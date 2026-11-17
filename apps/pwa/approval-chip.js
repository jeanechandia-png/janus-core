import { authHeaders, sessionToken } from './founder-session.js';

/**
 * «Aprobar» en la cabecera de la dashboard del CEO: aparece SOLO cuando hay acciones esperando su decisión.
 * Al tocarlo se despliega la lista con Aprobar / Denegar. Usa la cola de aprobaciones existente
 * (GET /api/approvals, POST /api/approvals/:id/decision): la misma que el panel «Aprobaciones» de la app.
 * Una decisión por solicitud; lo que caduca sin respuesta no se ejecuta.
 */
const REFRESH_MS = 15_000;
const RISK = { low: 'bajo', medium: 'medio', high: 'alto', critical: 'crítico' };
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };

export function describeApproval(item, nowMs = Date.now()) {
  const minutes = Math.max(0, Math.round((Date.parse(item.expiresAt) - nowMs) / 60000));
  return [item.operation ? String(item.operation) : null, item.target ? `en ${item.target}` : null, item.reason || null, `riesgo ${RISK[item.risk] ?? item.risk ?? '—'}`, item.reversible === false ? 'irreversible' : null, `caduca en ${minutes} min`].filter(Boolean).join(' · ');
}

export function mountApprovalChip() {
  const root = el('details', 'janus-approvals');
  root.hidden = true;
  const summary = el('summary', 'janus-approvals-chip');
  const count = el('b', 'jap-count', '0');
  summary.append(el('span', 'jap-icon', '!'), el('span', 'jap-text', 'Aprobar'), count);
  const panel = el('div', 'janus-approvals-panel');
  root.append(summary, panel);
  let pending = [];
  let error = '';

  function paint() {
    root.hidden = pending.length === 0 && !error;
    if (root.hidden) root.open = false;
    count.textContent = String(pending.length);
    summary.setAttribute('aria-label', pending.length === 1 ? '1 acción espera tu aprobación' : `${pending.length} acciones esperan tu aprobación`);
    const rows = pending.map((item) => {
      const row = el('div', 'jap-row' + (item.risk === 'critical' ? ' is-critical' : ''));
      const actions = el('div', 'jap-actions');
      for (const [label, approved, cls] of [['Aprobar', true, 'jap-yes'], ['Denegar', false, 'jap-no']]) {
        const button = el('button', cls, label);
        button.type = 'button';
        button.addEventListener('click', () => { void decide(item.id, approved, actions); });
        actions.append(button);
      }
      row.append(el('strong', '', item.label || item.operation || 'Acción'), el('small', '', describeApproval(item)), actions);
      return row;
    });
    panel.replaceChildren(el('div', 'jap-title', 'Esperan tu decisión'), ...rows, ...(error ? [el('div', 'jap-error', error)] : []));
  }
  async function decide(id, approved, actions) {
    for (const button of actions.querySelectorAll('button')) button.disabled = true;
    try {
      const response = await fetch(`/api/approvals/${encodeURIComponent(id)}/decision`, { method: 'POST', headers: { ...authHeaders(), 'content-type': 'application/json' }, body: JSON.stringify({ approved }) });
      // 409 = ya se decidió (en otro dispositivo) o caducó: se refresca la lista, no es un fallo.
      error = response.ok || response.status === 409 ? '' : `No se pudo registrar la decisión (${response.status}).`;
    } catch { error = 'Sin conexión con JANUS: la decisión no se registró.'; }
    await refresh();
  }
  async function refresh() {
    if (!sessionToken()) { pending = []; error = ''; paint(); return; }
    if (document.hidden) return;
    try {
      const response = await fetch('/api/approvals', { headers: authHeaders(), cache: 'no-store' });
      if (response.ok) pending = (await response.json()).pending ?? []; else pending = [];
    } catch { /* se reintenta en el siguiente ciclo */ }
    paint();
  }
  paint();
  void refresh();
  const timer = setInterval(refresh, REFRESH_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void refresh(); });
  addEventListener('pagehide', () => clearInterval(timer));
  return { element: root, refresh };
}
