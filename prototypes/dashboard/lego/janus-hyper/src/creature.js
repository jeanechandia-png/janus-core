/* creature.js · ensamblador: SDF → malla orgánica con esqueleto, pelaje en capas, ojos y animación.
 * Una especie (species/*.js) aporta la forma (SDF por hueso), la pintura por zonas y sus rasgos propios. */
import * as THREE from 'three';
import { mesh, skinWeights, U } from './sdf.js';
import { furLayer, furBase, furShared } from './fur.js';
import { makeEye } from './eyes.js';

const damp = (c, t, k, dt) => c + (t - c) * (1 - Math.exp(-k * dt));

export function assemble(def, q, look, style = 'fur') {
  const root = new THREE.Group(); root.name = def.id;
  // ---- malla ----
  const g = mesh(def.body, def.bounds, def.cell), n = g.positions.length / 3;
  const zones = new Float32Array(n * 4), fur = new Float32Array(n);
  for (let v = 0; v < n; v++) { const r = def.paint(g.positions[v * 3], g.positions[v * 3 + 1], g.positions[v * 3 + 2], g.normals[v * 3], g.normals[v * 3 + 1], g.normals[v * 3 + 2]); zones.set(r.z, v * 4); fur[v] = r.fur; }
  // ---- esqueleto ----
  const bones = [], byName = {}, rest = {};
  def.bones.forEach((b) => { const bn = new THREE.Bone(); bn.name = b.n; const par = b.parent ? byName[b.parent] : null, pp = b.parent ? rest[b.parent] : [0, 0, 0]; bn.position.set(b.p[0] - pp[0], b.p[1] - pp[1], b.p[2] - pp[2]); if (par) par.add(bn); else root.add(bn); byName[b.n] = bn; rest[b.n] = b.p; bones.push(bn); });
  root.updateMatrixWorld(true);
  const boneFns = {}; Object.keys(def.parts).forEach((k) => { boneFns[k] = U(0, ...def.parts[k]); });
  const sk = skinWeights(g.positions, boneFns, def.tau || 0.05), idxMap = sk.names.map((nm) => bones.findIndex((b) => b.name === nm));
  const si = new Uint16Array(sk.skinIndex.length); for (let i = 0; i < si.length; i++) si[i] = idxMap[sk.skinIndex[i]];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(g.positions, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(g.normals, 3)); geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('aFur', new THREE.BufferAttribute(fur, 1)); geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.BufferAttribute(sk.skinWeight, 4)); geo.setIndex(new THREE.BufferAttribute(g.indices, 1));
  const skeleton = new THREE.Skeleton(bones);
  // puntos representativos por hueso (para medir su velocidad y mover el pelo con inercia)
  const repS = bones.map(() => new THREE.Vector3()), repW = bones.map(() => 0), tp = new THREE.Vector3();
  for (let v = 0; v < n; v++) for (let k = 0; k < 4; k++) { const bi = si[v * 4 + k], w = sk.skinWeight[v * 4 + k]; if (w > 0.001) { repS[bi].x += g.positions[v * 3] * w; repS[bi].y += g.positions[v * 3 + 1] * w; repS[bi].z += g.positions[v * 3 + 2] * w; repW[bi] += w; } }
  const dynLocal = bones.map((b, i) => { tp.set(repS[i].x / (repW[i] || 1), repS[i].y / (repW[i] || 1), repS[i].z / (repW[i] || 1)); if (!repW[i]) tp.setFromMatrixPosition(b.matrixWorld); return b.worldToLocal(tp.clone()); });
  const R = { root, def, bones: byName, rest, geo, skeleton, zones, n, style, q, shells: [], extras: {}, pose: 'idle', st: { blink: 0, blinkT: 2, look: new THREE.Vector2(), lookT: new THREE.Vector2(), saccade: 1, jump: 0 }, props: {}, mats: {}, dyn: { local: dynLocal, prev: bones.map(() => new THREE.Vector3()), vel: bones.map(() => new THREE.Vector3()), s: bones.map(() => new THREE.Vector3()), sv: bones.map(() => new THREE.Vector3()), has: false, wind: 0.2, windYaw: 1.2, gain: 0.32 } };
  // ---- materiales ----
  const lumi = look || {}; R.look = lumi;
  const fo = Object.assign({}, def.fur, { layers: q.layers, density: def.fur.density * (q.density / 90) });
  R.furOpts = fo;
  const base = furBase(fo); R.mats.base = base;
  const baseMesh = new THREE.SkinnedMesh(geo, base); baseMesh.frustumCulled = false; baseMesh.castShadow = true; baseMesh.receiveShadow = true; root.add(baseMesh); baseMesh.bind(skeleton, new THREE.Matrix4()); R.baseMesh = baseMesh;
  for (let i = 1; !def.noFur && i <= q.layers; i++) { const m = furLayer(fo, i); const sm = new THREE.SkinnedMesh(geo, m); sm.frustumCulled = false; sm.receiveShadow = false; sm.castShadow = false; root.add(sm); sm.bind(skeleton, new THREE.Matrix4()); R.shells.push(sm); }
  // vinilo: material liso y brillante en vez de pelaje
  R.vinyl = new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08, metalness: 0, sheen: 0.4, envMapIntensity: 1.3 });
  R.setStyle = (s) => { R.style = s; R.shells.forEach((m) => { m.visible = s === 'fur' && !def.noFur; }); baseMesh.material = s === 'fur' && !def.skin ? base : (def.skin ? R.skinMat : R.vinyl); };
  if (def.skin) { R.skinMat = def.skin(); if (R.skinMat.userData.bind) R.skinMat.userData.bind(baseMesh); }
  // ---- helpers para extras ----
  R.attach = (bone, obj, wp) => { const b = byName[bone], p = rest[bone]; obj.position.set(wp[0] - p[0], wp[1] - p[1], wp[2] - p[2]); b.add(obj); return obj; };
  R.eye = (o) => makeEye(o);
  // ---- color ----
  const F = new THREE.Color(), A = new THREE.Color(), BL = new THREE.Color(), P = new THREE.Color(), D = new THREE.Color(), tmp = new THREE.Color();
  R.applyColors = (lk) => {
    R.look = lk; F.set(lk.fur); A.set(lk.accent); BL.copy(F).lerp(new THREE.Color(0xffffff), def.bellyLight ?? 0.5); P.set(def.padColor || '#e8a3b4'); D.set(def.darkColor || '#2a0d0f');
    const c = geo.attributes.color.array;
    for (let v = 0; v < n; v++) { const a = zones[v * 4], b = zones[v * 4 + 1], p = zones[v * 4 + 2], d = zones[v * 4 + 3], f = Math.max(0, 1 - a - b - p - d);
      c[v * 3] = F.r * f + A.r * a + BL.r * b + P.r * p + D.r * d; c[v * 3 + 1] = F.g * f + A.g * a + BL.g * b + P.g * p + D.g * d; c[v * 3 + 2] = F.b * f + A.b * a + BL.b * b + P.b * p + D.b * d; }
    geo.attributes.color.needsUpdate = true;
    const tip = F.clone().lerp(new THREE.Color(def.fur.tip ?? 0xfff3df), 0.55); R.shells.forEach((m) => { const u = m.material.userData.furU; u.uTip.value.copy(tip); u.uRimColor.value.copy(F).lerp(new THREE.Color(0xffe6c0), 0.5); });
    if (def.onLook) def.onLook(R, lk);
  };
  R.setStyle(style);
  if (def.extras) def.extras(R, THREE);
  R.applyColors(look);
  // ---- dinámica del pelo: viento + inercia por hueso (muelle amortiguado) ----
  const tv = new THREE.Vector3(), tt = new THREE.Vector3(), ww = new THREE.Vector3();
  R.setWind = (amount, yaw) => { R.dyn.wind = amount; if (yaw !== undefined) R.dyn.windYaw = yaw; };
  R.dynStep = (t, dt) => {
    const D = R.dyn; if (dt <= 0) return; root.updateMatrixWorld(true);
    const gust = D.wind * (0.72 + 0.2 * Math.sin(t * 0.7) + 0.12 * Math.sin(t * 2.3 + 1) + 0.08 * Math.sin(t * 5.1)); ww.set(Math.sin(D.windYaw), 0.04, Math.cos(D.windYaw)).multiplyScalar(gust);
    furShared.uWindW.value.copy(ww);
    const sub = Math.max(1, Math.ceil(dt / 0.012)), h = dt / sub;
    for (let i = 0; i < bones.length && i < 16; i++) {
      tv.copy(D.local[i]).applyMatrix4(bones[i].matrixWorld);
      if (D.has) { D.vel[i].copy(tv).sub(D.prev[i]).divideScalar(dt); const l = D.vel[i].length(); if (l > 9) D.vel[i].multiplyScalar(9 / l); }
      D.prev[i].copy(tv); tt.copy(D.vel[i]).multiplyScalar(-D.gain);
      const s = D.s[i], sv = D.sv[i];
      for (let k = 0; k < sub; k++) { sv.x += ((tt.x - s.x) * 90 - sv.x * 7.5) * h; sv.y += ((tt.y - s.y) * 90 - sv.y * 7.5) * h; sv.z += ((tt.z - s.z) * 90 - sv.z * 7.5) * h; s.addScaledVector(sv, h); }
      const l = s.length(); if (l > 1.1) s.multiplyScalar(1.1 / l);
      furShared.uSway.value[i].copy(s);
    }
    D.has = true;
  };
  R.setPose = (p) => { R.pose = p; };
  R.update = (t, dt, io) => {
    const s = R.st, B = byName; io = io || {};
    // parpadeo y mirada
    s.blinkT -= dt; if (s.blinkT < 0) { s.blink = 1; s.blinkT = 2.2 + Math.random() * 3; } s.blink = Math.max(0, s.blink - dt * 7);
    const bl = s.blink > 0 ? Math.sin((1 - s.blink) * Math.PI) : 0;
    s.saccade -= dt; if (s.saccade < 0) { s.saccade = 1 + Math.random() * 2; s.lookT.set((Math.random() - 0.5) * 0.35, (Math.random() - 0.5) * 0.2); }
    const tgt = io.look ? io.look : s.lookT; s.look.x = damp(s.look.x, tgt.x, 7, dt); s.look.y = damp(s.look.y, tgt.y, 7, dt);
    if (R.eyes) R.eyes.forEach((e, i) => { e.userData.blink(Math.max(bl, R.pose === 'celebra' ? 0.55 : 0, e.userData.winkK || 0)); e.rotation.y = (e.userData.baseYaw || 0) + s.look.x * 0.5; e.rotation.x = -s.look.y * 0.5; });
    if (def.anim) def.anim(R, t, dt, damp);
    R.dynStep(t, dt);
    if (B.head && !def.noHead) { B.head.rotation.y = damp(B.head.rotation.y, s.look.x * 0.45, 5, dt); B.head.rotation.x = damp(B.head.rotation.x, -s.look.y * 0.35 + (R.headNod || 0), 5, dt); }
  };
  R.dispose = () => { geo.dispose(); R.shells.forEach((m) => m.material.dispose()); };
  return R;
}
