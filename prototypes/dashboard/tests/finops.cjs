'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/platform-finops.js'), 'utf8');
const htmlEscape = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;');
function createFinOps(data) {
  const scope = {
    window: data ? { JANUS_FINOPS_SNAPSHOT: data } : {},
    location: { protocol: 'file:' },
    goAttr: (route) => ' data-go="' + htmlEscape(route) + '"',
    esc: htmlEscape,
    frame: (_id, _sub, _model, body) => body,
    Intl, Date,
  };
  return vm.runInNewContext(source + '\nFinOps;', scope);
}
test('datos ausentes se presentan como desconocidos y nunca como importe cero/verde', async () => {
  const fin = createFinOps(null);
  await fin.load();
  assert.match(fin.chip(), /fi-grey/);
  assert.match(fin.detail('elevenlabs', {}), /Sin verificar/);
  assert.match(fin.detail('elevenlabs', {}), /No se representan importes ficticios/);
});
test('se usa el mayor porcentaje entre presupuesto en EUR y créditos', async () => {
  const fin = createFinOps({
    generatedAt: new Date().toISOString(),
    providers: [{id:'elevenlabs',name:'ElevenLabs',source:'prueba',
      verifiedAt: new Date().toISOString(), budgetEur:20,spentEur:14.5,
      creditsUsed:90,creditsLimit:100,
      daily:[{date:'2026-11-04',eur:14.5}],
      monthly:[{month:'2026-11',eur:14.5}]}],
  });
  await fin.load();
  assert.match(fin.chip(), /fi-red/);
  const detail=fin.detail('elevenlabs',{});
  assert.match(detail, /Consumo diario/);
  assert.match(detail, /Evolución mensual/);
  assert.match(detail, /14,50/);
});
test('plataformas sin suscripción comprobada conservan estado pendiente', async () => {
  const fin = createFinOps(null);
  await fin.load();
  const html = fin.detail('', {});
  for (const platform of ['OpenAI API','ChatGPT','Claude','Gemini',
    'Google Workspace','Hostinger','Vercel','Netlify','Supabase','WhatsApp']) {
    assert.ok(html.includes(platform), 'falta ' + platform);
  }
  assert.match(html, /plataformas\/elevenlabs/);
});