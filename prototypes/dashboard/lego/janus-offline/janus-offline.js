'use strict';
/* ===== janus-offline · seguir trabajando sin conexión en el navegador (LEGO 1.0.0) =====
 * Pareja de navegador de packages/modules/offline-kit (misma política, sin dependencias). Sirve a cualquier producto
 * web (JANUS hoy; IBA y ChatBox después) sin tocar su código de pantalla: envuelve `fetch` solo para las rutas que
 * el producto declare.
 *
 *  - LECTURAS declaradas: primero la red; si responde bien, se guarda una copia en el aparato. Si la red falla, se
 *    devuelve la última copia con las cabeceras `x-janus-offline: cache` y `x-janus-saved-at`, para que la pantalla
 *    diga de cuándo son los datos. Una copia demasiado vieja no se enseña.
 *  - CAMBIOS declarados: si la red falla, el cambio se guarda en una bandeja de salida y la llamada responde 202
 *    `{ queued: true }`. Al volver la conexión se envían en orden con `Idempotency-Key` (el servidor no duplica).
 *    Lo marcado como delicado, o lo que lleva demasiado tiempo esperando, NO se envía solo: pide confirmación.
 *  - Un error del servidor (4xx/5xx) no es «estar sin conexión»: pasa tal cual a la pantalla.
 *  - El token de sesión nunca se guarda: al reenviar se usan las cabeceras vigentes en ese momento.
 *  - `clear()` borra todo lo guardado (al cerrar sesión).
 *
 * Uso:
 *   JanusOffline.install({
 *     namespace: 'janus:founder',                         // separa usuarios/empresas en el mismo aparato
 *     read:  [/^\/api\/books(\?|$)/, '/api/cases'],       // prefijos (texto) o expresiones regulares
 *     write: [{ match: '/api/books/entries', method: 'POST', kind: 'books.entry', summary: (body) => body.description, sensitive: false }],
 *     headers: () => ({ authorization: 'Bearer …' }),     // cabeceras para reenviar
 *     onChange: (state) => { … },                         // { online, pending, review, lastSavedAt }
 *   });
 */
(function () {
  const DB_NAME = 'janus-offline-v1';
  const DEFAULTS = { maxAgeMs: 7 * 24 * 3600 * 1000, reviewAfterMs: 24 * 3600 * 1000, maxItems: 200, maxBodyChars: 200000, maxCacheChars: 2000000 };
  const S = { cfg: null, db: null, mem: { cache: new Map(), outbox: new Map() }, online: true, draining: false, nativeFetch: null, state: { online: true, pending: 0, review: 0, lastSavedAt: null }, timer: null };

  /* ── Almacén: IndexedDB; si el navegador no lo permite (modo privado), memoria (se pierde al cerrar). ── */
  function openDb() {
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains('cache')) db.createObjectStore('cache'); if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox'); };
        req.onsuccess = () => resolve(req.result); req.onerror = () => resolve(null); req.onblocked = () => resolve(null);
      } catch (e) { resolve(null); }
    });
  }
  const key = (id) => S.cfg.namespace + '|' + id;
  function tx(store, mode, run) {
    if (!S.db) return Promise.resolve(run(null));
    return new Promise((resolve) => { try { const t = S.db.transaction(store, mode); const out = run(t.objectStore(store)); t.oncomplete = () => resolve(out ? out.result : undefined); t.onerror = t.onabort = () => resolve(undefined); } catch (e) { resolve(undefined); } });
  }
  const put = (store, id, value) => (S.db ? tx(store, 'readwrite', (os) => os.put(value, key(id))) : Promise.resolve(void S.mem[store].set(key(id), value)));
  const get = (store, id) => (S.db ? tx(store, 'readonly', (os) => os.get(key(id))) : Promise.resolve(S.mem[store].get(key(id))));
  const del = (store, id) => (S.db ? tx(store, 'readwrite', (os) => os.delete(key(id))) : Promise.resolve(void S.mem[store].delete(key(id))));
  function all(store) {
    const prefix = S.cfg.namespace + '|';
    if (!S.db) return Promise.resolve([...S.mem[store].entries()].filter(([k]) => k.startsWith(prefix)).map(([, v]) => v));
    return new Promise((resolve) => { try { const out = []; const req = S.db.transaction(store, 'readonly').objectStore(store).openCursor(); req.onsuccess = () => { const c = req.result; if (!c) return resolve(out); if (String(c.key).startsWith(prefix)) out.push(c.value); c.continue(); }; req.onerror = () => resolve(out); } catch (e) { resolve([]); } });
  }
  async function wipe(store) { const prefix = S.cfg.namespace + '|'; if (!S.db) { for (const k of [...S.mem[store].keys()]) if (k.startsWith(prefix)) S.mem[store].delete(k); return; } await new Promise((resolve) => { try { const t = S.db.transaction(store, 'readwrite'); const req = t.objectStore(store).openCursor(); req.onsuccess = () => { const c = req.result; if (!c) return; if (String(c.key).startsWith(prefix)) c.delete(); c.continue(); }; t.oncomplete = t.onerror = () => resolve(); } catch (e) { resolve(); } }); }

  /* ── Reglas ── */
  const matches = (rule, path) => (rule instanceof RegExp ? rule.test(path) : typeof rule === 'string' && (path === rule || path.startsWith(rule + '?') || path.startsWith(rule + '/')));
  const sameOrigin = (url) => { try { return new URL(url, location.href).origin === location.origin; } catch (e) { return false; } };
  const pathOf = (url) => { const u = new URL(url, location.href); return u.pathname + u.search; };
  const uid = () => 'q_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
  const isNetworkError = (error) => error instanceof TypeError || (error && error.name === 'TypeError');

  async function refresh(patch) {
    const items = await all('outbox');
    const next = Object.assign({}, S.state, patch || {}, { pending: items.filter((i) => i.state === 'queued').length, review: items.filter((i) => i.state === 'review').length });
    const changed = JSON.stringify(next) !== JSON.stringify(S.state); S.state = next; S.online = next.online;
    if (changed && S.cfg && typeof S.cfg.onChange === 'function') { try { S.cfg.onChange(Object.assign({}, next)); } catch (e) { } }
    if (changed) { try { window.dispatchEvent(new CustomEvent('janus-offline', { detail: Object.assign({}, next) })); } catch (e) { } }
  }

  async function handleRead(input, init, path) {
    try {
      const res = await S.nativeFetch(input, init);
      if (res.ok) {
        try { const text = await res.clone().text(); if (text.length <= S.cfg.maxCacheChars) { const savedAt = new Date().toISOString(); await put('cache', path, { path, body: text, type: res.headers.get('content-type') || 'application/json', savedAt }); await refresh({ online: true, lastSavedAt: savedAt }); } } catch (e) { }
        if (!S.online) await refresh({ online: true });
        void drain();
      }
      return res;
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      const hit = await get('cache', path);
      await refresh({ online: false });
      if (!hit || Date.now() - Date.parse(hit.savedAt) > S.cfg.maxAgeMs) throw error;
      return new Response(hit.body, { status: 200, headers: { 'content-type': hit.type, 'x-janus-offline': 'cache', 'x-janus-saved-at': hit.savedAt } });
    }
  }

  async function handleWrite(input, init, path, rule) {
    const bodyText = init && typeof init.body === 'string' ? init.body : '';
    try {
      const res = await S.nativeFetch(input, init);
      if (!S.online) { await refresh({ online: true }); void drain(); }
      return res;
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      await refresh({ online: false });
      // Solo se encolan cuerpos de texto (JSON). Un archivo o formulario binario no se guarda: la pantalla recibe el error real.
      if (init && init.body != null && typeof init.body !== 'string') throw error;
      if (bodyText.length > S.cfg.maxBodyChars) throw error;
      const items = await all('outbox');
      if (items.filter((i) => i.state !== 'sent').length >= S.cfg.maxItems) throw error;
      let parsed = null; try { parsed = bodyText ? JSON.parse(bodyText) : null; } catch (e) { }
      let summary = ''; try { summary = typeof rule.summary === 'function' ? String(rule.summary(parsed) || '') : String(rule.summary || ''); } catch (e) { }
      const id = uid();
      const item = { id, kind: String(rule.kind || 'change'), summary: (summary || rule.kind || 'Cambio').slice(0, 200), path, method: String((init && init.method) || 'POST').toUpperCase(), body: bodyText, contentType: 'application/json', sensitive: !!rule.sensitive, state: 'queued', createdAt: new Date().toISOString(), attempts: 0, lastError: null };
      await put('outbox', id, item); await refresh({});
      return new Response(JSON.stringify({ ok: true, queued: true, offlineId: id }), { status: 202, headers: { 'content-type': 'application/json', 'x-janus-offline': 'queued' } });
    }
  }

  /** Envía lo pendiente, en orden. Se detiene en cuanto la red vuelve a fallar. */
  async function drain() {
    if (S.draining || !S.cfg) return; S.draining = true;
    try {
      let items = (await all('outbox')).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
      // Revalidación: lo delicado y lo viejo no salen solos.
      for (const item of items) if (item.state === 'queued' && !item.confirmed && (item.sensitive || Date.now() - Date.parse(item.createdAt) > S.cfg.reviewAfterMs)) { item.state = 'review'; item.lastError = item.sensitive ? 'requiere confirmación' : 'lleva demasiado tiempo en espera'; await put('outbox', item.id, item); }
      for (const item of items.filter((i) => i.state === 'queued')) {
        let res;
        try { res = await S.nativeFetch(item.path, { method: item.method, headers: Object.assign({ 'content-type': item.contentType }, S.cfg.headers ? S.cfg.headers() : {}, { 'Idempotency-Key': item.id }), body: item.body || undefined, cache: 'no-store' }); }
        catch (error) { await refresh({ online: false }); break; }
        if (res.ok || res.status === 409) { await del('outbox', item.id); }
        else if (res.status === 401 || res.status === 403) { break; } // sin sesión válida: se reintenta cuando la haya
        else if (res.status >= 500 || res.status === 429) { item.attempts += 1; if (item.attempts >= 6) { item.state = 'review'; item.lastError = 'el servidor no lo acepta (' + res.status + ')'; } await put('outbox', item.id, item); if (item.state === 'queued') break; }
        else { let message = ''; try { message = (await res.json()).error || ''; } catch (e) { } item.state = 'review'; item.lastError = ('rechazado: ' + (message || res.status)).slice(0, 200); await put('outbox', item.id, item); }
      }
      await refresh({});
    } finally { S.draining = false; }
  }

  async function fetchWrapper(input, init) {
    const cfg = S.cfg; const url = typeof input === 'string' ? input : input && input.url;
    if (!cfg || !url || !sameOrigin(url)) return S.nativeFetch(input, init);
    const method = String((init && init.method) || (typeof input !== 'string' && input.method) || 'GET').toUpperCase();
    const path = pathOf(url);
    if (method === 'GET' && cfg.read.some((rule) => matches(rule, path))) return handleRead(input, init, path);
    if (method !== 'GET') { const rule = cfg.write.find((r) => (r.method || 'POST').toUpperCase() === method && matches(r.match, path)); if (rule) return handleWrite(input, init, path, rule); }
    return S.nativeFetch(input, init);
  }

  async function install(config) {
    if (!config || !config.namespace) throw new Error('JanusOffline: namespace is required');
    S.cfg = Object.assign({}, DEFAULTS, { read: [], write: [] }, config);
    if (!S.nativeFetch) { S.nativeFetch = window.fetch.bind(window); window.fetch = fetchWrapper; }
    if (!S.db) S.db = await openDb();
    window.addEventListener('online', () => { void drain(); });
    window.addEventListener('offline', () => { void refresh({ online: false }); });
    if (S.timer) clearInterval(S.timer);
    S.timer = setInterval(() => { if (S.state.pending) void drain(); }, 30000);
    await refresh({ online: navigator.onLine !== false });
    void drain();
    return api;
  }
  async function pending() { return (await all('outbox')).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((i) => ({ id: i.id, kind: i.kind, summary: i.summary, state: i.state, createdAt: i.createdAt, lastError: i.lastError, sensitive: i.sensitive })); }
  async function decide(id, decision) {
    const item = await get('outbox', id); if (!item || item.state !== 'review') return false;
    if (decision === 'discard') await del('outbox', id);
    else if (decision === 'send') { item.state = 'queued'; item.confirmed = true; item.attempts = 0; item.lastError = null; await put('outbox', id, item); }
    else return false;
    await refresh({}); if (decision === 'send') void drain(); return true;
  }
  async function clear() { if (!S.cfg) return; await wipe('cache'); await wipe('outbox'); await refresh({ lastSavedAt: null }); }
  const api = { install, drain, pending, decide, clear, state: () => Object.assign({}, S.state), storage: () => (S.db ? 'indexeddb' : 'memory'), version: '1.0.0' };
  window.JanusOffline = api;
})();
