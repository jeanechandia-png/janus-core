'use strict';
// Diseño B · Platino — tres franjas horizontales (Clima · Vida · Empresa), cristal claro. Una sola pantalla.
const fs = require('fs');
const L = require('./lib-static.cjs');
const { D, esc, fmt, f1, smooth, polc, arrowSvg } = L;

const css = `
.b{--ink:#0E1A33;--mute:#5E6E8A;--sap:#2F6BFF;--em:#12B886;--am:#F59F00;--vi:#7C5CFF;--pk:#EE4D95;--rd:#E5484D;
color:var(--ink);font-family:'Manrope',system-ui,-apple-system,'Helvetica Neue',sans-serif;font-size:12px;line-height:1.25;padding:12px;display:grid;grid-template-rows:auto 1.08fr 1fr 1.1fr;gap:10px;
background:radial-gradient(800px 460px at 0% 0%,rgba(47,107,255,.22),transparent 62%),radial-gradient(640px 440px at 100% 8%,rgba(124,92,255,.17),transparent 62%),radial-gradient(760px 460px at 62% 112%,rgba(18,184,134,.16),transparent 62%),radial-gradient(500px 300px at 8% 100%,rgba(238,77,149,.10),transparent 62%),#E7ECF5}
.b b{font-weight:700}
.mono{font-family:'DM Mono',ui-monospace,'SF Mono',Menlo,monospace}
.sora{font-family:'Sora','Manrope',system-ui,-apple-system,sans-serif}
.hd{display:flex;align-items:center;gap:14px;padding:6px 14px;border-radius:18px;background:linear-gradient(160deg,rgba(255,255,255,.9),rgba(255,255,255,.55));border:1px solid #fff;box-shadow:inset 0 1px 0 #fff,0 18px 32px -22px rgba(30,50,110,.4)}
.medal{width:34px;height:34px;border-radius:50%;object-fit:cover;box-shadow:0 0 0 2px #fff,0 6px 16px -4px rgba(47,107,255,.55)}
.wm{font-size:17px;font-weight:700;letter-spacing:.26em;background:linear-gradient(90deg,#2F6BFF,#7C5CFF 60%,#EE4D95);-webkit-background-clip:text;background-clip:text;color:transparent}
.dt{font-size:9.5px;letter-spacing:.14em;color:var(--mute)}
.chips{display:flex;gap:7px;flex:1;justify-content:center}
.chip{display:inline-flex;align-items:center;gap:5px;padding:4px 11px;border-radius:999px;background:rgba(255,255,255,.8);border:1px solid #fff;font-size:11.5px;box-shadow:0 6px 12px -8px rgba(30,50,110,.45),inset 0 -2px 3px rgba(30,50,110,.06)}
.chip.good{color:#0A8F66;background:rgba(18,184,134,.14)}.chip.warn{color:#B76E00;background:rgba(245,159,0,.16)}.chip.bad{color:#C2272D;background:rgba(229,72,77,.14)}
.demo{font-size:8.5px;letter-spacing:.13em;text-transform:uppercase;color:var(--sap);border:1px dashed rgba(47,107,255,.55);border-radius:999px;padding:5px 10px;white-space:nowrap}
.cd{position:relative;min-width:0;min-height:0;overflow:hidden;border-radius:20px;padding:10px 12px;background:linear-gradient(160deg,rgba(255,255,255,.88),rgba(255,255,255,.52));border:1px solid #fff;box-shadow:inset 0 1px 0 #fff,inset 0 -1px 0 rgba(30,50,110,.05),0 22px 38px -24px rgba(30,50,110,.45),0 2px 5px rgba(30,50,110,.06);display:flex;flex-direction:column}
.lb{display:flex;align-items:center;gap:7px;margin-bottom:6px;font-size:9.5px;letter-spacing:.17em;text-transform:uppercase;color:var(--mute);flex:none;font-weight:500}
.lb .mt{margin-left:auto;letter-spacing:.04em;text-transform:none}
.bb{flex:none;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font-size:12px;line-height:1;background:radial-gradient(circle at 32% 24%,#fff,#EAF0FB 55%,#C9D6EE);box-shadow:inset 0 -3px 5px rgba(30,50,110,.14),0 6px 10px -5px rgba(30,50,110,.5),0 0 0 1px rgba(255,255,255,.9)}
.bb.s{width:21px;height:21px;font-size:10.5px}.bb.m{width:28px;height:28px;font-size:14px}
.bb.sap{background:radial-gradient(circle at 32% 24%,#D6E4FF,#5A8CFF 62%,#2556D6)}.bb.em{background:radial-gradient(circle at 32% 24%,#CFF7E8,#2FCB9C 62%,#0B9468)}.bb.vi{background:radial-gradient(circle at 32% 24%,#E3DBFF,#8F76FF 62%,#5A3FD6)}.bb.pk{background:radial-gradient(circle at 32% 24%,#FFD6E8,#F46AA8 62%,#C42A74)}.bb.am{background:radial-gradient(circle at 32% 24%,#FFE9BF,#FFB62E 62%,#C77D00)}
/* BAND 1 */
.wg{display:grid;grid-template-columns:186px 150px 186px 1fr 124px;gap:10px;flex:1;min-height:0}
.sd{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-width:0}
.tg{font-size:9px;letter-spacing:.18em;padding:3px 9px;border-radius:999px;color:#fff;background:linear-gradient(180deg,#5A8CFF,#2F6BFF);box-shadow:0 5px 9px -4px rgba(47,107,255,.7)}
.tg.t{background:linear-gradient(180deg,#8F76FF,#5A3FD6);box-shadow:0 5px 9px -4px rgba(124,92,255,.7)}
.bg{display:flex;align-items:center;gap:3px}
.wi{width:56px;height:56px;filter:drop-shadow(0 10px 8px rgba(30,50,110,.35))}
.tp{font-size:44px;font-weight:700;line-height:1;letter-spacing:-.03em}
.fc{display:flex;gap:4px}
.ft1{display:inline-flex;align-items:center;gap:3px;padding:4px 7px;border-radius:10px;background:rgba(255,255,255,.85);font-size:11.5px;box-shadow:inset 0 -2px 3px rgba(30,50,110,.07),0 5px 9px -6px rgba(30,50,110,.4)}
.ft1 small{font-size:8px;color:var(--mute)}
.ar{width:11px;height:11px;fill:var(--sap);flex:none}
.gz{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}
.gz svg{width:136px;height:136px;filter:drop-shadow(0 12px 10px rgba(30,50,110,.3))}
.gz .gl{display:flex;gap:6px;font-size:10px;align-items:center;color:var(--mute)}
.gz .gl b{color:var(--ink);font-size:12px}
.hr8{display:flex;gap:5px;min-width:0;min-height:0}
.hh{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:3px;padding:5px 1px 5px;border-radius:14px;background:linear-gradient(180deg,rgba(255,255,255,.85),rgba(228,236,250,.6));box-shadow:inset 0 1px 0 #fff,0 8px 14px -10px rgba(30,50,110,.5)}
.hh.now{box-shadow:inset 0 1px 0 #fff,0 0 0 2px var(--sap),0 10px 16px -8px rgba(47,107,255,.6)}
.hh.hot{background:linear-gradient(180deg,rgba(214,228,255,.95),rgba(143,170,235,.5))}
.hh .h{font-size:9px;color:var(--mute)}
.hh img{width:24px;height:24px;filter:drop-shadow(0 5px 4px rgba(30,50,110,.35))}
.hh .t{font-size:14px;font-weight:700}
.tb{flex:1;min-height:30px;width:13px;border-radius:9px;background:linear-gradient(90deg,rgba(30,50,110,.14),rgba(255,255,255,.7) 45%,rgba(30,50,110,.1));box-shadow:inset 0 2px 4px rgba(30,50,110,.28);display:flex;align-items:flex-end;padding:1.5px;overflow:hidden}
.tb i{display:block;width:100%;border-radius:7px;background:linear-gradient(90deg,#2556D6,#8FB3FF 40%,#2F6BFF);box-shadow:inset 0 2px 3px rgba(255,255,255,.55)}
.hh.hot .tb i{background:linear-gradient(90deg,#4B2FC4,#A596FF 40%,#7C5CFF)}
.hh .p{font-size:10px;color:var(--sap);font-weight:500}
.hh .w{display:flex;align-items:center;gap:2px;font-size:9.5px}.hh .w .ar{width:9px;height:9px}
.vd{display:flex;flex-direction:column;justify-content:space-between;gap:6px}
.kit{display:flex;gap:4px;justify-content:space-between}
.orb{display:flex;align-items:center;gap:7px;padding:4px 12px 4px 4px;border-radius:999px;font-size:11px;letter-spacing:.1em;font-weight:700;box-shadow:0 8px 14px -8px currentColor,inset 0 -2px 4px rgba(0,0,0,.08)}
.orb i{font-style:normal;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font-size:12px;color:#fff;box-shadow:inset 0 -3px 5px rgba(0,0,0,.2),inset 0 2px 3px rgba(255,255,255,.6)}
.orb.g{color:#0A8F66;background:rgba(18,184,134,.14)}.orb.g i{background:radial-gradient(circle at 35% 28%,#B8F5DE,#12B886 65%,#0A8F66)}
.orb.a{color:#B76E00;background:rgba(245,159,0,.17)}.orb.a i{background:radial-gradient(circle at 35% 28%,#FFE2A8,#F59F00 65%,#B76E00)}
.orb.t{justify-content:center;padding:6px 12px;color:var(--ink);background:rgba(255,255,255,.85);letter-spacing:.06em}
/* BAND 2 */
.b2{display:grid;grid-template-columns:238px 270px 1.1fr 220px 130px;gap:10px;min-height:0}
.tl{position:relative;display:flex;flex-direction:column;flex:1;min-height:0;padding-left:2px}
.tl::before{content:"";position:absolute;left:12px;top:10px;bottom:10px;width:2px;border-radius:2px;background:linear-gradient(180deg,#5A8CFF,#8F76FF 60%,#F46AA8);opacity:.45}
.ev{position:relative;display:flex;align-items:center;gap:7px;flex:1 1 auto;min-height:21px;padding:0 3px 0 0;border-radius:11px}
.ev .bb.s{width:20px;height:20px;font-size:10px;margin-left:1px}
.ev .tm{width:33px;flex:none;font-size:10px;color:var(--mute)}
.ev .tx{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px;font-weight:500}
.ev.nw{background:linear-gradient(90deg,rgba(47,107,255,.14),transparent)}
.ev.nw .tm{color:var(--sap);font-weight:700}
.kd{justify-content:space-between}
.kt{display:flex;align-items:center;gap:7px;padding:4px 9px 4px 5px;border-radius:13px;background:rgba(255,255,255,.78);box-shadow:inset 0 -2px 3px rgba(30,50,110,.06),0 6px 10px -8px rgba(30,50,110,.45);margin-bottom:5px}
.kt .tm{font-size:11px;color:var(--mute);width:34px}
.kt .tx{flex:1;font-size:12px;font-weight:600}
.kt small{font-size:9.5px;color:var(--mute)}
.gear2{display:flex;gap:4px;margin-left:auto}
.sb{font-size:8.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--mute);margin:3px 0 3px}
.wk{display:flex;gap:3px}
.dy{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:1px;padding:3px 0;border-radius:10px;background:rgba(255,255,255,.7);font-size:9px;line-height:1.1;min-height:42px;box-shadow:inset 0 -2px 3px rgba(30,50,110,.05)}
.dy .l{font-size:8px;color:var(--mute)}.dy .n{font-size:13px;font-weight:700}
.dy.td{background:linear-gradient(180deg,#5A8CFF,#2F6BFF);color:#fff;box-shadow:0 8px 12px -6px rgba(47,107,255,.7)}.dy.td .l{color:#D6E4FF}
.cnt{display:flex;align-items:center;gap:8px;margin-top:5px;padding:4px 10px 4px 5px;border-radius:13px;background:rgba(229,72,77,.11);flex:none}
.cnt b{font-size:19px;color:var(--rd);line-height:1}.cnt span{font-size:10.5px}
.ml{display:flex;align-items:center;gap:8px;flex:1;min-height:0;border-bottom:1px solid rgba(30,50,110,.07)}
.ml:last-child{border-bottom:0}
.av{flex:none;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-size:9.5px;font-weight:700;color:#fff;box-shadow:inset 0 -3px 5px rgba(0,0,0,.2),inset 0 2px 3px rgba(255,255,255,.5),0 6px 10px -5px rgba(30,50,110,.55)}
.ml .mid{flex:1;min-width:0}.ml .who{font-weight:700;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ml .sj{font-size:10.5px;color:var(--mute);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.age{font-size:9.5px;color:var(--mute)}
.sev{width:11px;height:11px;border-radius:50%;flex:none;box-shadow:inset 0 -2px 3px rgba(0,0,0,.2),0 0 0 3px rgba(255,255,255,.7)}
.s3{background:radial-gradient(circle at 35% 30%,#FFC1C3,#E5484D 65%)}.s2{background:radial-gradient(circle at 35% 30%,#FFE2A8,#F59F00 65%)}.s1{background:radial-gradient(circle at 35% 30%,#D6E4FF,#2F6BFF 65%)}
.rgs{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:6px;flex:1;min-height:0}
.rc{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-width:0}
.rg{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;position:relative;filter:drop-shadow(0 6px 6px rgba(30,50,110,.28))}
.rg::after{content:"";position:absolute;inset:5.5px;border-radius:50%;background:radial-gradient(circle at 35% 25%,#fff,#E6EDFA);box-shadow:inset 0 2px 4px rgba(30,50,110,.2)}
.rg span{position:relative;z-index:1;font-size:10px;font-weight:700}
.rc .tx{font-size:9.5px;max-width:100%;text-align:center;line-height:1.1;font-weight:600;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.due{font-size:9px;padding:1px 7px;border-radius:999px;background:rgba(255,255,255,.85);color:var(--mute)}
.due.hot{background:rgba(229,72,77,.14);color:var(--rd)}
.jv{display:flex;flex-direction:column;justify-content:space-around;flex:1;min-height:0;gap:6px}
.jp{display:flex;align-items:center;gap:8px;padding:5px 11px 5px 5px;border-radius:999px;background:rgba(255,255,255,.8);box-shadow:inset 0 -2px 3px rgba(30,50,110,.06),0 6px 10px -8px rgba(30,50,110,.45)}
.jp b{margin-left:auto;font-size:19px}
/* BAND 3 */
.b3{display:grid;grid-template-columns:150px 1.15fr 1.4fr .95fr 1fr .8fr;gap:10px;min-height:0}
.kl{display:flex;flex-direction:column;justify-content:space-between;flex:1;min-height:0;gap:2px}
.kr{display:flex;align-items:center;gap:6px;flex:1;min-height:0}
.kr .vv{flex:1;min-width:0;line-height:1.05}
.kr .vv b{font-size:15px;display:block}
.kr .vv small{font-size:9px;color:var(--em);font-weight:600}
.kr svg{width:34px;height:18px;flex:none}
.rvw{display:flex;gap:8px;flex:1;min-height:0}
.cols{display:flex;gap:6px;align-items:flex-end;flex:1.3;min-width:0}
.cl{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;height:100%;justify-content:flex-end}
.stk{width:100%;max-width:30px;display:flex;flex-direction:column-reverse;border-radius:9px;overflow:hidden;box-shadow:inset 0 2px 3px rgba(255,255,255,.5),0 8px 12px -6px rgba(30,50,110,.5);background:rgba(30,50,110,.1)}
.stk i{display:block;width:100%;box-shadow:inset 0 1px 0 rgba(255,255,255,.55)}
.cl small{font-size:8px;color:var(--mute)}
.lg{display:flex;flex-direction:column;justify-content:space-around;flex:1;min-width:0}
.lg div{display:flex;align-items:center;gap:4px;font-size:10.5px;white-space:nowrap}
.lg i{width:8px;height:8px;border-radius:50%;flex:none}.lg b{margin-left:auto;font-size:11px}
.cbx{display:flex;gap:6px;flex:1;min-height:0}
.yax{display:flex;flex-direction:column;justify-content:space-between;font-size:8.5px;color:var(--mute);text-align:right;width:22px}
.plot{position:relative;flex:1;min-width:0}.plot svg{position:absolute;inset:0;width:100%;height:100%}
.dot{position:absolute;width:11px;height:11px;margin:-5.5px 0 0 -5.5px;border-radius:50%;background:#fff;border:3px solid #2F6BFF;box-shadow:0 0 0 4px rgba(47,107,255,.2),0 4px 8px rgba(47,107,255,.5)}
.xax{display:flex;justify-content:space-between;margin:4px 0 0 28px;font-size:8.5px;color:var(--mute);flex:none}
.bot{display:flex;flex-direction:column;justify-content:center;flex:1;min-height:0;padding:5px 8px;border-radius:14px;background:rgba(255,255,255,.75);margin-bottom:5px;box-shadow:inset 0 -2px 3px rgba(30,50,110,.05),0 6px 10px -8px rgba(30,50,110,.45)}
.bot:last-of-type{margin-bottom:0}
.bot .bh{display:flex;align-items:center;gap:6px}
.led{width:9px;height:9px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#B8F5DE,#12B886 65%);flex:none;box-shadow:0 0 0 3px rgba(18,184,134,.2)}
.bot .nm{font-weight:700;font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bot .bb2{display:flex;align-items:center;gap:6px;margin-top:2px}
.bot .cv{font-size:20px;font-weight:700;line-height:1}
.pill{margin-left:auto;font-size:9.5px;padding:2px 7px;border-radius:999px;background:rgba(47,107,255,.12);color:var(--sap);white-space:nowrap;font-weight:600}
.pill.w{background:rgba(245,159,0,.18);color:#B76E00}
.sp3{display:flex;align-items:center;gap:6px;margin-top:2px}.sp3 svg{flex:1;height:16px;min-width:0}
.tc{display:flex;align-items:center;gap:8px;flex:1;min-height:0}
.th{flex:none;width:30px;height:40px;border-radius:10px;display:grid;place-items:center;color:#fff;font-size:10px;box-shadow:0 8px 12px -6px rgba(30,50,110,.6),inset 0 2px 0 rgba(255,255,255,.4)}
.tc .tt{font-size:10.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tc .mid{flex:1;min-width:0}
.tc .mr{display:flex;align-items:center;gap:6px;margin-top:5px}
.vbar{flex:1;min-width:14px;height:6px;border-radius:4px;background:rgba(30,50,110,.12);box-shadow:inset 0 1px 2px rgba(30,50,110,.25)}
.vbar i{display:block;height:100%;border-radius:4px;background:linear-gradient(90deg,#2F6BFF,#7C5CFF)}
.tc .mr b{font-size:12px}.tc .mr small{font-size:9.5px;color:var(--em);font-weight:600}
.dn{display:flex;gap:8px;align-items:center;flex:none}
.donut{flex:none;width:54px;height:54px;border-radius:50%;display:grid;place-items:center;position:relative;filter:drop-shadow(0 8px 8px rgba(30,50,110,.3))}
.donut::after{content:"";position:absolute;inset:9px;border-radius:50%;background:radial-gradient(circle at 35% 25%,#fff,#E6EDFA);box-shadow:inset 0 2px 4px rgba(30,50,110,.2)}
.donut b{position:relative;z-index:1;font-size:17px}
.lgd{display:flex;flex-direction:column;gap:3px;font-size:11px}.lgd span{display:flex;align-items:center;gap:5px}.lgd i{width:8px;height:8px;border-radius:50%;display:inline-block}
.fns{display:flex;flex-direction:column;justify-content:space-around;flex:1;min-height:0;margin-top:5px}
.fn{display:flex;align-items:center;gap:6px}
.fn .fb{height:17px;border-radius:9px;color:#fff;display:flex;align-items:center;justify-content:flex-end;padding-right:7px;font-size:10px;font-weight:700;box-shadow:inset 0 2px 3px rgba(255,255,255,.45),0 6px 10px -6px rgba(30,50,110,.55)}
`;

(async () => {
  const IM = await L.loadImages();
  const icon = (k) => IM[k];
  const now = D.now, tarde = D.tarde;
  const arc = (cx, cy, r, a0, a1) => { const p0 = polc(cx, cy, a0, r), p1 = polc(cx, cy, a1, r); return 'M' + f1(p0[0]) + ' ' + f1(p0[1]) + ' A' + r + ' ' + r + ' 0 ' + (a1 - a0 > 180 ? 1 : 0) + ' 1 ' + f1(p1[0]) + ' ' + f1(p1[1]); };
  const ang = (x) => -135 + Math.min(x, 40) / 40 * 270;

  // Reloj de viento 0–40 km/h
  let tk = '';
  for (let v = 0; v <= 40; v += 5) { const p1 = polc(80, 80, ang(v), 66), p2 = polc(80, 80, ang(v), v % 10 === 0 ? 72 : 69); tk += 'M' + f1(p1[0]) + ' ' + f1(p1[1]) + ' L' + f1(p2[0]) + ' ' + f1(p2[1]) + ' '; }
  const nd = polc(80, 80, ang(now.w), 46), tm = polc(80, 80, ang(tarde.w), 58), gm = polc(80, 80, ang(tarde.g), 58);
  const l0 = polc(80, 80, ang(0), 62), l40 = polc(80, 80, ang(40), 62);
  const gauge = `<svg viewBox="0 0 160 160" aria-hidden="true"><defs><radialGradient id="gf" cx=".5" cy=".28" r=".95"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#D3DEF2"/></radialGradient><linearGradient id="rm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#AFC0E0"/><stop offset="1" stop-color="#fff"/></linearGradient></defs>
<circle cx="80" cy="80" r="78" fill="url(#rm)"/><circle cx="80" cy="80" r="74" fill="url(#gf)"/>
<path d="${arc(80, 80, 58, ang(0), ang(40))}" stroke="rgba(30,50,110,.1)" stroke-width="11" fill="none" stroke-linecap="round"/>
<path d="${arc(80, 80, 58, ang(0.5), ang(20))}" stroke="#12B886" stroke-width="9" fill="none"/>
<path d="${arc(80, 80, 58, ang(20), ang(30))}" stroke="#F59F00" stroke-width="9" fill="none"/>
<path d="${arc(80, 80, 58, ang(30), ang(39.5))}" stroke="#E5484D" stroke-width="9" fill="none"/>
<path d="${tk}" stroke="#7B8BA8" stroke-width="1.4" fill="none"/>
<text x="${f1(l0[0] - 3)}" y="${f1(l0[1] + 14)}" font-family="DM Mono, monospace" font-size="9" fill="#5E6E8A">0</text><text x="${f1(l40[0] - 9)}" y="${f1(l40[1] + 14)}" font-family="DM Mono, monospace" font-size="9" fill="#5E6E8A">40</text>
<circle cx="${f1(gm[0])}" cy="${f1(gm[1])}" r="4.2" fill="#E5484D" stroke="#fff" stroke-width="1.8"/>
<circle cx="${f1(tm[0])}" cy="${f1(tm[1])}" r="6.2" fill="#fff" stroke="#7C5CFF" stroke-width="3"/>
<line x1="80" y1="80" x2="${f1(nd[0])}" y2="${f1(nd[1])}" stroke="#0E1A33" stroke-width="3.6" stroke-linecap="round"/><circle cx="80" cy="80" r="7.5" fill="#0E1A33"/><circle cx="78" cy="78" r="2.4" fill="#fff"/>
<text x="80" y="112" text-anchor="middle" font-family="DM Mono, monospace" font-size="9" fill="#5E6E8A">km/h</text></svg>`;

  const side = (cls, tag, d, img) => `<div class="sd"><span class="tg ${cls} mono">${tag}</span><div class="bg"><img class="wi" src="${img}" alt=""><span class="tp sora">${d.t}°</span></div>
<div class="fc mono"><span class="ft1">🌡 ${d.feel}°</span><span class="ft1">${arrowSvg(d.d)} ${d.w}<small>km/h</small></span><span class="ft1">💧 ${d.r}%</span></div></div>`;

  const hours = D.wxRaw.map((x, i) => `<div class="hh${i === 0 ? ' now' : ''}${x.r >= 50 ? ' hot' : ''}"><span class="h mono">${x.h}</span><img src="${icon(x.k)}" alt=""><span class="t sora">${x.t}°</span><span class="tb"><i style="height:${Math.max(8, x.r)}%"></i></span><span class="p mono">${x.r}%</span><span class="w mono">${arrowSvg(x.d)}${x.w}</span></div>`).join('');

  const clima = `<section class="cd"><div class="lb mono"><span class="bb sap">🚴</span>Clima · Bici<span class="mt">📍 tu ubicación</span></div>
<div class="wg">${side('', 'AHORA · 07:45', now, icon('part'))}
<div class="gz">${gauge}<div class="gl mono"><span>💨</span><b>${now.w}</b><span>→</span><b>${tarde.w}</b><span>⚡${tarde.g}</span></div></div>
${side('t', 'TARDE · 17:00', tarde, icon('rain'))}
<div class="hr8">${hours}</div>
<div class="vd"><div class="kit"><span class="bb m">🧥</span><span class="bb m">🧤</span><span class="bb m">☔</span><span class="bb m">🕶</span></div>
<div class="orb g mono"><i>✔</i>IDA</div><div class="orb a mono"><i>!</i>VUELTA</div><div class="orb t mono">⏱ 15:30</div></div></div></section>`;

  const dia = `<section class="cd"><div class="lb mono"><span class="bb sap">🗓</span>Mi día<span class="mt">personal</span></div><div class="tl">${D.agenda.map((e, i) => `<div class="ev${i === 0 ? ' nw' : ''}"><span class="bb s">${e[1]}</span><span class="tm mono">${e[0]}</span><span class="tx">${esc(e[2])}</span></div>`).join('')}</div></section>`;

  const familia = `<section class="cd kd"><div class="lb mono"><span class="bb pk">🌟</span>__HIJA__<span class="gear2"><span class="bb s">🎒</span><span class="bb s">👟</span><span class="bb s">🧥</span></span></div>
<div><div class="kt"><span class="tm mono">08:30</span><span class="bb s">🏫</span><span class="tx">Escuela</span><small class="mono">→ 15:00</small></div>
<div class="kt"><span class="tm mono">16:30</span><span class="bb s">🤸</span><span class="tx">Gimnasio</span><small class="mono">1 h</small></div></div>
<div><div class="wk">${D.week.map((d) => `<div class="dy${d[3] ? ' td' : ''}"><span class="l mono">${d[0]}</span><span class="n sora">${d[1]}</span><span>${d[2]}</span></div>`).join('')}</div>
<div class="cnt"><span class="bb s">🩺</span><b class="sora">6</b><span class="mono">días · mar 27 · 15:20</span></div></div></section>`;

  const AV = ['#E5484D', '#F59F00', '#7C5CFF', '#2F6BFF'];
  const mail = `<section class="cd"><div class="lb mono"><span class="bb em">✉</span>Correos prioritarios<span class="mt">4</span></div>${D.mails.map((m, i) => `<div class="ml"><span class="av mono" style="background:radial-gradient(circle at 32% 24%,rgba(255,255,255,.7),${AV[i]} 60%)">${m.ini}</span><div class="mid"><div class="who">${esc(m.who)}</div><div class="sj">${esc(m.sj)}</div></div><span class="age mono">${m.age}</span><span class="sev s${m.sev}"></span></div>`).join('')}</section>`;

  const RC = ['#2F6BFF', '#7C5CFF', '#E5484D', '#12B886'];
  const fol = `<section class="cd"><div class="lb mono"><span class="bb vi">🎯</span>Lo que dije<span class="mt">avance</span></div><div class="rgs">${D.follow.map((f, i) => `<div class="rc"><span class="rg" style="background:conic-gradient(${RC[i]} ${f.p * 3.6}deg,rgba(30,50,110,.12) 0)"><span class="mono">${f.p}%</span></span><span class="tx">${esc(f.x)}</span><span class="due mono${f.due === 'hoy' ? ' hot' : ''}">${f.due}</span></div>`).join('')}</div></section>`;

  const jan = `<section class="cd"><div class="lb mono"><span class="bb am">⚙</span>Janus<span class="mt">hoy</span></div><div class="jv">${D.janus.map((j) => `<div class="jp"><span class="bb s">${j.e}</span><b class="sora">${j.n}</b></div>`).join('')}</div></section>`;

  const spk = (arr, w, h) => { const mx = Math.max(...arr); return smooth(arr.map((v, i) => [i * (w / (arr.length - 1)), h - 2 - (v / mx) * (h - 5)])); };
  const KC = ['sap', 'vi', 'pk', 'em', 'am'], KS = ['#2F6BFF', '#7C5CFF', '#EE4D95', '#12B886', '#F59F00'];
  const kp = `<section class="cd"><div class="lb mono"><span class="bb sap">📊</span>Cifras<span class="mt">30 d</span></div><div class="kl">${D.kpis.map((k, i) => `<div class="kr"><span class="bb s ${KC[i]}">${k.e}</span><div class="vv"><b class="sora">${k.v}</b><small class="mono">▲ ${k.d}</small></div><svg viewBox="0 0 34 18" preserveAspectRatio="none"><path d="${spk(k.s, 34, 18)}" fill="none" stroke="${KS[i]}" stroke-width="1.8" vector-effect="non-scaling-stroke" stroke-linecap="round"/></svg></div>`).join('')}</div></section>`;

  const SG = ['linear-gradient(90deg,#2556D6,#7FA6FF 45%,#2F6BFF)', 'linear-gradient(90deg,#5A3FD6,#B5A6FF 45%,#7C5CFF)', 'linear-gradient(90deg,#C42A74,#FFA6CC 45%,#EE4D95)', 'linear-gradient(90deg,#0B9468,#8FE8C8 45%,#12B886)'];
  const SD = ['#2F6BFF', '#7C5CFF', '#EE4D95', '#12B886'];
  const wtot = [0, 1, 2, 3].map((w) => D.sources.reduce((a, s) => a + s.w[w], 0)), wmax = Math.max(...wtot);
  const cols = [0, 1, 2, 3].map((w) => `<div class="cl"><div class="stk" style="height:${Math.round(wtot[w] / wmax * 100)}%">${D.sources.map((s, i) => `<i style="height:${(s.w[w] / wtot[w] * 100).toFixed(1)}%;background:${SG[i]}"></i>`).join('')}</div><small class="mono">S${w + 1}</small></div>`).join('');
  const revenue = `<section class="cd"><div class="lb mono"><span class="bb em">💶</span>Ingresos<span class="mt">▲ ${D.rev.delta}</span></div><div class="rvw"><div class="cols">${cols}</div><div class="lg mono">${D.sources.map((s, i) => `<div><i style="background:${SD[i]}"></i>${s.e}<b>€${fmt(s.v)}</b></div>`).join('')}</div></div></section>`;

  const rv = D.reach.vals, pts = rv.map((v, i) => [i * (600 / (rv.length - 1)), 200 - (v / 20) * 200 * 0.94 - 6]);
  const line = smooth(pts), last = pts[pts.length - 1];
  const reachC = `<section class="cd"><div class="lb mono"><span class="bb vi">👁</span>Alcance<span class="mt">${D.reach.total} · ▲ ${D.reach.delta}</span></div>
<div class="cbx"><div class="yax mono"><span>20K</span><span>10K</span><span>0</span></div><div class="plot"><svg viewBox="0 0 600 200" preserveAspectRatio="none"><defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7C5CFF" stop-opacity=".38"/><stop offset="1" stop-color="#2F6BFF" stop-opacity="0"/></linearGradient><linearGradient id="gl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2F6BFF"/><stop offset="1" stop-color="#7C5CFF"/></linearGradient></defs>
<path d="M0 .5 L600 .5 M0 100 L600 100 M0 199.5 L600 199.5" stroke="rgba(30,50,110,.1)" fill="none" vector-effect="non-scaling-stroke"/>
<path d="${line} L600 200 L0 200 Z" fill="url(#ga)"/><path d="${line}" fill="none" stroke="url(#gl)" stroke-width="3.2" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg><span class="dot" style="left:100%;top:${(last[1] / 200 * 100).toFixed(1)}%"></span></div></div>
<div class="xax mono"><span>22 sep</span><span>6 oct</span><span>21 oct</span></div></section>`;

  const spkb = (arr, w, h) => { const mx = Math.max(...arr); return smooth(arr.map((v, i) => [i * (w / (arr.length - 1)), h - 2 - (v / mx) * (h - 5)])); };
  const botsC = `<section class="cd"><div class="lb mono"><span class="bb sap">🤖</span>Chatbots<span class="mt">en vivo</span></div>${D.bots.map((b) => `<div class="bot"><div class="bh"><span class="led"></span><span class="nm">${esc(b.n)}</span></div><div class="bb2"><span class="cv sora">${b.c}</span><span style="font-size:11px">💬</span><span class="pill mono${b.warn ? ' w' : ''}">${b.u}</span></div><div class="sp3"><span class="age mono">⏱ ${b.upT}%</span><svg viewBox="0 0 100 22" preserveAspectRatio="none"><path d="${spkb(b.days, 100, 22)}" fill="none" stroke="#2F6BFF" stroke-width="1.8" vector-effect="non-scaling-stroke"/></svg></div></div>`).join('')}</section>`;

  const grads = ['linear-gradient(160deg,#7FA6FF,#2F6BFF 60%,#5A3FD6)', 'linear-gradient(160deg,#FFA6CC,#EE4D95 60%,#9B1F5C)', 'linear-gradient(160deg,#8FE8C8,#12B886 60%,#0A6B4E)'];
  const topsC = `<section class="cd"><div class="lb mono"><span class="bb pk">🎬</span>Contenido<span class="mt">top 3</span></div>${D.tops.map((t, i) => `<div class="tc"><div class="th" style="background:${grads[i]}">▶</div><div class="mid"><div class="tt">${esc(t.t)}</div><div class="mr"><span class="vbar"><i style="width:${Math.round(t.vn / 48 * 100)}%"></i></span><b class="mono">${t.v}</b><small class="mono">${t.m}</small></div></div></div>`).join('')}</section>`;

  const maxF = D.funnel[0].n, FC = ['linear-gradient(180deg,#8FB3FF,#2F6BFF)', 'linear-gradient(180deg,#B5A6FF,#7C5CFF)', 'linear-gradient(180deg,#8FE8C8,#12B886)'];
  const cli = `<section class="cd"><div class="lb mono"><span class="bb em">🤝</span>Clientes</div><div class="dn"><div class="donut" style="background:conic-gradient(from -90deg,#2F6BFF 0 120deg,#7C5CFF 120deg 270deg,#B9C5DE 270deg 360deg)"><b class="sora">12</b></div><div class="lgd mono"><span><i style="background:#2F6BFF"></i>🤝 4</span><span><i style="background:#7C5CFF"></i>🛟 5</span><span><i style="background:#B9C5DE"></i>📄 3</span></div></div>
<div class="fns">${D.funnel.map((f, i) => `<div class="fn"><span class="bb s">${f.e}</span><div class="fb mono" style="width:${Math.max(24, Math.round(f.n / maxF * 74))}%;background:${FC[i]}">${f.n}</div>${i ? `<small class="mono" style="color:var(--mute);font-size:9px">▼${Math.round(f.n / D.funnel[i - 1].n * 100)}%</small>` : ''}</div>`).join('')}</div></section>`;

  const body = `<div class="stage b"><header class="hd"><img class="medal" src="${IM.medal}" alt="Janus"><div><div class="wm sora">JANUS</div><div class="dt mono">MIÉ 21 OCT · 07:45</div></div>
<div class="chips mono"><span class="chip good">🚴 ✔ <b>IDA</b></span><span class="chip warn">☔ <b>17:00</b></span><span class="chip">✉ <b>4</b></span><span class="chip">🔐 <b>2</b></span><span class="chip bad">⚑ <b>1</b></span></div><div class="demo mono">Vista previa · datos de ejemplo</div></header>
${clima}<div class="b2">${dia}${familia}${mail}${fol}${jan}</div><div class="b3">${kp}${revenue}${reachC}${botsC}${topsC}${cli}</div></div>`;

  const head = '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link href="https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Manrope:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">';
  const html = L.page({ title: 'Janus · Platino', head, css, body, bg: '#E7ECF5', scheme: 'light' });
  fs.mkdirSync(require('path').join(__dirname, '../dist'), { recursive: true });
  fs.writeFileSync(require('path').join(__dirname, '../dist/Janus-B-Platino.html'), html);
  console.log('B', (html.length / 1024).toFixed(0) + ' KB');
})();
