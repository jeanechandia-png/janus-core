// Empaqueta el preview en UN solo HTML autocontenido (motor three+JanusHyper dentro). Uso: THREE_DIR=<node_modules> node build-preview.cjs [salida.html]
const fs = require('fs'), path = require('path'), cp = require('child_process');
const tmp = path.resolve(__dirname, 'dist/janus-hyper.min.js'); fs.mkdirSync(path.dirname(tmp), { recursive: true });
cp.execFileSync('node', [path.resolve(__dirname, 'build.cjs'), tmp], { env: Object.assign({}, process.env, { MIN: '1' }), stdio: 'inherit' });
const js = fs.readFileSync(tmp, 'utf8').replace(/<\/script/gi, '<\\/script'), src = fs.readFileSync(path.resolve(__dirname, 'preview/preview.src.html'), 'utf8');
const out = process.argv[2] || path.resolve(__dirname, 'preview/janus-companero-preview.html');
fs.writeFileSync(out, src.replace('/*BUNDLE*/', () => js)); console.log('OK', out, (fs.statSync(out).size / 1048576).toFixed(2) + ' MB');
