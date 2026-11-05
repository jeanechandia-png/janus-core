import assert from 'node:assert/strict';
import test from 'node:test';
import {pollElevenLabs, pollOpenAi, pollBillingSources} from '../packages/core/src/provider-billing-collector.js';

const NOW = new Date('2026-11-05T12:00:00.000Z');
function fakeFetch(routes: Record<string, {body: unknown; status?: number; contentType?: string}>): typeof fetch {
  return (async (request: string | URL | Request) => {
    const url = String(request);
    const key = Object.keys(routes).find(k => url.includes(k));
    if (!key) throw new Error('Unexpected outbound request: ' + url);
    const r=routes[key]!;
    return new Response(r.contentType==='xml' ? String(r.body) : JSON.stringify(r.body),{
      status:r.status??200,headers:{'Content-Type':r.contentType==='xml'?'application/xml':'application/json'}});
  }) as typeof fetch;
}
test('ElevenLabs: separa crédito workspace de caracteres, nunca convierte créditos a euros',async ()=>{
 const fetcher=fakeFetch({
   '/v1/user/subscription':{body:{tier:'creator',status:'active',character_count:90,
     character_limit:100,next_character_count_reset_unix:1794200000,
     has_open_invoices:false,current_overage:{amount:'0',currency:'usd'}}},
   '/v1/workspace/analytics/query/usage-by-product-over-time':{
     body:{columns:['time','credits'],column_units:['ms','credits'],
       rows:[[Date.parse('2026-11-04T00:00:00Z'),60],
         [Date.parse('2026-11-05T00:00:00Z'),30]]}},
 });
 const result=await pollElevenLabs({ELEVENLABS_FINOPS_API_KEY:'FAKE_FOR_TEST',
   FINOPS_ELEVENLABS_BUDGET_EUR:'30'} as NodeJS.ProcessEnv,fetcher,NOW);
 const last=result.readings.at(-1)!;
 assert.equal(last.metrics?.charactersUsed,90);
 assert.equal(last.metrics?.charactersLimit,100);
 assert.equal(last.metrics?.creditsUsed,null);
 assert.equal(last.metrics?.spentEur,null);
 assert.equal(last.metrics?.creditsThisMonth,90);
 assert.equal(last.metrics?.budgetEur,30);
 assert.equal(result.readings[0]?.metrics?.creditsToday,60);
 assert.equal(result.readings[1]?.metrics?.creditsToday,30);
 assert.equal(last.state,'degraded');
});
test('OpenAI: ingiere costes en USD y los convierte de forma identificada con BCE',async ()=>{
 const fetcher=fakeFetch({
  'eurofxref-daily.xml':{body:"<gesmes:Envelope><Cube><Cube time='2026-11-04'><Cube currency='USD' rate='1.2'/></Cube></Cube></gesmes:Envelope>",contentType:'xml'},
  '/v1/organization/costs':{body:{data:[
   {start_time:Math.floor(Date.parse('2026-11-04T00:00:00Z')/1000),results:[{amount:{value:0.48,currency:'usd'}}]},
   {start_time:Math.floor(Date.parse('2026-11-05T00:00:00Z')/1000),results:[{amount:{value:0.24,currency:'usd'}}]}
  ],has_more:false,next_page:null}},
 });
 const result=await pollOpenAi({OPENAI_FINOPS_ADMIN_KEY:'FAKE_FOR_TEST',FINOPS_OPENAI_BUDGET_EUR:'10'} as NodeJS.ProcessEnv,fetcher,NOW);
 const last=result.readings.at(-1)!;
 assert.equal(last.metrics?.spentEur,0.6);
 assert.equal(last.metrics?.exchangeUsdPerEur,1.2);
 assert.match(String(last.source),/ECB 2026-11-04/);
 assert.deepEqual(result.readings.slice(0,2).map(x=>x.metrics?.dailySpendEur),[0.4,0.2]);
});
test('No hay credenciales: no inventar datos ni realizar llamadas',async ()=>{
 let calls=0;
 const fetcher=(async()=>{calls++;throw new Error('No debería llamarse');}) as typeof fetch;
 const result=await pollBillingSources({} as NodeJS.ProcessEnv,fetcher,NOW);
 assert.equal(calls,0);
 assert.equal(result.results.length,0);
 assert.deepEqual(result.missing.map(x=>x.status),['not_configured','not_configured']);
});
test('API fallida: falla cerrada, sin exponer ningún secreto ni generar cargo',async ()=>{
 const result=await pollBillingSources({OPENAI_FINOPS_ADMIN_KEY:'PRIVATE_TEST_SECRET'} as NodeJS.ProcessEnv,
   (async()=>new Response('',{status:403})) as typeof fetch,NOW);
 assert.equal(result.results.length,0);
 assert.equal(result.missing[0]?.status,'not_configured');
 assert.equal(result.missing[1]?.status,'unavailable');
 assert.ok(!JSON.stringify(result).includes('PRIVATE_TEST_SECRET'));
});
