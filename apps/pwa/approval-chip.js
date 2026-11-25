import { currentLanguage } from './language-buttons.js';
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

export function describeApproval(item, nowMs = Date.now(), language='es') {
  const nl=language==='nl';
  const risk=nl?{low:'laag',medium:'gemiddeld',high:'hoog',critical:'kritiek'}:RISK;
  const minutes = Math.max(0, Math.round((Date.parse(item.expiresAt) - nowMs) / 60000));
  return [item.operation ? String(item.operation) : null, item.target ? `${nl?'bij':'en'} ${item.target}` : null, item.reason || null, `${nl?'risico':'riesgo'} ${risk[item.risk] ?? item.risk ?? '—'}`, item.reversible === false ? (nl?'onomkeerbaar':'irreversible') : null, `${nl?'verloopt over':'caduca en'} ${minutes} min`].filter(Boolean).join(' · ');
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
  let error = '', verified = false, forced = false, refreshId = 0;

  const tr = value => currentLanguage('founder')==='nl' ? ({"Aprobar":"Goedkeuren","Denegar":"Weigeren","Acción":"Actie","Esperan tu decisión":"Wachten op jouw beslissing","No hay aprobaciones pendientes.":"Geen openstaande goedkeuringen.","Identificarme":"Inloggen","Aprobaciones sin comprobar":"Goedkeuringen niet gecontroleerd","Identifícate para comprobar las aprobaciones.":"Log in om goedkeuringen te controleren.","No pude comprobar la cola de aprobaciones.":"De wachtrij kon niet worden gecontroleerd.","Sin conexión con JANUS: la decisión no se registró.":"Geen verbinding met JANUS: de beslissing is niet opgeslagen."})[value] ?? value : value;
  function paint() {
    const nl=currentLanguage('founder')==='nl';
    summary.querySelector('.jap-text').textContent=tr('Aprobar');
    root.hidden = pending.length === 0 && !error && !forced;
    if (root.hidden) root.open = false;
    count.textContent = verified ? String(pending.length) : '—';
    summary.setAttribute('aria-label', verified ? (nl ? `${pending.length} ${pending.length===1?'actie wacht':'acties wachten'} op jouw goedkeuring` : pending.length === 1 ? '1 acción espera tu aprobación' : `${pending.length} acciones esperan tu aprobación`) : tr('Aprobaciones sin comprobar'));
    const rows = pending.map((item) => {
      const row = el('div', 'jap-row' + (item.risk === 'critical' ? ' is-critical' : ''));
      const actions = el('div', 'jap-actions');
      for (const [label, approved, cls] of [['Aprobar', true, 'jap-yes'], ['Denegar', false, 'jap-no']]) {
        const button = el('button', cls, tr(label));
        button.type = 'button';
        button.addEventListener('click', () => { void decide(item.id, approved, actions); });
        actions.append(button);
      }
      row.append(el('strong', '', item.label || item.operation || tr('Acción')), el('small', '', describeApproval(item,Date.now(),currentLanguage('founder'))), actions);
      return row;
    });
    panel.replaceChildren(el('div', 'jap-title', tr('Esperan tu decisión')), ...rows,
      ...(error ? [el('div', 'jap-error', nl && /^No se pudo registrar la decisión \(\d+\)\.$/.test(error) ? error.replace('No se pudo registrar la decisión','De beslissing kon niet worden opgeslagen') : tr(error))] : []),
      ...(verified && !pending.length ? [el('p', '', tr('No hay aprobaciones pendientes.'))] : []));
    if (!sessionToken() && forced) {
      const a=el('a','',tr('Identificarme')); a.href='/?returnTo='+encodeURIComponent(location.pathname)+'#approvals'; panel.append(a);
    }
  }
  async function decide(id, approved, actions) {
    if (!sessionToken() || !verified || !pending.some(item=>item.id===id)) { await refresh(); return; }
    for (const button of actions.querySelectorAll('button')) button.disabled = true;
    try {
      const response = await fetch(`/api/approvals/${encodeURIComponent(id)}/decision`, { method: 'POST', headers: { ...authHeaders(), 'content-type': 'application/json' }, body: JSON.stringify({ approved }) });
      // 409 = ya se decidió (en otro dispositivo) o caducó: se refresca la lista, no es un fallo.
      error = response.ok || response.status === 409 ? '' : `No se pudo registrar la decisión (${response.status}).`;
    } catch { error = 'Sin conexión con JANUS: la decisión no se registró.'; }
    await refresh();
  }
  async function refresh() {
    const id=++refreshId, token=sessionToken();
    if (!token) { pending=[]; verified=false; error=forced?'Identifícate para comprobar las aprobaciones.':''; paint(); return; }
    if (document.hidden && !forced) return;
    try {
      const response = await fetch('/api/approvals', { headers: authHeaders(), cache: 'no-store' });
      const body=response.ok?await response.json():null;
      if(id!==refreshId || token!==sessionToken())return;
      verified=Boolean(response.ok && body?.ok===true && Array.isArray(body.pending));
      pending=verified?body.pending:[];
      if(!verified)error='No pude comprobar la cola de aprobaciones.';
      else if(error==='No pude comprobar la cola de aprobaciones.' || error==='Identifícate para comprobar las aprobaciones.')error='';
    } catch {
      if(id!==refreshId || token!==sessionToken())return;
      pending=[];verified=false;error='No pude comprobar la cola de aprobaciones.';
    }
    paint();
  }
  paint();
  void refresh();
  document.addEventListener('janus:language-changed', event=>{if(event.detail?.scope==='founder')paint();});
  const timer = setInterval(refresh, REFRESH_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void refresh(); });
  addEventListener('pagehide', () => clearInterval(timer));
  function open() { forced=true;root.hidden=false;root.open=true;void refresh(); }
  root.addEventListener('toggle',()=>{if(!root.open && forced){forced=false;paint();}});
  return { element: root, refresh, open };
}
