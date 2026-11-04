/* accesorios de cuello: se construyen alrededor de la elipse del cuello de cada criatura (A.neck = { c, rx, rz }) */
import { THREE, V, PI, mk, rbox, lathe, tube, torus, grp, at, rotd, sc, ball, ellipsoid, arcPts, bend, star, extrude, glow, hsl, mergeGeometries } from '../kit.js';
import * as M from '../mats.js';

const ring = (A, off = 0, n = 64, dy = 0) => { const { rx, rz } = A.neck; const p = []; for (let i = 0; i < n; i++) { const a = (i / n) * PI * 2; p.push(V(Math.cos(a) * (rx + off), dy, Math.sin(a) * (rz + off))); } return p; };
const at_ = (A, a, off = 0, dy = 0) => { const { rx, rz } = A.neck; return V(Math.cos(a) * (rx + off), dy, Math.sin(a) * (rz + off)); };
const out = (A, g) => [{ bone: 'spine', obj: g, at: A.neck.c }];
const FRONT = PI / 2;

export function bufanda({ A, S, C }) {
  const g = grp(), R = 0.13 * S;
  const tg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ring(A, R * 0.55, 72), true), 120, R, 20, true);
  const col = new THREE.Color(C.main), acc = new THREE.Color(C.accent), cs = [], p = tg.attributes.position; for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), k = Math.floor(((a + PI) / (PI * 2)) * 18) % 2; const c = k ? acc : col; cs.push(c.r, c.g, c.b); }
  tg.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3)); g.add(mk(tg, M.fabric('knit', 0xffffff, { vc: true, rough: 0.95 })));
  const tail = new THREE.PlaneGeometry(0.3 * S, 0.9 * S, 10, 28); const tp = tail.attributes.position, tc = [];
  for (let i = 0; i < tp.count; i++) { const y = tp.getY(i), x = tp.getX(i); const t = (y + 0.45 * S) / (0.9 * S); tp.setZ(i, Math.sin(x * 9) * 0.012 + (1 - t) * 0.0 + 0.03 * Math.sin(t * 3 + x * 4)); const k = Math.floor(t * 9) % 2; const c = k ? acc : col; tc.push(c.r, c.g, c.b); }
  tail.setAttribute('color', new THREE.Float32BufferAttribute(tc, 3)); tail.computeVertexNormals();
  const tm = M.fabric('knit', 0xffffff, { vc: true, rough: 0.95, side: THREE.DoubleSide }); const t = mk(tail, tm); t.position.set(A.neck.rx * 0.38, -0.5 * S, A.neck.rz + R * 1.3); t.rotation.z = -0.06; g.add(t);
  for (let i = 0; i < 7; i++) { const f = mk(tube([V(0, 0, 0), V(0.004, -0.06 * S, 0.01), V(0, -0.13 * S, 0.0)], 0.011 * S, 8, 5), M.fabric('knit', 0xffffff, { vc: false, rough: 1 })); f.material.color.set(i % 2 ? acc : col); f.position.set(A.neck.rx * 0.38 - 0.13 * S + i * 0.043 * S, -0.95 * S, A.neck.rz + R * 1.3); g.add(f); }
  return { parts: out(A, g) };
}
export function pajarita({ A, S, C }) {
  const g = grp(), m = M.satin(C.main, { roughness: 0.3 }), knot = M.satin(C.accent), z = A.neck.rz + 0.03;
  g.add(mk(tube(ring(A, 0.03, 72), 0.045 * S, 96, 10, true), M.satin(0xf4f1ea, { roughness: 0.5 })));
  [-1, 1].forEach((s) => { const w = new THREE.SphereGeometry(0.19 * S, 28, 18); w.scale(1.1, 0.78, 0.45); bend(w, (v) => { v.x += 0; }); const m1 = mk(w, m); m1.position.set(s * 0.21 * S, 0, z + 0.09 * S); m1.rotation.z = s * 0.1; g.add(m1);
    for (let k = -2; k <= 2; k++) { const l = mk(tube([V(s * 0.06 * S, k * 0.025 * S, z + 0.14 * S), V(s * 0.2 * S, k * 0.05 * S, z + 0.19 * S), V(s * 0.34 * S, k * 0.07 * S, z + 0.14 * S)], 0.004 * S, 12, 4), M.satin(C.accent, { roughness: 0.4 })); g.add(l); } });
  g.add(at(ellipsoid(0.065 * S, 0.1 * S, 0.075 * S, knot), 0, 0, z + 0.14 * S));
  return { parts: out(A, g) };
}
export function perlas({ A, S, C }) {
  const g = grp(), pm = M.pearl(), n = 40, au = M.gold();
  for (let i = 0; i < n; i++) { const a = (i / n) * PI * 2, sag = Math.max(0, Math.cos(a - FRONT)) ** 2; const p = at_(A, a, 0.05 * S + sag * 0.04, -sag * 0.2 * S); const b = ball((0.052 + sag * 0.012) * S, pm, 24, 16); b.position.copy(p); g.add(b); }
  const fa = at_(A, FRONT, 0.09 * S, -0.27 * S); const pendant = ball(0.1 * S, pm, 28, 18); pendant.position.copy(fa).add(V(0, -0.13 * S, 0)); g.add(pendant);
  const cap = mk(new THREE.ConeGeometry(0.05 * S, 0.07 * S, 16), au); cap.position.copy(fa).add(V(0, -0.04 * S, 0)); cap.rotation.x = PI; g.add(cap);
  return { parts: out(A, g) };
}
export function cadenaOro({ A, S, C }) {
  const g = grp(), au = M.gold({ roughness: 0.14 }), n = 54, MB = new THREE.Matrix4(), T = new THREE.Vector3(), Uv = new THREE.Vector3(), Sd = new THREE.Vector3(), tmp = new THREE.Vector3();
  const pt = (i) => { const a = (i / n) * PI * 2, sag = Math.max(0, Math.cos(a - FRONT)) ** 2; return at_(A, a, 0.07 * S, -sag * 0.18 * S); };
  for (let i = 0; i < n; i++) {
    const p = pt(i), nx = pt(i + 1), pv = pt(i - 1); T.copy(nx).sub(pv).normalize(); Uv.set(0, 1, 0).addScaledVector(T, -T.y).normalize(); Sd.crossVectors(T, Uv).normalize();
    const l = mk(new THREE.TorusGeometry(0.052 * S, 0.017 * S, 10, 22), au); l.scale.set(1, 0.6, 1);
    if (i % 2) MB.makeBasis(T, Uv, Sd); else MB.makeBasis(T, tmp.copy(Sd).negate(), Uv);   // eslabones alternos en planos perpendiculares → cadena real
    l.quaternion.setFromRotationMatrix(MB); l.position.copy(p); g.add(l);
  }
  const fa = at_(A, FRONT, 0.11 * S, -0.25 * S), pg = grp();
  const st = extrude(star(0.2, 0.1), 0.05, 0.016); pg.add(mk(st, au)); pg.add(at(mk(new THREE.OctahedronGeometry(0.06), M.gem(C.accent)), 0, 0, 0.05)); pg.scale.setScalar(S * 0.85); pg.position.copy(fa).add(V(0, -0.2 * S, 0.02)); g.add(pg);
  g.add(at(mk(new THREE.TorusGeometry(0.035 * S, 0.012 * S, 10, 20), au), fa.x, fa.y - 0.02 * S, fa.z));
  return { parts: out(A, g) };
}
export function medalla({ A, S, C }) {
  const g = grp(), rb = M.satin(C.main, { roughness: 0.4 }), au = M.gold();
  const rp = (sx) => [V(sx * A.neck.rx * 0.9, 0.05 * S, -A.neck.rz * 0.4), V(sx * A.neck.rx * 0.96, 0.02 * S, A.neck.rz * 0.35), V(sx * A.neck.rx * 0.5, -0.12 * S, A.neck.rz + 0.1 * S), V(sx * 0.05 * S, -0.34 * S, A.neck.rz + 0.12 * S)];
  [-1, 1].forEach((s) => { const c = new THREE.CatmullRomCurve3(rp(s)); const gg = new THREE.TubeGeometry(c, 40, 0.05 * S, 4, false); gg.scale(1, 1, 1); g.add(mk(gg, rb)); });
  g.add(mk(tube(arcPts(1, PI * 0.5, PI * 2.5, 30, (a) => V(Math.cos(a) * A.neck.rx * 0.93, 0.05 * S, Math.sin(a) * A.neck.rz * 0.93)), 0.04 * S, 40, 4), rb));
  const md = grp(), rim = mk(lathe([[0, 0.0], [0.24, 0.0], [0.27, 0.02], [0.27, 0.05], [0.24, 0.065], [0, 0.065]], 56), au); rim.rotation.x = PI / 2; md.add(rim);
  const face = mk(lathe([[0, 0.066], [0.2, 0.066], [0.22, 0.075], [0.2, 0.082], [0, 0.082]], 56), M.gold({ color: 0xffe08a, roughness: 0.12 })); face.rotation.x = PI / 2; md.add(face);
  md.add(at(mk(extrude(star(0.15, 0.07), 0.03, 0.01), au), 0, 0, 0.1)); md.add(at(mk(new THREE.TorusGeometry(0.2, 0.012, 8, 56), au), 0, 0, 0.08));
  md.add(at(mk(rbox(0.12, 0.13, 0.04, 0.015), rb), 0, 0.3, 0.02)); md.scale.setScalar(S); md.position.set(0, -0.5 * S, A.neck.rz + 0.12 * S); g.add(md);
  return { parts: out(A, g) };
}
export function bandana({ A, S, C }) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d'); const base = '#' + new THREE.Color(C.main).getHexString(); x.fillStyle = base; x.fillRect(0, 0, 256, 256); x.strokeStyle = 'rgba(255,255,255,.85)'; x.fillStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 3;
  for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) { const cx = 14 + i * 28 + (j % 2) * 14, cy = 14 + j * 28; x.beginPath(); x.arc(cx, cy, 4, 0, PI * 2); x.fill(); x.beginPath(); x.arc(cx, cy, 10, 0.4, 3.6); x.stroke(); }
  x.lineWidth = 8; x.strokeStyle = 'rgba(255,255,255,.95)'; x.strokeRect(6, 6, 244, 244); const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const g = grp(), mat = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.8, sheen: 0.7, sheenColor: new THREE.Color(0xffffff), side: THREE.DoubleSide, envMapIntensity: 0.7 });
  const w = A.neck.rx * 1.05, d = 0.62 * S, geo = new THREE.PlaneGeometry(1, 1, 24, 24), p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) { const u = uv.getX(i), v = uv.getY(i), t = 1 - v; /* t: 0 arriba, 1 punta */ const half = (1 - t) * w; const x = (u - 0.5) * 2 * half; const y = -t * d + 0.02 * S; const ang = Math.atan2(x, 1) ; const zc = A.neck.rz * Math.sqrt(Math.max(0, 1 - (x / (A.neck.rx + 0.06 * S)) ** 2)) + 0.05 * S + Math.sin(u * 20 + t * 5) * 0.012 * t; p.setXYZ(i, x, y, zc + t * 0.05 * S); }
  geo.computeVertexNormals(); g.add(mk(geo, mat));
  g.add(mk(tube(arcPts(1, 0, PI, 40, (a) => V(Math.cos(a) * (A.neck.rx + 0.04 * S), 0.02 * S, -Math.sin(a) * (A.neck.rz + 0.04 * S))), 0.045 * S, 50, 8), M.fabric('weave', C.main, { rough: 0.85 })));
  return { parts: out(A, g) };
}
export function amuleto({ A, S, C }) {
  const g = grp(), au = M.gold(), crystalM = M.gem(C.main); crystalM.transparent = true; crystalM.opacity = 0.9;
  g.add(mk(tube(ring(A, 0.05, 72), 0.012 * S, 90, 5, true), M.fabric('leather', 0x2a1a10)));
  const cg = grp(), body = mk(lathe([[0, -0.36], [0.1, -0.2], [0.14, 0.0], [0.14, 0.12], [0.08, 0.2], [0.0, 0.26]], 6), crystalM); cg.add(body);
  const cap = mk(lathe([[0.09, 0.2], [0.1, 0.26], [0.06, 0.3], [0.03, 0.3]], 20), au); cg.add(cap); cg.add(at(mk(new THREE.TorusGeometry(0.035, 0.012, 8, 20), au), 0, 0.33, 0));
  const gl = glow(C.main, 0.9, 0.55); cg.add(gl); cg.scale.setScalar(S); cg.position.set(0, -0.28 * S, A.neck.rz + 0.1 * S);
  g.add(cg); const prof = { parts: out(A, g), tick(t) { gl.material.opacity = 0.4 + Math.sin(t * 2.4) * 0.18; cg.rotation.y = Math.sin(t * 1.1) * 0.25; } }; return prof;
}
