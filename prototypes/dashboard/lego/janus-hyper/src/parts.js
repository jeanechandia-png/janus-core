/* parts.js · piezas orgánicas reutilizables: plumas, alas translúcidas, pétalos, medias lunas, estrellas, espirales */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const goldMat = (o) => new THREE.MeshPhysicalMaterial(Object.assign({ color: 0xffc94d, metalness: 1, roughness: 0.22, clearcoat: 0.6, clearcoatRoughness: 0.1, envMapIntensity: 1.6 }, o || {}));

/** pluma: raquis curvo + bárbulas finas; devuelve una malla con material translúcido luminoso */
export function feather(len, width, barbs, mat, curve = 0.15, grad, barbR = 0.0055) {
  const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector3(Math.sin(t * 1.4) * curve * len, t * len, t * t * curve * len * 0.5)); }
  const cur = new THREE.CatmullRomCurve3(pts), geos = [new THREE.TubeGeometry(cur, 16, 0.009, 6)];
  const z = new THREE.Vector3(0, 0, 1); let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let k = 0; k < barbs; k++) {
    const t = 0.1 + 0.88 * (k / (barbs - 1)), p = cur.getPoint(t), tg = cur.getTangent(t).normalize(), sd = new THREE.Vector3().crossVectors(tg, z).normalize();
    const l = width * (Math.sin(Math.PI * Math.min(1, t * 1.05)) * 0.85 + 0.2) * (0.82 + rnd() * 0.36);
    [-1, 1].forEach((s) => { const tip = p.clone().addScaledVector(sd, s * l).addScaledVector(tg, l * 0.9), mid = p.clone().lerp(tip, 0.5).addScaledVector(tg, l * 0.1).addScaledVector(z, 0.01);
      geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([p, mid, tip]), 5, barbR, 5)); });
  }
  const mg = mergeGeometries(geos);
  if (grad) { const c0 = new THREE.Color(grad[0]), c1 = new THREE.Color(grad[1]), p = mg.attributes.position, col = new Float32Array(p.count * 3), t = new THREE.Color(); for (let i = 0; i < p.count; i++) { t.copy(c0).lerp(c1, Math.min(1, Math.max(0, p.getY(i) / len * 1.1))); col[i * 3] = t.r; col[i * 3 + 1] = t.g; col[i * 3 + 2] = t.b; } mg.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
  const m = new THREE.Mesh(mg, mat); m.castShadow = false; return m;
}
import { ell as _ell } from './sdf.js';
/** cavidad de boca abierta en forma de D (borde superior recto, inferior redondeado) */
export const dMouth = (c, r, cut = 0.12) => { const e = _ell(c, r); return (x, y, z) => Math.max(e(x, y, z), y - (c[1] + r[1] * cut)); };

/** forma de ala de mariposa (lóbulo superior grande + inferior pequeño) con curvatura suave */
export function wingShape() {
  const s = new THREE.Shape(); s.moveTo(0, 0); s.bezierCurveTo(0.18, 0.5, 0.6, 0.98, 1.02, 0.92); s.bezierCurveTo(1.3, 0.82, 1.24, 0.38, 1.02, 0.12);
  s.bezierCurveTo(1.08, -0.16, 0.88, -0.62, 0.56, -0.64); s.bezierCurveTo(0.3, -0.64, 0.1, -0.3, 0, 0); return s;
}
export function wingMesh(shape, mat, bend = 0.12) {
  const g = new THREE.ShapeGeometry(shape, 28), p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, x * x * bend - Math.abs(y) * 0.05); uv.setXY(i, (x + 0.05) / 1.4, (y + 0.7) / 1.7); }
  g.computeVertexNormals(); return new THREE.Mesh(g, mat);
}
export function wingTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 512; const g = cv.getContext('2d');
  // gradiente perlado: lavanda en la raíz, rosa, turquesa y dorado hacia el borde (el material no lo tiñe, se mezcla con el tinte)
  const gr = g.createLinearGradient(20, 330, 500, 250); gr.addColorStop(0, 'rgba(225,205,255,0.95)'); gr.addColorStop(0.3, 'rgba(255,190,235,0.9)'); gr.addColorStop(0.62, 'rgba(160,235,255,0.88)'); gr.addColorStop(0.9, 'rgba(255,226,160,0.85)'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  const rg = g.createRadialGradient(60, 320, 5, 120, 300, 300); rg.addColorStop(0, 'rgba(255,255,255,0.85)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(0, 0, 512, 512);
  g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 90; i++) { const x = 80 + Math.random() * 400, y = 40 + Math.random() * 440, r = 0.8 + Math.random() * 2.2; g.fillStyle = 'rgba(255,255,255,' + (0.25 + Math.random() * 0.5) + ')'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  g.globalCompositeOperation = 'source-over'; g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1.6; for (let i = -5; i <= 5; i++) { g.beginPath(); g.moveTo(36, 330); g.quadraticCurveTo(200, 330 + i * 24, 470, 330 + i * 60); g.stroke(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
export function crescent(R, depth = 0.01) {
  const s = new THREE.Shape(); s.absarc(0, 0, R, -2.2, 2.2, false); s.absarc(R * 0.38, 0, R * 0.82, 2.0, -2.0, true);
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 20 });
}
export function starGeo(R, r, depth = 0.02, n = 5) {
  const s = new THREE.Shape(); for (let i = 0; i < n * 2; i++) { const rr = i % 2 ? r : R, a = Math.PI / 2 + (i * Math.PI) / n; const x = Math.cos(a) * rr, y = Math.sin(a) * rr; if (!i) s.moveTo(x, y); else s.lineTo(x, y); } s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: depth * 0.4, bevelThickness: depth * 0.4, bevelSegments: 2 });
}
/** espiral de helecho (tallo que se enrolla) */
export function fiddlehead(h, curl, rad, mat) {
  const R0 = h * 0.16, pts = [], c = new THREE.Vector3(0, h * 0.58 + R0, 0);
  for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector3(Math.sin(t * 2.2) * 0.02, t * h * 0.58, 0)); }
  for (let i = 1; i <= 30; i++) { const u = i / 30, a = u * Math.PI * 2 * 1.25 * curl, r = R0 * (1 - u * 0.78); pts.push(new THREE.Vector3(c.x + r * Math.sin(a), c.y - r * Math.cos(a), 0)); }
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 90, rad, 8), mat);
}
export const glowTex = (() => { let t; return () => { if (t) return t; const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); t = new THREE.CanvasTexture(cv); return t; }; })();
export function glowSprite(color, size, op = 1) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: op })); s.scale.set(size, size, 1); return s; }
