'use strict';
// Prepara la variante para Artifact (vista previa navegable alojada) a partir de `node build.cjs --artifact <ruta>`.
// Reglas del contenedor: título primero, sin metas propias, el esqueleto ya añade viewport y padding de zonas seguras.
// Uso: node tools/make-artifact.cjs entrada.html salida.html [vista-local.html]
// El 3.er argumento (opcional) escribe una copia ENVUELTA con el mismo esqueleto que añade Artifact al publicar (charset, viewport, reseteo),
// para probarla localmente: sin <meta charset> el navegador adivina la codificación y rompe las expresiones regulares con tildes.
const fs = require('fs');
const [inp, out, prev] = process.argv.slice(2); if (!inp || !out) { console.error('uso: make-artifact.cjs entrada salida'); process.exit(1); }
let h = fs.readFileSync(inp, 'utf8');
const title = (h.match(/<title>[^<]*<\/title>/) || ['<title>Janus · Obsidiana</title>'])[0];
h = h.replace(/<meta [^>]*>\n?/g, '').replace(/<title>[^<]*<\/title>\n?/, '');
// la altura sigue a la ventana del contenedor (100% de html/body), no a 100vh, para respetar las zonas seguras
h = h.replace('</style>', '.stage{height:100%!important}\n@media (max-aspect-ratio:1/1){.stage{height:100%!important;top:0!important}}\n</style>');
h = title.replace(/<title>[^<]*<\/title>/, '<title>Janus Dashboard</title>') + '\n' + h.replace(/^\s+/, '');
fs.writeFileSync(out, h); console.log('artifact listo', out, (h.length / 1024).toFixed(0) + ' KB');
if (prev) {
  const sk = '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style></head><body>';
  fs.writeFileSync(prev, sk + h + '</body></html>'); console.log('vista local con esqueleto', prev);
}
