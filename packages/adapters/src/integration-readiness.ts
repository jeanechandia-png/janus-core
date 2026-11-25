import { parseProductFeed, type ProductFeedReader, type ProductFeedSource } from '../../core/src/product-feeds.js';

export type ReadinessState = 'verified' | 'needs_auth' | 'denied' | 'unavailable' | 'invalid_response' | 'not_connected' | 'stale_response' | 'not_configured';
export interface ReadinessResult { service:string; state:ReadinessState }
export interface ReadinessDeps {
  token:(service:string,scopes:readonly string[])=>Promise<string|undefined>;
  readProduct:ProductFeedReader;
  products:readonly ProductFeedSource[];
  accounts?:readonly {accountId:string; credentialService:string; address:string}[];
  fetchImpl?:typeof fetch;
  now?:()=>number;
}
// Fixed read-only endpoints, minimal fields; never return provider payloads or tokens.
export async function verifyReadiness(deps:ReadinessDeps):Promise<ReadinessResult[]> {
  const google=async(service:string,url:string,scope:string,field:string,credential='google-workspace',expectedAddress?:string):Promise<ReadinessResult>=>{
    let state:ReadinessState='unavailable';
    try {
      const token=await deps.token(credential,[scope]);
      if(!token?.trim())return {service,state:'needs_auth'};
      const response=await (deps.fetchImpl??fetch)(url,{method:'GET',redirect:'error',signal:AbortSignal.timeout(10000),headers:{authorization:'Bearer '+token,accept:'application/json'}});
      if(response.status===401)state='needs_auth';
      else if(response.status===403)state='denied';
      else if(response.ok){
        const body:unknown=await response.json();
        const value=body!==null&&typeof body==='object'?(body as Record<string,unknown>)[field]:undefined;
        state=(field==='messagesTotal'?Number.isSafeInteger(value)&&Number(value)>=0:field==='kind'&&value==='calendar#events')?'verified':'invalid_response';
        if(state==='verified'&&expectedAddress){
          const actual=(body as Record<string,unknown>).emailAddress;
          if(typeof actual!=='string'||actual.toLowerCase()!==expectedAddress.toLowerCase())state='denied';
        }
      }
    }catch{ /* no raw provider errors, URLs, identifiers or token values */ }
    return {service,state};
  };
  const product=async(source:ProductFeedSource):Promise<ReadinessResult>=>{
    const service=source.productId;
    if(!source.url)return {service,state:'not_connected'};
    try {const feed=parseProductFeed(await deps.readProduct(source),service);
      const age=(deps.now?.()??Date.now())-Date.parse(feed.generatedAt);
      return {service,state:!Number.isFinite(age)?'invalid_response':age < -60_000||age > 300_000?'stale_response':'verified'};}
    catch(error){const code=error instanceof Error?error.message:'';
      return {service,state:code==='needs_auth'?'needs_auth':code==='denied'?'denied':code==='not_configured'?'not_configured':code==='not_connected'?'not_connected':code==='feed_invalid'||code==='invalid_source'?'invalid_response':'unavailable'};
    }
  };
  return Promise.all([
    google('gmail','https://gmail.googleapis.com/gmail/v1/users/me/profile?fields=messagesTotal','gmail.readonly','messagesTotal'),
    google('calendar','https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=1&fields=kind','calendar.events.readonly','kind'),
    ...(deps.accounts??[]).flatMap(account=>[
      google('gmail:'+account.accountId,'https://gmail.googleapis.com/gmail/v1/users/me/profile?fields=messagesTotal,emailAddress','gmail.readonly','messagesTotal',account.credentialService,account.address),
      google('calendar:'+account.accountId,'https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=1&fields=kind','calendar.events.readonly','kind',account.credentialService)
    ]),
    ...deps.products.map(product)
  ]);
}
