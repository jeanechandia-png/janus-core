'use strict';
/* ===== Teléfono: tablero propio de widgets compactos (2 columnas) =====
 * En teléfono no se apilan las tarjetas de la tablet: cada función es un widget con su cifra clave
 * y una mini gráfica; al tocarlo se abre la vista de detalle completa.
 */
const PHONE_MQ = '(max-width:47.5em),(max-height:31.25em)';
const isPhone = () => { try { return matchMedia(PHONE_MQ).matches; } catch (e) { return false; } };
const spark = (arr, cls) => '<svg class="wsp ' + (cls || '') + '" viewBox="0 0 120 30" preserveAspectRatio="none" aria-hidden="true"><path d="' + spk(arr, 120, 30) + '" fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linecap="round"/></svg>';
function wdg(route, e, label, big, sub, extra, cls) {
  return '<section class="cd w go ' + (cls || '') + '"' + goAttr(route, label) + '><div class="wh"><span class="bb s">' + e + '</span><span class="wl mono">' + label + '</span></div>' +
    '<b class="wv serif gld">' + big + '</b><div class="ws">' + sub + '</div>' + (extra || '') + '</section>';
}
function renderPhone(M, X) {
  const live = M.src === 'vivo';
  const bad = M.ida.verdict !== 'g' || M.vuelta.verdict !== 'g';
  const strip = M.strip.slice(0, 6).map((c) => '<span class="ph go"' + goAttr('clima/h' + c.idx, c.label) + '><small class="mono">' + c.label + '</small><img src="' + wxImg(c.e.k) + '" alt=""><b>' + c.e.t + '°</b><i class="mono' + (c.e.r >= 50 ? ' r' : '') + '">' + c.e.r + '%</i></span>').join('');
  const clima = '<section class="cd w wide go"' + goAttr('clima', 'Clima') + '><div class="wh"><span class="bb s">🚴</span><span class="wl mono">Clima · bici</span>' + srcBadge(live) + '</div>' +
    '<div class="wc"><img class="wci" src="' + wxImg(M.nowE.k) + '" alt=""><b class="wv serif gld">' + M.nowE.t + '°</b><div class="wcv">' + orb(M.ida.verdict, 'IDA') + orb(M.vuelta.verdict, 'VUELTA') +
    (M.suggest != null ? '<span class="mono wsug">⏱ salir ' + minToHm(M.suggest) + '</span>' : '') + '</div></div><div class="wstp">' + strip + '</div></section>';
  const next = X.agenda.filter((a) => a.m + (a.dur || 30) > M.nowMin && !ST.done[a.id])[0] || X.agenda[0];
  const kd = X.kweek[0], kI = DATA.familia.items, kNext = kd.it.filter((e) => kI[e]).map((e) => kI[e])[0];
  const cita = X.citas[0];
  const proj = PROJECTS.filter((p) => p.grp === 'activo');
  const bots = DATA.bots, conv = bots.reduce((a, b) => a + b.c, 0);
  const top = DATA.reels[0];
  const tiles = [
    wdg('dia', '🗓', 'Mi día', next ? next.h : '—', next ? esc(next.t) : 'Sin eventos', '<div class="wf mono">● real · ' + X.agenda.length + ' hoy</div>'),
    wdg('familia', '🌟', '__HIJA__', kNext ? kNext.h : '—', kNext ? esc(kNext.t) : 'Día libre', cita ? '<div class="wf mono">🩺 cita en ' + cita.days + ' d</div>' : ''),
    wdg('prioridades', '🎯', 'Prioridades', X.mailsOpen.length, 'correos abiertos', '<div class="wf mono">' + DATA.mails.filter((m) => m.sev === 3).length + ' urgente · ' + X.follow.filter((f) => !f.done).length + ' compromisos</div>'),
    wdg('trabajo', '📁', 'Proyectos', proj.length, proj.map((p) => esc(p.s || p.n)).join(' · '), '<div class="wf mono">⚙ CI ' + REAL.ci.length + ' · PR ' + REAL.prs.length + '</div>'),
    wdg('ingresos', '💶', 'Ingresos', '€' + fmt(X.total), '<span class="up mono">▲ ' + X.revDelta + '%</span> 4 sem', spark([3, 3.4, 3.2, 3.8, 3.9, 4.1, 4.0, 4.3, 4.4, 4.5, 4.6, 4.65], 'g')),
    wdg('alcance', '👁', 'Alcance', Math.round(X.r30 / 1000) + 'K', '<span class="up mono">▲ ' + X.reachDelta + '%</span> 30 d', spark(DATA.reach30, 'g')),
    wdg('chatbots', '🤖', 'Chatbots', conv, 'conversaciones 7 d', '<div class="wf mono">' + bots.filter((b) => b.warn).length + ' con avisos</div>'),
    wdg('contenido', '🎬', 'Contenido', top.views + 'K', esc(top.t), '<div class="wf mono">top reel · €' + top.eur + '</div>'),
    wdg('clientes', '🤝', 'Clientes', DATA.funnel[0].n, 'leads · ' + DATA.funnel[2].n + ' clientes', '<div class="wf mono">' + DATA.mailCats.reduce((a, c) => a + c.items.length, 0) + ' correos de empresa</div>'),
    wdg('janus', '⚙', 'Janus', REAL.prs.length, 'PR abiertos · real', '<div class="wf mono">CI ' + REAL.ci.length + '/' + REAL.ci.length + ' en verde</div>')
  ].join('');
  const sala = '<section class="cd w wide wsala go"' + goAttr('inicio', 'Hablar con Janus') + '><img class="wmic" src="' + IMG.mic + '" alt=""><div><b class="serif gld">Hablar con Janus</b><div class="ws">Voz, texto y proyectos</div></div><span class="btn mono">Abrir</span></section>';
  return '<header class="hd hph"><img class="medal go" src="' + IMG.medal + '" alt="Janus"' + goAttr('datos', 'Estado de datos') + '><div><div class="wm" data-jg="JANUS">JANUS</div><div class="dt mono">' + M.dateLabel + ' · ' + M.nowLabel + '</div></div>' +
    '<span class="chip ' + (bad ? 'warn' : 'good') + ' go"' + goAttr('clima', 'Bici') + '>🚴 ' + (bad ? '!' : '✔') + '</span></header>' +
    '<main class="phg">' + clima + sala + tiles + '</main>';
}
