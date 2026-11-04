/* thumbs.js · miniaturas 3D de cada prenda/accesorio (render fuera de pantalla con el mismo material físico). Las prendas se ven como "maniquí fantasma". */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ANCH } from './anchors.js';
import { BY_ID } from './catalog.js';
import { garmentFor } from './equip.js';
import { DEFS } from './defs.js';

let rt = null;
function ensure(size) {
  if (rt && rt.size === size) return rt;
  const cv = document.createElement('canvas'); cv.width = cv.height = size; const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true }); r.setPixelRatio(1); r.setSize(size, size, false); r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.15; r.outputColorSpace = THREE.SRGBColorSpace;
  const sc = new THREE.Scene(), pm = new THREE.PMREMGenerator(r); sc.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; const k = new THREE.DirectionalLight(0xfff1dc, 2.6); k.position.set(2, 3, 3); sc.add(k); const f = new THREE.DirectionalLight(0xbfd6ff, 0.8); f.position.set(-3, 1, 2); sc.add(f); sc.add(new THREE.HemisphereLight(0xffffff, 0x554433, 0.5));
  rt = { size, r, sc, cam: new THREE.PerspectiveCamera(26, 1, 0.05, 50), holder: null }; return rt;
}
const YAW = { cabeza: 0.5, cara: 0.35, oidos: 0.6, cuello: 0.3, torso: 0.25, espalda: 2.7, cintura: 0.4, pies: 0.7, mano: 0.4, aura: 0.3 };
export function thumb(id, species = 'lumi', opts = {}) {
  const it = BY_ID[id]; if (!it) return null; const size = opts.size || 160, T = ensure(size), A = ANCH[species], C = Object.assign({ main: it.col[0], accent: it.col[1] }, opts.colors || {});
  const g = new THREE.Group(); let tick = null;
  if (it.garment) {
    const def = DEFS[species](), gd = garmentFor(def, A, it, C), mesh = new THREE.Mesh(gd.geo, it.garment.mat({ A, C })); mesh.material.side = THREE.DoubleSide; g.add(mesh);
    (it.garment.extras({ A, C, S: gd.S }) || []).forEach((p) => g.add(p.isObject3D ? p : p.obj)); g.userData.yaw = 0.0;
  } else {
    const S = A.scale[it.slot] ?? 1, out = it.build({ A: ANCH.lumi, S, C }); tick = out.tick; const objs = out.parts.map((p) => p.obj); objs.forEach((o, i) => { o.position.set(0, 0, 0); if (objs.length > 1) o.position.x = (i ? 1 : -1) * 0.34; g.add(o); });
    if (it.slot === 'mano' || it.slot === 'aura' || it.slot === 'cintura') g.traverse((o) => { if (o.isMesh || o.isSprite) o.frustumCulled = false; });
  }
  if (tick) tick(0.6, 0.016);
  const hold = new THREE.Group(); hold.add(g); hold.rotation.y = it.thumbYaw ?? YAW[it.slot] ?? 0.4; T.sc.add(hold); hold.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(hold), sph = box.getBoundingSphere(new THREE.Sphere()), c = sph.center, d = (sph.radius * 1.12) / Math.tan((T.cam.fov * Math.PI) / 360);
  const up = ({ cabeza: 0.5, aura: 0.3, cara: 0.2 })[it.slot] ?? 0.15; T.cam.position.set(c.x, c.y + sph.radius * up, c.z + d); T.cam.lookAt(c); T.cam.updateProjectionMatrix(); T.r.setClearColor(0x000000, 0); T.r.render(T.sc, T.cam);
  const url = T.r.domElement.toDataURL('image/png'); T.sc.remove(hold); hold.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); return url;
}
