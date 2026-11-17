'use strict';
// Plantilla laboral «JANUS Work»: comprobaciones estáticas y de build (node --test, sin navegador).
// Las pruebas que necesitan la piel privada de IBA se OMITEN con aviso si no está instalada (CI público).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync, spawnSync } = require('child_process');

const D = path.join(__dirname, '..');
const W = path.join(D, 'work');
const rd = (f) => fs.readFileSync(path.join(W, f), 'utf8');
// Los .js del prototipo son scripts clásicos que el build concatena (el paquete raíz es ESM): se evalúan como texto.
const load = (file, symbol) => new Function(rd(file) + '\nreturn ' + symbol + ';')();
const WORK_I18N = load('work-i18n.js', 'WORK_I18N');
const workExample = load('work-example.js', 'workExample');
const { buildWork, LOCK } = require(path.join(W, 'build-work.cjs'));
const skinPath = process.env.JANUS_WORK_SKIN_CSS || path.join(D, 'local', 'iba-command-center.css');
const hasSkin = fs.existsSync(skinPath);
const skinSkip = hasSkin ? false : 'piel privada de IBA no instalada en este entorno';

test('ES, NL y EN tienen exactamente las mismas claves y ningún texto vacío', () => {
  const keys = Object.keys(WORK_I18N.es).sort();
  for (const lang of ['nl', 'en']) assert.deepEqual(Object.keys(WORK_I18N[lang]).sort(), keys, 'claves de ' + lang);
  for (const lang of ['es', 'nl', 'en']) for (const key of keys) assert.ok(String(WORK_I18N[lang][key]).trim(), lang + '.' + key + ' vacío');
  // Los marcadores {x} coinciden entre idiomas.
  const marks = (s) => (String(s).match(/\{[a-z]+\}/g) || []).sort().join(',');
  for (const key of keys) for (const lang of ['nl', 'en']) assert.equal(marks(WORK_I18N[lang][key]), marks(WORK_I18N.es[key]), 'marcadores de ' + lang + '.' + key);
});

test('toda clave t(\'…\') usada por la app existe en el diccionario', () => {
  const app = rd('work-app.js');
  const used = new Set([...app.matchAll(/\bt\('([A-Za-z0-9_]+)'/g)].map((m) => m[1]));
  assert.ok(used.size > 60, 'claves usadas: ' + used.size);
  for (const key of used) if (!key.endsWith('_')) assert.ok(key in WORK_I18N.es, 'falta la clave ' + key);
  // Y al revés: no quedan textos muertos (las familias dinámicas se comprueban abajo).
  const dynamic = ['st_', 'pr_', 'src_', 'sess_', 'res_', 'nav', 'prompt'];
  for (const key of Object.keys(WORK_I18N.es)) if (!dynamic.some((d) => key.startsWith(d))) assert.ok(used.has(key), 'clave sin uso: ' + key);
  for (const prefix of ['st_', 'pr_', 'src_', 'sess_', 'res_']) assert.ok(Object.keys(WORK_I18N.es).some((k) => k.startsWith(prefix)), prefix);
  for (const s of ['queued', 'active', 'blocked', 'handoff_required', 'completed', 'cancelled']) assert.ok('st_' + s in WORK_I18N.es);
  for (const s of ['upload', 'google_drive', 'apple_icloud', 'local', 'import', 'other']) assert.ok('src_' + s in WORK_I18N.es);
  for (const s of ['purchases', 'payments', 'contracts', 'permissions', 'critical_deploys', 'project_instructions']) assert.ok('res_' + s in WORK_I18N.es);
});

test('solo texto: la plantilla no contiene micrófono, reconocimiento ni síntesis de voz', () => {
  const sources = rd('work-app.js') + rd('work-extra.css') + rd('work-example.js');
  assert.doesNotMatch(sources, /getUserMedia|SpeechRecognition|speechSynthesis|AudioContext|MediaRecorder|\/api\/voice|elevenlabs/i);
  for (const persona of Object.values(workExample('2026-11-10T09:00:00.000Z'))) {
    assert.equal(persona.capabilities.voice, false);
    assert.equal(persona.capabilities.approvePayments, false);
    assert.equal(persona.capabilities.changePermissions, false);
  }
});

test('una sola plantilla: los ejemplos difieren en datos, no en código, y no llevan nombres reales', () => {
  const ex = workExample('2026-11-10T09:00:00.000Z');
  assert.deepEqual(Object.keys(ex), ['colab-a', 'colab-b', 'colab-c']);
  assert.equal(ex['colab-a'].locale, 'es'); assert.equal(ex['colab-b'].locale, 'nl');
  const shape = (o) => Object.keys(o).sort().join(',');
  assert.equal(shape(ex['colab-a']), shape(ex['colab-b'])); assert.equal(shape(ex['colab-a']), shape(ex['colab-c']));
  for (const p of Object.values(ex)) {
    assert.equal(p.templateId, 'janus-work-v1');
    assert.match(p.profile.displayName, /^__WORK_NAME_[ABC]__$/);
    for (const item of p.assignments) assert.equal(item.assignment.assigneePrincipalId, p.principalId);
  }
  // El repositorio es público: ni nombres de colaboradores ni datos de clientes en los ejemplos.
  assert.doesNotMatch(rd('work-example.js') + rd('work-app.js') + rd('work-i18n.js'), /\b(Julio|Robin|Mariel|Kendra|3 Kings)\b/);
});

test('medallones de idioma: un único juego compartido (ES, NL, EN) en apps/pwa/language-art', () => {
  for (const name of ['espana', 'nederland', 'english']) {
    const file = path.join(D, '..', '..', 'apps', 'pwa', 'language-art', name + '-192.webp');
    const bytes = fs.readFileSync(file);
    assert.equal(bytes.subarray(0, 4).toString('latin1'), 'RIFF'); assert.equal(bytes.subarray(8, 12).toString('latin1'), 'WEBP');
    assert.ok(bytes.length > 8000 && bytes.length < 40000, name + ' ' + bytes.length);
  }
  const css = rd('work-extra.css'), app = rd('work-app.js');
  assert.match(css, /\.jw-flag\.is-lit\{[^}]*drop-shadow/); assert.match(css, /prefers-reduced-motion/);
  assert.match(app, /aria-pressed=/); assert.doesNotMatch(app, /class="cc-lang"/);
});

test('la app escapa todo dato antes de pintarlo (sin innerHTML con datos crudos)', () => {
  const app = rd('work-app.js');
  // Cada interpolación de datos del servidor pasa por esc(); buscamos patrones peligrosos conocidos.
  assert.doesNotMatch(app, /\+ (a|p|h|r|x|m|d)\.(title|goal|name|text|content|subject|executiveSummary|description|instructions|displayName|roleTitle) \+/);
  assert.doesNotMatch(app, /eval\(|new Function|document\.write|insertAdjacentHTML/);
});

test('el CSS privado de IBA no está versionado en este repositorio público', () => {
  const tracked = spawnSync('git', ['ls-files', '-z'], { cwd: path.join(D, '..', '..'), encoding: 'utf8' });
  if (tracked.status !== 0) return; // sin git (paquete exportado): nada que comprobar
  const files = tracked.stdout.split('\0').filter((f) => /\.css$/.test(f));
  for (const f of files) {
    const abs = path.join(D, '..', '..', f);
    if (!fs.existsSync(abs)) continue;
    const sha = crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
    assert.notEqual(sha, LOCK.source.sha256, f + ' es una copia de la piel privada de IBA');
    assert.doesNotMatch(fs.readFileSync(abs, 'utf8'), /\.cc-shell\{display:grid;grid-template-columns:248px/, f + ' contiene CSS de IBA');
  }
  assert.equal(LOCK.source.visibility, 'private');
  assert.match(LOCK.source.sha256, /^[0-9a-f]{64}$/);
});

test('sin piel verificada no hay build: ni ausente ni alterada, y nunca un diseño sustituto', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jw-'));
  assert.throws(() => buildWork({ skin: path.join(tmp, 'no-existe.css') }), /Falta la piel de IBA/);
  const fake = path.join(tmp, 'fake.css'); fs.writeFileSync(fake, '.cc-shell{color:red}');
  assert.throws(() => buildWork({ skin: fake }), /no coincide con la huella/);
  const cli = spawnSync(process.execPath, [path.join(W, 'build-work.cjs'), '--skin', fake, '--out', path.join(tmp, 'x.html')], { encoding: 'utf8' });
  assert.equal(cli.status, 1); assert.ok(!fs.existsSync(path.join(tmp, 'x.html')));
});

test('build de vista previa: un solo archivo autónomo, sin red, con la piel de IBA', { skip: skinSkip }, () => {
  const html = buildWork({ mode: 'example', publicSafe: true });
  assert.match(html, /<meta name="janus-work-template" content="janus-work-v1 · skin iba-command-center@/);
  assert.match(html, /\.cc-shell\{display:grid/); assert.match(html, /const WORK_MODE="example"/);
  assert.match(html, /Colaborador A/); assert.doesNotMatch(html, /__WORK_NAME_/);
  assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+href=|@import|url\(https?:/i, 'no debe cargar nada externo');
  assert.doesNotMatch(html, /const JanusGateway|async function signIn\(/, 'la vista previa no lleva cliente del Núcleo');
  assert.ok(html.length < 460 * 1024, "vista previa autónoma: incluye el logo oficial incrustado");
  // Selector de idioma: los tres medallones aprobados, incrustados, con el componente compartido de la PWA.
  // 3 medallones de idioma aprobados + el sello oficial del grupo (una sola copia; se reutiliza en barra lateral, acceso y móvil).
  assert.equal((html.match(/data:image\/webp;base64,/g) || []).length, 4);
  assert.match(html, /const WORK_BRAND="data:image\/webp;base64,/); assert.match(html, /alt="InfinitySeed Group"/);
  assert.match(html, /\.janus-language-button\.is-lit/); assert.match(html, /janus-language-button jw-flag/);
});

test('build para el Núcleo: reutiliza la sesión de la PWA y la pasarela, sin datos de ejemplo', { skip: skinSkip }, () => {
  const html = buildWork({ mode: 'core' });
  assert.match(html, /const WORK_MODE="core"/); assert.match(html, /const JanusGateway/); assert.match(html, /async function signIn\(/);
  assert.doesNotMatch(html, /function workExample|^export /m);
  // La pasarela reenvía el contexto de proyecto/tarea solo si es válido (v1.2, aditivo).
  assert.match(html, /coreContext\(req\)/);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jw-'));
  const out = path.join(tmp, 'w.html');
  execFileSync(process.execPath, [path.join(W, 'build-work.cjs'), '--mode', 'core', '--out', out]);
  // El script incrustado es JavaScript válido.
  const js = fs.readFileSync(out, 'utf8').match(/<script>\n([\s\S]*)\n<\/script>/)[1];
  assert.doesNotThrow(() => new (require('vm').Script)(js));
});

test('«recuérdame…» en el chat se convierte en un elemento de agenda (ES · NL · EN), sin llamar a ningún modelo', () => {
  const parse = new Function(rd('work-app.js').split('const JanusWork')[0] + '\nreturn parseWorkReminder;')();
  const now = new Date(2026, 10, 10, 14, 0); // martes 10-nov-2026
  assert.deepEqual(parse('Recuérdame mañana a las 17:30 llamar a Pedro', now), { date: '2026-11-11', text: 'Llamar a Pedro', time: '17:30' });
  assert.deepEqual(parse('recuerdame el viernes enviar la propuesta', now), { date: '2026-11-13', text: 'Enviar la propuesta' });
  assert.deepEqual(parse('recuérdame el miércoles a las 9 la demo', now), { date: '2026-11-11', text: 'La demo', time: '09:00' });
  assert.deepEqual(parse('Recuérdame el martes revisar', now), { date: '2026-11-17', text: 'Revisar' }, 'el mismo día de la semana es la semana siguiente');
  assert.deepEqual(parse('recuérdame comprar pan', now), { date: '2026-11-10', text: 'Comprar pan' });
  assert.deepEqual(parse('Herinner me morgen om 9 uur aan de offerte', now), { date: '2026-11-11', text: 'De offerte', time: '09:00' });
  assert.deepEqual(parse('remind me on 25/12 at 5pm to call mum', now), { date: '2026-12-25', text: 'Call mum', time: '17:00' });
  assert.deepEqual(parse('recuérdame el 05/01 firmar', now), { date: '2027-01-05', text: 'Firmar' }, 'una fecha ya pasada este año es del año siguiente');
  for (const other of ['hola qué tal', 'recuérdame', '¿qué me recuerdas del proyecto?', 'recuérdamelo', 'recuérdame el 31/02 algo imposible ya']) {
    const result = parse(other, now);
    if (other.includes('31/02')) assert.equal(result.date, '2026-11-10', 'fecha imposible: no se inventa otra'); else assert.equal(result, null, other);
  }
});

test('vista de equipo del CEO: página aparte, sin nombres reales y sin tocar la dashboard personal', { skip: skinSkip }, () => {
  const { buildTeam } = require(path.join(W, 'build-work.cjs'));
  const preview = buildTeam({ mode: 'team-example' }), live = buildTeam({ mode: 'team' });
  assert.match(preview, /const TEAM_MODE="example"/); assert.match(preview, /Colaborador A/); assert.doesNotMatch(preview, /__WORK_NAME_/);
  assert.match(live, /const TEAM_MODE="core"/); assert.match(live, /async function signIn\(/); assert.doesNotMatch(live, /function teamExample/);
  for (const html of [preview, live]) {
    assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+href=|@import/i);
    assert.doesNotThrow(() => new (require('vm').Script)(html.match(/<script>\n([\s\S]*)\n<\/script>/)[1]));
  }
  assert.doesNotMatch(rd('work-team.js') + rd('work-team-example.js'), /\b(Julio|Robin|Mariel|Kendra|3 Kings)\b/);
  // No importa ni modifica nada de la dashboard personal aprobada.
  // Solo puede nombrar las dashboards aprobadas en la lista cerrada del enlace «← Mi dashboard»; nunca importar ni tocar su código.
  const team = rd('work-team.js');
  assert.doesNotMatch(team, /src\/dash|JanusNexo|janus-gold/);
  const mentions = team.split('\n').filter((line) => /dashboard\/a|dashboard\/b/.test(line));
  assert.ok(mentions.length > 0 && mentions.every((line) => /BACK_ALLOWED|backHref|En la vista previa no navega/.test(line)), 'solo la lista cerrada de retorno: ' + mentions.join(' | ').slice(0, 200));
});
