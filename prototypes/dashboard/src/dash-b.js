'use strict';
/* ===== B · Platino: dashboard de tablet/escritorio (tres franjas: Clima · Vida · Empresa) =====
 * Misma fuente de datos (model/derived), mismas rutas (data-go) y mismas acciones que A: solo cambia la composición y la piel.
 * Reglas heredadas de A: una sola pantalla sin scroll, todo clicable, EN VIVO / EJEMPLO a la vista.
 * Las vistas de detalle y el teléfono NO se reescriben: heredan B por traducción de paleta (skin-map.js).
 */
const plc = (s) => s.split(' ').map((c) => (c === 'go' || c === 'mono' || !c ? c : 'pl-' + c)).join(' ');
const PL_AV = ['#A01C26', '#855000', '#5035C8', '#1B45C4'];
const PL_RC = ['#2F6BFF', '#7C5CFF', '#E5484D', '#12B886'];
const PL_KC = ['sap', 'vi', 'pk', 'em', 'am'], PL_KS = ['#2F6BFF', '#7C5CFF', '#EE4D95', '#12B886', '#F59F00'];
const PL_SG = ['linear-gradient(90deg,#2556D6,#7FA6FF 45%,#2F6BFF)', 'linear-gradient(90deg,#5A3FD6,#B5A6FF 45%,#7C5CFF)', 'linear-gradient(90deg,#C42A74,#FFA6CC 45%,#EE4D95)', 'linear-gradient(90deg,#0B9468,#8FE8C8 45%,#12B886)'];
const PL_SD = ['#2F6BFF', '#7C5CFF', '#EE4D95', '#12B886'];
const PL_FC = ['linear-gradient(180deg,#4F86FF,#1F4FD8)', 'linear-gradient(180deg,#9B85FF,#5B3FD9)', 'linear-gradient(180deg,#2FB58C,#087552)', 'linear-gradient(180deg,#E09A1F,#8F5600)'];
const PL_GR = ['linear-gradient(160deg,#5C8DFF,#2F6BFF 55%,#4A2FC0)', 'linear-gradient(160deg,#F2669F,#D93A83 55%,#8F1A54)', 'linear-gradient(160deg,#2FB58C,#0E9F72 55%,#07694B)'];

const plSpk = (arr, w, h) => { const mx = Math.max(...arr) || 1; return smooth(arr.map((v, i) => [i * (w / (arr.length - 1)), h - 2 - (v / mx) * (h - 5)])); };
const plOrb = (v, txt) => '<span class="' + plc('orb ' + (v === 'g' ? 'g' : v === 'r' ? 'r' : 'a')) + ' mono"><i>' + (v === 'g' ? '✔' : v === 'r' ? '✕' : '!') + '</i>' + txt + '</span>';
const plBb = (e, col, size) => '<span class="' + plc('bb' + (size ? ' ' + size : '') + (col ? ' ' + col : '')) + '">' + e + '</span>';
/* Selector de piel A/B (también en la cabecera de A y en «Datos»). */
const skinSeg = (labels) => seg('skin', skinNow(), labels || [['a', 'A'], ['b', 'B']]);

/* Reloj de viento 0–40 km/h: aguja = ahora, círculo blanco = viento a la vuelta, punto rojo = racha a la vuelta. */
function plGauge(nowW, retW, retG) {
  const ang = (x) => -135 + Math.min(Math.max(x, 0), 40) / 40 * 270;
  const arc = (r, a0, a1) => { const p0 = polc(80, 80, a0, r), p1 = polc(80, 80, a1, r); return 'M' + f1(p0[0]) + ' ' + f1(p0[1]) + ' A' + r + ' ' + r + ' 0 ' + (a1 - a0 > 180 ? 1 : 0) + ' 1 ' + f1(p1[0]) + ' ' + f1(p1[1]); };
  let tk = '';
  for (let v = 0; v <= 40; v += 5) { const p1 = polc(80, 80, ang(v), 66), p2 = polc(80, 80, ang(v), v % 10 === 0 ? 72 : 69); tk += 'M' + f1(p1[0]) + ' ' + f1(p1[1]) + ' L' + f1(p2[0]) + ' ' + f1(p2[1]) + ' '; }
  const nd = polc(80, 80, ang(nowW), 46), tm = polc(80, 80, ang(retW), 58), gm = polc(80, 80, ang(retG), 58), l0 = polc(80, 80, ang(0), 62), l40 = polc(80, 80, ang(40), 62);
  return '<svg viewBox="0 0 160 160" aria-hidden="true"><defs><radialGradient id="plgf" cx=".5" cy=".28" r=".95"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#D3DEF2"/></radialGradient><linearGradient id="plrm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#AFC0E0"/><stop offset="1" stop-color="#fff"/></linearGradient></defs>' +
    '<circle cx="80" cy="80" r="78" fill="url(#plrm)"/><circle cx="80" cy="80" r="74" fill="url(#plgf)"/>' +
    '<path d="' + arc(58, ang(0), ang(40)) + '" stroke="rgba(30,50,110,.1)" stroke-width="11" fill="none" stroke-linecap="round"/>' +
    '<path d="' + arc(58, ang(0.5), ang(20)) + '" stroke="#12B886" stroke-width="9" fill="none"/><path d="' + arc(58, ang(20), ang(30)) + '" stroke="#F59F00" stroke-width="9" fill="none"/><path d="' + arc(58, ang(30), ang(39.5)) + '" stroke="#E5484D" stroke-width="9" fill="none"/>' +
    '<path d="' + tk + '" stroke="#7B8BA8" stroke-width="1.4" fill="none"/>' +
    '<text x="' + f1(l0[0] - 3) + '" y="' + f1(l0[1] + 14) + '" font-family="DM Mono, monospace" font-size="9" fill="#5E6E8A">0</text><text x="' + f1(l40[0] - 9) + '" y="' + f1(l40[1] + 14) + '" font-family="DM Mono, monospace" font-size="9" fill="#5E6E8A">40</text>' +
    '<circle cx="' + f1(gm[0]) + '" cy="' + f1(gm[1]) + '" r="4.2" fill="#E5484D" stroke="#fff" stroke-width="1.8"/><circle cx="' + f1(tm[0]) + '" cy="' + f1(tm[1]) + '" r="6.2" fill="#fff" stroke="#7C5CFF" stroke-width="3"/>' +
    '<line x1="80" y1="80" x2="' + f1(nd[0]) + '" y2="' + f1(nd[1]) + '" stroke="#0E1A33" stroke-width="3.6" stroke-linecap="round"/><circle cx="80" cy="80" r="7.5" fill="#0E1A33"/><circle cx="78" cy="78" r="2.4" fill="#fff"/>' +
    '<text x="80" y="112" text-anchor="middle" font-family="DM Mono, monospace" font-size="9" fill="#5E6E8A">km/h</text></svg>';
}

function renderDashB(M, X) {
  const live = M.src === 'vivo', C = plc;
  const card = (route, label, inner, extra) => '<section class="' + C('cd') + ' go' + (extra ? ' ' + extra : '') + '"' + goAttr(route, label) + '>' + inner + '</section>';
  const panel2 = (inner, extra) => '<section class="' + C('cd') + (extra ? ' ' + C(extra) : '') + '">' + inner + '</section>';
  const lb = (route, label, col, e, title, mt) => '<div class="' + C('lb') + ' mono go"' + goAttr(route, label) + '>' + plBb(e, col) + title + '<span class="' + C('mt') + '">' + (mt || '') + '</span></div>';

  /* ---- Cabecera ---- */
  const flags = DATA.mails.filter((m) => m.sev === 3 && !(ST.mail[m.id] || {}).done).length;
  const chip = (cls, route, label, inner) => '<span class="' + C('chip' + (cls ? ' ' + cls : '')) + ' go"' + goAttr(route, label) + '>' + inner + '</span>';
  const rainChip = M.rainAt ? chip('warn', 'clima/h' + (M.rainAt.day * 24 + M.rainAt.h), 'Lluvia', '☔ <b>' + pad2(M.rainAt.h) + ':00</b>') : chip('good', 'clima', 'Sin lluvia', '☀ <b>seco</b>');
  const head = '<header class="' + C('hd') + '"><img class="' + C('medal') + ' go" src="' + IMG.medal + '" alt="Janus"' + goAttr('datos', 'Estado de datos') + '><div><div class="' + C('wm sora') + '">JANUS</div><div class="' + C('dt') + ' mono">' + M.dateLabel + ' · ' + M.nowLabel + '</div></div>' +
    '<div class="' + C('chips') + ' mono">' + chip(M.ida.verdict === 'g' ? 'good' : M.ida.verdict === 'r' ? 'bad' : 'warn', 'clima/ida', 'Ida', '🚴 ' + (M.ida.verdict === 'g' ? '✔' : '!') + ' <b>IDA</b>') + rainChip +
    chip('', 'correo', 'Correo', '✉ <b>' + X.mailsOpen.length + '</b>') + chip('good', 'ofertas', 'Ofertas', '🏷 <b>' + OF.digest.alerts.length + '</b>') + chip('', 'janus/aprob', 'Aprobaciones', '🔐 <b>' + X.apprOpen.length + '</b>') + chip(flags ? 'bad' : '', 'prioridades/m0', 'Alertas', '⚑ <b>' + flags + '</b>') + '</div>' +
    skinSeg() + '<div class="' + C('demo') + ' mono go"' + goAttr('datos', 'Estado de datos') + '>' + (live ? '● Clima en vivo · resto ejemplo' : 'Vista previa · datos de ejemplo') + '</div></header>';

  /* ---- Franja 1 · Clima ---- */
  const side = (cls, tag, d, route) => '<div class="' + C('sd') + ' go"' + goAttr(route, tag) + '><span class="' + C('tg' + (cls ? ' ' + cls : '')) + ' mono">' + tag + '</span><div class="' + C('bg') + '"><img class="' + C('wi') + '" src="' + wxImg(d.k) + '" alt=""><span class="' + C('tp sora') + '">' + d.t + '°</span></div>' +
    '<div class="' + C('fc') + ' mono"><span class="' + C('ft1') + '">🌡 ' + d.feel + '°</span><span class="' + C('ft1') + '">' + arrowSvg(d.d, 'pl-ar') + ' ' + d.w + '<small>km/h</small></span><span class="' + C('ft1') + '">💧 ' + d.r + '%</span></div></div>';
  const hours = M.strip.map((c, i) => { const lv = hourRisk(c.e).lv; return '<div class="' + C('hh') + ' go' + (i === 0 ? ' ' + C('now') : '') + (lv === 2 ? ' ' + C('hot') : '') + '"' + goAttr('clima/h' + c.idx, c.label) + '><span class="' + C('h') + ' mono">' + c.label + '</span><img src="' + wxImg(c.e.k) + '" alt=""><span class="' + C('t sora') + '">' + c.e.t + '°</span><span class="' + C('tb') + '"><i style="height:' + Math.max(8, c.e.r) + '%"></i></span><span class="' + C('p') + ' mono">' + c.e.r + '%</span><span class="' + C('w') + ' mono">' + arrowSvg(c.e.d, 'pl-ar') + c.e.w + '</span></div>'; }).join('');
  const kit = M.kit.slice(0, 4).map((k) => '<span class="' + C('bb m') + ' go' + (k.on ? '' : ' ' + C('off')) + '"' + goAttr('clima/kit', k.n + (k.on ? ' sí' : ' no')) + ' title="' + esc(k.n) + '">' + k.e + '</span>').join('');
  const retG = M.retE.g != null ? M.retE.g : M.retE.w;
  const clima = '<section class="' + C('cd') + '">' + lb('clima', 'Clima', 'sap', '🚴', 'Clima · Bici ' + srcBadge(live), '📍 ' + esc(M.place)) +
    '<div class="' + C('wg') + '">' + side('', 'AHORA · ' + M.nowLabel, M.nowE, 'clima/now') +
    '<div class="' + C('gz') + ' go"' + goAttr('clima/viento', 'Viento') + '>' + plGauge(M.nowE.w, M.retE.w, retG) + '<div class="' + C('gl') + ' mono"><span>💨</span><b>' + M.nowE.w + '</b><span>→</span><b>' + M.retE.w + '</b><span>⚡' + retG + '</span></div></div>' +
    side('t', M.retLabel, M.retE, 'clima/vuelta') + '<div class="' + C('hr8') + '">' + hours + '</div>' +
    '<div class="' + C('vd') + '"><div class="' + C('kit') + '">' + kit + '</div><span class="go"' + goAttr('clima/ida', 'Ida') + '>' + plOrb(M.ida.verdict, 'IDA') + '</span><span class="go"' + goAttr('clima/vuelta', 'Vuelta') + '>' + plOrb(M.vuelta.verdict, 'VUELTA') + '</span>' +
    (M.suggest != null ? '<span class="' + C('orb t') + ' mono go"' + goAttr('clima/vuelta', 'Salida sugerida') + '>⏱ ' + minToHm(M.suggest) + '</span>' : '<span class="' + C('orb t') + ' mono go"' + goAttr('clima', 'Sin avisos') + '>✔ libre</span>') + '</div></div></section>';

  /* ---- Franja 2 · Vida ---- */
  const ag = X.agenda, pers = ag.filter((e) => e.amb !== 'e'), emp = ag.filter((e) => e.amb === 'e');
  const ordered = pers.concat(emp).slice(0, 7);
  const evRow = (e) => '<div class="' + C('ev') + ' go' + (e.id === X.nextId ? ' ' + C('nw') : '') + (ST.done[e.id] || e.m + (e.dur || 30) <= M.nowMin ? ' past' : '') + '"' + goAttr('dia/' + e.id, e.t) + '>' + plBb(e.e, '', 's') + '<span class="' + C('tm') + ' mono">' + e.h + '</span><span class="' + C('tx') + '">' + esc(e.t) + '</span></div>';
  const dia = '<section class="' + C('cd') + '">' + lb('dia', 'Mi día', 'sap', '🗓', 'Mi día <span class="src live mono">● REAL</span>', '🏠 ' + pers.length + ' · 🏢 ' + emp.length) + '<div class="' + C('tl') + '">' + (ordered.map(evRow).join('') || '<div class="' + C('ev') + '"><span class="' + C('tx') + '">Día libre</span></div>') + '</div></section>';

  const today = X.kweek[0], K = DATA.familia.items;
  const kt = today.it.filter((e) => K[e]).slice(0, 2).map((e) => '<div class="' + C('kt') + ' go"' + goAttr('familia/hoy', K[e].t) + '><span class="' + C('tm') + ' mono">' + K[e].h + '</span>' + plBb(e, '', 's') + '<span class="' + C('tx') + '">' + K[e].t + '</span><small class="mono">→ ' + K[e].to + '</small></div>').join('') || '<div class="' + C('kt') + ' go"' + goAttr('familia', 'Libre') + '>' + plBb('🌿', '', 's') + '<span class="' + C('tx') + '">Día libre</span></div>';
  const lleva = DATA.familia.lleva.slice(0, 3).map((l) => '<span class="' + C('bb s') + ' go"' + goAttr('familia/lleva', l.t) + (ST.lleva[l.id] ? ' style="box-shadow:0 0 0 2px #12B886"' : '') + '>' + l.e + '</span>').join('');
  const cita = X.citas[0];
  const familia = '<section class="' + C('cd kd') + '">' + '<div class="' + C('lb') + ' mono go"' + goAttr('familia', '__HIJA__') + '>' + plBb('🌟', 'pk') + '__HIJA__<span class="' + C('gear2') + '">' + lleva + '</span></div><div>' + kt + '</div>' +
    '<div><div class="' + C('wk') + '">' + X.kweek.map((d, i) => '<div class="' + C('dy') + ' go' + (i === 0 ? ' ' + C('td') : '') + '"' + goAttr('familia/d' + i, d.l + ' ' + d.n) + '><span class="' + C('l') + ' mono">' + d.l + '</span><span class="' + C('n sora') + '">' + d.n + '</span><span>' + d.it.join('') + '</span></div>').join('') + '</div>' +
    (cita ? '<div class="' + C('cnt') + ' go"' + goAttr('familia/citas', 'Cita') + '>' + plBb(cita.e, '', 's') + '<b class="' + C('sora') + '">' + cita.days + '</b><span class="mono">días · ' + dateMid(cita.dn) + ' · ' + K[cita.e].h + '</span></div>' : '') + '</div></section>';

  const mail = '<section class="' + C('cd') + '">' + lb('prioridades', 'Correos prioritarios', 'em', '✉', 'Correos prioritarios', X.mailsOpen.length) + DATA.mails.slice(0, 4).map((m, i) => { const st = ST.mail[m.id] || {}; return '<div class="' + C('ml') + ' go' + (st.done ? ' past' : '') + '"' + goAttr('prioridades/' + m.id, m.who) + '><span class="' + C('av') + ' mono" style="background:radial-gradient(circle at 32% 24%,rgba(255,255,255,.22),' + PL_AV[i % 4] + ' 60%)">' + m.ini + '</span><div class="' + C('mid') + '"><div class="' + C('who') + '">' + esc(m.who) + '</div><div class="' + C('sj') + '">' + esc(m.sj) + '</div></div><span class="' + C('age') + ' mono">' + (st.done ? '✔' : m.age) + '</span><span class="' + C('sev') + ' ' + C('s' + m.sev) + '"></span></div>'; }).join('') + '</section>';

  const fol = '<section class="' + C('cd') + '">' + lb('prioridades', 'Lo que dije', 'vi', '🎯', 'Lo que dije', 'avance') + '<div class="' + C('rgs') + '">' + X.follow.slice(0, 4).map((f, i) => '<div class="' + C('rc') + ' go' + (f.done ? ' past' : '') + '"' + goAttr('prioridades/' + f.id, f.x) + '><span class="' + C('rg') + '" style="background:conic-gradient(' + PL_RC[i % 4] + ' ' + (f.done ? 360 : f.p * 3.6) + 'deg,rgba(30,50,110,.12) 0)"><span class="mono">' + (f.done ? '✔' : f.p + '%') + '</span></span><span class="' + C('tx') + '">' + esc(f.x) + '</span><span class="' + C('due') + (f.due === 'hoy' && !f.done ? ' ' + C('hot') : '') + ' mono">' + f.due + '</span></div>').join('') + '</div></section>';

  const pjs = PROJECTS.filter((p) => p.grp !== 'proximo').slice(0, 5);
  const sala = '<section class="' + C('cd') + '">' + lb('trabajo', 'Sala de trabajo', 'am', '📁', 'Proyectos', '<span class="go"' + goAttr('janus', 'Janus') + '>⚙ CI ' + REAL.ci.filter((c) => c[0].startsWith('2026-10-21')).length + ' · PR ' + REAL.prs.length + '</span>') +
    '<div class="' + C('sala') + '"><div class="' + C('sr0') + '"><div class="' + C('mic') + ' go"' + goAttr('trabajo/voz', 'Hablar con Janus') + '><img src="' + IMG.mic + '" alt=""></div>' +
    '<div class="' + C('in') + '"><textarea data-f="msg" rows="1" maxlength="2000" placeholder="Habla o escribe a Janus…" aria-label="Mensaje para Janus">' + esc(UI.draft || '') + '</textarea><span class="' + C('send') + '"' + act('send', '', 'Enviar') + '>➤</span></div></div>' +
    '<div class="' + C('pj') + '">' + pjs.map((p) => '<span class="' + C('pjp') + ' ' + p.grp + ' go"' + goAttr('trabajo/' + p.id, p.n) + '>' + plBb(p.e, '', 's') + esc(p.s || p.n) + '<i></i></span>').join('') + '</div></div></section>';

  /* ---- Franja 3 · Empresa ---- */
  const kpv = [{ v: '€' + fmt(X.total), d: X.revDelta + '%', s: [3, 3.4, 3.2, 3.8, 3.9, 4.1, 4.0, 4.3, 4.4, 4.5, 4.6, 4.65] }, { v: Math.round(X.r30 / 1000) + 'K', d: X.reachDelta + '%', s: DATA.reach30.filter((_, i) => i % 3 === 0).concat([17.2, 16.4]).slice(0, 12) }];
  const kp = '<section class="' + C('cd') + '">' + lb('datos', 'Cifras', 'sap', '📊', 'Cifras', '30 d') + '<div class="' + C('kl') + '">' + DATA.kpis.map((k, i) => { const v = kpv[i] || k; return '<div class="' + C('kr') + ' go"' + goAttr(k.go, k.k) + '>' + plBb(k.e, PL_KC[i % 5], 's') + '<div class="' + C('vv') + '"><b class="' + C('sora') + '">' + v.v + '</b><small class="mono">▲ ' + v.d + '</small></div><svg viewBox="0 0 34 18" preserveAspectRatio="none" aria-hidden="true"><path d="' + plSpk(v.s, 34, 18) + '" fill="none" stroke="' + PL_KS[i % 5] + '" stroke-width="1.8" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg></div>'; }).join('') + '</div></section>';

  const S = DATA.sources, wtot = [8, 9, 10, 11].map((w) => S.reduce((a, s2) => a + s2.w[w], 0)), wmax = Math.max(...wtot);
  const cols = [0, 1, 2, 3].map((w) => '<div class="' + C('cl') + '"><div class="' + C('stk') + '" style="height:' + Math.round(wtot[w] / wmax * 100) + '%">' + S.map((s2, i) => '<i style="height:' + (s2.w[8 + w] / wtot[w] * 100).toFixed(1) + '%;background:' + PL_SG[i % 4] + '"></i>').join('') + '</div><small class="mono">S' + (w + 1) + '</small></div>').join('');
  const revenue = '<section class="' + C('cd') + ' go"' + goAttr('ingresos', 'Ingresos') + '>' + '<div class="' + C('lb') + ' mono">' + plBb('💶', 'em') + 'Ingresos<span class="' + C('mt') + '">▲ ' + X.revDelta + '% · 30 d</span></div><div class="' + C('rvw') + '"><div class="' + C('cols') + '">' + cols + '</div><div class="' + C('lg') + ' mono">' + S.map((s2, i) => '<div class="go"' + goAttr('ingresos/' + s2.id, s2.n) + '><i style="background:' + PL_SD[i % 4] + '"></i>' + s2.e + '<b>€' + fmt(X.last[i]) + '</b></div>').join('') + '</div></div></section>';

  const rv = DATA.reach30, pts = rv.map((v, i) => [i * (600 / (rv.length - 1)), 200 - (v / 20) * 200 * 0.94 - 6]), line = smooth(pts), last = pts[pts.length - 1];
  const xl = [29, 15, 0].map((k) => { const o = fromDayNum(M.today - k); return o.d + ' ' + MO[o.m - 1]; });
  const reach = '<section class="' + C('cd') + ' go"' + goAttr('alcance', 'Alcance') + '>' + '<div class="' + C('lb') + ' mono">' + plBb('👁', 'vi') + 'Alcance<span class="' + C('mt') + '">' + Math.round(X.r30 / 1000) + 'K · ▲ ' + X.reachDelta + '%</span></div>' +
    '<div class="' + C('cbx') + '"><div class="' + C('yax') + ' mono"><span>20K</span><span>10K</span><span>0</span></div><div class="' + C('plot') + '"><svg viewBox="0 0 600 200" preserveAspectRatio="none"><defs><linearGradient id="plga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7C5CFF" stop-opacity=".38"/><stop offset="1" stop-color="#2F6BFF" stop-opacity="0"/></linearGradient><linearGradient id="plgl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2F6BFF"/><stop offset="1" stop-color="#7C5CFF"/></linearGradient></defs>' +
    '<path d="M0 .5 L600 .5 M0 100 L600 100 M0 199.5 L600 199.5" stroke="rgba(30,50,110,.1)" fill="none" vector-effect="non-scaling-stroke"/><path d="' + line + ' L600 200 L0 200 Z" fill="url(#plga)"/><path d="' + line + '" fill="none" stroke="url(#plgl)" stroke-width="3.2" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg><span class="' + C('dot') + '" style="left:100%;top:' + (last[1] / 200 * 100).toFixed(1) + '%"></span></div></div><div class="' + C('xax') + ' mono">' + xl.map((x) => '<span>' + x + '</span>').join('') + '</div></section>';

  const bots = '<section class="' + C('cd') + '">' + lb('chatbots', 'Chatbots', 'sap', '🤖', 'Chatbots', 'en vivo') + DATA.bots.map((b) => { const pend = b.upd.filter((u) => !u.done && !ST.upd[u.id]).length; return '<div class="' + C('bot') + ' go"' + goAttr('chatbots/' + b.id, b.n) + '><div class="' + C('bh') + '"><span class="' + C('led') + '"></span><span class="' + C('nm') + '">' + esc(b.n) + '</span></div><div class="' + C('bb2') + '"><span class="' + C('cv') + ' ' + C('sora') + '">' + b.c + '</span><span style="font-size:11px">💬</span><span class="' + C('pill') + (pend ? ' ' + C('w') : '') + ' mono">' + (pend ? '⏳ ' + pend + ' act.' : b.u.startsWith('★') ? b.u : '✔ al día') + '</span></div><div class="' + C('sp3') + '"><span class="' + C('age') + ' mono">⏱ ' + b.upT + '%</span><svg viewBox="0 0 100 22" preserveAspectRatio="none"><path d="' + plSpk(b.days, 100, 22) + '" fill="none" stroke="#2F6BFF" stroke-width="1.8" vector-effect="non-scaling-stroke"/></svg></div></div>'; }).join('') + '</section>';

  const tops = '<section class="' + C('cd') + '">' + lb('contenido', 'Contenido', 'pk', '🎬', 'Contenido', 'top 3') + DATA.reels.slice(0, 3).map((t, i) => '<div class="' + C('tc') + ' go"' + goAttr('contenido/' + t.id, t.t) + '><div class="' + C('th') + '" style="background:' + PL_GR[i % 3] + '">▶</div><div class="' + C('mid') + '"><div class="' + C('tt') + '">' + esc(t.t) + '</div><div class="' + C('mr') + '"><span class="' + C('vbar') + '"><i style="width:' + Math.round(t.views / 48 * 100) + '%"></i></span><b class="mono">' + t.vtxt + '</b><small class="mono">€' + t.eur + '</small></div></div></div>').join('') + '</section>';

  const Cc = DATA.mailCats, ctot = Cc.reduce((a, c) => a + c.items.length, 0), CD = ['#2F6BFF', '#7C5CFF', '#B9C5DE', '#12B886', '#F59F00'];
  let acc = 0; const cg = Cc.map((c, i) => { const a0 = acc; acc += c.items.length / ctot * 360; return CD[i % 5] + ' ' + a0.toFixed(1) + 'deg ' + acc.toFixed(1) + 'deg'; }).join(',');
  const F = DATA.funnel;
  const cli = '<section class="' + C('cd') + '">' + lb('clientes', 'Clientes', 'em', '🤝', 'Clientes', '✉ ' + ctot) + '<div class="' + C('dn') + ' go"' + goAttr('clientes/correo', 'Correo empresa') + '><div class="' + C('donut') + '" style="background:conic-gradient(from -90deg,' + cg + ')"><b class="' + C('sora') + '">' + ctot + '</b></div><div class="' + C('lgd') + ' mono">' + Cc.map((c, i) => '<span><i style="background:' + CD[i % 5] + '"></i>' + c.e + ' ' + c.items.length + '</span>').join('') + '</div></div>' +
    '<div class="' + C('fns') + '">' + F.map((f, i) => '<div class="' + C('fn') + ' go"' + goAttr('clientes/embudo', f.t) + '>' + plBb(f.e, '', 's') + '<div class="' + C('fb') + ' mono" style="width:' + Math.max(24, Math.round(f.n / F[0].n * 74)) + '%;background:' + PL_FC[i % 4] + '">' + f.n + '</div>' + (i ? '<small class="mono" style="color:var(--mute);font-size:9px">▼' + Math.round(f.n / F[i - 1].n * 100) + '%</small>' : '') + '</div>').join('') + '</div></section>';

  return head + clima + '<div class="' + C('b2') + '">' + dia + familia + mail + fol + sala + '</div><div class="' + C('b3') + '">' + kp + revenue + reach + bots + tops + cli + '</div>';
}
