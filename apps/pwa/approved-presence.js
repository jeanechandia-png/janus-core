/**
 * JANUS CORE / PWA real — presencia canónica con assets originales verificables.
 * No genera personajes ni imágenes. No finge modelos 3D con imágenes 2D.
 * Usa el rig y cargador GLB existentes de JANUS (mismos blobs Git del proyecto).
 * Las referencias aprobadas permanecen en IndexedDB del dispositivo; nada se sube.
 */
export const APPROVED_REFERENCES = Object.freeze({
  kendra: {
    sha256: '87d977714b2b2dc03f426151b731e0b3f1936be7e0d81c09108377bf4b1af5e3',
    width: 1536, height: 864,
    names: ['lumi', 'bombo', 'musgo', 'nimbo'],
    crops: {
      lumi: [240, 42, 245, 326],
      bombo: [480, 43, 254, 325],
      musgo: [744, 45, 288, 328],
      nimbo: [1068, 37, 255, 336]
    }
  },
  'nexo-masculino': {
    sha256: 'fbb0ba9cf9923848600b866a0b31ecc44d17013e627024b7c5b566c09d78aeb1',
    width: 1535, height: 1024, names: ['nexo-masculino'],
    crops: { 'nexo-masculino': [128, 5, 613, 1010] }
  },
  'nexo-femenino': {
    sha256: '4d21d78ab32c352a2207aa62043d32b52ef4971eede93051925b8c89b24861b1',
    width: 1536, height: 1024, names: ['nexo-femenino'],
    crops: { 'nexo-femenino': [207, 0, 646, 1012] }
  }
});
export const JANUS_CHARACTER_IDS = Object.freeze([
  'lumi', 'bombo', 'musgo', 'nimbo', 'nexo-masculino', 'nexo-femenino'
]);
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_GLB_BYTES = 15 * 1024 * 1024;
const memory = new Map();
const viewers = new Set();
const objectUrls = new Map();
let restoring = null;
let listening = false;

function referenceFor(id) {
  return Object.entries(APPROVED_REFERENCES).find(([, ref]) => ref.names.includes(id));
}
function openDb() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) { reject(new Error('IndexedDB no disponible')); return; }
    const req = indexedDB.open('janus-approved-references', 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains('assets')) req.result.createObjectStore('assets');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('No se pudo abrir el almacén'));
  });
}
async function readRecord(key) {
  if (memory.has(key)) return memory.get(key);
  try {
    const db = await openDb();
    const result = await new Promise((resolve) => {
      const q = db.transaction('assets', 'readonly').objectStore('assets').get(key);
      q.onsuccess = () => resolve(q.result || null);
      q.onerror = () => resolve(null);
    });
    db.close();
    if (result) memory.set(key, result);
    return result;
  } catch { return null; }
}
async function writeRecord(key, record) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction('assets', 'readwrite');
    tx.objectStore('assets').put(record, key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('No se pudo guardar'));
  });
  db.close();
  memory.set(key, record);
}
async function sha256(buffer) {
  if (!globalThis.crypto?.subtle) throw new Error('Necesitas HTTPS o localhost para verificar el original');
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', buffer));
  return [...bytes].map(x => x.toString(16).padStart(2, '0')).join('');
}
export async function installOriginalArtwork(key, file) {
  const ref = APPROVED_REFERENCES[key];
  if (!ref) throw new Error('Referencia desconocida');
  if (!file || file.size > MAX_IMAGE_BYTES || file.size < 1024) throw new Error('Imagen original ausente o demasiado grande');
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Solo se admiten imágenes originales');
  const bytes = await file.arrayBuffer();
  const hash = await sha256(bytes);
  if (hash !== ref.sha256) throw new Error('El archivo no coincide con la imagen exacta aprobada: no se instalará');
  const image = await createImageBitmap(new Blob([bytes], { type: file.type }));
  const dimensionsOk = image.width === ref.width && image.height === ref.height;
  image.close?.();
  if (!dimensionsOk) throw new Error('Las dimensiones del original no coinciden');
  await writeRecord('art:' + key, { blob: new Blob([bytes], { type: file.type }), sha256: hash });
  if (objectUrls.has(key)) URL.revokeObjectURL(objectUrls.get(key));
  objectUrls.delete(key);
  notify();
  return { key, sha256: hash, verified: true };
}
export async function installGlbPreview(id, file) {
  if (!JANUS_CHARACTER_IDS.includes(id)) throw new Error('Personaje no autorizado');
  if (!file || file.size > MAX_GLB_BYTES || file.size < 32 || !/\.glb$/i.test(file.name)) {
    throw new Error('Se exige un modelo GLB real de hasta 15 MB');
  }
  await initApprovedPresence();
  const slot = window.JanusCreatureSlot;
  if (!slot?.supported?.()) throw new Error('Motor de modelos glTF no disponible en este dispositivo');
  const bytes = await file.arrayBuffer();
  const report = await slot.inspect(bytes);
  if (report.level !== 'ok') throw new Error('Modelo incompleto: ' + report.summary);
  const loaded = await slot.load(id, bytes, { name: file.name });
  if (loaded.level !== 'ok') throw new Error('Modelo rechazado: ' + loaded.summary);
  notify();
  // Un GLB técnicamente válido aún NO equivale a la aprobación visual del usuario.
  return { id, status: '3D_TECNICAMENTE_VALIDO_REVISION_VISUAL_PENDIENTE', report: loaded };
}
export function initApprovedPresence() {
  if (!restoring) {
    restoring = Promise.resolve().then(async () => {
      const slot = window.JanusCreatureSlot;
      if (!slot?.supported?.()) return false;
      if (!listening) {
        slot.onChange(() => notify());
        listening = true;
      }
      await slot.restore();
      return true;
    }).catch(() => false);
  }
  return restoring;
}
function notify() {
  for (const viewer of [...viewers]) {
    if (!viewer.isConnected) { viewer.__janusDispose?.(); viewers.delete(viewer); continue; }
    void refreshViewer(viewer);
  }
}
async function artUrl(key) {
  if (objectUrls.has(key)) return objectUrls.get(key);
  const record = await readRecord('art:' + key);
  if (!record || record.sha256 !== APPROVED_REFERENCES[key]?.sha256 || !record.blob) return null;
  const url = URL.createObjectURL(record.blob);
  objectUrls.set(key, url);
  return url;
}
function mountPoster(target, id, key, url) {
  const spec = APPROVED_REFERENCES[key], c = spec.crops[id];
  const poster = document.createElement('div');
  poster.className = 'janus-approved-poster';
  poster.style.backgroundImage = 'url("' + url + '")';
  poster.style.backgroundSize = (100 * spec.width / c[2]) + '% ' + (100 * spec.height / c[3]) + '%';
  poster.style.backgroundPosition =
    (100 * c[0] / (spec.width - c[2])) + '% ' +
    (100 * c[1] / (spec.height - c[3])) + '%';
  poster.setAttribute('role', 'img');
  poster.setAttribute('aria-label', 'Recorte sin modificación de la referencia original ' + id + '. Fotografía, no modelo 3D.');
  target.append(poster);
  target.dataset.media = 'approved-2d-reference';
}
function mountModel(target, id) {
  const T = window.THREE;
  const rig = window.JanusCreatureSlot?.rigFor(id);
  if (!T || !rig) return false;
  const scene = new T.Scene();
  scene.add(rig.root);
  scene.add(new T.HemisphereLight(0xf6e3ff, 0x24172b, 2.0));
  const key = new T.DirectionalLight(0xffe5b9, 2.9);
  key.position.set(-2, 5, 5); scene.add(key);
  const rim = new T.DirectionalLight(0x8eaeff, 1.8);
  rim.position.set(3, 4, -3); scene.add(rim);
  const camera = new T.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 2.05, 6.0);
  camera.lookAt(0, 1.2, 0);
  let renderer;
  try {
    renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
  } catch { return false; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  target.append(renderer.domElement);
  target.dataset.media = 'glb-3d-preview';
  target.dataset.visualApproval = 'pending';
  const label = document.createElement('span');
  label.className = 'janus-approval-label';
  label.textContent = '3D · revisión visual pendiente';
  target.append(label);
  let yaw = 0, lastX = 0, down = false, playing = 'idle', clock = performance.now(), frame = 0;
  const action = target.closest('button') || target;
  const onDown = e => { down = true; lastX = e.clientX; };
  const onMove = e => { if (down) { yaw += (e.clientX - lastX) * .008; lastX = e.clientX; } };
  const onUp = () => { down = false; };
  const onClick = () => { playing = 'celebra'; setTimeout(() => { playing = 'idle'; }, 1200); };
  action.addEventListener('pointerdown', onDown);
  action.addEventListener('pointermove', onMove);
  action.addEventListener('pointerup', onUp);
  action.addEventListener('pointercancel', onUp);
  action.addEventListener('click', onClick);
  const resize = () => {
    const box = target.getBoundingClientRect();
    const w = Math.max(1, Math.round(box.width)), h = Math.max(1, Math.round(box.height));
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(target); resize();
  let disposed = false;
  const tick = now => {
    if (disposed || !target.isConnected || !target.querySelector('canvas')) { dispose(); return; }
    const dt = Math.min(.05, (now - clock) / 1000 || .016);
    clock = now;
    if (document.visibilityState === 'visible') {
      rig.root.rotation.y += (yaw - rig.root.rotation.y) * .12;
      rig.update(now / 1000, dt, { pose: playing, mood: playing === 'celebra' ? 'alegre' : 'contento' });
      renderer.render(scene, camera);
    }
    frame = requestAnimationFrame(tick);
  };
  function dispose() {
    if (disposed) return;
    disposed = true; cancelAnimationFrame(frame); resizeObserver.disconnect();
    action.removeEventListener('pointerdown', onDown);
    action.removeEventListener('pointermove', onMove);
    action.removeEventListener('pointerup', onUp);
    action.removeEventListener('pointercancel', onUp);
    action.removeEventListener('click', onClick);
    renderer.dispose(); renderer.domElement.remove();
    // rigFor clones meshes; keep saved source in the shared GLB slot.
  }
  target.__janusDispose = dispose;
  frame = requestAnimationFrame(tick);
  return true;
}
async function refreshViewer(viewer) {
  const id = viewer.dataset.character;
  if (!id || !JANUS_CHARACTER_IDS.includes(id)) return;
  const target = viewer.querySelector('.janus-approved-viewport');
  if (!target) return;
  const version = (viewer.__janusVersion || 0) + 1;
  viewer.__janusVersion = version;
  viewer.__janusDispose?.();
  viewer.__janusDispose = null;
  target.replaceChildren();
  await initApprovedPresence();
  if (version !== viewer.__janusVersion || !viewer.isConnected) return;
  if (window.JanusCreatureSlot?.has?.(id) && mountModel(target, id)) return;
  const [key] = referenceFor(id) || [];
  const url = key ? await artUrl(key) : null;
  if (version !== viewer.__janusVersion || !viewer.isConnected) return;
  if (url) { mountPoster(target, id, key, url); return; }
  const notice = document.createElement('span');
  notice.className = 'janus-asset-pending';
  notice.textContent = 'Original aprobado pendiente de instalar · no se mostrará un sustituto';
  target.dataset.media = 'not-installed';
  target.append(notice);
}
export function createApprovedStage(id, { compact = false } = {}) {
  if (!JANUS_CHARACTER_IDS.includes(id)) throw new Error('Personaje desconocido');
  const box = document.createElement('div');
  box.className = 'janus-approved-stage' + (compact ? ' is-compact' : '');
  box.dataset.character = id;
  const viewport = document.createElement('div');
  viewport.className = 'janus-approved-viewport';
  box.append(viewport);
  viewers.add(box);
  queueMicrotask(() => void refreshViewer(box));
  return box;
}
export function createApprovedAssetControls({ family = 'kendra' } = {}) {
  const panel = document.createElement('section');
  panel.className = 'janus-asset-manager';
  const title = document.createElement('h3');
  title.textContent = 'Activos originales · verificación local';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.textContent = 'Se conservan los originales exactos. No se generan ni suben archivos.';
  panel.append(title, status);
  const keys = family === 'kendra' ? ['kendra'] : ['nexo-masculino', 'nexo-femenino'];
  for (const key of keys) {
    const label = document.createElement('label');
    label.textContent = (key === 'kendra' ? 'Lámina original de Lumi, Bombo, Musgo y Nimbo' : key) + ': ';
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/jpeg,image/png,image/webp';
    input.setAttribute('aria-label', 'Instalar referencia verificada ' + key);
    input.addEventListener('change', async () => {
      try {
        status.textContent = 'Comprobando SHA-256…';
        const result = await installOriginalArtwork(key, input.files?.[0]);
        status.textContent = 'Original exacto instalado en este dispositivo (' + result.sha256.slice(0, 12) + '…).';
      } catch (error) { status.textContent = String(error?.message || error); }
      finally { input.value = ''; }
    });
    label.append(input); panel.append(label);
  }
  for (const id of (family === 'kendra' ? JANUS_CHARACTER_IDS.slice(0,4) : JANUS_CHARACTER_IDS.slice(4))) {
    const label = document.createElement('label');
    label.textContent = 'Modelo 3D ' + id + ': ';
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.glb,model/gltf-binary';
    input.setAttribute('aria-label', 'Importar GLB para ' + id);
    input.addEventListener('change', async () => {
      try {
        status.textContent = 'Inspeccionando malla, rig, morphs y animaciones…';
        const result = await installGlbPreview(id, input.files?.[0]);
        status.textContent = result.id + ': 3D técnico cargado. Revisión visual final todavía pendiente.';
      } catch (error) { status.textContent = String(error?.message || error); }
      finally { input.value = ''; }
    });
    label.append(input); panel.append(label);
  }
  return panel;
}
