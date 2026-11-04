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
  let coreUrl = '';
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
  register('core', {
    label: 'Núcleo Janus',
    available: () => !!coreUrl,
    async ask() { throw new Error('Adaptador del núcleo pendiente: necesita el servidor de Janus y la sesión del Fundador (no verificado).'); }
  });
  register('local', { label: 'Simulado', available: () => true, async ask() { return { text: '' }; } });

  async function ask(req) {
    const skipped = [];
    for (const id of order) {
      const p = providers[id]; if (!p || !p.available()) continue;
      if (id === 'local') return { text: '', via: 'local', label: p.label, skipped };
      try { const r = await p.ask(req || {}); return { text: r.text, via: id, label: p.label, skipped, imagesSent: r.imagesSent || 0 }; }
      catch (e) { skipped.push({ id, error: String((e && e.message) || e).slice(0, 160), code: e && e.code }); }
    }
    return { text: '', via: 'local', label: 'Simulado', skipped };
  }
  /** Límites de imagen del primer adaptador real que los ofrece (en el orden core → claude); null si ninguno. */
  async function imageLimits() { for (const id of order) { const p = providers[id]; if (id !== 'local' && p && p.available() && typeof p.imageLimits === 'function') { const l = await p.imageLimits(); if (l) return l; } } return null; }
  return { register, ask, live, status, imageLimits, setCoreUrl(u) { coreUrl = String(u || ''); }, toSampleInput };
})();
window.JanusGateway = JanusGateway;
