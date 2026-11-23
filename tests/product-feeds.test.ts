import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ProductFeedSync,parseProductFeed,validateProductFeedSources,type ProductFeedNotice} from '../packages/core/src/product-feeds.js';
import {productFeedReader} from '../packages/adapters/src/product-feed-reader.js';

const TOKEN='synthetic-janus-feed-token-0123456789abcdef';
const iba={productId:'infinity-business-assistant',name:'IBA',url:'https://iba.example/api/v1/janus/feed',tokenEnv:'JANUS_FEED_TOKEN_IBA'};
const feed=(requests:unknown[],customers={active:2,trial:1})=>({schemaVersion:1,productId:'infinity-business-assistant',generatedAt:'2026-11-23T19:00:00.000Z',customers:{...customers,total:99},requests});
const req=(id:string,createdAt:string,status='new')=>({id,createdAt,status,name:'Synthetic Visitor',contact:'visitor@example.test',message:'[IBA landing · Core · pago fraccionado · NL · es] Hola'});

test('the registered product feeds are valid and secrets are referenced by environment name only',()=>{
  const config=JSON.parse(readFileSync('config/product-feeds.json','utf8')) as {products:any[];intervalMs:number};
  validateProductFeedSources(config.products);
  assert.ok(config.intervalMs>=30_000);
  assert.doesNotMatch(JSON.stringify(config),/token"\s*:\s*"(?!JANUS_)/i,'no secret values in the registry');
  assert.throws(()=>validateProductFeedSources([{...iba,url:'http://iba.example/feed'}]),/feed_source_registry_invalid/);
  assert.throws(()=>validateProductFeedSources([{...iba,tokenEnv:undefined}]),/feed_source_registry_invalid/);
  assert.throws(()=>validateProductFeedSources([iba,iba]),/feed_source_registry_invalid/);
});

test('a feed that breaks the contract is rejected whole and totals are recomputed by JANUS',()=>{
  const parsed=parseProductFeed(feed([req('m1','2026-11-23T19:00:00.000Z')]),'infinity-business-assistant');
  assert.deepEqual(parsed.customers,{active:2,trial:1,total:3},'the product cannot inflate the total');
  assert.throws(()=>parseProductFeed(feed([]),'infinity-chatbox'),/feed_invalid/,'a feed for another product is refused');
  assert.throws(()=>parseProductFeed(feed([{...req('m1','2026-11-23T19:00:00Z'),status:'deleted'}]),'infinity-business-assistant'),/feed_invalid/);
  assert.throws(()=>parseProductFeed(feed([],{active:-1,trial:0}),'infinity-business-assistant'),/feed_invalid/);
  const control=parseProductFeed(feed([{...req('m2','2026-11-23T19:00:00Z'),name:'A\u0000B'}]),'infinity-business-assistant');
  assert.equal(control.requests[0]?.name,'A B','control characters never reach the dashboard');
});

test('new requests notify the founder once; old requests are not re-announced when JANUS starts',async()=>{
  let now=new Date('2026-11-23T20:00:00.000Z');
  let current:unknown=feed([req('old','2026-11-20T10:00:00.000Z'),req('recent','2026-11-23T19:55:00.000Z'),req('seen','2026-11-23T19:56:00.000Z','read')]);
  const notices:ProductFeedNotice[][]=[];
  const sync=new ProductFeedSync({sources:[iba,{productId:'infinityseed-group',name:'Web InfinitySeed'}],intervalMs:60_000,now:()=>now,
    read:async()=>current,onNew:(n)=>notices.push(n)});
  await sync.refreshIfDue(true);
  assert.deepEqual(notices.flat().map(n=>n.request.id),['recent'],'only new, recent requests at startup');
  current=feed([req('fresh','2026-11-23T20:01:00.000Z'),req('old','2026-11-20T10:00:00.000Z'),req('recent','2026-11-23T19:55:00.000Z')]);
  now=new Date('2026-11-23T20:02:00.000Z');
  await sync.refreshIfDue(true);
  assert.deepEqual(notices.flat().map(n=>n.request.id),['recent','fresh'],'each request is announced once');
  const snap=sync.snapshot();
  assert.equal(snap.products[0]?.state,'live');
  assert.equal(snap.products[0]?.newRequests,3);
  assert.equal(snap.products[1]?.state,'not_connected');
  assert.equal(snap.customers,3);
});

test('a failing product keeps its last data marked stale and never breaks the others',async()=>{
  let fail=false;
  const sync=new ProductFeedSync({sources:[iba],read:async()=>{if(fail)throw new Error('needs_auth');return feed([]);}});
  await sync.refreshIfDue(true);
  fail=true;await sync.refreshIfDue(true);
  const product=sync.snapshot().products[0]!;
  assert.equal(product.state,'stale');
  assert.deepEqual(product.customers,{active:2,trial:1,total:3});
});

test('the reader sends the bearer token from the environment, only over https, and maps product answers',async()=>{
  const calls:{url:string;auth:string|null;redirect?:string}[]=[];
  const fetchImpl=(async(input:URL,init:RequestInit)=>{calls.push({url:String(input),auth:new Headers(init.headers).get('authorization'),redirect:init.redirect});
    return new Response(JSON.stringify(feed([])),{status:200});}) as unknown as typeof fetch;
  const read=productFeedReader({env:{JANUS_FEED_TOKEN_IBA:TOKEN},fetchImpl});
  assert.equal((await read(iba) as any).productId,'infinity-business-assistant');
  assert.deepEqual(calls[0],{url:iba.url,auth:'Bearer '+TOKEN,redirect:'error'});
  await assert.rejects(productFeedReader({env:{},fetchImpl})(iba),/needs_auth/,'no token, no call');
  assert.equal(calls.length,1);
  const status=(code:number)=>productFeedReader({env:{JANUS_FEED_TOKEN_IBA:TOKEN},fetchImpl:(async()=>new Response('{}',{status:code})) as unknown as typeof fetch})(iba);
  await assert.rejects(status(401),/needs_auth/);
  await assert.rejects(status(503),/not_configured/);
  await assert.rejects(status(500),/source_unavailable/);
});
