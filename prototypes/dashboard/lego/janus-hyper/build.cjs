// Empaqueta JanusHyper (three r160 + motor) en un único script IIFE. Uso: node build.cjs [salida.js]
// Requiere esbuild y three@0.160.0 (variable THREE_DIR = carpeta node_modules que contiene "three").
const path = require('path'), fs = require('fs');
const NM = process.env.THREE_DIR || path.resolve(__dirname, '../../node_modules');
const esbuild = require(path.join(NM, 'esbuild'));
const out = process.argv[2] || path.resolve(__dirname, 'dist/janus-hyper.js');
fs.mkdirSync(path.dirname(out), { recursive: true });
esbuild.build({ entryPoints: [path.resolve(__dirname, 'src/index.js')], bundle: true, format: 'iife', globalName: 'JanusHyper', outfile: out, minify: !!process.env.MIN, nodePaths: [NM], target: 'es2020', legalComments: 'none', logLevel: 'info' }).catch(() => process.exit(1));
