const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async()=>{const b=await chromium.launch({...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), args:['--no-sandbox']});
const p=await (await b.newContext({viewport:{width:1194,height:834}})).newPage(); const errs=[];p.on('pageerror',e=>errs.push(String(e)));
await p.route('**/api.open-meteo.com/**',r=>r.abort());
await p.goto('file://' + require('path').resolve(process.env.DASH_FILE || require('path').join(__dirname, '../dist/Janus-A-Obsidiana-interactivo.html')));await p.waitForTimeout(400);
const L=[];const t=async(n,f)=>{try{await f();await p.waitForTimeout(300);L.push(n+': '+await p.evaluate(()=>location.hash+' | '+document.title));}catch(e){L.push(n+' FALLO '+e.message.split('\n')[0]);}};
await t('clima desde portada', ()=>p.click('.jh-card [data-go=clima]'));
await t('hora 17h', ()=>p.evaluate(()=>{location.hash='#clima/h17'}));
await t('métrica lluvia', ()=>p.click('[data-act=clMetric][data-arg=r]'));
await t('día 3', ()=>p.click('[data-act=clDay][data-arg="3"]'));
await t('slider lluvia 80', ()=>p.$eval('input[data-set=rainBad]',e=>{e.value=80;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))}));
L.push('  sugerencia tras umbral 80: '+await p.$eval('.sug',e=>e.textContent));
await t('volver', ()=>p.click('.back'));
L.push('  clima en portada: '+await p.$eval('.jh-card [data-go=clima]',e=>e.textContent));
await t('prioridades', ()=>p.click('.jh-nav [data-go=prioridades]'));
await t('atendido', ()=>p.click('[data-act=mail] >> nth=0'));
await t('Esc', ()=>p.keyboard.press('Escape'));
L.push('  navegación principal: '+await p.locator('.jh-nav > *').count());
await t('clientes desde portada', ()=>p.click('.jh-nav [data-go=clientes]'));
await t('tab janus', ()=>p.click('.tb2[data-go=janus]'));
await t('aprobar', ()=>p.click('[data-act=appr] >> nth=0'));
await t('Mi día añadir', async()=>{await p.click('.tb2[data-go=dia]');await p.fill('[data-f=evT]','Prueba');await p.click('[data-act=evAdd]');});
L.push('  eventos personal: '+await p.$eval('.vb-dia .cd >> nth=0',e=>e.querySelector('.mt').textContent));
await t('reload persiste', ()=>p.reload());
L.push('  tras recarga: '+await p.$eval('.vb-dia .cd >> nth=0',e=>e.querySelector('.mt').textContent));
console.log(L.join('\n'));console.log(errs.length?'ERRORES '+errs.join('|'):'sin errores JS');await b.close();
// Este smoke debe FALLAR en CI ante un clic roto o error de ejecución; la versión anterior solo imprimía FALLO y devolvía exit 0.
if (errs.length || L.some(line => line.includes(' FALLO '))) { console.error('JANUS: navegación o control funcional fallido'); process.exitCode = 1; }
})();
