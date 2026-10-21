'use strict';
/* ===== Pestañas de detalle ===== */
const UI = { clDay: null, clH: null, clMetric: 't', dDay: 0, dSel: null, kDay: 0, mFilter: 0, mSel: 'm0', fSel: null, iPer: 12, iSel: null, aPer: 30, bSel: null, cSort: 'views', cSel: 'r1', clCat: 'leads', clSel: 0, geo: [], geoMsg: '' };
const TABS = [['clima', '🚴', 'Clima'], ['dia', '🗓', 'Mi día'], ['familia', '🌟', '__HIJA__'], ['prioridades', '🎯', 'Prioridades'], ['janus', '⚙', 'Janus'], ['ingresos', '💶', 'Ingresos'], ['alcance', '👁', 'Alcance'], ['chatbots', '🤖', 'Chatbots'], ['contenido', '🎬', 'Contenido'], ['clientes', '🤝', 'Clientes'], ['datos', '🛈', 'Datos']];
const act = (a, arg, label) => ' data-act="' + a + '"' + (arg !== undefined ? ' data-arg="' + esc(arg) + '"' : '') + ' role="button" tabindex="0"' + (label ? ' aria-label="' + esc(label) + '"' : '');
const seg = (a, cur, opts) => '<div class="seg mono">' + opts.map((o) => '<span class="sg' + (String(o[0]) === String(cur) ? ' on' : '') + '"' + act(a, o[0], o[1]) + '>' + o[1] + '</span>').join('') + '</div>';
const panel = (cls, e, title, mt, body, extra) => '<section class="cd ' + (cls || '') + '"' + (extra || '') + '><div class="lb mono"><span class="bb">' + e + '</span>' + title + '<span class="mt">' + (mt || '') + '</span></div><div class="pb">' + body + '</div></section>';
const ring = (p, col, txt, size) => '<span class="rg2" style="--sz:' + rem(size || 46) + ';background:conic-gradient(' + col + ' ' + clamp(p, 0, 100) * 3.6 + 'deg,rgba(255,255,255,.09) 0)"><span class="mono">' + (txt != null ? txt : p + '%') + '</span></span>';
const pill = (txt, cls) => '<span class="pill2 mono ' + (cls || '') + '">' + txt + '</span>';
const LVC = ['g', 'a', 'r'];

function lineChart(o) {
  const n = o.series[0].vals.length, all = [].concat(...o.series.map((s) => s.vals)), mx = o.max != null ? o.max : Math.max(...all) * 1.1 || 1, mn = o.min != null ? o.min : Math.min(0, ...all);
  const y = (v) => 200 - ((v - mn) / (mx - mn || 1)) * 190 - 5, x = (i) => n === 1 ? 300 : i * (600 / (n - 1));
  const uid = 'g' + (lineChart.n = (lineChart.n || 0) + 1);
  // 3D: área con degradado de profundidad, cinta extruida bajo la línea y brillo especular.
  const defs = '<defs>' + o.series.map((s, k) => '<linearGradient id="' + uid + 'a' + k + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + s.c + '" stop-opacity=".42"/><stop offset=".55" stop-color="' + s.c + '" stop-opacity=".12"/><stop offset="1" stop-color="' + s.c + '" stop-opacity="0"/></linearGradient>').join('') +
    '<linearGradient id="' + uid + 'b" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".22" stop-color="#fff" stop-opacity=".55"/><stop offset=".5" stop-color="#000" stop-opacity=".08"/><stop offset=".78" stop-color="#fff" stop-opacity=".25"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient></defs>';
  // Cinta 3D: pared extruida entre la línea y su copia desplazada en profundidad.
  const DX = 7, DY = 9;
  const paths = o.series.map((s, k) => { const pts = s.vals.map((v, i) => [x(i), y(v)]), d = smooth(pts);
    const wall = s.dash ? '' : '<polygon points="' + pts.map((p) => f1(p[0]) + ',' + f1(p[1])).join(' ') + ' ' + pts.slice().reverse().map((p) => f1(p[0] + DX) + ',' + f1(p[1] + DY)).join(' ') + '" fill="' + s.c + '" opacity=".16"/>' +
      '<path d="' + d + '" fill="none" stroke="' + s.c + '" stroke-width="' + ((s.w || 2.2) * .9) + '" stroke-linecap="round" vector-effect="non-scaling-stroke" transform="translate(' + DX + ' ' + DY + ')" opacity=".35"/>';
    return (s.fill ? '<path d="' + d + ' L600 200 L0 200 Z" fill="url(#' + uid + 'a' + k + ')"/>' : '') + wall +
    (s.dash ? '' : '<path class="xtr" d="' + d + '" fill="none" stroke="' + s.c + '" stroke-width="' + ((s.w || 2.2) * 4) + '" stroke-linecap="round" vector-effect="non-scaling-stroke" opacity=".16"/>') +
    '<path class="ln3" d="' + d + '" fill="none" stroke="' + s.c + '" stroke-width="' + (s.w || 2.2) * 1.25 + '"' + (s.dash ? ' stroke-dasharray="5 5"' : '') + ' stroke-linecap="round" vector-effect="non-scaling-stroke"/>' +
    (s.dash ? '' : '<path d="' + d + '" fill="none" stroke="#fff" stroke-width=".9" stroke-linecap="round" vector-effect="non-scaling-stroke" opacity=".55" transform="translate(0 -1)"/>'); }).join('');
  const bw = 600 / n * .64;
  // Barras como prismas: cara frontal, tapa y lateral con sombreado.
  const bars = o.bars ? o.bars.vals.map((v, i) => { const bx = x(i) - 600 / n * .32, by = y(v), bh = Math.max(0, 195 - by), dx = bw * .38, dy = 5;
    if (bh < .5) return '';
    return '<polygon points="' + f1(bx + bw) + ',' + f1(by) + ' ' + f1(bx + bw + dx) + ',' + f1(by - dy) + ' ' + f1(bx + bw + dx) + ',' + f1(195 - dy) + ' ' + f1(bx + bw) + ',195" fill="' + o.bars.c + '" opacity=".5"/><polygon points="' + f1(bx + bw) + ',' + f1(by) + ' ' + f1(bx + bw + dx) + ',' + f1(by - dy) + ' ' + f1(bx + bw + dx) + ',' + f1(195 - dy) + ' ' + f1(bx + bw) + ',195" fill="#000" opacity=".35"/>' +
      '<rect x="' + f1(bx) + '" y="' + f1(by) + '" width="' + f1(bw) + '" height="' + f1(bh) + '" fill="' + o.bars.c + '" opacity=".92"/><rect x="' + f1(bx) + '" y="' + f1(by) + '" width="' + f1(bw) + '" height="' + f1(bh) + '" fill="url(#' + uid + 'b)" opacity=".5"/>' +
      '<polygon points="' + f1(bx) + ',' + f1(by) + ' ' + f1(bx + dx) + ',' + f1(by - dy) + ' ' + f1(bx + bw + dx) + ',' + f1(by - dy) + ' ' + f1(bx + bw) + ',' + f1(by) + '" fill="#fff" opacity=".6"/>'; }).join('') : '';
  const ticks = [mx, (mx + mn) / 2, mn].map((v) => '<span>' + (o.yf ? o.yf(v) : Math.round(v)) + '</span>');
  const bands = (o.bands || []).map((b) => '<span class="band ' + (b.cls || '') + '" style="left:' + (b.a / n * 100) + '%;width:' + ((b.b - b.a) / n * 100) + '%"><em class="mono">' + b.t + '</em></span>').join('');
  const hits = '<div class="hits" style="grid-template-columns:repeat(' + n + ',1fr)">' + o.series[0].vals.map((_, i) => '<i class="' + (o.sel === i ? 'on' : '') + '" data-ro="' + esc(o.ro(i)) + '"' + (o.act ? act(o.act, o.actArg ? o.actArg(i) : i) : '') + '></i>').join('') + '</div>';
  const xl = o.xl ? '<div class="xax2 mono">' + o.xl.map((t) => '<span>' + t + '</span>').join('') + '</div>' : '';
  return '<div class="lc"><div class="cbx"><div class="yax mono">' + ticks.join('') + '</div><div class="plot">' + bands + '<svg viewBox="0 0 600 200" preserveAspectRatio="none">' + defs + '<path d="M0 5 L600 5 M0 100 L600 100 M0 195 L600 195" stroke="rgba(255,255,255,.08)" fill="none" vector-effect="non-scaling-stroke"/>' + bars + paths + '</svg>' + hits + '</div></div>' + xl + '</div>';
}
const roBox = (txt) => '<div class="ro mono">' + (txt || '☝ toca la gráfica') + '</div>';
const hbars = (rows, max, fmtv) => '<div class="hb">' + rows.map((r) => '<div class="hbr"><span class="hl">' + r[0] + '</span><div class="rtk"><div class="rfl" style="--c:' + (r[2] || 'var(--gold)') + ';width:' + Math.round(r[1] / max * 100) + '%;' + (r[2] ? 'background:' + r[2] : '') + '"></div></div><b class="mono">' + (fmtv ? fmtv(r[1]) : r[1]) + '</b></div>').join('') + '</div>';

function frame(id, sub, M, body) {
  const t = TABS.find((x) => x[0] === id), live = id === 'clima' ? M.src === 'vivo' : (id === 'dia' || id === 'janus');
  return '<div class="vh"><span class="back mono" data-go="" role="link" tabindex="0" aria-label="Volver al dashboard">← Dashboard</span><span class="bb m">' + t[1] + '</span><h1 class="serif gld">' + t[2] + '</h1>' + (id === 'datos' ? '' : (id === 'dia' || id === 'janus') ? '<span class="src live mono">● REAL · ' + REAL.syncedAt.slice(11) + '</span>' : srcBadge(live)) +
    '<nav class="tabs">' + TABS.map((x) => '<span class="tb2' + (x[0] === id ? ' on' : '') + '" data-go="' + x[0] + '" role="link" tabindex="0" title="' + x[2] + '"><i>' + x[1] + '</i><em class="mono">' + x[2] + '</em></span>').join('') + '</nav>' +
    '<a class="nt mono" href="#' + id + (sub ? '/' + esc(sub) : '') + '" target="_blank" rel="noopener" title="Abrir en pestaña nueva">↗</a></div><div class="vb vb-' + id + '">' + body + '</div>';
}

/* ---------- CLIMA ---------- */
function vClima(M, X, sub) {
  const H = M.raw.hourly, s = ST.settings;
  if (sub === 'now' || sub === 'viento') UI.clH = M.raw.nowIdx;
  else if (sub === 'ida') UI.clH = M.ida.day * 24 + Math.floor(hmToMin(s.ida) / 60);
  else if (sub === 'vuelta') UI.clH = M.vuelta.day * 24 + Math.floor(hmToMin(s.vuelta) / 60);
  else if (sub && sub[0] === 'h') UI.clH = clamp(+sub.slice(1), 0, H.length - 1);
  if (UI.clH == null) UI.clH = M.raw.nowIdx;
  if (sub && sub !== 'kit') UI.clDay = Math.floor(UI.clH / 24);
  if (UI.clDay == null) UI.clDay = M.nowDay;
  const e = Object.assign({}, H[UI.clH], UI.clH === M.raw.nowIdx ? M.nowE : {}), rk = hourRisk(e), dn = M.raw.today + Math.floor(UI.clH / 24);
  const hero = panel('wxh', '🕐', 'Hora seleccionada', '<span class="mini mono"' + act('clH', -1, 'Hora anterior') + '>◀</span> <span class="mini mono"' + act('clH', 1, 'Hora siguiente') + '>▶</span>',
    '<div class="hero"><img src="' + wxImg(e.k) + '" alt=""><div><div class="tp serif gld">' + e.t + '°</div><div class="mono dim">' + dateLabel(dn) + ' · ' + (UI.clH === M.raw.nowIdx ? M.nowLabel : pad2(e.h) + ':00') + '</div><div class="dim">' + WX_TXT[e.k] + '</div></div></div>' +
    '<div class="rk2 ' + LVC[rk.lv] + ' mono">' + ['✔ Bien para bici', '! Precaución', '✕ Evitar'][rk.lv] + (rk.why.length ? ' · ' + rk.why.join(' ') : '') + '</div>' +
    '<div class="kv">' + [['🌡', 'Sensación', e.feel + '°'], ['💨', 'Viento', arrowSvg(e.d) + ' ' + compassTxt(e.d) + ' · ' + e.w + ' km/h'], ['⚡', 'Ráfagas', e.g + ' km/h'], ['💧', 'Lluvia', e.r + '% · ' + dec(e.mm) + ' mm'], ['💦', 'Humedad', e.rh + '%'], ['☀', 'UV', dec(e.uv)], ['👁', 'Visibilidad', e.vis + ' km'], ['☁', 'Nubes', e.cl + '%']].map((r) => '<div class="kvr"><span class="bb s">' + r[0] + '</span><span>' + r[1] + '</span><b class="mono">' + r[2] + '</b></div>').join('') + '</div>' +
    '<div class="dw2">' + compassSvg(e.d, M.retE.d) + '</div>');
  const d0 = UI.clDay * 24, hs = H.slice(d0, d0 + 24), met = UI.clMetric;
  const dep = hmToMin(s.ida) / 60, ret = hmToMin(s.vuelta) / 60;
  const ser = met === 't' ? [{ vals: hs.map((x) => x.t), c: '#FFE9B0', fill: true }, { vals: hs.map((x) => x.feel), c: '#86B6FF', dash: true }] : met === 'w' ? [{ vals: hs.map((x) => x.w), c: '#E8C37A', fill: true }, { vals: hs.map((x) => x.g), c: '#FF6B5E', dash: true }] : [{ vals: hs.map((x) => x.r), c: '#86B6FF', fill: true }];
  const chart = lineChart({ series: ser, bars: met === 'r' ? { vals: hs.map((x) => Math.min(100, x.mm * 40)), c: '#3E8BFF' } : null, max: met === 'r' ? 100 : undefined, min: met === 't' ? Math.min(...hs.map((x) => x.feel)) - 2 : 0, yf: (v) => Math.round(v) + (met === 't' ? '°' : met === 'r' ? '%' : ''), sel: Math.floor(UI.clH / 24) === UI.clDay ? UI.clH % 24 : -1,
    bands: [{ a: Math.floor(dep), b: Math.floor(dep) + 1, t: '🚴 ida' }, { a: Math.floor(ret), b: Math.floor(ret) + 1, t: '🚴 vuelta' }].concat(UI.clDay === M.nowDay ? [{ a: M.raw.nowIdx % 24, b: M.raw.nowIdx % 24 + .15, t: 'ahora', cls: 'nowb' }] : []),
    ro: (i) => pad2(i) + ':00 · ' + (met === 't' ? hs[i].t + '° / sens. ' + hs[i].feel + '°' : met === 'w' ? hs[i].w + ' km/h · ráf. ' + hs[i].g : hs[i].r + '% · ' + dec(hs[i].mm) + ' mm'), act: 'clH', actArg: (i) => 'a' + (d0 + i), xl: ['00', '03', '06', '09', '12', '15', '18', '21', '24'] });
  const icons = '<div class="icrow">' + hs.map((x, i) => '<i class="' + LVC[hourRisk(x).lv] + (d0 + i === UI.clH ? ' on' : '') + '"' + act('clH', 'a' + (d0 + i), pad2(i) + ':00') + '><img src="' + wxImg(x.k) + '" alt=""></i>').join('') + '</div>';
  const chartP = panel('wxc', '📈', '24 horas · ' + dateLabel(M.raw.today + UI.clDay), seg('clMetric', met, [['t', '🌡 Temp.'], ['r', '💧 Lluvia'], ['w', '💨 Viento']]), roBox() + chart + icons);
  const days = panel('wxd', '📅', '7 días', 'toca un día', '<div class="d7">' + M.raw.daily.map((d, i) => '<div class="d7c' + (i === UI.clDay ? ' on' : '') + '"' + act('clDay', i, dateLabel(d.dn)) + '><span class="mono dim">' + dateShort(d.dn) + '</span><img src="' + wxImg(d.k) + '" alt=""><b class="serif">' + d.tmax + '°</b><span class="mono dim">' + d.tmin + '°</span><span class="mono p">💧' + d.rmax + '%</span><span class="mono">💨' + d.wmax + '</span></div>').join('') + '</div>');
  const leg = (name, L2, lab) => '<div class="leg">' + orb(L2.verdict, name) + '<div><b class="mono">' + lab + '</b><div class="dim">' + (L2.why.length ? L2.why.join(' ') : 'Sin riesgos en la franja') + '</div></div></div>';
  const plan = panel('wxp', '🚴', 'Plan de bici', '', leg('IDA', M.ida, M.depLabel) + leg('VUELTA', M.vuelta, M.retLabel) +
    '<div class="sug mono">' + (M.suggest != null ? '⏱ Sal antes de <b>' + minToHm(M.suggest) + '</b> · ' + M.leaveWhy + ' desde las ' + pad2(M.firstBad) + ':00' : '✔ Sin ventana de riesgo por la tarde') + '</div>' +
    '<div class="sb mono">Equipo recomendado</div><div class="kit2">' + M.kit.map((k) => '<div class="kr2' + (k.on ? ' on' : '') + '"><span class="bb s' + (k.on ? '' : ' off') + '">' + k.e + '</span><div><b>' + k.n + '</b><div class="dim">' + k.why + '</div></div><span class="mono">' + (k.on ? 'SÍ' : 'no') + '</span></div>').join('') + '</div>');
  const sl = (key, label, min, max, step, unit) => '<label class="sl"><span>' + label + '</span><input type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + s[key] + '" data-set="' + key + '"><b class="mono" data-out="' + key + '">' + s[key] + unit + '</b></label>';
  const thr = panel('wxt', '🎚', 'Mis umbrales', 'se guardan aquí', '<div class="tms"><label>🚴 Ida <input type="time" value="' + s.ida + '" data-set="ida"></label><label>🏠 Vuelta <input type="time" value="' + s.vuelta + '" data-set="vuelta"></label></div>' + sl('rainBad', '💧 Lluvia evitar', 20, 90, 5, '%') + sl('windBad', '💨 Viento evitar', 15, 50, 1, ' km/h') + sl('feelCold', '🧥 Chaqueta bajo', 5, 22, 1, '°') + sl('feelGlove', '🧤 Guantes bajo', 0, 15, 1, '°'));
  return frame('clima', sub, M, hero + chartP + days + '<div class="col3">' + plan + thr + '</div>');
}

/* ---------- MI DÍA ---------- */
function vDia(M, X, sub) {
  if (sub && sub !== 'hoy') UI.dSel = sub;
  const list = UI.dDay === 0 ? X.agenda : X.agendaTomorrow.concat(ST.localEv.filter((x) => x.day === 1).map((a) => Object.assign({}, a, { m: hmToMin(a.h) }))).sort((a, b) => a.m - b.m);
  if (!UI.dSel || !list.find((a) => a.id === UI.dSel)) UI.dSel = (list[0] || {}).id;
  const row = (a) => { const past = UI.dDay === 0 && (ST.done[a.id] || a.m + (a.dur || 30) <= M.nowMin); const top = (a.m - 360) / (16 * 60) * 100; return '<div class="tlr' + (a.id === UI.dSel ? ' on' : '') + (past ? ' past' : '') + (a.id === X.nextId && UI.dDay === 0 ? ' nx' : '') + '"' + act('dSel', a.id, a.t) + '><span class="mono tm">' + a.h + '</span><span class="bb s">' + a.e + '</span><div class="tx"><b>' + esc(a.t) + '</b><span class="dim mono">' + (a.dur || 30) + ' min' + (a.amb === 'f' ? ' · 👧 familia' : '') + '</span></div><span class="chk' + (ST.done[a.id] ? ' ok' : '') + '"' + act('evDone', a.id, 'Hecho') + '>✔</span></div>'; };
  const P = list.filter((a) => a.amb !== 'e'), E = list.filter((a) => a.amb === 'e');
  const tl = (arr) => { let prev = -99; const grid = [6, 8, 10, 12, 14, 16, 18, 20, 22].map((h) => '<span class="hl2 mono" style="top:' + ((h - 6) / 16 * 100).toFixed(2) + '%">' + pad2(h) + '</span>').join('');
    const nowL = UI.dDay === 0 && M.nowMin >= 360 && M.nowMin <= 1320 ? '<span class="nowl" style="top:' + ((M.nowMin - 360) / 960 * 100).toFixed(2) + '%"></span>' : '';
    return '<div class="tlp">' + grid + nowL + arr.map((a) => { let t = clamp((a.m - 360) / 960 * 100, 0, 93); t = Math.max(t, prev + 6.2); prev = t; return '<div class="tlw" style="top:' + t.toFixed(2) + '%">' + row(a) + '</div>'; }).join('') + '</div>'; };
  const sel = list.find((a) => a.id === UI.dSel);
  let det = '<div class="dim">Sin eventos</div>';
  if (sel) {
    const wx = M.at(M.nowDay + UI.dDay, Math.floor(sel.m / 60)), rk = hourRisk(wx);
    det = '<div class="evd"><span class="bb m">' + sel.e + '</span><div><b class="serif big2">' + esc(sel.t) + '</b><div class="mono dim">' + sel.h + ' – ' + minToHm(sel.m + (sel.dur || 30)) + ' · ' + ({ p: '🏠 Personal', f: '👧 Familia', e: '🏢 Empresa' })[sel.amb] + '</div></div></div>' +
      '<div class="kv">' + [['📍', 'Lugar', esc(sel.where || '—')], ['🌦', 'Clima a esa hora', wx.t + '° · 💧' + wx.r + '% · 💨' + wx.w], ['🚦', 'Bici', ['✔ bien', '! precaución', '✕ evitar'][rk.lv]], ['📝', 'Nota', esc(sel.note || '—')]].map((r) => '<div class="kvr"><span class="bb s">' + r[0] + '</span><span>' + r[1] + '</span><b class="mono">' + r[2] + '</b></div>').join('') + '</div>' +
      '<div class="btns"><span class="btn"' + act('evDone', sel.id) + '>' + (ST.done[sel.id] ? '↺ Reabrir' : '✔ Hecho') + '</span>' + (String(sel.id).startsWith('loc') ? '<span class="btn r"' + act('evDel', sel.id) + '>🗑 Quitar</span>' : '') + '</div>';
  }
  const conf = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) { const a = list[i], b = list[j]; if (a.m < b.m + (b.dur || 30) && b.m < a.m + (a.dur || 30)) conf.push('⚠ ' + a.h + ' ' + esc(a.t) + ' ↔ ' + b.h + ' ' + esc(b.t)); }
  list.filter((a) => /🚴|🤸|🏃/.test(a.e)).forEach((a) => { const wx = M.at(M.nowDay + UI.dDay, Math.floor(a.m / 60)); if (hourRisk(wx).lv === 2) conf.push('☔ ' + a.h + ' ' + esc(a.t) + ': ' + hourRisk(wx).why.join(' ')); });
  const add = '<div class="addf"><input type="time" value="18:00" data-f="evH"><input type="text" placeholder="Nuevo evento" maxlength="40" data-f="evT"><select data-f="evA"><option value="p">🏠</option><option value="f">👧</option><option value="e">🏢</option></select><span class="btn"' + act('evAdd') + '>＋</span></div>';
  return frame('dia', sub, M, '<div class="topbar">' + seg('dDay', UI.dDay, [[0, 'Hoy · ' + dateShort(M.today)], [1, 'Mañana · ' + dateShort(M.today + 1)]]) + '<span class="mono dim">Ámbitos separados: 🏠 personal y 👧 familia · 🏢 empresa</span></div>' +
    panel('', '🏠', 'Personal y familia', P.length + ' eventos', tl(P)) + panel('', '🏢', 'Empresa', E.length + ' eventos', tl(E)) +
    '<div class="col3">' + panel('', '🔎', 'Detalle', '', det) + panel('', '＋', 'Añadir rápido', 'solo en este dispositivo', add) + panel('', '🚦', 'Avisos y próximo', conf.length + ' avisos', (conf.length ? '<div class="alst">' + conf.map((c) => '<div>' + c + '</div>').join('') + '</div>' : '<div class="dim">✔ Sin choques ni riesgos</div>') + '<div class="sb mono">' + (UI.dDay === 0 ? 'Mañana' : 'Hoy') + '</div>' + (UI.dDay === 0 ? X.agendaTomorrow : X.agenda).map((a) => '<div class="li2"><span class="bb s">' + a.e + '</span><span>' + esc(a.t) + '</span><b class="mono">' + a.h + ' · ' + (a.amb === 'e' ? '🏢' : a.amb === 'f' ? '👧' : '🏠') + '</b></div>').join('')) + '</div>');
}

/* ---------- KENDRA ---------- */
function vFamilia(M, X, sub) {
  if (sub && sub[0] === 'd') UI.kDay = +sub.slice(1) || 0;
  const K = DATA.familia, I = K.items, day = X.kweek[UI.kDay];
  const items = day.it.filter((e) => I[e]).map((e) => '<div class="kt"><span class="tm mono">' + I[e].h + '</span><span class="bb s">' + e + '</span><span class="tx">' + I[e].t + '</span><small class="mono">→ ' + I[e].to + '</small></div>').join('') || '<div class="dim">🌿 Día libre</div>';
  const lleva = K.lleva.map((l) => '<div class="cl2' + (ST.lleva[l.id] ? ' ok' : '') + '"' + act('lleva', l.id, l.t) + '><span class="chk' + (ST.lleva[l.id] ? ' ok' : '') + '">✔</span><span class="bb s">' + l.e + '</span><span>' + l.t + '</span></div>').join('');
  const tras = UI.kDay === 0 ? X.agenda.filter((a) => a.amb === 'f').concat(day.it.includes('🤸') ? [{ h: '17:30', e: '🏠', t: 'Recoger del gimnasio', m: 1050 }] : []).map((a) => { const w = M.at(M.nowDay, Math.floor(a.m / 60)), r = hourRisk(w); return '<div class="li2"><span class="bb s">' + a.e + '</span><span>' + a.h + ' · ' + esc(a.t) + '</span><b class="mono ' + (r.lv === 2 ? 'badc' : r.lv ? '' : 'okc') + '">' + w.t + '° 💧' + w.r + '%</b></div>'; }).join('') : '';
  const hoy = panel('', '📍', UI.kDay === 0 ? 'Hoy' : dateLabel(day.dn), dateShort(day.dn), items + '<div class="sb mono">Qué lleva</div>' + lleva + (tras ? '<div class="sb mono">Traslados y clima</div>' + tras : ''));
  const wk = panel('', '🗓', 'Semana', 'toca un día', '<div class="wk2"><div class="wkax mono">' + ['08', '11', '14', '17', '20'].map((h) => '<span style="top:' + ((+h - 7) / 14 * 100).toFixed(1) + '%">' + h + '</span>').join('') + '</div>' + X.kweek.map((d, i) => '<div class="wkc' + (i === UI.kDay ? ' on' : '') + (i === 0 ? ' td' : '') + '"' + act('kDay', i, d.l + ' ' + d.n) + '><span class="mono dim">' + d.l + '</span><b class="serif">' + d.n + '</b><div class="wkt">' + d.it.map((e) => { const h = I[e] ? hmToMin(I[e].h) / 60 : 12; return '<span class="kit3" style="top:' + clamp((h - 7) / 14 * 100, 0, 88).toFixed(1) + '%">' + e + '<small class="mono">' + (I[e] ? I[e].h : '') + '</small></span>'; }).join('') + '</div></div>').join('') + '</div>');
  const cit = panel('', '🩺', 'Citas médicas', '', X.citas.map((c) => '<div class="ci">' + ring(clamp(100 - c.days * 3, 5, 100), c.days <= 7 ? '#FF6B5E' : '#E8C37A', c.days + 'd', 48) + '<div><b>' + I[c.e].t + '</b><div class="mono dim">' + dateLabel(c.dn) + ' · ' + I[c.e].h + '</div><div class="dim">📝 ' + c.note + '</div></div></div>').join('') || '<div class="dim">Sin citas</div>');
  const dl = (x) => { const dn = dayNum(x.y, x.m, x.d); return { dn, days: dn - M.today }; };
  const esc2 = panel('', '🏫', 'Escuela', 'próximas', K.escuela.map((x) => { const q = dl(x); return '<div class="li2' + (q.days < 0 ? ' past' : '') + '"><span class="bb s">' + x.e + '</span><span>' + x.t + '</span><b class="mono">' + dateShort(q.dn) + ' · ' + (q.days < 0 ? 'hecho' : q.days === 0 ? 'hoy' : q.days + ' d') + '</b></div>'; }).join(''));
  const sem = panel('', '🤸', 'Gimnasio y clases', 'semanal', K.semanal.map((x) => '<div class="li2"><span class="bb s">' + x[0] + '</span><span>' + x[1] + '</span><b class="mono">' + x[2] + ' · ' + x[3] + '</b></div>').join(''));
  const vac = panel('', '🏖', 'Vacaciones', '', K.vacaciones.map((x) => { const q = dl(x); return '<div class="ci">' + ring(clamp(100 - q.days / 1.2, 3, 100), '#86B6FF', q.days + 'd', 48) + '<div><b>' + x.e + ' ' + x.t + '</b><div class="mono dim">' + dateShort(q.dn) + ' → ' + x.to + '</div></div></div>'; }).join(''));
  return frame('familia', sub, M, hoy + wk + cit + esc2 + sem + vac);
}

/* ---------- PRIORIDADES ---------- */
function vPrioridades(M, X, sub) {
  if (sub && sub[0] === 'm') UI.mSel = sub;
  if (sub && sub[0] === 'f') UI.fSel = sub;
  const ms = DATA.mails.filter((m) => !UI.mFilter || m.sev === UI.mFilter);
  const list = panel('', '✉', 'Correos prioritarios', X.mailsOpen.length + ' abiertos', seg('mFilter', UI.mFilter, [[0, 'Todos'], [3, '🔴'], [2, '🟠'], [1, '🔵']]) + '<div class="mls">' + ms.map((m) => { const st = ST.mail[m.id] || {}; return '<div class="ml2' + (m.id === UI.mSel ? ' on' : '') + (st.done ? ' past' : '') + '"' + act('mSel', m.id, m.who) + '><span class="av mono">' + m.ini + '</span><div class="mid"><div class="who">' + esc(m.who) + (st.pin ? ' 📌' : '') + '</div><div class="sj">' + esc(m.sj) + '</div></div><div class="mono dim r2">' + m.age + '<br>' + pill(m.tag) + '</div><span class="sig s' + m.sev + '"><i></i><i></i><i></i></span></div>'; }).join('') + '</div>');
  const m = DATA.mails.find((x) => x.id === UI.mSel) || DATA.mails[0], st = ST.mail[m.id] || {};
  const rd = panel('', '📖', esc(m.who), m.age + ' · ' + ['', '🔵 baja', '🟠 media', '🔴 alta'][m.sev], '<div class="rdh"><span class="av mono big3">' + m.ini + '</span><div><b class="serif big2">' + esc(m.sj) + '</b><div class="mono dim">🏢 Empresa · ' + m.tag + '</div></div></div>' +
    '<div class="sumb"><span class="bb s">🧠</span><div><b>Resumen Janus</b><div>' + esc(m.sum) + '</div></div></div><div class="sumb"><span class="bb s">➡</span><div><b>Acción sugerida</b><div>' + esc(m.act) + '</div></div></div>' +
    '<div class="btns"><span class="btn"' + act('mail', m.id + '|done') + '>' + (st.done ? '↺ Reabrir' : '✔ Atendido') + '</span><span class="btn"' + act('mail', m.id + '|pin') + '>' + (st.pin ? '📌 Fijado' : '📌 Fijar') + '</span><span class="btn"' + act('mail', m.id + '|janus') + '>' + (st.janus ? '🤖 Delegado' : '🤖 Delegar a Janus') + '</span></div><div class="note mono">Vista previa: las acciones se guardan solo en este dispositivo; no envían correos.</div>');
  const F = X.follow;
  const fol = panel('', '🎯', 'Lo que dije que haría', F.filter((f) => !f.done).length + ' abiertos', '<div class="fls">' + F.map((f) => '<div class="fl2' + (f.id === UI.fSel ? ' on' : '') + (f.done ? ' past' : '') + '">' + ring(f.done ? 100 : f.p, f.done ? '#5FD39A' : '#E8C37A', f.done ? '✔' : f.p + '%', 40) + '<div class="tx"><b>' + esc(f.x) + '</b><div class="stp">' + (f.steps || []).map((s2, i) => '<span class="' + ((i + 1) / (f.steps.length) * 100 <= f.p || f.done ? 'ok' : '') + '">' + esc(s2) + '</span>').join('') + '</div></div><span class="due mono' + (f.due === 'hoy' && !f.done ? ' hot' : '') + '">' + f.due + '</span><span class="mini mono"' + act('fp', f.id + '|-10', 'Menos') + '>−</span><span class="mini mono"' + act('fp', f.id + '|10', 'Más') + '>＋</span><span class="chk' + (f.done ? ' ok' : '') + '"' + act('fdone', f.id, 'Hecho') + '>✔</span></div>').join('') + '</div><div class="addf"><input type="text" placeholder="Nuevo compromiso" maxlength="40" data-f="fT"><select data-f="fD"><option>hoy</option><option>mañ</option><option>vie</option><option>lun</option></select><span class="btn"' + act('fAdd') + '>＋</span></div>');
  const sv = [3, 2, 1].map((k) => [['', '🔵 Baja', '🟠 Media', '🔴 Alta'][k], DATA.mails.filter((x) => x.sev === k && !(ST.mail[x.id] || {}).done).length, ['', '#86B6FF', '#FFB454', '#FF6B5E'][k]]);
  const stats = panel('', '📊', 'Bandeja', 'abiertos por prioridad', hbars(sv, Math.max(1, ...sv.map((x) => x[1])), (v) => v) + '<div class="kv">' + [['⏳', 'Más antiguo', '3 d · Hosting'], ['🤖', 'Delegados a Janus', DATA.mails.filter((x) => (ST.mail[x.id] || {}).janus).length], ['📌', 'Fijados', DATA.mails.filter((x) => (ST.mail[x.id] || {}).pin).length]].map((r) => '<div class="kvr"><span class="bb s">' + r[0] + '</span><span>' + r[1] + '</span><b class="mono">' + r[2] + '</b></div>').join('') + '</div>');
  return frame('prioridades', sub, M, '<div class="col3">' + list + stats + '</div><div class="col3">' + rd + fol + '</div>');
}

/* ---------- JANUS ---------- */
function vJanus(M, X, sub) {
  const J = DATA.janus;
  const log = panel(sub === 'log' ? 'hl' : '', '✅', 'CI de janus-core', REAL.ciOk + '/' + REAL.ci.length + ' en verde', '<div class="lg2">' + REAL.ci.map((l) => '<div class="li2"><span class="mono dim">' + l[0].slice(5) + '</span><span class="bb s">🧪</span><span>' + esc(l[1]) + '</span><b class="mono okc">✔</b></div>').join('') + '</div><div class="note mono">Real · GitHub Actions · sincronizado ' + REAL.syncedAt.replace('T', ' ') + '</div>');
  const ap = panel(sub === 'aprob' ? 'hl' : '', '🔐', 'Aprobaciones', X.apprOpen.length + ' pendientes · ejemplo', J.appr.map((a) => { const v = ST.appr[a.id]; return '<div class="apc"><span class="bb m">' + a.e + '</span><div><b>' + a.t + '</b><div class="dim mono">' + a.d + '</div></div>' + (v ? pill(v === 'ok' ? '✔ aprobada' : '✕ rechazada', v === 'ok' ? 'g' : 'r') + '<span class="mini mono"' + act('appr', a.id + '|', 'Deshacer') + '>↺</span>' : '<span class="btn"' + act('appr', a.id + '|ok') + '>✔</span><span class="btn r"' + act('appr', a.id + '|no') + '>✕</span>') + '</div>'; }).join('') + '<div class="note mono">Vista previa: aprobar aquí no ejecuta acciones reales.</div>');
  const pr = panel(sub === 'prs' ? 'hl' : '', '🧩', 'Pull requests abiertos', REAL.prs.length + ' · ' + REAL.prs.filter((p) => p[2]).length + ' borradores', '<div class="lg2">' + REAL.prs.map((p) => '<a class="li2 lnk" href="https://github.com/jeanechandia-png/janus-core/pull/' + p[0] + '" target="_blank" rel="noopener"><b class="mono">#' + p[0] + '</b><span>' + esc(p[1]) + '</span>' + pill(p[2] ? 'borrador' : 'listo', p[2] ? '' : 'g') + '</a>').join('') + '</div><div class="note mono">Real · GitHub · toca para abrir el PR</div>');
  const ig = panel('', '🔌', 'Integraciones', 'verificado hoy: GitHub y Calendar', '<div class="igr">' + J.integ.map((i) => { const st = { GitHub: ['conectado', 'g'], 'Google Workspace': ['Calendar ✔ · Gmail ✕', ''] }[i[0]] || ['por confirmar', '']; return '<div class="igc"><span class="bb s">' + i[1] + '</span><span>' + i[0] + '</span>' + pill(st[0], st[1]) + '</div>'; }).join('') + '</div>');
  const sec = panel('', '🛡', 'Seguridad y memoria', '', '<div class="kv">' + [['💾', 'Memoria', 'SQLite local'], ['☁', 'Respaldo', 'Drive (sync)'], ['🔐', 'Secretos', 'fuera de código'], ['✋', 'Acciones externas', 'requieren aprobación'], ['📜', 'Auditoría', 'activa']].map((r) => '<div class="kvr"><span class="bb s">' + r[0] + '</span><span>' + r[1] + '</span><b class="mono">' + r[2] + '</b></div>').join('') + '</div>');
  const ag = panel('', '🐝', 'Agentes', 'esfuerzo AUTO · ejemplo', [['🧭', 'Orquestador', 'activo', 'g'], ['🔎', 'Investigador', 'en espera', ''], ['💻', 'Programador', 'PR #42', ''], ['✅', 'Verificador', 'pruebas OK', 'g'], ['📝', 'Documentador', 'handoff listo', '']].map((a) => '<div class="li2"><span class="bb s">' + a[0] + '</span><span>' + a[1] + '</span>' + pill(a[2], a[3]) + '</div>').join(''));
  return frame('janus', sub, M, '<div class="col3">' + log + ag + '</div><div class="col3">' + pr + ap + '</div><div class="col3">' + ig + sec + '</div>');
}

/* ---------- INGRESOS ---------- */
function vIngresos(M, X, sub) {
  if (sub && DATA.sources.find((s) => s.id === sub)) UI.iSel = sub;
  const S = DATA.sources, n = UI.iPer, from = 12 - n, goal = ST.settings.goal;
  const best = S[X.last.indexOf(Math.max(...X.last))];
  const kp = '<div class="kp2">' + [['💶', 'Últimas 4 semanas', '€' + fmt(X.total)], ['📈', 'vs 4 anteriores', (X.revDelta >= 0 ? '▲ ' : '▼ ') + X.revDelta + '%'], ['🏆', 'Mejor fuente', best.e + ' ' + best.n.split(' · ')[0]], ['📅', 'Media semanal', '€' + fmt(X.total / 4)]].map((k) => '<div class="kpi"><div class="top"><span class="bb s">' + k[0] + '</span><span class="k mono">' + k[1] + '</span></div><div class="v serif gld">' + k[2] + '</div></div>').join('') +
    '<div class="kpi goal">' + ring(Math.round(X.total / goal * 100), '#5FD39A', Math.round(X.total / goal * 100) + '%', 54) + '<div><span class="k mono">META MENSUAL</span><label class="mono">€ <input type="number" min="500" step="250" value="' + goal + '" data-set="goal"></label></div></div></div>';
  const wt = []; for (let w = from; w < 12; w++) wt.push(S.reduce((a, s) => a + s.w[w], 0));
  const wm = Math.max(...wt);
  const cols = '<div class="scol">' + wt.map((t, k) => { const w = from + k; return '<div class="sc" data-ro="' + esc('Semana ' + (w - 11 <= 0 ? w - 11 : '') + ' · €' + fmt(t) + ' · ' + S.map((s) => s.e + ' ' + s.w[w]).join(' ')) + '"><div class="stk2c" style="height:' + Math.round(t / wm * 86) + '%">' + (() => { const seg2 = S.map((s) => '<i style="height:' + (s.w[w] / t * 100).toFixed(1) + '%;background:' + s.c + ';opacity:' + (!UI.iSel || UI.iSel === s.id ? 1 : .25) + '"></i>').join(''); return seg2 + '<span class="sd3">' + seg2 + '</span><span class="cap3" style="background:' + S[S.length - 1].c + '"></span>'; })() + '</div><small class="mono">' + (w === 11 ? 'esta' : 'S' + (w - 11)) + '</small></div>'; }).join('') + '</div>';
  const ch = panel('', '📊', 'Por semana y fuente', seg('iPer', n, [[4, '4 sem'], [8, '8 sem'], [12, '12 sem']]), roBox() + cols);
  let acc = 0; const cg = S.map((s, i) => { const a0 = acc; acc += X.last[i] / X.total * 360; return s.c + ' ' + a0 + 'deg ' + acc + 'deg'; }).join(',');
  const dn = panel('', '🥧', 'Reparto', '4 semanas', '<div class="dn2"><div class="donut big" style="background:conic-gradient(from -90deg,' + cg + ')"><b class="serif">€' + fmt(X.total) + '</b></div><div class="lgd2">' + S.map((s, i) => '<div class="' + (UI.iSel === s.id ? 'on' : '') + '"' + act('iSel', s.id, s.n) + '><i style="background:' + s.c + '"></i>' + s.e + ' ' + esc(s.n) + '<b class="mono">' + Math.round(X.last[i] / X.total * 100) + '%</b></div>').join('') + '</div></div>');
  const tb = panel('', '🧾', 'Fuentes', 'toca para resaltar', '<div class="tbl"><div class="th2 mono"><span>Fuente</span><span>4 sem</span><span>Anterior</span><span>Δ</span><span>Tendencia</span></div>' + S.map((s, i) => { const d = Math.round((X.last[i] / X.prev[i] - 1) * 100); return '<div class="tr' + (UI.iSel === s.id ? ' on' : '') + '"' + act('iSel', s.id, s.n) + '><span>' + s.e + ' ' + esc(s.n) + '</span><b class="mono">€' + fmt(X.last[i]) + '</b><span class="mono dim">€' + fmt(X.prev[i]) + '</span><span class="mono ' + (d >= 0 ? 'okc' : 'badc') + '">' + (d >= 0 ? '▲' : '▼') + Math.abs(d) + '%</span><svg viewBox="0 0 100 22" preserveAspectRatio="none"><path d="' + spk(s.w, 100, 22) + '" fill="none" stroke="' + s.c + '" stroke-width="1.8" vector-effect="non-scaling-stroke"/></svg></div>'; }).join('') + '</div>');
  const nt = panel('', '⚖', 'Nota', '', '<div class="dim">Infinity Seed Group aún no está registrada. Estas cifras son de ejemplo y se sustituirán por ventas reales cuando la empresa esté registrada y conectada (Stripe, Gumroad, facturación).</div>');
  return frame('ingresos', sub, M, kp + ch + dn + tb + nt);
}

/* ---------- ALCANCE ---------- */
function vAlcance(M, X, sub) {
  const n = UI.aPer, vals = DATA.reach90.slice(90 - n), sum = vals.reduce((a, b) => a + b, 0);
  const best = vals.indexOf(Math.max(...vals)), lab = (i) => { const o = fromDayNum(M.today - (n - 1 - i)); return o.d + ' ' + MO[o.m - 1]; };
  const kp = '<div class="kp2">' + [['👁', 'Alcance ' + n + ' d', fmt(sum * 1000)], ['📈', 'Media diaria', fmt(sum / n * 1000)], ['🏆', 'Mejor día', lab(best) + ' · ' + dec(vals[best]) + 'K'], ['➕', 'Seguidores nuevos', '+' + fmt(DATA.followers.now - DATA.followers.wk[Math.max(0, 8 - Math.ceil(n / 7) - 1)])], ['❤', 'Interacción', '6,8%']].map((k) => '<div class="kpi"><div class="top"><span class="bb s">' + k[0] + '</span><span class="k mono">' + k[1] + '</span></div><div class="v serif gld">' + k[2] + '</div></div>').join('') + '</div>';
  const step = Math.max(1, Math.floor(n / 5));
  const xl = []; for (let i = 0; i < n; i += step) xl.push(lab(i)); xl.push(lab(n - 1));
  const ch = panel('', '📈', 'Alcance diario', seg('aPer', n, [[7, '7 d'], [30, '30 d'], [90, '90 d']]), roBox() + lineChart({ series: [{ vals, c: '#FFE9B0', fill: true, w: 2.4 }], yf: (v) => dec(v, 0) + 'K', ro: (i) => lab(i) + ' · ' + fmt(vals[i] * 1000), xl: xl.slice(0, 7) }));
  const pl = panel('', '📱', 'Por plataforma', '', hbars(DATA.platforms.map((p, i) => [p[0], p[1], ['#E8C37A', '#86B6FF', '#5FD39A'][i]]), 100, (v) => v + '%'));
  const au = panel('', '👥', 'Audiencia', 'edad · ciudad', '<div class="two">' + hbars(DATA.ages.map((a) => [a[0], a[1]]), 40, (v) => v + '%') + hbars(DATA.cities.map((c) => [c[0], c[1], '#86B6FF']), 35, (v) => v + '%') + '</div>');
  const dd = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const hm = panel('', '🕐', 'Mejores horas para publicar', '08–20 h', '<div class="hm">' + DATA.heat.map((r, d) => '<span class="mono dim">' + dd[d] + '</span>' + r.map((v, h) => '<i style="background:rgba(232,195,122,' + (v / 100).toFixed(2) + ')" data-ro="' + dd[d] + ' ' + (8 + h) + ':00 · ' + v + '"></i>').join('')).join('') + '<span></span>' + Array.from({ length: 12 }, (_, h) => '<span class="mono dim">' + (h % 3 === 0 ? 8 + h : '') + '</span>').join('') + '</div>' + roBox('☝ toca una celda'));
  return frame('alcance', sub, M, kp + ch + pl + au + hm);
}

/* ---------- CHATBOTS ---------- */
function vChatbots(M, X, sub) {
  if (sub) UI.bSel = sub;
  const col = (b) => {
    const pend = b.upd.filter((u) => !u.done && !ST.upd[u.id]).length;
    const k = [['💬', 'Conversaciones 7 d', b.c], ['⏱', 'Disponibilidad', b.upT + '%'], ['⚡', 'Respuesta', b.resp], ['★', 'Satisfacción', b.csat], ['🙋', 'A humano', b.hand]];
    return panel('bcol' + (UI.bSel === b.id ? ' hl' : ''), '🤖', esc(b.n), '<span class="led"></span> activo',
      '<div class="kp3">' + k.map((x) => '<div><span class="bb s">' + x[0] + '</span><b class="serif">' + x[2] + '</b><span class="mono dim">' + x[1] + '</span></div>').join('') + '</div>' +
      '<div class="sb mono">Conversaciones · 30 días</div>' + roBox() + lineChart({ series: [{ vals: b.d30, c: '#86B6FF', fill: true }], ro: (i) => { const o = fromDayNum(M.today - 29 + i); return o.d + ' ' + MO[o.m - 1] + ' · ' + Math.round(b.d30[i]) + ' conv.'; } }) +
      '<div class="two"><div><div class="sb mono">Temas más consultados</div>' + hbars(b.intents, 50, (v) => v + '%') + '</div><div><div class="sb mono">Actualizaciones · ' + pend + ' pendientes</div>' + b.upd.map((u) => { const ok = u.done || ST.upd[u.id]; return '<div class="cl2' + (ok ? ' ok' : '') + '"' + (u.done ? '' : act('upd', u.id, u.t)) + '><span class="chk' + (ok ? ' ok' : '') + '">✔</span><span>' + esc(u.t) + '</span></div>'; }).join('') + '</div></div>');
  };
  return frame('chatbots', sub, M, DATA.bots.map(col).join(''));
}

/* ---------- CONTENIDO ---------- */
function vContenido(M, X, sub) {
  if (sub && DATA.reels.find((r) => r.id === sub)) UI.cSel = sub;
  const er = (r) => (r.likes + r.com + r.sh + r.sv) / (r.views * 1000) * 100;
  const L2 = DATA.reels.slice().sort((a, b) => UI.cSort === 'eur' ? b.eur - a.eur : UI.cSort === 'er' ? er(b) - er(a) : b.views - a.views);
  const grads = ['#8a5a14', '#1d4f9c', '#7a2b1f', '#2d5a3c', '#4a2d6b', '#1d3d4f'];
  const list = panel('', '🎬', 'Reels', 'Meta', seg('cSort', UI.cSort, [['views', '👁 Vistas'], ['eur', '€ Ingresos'], ['er', '❤ Interacción']]) + '<div class="rls">' + L2.map((r) => '<div class="rl' + (r.id === UI.cSel ? ' on' : '') + '"' + act('cSel', r.id, r.t) + '><div class="th" style="background:linear-gradient(165deg,#111,' + grads[DATA.reels.indexOf(r)] + ')">▶</div><div class="mid"><b>' + esc(r.t) + '</b><div class="mono dim">' + r.dur + ' s · ❤ ' + dec(er(r)) + '%</div></div><div class="mono r2"><b>' + r.vtxt + '</b><br><span class="okc">€' + r.eur + '</span></div></div>').join('') + '</div>');
  const r = DATA.reels.find((x) => x.id === UI.cSel);
  const kp = '<div class="kp2">' + [['👁', 'Vistas', fmt(r.views * 1000)], ['📡', 'Alcance', fmt(r.reach)], ['❤', 'Me gusta', fmt(r.likes)], ['💬', 'Comentarios', fmt(r.com)], ['↗', 'Compartidos', fmt(r.sh)], ['🔖', 'Guardados', fmt(r.sv)], ['💶', 'Ingresos', '€' + r.eur]].map((k) => '<div class="kpi"><div class="top"><span class="bb s">' + k[0] + '</span><span class="k mono">' + k[1] + '</span></div><div class="v serif gld">' + k[2] + '</div></div>').join('') + '</div>';
  const vmax = Math.max(...r.v7);
  const v7 = panel('', '📊', 'Vistas por día', 'primeros 7 días', roBox() + '<div class="scol">' + r.v7.map((v, i) => '<div class="sc" data-ro="Día ' + (i + 1) + ' · ' + fmt(v) + ' vistas"><div class="stk2c" style="height:' + Math.round(v / vmax * 86) + '%"><i style="height:100%;background:linear-gradient(180deg,#FFE9B0,#A8741F)"></i></div><small class="mono">D' + (i + 1) + '</small></div>').join('') + '</div>');
  const rt = panel('', '⏳', 'Retención', 'duración ' + r.dur + ' s', roBox() + lineChart({ series: [{ vals: r.ret, c: '#86B6FF', fill: true }], max: 100, min: 0, yf: (v) => Math.round(v) + '%', ro: (i) => Math.round(r.dur * i / 10) + ' s · ' + r.ret[i] + '% sigue viendo', xl: ['0 s', Math.round(r.dur / 2) + ' s', r.dur + ' s'] }));
  const F = DATA.followers;
  const src = panel('', '🧭', 'Origen de vistas', '', hbars([['Explorar/Reels', r.src[0], '#E8C37A'], ['Seguidores', r.src[1], '#86B6FF'], ['Perfil', r.src[2], '#5FD39A'], ['Otros', 100 - r.src[0] - r.src[1] - r.src[2], '#8a836f']], 70, (v) => v + '%'));
  const mon = panel('', '🏁', 'Camino a monetizar', 'seguidores', '<div class="dn2">' + ring(Math.round(F.now / F.goal * 100), '#E8C37A', Math.round(F.now / F.goal * 100) + '%', 70) + '<div><b class="serif big2">' + fmt(F.now) + '</b><div class="mono dim">meta ' + fmt(F.goal) + ' · faltan ' + fmt(F.goal - F.now) + '</div><svg class="spk2" viewBox="0 0 100 26" preserveAspectRatio="none"><path d="' + spk(F.wk, 100, 26) + '" fill="none" stroke="#E8C37A" stroke-width="2" vector-effect="non-scaling-stroke"/></svg><div class="mono dim">8 semanas</div></div></div>');
  return frame('contenido', sub, M, list + '<div class="cright">' + kp + '<div class="two2">' + v7 + rt + '</div><div class="two2">' + src + mon + '</div></div>');
}

/* ---------- CLIENTES ---------- */
function vClientes(M, X, sub) {
  if (sub === 'leads' || sub === 'embudo') UI.clCat = 'leads';
  const F = DATA.funnel, C = DATA.mailCats;
  const fn = panel(sub === 'embudo' ? 'hl' : '', '🔻', 'Embudo comercial', '30 días', '<div class="fun2">' + F.map((f, i) => '<div class="fs" style="width:' + (100 - i * 22) + '%"><span class="bb s">' + f.e + '</span><b class="serif">' + f.n + '</b><span class="mono">' + f.t + '</span></div>' + (i < F.length - 1 ? '<div class="fcv mono">▼ ' + Math.round(F[i + 1].n / f.n * 100) + '%</div>' : '')).join('') + '</div><div class="mono dim c">Conversión total ' + Math.round(F[2].n / F[0].n * 100) + '%</div><div class="sb mono">Días por etapa</div>' + hbars([['📥 → 📅', 4], ['📅 → ✅', 9], ['✅ → 💶', 6]], 10, (v) => v + ' d'));
  const cat = C.find((c) => c.id === UI.clCat) || C[0];
  const ls = panel(sub === 'correo' ? 'hl' : '', '✉', 'Correo de empresa', C.reduce((a, c) => a + c.items.length, 0) + ' nuevos', seg('clCat', cat.id, C.map((c) => [c.id, c.e + ' ' + c.n + ' ' + c.items.length])) + '<div class="mls">' + cat.items.map((it, i) => '<div class="ml2' + (i === UI.clSel ? ' on' : '') + '"' + act('clSel', i, it[0]) + '><span class="bb s">' + cat.e + '</span><div class="mid"><div class="who">' + esc(it[0]) + '</div><div class="sj">' + esc(it[1]) + '</div></div>' + pill(esc(it[2])) + '</div>').join('') + '</div>');
  const it = cat.items[clamp(UI.clSel, 0, cat.items.length - 1)];
  const dt = panel('', '🔎', 'Detalle', cat.n, '<div class="rdh"><span class="bb m">' + cat.e + '</span><div><b class="serif big2">' + esc(it[0]) + '</b><div class="mono dim">Origen: ' + esc(it[1]) + '</div></div></div><div class="sumb"><span class="bb s">➡</span><div><b>Siguiente paso</b><div>' + esc(it[2]) + '</div></div></div><div class="sb mono">Historial</div>' + [['📩', 'Primer contacto', it[1]], ['🤖', 'Respuesta automática', 'enviada'], ['⏭', 'Próximo', it[2]]].map((r) => '<div class="li2"><span class="bb s">' + r[0] + '</span><span>' + r[1] + '</span><b class="mono">' + esc(r[2]) + '</b></div>').join('') + '<div class="btns"><span class="btn"' + act('evDone', 'lead:' + cat.id + clamp(UI.clSel, 0, cat.items.length - 1)) + '>' + (ST.done['lead:' + cat.id + clamp(UI.clSel, 0, cat.items.length - 1)] ? '✔ Contactado' : '☎ Marcar contactado') + '</span></div><div class="note mono">Ejemplo ilustrativo. Se llenará con el correo real de la empresa.</div>');
  const nc = panel('', '🆕', 'Clientes nuevos', DATA.newClients.length, DATA.newClients.map((c) => '<div class="li2"><span class="bb s">🤝</span><span>' + esc(c[0]) + '</span><b class="mono">' + c[1] + ' · ' + c[2] + '</b></div>').join(''));
  return frame('clientes', sub, M, fn + ls + '<div class="col3">' + dt + nc + '</div>');
}

/* ---------- DATOS ---------- */
function vDatos(M) {
  const s = ST.settings, wxs = s.mode !== 'vivo' ? 'Ejemplo (elegido)' : WX.status === 'ok' ? '● En vivo' : WX.status === 'loading' ? 'Cargando…' : 'Sin conexión → ejemplo';
  const rows = [['🚴', 'Clima y bici', 'Open-Meteo (pública, sin clave)', wxs], ['🗓', 'Mi día', 'Google Calendar (principal)', '● Real · ' + REAL.syncedAt.slice(11)], ['🌟', '__HIJA__', 'Calendario «Familia»', 'Conectado · 0 eventos → ejemplo'], ['✉', 'Correos y clientes', 'Gmail', 'Reconectar Gmail → ejemplo'], ['🎯', 'Seguimiento', 'JANUS Core (SQLite)', 'Ejemplo · local'], ['⚙', 'Janus', 'janus-core / GitHub', '● Real · CI + PR'], ['💶', 'Ingresos', 'Stripe · Gumroad', 'Ejemplo · empresa sin registrar'], ['👁', 'Alcance y Reels', 'Meta (Instagram/Facebook)', 'Ejemplo · por conectar'], ['🤖', 'Chatbots', 'IBA · ChatBox', 'Ejemplo · por conectar']];
  const st = panel('', '🧭', 'Estado de datos', 'Protocolo de la Verdad', '<div class="tbl dt2"><div class="th2 mono"><span>Módulo</span><span>Fuente prevista</span><span>Estado</span></div>' + rows.map((r) => '<div class="tr"><span>' + r[0] + ' ' + r[1] + '</span><span class="dim">' + r[2] + '</span>' + pill(r[3], /En vivo|Real/.test(r[3]) ? 'g' : /Sin conexión|Reconectar/.test(r[3]) ? 'r' : '') + '</div>').join('') + '</div><div class="note mono">EJEMPLO = dato ficticio para evaluar el diseño. EN VIVO = dato real obtenido ahora.</div>');
  const geo = UI.geo.map((g, i) => '<div class="li2"' + act('geoPick', i, g.name) + '><span class="bb s">📍</span><span>' + esc(g.name) + '</span><b class="mono">' + esc([g.admin, g.country].filter(Boolean).join(', ')) + '</b></div>').join('');
  const loc = panel('', '📍', 'Clima: modo y ubicación', '', seg('mode', s.mode, [['vivo', '● En vivo'], ['ejemplo', 'Ejemplo 07:45']]) +
    '<div class="kv"><div class="kvr"><span class="bb s">📍</span><span>Ubicación</span><b class="mono">' + esc(s.place) + ' (' + esc(s.placeSrc) + ')</b></div><div class="kvr"><span class="bb s">🌐</span><span>Coordenadas</span><b class="mono">' + s.lat + ', ' + s.lon + '</b></div>' + (WX.err ? '<div class="kvr"><span class="bb s">⚠</span><span>Último error</span><b class="mono">' + esc(WX.err) + '</b></div>' : '') + '</div>' +
    '<div class="addf"><input type="text" placeholder="Buscar ciudad (p. ej. Huissen)" maxlength="40" data-f="geoQ"><span class="btn"' + act('geoSearch') + '>🔎</span><span class="btn"' + act('geoMe') + '>📍 Mi ubicación</span><span class="btn"' + act('wxReload') + '>↻</span></div>' + (UI.geoMsg ? '<div class="note mono">' + esc(UI.geoMsg) + '</div>' : '') + '<div class="mls">' + geo + '</div>');
  const misc = panel('', '💾', 'Este dispositivo', storeOk ? 'guardado activo' : 'sin almacenamiento', '<div class="dim">Tus marcas (hechos, checklist, umbrales, metas, eventos rápidos) se guardan solo en este navegador. En la versión final vivirán en JANUS Core (SQLite) y se sincronizarán.</div><div class="btns"><span class="btn r"' + act('reset') + '>↺ Restablecer vista previa</span></div><div class="sb mono">Atajos</div><div class="dim">Esc o ← vuelve al dashboard · ↗ abre la pestaña en una ventana nueva · las zonas se iluminan al tocarlas.</div>');
  return frame('datos', '', M, st + '<div class="col3">' + loc + misc + '</div>');
}
const VIEWS = { clima: vClima, dia: vDia, familia: vFamilia, prioridades: vPrioridades, janus: vJanus, ingresos: vIngresos, alcance: vAlcance, chatbots: vChatbots, contenido: vContenido, clientes: vClientes, datos: vDatos };
