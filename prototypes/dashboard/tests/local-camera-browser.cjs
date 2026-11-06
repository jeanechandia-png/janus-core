'use strict';
/* Browser-level camera interaction with Chromium fake camera; not an iPhone test. */
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox','--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream','--allow-file-access-from-files',
      '--use-angle=swiftshader','--enable-unsafe-swiftshader']
  });
  try {
    for (const skin of ['a','b']) {
      const file=path.resolve(__dirname,'../dist/Janus-'+
        (skin==='a'?'A-Obsidiana':'B-Platino')+'-interactivo.html');
      for (const [route,tab,button] of [
        ['janus',null,'localCameraOpen'],
        ['companero','hablar','cpCameraOpen']
      ]) {
        const context=await browser.newContext({
          viewport:{width:390,height:844},
          permissions:['camera'], hasTouch:true, isMobile:true
        });
        const page=await context.newPage();
        const errors=[];
        page.on('pageerror',error=>errors.push(String(error)));
        await page.route('http://**/*', route=>route.abort());
        await page.route('https://**/*', route=>route.abort());
        await page.goto('file://'+file+'#'+route,{waitUntil:'domcontentloaded'});
        if (tab) {
          await page.locator('[data-act="cpTab"][data-arg="'+tab+'"]').click();
        }
        await page.locator('[data-act="'+button+'"]').click();
        const status=page.locator('.jlc-status');
        await status.waitFor({state:'visible',timeout:15000});
        await page.waitForFunction(()=>
          /Cámara encendida|Permiso denegado|no está disponible/.test(
            document.querySelector('.jlc-status')?.textContent||''),null,{timeout:15000});
        const actual=await status.innerText();
        assert.match(actual,/Cámara encendida/,route+'/'+skin+' must reach fake camera ready: '+actual);
        assert.equal(await page.evaluate(()=>JanusLocalCamera.state().active),true);
        const video=page.locator('.jlc-video');
        assert.ok(await video.isVisible());
        await page.locator('.jlc-close').click();
        assert.equal(await page.evaluate(()=>JanusLocalCamera.state().active),false);
        assert.equal(await page.locator('.jlc-backdrop').count(),0);
        assert.deepEqual(errors,[],'browser console exceptions');
        await context.close();
        console.log('PASS camera',skin,route,'fake Chromium video');
      }
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
