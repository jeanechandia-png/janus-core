/* shading.js · materiales procedurales con detalle fino sin texturas: bump de roca, brillo de escamas, tejido, cuero.
 * Se inyectan en MeshPhysicalMaterial para conservar luces, sombras y reflejos del entorno. */
import * as THREE from 'three';

export const GLSL_NOISE = `
float hash13(vec3 p){ p=fract(p*0.1031); p+=dot(p,p.zyx+31.32); return fract((p.x+p.y)*p.z); }
vec3 hash33(vec3 p){ p=fract(p*vec3(.1031,.1030,.0973)); p+=dot(p,p.yxz+33.33); return fract((p.xxy+p.yxx)*p.zyx); }
float vn(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
 return mix(mix(mix(hash13(i),hash13(i+vec3(1,0,0)),f.x),mix(hash13(i+vec3(0,1,0)),hash13(i+vec3(1,1,0)),f.x),f.y),
            mix(mix(hash13(i+vec3(0,0,1)),hash13(i+vec3(1,0,1)),f.x),mix(hash13(i+vec3(0,1,1)),hash13(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm3(vec3 p){ return vn(p)*0.55+vn(p*2.03)*0.28+vn(p*4.1)*0.17; }
`;

/** parche común: varying de la posición en reposo + matriz de rotación del objeto para llevar gradientes a vista */
export function patch(material, key, uniforms, fragHead, fragRough, fragEmissive, fragNormal) {
  const MR = { value: new THREE.Matrix3() };
  material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms || {}, { uMR: MR });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vBase;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvBase = position;');
    let f = sh.fragmentShader.replace('#include <common>', `#include <common>\n${GLSL_NOISE}\nvarying vec3 vBase; uniform mat3 uMR;\n${fragHead || ''}`);
    if (fragRough) f = f.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + fragRough);
    if (fragNormal) f = f.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + fragNormal);
    if (fragEmissive) f = f.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + fragEmissive);
    sh.fragmentShader = f;
  };
  material.customProgramCacheKey = () => key;
  material.userData.MR = MR;
  return (mesh) => { const prev = mesh.onBeforeRender; mesh.onBeforeRender = function (...a) { MR.value.setFromMatrix4(mesh.matrixWorld); material.uniformsNeedUpdate = true; if (prev) prev.apply(this, a); }; };
}

/** piel húmeda y brillante con destellos (escamas de brillo) y pecas; luz cálida en los bordes */
export function wetSkin(o = {}) {
  const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: o.rough ?? 0.36, clearcoat: 1, clearcoatRoughness: 0.14, sheen: 0.35, sheenColor: new THREE.Color(o.sheen ?? '#ff9a7a'), sheenRoughness: 0.4, envMapIntensity: 1.35 });
  const bind = patch(m, 'wetskin-v1', {}, '',
    `float gF = step(0.88, hash13(floor(vBase*95.0))) * smoothstep(0.36, 0.16, length(fract(vBase*95.0)-0.5-(hash33(floor(vBase*95.0))-0.5)*0.5)); roughnessFactor = mix(roughnessFactor, 0.1, gF); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0,0.88,0.6), gF*0.85);`,
    `{ float fr = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.0); totalEmissiveRadiance += vec3(1.0,0.55,0.4) * diffuseColor.rgb * fr * 0.09 + vec3(1.0,0.9,0.7) * gF * 0.5; }`);
  m.userData.bind = bind; return m;
}

/** roca: relieve fino (bump procedural), grietas y variación de rugosidad */
export function rock(o = {}) {
  const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.9, metalness: 0, envMapIntensity: 0.8, sheen: 0.15 });
  const bind = patch(m, 'rock-v1', {}, `float rockH(vec3 p){ float h=fbm3(p*9.0); float c=abs(vn(p*5.5)-0.5); return h*0.8+smoothstep(0.0,0.06,c)*0.12; }`,
    `float rh = fbm3(vBase*14.0); roughnessFactor = clamp(roughnessFactor + (rh-0.5)*0.25, 0.55, 1.0);`,
    '',
    `{ vec3 p=vBase; float e=0.012; vec3 g=vec3(rockH(p+vec3(e,0,0))-rockH(p-vec3(e,0,0)), rockH(p+vec3(0,e,0))-rockH(p-vec3(0,e,0)), rockH(p+vec3(0,0,e))-rockH(p-vec3(0,0,e)))/(2.0*e); g = mat3(viewMatrix)*(uMR*g); normal = normalize(normal - g*0.035); float cr = 1.0-smoothstep(0.0,0.05,abs(vn(p*5.5)-0.5)); diffuseColor.rgb *= 1.0 - cr*0.12; }`);
  m.userData.bind = bind; return m;
}
