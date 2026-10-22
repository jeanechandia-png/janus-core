'use strict';
/* ===== Sala de trabajo (#trabajo) y portada (#inicio) =====
 * Chat de voz + texto por proyecto, medallón del logo (estado) y Mini-Jano en la conversación mientras genera la respuesta.
 * VISTA PREVIA: las respuestas de Janus son simuladas; la conexión real vive en la app (apps/pwa) y el núcleo.
 */
Object.assign(UI, { pFilter: 'todos', pSel: 'janus', js: 'listo', draft: '', listening: false, micMsg: '' });
TABS.unshift(['inicio', '🎙', 'Inicio'], ['trabajo', '💬', 'Sala']);
const SENSITIVE = /(publica|publicar|envía|enviar|manda|borra|elimina|despliega|deploy|paga|compra|factura)/i;
const chatsOf = (id) => { ST.chats = ST.chats || {}; return ST.chats[id] || (ST.chats[id] = []); };
const robotOn = () => ST.settings.robot !== false;
const hhmm = () => { const d = new Date(); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };

function stateBlock(big) {
  const s = JSTATE[UI.js];
  return '<div class="jst ' + (big ? 'big' : '') + '"><i class="jdot"></i><div><b class="' + (big ? 'serif gld' : '') + '">' + s[0] + '</b><div class="dim">' + s[1] + '</div></div></div>';
}

const meMsg = (m) => '<div class="msg me"><div class="bub">' + esc(m.t) + '</div><small class="mono">' + m.at + (m.v ? ' · 🎙' : '') + '</small></div>';
const jaMsg = (m) => '<div class="msg ja"><div class="bub">' + esc(m.t) + (m.appr ? '<div class="apb"><span class="btn mono"' + act('apprOk', m.id) + '>✔ Aprobar</span><span class="btn mono ghost"' + act('apprNo', m.id) + '>✕ Rechazar</span></div>' : '') + '</div><small class="mono">' + m.at + ' · Janus · simulado</small></div>';

function vTrabajo(M, X, sub) {
  if (sub && PROJECTS.find((p) => p.id === sub)) UI.pSel = sub;
  if (sub === 'voz' && !UI.listening) setTimeout(() => SALA_ACTS.mic(), 60);
  const P = projById(UI.pSel), list = PROJECTS.filter((p) => UI.pFilter === 'todos' || p.grp === UI.pFilter);
  const left = panel('pj', '📁', 'Proyectos', PROJECTS.length, seg('pFilter', UI.pFilter, PGRP) +
    '<div class="pjl">' + list.map((p) => '<div class="pjr' + (p.id === P.id ? ' on' : '') + '"' + act('pSel', p.id, p.n) + '><span class="bb s">' + p.e + '</span><div class="mid"><b>' + esc(p.n) + '</b><small class="mono">' + (p.amb === 'p' ? 'personal' : 'empresa') + ' · ' + PGRP_TXT[p.grp] + '</small></div><span class="ct mono">' + (chatsOf(p.id).length || '') + '</span></div>').join('') + '</div>' +
    '<div class="btn2 mono"' + act('newChat', P.id, 'Nueva conversación') + '>＋ Nueva conversación</div>');
  const msgs = chatsOf(P.id);
  const working = UI.js === 'pensando' || UI.js === 'ejecutando';
  const typing = working ? '<div class="msg ja gen">' + (robotOn() ? '<div class="mjw">' + miniJano() + '</div>' : '') + '<div class="bub mono"><span class="tdots"><i></i><i></i><i></i></span>' + (UI.js === 'pensando' ? 'Janus está pensando la respuesta…' : 'Janus está trabajando en ' + esc(P.n) + '…') + '</div></div>' : '';
  const lastAppr = msgs.length && msgs[msgs.length - 1].appr ? msgs.length - 1 : -1;
  const thread = '<div class="thr" id="thr">' + (msgs.length
    ? msgs.map((m, k) => k === lastAppr && robotOn() ? '<div class="msg ja gen appr"><div class="mjw">' + miniJano() + '</div>' + jaMsg(m) + '</div>' : m.who === 'me' ? meMsg(m) : jaMsg(m)).join('') + typing
    : (typing || '<div class="empty"><div class="j3mic" data-3d="mic" data-id="mic-hero" data-tapact="mic" role="button" aria-label="Hablar con Janus"><img class="j3d-fb" src="' + IMG.mic + '" alt=""></div><b class="serif gld">' + esc(P.n) + '</b><div class="dim">Toca el micrófono y habla (te transcribo al instante), o escribe. Gíralo con el dedo.</div><div class="sugs">' + ['Resume el estado del proyecto', 'Qué está pendiente hoy', 'Prepara el siguiente paso'].map((t) => '<span class="sg2"' + act('suggest', t) + '>' + t + '</span>').join('') + '</div></div>')) + '</div>';
  const composer = '<div class="cmp">' +
    '<div class="inp"><textarea data-f="msg" rows="2" maxlength="2000" placeholder="Escribe a Janus sobre ' + esc(P.n) + '…" aria-label="Mensaje para Janus">' + esc(UI.draft) + '</textarea>' +
    (UI.micMsg ? '<div class="mmsg mono">' + esc(UI.micMsg) + '</div>' : '') + '</div>' +
    '<span class="mic m3' + (UI.listening ? ' on' : '') + '" data-3d="mic" data-id="mic-cmp" data-tapact="mic" role="button" aria-label="' + (UI.listening ? 'Detener dictado' : 'Hablar') + '"><img class="j3d-fb" src="' + IMG.mic + '" alt=""></span>' +
    '<span class="gsend"' + act('send', '', 'Enviar') + '><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12 5 5l4 7-4 7Z" fill="#1c1003" stroke="#FFF3C4" stroke-width=".6" stroke-linejoin="round"/></svg></span></div>';
  const center = '<section class="cd chat"><div class="chd"><span class="bb m">' + P.e + '</span><div><b class="serif gld">' + esc(P.n) + '</b><div class="mono dim">' + (P.amb === 'p' ? '🏠 personal' : '🏢 empresa') + ' · ' + PGRP_TXT[P.grp] + '</div></div>' + stateBlock(false) + '</div>' + thread + composer +
    '<div class="note mono">Vista previa: Janus responde de forma simulada aquí. En la app real, cada mensaje va al núcleo de Janus con este proyecto como contexto.</div></section>';
  const prs = P.real === 'prs' ? '<div class="sb mono">PR abiertos · real</div>' + REAL.prs.slice(0, 4).map((p) => '<a class="li2 lnk" href="https://github.com/jeanechandia-png/janus-core/pull/' + p[0] + '" target="_blank" rel="noopener"><b class="mono">#' + p[0] + '</b><span>' + esc(p[1]) + '</span>' + pill(p[2] ? 'borrador' : 'listo', p[2] ? '' : 'g') + '</a>').join('') : '';
  const right = '<div class="col3">' + panel('jsp', '⚙', 'Estado de Janus', 'gíralo con el dedo', '<div class="j3bot" data-3d="bot" data-id="bot-sala" role="img" aria-label="Robot de Janus"><img class="j3d-fb" src="' + GOLD.o.bot + '" alt=""></div>' + stateBlock(true) +
    '<div class="sts">' + Object.keys(JSTATE).map((k) => '<span class="stt' + (k === UI.js ? ' on' : '') + '" data-k="' + k + '"' + act('jsDemo', k, JSTATE[k][0]) + '><i></i>' + JSTATE[k][0] + '</span>').join('') + '</div>' +
    '<label class="tgl mono"><input type="checkbox" data-set="robot"' + (robotOn() ? ' checked' : '') + '> Mini-Jano al generar la respuesta</label>') +
    panel('pjc', P.e, 'Proyecto', PGRP_TXT[P.grp], '<div class="kv">' + [['🏷', 'Estado declarado', P.decl ? P.decl + ' · Jean 13-oct' : 'Por confirmar'], ['📌', 'Grupo', PGRP_TXT[P.grp] + ' · propuesta'], ['⏭', 'Siguiente paso', P.next], ['🐙', 'Repositorio', P.repo || '—']].map((r) => '<div class="kvr"><span class="bb s">' + r[0] + '</span><span>' + r[1] + '</span><b class="mono">' + esc(r[2]) + '</b></div>').join('') + '</div>' + prs) + '</div>';
  return frame('trabajo', sub, M, '<div class="sala" data-js="' + UI.js + '">' + left + center + right + '</div>');
}

function vInicio(M, X) {
  const act3 = PROJECTS.filter((p) => p.grp === 'activo');
  return '<div class="ini" data-js="' + UI.js + '">' +
    '<div class="ini-top"><span class="back mono" data-go="" role="link" tabindex="0">← Dashboard</span><div class="ini-brand">' + medallion('logo') + '<div><div class="wm" data-jg="JANUS" data-jg-refl>JANUS</div><div class="dt mono">' + M.dateLabel + ' · ' + M.nowLabel + '</div></div></div><span class="mono dim">Vista previa</span></div>' +
    '<div class="ini-mid"><div class="ini-mic go" style="--micmask:url(' + IMG.mic + ')" data-go="trabajo/voz" role="button" tabindex="0" aria-label="Hablar con Janus"><img src="' + IMG.mic + '" alt=""><span class="sweep"></span></div>' +
    '<div class="ini-say"><div><b class="serif gld">Hola, Patrón.</b><div class="dim">Toca el micrófono y habla, o escribe. Elige un proyecto para trabajar.</div></div></div>' +
    '<div class="ini-btns"><span class="ibtn gold go" data-go="trabajo/voz" role="button" tabindex="0">🎙 Hablar</span><span class="ibtn go" data-go="trabajo" role="button" tabindex="0">⌨ Escribir</span><span class="ibtn go" data-go="trabajo/' + UI.pSel + '" role="button" tabindex="0">📁 Proyectos</span><span class="ibtn go" data-go="" role="button" tabindex="0">📊 Dashboard</span></div>' +
    '<div class="ini-pj">' + act3.map((p) => '<span class="ipj go" data-go="trabajo/' + p.id + '" role="link" tabindex="0"><span class="bb s">' + p.e + '</span>' + esc(p.n) + '</span>').join('') + '</div></div></div>';
}
VIEWS.trabajo = vTrabajo;
VIEWS.inicio = vInicio;

/* ---- Acciones ---- */
let SIM = [];
const clearSim = () => { SIM.forEach(clearTimeout); SIM = []; };
const later = (ms, fn) => SIM.push(setTimeout(() => { fn(); if (ROUTE.v === 'trabajo' || ROUTE.v === 'inicio' || !ROUTE.v) { rerender(); scrollThread(); } }, ms));
function scrollThread() { const t = document.getElementById('thr'); if (t) t.scrollTop = t.scrollHeight; }
function reply(pid, text, voice) {
  const P = projById(pid), list = chatsOf(pid), id = 'm' + Date.now();
  list.push({ who: 'me', t: text, at: hhmm(), v: !!voice });
  UI.js = 'pensando'; saveState(); clearSim(); if (window.Janus3D) { Janus3D.state.thinking = true; setTimeout(() => { Janus3D.state.thinking = false; }, 3400); }
  const hi = typeof HomeScenes !== 'undefined' ? HomeScenes.parseIntent(text) : null;
  if (hi && hi.scene) { const a = runScene(hi.scene, voice ? 'voz' : 'texto'); later(700, () => { list.push({ who: 'ja', t: HomeScenes.SCENES[hi.scene].label + ' hecho: ' + (a.length ? a.length + ' cambios' : 'ya estaba así') + '. ' + homeSummary() + ' (casa de ejemplo hasta conectar Tuya).', at: hhmm() }); UI.js = 'listo'; saveState(); rerender(); }); return; }
  if (hi && hi.temp) { later(700, () => { const H = homeSt(); H.state = HomeScenes.applyActions(H.state, [{ deviceId: 'calefaccion', cmd: 'setTemp', value: hi.temp }]); saveState(); list.push({ who: 'ja', t: 'Calefacción a ' + String(hi.temp).replace('.', ',') + '° (ejemplo hasta conectar tu termostato).', at: hhmm() }); UI.js = 'listo'; rerender(); }); return; }
  if (SENSITIVE.test(text)) {
    later(1200, () => { UI.js = 'aprobacion'; list.push({ who: 'ja', id, appr: true, t: 'Entendido. «' + text.slice(0, 80) + '» actúa fuera (publica, envía, borra o gasta). Necesito tu visto bueno antes de hacerlo en ' + P.n + '.', at: hhmm() }); saveState(); });
  } else {
    later(1200, () => { UI.js = 'ejecutando'; });
    later(3400, () => { UI.js = 'listo'; list.push({ who: 'ja', t: 'Hecho en la vista previa. En la app real trabajaría sobre ' + P.n + ' (siguiente paso: ' + P.next + ') y te dejaría aquí el resultado verificado.', at: hhmm() }); saveState(); });
  }
}
let REC = null;
const SALA_ACTS = {
  pFilter: (a) => { UI.pFilter = a; },
  pSel: (a) => { UI.pSel = a; UI.draft = ''; ROUTE.sub = ''; },
  newChat: (a) => { ST.chats = ST.chats || {}; ST.chats[a] = []; UI.js = 'listo'; clearSim(); saveState(); },
  suggest: (t) => { reply(UI.pSel, t); },
  send: () => { const t = (UI.draft || '').trim(); if (!t) return; UI.draft = ''; reply(UI.pSel, t); if (!ROUTE.v && !isPhone()) location.hash = '#trabajo/' + UI.pSel; setTimeout(scrollThread, 30); },
  jsDemo: (k) => { clearSim(); UI.js = k; },
  apprOk: (id) => { const l = chatsOf(UI.pSel), m = l.find((x) => x.id === id); if (m) m.appr = false; l.push({ who: 'ja', t: 'Aprobado. En la app real lo ejecutaría ahora y registraría la acción en la auditoría.', at: hhmm() }); UI.js = 'ejecutando'; saveState(); later(2000, () => { UI.js = 'listo'; }); },
  apprNo: (id) => { const l = chatsOf(UI.pSel), m = l.find((x) => x.id === id); if (m) m.appr = false; l.push({ who: 'ja', t: 'Rechazado. No hago nada fuera.', at: hhmm() }); UI.js = 'listo'; saveState(); },
  mic: () => {
    if (UI.listening) { try { REC && REC.stop(); } catch (e) { } UI.listening = false; UI.js = 'listo'; if (window.Janus3D) Janus3D.state.listening = false; return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    UI.listening = true; UI.js = 'escuchando'; UI.micMsg = ''; if (window.Janus3D) Janus3D.state.listening = true;
    if (!SR) { UI.micMsg = 'El dictado no está disponible en esta vista; en la app de Janus el micrófono usa la voz propia de Janus.'; later(3500, () => { UI.listening = false; UI.js = 'listo'; }); return; }
    try {
      REC = new SR(); REC.lang = 'es-ES'; REC.interimResults = true; REC.continuous = false;
      const base = UI.draft ? UI.draft + ' ' : '';
      REC.onresult = (ev) => { let t = ''; for (let i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript; UI.draft = base + t; document.querySelectorAll('[data-f="msg"]').forEach((ta) => { ta.value = UI.draft; ta.scrollTop = ta.scrollHeight; }); /* transcripción inmediata en todos los campos (móvil, Sala, tablet) */ };
      REC.onerror = (ev) => { UI.micMsg = 'Micrófono: ' + (ev.error === 'not-allowed' ? 'permiso denegado en esta vista' : ev.error); };
      REC.onend = () => { UI.listening = false; if (window.Janus3D) Janus3D.state.listening = false; const t = (UI.draft || '').trim(); if (t) { UI.draft = ''; reply(UI.pSel, t, true); } else UI.js = 'listo'; rerender(); scrollThread(); };
      REC.start();
    } catch (e) { UI.listening = false; UI.js = 'listo'; UI.micMsg = 'No se pudo abrir el micrófono en esta vista.'; }
  }
};
document.addEventListener('input', (ev) => { if (ev.target.matches && ev.target.matches('[data-f="msg"]')) UI.draft = ev.target.value; });
document.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && !ev.shiftKey && ev.target.matches && ev.target.matches('[data-f="msg"]')) { ev.preventDefault(); SALA_ACTS.send(); rerender(); scrollThread(); const ta = document.querySelector('[data-f="msg"]'); if (ta) ta.focus(); } });
