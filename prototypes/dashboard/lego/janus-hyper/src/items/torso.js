/* torso.js · prendas modernas (streetwear) que se ajustan al cuerpo de cada criatura. Cada entrada: { spec(ctx), mat(ctx), extras(ctx) } */
import { THREE, V, PI, mk, rbox, lathe, tube, torus, grp, at, ball, ellipsoid, arcPts, bend, star, extrude, glow, hsl } from '../kit.js';
import * as M from '../mats.js';
import { onSurface, conformRect, conformPolar } from '../garment.js';
import { smooth01 } from '../sdf.js';

const K = (c) => new THREE.Color(c), mixc = (a, b, t) => K(a).lerp(K(b), t), WHITE = 0xf4f1ea;
const pal = (t, a, b, c, d) => new THREE.Color(a[0] + b[0] * Math.cos(6.2832 * (c[0] * t + d[0])), a[1] + b[1] * Math.cos(6.2832 * (c[1] * t + d[1])), a[2] + b[2] * Math.cos(6.2832 * (c[2] * t + d[2])));
const tex = (draw, w = 256, h = 256) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'); draw(g, w, h); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
const glyph = (txt, fg, edge, font = 'bold 190px "Arial Black",Impact,sans-serif') => tex((g, w, h) => { g.clearRect(0, 0, w, h); g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = 22; g.strokeStyle = edge; g.strokeText(txt, w / 2, h / 2 + 8); g.fillStyle = fg; g.fillText(txt, w / 2, h / 2 + 8); });
const decal = (map) => new THREE.MeshPhysicalMaterial({ map, transparent: true, alphaTest: 0.35, roughness: 0.85, sheen: 1, sheenColor: K(0xffffff), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide });
const zip = (f, x, y0, y1, mat, lift = 0.008, r = 0.011, dir = 1, k = 1) => { const p = []; for (let i = 0; i <= 14; i++) { const y = y0 + (y1 - y0) * (i / 14), s = onSurface(f, x, y, dir); p.push(V(x + s.n[0] * lift, y + s.n[1] * lift, s.z + s.n[2] * lift)); } const g = grp(); g.add(mk(tube(p, r * k, 30, 6), mat)); const top = p[p.length - 1], tab = mk(rbox(0.05 * k, 0.09 * k, 0.016 * k, 0.006), mat); tab.position.copy(top).add(V(0, -0.02 * k, 0.01)); g.add(tab); return g; };
const dots = (f, pts, r, mat, lift = 0.01, dir = 1) => { const g = grp(); pts.forEach(([x, y]) => { const s = onSurface(f, x, y, dir), b = ball(r, mat, 16, 12); b.position.set(x + s.n[0] * lift, y + s.n[1] * lift, s.z + s.n[2] * lift); g.add(b); }); return g; };
const rim = (S, t, A) => ({ hemRib: S, k: t, A });
const bandMix = (info, base, trim, hemH, cuffH, colH) => (info.dh < hemH ? trim : info.sle < cuffH ? trim : info.hd < colH ? trim : base);
const stitch = (pts, mat, r = 0.004) => mk(tube(pts, r, pts.length * 4, 4), mat);
const rectLine = (f, x0, x1, y0, y1, lift = 0.014, n = 8) => { const o = [], s = (x, y) => { const q = onSurface(f, x, y); return V(x + q.n[0] * lift, y + q.n[1] * lift, q.z + q.n[2] * lift); }; for (let i = 0; i <= n; i++) o.push(s(x0 + (x1 - x0) * (i / n), y0)); for (let i = 1; i <= n; i++) o.push(s(x1, y0 + (y1 - y0) * (i / n))); for (let i = 1; i <= n; i++) o.push(s(x1 - (x1 - x0) * (i / n), y1)); for (let i = 1; i < n; i++) o.push(s(x0, y1 - (y1 - y0) * (i / n))); return o; };
const kk = (A) => A.scale.espalda;

export const GARMENTS = {
  /* ---- sudadera oversize con capucha ---- */
  hoodie: {
    spec: ({ A, C }) => ({ sleeves: { t: 0.97, r: 0.1 }, offFn: (x, y, z) => A.garment.off + 0.035 + 0.02 * smooth01(A.garment.top, A.garment.hem, y), hem: A.garment.hem - 0.06,
      color: (i) => bandMix(i, K(C.main), mixc(C.main, 0x000000, 0.18), 0.075, 0.075, 0.0) }),
    mat: () => M.fabric('felt', 0xffffff, { vc: true, rough: 0.95, amp: 0.1 }),
    extras: ({ A, C, S }) => { const f = S.f, k = kk(A), g = grp(), hem = S.hem, fm = M.fabric('felt', mixc(C.main, 0x000000, 0.1), { rough: 0.95 }); const y0 = hem + 0.1 * k, y1 = hem + 0.34 * k, hw = 0.3 * k;
      const pk = conformRect(f, -hw, hw, y0, y1, 0.012, 14, 8); g.add(mk(pk, fm)); g.add(stitch(rectLine(f, -hw, hw, y0, y1, 0.02), M.satin(mixc(C.main, 0x000000, 0.35))));
      const nk = A.neck, cord = M.satin(WHITE, { roughness: 0.5 }); [-1, 1].forEach((s) => { const a = onSurface(f, s * 0.11 * k, S.top - 0.12, 1), b = onSurface(f, s * 0.13 * k, S.top - 0.34 * k, 1); g.add(mk(tube([V(s * 0.11 * k, S.top - 0.1, a.z + 0.02), V(s * 0.125 * k, S.top - 0.2 * k, (a.z + b.z) / 2 + 0.03), V(s * 0.13 * k, S.top - 0.34 * k, b.z + 0.03)], 0.012 * k, 14, 6), cord)); const tip = mk(new THREE.CylinderGeometry(0.014 * k, 0.014 * k, 0.05 * k, 8), M.gold()); tip.position.set(s * 0.13 * k, S.top - 0.37 * k, b.z + 0.03); g.add(tip); });
      const hood = grp(), hr = 0.36 * k, hg = new THREE.SphereGeometry(hr, 28, 18, 0, PI * 2, PI * 0.15, PI * 0.62); hg.scale(1.2, 0.85, 0.8); const hm = mk(hg, M.fabric('felt', C.main, { rough: 0.95, side: THREE.DoubleSide })); hood.add(hm); const rg = mk(new THREE.TorusGeometry(hr * 0.98, 0.04 * k, 10, 40, PI * 1.4), M.fabric('felt', mixc(C.main, 0x000000, 0.12), { rough: 0.95 })); rg.rotation.set(PI / 2 - 0.5, 0, PI * 0.8); rg.scale.set(1.2, 0.9, 1); hood.add(rg);
      hood.position.set(nk.c[0], S.top - 0.12 * k, nk.c[2] - nk.rz * 0.78); hood.rotation.x = 0.55; g.add(hood);
      const em = conformPolar(f, 0.0, S.top - 0.28 * k, (a) => 0.07 * k * (1 + 0.5 * Math.cos(a * 5) * 0), 0.016, 4, 30); g.add(mk(em, M.gold({ roughness: 0.2 }))); return [g]; }
  },
  /* ---- bomber satinada ---- */
  bomber: {
    spec: ({ A, C }) => ({ sleeves: { t: 0.97, r: 0.1 }, off: A.garment.off + 0.022, hem: A.garment.hem - 0.04,
      color: (i) => { if (i.dh < 0.085 || i.sle < 0.085) return mixc(C.accent, 0x000000, 0.1); if (i.hd < 0.07) return mixc(C.accent, 0x000000, 0.1); if (i.sle > 0.16 && i.sle < 0.2) return K(WHITE); return mixc(C.main, 0xffffff, 0.04); } }),
    mat: () => M.satin(0xffffff, { vertexColors: true, roughness: 0.3, sheen: 1 }),
    extras: ({ A, C, S }) => { const f = S.f, k = kk(A), g = grp(); g.add(zip(f, 0, S.hem + 0.03, S.top - 0.1 * k, M.gold({ roughness: 0.18 }), 0.01, 0.012, 1, k));
      const pg = conformPolar(f, 0.2 * k, S.top - 0.34 * k, (a) => 0.085 * k, 0.014, 4, 32); g.add(mk(pg, M.gloss(C.accent))); g.add(mk(conformPolar(f, 0.2 * k, S.top - 0.34 * k, (a) => 0.045 * k * (0.5 + 0.5 * Math.abs(Math.cos(a * 2.5))), 0.02, 3, 30), M.gold()));
      [-1, 1].forEach((s) => g.add(stitch(rectLine(f, s * 0.14 * k, s * 0.32 * k, S.hem + 0.1 * k, S.hem + 0.2 * k, 0.014), M.satin(mixc(C.main, 0x000000, 0.4))))); return [g]; }
  },
  /* ---- chaqueta varsity (universitaria) ---- */
  varsity: {
    spec: ({ A, C }) => ({ sleeves: { t: 0.97, r: 0.1 }, off: A.garment.off + 0.03, hem: A.garment.hem - 0.04,
      color: (i) => { const band = (v, a) => ((v > a && v < a + 0.022) || (v > a + 0.05 && v < a + 0.072)); if (i.dh < 0.1 || i.sle < 0.1 || i.hd < 0.075) { const v = i.dh < 0.1 ? i.dh : i.sle < 0.1 ? i.sle : i.hd - 0; return band(v, 0.02) ? K(WHITE) : mixc(C.accent, 0x000000, 0.12); } return i.sle < 99 && i.sle < 0.6 ? K(0xf1e8d4) : K(C.main); } }),
    mat: () => M.fabric('felt', 0xffffff, { vc: true, rough: 0.9, amp: 0.14 }),
    extras: ({ A, C, S }) => { const f = S.f, k = kk(A), g = grp();
      const lt = glyph(C.letter || 'J', '#' + K(WHITE).getHexString(), '#' + K(C.accent).getHexString()), lp = mk(conformRect(f, -0.34 * k, -0.02 * k, S.top - 0.55 * k, S.top - 0.2 * k, 0.018, 8, 8), decal(lt)); g.add(lp);
      g.add(dots(f, [0, 1, 2, 3, 4].map((i) => [0, S.hem + 0.08 + i * (S.top - S.hem - 0.22) / 4]), 0.018 * k, M.gold(), 0.012));
      [-1, 1].forEach((s) => g.add(stitch(rectLine(f, s * 0.16 * k, s * 0.34 * k, S.hem + 0.12 * k, S.hem + 0.22 * k, 0.012, 5), M.satin(0xf1e8d4)))); return [g]; }
  },
  /* ---- plumífero metalizado holográfico ---- */
  puffer: {
    spec: ({ A, C }) => ({ sleeves: { t: 0.97, r: 0.1 }, offFn: (x, y, z) => A.garment.off + 0.03 + 0.032 * (0.5 + 0.5 * Math.cos(y * 30)), hem: A.garment.hem - 0.04,
      color: (i) => mixc(C.main, 0x000000, 0.22 * (0.5 - 0.5 * Math.cos(i.y * 30 + 0.0)) * 0 + 0.0).lerp(mixc(C.main, 0xffffff, 0.12), 0.5 + 0.5 * Math.cos(i.y * 30)).multiplyScalar(0.8 + 0.2 * (0.5 + 0.5 * Math.cos(i.y * 30))) }),
    mat: () => new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, metalness: 0.55, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08, iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [200, 700], envMapIntensity: 2 }),
    extras: ({ A, C, S }) => { const f = S.f, k = kk(A), g = grp(), nk = A.neck; g.add(zip(f, 0, S.hem + 0.03, S.top - 0.08 * k, M.chrome(), 0.012, 0.012, 1, k));
      const col = mk(new THREE.TorusGeometry(1, 0.1 * k, 16, 60), new THREE.MeshPhysicalMaterial({ color: C.main, metalness: 0.55, roughness: 0.2, clearcoat: 1, iridescence: 1, envMapIntensity: 2 })); col.rotation.x = PI / 2; col.scale.set(nk.rx * 0.82, nk.rz * 0.82, 1); col.scale.z = 1; col.position.set(nk.c[0], nk.c[1] - 0.1 * k, nk.c[2]); col.rotation.x = PI / 2; g.add(col); return [g]; }
  },
  /* ---- chaqueta de cuero motera ---- */
  cuero: {
    spec: ({ A, C }) => ({ sleeves: { t: 0.97, r: 0.1 }, off: A.garment.off + 0.018, hem: A.garment.hem - 0.04,
      color: (i) => { const sh = 0.02 * Math.sin(i.y * 40 + i.x * 9) * 0 + 0.0; return K(i.dh < 0.06 || i.sle < 0.06 ? 0x0a0a0d : 0x17161b).offsetHSL(0, 0, sh); } }),
    mat: () => M.fabric('leather', 0xffffff, { vc: true, amp: 0.2 }),
    extras: ({ A, C, S }) => { const f = S.f, k = kk(A), g = grp(), sv = M.silver({ roughness: 0.12 }), lm = M.fabric('leather', 0x101014, { amp: 0.18 });
      const p = []; for (let i = 0; i <= 14; i++) { const t = i / 14, y = S.top - 0.1 * k - t * (S.top - S.hem - 0.12), x = 0.02 + t * 0.2 * k, s = onSurface(f, x, y); p.push(V(x + s.n[0] * 0.01, y + s.n[1] * 0.01, s.z + s.n[2] * 0.01)); } g.add(mk(tube(p, 0.012 * k, 30, 6), sv));
      [-1, 1].forEach((s) => { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(s * 0.22 * k, 0.08 * k); sh.lineTo(s * 0.3 * k, -0.2 * k); sh.lineTo(s * 0.06 * k, -0.34 * k); sh.lineTo(0, 0); const lg = new THREE.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 2 }); const sf = onSurface(f, s * 0.12 * k, S.top - 0.2 * k); const m = mk(lg, lm); m.position.set(s * 0.04 * k, S.top - 0.02, sf.z + 0.012); m.rotation.x = -0.18; g.add(m); });
      g.add(dots(f, [-1, 1].flatMap((s) => [0, 1, 2, 3].map((i) => [s * (0.2 + i * 0.045) * k, S.top - 0.1 * k - i * 0.02])), 0.012 * k, sv, 0.012)); const bs = rbox(0.1 * k, 0.06 * k, 0.03 * k, 0.01), bk = mk(bs, sv); const sf = onSurface(f, 0, S.hem + 0.06); bk.position.set(0, S.hem + 0.06, sf.z + 0.03); g.add(bk);
      g.add(mk(conformRect(f, -0.6 * k, 0.6 * k, S.hem + 0.04, S.hem + 0.075, 0.012, 24, 2), lm)); return [g]; }
  },
  /* ---- camiseta de fútbol retro (con número a la espalda) ---- */
  futbol: {
    spec: ({ A, C }) => ({ sleeves: { t: 0.5, r: 0.1 }, off: A.garment.off + 0.006, hem: A.garment.hem - 0.02,
      color: (i) => { if (i.sle < 0.07) return K(C.accent); if (i.hd < 0.06) return K(C.accent); if (i.dh < 0.04) return K(C.accent); const st = Math.floor(i.x * 10 / (A.scale.espalda)) & 1; return st ? K(C.main) : mixc(C.main, 0xffffff, 0.14); } }),
    mat: () => M.fabric('weave', 0xffffff, { vc: true, rough: 0.8, sheen: 0.6, amp: 0.045 }),
    extras: ({ A, C, S }) => { const f = S.f, k = kk(A), g = grp();
      g.add(mk(conformPolar(f, 0.19 * k, S.top - 0.3 * k, () => 0.075 * k, 0.012, 3, 30), M.gold())); g.add(mk(conformPolar(f, 0.19 * k, S.top - 0.3 * k, () => 0.05 * k, 0.018, 3, 30), M.gloss(C.accent)));
      const sp = mk(conformRect(f, -0.28 * k, 0.0, S.top - 0.34 * k, S.top - 0.3 * k, 0.012, 10, 2), M.satin(K(WHITE))); g.add(sp);
      const nt = glyph(C.number || '10', '#' + K(WHITE).getHexString(), '#' + K(C.accent).getHexString(), 'bold 150px "Arial Black",Impact,sans-serif'); g.add(mk(conformRect(f, -0.28 * k, 0.28 * k, S.top - 0.62 * k, S.top - 0.2 * k, 0.014, 10, 8, -1), decal(nt))); return [g]; }
  },
  /* ---- camiseta tie-dye ---- */
  tiedye: {
    spec: ({ A, C }) => ({ sleeves: { t: 0.5, r: 0.1 }, off: A.garment.off + 0.026, hem: A.garment.hem - 0.04, offFn: (x, y, z) => A.garment.off + 0.03 + 0.012 * smooth01(A.garment.top, A.garment.hem, y),
      color: (i) => { const cx = 0, cy = (A.garment.top + A.garment.hem) / 2 + 0.05, dx = i.x - cx, dy = i.y - cy, a = Math.atan2(dy, dx), r = Math.hypot(dx, dy) / A.scale.espalda; const t = (a / 6.2832 * 3 + r * 2.2 + 0.18 * Math.sin(r * 12 + a * 2)); return pal(((t % 1) + 1) % 1, [0.55, 0.45, 0.6], [0.45, 0.45, 0.4], [1, 1, 1], [0.0, 0.25, 0.55]); } }),
    mat: () => M.fabric('weave', 0xffffff, { vc: true, rough: 0.9, amp: 0.05 }),
    extras: () => []
  },
  /* ---- chándal deportivo (chaqueta de cremallera con franjas) ---- */
  chandal: {
    spec: ({ A, C }) => ({ sleeves: { t: 0.97, r: 0.1 }, off: A.garment.off + 0.014, hem: A.garment.hem - 0.04,
      color: (i) => { if (i.dh < 0.06 || i.sle < 0.06 || i.hd < 0.06) return mixc(C.main, 0x000000, 0.25); const sd = (Math.abs(i.nx) > 0.82 && i.sle > 90) || (i.sle < 90 && Math.abs(i.ny) > 0.62 && i.sle > 0.08); const st = sd; if (st) return Math.floor((i.nz * 7 + i.y * 9) * 1) & 1 ? K(WHITE) : K(WHITE); return K(C.main).lerp(K(C.accent), smooth01(A.garment.top - 0.25, A.garment.top, i.y) * 0.9); } }),
    mat: () => M.satin(0xffffff, { vertexColors: true, roughness: 0.34, sheen: 1 }),
    extras: ({ A, C, S }) => { const f = S.f, k = kk(A), g = grp(), nk = A.neck; g.add(zip(f, 0, S.hem + 0.03, S.top - 0.06 * k, M.silver(), 0.01, 0.012, 1, k));
      const col = mk(new THREE.TorusGeometry(1, 0.075 * k, 12, 56), M.satin(mixc(C.main, 0x000000, 0.2))); col.rotation.x = PI / 2; col.scale.set(nk.rx * 0.8, nk.rz * 0.8, 1); col.position.set(nk.c[0], nk.c[1] - 0.12 * k, nk.c[2]); g.add(col);
      g.add(mk(conformPolar(f, -0.2 * k, S.top - 0.32 * k, () => 0.05 * k, 0.014, 3, 24), M.gold())); return [g]; }
  },
  /* ---- vestido satinado con falda de volantes ---- */
  vestido: {
    spec: ({ A, C }) => ({ sleeves: null, top: A.garment.top - 0.06, hem: A.garment.waist, off: A.garment.off + 0.01,
      color: (i) => { if (i.hd < 0.06) return K(WHITE); return K(C.main).lerp(K(C.accent), smooth01(i.dh + 0.05, 0.0, 0.5) * 0); } }),
    mat: () => M.satin(0xffffff, { vertexColors: true, roughness: 0.3 }),
    extras: ({ A, C, S }) => { const g = grp(), sk = A.skirt, tiers = 3; for (let t = 0; t < tiers; t++) { const u0 = t / tiers, u1 = (t + 1) / tiers + 0.08, yTop = sk.y0 + (sk.y1 - sk.y0) * u0, yBot = sk.y0 + (sk.y1 - sk.y0) * u1; const col = t === 1 ? K(C.accent) : K(C.main).lerp(K(WHITE), t * 0.18);
        const pts = [[sk.r0[0] + (sk.r1[0] - sk.r0[0]) * u0 * 0.9, yTop], [sk.r0[0] + (sk.r1[0] - sk.r0[0]) * (u0 + 0.5 / tiers) * 1.05, (yTop + yBot) / 2 + 0.02], [sk.r0[0] + (sk.r1[0] - sk.r0[0]) * u1, yBot]]; const lg = lathe(pts.map((p) => [p[0], p[1]]), 96); const p = lg.attributes.position, zr = sk.r1[1] / sk.r1[0]; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), edge = smooth01(yTop + 0.1, yBot, y); p.setXYZ(i, x, y - edge * (0.5 + 0.5 * Math.sin(a * 14 + t)) * 0.07, z * zr * (1 + edge * 0.03 * Math.sin(a * 14 + t))); } lg.computeVertexNormals();
        const m = mk(lg, M.satin(col, { roughness: 0.32, side: THREE.DoubleSide })); m.position.set(sk.c[0], 0, sk.c[1]); g.add(m); }
      const bow = grp(), bm = M.satin(C.accent); [-1, 1].forEach((s) => { const lg = new THREE.SphereGeometry(0.1 * kk(A), 20, 14); lg.scale(1.3, 0.8, 0.4); lg.translate(s * 0.1 * kk(A), 0, 0); const b = mk(lg, bm); b.rotation.z = s * 0.2; bow.add(b); }); bow.add(ellipsoid(0.04 * kk(A), 0.05 * kk(A), 0.04 * kk(A), bm)); const sf = onSurface(S.f, 0, A.garment.waist + 0.02); bow.position.set(0, A.garment.waist + 0.03, sf.z + 0.03); g.add(bow);
      g.add(mk(tube(arcPts(1, 0, PI * 2, 60, (a) => V(Math.cos(a) * (A.skirt.r0[0] + 0.02), A.garment.waist - 0.005, Math.sin(a) * (A.skirt.r0[1] + 0.02) + A.skirt.c[1])), 0.025 * kk(A), 80, 6, true), bm)); return [{ obj: g, bone: 'hips' }]; }
  },
  /* ---- peto vaquero ---- */
  peto: {
    spec: ({ A, C }) => ({ sleeves: null, top: A.garment.top - 0.2, hem: A.garment.hem - 0.05, off: A.garment.off + 0.014,
      color: (i) => { const n = Math.sin(i.x * 22) * Math.sin(i.y * 26) * 0.5 + 0.5; return mixc(C.main, 0xffffff, 0.06 + 0.1 * n * (1 - smooth01(0, 0.5, i.dh))); } }),
    mat: () => M.fabric('denim', 0xffffff, { vc: true, rough: 0.82, amp: 0.1 }),
    extras: ({ A, C, S }) => { const f = S.f, k = kk(A), g = grp(), dn = M.fabric('denim', mixc(C.main, 0xffffff, 0.04), { rough: 0.82 }), st = M.satin(0xd9a441, { roughness: 0.5 }); const top = S.top, hw = 0.2 * k;
      g.add(mk(conformRect(f, -hw, hw, top - 0.2 * k, top - 0.02, 0.014, 10, 6), dn)); g.add(stitch(rectLine(f, -hw, hw, top - 0.2 * k, top - 0.02, 0.02), st)); g.add(stitch(rectLine(f, -0.12 * k, 0.12 * k, top - 0.16 * k, top - 0.07 * k, 0.026, 6), st));
      const tp = (x) => { let y = 2.0; while (y > 0.2 && S.torso(x, y, 0) > 0.0) y -= 0.01; return y; };
      [-1, 1].forEach((s) => { const x = s * hw * 0.85, a = onSurface(f, x, top - 0.02, 1), b = onSurface(f, x * 1.3, top - 0.1, -1), ty = tp(x * 1.1); const pts = [V(x, top - 0.02, a.z + 0.014), V(x * 1.1, (top + ty) / 2 + 0.01, a.z * 0.4), V(x * 1.2, ty + 0.03, 0.0), V(x * 1.3, (top + ty) / 2, b.z * 0.5), V(x * 1.4, top - 0.1, b.z - 0.014)]; g.add(mk(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.02 * k, 6), dn).clone()); const bt = ball(0.026 * k, M.gold({ roughness: 0.2 }), 18, 12); bt.position.set(x, top - 0.02, a.z + 0.03); g.add(bt); });
      g.add(dots(f, [[-hw, top - 0.2 * k], [hw, top - 0.2 * k]], 0.016 * k, M.gold(), 0.02)); [-1, 1].forEach((s) => g.add(stitch(rectLine(f, s * 0.14 * k, s * 0.34 * k, S.hem + 0.12 * k, S.hem + 0.26 * k, 0.016, 5), st))); return [g]; }
  },
  /* ---- jersey nórdico de punto oversize ---- */
  jersey: {
    spec: ({ A, C }) => ({ sleeves: { t: 0.97, r: 0.1 }, offFn: (x, y, z) => A.garment.off + 0.04 + 0.016 * smooth01(A.garment.top, A.garment.hem, y), hem: A.garment.hem - 0.05,
      color: (i) => { if (i.dh < 0.08 || i.sle < 0.08) return mixc(C.main, 0x000000, 0.12); const yc = (A.garment.top + A.garment.hem) / 2 + 0.06, zz = Math.abs(((i.x * 6 / A.scale.espalda) % 1 + 1) % 1 - 0.5) * 2; const band = (c, w) => Math.abs(i.y - c) < w * (0.55 + 0.45 * (1 - zz)); if (band(yc, 0.05) || band(yc - 0.14, 0.035)) return K(C.accent); if (Math.abs(i.y - yc + 0.07) < 0.012) return K(WHITE); return K(C.main); } }),
    mat: () => M.fabric('knit', 0xffffff, { vc: true, rough: 0.97, amp: 0.3 }),
    extras: ({ A, C, S }) => { const g = grp(), nk = A.neck, k = kk(A); const roll = mk(new THREE.TorusGeometry(1, 0.1 * k, 14, 60), M.fabric('knit', mixc(C.main, 0x000000, 0.12), { rough: 0.97, amp: 0.3 })); roll.rotation.x = PI / 2; roll.scale.set(nk.rx * 0.85, nk.rz * 0.85, 1); roll.position.set(nk.c[0], nk.c[1] - 0.1 * k, nk.c[2]); g.add(roll); return [g]; }
  },
  /* ---- chaleco techwear con bolsillos y hebillas ---- */
  techwear: {
    spec: ({ A, C }) => ({ sleeves: null, off: A.garment.off + 0.026, hem: A.garment.hem + 0.06, color: (i) => (i.hd < 0.06 || i.dh < 0.04 ? K(0x1a1b20) : K(0x23252b)) }),
    mat: () => M.fabric('weave', 0xffffff, { vc: true, rough: 0.7, amp: 0.07 }),
    extras: ({ A, C, S }) => { const f = S.f, k = kk(A), g = grp(), nyl = M.fabric('weave', 0x1b1c21, { rough: 0.7 }), bk = M.gloss(0x0e0e12, { roughness: 0.3 }), ac = M.satin(C.accent, { roughness: 0.4 });
      g.add(zip(f, 0, S.hem + 0.03, S.top - 0.06 * k, M.silver(), 0.012, 0.012, 1, k));
      [-1, 1].forEach((s) => { const x0 = s * 0.06 * k, x1 = s * 0.3 * k, y0 = S.hem + 0.14 * k, y1 = S.hem + 0.3 * k; const lo = Math.min(x0, x1), hi = Math.max(x0, x1); g.add(mk(conformRect(f, lo, hi, y0, y1, 0.026, 8, 6), nyl)); g.add(stitch(rectLine(f, lo, hi, y0, y1, 0.034, 6), ac)); const fl = mk(conformRect(f, lo, hi, y1 - 0.05 * k, y1 + 0.01, 0.036, 8, 3), nyl); g.add(fl);
        const ch = onSurface(f, s * 0.2 * k, S.top - 0.2 * k); const bu = mk(rbox(0.06 * k, 0.03 * k, 0.02 * k, 0.008), bk); bu.position.set(s * 0.2 * k, S.top - 0.2 * k, ch.z + 0.02); g.add(bu); });
      g.add(mk(conformRect(f, -0.34 * k, 0.34 * k, S.top - 0.2 * k - 0.03, S.top - 0.2 * k + 0.0, 0.022, 14, 2), ac));
      g.add(mk(conformRect(f, -0.34 * k, 0.34 * k, S.hem + 0.08 * k, S.hem + 0.11 * k, 0.022, 14, 2), ac)); return [g]; }
  }
};
