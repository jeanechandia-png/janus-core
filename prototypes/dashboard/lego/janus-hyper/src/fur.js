/* fur.js · pelaje volumétrico por capas ("shells") sobre MeshPhysicalMaterial: conserva luces, sombras, entorno y piel (skinning).
 * Cada capa es un SkinnedMesh que comparte geometría y esqueleto; el patrón de hebras es procedural en 3D (sin UV). */
import * as THREE from 'three';

const HASH = `
float hash13(vec3 p){ p=fract(p*0.1031); p+=dot(p,p.zyx+31.32); return fract((p.x+p.y)*p.z); }
vec3 hash33(vec3 p){ p=fract(p*vec3(.1031,.1030,.0973)); p+=dot(p,p.yxz+33.33); return fract((p.xxy+p.yxx)*p.zyx); }
`;

export const furShared = { uTime: { value: 0 }, uSway: { value: Array.from({ length: 16 }, () => new THREE.Vector3()) }, uWindW: { value: new THREE.Vector3() }, uTurb: { value: 0.6 } };

/** opts: { color, tip, tipMix, root, density, thick, length, gravity, wind, rim, rimPow, layers, rough, sheen, curl, lenVar } */
export function furLayer(o, i) {
  const h = i / o.layers;
  const m = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, vertexColors: true, roughness: o.rough ?? 0.78, metalness: 0, sheen: o.sheen ?? 1, sheenRoughness: 0.5, sheenColor: new THREE.Color(o.sheenColor ?? 0xffffff),
    side: THREE.FrontSide, alphaTest: 0.5, alphaToCoverage: true, envMapIntensity: o.env ?? 0.9
  });
  const U = { uLayer: { value: h }, uLen: { value: o.length }, uGrav: { value: o.gravity ?? 0.25 }, uWind: { value: o.wind ?? 0.02 }, uCurl: { value: o.curl ?? 0 }, uDensity: { value: o.density }, uThick: { value: o.thick ?? 0.55 }, uLenVar: { value: o.lenVar ?? 0.45 },
    uRoot: { value: new THREE.Color(o.root ?? 0x6b5a4a) }, uTip: { value: new THREE.Color(o.tip ?? 0xffffff) }, uTipMix: { value: o.tipMix ?? 0.3 }, uRim: { value: o.rim ?? 0.35 }, uRimPow: { value: o.rimPow ?? 2.6 }, uRimColor: { value: new THREE.Color(o.rimColor ?? 0xffe2b8) }, uTint: { value: new THREE.Color(1, 1, 1) } };
  m.userData.furU = U;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U, { uTime: furShared.uTime, uSway: furShared.uSway, uWindW: furShared.uWindW, uTurb: furShared.uTurb });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute float aFur; uniform float uLayer,uLen,uGrav,uWind,uTime,uCurl,uTurb; uniform vec3 uSway[16]; uniform vec3 uWindW; varying vec3 vBase; varying float vLayer; varying float vFurA;`)
      .replace('#include <skinning_vertex>', `#include <skinning_vertex>
vBase = position; vLayer = uLayer; vFurA = aFur;
{ float L = uLen * aFur * uLayer; vec3 nn = normalize(objectNormal); transformed += nn * L;
  transformed += vec3(0.0,-1.0,0.0) * (uLayer*uLayer) * uLen * aFur * uGrav;
  float ph = position.x*5.0 + position.y*3.7 + position.z*4.3;
  float wv = sin(uTime*1.7 + ph) * uWind * uLayer*uLayer * uLen * aFur;
  vec3 tg = normalize(cross(nn, vec3(0.0,1.0,0.01)) + 1e-4);
  transformed += tg * (wv + sin(ph*2.0 + uLayer*6.0) * uCurl * uLayer * uLen * aFur) + vec3(0.0, wv*0.3, 0.0);
  /* dinámica: viento global + inercia por hueso (el pelo se queda atrás al moverse y rebota) */
  vec3 swW = uSway[int(skinIndex.x)]*skinWeight.x + uSway[int(skinIndex.y)]*skinWeight.y + uSway[int(skinIndex.z)]*skinWeight.z + uSway[int(skinIndex.w)]*skinWeight.w;
  float wl = length(uWindW); vec3 wO = (vec4(swW + uWindW, 0.0) * modelMatrix).xyz;
  vec3 wp = (modelMatrix * vec4(transformed, 1.0)).xyz;
  float rip = 0.5 + 0.5*sin(dot(wp, uWindW/(wl+1e-4))*3.2 - uTime*4.2 + ph*0.35);
  vec3 dsp = wO * (0.6 + 0.9*rip*smoothstep(0.0, 0.05, wl));
  dsp -= nn * dot(dsp, nn) * 0.55;
  float ly2 = uLayer*uLayer;
  transformed += dsp * ly2 * uLen * aFur * 1.6;
  transformed += tg * sin(uTime*14.0 + ph*2.3 + uLayer*5.0) * (wl + length(swW)*0.5) * uTurb * ly2 * uLen * aFur * 0.35; }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
${HASH}
uniform float uDensity,uThick,uLenVar,uTipMix,uRim,uRimPow; uniform vec3 uRoot,uTip,uRimColor,uTint; varying vec3 vBase; varying float vLayer; varying float vFurA;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  if (vFurA < 0.04) discard;
  float h = vLayer; vec3 q = vBase * uDensity; vec3 cid = floor(q); vec3 fr = fract(q) - 0.5;
  vec3 jt = (hash33(cid) - 0.5) * 0.6; float r1 = hash13(cid + 7.3), r2 = hash13(cid + 19.1);
  float dd = length(fr - jt); float len = mix(1.0 - uLenVar, 1.0, r1);
  float hh = h / max(len, 0.02); if (hh > 1.0) discard;
  float rad = uThick * (1.0 - 0.78 * hh);
  float a = smoothstep(rad, rad * 0.5, dd); diffuseColor.a = a;
  vec3 base = diffuseColor.rgb * uTint;
  vec3 root = base * uRoot; vec3 tip = base * (1.0 + uTipMix * 0.4) + uTip * uTipMix * 0.22;
  vec3 c = mix(root, tip, pow(hh, 0.75)); c *= 0.86 + 0.28 * r2;
  c *= mix(0.68, 1.0, smoothstep(0.0, 0.5, h));
  diffuseColor.rgb = c;
}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{ float fr = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), uRimPow);
  totalEmissiveRadiance += uRimColor * diffuseColor.rgb * fr * uRim * (0.25 + 0.75 * vLayer); }`);
  };
  m.customProgramCacheKey = () => 'furshell-v2';
  return m;
}

/** material de la piel que hay debajo del pelaje (el color de raíz), con el mismo atributo de color por vértice */
export function furBase(o) {
  const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.9, metalness: 0, sheen: 0.6, sheenColor: new THREE.Color(0xffffff), envMapIntensity: 0.6 });
  const root = new THREE.Color(o.root ?? 0x6b5a4a); m.onBeforeCompile = (sh) => { sh.uniforms.uRoot = { value: root }; sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uRoot;').replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= uRoot * 1.0;'); };
  m.customProgramCacheKey = () => 'furbase-v1';
  m.userData.tint = null; return m;
}
