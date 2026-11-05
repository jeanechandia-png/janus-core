'use strict';
/* ===== LEGO janus-creature-slot v1.0 · espacio para recibir criaturas 3D externas (GLB) =====
 * El anfitrión (dashboard, PWA…) deja un hueco por criatura (lumi · bombo · musgo · nimbo). Si en el hueco hay un modelo
 * glTF/GLB que cumple CONTRATO.md, la escena (janus-stage-3d) lo usa en lugar de la criatura procedural; si no, todo sigue igual.
 * Sin tocar código: se importa el archivo (botón «Importar GLB») o se incrusta en el build (assets/creatures/<id>.glb).
 *
 *   JanusCreatureSlot.CONTRACT                       contrato técnico (huesos, sockets, morphs, clips, presupuesto)
 *   await JanusCreatureSlot.load(id, arrayBuffer, {name})  → informe  (registra si no hay errores bloqueantes)
 *   await JanusCreatureSlot.inspect(arrayBuffer)     → informe sin registrar
 *   JanusCreatureSlot.remove(id) · has(id) · report(id) · info(id) · ids
 *   JanusCreatureSlot.rigFor(id)                     → rig compatible con JanusCreatures3D.build() { root, update(t,dt,ctl), setLook(look), sockets } o null
 *   await JanusCreatureSlot.restore()                recupera de IndexedDB los modelos importados en este dispositivo
 *   JanusCreatureSlot.onChange(fn)                   fn(id) cuando un hueco cambia
 * Dependencias: window.THREE (r160) y window.JanusGLTF (vendor/gltf-kit.js).
 * Los modelos importados se guardan SOLO en este dispositivo (IndexedDB); no se suben a ningún sitio.
 */
const JanusCreatureSlot = (() => {
  const T = window.THREE, G = window.JanusGLTF;
  const IDS = ['lumi', 'bombo', 'musgo', 'nimbo', 'robot', 'robot-femenino']; // robot masculino heredado; femenino independiente // 'robot' = el robot de Janus (hueco para el GLB hiperrealista)
  if (!T) return { supported: () => false, ids: IDS, has: () => false, rigFor: () => null, report: () => null, info: () => null, remove: () => false, restore: async () => 0, onChange() {}, guessId: () => null, load: async () => ({ level: 'error', checks: [], summary: 'three.js no está cargado' }), inspect: async () => ({ level: 'error', checks: [], summary: 'three.js no está cargado' }), CONTRACT: {} };
  const VISEMES = ['v_aa', 'v_ee', 'v_ih', 'v_oh', 'v_ou', 'v_pp', 'v_ff', 'v_th', 'v_dd', 'v_kk', 'v_ch', 'v_ss', 'v_nn', 'v_rr'];
  const CONTRACT = {
    version: '1.0',
    ids: IDS,
    units: 'metros, Y arriba, mira a +Z, origen en el suelo entre los pies',
    height: [0.8, 1.5],
    bones: { required: ['root', 'hips', 'spine', 'chest', 'neck', 'head', 'jaw', 'eye_L', 'eye_R', 'hand_L', 'hand_R', 'foot_L', 'foot_R'] },
    sockets: ['sock_head', 'sock_face', 'sock_ears', 'sock_neck', 'sock_back', 'sock_torso', 'sock_hand_L', 'sock_hand_R', 'sock_foot_L', 'sock_foot_R'],
    morphs: { required: ['alegre', 'contento', 'triste', 'enojado', 'sorprendido', 'blink_L', 'blink_R', 'mouth_open'], optional: ['pensativo', 'carinoso'].concat(VISEMES) },
    clips: { required: ['idle', 'saluda', 'celebra', 'piensa', 'camina', 'habla'], optional: ['corre', 'escucha', 'triste', 'enojado', 'sorprendido', 'baila', 'dormir', 'sentado'] },
    budget: { trisLod0: 80000, trisHard: 300000, bones: 80, textures: 16, textureSize: 2048, fileMB: 15 },
    wind: 'COLOR_1 canal R = flexibilidad del pelo/plumas/musgo (0 anclado, 1 libre). COLOR_0 no se usa para esto: según la especificación glTF tiñe el color base.'
  };
  const reg = {}, listeners = [];
  const emit = (id) => listeners.forEach((f) => { try { f(id); } catch (e) { /* un oyente roto no afecta a los demás */ } });

  /* ---------- lectura e informe ---------- */
  function parse(buf) {
    return new Promise((res, rej) => {
      if (!G || !G.GLTFLoader) return rej(new Error('Falta el cargador glTF (vendor/gltf-kit.js).'));
      const L = new G.GLTFLoader(); if (G.MeshoptDecoder) L.setMeshoptDecoder(G.MeshoptDecoder);
      try { L.parse(buf, '', res, (e) => rej(e instanceof Error ? e : new Error(String((e && e.message) || e)))); } catch (e) { rej(e); }
    });
  }
  const TEX_KEYS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap', 'sheenColorMap', 'sheenRoughnessMap', 'clearcoatMap', 'clearcoatNormalMap', 'clearcoatRoughnessMap', 'transmissionMap', 'thicknessMap', 'specularIntensityMap', 'specularColorMap', 'iridescenceMap', 'bumpMap'];
  function inspectGltf(gltf, bytes) {
    const names = new Set(), bones = new Set(), morphs = new Set(), tex = new Set(); let tris = 0, meshes = 0, skinned = 0, maxTex = 0;
    gltf.scene.traverse((o) => {
      if (o.name) names.add(o.name); if (o.isBone) bones.add(o.name);
      if (o.isMesh) {
        meshes++; const g = o.geometry, n = g.index ? g.index.count : (g.attributes.position ? g.attributes.position.count : 0); tris += Math.floor(n / 3);
        if (o.isSkinnedMesh) { skinned++; o.skeleton.bones.forEach((b) => bones.add(b.name)); }
        if (o.morphTargetDictionary) Object.keys(o.morphTargetDictionary).forEach((k) => morphs.add(k));
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => TEX_KEYS.forEach((k) => { const t = m && m[k]; if (t && !tex.has(t)) { tex.add(t); const im = t.image; if (im) maxTex = Math.max(maxTex, im.width || 0, im.height || 0); } }));
      }
    });
    const clips = (gltf.animations || []).map((a) => a.name);
    gltf.scene.updateMatrixWorld(true); const box = new T.Box3().setFromObject(gltf.scene), height = box.isEmpty() ? 0 : box.max.y - box.min.y;
    const C = CONTRACT, miss = (list, have) => list.filter((x) => !have.has(x));
    const missing = { bones: miss(C.bones.required, bones), sockets: miss(C.sockets, names), morphs: miss(C.morphs.required, morphs), clips: miss(C.clips.required, new Set(clips)) };
    const sizeMB = bytes / 1048576;
    const checks = [
      { k: 'malla', ok: meshes > 0, level: 'error', label: 'Contiene malla 3D', detail: meshes + ' malla(s), ' + tris.toLocaleString('es') + ' triángulos' },
      { k: 'esqueleto', ok: skinned > 0, level: 'warn', label: 'Esqueleto con piel (animable)', detail: skinned ? bones.size + ' huesos' : 'sin esqueleto: se verá quieta' },
      { k: 'huesos', ok: !missing.bones.length, level: 'warn', label: 'Huesos obligatorios', detail: missing.bones.length ? 'faltan: ' + missing.bones.join(', ') : 'completos' },
      { k: 'sockets', ok: !missing.sockets.length, level: 'warn', label: 'Sockets para accesorios', detail: missing.sockets.length ? 'faltan: ' + missing.sockets.join(', ') : 'completos' },
      { k: 'morphs', ok: !missing.morphs.length, level: 'warn', label: 'Expresiones (morph targets)', detail: missing.morphs.length ? 'faltan: ' + missing.morphs.join(', ') : morphs.size + ' disponibles' },
      { k: 'clips', ok: !missing.clips.length, level: 'warn', label: 'Animaciones', detail: missing.clips.length ? 'faltan: ' + missing.clips.join(', ') : clips.length + ' clips' },
      { k: 'altura', ok: height >= C.height[0] && height <= C.height[1], level: 'warn', label: 'Altura 0,8 a 1,5 m', detail: height ? height.toFixed(2).replace('.', ',') + ' m (la escena la escala sola)' : 'sin medida' },
      { k: 'triangulos', ok: tris <= C.budget.trisLod0, level: tris > C.budget.trisHard ? 'error' : 'warn', label: 'Triángulos ≤ ' + C.budget.trisLod0.toLocaleString('es'), detail: tris.toLocaleString('es') },
      { k: 'huesos-max', ok: bones.size <= C.budget.bones, level: 'warn', label: 'Huesos ≤ ' + C.budget.bones, detail: String(bones.size) },
      { k: 'texturas', ok: tex.size <= C.budget.textures && maxTex <= C.budget.textureSize, level: 'warn', label: 'Texturas ≤ ' + C.budget.textures + ' de ' + C.budget.textureSize + ' px', detail: tex.size + ' texturas, la mayor de ' + maxTex + ' px' },
      { k: 'peso', ok: sizeMB <= C.budget.fileMB, level: 'warn', label: 'Archivo ≤ ' + C.budget.fileMB + ' MB', detail: sizeMB.toFixed(1).replace('.', ',') + ' MB' }
    ];
    const level = checks.some((c) => !c.ok && c.level === 'error') ? 'error' : checks.every((c) => c.ok) ? 'ok' : 'avisos';
    return { level, checks, missing, stats: { tris, meshes, bones: bones.size, morphs: [...morphs], clips, textures: tex.size, maxTex, height: +height.toFixed(3), sizeMB: +sizeMB.toFixed(2) },
      summary: level === 'ok' ? 'Cumple el contrato' : level === 'avisos' ? 'Carga con avisos (' + checks.filter((c) => !c.ok).length + ')' : 'No se puede usar' };
  }
  async function inspect(buf) { const g = await parse(buf); return inspectGltf(g, buf.byteLength); }

  /* ---------- registro ---------- */
  async function load(id, buf, opts) {
    if (!IDS.includes(id)) throw new Error('Criatura desconocida: ' + id);
    let gltf; try { gltf = await parse(buf); } catch (e) { return { level: 'error', checks: [], missing: {}, stats: {}, summary: 'No se pudo leer el archivo: ' + String((e && e.message) || e).slice(0, 160) }; }
    const rep = inspectGltf(gltf, buf.byteLength);
    if (rep.level === 'error') return rep;
    gltf.scene.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = true; o.receiveShadow = false; } });
    patchWind(gltf.scene);
    reg[id] = { gltf, buf, report: rep, name: (opts && opts.name) || id + '.glb', at: Date.now() };
    if (!(opts && opts.volatile)) idbPut(id, buf, reg[id].name);
    emit(id); return rep;
  }
  function remove(id) { if (!reg[id]) return false; delete reg[id]; idbDel(id); emit(id); return true; }
  const has = (id) => !!reg[id];
  const report = (id) => (reg[id] ? reg[id].report : null);
  const info = (id) => (reg[id] ? { name: reg[id].name, at: reg[id].at, level: reg[id].report.level, summary: reg[id].report.summary, stats: reg[id].report.stats } : null);
  const onChange = (fn) => { listeners.push(fn); };
  const guessId = (name) => IDS.find((i) => new RegExp('(^|[^a-z])' + i + '([^a-z]|$)', 'i').test(String(name || ''))) || null;

  /* ---------- viento en pelo, plumas y musgo (COLOR_1.r = flexibilidad) ---------- */
  const WU = { uTime: { value: 0 }, uWind: { value: new T.Vector3() } };
  function patchWind(scene) {
    scene.traverse((o) => {
      if (!o.isMesh || !o.geometry.attributes.color_1) return;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
        if (!m || m.userData.jcsWind) return; m.userData.jcsWind = true;
        m.onBeforeCompile = (sh) => {
          sh.uniforms.uTime = WU.uTime; sh.uniforms.uWind = WU.uWind;
          sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform vec3 uWind;\nattribute vec3 color_1;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\n{ float jf = color_1.r; float jw = 0.65 + 0.35 * sin(uTime * 2.3 + position.x * 9.0 + position.y * 6.0 + position.z * 7.0); transformed += uWind * jf * jw; }');
        };
        m.customProgramCacheKey = () => 'jcs-wind'; m.needsUpdate = true;
      });
    });
  }

  /* ---------- rig compatible con JanusCreatures3D ---------- */
  const POSE_CLIPS = { idle: ['idle'], habla: ['habla', 'idle'], piensa: ['piensa', 'idle'], celebra: ['celebra', 'baila', 'idle'], senala: ['saluda', 'idle'], saluda: ['saluda', 'idle'] };
  const MOOD_MORPH = { alegre: 'alegre', contento: 'contento', triste: 'triste', enojado: 'enojado', sorprendido: 'sorprendido', pensativo: 'pensativo' };
  const STAGE_H = 2.3;
  function rigFor(id) {
    const e = reg[id]; if (!e) return null;
    const root = new T.Group(), wrap = new T.Group(), inst = G.cloneSkinned(e.gltf.scene); wrap.add(inst); root.add(wrap);
    inst.updateMatrixWorld(true); const box = new T.Box3().setFromObject(inst), h = box.max.y - box.min.y || 1, k = STAGE_H / h;
    wrap.scale.setScalar(k); wrap.position.y = -box.min.y * k;
    inst.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = true; } });
    const sockets = {}; CONTRACT.sockets.forEach((n) => { const o = inst.getObjectByName(n); if (o) sockets[n] = o; });
    const mixer = new T.AnimationMixer(inst), actions = {}; (e.gltf.animations || []).forEach((c) => { actions[c.name] = mixer.clipAction(c); });
    const morphMeshes = []; inst.traverse((o) => { if (o.isMesh && o.morphTargetDictionary) morphMeshes.push(o); });
    const cur = {}, setM = (n, v) => { morphMeshes.forEach((m) => { const i = m.morphTargetDictionary[n]; if (i !== undefined) m.morphTargetInfluences[i] = v; }); };
    const hasM = (n) => morphMeshes.some((m) => m.morphTargetDictionary[n] !== undefined);
    const visAvail = VISEMES.filter(hasM);
    const R = { root, sockets, id, glb: true, mixer, clip: null, blinkT: 2 + Math.random() * 3, vis: 0, visT: 0, phase: Math.random() * 6 };
    R.setLook = () => { /* los GLB no se recolorean: su aspecto viene del modelo. Los accesorios van a los sockets (fase 2). */ };
    R.attach = (socket, obj) => { const s = sockets[socket]; if (s && obj) { s.add(obj); return true; } return false; };
    R.update = (t, dt, ctl) => {
      ctl = ctl || {}; const pose = ctl.pose || 'idle', walk = ctl.walk || 0, talking = pose === 'habla' || ctl.talk;
      // clip: andar manda sobre la pose
      const want = (walk > 0.25 ? ['camina', 'idle'] : POSE_CLIPS[pose] || ['idle']).find((n) => actions[n]);
      const next = want ? actions[want] : null;
      if (next && R.clip !== next) { next.reset().fadeIn(0.25).play(); if (R.clip) R.clip.fadeOut(0.25); R.clip = next; }
      if (!next) { wrap.rotation.y = Math.sin((t + R.phase) * 0.7) * 0.05; wrap.position.y = -box.min.y * k + Math.sin((t + R.phase) * 2.1) * 0.01; } // sin animaciones: respiración mínima
      mixer.update(dt);
      // expresiones
      const mood = MOOD_MORPH[ctl.mood] ? ctl.mood : pose === 'piensa' && hasM('pensativo') ? 'pensativo' : 'contento';
      const d = 1 - Math.exp(-14 * dt);
      Object.keys(MOOD_MORPH).forEach((m) => { const n = MOOD_MORPH[m]; if (!hasM(n)) return; cur[n] = (cur[n] || 0) + ((m === mood ? 1 : 0) - (cur[n] || 0)) * d; setM(n, cur[n]); });
      R.blinkT -= dt; const bl = R.blinkT < 0.12 ? 1 : 0; if (R.blinkT < 0) R.blinkT = 2.2 + Math.random() * 3.2;
      ['blink_L', 'blink_R'].forEach((n) => { if (!hasM(n)) return; cur[n] = (cur[n] || 0) + (bl - (cur[n] || 0)) * (1 - Math.exp(-40 * dt)); setM(n, cur[n]); });
      // boca al hablar: visemas si los hay; si no, mouth_open
      if (talking) {
        R.visT -= dt; if (R.visT <= 0) { R.visT = 0.07 + Math.random() * 0.08; R.vis = visAvail.length ? Math.floor(Math.random() * Math.min(visAvail.length, 5)) : 0; }
        visAvail.forEach((n, i) => { const tgt = i === R.vis ? 0.85 : 0; cur[n] = (cur[n] || 0) + (tgt - (cur[n] || 0)) * (1 - Math.exp(-30 * dt)); setM(n, cur[n]); });
        if (!visAvail.length && hasM('mouth_open')) { cur.mouth_open = 0.25 + Math.abs(Math.sin((t + R.phase) * 13)) * 0.6; setM('mouth_open', cur.mouth_open); }
      } else {
        visAvail.forEach((n) => { if (cur[n]) { cur[n] *= Math.exp(-30 * dt); setM(n, cur[n]); } });
        const mo = mood === 'sorprendido' ? 0.55 : mood === 'alegre' ? 0.2 : 0; if (hasM('mouth_open')) { cur.mouth_open = (cur.mouth_open || 0) + (mo - (cur.mouth_open || 0)) * d; setM('mouth_open', cur.mouth_open); }
      }
      // viento: más fuerte al andar, cola de la estela hacia atrás
      WU.uTime.value = t; WU.uWind.value.set(Math.sin(t * 0.9) * 0.012, 0.002, -0.006 - walk * 0.03);
    };
    return R;
  }

  /* ---------- persistencia local (IndexedDB) ---------- */
  const DB = 'janus-creature-slot', STORE = 'glb';
  const idb = () => new Promise((res, rej) => { try { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } });
  async function idbPut(id, buf, name) { try { const db = await idb(); db.transaction(STORE, 'readwrite').objectStore(STORE).put({ buf, name }, id); } catch (e) { /* sin almacenamiento: el modelo vale para esta sesión */ } }
  async function idbDel(id) { try { const db = await idb(); db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id); } catch (e) { /* nada que borrar */ } }
  async function restore() {
    let n = 0; try {
      const db = await idb();
      for (const id of IDS) {
        const v = await new Promise((res) => { const q = db.transaction(STORE).objectStore(STORE).get(id); q.onsuccess = () => res(q.result); q.onerror = () => res(null); });
        if (v && v.buf && !reg[id]) { const r = await load(id, v.buf, { name: v.name, volatile: true }); if (r.level !== 'error') n++; }
      }
    } catch (e) { /* sin IndexedDB */ }
    return n;
  }

  return { CONTRACT, ids: IDS, inspect, load, remove, has, report, info, rigFor, restore, onChange, guessId, supported: () => !!(T && G && G.GLTFLoader) };
})();
window.JanusCreatureSlot = JanusCreatureSlot;
