/* más cabeza: sombrero pescador y clips de mariposa */
import { THREE, V, PI, mk, rbox, lathe, tube, torus, grp, at, rotd, sc, ball, ellipsoid, arcPts, bend, glow } from '../kit.js';
import * as M from '../mats.js';
export function bucket({ A, S, C }) {
  const g = grp(), cl = M.fabric('weave', C.main, { rough: 0.8 });
  g.add(at(mk(lathe([[0, 0], [0.58, 0], [0.6, 0.05], [0.52, 0.5], [0.45, 0.54], [0, 0.55]], 64), cl), 0, -0.36, 0));
  const br = lathe([[0.54, 0], [0.9, -0.03], [1.02, -0.09], [1.04, -0.12], [0.98, -0.11], [0.88, -0.04], [0.54, 0.04]], 80); g.add(at(mk(br, cl), 0, -0.3, 0));
  for (let r = 0; r < 5; r++) { const rad = 0.64 + r * 0.075, y = -0.283 - 0.03 * (rad - 0.54) * 1.2 - 0.004 * r; const pts = []; for (let k = 0; k <= 64; k++) { const a = (k / 64) * PI * 2; pts.push(V(Math.cos(a) * rad, y, Math.sin(a) * rad)); } g.add(mk(tube(pts, 0.004, 90, 4, true), M.satin(C.accent, { roughness: 0.6 }))); }
  g.add(at(mk(lathe([[0.575, 0], [0.585, 0], [0.585, 0.12], [0.575, 0.12]], 64), M.fabric('weave', C.accent)), 0, -0.2, 0));
  [-1, 1].forEach((s) => g.add(at(mk(new THREE.TorusGeometry(0.022, 0.007, 8, 16), M.silver()), s * 0.585, 0.0, 0)).rotation.y = PI / 2);
  return { parts: [{ bone: 'head', obj: sc(g, S), at: A.head.top }] };
}
export function clipsMariposa({ A, S, C }) {
  const g = grp(), m1 = M.gloss(C.main, { roughness: 0.15, clearcoat: 1 }), m2 = M.gloss(C.accent, { roughness: 0.15 }), au = M.gold();
  [-1, 1].forEach((s) => { const b = grp(); [[0.1, 0.07, 0.17, 0.12], [0.08, -0.06, 0.12, 0.09]].forEach(([x, y, rx, ry], i) => [-1, 1].forEach((k) => { const w = new THREE.SphereGeometry(1, 24, 16); w.scale(rx, ry, 0.025); const m = mk(w, i ? m2 : m1); m.position.set(k * x, y, 0); m.rotation.z = k * (i ? -0.5 : 0.4); b.add(m); const ring = mk(new THREE.TorusGeometry(1, 0.06, 6, 28), au); ring.scale.set(rx * 1.0, ry * 1.0, 1); ring.scale.multiplyScalar(0.96); ring.position.copy(m.position); ring.rotation.z = m.rotation.z; ring.scale.set(rx, ry, 0.6); ring.geometry = new THREE.TorusGeometry(1, 0.045 / Math.min(rx, ry), 6, 28); b.add(ring); const gm = ball(0.016, M.gem(0xffffff), 10, 8); gm.position.set(k * x * 1.1, y, 0.03); b.add(gm); }));
    b.add(at(ellipsoid(0.03, 0.12, 0.035, au), 0, 0.0, 0.01)); [-1, 1].forEach((k) => b.add(mk(tube([V(0, 0.1, 0), V(k * 0.05, 0.22, 0.01), V(k * 0.09, 0.27, 0.01)], 0.006, 10, 4), au)));
    b.position.set(s * 0.46, -0.18, 0.28); b.rotation.set(-0.35, s * -0.6, s * 0.3); b.scale.setScalar(0.95); g.add(b); });
  return { parts: [{ bone: 'head', obj: sc(g, S), at: A.head.top }] };
}
