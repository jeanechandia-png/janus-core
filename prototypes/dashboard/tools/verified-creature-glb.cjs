'use strict';
/**
 * Gate de publicación para GLB originales de Kendra. Sin PBR, huesos,
 * morphs, clips, evidencia visual y aprobación expresa: NO es un modelo final.
 * Sin dependencias ni servicios externos; el arte viaja dentro del HTML offline.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname,'..');
const ART = path.join(ROOT,'assets/approved');
const MODEL_DIR = path.join(ART,'models');
const IDS = Object.freeze(['lumi','bombo','musgo','nimbo']);
const BONES = ['root','hips','spine','chest','neck','head','jaw','eye_L','eye_R','hand_L','hand_R','foot_L','foot_R'];
const SOCKETS = ['sock_head','sock_face','sock_ears','sock_neck','sock_back','sock_torso','sock_hand_L','sock_hand_R','sock_foot_L','sock_foot_R'];
const MORPHS = ['alegre','contento','triste','enojado','sorprendido','blink_L','blink_R','mouth_open'];
const CLIPS = ['idle','saluda','celebra','piensa','camina','habla'];
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const isHash = (v) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const must = (test,message) => { if(!test) throw new Error('GLB no aprobado: '+message); };

function parseGLB(data) {
  must(Buffer.isBuffer(data) && data.length > 20,'archivo no binario');
  must(data.toString('ascii',0,4) === 'glTF','cabecera GLB incorrecta');
  must(data.readUInt32LE(4) === 2,'GLB debe ser glTF 2.0');
  must(data.readUInt32LE(8) === data.length,'longitud GLB incorrecta');
  must(data.readUInt32LE(16) === 0x4e4f534a,'JSON chunk obligatorio');
  const n = data.readUInt32LE(12);
  must(n > 32 && 20+n <= data.length,'JSON chunk inválido');
  const json = JSON.parse(data.subarray(20,20+n).toString('utf8').trim());
  must(json.asset && json.asset.version === '2.0','asset glTF 2.0 obligatorio');
  return json;
}
function missing(list,set){return list.filter(v=>!set.has(v));}
function inspectGLB(data) {
  const g = parseGLB(data), nodes = g.nodes || [], meshes = g.meshes || [];
  const bones = new Set((g.skins||[]).flatMap(s=>(s.joints||[]).map(i=>nodes[i]?.name).filter(Boolean)));
  const sockets = new Set(nodes.map(n=>n.name).filter(Boolean));
  const morphs = new Set(meshes.flatMap(m=>m.extras?.targetNames||[]));
  const clips = new Set((g.animations||[]).map(a=>a.name));
  const triangles = meshes.reduce((total,m)=>total+(m.primitives||[]).reduce((t,p)=>{
    must(p.mode === undefined || p.mode === 4,'topología no triangular');
    const acc = (g.accessors||[])[p.indices??p.attributes?.POSITION];
    must(acc && Number.isInteger(acc.count),'índices de malla ausentes');
    must(acc.count%3 === 0,'índices no divisibles por tres');
    return t+acc.count/3;
  },0),0);
  const missingFields={bones:missing(BONES,bones),sockets:missing(SOCKETS,sockets),
    morphs:missing(MORPHS,morphs),clips:missing(CLIPS,clips)};
  const hasPBR=(g.materials||[]).some(m=>!!m.pbrMetallicRoughness?.baseColorTexture);
  const hasNormal=(g.materials||[]).some(m=>!!m.normalTexture);
  return {triangles,skinned:(g.skins||[]).length>0,hasPBR,hasNormal,
    morphTargets:morphs.size,clips:clips.size,bones:bones.size,
    missing:missingFields,size:data.byteLength};
}
/**
 * La calidad estética no se deduce del test sintáctico. Requiere evidencia
 * de las 4 vistas, expresiones, pelo y accesorios; aceptación humana.
 */
function checkApproved(id,entry,sourceHashes) {
  must(IDS.includes(id),'identificador '+id);
  must(entry && entry.status==='approved','aprobación vigente ausente: '+id);
  must(isHash(entry.sha256),'SHA-256 faltante: '+id);
  must(entry.approvedBy==='Jean','responsable de aprobación no registrado: '+id);
  must(typeof entry.approvedAt==='string' && /^20\d\d-/.test(entry.approvedAt),'fecha de aprobación: '+id);
  must(entry.visualReview && entry.visualReview.fidelity==='approved' && entry.visualReview.iphoneSafari==='passed',
       'fidelidad visual y Safari físico pendientes: '+id);
  for(const name of ['front','side','back','face','accessories']){
    must(isHash(entry.visualReview.screenshots?.[name]),'captura revisada sin hash: '+id+'/'+name);
  }
  // No lock-in: commercial rights and a retained local license/receipt are
  // mandatory. A credit balance, active subscription or cloud validation can
  // NEVER be needed to display this character in JANUS CORE.
  const rights=entry.rights;
  must(rights && rights.commercialUse===true && rights.modification===true &&
    rights.redistributionInProducts===true,'derechos comerciales completos sin acreditar: '+id);
  must(rights.subscriptionRequiredForUse===false && rights.runtimeApiRequired===false &&
    rights.perUseCredits===false,'dependencia de créditos o proveedor para usar el GLB: '+id);
  must(typeof rights.provider==='string' && rights.provider.length>1 &&
    /^https:\/\//.test(rights.termsUrl||''),'proveedor y condiciones oficiales no documentados: '+id);
  const proofName='licenses/'+id+'.license.txt';
  must(rights.licenseEvidencePath===proofName && isHash(rights.licenseEvidenceSha256),
    'licencia comercial local faltante: '+id);
  const proofPath=path.join(MODEL_DIR,proofName);
  must(fs.existsSync(proofPath) && fs.statSync(proofPath).isFile(),
    'no existe copia de la licencia o recibo: '+id);
  must(sha256(fs.readFileSync(proofPath))===rights.licenseEvidenceSha256,
    'copia de licencia alterada: '+id);
  must(entry.sourceArtSha256===sourceHashes[id+'.webp'],'la fuente visual difiere del arte aprobado: '+id);
  const original=path.join(ART,id+'.webp');
  must(fs.existsSync(original),'la imagen original aprobada no está instalada: '+id);
  must(sha256(fs.readFileSync(original))===entry.sourceArtSha256,'la imagen original no coincide con el SHA oficial: '+id);
  const f = path.join(MODEL_DIR,id+'.glb');
  must(fs.existsSync(f),'no existe GLB '+id);
  const data=fs.readFileSync(f);
  must(sha256(data)===entry.sha256,'SHA-256 GLB no coincide: '+id);
  must(data.length<=15*1024*1024,'modelo excede 15 MiB: '+id);
  const report=inspectGLB(data);
  must(report.triangles>0 && report.triangles<=80000,'triángulos fuera del presupuesto para iPhone: '+id);
  must(report.skinned,'no tiene esqueleto animable: '+id);
  must(report.hasPBR && report.hasNormal,'materiales PBR y mapa de normales faltantes: '+id);
  for(const [kind,values] of Object.entries(report.missing)){
    must(values.length===0,kind+' incompletos ('+values.join(',')+'): '+id);
  }
  return {id,sha256:entry.sha256,bytes:data.length,report,data};
}
function collect({strict=false}={}) {
  const registry=JSON.parse(fs.readFileSync(path.join(MODEL_DIR,'REGISTRY.json'),'utf8'));
  const source=JSON.parse(fs.readFileSync(path.join(ART,'INDEX.json'),'utf8'));
  const out={},errors=[];
  for(const id of IDS){
    const entry=registry.characters?.[id];
    const f=path.join(MODEL_DIR,id+'.glb');
    if(!entry && !fs.existsSync(f)) continue;
    try {
      const v=checkApproved(id,entry,source.required_assets);
      out[id]={sha256:v.sha256,bytes:v.bytes,base64:v.data.toString('base64'),quality:'visual-approved-3d'};
    }catch(e){errors.push({id,error:String(e.message||e)});}
  }
  // No se ignora un modelo suelto, incompleto o distinto de la fuente.
  if(strict && (errors.length || Object.keys(out).length!==4))
    throw new Error('No se publican criaturas 3D finales: '+JSON.stringify({errors,loaded:Object.keys(out)}));
  return {models:out,errors,complete:Object.keys(out).length===4 && !errors.length};
}
module.exports={IDS,inspectGLB,checkApproved,collect,sha256,parseGLB};
if(require.main===module){
  const strict=process.argv.includes('--require-all');
  try {
    const r=collect({strict});
    console.log(JSON.stringify({complete:r.complete,models:Object.keys(r.models),errors:r.errors},null,2));
    if(r.errors.length || (strict&&!r.complete)) process.exitCode=1;
  }catch(e){console.error(e.message);process.exitCode=1;}
}
