'use strict';
/* ===== Clima: modelo normalizado (en vivo vía Open-Meteo o de ejemplo) ===== */
const WMO = (c, day) => {
  let k = 'cloud';
  if (c === 0) k = 'sun'; else if (c <= 2) k = 'part'; else if (c === 3 || c === 45 || c === 48) k = 'cloud';
  else if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95) k = 'rain'; else if ((c >= 71 && c <= 77) || c === 85 || c === 86) k = 'snow';
  if (!day) { if (k === 'sun') k = 'moon'; else if (k === 'part') k = 'cloud'; }
  return k;
};
const WX_TXT = { sun: 'Despejado', part: 'Parcialmente nuboso', cloud: 'Nublado', rain: 'Lluvia', snow: 'Nieve', moon: 'Despejado (noche)' };
const wxImg = (k) => IMG[k === 'snow' ? 'cloud' : k] || IMG.cloud;

function lerpAnchors(anchors, h) {
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i], b = anchors[i + 1];
    if (h >= a[0] && h <= b[0]) { const t = (h - a[0]) / (b[0] - a[0] || 1); return a[1] + (b[1] - a[1]) * t; }
  }
  return h < anchors[0][0] ? anchors[0][1] : anchors[anchors.length - 1][1];
}

/* Datos de EJEMPLO: anclados a la vista aprobada (07:45 · 10° · tarde 17:00 lluvia 70 %) */
function exampleRaw() {
  const H = [0, 7.75, 9, 11, 13, 15, 16, 17, 19, 21, 23.99];
  const A = (vals) => H.map((h, i) => [h, vals[i]]);
  const base = {
    t: A([8, 10, 11, 13, 14, 14, 14, 13, 11, 10, 9]), feel: A([5, 7, 8, 11, 12, 12, 11, 10, 8, 7, 6]),
    r: A([10, 5, 10, 5, 15, 40, 45, 70, 60, 30, 20]), w: A([12, 16, 20, 22, 24, 26, 27, 28, 26, 20, 16]),
    g: A([18, 20, 26, 29, 32, 35, 38, 41, 38, 30, 24]), d: A([220, 225, 225, 225, 240, 240, 245, 250, 250, 250, 245])
  };
  const rnd = prng(2110);
  const hourly = [];
  for (let day = 0; day < 15; day++) {
    const dt = [0, -1, 1, 0, -2, 2, 1][day % 7] - Math.floor(day / 7), dr = [0, -15, 20, -5, 25, -20, 5][(day * 3) % 7], dw = [0, -4, 6, -2, 8, -6, 0][(day * 5) % 7];
    for (let h = 0; h < 24; h++) {
      const hh = day === 0 && h === 7 ? 7.75 : h;
      const j = day ? (rnd() - .5) * 2 : 0;
      const t = Math.round(lerpAnchors(base.t, hh) + dt + j * .6), feel = Math.round(lerpAnchors(base.feel, hh) + dt + j * .6);
      const r = clamp(Math.round(lerpAnchors(base.r, hh) + (day ? dr + j * 6 : 0)), 0, 100), w = Math.max(3, Math.round(lerpAnchors(base.w, hh) + (day ? dw + j * 2 : 0)));
      const g = Math.round(day ? w * 1.42 : lerpAnchors(base.g, hh)), d = Math.round(lerpAnchors(base.d, hh) + day * 8) % 360;
      const isDay = h >= 8 && h < 18;
      const k = r >= 50 ? 'rain' : r >= 30 ? 'cloud' : !isDay ? (r < 12 ? 'moon' : 'cloud') : (r <= 6 && h >= 10 && h <= 14 ? 'sun' : 'part');
      const uv = isDay ? Math.max(0, +(3.4 * Math.sin(Math.PI * (h - 8) / 10) * (1 - r / 120)).toFixed(1)) : 0;
      hourly.push({ day, h, storm: r >= 88 && h >= 14 && h <= 19, k, t, feel, r, w, g, d, mm: r >= 50 ? +((r - 40) / 40 * 1.2).toFixed(1) : r >= 30 ? .1 : 0, rh: Math.round(68 + r / 4), uv, vis: r >= 50 ? 6 : 10, cl: Math.min(100, 25 + r) });
    }
  }
  const today = dayNum(2026, 10, 21);
  const daily = [];
  for (let day = 0; day < 15; day++) {
    const hs = hourly.slice(day * 24, day * 24 + 24), day8 = hs.slice(8, 20);
    const rmax = Math.max(...day8.map((x) => x.r));
    daily.push({ dn: today + day, k: rmax >= 50 ? 'rain' : rmax >= 30 ? 'cloud' : 'part', tmax: Math.max(...hs.map((x) => x.t)), tmin: Math.min(...hs.map((x) => x.t)), rmax, wmax: Math.max(...hs.map((x) => x.w)), sunrise: '08:20', sunset: '18:31' });
  }
  return { src: 'ejemplo', place: 'Ubicación de ejemplo', hourly, daily, today, nowIdx: 7, nowMin: 7 * 60 + 45, nowCur: null };
}

function parseOpenMeteo(j, place) {
  const H = j.hourly, Dd = j.daily, cur = j.current || {};
  if (!H || !H.time || !Dd || !Dd.time) throw new Error('respuesta sin datos horarios/diarios');
  const p0 = Dd.time[0].split('-').map(Number), today = dayNum(p0[0], p0[1], p0[2]);
  const sr = Dd.sunrise.map((s) => hmToMin(s.slice(11, 16))), ss = Dd.sunset.map((s) => hmToMin(s.slice(11, 16)));
  const hourly = [];
  for (let i = 0; i < H.time.length && i < 168; i++) {
    const tp = H.time[i], ymd = tp.slice(0, 10).split('-').map(Number), day = dayNum(ymd[0], ymd[1], ymd[2]) - today, h = +tp.slice(11, 13);
    if (day < 0 || day > 6) continue;
    const isDay = H.is_day ? !!H.is_day[i] : (h * 60 >= sr[day] && h * 60 < ss[day]);
    const n = (a) => (H[a] && H[a][i] != null ? H[a][i] : 0);
    hourly.push({ day, h, storm: n('weather_code') >= 95, k: WMO(n('weather_code'), isDay), t: Math.round(n('temperature_2m')), feel: Math.round(n('apparent_temperature')), r: Math.round(n('precipitation_probability')), w: Math.round(n('wind_speed_10m')), g: Math.round(n('wind_gusts_10m')), d: Math.round(n('wind_direction_10m')), mm: +(+n('precipitation')).toFixed(1), rh: Math.round(n('relative_humidity_2m')), uv: +(+n('uv_index')).toFixed(1), vis: Math.round(n('visibility') / 1000), cl: Math.round(n('cloud_cover')) });
  }
  if (hourly.length < 24) throw new Error('menos de 24 horas en la respuesta');
  const daily = Dd.time.slice(0, 15).map((t, i) => { const ymd = t.split('-').map(Number); return { dn: dayNum(ymd[0], ymd[1], ymd[2]), k: WMO(Dd.weather_code[i], true), tmax: Math.round(Dd.temperature_2m_max[i]), tmin: Math.round(Dd.temperature_2m_min[i]), rmax: Math.round(Dd.precipitation_probability_max[i] || 0), wmax: Math.round(Dd.wind_speed_10m_max[i]), sunrise: Dd.sunrise[i].slice(11, 16), sunset: Dd.sunset[i].slice(11, 16) }; });
  const ct = cur.time || H.time[0], cymd = ct.slice(0, 10).split('-').map(Number), cday = dayNum(cymd[0], cymd[1], cymd[2]) - today;
  const nowMin = hmToMin(ct.slice(11, 16)), nowIdx = clamp(cday * 24 + Math.floor(nowMin / 60), 0, hourly.length - 1);
  const nowCur = cur.temperature_2m != null ? { t: Math.round(cur.temperature_2m), feel: Math.round(cur.apparent_temperature), w: Math.round(cur.wind_speed_10m), g: Math.round(cur.wind_gusts_10m), d: Math.round(cur.wind_direction_10m), k: WMO(cur.weather_code, cur.is_day !== 0) } : null;
  return { src: 'vivo', place, hourly, daily, today, nowIdx, nowMin, nowCur, fetchedAt: ct };
}

const WX = { status: 'idle', err: '', live: null, ex: exampleRaw() };
function wxUrl(lat, lon) {
  const hv = 'temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,relative_humidity_2m,uv_index,visibility,cloud_cover,is_day';
  return 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon + '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,is_day&hourly=' + hv + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset&timezone=auto&forecast_days=16&wind_speed_unit=kmh';
}
async function loadLiveWeather() {
  const s = ST.settings;
  WX.status = 'loading';
  try {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const tm = setTimeout(() => ctl && ctl.abort(), 9000);
    const res = await fetch(wxUrl(s.lat, s.lon), ctl ? { signal: ctl.signal } : {});
    clearTimeout(tm);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    WX.live = parseOpenMeteo(await res.json(), s.place);
    WX.status = 'ok'; WX.err = '';
  } catch (e) { WX.status = 'error'; WX.err = String(e && e.message || e); WX.live = null; }
}
async function geocode(q) {
  const res = await fetch('https://geocoding-api.open-meteo.com/v1/search?count=6&language=es&format=json&name=' + encodeURIComponent(q));
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const j = await res.json();
  return (j.results || []).map((r) => ({ name: r.name, admin: r.admin1 || '', country: r.country || '', lat: +r.latitude.toFixed(3), lon: +r.longitude.toFixed(3) }));
}

/* ===== Reglas de bici: riesgo por hora, tramos, salida sugerida, equipo ===== */
function hourRisk(e) {
  const s = ST.settings, why = [];
  let lv = 0;
  if (e.r >= s.rainBad) { lv = 2; why.push('💧 ' + e.r + '%'); } else if (e.r >= s.rainWarn) { lv = Math.max(lv, 1); why.push('💧 ' + e.r + '%'); }
  if (e.w >= s.windBad || e.g >= s.windBad * 1.5) { lv = 2; why.push('💨 ' + e.w + '/' + e.g); } else if (e.w >= s.windWarn) { lv = Math.max(lv, 1); why.push('💨 ' + e.w); }
  if (e.feel <= 1) { lv = Math.max(lv, 1); why.push('🧊 ' + e.feel + '°'); }
  return { lv, why };
}
function model() {
  const raw = ST.settings.mode === 'vivo' && WX.live ? WX.live : WX.ex;
  const s = ST.settings, H = raw.hourly;
  const at = (day, h) => H[clamp(day * 24 + h, 0, H.length - 1)];
  const nowDay = Math.floor(raw.nowIdx / 24), nowMin = raw.nowMin;
  const nowE = Object.assign({}, H[raw.nowIdx], raw.nowCur || {});
  if (raw.src === 'ejemplo') Object.assign(nowE, { t: 10, feel: 7, w: 16, r: 5, d: 225, k: 'part', g: 20 });
  const dep = hmToMin(s.ida), ret = hmToMin(s.vuelta);
  const legDay = (m) => clamp(nowMin < m + 60 ? nowDay : nowDay + 1, 0, 6);
  const leg = (m, day) => { const hs = []; for (let x = m; x <= m + 45; x += 30) hs.push(at(day, Math.floor(x / 60))); let lv = 0, why = []; hs.forEach((e) => { const r = hourRisk(e); if (r.lv > lv) { lv = r.lv; why = r.why; } }); return { lv, why, day, hours: hs }; };
  const ida = leg(dep, legDay(dep)), vDay = legDay(ret), vuelta = leg(ret, vDay);
  let firstBad = null;
  for (let h = 12; h < 24; h++) { if (hourRisk(at(vDay, h)).lv === 2) { firstBad = h; break; } }
  const suggest = firstBad != null && firstBad * 60 - 90 > dep ? Math.floor((firstBad * 60 - 90) / 15) * 15 : null;
  vuelta.verdict = vuelta.lv === 0 ? 'g' : (suggest != null && suggest < ret) ? 'a' : vuelta.lv === 2 ? 'r' : 'a';
  ida.verdict = ida.lv === 0 ? 'g' : ida.lv === 1 ? 'a' : 'r';
  const badE = firstBad != null ? at(vDay, firstBad) : null;
  const leaveWhy = badE ? (badE.r >= s.rainBad ? 'lluvia' : 'viento') : '';
  let rainAt = null;
  for (let i = raw.nowIdx; i < Math.min(H.length, raw.nowIdx + 18); i++) if (H[i].r >= s.rainBad) { rainAt = H[i]; break; }
  const span = []; for (let h = Math.floor(dep / 60); h <= Math.floor(ret / 60) + 1; h++) span.push(at(vDay, h));
  const minFeel = Math.min(...span.map((e) => e.feel)), maxR = Math.max(...span.map((e) => e.r)), mm = span.reduce((a, e) => a + e.mm, 0), maxUV = Math.max(...span.map((e) => e.uv)), maxW = Math.max(...span.map((e) => e.w));
  const dl = raw.daily[vDay] || raw.daily[0], sunset = hmToMin(dl.sunset), sunrise = hmToMin(dl.sunrise);
  const kit = [
    { e: '🧥', n: 'Chaqueta', on: minFeel < s.feelCold, why: 'Sensación mínima ' + minFeel + '° (umbral ' + s.feelCold + '°)' },
    { e: '🧤', n: 'Guantes', on: minFeel < s.feelGlove, why: 'Sensación mínima ' + minFeel + '° (umbral ' + s.feelGlove + '°)' },
    { e: '☔', n: 'Impermeable', on: maxR >= 40 || mm > .5, why: 'Lluvia máx. ' + maxR + '% · ' + dec(mm) + ' mm en tu franja' },
    { e: '🕶', n: 'Gafas', on: maxUV >= 3, why: 'UV máx. ' + dec(maxUV) + ' en tu franja' },
    { e: '🧣', n: 'Cuello/buff', on: minFeel < 4, why: 'Sensación mínima ' + minFeel + '°' },
    { e: '🔦', n: 'Luces', on: ret + 45 > sunset || dep < sunrise, why: 'Amanece ' + dl.sunrise + ' · anochece ' + dl.sunset }
  ];
  const strip = [{ label: raw.src === 'ejemplo' ? '07:45' : minToHm(nowMin), e: nowE, idx: raw.nowIdx }];
  for (let k = 1; k < 8; k++) { const idx = Math.min(H.length - 1, raw.nowIdx + 2 * k); strip.push({ label: pad2(H[idx].h) + ':00', e: H[idx], idx }); }
  const today = raw.today + nowDay;
  return { raw, src: raw.src, place: raw.src === 'vivo' ? s.place : 'Ubicación de ejemplo', at, nowDay, nowMin, nowE, ida, vuelta, retE: at(vDay, Math.floor(ret / 60)), retLabel: (vDay === nowDay ? 'TARDE' : 'MAÑ') + ' · ' + s.vuelta, depLabel: (ida.day === nowDay ? 'HOY' : 'MAÑ') + ' · ' + s.ida, suggest, leaveWhy, firstBad, rainAt, kit, strip, minFeel, maxR, maxW, mm, maxUV, sunset: dl.sunset, sunrise: dl.sunrise, today, nowLabel: strip[0].label, dateLabel: dateLabel(today) };
}
