/* eyes.js · ojos hiperrealistas: esclera, iris con fibras (textura polar), pupila, córnea húmeda con reflejos, párpado y pestañas */
import * as THREE from 'three';
import { vnoise } from './sdf.js';

const cache = new Map();
export function irisTexture(hex, pupil = 0.34) {
  const key = hex + pupil; if (cache.has(key)) return cache.get(key);
  const W = 512, H = 160, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'), img = g.createImageData(W, H);
  const c = new THREE.Color(hex), r0 = c.r, g0 = c.g, b0 = c.b, ring = new THREE.Color(hex).lerp(new THREE.Color(0xffffff), 0.38);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const rho = y / (H - 1), a = (x / W) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    const fib = vnoise(ca * 6 + 3, sa * 6 + 1, rho * 2.2) * 0.6 + vnoise(ca * 14, sa * 14, rho * 3.5) * 0.4;
    let k = 0.62 + fib * 0.75; const inner = 1 - Math.min(1, Math.abs(rho - 0.46) / 0.12); // collarete claro
    let r = r0 * k, gg = g0 * k, b = b0 * k;
    r += (ring.r - r0) * inner * 0.55; gg += (ring.g - g0) * inner * 0.55; b += (ring.b - b0) * inner * 0.55;
    const dark = Math.pow(Math.max(0, (rho - 0.7) / 0.3), 1.6); r *= 1 - 0.78 * dark; gg *= 1 - 0.78 * dark; b *= 1 - 0.78 * dark; // limbo oscuro
    const glow = Math.max(0, 1 - rho / 0.75) * 0.28; r += glow * (0.2 + r0); gg += glow * (0.2 + g0); b += glow * (0.2 + b0);
    const pm = THREE.MathUtils.smoothstep(rho, pupil - 0.025, pupil + 0.02); // 0 dentro de la pupila
    r *= pm * 0.98 + 0.02; gg *= pm * 0.98 + 0.02; b *= pm * 0.98 + 0.02;
    const o = (y * W + x) * 4; img.data[o] = Math.min(255, r * 255); img.data[o + 1] = Math.min(255, gg * 255); img.data[o + 2] = Math.min(255, b * 255); img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.wrapS = THREE.RepeatWrapping; cache.set(key, t); return t;
}

const hiMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });

/** opts: { r, iris, pupil, sclera, lidColor, lash, kind: 'round'|'bead', irisSize } → Group con .userData { lid, setIris(hex), blink(k 0..1) } */
export function makeEye(o) {
  const r = o.r, g = new THREE.Group(), kind = o.kind || 'round';
  const scl = new THREE.MeshPhysicalMaterial({ color: o.sclera ?? 0xfff8ef, roughness: 0.28, clearcoat: 0.6, clearcoatRoughness: 0.2, envMapIntensity: 0.8 });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 40, 28), kind === 'bead' ? new THREE.MeshPhysicalMaterial({ color: 0x07060a, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.6 }) : scl);
  g.add(ball);
  let irisMat = null, iris = null;
  if (kind !== 'bead') {
    const th = o.irisSize ?? 0.95; // radio angular del iris (rad)
    const geo = new THREE.SphereGeometry(r * 1.004, 56, 20, 0, Math.PI * 2, 0, th); geo.rotateX(Math.PI / 2);
    irisMat = new THREE.MeshPhysicalMaterial({ map: irisTexture(o.iris, o.pupil ?? 0.34), roughness: 0.35, clearcoat: 0.5, envMapIntensity: 0.7, emissive: 0xffffff, emissiveMap: irisTexture(o.iris, o.pupil ?? 0.34), emissiveIntensity: 0.18 });
    iris = new THREE.Mesh(geo, irisMat); g.add(iris);
    // sombra de oclusión del párpado sobre la parte alta del ojo (da profundidad)
    const occ = new THREE.Mesh(new THREE.SphereGeometry(r * 1.012, 40, 14, 0, Math.PI * 2, 0, 0.9), new THREE.MeshBasicMaterial({ color: 0x1a0d08, transparent: true, opacity: 0.0, depthWrite: false }));
    g.add(occ);
  }
  const cornea = new THREE.Mesh(new THREE.SphereGeometry(r * 1.03, 48, 28, 0, Math.PI * 2, 0, 1.35), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, roughness: 0.0, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.0, envMapIntensity: 3.2, depthWrite: false }));
  cornea.geometry.rotateX(Math.PI / 2); g.add(cornea);
  const hl = (dir, s) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r * s, 14, 10), hiMat); const d = new THREE.Vector3(...dir).normalize().multiplyScalar(r * 1.035); m.position.copy(d); m.scale.set(1, 1, 0.35); m.lookAt(d.clone().multiplyScalar(2)); g.add(m); return m; };
  const bead = kind === 'bead';
  hl(bead ? [-0.38, 0.5, 1] : [-0.34, 0.42, 1], bead ? 0.2 : 0.22); hl(bead ? [0.34, -0.3, 1] : [0.42, -0.34, 1], bead ? 0.09 : 0.1);
  // párpado superior
  const lidMat = new THREE.MeshPhysicalMaterial({ color: o.lidColor ?? 0xe9d3b0, roughness: 0.7, sheen: 0.8, sheenColor: new THREE.Color(0xffffff), envMapIntensity: 0.7, side: THREE.DoubleSide });
  const lid = new THREE.Group(); const lidGeo = new THREE.SphereGeometry(r * 1.07, 40, 18, 0, Math.PI * 2, 0, Math.PI / 2); const lidMesh = new THREE.Mesh(lidGeo, lidMat); lid.add(lidMesh);
  if (o.lash) { const pts = []; for (let i = 0; i <= 24; i++) { const a = -Math.PI / 2 + (i / 24) * Math.PI; pts.push(new THREE.Vector3(Math.sin(a) * r * 1.075, 0, Math.cos(a) * r * 1.075)); } const lash = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, r * 0.045, 6), new THREE.MeshStandardMaterial({ color: o.lashColor ?? 0x1c0f0a, roughness: 0.5 })); lid.add(lash);
    for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + ((i + 0.5) / 6) * Math.PI, base = new THREE.Vector3(Math.sin(a) * r * 1.08, 0, Math.cos(a) * r * 1.08); const tip = base.clone().add(new THREE.Vector3(Math.sin(a) * r * 0.32, r * 0.1, Math.cos(a) * r * 0.24)); const f = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([base, base.clone().lerp(tip, 0.5).add(new THREE.Vector3(0, r * 0.1, 0)), tip]), 8, r * 0.022, 5), lash.material); lid.add(f); } }
  if (o.winkArc) { const pts = []; for (let i = 0; i <= 16; i++) { const a = -0.8 + (i / 16) * 1.6; pts.push(new THREE.Vector3(Math.sin(a) * r * 1.0, Math.cos(a) * r * 0.28 - r * 0.06, r * 1.12)); } const arc = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, r * 0.045, 6), new THREE.MeshStandardMaterial({ color: 0x2b1a12, roughness: 0.5 })); arc.visible = false; g.add(arc); g.userData.arc = arc; }
  g.add(lid);
  const low = new THREE.Group(); low.add(new THREE.Mesh(new THREE.SphereGeometry(r * 1.066, 40, 18, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), lidMat)); low.rotation.x = o.lowerOpen ?? 1.0; g.add(low);
  const open = o.openAngle ?? -1.05;
  g.userData = { lid, lidMat, irisMat, ball, openAngle: open, blink(k) { lid.rotation.x = open + (Math.PI / 2 + 0.25 - open) * k; if (g.userData.arc) g.userData.arc.visible = k > 0.85; }, setIris(hex) { if (irisMat) { const t = irisTexture(hex, o.pupil ?? 0.34); irisMat.map = t; irisMat.emissiveMap = t; irisMat.needsUpdate = true; } }, setLid(c) { lidMat.color.set(c); } };
  g.userData.blink(0); return g;
}
