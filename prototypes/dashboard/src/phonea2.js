'use strict';
/* ===== Teléfono A2 · Cristal · oro pulido (elegido por Jean, 22-10-2026) =====
 * Oro renderizado en 3D real (three.js MeshPhysicalMaterial + estudio PMREM, ver tools/gold3d):
 * wordmark JANUS, monedas-icono y atlas de cifras (cada carácter con la misma altura y la misma luz).
 * Las cifras dinámicas se componen con el atlas: así cualquier dato real sale en oro 3D.
 * Escritorio/tablet NO se tocan: este renderer solo se usa en el breakpoint de teléfono.
 */
const gIco = (n, cls) => GOLD.i[n] ? '<img class="a2i ' + (cls || '') + '" src="' + GOLD.i[n] + '" alt="">' : '';
function gNum(str, cls) {
  const s = String(str).replace(/-/g, '−');
  return '<span class="a2n ' + (cls || '') + '" aria-label="' + esc(String(str)) + '">' + [...s].map((ch) => GOLD.g[ch] ? '<img src="' + GOLD.g[ch] + '" alt="">' : ch === ' ' ? '<i class="sp"></i>' : '<b>' + esc(ch) + '</b>').join('') + '</span>';
}
const EMO2ICO = { '🎓': 'school', '📚': 'school', '🏫': 'school', '☔': 'umbrella', '🌂': 'umbrella', '🤖': 'bot', '⚙': 'settings', '⚙️': 'settings', '🏋': 'dumbbell', '🏋️': 'dumbbell', '💪': 'dumbbell', '🩺': 'stethoscope', '🎬': 'clapperboard', '📧': 'mail', '✉': 'mail', '🤝': 'handshake', '📁': 'folder', '🌐': 'sun', '💶': 'euro', '❤': 'heart', '🎯': 'target', '🚴': 'bike', '✈': 'plane', '🛒': 'shopping-cart', '🎢': 'ferris-wheel', '📱': 'smartphone' };
const eIco = (e) => EMO2ICO[e] ? gIco(EMO2ICO[e], 'r') : '<span class="a2e">' + e + '</span>';
const a2card = (route, icon, title, meta, body, cls) => '<section class="a2c ' + (cls || '') + '"><div class="a2t go"' + goAttr(route, title) + '>' + gIco(icon, 'c') + '<span>' + title + '</span><em>' + (meta || '') + '</em></div>' + body + '</section>';
const a2row = (time, icon, txt, right, cls, route) => '<div class="a2r ' + (cls || '') + (route ? ' go"' + goAttr(route, txt.replace(/<[^>]+>/g, '')) : '"') + '><span class="tm">' + time + '</span>' + (icon || '') + '<span class="tx">' + txt + '</span>' + (right || '') + '</div>';
const a2spark = (arr, col) => '<svg class="a2sp" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true"><path d="' + spk(arr, 100, 28) + '" fill="none" stroke="' + (col || '#F2C46A') + '" stroke-width="1.6" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function renderPhoneA2(M, X) {
  const D = pvData(M, X), raw = M.raw, d0 = raw.daily[M.nowDay] || raw.daily[0], d1 = raw.daily[M.nowDay + 1] || d0;
  const head = '<header class="a2c a2h"><img class="a2md go" src="' + IMG.medal + '" alt=""' + goAttr('datos', 'Datos') + '><div class="a2b"><img class="wm3" src="' + GOLD.wm + '" alt="JANUS"><div class="dt">' + M.dateLabel + ' · ' + M.nowLabel + '</div></div>' +
    '<div class="a2hs"><span class="go"' + goAttr('correo', 'Correo') + '>' + gIco('mail') + X.mailsOpen.length + '</span><span class="go"' + goAttr('ofertas', 'Ofertas') + '>' + gIco('tag') + OF.digest.alerts.length + '</span><span class="go"' + goAttr('janus/aprob', 'Aprobaciones') + '>' + gIco('lock') + X.apprOpen.length + '</span><span class="go mic"' + goAttr('trabajo', 'Sala') + '>' + gIco('mic') + '</span></div></header>';
  const wd = (lbl, k, temp, line, route) => '<div class="a2wd go"' + goAttr(route, lbl) + '><div class="wl">' + lbl + '</div><div class="wm2"><img class="wi" src="' + wxImg(k) + '" alt="">' + gNum(temp + '°', 'big') + '</div><div class="wk">' + line + '</div></div>';
  const clima = a2card('clima', 'bike', 'Clima · bici', (M.src === 'vivo' ? '● en vivo' : 'ejemplo') + ' · ' + esc(M.place.split(',')[0]),
    '<div class="a2wx">' + wd('HOY', M.nowE.k, M.nowE.t, 'sens. ' + M.nowE.feel + '° · ☔ ' + d0.rmax + '% · ' + (M.nowE.w || d0.wmax) + ' km/h', 'clima') +
    wd('MAÑANA', d1.k, d1.tmax, 'mín. ' + d1.tmin + '° · ☔ ' + d1.rmax + '% · ' + d1.wmax + ' km/h', 'clima') + '</div>' +
    '<div class="a2vd">' + orb(M.ida.verdict, 'IDA ' + ST.settings.ida) + orb(M.vuelta.verdict, 'VUELTA ' + ST.settings.vuelta) + (M.suggest != null ? '<span class="sal mono">⏱ Salir ' + minToHm(M.suggest) + '</span>' : '') + '</div>');
  const dia = a2card('dia', 'calendar-days', 'Mi día', '● real', X.agenda.slice(0, 4).map((a) => a2row(a.h, eIco(a.e), esc(a.t), '', a.amb === 'e' ? 'e' : '', 'dia/' + a.id)).join(''));
  const fam = a2card('familia', 'sparkles', '__HIJA__', D.cita ? 'cita en ' + D.cita.days + ' d' : '',
    D.kToday.map((k) => a2row(k.h, eIco(k.e), esc(k.t), '<span class="to">→ ' + k.to + '</span>')).join('') +
    '<div class="a2wk">' + X.kweek.map((d, i) => '<span class="' + (i ? '' : 'on') + '"><small>' + d.l + '</small><b>' + d.n + '</b><i>' + (d.it.length ? '●' : '·') + '</i></span>').join('') + '</div>' +
    '<div class="a2r go a2comp"' + goAttr('companero', 'Compañero') + '><img class="a2cp" src="' + CREAT_IMG[(ST.comp && ST.comp.creatureId) || 'lumi'] + '" alt=""><span class="tx"><b>Compañero</b> · mates, juegos y ánimo</span><span class="to">›</span></div>');
  const sev = (s) => '<i class="sv">' + [1, 2, 3].map((k) => '<b class="' + (k <= s ? 'on s' + s : '') + '"></b>').join('') + '</i>';
  const pri = a2card('prioridades', 'target', 'Prioridades', X.mailsOpen.length + ' abiertos · ' + DATA.mails.filter((m) => m.sev === 3).length + ' urgente',
    DATA.mails.slice(0, 3).map((m) => a2row(m.ini, '', '<b>' + esc(m.who) + '</b> · ' + esc(m.sj), sev(m.sev), '', 'prioridades/' + m.id)).join('') +
    '<div class="a2cm">' + X.follow.slice(0, 4).map((f) => '<span class="go"' + goAttr('prioridades/f-' + f.id, f.x) + '>' + ring(f.p, f.p >= 60 ? '#5FD39A' : '#F2C46A', f.p + '%', 30) + '<small>' + esc(f.x.split(' ')[0]) + '</small></span>').join('') + '</div>');
  const of = OF.digest;
  const ofertas = '<section class="a2c a2of go"' + goAttr('ofertas', 'Ofertas') + '>' + gIco('tag', 'c') + '<div class="tx"><b>' + of.alerts.length + ' ofertas para ti</b><small>' + of.basketOnSale + ' de tu cesta · revisión lunes 08:00 · ejemplo</small></div>' + gIco('shopping-cart', 'r') + '<span class="to">›</span></section>';
  const KI = { 'Ingresos': 'euro', 'Alcance': 'eye', 'Interac.': 'heart', 'Leads': 'inbox' };
  const kpi = '<section class="a2c a2kp">' + D.kpis.map((k) => '<div class="go"' + goAttr(k[5], k[1]) + '><span class="kl">' + gIco(KI[k[1]]) + k[1] + '</span>' + gNum(k[2], 'kn') + '<span class="up">' + k[3] + '</span>' + a2spark(k[4]) + '</div>').join('') + '</section>';
  const bots = a2card('chatbots', 'bot', 'Chatbots', 'en vivo', D.bots.map((b) => '<div class="a2bt"><span class="dot ' + (b.warn ? 'w' : '') + '"></span><span class="tx">' + esc(b.n) + '</span>' + gNum(b.c, 'kn s') + '</div>' + a2spark(b.days, '#86B6FF')).join(''));
  const reels = a2card('contenido', 'clapperboard', 'Reels', 'top 3', D.reels.map((r, i) => a2row(String(i + 1), '', esc(r.t), '<b class="v">' + r.views + 'K</b>')).join(''));
  const fun = a2card('clientes', 'handshake', 'Embudo', '30 d', '<div class="a2fn">' + D.F.map((f, i) => '<span style="width:' + (100 - i * 24) + '%"><b>' + f.n + '</b>' + f.t + '</span>').join('') + '</div>');
  const PI = { '⚙': 'settings', '🤖': 'bot', '🌐': 'sun' };
  const pro = a2card('trabajo', 'folder', 'Proyectos', 'PR ' + REAL.prs.length, D.proj.map((p) => '<div class="a2r go"' + goAttr('trabajo/' + p.id, p.n) + '>' + (PI[p.e] ? gIco(PI[p.e], 'r') : eIco(p.e)) + '<span class="tx"><b>' + esc(p.s || p.n) + '</b> · ' + esc(p.decl || p.next.split(':')[0]) + '</span><span class="dot"></span></div>').join(''));
  return '<main class="pa2">' + head + clima + dia + fam + pri + ofertas + kpi + '<div class="a2two">' + bots + reels + '</div><div class="a2two">' + fun + pro + '</div></main>';
}
