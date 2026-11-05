'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../src/spend.js'), 'utf8');
function setup() {
  const sandbox = { TABS:[], VIEWS:{}, frame(_id,_sub,_model,body){ return body; },
    esc(x){return String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');},
    Intl, Number, Date, Math, Array, String, RegExp, JSON };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox;
}
test('spend tab integrates with original routes without inventing EUR totals', () => {
  const ctx=setup();
  assert.equal(ctx.TABS.length,1);
  assert.equal(ctx.TABS[0][0],'consumos');
  const html=ctx.VIEWS.consumos({},null,'');
  assert.match(html,/POR CONFIRMAR/);
  assert.match(html,/Sin lecturas|Sin conexión|Sin datos/i);
  assert.doesNotMatch(html,/€0[,.]00/);
});
test('detail view creates an SVG using observations only; unconnected providers remain unknown', () => {
  const ctx=setup();
  vm.runInContext("SPEND.state='ready';SPEND.report={verifiedProviders:1,alerts:1,totalCostEUR:null,providers:[{id:'elevenlabs',name:'ElevenLabs',state:'verified',alert:'high',used:90,limit:100,unit:'caracteres',percent:90,overageEUR:null,totalCostEUR:null,resetAt:null,overageEnabled:null,source:'API oficial',history:[{date:'2026-11-04',used:60,limit:100},{date:'2026-11-05',used:90,limit:100}]},{id:'openai-api',name:'OpenAI API',state:'not_connected',alert:'unknown',totalCostEUR:null,history:[],note:'Sin datos'}]}",ctx);
  const html=ctx.VIEWS.consumos({},null,'elevenlabs');
  assert.match(html,/<svg/);
  assert.match(html,/2026-11-04/);
  assert.match(html,/2026-11-05/);
  assert.match(html,/OpenAI API/);
  assert.match(html,/NO VERIFICADO/);
  assert.match(html,/90 %/);
  assert.match(html,/POR CONFIRMAR/);
});
