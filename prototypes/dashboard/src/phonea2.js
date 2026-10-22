'use strict';
/* ===== Teléfono A2 · Cristal · oro pulido (elegido por Jean, 22-10-2026) =====
 * Oro renderizado en 3D real (three.js MeshPhysicalMaterial + estudio PMREM, ver tools/gold3d):
 * wordmark JANUS, monedas-icono y atlas de cifras (cada carácter con la misma altura y la misma luz).
 * Las cifras dinámicas se componen con el atlas: así cualquier dato real sale en oro 3D.
 * Escritorio/tablet NO se tocan: este renderer solo se usa en el breakpoint de teléfono.
 */
// Icono: primero el OBJETO 3D hiperrealista (GOLD.o); si no existe, la moneda acuñada (GOLD.i).
const gIco = (n, cls) => GOLD.o[n] ? '<img class="a2i o ' + (cls || '') + '" src="' + GOLD.o[n] + '" alt="">' : GOLD.i[n] ? '<img class="a2i ' + (cls || '') + '" src="' + GOLD.i[n] + '" alt="">' : '';
function gNum(str, cls) {
  const s = String(str).replace(/-/g, '−');
  return '<span class="a2n ' + (cls || '') + '" aria-label="' + esc(String(str)) + '">' + [...s].map((ch) => GOLD.g[ch] ? '<img src="' + GOLD.g[ch] + '" alt="">' : ch === ' ' ? '<i class="sp"></i>' : '<b>' + esc(ch) + '</b>').join('') + '</span>';
}
const EMO2ICO = { '🎓': 'school', '📚': 'school', '🏫': 'school', '☔': 'umbrella', '🌂': 'umbrella', '🤖': 'bot', '⚙': 'settings', '⚙️': 'settings', '🏋': 'dumbbell', '🏋️': 'dumbbell', '💪': 'dumbbell', '🤸': 'dumbbell', '🩺': 'stethoscope', '🎬': 'clapperboard', '📧': 'mail', '✉': 'mail', '🤝': 'handshake', '📁': 'folder', '🌐': 'sun', '💶': 'euro', '❤': 'heart', '🎯': 'target', '🚴': 'bike', '✈': 'plane', '🛒': 'shopping-cart', '📱': 'smartphone', '⏱': 'calendar-days', '🗓': 'calendar-days', '🧩': 'settings', '🏠': 'sun', '📥': 'inbox', '👁': 'eye', '🌟': 'sparkles', '🔐': 'lock', '🏷': 'tag', '🎙': 'mic', '🏢': 'folder' };
const eIco = (e) => EMO2ICO[e] ? gIco(EMO2ICO[e], 'r') : '<span class="a2e">' + e + '</span>';
const a2card = (route, icon, title, meta, body, cls) => '<section class="a2c ' + (cls || '') + '"><div class="a2t go"' + goAttr(route, title) + '>' + gIco(icon, 'c') + '<span>' + title + '</span><em>' + (meta || '') + '</em></div>' + body + '</section>';
const a2row = (time, icon, txt, right, cls, route) => '<div class="a2r ' + (cls || '') + (route ? ' go"' + goAttr(route, txt.replace(/<[^>]+>/g, '')) : '"') + '><span class="tm">' + time + '</span>' + (icon || '') + '<span class="tx">' + txt + '</span>' + (right || '') + '</div>';
const a2spark = (arr, col) => '<svg class="a2sp" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true"><path d="' + spk(arr, 100, 28) + '" fill="none" stroke="' + (col || '#F2C46A') + '" stroke-width="1.6" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/* Orden (Jean, 22-10 19:38): lo más importante arriba.
 * 1 Cabecera + clima mini hoy/mañana · 2 Micrófono de Janus protagonista + chat · 3 Proyectos · 4 Mi día · 5 __HIJA__ · 6 Prioridades · 7 Casa · 8 Ofertas · 9 métricas. */
function renderPhoneA2(M, X) {
  const D = pvData(M, X), raw = M.raw, d0 = raw.daily[M.nowDay] || raw.daily[0], d1 = raw.daily[M.nowDay + 1] || d0;
  const wxMini = '<div class="a2wxm go"' + goAttr('clima', 'Clima 15 días') + '><span class="d"><small>HOY</small><img src="' + wxImg(M.nowE.k) + '" alt="">' + gNum(M.nowE.t + '°', 'w') + '</span><span class="d"><small>MAÑ</small><img src="' + wxImg(d1.k) + '" alt="">' + gNum(d1.tmax + '°', 'w') + '</span></div>';
  const head = '<header class="a2c a2h"><img class="a2md go" src="' + IMG.medal + '" alt=""' + goAttr('datos', 'Datos') + '><div class="a2b"><img class="wm3" src="' + GOLD.wm + '" alt="JANUS"><div class="dt">' + M.dateLabel + ' · ' + M.nowLabel + '</div></div>' + wxMini + '</header>' +
    '<div class="a2hs"><span class="go"' + goAttr('correo', 'Correo') + '>' + gIco('mail') + '<b>' + X.mailsOpen.length + '</b><small>correo</small></span><span class="go"' + goAttr('ofertas', 'Ofertas') + '>' + gIco('tag') + '<b>' + OF.digest.alerts.length + '</b><small>ofertas</small></span><span class="go"' + goAttr('janus/aprob', 'Aprobaciones') + '>' + gIco('lock') + '<b>' + X.apprOpen.length + '</b><small>aprobar</small></span><span class="go ' + (M.ida.verdict === 'g' ? 'ok' : 'wa') + '"' + goAttr('clima/ida', 'Bici') + '>' + gIco('bike') + '<b>' + (M.ida.verdict === 'g' ? '✔' : '!') + '</b><small>bici</small></span></div>';
  // Sala: micrófono de Janus (estilo Melanie) protagonista + chat en el propio dashboard
  const P = projById(UI.pSel), thread = chatsOf(UI.pSel).slice(-2);
  const B = janusBriefing(M, X);
  const sala = '<section class="a2c a2sala" data-js="' + UI.js + '"><div class="a2mic' + (UI.listening ? ' on' : '') + '" style="--micmask:url(' + IMG.mic + ')"' + act('mic', '', UI.listening ? 'Detener' : 'Hablar con Janus') + '><img src="' + IMG.mic + '" alt=""><span class="sweep"></span><i class="ring"></i><i class="ring r2"></i></div>' +
    '<div class="a2say"><b class="serif">' + esc(B.greet) + '</b><span>' + esc(B.lines[0] || '') + '</span><div class="a2sb"><span class="btn2 mono"' + act('brief', '', 'Escuchar resumen') + '>' + gIco('mic') + 'Resumen</span><span class="btn2 mono go"' + goAttr('trabajo/' + UI.pSel, 'Sala') + '>' + gIco('folder') + 'Sala · ' + esc(P.s || P.n) + '</span></div></div>' +
    '<div class="a2th">' + (thread.length ? thread.map((m) => '<div class="a2m ' + m.who + '">' + esc(m.t) + '</div>').join('') : '<div class="a2m ja">Tócame y habla, o escríbeme aquí abajo.</div>') + (UI.js !== 'listo' ? '<div class="a2m ja typing"><i></i><i></i><i></i></div>' : '') + '</div>' +
    '<div class="a2in"><textarea data-f="msg" rows="1" maxlength="2000" placeholder="Escribe a Janus…" aria-label="Mensaje para Janus">' + esc(UI.draft) + '</textarea><span class="a2send"' + act('send', '', 'Enviar') + '>➤</span></div>' + (UI.micMsg ? '<div class="note mono">' + esc(UI.micMsg) + '</div>' : '') + '</section>';
  const PI = { '⚙': 'settings', '🤖': 'bot', '🌐': 'sun', '🧠': 'bot', '🏆': 'target' };
  const pro = a2card('trabajo', 'folder', 'Proyectos', 'CI ' + REAL.ci.length + ' · PR ' + REAL.prs.length, PROJECTS.filter((p) => p.grp !== 'proximo').slice(0, 5).map((p) => '<div class="a2r a2pj go"' + goAttr('trabajo/' + p.id, p.n) + '>' + (PI[p.e] ? gIco(PI[p.e], 'r') : eIco(p.e)) + '<span class="tx"><b>' + esc(p.s || p.n) + '</b><small>' + esc(p.next) + '</small></span><span class="dot ' + (p.grp === 'activo' ? '' : 'w') + '"></span></div>').join(''));
  const dia = a2card('dia', 'calendar-days', 'Mi día', '● real', X.agenda.slice(0, 4).map((a) => a2row(a.h, eIco(a.e), esc(a.t), '', a.amb === 'e' ? 'e' : '', 'dia/' + a.id)).join(''));
  const fam = a2card('familia', 'sparkles', '__HIJA__', D.cita ? 'cita en ' + D.cita.days + ' d' : '',
    D.kToday.map((k) => a2row(k.h, eIco(k.e), esc(k.t), '<span class="to">→ ' + k.to + '</span>')).join('') +
    (D.cita ? '<div class="a2r warn">' + gIco('stethoscope', 'r') + '<span class="tx"><b>Cita médica</b> · en ' + D.cita.days + ' días</span></div>' : '') +
    '<div class="a2r go a2comp"' + goAttr('companero', 'Compañero') + '><img class="a2cp" src="' + CREAT_IMG[(ST.comp && ST.comp.creatureId) || 'lumi'] + '" alt=""><span class="tx"><b>Compañero</b> · mates, juegos y ánimo</span><span class="to">›</span></div>');
  const sev = (s) => '<i class="sv">' + [1, 2, 3].map((k) => '<b class="' + (k <= s ? 'on s' + s : '') + '"></b>').join('') + '</i>';
  const pri = a2card('prioridades', 'target', 'Prioridades', X.mailsOpen.length + ' abiertos · ' + DATA.mails.filter((m) => m.sev === 3).length + ' urgente',
    DATA.mails.slice(0, 3).map((m) => a2row(m.ini, '', '<b>' + esc(m.who) + '</b> · ' + esc(m.sj), sev(m.sev), '', 'prioridades/' + m.id)).join(''));
  const casa = typeof homeCard === 'function' ? homeCard() : '';
  const of = OF.digest;
  const ofertas = '<section class="a2c a2of go"' + goAttr('ofertas', 'Ofertas') + '>' + gIco('tag', 'c') + '<div class="tx"><b>' + of.alerts.length + ' ofertas para ti</b><small>' + of.basketOnSale + ' de tu cesta · revisión lunes 08:00 · ejemplo</small></div>' + gIco('shopping-cart', 'r') + '<span class="to">›</span></section>';
  const KI = { 'Ingresos': 'euro', 'Alcance': 'eye', 'Interac.': 'heart', 'Leads': 'inbox' };
  const kpi = '<section class="a2c a2kp">' + D.kpis.map((k) => '<div class="go"' + goAttr(k[5], k[1]) + '><span class="kl">' + gIco(KI[k[1]]) + k[1] + '</span>' + gNum(k[2], 'kn') + '<span class="up">' + k[3] + '</span>' + a2spark(k[4]) + '</div>').join('') + '</section>';
  const bots = a2card('chatbots', 'bot', 'Chatbots', 'en vivo', D.bots.map((b) => '<div class="a2bt"><span class="dot ' + (b.warn ? 'w' : '') + '"></span><span class="tx">' + esc(b.n) + '</span>' + gNum(b.c, 'kn s') + '</div>' + a2spark(b.days, '#86B6FF')).join(''));
  const reels = a2card('contenido', 'clapperboard', 'Reels', 'top 3', D.reels.map((r, i) => a2row(String(i + 1), '', esc(r.t), '<b class="v">' + r.views + 'K</b>')).join(''));
  const fun = a2card('clientes', 'handshake', 'Embudo', '30 d', '<div class="a2fn">' + D.F.map((f, i) => '<span style="width:' + (100 - i * 24) + '%"><b>' + f.n + '</b>' + f.t + '</span>').join('') + '</div>');
  return '<main class="pa2">' + head + sala + pro + dia + fam + pri + casa + ofertas + kpi + '<div class="a2two">' + bots + reels + '</div>' + fun + '</main>';
}
