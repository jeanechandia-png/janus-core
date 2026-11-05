import { createHash, randomUUID } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { basename, extname, join, relative, resolve, sep } from 'node:path';
import type { ToolAdapter, ToolProgress, ToolRequest, ToolResult } from '../../gateways/src/contracts.js';
import type { ProjectResourceRef, ProjectWorkspace } from '../../core/src/project-context.js';

/**
 * LEGO media-inbox: permite a JANUS recibir por voz la instrucción de agregar
 * imágenes YA recibidas en su bandeja local. Registra el recurso en SQLite y
 * prepara la revisión, SIN tocar una landing o publicar datos sin autorización.
 *
 * External landing publish stays a separate explicitly approved deployment.
 * No image model, payment, connection, or code change is required for staging.
 */
export interface LocalMediaToolOptions {
  inboxRoot:string;
  libraryRoot:string;
  store:{
    getProjectWorkspace(id:string):ProjectWorkspace|null;
    upsertProjectResource(resource:ProjectResourceRef):void;
    listProjectResources(projectId:string):ProjectResourceRef[];
  };
  now?:()=>Date;
}
export class LocalMediaToolAdapter implements ToolAdapter {
  readonly name='media';
  readonly capabilities=['images.list','image.inspect','image.stage.apply'];
  private readonly inbox:string;
  private readonly library:string;
  private readonly now:()=>Date;
  constructor(private readonly opts:LocalMediaToolOptions) {
    this.inbox=resolve(opts.inboxRoot);
    this.library=resolve(opts.libraryRoot);
    this.now=opts.now??(()=>new Date());
  }
  async execute(request:ToolRequest,onProgress:(x:ToolProgress)=>void|Promise<void>):Promise<ToolResult> {
    try {
      if(!this.capabilities.includes(request.action)) return {ok:false,error:'Acción multimedia no permitida.'};
      await onProgress({phase:'progress',message:'Bandeja local de imágenes',percent:25});
      if(request.action==='images.list') return this.list();
      const name=fileName(request.input.fileName);
      const image=this.inspect(name);
      if(request.action==='image.inspect') return {ok:true,output:{...safe(image),reply:'Imagen disponible localmente; no se ha publicado.'}};
      return this.stage(image,request);
    } catch(e) {
      return {ok:false,error:e instanceof MediaError?e.message:'Imagen no procesable en la bandeja local.'};
    }
  }
  private list():ToolResult {
    const names=existsSync(this.inbox)?readdirSync(this.inbox).filter(x=>/^[a-z0-9][a-z0-9_.-]{0,100}$/i.test(x)).slice(0,100):[];
    const images=names.flatMap(name=>{try{return [safe(this.inspect(name))];}catch{return [];}});
    return {ok:true,output:{count:images.length,images,reply:'Imágenes que Janus ya tiene en su bandeja privada. No se han subido a ninguna web.'}};
  }
  private inspect(name:string) {
    if(!existsSync(this.inbox))throw new MediaError('No existe todavía la bandeja privada de imágenes.');
    const parent=realpathSync(this.inbox),file=realpathSync(join(this.inbox,name));
    const rel=relative(parent,file);
    if(rel.startsWith('..'+sep)||rel==='..'||rel.includes(sep))throw new MediaError('La imagen debe estar en la bandeja local aprobada.');
    const info=statSync(file);
    if(!info.isFile()||info.size<12||info.size>25*1024*1024)throw new MediaError('La imagen debe ser un archivo válido de 12 bytes a 25 MB.');
    const bytes=readFileSync(file);
    const ext=extname(name).toLowerCase();
    let mime='';
    if(ext==='.png' && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) mime='image/png';
    else if((ext==='.jpg'||ext==='.jpeg') && bytes[0]===255&&bytes[1]===216&&bytes[2]===255) mime='image/jpeg';
    else if(ext==='.webp' && bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP') mime='image/webp';
    if(!mime)throw new MediaError('Solo PNG, JPG y WebP auténticos; no se aceptan ejecutables renombrados.');
    return {name,path:file,size:info.size,mime,sha256:createHash('sha256').update(bytes).digest('hex'),ext};
  }
  private stage(image:ReturnType<LocalMediaToolAdapter['inspect']>,request:ToolRequest):ToolResult {
    const auth=request.authorization;
    if(!auth?.privileged||auth.principalId!=='founder'||!/^[a-f0-9]{64}$/i.test(auth.authorityDecisionHash||'')
       ||!request.idempotencyKey?.trim())
      return {ok:false,error:'Agregar imágenes requiere permiso auditado del Founder y confirmación biométrica.'};
    const projectId=projectIdOf(request.input.projectId);
    const project=this.opts.store.getProjectWorkspace(projectId);
    if(!project) return {ok:false,error:'El proyecto de destino no existe en Janus. No se creó una web nueva.'};
    const id='media:'+createHash('sha256').update(projectId+':'+image.sha256).digest('hex').slice(0,32);
    const prior=this.opts.store.listProjectResources(projectId).find(x=>x.id===id);
    if(prior) return {ok:true,output:{resourceId:id,unchanged:true,staged:true,published:false,reply:'Imagen ya registrada; no se ha duplicado.'}};
    const folder=join(this.library,projectId);
    mkdirSync(folder,{recursive:true,mode:0o700});
    const target=join(folder,image.sha256+image.ext);
    if(!existsSync(target)) copyFileSync(image.path,target);
    const bytes=readFileSync(target);
    if(createHash('sha256').update(bytes).digest('hex')!==image.sha256)
      throw new MediaError('La copia local no supera la verificación de integridad SHA-256.');
    const record:ProjectResourceRef={
      id,projectId,name:image.name,source:'local',sourceRef:target,createdAt:this.now().toISOString(),
      addedBy:'founder',mimeType:image.mime,checksum:image.sha256,
      metadata:{kind:'image',stage:'local_review',published:false,source:'founder_inbox',
        operationKey:request.idempotencyKey,bytes:image.size},
    };
    this.opts.store.upsertProjectResource(record);
    return {ok:true,output:{resourceId:id,projectId,name:image.name,checksum:image.sha256,
      staged:true,published:false,
      reply:'Imagen incorporada al proyecto local y verificada. Todavía NO se ha publicado; la vista previa y el despliegue son pasos separados.',
    }};
  }
}
function safe(image:{name:string;size:number;mime:string;sha256:string}) {
  return {fileName:image.name,size:image.size,mimeType:image.mime,sha256:image.sha256};
}
function fileName(value:unknown):string {
  if(typeof value!=='string'||!value.trim())throw new MediaError('Indica el nombre exacto de una imagen de la bandeja local.');
  const name=value.trim();
  if(name!==basename(name)||! /^[a-z0-9][a-z0-9_.-]{0,100}$/i.test(name)||name.includes('..'))
    throw new MediaError('Nombre de archivo inseguro.');
  return name;
}
function projectIdOf(value:unknown):string {
  if(typeof value!=='string'||!/^[a-z][a-z0-9_-]{2,79}$/i.test(value))throw new MediaError('Indica un identificador de proyecto válido.');
  return value;
}
class MediaError extends Error {}
