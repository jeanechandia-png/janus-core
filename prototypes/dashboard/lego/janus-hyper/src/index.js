/* JanusHyper · API pública: JanusHyper.create(canvas, { creature, quality, light, style }) */
import * as THREE from 'three';
import { createStudio, QUALITY, LIGHTS } from './studio.js';
import { assemble } from './creature.js';
import { furShared } from './fur.js';
import { DEFS } from './defs.js';
import { installEquip } from './equip.js';
import { CATALOG, SLOTS, TIERS, BY_ID } from './catalog.js';
import { thumb } from './thumbs.js';
import { ANCH } from './anchors.js';

export { DEFS, THREE, QUALITY, LIGHTS, CATALOG, SLOTS, TIERS, BY_ID, ANCH, thumb };

export function create(canvas, opts = {}) {
  const S = createStudio(canvas, opts), A = { S, THREE, style: opts.style || 'fur', R: null, id: null, cam: { yaw: 0.25, pitch: 0.08, dist: 7.4, ty: 1.25, auto: false }, io: { look: null }, speed: 1, onFrame: null, outfit: {}, walk: false };
  const cam = A.cam, upd = () => {
    S.camera.position.set(Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.dist, cam.ty + Math.sin(cam.pitch) * cam.dist, Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.dist); S.camera.lookAt(0, cam.ty, 0);
  };
  A.setCreature = (id, look) => {
    if (A.R) { S.scene.remove(A.R.root); A.R.dispose(); A.R = null; }
    const def = DEFS[id](); A.id = id; A.def = def; A.look = Object.assign({}, def.defaults, look || {});
    const t0 = performance.now(); A.R = assemble(def, S.q, A.look, A.style); installEquip(A.R); A.buildMs = Math.round(performance.now() - t0); S.scene.add(A.R.root); Object.keys(A.outfit).forEach((sl) => A.R.equip(A.outfit[sl].id, A.outfit[sl].colors)); return A.R;
  };
  A.setLook = (lk) => { A.look = Object.assign({}, A.look, lk); if (A.R) A.R.applyColors(A.look); };
  A.setStyle = (s) => { A.style = s; if (A.R) A.R.setStyle(s); };
  A.setPose = (p) => { if (A.R) A.R.setPose(p); };
  A.wear = (id, colors) => { const it = BY_ID[id]; if (!it) return null; if (it.slot === 'oidos') delete A.outfit.cabeza; if (it.slot === 'cabeza') delete A.outfit.oidos; A.outfit[it.slot] = { id, colors }; return A.R && A.R.equip(id, colors); };
  A.unwear = (slot) => { delete A.outfit[slot]; if (A.R) A.R.unequip(slot); };
  A.clearOutfit = () => { A.outfit = {}; if (A.R) A.R.clearOutfit(); };
  A.setWind = (v, yaw) => { if (A.R) A.R.setWind(v, yaw); A.wind = v; };
  A.setQuality = (qid) => { S.setQuality(qid); if (A.id) A.setCreature(A.id, Object.assign({}, A.look)); };
  A.setLight = (id) => S.setLight(id);
  A.resize = () => { S.resize(); };
  let last = performance.now(), t = 0, raf = 0;
  A.step = (dt) => { t += dt * A.speed; furShared.uTime.value = t; if (cam.auto) cam.yaw += dt * 0.25; upd();
    if (A.R && A.walk) { const ph = t * 0.85, x = Math.sin(ph) * 1.7, vx = Math.cos(ph), R = A.R; R.root.position.x = x; const ty = Math.abs(vx) > 0.15 ? (vx > 0 ? Math.PI / 2 : -Math.PI / 2) : R.root.rotation.y; R.root.rotation.y += (ty - R.root.rotation.y) * (1 - Math.exp(-6 * dt)); const sw = Math.sin(t * 9) * 0.55 * Math.min(1, Math.abs(vx) * 2); if (R.bones.legL) { R.bones.legL.rotation.x = sw; R.bones.legR.rotation.x = -sw; } R.root.position.y += Math.abs(Math.sin(t * 9)) * 0.05; } else if (A.R && A.R.root.position.x !== 0) { A.R.root.position.x = 0; A.R.root.rotation.y = 0; if (A.R.bones.legL) { A.R.bones.legL.rotation.x = 0; A.R.bones.legR.rotation.x = 0; } }
    if (A.R) A.R.update(t, dt, A.io); if (A.onFrame) A.onFrame(t, dt); S.render(dt); };
  A.loop = () => { const n = performance.now(), dt = Math.min(0.1, (n - last) / 1000); last = n; A.step(dt); raf = requestAnimationFrame(A.loop); };
  A.start = () => { last = performance.now(); raf = requestAnimationFrame(A.loop); }; A.stop = () => cancelAnimationFrame(raf);
  // órbita táctil / ratón
  let drag = null; const el = canvas;
  el.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, yaw: cam.yaw, pitch: cam.pitch }; el.setPointerCapture(e.pointerId); cam.auto = false; });
  el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(); A.io.look = { x: ((e.clientX - r.left) / r.width - 0.5) * 1.2, y: -((e.clientY - r.top) / r.height - 0.45) * 0.9 }; if (!drag) return; cam.yaw = drag.yaw - (e.clientX - drag.x) * 0.006; cam.pitch = Math.max(-0.1, Math.min(0.6, drag.pitch + (e.clientY - drag.y) * 0.004)); });
  el.addEventListener('pointerup', () => { drag = null; }); el.addEventListener('pointerleave', () => { A.io.look = null; });
  el.addEventListener('wheel', (e) => { e.preventDefault(); cam.dist = Math.max(3.2, Math.min(11, cam.dist * (1 + e.deltaY * 0.001))); }, { passive: false });
  A.setCreature(opts.creature || 'lumi', opts.look);
  return A;
}
