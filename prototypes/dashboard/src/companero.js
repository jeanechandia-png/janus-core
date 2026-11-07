'use strict';
/* ===== Criatura de Kendra — conserva ilustraciones originales y funciones heredadas =====
 * La criatura vive DENTRO de la escena 3D (lego/janus-stage-3d + lego/janus-creatures-3d), no como imagen encima.
 * Lógica: módulos LEGO componibles empaquetados en el global `Companion` (adaptador packages/adapters/src/companion-kit.ts):
 *   companion (carácter fijo, tutor, seguridad) · avatar-look (aspecto) · star-shop (estrellas, tienda, mundo) · scene-stage (escena y lecciones).
 * Los cambios de apariencia y voz no alteran las normas de seguridad o el perfil de Kendra.
 * Las lecciones usan representaciones concretas (IES/WWC 2021006, Rec. 3); no sustituyen a un profesional (ver pestaña «Papá»).
 */
const CP_APPROVED = typeof APPROVED_ART !== 'undefined' ? APPROVED_ART : { creatures:{}, accessories:{} };
const CREAT_IMG = { lumi: CP_APPROVED.creatures.lumi || IMG.cLumi, bombo: CP_APPROVED.creatures.bombo || IMG.cBombo, musgo: CP_APPROVED.creatures.musgo || IMG.cMusgo, nimbo: CP_APPROVED.creatures.nimbo || IMG.cNimbo };
// Approved art takes visual priority; procedural 3D is explicitly technical preview.
const cpArtIcon = (key, fallback) => {
  const image = (window.JanusOriginalArt && window.JanusOriginalArt.accessory(key)) || CP_APPROVED.accessories[key];
  return image ? '<img class="cp-approved-item" src="' + image + '" alt="" decoding="async">' : fallback;
};
const CHILD = 'Kendra'; // nombre de la usuaria, NO relación parental ni identidad del Founder
const CP_STAGE = 'kendra';
const CP_TABS = [['aprender', '🧮', 'Aprender'], ['vestidor', '👗', 'Vestidor'], ['tienda', '⭐', 'Tienda'], ['mundo', '🏠', 'Mi mundo'], ['hablar', '💬', 'Hablar'], ['papa', '🔐', 'Papá']];
function compState() {
  if (!ST.comp) ST.comp = { creatureId: 'lumi', names: {}, level: 1, streak: 0, misses: 0, fails: 0, seed: 7, topic: 'multiplicacion', sc: 0, enc: { said: [], recent: [] }, alerts: [] };
  const C = ST.comp; if (!C.looks) C.looks = {}; if (!C.names || typeof C.names !== 'object') C.names = {}; if (!C.furStyles || typeof C.furStyles !== 'object') C.furStyles = {}; if (!C.voiceStyles || typeof C.voiceStyles !== 'object') C.voiceStyles = {}; if (!C.voiceStyle) C.voiceStyle = C.voiceStyles[C.creatureId] || 'caricatura'; if (!C.tab) C.tab = 'aprender'; if (!C.aspect) C.aspect = 'criatura';
  // Triple filtro: los muñecos procedurales NO son los GLB hiperrealistas aprobados.
  // Nunca migrar silenciosamente preferencias antiguas hacia esos sustitutos.
  if (C.visualPolicyVersion !== '2026-11-06-approved-art-gate') {
    // Migración: portada original por defecto; el modo QA pedido expresamente no se pierde.
    if (C.userSelectedVisualMode !== true) C.visualMode = 'cinematic';
    C.visualPolicyVersion = '2026-11-06-approved-art-gate';
  }
  if (!['3d', 'edge', 'cinematic'].includes(C.visualMode)) C.visualMode = 'cinematic';
  return C;
}
/** Perfil del kit a partir de lo guardado (acepta perfiles antiguos sin aspecto ni mundo). */
function compProfile() {
  const C = compState(), p = Companion.newKitProfile('kendra', CHILD, C.creatureId);
  p.names = C.names; p.mathLevel = C.level; p.encourage = C.enc; p.looks = C.looks; if (C.world) p.world = C.world; Companion.worldOf(p); return p;
}
function compSave(p) { const C = compState(); C.names = p.names; C.enc = p.encourage; C.looks = p.looks || {}; C.world = p.world; saveState(); }
const COMP_UI = { say: '', hint: '', ok: null, scFb: '', renaming: false, scn: null, sel: null, lesson: null, sol: false, si: -1, goal: null, goalDone: {}, view: null, toast: '', ended: false };
const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };
const hexLook = (l) => ({ fur: Companion.SWATCHES[l.fur].hex, accent: Companion.SWATCHES[l.accent].hex, eyes: Companion.EYES[l.eyes].hex, outfit: l.outfit, outfitColor: Companion.SWATCHES[l.outfitColor].hex, accessoryColor: Companion.SWATCHES[l.accessoryColor].hex, accessories: l.accessories });
const cpStage = () => (window.JanusStage3D ? JanusStage3D.get(CP_STAGE) : null);

function speak(text, opts) {
  // Sólo las criaturas usan esta voz. Janus Nexo mantiene su sistema de voz independiente.
  const C = compState(), V = window.JanusCartoonVoice;
  if (!V) return { ok:false, reason:'unavailable' };
  const o = opts || {};
  return V.speak(text, C.creatureId, {
    enabled: C.voiceEnabled !== false,
    force: o.force === true,
    style: C.voiceStyle || 'caricatura',
    mood: o.mood || 'contento',
    onStart: () => {
      if (window.JanusEdgeCompanion) JanusEdgeCompanion.react('habla', 1.5, o.mood || 'contento');
    }
  });
}

/* ───────────── estrellas (por esfuerzo, con tope diario e idempotentes) ───────────── */
function cpEarn(reason, eventId) {
  const p = compProfile(), r = Companion.earn(Companion.worldOf(p), reason, todayStr(), eventId);
  if (r.duplicate) return 0;
  p.world = r.world; compSave(p);
  COMP_UI.toast = r.gained > 0 ? '+' + r.gained + ' ★' : 'Hoy ya juntaste las ' + Companion.DAILY_CAP + ' estrellas. ¡Mañana hay más!';
  clearTimeout(cpEarn.t); cpEarn.t = setTimeout(() => { COMP_UI.toast = ''; cpRefreshOv(); }, 3200);
  const st = cpStage(); if (st && r.gained > 0) st.sparkle(-1.6, 1.5, '#FFE07A');
  return r.gained;
}

/* ───────────── habla de la criatura ───────────── */
function cpSay(text, pose, quiet, mood) {
  COMP_UI.say = text; const st = cpStage();
  const secs = Math.min(8, Math.max(2, text.length * 0.055 + 1.2));
  if (st) st.react(pose || 'habla', secs, mood);
  if (window.JanusEdgeCompanion) JanusEdgeCompanion.react(pose || 'habla', secs, mood);
  if (!quiet) speak(text, { mood: mood || 'contento' });
  cpRefreshOv();
}

/* ───────────── escena 3D: sincronía con el estado ───────────── */
function cpSyncStage(st) {
  const C = compState(), p = compProfile(), w = Companion.worldOf(p);
  if (!COMP_UI.scn) COMP_UI.scn = Companion.newScene();
  if (st.setAspect) st.setAspect(C.aspect);
  st.setCreature(C.creatureId, hexLook(Companion.lookOf(p)));
  if (st.setWind) st.setWind(Number.isFinite(C.windStrength) ? C.windStrength : 0.3);
  if (st.setFurStyle) st.setFurStyle(C.furStyles[C.creatureId] || 'natural');
  st.setWorld({ home: w.home, vehicle: w.vehicle, decor: w.decor });
  st.setMode(C.tab === 'mundo' ? 'mundo' : 'escena');
  if (C.tab !== 'mundo') st.setView(COMP_UI.view);
  st.apply(COMP_UI.scn, []);
  st.select(COMP_UI.sel);
}
function cpAfterRender() {
  if (typeof ROUTE === 'undefined' || ROUTE.v !== 'companero') {
    if (window.JanusEdgeCompanion) JanusEdgeCompanion.hide();
    return;
  }
  document.querySelectorAll('#view [data-hex]').forEach((el) => el.style.setProperty('--c', el.getAttribute('data-hex')));
  if (window.JanusEdgeCompanion) {
    const C = compState(), p = compProfile(), edge = !!document.querySelector('#view .cpst3.edge-hero');
    JanusEdgeCompanion.sync({
      active: edge, id: C.creatureId, name: Companion.displayName(p),
      look: hexLook(Companion.lookOf(p)), style: C.furStyles[C.creatureId] || 'natural',
      wind: Number.isFinite(C.windStrength) ? C.windStrength : 0.3,
      side: C.edgeSide || 'left', roam: C.edgeRoam !== false,
      onTap: cpOnTapCreature,
      onDock: (side) => { if (C.edgeSide !== side) { C.edgeSide = side; saveState(); } },
      onError: () => { if (C.visualMode !== 'cinematic') { C.visualMode = 'cinematic'; saveState(); rerender(); } }
    });
  }
  if (!window.JanusStage3D || !document.querySelector('#view [data-stage3d]')) return;
  const st = cpStage(); if (!st) return;
  if (!st._wired) { st._wired = true; st.on({ move: cpOnMove, tapProp: cpOnTapProp, tapCreature: cpOnTapCreature, tapHome: cpOnTapHome, tapVehicle: cpOnTapVehicle, tapDecor: cpOnTapDecor, tapEmpty: cpOnTapEmpty }); }
  cpSyncStage(st);
}
function cpRefreshOv() { const el = document.querySelector('#view .cpov'); if (el) el.innerHTML = cpOverlay(); }
function cpApply(events) { const st = cpStage(); if (st) st.apply(COMP_UI.scn, events || []); cpCheckGoal(); }

function cpOnMove(id, to) { try { COMP_UI.scn = Companion.userMove(COMP_UI.scn, id, to); } catch (e) { return; } COMP_UI.sel = id; cpApply(); cpRefreshOv(); }
function cpOnTapProp(id) { COMP_UI.sel = id; const st = cpStage(); if (st) st.select(id); cpRefreshOv(); }
function cpOnTapEmpty() { if (COMP_UI.sel) { COMP_UI.sel = null; const st = cpStage(); if (st) st.select(null); cpRefreshOv(); } }
function cpOnTapCreature() { const cr = Companion.getCreature(compState().creatureId); cpSay('¡Hola, ' + CHILD + '! ' + cr.catchphrases[Math.floor(Math.random() * cr.catchphrases.length)].replaceAll('{n}', CHILD), 'saluda'); }
function cpOnTapHome() { cpSay('¡Esta es mi casa! Aquí descanso después de aprender contigo.', 'saluda'); }
function cpOnTapVehicle() { const w = Companion.worldOf(compProfile()); cpSay(w.vehicle === 'veh:cohete' ? '¡Tres, dos, uno… despegue!' : '¡Brrrum! Vamos a dar una vuelta.', 'celebra'); }
function cpOnTapDecor() { cpSay('¡Qué bonito se ve todo, ' + CHILD + '!', 'saluda', true); }

/* ───────────── lecciones: representaciones concretas, a su ritmo ───────────── */
function cpExercise() { const C = compState(); return Companion.makeExercise(C.topic, C.level, C.seed); }
function cpReset() { COMP_UI.lesson = null; COMP_UI.sol = false; COMP_UI.si = -1; COMP_UI.goal = null; COMP_UI.ended = false; COMP_UI.sel = null; COMP_UI.scn = Companion.newScene(); const st = cpStage(); if (st) { st.select(null); st.apply(COMP_UI.scn, []); } }
function cpLessonStart(withSolution) {
  const C = compState(), ex = cpExercise();
  COMP_UI.lesson = Companion.buildCreatureLesson({ id: ex.id, topic: ex.topic, params: ex.params }, C.creatureId);
  COMP_UI.sol = !!withSolution; COMP_UI.si = -1; COMP_UI.goal = null; COMP_UI.ended = false; COMP_UI.sel = null; COMP_UI.scn = Companion.newScene(); cpStep();
}
function cpStep() {
  const L = COMP_UI.lesson; if (!L) return;
  const steps = Companion.stepsFor(L, COMP_UI.sol), i = COMP_UI.si + 1;
  if (i >= steps.length) {
    COMP_UI.ended = true; COMP_UI.goal = null;
    cpSay(COMP_UI.sol ? '¡Eso es todo! ¿Lo intentas tú ahora? Escribe tu respuesta.' : 'Ahora te toca a ti: escribe tu respuesta. Si lo necesitas, pulsa «Ver los pasos».', 'saluda');
    return;
  }
  COMP_UI.si = i; const s = steps[i], r = Companion.applyCommands(COMP_UI.scn, s.commands);
  COMP_UI.scn = r.state; COMP_UI.goal = s.build || null; if (!s.build) COMP_UI.sel = COMP_UI.sel && COMP_UI.scn.props.some((q) => q.id === COMP_UI.sel) ? COMP_UI.sel : null;
  cpApply(r.events); cpSay(s.say, COMP_UI.scn.creature.pose === 'senala' ? 'senala' : 'habla');
}
function goalText(g) { return g.kind === 'valor' ? 'forma el número ' + g.target : g.kind === 'galletas' ? 'pon ' + g.target + ' galletas' : 'pinta ' + g.target + ' porciones'; }
function cpCheckGoal() {
  const g = COMP_UI.goal, L = COMP_UI.lesson; if (!g || !L) return;
  const r = Companion.checkBuild(COMP_UI.scn, g), key = L.exerciseId + ':' + COMP_UI.si;
  if (r.done && !COMP_UI.goalDone[key]) {
    COMP_UI.goalDone[key] = true; cpEarn('leccion', 'leccion:' + key);
    const st = cpStage(); if (st) st.celebrate(); cpSay('¡Lo lograste, ' + CHILD + '! Mira cómo queda.', 'celebra');
  }
}

/* ───────────── vista ───────────── */
const PLACE_ONE = ['unidad', 'decena', 'centena', 'unidad de millar', 'decena de millar'];
function cpHud() {
  const scn = COMP_UI.scn || Companion.newScene(), L = COMP_UI.lesson, out = [];
  if (COMP_UI.goal) { const r = Companion.checkBuild(scn, COMP_UI.goal); out.push('<div class="cpgoal' + (r.done ? ' ok' : '') + '">✋ <b>Tu turno</b> · ' + esc(goalText(COMP_UI.goal)) + ' · llevas <b>' + r.now + '</b> de <b>' + r.target + '</b>' + (r.done ? ' ✔' : '') + '</div>'); }
  const s = scn.props.find((q) => q.id === COMP_UI.sel);
  if (s && s.kind !== 'cartel') {
    const one = s.n === 1, unit = s.kind === 'columna' ? (one ? PLACE_ONE[s.of] : Companion.PLACE_NAME[s.of]) : s.kind === 'tarta' ? (one ? 'porción' : 'porciones') : s.kind === 'semaforo' ? 'luz' : (one ? 'galleta' : 'galletas');
    let bar = s.kind === 'semaforo' ? '<span class="cpb wd"' + act('cpAdj', '1', 'Cambiar la luz') + '>🚦 Cambiar luz</span>' : '<span class="cpb"' + act('cpAdj', '-1', 'Quitar uno') + '>−</span><span class="cpn"><b>' + (s.kind === 'tarta' ? s.n + '/' + s.of : s.n) + '</b> <small class="mono">' + esc(unit) + '</small></span><span class="cpb"' + act('cpAdj', '1', 'Poner uno') + '>＋</span>';
    if (s.kind === 'columna') {
      const up = scn.props.some((q) => q.kind === 'columna' && q.of === s.of + 1) && s.n >= 10, dn = scn.props.some((q) => q.kind === 'columna' && q.of === s.of - 1) && s.n >= 1;
      bar += '<span class="cpb wd' + (up ? '' : ' off') + '"' + act('cpExch', 'subir', 'Cambiar diez por uno de la columna de al lado') + '>⇧ 10 → 1</span><span class="cpb wd' + (dn ? '' : ' off') + '"' + act('cpExch', 'bajar', 'Cambiar uno por diez de la columna de al lado') + '>⇩ 1 → 10</span>';
    }
    out.push('<div class="cptool">' + bar + '</div>');
  }
  if (L) { const steps = Companion.stepsFor(L, COMP_UI.sol); out.push('<div class="cplb"><span class="cpb wd"' + act('cpRetry', '', 'Empezar otra vez') + '>↺ Otra vez</span><span class="cpn mono">paso ' + Math.max(1, Math.min(COMP_UI.si + 1, steps.length)) + ' de ' + steps.length + '</span>' + (COMP_UI.ended ? '' : '<span class="cpb wd go"' + act('cpStep', '', COMP_UI.si >= steps.length - 1 ? 'Ya terminé' : 'Siguiente paso') + '>' + (COMP_UI.si >= steps.length - 1 ? 'Ya terminé ✔' : 'Siguiente ▶') + '</span>') + '</div>'); }
  else out.push('<div class="cplb"><span class="cpb wd go"' + act('cpShow', '', 'Muéstramelo con la escena') + '>🎬 Muéstramelo</span></div>');
  return out.join('');
}
function cpOverlay() {
  const C = compState(), p = compProfile(), cr = Companion.getCreature(C.creatureId), name = Companion.displayName(p), w = Companion.worldOf(p);
  const say = COMP_UI.say || '¡Hola, ' + CHILD + '! ' + cr.catchphrases[0].replaceAll('{n}', CHILD), mundo = C.tab === 'mundo';
  const views = mundo ? '' : '<div class="cpviews">' + [['amplia', '🔭', 'Vista amplia'], ['mesa', '🍪', 'Vista de la mesa'], ['primer-plano', '🔍', 'Más cerca']].map((v) => '<span class="cpvb' + (COMP_UI.view === v[0] ? ' on' : '') + '"' + act('cpView', v[0], v[2]) + '>' + v[1] + '</span>').join('') + '<span class="cpvb"' + act('cpView', '', 'Que la cámara siga la lección') + '>🎯</span></div>';
  return '<div class="cpsay"><b>' + esc(name) + '</b><span>' + esc(say) + '</span><span class="mini mono"' + act('cpSpeak', '', 'Escuchar') + '>🔊</span></div>' +
    '<div class="cpstars mono" title="Estrellas: se ganan por esfuerzo, máximo ' + Companion.DAILY_CAP + ' al día">★ <b>' + w.stars + '</b><span class="hoy"> · hoy ' + w.earnedToday + '/' + Companion.DAILY_CAP + '</span>' + (COMP_UI.toast ? '<em>' + esc(COMP_UI.toast) + '</em>' : '') + '</div>' + views +
    '<div class="cphud">' + (mundo ? '<div class="cplb"><span class="cpb wd go"' + act('cpTab', 'aprender', 'Volver a la mesa de práctica') + '>🧮 A la mesa de práctica</span></div>' : cpHud()) + '</div>' +
    '<div class="cpbar"><div class="cpname">' + (COMP_UI.renaming ? '<input type="text" maxlength="20" data-f="cpName" value="' + esc(name) + '" aria-label="Nombre"><span class="mini mono"' + act('cpRename') + '>✔</span>' : '<b class="serif gld">' + esc(name) + '</b><small class="mono">de ' + esc(cr.planet.split(',')[0]) + '</small><span class="mini mono"' + act('cpRenameOn', '', 'Cambiar nombre') + '>✎</span>') + '</div>' +
    '<div class="cpsel">' + Companion.CREATURES.map((c) => '<span class="cpo' + (c.id === cr.id ? ' on' : '') + '"' + act('cpPick', c.id, Companion.displayName(p, c.id)) + '><img src="' + CREAT_IMG[c.id] + '" alt=""><em class="mono">' + esc(Companion.displayName(p, c.id)) + '</em></span>').join('') + '</div></div>';
}

/* El color de la muestra va en data-hex y se pone por JS tras pintar: la piel B traduce los colores de los atributos style y falsearía el color real del pelo/ojos. */
const dot = (a, arg, hex, label, on) => '<i class="cpdot' + (on ? ' on' : '') + '" data-hex="' + hex + '"' + act(a, arg, label) + '></i>';
const chip = (a, arg, icon, label, st, price) => '<span class="cpc' + (st ? ' ' + st : '') + '"' + act(a, arg, label + (st === 'lock' ? ' (bloqueado: ' + price + ' estrellas)' : '')) + '><i>' + icon + '</i><em>' + esc(label) + '</em>' + (st === 'lock' ? '<b>🔒 ' + price + '★</b>' : '') + '</span>';

function tabAprender(p, name) {
  const C = compState(), ex = cpExercise(), topics = [['suma', '+'], ['resta', '−'], ['multiplicacion', '×'], ['division', '÷'], ['fracciones', '½'], ['problema', '📖']];
  return '<div class="cptp">' + topics.map((t) => '<span class="pill2' + (t[0] === C.topic ? ' on' : '') + '"' + act('cpTopic', t[0]) + '>' + t[1] + '</span>').join('') + '</div>' +
    '<div class="cpq serif">' + esc(ex.prompt) + '</div><div class="dim mono">nivel ' + C.level + ' · racha ' + C.streak + '</div>' +
    '<div class="addf"><input type="text" inputmode="decimal" data-f="cpAns" placeholder="Tu respuesta" aria-label="Respuesta"><span class="btn"' + act('cpCheck') + '>Comprobar</span><span class="btn"' + act('cpNext') + '>Otro</span></div>' +
    '<div class="cpbtns"><span class="btn2 mono"' + act('cpShow', '', 'Muéstramelo') + '>🎬 Muéstramelo</span>' + (COMP_UI.lesson && !COMP_UI.sol ? '<span class="btn2 mono"' + act('cpSol', '', 'Ver los pasos completos') + '>👀 Ver los pasos</span>' : !COMP_UI.lesson ? '<span class="btn2 mono"' + act('cpSolStart', '', 'Ver los pasos completos') + '>👀 Ver los pasos</span>' : '') + '</div>' +
    (COMP_UI.hint ? '<div class="note mono ' + (COMP_UI.ok ? 'ok' : '') + '">' + esc(COMP_UI.hint) + '</div>' : '') +
    '<div class="dim cpmini">Mueve las cosas con el dedo: arrastra para cambiarlas de sitio, toca para elegirlas y cambia la cantidad con los botones. Arrastra el fondo para girar y pellizca para acercar.</div>';
}
function tabVestidor(p, name) {
  const w = Companion.worldOf(p), look = Companion.lookOf(p), S = Companion.SWATCHES, own = (k) => w.owned.includes(k);
  const sw = (part, cur) => '<div class="cpsw">' + Companion.SWATCH_IDS.map((id) => dot('cpWear', part + '|' + id, S[id].hex, S[id].label, cur === id)).join('') + '</div>';
  const price = (k) => (Companion.kitShop.item(k) || { price: 0 }).price;
  const slotRow = (slot) => '<div class="cpgr"><h4 class="mono">' + esc(Companion.SLOT_LABEL[slot]) + '</h4><div class="cpchips">' + chip('cpWear', 'accessory|' + slot + '|', '∅', 'Ninguno', !look.accessories[slot] ? 'on' : '') + Companion.ACCESSORIES[slot].map((a) => { const k = Companion.accessoryKey(slot, a.id); return chip('cpWear', 'accessory|' + slot + '|' + a.id, cpArtIcon(k,a.icon), a.label, look.accessories[slot] === a.id ? 'on' : own(k) ? '' : 'lock', price(k)); }).join('') + '</div></div>';
  const C = compState(), asp = C.aspect, canFace = !!window.JanusFace3D;
  const species = C.creatureId, opts = CP_STYLES[species] || CP_STYLES.lumi;
  const style = C.furStyles[species] || 'natural';
  const approvedGallery = '<div class="cpgr cp-approved-characters" aria-label="Criaturas aprobadas">' +
    '<h4 class="mono">Criaturas oficiales · arte aprobado</h4>' +
    '<div class="cp-approved-grid">' + Companion.CREATURES.map((item) =>
      '<button type="button" class="cp-approved-card' + (item.id === C.creatureId ? ' on' : '') +
      '"' + act('cpPick',item.id,'Elegir '+item.defaultName) +
      ' aria-pressed="' + (item.id === C.creatureId) + '">' +
      '<img src="' + ((window.JanusOriginalArt && window.JanusOriginalArt.creature(item.id)) || CREAT_IMG[item.id]) + '" alt="' + esc(item.defaultName) + '" loading="lazy" decoding="async">' +
      '<b>' + esc(item.defaultName) + '</b></button>'
    ).join('') + '</div></div>';
  const identity = '<div class="cpgr cp-identity"><h4 class="mono">Mi criatura · el nombre que tú elijas</h4>' +
    '<p class="cpmini dim">Se llama <b>' + esc(name) + '</b>. Puedes cambiar su nombre cuando quieras, sin gastar estrellas. ' + esc(name) + ' puede participar en tus actividades y siempre te llamará Kendra por tu nombre.</p>' +
    '<div class="addf"><input type="text" data-f="cpNewName" maxlength="20" value="' + esc(name) + '" aria-label="Nombre de mi criatura" placeholder="Escribe el nombre que quieras">' +
    '<span class="btn" role="button" tabindex="0"' + act('cpRenameWardrobe', '', 'Guardar el nombre de mi criatura') + '>Guardar nombre</span></div>' +
    (COMP_UI.nameMsg ? '<p class="cpmini dim" role="status">' + esc(COMP_UI.nameMsg) + '</p>' : '') + '</div>';
  const furPanel = '<div class="cpgr"><h4 class="mono">' + (species === 'bombo' ? 'Forma de las branquias' : species === 'musgo' ? 'Estilo del musgo' : species === 'nimbo' ? 'Forma de la nube' : 'Estilo del pelaje') + '</h4>' +
    '<p class="cpmini dim">Personalízalo como más te guste. La forma cambia en la criatura 3D; su personalidad y sus recuerdos siguen siendo los mismos.</p>' +
    '<div class="cpchips">' + opts.map((item) => chip('cpStyle', item[0], '✦', item[1], style === item[0] ? 'on' : '')).join('') + '</div></div>';
  return approvedGallery + identity + furPanel + (canFace ? '<div class="cpgr"><h4 class="mono">Cómo aparece ' + esc(name) + '</h4><div class="cpchips">' + chip('cpAspect', 'criatura', '🦊', 'Criatura', asp === 'criatura' ? 'on' : '') + chip('cpAspect', 'cara', '👀', 'Cara con expresiones', asp === 'cara' ? 'on' : '') + '</div>' + (asp === 'cara' ? '<p class="cpmini dim">Ojos y sonrisa flotantes, como la cara del robot de Janus. Aquí eliges el color de los ojos; las emociones están en «Hablar».</p>' : '') + '</div>' : '') +
    '<p class="cpmini dim">Tú decides cómo se ve ' + esc(name) + '. Cambiar su aspecto no cambia cómo es: sigue siendo ' + esc(name) + '.</p>' +
    '<div class="cpgr"><h4 class="mono">Viento en fibras 3D</h4><div class="cpchips">' +
      [[0, '🍃 Calma'], [0.3, '🌬 Brisa'], [0.7, '💨 Viento']].map((v) => chip('cpWind', v[0], v[1], v[1], String(Number.isFinite(compState().windStrength) ? compState().windStrength : 0.3) === String(v[0]) ? 'on' : '')).join('') +
      '</div><p class="cpmini dim">Pelaje y musgo en geometría 3D con viento en GPU. Bombo mantiene piel húmeda sin pelo. En modelos GLB el viento depende del atributo COLOR_1 del contrato.</p></div>' +
    '<div class="cpgr"><h4 class="mono">Color del pelo</h4>' + sw('fur', look.fur) + '</div><div class="cpgr"><h4 class="mono">Detalles</h4>' + sw('accent', look.accent) + '</div>' +
    '<div class="cpgr"><h4 class="mono">Ojos</h4><div class="cpsw">' + Companion.EYE_IDS.map((id) => dot('cpWear', 'eyes|' + id, Companion.EYES[id].hex, Companion.EYES[id].label, look.eyes === id)).join('') + '</div></div>' +
    '<div class="cpgr"><h4 class="mono">Ropa</h4><div class="cpchips">' + Companion.OUTFITS.map((o) => { const k = Companion.outfitKey(o.id); return chip('cpWear', 'outfit|' + o.id, cpArtIcon(k,o.icon), o.label, look.outfit === o.id ? 'on' : own(k) ? '' : 'lock', price(k)); }).join('') + '</div>' + (look.outfit !== 'ninguna' ? '<h4 class="mono">Color de la ropa</h4>' + sw('outfitColor', look.outfitColor) : '') + '</div>' +
    Companion.SLOTS.map(slotRow).join('') + (Object.keys(look.accessories).length ? '<div class="cpgr"><h4 class="mono">Color de los accesorios</h4>' + sw('accessoryColor', look.accessoryColor) + '</div>' : '') +
    '<div class="cpbtns"><span class="btn2 mono"' + act('cpSurprise', '', 'Sorpréndeme') + '>🎲 Sorpréndeme</span><span class="btn2 mono"' + act('cpResetLook', '', 'Como al principio') + '>↺ Como al principio</span></div>';
}
function tabTienda(p, name) {
  const w = Companion.worldOf(p), sections = [['Ropa', (i) => i.kind === 'out'], ['Accesorios', (i) => i.kind === 'acc'], ['Casas', (i) => i.kind === 'home'], ['Vehículos', (i) => i.kind === 'veh'], ['Decoración', (i) => i.kind === 'dec']];
  const items = Companion.kitShop.catalog.filter((i) => i.price > 0);
  return '<div class="cpwal"><b>★ ' + w.stars + '</b> estrellas<small class="mono">se ganan por intentarlo y aprender · máximo ' + Companion.DAILY_CAP + ' al día · hoy ' + w.earnedToday + '</small></div>' +
    sections.map((s) => { const list = items.filter(s[1]).sort((a, b) => a.price - b.price); return list.length ? '<div class="cpgr"><h4 class="mono">' + s[0] + '</h4><div class="cpchips">' + list.map((it) => { const have = w.owned.includes(it.key), can = w.stars >= it.price; return '<span class="cpc' + (have ? ' on' : can ? '' : ' dim2') + '"' + act(have ? 'cpNoop' : 'cpBuy', it.key, it.label + (have ? ' (ya es tuyo)' : ' · ' + it.price + ' estrellas')) + '><i>' + cpArtIcon(it.key,it.icon) + '</i><em>' + esc(it.label) + '</em><b>' + (have ? '✔ tuyo' : it.price + '★') + '</b></span>'; }).join('') + '</div></div>' : ''; }).join('') +
    '<p class="cpmini dim">Nada se pierde ni se acaba: fallar nunca quita estrellas ni objetos.</p>';
}
function tabMundo(p, name) {
  const w = Companion.worldOf(p), it = (k) => Companion.kitShop.item(k), ownedOf = (keys) => keys.filter((k) => w.owned.includes(k));
  return '<p class="cpmini dim">Este es el mundo de ' + esc(name) + '. Toca la casa, el vehículo y los objetos en la escena.</p>' +
    '<div class="cpgr"><h4 class="mono">Mi casa</h4><div class="cpchips">' + ownedOf(Companion.HOME_KEYS).map((k) => chip('cpHome', k, it(k).icon, it(k).label, w.home === k ? 'on' : '')).join('') + '</div></div>' +
    '<div class="cpgr"><h4 class="mono">Mi vehículo</h4><div class="cpchips">' + chip('cpVeh', '', '∅', 'Ninguno', !w.vehicle ? 'on' : '') + ownedOf(Companion.VEHICLE_KEYS).map((k) => chip('cpVeh', k, it(k).icon, it(k).label, w.vehicle === k ? 'on' : '')).join('') + '</div></div>' +
    '<div class="cpgr"><h4 class="mono">Decoración (hasta ' + Companion.MAX_DECOR + ')</h4><div class="cpchips">' + (ownedOf(Companion.DECOR_KEYS).map((k) => chip('cpDecor', k, it(k).icon, it(k).label, w.decor.includes(k) ? 'on' : '')).join('') || '<span class="dim">Todavía no tienes. ¡Mira la Tienda!</span>') + '</div></div>' +
    '<div class="cpbtns"><span class="btn2 mono"' + act('cpTab', 'tienda', 'Ir a la tienda') + '>⭐ Ir a la tienda</span></div>';
}
const CP_STYLES = {
  lumi: [['natural', 'Natural'], ['corto', 'Cortito'], ['esponjoso', 'Esponjoso'], ['rebelde', 'Despeinado']],
  musgo: [['natural', 'Natural'], ['corto', 'Musgo corto'], ['esponjoso', 'Frondoso'], ['rebelde', 'Silvestre']],
  nimbo: [['natural', 'Natural'], ['corto', 'Nube suave'], ['esponjoso', 'Nube esponjosa'], ['rebelde', 'Ondulado']],
  bombo: [['natural', 'Branquias naturales'], ['corto', 'Compactas'], ['esponjoso', 'Abundantes'], ['rebelde', 'Onduladas']]
};
const CP_MOODS = [['alegre', '😄', 'Alegre'], ['contento', '🙂', 'Contento'], ['triste', '😢', 'Triste'], ['enojado', '😠', 'Enojado'], ['sorprendido', '😮', 'Sorprendido'], ['pensativo', '🤔', 'Pensativo']];
function tabHablar(p, name) {
  const sc = Companion.SCENARIOS[compState().sc % Companion.SCENARIOS.length];
  const C = compState(), V = window.JanusCartoonVoice;
  const voice = V ? V.profile(C.creatureId, C.voiceStyle || 'caricatura') : null;
  const soundOn = C.voiceEnabled !== false;
  const faceMoods = {
    lumi: ['contento','sorprendido','alegre'],
    bombo: ['alegre','sorprendido','contento'],
    musgo: ['alegre','sorprendido','enojado'],
    nimbo: ['alegre','sorprendido','contento']
  };
  const approvedFaces = (CP_APPROVED.expressions?.[C.creatureId] || [null,null,null]).map((source,index) => {
    const src = (window.JanusOriginalArt && window.JanusOriginalArt.expression(C.creatureId,index)) || source;
    const mood = faceMoods[C.creatureId]?.[index] || 'contento';
    const label = CP_MOODS.find((item) => item[0] === mood)?.[2] || mood;
    return src ? '<button type="button" class="cp-approved-expression"' +
      act('cpMood',mood,label + ' (expresión ilustrada aprobada)') +
      '><img src="' + src + '" alt="' + esc(name) + ': ' + label + '" loading="lazy" decoding="async">' +
      '<span>' + label + '</span></button>' : '';
  }).join('');

  const voicePanel = '<div class="cpgr cp-voice" aria-label="Voz de caricatura de la criatura">' +
    '<h4 class="mono">Voz caricaturesca · ' + esc(name) + '</h4>' +
    '<p class="cpmini dim">' + esc(voice ? voice.label : 'Voz del dispositivo') +
    '. La misma voz caricaturesca habla para todas las criaturas. Usa la síntesis disponible en el dispositivo, sin cuentas ni pagos.</p>' +
    '<div class="cpchips">' + (V ? V.styles.map((item) =>
      chip('cpVoiceStyle', item.id, '♪', item.label, (C.voiceStyle || 'caricatura') === item.id ? 'on' : '')
    ).join('') : '') + '</div>' +
    '<div class="cpbtns"><button type="button" class="btn2 mono"' +
      act('cpVoiceToggle', '', soundOn ? 'Silenciar la criatura' : 'Activar la voz caricaturesca') + '>' +
      (soundOn ? '🔊 Voz activada' : '🔇 Voz silenciada') + '</button>' +
    '<button type="button" class="btn2 mono"' + act('cpVoicePreview', '', 'Escuchar una muestra de la voz de esta criatura') +
    '>▶ Escuchar muestra</button></div>' +
    (COMP_UI.voiceMsg ? '<p class="cpmini dim" role="status">' + esc(COMP_UI.voiceMsg) + '</p>' : '') +
    '</div>';
  return voicePanel + '<div class="cpgr"><h4 class="mono">Cómo se siente ' + esc(name) + '</h4>' +
    (approvedFaces ? '<div class="cp-approved-faces" aria-label="Expresiones originales aprobadas">' + approvedFaces + '</div>' : '') +
    '<div class="cpchips">' + CP_MOODS.map((g) => chip('cpMood', g[0], g[1], g[2], '')).join('') + '</div></div>' +
    '<div class="cpgr"><h4 class="mono">Jugar con ' + esc(name) + '</h4><div class="cpchips">' + [['saludo', '👋', 'Saludar'], ['cara', '😜', 'Cara graciosa'], ['baile', '💃', 'Bailar'], ['risa', '😂', 'Reír']].map((g) => chip('cpGesture', g[0], g[1], g[2], '')).join('') + '</div></div>' +
    '<div class="cpgr"><h4 class="mono">Contarle algo</h4><div class="addf"><input type="text" maxlength="200" data-f="cpMsg" placeholder="Cuéntale algo a ' + esc(name) + '…"><span class="btn"' + act('cpSend') + '>Enviar</span></div><div class="dim cpmini">Si algo preocupa a Kendra, ' + esc(name) + ' la anima a contárselo a un adulto. Los avisos se muestran solo aquí: aún no se envían notificaciones externas.</div></div>' +
    '<div class="cpgr"><h4 class="mono">🚦 Juego del semáforo</h4><p class="cpstory">' + esc(sc.story) + '</p><div class="cplights">' + [['rojo', '🔴 Parar'], ['amarillo', '🟡 Preguntar'], ['verde', '🟢 Seguir']].map((l) => '<span class="btn2 mono"' + act('cpLight', l[0]) + '>' + l[1] + '</span>').join('') + '</div>' + (COMP_UI.scFb ? '<div class="note mono">' + esc(COMP_UI.scFb) + '</div>' : '') + '</div>';
}
const SLOT_NAMES = { lumi: 'Lumi', bombo: 'Bombo', musgo: 'Musgo', nimbo: 'Nimbo', robot: 'Nexo masculino', 'robot-femenino': 'Nexo femenino' };
function slotPanel() {
  const art = window.JanusOriginalArt, exact = art && art.hasComplete();
  const importer = '<div class="cpgr cp-original-import"><h4 class="mono">Arte original privado · Lumi, Bombo, Musgo y Nimbo</h4>' +
    '<p class="cpmini dim">Carga el paquete JSON original de InfinitySeed desde Archivos. Valida 26 ilustraciones y SHA-256 localmente; no se envía a internet ni a Kling.</p>' +
    '<label class="btn2 mono cpfile">📂 Importar 26 originales <input type="file" accept="application/json,.json" data-original-art-file aria-label="Importar paquete original aprobado de las cuatro criaturas"></label>' +
    '<span class="cpmini" role="status">' + (exact ? '26/26 originales correctos · ' + (art.persisted() ? 'guardados en este dispositivo' : 'solo esta sesión') : 'Originales exactos pendientes de importar') + '</span></div>';
  const S = window.JanusCreatureSlot; if (!S || !S.supported()) return importer;
  const row = (id) => {
    const i = S.info(id), rep = S.report(id);
    return '<div class="cpslot"><div class="cpslh"><b>' + SLOT_NAMES[id] + '</b><span class="mono dim">' + (i ? 'GLB · ' + esc(i.name) + ' · ' + esc(i.summary) : 'Procedural (el de ahora)') + '</span></div>' +
      '<div class="cpbtns"><label class="btn2 mono cpfile">⬆ Importar GLB<input type="file" accept=".glb,model/gltf-binary" data-slotfile="' + id + '" aria-label="Importar modelo GLB de ' + SLOT_NAMES[id] + '"></label>' + (i ? '<span class="btn2 mono"' + act('cpSlotDel', id, 'Quitar el modelo de ' + SLOT_NAMES[id]) + '>✕ Quitar</span>' : '') + '</div>' +
      (rep ? '<details class="cpbasis"><summary class="mono">Informe del contrato</summary><ul class="cpul">' + rep.checks.map((c) => '<li>' + (c.ok ? '✔' : c.level === 'error' ? '✖' : '⚠') + ' ' + esc(c.label) + ': ' + esc(c.detail) + '</li>').join('') + '</ul></details>' : '') + '</div>';
  };
  return importer + '<div class="cpgr"><h4 class="mono">Criaturas 3D · módulo de modelos</h4><p class="cpmini dim">Aquí se conectan las criaturas hiperrealistas: un archivo GLB por criatura que cumpla el contrato (lego/janus-creature-slot/CONTRATO.md). Se guardan solo en este dispositivo y, si falta alguna pieza, se ve el informe.</p>' + S.ids.filter(id => ['lumi','bombo','musgo','nimbo'].includes(id)).map(row).join('') + (COMP_UI.slotMsg ? '<div class="note mono">' + esc(COMP_UI.slotMsg) + '</div>' : '') + '</div>';
}
function tabPapa(p, name) {
  const C = compState();
  // Los importadores técnicos se conservan para el adulto pero no ocupan
  // la dashboard infantil; el panel queda plegado por defecto.
  return '<details class="cp-adult-tools"><summary>Configuración 3D · acceso adulto</summary>' +
    slotPanel() + '</details>' + '<div class="cpgr"><h4 class="mono">' + (C.alerts.length ? C.alerts.length + ' aviso(s)' : 'Sin avisos') + '</h4>' + (C.alerts.length ? C.alerts.slice(-3).reverse().map((a) => '<div class="li2">' + pill(a.severity, a.severity === 'urgente' ? 'r' : 'a') + '<span class="tx">' + esc(a.summary) + '</span><span class="mono dim">' + a.at + '</span></div>').join('') : '<div class="dim">Aquí aparecen los avisos para revisión presencial del adulto. No se envían notificaciones automáticas.</div>') + '</div>' +
    '<div class="cpgr"><h4 class="mono">Qué hace y qué no hace</h4><ul class="cpul"><li>Practica con representaciones concretas (fichas, platos, tartas) y pasos cortos con «tu turno».</li><li><b>No sustituye a un profesional</b> (docente, psicopedagogo, terapeuta): sigue las mismas bases que ellos usan.</li><li>Las estrellas premian el esfuerzo, con tope diario; no hay castigos, temporizadores ni dinero real.</li><li>Nunca comenta el cuerpo ni el peso de la niña.</li></ul></div>' +
    '<details class="cpbasis"><summary class="mono">Bases y estado de la evidencia</summary><ul class="cpul">' + Companion.LESSON_BASIS.map((b) => '<li>' + esc(b) + '</li>').join('') + '<li>Pautas AAP 2019 (TDAH, Pediatrics 144(4):e20192528): apoyo conductual y refuerzo claro, con los padres. <span class="mono">HECHO VERIFICADO</span></li><li>Efecto de las estrellas dentro de una app y revisión de las lecciones por un profesional: <span class="mono">POR CONFIRMAR</span></li></ul></details>' +
    '<div class="dim mono cpmini">Las voces de las criaturas usan síntesis de voz del navegador y pueden silenciarse; no se activa reconocimiento de voz ni biometría. El código no envía datos a proveedores, aunque algunas voces del sistema operativo podrían necesitar un servicio del fabricante. La versión neuronal propia de alta fidelidad sigue pendiente.</div>';
}
/* Piezas GOLD reutilizadas de la portada A2: mismo material, luz y profundidad. */
const KENDRA_ICON_OBJECTS = Object.freeze({
  aprender: 'school', vestidor: 'sparkles', tienda: 'shopping-cart',
  mundo: 'sun', hablar: 'mic', papa: 'lock'
});
function kendraTabIcon(tab) {
  const key = KENDRA_ICON_OBJECTS[tab];
  return key ? '<span class="cp-3d-icon" aria-hidden="true">' +
    gIco(key, 'cp-3d-object') + '</span>' : '';
}
function vCompanero(M, X, sub) {
  const C = compState(), p = compProfile(), cr = Companion.getCreature(C.creatureId), name = Companion.displayName(p), ok3d = !!(window.JanusStage3D && JanusStage3D.supported() && window.JanusCreatures3D);
  if (!COMP_UI.scn) COMP_UI.scn = Companion.newScene();
  const body = { aprender: tabAprender, vestidor: tabVestidor, tienda: tabTienda, mundo: tabMundo, hablar: tabHablar, papa: tabPapa }[C.tab] || tabAprender;
  // Activar la escena WebGL SOLO cuando el modelo 3D real superó el contrato
  // de JanusCreatureSlot; nunca utilizar muñecos procedurales no aprobados.
  const scene3d = Boolean(ok3d && window.JanusCreatureSlot?.has?.(C.creatureId));
  const cinematic = !scene3d, edge = false;
  const tools = '';
  const stage = '<section class="cpst3' + (ok3d ? '' : ' nogl') + (cinematic ? ' cinematic' : '') + (edge ? ' edge-hero' : '') + '" style="--cp:' + cr.palette.primary + ';--cg:' + cr.palette.glow + '">' +
    (edge ? '<div class="cp-edge-prompt"><b>' + esc(name) + ' vive aquí contigo, Kendra. Tócalo para saludar o arrástralo por la pantalla.</b></div>' :
      cinematic ? '<div class="cp-cinematic">' + JanusPresence.render('kendra', false, C.creatureId) + '</div>' :
      scene3d ? '<div class="cpgl" data-stage3d data-id="' + CP_STAGE + '" aria-label="Escenario 3D de ' + esc(name) + ': puedes mover los objetos con el dedo"></div>' :
        '<div class="cpfb"><img src="' + CREAT_IMG[cr.id] + '" alt="' + esc(name) + '"><p class="mono">Este navegador no puede mostrar el escenario 3D. Puedes seguir practicando con los textos.</p></div>') +
    tools + '<div class="cpov">' + cpOverlay() + '</div></section>';
  const panel3 = '<section class="cptabs"><nav class="cptb">' + CP_TABS.map((t) => '<span class="cptab' + (C.tab === t[0] ? ' on' : '') + '"' + act('cpTab', t[0], t[2]) + '><i>' + kendraTabIcon(t[0]) + '</i><em class="mono">' + t[2] + '</em></span>').join('') + '</nav><div class="cp-pilot-camera"><button type="button"' + act('pilotCamera', 'kendra', 'Abrir cámara privada de Kendra') + '>' + gIco('smartphone', 'cp-camera-object') + ' Mi cámara</button></div><div class="cptc">' + body(p, name) + '</div></section>';
  return frame('companero', sub, M, stage + panel3, name);
}
VIEWS.companero = vCompanero;
TABS.push(['companero', '🦊', 'Mi criatura']);

const nowHM = () => { const d = new Date(); return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };
const newSeed = () => (Date.now() % 9973) + 1;
function parseWear(arg) {
  const a = String(arg).split('|'), part = a[0];
  if (part === 'accessory') return { part, slot: a[1], value: a[2] || null };
  return { part, value: a[1] };
}
function cpRenameCommit(raw) {
  const C = compState(), p = compProfile();
  try {
    const name = Companion.renameCreature(p, C.creatureId, String(raw || ''));
    compSave(p); COMP_UI.renaming = false; COMP_UI.nameMsg = 'Nombre guardado: ' + name;
    cpSay('¡Me encanta mi nombre, ' + CHILD + '! Ahora puedes llamarme ' + name + '.', 'celebra', false, 'alegre');
  } catch (e) {
    COMP_UI.nameMsg = 'Prueba otro nombre (entre 1 y 20 letras, sin palabras inapropiadas).';
    cpSay('Kendra, probemos con otro nombre que te guste.', 'piensa', true, 'pensativo');
  }
}
const COMP_ACTS = {
  cpNoop: () => { },
  cpTab: (t) => { const C = compState(); C.tab = CP_TABS.some((x) => x[0] === t) ? t : 'aprender'; C.visualMode = 'cinematic'; COMP_UI.sel = C.tab === 'mundo' ? null : COMP_UI.sel; saveState(); },
  cpVisual: (mode) => { const C = compState(); C.visualMode = ['3d', 'edge', 'cinematic'].includes(mode) ? mode : 'cinematic'; C.userSelectedVisualMode = true; COMP_UI.toast = 'Preferencia QA guardada. Hasta aprobación visual solo se muestra el arte original.'; saveState(); },
  cpEdgeSide: () => { const C = compState(); C.edgeSide = C.edgeSide === 'right' ? 'left' : 'right'; saveState(); },
  cpEdgeRoam: () => { const C = compState(); C.edgeRoam = C.edgeRoam === false; saveState(); },
  cpPick: (id) => { const C = compState(); if (!Companion.CREATURES.some((c) => c.id === id)) return; C.creatureId = id; C.visualMode = 'cinematic'; COMP_UI.renaming = false; COMP_UI.voiceMsg = ''; saveState(); const c = Companion.getCreature(id); cpReset(); cpSay('¡Hola, ' + CHILD + '! ' + c.catchphrases[0], 'saluda'); },
  cpRenameOn: () => { COMP_UI.renaming = true; },
  cpRename: () => cpRenameCommit(field('cpName')),
  cpRenameWardrobe: () => cpRenameCommit(field('cpNewName')),
  cpStyle: (style) => {
    const C = compState(), ids = (CP_STYLES[C.creatureId] || []).map((v) => v[0]);
    if (!ids.includes(style)) return;
    C.furStyles[C.creatureId] = style;
    // The approved illustration remains visible until a validated GLB is explicitly chosen.
    saveState();
    const st = cpStage(); if (st && st.setFurStyle) st.setFurStyle(style);
    cpSay('¡Mira, ' + CHILD + '! ¿Qué te parece mi nuevo estilo?', 'saluda', true, 'alegre');
  },
  cpWind: (v) => { const C = compState(), x = Number(v); if (![0, 0.3, 0.7].includes(x)) return; C.windStrength = x; saveState(); const st = cpStage(); if (st && st.setWind) st.setWind(x); },
  cpAspect: (a) => { const C = compState(); C.aspect = a === 'cara' ? 'cara' : 'criatura'; saveState(); const st = cpStage(); if (st && st.setAspect) { st.setAspect(C.aspect); st.sparkle(-1.6, 1.8, '#FFE9A0'); } cpSay(C.aspect === 'cara' ? '¡Ahora me ves la cara! Mira cómo cambian mis ojos.' : '¡Vuelvo a ser yo, con cuerpo y todo!', 'saluda', true, 'alegre'); },
  cpMood: (m) => {
    if (!CP_MOODS.some((x) => x[0] === m)) return; const st = cpStage();
    const line = { alegre: '¡Qué alegría!', contento: 'Aquí estoy, contento.', triste: 'Mmm… me da un poquito de pena.', enojado: '¡Grrr! Es un enfado de mentira, ¿eh?', sorprendido: '¡Oooh! ¡No me lo esperaba!', pensativo: 'Mmm… déjame pensar.' }[m];
    if (st) st.setMood(m, 7); cpSay(line, m === 'pensativo' ? 'piensa' : 'habla', false, m);
  },
  cpSlotDel: (id) => { if (window.JanusCreatureSlot) { JanusCreatureSlot.remove(id); COMP_UI.slotMsg = SLOT_NAMES[id] + ': vuelve la criatura procedural.'; } },
  cpGesture: (g) => { const t = { saludo: '¡Holaaa, ' + CHILD + '!', cara: '¡Bluuu! ¿Me salió graciosa la cara?', baile: '¡A bailar! Un pasito para aquí, otro para allá.', risa: '¡Jajaja! Me haces cosquillas.' }[g]; if (t) cpSay(t, { saludo: 'saluda', cara: 'piensa', baile: 'celebra', risa: 'habla' }[g]); },
  cpVoiceStyle: (style) => {
    const V = window.JanusCartoonVoice, C = compState();
    if (!V || !V.styles.some((v) => v.id === style)) return;
    C.voiceStyle = style; saveState();
    COMP_UI.voiceMsg = 'Estilo guardado para todas las criaturas.';
    if (C.voiceEnabled !== false) {
      const result = V.preview(C.creatureId, { style });
      if (!result.ok) COMP_UI.voiceMsg = 'Voz no disponible en el dispositivo. La configuración permanece guardada.';
    }
  },
  cpVoiceToggle: () => {
    const C = compState(); C.voiceEnabled = C.voiceEnabled === false; saveState();
    if (!C.voiceEnabled && window.JanusCartoonVoice) JanusCartoonVoice.stop();
    COMP_UI.voiceMsg = C.voiceEnabled ? 'Voz activada.' : 'Voz silenciada. Puedes seguir leyendo las respuestas.';
  },
  cpVoicePreview: () => {
    const V = window.JanusCartoonVoice, C = compState();
    if (!V) { COMP_UI.voiceMsg = 'El navegador no admite esta voz.'; return; }
    const response = V.preview(C.creatureId, { style: C.voiceStyle || 'caricatura', force: true });
    COMP_UI.voiceMsg = response.ok ? 'Muestra de la voz caricaturesca compartida · voz del dispositivo.' :
      'La síntesis de voz no está disponible aquí.';
  },
  cpSpeak: () => { speak(COMP_UI.say || '¡Hola, ' + CHILD + '! ' + Companion.getCreature(compState().creatureId).catchphrases[0], { force: true }); },
  cpView: (v) => { COMP_UI.view = ['amplia', 'mesa', 'primer-plano'].includes(v) ? v : null; const st = cpStage(); if (st) { st.resetView(); st.setView(COMP_UI.view); } },
  cpTopic: (t) => { const C = compState(); C.topic = t; C.seed = newSeed(); C.fails = 0; COMP_UI.hint = ''; cpReset(); saveState(); },
  cpNext: () => { const C = compState(); C.seed = newSeed(); C.fails = 0; COMP_UI.hint = ''; COMP_UI.ok = null; cpReset(); saveState(); },
  cpShow: () => { const C = compState(); C.visualMode = '3d'; saveState(); COMP_UI.hint = ''; cpLessonStart(false); }, 
  cpSolStart: () => { const C = compState(); C.visualMode = '3d'; saveState(); COMP_UI.hint = ''; cpLessonStart(true); }, 
  cpSol: () => { COMP_UI.sol = true; COMP_UI.ended = false; cpStep(); },
  cpStep: () => { cpStep(); },
  cpRetry: () => { cpLessonStart(COMP_UI.sol); },
  cpAdj: (d) => { const id = COMP_UI.sel; if (!id) return; try { COMP_UI.scn = Companion.userAdjust(COMP_UI.scn, id, +d > 0 ? 1 : -1); } catch (e) { return; } cpApply(); },
  cpExch: (dir) => { const id = COMP_UI.sel; if (!id) return; const before = COMP_UI.scn; try { COMP_UI.scn = Companion.userExchange(COMP_UI.scn, id, dir === 'bajar' ? 'bajar' : 'subir'); } catch (e) { return; } if (COMP_UI.scn !== before) { const a = before.props.find((q) => q.id === id), b = COMP_UI.scn.props.find((q) => q.id === id); const to = COMP_UI.scn.props.find((q) => q.kind === 'columna' && a && q.of === a.of + (dir === 'bajar' ? -1 : 1)); cpApply(a && b && to ? [{ type: 'canje', from: id, to: to.id, dir: dir === 'bajar' ? 'bajar' : 'subir', times: 1 }] : []); } },
  cpWear: (arg) => {
    const p = compProfile(), ch = parseWear(arg); let r; try { r = Companion.wear(p, ch); } catch (e) { return; }
    if (!r.ok) { cpSay(r.say, 'piensa'); COMP_UI.hint = ''; return; }
    compSave(p); const st = cpStage(); if (st) { st.setLook(hexLook(r.look)); st.sparkle(-1.6, 1.8, '#FFE9A0'); } cpSay(r.say, 'saluda', true);
  },
  cpSurprise: () => { const p = compProfile(); const l = Companion.surpriseLook(p); compSave(p); const st = cpStage(); if (st) { st.setLook(hexLook(l)); st.sparkle(-1.6, 1.8, '#FFE9A0'); } cpSay('¡Sorpresa! ¿Cómo me veo?', 'celebra', true); },
  cpResetLook: () => { const p = compProfile(); const l = Companion.resetLook(p); compSave(p); const st = cpStage(); if (st) st.setLook(hexLook(l)); cpSay('¡Vuelvo a ser yo, como al principio!', 'saluda', true); },
  cpBuy: (key) => {
    const p = compProfile(), w = Companion.worldOf(p), r = Companion.kitShop.buy(w, key), it = Companion.kitShop.item(key);
    if (!r.ok) { cpSay(r.why === 'faltan-estrellas' ? 'Todavía me faltan ' + r.missing + ' estrellas. ¡Con calma, las vamos juntando!' : 'Eso ya es mío.', 'piensa', true); return; }
    p.world = r.world;
    try {
      if (it.kind === 'home') p.world = Companion.kitShop.setHome(p.world, key);
      else if (it.kind === 'veh') p.world = Companion.kitShop.setVehicle(p.world, key);
      else if (it.kind === 'dec' && p.world.decor.length < Companion.MAX_DECOR) p.world = Companion.kitShop.toggleDecor(p.world, key);
    } catch (e) { /* queda comprado; se coloca desde «Mi mundo» */ }
    let look = null; if (it.kind === 'out') { const o = Companion.wear(p, { part: 'outfit', value: key.slice(4) }); look = o.look; } else if (it.kind === 'acc') { const [, slot, id] = key.split(':'); const o = Companion.wear(p, { part: 'accessory', slot, value: id }); look = o.look; }
    compSave(p); const st = cpStage(); if (st) { if (look) st.setLook(hexLook(look)); st.celebrate(); } cpSay('¡Es mío! ¡Gracias por juntar las estrellas, ' + CHILD + '!', 'celebra');
  },
  cpHome: (key) => { const p = compProfile(); try { p.world = Companion.kitShop.setHome(Companion.worldOf(p), key); } catch (e) { return; } compSave(p); cpSay('¡Qué casa tan bonita!', 'saluda', true); },
  cpVeh: (key) => { const p = compProfile(); try { p.world = Companion.kitShop.setVehicle(Companion.worldOf(p), key || null); } catch (e) { return; } compSave(p); cpSay(key ? '¡Listo para pasear!' : 'Hoy iremos andando.', 'saluda', true); },
  cpDecor: (key) => { const p = compProfile(); try { p.world = Companion.kitShop.toggleDecor(Companion.worldOf(p), key); } catch (e) { cpSay(String(e.message || 'No cabe más decoración.'), 'piensa', true); return; } compSave(p); cpSay('¡Ahora sí se ve acogedor!', 'saluda', true); },
  cpCheck: () => {
    const C = compState(), p = compProfile(), ex = cpExercise(), r = Companion.checkAnswer(ex, field('cpAns'), C.fails), now = Date.now(), ev = ex.id + ':' + C.seed;
    if (r.correct) {
      C.streak++; C.misses = 0; C.level = Companion.adaptLevel(C.level, C.streak, 0); const racha = C.streak >= 3; if (racha) C.streak = 0; COMP_UI.ok = true;
      const e = Companion.pickEncouragement('acierto', CHILD, p.encourage, now); COMP_UI.hint = '✔ ¡Correcto! ' + (e || ''); C.enc = p.encourage; saveState();
      cpEarn('acierto', 'acierto:' + ev); if (racha) cpEarn('racha', 'racha:' + ev);
      const st = cpStage(); if (st) st.celebrate(); cpSay(e || '¡Correcto!', 'celebra', false, 'alegre');
      C.seed++; C.fails = 0; cpReset(); saveState();
    } else {
      C.fails++; COMP_UI.ok = false; if (C.fails === 1) cpEarn('esfuerzo', 'esfuerzo:' + ev);
      if (r.next === 'mostrar-pasos') { C.misses++; C.level = Companion.adaptLevel(C.level, 0, C.misses); }
      const e = C.fails === 1 ? Companion.pickEncouragement('error', CHILD, p.encourage, now) : null; COMP_UI.hint = '💡 ' + r.hint + (r.next === 'mostrar-pasos' ? ' · Respuesta: ' + ex.answer : '');
      C.enc = p.encourage; saveState(); cpSay(e || r.hint, 'piensa', false, 'pensativo');
      if (r.next === 'mostrar-pasos' && !COMP_UI.lesson) cpLessonStart(true);
    }
  },
  cpLight: (l) => { const C = compState(), sc = Companion.SCENARIOS[C.sc % Companion.SCENARIOS.length], r = Companion.answerScenario(sc, l); COMP_UI.scFb = (r.correct ? '✔ ' : '↺ ') + r.feedback; cpSay(r.feedback, r.correct ? 'celebra' : 'piensa'); if (r.correct) C.sc++; saveState(); },
  cpSend: () => {
    const C = compState(), p = compProfile(), msg = field('cpMsg'); if (!msg) return;
    // Child-safety evidence gate is executed BEFORE the normal companion reply.
    // No sensitive raw input is written to the child state or sent to a model.
    const evidence = window.JanusChildSafety && JanusChildSafety.assess(msg);
    if (evidence) {
      if (evidence.notifyAdult) {
        const severity = evidence.level === 'urgent' ? 'urgente' : 'importante';
        const topic = evidence.topic === 'bullying' ? 'Acoso o intimidación' : 'Seguridad de Kendra';
        C.alerts.push({ at: nowHM(), severity, summary: topic + ': se recomienda hablar con un adulto de confianza.' });
        C.alerts = C.alerts.slice(-20);
      }
      compSave(p);
      cpSay(evidence.reply, evidence.notifyAdult ? 'saluda' : 'habla');
      return;
    }
    const reply = '¡Te escucho, ' + CHILD + '! Cuéntame más, me encanta escucharte.';
    const t = Companion.companionTurn(p, msg, reply, 'espontaneo', Date.now());
    if (t.safety.parentAlert) C.alerts.push(Object.assign({ at: nowHM() }, t.safety.parentAlert));
    compSave(p); cpSay(t.say.join(' '), t.safety.parentAlert ? 'saluda' : 'habla');
  }
};
document.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && ev.target.matches) { if (ev.target.matches('[data-f="cpAns"]')) { COMP_ACTS.cpCheck(); rerender(); } else if (ev.target.matches('[data-f="cpMsg"]')) { COMP_ACTS.cpSend(); rerender(); } else if (ev.target.matches('[data-f="cpNewName"]')) { COMP_ACTS.cpRenameWardrobe(); rerender(); } else if (ev.target.matches('[data-f="cpName"]')) { COMP_ACTS.cpRename(); rerender(); } } });

/* ---- Módulo de criaturas (GLB): importar, refrescar la escena y recuperar lo guardado en este dispositivo ---- */
document.addEventListener('change', async (ev) => {
  const el = ev.target;
  if (el.matches && el.matches('input[data-original-art-file]')) {
    const f = el.files && el.files[0]; if (!f) return;
    if (!window.JanusOriginalArt) { COMP_UI.slotMsg = 'Falta el módulo local de arte.'; rerender(); return; }
    COMP_UI.slotMsg = 'Verificando las 26 ilustraciones originales…'; rerender();
    try {
      const result = await JanusOriginalArt.importJSON(await f.text());
      COMP_UI.slotMsg = result.verified + ' originales verificados (SHA-256). ' +
        (result.persisted ? 'Guardados para uso sin internet.' : 'Activos en esta sesión; importa otra vez si cierras Safari.');
    } catch(e) {
      COMP_UI.slotMsg = 'Paquete rechazado, sin cambios: ' + String(e && e.message || e).slice(0,140);
    }
    rerender(); return;
  }
  if (!el.matches || !el.matches('input[data-slotfile]') || !window.JanusCreatureSlot) return;
  const id = el.getAttribute('data-slotfile'), f = el.files && el.files[0]; if (!f) return;
  COMP_UI.slotMsg = 'Leyendo ' + f.name + '…'; rerender();
  try { const rep = await JanusCreatureSlot.load(id, await f.arrayBuffer(), { name: f.name }); COMP_UI.slotMsg = SLOT_NAMES[id] + ': ' + (rep.level === 'error' ? 'no se pudo usar ' + f.name + ' · ' + rep.summary : rep.summary + ' · ya está en la escena'); }
  catch (e) { COMP_UI.slotMsg = 'Error al importar: ' + String((e && e.message) || e).slice(0, 140); }
  rerender();
});
/* El módulo de criaturas se carga DESPUÉS de este archivo (orden de build.cjs), así que se conecta desde app.js al arrancar:
   antes estaba aquí a nivel de archivo, JanusCreatureSlot aún no existía y ni el refresco al importar ni la recuperación al recargar se registraban. */
let SLOT_WIRED = false, ART_WIRED = false;
function slotWire() {
  if (!ART_WIRED && window.JanusOriginalArt) {
    ART_WIRED = true;
    JanusOriginalArt.restore().then((ok) => {
      if (ok && typeof ROUTE !== 'undefined' && ROUTE.v === 'companero') rerender();
    }).catch(() => {});
  }
  if (SLOT_WIRED || !window.JanusCreatureSlot || !JanusCreatureSlot.supported()) return; SLOT_WIRED = true;
  JanusCreatureSlot.onChange((id) => { if (window.Janus3D && Janus3D.refresh) Janus3D.refresh(); const I = (window.JanusStage3D && JanusStage3D._inst) || {}; Object.keys(I).forEach((k) => { try { I[k].refreshRig(id); } catch (e) { /* escena aún sin criatura */ } }); });
  JanusCreatureSlot.restore().then(async (n) => {
    // Restore personal models first; approved bundled GLBs never overwrite them.
    const result = window.JanusApproved3D
      ? await JanusApproved3D.install() : {installed:[]};
    if ((n || result.installed.length) && typeof ROUTE !== 'undefined' && ROUTE.v === 'companero') rerender();
  }).catch((e) => { console.warn('JANUS GLB: carga no completada',e); });
}
