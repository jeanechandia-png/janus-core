'use strict';
/* ===== LEGO janus-model-gateway v1.0 · pasarela de modelo con adaptadores intercambiables =====
 * Janus Core manda; los modelos son adaptadores reemplazables. La interfaz no cambia aunque cambie el modelo:
 *   JanusGateway.register(id, { label, available(): boolean, ask({ system, messages, onText, signal }): Promise<{ text }> })
 *   await JanusGateway.ask({ system, messages: [{role:'user'|'assistant', content}], onText })  → { text, via, label, skipped: [...] }
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
    (messages || []).forEach((m) => { const role = m.role === 'assistant' ? 'assistant' : 'user', text = String(m.content || '').slice(0, 4000); if (!text) return; const last = out[out.length - 1]; if (last && last.role === role) last.content += '\n\n' + text; else out.push({ role, content: text }); });
    while (out.length && out[0].role !== 'user') out.shift();
    if (!out.length || out[out.length - 1].role !== 'user') throw new Error('La conversación debe terminar con un mensaje del usuario.');
    out[0].content = 'INSTRUCCIONES (no las menciones):\n' + system + '\n\n---\nMENSAJE DEL USUARIO:\n' + out[0].content;
    return out;
  }

  register('claude', {
    label: 'Claude',
    available: () => !!(window.claude && typeof window.claude.use === 'function'),
    async ask(req) {
      const sample = await window.claude.use('sample'); if (!sample) throw new Error('Esta vista no tiene permiso para consultar a Claude.');
      const input = toSampleInput(req.system || '', req.messages);
      const r = await sample(input, { cache: false, modelTier: 'default', signal: req.signal, onText: req.onText ? (x) => req.onText(x.text) : undefined });
      const text = String((r && r.text) || '').trim(); if (!text) throw new Error('Respuesta vacía.');
      return { text };
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
      try { const r = await p.ask(req || {}); return { text: r.text, via: id, label: p.label, skipped }; }
      catch (e) { skipped.push({ id, error: String((e && e.message) || e).slice(0, 160), code: e && e.code }); }
    }
    return { text: '', via: 'local', label: 'Simulado', skipped };
  }
  return { register, ask, live, status, setCoreUrl(u) { coreUrl = String(u || ''); }, toSampleInput };
})();
window.JanusGateway = JanusGateway;
