'use strict';
/* LEGO janus-fur-wind v1.0
 * Pelo, musgo y fibra de nube de geometria 3D REAL mediante InstancedMesh (Three.js r160).
 * Cada hebra tiene raiz anclada, normal local y deformacion progresiva por viento en GPU.
 * No usa red, texturas externas ni proveedores. Bombo NO tiene pelo.
 * La calidad se limita por dispositivo; no implica que el personaje sea un GLB VFX final.
 */
const JanusFurWind = (() => {
  const T = window.THREE;
  const BUDGETS = Object.freeze({
    eco: { max: 250, radius: 0.007, length: 0.055 },
    mobile: { max: 550, radius: 0.006, length: 0.075 },
    balanced: { max: 1400, radius: 0.005, length: 0.085 },
    detail: { max: 2800, radius: 0.004, length: 0.09 }
  });
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const prefersStill = () => { try { return !!window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };
  function tier() {
    try {
      if (window.matchMedia('(max-width: 47.5em), (max-height: 31.25em)').matches) return 'mobile';
      if (navigator.deviceMemory && navigator.deviceMemory <= 2) return 'eco';
    } catch (_) { /* offline/embedded */ }
    return 'balanced'; // "detail" solo si el usuario lo solicita explicitamente
  }
  function seeded(seed) { let x = (seed >>> 0) || 1337; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; }; }
  const hash = (s) => { let v = 2166136261; for (let i = 0; i < s.length; i++) v = Math.imul(v ^ s.charCodeAt(i), 16777619); return v >>> 0; };
  if (!T) return { supported: () => false, attach: () => null, tier, BUDGETS };
  const UP = new T.Vector3(0, 1, 0), v0 = new T.Vector3(), v1 = new T.Vector3(), v2 = new T.Vector3();
  const ab = new T.Vector3(), ac = new T.Vector3(), cross = new T.Vector3();
  const pos = new T.Vector3(), norm = new T.Vector3(), n0 = new T.Vector3(), n1 = new T.Vector3(), n2 = new T.Vector3();
  function surfaceTriangles(geom) {
    if (!geom || !geom.attributes || !geom.attributes.position) return null;
    const p = geom.attributes.position, ns = geom.attributes.normal, idx = geom.index, count = idx ? idx.count : p.count;
    const cdf = [], tris = [], ids = [], totalIndex = Math.floor(count / 3) * 3;
    let areaSum = 0;
    for (let i = 0; i < totalIndex; i += 3) {
      const a = idx ? idx.getX(i) : i, b = idx ? idx.getX(i + 1) : i + 1, c = idx ? idx.getX(i + 2) : i + 2;
      v0.fromBufferAttribute(p, a); v1.fromBufferAttribute(p, b); v2.fromBufferAttribute(p, c);
      ab.subVectors(v1, v0); ac.subVectors(v2, v0); cross.crossVectors(ab, ac);
      const area = 0.5 * cross.length(); if (area < 1e-11) continue;
      areaSum += area; cdf.push(areaSum); ids.push(a, b, c); tris.push(i);
    }
    return areaSum > 0 ? { p, ns, cdf, ids, areaSum } : null;
  }
  function sampleSurface(src, rng) {
    const u = rng() * src.areaSum, cdf = src.cdf;
    let lo = 0, hi = cdf.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cdf[mid] < u) lo = mid + 1; else hi = mid; }
    const a = src.ids[lo * 3], b = src.ids[lo * 3 + 1], c = src.ids[lo * 3 + 2], p = src.p;
    let e = rng(), f = rng(); if (e + f > 1) { e = 1 - e; f = 1 - f; }
    const z = 1 - e - f;
    v0.fromBufferAttribute(p, a); v1.fromBufferAttribute(p, b); v2.fromBufferAttribute(p, c);
    pos.copy(v0).multiplyScalar(z).addScaledVector(v1, e).addScaledVector(v2, f);
    if (src.ns) {
      n0.fromBufferAttribute(src.ns, a); n1.fromBufferAttribute(src.ns, b); n2.fromBufferAttribute(src.ns, c);
      norm.copy(n0).multiplyScalar(z).addScaledVector(n1, e).addScaledVector(n2, f).normalize();
    } else { ab.subVectors(v1, v0); ac.subVectors(v2, v0); norm.crossVectors(ab, ac).normalize(); }
    if (norm.lengthSq() < 1e-6) norm.copy(UP);
    return { pos: pos.clone(), normal: norm.clone() };
  }

  function attach(target, opts) {
    opts = opts || {};
    const source = surfaceTriangles(target && target.geometry);
    if (!source || !target.isMesh) return null;
    const budget = BUDGETS[opts.quality || tier()] || BUDGETS.balanced;
    const count = Math.min(budget.max, Math.max(0, Math.floor(opts.count || 600)));
    if (!count) return null;
    const seed = hash(String(opts.seed || target.uuid || 'janus-fur')), rand = seeded(seed);
    const length = clamp(opts.length || budget.length, 0.01, 0.3), radius = clamp(opts.radius || budget.radius, 0.001, 0.03);
    // Cono base en y=0; raiz fija, flexibilidad cuadratica hacia la punta.
    const geo = new T.ConeGeometry(radius, length, 4, 2);
    geo.translate(0, length * 0.5, 0);
    const mat = new T.MeshPhysicalMaterial({
      color: opts.color || '#ffffff', roughness: opts.roughness == null ? 0.76 : opts.roughness,
      metalness: 0, sheen: 0.95, sheenRoughness: 0.52, sheenColor: opts.color || '#ffffff',
      side: T.DoubleSide, envMapIntensity: 0.92
    });
    const U = { uJanusFurTime: { value: 0 }, uJanusFurWind: { value: 0.15 }, uJanusFurYaw: { value: 0.3 } };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>',
        '#include <common>\nuniform float uJanusFurTime; uniform float uJanusFurWind; uniform float uJanusFurYaw;');
      sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
float jPhase = dot(instanceMatrix[3].xyz, vec3(9.13, 17.71, 5.97));
float jTip = clamp(position.y / ${length.toFixed(6)}, 0.0, 1.0);
float jFlex = jTip * jTip;
float jWave = sin(uJanusFurTime * 2.0 + jPhase) * 0.5
             + sin(uJanusFurTime * 3.7 + jPhase * 0.7) * 0.25;
transformed.x += (cos(uJanusFurYaw) * uJanusFurWind + jWave * uJanusFurWind) * jFlex * ${(length * 0.5).toFixed(6)};
transformed.z += (sin(uJanusFurYaw) * uJanusFurWind + jWave * uJanusFurWind * 0.6) * jFlex * ${(length * 0.5).toFixed(6)};
#endif`);
    };
    mat.customProgramCacheKey = () => 'janus-instanced-fur-v1:' + length.toFixed(6);
    const mesh = new T.InstancedMesh(geo, mat, count), dummy = new T.Object3D(), q = new T.Quaternion();
    mesh.name = 'janus-fibers-' + (opts.seed || 'coat');
    mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false;
    for (let i = 0; i < count; i++) {
      const p = sampleSurface(source, rand); const variance = 0.65 + rand() * 0.7;
      q.setFromUnitVectors(UP, p.normal);
      dummy.position.copy(p.pos).addScaledVector(p.normal, 0.003);
      dummy.quaternion.copy(q);
      dummy.scale.set(variance * (0.65 + rand() * 0.35), variance, variance * (0.65 + rand() * 0.35));
      dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    target.add(mesh);
    const obj = {
      mesh, count, source: target, material: mat,
      setColor(color) { mat.color.set(color); mat.sheenColor.set(color); },
      update(time, wind, yaw) {
        U.uJanusFurTime.value = Number.isFinite(time) ? time : 0;
        U.uJanusFurWind.value = prefersStill() ? 0 : clamp(Number(wind) || 0, 0, 1);
        U.uJanusFurYaw.value = Number.isFinite(yaw) ? yaw : 0;
      },
      dispose() { target.remove(mesh); geo.dispose(); mat.dispose(); }
    };
    return obj;
  }
  return { supported: () => true, attach, tier, BUDGETS };
})();
window.JanusFurWind = JanusFurWind;
