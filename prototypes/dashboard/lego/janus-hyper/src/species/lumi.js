/* Lumi · zorrito de luz con orejas enormes, alas de mariposa iridiscentes, antenas de pluma y cola esponjosa */
import * as THREE from 'three';
import { ell, cone, U, sub, flat, smooth01, fbm, vnoise, move } from '../sdf.js';
import { feather, wingShape, wingMesh, wingTexture, goldMat, crescent, glowSprite } from '../parts.js';

export function lumiDef() {
  const H = [0, 1.5, 0.05];
  const head0 = U(0.1, ell(H, [0.64, 0.54, 0.56]), ell([-0.47, 1.4, 0.15], [0.29, 0.24, 0.26]), ell([0.47, 1.4, 0.15], [0.29, 0.24, 0.26]), ell([0, 1.335, 0.5], [0.22, 0.16, 0.18]));
  const cav0 = ell([0, 1.272, 0.63], [0.2, 0.115, 0.13]), cav = (x, y, z) => Math.max(cav0(x, y, z), y - 1.285 + 0.0), head = sub(head0, cav, 0.02);
  const earBase = (s) => [s * 0.34, 1.9, 0.0], earTip = (s) => [s * 0.82, 2.48, -0.1];
  const bowl = (s) => ell([s * 0.56, 2.15, 0.13], [0.125, 0.27, 0.1]);
  const ear = (s) => { const b = earBase(s), t = earTip(s); return sub(flat(cone(b, t, 0.24, 0.03), [(b[0] + t[0]) / 2, (b[1] + t[1]) / 2, 0], [1, 1, 0.4]), bowl(s), 0.04); };
  const spine = ell([0, 0.95, 0], [0.4, 0.46, 0.34]), hips = ell([0, 0.62, 0], [0.36, 0.3, 0.31]), chest = ell([0, 1.0, 0.13], [0.3, 0.32, 0.24]);
  const arm = (s) => U(0.05, cone([s * 0.37, 1.08, 0.04], [s * 0.5, 0.68, 0.2], 0.105, 0.088), ell([s * 0.51, 0.64, 0.22], [0.115, 0.105, 0.115]));
  const leg = (s) => U(0.05, cone([s * 0.19, 0.58, 0], [s * 0.21, 0.18, 0.03], 0.17, 0.125), ell([s * 0.22, 0.095, 0.15], [0.15, 0.095, 0.24]));
  const tail0 = cone([0, 0.6, -0.28], [0, 0.72, -0.7], 0.14, 0.24), tail1 = cone([0, 0.72, -0.7], [0, 1.08, -1.04], 0.24, 0.31), tail2 = U(0.1, cone([0, 1.08, -1.04], [0.04, 1.58, -1.0], 0.31, 0.22), cone([0.04, 1.58, -1.0], [0.06, 2.0, -0.8], 0.22, 0.07));
  const body = U(0.09, head, spine, hips, chest, ear(1), ear(-1), arm(1), arm(-1), leg(1), leg(-1), tail0, tail1, tail2);
  const parts = { hips: [hips, tail0], spine: [spine, chest], head: [head], earL: [ear(-1)], earR: [ear(1)], armL: [arm(-1)], armR: [arm(1)], legL: [leg(-1)], legR: [leg(1)], tail0: [tail0], tail1: [tail1], tail2: [tail2] };
  const eyeC = (s) => [s * 0.285, 1.55, 0.42];
  const def = {
    id: 'lumi', name: 'Lumi', bounds: [-1.0, -0.05, -1.3, 1.0, 2.6, 0.95], cell: 0.022, tau: 0.045, body, parts, padColor: '#e7a2c0', darkColor: '#8e2f3f', bellyLight: 0.6,
    bones: [{ n: 'root', p: [0, 0, 0] }, { n: 'hips', parent: 'root', p: [0, 0.6, 0] }, { n: 'spine', parent: 'hips', p: [0, 0.9, 0] }, { n: 'head', parent: 'spine', p: [0, 1.3, 0] }, { n: 'earL', parent: 'head', p: [-0.34, 1.88, 0] }, { n: 'earR', parent: 'head', p: [0.34, 1.88, 0] },
      { n: 'armL', parent: 'spine', p: [-0.37, 1.08, 0.04] }, { n: 'armR', parent: 'spine', p: [0.37, 1.08, 0.04] }, { n: 'legL', parent: 'hips', p: [-0.19, 0.58, 0] }, { n: 'legR', parent: 'hips', p: [0.19, 0.58, 0] },
      { n: 'tail0', parent: 'hips', p: [0, 0.62, -0.3] }, { n: 'tail1', parent: 'tail0', p: [0, 0.8, -0.7] }, { n: 'tail2', parent: 'tail1', p: [0, 1.08, -1.04] }],
    fur: { length: 0.088, density: 105, thick: 0.66, root: 0xd2c3b2, tip: 0xfff6e6, tipMix: 0.3, gravity: 0.32, wind: 0.03, curl: 0.03, rim: 0.32, rimPow: 2.6, sheenColor: 0xffffff, lenVar: 0.5 },
    defaults: { fur: '#F7E6CB', accent: '#BBA5E6', eyes: '#F2A63B' },
    paint(x, y, z, nx, ny, nz) {
      let acc = 0, belly = 0, pad = 0, dark = 0, fur = 0.55;
      const dT = Math.min(tail0(x, y, z), tail1(x, y, z), tail2(x, y, z)), dE = Math.min(ear(1)(x, y, z), ear(-1)(x, y, z)), dHd = head(x, y, z), dLg = Math.min(leg(1)(x, y, z), leg(-1)(x, y, z)), dAr = Math.min(arm(1)(x, y, z), arm(-1)(x, y, z));
      const mn = Math.min(dT, dE, dHd, dLg, dAr, spine(x, y, z));
      if (dT === mn && z < -0.2 && y > 0.5) { fur = 1.75; const n = fbm(x * 3.2 + 4, y * 3.2, z * 3.2); acc = smooth01(0.5, 0.72, n) * 0.85; if (y > 1.75) { acc *= 0.3; belly = smooth01(1.7, 2.0, y) * 0.7; } }
      else if (dE === mn && y > 1.8) {
        fur = 0.6; const b = Math.min(bowl(1)(x, y, z), bowl(-1)(x, y, z)); const inner = 1 - smooth01(-0.02, 0.07, b);
        acc = smooth01(1.95, 2.35, y) * 0.95 * (1 - inner); pad = inner * 0.75; acc += inner * 0.2; fur = 0.6 - inner * 0.4 + (1 - smooth01(0.0, 0.1, Math.abs(b - 0.05))) * 0.9 * inner;
      } else if (dLg === mn && y < 0.75) { fur = 0.55; acc = (1 - smooth01(0.24, 0.42, y + (vnoise(x * 9, y * 9, z * 9) - 0.5) * 0.12)) * 0.95; if (y < 0.03) pad = 0.8; }
      else if (dAr === mn && y < 0.9) { fur = 0.45; const k = 1 - smooth01(0.7, 0.9, y); acc = 0.0; if (y < 0.78) fur = 0.28; }
      else if (dHd === mn || y > 1.05) {
        fur = 0.55; const eL = Math.hypot(x - 0.275, y - 1.545, z - 0.43), eR = Math.hypot(x + 0.275, y - 1.545, z - 0.43), ee = Math.min(eL, eR); fur *= 0.35 + 0.65 * smooth01(0.2, 0.34, ee);
        const m = Math.hypot(x / 0.3, (y - 1.3) / 0.2, (z - 0.58) / 0.22); belly = (1 - smooth01(0.6, 1.5, m)) * 0.9; fur *= 0.15 + 0.85 * smooth01(0.7, 1.4, m);
        const ch = Math.min(Math.hypot((x - 0.5) / 0.3, (y - 1.4) / 0.25, (z - 0.15) / 0.28), Math.hypot((x + 0.5) / 0.3, (y - 1.4) / 0.25, (z - 0.15) / 0.28)); fur += (1 - smooth01(0.7, 1.35, ch)) * 0.9 * smooth01(0.0, 0.3, x * x * 4); // pelusa de mejillas
        pad = (1 - smooth01(0.0, 0.18, Math.min(Math.hypot(x - 0.45, y - 1.34, z - 0.4), Math.hypot(x + 0.45, y - 1.34, z - 0.4)))) * 0.28; // rubor
        const cv = Math.abs(cav(x, y, z)); if (cv < 0.04 && z > 0.45) { dark = 1 - smooth01(0.015, 0.04, cv); fur *= 0.1; }
      } else { fur = 0.7; belly = (1 - smooth01(0.55, 1.15, Math.hypot(x / 0.27, (y - 0.93) / 0.4, (z - 0.2) / 0.2))) * 0.95; }
      const tot = acc + belly + pad + dark; if (tot > 1) { acc /= tot; belly /= tot; pad /= tot; dark /= tot; }
      return { z: [acc, belly, pad, dark], fur };
    },
    extras(R) {
      const eyeMat = {}; R.eyes = [];
      [-1, 1].forEach((s) => { const e = R.eye({ r: 0.18, iris: R.look.eyes || '#F2A63B', lash: true, lidColor: '#e8cfaa', irisSize: 1.0, pupil: 0.32 }); e.scale.set(1, 1.08, 1); e.userData.baseYaw = s * 0.2; e.rotation.y = s * 0.2; R.attach('head', e, eyeC(s)); R.eyes.push(e); });
      const noseM = new THREE.MeshPhysicalMaterial({ color: 0x1c1114, roughness: 0.22, clearcoat: 1, envMapIntensity: 1.4 }); const nose = new THREE.Mesh(new THREE.SphereGeometry(0.055, 24, 16), noseM); nose.scale.set(1.25, 0.82, 0.9); R.attach('head', nose, [0, 1.405, 0.672]);
      const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 14), new THREE.MeshPhysicalMaterial({ color: 0xf0708a, roughness: 0.4, clearcoat: 0.7 })); tongue.scale.set(1.5, 0.5, 1.1); R.attach('head', tongue, [0, 1.2, 0.655]); R.props.tongue = tongue;
      [-1, 1].forEach((s) => { const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.045, 10), new THREE.MeshPhysicalMaterial({ color: 0xfffaf0, roughness: 0.3, clearcoat: 0.5 })); tooth.rotation.x = Math.PI; R.attach('head', tooth, [s * 0.05, 1.268, 0.668]); });
      // antenas de pluma con punta luminosa
      const fMat = new THREE.MeshPhysicalMaterial({ color: 0xfff1cc, emissive: 0xffc15a, emissiveIntensity: 0.5, roughness: 0.4, transparent: true, opacity: 0.95, envMapIntensity: 1.2 }); R.props.antennae = [];
      [-1, 1].forEach((s) => { const a = feather(0.62, 0.15, 14, fMat, 0.25 * s); a.rotation.set(0.12, 0, -s * 0.4); const grp = new THREE.Group(); grp.add(a); const tip = glowSprite(0xffc866, 0.28, 0.9); tip.position.set(Math.sin(1.4) * 0.25 * s * 0.62 * 0 + 0.0, 0.64, 0.02); a.add(tip); R.attach('head', grp, [s * 0.15, 1.99, 0.2]); R.props.antennae.push(grp); });
      // alas de mariposa iridiscentes
      const tex = wingTexture(), shape = wingShape(), tint = new THREE.Color('#d9c8ff'); R.props.wings = [];
      const wm = new THREE.MeshPhysicalMaterial({ map: tex, color: tint, transparent: true, opacity: 0.9, roughness: 0.12, metalness: 0, iridescence: 1, iridescenceIOR: 1.4, iridescenceThicknessRange: [220, 780], side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 2.2, emissive: new THREE.Color('#b9a5ff'), emissiveIntensity: 0.22 }); R.mats.wing = wm;
      const edgePts = shape.getPoints(60).map((p) => new THREE.Vector3(p.x, p.y, p.x * p.x * 0.12 - Math.abs(p.y) * 0.05)); const gold = goldMat({ emissive: 0xffa930, emissiveIntensity: 0.25 });
      [-1, 1].forEach((s) => {
        const w = new THREE.Group(), mem = wingMesh(shape, wm); w.add(mem);
        w.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edgePts, true), 160, 0.011, 6, true), gold));
        const cr = new THREE.Mesh(crescent(0.07, 0.012), gold); cr.position.set(0.7, 0.55, 0.06 + 0.7 * 0.7 * 0.12); w.add(cr); const cr2 = new THREE.Mesh(crescent(0.05, 0.012), gold); cr2.position.set(0.62, -0.28, 0.05); cr2.rotation.z = 2.4; w.add(cr2);
        for (let i = 0; i < 4; i++) { const pp = [new THREE.Vector3(0.02, 0, 0), new THREE.Vector3(0.45, 0.2 * (i - 1.5), 0.02 + 0.2 * 0.12), new THREE.Vector3(0.95, 0.45 * (i - 1.5) * 0.9, 0.12)]; w.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pp), 14, 0.004, 4), gold)); }
        w.scale.x = s; const pivot = new THREE.Group(); pivot.add(w); pivot.rotation.set(0, s * 0.55, 0); R.attach('spine', pivot, [s * 0.14, 1.12, -0.28]); pivot.userData.s = s; R.props.wings.push(pivot);
      });
    },
    onLook(R, lk) { if (R.mats.wing) { R.mats.wing.color.set(lk.accent).lerp(new THREE.Color(0xffffff), 0.5); R.mats.wing.emissive.set(lk.accent); } R.eyes && R.eyes.forEach((e) => { e.userData.setIris(lk.eyes); e.userData.setLid(new THREE.Color(lk.fur).multiplyScalar(0.93)); }); },
    anim(R, t, dt, damp) {
      const B = R.bones, p = R.pose, br = Math.sin(t * 2.0);
      B.spine.scale.set(1 + br * 0.01, 1 + br * 0.016, 1 + br * 0.01); B.hips.position.y = 0.6 + Math.sin(t * 2.0 + 0.5) * 0.006;
      B.earL.rotation.z = Math.sin(t * 1.3) * 0.04 - (p === 'piensa' ? 0.15 : 0); B.earR.rotation.z = -Math.sin(t * 1.3 + 1) * 0.04 + (p === 'piensa' ? 0.15 : 0); const fl = Math.max(0, Math.sin(t * 0.7 + 2)) ** 14; B.earL.rotation.x = fl * 0.3; B.earR.rotation.x = Math.max(0, Math.sin(t * 0.9)) ** 16 * 0.25;
      const sw = p === 'celebra' ? 0.55 : 0.3, sp = p === 'celebra' ? 5 : 1.8; B.tail0.rotation.y = Math.sin(t * sp) * sw * 0.5; B.tail1.rotation.y = Math.sin(t * sp - 0.7) * sw * 0.7; B.tail2.rotation.y = Math.sin(t * sp - 1.4) * sw * 0.9; B.tail1.rotation.x = Math.sin(t * 1.2) * 0.04;
      const rate = p === 'celebra' ? 14 : 4.2, amp = p === 'celebra' ? 0.5 : 0.18; R.props.wings.forEach((w) => { w.rotation.y = w.userData.s * (0.55 + Math.sin(t * rate) * amp); w.rotation.z = Math.sin(t * rate * 0.5) * 0.04 * w.userData.s; });
      R.props.antennae.forEach((a, i) => { a.rotation.x = Math.sin(t * 2.2 + i) * 0.08; a.rotation.z = Math.sin(t * 1.7 + i * 2) * 0.06; });
      let rz = 0.05, rx = 0, lz = -0.05, lx = 0, jump = 0, nod = 0;
      if (p === 'saluda') { rz = 2.55 + Math.sin(t * 10) * 0.16; rx = -0.15; }
      else if (p === 'celebra') { rz = 2.6 + Math.sin(t * 12) * 0.12; lz = -2.6 - Math.sin(t * 12) * 0.12; jump = Math.abs(Math.sin(t * 5)) * 0.28; }
      else if (p === 'piensa') { rz = 0.5; rx = -2.0; nod = 0.0; R.st.lookT.set(0.2, 0.15); }
      else { rz += Math.sin(t * 1.9) * 0.03; lz -= Math.sin(t * 1.9 + 1) * 0.03; }
      B.armR.rotation.z = damp(B.armR.rotation.z, rz, 9, dt); B.armR.rotation.x = damp(B.armR.rotation.x, rx, 9, dt); B.armL.rotation.z = damp(B.armL.rotation.z, lz, 9, dt); B.armL.rotation.x = damp(B.armL.rotation.x, lx, 9, dt);
      R.root.position.y = damp(R.root.position.y, jump, 14, dt); R.headNod = nod + (p === 'celebra' ? Math.sin(t * 10) * 0.05 : 0); const m = R.props.tongue; if (m) m.visible = true;
    }
  };
  return def;
}
