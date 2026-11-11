import { authHeaders, sessionToken } from './founder-session.js';

/**
 * «Mi equipo» en la dashboard del CEO (A/B): una tarjeta con una lucecita por colaborador.
 * Tablet/escritorio: tarjeta compacta en la cabecera (la rejilla aprobada va completa, no se toca).
 * Teléfono: tarjeta a ancho completo en la columna, bajo los accesos rápidos.
 * Al tocarla se hunde y abre «¿Cómo va el equipo?» (/work/team).
 *
 * Luces (servidor: packages/core/src/work-presence.ts):
 *   working verde · unconfirmed verde hueco · paused ámbar · online azul · offline gris
 */
const PRESENCE_PATH = '/api/work/team/presence';
const REFRESH_MS = 15_000;
export const PRESENCE_STATES = Object.freeze(['working', 'unconfirmed', 'paused', 'online', 'offline']);
const ORDER = { working: 0, unconfirmed: 1, paused: 2, online: 3, offline: 4 };

export function normalizePresence(data) {
  const members = (Array.isArray(data?.members) ? data.members : [])
    .map((m) => ({
      id: String(m?.principalId ?? ''),
      name: String(m?.displayName ?? m?.principalId ?? '').trim() || '—',
      state: PRESENCE_STATES.includes(m?.state) ? m.state : 'offline',
      seen: Number.isFinite(m?.seenSecondsAgo) ? m.seenSecondsAgo : null,
      since: typeof m?.sessionSince === 'string' ? m.sessionSince : null,
    }))
    .sort((a, b) => ORDER[a.state] - ORDER[b.state] || a.name.localeCompare(b.name));
  const blocked = Math.max(0, Number(data?.attention?.blocked) || 0);
  const unread = Math.max(0, Number(data?.attention?.unread) || 0);
  return {
    members,
    working: members.filter((m) => m.state === 'working').length,
    online: members.filter((m) => m.state !== 'offline').length,
    attention: blocked + unread,
  };
}

export function initialOf(name) {
  const letter = String(name || '').trim().match(/\p{L}|\p{N}/u);
  return letter ? letter[0].toUpperCase() : '·';
}

export function teamHref(back) {
  const allowed = ['/dashboard/a', '/dashboard/b', '/'];
  return '/work/team?back=' + encodeURIComponent(allowed.includes(back) ? back : '/dashboard/a');
}

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };

function lamp(member) {
  const l = el('span', 'jtp-lamp is-' + member.state, initialOf(member.name));
  l.setAttribute('aria-hidden', 'true');
  return l;
}

export function mountTeamPanel({ back, labels }) {
  const href = teamHref(back);
  const compact = el('a', 'janus-team-panel'); compact.href = href;
  const card = el('a', 'janus-team-card'); card.href = href;
  let data = null;

  function describe(l) {
    if (!data) return l.open;
    if (!data.members.length) return `${l.title}: ${l.empty}`;
    const people = data.members.map((m) => `${m.name}: ${l.states[m.state]}`).join(', ');
    return `${l.title}: ${people}${data.attention ? '. ' + l.attention(data.attention) : ''}. ${l.open}`;
  }
  function detail(l, m) {
    if ((m.state === 'working' || m.state === 'paused' || m.state === 'unconfirmed') && m.since) {
      const t = new Date(m.since);
      if (!Number.isNaN(t.getTime())) return `${l.states[m.state]} · ${l.since(t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }))}`;
    }
    if (m.state === 'offline' && m.seen !== null) return `${l.states.offline} · ${l.seen(Math.max(1, Math.round(m.seen / 60)))}`;
    return l.states[m.state];
  }
  function badge() {
    const b = el('span', 'jtp-badge', String(data?.attention || 0));
    b.hidden = !data || !data.attention;
    return b;
  }
  function paint() {
    const l = labels();
    const text = describe(l);
    for (const a of [compact, card]) { a.setAttribute('aria-label', text); a.title = text; a.classList.toggle('is-live', Boolean(data?.working)); }

    // Compacta (cabecera): título + lucecitas.
    const lamps = el('span', 'jtp-lamps');
    if (data) {
      for (const m of data.members.slice(0, 6)) lamps.append(lamp(m));
      if (data.members.length > 6) lamps.append(el('span', 'jtp-more', '+' + (data.members.length - 6)));
      if (!data.members.length) lamps.append(el('span', 'jtp-none', '—'));
    } else lamps.append(el('span', 'jtp-go', '›'));
    lamps.append(badge());
    compact.replaceChildren(el('span', 'jtp-title', l.title), lamps);

    // Tarjeta (teléfono): una fila por persona.
    const head = el('span', 'jtp-head');
    head.append(el('span', 'jtp-title', l.title), badge(), el('span', 'jtp-go', '›'));
    const rows = el('span', 'jtp-rows');
    if (!data) rows.append(el('span', 'jtp-empty', l.open));
    else if (!data.members.length) rows.append(el('span', 'jtp-empty', l.empty));
    else for (const m of data.members) {
      const row = el('span', 'jtp-row');
      const txt = el('span', 'jtp-who');
      txt.append(el('b', '', m.name), el('small', '', detail(l, m)));
      row.append(lamp(m), txt);
      rows.append(row);
    }
    card.replaceChildren(head, rows);
  }
  async function refresh() {
    if (!sessionToken() || document.hidden) { if (!sessionToken()) { data = null; paint(); } return; }
    try {
      const response = await fetch(PRESENCE_PATH, { headers: authHeaders(), cache: 'no-store' });
      data = response.ok ? normalizePresence(await response.json()) : null; // sin permiso: solo el acceso
    } catch { data = null; }
    paint();
  }
  paint();
  void refresh();
  const timer = setInterval(refresh, REFRESH_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void refresh(); });
  addEventListener('pagehide', () => clearInterval(timer));
  return { compact, card, repaint: paint, refresh };
}
