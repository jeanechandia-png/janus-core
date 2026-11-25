import { parseProductFeed, type ProductFeedReader, type ProductFeedSource } from '../../core/src/product-feeds.js';

export type ReadinessState = 'verified' | 'needs_auth' | 'denied' | 'unavailable' | 'invalid_response' | 'not_connected';
export interface ReadinessResult { service:string; state:ReadinessState }
export interface ReadinessDeps {
  token:(service:string,scopes:readonly string[])=>Promise<string|undefined>;
  readProduct:ProductFeedReader;
  products:readonly ProductFeedSource[];
  fetchImpl?:typeof fetch;
}
// Fixed read-only endpoints, minimal fields; never return provider payloads or tokens.
export async function verifyReadiness(deps:ReadinessDeps):Promise<ReadinessResult[]> {
  const google=async(service:string,url:string,scope:string,field:string):Promise<ReadinessResult>=>{
    let state:ReadinessState='unavailable';
    try {
      const token=await deps.token('google-workspace',[scope]);
      if(!token?.trim())return {service,state:'needs_auth'};
      const response=await (deps.fetchImpl??fetch)(url,{method:'GET',redirect:'error',signal:AbortSignal.timeout(10000),headers:{authorization:'Bearer '+token,accept:'application/json'}});
      if(response.status===401)state='needs_auth';
      else if(response.status===403)state='denied';
      else if(response.ok){
        const body:unknown=await response.json();
        state=body!==null&&typeof body==='object'&&Object.hasOwn(body,field)?'verified':'invalid_response';
      }
    }catch{ /* no raw provider errors, URLs, identifiers or token values */ }
    return {service,state};
  };
  const product=async(source:ProductFeedSource):Promise<ReadinessResult>=>{
    const service=source.productId;
    if(!source.url)return {service,state:'not_connected'};
    try {parseProductFeed(await deps.readProduct(source),service);return {service,state:'verified'};}
    catch(error){const code=error instanceof Error?error.message:'';
      return {service,state:code==='needs_auth'?'needs_auth':code==='feed_invalid'||code==='invalid_source'?'invalid_response':'unavailable'};
    }
  };
  return Promise.all([
    google('gmail','https://gmail.googleapis.com/gmail/v1/users/me/profile?fields=messagesTotal','gmail.readonly','messagesTotal'),
    google('calendar','https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=1&fields=kind','calendar.events.readonly','kind'),
    ...deps.products.map(product)
  ]);
}
