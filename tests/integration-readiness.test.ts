import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyReadiness } from '../packages/adapters/src/integration-readiness.js';

test('readiness: checks real response contracts without disclosing tokens or provider data',async()=>{
 const urls:string[]=[];
 const result=await verifyReadiness({token:async(_service,scopes)=>scopes.includes('gmail.readonly')?'secret-token':undefined,
  products:[{productId:'iba',name:'IBA',url:'https://example.com/feed',tokenEnv:'FEED'},{productId:'web',name:'Web'}],
  readProduct:async()=>({schemaVersion:1,productId:'iba',generatedAt:new Date().toISOString(),customers:{active:0,trial:0},requests:[]}),
  fetchImpl:async(input,init)=>{urls.push(String(input));assert.equal(init?.method,'GET');assert.equal(init?.redirect,'error');return new Response(JSON.stringify({messagesTotal:2,emailAddress:'private@example.com'}));}
 });
 assert.equal(urls.length,1);
 assert.deepEqual(result,[{service:'gmail',state:'verified'},{service:'calendar',state:'needs_auth'},{service:'iba',state:'verified'},{service:'web',state:'not_connected'}]);
 assert.doesNotMatch(JSON.stringify(result),/secret-token|private@example/);
});
test('readiness: forbidden and malformed responses never count as verified',async()=>{
 const result=await verifyReadiness({token:async()=> 'token',products:[],readProduct:async()=>null,
 fetchImpl:async(input)=>String(input).includes('gmail')?new Response('',{status:403}):new Response('{}')});
 assert.deepEqual(result.map(x=>x.state),['denied','invalid_response']);
});

test('per-account verification refuses mismatched Gmail identity and never returns an address',async()=>{
 const result=await verifyReadiness({token:async service=>service==='google-workspace:business'?'token':undefined,products:[],readProduct:async()=>null,accounts:[{accountId:'business',credentialService:'google-workspace:business',address:'owner@example.com'}],fetchImpl:async input=>String(input).includes('gmail')?new Response(JSON.stringify({messagesTotal:1,emailAddress:'wrong@example.com'})):new Response(JSON.stringify({kind:'calendar#events'}))});
 assert.deepEqual(result,[{service:'gmail',state:'needs_auth'},{service:'calendar',state:'needs_auth'},{service:'gmail:business',state:'denied'},{service:'calendar:business',state:'verified'}]);
 assert.doesNotMatch(JSON.stringify(result),/example.com|token/);
});
