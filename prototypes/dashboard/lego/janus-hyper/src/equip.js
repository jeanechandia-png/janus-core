/* equip.js · viste a una criatura: piezas rígidas atadas a huesos, prendas ajustadas al cuerpo, ocultar rasgos que estorban, recortar el pelo bajo la ropa */
import * as THREE from 'three';
import { ANCH } from './anchors.js';
import { BY_ID } from './catalog.js';
import { buildGarment } from './garment.js';
import { smooth01 } from './sdf.js';

const gcache = new Map();
const SLOT_HIDES = { espalda: ['wings'], cabeza: ['flower', 'ferns'], oidos: ['flower', 'ferns'] };
export function garmentFor(def, A, item, C) {
  const key = def.id + ':' + item.id + ':' + C.main + ':' + C.accent + ':' + (C.letter || '') + (C.number || '');
  if (gcache.has(key)) return gcache.get(key);
  const spec = item.garment.spec({ A, C }), g = buildGarment(def, A, spec); gcache.set(key, g); return g;
}
export function installEquip(R) {
  const A = ANCH[R.def.id], def = R.def; R.worn = {}; R.wornX = {}; R.ticks = [];
  R.furOrig = R.geo.attributes.aFur.array.slice(); const P = R.geo.attributes.position.array;
  const orig = R.update; R.update = (t, dt, io) => { orig(t, dt, io); for (let i = 0; i < R.ticks.length; i++) R.ticks[i](t, dt); };
  const hideProps = (keys, v) => (keys || []).forEach((k) => (A.hides[k] || []).forEach((pk) => { const pr = R.props[pk]; if (!pr) return; (Array.isArray(pr) ? pr : [pr]).forEach((o) => { o.visible = v; }); }));
  const recomputeFur = () => {
    const a = R.geo.attributes.aFur.array; a.set(R.furOrig); const regs = Object.values(R.wornX).map((w) => w.reg).filter(Boolean);
    if (regs.length) for (let v = 0; v < R.n; v++) { let cov = 0; for (const rg of regs) cov = Math.max(cov, smooth01(0.07, -0.03, rg(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]))); a[v] *= 1 - 0.9 * cov; }
    R.geo.attributes.aFur.needsUpdate = true;
  };
  R.unequip = (slot) => {
    const w = R.wornX[slot]; if (!w) return; w.objs.forEach((o) => { if (o.parent) o.parent.remove(o); o.traverse((c) => { if (c.isMesh && c.userData.ownGeo) c.geometry.dispose(); }); }); if (w.tick) R.ticks.splice(R.ticks.indexOf(w.tick), 1);
    hideProps(w.hides, true); delete R.wornX[slot]; delete R.worn[slot]; if (w.reg) recomputeFur();
  };
  R.equip = (id, colors) => {
    const it = BY_ID[id]; if (!it) return null; R.unequip(it.slot);
    if (it.slot === 'oidos') R.unequip('cabeza'); if (it.slot === 'cabeza') R.unequip('oidos');
    const C = Object.assign({ main: it.col[0], accent: it.col[1] }, colors || {}), S = A.scale[it.slot] ?? A.scale.espalda, objs = [], w = { id, objs, hides: it.hides };
    const mount = (p) => { if (p.isObject3D) p = { bone: 'spine', obj: p, at: [0, 0, 0] }; R.attach(p.bone, p.obj, p.at); objs.push(p.obj); };
    if (it.garment) {
      const gd = garmentFor(def, A, it, C), mat = it.garment.mat({ A, C }), mesh = new THREE.SkinnedMesh(gd.geo, mat); mesh.frustumCulled = false; mesh.castShadow = true; mesh.receiveShadow = true; R.root.add(mesh); mesh.bind(R.skeleton, new THREE.Matrix4()); if (mat.userData.bind) mat.userData.bind(mesh); objs.push(mesh);
      (it.garment.extras({ A, C, S: gd.S, R }) || []).forEach(mount); w.reg = gd.S.reg;
    } else {
      const out = it.build({ A, S, C, R }); out.parts.forEach(mount); if (out.reg) w.reg = out.reg; if (out.hides) w.hides = (it.hides || []).concat(out.hides); if (out.tick) { w.tick = out.tick; R.ticks.push(out.tick); }
    }
    w.hides = Array.from(new Set((w.hides || []).concat(SLOT_HIDES[it.slot] || []))); hideProps(w.hides, false); R.wornX[it.slot] = w; R.worn[it.slot] = id; if (w.reg) recomputeFur(); return w;
  };
  R.clearOutfit = () => Object.keys(R.wornX).forEach((s) => R.unequip(s));
}
