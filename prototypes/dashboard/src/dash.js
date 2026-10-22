'use strict';
/* ===== Cálculos derivados compartidos ===== */
function derived(M) {
  const S = DATA.sources, sum = (a) => a.reduce((x, y) => x + y, 0);
  const last = S.map((s) => sum(s.w.slice(8))), prev = S.map((s) => sum(s.w.slice(4, 8)));
  const total = sum(last), ptotal = sum(prev);
  const r30 = sum(DATA.reach30) * 1000, rprev = sum(DATA.reach90.slice(30, 60)) * 1000;
  const pct = (a, b) => Math.round((a / b - 1) * 100);
  const nowDn = M.today;
  const realDay = (dn) => REAL.ev.filter((e) => { const p = e.d.split('-').map(Number); return dayNum(p[0], p[1], p[2]) === dn; }).map((e, i) => Object.assign({}, e, { id: 'r' + e.d + i, where: 'Google Calendar' }));
  const leave = DATA.agenda.filter((a) => a.auto === 'leave');
  const agenda = realDay(nowDn).concat(leave).map((a) => {
    if (a.auto === 'leave') { if (M.suggest == null) return null; return Object.assign({}, a, { h: minToHm(M.suggest), t: 'Salir (' + M.leaveWhy + ')' }); }
    return a;
  }).filter(Boolean).concat(ST.localEv.filter((x) => x.day === 0)).map((a) => Object.assign({}, a, { m: hmToMin(a.h) }));
  const order = { p: 0, f: 0, e: 1 };
  agenda.sort((a, b) => (order[a.amb] - order[b.amb]) || (a.m - b.m));
  const nextId = (agenda.filter((a) => a.amb !== 'e' && a.m + (a.dur || 30) > M.nowMin && !ST.done[a.id])[0] || {}).id;
  const kweek = [];
  for (let i = 0; i < 7; i++) {
    const o = fromDayNum(nowDn + i), it = (DATA.familia.pattern[o.wd] || []).slice();
    DATA.familia.dated.forEach((x) => { if (dayNum(x.y, x.m, x.d) === nowDn + i) it.push(x.e); });
    kweek.push({ dn: nowDn + i, l: WDL[o.wd], n: o.d, it });
  }
  const citas = DATA.familia.dated.map((x) => Object.assign({}, x, { dn: dayNum(x.y, x.m, x.d), days: dayNum(x.y, x.m, x.d) - nowDn })).filter((x) => x.days >= 0).sort((a, b) => a.days - b.days);
  const follow = DATA.follow.concat(ST.newFollow).map((f) => { const st = ST.follow[f.id] || {}; return Object.assign({}, f, { p: st.p != null ? st.p : f.p, done: !!st.done }); });
  const mailsOpen = DATA.mails.filter((m) => !(ST.mail[m.id] || {}).done);
  const apprOpen = DATA.janus.appr.filter((a) => !ST.appr[a.id]);
  const agendaTomorrow = realDay(nowDn + 1).map((a) => Object.assign({}, a, { m: hmToMin(a.h) }));
  return { agendaTomorrow, total, ptotal, last, prev, revDelta: pct(total, ptotal), r30, reachDelta: pct(r30, rprev), agenda, nextId, kweek, citas, follow, mailsOpen, apprOpen };
}

/* ===== Piezas ===== */
const goAttr = (r, label) => ' data-go="' + esc(r) + '" role="link" tabindex="0" aria-label="' + esc(label || r) + '"';
const spk = (arr, w, h) => { const mx = Math.max(...arr), mn = Math.min(...arr, 0); return smooth(arr.map((v, i) => [i * (w / (arr.length - 1)), h - 2 - ((v - mn) / (mx - mn || 1)) * (h - 5)])); };
function compassSvg(nowDir, retDir) {
  let ticks = '';
  for (let a = 0; a < 360; a += 5) { const len = a % 90 === 0 ? 16 : a % 45 === 0 ? 12 : a % 15 === 0 ? 8 : 4; const p1 = polc(110, 110, a, 94), p2 = polc(110, 110, a, 94 - len); ticks += 'M' + f1(p1[0]) + ' ' + f1(p1[1]) + ' L' + f1(p2[0]) + ' ' + f1(p2[1]) + ' '; }
  const to = (nowDir + 180) % 360;
  const needle = [polc(110, 110, to, 62), polc(110, 110, to - 150, 24), polc(110, 110, to + 180, 9), polc(110, 110, to + 150, 24)].map((p) => f1(p[0]) + ',' + f1(p[1])).join(' ');
  const m1 = polc(110, 110, nowDir, 103), m2 = polc(110, 110, retDir, 103);
  return '<svg viewBox="0 0 220 220" aria-hidden="true"><defs><linearGradient id="bez" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE9B0"/><stop offset=".5" stop-color="#B8862F"/><stop offset="1" stop-color="#4E3308"/></linearGradient><radialGradient id="face" cx=".5" cy=".38" r=".75"><stop offset="0" stop-color="#23222a"/><stop offset="1" stop-color="#07070a"/></radialGradient><linearGradient id="nd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E3F0FF"/><stop offset="1" stop-color="#2F7BFF"/></linearGradient><filter id="gl"><feGaussianBlur stdDeviation="3.2"/></filter></defs>' +
    '<circle cx="110" cy="110" r="107" fill="url(#bez)"/><circle cx="110" cy="110" r="99" fill="url(#face)"/><path d="' + ticks + '" stroke="rgba(232,195,122,.6)" stroke-width="1.6" fill="none"/>' +
    '<text x="110" y="52" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="15" fill="#FFE9B0">N</text><text x="170" y="116" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="14" fill="#ABA392">E</text><text x="110" y="178" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="14" fill="#ABA392">S</text><text x="50" y="116" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="14" fill="#ABA392">O</text>' +
    '<polygon points="' + needle + '" fill="#2F7BFF" opacity=".55" filter="url(#gl)"/><polygon points="' + needle + '" fill="url(#nd)" stroke="#E3F0FF" stroke-width=".8"/><circle cx="110" cy="110" r="7" fill="#E8C37A"/><circle cx="107.5" cy="107.5" r="2.5" fill="#FFF3D1"/>' +
    '<circle cx="' + f1(m1[0]) + '" cy="' + f1(m1[1]) + '" r="6" fill="#5FD39A"/><circle cx="' + f1(m2[0]) + '" cy="' + f1(m2[1]) + '" r="6" fill="#FFB454"/></svg>';
}
const orb = (v, txt) => '<span class="orb ' + (v === 'g' ? 'g' : v === 'r' ? 'r' : 'a') + ' mono"><i>' + (v === 'g' ? '✔' : v === 'r' ? '✕' : '!') + '</i>' + txt + '</span>';
const srcBadge = (live) => '<span class="src ' + (live ? 'live' : 'ex') + ' mono">' + (live ? '● EN VIVO' : 'EJEMPLO') + '</span>';

/* ===== Dashboard (pantalla única) ===== */
function renderDash(M, X) {
  const s = ST.settings, live = M.src === 'vivo';
  const side = (tag, d, route) => '<div class="sd go"' + goAttr(route, tag) + '><span class="tg mono">' + tag + '</span><div class="bg"><img class="wi" src="' + wxImg(d.k) + '" alt=""><span class="tp serif gld">' + d.t + '°</span></div><div class="fc mono"><span class="ft1">🌡 ' + d.feel + '°</span><span class="ft1">' + arrowSvg(d.d) + ' ' + d.w + '<small>km/h</small></span><span class="ft1">💧 ' + d.r + '%</span></div></div>';
  const hours = M.strip.map((c, i) => { const lv = hourRisk(c.e).lv; return '<div class="hc go' + (i === 0 ? ' now' : '') + (lv === 2 ? ' hot' : lv === 1 ? ' mild' : '') + '"' + goAttr('clima/h' + c.idx, c.label) + '><span class="h mono">' + c.label + '</span><img src="' + wxImg(c.e.k) + '" alt=""><span class="t serif">' + c.e.t + '°</span><span class="rr"><span class="tube"><i style="height:' + Math.max(10, c.e.r) + '%"></i></span><span class="p mono">' + c.e.r + '</span></span><span class="w mono">' + arrowSvg(c.e.d) + c.e.w + '</span></div>'; }).join('');
  const kit4 = M.kit.slice(0, 4).map((k) => '<span class="bb m go' + (k.on ? '' : ' off') + '"' + goAttr('clima/kit', k.n + (k.on ? ' sí' : ' no')) + ' title="' + esc(k.n) + '">' + k.e + '</span>').join('');
  const clima = '<section class="cd"><div class="lb mono go"' + goAttr('clima', 'Clima') + '><span class="bb">🚴</span>Clima · Bici ' + srcBadge(live) + '<span class="mt">📍 ' + esc(M.place) + '</span></div>' +
    '<div class="wxr">' + side('AHORA · ' + M.nowLabel, M.nowE, 'clima/now') + '<div class="md go"' + goAttr('clima/viento', 'Viento') + '><div class="dw">' + compassSvg(M.nowE.d, M.retE.d) + '</div><div class="wn mono">' + M.nowE.w + ' <span style="color:#B2AA99">→</span> ' + M.retE.w + '<small>km/h</small></div></div>' + side(M.retLabel, M.retE, 'clima/vuelta') + '</div>' +
    '<div class="hrs">' + hours + '</div><div class="ftr"><div class="gear">' + kit4 + '</div>' +
    '<span class="go"' + goAttr('clima/ida', 'Ida') + '>' + orb(M.ida.verdict, 'IDA') + '</span><span class="go"' + goAttr('clima/vuelta', 'Vuelta') + '>' + orb(M.vuelta.verdict, 'VUELTA') + '</span>' +
    (M.suggest != null ? '<span class="orb t mono go"' + goAttr('clima/vuelta', 'Salida sugerida') + '>⏱ ' + minToHm(M.suggest) + '</span>' : '<span class="orb t mono go"' + goAttr('clima', 'Sin avisos') + '>✔ libre</span>') + '</div></section>';

  const ag = X.agenda;
  const evRow = (e) => '<div class="ev go' + (e.id === X.nextId ? ' nw' : '') + (ST.done[e.id] || e.m + (e.dur || 30) <= M.nowMin ? ' past' : '') + ' amb-' + e.amb + '"' + goAttr('dia/' + e.id, e.t) + '><span class="tm mono">' + e.h + '</span><span class="bb s">' + e.e + '</span><span class="tx">' + esc(e.t) + '</span></div>';
  const pers = ag.filter((e) => e.amb !== 'e'), emp = ag.filter((e) => e.amb === 'e');
  const dia = '<section class="cd"><div class="lb mono go"' + goAttr('dia', 'Mi día') + '><span class="bb">🗓</span>Mi día <span class="src live mono">● REAL</span><span class="mt">🏠 ' + pers.length + ' · 🏢 ' + emp.length + '</span></div><div class="evs">' + pers.map(evRow).join('') + '<div class="sep mono">🏢 empresa</div>' + emp.map(evRow).join('') + (ag.length < 6 ? '<div class="sep mono" style="color:#B2AA99;border-color:rgba(255,255,255,.1)">mañana</div>' + X.agendaTomorrow.slice(0, 6 - ag.length).map((e) => '<div class="ev go amb-' + e.amb + '"' + goAttr('dia', e.t) + '><span class="tm mono">' + e.h + '</span><span class="bb s">' + e.e + '</span><span class="tx">' + esc(e.t) + '</span></div>').join('') : '') + '</div></section>';

  const today = X.kweek[0], K = DATA.familia.items;
  const kt = today.it.filter((e) => K[e]).slice(0, 2).map((e) => '<div class="kt go"' + goAttr('familia/hoy', K[e].t) + '><span class="tm mono">' + K[e].h + '</span><span class="bb s">' + e + '</span><span class="tx">' + K[e].t + '</span><small class="mono">→ ' + K[e].to + '</small></div>').join('') || '<div class="kt go"' + goAttr('familia', 'Libre') + '><span class="bb s">🌿</span><span class="tx">Día libre</span></div>';
  const lleva = DATA.familia.lleva.slice(0, 3).map((l) => '<span class="bb s go' + (ST.lleva[l.id] ? ' ok' : '') + '"' + goAttr('familia/lleva', l.t) + '>' + l.e + '</span>').join('');
  const cita = X.citas[0];
  const familia = '<section class="cd kd"><div class="lb mono go"' + goAttr('familia', '__HIJA__') + '><span class="bb">🌟</span>__HIJA__<span class="gear2">' + lleva + '</span></div><div>' + kt + '</div>' +
    '<div><div class="wk">' + X.kweek.map((d, i) => '<div class="dy go' + (i === 0 ? ' td' : '') + '"' + goAttr('familia/d' + i, d.l + ' ' + d.n) + '><span class="l mono">' + d.l + '</span><span class="n serif">' + d.n + '</span><span>' + d.it.join('') + '</span></div>').join('') + '</div>' +
    (cita ? '<div class="cnt go"' + goAttr('familia/citas', 'Cita') + '><span class="bb s">' + cita.e + '</span><b class="serif">' + cita.days + '</b><span class="mono">días · ' + dateMid(cita.dn) + ' · ' + K[cita.e].h + '</span></div>' : '') + '</div></section>';

  const mails = DATA.mails.map((m) => { const st = ST.mail[m.id] || {}; return '<div class="ml go' + (st.done ? ' past' : '') + '"' + goAttr('prioridades/' + m.id, m.who) + '><span class="av mono">' + m.ini + '</span><div class="mid"><div class="who">' + esc(m.who) + '</div><div class="sj">' + esc(m.sj) + '</div></div><span class="age mono">' + (st.done ? '✔' : m.age) + '</span><span class="sig s' + m.sev + '"><i></i><i></i><i></i></span></div>'; }).join('');
  const fol = X.follow.slice(0, 4).map((f) => '<div class="fu go' + (f.done ? ' past' : '') + '"' + goAttr('prioridades/' + f.id, f.x) + '><span class="rg" style="background:conic-gradient(#E8C37A ' + (f.done ? 360 : f.p * 3.6) + 'deg,rgba(255,255,255,.09) 0)"><span class="mono">' + (f.done ? '✔' : f.p + '%') + '</span></span><span class="tx">' + esc(f.x) + '</span><span class="due mono' + (f.due === 'hoy' && !f.done ? ' hot' : '') + '">' + f.due + '</span></div>').join('');
  const pri = '<section class="cd"><div class="lb mono go"' + goAttr('prioridades', 'Prioridades') + '><span class="bb">🎯</span>Prioridades<span class="mt">correo · seguimiento</span></div>' + mails + '<div class="sb mono" style="margin-top:7px">Lo que dije que haría</div>' + fol + '</section>';
  const jv = [['✅', REAL.ci.filter((c) => c[0].startsWith('2026-10-21')).length, 'janus/log'], ['🔐', X.apprOpen.length, 'janus/aprob'], ['🧩', REAL.prs.length, 'janus/prs']];
  // Proyectos (sustituye a la tarjeta Janus; Janus sigue accesible desde su contador CI · PR).
  const pjs = PROJECTS.filter((p) => p.grp !== 'proximo').slice(0, 3);
  const jan = '<section class="cd"><div class="lb mono go"' + goAttr('trabajo', 'Sala de trabajo') + '><span class="bb">📁</span>Proyectos<span class="mt go"' + goAttr('janus', 'Janus') + '>⚙ CI ' + REAL.ci.filter((c) => c[0].startsWith('2026-10-21')).length + ' · PR ' + REAL.prs.length + '</span></div><div class="pjrow">' + pjs.map((p) => '<div class="pjp go ' + p.grp + '"' + goAttr('trabajo/' + p.id, p.n) + '><span class="bb s">' + p.e + '</span><span class="t">' + esc(p.s || p.n) + '</span><i></i></div>').join('') + '</div></section>';

  const kpv = [{ v: '€' + fmt(X.total), d: X.revDelta + '%', s: [3, 3.4, 3.2, 3.8, 3.9, 4.1, 4.0, 4.3, 4.4, 4.5, 4.6, 4.65] }, { v: Math.round(X.r30 / 1000) + 'K', d: X.reachDelta + '%', s: DATA.reach30.filter((_, i) => i % 3 === 0).concat([17.2, 16.4]).slice(0, 12) }];
  const kp = '<div class="kp">' + DATA.kpis.map((k, i) => { const v = kpv[i] || k; return '<div class="kpi go"' + goAttr(k.go, k.k) + '><div class="top"><span class="bb s">' + k.e + '</span><span class="k mono">' + k.k + '</span></div><div class="v serif gld">' + v.v + '</div><span class="dl mono">▲ ' + v.d + '</span><svg viewBox="0 0 100 20" preserveAspectRatio="none"><path d="' + spk(v.s, 100, 20) + '" fill="none" stroke="#E8C37A" stroke-width="1.8" vector-effect="non-scaling-stroke"/></svg></div>'; }).join('') + '</div>';

  const S = DATA.sources, mx = Math.max(...X.last);
  const wtot = [8, 9, 10, 11].map((w) => S.reduce((a, s2) => a + s2.w[w], 0)), wmax = Math.max(...wtot);
  const revenue = '<section class="cd"><div class="lb mono go"' + goAttr('ingresos', 'Ingresos') + '><span class="bb">💶</span>Ingresos<span class="mt">▲ ' + X.revDelta + '% · 30 d</span></div><div class="rbs">' + S.map((s2, i) => '<div class="rb go"' + goAttr('ingresos/' + s2.id, s2.n) + '><div class="rt"><span><i class="sdot" style="background:' + s2.c + '"></i>' + s2.e + ' ' + esc(s2.n.split(' · ')[0]) + '</span><b class="mono">€' + fmt(X.last[i]) + '</b></div><div class="rtk"><div class="rfl" style="width:' + Math.round(X.last[i] / mx * 100) + '%;background:' + s2.c + '"></div></div></div>').join('') + '</div>' +
    '<div class="wkly go"' + goAttr('ingresos', 'Semanas') + '>' + [0, 1, 2, 3].map((w) => '<div class="wcol"><div class="wst" style="height:' + Math.round(wtot[w] / wmax * 72) + '%">' + S.map((s2) => '<i style="height:' + (s2.w[8 + w] / wtot[w] * 100).toFixed(1) + '%;background:' + s2.c + '"></i>').join('') + '</div><small class="mono">S' + (w + 1) + '</small></div>').join('') + '</div></section>';

  const rv = DATA.reach30, pts = rv.map((v, i) => [i * (600 / (rv.length - 1)), 200 - (v / 20) * 200 * 0.94 - 6]);
  const line = smooth(pts), last = pts[pts.length - 1];
  const xl = [29, 22, 15, 8, 0].map((k) => { const o = fromDayNum(M.today - k); return o.d + ' ' + MO[o.m - 1]; });
  const reach = '<section class="cd go"' + goAttr('alcance', 'Alcance') + '><div class="lb mono"><span class="bb">👁</span>Alcance diario<span class="mt">' + Math.round(X.r30 / 1000) + 'K · ▲ ' + X.reachDelta + '%</span></div><div class="cbx"><div class="yax mono"><span>20K</span><span>15K</span><span>10K</span><span>5K</span><span>0</span></div><div class="plot"><svg viewBox="0 0 600 200" preserveAspectRatio="none"><defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E8C37A" stop-opacity=".5"/><stop offset="1" stop-color="#E8C37A" stop-opacity="0"/></linearGradient><filter id="gb" x="-5%" y="-30%" width="110%" height="160%"><feGaussianBlur stdDeviation="6"/></filter></defs><path d="M0 .5 L600 .5 M0 50 L600 50 M0 100 L600 100 M0 150 L600 150 M0 199.5 L600 199.5" stroke="rgba(255,255,255,.08)" fill="none" vector-effect="non-scaling-stroke"/><path d="' + line + ' L600 200 L0 200 Z" fill="url(#ga)"/><path d="' + line + '" fill="none" stroke="#E8C37A" stroke-width="6" opacity=".45" filter="url(#gb)" vector-effect="non-scaling-stroke"/><path d="' + line + '" fill="none" stroke="#FFE9B0" stroke-width="2.2" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg><span class="dot" style="left:100%;top:' + (last[1] / 200 * 100).toFixed(1) + '%"></span></div></div><div class="xax mono">' + xl.map((x) => '<span>' + x + '</span>').join('') + '</div></section>';

  const bots = '<section class="cd"><div class="lb mono go"' + goAttr('chatbots', 'Chatbots') + '><span class="bb">🤖</span>Chatbots<span class="mt">en vivo</span></div>' + DATA.bots.map((b) => { const pend = b.upd.filter((u) => !u.done && !ST.upd[u.id]).length; return '<div class="bot go"' + goAttr('chatbots/' + b.id, b.n) + '><div class="bh"><span class="led"></span><span class="nm">' + esc(b.n) + '</span></div><div class="bb2"><span class="cv serif">' + b.c + '</span><span style="font-size:11px">💬</span><span class="pill mono' + (pend ? ' w' : '') + '">' + (pend ? '⏳ ' + pend + ' act.' : b.u.startsWith('★') ? b.u : '✔ al día') + '</span></div><div class="sp3"><span class="age mono">⏱ ' + b.upT + '%</span><svg viewBox="0 0 100 22" preserveAspectRatio="none"><path d="' + spk(b.days, 100, 22) + '" fill="none" stroke="#86B6FF" stroke-width="1.8" vector-effect="non-scaling-stroke"/></svg></div></div>'; }).join('') + '</section>';

  const grads = ['linear-gradient(165deg,#1a1206,#8a5a14 58%,#E8C37A)', 'linear-gradient(165deg,#07162e,#1d4f9c 58%,#86B6FF)', 'linear-gradient(165deg,#1a0a0a,#7a2b1f 58%,#FFB454)'];
  const tops = '<section class="cd"><div class="lb mono go"' + goAttr('contenido', 'Contenido') + '><span class="bb">🎬</span>Contenido<span class="mt">top 3</span></div>' + DATA.reels.slice(0, 3).map((t, i) => '<div class="tc go"' + goAttr('contenido/' + t.id, t.t) + '><div class="th" style="background:' + grads[i] + '">▶</div><div class="mid"><div class="tt">' + esc(t.t) + '</div><div class="mr"><span class="vbar"><i style="width:' + Math.round(t.views / 48 * 100) + '%"></i></span><b class="mono">' + t.vtxt + '</b><small class="mono">€' + t.eur + '</small></div></div></div>').join('') + '</section>';

  const C = DATA.mailCats, ctot = C.reduce((a, c) => a + c.items.length, 0);
  let acc = 0; const cg = C.map((c) => { const a0 = acc; acc += c.items.length / ctot * 360; return c.c + ' ' + a0 + 'deg ' + acc + 'deg'; }).join(',');
  const F = DATA.funnel;
  const cli = '<section class="cd"><div class="lb mono go"' + goAttr('clientes', 'Clientes') + '><span class="bb">🤝</span>Clientes<span class="mt">✉ ' + ctot + '</span></div><div class="dn go"' + goAttr('clientes/correo', 'Correo empresa') + '><div class="donut" style="background:conic-gradient(from -90deg,' + cg + ')"><b class="serif">' + ctot + '</b></div><div class="lg mono">' + C.map((c) => '<span><i style="background:' + c.c + '"></i>' + c.e + ' ' + c.items.length + '</span>').join('') + '</div></div><div class="fns">' + F.map((f, i) => '<div class="fn go"' + goAttr('clientes/embudo', f.t) + '><span class="bb s">' + f.e + '</span><div class="fb mono" style="width:' + Math.max(24, Math.round(f.n / F[0].n * 78)) + '%">' + f.n + '</div>' + (i ? '<small class="mono" style="color:var(--mute);font-size:9px">▼' + Math.round(f.n / F[i - 1].n * 100) + '%</small>' : '') + '</div>').join('') + '</div></section>';

  const rainChip = M.rainAt ? '<span class="chip warn go"' + goAttr('clima/h' + (M.rainAt.day * 24 + M.rainAt.h), 'Lluvia') + '>☔ <b>' + pad2(M.rainAt.h) + ':00</b></span>' : '<span class="chip good go"' + goAttr('clima', 'Sin lluvia') + '>☀ <b>seco</b></span>';
  const flags = DATA.mails.filter((m) => m.sev === 3 && !(ST.mail[m.id] || {}).done).length;
  return '<header class="hd"><img class="medal go" src="' + IMG.medal + '" alt="Janus"' + goAttr('datos', 'Estado de datos') + '><div><div class="wm" data-jg="JANUS">JANUS</div><div class="dt mono">' + M.dateLabel + ' · ' + M.nowLabel + '</div></div>' +
    '<div class="chips mono"><span class="chip ' + (M.ida.verdict === 'g' ? 'good' : M.ida.verdict === 'r' ? 'bad' : 'warn') + ' go"' + goAttr('clima/ida', 'Ida') + '>🚴 ' + (M.ida.verdict === 'g' ? '✔' : '!') + ' <b>IDA</b></span>' + rainChip + '<span class="chip go"' + goAttr('prioridades', 'Correos') + '>✉ <b>' + X.mailsOpen.length + '</b></span><span class="chip go"' + goAttr('janus/aprob', 'Aprobaciones') + '>🔐 <b>' + X.apprOpen.length + '</b></span><span class="chip' + (flags ? ' bad' : '') + ' go"' + goAttr('prioridades/m0', 'Alertas') + '>⚑ <b>' + flags + '</b></span></div>' +
    '<div class="demo mono go"' + goAttr('datos', 'Estado de datos') + '>' + (live ? '● Clima en vivo · resto ejemplo' : 'Vista previa · datos de ejemplo') + '</div></header>' +
    '<main class="mn"><section class="L">' + clima + '<div class="low"><div class="stk">' + dia + familia + '</div><div class="stk2">' + pri + jan + '</div></div></section><section class="R">' + kp + '<div class="duo">' + revenue + reach + '</div><div class="tri">' + bots + tops + cli + '</div></section></main>';
}
