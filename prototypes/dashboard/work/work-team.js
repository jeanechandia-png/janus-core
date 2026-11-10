'use strict';
/* ===== JANUS Work · Vista de equipo del CEO (página aparte: /work/team) =====
 * NO forma parte de la dashboard personal aprobada del CEO ni la modifica: es una página propia con la piel de IBA.
 * Solo muestra asuntos de EMPRESA (GET /api/work/team). La agenda personal de cada colaborador nunca llega aquí.
 * Desde aquí el CEO decide: agente por tarea, «solo modelo propio» por proyecto y marca mensajes como leídos.
 * Globales del build: TEAM_MODE ('core' | 'example'), teamExample (modo example) y la sesión de founder-session.js.
 */
const JanusTeam = (() => {
  const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const S = { mode: typeof TEAM_MODE === 'string' ? TEAM_MODE : 'example', data: null, loading: false, notice: '', login: { id: 'founder', busy: false, error: '' }, openMsg: '', passkey: null, invite: { displayName: '', locale: 'es', busy: false, error: '', link: '', forName: '', expiresAt: '', copied: false } };
  let $root = null;
  const AGENTS = { '': 'Automático', anthropic: 'Claude', openai: 'ChatGPT', gemini: 'Gemini', perplexity: 'Perplexity', custom: 'JANUS local' };
  const STATUS = { queued: ['en cola', 'waiting'], active: ['en curso', 'in-progress'], blocked: ['bloqueada', 'blocked'], handoff_required: ['requiere traspaso', 'pending-approval'], completed: ['completada', 'completed'], cancelled: ['cancelada', 'draft'] };
  const fmtDate = (iso) => { const d = new Date(iso); return isNaN(d) ? '—' : new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d); };
  const fmtDay = (key) => { const d = new Date(key + 'T12:00:00'); return isNaN(d) ? key : new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }).format(d); };
  const fmtDur = (seconds) => { const s = Math.max(0, Math.round(seconds || 0)); return Math.floor(s / 3600) + ' h ' + String(Math.floor((s % 3600) / 60)).padStart(2, '0') + ' min'; };
  const name = (id) => { const m = S.data.members.find((x) => x.principalId === id); return m ? m.displayName : id; };
  const projectName = (id) => { const p = S.data.projects.find((x) => x.id === id); return p ? p.name : id; };

  async function api(path, init) {
    const headers = Object.assign({}, (init && init.headers) || {}, typeof authHeaders === 'function' ? authHeaders() : {});
    if (init && init.body) headers['content-type'] = 'application/json';
    const response = await fetch(path, Object.assign({ cache: 'no-store' }, init || {}, { headers }));
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(String(body.error || body.code || ('HTTP ' + response.status))); error.status = response.status; throw error; }
    return body;
  }
  async function load() {
    S.loading = true; render();
    try { S.data = S.mode === 'example' ? (S.data || teamExample(new Date().toISOString())) : await api('/api/work/team'); S.notice = ''; await loadPasskeyStatus(); }
    catch (error) { if (error.status === 401 || error.status === 403) { S.data = null; if (typeof signOut === 'function') await signOut(); S.login.error = error.status === 403 ? 'Esta página es solo para el CEO.' : ''; } else S.notice = 'No se pudo cargar el equipo: ' + error.message; }
    S.loading = false; render();
  }
  async function act(fn, local) {
    try { if (S.mode === 'example') local(); else { await fn(); await load(); return; } } catch (error) { S.notice = error.message; }
    render();
  }
  const setAgent = (id, provider) => act(() => api('/api/coordination/assignments/' + encodeURIComponent(id) + '/provider', { method: 'PUT', body: JSON.stringify({ preferredProvider: provider || null }) }),
    () => { const a = S.data.assignments.find((x) => x.assignment.id === id); if (a) { if (provider) a.assignment.preferredProvider = provider; else delete a.assignment.preferredProvider; } });
  const setLocalOnly = (id, on) => act(() => api('/api/projects/' + encodeURIComponent(id) + '/model-policy', { method: 'PUT', body: JSON.stringify({ modelPolicy: on ? 'local_only' : null }) }),
    () => { const p = S.data.projects.find((x) => x.id === id); if (p) p.localOnly = on; });
  const readMessage = (id) => { S.openMsg = S.openMsg === id ? '' : id; const m = S.data.messages.find((x) => x.id === id); if (!m || m.readAt || m.status !== 'delivered') { render(); return; }
    return act(() => api('/api/work/messages/' + encodeURIComponent(id) + '/read', { method: 'PUT' }), () => { m.readAt = new Date().toISOString(); }); };

  // Llave de acceso del navegador (Face ID de Safari): confirma SOLO «dar acceso a un colaborador». La llave privada
  // vive en el dispositivo; a JANUS llega una firma, nunca la cara ni la llave.
  const b64uToBuf = (text) => Uint8Array.from(atob(String(text).replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  const bufToB64u = (buffer) => { let out = ''; const bytes = new Uint8Array(buffer); for (let i = 0; i < bytes.length; i += 1) out += String.fromCharCode(bytes[i]); return btoa(out).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const passkeySupported = () => typeof navigator !== 'undefined' && !!navigator.credentials && typeof PublicKeyCredential !== 'undefined';
  const post = (path, body) => api(path, { method: 'POST', body: JSON.stringify(body || {}) });
  async function loadPasskeyStatus() {
    if (S.mode !== 'core') return;
    try { S.passkey = await api('/api/auth/passkey/status'); } catch (_) { S.passkey = null; }
  }
  async function passkeyEnroll() {
    const I = S.invite; I.error = ''; I.busy = true; render();
    try {
      if (!passkeySupported()) throw new Error('Este navegador no admite llaves de acceso.');
      const options = (await post('/api/auth/passkey/register/options')).options, pk = options.publicKey;
      const credential = await navigator.credentials.create({ publicKey: Object.assign({}, pk, { challenge: b64uToBuf(pk.challenge), user: Object.assign({}, pk.user, { id: b64uToBuf(pk.user.id) }), excludeCredentials: (pk.excludeCredentials || []).map((c) => ({ type: c.type, id: b64uToBuf(c.id) })) }) });
      if (!credential) throw new Error('No se creó la llave.');
      await post('/api/auth/passkey/register/verify', { challengeId: options.challengeId, clientDataJSON: bufToB64u(credential.response.clientDataJSON), attestationObject: bufToB64u(credential.response.attestationObject) });
      await loadPasskeyStatus(); S.notice = 'Face ID activado en este dispositivo para dar accesos.';
    } catch (error) { I.error = error && error.name === 'NotAllowedError' ? 'Confirmación cancelada. No se ha cambiado nada.' : String((error && error.message) || error); }
    I.busy = false; render();
  }
  async function passkeyProof(action) {
    const options = (await post('/api/auth/passkey/assert/options', { action: action })).options, pk = options.publicKey;
    const credential = await navigator.credentials.get({ publicKey: Object.assign({}, pk, { challenge: b64uToBuf(pk.challenge), allowCredentials: pk.allowCredentials.map((c) => ({ type: c.type, id: b64uToBuf(c.id) })) }) });
    if (!credential) throw new Error('Confirmación cancelada.');
    const result = await post('/api/auth/passkey/assert/verify', { challengeId: options.challengeId, credentialId: bufToB64u(credential.rawId), clientDataJSON: bufToB64u(credential.response.clientDataJSON), authenticatorData: bufToB64u(credential.response.authenticatorData), signature: bufToB64u(credential.response.signature) });
    return result.proof.proofId;
  }
  // Prueba de identidad del CEO para una acción: puente nativo de Face ID si existe; si no, la llave de acceso.
  async function founderProof(action, reason) {
    const native = globalThis.JanusFounderNative;
    if (native && typeof native.actionProof === 'function') return native.actionProof({ action: action, authoritySessionToken: (authHeaders().authorization || '').replace(/^Bearer /, ''), reason: reason });
    if (S.passkey && S.passkey.enabled && S.passkey.activePasskeys > 0 && passkeySupported()) return passkeyProof(action);
    throw new Error('Para dar accesos hace falta confirmar con Face ID y este dispositivo todavía no lo tiene activado. No se ha creado nada.');
  }

  const slug = (text) => String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  async function createInvite(displayName, locale) {
    const I = S.invite; I.displayName = displayName; I.locale = locale; I.error = ''; I.link = ''; I.copied = false;
    const principalId = slug(displayName);
    if (principalId.length < 2) { I.error = 'Escriba el nombre de la persona.'; render(); return; }
    I.busy = true; render();
    try {
      let body;
      if (S.mode === 'example') {
        body = { code: 'EJEMPLO-no-es-un-enlace-real', path: '/work#invite=EJEMPLO', invite: { id: 'invite_ejemplo-' + Date.now(), principalId: principalId, displayName: displayName, locale: locale, status: 'pending', expired: false, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 72 * 3600000).toISOString() } };
        S.data.invites = [body.invite].concat((S.data.invites || []).filter((x) => x.principalId !== principalId || x.status !== 'pending'));
      } else {
        // Dar acceso es una decisión reservada al CEO: exige su Face ID (ADR-007), igual que la delegación directa.
        const proofId = await founderProof('security.authority.delegate_operator', 'Dar acceso a ' + displayName + ' en JANUS Work');
        if (typeof proofId !== 'string' || !/^bio_proof_[A-Za-z0-9_-]+$/.test(proofId)) throw new Error('Face ID no devolvió una prueba válida.');
        body = await api('/api/auth/operator/invites', { method: 'POST', headers: { 'x-janus-biometric-proof': proofId }, body: JSON.stringify({ principalId: principalId, displayName: displayName, locale: locale }) });
      }
      I.link = (S.mode === 'example' ? 'https://(la dirección de su JANUS)' : location.origin) + body.path; I.forName = displayName; I.expiresAt = body.invite.expiresAt; I.displayName = '';
      I.busy = false; if (S.mode !== 'example') { await load(); return; }
    } catch (error) { I.error = error && error.name === 'NotAllowedError' ? 'Confirmación cancelada. No se ha creado nada.' : String(error.message || error); }
    I.busy = false; render();
  }
  const revokeInvite = (id) => act(() => api('/api/auth/operator/invites/' + encodeURIComponent(id), { method: 'DELETE' }),
    () => { const x = (S.data.invites || []).find((y) => y.id === id); if (x) x.status = 'revoked'; });

  const brandOn = typeof WORK_BRAND === 'string' && WORK_BRAND;
  const brandImg = () => (brandOn ? '<img class="jw-brand-img" src="' + WORK_BRAND + '" alt="InfinitySeed Group" width="200" height="59" decoding="async" draggable="false">' : 'INFINITYSEED GROUP ');
  const brandBar = () => (brandOn ? '<div class="jw-brand-bar" aria-hidden="true"><img src="' + WORK_BRAND + '" alt="" width="180" height="53" decoding="async" draggable="false"></div>' : '');
  // Vuelta a la dashboard de la que viene el CEO. Solo rutas propias conocidas: nunca una dirección escrita en el enlace.
  const BACK_ALLOWED = ['/dashboard/a', '/dashboard/b', '/'];
  const backHref = () => { try { const v = new URLSearchParams(location.search).get('back'); return BACK_ALLOWED.indexOf(v) >= 0 ? v : '/dashboard/a'; } catch (_) { return '/dashboard/a'; } };
  const backLink = (cls) => '<a class="' + cls + '" href="' + (S.mode === 'example' ? '#' : esc(backHref())) + '"' + (S.mode === 'example' ? ' title="En la vista previa no navega: en JANUS vuelve a su dashboard"' : '') + '>← Mi dashboard</a>';
  const head = (kicker, title, right) => '<div class="cc-panel-head"><div><small>' + esc(kicker) + '</small><h3>' + esc(title) + '</h3></div>' + (right || '') + '</div>';
  const empty = (text) => '<p class="empty">' + esc(text) + '</p>';

  function viewLogin() {
    const L = S.login;
    return '<main class="cc-login-shell"><section class="cc-login-card"><a class="cc-wordmark jw-brand" href="#">' + brandImg() + '<em>Janus Work</em></a><p class="cc-kicker">VISTA DE EQUIPO · CEO</p><h1>Iniciar sesión</h1><p>Acceso con la llave segura de este dispositivo.</p>' +
      '<form data-form="login"><label for="jt-id">Identificador</label><input id="jt-id" name="id" autocomplete="username" autocapitalize="none" value="' + esc(L.id) + '" required><button type="submit"' + (L.busy ? ' disabled' : '') + '>' + (L.busy ? 'Comprobando…' : 'Entrar') + '</button></form>' +
      (L.error ? '<div class="cc-notice">' + esc(L.error) + '</div>' : '') + '</section></main>';
  }

  function viewShell() {
    const d = S.data;
    // Mismo estado que las lucecitas de «Mi equipo» en la dashboard del CEO (presencia real del servidor).
    const presenceOf = (m) => m.presence || (m.openSession ? (m.openSession.state === 'running' ? 'working' : 'paused') : 'offline');
    const PRESENCE = { working: ['trabajando', 'in-progress', 'normal'], unconfirmed: ['sesión abierta, sin señal', 'waiting', 'normal'], paused: ['en pausa', 'waiting', 'normal'], online: ['conectado', 'completed', 'low'], offline: ['desconectado', 'draft', 'low'] };
    const working = d.members.filter((m) => presenceOf(m) === 'working').length;
    const blocked = d.assignments.filter((x) => x.assignment.status === 'blocked').length, unread = d.messages.filter((m) => m.status === 'delivered' && !m.readAt).length;
    const today = new Date().toISOString().slice(0, 10);
    const nav = [['team', '◉', 'Equipo'], ['availability', '▤', 'Disponibilidad'], ['tasks', '✓', 'Tareas'], ['deliveries', '↗', 'Entregas'], ['messages', '✉', 'Mensajes'], ['files', '◇', 'Archivos'], ['projects', '◫', 'Proyectos'], ['access', '⚿', 'Accesos']];
    const members = d.members.length ? d.members.map((m) => {
      const st = PRESENCE[presenceOf(m)] || PRESENCE.offline;
      return '<article class="cc-operation-item"><div class="priority priority-' + st[2] + '"></div><div class="grow"><strong>' + esc(m.displayName) + '</strong><small>' + esc(m.roleTitle || 'Colaborador') + ' · ' + esc(String(m.locale).toUpperCase()) + ' · hoy ' + esc(fmtDur(m.todayActiveSeconds)) + ' · consultas ' + m.usage.used + (m.usage.limit ? '/' + m.usage.limit : '') + '</small></div><span class="status status-' + st[1] + '">' + st[0] + '</span></article>';
    }).join('') : empty('Todavía no hay colaboradores dados de alta.');
    const agenda = d.agenda.length ? d.agenda.slice(0, 14).map((x) => '<article><div class="grow"><strong>' + esc(name(x.principalId)) + ' · ' + esc(x.kind === 'availability' ? 'Trabaja' + (x.text ? ' — ' + x.text : '') : x.text) + '</strong><small>' + esc(x.date === today ? 'Hoy' : fmtDay(x.date)) + (x.time ? ' · ' + esc(x.time) + (x.endTime ? '–' + esc(x.endTime) : '') : '') + (x.projectId ? ' · ' + esc(projectName(x.projectId)) : '') + '</small></div><span class="status status-' + (x.kind === 'availability' ? 'submitted' : 'received') + '">' + (x.kind === 'availability' ? 'disponible' : 'recordatorio') + '</span></article>').join('') : empty('Nadie ha anotado disponibilidad.');
    const tasks = d.assignments.length ? d.assignments.map((item) => {
      const a = item.assignment, st = STATUS[a.status] || [a.status, 'draft'];
      return '<article class="cc-operation-item"><div class="priority priority-' + ({ critical: 'urgent', high: 'high', normal: 'normal', low: 'low' }[a.priority] || 'normal') + '"></div><div class="grow"><strong>' + esc(a.title) + '</strong><small>' + esc(name(a.assigneePrincipalId)) + (item.latestHandoff ? ' · último avance: ' + esc(item.latestHandoff.executiveSummary) : ' · sin avances registrados') + '</small>' +
        '<label class="jt-agent"><span>Agente</span><select data-act="agent" data-v="' + esc(a.id) + '">' + Object.keys(AGENTS).map((k) => '<option value="' + k + '"' + ((a.preferredProvider || '') === k ? ' selected' : '') + '>' + AGENTS[k] + (k && !d.providers.configured.includes(k) ? ' (sin configurar)' : '') + '</option>').join('') + '</select></label>' +
        '</div><span class="status status-' + st[1] + '">' + st[0] + '</span><time>' + esc(fmtDate(a.updatedAt)) + '</time></article>';
    }).join('') : empty('No hay tareas asignadas.');
    const deliveries = d.deliveries.length ? d.deliveries.slice(0, 10).map((h) => '<article><div class="grow"><strong>' + esc(h.executiveSummary) + '</strong><small>' + esc(name(h.fromPrincipalId)) + ' · hechos: ' + h.completed.length + ' · pendientes: ' + h.pending.length + (h.blockers.length ? ' · bloqueos: ' + h.blockers.length : '') + (h.evidenceRefs.length ? ' · evidencias: ' + h.evidenceRefs.length : '') + '</small></div><span class="status status-' + (h.blockers.length ? 'blocked' : 'done') + '">' + (h.blockers.length ? 'con bloqueo' : 'registrada') + '</span><time>' + esc(fmtDate(h.createdAt)) + '</time></article>').join('') : empty('Sin entregas todavía.');
    const messages = d.messages.length ? d.messages.slice(0, 12).map((m) => '<article><div class="grow"><strong>' + esc(m.subject) + '</strong><small>' + esc(name(m.fromPrincipalId)) + (m.projectId ? ' · ' + esc(projectName(m.projectId)) : '') + ' · ' + esc(fmtDate(m.createdAt)) + '</small>' +
      (S.openMsg === m.id ? '<p class="jt-body">' + esc(m.body) + '</p>' : '') +
      '<div class="cc-operation-links cc-row-actions jw-links"><button type="button" data-act="msg" data-v="' + esc(m.id) + '">' + (S.openMsg === m.id ? 'Cerrar' : 'Leer') + '</button></div></div>' +
      '<span class="status status-' + (m.status === 'rejected' ? 'blocked' : m.readAt ? 'completed' : 'in-progress') + '">' + (m.status === 'rejected' ? 'rechazado: destino externo' : m.readAt ? 'leído' : 'nuevo') + '</span></article>').join('') : empty('Sin mensajes del equipo.');
    const files = d.fileAccess.length ? d.fileAccess.slice(0, 14).map((f) => '<article><div class="grow"><strong>' + esc(f.name) + '</strong><small>' + esc(name(f.principalId)) + ' · ' + esc(projectName(f.projectId)) + '</small></div><span class="status status-received">abierto</span><time>' + esc(fmtDate(f.at)) + '</time></article>').join('') : empty('Nadie ha abierto archivos todavía.');
    const projects = d.projects.length ? d.projects.map((p) => '<article><div class="grow"><strong>' + esc(p.name) + '</strong><small>' + (p.createdBy === 'founder' ? 'Creado por el CEO' : 'Abierto por ' + esc(name(p.createdBy))) + '</small></div>' +
      '<label class="jt-toggle"><input type="checkbox" data-act="local" data-v="' + esc(p.id) + '"' + (p.localOnly ? ' checked' : '') + '><span>Solo modelo propio</span></label></article>').join('') : empty('Sin proyectos.');
    return '<main class="cc-shell"><aside class="cc-sidebar"><a class="cc-wordmark jw-brand" href="#team">' + brandImg() + '<em>Janus Work</em></a><nav aria-label="Equipo">' + nav.map((n, i) => '<a href="#' + n[0] + '"' + (i === 0 ? ' class="active"' : '') + '><span aria-hidden="true">' + n[1] + '</span>' + n[2] + '</a>').join('') + '</nav>' +
      '<div class="cc-sidebar-foot"><small>CEO</small><strong>Vista de equipo</strong>' + backLink('jt-back') + (S.mode === 'core' ? '<button type="button" data-act="signout">Cerrar sesión</button>' : '') + '</div></aside>' +
      '<section class="cc-main">' + brandBar() + (S.mode === 'example' ? '<div class="cc-notice jw-example" role="note"><b>VISTA PREVIA · DATOS DE EJEMPLO · nada se envía ni se guarda</b><span>Página aparte: no modifica su dashboard personal.</span></div>' : '') +
      '<header class="cc-topbar"><div><small>Solo asuntos de empresa · la agenda personal de cada persona no aparece aquí</small><h1>¿Cómo va el equipo?</h1></div><div class="cc-top-actions">' + backLink('jt-back jt-back-top') + '<button type="button" class="refresh" data-act="refresh"' + (S.loading ? ' disabled' : '') + '>↻ Actualizar</button></div></header>' +
      (S.notice ? '<div class="cc-notice" role="status">' + esc(S.notice) + '</div>' : '') +
      '<section class="cc-attention-grid"><article class="cc-attention"><small>Trabajando ahora</small><strong>' + working + '</strong><span>de ' + d.members.length + '</span></article><article class="cc-attention ' + (blocked ? 'warn' : '') + '"><small>Tareas bloqueadas</small><strong>' + blocked + '</strong><span>&nbsp;</span></article><article class="cc-attention ' + (unread ? 'danger' : '') + '"><small>Mensajes nuevos</small><strong>' + unread + '</strong><span>&nbsp;</span></article><article class="cc-attention"><small>Entregas</small><strong>' + d.deliveries.length + '</strong><span>&nbsp;</span></article><article class="cc-attention"><small>Archivos abiertos</small><strong>' + d.fileAccess.length + '</strong><span>&nbsp;</span></article><article class="cc-attention"><small>Límite diario</small><strong>' + (d.providers.dailyLimit || '∞') + '</strong><span>consultas/persona</span></article></section>' +
      '<div class="cc-two-col"><section class="cc-panel" id="team">' + head('PERSONAS', 'Equipo') + '<div class="cc-list">' + members + '</div></section><section class="cc-panel" id="availability">' + head('AGENDA DE TRABAJO', 'Disponibilidad') + '<div class="cc-list compact">' + agenda + '</div><div class="cc-admin-strip">Solo lo que cada persona marca como trabajo. Sus recordatorios personales son privados.</div></section></div>' +
      '<div class="cc-two-col"><section class="cc-panel" id="tasks">' + head('TAREAS', 'Trabajo asignado') + '<div class="cc-list">' + tasks + '</div><div class="cc-admin-strip">«Agente» es con quién trabaja JANUS esa tarea. Si falla, JANUS sigue con los demás.</div></section><section class="cc-panel" id="deliveries">' + head('AVANCES Y ENTREGAS', 'Lo último del equipo') + '<div class="cc-list compact">' + deliveries + '</div></section></div>' +
      '<div class="cc-three-col"><section class="cc-panel" id="messages">' + head('BANDEJA INTERNA', 'Mensajes del equipo', '<b>' + unread + '</b>') + '<div class="cc-list compact">' + messages + '</div><div class="cc-admin-strip">Los intentos de escribir fuera de la empresa se rechazan solos y quedan anotados.</div></section><section class="cc-panel" id="files">' + head('TRAZABILIDAD', 'Archivos abiertos') + '<div class="cc-list compact">' + files + '</div></section><section class="cc-panel" id="projects">' + head('PROYECTOS', 'Confidencialidad') + '<div class="cc-list compact">' + projects + '</div><div class="cc-admin-strip">«Solo modelo propio»: el contenido de ese proyecto no se envía a Claude, ChatGPT ni Gemini.' + (d.providers.configured.includes('custom') ? '' : ' Ahora mismo no hay modelo propio configurado: en esos proyectos JANUS responderá sin modelo.') + '</div></section></div>' +
      '<section class="cc-panel jt-access" id="access">' + head('ACCESOS', 'Dar acceso a un colaborador') +
      '<form data-form="invite" class="jt-invite"><label>Nombre<input name="displayName" maxlength="80" required value="' + esc(S.invite.displayName) + '" placeholder="Nombre de la persona"></label>' +
      '<label>Idioma<select name="locale">' + [['es', 'Español'], ['nl', 'Nederlands'], ['en', 'English']].map((l) => '<option value="' + l[0] + '"' + (S.invite.locale === l[0] ? ' selected' : '') + '>' + l[1] + '</option>').join('') + '</select></label>' +
      '<button type="submit"' + (S.invite.busy ? ' disabled' : '') + '>' + (S.invite.busy ? 'Confirmando…' : 'Crear enlace con Face ID') + '</button></form>' +
      (S.mode === 'core' && !(globalThis.JanusFounderNative && globalThis.JanusFounderNative.actionProof) && S.passkey && S.passkey.enabled && S.passkey.activePasskeys === 0 ? '<div class="cc-notice jt-link" role="note"><b>Antes de dar accesos, active Face ID en este dispositivo (una sola vez).</b>' + (S.passkey.canEnrollNow ? '<span><button type="button" data-act="passkey-enroll"' + (S.invite.busy ? ' disabled' : '') + '>Activar Face ID</button></span>' : '<small>El alta está cerrada por seguridad. Se abre unos minutos desde el equipo donde corre JANUS y se vuelve a cerrar.</small>') + '</div>' : '') +
      (S.invite.error ? '<div class="cc-notice" role="alert">' + esc(S.invite.error) + '</div>' : '') +
      (S.invite.link ? '<div class="cc-notice jt-link" role="status"><b>Enlace para ' + esc(S.invite.forName) + ' · vale una sola vez, hasta ' + esc(fmtDate(S.invite.expiresAt)) + '</b><textarea readonly rows="2" aria-label="Enlace de acceso">' + esc(S.invite.link) + '</textarea><span><button type="button" data-act="invite-copy">' + (S.invite.copied ? 'Copiado' : 'Copiar') + '</button>' + (typeof navigator !== 'undefined' && navigator.share ? '<button type="button" data-act="invite-share">Enviar</button>' : '') + '</span><small>Envíeselo solo a esa persona. Al abrirlo en su teléfono queda vinculado ese dispositivo. No se volverá a mostrar.</small></div>' : '') +
      '<div class="cc-list compact">' + ((d.invites || []).length ? d.invites.slice(0, 8).map((x) => { const st = x.status === 'redeemed' ? ['usado', 'completed'] : x.status === 'revoked' ? ['anulado', 'draft'] : x.expired ? ['caducado', 'draft'] : ['pendiente', 'waiting'];
        return '<article><div class="grow"><strong>' + esc(x.displayName) + ' · ' + esc(String(x.locale).toUpperCase()) + '</strong><small>' + esc(x.principalId) + ' · creado ' + esc(fmtDate(x.createdAt)) + '</small></div><span class="status status-' + st[1] + '">' + st[0] + '</span>' + (x.status === 'pending' && !x.expired ? '<button type="button" data-act="invite-revoke" data-v="' + esc(x.id) + '">Anular</button>' : '') + '</article>'; }).join('') : empty('Todavía no ha creado ningún enlace de acceso.')) + '</div>' +
      '<div class="cc-admin-strip">Cada enlace vincula UN teléfono a UNA persona. Si alguien cambia de teléfono, cree un enlace nuevo: el anterior deja de valer.</div></section>' +
      '</section></main>';
  }

  function render() {
    if (!$root) return; const y = window.scrollY;
    $root.innerHTML = S.data ? viewShell() : (S.mode === 'core' && !S.loading ? viewLogin() : '<main class="cc-login-shell"><div class="cc-loading">Cargando…</div></main>');
    window.scrollTo(0, y);
  }
  function start(root) {
    $root = root;
    root.addEventListener('click', (event) => {
      const el = event.target.closest('button[data-act]'); if (!el) return;
      if (el.dataset.act === 'refresh') void load();
      else if (el.dataset.act === 'msg') void readMessage(el.dataset.v);
      else if (el.dataset.act === 'passkey-enroll') void passkeyEnroll();
      else if (el.dataset.act === 'invite-revoke') void revokeInvite(el.dataset.v);
      else if (el.dataset.act === 'invite-copy') Promise.resolve(navigator.clipboard && navigator.clipboard.writeText(S.invite.link)).then(() => { S.invite.copied = true; render(); }).catch(() => {});
      else if (el.dataset.act === 'invite-share') navigator.share({ title: 'JANUS Work', text: 'Tu acceso a JANUS Work (vale una sola vez):', url: S.invite.link }).catch(() => {});
      else if (el.dataset.act === 'signout') Promise.resolve(signOut()).then(() => { S.data = null; render(); });
    });
    root.addEventListener('change', (event) => {
      const el = event.target;
      if (el.dataset && el.dataset.act === 'agent') void setAgent(el.dataset.v, el.value);
      else if (el.dataset && el.dataset.act === 'local') void setLocalOnly(el.dataset.v, el.checked);
      else if (el.id === 'jt-id') S.login.id = el.value;
    });
    root.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (event.target.dataset.form === 'invite') { const f = event.target; void createInvite(f.displayName.value.trim(), f.locale.value); return; }
      if (event.target.dataset.form !== 'login') return;
      const L = S.login; L.id = (document.getElementById('jt-id') || {}).value || L.id; L.busy = true; L.error = ''; render();
      try { const pair = await loadDeviceKey(); if (!pair) throw new Error('Este dispositivo no tiene la llave del CEO.'); await signIn(pair, L.id.trim()); L.busy = false; await load(); return; }
      catch (error) { L.error = String(error.message || error); }
      L.busy = false; render();
    });
    if (S.mode === 'core') { if (typeof sessionToken === 'function' && sessionToken()) void load(); else render(); } else void load();
  }
  return { start, state: S };
})();
if (typeof document !== 'undefined') {
  const boot = () => JanusTeam.start(document.getElementById('app'));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
}
