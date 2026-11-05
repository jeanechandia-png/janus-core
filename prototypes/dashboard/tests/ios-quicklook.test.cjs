'use strict';
/* Regresión específica: el visor de documentos de iPhone no garantiza ejecutar JS.
 * Debe haber contenido visual visible ANTES del primer <script>. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
for(const f of ['Janus-A-Obsidiana-interactivo.html','Janus-B-Platino-interactivo.html']){
  test(f+' mantiene contenido en visor sin JavaScript',()=>{
    const html=fs.readFileSync(path.join(ROOT,'dist',f),'utf8');
    const firstScript=html.indexOf('<script>');
    const fallback=html.indexOf('id="janus-static-preview"');
    assert.ok(firstScript>0,'el HTML incluye la aplicación');
    assert.ok(fallback>0&&fallback<firstScript,'la vista previa debe renderizar sin ejecutar JS');
    const staticPart=html.slice(0,firstScript);
    assert.match(staticPart,/VISTA PREVIA/);
    assert.match(staticPart,/Mi día/);
    assert.match(staticPart,/Janus · Nexo/);
    assert.match(staticPart,/Kendra/);
    assert.match(staticPart,/data:image\/webp;base64,/,'imagen incrustada sin solicitudes externas');
    assert.match(staticPart,/html:not\(\.janus-ready\) \.stage\{display:none!important\}/);
    assert.match(staticPart,/html\.janus-ready #janus-static-preview\{display:none!important\}/);
    assert.match(html,/document\.documentElement\.classList\.add\("janus-ready"\)/,
      'la vista interactiva reemplaza al poster sólo tras renderizar correctamente');
    assert.match(html,/<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">/);
    assert.ok(html.includes('window.JanusEdgeCompanion'),'mantener 3D de Kendra');
    assert.ok(html.includes('data-janus-founder'),'mantener Nexo');
  });
}
