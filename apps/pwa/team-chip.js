import { authHeaders, sessionToken } from './founder-session.js';

/**
 * Acceso simplificado «Equipo» en la cabecera de la dashboard del CEO (A/B).
 * Solo es un enlace con un resumen de dos cifras; la vista completa vive en /work/team («¿Cómo va el equipo?»).
 * No reemplaza ni redibuja nada de la dashboard: se añade en la cabecera existente, junto a los accesos.
 *
 * Cifras (solo asuntos de empresa, las mismas que la vista de equipo):
 *   working   = personas con una sesión de trabajo en marcha
 *   attention = tareas bloqueadas + mensajes nuevos sin leer
 */
const SUMMARY_PATH = '/api/work/team';
const REFRESH_MS = 60_000;

export function summarizeTeam(data) {
  const members = Array.isArray(data?.members) ? data.members : [];
  const assignments = Array.isArray(data?.assignments) ? data.assignments : [];
  const messages = Array.isArray(data?.messages) ? data.messages : [];
  const working = members.filter((m) => m?.openSession?.state === 'running').length;
  const blocked = assignments.filter((x) => x?.assignment?.status === 'blocked').length;
  const unread = messages.filter((m) => m?.status === 'delivered' && !m?.readAt).length;
  return { working, attention: blocked + unread, blocked, unread };
}

export function teamHref(back) {
  const allowed = ['/dashboard/a', '/dashboard/b', '/'];
  return '/work/team?back=' + encodeURIComponent(allowed.includes(back) ? back : '/dashboard/a');
}

export function mountTeamChip({ back, labels }) {
  const chip = document.createElement('a');
  chip.className = 'janus-team-chip';
  chip.href = teamHref(back);
  const icon = document.createElement('span');
  icon.className = 'jtc-icon'; icon.setAttribute('aria-hidden', 'true'); icon.textContent = '◉';
  const text = document.createElement('span');
  text.className = 'jtc-text';
  const badge = document.createElement('span');
  badge.className = 'jtc-badge'; badge.hidden = true;
  chip.append(icon, text, badge);
  let last = null;

  function paint() {
    const l = labels();
    text.textContent = l.team;
    chip.title = l.open;
    if (!last) { chip.setAttribute('aria-label', l.open); badge.hidden = true; chip.classList.remove('is-attention', 'is-live'); return; }
    badge.hidden = last.attention === 0;
    badge.textContent = String(last.attention);
    chip.classList.toggle('is-attention', last.attention > 0);
    chip.classList.toggle('is-live', last.working > 0);
    chip.setAttribute('aria-label', `${l.open}: ${l.working(last.working)}${last.attention ? ', ' + l.attention(last.attention) : ''}`);
  }
  async function refresh() {
    if (!sessionToken() || document.hidden) return;
    try {
      const response = await fetch(SUMMARY_PATH, { headers: authHeaders(), cache: 'no-store' });
      if (!response.ok) { last = null; paint(); return; } // sin permiso o sin sesión: solo el enlace, sin cifras
      last = summarizeTeam(await response.json());
    } catch { last = null; }
    paint();
  }
  paint();
  void refresh();
  const timer = setInterval(refresh, REFRESH_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void refresh(); });
  addEventListener('pagehide', () => clearInterval(timer));
  return { element: chip, repaint: paint, refresh };
}
