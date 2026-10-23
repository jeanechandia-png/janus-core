'use strict';
/* ===== Teléfono: tres propuestas de dashboard con TODA la información a la vista =====
 * A · Terminal: bandas densas a todo lo ancho, todo en ~1 pantalla.
 * B · Cuadrantes: paneles en 2 columnas con listas y gráficas reales dentro.
 * C · Cronología: el día como eje (clima + eventos por carriles) y métricas debajo.
 * Ninguna depende de tocar para ver datos; tocar solo abre más detalle.
 */
const PV = (() => { try { return (new URLSearchParams(location.search).get('tel') || localStorage.getItem('janus.tel') || 'a2'); } catch (e) { return 'a2'; } })();
const svgSpark = (arr, w, h, col) => '<svg class="pvs" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true"><path d="' + spk(arr, w, h) + '" fill="none" stroke="' + (col || '#E8C37A') + '" stroke-width="1.8" vector-effect="non-scaling-stroke" stroke-linecap="round"/></svg>';
const sevBars = (s) => '<i class="sv">' + [1, 2, 3].map((k) => '<b class="' + (k <= s ? 'on s' + s : '') + '"></b>').join('') + '</i>';
function pvData(M, X) {
  const K = DATA.familia, I = K.items, kd = X.kweek[0];
  const kToday = kd.it.filter((e) => I[e]).map((e) => Object.assign({ e }, I[e]));
  const kpis = [['💶', 'Ingresos', '€' + fmt(X.total), '▲' + X.revDelta + '%', [3, 3.4, 3.2, 3.8, 3.9, 4.1, 4.0, 4.3, 4.4, 4.5, 4.6, 4.65], 'ingresos'],
    ['👁', 'Alcance', Math.round(X.r30 / 1000) + 'K', '▲' + X.reachDelta + '%', DATA.reach30, 'alcance'],
    ['❤', 'Interac.', DATA.kpis[2].v, '▲' + DATA.kpis[2].d, DATA.kpis[2].s, 'contenido'],
    ['📥', 'Leads', DATA.kpis[4].v, '▲' + DATA.kpis[4].d, DATA.kpis[4].s, 'clientes/leads']];
  return { kToday, kpis, cita: X.citas[0], proj: PROJECTS.filter((p) => p.grp === 'activo'), bots: DATA.bots, reels: DATA.reels.slice(0, 3), F: DATA.funnel };
}
const pvHead = (M, X) => '<header class="hd pvh"><img class="medal go" src="' + IMG.medal + '" alt=""' + goAttr('datos', 'Datos') + '><div class="pvb"><div class="wm" data-jg="JANUS">JANUS</div><div class="dt mono">' + M.dateLabel + ' · ' + M.nowLabel + '</div></div>' +
  '<div class="pvc mono"><span class="go"' + goAttr('prioridades', 'Correos') + '>✉ ' + X.mailsOpen.length + '</span><span class="go"' + goAttr('janus/aprob', 'Aprobaciones') + '>🔐 ' + X.apprOpen.length + '</span><span class="go"' + goAttr('trabajo', 'Sala') + '>🎙</span></div></header>';
const pvWx = (M, n) => M.strip.slice(0, n).map((c) => '<span class="pvhr go' + (c.e.r >= 50 ? ' rn' : '') + '"' + goAttr('clima/h' + c.idx, c.label) + '><small class="mono">' + c.label.slice(0, 2) + '</small><img src="' + wxImg(c.e.k) + '" alt=""><b>' + c.e.t + '°</b><i class="mono">' + c.e.r + '%</i></span>').join('');
const pvVerd = (M) => orb(M.ida.verdict, 'IDA') + orb(M.vuelta.verdict, 'VUELTA') + (M.suggest != null ? '<span class="mono pvsal">⏱ ' + minToHm(M.suggest) + '</span>' : '');
const evLine = (a) => '<div class="pvl go amb-' + a.amb + '"' + goAttr('dia/' + a.id, a.t) + '><span class="mono tm">' + a.h + '</span><span class="bb s">' + a.e + '</span><span class="tx">' + esc(a.t) + '</span></div>';
const sec = (route, e, t, mt, body, cls) => '<section class="cd pv ' + (cls || '') + '"><div class="pvt go"' + goAttr(route, t) + '><span class="bb s">' + e + '</span><span class="mono">' + t + '</span><span class="mt mono">' + (mt || '') + '</span></div>' + body + '</section>';

/* ---------- A · TERMINAL ---------- */
function renderPhoneA(M, X) {
  const D = pvData(M, X);
  const clima = sec('clima', '🚴', 'Clima · bici', srcBadge(M.src === 'vivo'), '<div class="pva-wx"><img class="wi" src="' + wxImg(M.nowE.k) + '" alt=""><b class="serif gld big">' + M.nowE.t + '°</b><div class="pvv">' + pvVerd(M) + '</div></div><div class="pvhrs">' + pvWx(M, 8) + '</div>');
  const dia = sec('dia', '🗓', 'Mi día', '● real', X.agenda.slice(0, 4).map(evLine).join(''));
  const fam = sec('familia', '🌟', '__HIJA__', D.cita ? '🩺 ' + D.cita.days + ' d' : '', D.kToday.map((k) => '<div class="pvl"><span class="mono tm">' + k.h + '</span><span class="bb s">' + k.e + '</span><span class="tx">' + k.t + '</span><span class="mono dim">→' + k.to + '</span></div>').join('') +
    '<div class="pvwk">' + X.kweek.map((d, i) => '<span class="' + (i ? '' : 'on') + '"><small class="mono">' + d.l + '</small><b>' + d.n + '</b><i>' + d.it.join('') + '</i></span>').join('') + '</div>');
  const pri = sec('prioridades', '🎯', 'Prioridades', X.mailsOpen.length + ' abiertos', DATA.mails.slice(0, 3).map((m) => '<div class="pvl go"' + goAttr('prioridades/' + m.id, m.who) + '><span class="pini mono">' + m.ini + '</span><span class="tx"><b>' + esc(m.who) + '</b> · ' + esc(m.sj) + '</span>' + sevBars(m.sev) + '</div>').join('') +
    '<div class="pvf">' + X.follow.slice(0, 4).map((f) => '<span class="go"' + goAttr('prioridades/f-' + f.id, f.x) + '>' + ring(f.p, f.p >= 60 ? '#5FD39A' : '#E8C37A', f.p + '%', 26) + '<small>' + esc(f.x.split(' ')[0]) + '</small></span>').join('') + '</div>');
  const kp = '<section class="cd pv pvk">' + D.kpis.map((k) => '<div class="go"' + goAttr(k[5], k[1]) + '><span class="mono kl">' + k[1] + '</span><b class="serif gld">' + k[2] + '</b><span class="mono up">' + k[3] + '</span>' + svgSpark(k[4], 80, 18) + '</div>').join('') + '</section>';
  const bots = sec('chatbots', '🤖', 'Chatbots', 'en vivo', D.bots.map((b) => '<div class="pvl"><i class="dot ' + (b.warn ? 'w' : 'g') + '"></i><span class="tx">' + esc(b.n) + '</span><b class="mono">' + b.c + '</b>' + svgSpark(b.days, 50, 14, '#86B6FF') + '</div>').join(''));
  const cont = sec('contenido', '🎬', 'Reels', 'top 3', D.reels.map((r, i) => '<div class="pvl"><span class="mono tm">' + (i + 1) + '</span><span class="tx">' + esc(r.t) + '</span><b class="mono">' + r.views + 'K</b><span class="mono dim">€' + r.eur + '</span></div>').join(''));
  const cli = sec('clientes', '🤝', 'Embudo', '30 d', '<div class="pvfun">' + D.F.map((f, i) => '<span style="--w:' + (100 - i * 24) + '%"><b class="serif">' + f.n + '</b><small class="mono">' + f.t + '</small></span>').join('') + '</div>');
  const pro = sec('trabajo', '📁', 'Proyectos', '⚙ CI ' + REAL.ci.length + ' · PR ' + REAL.prs.length, '<div class="pvp">' + D.proj.map((p) => '<span class="go"' + goAttr('trabajo/' + p.id, p.n) + '><span class="bb s">' + p.e + '</span>' + esc(p.s || p.n) + '<i></i></span>').join('') + '</div>');
  return pvHead(M, X) + '<main class="pvA">' + clima + dia + fam + pri + kp + '<div class="pv2">' + bots + cont + '</div><div class="pv2">' + cli + pro + '</div></main>';
}

/* ---------- B · CUADRANTES ---------- */
function renderPhoneB(M, X) {
  const D = pvData(M, X);
  const clima = sec('clima', '🚴', 'Clima · bici', srcBadge(M.src === 'vivo'), '<div class="pvb-wx"><div class="l"><img class="wi" src="' + wxImg(M.nowE.k) + '" alt=""><b class="serif gld big">' + M.nowE.t + '°</b></div><div class="pvv">' + pvVerd(M) + '</div></div><div class="pvhrs">' + pvWx(M, 6) + '</div>', 'full');
  const dia = sec('dia', '🗓', 'Mi día', '● real', X.agenda.slice(0, 3).map((a) => '<div class="pvl2"><span class="mono tm">' + a.h + '</span><span class="tx">' + esc(a.t) + '</span></div>').join(''));
  const fam = sec('familia', '🌟', '__HIJA__', '', D.kToday.map((k) => '<div class="pvl2"><span class="mono tm">' + k.h + '</span><span class="tx">' + k.e + ' ' + k.t + '</span></div>').join('') + (D.cita ? '<div class="pvl2 warn"><span class="mono tm">' + D.cita.days + ' d</span><span class="tx">🩺 cita</span></div>' : ''));
  const pri = sec('prioridades', '🎯', 'Correo', X.mailsOpen.length, DATA.mails.slice(0, 3).map((m) => '<div class="pvl2"><span class="tx"><b>' + esc(m.who) + '</b></span>' + sevBars(m.sev) + '</div>').join(''));
  const fol = sec('prioridades', '✅', 'Compromisos', X.follow.filter((f) => !f.done).length, X.follow.slice(0, 3).map((f) => '<div class="pvl2"><span class="tx">' + esc(f.x) + '</span><i class="pbar"><b style="width:' + f.p + '%"></b></i></div>').join(''));
  const ing = sec('ingresos', '💶', 'Ingresos', '▲' + X.revDelta + '%', '<b class="serif gld mid">€' + fmt(X.total) + '</b>' + svgSpark(D.kpis[0][4], 120, 30));
  const alc = sec('alcance', '👁', 'Alcance', '▲' + X.reachDelta + '%', '<b class="serif gld mid">' + Math.round(X.r30 / 1000) + 'K</b>' + svgSpark(DATA.reach30, 120, 30));
  const bots = sec('chatbots', '🤖', 'Chatbots', '', D.bots.map((b) => '<div class="pvl2"><span class="tx">' + esc(b.n.split(' · ')[0]) + '</span><b class="mono">' + b.c + '</b>' + (b.warn ? '<i class="dot w"></i>' : '<i class="dot g"></i>') + '</div>').join('') + svgSpark(D.bots[0].days.map((v, i) => v + D.bots[1].days[i]), 120, 22, '#86B6FF'));
  const cont = sec('contenido', '🎬', 'Reels', '', D.reels.map((r) => '<div class="pvl2"><span class="tx">' + esc(r.t) + '</span><b class="mono">' + r.views + 'K</b></div>').join(''));
  const cli = sec('clientes', '🤝', 'Clientes', '', '<div class="pvfun sm">' + D.F.map((f, i) => '<span style="--w:' + (100 - i * 24) + '%"><b class="serif">' + f.n + '</b><small class="mono">' + f.t + '</small></span>').join('') + '</div>');
  const pro = sec('trabajo', '📁', 'Proyectos', 'PR ' + REAL.prs.length, D.proj.map((p) => '<div class="pvl2"><span class="tx">' + p.e + ' ' + esc(p.s || p.n) + '</span><i class="dot g"></i></div>').join(''));
  const jan = '<section class="cd pv full pvjr"><div class="pvt go"' + goAttr('janus', 'Janus') + '><span class="bb s">⚙</span><span class="mono">Janus</span><span class="mt mono">● real · ' + REAL.syncedAt.slice(11) + '</span></div><div class="pvjn">' + [['✅', 'CI', REAL.ci.length + '/' + REAL.ci.length], ['🧩', 'PR', REAL.prs.length], ['🔐', 'Aprobar', X.apprOpen.length], ['🌦', 'Clima', M.src === 'vivo' ? 'vivo' : 'ejemplo']].map((r) => '<span><span class="bb s">' + r[0] + '</span><small class="mono">' + r[1] + '</small><b class="mono">' + r[2] + '</b></span>').join('') + '</div></section>';
  return pvHead(M, X) + '<main class="pvB">' + clima + dia + fam + pri + fol + ing + alc + bots + cont + cli + pro + jan + '</main>';
}

/* ---------- C · CRONOLOGÍA ---------- */
function renderPhoneC(M, X) {
  const D = pvData(M, X), H0 = 7, H1 = 21, span = H1 - H0;
  const y = (h) => ((h - H0) / span * 100).toFixed(2) + '%';
  const hours = []; for (let h = H0; h <= H1; h += 2) hours.push(h);
  const day = M.raw.hourly.slice(M.nowDay * 24, M.nowDay * 24 + 24);
  const gutter = hours.map((h) => { const e = day[h] || day[0]; return '<div class="pcg" style="top:' + y(h) + '"><small class="mono">' + pad2(h) + '</small><img src="' + wxImg(e.k) + '" alt=""><i class="mono' + (e.r >= 50 ? ' r' : '') + '">' + e.r + '%</i></div>'; }).join('');
  const rain = day.slice(H0, H1 + 1).map((e, i) => '<i style="top:' + y(H0 + i) + ';opacity:' + Math.min(.9, e.r / 100) + '"></i>').join('');
  const TLH = 470;
  const lane = (items, cls) => { let last = -99; return items.slice().sort((a, b) => hmToMin(a.h) - hmToMin(b.h)).map((a) => { const h = Math.max(H0, Math.min(H1 - .5, hmToMin(a.h) / 60)); const top = Math.max((h - H0) / span * TLH, last + 26); last = top; return '<div class="pce ' + cls + ' go" style="top:' + top.toFixed(0) + 'px"' + goAttr(cls === 'k' ? 'familia' : 'dia', a.t) + '><span class="mono">' + a.h + '</span> ' + (a.e || '') + ' ' + esc(a.t) + '</div>'; }).join(''); };
  const nowY = y(Math.max(H0, Math.min(H1, M.nowMin / 60)));
  const tl = '<section class="cd pv pvC-tl"><div class="pvt go"' + goAttr('clima', 'Clima') + '><span class="bb s">🗓</span><span class="mono">Hoy · clima y agenda</span><span class="mt">' + pvVerd(M) + '</span></div>' +
    '<div class="pct"><div class="pcgut">' + gutter + '<div class="pcrain">' + rain + '</div></div>' +
    '<div class="pcl"><small class="mono lh">🏠 personal</small>' + lane(X.agenda.filter((a) => a.amb !== 'e'), 'p') + '</div>' +
    '<div class="pcl"><small class="mono lh">🌟 __HIJA__</small>' + lane(D.kToday.map((k) => ({ h: k.h, e: k.e, t: k.t })), 'k') + '</div>' +
    '<div class="pcl"><small class="mono lh">🏢 empresa</small>' + lane(X.agenda.filter((a) => a.amb === 'e'), 'e') + '</div>' +
    '<div class="pcnow" style="top:' + nowY + '"><span class="mono">' + M.nowLabel + '</span></div></div></section>';
  const kp = '<section class="cd pv pvk">' + D.kpis.map((k) => '<div class="go"' + goAttr(k[5], k[1]) + '><span class="mono kl">' + k[1] + '</span><b class="serif gld">' + k[2] + '</b><span class="mono up">' + k[3] + '</span>' + svgSpark(k[4], 80, 18) + '</div>').join('') + '</section>';
  const st = '<section class="cd pv pvst">' + [
    ['prioridades', '🎯', 'Correo', X.mailsOpen.length + ' abiertos · ' + DATA.mails.filter((m) => m.sev === 3).length + ' urgente', DATA.mails[0].who + ': ' + DATA.mails[0].sj],
    ['chatbots', '🤖', 'Chatbots', D.bots.reduce((a, b) => a + b.c, 0) + ' conv. 7 d', D.bots.map((b) => b.n.split(' · ')[0] + ' ' + b.c).join(' · ')],
    ['contenido', '🎬', 'Reels', D.reels[0].views + 'K top', D.reels.map((r) => r.t.split(' ')[0] + ' ' + r.views + 'K').join(' · ')],
    ['clientes', '🤝', 'Embudo', D.F.map((f) => f.n).join(' → '), D.F.map((f) => f.t).join(' → ')],
    ['trabajo', '📁', 'Proyectos', D.proj.length + ' activos · PR ' + REAL.prs.length, D.proj.map((p) => p.s || p.n).join(' · ')]
  ].map((r) => '<div class="pvr go"' + goAttr(r[0], r[2]) + '><span class="bb s">' + r[1] + '</span><div><b>' + r[2] + ' <span class="mono gold">' + esc(String(r[3])) + '</span></b><small>' + esc(r[4]) + '</small></div></div>').join('') + '</section>';
  return pvHead(M, X) + '<main class="pvCm">' + tl + kp + st + '</main>';
}
function renderPhoneV(M, X) { return PV === 'a2' ? renderPhoneA2(M, X) : PV === 'b' ? renderPhoneB(M, X) : PV === 'c' ? renderPhoneC(M, X) : renderPhoneA(M, X); }
