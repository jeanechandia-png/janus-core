'use strict';
/* ===== LEGO janus-model-gateway v1.0 · pasarela de modelo con adaptadores intercambiables =====
 * Janus Core manda; los modelos son adaptadores reemplazables. La interfaz no cambia aunque cambie el modelo:
 *   JanusGateway.register(id, { label, available(): boolean, ask({ system, messages, onText, signal }): Promise<{ text }> })
 *   await JanusGateway.ask({ system, messages: [{role:'user'|'assistant', content}], onText, images?: Blob[] })  → { text, via, label, skipped: [...], imagesSent }
 *   await JanusGateway.imageLimits()  → { maxCount, maxInputBytes, mediaTypes } | null   (null = ningún adaptador disponible acepta imágenes ahora)
 *   JanusGateway.live()  true si hay al menos un adaptador real disponible (no el simulado)
 *   JanusGateway.status() → [{ id, label, available }]
 * Adaptadores incluidos:
 *   claude  · Claude mediante la capacidad `sample` de un Artifact publicado (sin claves en la página; pide permiso al primer uso).
 *   core    · Núcleo Janus real (apps/runtime, POST /api/command con sesión del Fundador). PENDIENTE: se activa con setCoreUrl(url) cuando exista el servidor
 *             y la sesión; hoy no está verificado, así que no se usa.
 *   local   · respuesta simulada del host (siempre disponible; el host decide qué mostrar).
 * El orden por defecto es core → claude → local. Si un adaptador falla, se pasa al siguiente y se anota en `skipped`.
 */
const JanusGateway = (() => {
  const providers = {}, order = ['core', 'claude', 'local'];
  // La conexión Core solo puede usar el MISMO ORIGEN que sirve la dashboard.
  // Así jamás enviamos el bearer de la sesión del Founder a terceros.
  let coreUrl = '', coreReady = false, coreIssue = '';
  const coreConnected = () => coreReady;
  const credentials = () => {
    try {
      const token = window.sessionStorage.getItem('janus.founder.session');
      return token ? { authorization: 'Bearer ' + token } : {};
    } catch (_) { return {}; }
  };
  async function probeCore() {
    coreReady = false;
    try {
      if (!/^https?:$/.test(window.location.protocol)) return false;
      const base = new URL(window.location.origin);
      if (coreUrl && coreUrl !== base.origin) return false;
      const response = await window.fetch(base.origin + '/health', { cache: 'no-store', credentials: 'omit' });
      const health = await response.json();
      if (!response.ok || !health || health.ok !== true || health.service !== 'janus-runtime') {
        coreIssue = 'El servicio del origen no es JANUS CORE';
        return false;
      }
      coreUrl = base.origin; coreReady = true; coreIssue = '';
      return true;
    } catch (error) {
      coreIssue = String((error && error.message) || error).slice(0, 160);
      return false;
    }
  }
  function setCoreUrl(url) {
    const origin = window.location && window.location.origin;
    const raw = String(url || '').trim();
    if (!raw) { coreUrl = ''; coreReady = false; return; }
    const target = new URL(raw, window.location.href);
    if (!/^https?:$/.test(target.protocol) || target.origin !== origin || target.pathname !== '/') {
      throw new Error('Por seguridad, JANUS CORE debe servirse desde el mismo origen HTTPS/local de esta dashboard.');
    }
    coreUrl = origin; coreReady = false;
    void probeCore();
  }

  // No se transmiten system prompts ni historiales fuera de la política JANUS CORE;
  // el núcleo es autoridad, los modelos remotos son solo adaptadores suyos.
  async function askCore(req) {
    const user = [...(req.messages || [])].reverse().find(m => m.role === 'user' && typeof m.content === 'string' && m.content.trim());
    if (!user) throw new Error('Falta el mensaje del usuario.');
    const signal = req.signal;
    if (!credentials().authorization) throw new Error('Primero toca «Identificarme» y entra como Founder.');
    const start = await fetch(coreUrl + '/api/command', {
      method: 'POST', signal,
      headers: { 'content-type': 'application/json', ...credentials() },
      body: JSON.stringify({ text: user.content.slice(0, 30000), inputMode: req.inputMode === 'voice' ? 'voice' : 'text' }),
    });
    const result = await start.json().catch(() => ({}));
    if (!start.ok || !result.runId) {
      if (start.status === 401 || start.status === 403)
        throw new Error('JANUS CORE requiere sesión autorizada del Founder. Inicia sesión en la PWA desde este mismo origen.');
      throw new Error('JANUS CORE: ' + String(result.error || ('HTTP ' + start.status)).slice(0, 220));
    }
    const runId = String(result.runId);
    const events = [];
    let lastPreview = '';
    let terminal = null;
    // EventSource no acepta headers; el endpoint de eventos solo lee estados,
    // todas las mutaciones siguen protegidas por el Core.
    return await new Promise((resolve, reject) => {
      let completed = false, stream = null, poll = null, timeout = null;
      const stop = () => {
        if (stream) stream.close();
        if (poll) clearInterval(poll);
        if (timeout) clearTimeout(timeout);
        if (signal) signal.removeEventListener('abort', abort);
      };
      const fail = (message) => { if (completed) return; completed = true; stop(); reject(new Error(message)); };
      const done = (text, state = 'completed') => {
        if (completed) return; completed = true; stop();
        resolve({
          text: text || (state === 'completed'
            ? 'JANUS CORE finalizó la ejecución ' + runId + '. Revisa el historial verificable de esta tarea.'
            : 'JANUS CORE requiere atención para la ejecución ' + runId + '.'),
          runId, coreStatus: state, imagesSent: 0,
        });
      };
      const abort = () => fail('La visualización fue interrumpida. Verifica el estado del proceso ' + runId + ' en JANUS CORE.');
      if (signal && signal.aborted) { abort(); return; }
      if (signal) signal.addEventListener('abort', abort, { once: true });
      const finish = (event, state) => {
        const reason = String(lastPreview || (event && (event.summary || event.payload?.preview || event.payload?.error)) || '').trim();
        if (state === 'completed') done(reason && !/^objetivo completado|^tarea completada/i.test(reason)
          ? reason : 'JANUS CORE terminó el proceso ' + runId + '. Consulta su resultado y registro de decisiones.', state);
        else done('JANUS CORE ' + (state === 'blocked' ? 'bloqueó o pidió aprobación para' : 'falló en') + ' la tarea ' + runId + '. ' + reason, state);
      };
      const consume = (event) => {
        if (!event || (event.runId && event.runId !== runId) || completed) return;
        const payload = event.payload || {};
        const proposalId = payload.tool === 'knowledge' && (payload.proposalId || payload.result?.output?.proposalId);
        if (proposalId) window.dispatchEvent(new CustomEvent('janus:knowledge-proposal', { detail: { proposalId } }));
        const summary = String(event.payload?.preview || event.summary || '').slice(0, 1200);
        if (summary && summary !== lastPreview) {
          lastPreview = summary;
          events.push({ type: event.type, summary });
          if (events.length > 50) events.shift();
          if (typeof req.onText === 'function') req.onText(summary);
        }
        if (event.type === 'run.completed') finish(event, 'completed');
        else if (event.type === 'run.blocked') finish(event, 'blocked');
        else if (event.type === 'run.failed') finish(event, 'failed');
        else if (event.type === 'run.cancelled') finish(event, 'cancelled');
      };
      try {
        stream = new EventSource(coreUrl + '/api/events?runId=' + encodeURIComponent(runId));
        stream.onmessage = (message) => { try { consume(JSON.parse(message.data)); } catch (_) {} };
      } catch (_) { /* polling continues when streaming is unavailable */ }
      const inspect = async () => {
        try {
          const response = await fetch(coreUrl + '/api/runs/' + encodeURIComponent(runId), {
            headers: credentials(), cache: 'no-store',
          });
          if (!response.ok || completed) return;
          const data = await response.json();
          const snap = data.snapshot || {};
          const state = String(snap.status || snap.state || '').toLowerCase();
          if (state === 'completed' || state === 'blocked' || state === 'failed' || state === 'cancelled') {
            const text = String(snap.result?.summary || snap.result?.text || snap.outputSummary || lastPreview || '').slice(0, 1600);
            finish({ summary: text }, state);
          }
        } catch (_) { /* SSE may still be alive */ }
      };
      poll = setInterval(inspect, 2500);
      void inspect();
      timeout = setTimeout(() => done('JANUS CORE inició la tarea ' + runId + ' y continúa ejecutándola. Comprueba su resultado antes de considerarla completada.', 'running'), 90000);
    });
  }
  const register = (id, p) => { providers[id] = p; if (!order.includes(id)) order.splice(order.length - 1, 0, id); };
  const status = () => order.filter((id) => providers[id]).map((id) => ({ id, label: providers[id].label, available: !!providers[id].available() }));
  const live = () => order.some((id) => id !== 'local' && providers[id] && providers[id].available());

  /** Alterna roles (user/assistant), empieza y termina en user, y mete las instrucciones en el primer turno: `sample` no tiene memoria. */
  function toSampleInput(system, messages) {
    const out = [];
    (messages || []).forEach((m) => { const role = m.role === 'assistant' ? 'assistant' : 'user', text = String(m.content || '').slice(0, 30000); if (!text) return; const last = out[out.length - 1]; if (last && last.role === role) last.content += '\n\n' + text; else out.push({ role, content: text }); });
    while (out.length && out[0].role !== 'user') out.shift();
    if (!out.length || out[out.length - 1].role !== 'user') throw new Error('La conversación debe terminar con un mensaje del usuario.');
    out[0].content = 'INSTRUCCIONES (no las menciones):\n' + system + '\n\n---\nMENSAJE DEL USUARIO:\n' + out[0].content;
    return out;
  }

  /** Límites de imagen que ofrece esta vista; null si no hay (sin `images:true` declarado, vista sin soporte o error). */
  async function claudeImageLimits() {
    try { const sample = window.claude && await window.claude.use('sample'); if (!sample || typeof sample.limits !== 'function') return null; const l = await sample.limits(); return l && l.images && l.images.maxCount > 0 ? l.images : null; } catch (e) { return null; }
  }
  register('claude', {
    label: 'Claude',
    available: () => !!(window.claude && typeof window.claude.use === 'function'),
    imageLimits: claudeImageLimits,
    async ask(req) {
      const sample = await window.claude.use('sample'); if (!sample) throw new Error('Esta vista no tiene permiso para consultar a Claude.');
      const input = toSampleInput(req.system || '', req.messages);
      const base = { cache: false, modelTier: 'default', signal: req.signal, onText: req.onText ? (x) => req.onText(x.text) : undefined };
      let imgs = [];
      if (req.images && req.images.length) {
        const L = await claudeImageLimits();
        if (L) imgs = req.images.filter((b) => !L.mediaTypes || !L.mediaTypes.length || L.mediaTypes.indexOf(b.type) >= 0).filter((b) => !L.maxInputBytes || b.size <= L.maxInputBytes).slice(0, L.maxCount);
      }
      let r, sent = 0;
      try { r = await sample(input, imgs.length ? Object.assign({ images: imgs }, base) : base); sent = imgs.length; }
      catch (e) {
        // si solo falla por las imágenes, se reintenta sin ellas y se AVISA al modelo para que no finja verlas
        if (imgs.length && e && (e.code === 'image_rejected' || e.code === 'images_unavailable')) {
          const last = input[input.length - 1]; last.content += '\n\n[AVISO DEL SISTEMA: las imágenes NO llegaron a ti (' + e.code + '). No las ves: dilo claramente a Jean y no describas su contenido.]';
          r = await sample(input, base); sent = 0;
        } else throw e;
      }
      const text = String((r && r.text) || '').trim(); if (!text) throw new Error('Respuesta vacía.');
      return { text, imagesSent: sent };
    }
  });
  register('core', { label: 'JANUS CORE', available: coreConnected, ask: askCore });
  register('local', { label: 'Simulado', available: () => true, async ask() { return { text: '' }; } });

  async function ask(req) {
    const skipped = [];
    // A Core-served page never falls back to a remote Artifact while health is pending/offline.
    if (window.document?.querySelector('meta[name="janus-runtime"]') && !coreReady) {
      if (!await probeCore()) return { text: 'JANUS CORE no está disponible. Revisa la conexión con tu servidor.', via: 'core-error', label: 'JANUS CORE', skipped, imagesSent: 0 };
    }
    for (const id of order) {
      const p = providers[id]; if (!p || !p.available()) continue;
      if (id === 'local') return { text: '', via: 'local', label: p.label, skipped };
      try { const r = await p.ask(req || {}); return { text: r.text, via: id, label: p.label, skipped, imagesSent: r.imagesSent || 0 }; }
      catch (e) {
        const message = String((e && e.message) || e).slice(0, 240);
        skipped.push({ id, error: message, code: e && e.code });
        // Fallo cerrado: si el Core autentificado está disponible no desviamos
        // contenido de trabajo privado hacia Claude u otro proveedor por accidente.
        if (id === 'core') return { text: message, via: 'core-error', label: 'JANUS CORE · acceso pendiente', skipped, imagesSent: 0 };
      }
    }
    return { text: '', via: 'local', label: 'Simulado', skipped };
  }
  /** Límites de imagen del primer adaptador real que los ofrece (en el orden core → claude); null si ninguno. */
  async function imageLimits() { for (const id of order) { const p = providers[id]; if (id !== 'local' && p && p.available() && typeof p.imageLimits === 'function') { const l = await p.imageLimits(); if (l) return l; } } return null; }
  // Detecta automáticamente JANUS CORE al servir la dashboard desde su mismo origen.
  // En un Artifact externo o file:// el core NO se anuncia como conectado.
  if (/^https?:$/.test(window.location.protocol)) {
    setTimeout(() => { void probeCore(); }, 0);
    window.addEventListener('online', () => { void probeCore(); });
  }
  return { register, ask, live, status, imageLimits, setCoreUrl, probeCore, coreConnected, coreIssue: () => coreIssue, toSampleInput };
})();
window.JanusGateway = JanusGateway;
