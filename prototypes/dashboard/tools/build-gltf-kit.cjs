'use strict';
// Regenera vendor/gltf-kit.js (global JanusGLTF). Uso: THREE_DIR=<carpeta node_modules> node tools/build-gltf-kit.cjs
const path = require('path');
const NM = process.env.THREE_DIR || path.join(__dirname, '..', 'node_modules');
const esbuild = require(path.join(NM, 'esbuild'));
const D = path.join(__dirname, '..');
esbuild.build({
  entryPoints: [path.join(D, 'lego/janus-creature-slot/gltf-kit-entry.js')], bundle: true, format: 'iife', minify: true, target: 'es2020', platform: 'browser',
  outfile: path.join(D, 'vendor/gltf-kit.js'), nodePaths: [NM], logLevel: 'info',
  banner: { js: '/* three.js r160 (MIT) GLTFLoader + SkeletonUtils + MeshoptDecoder; global JanusGLTF. Regenerar: tools/build-gltf-kit.cjs */' },
  plugins: [{ name: 'three-global', setup(b) { b.onResolve({ filter: /^three$/ }, () => ({ path: 'three', namespace: 'three-global' })); b.onLoad({ filter: /.*/, namespace: 'three-global' }, () => ({ contents: 'module.exports = window.THREE;', loader: 'js' })); } }]
}).then(() => console.log('ok'));
