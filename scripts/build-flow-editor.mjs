#!/usr/bin/env node
// Compila el editor de flujos en UN solo HTML autónomo (CSS y JS dentro, sin recursos externos ni red).
// Uso: node scripts/build-flow-editor.mjs [salida.html]   (por defecto dist/flow-editor/janus-flujos.html; dist/ no se versiona)
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(process.argv[2] ?? `${root}/dist/flow-editor/janus-flujos.html`);
const bundle = await build({
  entryPoints: [`${root}/apps/flow-editor/web/main.ts`],
  bundle: true, write: false, format: 'iife', target: 'es2020', platform: 'browser', minify: true, legalComments: 'none',
  logLevel: 'warning',
});
const js = bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync(`${root}/apps/flow-editor/web/flow-editor.css`, 'utf8');
const csp = "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'";
const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="dark"><meta http-equiv="Content-Security-Policy" content="${csp}">
<title>Janus · Flujos</title><style>${css}</style></head>
<body><div id="app"></div><script>${js}</script></body></html>
`;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`${out}  ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB`);
