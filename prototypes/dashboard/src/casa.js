'use strict';
/* ===== Casa inteligente (pieza LEGO home-scenes) =====
 * Dispositivos de EJEMPLO hasta conectar Tuya (LSC Smart Connect). Estado y registro en ST.home.
 */
const HOME_DEV = [
  { id: 'salon', name: 'Salón', room: 'salón', kind: 'light', adapter: 'demo', tags: ['ambiente'] },
  { id: 'cocina', name: 'Cocina', room: 'cocina', kind: 'light', adapter: 'demo', tags: ['ambiente', 'despertar'] },
  { id: 'dormitorio', name: 'Dormitorio', room: 'dormitorio', kind: 'light', adapter: 'demo', tags: ['despertar'] },
  { id: 'pasillo', name: 'Pasillo', room: 'pasillo', kind: 'light', adapter: 'demo', tags: ['noche'] },
  { id: 'arbol', name: 'Luces de Navidad', room: 'salón', kind: 'plug', adapter: 'demo', tags: ['navidad'] },
  { id: 'calefaccion', name: 'Calefacción', room: 'casa', kind: 'thermostat', adapter: 'demo', tags: [] }
];
const homeSt = () => { ST.home = ST.home || { state: {}, log: [] }; return ST.home; };
function runScene(scene, source) {
  const H = homeSt(), acts = HomeScenes.planScene(scene, HOME_DEV, H.state, { now: new Date(), comfortTemp: 20.5 });
  H.state = HomeScenes.applyActions(H.state, acts);
  H.log.unshift({ at: hhmm(), source, scene, n: acts.length }); H.log = H.log.slice(0, 8); saveState();
  return acts;
}
function homeSummary() { const s = homeSt().state; const on = HOME_DEV.filter((d) => d.kind !== 'thermostat' && s[d.id] && s[d.id].on).length; const t = s.calefaccion && s.calefaccion.temp; return on + ' luces encendidas' + (t ? ' · calefacción ' + String(t).replace('.', ',') + '°' : ''); }
const HOME_BTNS = [['llegada', '🏠', 'Llegada'], ['navidad', '🎄', 'Navidad'], ['buenas-noches', '🌙', 'Noche'], ['todo-off', '⏻', 'Apagar']];
function homeCard() {
  return '<section class="a2c a2home"><div class="a2t go"' + goAttr('casa', 'Casa') + '>' + gIco('sun', 'c') + '<span>Casa</span><em>' + homeSummary() + ' · ejemplo</em></div><div class="a2sc">' +
    HOME_BTNS.map((b) => '<span class="btn2 mono"' + act('scene', b[0], b[2]) + '>' + b[2] + '</span>').join('') + '</div></section>';
}
function vCasa(M, X, sub) {
  const H = homeSt(), s = H.state;
  const devs = panel('hdev', '💡', 'Dispositivos', 'LSC Smart Connect · Tuya · ejemplo', HOME_DEV.map((d) => { const st = s[d.id] || { on: false }; return '<div class="li2"><span class="tx"><b>' + esc(d.name) + '</b> <small class="dim">' + d.room + ' · ' + d.tags.join(', ') + '</small></span>' + (d.kind === 'thermostat' ? '<span class="mono">' + (st.temp ? String(st.temp).replace('.', ',') + '°' : '—') + '</span>' : pill(st.on ? 'encendida' : 'apagada', st.on ? '' : 'a')) + '</div>'; }).join(''));
  const scenes = panel('hsc', '🎬', 'Escenas', 'toca o pídelo por voz', '<div class="a2sc">' + Object.entries(HomeScenes.SCENES).map(([k, v]) => '<span class="btn2 mono"' + act('scene', k, v.label) + ' title="' + esc(v.desc) + '">' + v.label + '</span>').join('') + '</div><div class="dim">Por voz: «enciende las luces de Navidad», «apaga todo», «pon la calefacción a 21», «ya llegué».</div>');
  const log = panel('hlog', '🧾', 'Registro', H.log.length + ' acciones', H.log.length ? H.log.map((l) => '<div class="li2"><span class="mono tm">' + l.at + '</span><span class="tx">' + HomeScenes.SCENES[l.scene].label + ' · ' + l.source + '</span><span class="mono dim">' + l.n + ' cambios</span></div>').join('') : '<div class="dim">Sin acciones todavía.</div>');
  const how = panel('hhow', '🛈', 'Cómo funcionará de verdad', 'por confirmar', '<div class="dim">1) Llegas: un Atajo de iOS «Al llegar a casa» avisa a Janus. 2) Janus ejecuta «Llegada»: luces si ya es de noche y calefacción a confort. 3) El equipo de casa (tablet en soporte o mini-PC) te saluda: «Hola, Jean. ¿Qué tal tu día?» y te resume el día. Falta: conectar tu cuenta Tuya/Smart Life (claves en llavero, nunca en el código) y el inventario real de tus luces.</div>');
  return frame('casa', sub, M, scenes + devs + log + how);
}
VIEWS.casa = vCasa;
TABS.push(['casa', '🏠', 'Casa']);
const HOME_ACTS = { scene: (k) => { const a = runScene(k, 'boton'); UI.homeMsg = HomeScenes.SCENES[k].label + ': ' + (a.length ? a.length + ' cambios' : 'ya estaba así'); } };
