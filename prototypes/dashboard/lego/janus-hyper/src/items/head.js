/* accesorios de cabeza, auriculares y cara: se construyen en una cabeza de referencia (radio ≈ 0.6) y se escalan a cada criatura */
import { THREE, V, PI, mk, rbox, lathe, tube, torus, grp, at, rotd, sc, ball, ellipsoid, arcPts, bend, star, extrude, polarShape, glow, hsl, roundRectShape } from '../kit.js';
import * as M from '../mats.js';

const headTop = (A, S, g) => [{ bone: 'head', obj: sc(g, S), at: A.head.top }];
const headC = (A, S, g) => [{ bone: 'head', obj: sc(g, S), at: A.head.c }];
const faceP = (A, S, g) => [{ bone: 'head', obj: sc(g, S), at: A.face.c }];

/* ---------- CABEZA ---------- */
export function gorra({ A, S, C }) {
  const g = grp(), cloth = M.fabric('weave', C.main), brimM = M.fabric('weave', C.main, { rough: 0.7 });
  const dome = mk(new THREE.SphereGeometry(0.67, 56, 36, 0, PI * 2, 0, PI * 0.52), cloth); dome.scale.set(1, 0.82, 1.08); dome.position.set(0, -0.3, -0.02); g.add(dome);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2, pts = []; for (let k = 0; k <= 14; k++) { const th = (k / 14) * PI * 0.5; pts.push(V(Math.sin(th) * Math.sin(a) * 0.675, Math.cos(th) * 0.675 * 0.82 - 0.3, Math.sin(th) * Math.cos(a) * 0.675 * 1.08 - 0.02)); } g.add(mk(tube(pts, 0.007, 20, 5), M.gloss(C.accent, { roughness: 0.5 }))); }
  g.add(at(ball(0.052, M.gloss(C.accent)), 0, 0.26, -0.02));
  const sh = new THREE.Shape(); sh.absellipse(0, 0, 0.56, 0.78, 0, PI, false); sh.closePath();
  const bg = new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 36 }); bg.rotateX(PI / 2); bend(bg, (v) => { v.y -= v.z * v.z * 0.34; });
  const brim = mk(bg, brimM); brim.position.set(0, -0.36, 0.1); g.add(brim);
  for (let r = 0; r < 3; r++) { const pts = []; for (let k = 0; k <= 20; k++) { const a = (k / 20) * PI; const x = Math.cos(a) * (0.5 - r * 0.07), z = Math.sin(a) * (0.7 - r * 0.07) + 0.1; pts.push(V(x, -0.36 + 0.021 - z * z * 0.34, z)); } g.add(mk(tube(pts, 0.004, 30, 4), M.gloss(C.accent, { roughness: 0.6 }))); }
  // gorra echada hacia atrás: la visera sube y no tapa los ojos ni las gafas
  const pv = grp(), o = grp(); pv.position.set(0, -0.3, 0); g.position.set(0, 0.3, 0); pv.add(g); pv.rotation.x = -0.3; o.add(pv);
  return { parts: headTop(A, S, o), hides: [] };
}
export function gorro({ A, S, C }) {
  const g = grp(), knit = M.fabric('knit', C.main, { rough: 0.95 });
  const dome = mk(new THREE.SphereGeometry(0.66, 56, 36, 0, PI * 2, 0, PI * 0.55), knit); dome.scale.set(1, 0.95, 1.08); dome.position.set(0, -0.26, -0.02); g.add(dome);
  const cuff = mk(torus(0.64, 0.13, PI * 2, 18, 64), M.fabric('knit', C.accent, { rough: 0.95 })); cuff.rotation.x = PI / 2; cuff.scale.set(1, 1.08, 1); cuff.position.set(0, -0.3, -0.02); g.add(cuff);
  const pom = ball(0.2, M.fabric('felt', C.accent, { rough: 1, sheen: 1 }), 32, 22); pom.position.set(0, 0.34, -0.02); g.add(pom);
  return { parts: headTop(A, S, g) };
}
export function copa({ A, S, C }) {
  const g = grp(), sat = M.satin(0x14121a, { roughness: 0.3 });
  g.add(at(mk(lathe([[0.0, 0], [0.54, 0], [0.54, 0.7], [0.52, 0.78], [0.46, 0.8], [0.0, 0.8]]), sat), 0, -0.2, 0));
  g.add(at(mk(lathe([[0.4, 0], [0.9, 0.01], [1.0, 0.06], [0.99, 0.1], [0.9, 0.05], [0.4, 0.045]], 72), sat), 0, -0.34, 0));
  g.add(at(mk(lathe([[0.54, 0], [0.545, 0.14], [0.54, 0.15], [0.535, 0.0]]), M.satin(C.accent)), 0, -0.14, 0)); const band = mk(lathe([[0.535, 0], [0.56, 0.0], [0.56, 0.17], [0.535, 0.17]]), M.satin(C.accent)); band.position.set(0, -0.14, 0); g.add(band);
  const bk = mk(rbox(0.2, 0.22, 0.04, 0.02), M.gold()); bk.position.set(0, -0.04, 0.565); g.add(bk); const bi = mk(rbox(0.12, 0.14, 0.05, 0.015), M.satin(C.accent)); bi.position.set(0, -0.04, 0.57); g.add(bi);
  return { parts: headTop(A, S, g) };
}
export function corona({ A, S, C }) {
  const g = grp(), au = M.gold(), rub = M.gem(0xe0113a), sap = M.gem(0x1f6bff), emr = M.gem(0x1fbf6a), gems = [rub, sap, emr, rub, sap];
  g.add(at(mk(lathe([[0.6, 0], [0.66, 0.015], [0.67, 0.24], [0.62, 0.27], [0.585, 0.24], [0.58, 0.015]], 80), au), 0, -0.26, 0));
  for (let i = 0; i < 5; i++) { const a = (i / 5) * PI * 2, x = Math.sin(a) * 0.63, z = Math.cos(a) * 0.63, h = i % 2 ? 0.34 : 0.46;
    const sp = mk(lathe([[0.12, 0], [0.095, 0.1], [0.05, h * 0.62], [0.025, h * 0.88], [0.0, h]], 24), au); sp.position.set(x, -0.0, z); g.add(sp); const tip = ball(0.05, au, 20, 14); tip.position.set(x, h + 0.02, z); g.add(tip);
    const gm = mk(new THREE.SphereGeometry(0.055, 20, 14), gems[i]); gm.scale.set(1, 1.25, 0.8); gm.position.set(x * 1.02, -0.13, z * 1.02); gm.lookAt(x * 3, -0.13, z * 3); g.add(gm);
    const gem2 = mk(new THREE.OctahedronGeometry(0.05), gems[(i + 2) % 5]); gem2.position.set(x * 1.0, h * 0.4, z * 1.02); g.add(gem2);
    const nx = Math.sin(a + PI / 5) * 0.63, nz = Math.cos(a + PI / 5) * 0.63; for (let k = 0; k < 3; k++) { const p = mk(new THREE.SphereGeometry(0.018, 10, 8), au); p.position.set(nx * 1.03, -0.14 + (k - 1) * 0.07, nz * 1.03); g.add(p); } }
  g.add(at(mk(lathe([[0, 0], [0.58, 0.0], [0.57, 0.1], [0.45, 0.2], [0.0, 0.22]], 48), M.satin(0x8a0f2a)), 0, -0.3, 0));
  return { parts: headTop(A, S, g) };
}
export function orejasGato({ A, S, C }) {
  const g = grp(), band = mk(tube(arcPts(0.6, 0.35, PI - 0.35, 30, (a) => V(Math.cos(a) * 0.6, Math.sin(a) * 0.6 * 0.9 - 0.2, 0)), 0.03, 40, 10), M.gloss(0x111018)); g.add(band);
  [-1, 1].forEach((s) => { const e = grp(); const o = mk(new THREE.ConeGeometry(0.2, 0.42, 4, 1), M.fabric('felt', C.main, { rough: 1, sheen: 1 })); o.scale.z = 0.5; o.rotation.y = PI / 4; e.add(o); const i = mk(new THREE.ConeGeometry(0.13, 0.3, 4, 1), M.satin(0xff9db8, { roughness: 0.6 })); i.scale.z = 0.4; i.rotation.y = PI / 4; i.position.set(0, -0.03, 0.045); e.add(i); e.position.set(s * 0.36, 0.1, 0); e.rotation.z = -s * 0.28; e.scale.setScalar(1.3); g.add(e); const gl = mk(new THREE.SphereGeometry(0.03, 12, 8), M.gold()); gl.position.set(s * 0.58, -0.05, 0.03); g.add(gl); });
  return { parts: headTop(A, S, g) };
}
export function vaquero({ A, S, C }) {
  const g = grp(), felt = M.fabric('felt', C.main, { rough: 0.95, sheen: 0.6 });
  const crown = mk(lathe([[0.0, 0], [0.5, 0], [0.5, 0.42], [0.46, 0.58], [0.32, 0.62], [0.2, 0.56], [0.0, 0.5]], 56), felt); crown.position.set(0, -0.22, 0); g.add(crown);
  const bg = lathe([[0.4, 0.0], [0.9, 0.01], [1.15, 0.04], [1.2, 0.07], [1.15, 0.065], [0.9, 0.035], [0.4, 0.03]], 72); bend(bg, (v) => { v.y += (v.x * v.x) * 0.45 - (v.z * v.z) * 0.12; }); g.add(at(mk(bg, felt), 0, -0.34, 0));
  const band = mk(lathe([[0.5, 0], [0.525, 0], [0.525, 0.11], [0.5, 0.11]]), M.fabric('leather', C.accent)); band.position.set(0, -0.2, 0); g.add(band);
  for (let i = 0; i < 6; i++) { const a = -0.9 + i * 0.36, c = mk(new THREE.CylinderGeometry(0.035, 0.035, 0.015, 16), M.gold()); c.rotation.x = PI / 2; c.position.set(Math.sin(a) * 0.53, -0.145, Math.cos(a) * 0.53); c.lookAt(Math.sin(a) * 2, -0.145, Math.cos(a) * 2); c.rotateX(PI / 2); g.add(c); }
  return { parts: headTop(A, S, g) };
}
export function flores({ A, S, C }) {
  const g = grp(), ring = mk(torus(0.64, 0.025, PI * 2, 8, 64), M.fabric('felt', 0x3f8f3a)); ring.rotation.x = PI / 2; ring.position.y = -0.2; ring.scale.set(1, 1.08, 1); g.add(ring);
  const cols = [C.main, C.accent, 0xffffff, 0xffd34d, 0xff7aa8]; const pm = (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.45, sheen: 1, sheenColor: new THREE.Color(0xffffff), side: THREE.DoubleSide, envMapIntensity: 1 });
  for (let i = 0; i < 9; i++) { const a = (i / 9) * PI * 2, f = grp(), n = 6, col = cols[i % cols.length], mat = pm(col);
    for (let k = 0; k < n; k++) { const pg = new THREE.SphereGeometry(0.1, 16, 12); pg.scale(0.55, 1.2, 0.14); pg.translate(0, 0.12, 0); const p = mk(pg, mat); p.rotation.z = (k / n) * PI * 2; f.add(p); }
    f.add(at(ball(0.05, M.gloss(0xffbf1f)), 0, 0, 0.025)); f.position.set(Math.sin(a) * 0.68, -0.2 + (i % 2) * 0.03, Math.cos(a) * 0.68 * 1.08); f.lookAt(Math.sin(a) * 3, -0.2, Math.cos(a) * 3); f.scale.setScalar(0.85 + (i % 3) * 0.12); g.add(f); }
  return { parts: headTop(A, S, g) };
}
export function lazo({ A, S, C }) {
  const g = grp(), m = M.satin(C.main, { roughness: 0.3 }), b = grp();
  [-1, 1].forEach((s) => { const lg = new THREE.SphereGeometry(0.2, 28, 18); lg.scale(1.15, 0.78, 0.38); lg.translate(s * 0.26, 0, 0); b.add(mk(lg, m)); const tl = mk(new THREE.ConeGeometry(0.1, 0.34, 12), m); tl.scale.z = 0.3; tl.rotation.z = s * 2.4; tl.position.set(s * 0.12, -0.22, -0.02); b.add(tl); });
  b.add(at(ellipsoid(0.1, 0.12, 0.1, M.satin(C.accent)), 0, 0, 0.02)); b.position.set(0.0, 0.18, 0.0); b.scale.setScalar(1.4); g.add(b);
  return { parts: [{ bone: 'head', obj: sc(g, S), at: A.head.side ? A.head.side : A.head.top }] };
}
export function halo({ A, S, C }) {
  const g = grp(); const t = mk(torus(0.5, 0.04, PI * 2, 16, 72), M.gold({ emissive: 0xffb020, emissiveIntensity: 0.75 })); t.rotation.x = PI / 2; t.scale.set(1, 1.0, 1); g.add(t); g.add(at(glow(0xffd36a, 1.5, 0.5), 0, 0, 0)); g.position.y = 0;
  const parts = [{ bone: 'head', obj: sc(g, S), at: [A.head.top[0], A.head.top[1] + 0.55 * S, A.head.top[2]] }];
  return { parts, tick(t) { g.position.y = Math.sin(t * 2) * 0.03; g.rotation.y = t * 0.8; } };
}

/* ---------- AURICULARES ---------- */
function cups(g, mat, ring, pad, r, x) { [-1, 1].forEach((s) => { const c = mk(new THREE.CylinderGeometry(r, r, 0.17, 40), mat); c.rotation.z = PI / 2; c.position.set(s * x, 0, 0); g.add(c); const p = mk(torus(r * 0.82, 0.07, PI * 2, 14, 40), pad); p.rotation.y = PI / 2; p.position.set(s * (x - 0.1), 0, 0); g.add(p); const rg = mk(new THREE.CylinderGeometry(r * 0.78, r * 0.78, 0.02, 40), ring); rg.rotation.z = PI / 2; rg.position.set(s * (x + 0.092), 0, 0); g.add(rg); }); }
export function auricGamer({ A, S, C }) {
  const g = grp(), blk = M.gloss(0x14141c, { roughness: 0.3 }), neonM = M.neon(0x39e5ff, 1.6), pad = M.fabric('leather', 0x1d1d26);
  g.add(mk(tube(arcPts(0.72, 0.0, PI, 40, (a) => V(Math.cos(a) * 0.72, Math.sin(a) * 0.62, 0)), 0.04, 56, 10), blk)); g.add(mk(tube(arcPts(0.7, 0.2, PI - 0.2, 30, (a) => V(Math.cos(a) * 0.7, Math.sin(a) * 0.6 + 0.045, 0)), 0.012, 40, 6), neonM));
  cups(g, blk, neonM, pad, 0.26, 0.74); const mic = grp(), arm = mk(tube([V(-0.78, -0.02, 0.1), V(-0.72, -0.2, 0.42), V(-0.5, -0.38, 0.72), V(-0.26, -0.42, 0.78)], 0.016, 30, 6), blk); mic.add(arm); mic.add(at(mk(new THREE.CapsuleGeometry(0.04, 0.07, 8, 14), M.gloss(0x2a2a34)), -0.2, -0.42, 0.78)); g.add(mic);
  const parts = [{ bone: 'head', obj: sc(g, S), at: A.head.ears || A.head.c }]; return { parts, tick(t) { neonM.color.copy(hsl(t * 0.15, 1, 0.55)).multiplyScalar(1.6); } };
}
export function auricEstudio({ A, S, C }) {
  const g = grp(), w = M.gloss(C.main, { roughness: 0.35 }), au = M.gold(), pad = M.fabric('leather', 0xf4efe6);
  g.add(mk(tube(arcPts(0.72, 0.0, PI, 40, (a) => V(Math.cos(a) * 0.72, Math.sin(a) * 0.62, 0)), 0.05, 56, 10), w)); g.add(mk(tube(arcPts(0.72, 0.5, PI - 0.5, 20, (a) => V(Math.cos(a) * 0.72, Math.sin(a) * 0.62 + 0.05, 0)), 0.012, 30, 6), au));
  cups(g, w, au, pad, 0.27, 0.74); [-1, 1].forEach((s) => { const sl = mk(rbox(0.04, 0.26, 0.06, 0.01), au); sl.position.set(s * 0.7, 0.2, 0); g.add(sl); });
  return { parts: [{ bone: 'head', obj: sc(g, S), at: A.head.ears || A.head.c }] };
}

/* ---------- CARA ---------- */
const temples = (g, mat, x, len = 0.8) => [-1, 1].forEach((s) => g.add(mk(tube([V(s * x, 0, 0), V(s * (x + 0.02), 0, -len * 0.5), V(s * (x + 0.04), -0.04, -len)], 0.017, 12, 6), mat)));
export function gafasAviador({ A, S, C }) {
  const g = grp(), fr = M.gold(), lens = M.mirror(C.main);
  const lensShape = polarShape((a) => 0.3 * (1 - 0.18 * Math.sin(a - 1.57) * Math.max(0, -Math.sin(a - 1.57) * 0) - 0.12 * Math.cos(a * 2)) * (a > PI ? 1.0 + 0.12 * Math.sin(a) * -1 : 1.0), 64);
  [-1, 1].forEach((s) => { const ls = new THREE.ShapeGeometry(lensShape, 32); ls.scale(1.05, 1.0, 1); const l = mk(ls, lens); l.material.side = THREE.DoubleSide; l.position.set(s * 0.34, -0.02, 0); g.add(l);
    const pts = lensShape.getPoints(64).map((p) => V(p.x * 1.05 + s * 0.34, p.y - 0.02, 0)); g.add(mk(tube(pts, 0.014, 80, 8, true), fr)); });
  g.add(mk(tube([V(-0.06, 0.08, 0), V(0, 0.12, 0.02), V(0.06, 0.08, 0)], 0.014, 12, 6), fr)); g.add(mk(tube([V(-0.06, 0.02, 0.0), V(0, 0.04, 0.02), V(0.06, 0.02, 0)], 0.012, 12, 6), fr)); temples(g, fr, 0.66, 0.9);
  return { parts: faceP(A, S, g) };
}
export function gafasRedondas({ A, S, C }) {
  const g = grp(), fr = M.gold(), lens = M.glass(0xcfe8ff, 0.16);
  [-1, 1].forEach((s) => { const r = mk(torus(0.29, 0.014, PI * 2, 8, 64), fr); r.position.set(s * 0.35, 0, 0); g.add(r); const l = mk(new THREE.CircleGeometry(0.29, 40), lens); l.position.set(s * 0.35, 0, 0); g.add(l); });
  g.add(mk(tube([V(-0.06, 0.05, 0), V(0, 0.1, 0.02), V(0.06, 0.05, 0)], 0.014, 12, 6), fr)); temples(g, fr, 0.64, 0.85);
  return { parts: faceP(A, S, g) };
}
export function gafasEstrella({ A, S, C }) {
  const g = grp(), fr = M.gloss(C.main, { roughness: 0.2 }), lens = M.glass(0xff9ad0, 0.45);
  [-1, 1].forEach((s) => { const sh = star(0.4, 0.2), hole = new THREE.Path(); const hs = star(0.3, 0.14).getPoints(); hole.moveTo(hs[0].x, hs[0].y); hs.forEach((p) => hole.lineTo(p.x, p.y)); sh.holes.push(hole);
    const f = mk(new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 3 }), fr); f.position.set(s * 0.37, 0.0, -0.02); g.add(f);
    const l = mk(new THREE.ShapeGeometry(star(0.3, 0.14)), lens); l.position.set(s * 0.37, 0, 0.0); g.add(l); });
  g.add(mk(tube([V(-0.05, 0.02, 0), V(0, 0.05, 0.02), V(0.05, 0.02, 0)], 0.018, 12, 6), fr)); temples(g, fr, 0.7, 0.8);
  return { parts: faceP(A, S, g) };
}
export function gafasDeporte({ A, S, C }) {
  const g = grp(), lens = M.mirror(C.main), fr = M.gloss(0x15151c); lens.emissive = new THREE.Color(C.main); lens.emissiveIntensity = 0.45;
  const geo = new THREE.CylinderGeometry(0.82, 0.82, 0.4, 56, 1, true, -0.78, 1.56); geo.rotateY(0); const l = mk(geo, lens); l.material.side = THREE.DoubleSide; l.position.set(0, -0.02, -0.7); g.add(l);
  const top = mk(tube(arcPts(0.83, -0.78, 0.78, 28, (a) => V(Math.sin(a) * 0.83, 0.2, Math.cos(a) * 0.83 - 0.7)), 0.02, 40, 6), fr), bot = mk(tube(arcPts(0.83, -0.78, 0.78, 28, (a) => V(Math.sin(a) * 0.83, -0.24, Math.cos(a) * 0.83 - 0.7)), 0.014, 40, 6), fr); g.add(top, bot);
  g.add(mk(rbox(0.1, 0.18, 0.06, 0.02), fr)).position.set(0, -0.06, 0.1); temples(g, fr, 0.64, 0.8); return { parts: faceP(A, S, g) };
}
export function visorVR({ A, S, C }) {
  const g = grp(), body = M.gloss(0xf2f2f6, { roughness: 0.3 }), scr = M.gloss(0x05060a, { roughness: 0.04 }), neonM = M.neon(C.main, 1.8);
  const b = mk(rbox(1.55, 0.58, 0.46, 0.18, 6), body); b.position.set(0, 0, 0.05); g.add(b); const f = mk(rbox(1.4, 0.44, 0.06, 0.15, 6), scr); f.position.set(0, 0, 0.27); g.add(f);
  g.add(at(mk(rbox(1.34, 0.025, 0.02, 0.01), neonM), 0, 0.0, 0.31)); [-1, 1].forEach((s) => g.add(at(mk(torus(0.1, 0.012, PI * 2, 8, 24), neonM), s * 0.45, 0.0, 0.305)));
  const strap = mk(torus(0.74, 0.05, PI * 2, 10, 72), M.fabric('weave', 0x23232b)); strap.rotation.x = PI / 2; strap.position.set(0, 0, -0.72); strap.scale.set(1, 1.1, 1); g.add(strap);
  return { parts: faceP(A, S, g) };
}
export function antifaz({ A, S, C }) {
  const g = grp(), sat = M.satin(C.main, { roughness: 0.35 });
  const sh = new THREE.Shape(); sh.moveTo(0, 0.1); sh.bezierCurveTo(0.2, 0.2, 0.6, 0.3, 0.84, 0.18); sh.bezierCurveTo(0.95, 0.08, 0.9, -0.2, 0.7, -0.26); sh.bezierCurveTo(0.5, -0.3, 0.3, -0.12, 0.0, -0.08); sh.bezierCurveTo(-0.3, -0.12, -0.5, -0.3, -0.7, -0.26); sh.bezierCurveTo(-0.9, -0.2, -0.95, 0.08, -0.84, 0.18); sh.bezierCurveTo(-0.6, 0.3, -0.2, 0.2, 0, 0.1);
  [-1, 1].forEach((s) => { const h = new THREE.Path(); h.absellipse(s * 0.38, -0.02, 0.17, 0.12, 0, PI * 2, false); sh.holes.push(h); });
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.035, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2, curveSegments: 24 }); bend(geo, (v) => { v.z -= v.x * v.x * 0.5; }); g.add(mk(geo, sat));
  const rim = []; g.add(mk(torus(0.01, 0.01), M.gold())); // placeholder pequeño (sin efecto)
  for (let i = 0; i < 12; i++) { const a = (i / 12) * PI, x = Math.cos(a) * 0.8, y = 0.12 + Math.sin(a) * 0.04; const gm = mk(new THREE.OctahedronGeometry(0.018), M.gold()); gm.position.set(x, y, 0.05 - x * x * 0.5); g.add(gm); }
  return { parts: faceP(A, S, g) };
}
export function gafasPixel({ A, S, C }) {
  const g = grp(), blk = M.gloss(0x0a0a10, { roughness: 0.2 }), hi = M.neon(0x39ff9a, 1.5);
  [-1, 1].forEach((s) => { const l = mk(rbox(0.56, 0.3, 0.1, 0.02), blk); l.position.set(s * 0.34, 0, 0); g.add(l); const h = mk(rbox(0.12, 0.05, 0.02, 0.005), hi); h.position.set(s * 0.34 - 0.14, 0.07, 0.056); g.add(h); const h2 = mk(rbox(0.06, 0.05, 0.02, 0.005), hi); h2.position.set(s * 0.34 - 0.14, -0.0, 0.056); g.add(h2); });
  g.add(at(mk(rbox(0.16, 0.1, 0.1, 0.02), blk), 0, 0.06, 0)); g.add(at(mk(rbox(0.07, 0.07, 0.07, 0.02), blk), 0, -0.04, 0.0)); temples(g, blk, 0.64, 0.8);
  return { parts: faceP(A, S, g) };
}
