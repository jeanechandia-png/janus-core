/* espalda y cintura: mochilas, alas, monopatín, guitarra, riñonera. Origen = punto de contacto con la espalda (z negativo = hacia atrás). */
import { THREE, V, PI, mk, rbox, lathe, tube, torus, grp, at, rotd, sc, ball, ellipsoid, arcPts, bend, star, extrude, glow, hsl, mergeGeometries } from '../kit.js';
import * as M from '../mats.js';
import { feather, wingShape, wingMesh, wingTexture } from '../parts.js';

const place = (A, S, g, dy = 0) => [{ bone: 'spine', obj: sc(g, S), at: [A.back.c[0], A.back.c[1] + dy * S, A.back.c[2]] }];
const depth = (A, S) => (A.garment.front[2] - A.back.c[2]) / S;

export function mochilaTech({ A, S, C }) {
  const g = grp(), nyl = M.fabric('weave', C.main, { rough: 0.7, amp: 0.07 }), acc = M.satin(C.accent, { roughness: 0.4 }), blk = M.gloss(0x0d0d11, { roughness: 0.3 }), D = depth(A, S);
  const body = mk(rbox(0.66, 0.84, 0.32, 0.12, 6), nyl); body.position.set(0, 0.02, -0.18); g.add(body);
  const top = mk(rbox(0.6, 0.2, 0.3, 0.1, 5), M.fabric('weave', C.main, { rough: 0.7 })); top.position.set(0, 0.42, -0.19); g.add(top);
  const pk = mk(rbox(0.5, 0.36, 0.14, 0.07, 5), M.fabric('weave', C.accent, { rough: 0.7 })); pk.position.set(0, -0.12, -0.4); g.add(pk);
  g.add(at(mk(rbox(0.46, 0.012, 0.012, 0.004), M.silver()), 0, 0.04, -0.465)); g.add(at(mk(new THREE.TorusGeometry(0.02, 0.006, 8, 16), M.silver()), 0.22, 0.03, -0.47));
  [-1, 1].forEach((s) => { const bt = mk(new THREE.CylinderGeometry(0.1, 0.1, 0.4, 24), M.gloss(0xdedede)); bt.position.set(s * 0.36, -0.15, -0.2); g.add(bt); const net = mk(new THREE.CylinderGeometry(0.106, 0.106, 0.18, 24, 1, true), nyl); net.position.set(s * 0.36, -0.32, -0.2); g.add(net);
    const st = mk(tube([V(s * 0.2, 0.34, -0.06), V(s * 0.24, 0.5, 0.06), V(s * 0.27, 0.34, D * 0.62), V(s * 0.26, 0.0, D * 0.78), V(s * 0.24, -0.34, D * 0.72)], 0.05, 40, 6), M.fabric('weave', 0x1b1c21, { rough: 0.7 })); st.scale.set(1, 1, 1); g.add(st);
    g.add(at(mk(rbox(0.07, 0.04, 0.025, 0.01), blk), s * 0.26, 0.04, D * 0.8 + 0.03)); });
  g.add(mk(tube([V(-0.26, 0.1, D * 0.78), V(0, 0.12, D * 0.88), V(0.26, 0.1, D * 0.78)], 0.016, 20, 5), M.fabric('weave', 0x1b1c21)));
  g.add(at(mk(rbox(0.1, 0.05, 0.03, 0.01), M.gold({ roughness: 0.2 })), 0, 0.12, D * 0.9 + 0.01));
  const ref = mk(rbox(0.5, 0.025, 0.012, 0.004), M.neon(0xc8f5ff, 1.2)); ref.position.set(0, 0.22, -0.4); g.add(ref);
  return { parts: place(A, S, g, -0.05) };
}
export function skate({ A, S, C }) {
  const g = grp(), cv = document.createElement('canvas'); cv.width = 128; cv.height = 512; const x = cv.getContext('2d');
  const gr = x.createLinearGradient(0, 0, 128, 512); gr.addColorStop(0, '#' + new THREE.Color(C.main).getHexString()); gr.addColorStop(0.55, '#' + new THREE.Color(C.accent).getHexString()); gr.addColorStop(1, '#ffffff'); x.fillStyle = gr; x.fillRect(0, 0, 128, 512);
  x.fillStyle = 'rgba(0,0,0,.28)'; for (let i = 0; i < 7; i++) { x.beginPath(); x.arc(64, 90 + i * 55, 34 - i * 2.5, 0, 6.3); x.fill(); } x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 6; x.strokeRect(5, 5, 118, 502);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const sh = new THREE.Shape(); const L = 0.9, W = 0.21, r = 0.1; sh.moveTo(-W / 2, -L / 2 + r); sh.lineTo(-W / 2, L / 2 - r); sh.quadraticCurveTo(-W / 2, L / 2, 0, L / 2 + 0.03); sh.quadraticCurveTo(W / 2, L / 2, W / 2, L / 2 - r); sh.lineTo(W / 2, -L / 2 + r); sh.quadraticCurveTo(W / 2, -L / 2, 0, -L / 2 - 0.03); sh.quadraticCurveTo(-W / 2, -L / 2, -W / 2, -L / 2 + r);
  const dg = new THREE.ExtrudeGeometry(sh, { depth: 0.035, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.01, bevelSegments: 3, curveSegments: 20 }); bend(dg, (v) => { v.z += Math.pow(Math.abs(v.y) / 0.5, 2.4) * 0.05; });
  const deck = mk(dg, [M.gloss(0x111114, { roughness: 0.9, clearcoat: 0 }), M.gloss(0xffffff)]); deck.material = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.3, clearcoat: 1 }); g.add(deck);
  const grip = mk(new THREE.ShapeGeometry(sh, 20), M.gloss(0x0b0b0d, { roughness: 1, clearcoat: 0 })); grip.position.z = 0.047; g.add(grip);
  [-0.3, 0.3].forEach((y) => { const tr = mk(rbox(0.17, 0.035, 0.05, 0.012), M.silver()); tr.position.set(0, y, -0.045); g.add(tr); [-1, 1].forEach((s) => { const w = mk(new THREE.CylinderGeometry(0.052, 0.052, 0.045, 28), M.gloss(0xfff3d8, { roughness: 0.45 })); w.rotation.z = PI / 2; w.position.set(s * 0.11, y, -0.065); g.add(w); }); });
  const grp2 = grp(); grp2.add(g); g.rotation.set(PI, 0, 0); g.position.z = -0.0; grp2.rotation.z = -0.5; grp2.position.set(0, 0.0, -0.1);
  const st = mk(tube([V(-0.34, 0.15, 0.1), V(-0.1, 0.0, -0.02), V(0.3, -0.2, 0.1)], 0.02, 20, 5), M.fabric('weave', 0x16161a)); const w = grp(grp2, st);
  return { parts: place(A, S, w, 0.0) };
}
export function guitarra({ A, S, C }) {
  const g = grp(), body = new THREE.Shape(); body.moveTo(0, 0.36); body.bezierCurveTo(0.2, 0.4, 0.34, 0.3, 0.28, 0.12); body.bezierCurveTo(0.24, 0.02, 0.3, -0.04, 0.34, -0.14); body.bezierCurveTo(0.4, -0.36, 0.22, -0.46, 0, -0.46); body.bezierCurveTo(-0.22, -0.46, -0.4, -0.36, -0.34, -0.14); body.bezierCurveTo(-0.3, -0.04, -0.24, 0.02, -0.28, 0.12); body.bezierCurveTo(-0.34, 0.3, -0.2, 0.4, 0, 0.36);
  const bg = extrude(body, 0.07, 0.014, 40), cvs = document.createElement('canvas'); cvs.width = cvs.height = 256; const x = cvs.getContext('2d'), rg = x.createRadialGradient(128, 150, 10, 128, 150, 190); rg.addColorStop(0, '#' + new THREE.Color(C.accent).getHexString()); rg.addColorStop(0.55, '#' + new THREE.Color(C.main).getHexString()); rg.addColorStop(1, '#14080c'); x.fillStyle = rg; x.fillRect(0, 0, 256, 256);
  const bm = new THREE.MeshPhysicalMaterial({ color: C.main, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.6 }); const bd = mk(bg, bm); g.add(bd);
  const neck = mk(rbox(0.07, 0.75, 0.04, 0.012), M.fabric('leather', 0x3a2414, { amp: 0.05 })); neck.position.set(0, 0.7, 0.0); g.add(neck);
  for (let i = 0; i < 14; i++) g.add(at(mk(rbox(0.075, 0.006, 0.012, 0.002), M.silver()), 0, 0.4 + i * 0.05, 0.026));
  const hs = mk(rbox(0.1, 0.2, 0.04, 0.02), M.gloss(0x14141a)); hs.position.set(0, 1.18, 0); g.add(hs); [-1, 1].forEach((s) => [0, 1, 2].forEach((k) => g.add(at(mk(new THREE.CylinderGeometry(0.014, 0.014, 0.04, 10), M.chrome()), s * 0.062, 1.12 + k * 0.05, 0))));
  for (let i = 0; i < 6; i++) g.add(mk(tube([V(-0.025 + i * 0.01, 0.34, 0.056), V(-0.025 + i * 0.01, 1.1, 0.034)], 0.0025, 4, 3), M.silver()));
  [0.1, -0.08].forEach((y) => g.add(at(mk(rbox(0.16, 0.05, 0.02, 0.008), M.chrome()), 0, y, 0.058))); g.add(at(mk(rbox(0.22, 0.04, 0.02, 0.01), M.chrome()), 0, -0.3, 0.06)); [0.14, 0.2].forEach((k) => g.add(at(mk(new THREE.CylinderGeometry(0.026, 0.026, 0.03, 18), M.gold()), k, -0.2 - k * 0.2, 0.07)));
  g.add(mk(tube([V(-0.28, 0.1, 0.0), V(-0.4, -0.2, 0.0)], 0.03, 8, 5), M.fabric('leather', 0x1b1b1b)));
  g.scale.setScalar(0.9); const w = grp(g); g.position.set(0, -0.7, -0.14); g.rotation.set(0, PI, 0.34); w.rotation.set(0, 0, 0);
  const strap = mk(tube([V(0.34, 0.34, 0.1), V(0.0, 0.1, D0(A, S) * 0.7), V(-0.3, -0.34, 0.1)], 0.036, 30, 6), M.fabric('weave', C.accent, { rough: 0.8 })); w.add(strap);
  return { parts: place(A, S, w, 0.1) };
}
const D0 = (A, S) => depth(A, S);
export function alasHada({ A, S, C }) {
  const g = grp(), tex = wingTexture(), shape = wingShape(), tint = new THREE.Color(C.main).lerp(new THREE.Color(0xffffff), 0.5), wings = [];
  [-1, 1].forEach((s) => { const mat = new THREE.MeshPhysicalMaterial({ map: tex, color: tint, transparent: true, opacity: 0.88, side: THREE.DoubleSide, roughness: 0.15, clearcoat: 1, iridescence: 1, iridescenceIOR: 1.4, emissive: tint, emissiveIntensity: 0.18, depthWrite: false }); const w = grp(), mem = wingMesh(shape, mat); w.add(mem); w.scale.set(s * 0.5, 0.5, 0.5); w.userData.s = s;
    const vein = (a, l) => mk(tube([V(0, 0, 0.01), V(Math.cos(a) * l * 0.5, Math.sin(a) * l * 0.5 + 0.03, 0.02), V(Math.cos(a) * l, Math.sin(a) * l, 0.03)], 0.01, 12, 4), M.gold({ roughness: 0.3 })); [0.5, 0.9, 1.25, -0.5].forEach((a, i) => w.add(vein(a * 0.75, 1.0 - Math.abs(a) * 0.2)));
    const piv = grp(w); piv.position.set(s * 0.04, 0.1, -0.02); piv.userData.s = s; g.add(piv); wings.push(piv); });
  return { parts: place(A, S, g, 0.05), hides: ['wings'], tick(t) { wings.forEach((p) => { p.rotation.y = p.userData.s * (0.45 + Math.sin(t * 5) * 0.16); }); } };
}
export function alasAngel({ A, S, C }) {
  const g = grp(), wings = [], fm = new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.45, sheen: 1, sheenColor: new THREE.Color(0xfff4d0), side: THREE.DoubleSide, envMapIntensity: 1.2 });
  [-1, 1].forEach((s) => { const w = grp(); const rows = [{ n: 7, len: 0.95, y0: 0.0, a0: 0.5, a1: 1.45 }, { n: 7, len: 0.72, y0: 0.0, a0: 0.15, a1: 1.15 }, { n: 6, len: 0.5, y0: 0.0, a0: -0.1, a1: 0.9 }];
    rows.forEach((r, ri) => { for (let i = 0; i < r.n; i++) { const a = r.a0 + (r.a1 - r.a0) * (i / (r.n - 1)); const f = feather(r.len * (0.78 + 0.22 * Math.sin((i / (r.n - 1)) * PI)), 0.07 + ri * 0.012, 18, fm, 0.12, ['#fff6dc', '#ffffff'], 0.004); f.rotation.z = -(PI / 2 - a) * s + (s < 0 ? PI : 0) * 0; f.rotation.set(0, 0, 0); const pv = grp(f); pv.rotation.z = s * -(PI / 2 - a) * 1.0 - s * 0.0; pv.rotation.y = s * 0.1 * ri; pv.position.set(s * 0.05, 0.1 - ri * 0.02, -0.0 - ri * 0.012 - i * 0.002); w.add(pv); } });
    const piv = grp(w); piv.position.set(s * 0.06, 0.1, -0.03); piv.userData.s = s; piv.rotation.z = s * 0.0; g.add(piv); wings.push(piv); });
  return { parts: place(A, S, g, 0.05), hides: ['wings'], tick(t) { wings.forEach((p) => { p.rotation.y = p.userData.s * (0.18 + Math.sin(t * 1.7) * 0.05); }); } };
}
export function alasDragon({ A, S, C }) {
  const g = grp(), wings = [], bone = M.gloss(0x2a1018, { roughness: 0.4 });
  [-1, 1].forEach((s) => { const w = grp(); const sh = V(0, 0, 0), el = V(s * 0.35, 0.5, -0.02), wr = V(s * 0.8, 0.78, -0.04), tips = [V(s * 1.35, 1.15, -0.05), V(s * 1.5, 0.7, -0.05), V(s * 1.3, 0.2, -0.04), V(s * 0.85, -0.12, -0.03)];
    w.add(mk(tube([sh, el, wr], 0.028, 24, 8), bone)); tips.forEach((tp) => w.add(mk(tube([wr, wr.clone().lerp(tp, 0.5).add(V(0, 0.05, 0)), tp], 0.014, 16, 6), bone))); w.add(at(mk(new THREE.ConeGeometry(0.03, 0.12, 8), M.gloss(0xe8dcc0)), wr.x, wr.y + 0.05, wr.z));
    const pts = [sh, wr, ...tips, V(s * 0.1, -0.2, -0.02)], pos = [], col = [], idx = []; pts.forEach((p, i) => { pos.push(p.x, p.y, p.z); const k = Math.min(1, Math.hypot(p.x, p.y) / 1.6); const c = new THREE.Color(C.main).lerp(new THREE.Color(0x2a0a14), 0.6 * k); col.push(c.r, c.g, c.b); });
    for (let i = 1; i < pts.length - 1; i++) idx.push(0, i, i + 1); idx.push(0, pts.length - 1, 1); const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx.map((v, i) => v)); if (s < 0) { const ix = geo.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } } geo.computeVertexNormals();
    const memm = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.5, side: THREE.DoubleSide, transmission: 0, sheen: 1, sheenColor: new THREE.Color(0xff9a7a), emissive: new THREE.Color(C.main), emissiveIntensity: 0.12 }); w.add(new THREE.Mesh(geo, memm)); const piv = grp(w); piv.position.set(s * 0.06, 0.1, -0.03); piv.userData.s = s; g.add(piv); wings.push(piv); });
  return { parts: place(A, S, g, 0.0), hides: ['wings'], tick(t) { wings.forEach((p) => { p.rotation.y = p.userData.s * (0.3 + Math.sin(t * 2.4) * 0.12); }); } };
}
export function mochilaCohete({ A, S, C }) {
  const g = grp(), met = M.gloss(0xe9edf2, { roughness: 0.22 }), ac = M.gloss(C.main, { roughness: 0.25 }), fl = [];
  [-1, 1].forEach((s) => { const t = grp(); t.add(at(mk(new THREE.CylinderGeometry(0.15, 0.15, 0.7, 36), met), 0, 0.0, 0)); t.add(at(mk(new THREE.ConeGeometry(0.15, 0.22, 36), ac), 0, 0.46, 0)); t.add(at(mk(new THREE.CylinderGeometry(0.155, 0.155, 0.06, 36), ac), 0, 0.12, 0)); t.add(at(mk(new THREE.CylinderGeometry(0.155, 0.155, 0.05, 36), M.chrome()), 0, -0.28, 0));
    t.add(at(mk(new THREE.CylinderGeometry(0.1, 0.13, 0.12, 28, 1, true), M.chrome({ side: THREE.DoubleSide })), 0, -0.4, 0)); const f = grp(); const cone = mk(new THREE.ConeGeometry(0.1, 0.5, 20, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x66ccff).multiplyScalar(1.8), transparent: true, opacity: 0.85, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false })); cone.rotation.x = PI; cone.position.y = -0.7; f.add(cone); const core = mk(new THREE.ConeGeometry(0.05, 0.3, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false })); core.rotation.x = PI; core.position.y = -0.58; f.add(core); f.add(at(glow(0x66ccff, 0.7, 0.7), 0, -0.5, 0)); t.add(f); fl.push(f);
    t.position.set(s * 0.2, 0.0, -0.22); g.add(t); });
  g.add(at(mk(rbox(0.5, 0.1, 0.16, 0.03), met), 0, 0.25, -0.2)); g.add(at(mk(rbox(0.36, 0.06, 0.14, 0.02), ac), 0, -0.02, -0.2));
  const D = depth(A, S); [-1, 1].forEach((s) => g.add(mk(tube([V(s * 0.22, 0.24, -0.08), V(s * 0.26, 0.4, 0.05), V(s * 0.27, 0.2, D * 0.62), V(s * 0.25, -0.2, D * 0.72)], 0.045, 40, 6), M.fabric('weave', 0x1b1c21))));
  return { parts: place(A, S, g, 0.0), tick(t) { fl.forEach((f, i) => { f.scale.set(1 + Math.sin(t * 40 + i) * 0.06, 0.9 + Math.sin(t * 31 + i * 2) * 0.12 + 0.12, 1 + Math.cos(t * 37) * 0.06); }); } };
}
/* ---- cintura ---- */
const waistRing = (A) => A.skirt;
export function rinonera({ A, S, C }) {
  const g = grp(), sk = A.skirt, rx = sk.r0[0] * 1.02 + 0.03, rz = sk.r0[1] * 1.02 + 0.03, yy = A.garment.waist;
  const belt = mk(new THREE.TorusGeometry(1, 0.035 * S, 10, 64), M.fabric('weave', 0x1b1c21, { rough: 0.7 })); belt.rotation.x = PI / 2; belt.scale.set(rx, rz, 1); belt.position.set(sk.c[0], yy, sk.c[1]); g.add(belt);
  const bag = grp(); bag.add(mk(rbox(0.46 * S, 0.24 * S, 0.14 * S, 0.06 * S, 5), M.gloss(C.main, { roughness: 0.25, clearcoat: 1 }))); bag.add(at(mk(rbox(0.4 * S, 0.012 * S, 0.012 * S, 0.004), M.silver()), 0, 0.02 * S, 0.075 * S)); bag.add(at(mk(new THREE.TorusGeometry(0.02 * S, 0.006 * S, 8, 16), M.silver()), 0.17 * S, 0.02 * S, 0.08 * S));
  bag.add(at(mk(rbox(0.3 * S, 0.1 * S, 0.02 * S, 0.01), M.satin(C.accent)), 0, -0.05 * S, 0.075 * S)); bag.position.set(sk.c[0] + 0.0, yy - 0.02, sk.c[1] + rz + 0.05 * S); g.add(bag);
  g.add(at(mk(rbox(0.1 * S, 0.06 * S, 0.03 * S, 0.01), M.gloss(0x0d0d11)), sk.c[0] + 0.3 * rx, yy, sk.c[1] + rz * 0.95));
  return { parts: [{ bone: 'hips', obj: g, at: [0, 0, 0] }] };
}
export function cinturonOro({ A, S, C }) {
  const g = grp(), sk = A.skirt, rx = sk.r0[0] * 1.02 + 0.03, rz = sk.r0[1] * 1.02 + 0.03, yy = A.garment.waist;
  const belt = mk(new THREE.TorusGeometry(1, 0.04 * S, 10, 64), M.fabric('leather', 0x15110e, { amp: 0.15 })); belt.rotation.x = PI / 2; belt.scale.set(rx, rz, 1); belt.position.set(sk.c[0], yy, sk.c[1]); g.add(belt);
  const bk = grp(); bk.add(mk(rbox(0.26 * S, 0.18 * S, 0.04 * S, 0.02 * S), M.gold({ roughness: 0.14 }))); bk.add(at(mk(extrude(star(0.07 * S, 0.035 * S), 0.03 * S, 0.008), M.gem(C.accent)), 0, 0, 0.03 * S)); bk.add(at(mk(torus(0.1 * S, 0.012 * S, PI * 2, 8, 30), M.gold()), 0, 0, 0.026 * S)); bk.position.set(sk.c[0], yy, sk.c[1] + rz + 0.03 * S); g.add(bk);
  for (let i = 0; i < 14; i++) { const a = PI * 0.15 + (i / 14) * PI * 0.7, st = ball(0.016 * S, M.gold(), 10, 8); st.position.set(sk.c[0] + Math.cos(a + PI * 0.5) * rx * 0.99 * -1, yy, sk.c[1] + Math.sin(a + PI * 0.5) * rz * 0.99); g.add(st); }
  return { parts: [{ bone: 'hips', obj: g, at: [0, 0, 0] }] };
}
