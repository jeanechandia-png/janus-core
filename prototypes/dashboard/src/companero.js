'use strict';
/* ===== Modo compañero (pieza LEGO `companion`) =====
 * Teléfono: el compañero ocupa la mitad superior. Tablet: un cuarto, ampliable a la mitad.
 * Medios: imágenes fijas originales (ElevenLabs gpt-image-2.5). Los clips animados (kling-3-pro) se importan
 * desde el propio dispositivo y se guardan en IndexedDB, nunca en el repositorio.
 */
const CREAT_IMG = { lumi: IMG.cLumi, bombo: IMG.cBombo, musgo: IMG.cMusgo, nimbo: IMG.cNimbo };
const CHILD = '__HIJA__';
function compState() {
  if (!ST.comp) ST.comp = { creatureId: 'lumi', names: {}, level: 1, streak: 0, misses: 0, fails: 0, seed: 7, topic: 'multiplicacion', sc: 0, enc: { said: [], recent: [] }, alerts: [], wide: false };
  return ST.comp;
}
function compProfile() {
  const C = compState(), p = Companion.newProfile('hija', CHILD, C.creatureId);
  p.names = C.names; p.mathLevel = C.level; p.encourage = C.enc; return p;
}
const COMP_UI = { say: '', gesture: '', hint: '', ok: null, scFb: '', renaming: false, clips: {} };

/* ---- clips en IndexedDB (por dispositivo) ---- */
const clipDB = () => new Promise((res, rej) => { try { const r = indexedDB.open('janus-companion', 1); r.onupgradeneeded = () => r.result.createObjectStore('clips'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } });
async function loadClips() {
  try { const db = await clipDB(); for (const c of Companion.CREATURES) { const blob = await new Promise((res) => { const q = db.transaction('clips').objectStore('clips').get(c.id); q.onsuccess = () => res(q.result); q.onerror = () => res(null); }); if (blob) COMP_UI.clips[c.id] = URL.createObjectURL(blob); } if (Object.keys(COMP_UI.clips).length) rerender(); } catch (e) { /* sin IndexedDB: se usan las imágenes */ }
}
async function saveClip(id, file) {
  try { const db = await clipDB(); await new Promise((res, rej) => { const t = db.transaction('clips', 'readwrite'); t.objectStore('clips').put(file, id); t.oncomplete = res; t.onerror = () => rej(t.error); }); } catch (e) { /* se muestra igualmente en esta sesión */ }
  COMP_UI.clips[id] = URL.createObjectURL(file); rerender();
}

function speak(text) {
  try {
    if (!('speechSynthesis' in window)) return; speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[^\p{L}\p{N}\s¿?¡!.,]/gu, ''));
    const c = Companion.getCreature(compState().creatureId); u.lang = 'es-ES'; u.pitch = c.voice.pitch === 'aguda' ? 1.7 : 1.3; u.rate = 1.05;
    speechSynthesis.speak(u);
  } catch (e) { /* sin voz del navegador */ }
}

function vCompanero(M, X, sub) {
  const C = compState(), p = compProfile(), cr = Companion.getCreature(C.creatureId), name = Companion.displayName(p);
  const ex = Companion.makeExercise(C.topic, C.level, C.seed), sc = Companion.SCENARIOS[C.sc % Companion.SCENARIOS.length];
  const media = COMP_UI.clips[cr.id]
    ? '<video class="cpv" src="' + COMP_UI.clips[cr.id] + '" autoplay loop muted playsinline></video>'
    : '<img class="cpi" src="' + CREAT_IMG[cr.id] + '" alt="' + esc(name) + '">';
  const say = COMP_UI.say || cr.catchphrases[0].replace('{n}', CHILD);
  const stage = '<section class="cpst g-' + (COMP_UI.gesture || 'idle') + (C.wide ? ' wide' : '') + '" style="--cp:' + cr.palette.primary + ';--cg:' + cr.palette.glow + '">' +
    '<div class="cpbg"></div><div class="cpfig">' + media + '<i class="cpsh"></i></div>' +
    '<div class="cpsay"><b>' + esc(name) + '</b><span>' + esc(say) + '</span><span class="mini mono"' + act('cpSpeak', '', 'Escuchar') + '>🔊</span></div>' +
    '<div class="cpname">' + (COMP_UI.renaming ? '<input type="text" maxlength="20" data-f="cpName" value="' + esc(name) + '" aria-label="Nombre"><span class="mini mono"' + act('cpRename') + '>✔</span>' : '<b class="serif gld">' + esc(name) + '</b><small class="mono">de ' + esc(cr.planet.split(',')[0]) + '</small><span class="mini mono"' + act('cpRenameOn', '', 'Cambiar nombre') + '>✎</span>') + '</div>' +
    '<div class="cpges">' + [['saludo', '👋'], ['cara', '😜'], ['baile', '💃'], ['risa', '😂']].map((g) => '<span class="cpg"' + act('cpGesture', g[0], g[0]) + '>' + g[1] + '</span>').join('') + '<span class="cpg wide"' + act('cpWide', '', 'Tamaño') + '>' + (C.wide ? '⇤' : '⇥') + '</span></div>' +
    '<div class="cpsel">' + Companion.CREATURES.map((c) => '<span class="cpo' + (c.id === cr.id ? ' on' : '') + '"' + act('cpPick', c.id, c.defaultName) + '><img src="' + CREAT_IMG[c.id] + '" alt=""><em class="mono">' + esc(Companion.displayName(p, c.id)) + '</em></span>').join('') + '</div></section>';

  const topics = [['suma', '+'], ['resta', '−'], ['multiplicacion', '×'], ['division', '÷'], ['fracciones', '½'], ['problema', '📖']];
  const math = panel('cpm', '🧮', 'Matemáticas con ' + esc(name), 'nivel ' + C.level + ' · racha ' + C.streak,
    '<div class="cptp">' + topics.map((t) => '<span class="pill2' + (t[0] === C.topic ? ' on' : '') + '"' + act('cpTopic', t[0]) + '>' + t[1] + '</span>').join('') + '</div>' +
    '<div class="cpq serif">' + esc(ex.prompt) + '</div>' +
    '<div class="addf"><input type="text" inputmode="decimal" data-f="cpAns" placeholder="Tu respuesta" aria-label="Respuesta"><span class="btn"' + act('cpCheck') + '>Comprobar</span><span class="btn"' + act('cpNext') + '>Otro</span></div>' +
    (COMP_UI.hint ? '<div class="note mono ' + (COMP_UI.ok ? 'ok' : '') + '">' + esc(COMP_UI.hint) + '</div>' : ''));
  const semaforo = panel('cps', '🚦', 'Juego del semáforo', 'leer las señales', '<p class="cpstory">' + esc(sc.story) + '</p><div class="cplights">' + [['rojo', '🔴 Parar'], ['amarillo', '🟡 Preguntar'], ['verde', '🟢 Seguir']].map((l) => '<span class="btn2 mono"' + act('cpLight', l[0]) + '>' + l[1] + '</span>').join('') + '</div>' + (COMP_UI.scFb ? '<div class="note mono">' + esc(COMP_UI.scFb) + '</div>' : ''));
  const chat = panel('cpc', '💬', 'Hablar con ' + esc(name), 'con cariño', '<div class="addf"><input type="text" maxlength="200" data-f="cpMsg" placeholder="Cuéntale algo a ' + esc(name) + '…"><span class="btn"' + act('cpSend') + '>Enviar</span></div>' +
    '<div class="dim">Si algo le preocupa, ' + esc(name) + ' la anima a contarlo y avisa a papá.</div>');
  const papa = panel('cpp', '🔐', 'Para papá', C.alerts.length ? C.alerts.length + ' aviso(s)' : 'sin avisos',
    (C.alerts.length ? C.alerts.slice(-3).reverse().map((a) => '<div class="li2">' + pill(a.severity, a.severity === 'urgente' ? 'r' : 'a') + '<span class="tx">' + esc(a.summary) + '</span><span class="mono dim">' + a.at + '</span></div>').join('') : '<div class="dim">Aquí aparecen los avisos si detecta tristeza, burlas o algo serio.</div>') +
    '<label class="btn2 mono">🎬 Importar clip animado de ' + esc(name) + '<input type="file" accept="video/*" data-f="cpClip" hidden></label>' +
    '<div class="dim mono">Voz y rostro: desactivados (solo en el dispositivo y con tu consentimiento). Voz actual: la del navegador, hasta diseñar la de ElevenLabs.</div>');
  return frame('companero', sub, M, stage + '<div class="cpact">' + math + semaforo + chat + papa + '</div>');
}
VIEWS.companero = vCompanero;
TABS.push(['companero', '🦊', 'Compañero']);

const nowHM = () => { const d = new Date(); return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };
function cpSay(text, gesture) { COMP_UI.say = text; COMP_UI.gesture = gesture || 'risa'; clearTimeout(cpSay.t); cpSay.t = setTimeout(() => { COMP_UI.gesture = ''; const st = document.querySelector('.cpst'); if (st) st.className = st.className.replace(/g-\S+/, 'g-idle'); }, 2600); speak(text); }
const COMP_ACTS = {
  cpPick: (id) => { compState().creatureId = id; COMP_UI.renaming = false; saveState(); const c = Companion.getCreature(id); cpSay('¡Hola, ' + CHILD + '! ' + c.catchphrases[0], 'saludo'); },
  cpRenameOn: () => { COMP_UI.renaming = true; },
  cpRename: () => { try { const C = compState(); const p = compProfile(); Companion.renameCreature(p, C.creatureId, field('cpName')); C.names = p.names; saveState(); COMP_UI.renaming = false; cpSay('¡Me encanta mi nombre nuevo! Gracias, ' + CHILD + '.', 'baile'); } catch (e) { COMP_UI.renaming = false; } },
  cpGesture: (g) => { const t = { saludo: '¡Holaaa, ' + CHILD + '!', cara: '¡Bluuu! ¿Me salió graciosa la cara?', baile: '¡A bailar! Un pasito para aquí, otro para allá.', risa: '¡Jajaja! Me haces cosquillas.' }[g]; cpSay(t, g); },
  cpWide: () => { const C = compState(); C.wide = !C.wide; saveState(); },
  cpSpeak: () => { speak(COMP_UI.say || Companion.getCreature(compState().creatureId).catchphrases[0]); },
  cpTopic: (t) => { const C = compState(); C.topic = t; C.seed = (Date.now() % 9973) + 1; C.fails = 0; COMP_UI.hint = ''; saveState(); },
  cpNext: () => { const C = compState(); C.seed = (Date.now() % 9973) + 1; C.fails = 0; COMP_UI.hint = ''; COMP_UI.ok = null; saveState(); },
  cpCheck: () => {
    const C = compState(), p = compProfile(), ex = Companion.makeExercise(C.topic, C.level, C.seed), r = Companion.checkAnswer(ex, field('cpAns'), C.fails), now = Date.now();
    if (r.correct) { C.streak++; C.misses = 0; C.level = Companion.adaptLevel(C.level, C.streak, 0); if (C.streak >= 3) C.streak = 0; COMP_UI.ok = true; const e = Companion.pickEncouragement('acierto', CHILD, p.encourage, now); COMP_UI.hint = '✔ ¡Correcto! ' + (e || ''); cpSay(e || '¡Correcto!', 'baile'); C.seed++; C.fails = 0; }
    else { C.fails++; COMP_UI.ok = false; if (r.next === 'mostrar-pasos') { C.misses++; C.level = Companion.adaptLevel(C.level, 0, C.misses); } const e = C.fails === 1 ? Companion.pickEncouragement('error', CHILD, p.encourage, now) : null; COMP_UI.hint = '💡 ' + r.hint + (r.next === 'mostrar-pasos' ? ' · Respuesta: ' + ex.answer : ''); cpSay(e || r.hint, 'cara'); }
    C.enc = p.encourage; saveState();
  },
  cpLight: (l) => { const C = compState(), sc = Companion.SCENARIOS[C.sc % Companion.SCENARIOS.length], r = Companion.answerScenario(sc, l); COMP_UI.scFb = (r.correct ? '✔ ' : '↺ ') + r.feedback; cpSay(r.feedback, r.correct ? 'baile' : 'cara'); if (r.correct) C.sc++; saveState(); },
  cpSend: () => {
    const C = compState(), p = compProfile(), msg = field('cpMsg'); if (!msg) return;
    const reply = '¡Qué interesante! Cuéntame más, me encanta escucharte.';
    const t = Companion.companionTurn(p, msg, reply, 'espontaneo', Date.now());
    if (t.safety.parentAlert) C.alerts.push(Object.assign({ at: nowHM() }, t.safety.parentAlert));
    C.enc = p.encourage; saveState(); cpSay(t.say.join(' '), t.safety.parentAlert ? 'saludo' : 'risa');
  }
};
document.addEventListener('change', (ev) => { if (ev.target.matches && ev.target.matches('[data-f="cpClip"]') && ev.target.files && ev.target.files[0]) saveClip(compState().creatureId, ev.target.files[0]); });
document.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && ev.target.matches) { if (ev.target.matches('[data-f="cpAns"]')) { COMP_ACTS.cpCheck(); rerender(); } else if (ev.target.matches('[data-f="cpMsg"]')) { COMP_ACTS.cpSend(); rerender(); } } });
loadClips();
