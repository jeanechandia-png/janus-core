/* Bombo · ajolote de piel húmeda con branquias de pluma iridiscentes, gran sonrisa y cola de aleta */
import * as THREE from 'three';
import { ell, cone, U, sub, flat, smooth01, fbm, vnoise } from '../sdf.js';
import { feather, dMouth, glowSprite } from '../parts.js';
import { wetSkin } from '../shading.js';

export function bomboDef() {
  const belly = ell([0, 0.84, 0], [0.84, 0.84, 0.72]), head0 = U(0.12, ell([0, 1.72, 0.1], [0.7, 0.54, 0.6]), ell([-0.5, 1.62, 0.28], [0.3, 0.22, 0.26]), ell([0.5, 1.62, 0.28], [0.3, 0.22, 0.26]));
  const cav = dMouth([0, 1.58, 0.6], [0.34, 0.15, 0.2], 0.08), head = sub(head0, cav, 0.03);
  const arm = (s) => U(0.05, cone([s * 0.72, 1.12, 0.08], [s * 1.02, 0.84, 0.3], 0.125, 0.09), ell([s * 1.06, 0.79, 0.33], [0.14, 0.11, 0.1]), ell([s * 1.18, 0.74, 0.4], [0.06, 0.05, 0.05]), ell([s * 1.14, 0.69, 0.44], [0.055, 0.05, 0.05]), ell([s * 1.06, 0.66, 0.46], [0.055, 0.05, 0.05]));
  const leg = (s) => U(0.05, cone([s * 0.4, 0.34, 0.12], [s * 0.5, 0.13, 0.3], 0.22, 0.16), ell([s * 0.52, 0.07, 0.4], [0.25, 0.07, 0.28]));
  const fin = flat(cone([0, 0.5, -0.5], [0.3, 0.45, -1.28], 0.34, 0.06), [0.15, 0.48, -0.9], [1, 0.3, 1]), tail0 = cone([0, 0.5, -0.45], [0.12, 0.48, -0.8], 0.3, 0.2);
  const body = U(0.16, belly, head, arm(1), arm(-1), leg(1), leg(-1), tail0, fin);
  const parts = { hips: [belly, tail0], spine: [belly], head: [head], armL: [arm(-1)], armR: [arm(1)], legL: [leg(-1)], legR: [leg(1)], tail0: [fin] };
  const eyeC = (s) => [s * 0.4, 1.86, 0.46];
  return {
    id: 'bombo', name: 'Bombo', bounds: [-1.5, -0.05, -1.5, 1.5, 2.4, 1.0], cell: 0.022, tau: 0.05, body, parts, noFur: true, skin: () => wetSkin({ sheen: '#ff9a7a' }), padColor: '#ff8fa8', darkColor: '#c8473a', bellyLight: 0.62,
    bones: [{ n: 'root', p: [0, 0, 0] }, { n: 'hips', parent: 'root', p: [0, 0.7, 0] }, { n: 'spine', parent: 'hips', p: [0, 1.0, 0] }, { n: 'head', parent: 'spine', p: [0, 1.4, 0] }, { n: 'armL', parent: 'spine', p: [-0.72, 1.12, 0.08] }, { n: 'armR', parent: 'spine', p: [0.72, 1.12, 0.08] },
      { n: 'legL', parent: 'hips', p: [-0.4, 0.34, 0.12] }, { n: 'legR', parent: 'hips', p: [0.4, 0.34, 0.12] }, { n: 'tail0', parent: 'hips', p: [0, 0.5, -0.45] }],
    fur: { length: 0, density: 1 }, defaults: { fur: '#FF8E70', accent: '#59E4D4', eyes: '#1b1015' },
    paint(x, y, z) {
      let acc = 0, belly = 0, pad = 0, dark = 0;
      const sp = vnoise(x * 11 + 3, y * 11, z * 11), spots = smooth01(0.66, 0.76, sp) * smooth01(0.9, 1.5, y + (z < 0 ? 0.5 : 0)) * 0.3; dark = spots;
      belly = (1 - smooth01(0.5, 1.0, Math.hypot(x / 0.62, (y - 0.82) / 0.7, (z - 0.35) / 0.4))) * 0.95;
      const ch = Math.min(Math.hypot((x - 0.5) / 0.22, (y - 1.64) / 0.17, (z - 0.4) / 0.2), Math.hypot((x + 0.5) / 0.22, (y - 1.64) / 0.17, (z - 0.4) / 0.2)); pad = (1 - smooth01(0.6, 1.2, ch)) * 0.75;
      if (z < -0.5 && y < 0.9) { acc = smooth01(-0.7, -1.15, z) * 0.9; belly *= 0.2; dark *= 0.2; }
      const cv = Math.abs(cav(x, y, z)); if (cv < 0.05 && z > 0.35) { dark = 1; pad = 0; belly = 0; }
      const f = (x > 0.95 || x < -0.95) ? 0 : 0; const tot = acc + belly + pad + dark; if (tot > 1) { acc /= tot; belly /= tot; pad /= tot; dark /= tot; }
      return { z: [acc, belly, pad, dark], fur: 0 };
    },
    extras(R) {
      R.eyes = []; [-1, 1].forEach((s) => { const e = R.eye({ r: 0.13, kind: 'bead', lidColor: '#ff9a84', lowerOpen: 1.3 }); e.userData.baseYaw = s * 0.45; e.rotation.y = s * 0.45; R.attach('head', e, eyeC(s)); R.eyes.push(e); });
      const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.18, 24, 16), new THREE.MeshPhysicalMaterial({ color: 0xff6f8d, roughness: 0.35, clearcoat: 0.8 })); tongue.scale.set(1.35, 0.42, 1); R.attach('head', tongue, [0, 1.5, 0.56]);
      const nostril = new THREE.MeshStandardMaterial({ color: 0x5a2a28, roughness: 0.5 }); [-1, 1].forEach((s) => { const n = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), nostril); R.attach('head', n, [s * 0.07, 1.74, 0.68]); });
      // branquias de pluma
      const gm = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide, envMapIntensity: 0.55, transparent: true, opacity: 0.96 }); gm.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor * 0.55;'); }; gm.customProgramCacheKey = () => 'gill-v1'; R.mats.gill = gm; R.props.gills = [];
      [-1, 1].forEach((s) => { const g = new THREE.Group(); for (let i = 0; i < 3; i++) { const f = feather(0.72 - i * 0.08, 0.17, 24, gm, 0.14 * s, ['#ff4f8b', '#19f0cc'], 0.013); const pv = new THREE.Group(); pv.add(f); pv.rotation.z = -s * (0.05 + i * 0.72); pv.rotation.x = -0.1 - i * 0.05; pv.userData.i = i; g.add(pv); } R.attach('head', g, [s * 0.58, 1.94, -0.06]); g.userData.s = s; R.props.gills.push(g); });
      // aleta de la cola translúcida con degradado
      R.props.finMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.3, clearcoat: 1, envMapIntensity: 1.4 });
    },
    onLook(R, lk) { if (R.eyes) R.eyes.forEach((e) => e.userData.setLid(lk.fur));  },
    anim(R, t, dt, damp) {
      const B = R.bones, p = R.pose, br = Math.sin(t * 2.1); B.spine.scale.set(1 + br * 0.012, 1 + br * 0.018, 1 + br * 0.012);
      R.props.gills.forEach((g, gi) => g.children.forEach((pv, i) => { const base = -g.userData.s * (0.05 + i * 0.72); pv.rotation.z = base + Math.sin(t * (p === 'celebra' ? 9 : 2.4) + i * 0.9 + gi) * (p === 'celebra' ? 0.22 : 0.07); pv.rotation.y = Math.sin(t * 1.9 + i + gi * 2) * 0.1; }));
      B.tail0.rotation.y = Math.sin(t * (p === 'celebra' ? 6 : 2.1)) * 0.35;
      let rz = 0.55, rx = 0, lz = -0.55, jump = 0;
      if (p === 'saluda') { rz = 2.4 + Math.sin(t * 10) * 0.15; } else if (p === 'celebra') { rz = 2.5 + Math.sin(t * 11) * 0.12; lz = -2.5 - Math.sin(t * 11) * 0.12; jump = Math.abs(Math.sin(t * 5)) * 0.3; }
      else if (p === 'piensa') { rz = 0.6; rx = -2.1; } else { rz += Math.sin(t * 1.7) * 0.04; lz -= Math.sin(t * 1.7 + 1) * 0.04; }
      B.armR.rotation.z = damp(B.armR.rotation.z, rz, 9, dt); B.armR.rotation.x = damp(B.armR.rotation.x, rx, 9, dt); B.armL.rotation.z = damp(B.armL.rotation.z, lz, 9, dt);
      R.root.position.y = damp(R.root.position.y, jump + Math.abs(Math.sin(t * 3.2)) * 0.015, 14, dt); R.headNod = 0;
    }
  };
}
