/* sdf.js · campos de distancia con signo + malla por "surface nets" (suave, sin costuras) + pesos de piel automáticos.
 * Todo son funciones puras (x,y,z) → distancia. Sin dependencias: lo usan las criaturas y las prendas. */
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const smin = (a, b, k) => { if (k <= 0) return Math.min(a, b); const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
export const smax = (a, b, k) => -smin(-a, -b, k);

/* ---------- ruido de valor 3D (determinista) ---------- */
function h3(x, y, z) { const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return n - Math.floor(n); }
export function vnoise(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  const a = h3(ix, iy, iz), b = h3(ix + 1, iy, iz), c = h3(ix, iy + 1, iz), d = h3(ix + 1, iy + 1, iz);
  const e = h3(ix, iy, iz + 1), f = h3(ix + 1, iy, iz + 1), g = h3(ix, iy + 1, iz + 1), h = h3(ix + 1, iy + 1, iz + 1);
  const x1 = a + (b - a) * ux, x2 = c + (d - c) * ux, x3 = e + (f - e) * ux, x4 = g + (h - g) * ux;
  const y1 = x1 + (x2 - x1) * uy, y2 = x3 + (x4 - x3) * uy; return y1 + (y2 - y1) * uz;
}
export function fbm(x, y, z, oct = 4) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, z * f); f *= 2.03; a *= 0.5; } return s; }

/* ---------- primitivas ---------- */
export const sph = (c, r) => (x, y, z) => Math.hypot(x - c[0], y - c[1], z - c[2]) - r;
export const ell = (c, r) => (x, y, z) => {
  const px = (x - c[0]) / r[0], py = (y - c[1]) / r[1], pz = (z - c[2]) / r[2];
  const k0 = Math.hypot(px, py, pz); if (k0 < 1e-6) return -Math.min(r[0], r[1], r[2]);
  const k1 = Math.hypot(px / r[0], py / r[1], pz / r[2]); return k0 * (k0 - 1) / k1;
};
export function cone(a, b, r1, r2) { // cono redondeado (iq)
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2], l2 = bax * bax + bay * bay + baz * baz, rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1 / l2;
  return (x, y, z) => {
    const pax = x - a[0], pay = y - a[1], paz = z - a[2], yy = pax * bax + pay * bay + paz * baz, zz = yy - l2;
    const qx = pax * l2 - bax * yy, qy = pay * l2 - bay * yy, qz = paz * l2 - baz * yy, x2 = qx * qx + qy * qy + qz * qz, y2 = yy * yy * l2, z2 = zz * zz * l2, k = Math.sign(rr) * rr * rr * x2;
    if (Math.sign(zz) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
    if (Math.sign(yy) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
    return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - r1;
  };
}
export const cap = (a, b, r) => cone(a, b, r, r);
export const box = (c, h, rd = 0) => (x, y, z) => { const qx = Math.abs(x - c[0]) - h[0] + rd, qy = Math.abs(y - c[1]) - h[1] + rd, qz = Math.abs(z - c[2]) - h[2] + rd; return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - rd; };
export const torus = (c, R, r) => (x, y, z) => { const px = x - c[0], py = y - c[1], pz = z - c[2]; return Math.hypot(Math.hypot(px, pz) - R, py) - r; };

/* ---------- transformaciones y operadores ---------- */
export const move = (f, d) => (x, y, z) => f(x - d[0], y - d[1], z - d[2]);
export const scl = (f, s) => { const m = Math.min(s[0], s[1], s[2]); return (x, y, z) => f(x / s[0], y / s[1], z / s[2]) * m; };
export const mirrorX = (f) => (x, y, z) => f(Math.abs(x), y, z);
export function rot(f, e, pv = [0, 0, 0]) { // rota el objeto (Euler XYZ, radianes) alrededor de pv
  const [ax, ay, az] = e, cx = Math.cos(ax), sx = Math.sin(ax), cy = Math.cos(ay), sy = Math.sin(ay), cz = Math.cos(az), sz = Math.sin(az);
  // matriz inversa = traspuesta de Rz*Ry*Rx
  const m00 = cz * cy, m01 = cz * sy * sx - sz * cx, m02 = cz * sy * cx + sz * sx, m10 = sz * cy, m11 = sz * sy * sx + cz * cx, m12 = sz * sy * cx - cz * sx, m20 = -sy, m21 = cy * sx, m22 = cy * cx;
  return (x, y, z) => { const px = x - pv[0], py = y - pv[1], pz = z - pv[2]; return f(m00 * px + m10 * py + m20 * pz + pv[0], m01 * px + m11 * py + m21 * pz + pv[1], m02 * px + m12 * py + m22 * pz + pv[2]); };
}
export const U = (k, ...fs) => (x, y, z) => { let d = fs[0](x, y, z); for (let i = 1; i < fs.length; i++) d = smin(d, fs[i](x, y, z), k); return d; };
export const sub = (f, g, k = 0) => (x, y, z) => smax(f(x, y, z), -g(x, y, z), k);
export const inter = (f, g, k = 0) => (x, y, z) => smax(f(x, y, z), g(x, y, z), k);
export const shell = (f, off, w) => (x, y, z) => Math.abs(f(x, y, z) - off) - w; // lámina fina alrededor del contorno desplazado
export const disp = (f, amp, freq, oct = 3, seed = 0) => (x, y, z) => f(x, y, z) + (fbm(x * freq + seed, y * freq, z * freq, oct) - 0.5) * 2 * amp;
export const dispFn = (f, g) => (x, y, z) => f(x, y, z) + g(x, y, z);

/* ---------- surface nets con banda estrecha ---------- */
const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
const CORN = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
export function mesh(f, bounds, h) {
  const [x0, y0, z0, x1, y1, z1] = bounds, nx = Math.ceil((x1 - x0) / h) + 2, ny = Math.ceil((y1 - y0) / h) + 2, nz = Math.ceil((z1 - z0) / h) + 2;
  const S = new Float32Array(nx * ny * nz).fill(NaN), id = (i, j, k) => i + nx * (j + ny * k), Bk = 6;
  const diag = Bk * h * 0.866;
  for (let bk = 0; bk * Bk < nz; bk++) for (let bj = 0; bj * Bk < ny; bj++) for (let bi = 0; bi * Bk < nx; bi++) {
    const cx = x0 + (bi * Bk + Bk / 2) * h, cy = y0 + (bj * Bk + Bk / 2) * h, cz = z0 + (bk * Bk + Bk / 2) * h;
    if (Math.abs(f(cx, cy, cz)) > diag * 1.7 + 0.03) continue;
    for (let k = bk * Bk; k <= Math.min(nz - 1, bk * Bk + Bk); k++) for (let j = bj * Bk; j <= Math.min(ny - 1, bj * Bk + Bk); j++) for (let i = bi * Bk; i <= Math.min(nx - 1, bi * Bk + Bk); i++) {
      const q = id(i, j, k); if (S[q] !== S[q]) S[q] = f(x0 + i * h, y0 + j * h, z0 + k * h);
    }
  }
  const cell = new Int32Array(nx * ny * nz).fill(-1), pos = [], v = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let mask = 0, ok = true;
    for (let c = 0; c < 8; c++) { const s = S[id(i + CORN[c][0], j + CORN[c][1], k + CORN[c][2])]; if (s !== s) { ok = false; break; } v[c] = s; if (s < 0) mask |= 1 << c; }
    if (!ok || mask === 0 || mask === 255) continue;
    let ex = 0, ey = 0, ez = 0, n = 0;
    for (let e = 0; e < 12; e++) {
      const a = EDGES[e][0], b = EDGES[e][1]; if ((v[a] < 0) === (v[b] < 0)) continue;
      const t = v[a] / (v[a] - v[b]); ex += CORN[a][0] + t * (CORN[b][0] - CORN[a][0]); ey += CORN[a][1] + t * (CORN[b][1] - CORN[a][1]); ez += CORN[a][2] + t * (CORN[b][2] - CORN[a][2]); n++;
    }
    cell[id(i, j, k)] = pos.length / 3; pos.push(x0 + (i + ex / n) * h, y0 + (j + ey / n) * h, z0 + (k + ez / n) * h);
  }
  const idx = [], quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d); };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const s0 = S[id(i, j, k)]; if (s0 !== s0) continue;
    const inside = s0 < 0;
    let s1 = S[id(i + 1, j, k)]; if (s1 === s1 && (s1 < 0) !== inside) quad(cell[id(i, j - 1, k - 1)], cell[id(i, j, k - 1)], cell[id(i, j, k)], cell[id(i, j - 1, k)], !inside);
    s1 = S[id(i, j + 1, k)]; if (s1 === s1 && (s1 < 0) !== inside) quad(cell[id(i - 1, j, k - 1)], cell[id(i - 1, j, k)], cell[id(i, j, k)], cell[id(i, j, k - 1)], !inside);
    s1 = S[id(i, j, k + 1)]; if (s1 === s1 && (s1 < 0) !== inside) quad(cell[id(i - 1, j - 1, k)], cell[id(i, j - 1, k)], cell[id(i, j, k)], cell[id(i - 1, j, k)], !inside);
  }
  const P = new Float32Array(pos), N = new Float32Array(pos.length), e = h * 0.6;
  for (let i = 0; i < P.length; i += 3) {
    const x = P[i], y = P[i + 1], z = P[i + 2];
    let gx = f(x + e, y, z) - f(x - e, y, z), gy = f(x, y + e, z) - f(x, y - e, z), gz = f(x, y, z + e) - f(x, y, z - e), l = Math.hypot(gx, gy, gz) || 1;
    N[i] = gx / l; N[i + 1] = gy / l; N[i + 2] = gz / l;
  }
  return { positions: P, normals: N, indices: new Uint32Array(idx) };
}

/* ---------- pesos de piel por distancia a cada hueso ---------- */
export function skinWeights(positions, boneFns, tau = 0.06) {
  const n = positions.length / 3, names = Object.keys(boneFns), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), d = new Float32Array(names.length);
  for (let v = 0; v < n; v++) {
    const x = positions[v * 3], y = positions[v * 3 + 1], z = positions[v * 3 + 2];
    for (let b = 0; b < names.length; b++) d[b] = boneFns[names[b]](x, y, z);
    let order = []; let dmin = 1e9; for (let b = 0; b < names.length; b++) dmin = Math.min(dmin, d[b]);
    for (let b = 0; b < names.length; b++) order.push([Math.exp(-(d[b] - dmin) / tau), b]);
    order.sort((p, q) => q[0] - p[0]); let tot = 0; for (let k = 0; k < 4; k++) tot += order[k][0];
    for (let k = 0; k < 4; k++) { si[v * 4 + k] = order[k][1]; sw[v * 4 + k] = order[k][0] / tot; }
  }
  return { skinIndex: si, skinWeight: sw, names };
}

/** escala un objeto alrededor de un centro (aplanar orejas, alas…) */
export const flat = (f, c, s) => { const m = Math.min(s[0], s[1], s[2]); return (x, y, z) => f(c[0] + (x - c[0]) / s[0], c[1] + (y - c[1]) / s[1], c[2] + (z - c[2]) / s[2]) * m; };
export const smooth01 = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
