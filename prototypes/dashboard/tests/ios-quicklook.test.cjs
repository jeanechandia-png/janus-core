'use strict';
/* Regresión específica: el visor de documentos de iPhone no garantiza ejecutar JS.
 * Debe mostrarse un aviso honesto ANTES del primer <script>, no un dashboard inventado. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
for(const f of ['Janus-A-Obsidiana-interactivo.html','Janus-B-Platino-interactivo.html']){
  test(f+' mantiene contenido en visor sin JavaScript',()=>{
    const html=fs.readFileSync(path.join(ROOT,'dist',f),'utf8');
    const firstScript=html.indexOf('<script>');
    const fallback=html.indexOf('id="janus-js-unavailable"');
    assert.ok(firstScript>0,'el HTML incluye la aplicación interactiva');
    assert.ok(fallback>0&&fallback<firstScript,'la vista previa debe renderizar sin ejecutar JS');
    const staticPart=html.slice(0,firstScript);
    assert.match(staticPart,/no ejecuta JavaScript o WebGL/);
    assert.match(staticPart,/JANUS/);
    assert.doesNotMatch(staticPart,/Hola, Jean\./,'prohibida portada falsa');
    assert.doesNotMatch(staticPart,/MI ESPACIO|Mi día|Janus · Nexo/,'sin inventar UI');
    assert.match(staticPart,/html:not\(\.janus-ready\) \.stage\{display:none!important\}/);
    assert.match(staticPart,/html\.janus-ready #janus-js-unavailable\{display:none!important\}/);
    assert.match(html,/document\.documentElement\.classList\.add\("janus-ready"\)/,
      'la vista interactiva reemplaza al poster sólo tras renderizar correctamente');
    assert.match(html,/<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">/);
    assert.ok(html.includes('window.JanusEdgeCompanion'),'mantener 3D de Kendra');
    assert.ok(html.includes('data-janus-founder'),'mantener Nexo');
  });
}
