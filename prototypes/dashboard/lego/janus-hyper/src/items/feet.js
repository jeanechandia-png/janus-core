/* pies: zapatillas chunky, botas y zapatillas LED. Se construyen sobre el elipsoide del pie de cada criatura (A.foot = { c, r }). */
import { THREE, V, PI, mk, rbox, lathe, tube, torus, grp, at, rotd, sc, ball, ellipsoid, arcPts, bend, hsl } from '../kit.js';
import * as M from '../mats.js';

/** zona del zapato (para recortar el pelo que se asoma por la zapatilla) */
const shoeReg = (A) => { const [rx, ry, rz] = A.foot.r, f = A.foot.c, uh = Math.max(ry * 3, rx), h = uh * 0.5 + ry * 2.2, m = Math.min(rx, rz); return (x, y, z) => { let d = 1e9; for (const s of [1, -1]) d = Math.min(d, (Math.hypot((x - s * f[0]) / (rx * 1.2), (y - (f[1] - ry + h * 0.62)) / (h * 0.62), (z - f[2]) / (rz * 1.2)) - 1) * m); return d; }; };
const both = (A, build) => [1, -1].map((s) => { const f = A.foot, o = build(s); return { bone: s > 0 ? 'legR' : 'legL', obj: o, at: [s * f.c[0], f.c[1], f.c[2]] }; });
/** suela redondeada (superelipse con puntera más ancha que el talón), plana por abajo */
function soleGeo(W, L, h, bev) {
  const sh = new THREE.Shape(), n = 72, a = W / 2 - bev, b = L / 2 - bev;
  for (let i = 0; i <= n; i++) { const t = (i / n) * PI * 2, c = Math.cos(t), sn = Math.sin(t), e = 2 / 2.7, x = Math.sign(c) * Math.abs(c) ** e * a * (0.84 + 0.16 * (0.5 - sn * 0.5)), z = Math.sign(sn) * Math.abs(sn) ** e * b; if (!i) sh.moveTo(x, z); else sh.lineTo(x, z); }
  const g = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.002, h - bev * 2), bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 4, curveSegments: 1 }); g.rotateX(-PI / 2); g.translate(0, bev, 0); return g;
}
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** empeine por secciones: u∈[-.5,.5] talón→puntera; sección semielíptica; caña alta y puntera baja; `cut` abre el cuello por donde asoma el tobillo */
function loft(P, u0 = -0.5, u1 = 0.5, grow = 0, cut = false) {
  const nu = Math.max(6, Math.round((u1 - u0) * 48)), nv = 32, pos = [], idx = [];
  for (let i = 0; i <= nu; i++) { const u = u0 + ((u1 - u0) * i) / nu; for (let j = 0; j <= nv; j++) { const v = (PI * j) / nv; pos.push(Math.cos(v) * (P.wd(u) + grow), Math.pow(Math.sin(v), 0.72) * (P.ht(u) + grow), u * P.L); } }
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    if (cut) { const uc = u0 + ((u1 - u0) * (i + 0.5)) / nu, vc = (PI * (j + 0.5)) / nv, du = (uc - P.cu) / P.cw, dx = Math.cos(vc) / 0.64; if (du * du + dx * dx < 1) continue; }
    const a = i * (nv + 1) + j, b = a + 1, c = a + nv + 1, d = c + 1; idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
const two = (m) => { m.material.side = THREE.DoubleSide; return m; };
function sneaker(A, s, C, o = {}) {
  const [rx, ry, rz] = A.foot.r, g = grp(), W = rx * 2.1, L = rz * 2.1, hs = ry * (o.sole ?? 1.1), by = -ry - 0.012, uh = Math.max(ry * 3.0, rx * 1.0), y0 = by + hs * 1.1;
  const P = { L: L * 0.94, cu: A.foot.collar ?? -0.2, cw: 0.22, wd: (u) => (W * 0.47) * Math.pow(Math.sqrt(Math.max(0, 1 - 4 * u * u)), 0.78) * (0.86 + 0.14 * (u + 0.5)), ht: (u) => uh * Math.pow(Math.sqrt(Math.max(0, 1 - 4 * u * u)), 0.5) * (0.5 + 0.5 * sm(0.35, -0.35, u)) };
  const solePal = o.led ? M.gloss(0x20222a, { roughness: 0.4 }) : M.gloss(0xf3f1ec, { roughness: 0.5, clearcoat: 0.6 });
  g.add(at(mk(soleGeo(W, L, hs, hs * 0.3), solePal), 0, by + hs * 0.18, 0));
  g.add(at(mk(soleGeo(W * 1.02, L * 1.02, hs * 0.3, hs * 0.1), M.rubber(0x15161a)), 0, by, 0));
  const up = grp(); up.position.y = y0; g.add(up);
  up.add(two(mk(loft(P, -0.5, 0.5, 0, true), M.fabric('leather', C.main, { amp: 0.06, rough: 0.5 }))));
  up.add(two(mk(loft(P, 0.2, 0.5, 0.012), M.fabric('felt', 0xf3f1ec, { rough: 0.8 }))));          // puntera
  up.add(two(mk(loft(P, -0.5, -0.3, 0.012), M.fabric('leather', C.accent, { amp: 0.05, rough: 0.45 }))));  // talonera
  // cuello acolchado
  const rim = []; for (let k = 0; k < 40; k++) { const th = (k / 40) * PI * 2, u = P.cu + P.cw * Math.cos(th), cv = 0.64 * Math.sin(th), w = P.wd(u); rim.push(V(cv * w, P.ht(u) * Math.pow(1 - cv * cv, 0.36) + 0.004, u * P.L)); }
  up.add(mk(tube(rim, rx * 0.11, 64, 8, true), M.fabric('knit', C.accent, { rough: 0.95 })));
  // franja lateral
  [-1, 1].forEach((k) => { const pts = []; for (let i = 0; i <= 14; i++) { const u = -0.3 + (0.55 * i) / 14, w = P.wd(u), h = P.ht(u), y = 0.5 * h + 0.16 * h * Math.sin((i / 14) * PI), sv = Math.pow(Math.min(0.999, y / h), 1 / 0.72), cv = Math.sqrt(1 - sv * sv); pts.push(V(k * cv * w * 1.012, y, u * P.L)); } up.add(mk(tube(pts, ry * 0.15, 28, 6), M.gloss(C.accent))); });
  // cordones y lengüeta
  for (let i = 0; i < 5; i++) { const u = -0.02 + i * 0.085, w = P.wd(u), h = P.ht(u), pts = []; for (let t = -1; t <= 1.01; t += 0.5) pts.push(V(t * 0.42 * w, h * Math.pow(1 - (0.42 * t) ** 2, 0.36) + 0.008, u * P.L)); up.add(mk(tube(pts, ry * 0.085, 14, 5), M.satin(0xffffff))); [-1, 1].forEach((k) => { const q = pts[k < 0 ? 0 : 4]; up.add(at(mk(new THREE.TorusGeometry(ry * 0.14, ry * 0.045, 6, 12), M.gold()), q.x, q.y, q.z)); }); }
  const tg = mk(rbox(W * 0.26, uh * 0.34, L * 0.07, 0.01), M.fabric('felt', 0xf3f1ec, { rough: 0.8 })); tg.position.set(0, P.ht(-0.06) * 0.96, -0.06 * P.L); tg.rotation.x = -0.45; up.add(tg);
  // burbujas de aire laterales
  [-1, 1].forEach((k) => g.add(at(mk(rbox(0.03, hs * 0.55, L * 0.22, 0.01), M.glass(C.accent, 0.6)), k * W * 0.49, by + hs * 0.62, -L * 0.2)));
  if (o.led) { const neonM = M.neon(0x39e5ff, 1.8); g.add(at(mk(soleGeo(W * 1.03, L * 1.03, hs * 0.12, hs * 0.05), neonM), 0, by + hs * 0.5, 0)); g.userData.neon = neonM; }
  return g;
}
export function zapatillas({ A, S, C }) { return { parts: both(A, (s) => sneaker(A, s, C)), reg: shoeReg(A) }; }
export function zapatillasLED({ A, S, C }) { const gs = [], parts = both(A, (s) => { const g = sneaker(A, s, C, { led: true, sole: 1.0 }); gs.push(g); return g; }); return { parts, reg: shoeReg(A), tick(t) { gs.forEach((g) => g.userData.neon && g.userData.neon.color.copy(hsl(t * 0.2, 1, 0.55)).multiplyScalar(1.8)); } }; }
export function botas({ A, S, C }) {
  return { reg: shoeReg(A), parts: both(A, (s) => { const [rx, ry, rz] = A.foot.r, g = grp(), W = rx * 2.25, L = rz * 2.2, hs = ry * 0.9, by = -ry - 0.012, lm = M.fabric('leather', C.main, { amp: 0.22, rough: 0.4 });
    g.add(at(mk(rbox(W * 1.04, hs, L * 1.03, hs * 0.4, 5), M.rubber(0x0f1013)), 0, by + hs / 2, 0));
    for (let i = 0; i < 9; i++) { const z = (i / 8 - 0.5) * L * 0.9; g.add(at(mk(rbox(W * 1.07, hs * 0.2, L * 0.06, 0.01), M.rubber(0x0f1013)), 0, by + hs * 0.18, z)); }
    const up = mk(new THREE.SphereGeometry(1, 44, 30, 0, PI * 2, 0, PI * 0.5), lm); up.scale.set(W * 0.5 * 0.94, ry * 2.0, L * 0.5 * 0.97); up.position.set(0, by + hs, 0); g.add(up);
    const sh = mk(new THREE.CylinderGeometry(rx * 0.95, rx * 1.05, ry * 3.4, 36, 1, true), new THREE.MeshPhysicalMaterial({ color: C.main, roughness: 0.4, side: THREE.DoubleSide, clearcoat: 0.3 })); sh.material = lm.clone(); sh.material.side = THREE.DoubleSide; sh.position.set(0, by + hs + ry * 2.0, -L * 0.1); g.add(sh);
    g.add(at(mk(torus(rx * 1.0, ry * 0.2, PI * 2, 10, 36), M.fabric('leather', C.accent, { amp: 0.1 })), 0, by + hs + ry * 3.7, -L * 0.1)).rotation.x = 0; g.children[g.children.length - 1].rotation.x = PI / 2;
    for (let i = 0; i < 7; i++) { const y = by + hs + ry * (0.9 + i * 0.4), z = L * 0.2 - i * 0.012; g.add(mk(tube([V(-rx * 0.35, y, z + 0.15 * rx), V(0, y + 0.02, z + 0.2 * rx), V(rx * 0.35, y, z + 0.15 * rx)], 0.011 * ry / 0.1, 10, 5), M.satin(0x111111))); [-1, 1].forEach((k) => g.add(at(mk(new THREE.TorusGeometry(0.016 * ry / 0.1, 0.005, 6, 12), M.gold()), k * rx * 0.35, y, z + 0.15 * rx))); }
    const bk = mk(rbox(rx * 0.7, ry * 0.16, 0.02, 0.006), M.silver()); bk.position.set(s * rx * 0.2, by + hs + ry * 2.9, L * 0.2); g.add(bk); return g; }) };
}
