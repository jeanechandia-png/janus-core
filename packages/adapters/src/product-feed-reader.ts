import type {ProductFeedReader,ProductFeedSource} from '../../core/src/product-feeds.js';

/**
 * Lee el feed de solo lectura de un producto (IBA, ChatBox…). Nunca escribe en el producto.
 * - Solo https y solo la URL registrada en config/product-feeds.json; no sigue redirecciones.
 * - El token sale de la variable de entorno indicada en `tokenEnv` (nunca de config, SQLite ni código).
 * - Tiempo y tamaño acotados (10 s, 512 KB).
 */
export function productFeedReader(options:{
  env?:Record<string,string|undefined>;fetchImpl?:typeof fetch;
}={}):ProductFeedReader {
  return async(source:ProductFeedSource)=>{
    if(!source.url||!source.tokenEnv)throw new Error('not_connected');
    const url=new URL(source.url);
    if(url.protocol!=='https:')throw new Error('invalid_source');
    const token=(options.env??process.env)[source.tokenEnv]?.trim();
    if(!token||token.length<32)throw new Error('needs_auth');
    const response=await (options.fetchImpl??fetch)(url,{
      method:'GET',redirect:'error',signal:AbortSignal.timeout(10_000),
      headers:{authorization:'Bearer '+token,accept:'application/json'},
    });
    if(response.status===401||response.status===403)throw new Error('needs_auth');
    if(response.status===503)throw new Error('not_configured');
    if(!response.ok)throw new Error('source_unavailable');
    const chunks:Uint8Array[]=[];let size=0;
    const reader=response.body?.getReader();
    if(reader) {
      try {
        for(;;) {
          const next=await reader.read();if(next.done)break;
          size+=next.value.byteLength;
          if(size>512*1024)throw new Error('invalid_source');
          chunks.push(next.value);
        }
      }finally{await reader.cancel().catch(()=>undefined);}
    }
    try {return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;}
    catch {throw new Error('invalid_source');}
  };
}
