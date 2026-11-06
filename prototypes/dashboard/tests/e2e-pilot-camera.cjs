'use strict';
/* JANUS pilot E2E: same offline A/B dashboards, separate Founder/Kendra camera sessions,
 * local capture lifecycle and source-backed child alert. Browser camera is simulated.
 * A real iPhone/Safari validation is STILL REQUIRED before real-world pilot acceptance.
 */
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const shots = process.env.SHOTS_DIR || null;

async function verifySkin(br, file, label) {
  const ctx = await br.newContext({
    viewport: { width: 430, height: 932 }, isMobile: true, hasTouch: true,
    permissions: ['camera']
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  try {
    await page.goto('file://' + path.join(root,'dist',file));
    await page.waitForSelector('.jpc-launch', { timeout: 15000 });
    assert.equal(await page.locator('.jpc-launch').count(),1,label+': Founder launch');
    await page.locator('.jpc-launch').click();
    await page.waitForSelector('.jpc-backdrop');
    await page.waitForFunction(() => JanusPilotCamera.state().active);
    const founder = await page.evaluate(() => JanusPilotCamera.state());
    assert.equal(founder.scope,'founder',label+': founder scope');
    await page.waitForFunction(() => JanusPilotCamera.state().live, {timeout:10000}).catch(()=>{});
    const local = await page.evaluate(() => ({
      status: document.querySelector('.jpc-status')?.textContent || '',
      scope: JanusPilotCamera.state().scope
    }));
    assert.equal(local.scope,'founder');
    assert.ok(/dispositivo|permiso|móvil|cámara/i.test(local.status));
    if (await page.evaluate(() => JanusPilotCamera.state().live)) {
      await page.waitForFunction(() => {
        const v=document.querySelector('.jpc-dialog video');
        return v && v.videoWidth>0;
      }, {timeout:10000}).catch(()=>{});
      if (await page.evaluate(() => document.querySelector('.jpc-dialog video')?.videoWidth > 0)) {
        await page.locator('[data-jpc="shoot"]').click();
        await page.waitForFunction(() => JanusPilotCamera.state().photoReady,{timeout:10000});
        assert.ok(await page.locator('.jpc-dialog [data-jpc-save]').isVisible(),label+': local save link');
      }
    }
    await page.locator('[data-jpc="discard"]').click();
    assert.equal(await page.locator('.jpc-backdrop').count(),0,label+': removed camera dialog');
    assert.equal((await page.evaluate(() => JanusPilotCamera.state())).active,false,label+': camera released');
    await page.goto('file://' + path.join(root,'dist',file) + '#companero');
    await page.waitForSelector('#view .cp-pilot-camera button',{timeout:15000});
    assert.equal(await page.locator('.jpc-launch').count(),0,label+': no founder camera inside Kendra');
    await page.locator('#view .cp-pilot-camera button').click();
    await page.waitForSelector('.jpc-backdrop');
    const kendra = await page.evaluate(() => JanusPilotCamera.state());
    assert.equal(kendra.scope,'kendra',label+': child camera own scope');
    assert.ok(/no se comparte/i.test(await page.locator('.jpc-privacy').textContent()),label+': private child notice');
    assert.equal(await page.locator('[data-jpc-save]:visible').count(),0,label+': never auto save child photo');
    if (shots) {
      fs.mkdirSync(shots,{recursive:true});
      await page.screenshot({path:path.join(shots,'piloto-camara-kendra-'+label+'.png')});
    }
    await page.locator('[data-jpc="discard"]').click();

    // Safety safeguard is actually connected to the child's chat flow.
    await page.locator('#view [data-act="cpTab"][data-arg="hablar"]').click();
    await page.locator('#view [data-f="cpMsg"]').fill('Quiero hacerme daño');
    await page.locator('#view [data-act="cpSend"]').click();
    const reply = await page.locator('#view .cpsay').textContent();
    assert.match(reply,/adulto de confianza|profesora|Jean/i,label+': safe advice');
    await page.locator('#view [data-act="cpTab"][data-arg="papa"]').click();
    const adult = await page.locator('#view .cptc').textContent();
    assert.match(adult,/Seguridad de Kendra/,label+': local adult alert');
    assert.doesNotMatch(adult,/Quiero hacerme daño/,label+': disclosure is not stored in alert');
    assert.deepEqual(errors,[],label+': no browser JS errors');
    process.stdout.write('PASS '+label+' · Founder camera, Kendra camera, safety alert\n');
  } finally {
    await ctx.close();
  }
}
(async () => {
  const br = await chromium.launch({
    ...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),
    headless:true,
    args:['--no-sandbox','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream',
      '--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--allow-file-access-from-files']
  });
  try {
    await verifySkin(br,'Janus-A-Obsidiana-interactivo.html','A-Obsidiana');
    await verifySkin(br,'Janus-B-Platino-interactivo.html','B-Platino');
  } finally { await br.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
