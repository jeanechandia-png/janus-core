/* garment.js · prendas que se ajustan al cuerpo: capa SDF desplazada del cuerpo, recortada por regiones (torso, mangas, dobladillo), con el mismo esqueleto y pesos de piel.
 * También ayudas para colocar piezas rígidas (cremalleras, bolsillos, parches) pegadas a la superficie de la prenda. */
import * as THREE from 'three';
import { mesh, skinWeights, U, sub, ell, smooth01, smax } from './sdf.js';

const sdfOf = (def, names) => U(0, ...names.flatMap((n) => def.parts[n] || []));
export function garmentSDF(def, A, spec) {
  const G = A.garment, body = def.body, torso = sdfOf(def, ['spine', 'hips']);
  const excl = G.ex === 'face' ? ell([0, 1.0, 0.66], [0.66, 0.56, 0.38]) : sdfOf(def, ['head', 'tail0', 'tail1', 'tail2', 'earL', 'earR', 'legL', 'legR']);
  const top = spec.top ?? G.top, hem = spec.hem ?? G.hem, near = spec.near ?? 0.16, gap = spec.gap ?? 0.0;
  const regT = (x, y, z) => Math.max(y - top, hem - y, torso(x, y, z) - near, -(excl(x, y, z) - gap));
  const regs = [regT], sl = spec.sleeves;
  const mk = (s) => {
    const a = def.parts[s < 0 ? 'armL' : 'armR']; if (!a || !sl) return null;
    const arm = U(0, ...a), sh = A.shoulder.slice(), en = A.armEnd.slice(); if (s < 0 && def.id !== 'musgo') { sh[0] = -sh[0]; en[0] = -en[0]; }
    if (def.id === 'musgo') { sh[0] = s * 0.8; en[0] = s * (s < 0 ? 1.08 : 1.1); en[1] = s < 0 ? 0.62 : 1.2; sh[1] = 0.9; }
    const d = [en[0] - sh[0], en[1] - sh[1], en[2] - sh[2]], L = Math.hypot(...d); d[0] /= L; d[1] /= L; d[2] /= L;
    return { f: (x, y, z) => { const t = (x - sh[0]) * d[0] + (y - sh[1]) * d[1] + (z - sh[2]) * d[2]; return Math.max(arm(x, y, z) - (sl.r ?? 0.1), t - sl.t * L, -t - 0.08); }, sh, d, L };
  };
  const sR = mk(1), sL = mk(-1); if (sR) { regs.push(sR.f); regs.push(sL.f); }
  const reg = (x, y, z) => { let m = 1e9; for (let i = 0; i < regs.length; i++) { const v = regs[i](x, y, z); if (v < m) m = v; } return m; };
  const offB = spec.offFn || ((x, y, z) => spec.off ?? G.off), roll = spec.roll ?? 0.016, kE = spec.edge ?? 0.034;
  const offF = (x, y, z) => offB(x, y, z) + roll * (1 - smooth01(0.0, 0.1, y - hem));   // dobladillo en rib: banda algo más gruesa
  const f = (x, y, z) => smax(body(x, y, z) - offF(x, y, z), reg(x, y, z), kE);        // bordes redondeados, sin cantos dentados
  return { f, reg, regT, sleeves: [sR, sL], top, hem, torso, excl, body };
}
/** devuelve { geo, S } con geometría de la prenda (atributos de piel y color); S = utilidades de superficie */
export function buildGarment(def, A, spec, cell = 0.026) {
  const S = garmentSDF(def, A, spec), b = (spec.bounds || A.garment.bounds).slice();
  b[1] = Math.min(b[1], S.hem - 0.1); b[4] = Math.max(Math.min(b[4], S.top + 0.12), S.hem + 0.2);
  const g = mesh(S.f, b, cell), n = g.positions.length / 3, P = g.positions;
  const boneFns = {}; Object.keys(def.parts).forEach((k) => { boneFns[k] = U(0, ...def.parts[k]); });
  const sk = skinWeights(P, boneFns, def.tau || 0.05);
  // índices de hueso en el orden del esqueleto
  const order = def.bones.map((x) => x.n), si = new Uint16Array(sk.skinIndex.length); for (let i = 0; i < si.length; i++) si[i] = order.indexOf(sk.names[sk.skinIndex[i]]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(g.normals, 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.BufferAttribute(sk.skinWeight, 4)); geo.setIndex(new THREE.BufferAttribute(g.indices, 1));
  // color por vértice
  const col = new Float32Array(n * 3), c = new THREE.Color();
  if (spec.color) for (let v = 0; v < n; v++) {
    const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
    let sle = 99, side = x < 0 ? -1 : 1; for (const s of S.sleeves) if (s) { const t = (x - s.sh[0]) * s.d[0] + (y - s.sh[1]) * s.d[1] + (z - s.sh[2]) * s.d[2]; if (t > -0.02 && U0(def, s, x, y, z)) sle = Math.min(sle, (spec.sleeves.t * s.L) - t); }
    const info = { x, y, z, dh: y - S.hem, dt: S.top - y, sle, hd: S.excl(x, y, z), side, nz: g.normals[v * 3 + 2], ny: g.normals[v * 3 + 1], nx: g.normals[v * 3] };
    c.set(spec.color(info)); col[v * 3] = c.r; col[v * 3 + 1] = c.g; col[v * 3 + 2] = c.b;
  } else col.fill(1);
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return { geo, S };
}
const U0 = (def, s, x, y, z) => { const t = (x - s.sh[0]) * s.d[0] + (y - s.sh[1]) * s.d[1] + (z - s.sh[2]) * s.d[2]; const px = x - (s.sh[0] + s.d[0] * t), py = y - (s.sh[1] + s.d[1] * t), pz = z - (s.sh[2] + s.d[2] * t); return Math.hypot(px, py, pz) < 0.3; };

/** superficie exterior de la prenda en (x,y) mirando desde +z (o −z con dir=-1): { z, n:[x,y,z] } por bisección */
export function onSurface(f, x, y, dir = 1, zmax = 1.6) {
  let a = dir * zmax, b = 0; if (f(x, y, 0) > 0) { for (let z = 0; z * z < zmax * zmax; z += 0.05) { if (f(x, y, dir * z) < 0) { b = dir * z; break; } } }
  for (let i = 0; i < 22; i++) { const m = (a + b) / 2; if (f(x, y, m) > 0) a = m; else b = m; }
  const z = (a + b) / 2, e = 0.01; let nx = f(x + e, y, z) - f(x - e, y, z), ny = f(x, y + e, z) - f(x, y - e, z), nz = f(x, y, z + e) - f(x, y, z - e), l = Math.hypot(nx, ny, nz) || 1;
  return { z, n: [nx / l, ny / l, nz / l] };
}
/** lámina rectangular pegada a la superficie (bolsillos, parches, peto) */
export function conformRect(f, x0, x1, y0, y1, lift = 0.012, nx = 12, ny = 10, dir = 1, cut) {
  const pos = [], idx = [], nrm = [], uv = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) { const u = i / nx, v = j / ny, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * v, s = onSurface(f, x, y, dir); pos.push(x + s.n[0] * lift, y + s.n[1] * lift, s.z + s.n[2] * lift); nrm.push(...s.n); uv.push(u, v); }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1; if (dir > 0) idx.push(a, b, d, a, d, c); else idx.push(a, d, b, a, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); return g;
}
/** lámina con contorno polar r(θ) pegada a la superficie (logos redondos, estrellas) */
export function conformPolar(f, cx, cy, rFn, lift = 0.012, nr = 6, nt = 40, dir = 1) {
  const pos = [], idx = [], nrm = []; const add = (x, y) => { const s = onSurface(f, x, y, dir); pos.push(x + s.n[0] * lift, y + s.n[1] * lift, s.z + s.n[2] * lift); nrm.push(...s.n); };
  add(cx, cy); for (let r = 1; r <= nr; r++) for (let t = 0; t < nt; t++) { const a = (t / nt) * Math.PI * 2, R = rFn(a) * (r / nr); add(cx + Math.cos(a) * R, cy + Math.sin(a) * R); }
  for (let t = 0; t < nt; t++) { const a = 1 + t, b = 1 + ((t + 1) % nt); if (dir > 0) idx.push(0, b, a); else idx.push(0, a, b); }
  for (let r = 1; r < nr; r++) for (let t = 0; t < nt; t++) { const a = 1 + (r - 1) * nt + t, b = 1 + (r - 1) * nt + ((t + 1) % nt), c = a + nt, d = b + nt; if (dir > 0) idx.push(a, b, d, a, d, c); else idx.push(a, d, b, a, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setIndex(idx); return g;
}
export { smooth01 };
