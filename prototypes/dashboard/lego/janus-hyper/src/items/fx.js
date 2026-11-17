/* auras: efectos que rodean a la criatura (no se pegan a un hueso). */
import { THREE, V, PI, mk, grp, at, ball, star, extrude, glow, hsl } from '../kit.js';
import * as M from '../mats.js';
const flameTex = (() => { let t; return () => { if (t) return t; const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128; const g = cv.getContext('2d'); const gr = g.createRadialGradient(32, 90, 2, 32, 80, 56); gr.addColorStop(0, 'rgba(255,255,220,1)'); gr.addColorStop(0.25, 'rgba(255,200,60,.95)'); gr.addColorStop(0.6, 'rgba(255,90,20,.6)'); gr.addColorStop(1, 'rgba(255,40,0,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(32, 2); g.bezierCurveTo(60, 50, 62, 90, 32, 124); g.bezierCurveTo(2, 90, 4, 50, 32, 2); g.fill(); g.globalCompositeOperation = 'source-in'; g.fillStyle = gr; g.fillRect(0, 0, 64, 128); t = new THREE.CanvasTexture(cv); return t; }; })();
const R0 = (A) => A.scale.espalda;
export function auraEstrellas({ A, S, C }) {
  const g = grp(), k = R0(A), gm = M.gold({ emissive: 0xffb020, emissiveIntensity: 0.35 }), items = [];
  for (let i = 0; i < 14; i++) { const s = mk(extrude(star(0.09, 0.042), 0.025, 0.008), gm); const gl = glow(0xffd36a, 0.4, 0.55); s.add(gl); s.userData = { a: (i / 14) * PI * 2, r: (0.95 + (i % 3) * 0.16) * k, y: (0.35 + (i % 5) * 0.4) * k, sp: 0.5 + (i % 4) * 0.12, ph: i }; g.add(s); items.push(s); }
  return { parts: [{ bone: 'root', obj: g, at: [0, 0, 0] }], tick(t) { items.forEach((s) => { const u = s.userData, a = u.a + t * u.sp; s.position.set(Math.cos(a) * u.r, u.y + Math.sin(t * 1.3 + u.ph) * 0.1, Math.sin(a) * u.r * 0.8); s.rotation.set(t * 1.2 + u.ph, t * 1.7, 0); s.scale.setScalar(k * (0.8 + 0.2 * Math.sin(t * 3 + u.ph))); }); } };
}
export function auraBurbujas({ A, S, C }) {
  const g = grp(), k = R0(A), items = [], bm = new THREE.MeshPhysicalMaterial({ color: 0xcfefff, emissive: 0x6fd8ff, emissiveIntensity: 0.28, transparent: true, opacity: 0.38, roughness: 0, metalness: 0, clearcoat: 1, clearcoatRoughness: 0, iridescence: 1, iridescenceIOR: 1.5, iridescenceThicknessRange: [200, 800], envMapIntensity: 3.5, depthWrite: false });
  for (let i = 0; i < 18; i++) { const s = ball(0.08 + (i % 4) * 0.035, bm, 28, 20); s.userData = { a: (i / 18) * PI * 2, r: (0.8 + (i % 3) * 0.2) * k, ph: i * 0.37, sp: 0.35 + (i % 5) * 0.06 }; g.add(s); items.push(s); }
  return { parts: [{ bone: 'root', obj: g, at: [0, 0, 0] }], tick(t) { items.forEach((s) => { const u = s.userData, p = ((t * u.sp * 0.4 + u.ph) % 1 + 1) % 1; s.position.set(Math.cos(u.a + t * 0.3) * u.r, p * 2.6 * k, Math.sin(u.a + t * 0.3) * u.r * 0.8); s.scale.setScalar(k * (0.6 + 0.4 * Math.sin(p * PI))); }); } };
}
export function auraLlamas({ A, S, C }) {
  const g = grp(), k = R0(A), items = [];
  for (let i = 0; i < 16; i++) { const m = new THREE.SpriteMaterial({ map: flameTex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, color: new THREE.Color(C.main).lerp(new THREE.Color(0xffffff), 0.5) }); const sp = new THREE.Sprite(m); sp.userData = { a: (i / 16) * PI * 2, r: (0.85 + (i % 2) * 0.15) * k, ph: i * 0.9, sz: 0.5 + (i % 3) * 0.12 }; g.add(sp); items.push(sp); }
  return { parts: [{ bone: 'root', obj: g, at: [0, 0, 0] }], tick(t) { items.forEach((s) => { const u = s.userData, f = 0.8 + 0.25 * Math.sin(t * 9 + u.ph) + 0.1 * Math.sin(t * 17 + u.ph * 2); s.position.set(Math.cos(u.a + t * 0.5) * u.r, 0.28 * k * f, Math.sin(u.a + t * 0.5) * u.r * 0.85); s.scale.set(u.sz * k * 0.7 * f, u.sz * k * 1.4 * f, 1); s.material.rotation = Math.sin(t * 4 + u.ph) * 0.08; }); } };
}
