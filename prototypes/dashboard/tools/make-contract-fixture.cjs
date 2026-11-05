'use strict';
// Genera tests/fixtures/*.glb (figuras de PRUEBA del contrato de janus-creature-slot). THREE_DIR=<node_modules con three y esbuild>
const path = require('path'), fs = require('fs');
const NM = process.env.THREE_DIR || path.join(__dirname, '..', 'node_modules');
const esbuild = require(path.join(NM, 'esbuild')), { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const out = path.join(__dirname, '..', 'tests', 'fixtures'); fs.mkdirSync(out, { recursive: true });
  const r = await esbuild.build({ entryPoints: [path.join(__dirname, 'make-contract-fixture.entry.js')], bundle: true, write: false, format: 'iife', nodePaths: [NM], target: 'es2020' });
  const br = await chromium.launch({ args: ['--no-sandbox'] }), p = await br.newPage(); await p.goto('about:blank'); await p.addScriptTag({ content: r.outputFiles[0].text });
  for (const [name, o] of [['contrato-completo', {}], ['contrato-incompleto', { dropSockets: true, dropMorphs: true, dropClips: true }]]) {
    const b64 = await p.evaluate((o) => window.makeFixture(o), o); fs.writeFileSync(path.join(out, name + '.glb'), Buffer.from(b64, 'base64')); console.log('ok', name, Buffer.from(b64, 'base64').length, 'bytes');
  }
  await br.close();
})().catch((e) => { console.error(e); process.exit(1); });
