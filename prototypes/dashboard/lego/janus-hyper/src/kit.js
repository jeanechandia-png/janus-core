/* kit.js · ayudas de modelado para accesorios */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
export { THREE, mergeGeometries };
export const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const PI = Math.PI;
export const mk = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; if (mat.userData && mat.userData.bind) mat.userData.bind(m); return m; };
export const rbox = (w, h, d, r = 0.02, seg = 4) => new RoundedBoxGeometry(w, h, d, seg, r);
export const lathe = (pts, seg = 56) => new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), seg);
export const tube = (pts, r, seg = 40, rad = 8, closed = false) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed), seg, r, rad, closed);
export const torus = (R, r, arc = PI * 2, rs = 14, ts = 56) => new THREE.TorusGeometry(R, r, rs, ts, arc);
export const grp = (...k) => { const g = new THREE.Group(); k.forEach((o) => o && g.add(o)); return g; };
export const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };
export const rotd = (o, x, y, z) => { o.rotation.set(x, y, z); return o; };
export const sc = (o, x, y, z) => { o.scale.set(x, y === undefined ? x : y, z === undefined ? x : z); return o; };
export const ball = (r, mat, w = 24, h = 16) => mk(new THREE.SphereGeometry(r, w, h), mat);
export function ellipsoid(rx, ry, rz, mat, w = 28, h = 18) { const m = ball(1, mat, w, h); m.scale.set(rx, ry, rz); return m; }
export function arcPts(R, a0, a1, n, f) { const p = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * (i / n); p.push(f ? f(a, i / n) : V(Math.cos(a) * R, Math.sin(a) * R, 0)); } return p; }
export function bend(geo, fn) { const p = geo.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); fn(v); p.setXYZ(i, v.x, v.y, v.z); } geo.computeVertexNormals(); return geo; }
export function star(R, r, n = 5) { const s = new THREE.Shape(); for (let i = 0; i < n * 2; i++) { const rr = i % 2 ? r : R, a = PI / 2 + (i * PI) / n, x = Math.cos(a) * rr, y = Math.sin(a) * rr; if (!i) s.moveTo(x, y); else s.lineTo(x, y); } s.closePath(); return s; }
export const extrude = (shape, depth, bev = 0.01, seg = 24) => { const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bev > 0, bevelSize: bev, bevelThickness: bev, bevelSegments: 3, curveSegments: seg }); g.translate(0, 0, -depth / 2); return g; };
export function roundRectShape(w, h, r) { const s = new THREE.Shape(), x = -w / 2, y = -h / 2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; }
/** contorno polar r(θ) → Shape */
export function polarShape(fn, n = 64) { const s = new THREE.Shape(); for (let i = 0; i <= n; i++) { const a = (i / n) * PI * 2, r = fn(a); const x = Math.cos(a) * r, y = Math.sin(a) * r; if (!i) s.moveTo(x, y); else s.lineTo(x, y); } return s; }
export const glowTexCache = (() => { let t; return () => { if (t) return t; const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); t = new THREE.CanvasTexture(cv); return t; }; })();
export const glow = (color, size, op = 1) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexCache(), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: op })); s.scale.set(size, size, 1); return s; };
export const hsl = (h, s = 0.9, l = 0.55) => new THREE.Color().setHSL(h % 1, s, l);
