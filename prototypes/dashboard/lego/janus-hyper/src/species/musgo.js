/* Musgo · duendecillo de roca cubierto de musgo vivo, con flor, helechos enrollados y una luciérnaga amiga */
import * as THREE from 'three';
import { ell, cone, U, sub, flat, smooth01, fbm, vnoise, disp } from '../sdf.js';
import { dMouth, glowSprite, goldMat, fiddlehead } from '../parts.js';
import { rock } from '../shading.js';

export function musgoDef() {
  const stone = disp(U(0.25, ell([0, 0.98, 0], [0.92, 0.86, 0.78]), ell([0, 0.55, 0.05], [0.8, 0.5, 0.7])), 0.05, 2.3, 3, 1.7);
  const cav = dMouth([0.0, 0.8, 0.74], [0.3, 0.16, 0.16], 0.1), body0 = sub(stone, cav, 0.03);
  const armL = U(0.08, cone([-0.8, 0.9, 0.2], [-1.08, 0.62, 0.3], 0.2, 0.17), ell([-1.12, 0.56, 0.32], [0.2, 0.18, 0.18]));
  const armR = U(0.08, cone([0.8, 0.9, 0.2], [1.1, 1.2, 0.36], 0.2, 0.17), ell([1.12, 1.28, 0.38], [0.2, 0.19, 0.19]), cone([1.12, 1.34, 0.4], [1.12, 1.6, 0.4], 0.075, 0.062));
  const leg = (s) => U(0.08, ell([s * 0.4, 0.22, 0.15], [0.3, 0.26, 0.3]), ell([s * 0.4, 0.08, 0.26], [0.34, 0.1, 0.38]));
  const body = U(0.1, body0, armL, armR, leg(1), leg(-1));
  const parts = { spine: [body0], head: [], armL: [armL], armR: [armR], legL: [leg(-1)], legR: [leg(1)] };
  const eyeC = (s) => [s * 0.3, 1.16, 0.66];
  return {
    id: 'musgo', name: 'Musgo', bounds: [-1.5, -0.05, -1.0, 1.5, 2.2, 1.2], cell: 0.022, tau: 0.05, body, parts: { hips: [leg(-1), leg(1)], ...parts, head: [ell([0, 1.1, 0.5], [0.4, 0.3, 0.2])] }, skin: () => rock(), padColor: '#b9a98c', darkColor: '#6d1d28', bellyLight: 0.3,
    bones: [{ n: 'root', p: [0, 0, 0] }, { n: 'hips', parent: 'root', p: [0, 0.4, 0] }, { n: 'spine', parent: 'hips', p: [0, 0.8, 0] }, { n: 'head', parent: 'spine', p: [0, 1.1, 0.2] }, { n: 'armL', parent: 'spine', p: [-0.8, 0.9, 0.2] }, { n: 'armR', parent: 'spine', p: [0.8, 0.9, 0.2] }, { n: 'legL', parent: 'hips', p: [-0.4, 0.3, 0.15] }, { n: 'legR', parent: 'hips', p: [0.4, 0.3, 0.15] }],
    fur: { length: 0.12, density: 125, thick: 0.72, root: 0x6f8c52, tip: 0xe2f07a, tipMix: 0.5, gravity: 0.18, wind: 0.025, curl: 0.05, rim: 0.4, rimPow: 2.2, sheenColor: 0xd8ff8a, lenVar: 0.55, env: 0.8 },
    defaults: { fur: '#6FA63A', accent: '#A89F8C', eyes: '#F2A63B' },
    paint(x, y, z) {
      // accent = piedra, fur = musgo. Mapa de musgo: coronilla, hombros, espalda, brazos y pies.
      const n = fbm(x * 3.1 + 2, y * 3.1, z * 3.1);
      let mo = smooth01(1.28, 1.7, y + (n - 0.5) * 0.7) + smooth01(0.1, -0.45, z - (y - 0.4) * 0.3 + (n - 0.5) * 0.4) * smooth01(0.3, 0.9, y);
      mo += smooth01(0.7, 1.1, Math.abs(x) + (n - 0.5) * 0.4) * 0.7 * smooth01(0.0, 0.5, 1.05 - y + 0.0 * z) * 0 + (Math.abs(x) > 0.9 ? smooth01(0.9, 1.1, Math.abs(x)) * (n > 0.4 ? 1 : 0.5) : 0);
      mo += (1 - smooth01(0.0, 0.42, y)) * 0.9 * smooth01(0.3, 0.6, n + 0.15); mo += smooth01(0.55, 0.7, n) * 0.35 * smooth01(0.4, 0.9, y);
      const face = Math.hypot((x) / 0.62, (y - 0.98) / 0.45, (z - 0.55) / 0.35); mo *= smooth01(0.8, 1.3, face);
      mo = Math.max(0, Math.min(1, mo)); const stoneW = 1 - mo; const mouth = Math.abs(cav(x, y, z)); const d = (mouth < 0.05 && z > 0.5) ? 1 - smooth01(0.02, 0.05, mouth) : 0;
      const sv = (fbm(x * 6, y * 6, z * 6) - 0.5) * 0.28; // variación de tono en la piedra
      return { z: [Math.min(1, stoneW * (1 - d)) * (1 - 0.0), 0, 0, d], fur: mo * (1 - d) * (1.0 + (n - 0.5)) };
    },
    extras(R) {
      R.eyes = [];
      [-1, 1].forEach((s) => { const e = R.eye({ r: 0.175, iris: R.look.eyes, lash: false, lidColor: '#b9a98c', irisSize: 1.0, pupil: 0.3, lowerOpen: 0.95, winkArc: s < 0 }); e.userData.baseYaw = s * 0.2; e.rotation.y = s * 0.2; R.attach('head', e, eyeC(s)); R.eyes.push(e); });
      R.wink = R.eyes[0]; // guiño del ojo izquierdo (el de la derecha en pantalla)
      const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.15, 22, 16), new THREE.MeshPhysicalMaterial({ color: 0xf0708a, roughness: 0.4, clearcoat: 0.7 })); tongue.scale.set(1.3, 0.42, 1); R.attach('head', tongue, [0, 0.72, 0.7]);
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.065, 0.025), new THREE.MeshPhysicalMaterial({ color: 0xfffaf0, roughness: 0.3, clearcoat: 0.5 })); R.attach('head', tooth, [0.02, 0.89, 0.8]);
      // flor
      const fl = new THREE.Group(), pm = new THREE.MeshPhysicalMaterial({ color: 0xfffbf2, roughness: 0.45, sheen: 1, sheenColor: new THREE.Color(0xffffff), side: THREE.DoubleSide, envMapIntensity: 1.2, emissive: 0xfff3d6, emissiveIntensity: 0.12 });
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2, g = new THREE.SphereGeometry(0.1, 20, 14); g.scale(0.55, 1.1, 0.12); g.translate(0, 0.12, 0); const m = new THREE.Mesh(g, pm); m.rotation.z = a; m.rotation.x = 0.0; fl.add(m); }
      const ctr = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), new THREE.MeshPhysicalMaterial({ color: 0xffbc1f, roughness: 0.5, emissive: 0xff9f00, emissiveIntensity: 0.25 })); ctr.position.z = 0.03; fl.add(ctr); fl.scale.setScalar(1.25); fl.rotation.set(-0.7, 0.2, 0.3); R.attach('spine', fl, [0.05, 1.95, 0.3]); R.props.flower = fl;
      // helechos enrollados
      const hm = new THREE.MeshPhysicalMaterial({ color: 0x78b83c, roughness: 0.45, emissive: 0x3c6b1c, emissiveIntensity: 0.12, envMapIntensity: 1 }); R.props.ferns = [];
      [[0.38, 1.93, 0.0, 0.1, -0.38], [-0.4, 1.92, -0.05, -0.1, 0.4]].forEach((f, i) => { const h = fiddlehead(0.62 - i * 0.06, 1, 0.026, hm); h.rotation.z = f[4]; h.rotation.y = i ? 0.6 : -0.6; R.attach('spine', h, [f[0], f[1], f[2]]); R.props.ferns.push(h); });
      // luciérnaga
      const ff = new THREE.Group(), bm = new THREE.MeshPhysicalMaterial({ color: 0x3a2314, roughness: 0.4, clearcoat: 0.8 }), gm = new THREE.MeshBasicMaterial({ color: 0xffe27a, toneMapped: false });
      const thorax = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), bm), abd = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), gm), hd = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), bm);
      abd.scale.set(1, 0.9, 1.35); abd.position.set(0, -0.0, -0.1); hd.position.set(0, 0.01, 0.07); ff.add(thorax, abd, hd);
      const wmat = new THREE.MeshPhysicalMaterial({ color: 0xfff1b8, transparent: true, opacity: 0.55, roughness: 0.1, side: THREE.DoubleSide, iridescence: 1, depthWrite: false }); R.props.ffw = [-1, 1].map((s) => { const w = new THREE.Mesh(new THREE.CircleGeometry(0.1, 20), wmat); w.scale.set(0.6, 1.5, 1); w.position.set(s * 0.06, 0.07, -0.02); w.rotation.set(Math.PI / 2 - 0.2, 0, s * 0.5); ff.add(w); return w; });
      const gs = glowSprite(0xffd95a, 0.3, 0.55); gs.position.set(0, 0, -0.1); ff.add(gs); R.attach('spine', ff, [-1.0, 1.55, 0.35]); R.props.fly = ff;
    },
    onLook(R, lk) { if (R.eyes) R.eyes.forEach((e) => { e.userData.setIris(lk.eyes); e.userData.setLid(lk.accent); }); },
    anim(R, t, dt, damp) {
      const B = R.bones, p = R.pose, br = Math.sin(t * 1.8); B.spine.scale.set(1 + br * 0.008, 1 + br * 0.012, 1 + br * 0.008);
      R.props.fly.position.y = 1.55 - R.rest.spine[1] + Math.sin(t * 1.7) * 0.08; R.props.fly.position.x = -1.0 + Math.sin(t * 0.9) * 0.07; R.props.ffw.forEach((w, i) => { w.rotation.z = (i ? 1 : -1) * (0.5 + Math.sin(t * 38) * 0.35); });
      R.props.ferns.forEach((f, i) => { f.rotation.x = Math.sin(t * 1.3 + i * 2) * 0.06; }); R.props.flower.rotation.z = 0.3 + Math.sin(t * 1.1) * 0.05;
      let rz = 0, lz = 0, jump = 0, wink = Math.sin(t * 0.45) > -0.55 ? 1 : 0;
      if (p === 'saluda') { rz = -0.4 - Math.sin(t * 9) * 0.1; } else if (p === 'celebra') { jump = Math.abs(Math.sin(t * 5)) * 0.25; wink = 1; }
      B.armR.rotation.z = damp(B.armR.rotation.z, rz, 9, dt); B.armL.rotation.z = damp(B.armL.rotation.z, lz, 9, dt); R.root.position.y = damp(R.root.position.y, jump, 14, dt);
      R.eyes[0].scale.z = damp(R.eyes[0].scale.z, 1 - wink * 0.5, 14, dt); R.eyes[0].userData.winkK = wink;
      R.headNod = 0;
    }
  };
}
