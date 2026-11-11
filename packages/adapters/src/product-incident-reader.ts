import {GitHubAdapter} from './github-adapter.js';
import type {IncidentReader,IncidentSource} from '../../core/src/product-incidents.js';

/** Reuses the existing GitHub credential broker; never writes to a remote system. */
export function productIncidentReader(options:{
  tokenProvider:()=>Promise<string|undefined>;fetchImpl?:typeof fetch;
}):IncidentReader {
  return async(source:IncidentSource)=>{
    if(!source.repository||!source.ref||!source.path)throw new Error('invalid_source');
    const token=await options.tokenProvider();
    if(!token)throw new Error('needs_auth');
    const [owner,repo]=source.repository.split('/');
    if(!owner||!repo)throw new Error('invalid_source');
    const github=new GitHubAdapter({token,fetchImpl:async(input,init)=>{
      const url=typeof input==='string'?new URL(input):input instanceof URL?input:new URL(input.url);
      if(url.origin!=='https://api.github.com')throw new Error('invalid_source');
      const response=await (options.fetchImpl??fetch)(input,{...init,redirect:'error',signal:AbortSignal.timeout(10_000)});
      const chunks:Uint8Array[]=[];let size=0;
      const reader=response.body?.getReader();
      if(reader) {
        try {
          for(;;) {
            const next=await reader.read();if(next.done)break;
            size+=next.value.byteLength;
            if(size>1024*1024)throw new Error('invalid_source');
            chunks.push(next.value);
          }
        }finally{await reader.cancel().catch(()=>undefined);}
      }
      return new Response(Buffer.concat(chunks),{status:response.status,headers:{'content-type':'application/json'}});
    }});
    const result=await github.execute({tool:'github',action:'file.read',input:{owner,repo,path:source.path,ref:source.ref}},()=>undefined);
    if(!result.ok)throw new Error('source_unavailable');
    const content=result.output?.content;
    if(typeof content!=='string')throw new Error('invalid_source');
    return {content,sourceRef:'https://github.com/'+source.repository+'/blob/'+encodeURIComponent(source.ref)+'/'+source.path.split('/').map(encodeURIComponent).join('/')};
  };
}
