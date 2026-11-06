'use strict';
// Safari-sized regression for approved Kendra stage. Chromium/SwiftShader is
// not proof of iPhone GPU or cinematic GLB fidelity; it checks geometry and taps.
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const { chromium }=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const shotDir=process.env.SHOTS_DIR || path.join(__dirname,'../dist/shots/edge-safe');
fs.mkdirSync(shotDir,{recursive:true});
const browserArgs=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files'];
(async()=>{
 const browser=await chromium.launch({args:browserArgs});
 try{
  for(const skin of ['a','b']){
   for(const [w,h] of [[390,844],[430,932]]){
    const page=await browser.newPage({viewport:{width:w,height:h},deviceScaleFactor:1,isMobile:true,hasTouch:true});
    const errors=[];
    page.on('pageerror',e=>errors.push(String(e)));
    await page.route('**/api.open-meteo.com/**',route=>route.abort());
    const file=path.resolve(__dirname,'../dist/Janus-'+(skin==='a'?'A-Obsidiana':'B-Platino')+'-interactivo.html');
    await page.goto('file://'+file+'#companero',{waitUntil:'domcontentloaded'});
    await page.locator('.vb-companero .cpst3').waitFor({state:'visible',timeout:30000});
    await page.waitForTimeout(1300);
    const bounds=await page.evaluate(()=>{
      const node=(s)=>document.querySelector(s);
      const rect=(s)=>{const r=node(s)?.getBoundingClientRect();return r?{top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height}:null};
      const edge=node('[data-kendra-edge]'),visible=!!edge&&!edge.hidden;
      return {stage:rect('.vb-companero .cpst3'),footer:rect('.cpbar'),
        edge:visible?rect('[data-kendra-edge]'):null,
        controls:rect('.cp-edge-tools'),
        tab:rect('.cptabs')};
    });
    assert.ok(bounds.stage&&bounds.footer&&bounds.tab,'Kendra stage and learning panel exist');
    if(bounds.edge){
      assert.ok(bounds.edge.left>=bounds.stage.left-3 && bounds.edge.right<=bounds.stage.right+3,'avatar inside scene width');
      assert.ok(bounds.edge.top>=bounds.stage.top-3 && bounds.edge.bottom<=bounds.footer.top+3,'avatar above selection and learning');
      assert.ok(bounds.edge.bottom<=bounds.tab.top+3,'avatar never over learning tabs');
      if(bounds.controls) assert.ok(bounds.edge.top>=bounds.controls.bottom-3,'avatar below stage controls');
    }
    await page.screenshot({path:path.join(shotDir,`kendra-${skin}-${w}.png`),fullPage:true});
    await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
    await page.waitForTimeout(350);
    if(bounds.edge){
      const hidden=await page.evaluate(()=>{const el=document.querySelector('[data-kendra-edge]');return !el || el.hidden || getComputedStyle(el).display==='none';});
      assert.ok(hidden,'avatar hides after leaving stage');
    }
    // Check that the learning panel remains interactive and readable.
    const tabs=page.locator('.cptab');
    assert.ok(await tabs.count()>=6,'all six companion tabs remain');
    await tabs.nth(1).click({timeout:10000});
    assert.ok(await page.locator('.cptabs').isVisible(),'tab interaction remains enabled');
    assert.equal(errors.length,0,'no fatal browser errors: '+errors.join(' | '));
    await page.close();
    console.log('PASS',skin,w+'x'+h,bounds.edge?'3D visible and bounded':'GPU fallback / 3D unavailable');
   }
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
