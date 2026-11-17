/* Nimbo · corderito-nube de algodón con orejas enormes de nube, arcoíris y chispas doradas */
import * as THREE from 'three';
import { ell, cone, U, sub, smooth01, fbm, vnoise } from '../sdf.js';
import { dMouth, glowSprite } from '../parts.js';

export function nimboDef() {
  const H = [0, 1.6, 0.06];
  const head = U(0.14, ell(H, [0.62, 0.55, 0.56]), ell([-0.42, 1.5, 0.2], [0.26, 0.22, 0.24]), ell([0.42, 1.5, 0.2], [0.26, 0.22, 0.24]), ell([0, 2.12, 0], [0.22, 0.17, 0.2]), ell([-0.2, 2.07, 0.02], [0.16, 0.14, 0.15]), ell([0.2, 2.07, 0.02], [0.16, 0.14, 0.15]), ell([0, 2.0, 0.12], [0.2, 0.14, 0.16]));
  const cav = dMouth([0, 1.37, 0.6], [0.16, 0.1, 0.09], 0.1), headS = sub(head, cav, 0.02);
  const ear = (s) => U(0.16, cone([s * 0.5, 1.68, -0.02], [s * 1.0, 1.64, -0.1], 0.24, 0.36), cone([s * 1.0, 1.64, -0.1], [s * 1.5, 1.52, -0.16], 0.36, 0.42), cone([s * 1.5, 1.52, -0.16], [s * 1.95, 1.36, -0.2], 0.42, 0.34), ell([s * 1.3, 1.82, -0.1], [0.34, 0.26, 0.28]), ell([s * 1.78, 1.68, -0.15], [0.3, 0.24, 0.26]), ell([s * 1.55, 1.25, -0.12], [0.3, 0.22, 0.24]));
  const torso = ell([0, 0.78, 0], [0.5, 0.58, 0.46]), chest = ell([0, 0.9, 0.13], [0.38, 0.38, 0.3]), tail = ell([0, 0.55, -0.46], [0.2, 0.2, 0.2]);
  const arm = (s) => U(0.05, cone([s * 0.45, 1.05, 0.1], [s * 0.7, 0.86, 0.28], 0.12, 0.1), ell([s * 0.74, 0.82, 0.3], [0.13, 0.12, 0.13]));
  const leg = (s) => U(0.05, cone([s * 0.2, 0.46, 0.05], [s * 0.22, 0.17, 0.1], 0.15, 0.12), ell([s * 0.22, 0.09, 0.16], [0.14, 0.09, 0.2]));
  const body = U(0.14, headS, ear(1), ear(-1), torso, chest, tail, arm(1), arm(-1), leg(1), leg(-1));
  const parts = { hips: [torso, tail], spine: [chest], head: [headS], earL: [ear(-1)], earR: [ear(1)], armL: [arm(-1)], armR: [arm(1)], legL: [leg(-1)], legR: [leg(1)] };
  const eyeC = (s) => [s * 0.27, 1.58, 0.45];
  return {
    id: 'nimbo', name: 'Nimbo', bounds: [-2.5, -0.05, -0.9, 2.5, 2.5, 1.0], cell: 0.026, tau: 0.05, body, parts, padColor: '#ffb7c5', darkColor: '#8e2f3f', bellyLight: 0.5,
    bones: [{ n: 'root', p: [0, 0, 0] }, { n: 'hips', parent: 'root', p: [0, 0.6, 0] }, { n: 'spine', parent: 'hips', p: [0, 0.95, 0] }, { n: 'head', parent: 'spine', p: [0, 1.35, 0] }, { n: 'earL', parent: 'head', p: [-0.5, 1.68, 0] }, { n: 'earR', parent: 'head', p: [0.5, 1.68, 0] },
      { n: 'armL', parent: 'spine', p: [-0.45, 1.05, 0.1] }, { n: 'armR', parent: 'spine', p: [0.45, 1.05, 0.1] }, { n: 'legL', parent: 'hips', p: [-0.2, 0.46, 0.05] }, { n: 'legR', parent: 'hips', p: [0.2, 0.46, 0.05] }],
    fur: { length: 0.17, density: 78, thick: 0.72, root: 0xe9dcc6, tip: 0xfffbf0, tipMix: 0.35, gravity: 0.12, wind: 0.04, curl: 0.1, rim: 0.6, rimPow: 2.0, sheenColor: 0xffffff, lenVar: 0.5, env: 1.0 },
    defaults: { fur: '#FFF4DA', accent: '#FFD470', eyes: '#4FA3F7' },
    paint(x, y, z) {
      let acc = 0, belly = 0, pad = 0, dark = 0, fur = 0.75; const earD = Math.abs(x) > 0.75 && y > 1.0 ? 1 : 0;
      if (earD) { fur = 1.35; const t = smooth01(0.95, 2.2, Math.abs(x)); acc = t * 0.85 * (0.6 + 0.4 * fbm(x * 3, y * 3, z * 3)); pad = (1 - t) * 0.12; }
      else if (y > 1.0) { fur = 0.7; const eL = Math.min(Math.hypot(x - 0.27, y - 1.58, z - 0.45), Math.hypot(x + 0.27, y - 1.58, z - 0.45)); fur *= 0.35 + 0.65 * smooth01(0.2, 0.34, eL); const m = Math.hypot(x / 0.2, (y - 1.37) / 0.14, (z - 0.58) / 0.16); fur *= 0.15 + 0.85 * smooth01(0.8, 1.6, m); belly = (1 - smooth01(0.7, 1.8, m)) * 0.6;
        const ch = Math.min(Math.hypot(x - 0.42, y - 1.5, z - 0.35), Math.hypot(x + 0.42, y - 1.5, z - 0.35)); pad = (1 - smooth01(0.0, 0.2, ch)) * 0.55; if (y > 1.95) { acc = smooth01(1.95, 2.3, y) * 0.6; fur = 1.3; } const cv = Math.abs(cav(x, y, z)); if (cv < 0.04 && z > 0.4) { dark = 1; fur *= 0.1; } }
      else { fur = 0.85; belly = (1 - smooth01(0.6, 1.2, Math.hypot(x / 0.34, (y - 0.9) / 0.4, (z - 0.2) / 0.22))) * 0.8; if (y < 0.14) { fur = 0.3; } }
      const tot = acc + belly + pad + dark; if (tot > 1) { acc /= tot; belly /= tot; pad /= tot; dark /= tot; }
      return { z: [acc, belly, pad, dark], fur };
    },
    extras(R) {
      R.eyes = []; [-1, 1].forEach((s) => { const e = R.eye({ r: 0.2, iris: R.look.eyes, lash: true, lidColor: '#f0e2c8', irisSize: 1.05, pupil: 0.3, lowerOpen: 0.85 }); e.userData.baseYaw = s * 0.12; e.rotation.y = s * 0.12; R.attach('head', e, eyeC(s)); R.eyes.push(e); });
      const nose = new THREE.Mesh(new THREE.SphereGeometry(0.04, 20, 14), new THREE.MeshPhysicalMaterial({ color: 0xff9db0, roughness: 0.25, clearcoat: 1, envMapIntensity: 1.3 })); nose.scale.set(1.3, 0.85, 0.9); R.attach('head', nose, [0, 1.46, 0.605]);
      const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), new THREE.MeshPhysicalMaterial({ color: 0xf0708a, roughness: 0.4, clearcoat: 0.7 })); tongue.scale.set(1.4, 0.45, 1); R.attach('head', tongue, [0, 1.325, 0.6]);
      // arcoíris
      const cols = ['#ff5d6c', '#ffa24a', '#ffe04a', '#6fe07a', '#4fb6ff', '#a07bff'], rb = new THREE.Group(); R.props.rbMats = [];
      cols.forEach((c, i) => { const m = new THREE.MeshPhysicalMaterial({ color: c, emissive: c, emissiveIntensity: 0.75, roughness: 0.3, clearcoat: 1, transparent: true, opacity: 0.88, envMapIntensity: 1.2 }); const t = new THREE.Mesh(new THREE.TorusGeometry(0.86 - i * 0.052, 0.027, 12, 56, Math.PI), m); rb.add(t); R.props.rbMats.push(m); });
      rb.position.set(0, 0.0, -0.3); R.attach('head', rb, [0, 2.0, -0.32]); R.props.rainbow = rb;
      // chispas doradas
      R.props.sparks = []; for (let i = 0; i < 14; i++) { const s = glowSprite(0xffe08a, 0.1 + Math.random() * 0.14, 0.9); s.userData = { a: Math.random() * 6.28, r: 1.0 + Math.random() * 1.6, y: 0.4 + Math.random() * 2.2, sp: 0.2 + Math.random() * 0.5, ph: Math.random() * 6 }; R.root.add(s); R.props.sparks.push(s); }
    },
    onLook(R, lk) { if (R.eyes) R.eyes.forEach((e) => { e.userData.setIris(lk.eyes); e.userData.setLid(new THREE.Color(lk.fur).multiplyScalar(0.95)); }); },
    anim(R, t, dt, damp) {
      const B = R.bones, p = R.pose, br = Math.sin(t * 1.6); B.spine.scale.set(1 + br * 0.012, 1 + br * 0.016, 1 + br * 0.012);
      const fl = p === 'celebra' ? 0.35 : 0.09, sp = p === 'celebra' ? 6 : 1.4; B.earL.rotation.z = Math.sin(t * sp) * fl + 0.06; B.earR.rotation.z = -Math.sin(t * sp + 0.4) * fl - 0.06; B.earL.rotation.y = Math.sin(t * 0.9) * 0.05; B.earR.rotation.y = -Math.sin(t * 0.9 + 1) * 0.05;
      R.props.rbMats.forEach((m, i) => { m.emissiveIntensity = 0.7 + Math.sin(t * 2 + i * 0.7) * 0.18; });
      R.props.sparks.forEach((s) => { const u = s.userData, a = u.a + t * u.sp; s.position.set(Math.cos(a) * u.r, u.y + Math.sin(t * 0.8 + u.ph) * 0.12, Math.sin(a) * u.r * 0.6); s.material.opacity = 0.35 + (Math.sin(t * 3 + u.ph) * 0.5 + 0.5) * 0.6; });
      let rz = 0.12, rx = 0, lz = -0.12, jump = 0.06 + Math.sin(t * 1.6) * 0.04;
      if (p === 'saluda') { rz = 2.3 + Math.sin(t * 10) * 0.18; } else if (p === 'celebra') { rz = 2.5 + Math.sin(t * 12) * 0.12; lz = -2.5 - Math.sin(t * 12) * 0.12; jump = 0.18 + Math.abs(Math.sin(t * 4)) * 0.3; } else if (p === 'piensa') { rz = 0.5; rx = -1.9; }
      B.armR.rotation.z = damp(B.armR.rotation.z, rz, 9, dt); B.armR.rotation.x = damp(B.armR.rotation.x, rx, 9, dt); B.armL.rotation.z = damp(B.armL.rotation.z, lz, 9, dt);
      R.root.position.y = damp(R.root.position.y, jump, 12, dt); R.headNod = 0;
    }
  };
}
