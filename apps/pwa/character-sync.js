/**
 * JANUS · sincronización de personajes 3D con la biblioteca central del servidor.
 *
 * Subes cada modelo UNA vez (panel del Founder) y llega a todas las pantallas:
 *  - Founder: ve la última versión subida, con el aviso «revisión visual pendiente» hasta que la apruebe.
 *  - Kendra: recibe solo lo que el Founder aprobó; si lo rechaza después, se retira de su tablet.
 * Todo se instala con el hueco 3D existente (JanusCreatureSlot) y queda en el dispositivo para usarse sin conexión.
 * Este módulo no genera personajes ni sustituye imágenes: solo descarga, verifica la huella SHA-256 y carga.
 */
const SLOT_IDS = Object.freeze(['lumi', 'bombo', 'musgo', 'nimbo', 'nexo-masculino', 'nexo-femenino']);
const KID_IDS = Object.freeze(SLOT_IDS.slice(0, 4));
const SLOT_LABELS = Object.freeze({
  lumi: 'Lumi', bombo: 'Bombo', musgo: 'Musgo', nimbo: 'Nimbo',
  'nexo-masculino': 'Nexo · Janus', 'nexo-femenino': 'Nexo · Melanie',
});
const STORE_PREFIX = 'janus.characters.synced.v1.';
const MAX_GLB_BYTES = 15 * 1024 * 1024;
const RESYNC_MS = 60_000;

let config = null;
let started = false;
let running = null;
let lastRun = 0;
const meta = new Map();

/** audience: 'founder' (ve pendientes) | 'kid' (solo aprobados). headers(): cabeceras de autenticación vigentes. */
export function configureCharacterSync({ audience, headers }) {
  if (audience !== 'founder' && audience !== 'kid') throw new Error('Audiencia de personajes no válida');
  config = { audience, headers: typeof headers === 'function' ? headers : () => ({}) };
  window.JanusCharacterSync = Object.freeze({
    audience,
    canDisplay: canDisplayApproved,
    clearKidApprovals: () => { if (config?.audience === 'kid') { writeSynced({}); meta.clear(); announce(); } },
    meta: (id) => meta.get(id) || null,
    start: startCharacterSync,
    sync: syncCharacters,
  });
}

export function characterMeta(id) { return meta.get(id) || null; }

// Never equate a slot name with approved bytes. An imported or replaced GLB
// with the same slot name must not inherit the old approval.
export function canDisplayApproved(id) {
  if (!config || !authHeaders()) return false;
  const actual = window.JanusCreatureSlot?.info?.(id)?.sha256;
  if (!actual || !/^[a-f0-9]{64}$/.test(actual)) return false;
  if (config.audience === 'kid') {
    if (!KID_IDS.includes(id)) return false;
    return readSynced()[id] === actual;
  }
  const record = meta.get(id);
  return record?.review === 'approved' && record.sha256 === actual;
}
function readSynced() {
  try { return JSON.parse(localStorage.getItem(STORE_PREFIX + config.audience) || '{}') || {}; } catch { return {}; }
}
function writeSynced(map) {
  try { localStorage.setItem(STORE_PREFIX + config.audience, JSON.stringify(map)); } catch { /* sin almacenamiento: se repite la comprobación */ }
}
function authHeaders() {
  const headers = config?.headers?.() || {};
  return headers.authorization ? headers : null;
}
async function sha256Hex(buffer) {
  if (!globalThis.crypto?.subtle) throw new Error('Necesitas HTTPS o localhost para verificar el modelo');
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', buffer));
  return [...bytes].map((x) => x.toString(16).padStart(2, '0')).join('');
}
async function request(path, init = {}, wantBytes = false) {
  const headers = authHeaders();
  if (!headers) return { status: 0, reason: 'sin-acceso' };
  try {
    const response = await fetch(path, { ...init, headers: { ...headers, ...(init.headers || {}) } });
    if (wantBytes && response.ok) return { status: response.status, bytes: await response.arrayBuffer() };
    let body = null;
    try { body = await response.json(); } catch { body = null; }
    return { status: response.status, body };
  } catch {
    return { status: 0, reason: 'sin-conexion' };
  }
}
function announce() {
  try { window.dispatchEvent(new CustomEvent('janus:characters-changed')); } catch { /* sin eventos */ }
}

export function syncCharacters() {
  if (!config) return Promise.resolve({ skipped: 'sin-configurar' });
  if (!running) running = run().finally(() => { running = null; lastRun = Date.now(); });
  return running;
}

async function run() {
  const slot = window.JanusCreatureSlot;
  if (!slot?.supported?.()) return { skipped: 'sin-motor-3d' };
  const kid = config.audience === 'kid';
  const token = authHeaders()?.authorization;
  const sameSession = () => token === authHeaders()?.authorization;
  const listing = await request(kid ? '/api/kid/characters' : '/api/characters', { cache: 'no-store' });
  if (!sameSession()) return { skipped: 'sesion-cambiada' };
  if (listing.status !== 200 || !listing.body?.ok || !Array.isArray(listing.body.characters)) {
    if (kid && (listing.status === 401 || listing.status === 403)) { writeSynced({}); meta.clear(); announce(); }
    return { skipped: listing.reason || (listing.status === 0 ? 'sin-conexion' : 'sin-acceso') };
  }
  const wanted = kid
    ? listing.body.characters.filter(item => KID_IDS.includes(item.slot) && /^[a-f0-9]{64}$/.test(item.sha256)).map((item) => ({ slot: item.slot, sha256: item.sha256, tier: item.tier, review: 'approved' }))
    : listing.body.characters
      .map((item) => item.active || item.servable)
      .filter(Boolean)
      .map((entry) => ({ slot: entry.slot, sha256: entry.sha256, tier: entry.tier, review: entry.review }));

  const synced = readSynced();
  const before = JSON.stringify([...meta.entries()]);
  let loaded = 0; let removed = 0; const errors = [];

  // Revoke changed/withdrawn approvals before any download can fail.
  if (kid) {
    for (const id of Object.keys(synced)) {
      if (wanted.some(want => want.slot === id && want.sha256 === synced[id])) continue;
      const old = synced[id];
      delete synced[id]; meta.delete(id);
      if (slot.info?.(id)?.sha256 === old && slot.remove(id)) removed++;
    }
    writeSynced(synced); if (removed || JSON.stringify([...meta.entries()]) !== before) announce();
  }

  for (const want of wanted) {
    if (!SLOT_IDS.includes(want.slot) || !/^[a-f0-9]{64}$/.test(want.sha256)) continue;
    // El estado visible (aprobado/pendiente) se fija antes de cargar para que la primera pintura ya sea correcta.
    meta.set(want.slot, { sha256: want.sha256, tier: want.tier, review: want.review });
    if (!sameSession()) return { skipped: 'sesion-cambiada' };
    if (synced[want.slot] === want.sha256 && slot.info?.(want.slot)?.sha256 === want.sha256) continue;
    const path = (kid ? '/api/kid/characters/' : '/api/characters/') + want.slot + '/' + want.sha256 + '.glb';
    const download = await request(path, { cache: 'force-cache' }, true);
    if (!download.bytes) { errors.push(want.slot + ': ' + (download.reason || 'HTTP ' + download.status)); meta.delete(want.slot); continue; }
    try {
      if (download.bytes.byteLength > MAX_GLB_BYTES) throw new Error('supera 15 MB');
      if ((await sha256Hex(download.bytes)) !== want.sha256) throw new Error('la huella no coincide');
      if (!sameSession()) return { skipped: 'sesion-cambiada' };
      const report = await slot.load(want.slot, download.bytes, { name: want.slot + '-' + want.sha256.slice(0, 8) + '.glb' });
      if (report.level === 'error') throw new Error(report.summary || 'modelo no utilizable');
      if (!sameSession()) return { skipped: 'sesion-cambiada' };
      if (slot.info?.(want.slot)?.sha256 !== want.sha256) throw new Error('la huella cargada no coincide');
      synced[want.slot] = want.sha256;
      loaded++;
    } catch (error) {
      errors.push(want.slot + ': ' + String(error?.message || error));
      meta.delete(want.slot);
    }
  }

  for (const id of Object.keys(synced)) {
    if (wanted.some((want) => want.slot === id)) continue;
    // Retirada: solo en la tablet de la niña y solo de lo que ESTA sincronización instaló.
    if (kid && slot.info?.(id)?.sha256 === synced[id] && slot.remove(id)) removed++;
    if (kid) { delete synced[id]; meta.delete(id); }
  }
  if (!kid) for (const id of [...meta.keys()]) if (!wanted.some((want) => want.slot === id)) meta.delete(id);

  writeSynced(synced);
  if (loaded || removed || JSON.stringify([...meta.entries()]) !== before) announce();
  return { loaded, removed, errors };
}

export function startCharacterSync() {
  if (!config || started) return;
  started = true;
  void syncCharacters();
  window.addEventListener('online', () => void syncCharacters());
  if (config.audience === 'kid') setInterval(() => { if (document.visibilityState === 'visible' && authHeaders()) void syncCharacters(); }, RESYNC_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastRun > RESYNC_MS) void syncCharacters();
  });
}

// ── Solo Founder: subir, revisar y activar ───────────────────────────────────

export async function loadLibraryOverview() {
  const result = await request('/api/characters', { cache: 'no-store' });
  if (result.status !== 200 || !result.body?.ok) {
    throw new Error(result.status === 0 ? 'Sin conexión con Janus o sin sesión de Founder.' : (result.body?.error || 'No se pudo leer la biblioteca.'));
  }
  return result.body.characters;
}

export async function uploadCharacter(id, file, origin = 'hyper3d-rodin') {
  if (!SLOT_IDS.includes(id)) throw new Error('Personaje no autorizado');
  if (!file || !/\.glb$/i.test(file.name) || file.size < 32 || file.size > MAX_GLB_BYTES) {
    throw new Error('Se exige un archivo .glb de hasta 15 MB');
  }
  const result = await request('/api/characters/' + id, {
    method: 'PUT', body: file,
    headers: { 'content-type': 'model/gltf-binary', 'x-character-origin': origin },
  });
  if (result.status !== 200 && result.status !== 201) {
    throw new Error(result.status === 0 ? 'Sin conexión con Janus o sin sesión de Founder.' : (result.body?.error || 'Janus rechazó el modelo.'));
  }
  await syncCharacters();
  return result.body;
}

export async function reviewCharacter(id, sha256, decision) {
  const result = await request('/api/characters/' + id + '/review', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sha256, decision }),
  });
  if (result.status !== 200) throw new Error(result.body?.error || 'No se pudo guardar tu decisión.');
  await syncCharacters();
  return result.body;
}

function describe(item) {
  if (!item.active) return 'Sin modelo todavía';
  const fixed = item.active.tier === 'partial' ? ' · figura fija (sin esqueleto)' : '';
  if (item.active.review === 'approved') return 'Aprobado' + fixed;
  const kendra = item.servable ? ' · Kendra sigue viendo la versión aprobada' : '';
  return 'Pendiente de tu revisión' + fixed + kendra;
}

/** Panel del Founder. `openStage(id)` abre la vista 3D para revisar (lo aporta el anfitrión: createApprovedStage). */
export function createCharacterLibraryPanel({ openStage } = {}) {
  const panel = document.createElement('section');
  panel.className = 'janus-asset-manager janus-character-library';
  const title = document.createElement('h3');
  title.textContent = 'Biblioteca de personajes 3D';
  const intro = document.createElement('p');
  intro.textContent = 'Sube cada modelo una sola vez. Llega a tu dashboard y, cuando lo apruebes, a la de Kendra.';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  const originLabel = document.createElement('label');
  originLabel.textContent = 'Origen del modelo: ';
  const origin = document.createElement('select');
  for (const [value, text] of [['hyper3d-rodin', 'Hyper3D Rodin'], ['janus-trellis2-local', 'Janus local (TRELLIS)'], ['manual-local', 'Otro / hecho a mano']]) {
    const option = document.createElement('option'); option.value = value; option.textContent = text; origin.append(option);
  }
  originLabel.append(origin);
  const list = document.createElement('div');
  list.className = 'janus-library-list';
  panel.append(title, intro, status, originLabel, list);

  async function refresh() {
    let overview;
    try { overview = await loadLibraryOverview(); } catch (error) { status.textContent = String(error?.message || error); return; }
    list.replaceChildren();
    for (const item of overview) {
      const row = document.createElement('div');
      row.className = 'janus-library-row';
      row.dataset.slot = item.slot;
      const name = document.createElement('strong'); name.textContent = SLOT_LABELS[item.slot] || item.slot;
      const state = document.createElement('span'); state.className = 'janus-library-state'; state.textContent = describe(item);
      const upload = document.createElement('input');
      upload.type = 'file'; upload.accept = '.glb,model/gltf-binary';
      upload.setAttribute('aria-label', 'Subir GLB de ' + (SLOT_LABELS[item.slot] || item.slot));
      upload.addEventListener('change', async () => {
        try {
          status.textContent = 'Subiendo y comprobando ' + (SLOT_LABELS[item.slot] || item.slot) + '…';
          const result = await uploadCharacter(item.slot, upload.files?.[0], origin.value);
          status.textContent = (SLOT_LABELS[item.slot] || item.slot) + (result.duplicate ? ': ese archivo ya estaba.' : ': subido. Revísalo y apruébalo.');
        } catch (error) { status.textContent = String(error?.message || error); }
        finally { upload.value = ''; await refresh(); }
      });
      const actions = document.createElement('div'); actions.className = 'janus-library-actions';
      if (item.active && typeof openStage === 'function') {
        const view = document.createElement('button'); view.type = 'button'; view.textContent = 'Ver';
        view.addEventListener('click', () => openStage(item.slot));
        actions.append(view);
      }
      if (item.active?.review === 'pending_visual_review') {
        for (const [decision, text] of [['approved', 'Aprobar'], ['rejected', 'Rechazar']]) {
          const button = document.createElement('button'); button.type = 'button'; button.textContent = text;
          button.addEventListener('click', async () => {
            try {
              await reviewCharacter(item.slot, item.active.sha256, decision);
              status.textContent = (SLOT_LABELS[item.slot] || item.slot) + (decision === 'approved' ? ': aprobado. Llegará a Kendra.' : ': rechazado.');
            } catch (error) { status.textContent = String(error?.message || error); }
            await refresh();
          });
          actions.append(button);
        }
      }
      row.append(name, state, upload, actions);
      list.append(row);
    }
  }
  void syncCharacters().then(refresh, refresh);
  return panel;
}
