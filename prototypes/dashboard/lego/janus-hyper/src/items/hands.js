/* manos: reloj inteligente, móvil, varita y mando. Atados al hueso del brazo para seguir poses (saludar, celebrar). */
import { THREE, V, PI, mk, rbox, lathe, tube, torus, grp, at, rotd, sc, ball, ellipsoid, arcPts, bend, star, extrude, glow, hsl } from '../kit.js';
import * as M from '../mats.js';

export function reloj({ A, S, C }) {
  const g = grp(), band = mk(torus(0.1, 0.028, PI * 2, 12, 40), M.rubber(C.accent, { roughness: 0.5 })); band.rotation.x = PI / 2; band.scale.set(1, 1, 0.55); g.add(band);
  const body = mk(rbox(0.19, 0.045, 0.19, 0.04, 5), M.silver({ roughness: 0.15 })); body.position.set(0, 0.0, 0); body.position.x = 0.115; body.rotation.z = PI / 2; body.rotation.y = 0; g.add(body);
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d'); x.fillStyle = '#05060a'; x.fillRect(0, 0, 128, 128); const g0 = x.createRadialGradient(64, 64, 4, 64, 64, 60); g0.addColorStop(0, '#' + new THREE.Color(C.main).getHexString()); g0.addColorStop(1, '#10141c'); x.fillStyle = g0; x.globalAlpha = 0.35; x.fillRect(0, 0, 128, 128); x.globalAlpha = 1;
  x.strokeStyle = '#7dffb0'; x.lineWidth = 9; x.lineCap = 'round'; x.beginPath(); x.arc(64, 64, 44, -1.57, 3.2); x.stroke(); x.strokeStyle = '#ff6ea8'; x.beginPath(); x.arc(64, 64, 30, -1.57, 1.0); x.stroke(); x.strokeStyle = '#6ec6ff'; x.beginPath(); x.arc(64, 64, 16, -1.57, 4.2); x.stroke(); x.fillStyle = '#fff'; x.font = 'bold 20px sans-serif'; x.textAlign = 'center'; x.fillText('10:09', 64, 71);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; const scr = mk(new THREE.PlaneGeometry(0.16, 0.16), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); scr.position.set(0.1385, 0, 0); scr.rotation.y = PI / 2; g.add(scr);
  const crown = mk(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 16), M.gold()); crown.position.set(0.06, 0.07, -0.0); g.add(crown);
  const d = A.hand.dir, dn = V(d[0], d[1], d[2]).normalize(); g.quaternion.setFromUnitVectors(V(0, 1, 0), dn); const w = grp(g); g.rotation.set(0, 0, 0); const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dn); w.quaternion.copy(q); g.quaternion.identity(); g.rotation.z = PI / 2 * 0; g.rotation.x = 0;
  // el anillo del reloj (eje X en el modelo) se orienta al eje del brazo; la esfera mira hacia fuera (+x lateral)
  const hold = grp(); hold.add(g); g.rotation.set(0, 0, -PI / 2); g.position.set(0, 0, 0); hold.quaternion.copy(q);
  return { parts: [{ bone: 'armR', obj: sc(hold, S), at: A.hand.wrist }] };
}
export function movil({ A, S, C }) {
  const g = grp(), body = mk(rbox(0.21, 0.4, 0.034, 0.03, 5), M.gloss(C.main, { roughness: 0.2, metalness: 0.2 })); g.add(body);
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 256; const x = cv.getContext('2d'); const gr = x.createLinearGradient(0, 0, 128, 256); gr.addColorStop(0, '#' + new THREE.Color(C.accent).getHexString()); gr.addColorStop(0.6, '#7a4dff'); gr.addColorStop(1, '#ff6ea8'); x.fillStyle = gr; x.fillRect(0, 0, 128, 256); x.fillStyle = 'rgba(255,255,255,.95)'; x.font = 'bold 40px sans-serif'; x.textAlign = 'center'; x.fillText('10:09', 64, 70);
  for (let i = 0; i < 12; i++) { x.fillStyle = 'rgba(255,255,255,.9)'; const px = 14 + (i % 4) * 28, py = 110 + Math.floor(i / 4) * 36; x.beginPath(); x.roundRect ? x.roundRect(px, py, 22, 22, 6) : x.rect(px, py, 22, 22); x.fillStyle = ['#ff5d73', '#ffd166', '#06d6a0', '#118ab2'][i % 4]; x.fill(); }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; const scr = mk(new THREE.PlaneGeometry(0.19, 0.38), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); scr.position.z = 0.0175; g.add(scr); g.add(at(mk(new THREE.CylinderGeometry(0.012, 0.012, 0.004, 14), M.gloss(0x0a0a0d)), 0, 0.16, 0.0185)).children[g.children.length - 1].rotation.x = PI / 2;
  const cam = grp(); cam.add(at(mk(rbox(0.07, 0.07, 0.01, 0.02), M.gloss(0x14141a)), 0, 0, 0)); [[-0.012, 0.012], [0.012, 0.012], [0, -0.012]].forEach(([a, b]) => cam.add(at(mk(new THREE.CylinderGeometry(0.012, 0.012, 0.014, 16), M.chrome()), a, b, 0.006)).children[cam.children.length - 1].rotation.x = PI / 2); cam.position.set(-0.05, 0.14, -0.022); g.add(cam);
  g.rotation.set(-0.3, -0.25, 0.1); const w = grp(g); g.position.set(0, 0.05, 0.05);
  return { parts: [{ bone: 'armR', obj: sc(w, S), at: A.hand.c }] };
}
export function varita({ A, S, C }) {
  const g = grp(), stick = mk(tube([V(0, -0.2, 0), V(0, 0.3, 0), V(0, 0.8, 0)], 0.022, 30, 10), M.fabric('leather', 0x1a1210, { amp: 0.04, rough: 0.35 })); g.add(stick);
  g.add(at(mk(lathe([[0.03, 0], [0.036, 0.04], [0.03, 0.08]], 20), M.gold()), 0, -0.22, 0)); g.add(at(mk(lathe([[0.024, 0], [0.04, 0.03], [0.024, 0.06]], 20), M.gold()), 0, 0.2, 0));
  const tip = grp(); tip.add(mk(extrude(star(0.16, 0.075), 0.045, 0.014), M.gold({ roughness: 0.15, emissive: 0xffb020, emissiveIntensity: 0.2 }))); tip.add(at(mk(new THREE.OctahedronGeometry(0.045), M.gem(C.main)), 0, 0, 0.04)); const gl = glow(C.accent, 0.9, 0.7); tip.add(gl); tip.position.set(0, 0.88, 0); g.add(tip);
  const sp = []; for (let i = 0; i < 8; i++) { const s = mk(new THREE.OctahedronGeometry(0.014), M.gold({ emissive: 0xffc94d, emissiveIntensity: 0.6 })); s.userData.i = i; tip.add(s); sp.push(s); }
  const w = grp(g); g.rotation.set(0.6, 0, -0.25); g.position.set(0, 0.0, 0.0);
  return { parts: [{ bone: 'armR', obj: sc(w, S), at: A.hand.c }], tick(t) { tip.rotation.z = Math.sin(t * 2) * 0.08; gl.material.opacity = 0.55 + Math.sin(t * 5) * 0.2; sp.forEach((s) => { const a = t * 2 + s.userData.i * 0.8; s.position.set(Math.cos(a) * 0.16, Math.sin(a * 1.3) * 0.16, 0.06 + Math.sin(a * 2) * 0.04); }); } };
}
export function mando({ A, S, C }) {
  const g = grp(), sh = new THREE.Shape(); sh.moveTo(-0.2, 0.05); sh.bezierCurveTo(-0.2, 0.14, -0.1, 0.16, 0, 0.14); sh.bezierCurveTo(0.1, 0.16, 0.2, 0.14, 0.2, 0.05); sh.bezierCurveTo(0.24, -0.04, 0.24, -0.16, 0.18, -0.18); sh.bezierCurveTo(0.12, -0.2, 0.1, -0.1, 0.06, -0.06); sh.lineTo(-0.06, -0.06); sh.bezierCurveTo(-0.1, -0.1, -0.12, -0.2, -0.18, -0.18); sh.bezierCurveTo(-0.24, -0.16, -0.24, -0.04, -0.2, 0.05);
  const bm = mk(extrude(sh, 0.06, 0.016, 28), M.gloss(0xf2f2f6, { roughness: 0.28 })); g.add(bm);
  [-1, 1].forEach((s) => { const st = grp(); st.add(mk(new THREE.CylinderGeometry(0.03, 0.036, 0.02, 24), M.gloss(0x101014))); st.add(at(mk(new THREE.SphereGeometry(0.026, 20, 12, 0, PI * 2, 0, PI / 2), M.rubber(0x1a1a20)), 0, 0.01, 0)); st.rotation.x = PI / 2; st.position.set(s * 0.1, s > 0 ? -0.0 : 0.0, 0.05); g.add(st); });
  g.children[1].position.set(-0.11, 0.04, 0.05); g.children[2].position.set(0.07, -0.03, 0.05);
  const cols = [0x3ddc84, 0xff5d73, 0x4da3ff, 0xffd166]; cols.forEach((c, i) => { const b = mk(new THREE.CylinderGeometry(0.018, 0.018, 0.012, 16), M.gloss(c, { roughness: 0.3 })); b.rotation.x = PI / 2; b.position.set(0.12 + Math.cos(i * 1.57) * 0.04, 0.05 + Math.sin(i * 1.57) * 0.04, 0.066); g.add(b); });
  const dp = mk(new THREE.BoxGeometry(0.07, 0.02, 0.012), M.gloss(0x101014)); dp.position.set(-0.11, -0.03, 0.066); g.add(dp); const dp2 = dp.clone(); dp2.rotation.z = PI / 2; g.add(dp2);
  const ring = mk(rbox(0.12, 0.012, 0.012, 0.004), M.neon(C.main, 1.8)); ring.position.set(0, 0.11, 0.066); g.add(ring);
  g.rotation.set(-0.9, -0.3, 0.1); const w = grp(g); g.position.set(0, 0.0, 0.08);
  return { parts: [{ bone: 'armR', obj: sc(w, S * 1.3), at: A.hand.c }] };
}
