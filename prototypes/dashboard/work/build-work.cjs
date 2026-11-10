'use strict';
// Ensambla la plantilla laboral «JANUS Work» en un único HTML autónomo.
// Uso: node work/build-work.cjs [--mode example|core] [--out ruta.html] [--skin ruta/command-center.css]
//  - example (por defecto): vista previa navegable con datos ficticios; no llama a ningún servidor.
//  - core: la sirve el runtime en /work; habla con JANUS Core (mismo origen) y exige sesión de colaborador.
// La piel es la dashboard de IBA. Su CSS vive en un repositorio PRIVADO y NO se copia aquí: se lee de una
// ruta local fuera de Git y se verifica contra work/skin.lock.json. Sin piel verificada no hay build
// (nunca se sustituye por otro diseño).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const D = path.join(__dirname, '..');
const rd = (p) => fs.readFileSync(path.join(D, p), 'utf8');
const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };

const LOCK = JSON.parse(rd('work/skin.lock.json'));
function loadSkin(explicit) {
  const candidate = explicit || process.env.JANUS_WORK_SKIN_CSS || path.join(D, 'local', 'iba-command-center.css');
  if (!fs.existsSync(candidate)) {
    throw new Error('Falta la piel de IBA (' + candidate + '). Cópiala desde ' + LOCK.source.repository + '@' + LOCK.source.commit + ':' + LOCK.source.path + ' a prototypes/dashboard/local/ (fuera de Git).');
  }
  const bytes = fs.readFileSync(candidate);
  const sha = crypto.createHash('sha256').update(bytes).digest('hex');
  if (sha !== LOCK.source.sha256) throw new Error('La piel de IBA no coincide con la huella fijada (esperada ' + LOCK.source.sha256.slice(0, 12) + '…, encontrada ' + sha.slice(0, 12) + '…). Actualiza skin.lock.json solo con aprobación.');
  return bytes.toString('utf8');
}

// Vista de equipo del CEO (página aparte, misma piel de IBA). 'team' habla con el Núcleo; 'team-example' es la vista previa.
function buildTeam(options) {
  const live = options && options.mode === 'team';
  const skin = loadSkin(options && options.skin);
  const parts = ['const TEAM_MODE=' + JSON.stringify(live ? 'core' : 'example') + ';'];
  if (live) parts.push(fs.readFileSync(path.join(D, '..', '..', 'apps', 'pwa', 'founder-session.js'), 'utf8').replace(/^export\s+/gm, ''));
  else parts.push(rd('work/work-team-example.js'));
  parts.push(rd('work/work-team.js'));
  let js = parts.join('\n').replace(/<\/script/gi, '<\\/script');
  // Igual que en el panel: los nombres reales solo salen de un archivo local (no versionado) y solo en la vista previa.
  const teamNamesFile = path.join(D, 'local', 'work-names.json');
  const teamNames = Object.assign({ __WORK_NAME_A__: 'Colaborador A', __WORK_NAME_B__: 'Colaborador B', __WORK_NAME_C__: 'Colaborador C' },
    !live && !(options && options.publicSafe) && fs.existsSync(teamNamesFile) ? JSON.parse(fs.readFileSync(teamNamesFile, 'utf8')) : {});
  for (const [k, v] of Object.entries(teamNames)) js = js.split(k).join(v);
  const css = skin + '\n' + rd('work/work-extra.css');
  return '<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<meta name="theme-color" content="#11151a">\n<meta name="robots" content="noindex">\n' +
    '<meta name="janus-work-template" content="janus-work-team-v1 · skin ' + LOCK.skin + '@' + LOCK.source.commit + ' · ' + (live ? 'core' : 'example') + '">\n<title>JANUS Work · Equipo</title>\n<style>\n' + css + '\n</style>\n</head>\n<body>\n<div id="app"></div>\n<script>\n(function(){\n' + js + '\n})();\n</script>\n</body>\n</html>\n';
}

function buildWork(options) {
  const mode = options && options.mode === 'core' ? 'core' : 'example';
  const skin = loadSkin(options && options.skin);
  const namesFile = path.join(D, 'local', 'work-names.json');
  const NAMES = Object.assign({ __WORK_NAME_A__: 'Colaborador A', __WORK_NAME_B__: 'Colaborador B', __WORK_NAME_C__: 'Colaborador C' },
    mode === 'example' && !(options && options.publicSafe) && fs.existsSync(namesFile) ? JSON.parse(fs.readFileSync(namesFile, 'utf8')) : {});
  // Medallones de idioma aprobados (arte original del Founder): un único juego compartido en apps/pwa/language-art.
  const art = (name) => 'data:image/webp;base64,' + fs.readFileSync(path.join(D, '..', '..', 'apps', 'pwa', 'language-art', name + '-192.webp')).toString('base64');
  const LANG_ART = { es: art('espana'), nl: art('nederland'), en: art('english') };
  const parts = ['const WORK_MODE=' + JSON.stringify(mode) + ';', 'const WORK_LANG_ART=' + JSON.stringify(LANG_ART) + ';', rd('work/work-i18n.js')];
  if (mode === 'core') {
    // Mismas piezas que ya usa la PWA: sesión con llave del dispositivo y pasarela hacia el Núcleo.
    const session = fs.readFileSync(path.join(D, '..', '..', 'apps', 'pwa', 'founder-session.js'), 'utf8').replace(/^export\s+/gm, '');
    parts.push(session, rd('lego/janus-model-gateway/janus-model-gateway.js'));
  } else parts.push(rd('work/work-example.js'));
  // Lector de códigos: LEGO janus-attach existente + vendor/jsqr (mismo módulo del chat del CEO, sin modificar).
  parts.push(rd('vendor/jsqr.js'), rd('lego/janus-attach/janus-attach.js'));
  parts.push(rd('work/work-app.js'));
  let js = parts.join('\n').replace(/<\/script/gi, '<\\/script');
  for (const [k, v] of Object.entries(NAMES)) js = js.split(k).join(String(v).replace(/[<>&"'\\]/g, ''));
  const css = skin + '\n' + fs.readFileSync(path.join(D, '..', '..', 'apps', 'pwa', 'language-buttons.css'), 'utf8') + '\n' + rd('lego/janus-attach/janus-attach.css') + '\n' + rd('work/work-extra.css');
  return '<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
    '<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="mobile-web-app-capable" content="yes">\n' +
    '<meta name="apple-mobile-web-app-title" content="JANUS Work">\n<meta name="theme-color" content="#11151a">\n<meta name="robots" content="noindex">\n' +
    '<meta name="janus-work-template" content="janus-work-v1 · skin ' + LOCK.skin + '@' + LOCK.source.commit + ' · ' + mode + '">\n' +
    '<title>JANUS Work</title>\n<style>\n' + css + '\n</style>\n</head>\n<body>\n<div id="app"></div>\n<script>\n(function(){\n' + js + '\n})();\n</script>\n</body>\n</html>\n';
}

module.exports = { buildWork, buildTeam, loadSkin, LOCK };
if (require.main === module) {
  const raw = arg('--mode');
  const mode = raw === 'core' || raw === 'team' || raw === 'team-example' ? raw : 'example';
  const names = { core: 'Janus-Work-core.html', team: 'Janus-Work-team.html', 'team-example': 'Janus-Work-Equipo-preview.html', example: 'Janus-Work-preview.html' };
  const out = arg('--out') || path.join(D, 'dist', names[mode]);
  try {
    const html = mode.startsWith('team') ? buildTeam({ mode, skin: arg('--skin') }) : buildWork({ mode, skin: arg('--skin'), publicSafe: process.env.JANUS_DASH_PUBLIC_SAFE === '1' });
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, html);
    console.log('ok', out, (html.length / 1024).toFixed(0) + ' KB', '· modo:', mode, '· piel:', LOCK.skin + '@' + LOCK.source.commit);
  } catch (error) { console.error('JANUS Work: ' + error.message); process.exit(1); }
}
