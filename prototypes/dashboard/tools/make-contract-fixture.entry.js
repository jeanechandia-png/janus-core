// Fixture de PRUEBA (no es una criatura): una figura mínima que cumple (o rompe a propósito) el contrato de janus-creature-slot.
// Se exporta a GLB con GLTFExporter. Uso: node tools/make-contract-fixture.cjs
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

window.makeFixture = function (opts) {
  opts = opts || {};
  const bone = (name, x, y, z, parent) => { const b = new THREE.Bone(); b.name = name; b.position.set(x, y, z); if (parent) parent.add(b); return b; };
  const root = bone('root', 0, 0, 0), hips = bone('hips', 0, 0.45, 0, root), spine = bone('spine', 0, 0.12, 0, hips), chest = bone('chest', 0, 0.18, 0, spine), neck = bone('neck', 0, 0.2, 0, chest), head = bone('head', 0, 0.08, 0, neck);
  const jaw = bone('jaw', 0, 0.02, 0.07, head), eyeL = bone('eye_L', -0.06, 0.1, 0.12, head), eyeR = bone('eye_R', 0.06, 0.1, 0.12, head);
  const handL = bone('hand_L', -0.28, -0.05, 0, chest), handR = bone('hand_R', 0.28, -0.05, 0, chest), footL = bone('foot_L', -0.1, -0.42, 0.04, hips), footR = bone('foot_R', 0.1, -0.42, 0.04, hips);
  const bones = [root, hips, spine, chest, neck, head, jaw, eyeL, eyeR, handL, handR, footL, footR];
  const sock = (name, parent, x, y, z) => { const o = new THREE.Object3D(); o.name = name; o.position.set(x, y, z); parent.add(o); };
  const SOCK = { sock_head: [head, 0, 0.2, 0], sock_face: [head, 0, 0.1, 0.14], sock_ears: [head, 0, 0.15, 0], sock_neck: [neck, 0, 0, 0.05], sock_back: [chest, 0, 0, -0.15], sock_torso: [chest, 0, 0, 0], sock_hand_L: [handL, 0, 0, 0], sock_hand_R: [handR, 0, 0, 0], sock_foot_L: [footL, 0, 0, 0], sock_foot_R: [footR, 0, 0, 0] };
  Object.keys(SOCK).forEach((k) => { if (opts.dropSockets && /ear|back|foot/.test(k)) return; sock(k, SOCK[k][0], SOCK[k][1], SOCK[k][2], SOCK[k][3]); });
  const skeleton = new THREE.Skeleton(bones);
  const g = new THREE.SphereGeometry(0.34, 24, 18); g.translate(0, 0.62, 0); g.scale(1, 1.5, 1);
  const n = g.attributes.position.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), col1 = new Float32Array(n * 3);
  const iHips = bones.indexOf(hips), iHead = bones.indexOf(head), iSpine = bones.indexOf(spine);
  for (let i = 0; i < n; i++) { const y = g.attributes.position.getY(i), t = Math.min(1, Math.max(0, (y - 0.4) / 0.8)); si[i * 4] = iHips; si[i * 4 + 1] = iSpine; si[i * 4 + 2] = iHead; sw[i * 4] = 1 - t; sw[i * 4 + 1] = t * 0.5; sw[i * 4 + 2] = t * 0.5; col1[i * 3] = t; }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  g.setAttribute('color_1', new THREE.Float32BufferAttribute(col1, 3));
  const names = opts.dropMorphs ? ['alegre', 'contento'] : ['alegre', 'contento', 'triste', 'enojado', 'sorprendido', 'pensativo', 'carinoso', 'blink_L', 'blink_R', 'mouth_open', 'v_aa', 'v_oh', 'v_ee'];
  g.morphAttributes.position = names.map((nm, k) => { const a = g.attributes.position.array.slice(); for (let i = 0; i < n; i++) { a[i * 3 + 1] *= 1 + 0.02 * (k + 1); } return new THREE.Float32BufferAttribute(a, 3); });
  const mat = new THREE.MeshStandardMaterial({ color: 0xe8c58a, roughness: 0.6 });
  const mesh = new THREE.SkinnedMesh(g, mat); mesh.name = 'Face'; mesh.morphTargetInfluences = names.map(() => 0); mesh.morphTargetDictionary = Object.fromEntries(names.map((nm, i) => [nm, i]));
  mesh.add(root); mesh.bind(skeleton);
  const scene = new THREE.Group(); scene.name = 'fixture'; scene.add(mesh);
  const clip = (name, amp) => new THREE.AnimationClip(name, 1.2, [new THREE.QuaternionKeyframeTrack('spine.quaternion', [0, 0.6, 1.2], [].concat(...[0, amp, 0].map((a) => new THREE.Quaternion().setFromEuler(new THREE.Euler(a, 0, 0)).toArray())))]);
  const clipNames = opts.dropClips ? ['idle'] : ['idle', 'saluda', 'celebra', 'piensa', 'camina', 'habla'];
  const animations = clipNames.map((c, i) => clip(c, 0.05 + i * 0.02));
  return new Promise((res, rej) => new GLTFExporter().parse(scene, (buf) => res(Array.from(new Uint8Array(buf)).map((b) => String.fromCharCode(b)).join('')), rej, { binary: true, animations, onlyVisible: false }))
    .then((bin) => btoa(bin));
};
