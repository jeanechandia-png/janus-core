'use strict';
/* ===== Clima por franjas (mañana/tarde/noche) + dron (pieza LEGO drone-weather) ===== */
function wxDayHours(M, off) {
  const di = M.nowDay + off, raw = M.raw, d = raw.daily[di] || raw.daily[0];
  const sr = hmToMin(d.sunrise) / 60, ss = hmToMin(d.sunset) / 60;
  return raw.hourly.filter((x) => x.day === di).map((x) => ({ h: x.h, t: x.t, w: x.w, g: x.g, r: x.r, mm: x.mm || 0, vis: x.vis, storm: !!x.storm, day: x.h >= Math.ceil(sr) && x.h < Math.floor(ss), k: x.k }));
}
const perIcon = (p, night) => p.storm ? 'rain' : p.r >= 50 ? 'rain' : p.r >= 30 ? 'cloud' : night ? 'moon' : 'part';
const DRV = { si: ['ok', '✔', 'Bien para el dron'], precaucion: ['wa', '!', 'Dron con precaución'], no: ['no', '✕', 'No volar el dron'] };
function droneLine(M, off) {
  const hs = wxDayHours(M, off); if (!hs.length) return '';
  const v = DroneWx.dayVerdict(hs), d = DRV[v.verdict];
  return '<div class="a2dr ' + d[0] + '"><b>' + d[1] + '</b><span>' + d[2] + '</span><small>' + esc(v.reasons[0] || '') + '</small></div>';
}
function phoneWxCard(M) {
  const row = (off, lbl) => {
    const hs = wxDayHours(M, off), P = hs.length ? DroneWx.periods(hs) : [];
    return '<div class="a2wr"><div class="a2wl"><b>' + lbl + '</b><small>' + dateLabel(M.raw.today + M.nowDay + off).split(' ').slice(0, 2).join(' ') + '</small></div>' +
      P.map((p) => '<div class="a2wp' + (p.storm ? ' st' : p.r >= 50 ? ' rn' : '') + '"><small>' + p.label + '</small><img src="' + wxImg(perIcon(p, p.id === 'noche')) + '" alt="">' + gNum(p.t + '°', 'w') + '<i>' + (p.storm ? '⚡ ' : '') + p.r + '% · ' + p.w + ' km/h</i></div>').join('') + '</div>' + droneLine(M, off);
  };
  return '<section class="a2c a2wx2 go"' + goAttr('clima', 'Clima 15 días') + '><div class="a2t">' + gIco('umbrella', 'c') + '<span>Clima · bici · dron</span><em>' + (M.src === 'vivo' ? '● en vivo' : 'ejemplo') + ' · toca: 15 días</em></div>' + row(0, 'HOY') + row(1, 'MAÑANA') + '</section>';
}
function dronePanel(M) {
  const i = UI.clDay || 0, off = i - M.nowDay, hs = wxDayHours(M, off);
  if (!hs.length) return panel('wxdr', '🚁', 'Dron · Atom 2', 'sin datos horarios', '<div class="dim">Sin datos por hora para este día.</div>');
  const v = DroneWx.dayVerdict(hs), d = DRV[v.verdict];
  const strip = hs.filter((x) => x.h >= 6 && x.h <= 22).map((x) => { const c = DroneWx.checkHour(x).verdict; return '<i class="' + DRV[c][0] + '" title="' + x.h + ':00 · ' + DRV[c][2] + '"></i>'; }).join('');
  return panel('wxdr', '🚁', 'Dron · Atom 2', 'límite ' + DroneWx.ATOM2.maxWindKmh + ' km/h · ≤120 m',
    '<div class="a2dr ' + d[0] + '"><b>' + d[1] + '</b><span>' + d[2] + '</span><small>' + esc(v.reasons.join(' · ')) + '</small></div><div class="drs">' + strip + '</div><div class="drh mono"><span>06</span><span>12</span><span>18</span><span>22</span></div>');
}
function wxAlerts(M) {
  const out = []; const H = M.raw.hourly;
  M.raw.daily.forEach((d, i) => { const hs = H.filter((x) => x.day === i); const st = hs.some((x) => x.storm), gmax = Math.max(0, ...hs.map((x) => x.g)), mm = hs.reduce((s, x) => s + (x.mm || 0), 0);
    if (st) out.push('⚡ ' + dateLabel(d.dn).split(' ').slice(0, 2).join(' ') + ': tormenta'); else if (gmax >= 50) out.push('💨 ' + dateLabel(d.dn).split(' ').slice(0, 2).join(' ') + ': ráfagas ' + gmax); if (d.tmin <= 0) out.push('❄ ' + dateLabel(d.dn).split(' ').slice(0, 2).join(' ') + ': helada'); if (mm >= 8) out.push('🌧 ' + dateLabel(d.dn).split(' ').slice(0, 2).join(' ') + ': ' + mm.toFixed(0) + ' mm'); });
  return out;
}
