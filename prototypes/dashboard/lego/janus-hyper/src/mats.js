/* mats.js · biblioteca de materiales PBR para accesorios: oro real, plata, cromo, cuero, punto, vaquero, satén, cristal, neón, gemas, perlas */
import * as THREE from 'three';
import { patch } from './shading.js';

const C = (c) => new THREE.Color(c);
export const gold = (o) => new THREE.MeshPhysicalMaterial(Object.assign({ color: 0xffc94d, metalness: 1, roughness: 0.2, clearcoat: 0.5, clearcoatRoughness: 0.08, envMapIntensity: 1.8 }, o));
export const silver = (o) => new THREE.MeshPhysicalMaterial(Object.assign({ color: 0xe6e8ee, metalness: 1, roughness: 0.18, envMapIntensity: 1.7 }, o));
export const chrome = (o) => new THREE.MeshPhysicalMaterial(Object.assign({ color: 0xffffff, metalness: 1, roughness: 0.04, envMapIntensity: 2.2 }, o));
export const rose = (o) => gold(Object.assign({ color: 0xf2a58f }, o));
export const gloss = (color, o) => new THREE.MeshPhysicalMaterial(Object.assign({ color, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08, metalness: 0, envMapIntensity: 1.2 }, o));
export const rubber = (color, o) => new THREE.MeshPhysicalMaterial(Object.assign({ color, roughness: 0.85, metalness: 0, envMapIntensity: 0.5 }, o));
export const satin = (color, o) => new THREE.MeshPhysicalMaterial(Object.assign({ color, roughness: 0.38, metalness: 0, sheen: 1, sheenRoughness: 0.35, sheenColor: C(color).lerp(C(0xffffff), 0.5), clearcoat: 0.25, clearcoatRoughness: 0.3, envMapIntensity: 1.1 }, o));
export const glass = (tint = 0xcfe8ff, op = 0.18) => new THREE.MeshPhysicalMaterial({ color: tint, transparent: true, opacity: op, roughness: 0.02, metalness: 0, clearcoat: 1, clearcoatRoughness: 0, envMapIntensity: 3, depthWrite: false, side: THREE.DoubleSide });
export const mirror = (tint = 0x88aaff) => new THREE.MeshPhysicalMaterial({ color: tint, metalness: 1, roughness: 0.05, clearcoat: 1, envMapIntensity: 2.4 });
export const neon = (color, k = 1.6) => new THREE.MeshBasicMaterial({ color: C(color).multiplyScalar(k), toneMapped: false });
export const gem = (color) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.04, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0, emissive: color, emissiveIntensity: 0.22, envMapIntensity: 3, iridescence: 0.4, ior: 1.8 });
export const pearl = () => new THREE.MeshPhysicalMaterial({ color: 0xfff4e6, roughness: 0.16, metalness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05, iridescence: 1, iridescenceIOR: 1.3, iridescenceThicknessRange: [200, 600], sheen: 0.6, sheenColor: C(0xffd6e8), envMapIntensity: 1.6 });

/** tejidos con relieve fino procedural (triplanar en el espacio del objeto). kind: weave | knit | denim | leather | felt */
const PAT = {
  weave: 'float hh(vec3 p){ vec3 a=abs(normalize(vN)); vec2 u=a.x>a.y&&a.x>a.z?p.yz:(a.y>a.z?p.xz:p.xy); u*=70.0; return sin(u.x)*sin(u.y)*0.5+0.5 + (fract(floor(u.x/3.14159)*0.5)*0.4); }',
  knit: 'float hh(vec3 p){ vec3 a=abs(normalize(vN)); vec2 u=a.x>a.y&&a.x>a.z?p.yz:(a.y>a.z?p.xz:p.xy); u*=34.0; float col=abs(sin(u.x*1.0+sin(u.y*1.3)*0.9)); return pow(col,0.55)*(0.65+0.35*sin(u.y*2.6)); }',
  denim: 'float hh(vec3 p){ vec3 a=abs(normalize(vN)); vec2 u=a.x>a.y&&a.x>a.z?p.yz:(a.y>a.z?p.xz:p.xy); u*=95.0; float t=sin(u.x+u.y*0.5)*0.5+0.5; return t*0.6+hash13(floor(vec3(u*0.7,0.0)))*0.4; }',
  leather: 'float hh(vec3 p){ vec3 q=p*34.0; vec3 i=floor(q), f=fract(q); float d=1.0; for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)for(int z=-1;z<=1;z++){ vec3 g=vec3(float(x),float(y),float(z)); vec3 o=hash33(i+g); d=min(d,length(g+o-f)); } return smoothstep(0.0,0.7,d); }',
  felt: 'float hh(vec3 p){ return fbm3(p*60.0)*0.8+vn(p*160.0)*0.2; }'
};
export function fabric(kind, color, o = {}) {
  const base = { color, roughness: o.rough ?? 0.85, metalness: 0, sheen: o.sheen ?? 0.8, sheenRoughness: 0.5, sheenColor: C(color).lerp(C(0xffffff), 0.45), envMapIntensity: 0.7, vertexColors: !!o.vc, side: o.side ?? THREE.FrontSide };
  if (kind === 'leather') Object.assign(base, { roughness: 0.42, sheen: 0.2, clearcoat: 0.35, clearcoatRoughness: 0.35, envMapIntensity: 1.1 });
  const m = new THREE.MeshPhysicalMaterial(base), amp = o.amp ?? ({ weave: 0.05, knit: 0.2, denim: 0.07, leather: 0.18, felt: 0.12 })[kind];
  const bind = patch(m, 'fab-' + kind, {}, `varying vec3 vN; ${PAT[kind]}`, '', '',
    `{ vec3 p=vBase; float e=0.004; vec3 g=vec3(hh(p+vec3(e,0,0))-hh(p-vec3(e,0,0)), hh(p+vec3(0,e,0))-hh(p-vec3(0,e,0)), hh(p+vec3(0,0,e))-hh(p-vec3(0,0,e)))/(2.0*e); g=mat3(viewMatrix)*(uMR*g); normal=normalize(normal-g*${amp.toFixed(3)}*0.02); }`);
  // vN: normal en espacio objeto para elegir el plano de proyección
  const ob = m.onBeforeCompile; m.onBeforeCompile = (sh) => { ob(sh); sh.vertexShader = sh.vertexShader.replace('varying vec3 vBase;', 'varying vec3 vBase; varying vec3 vN;').replace('vBase = position;', 'vBase = position; vN = normal;'); };
  m.customProgramCacheKey = () => 'fab2-' + kind + (o.vc ? 'v' : '');
  m.userData.bind = bind; return m;
}
