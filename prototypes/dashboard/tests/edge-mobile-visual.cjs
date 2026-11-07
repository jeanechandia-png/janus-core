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
    // Real 3D mesh icon regression, not an image with a CSS rotation.
    const icons3D=await page.evaluate(()=>{
      const tabs=Array.from(document.querySelectorAll('.cptab'));
      const tones=[...new Set(tabs.map(x=>x.dataset.janusTone).filter(Boolean))];
      const canvases=Array.from(document.querySelectorAll('canvas.janus-live-icon3d'));
      const drawn=canvases.filter(c=>{
        const ctx=c.getContext('2d');
        if(!ctx)return false;
        const data=ctx.getImageData(35,35,82,82).data;
        for(let p=3;p<data.length;p+=4)if(data[p]>20)return true;
        return false;
      });
      return {
        runtime: typeof JanusLiveObjects3D==='object' && JanusLiveObjects3D.available,
        total:canvases.length,
        drawn:drawn.length,
        tones,
        webgl:typeof THREE!=='undefined' && !!document.createElement('canvas').getContext('webgl')
      };
    });
    assert.deepEqual(icons3D.tones,['bronze'],
      'todas las pestañas mantienen volumen pero NO bordes arcoíris');
    if(icons3D.webgl && icons3D.total>0){
      // El runtime reside en el bundle encapsulado; no exigir variable global.
      // El único criterio válido es que existan canvas con PÍXELES reales.
      assert.ok(icons3D.total>=4,'varios iconos deben ser objetos Three.js');
      assert.ok(icons3D.drawn>=3,'iconos WebGL deben tener píxeles renderizados');
    }else{
      console.log('WebGL unavailable: approved Gold WebP remains visible');
    }
    console.log('Live3D',skin,w,JSON.stringify(icons3D));
    const cinematicCaption = await page.evaluate(() => {
      const el=document.querySelector('.cpst3.cinematic .cp-cinematic .jp-caption');
      return !el || getComputedStyle(el).display==='none';
    });
    assert.ok(cinematicCaption,'approved artwork caption must not overlap Muéstramelo on iPhone');
    if(bounds.edge){
      assert.ok(bounds.edge.left>=bounds.stage.left-3 && bounds.edge.right<=bounds.stage.right+3,'avatar inside scene width');
      assert.ok(bounds.edge.top>=bounds.stage.top-3 && bounds.edge.bottom<=bounds.footer.top+3,'avatar above selection and learning');
      assert.ok(bounds.edge.bottom<=bounds.tab.top+3,'avatar never over learning tabs');
      if(bounds.controls) assert.ok(bounds.edge.top>=bounds.controls.bottom-3,'avatar below stage controls');
    }
    await page.screenshot({path:path.join(shotDir,`kendra-${skin}-${w}.png`),fullPage:true});
    await page.locator('.cptabs').scrollIntoViewIfNeeded();
    await page.waitForTimeout(350);
    if(bounds.edge){
      const afterScroll=await page.evaluate(()=>{
        const stage=document.querySelector('.vb-companero .cpst3')?.getBoundingClientRect();
        const tab=document.querySelector('.cptabs')?.getBoundingClientRect();
        const edge=document.querySelector('[data-kendra-edge]');
        const avatar=edge?.getBoundingClientRect();
        return {stageBottom:stage?.bottom,tabTop:tab?.top,avatarBottom:avatar?.bottom,
          hidden:!edge||edge.hidden||getComputedStyle(edge).display==='none',scrollY:scrollY};
      });
      if(afterScroll.stageBottom<=Math.max(70,h*0.08)){
        assert.ok(afterScroll.hidden,'avatar hides once stage really leaves the screen');
      } else if(!afterScroll.hidden){
        assert.ok(afterScroll.avatarBottom<=afterScroll.tabTop+3,
          'visible avatar must remain above learning controls');
      }
      console.log('scroll',skin,w,JSON.stringify(afterScroll));
    }
    // Check that the learning panel remains interactive and readable.
    const tabs=page.locator('.cptab');
    assert.ok(await tabs.count()>=6,'all six companion tabs remain');
    const grid=await tabs.evaluateAll(nodes=>nodes.slice(0,6).map(el=>{
      const r=el.getBoundingClientRect();
      const label=el.querySelector('em')?.getBoundingClientRect();
      return {x:r.x,y:r.y,width:r.width,right:r.right,labelRight:label?.right};
    }));
    assert.ok(Math.abs(grid[0].y-grid[1].y)<4 && Math.abs(grid[1].y-grid[2].y)<4,
      'tres botones en primera fila');
    assert.ok(Math.abs(grid[3].y-grid[4].y)<4 && Math.abs(grid[4].y-grid[5].y)<4,
      'tres botones en segunda fila');
    assert.ok(grid[3].y>grid[0].y+50,'segunda fila no superpuesta');
    for(const pair of [[0,1],[1,2],[3,4],[4,5]])
      assert.ok(grid[pair[0]].right<=grid[pair[1]].x+2,'botones no se solapan');
    for(const t of grid)
      assert.ok(t.labelRight<=t.right+3,'etiqueta no se sale del botón');
    const touched=await tabs.nth(1).evaluate(el=>{
      const rect=el.getBoundingClientRect();
      el.dispatchEvent(new PointerEvent('pointerdown',{
        bubbles:true,clientX:rect.left+rect.width/2,clientY:rect.top+rect.height/2,pointerType:'touch'
      }));
      const style=getComputedStyle(el);
      const lit=el.classList.contains('j3d-lit') && el.classList.contains('j3d-pressed');
      el.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerType:'touch'}));
      return {lit,tone:el.dataset.janusTone,shadow:style.boxShadow};
    });
    assert.ok(touched.lit,'botón 3D debe iluminarse inmediatamente al toque');
    assert.ok(touched.tone,'cada botón tiene color material asignado');
    assert.ok(touched.shadow && touched.shadow!=='none','el botón tiene relieve físico visible');
    await tabs.nth(1).click({timeout:10000});
    assert.ok(await page.locator('.cptabs').isVisible(),'tab interaction remains enabled');
    assert.equal(errors.length,0,'no fatal browser errors: '+errors.join(' | '));
    await page.close();
    console.log('PASS',skin,w+'x'+h,bounds.edge?'3D visible and bounded':'GPU fallback / 3D unavailable');
   }
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
