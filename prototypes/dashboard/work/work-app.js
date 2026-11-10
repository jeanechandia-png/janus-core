'use strict';
/* ===== JANUS Work · plantilla laboral reutilizable (una sola, configurada por perfil) =====
 * Piel: clases `cc-*` de la dashboard de IBA (command center). Aquí no se define diseño nuevo.
 * Datos: contrato ReusableWorkDashboard de JANUS Core (GET /api/dashboard/work) o, en la vista previa,
 *        datos de ejemplo con la misma forma. Solo texto: no hay micrófono, TTS ni voz.
 * Globales que aporta el build: WORK_MODE ('core' | 'example'), WORK_I18N, workExample, JanusGateway (modo core)
 *        y las funciones de sesión de apps/pwa/founder-session.js (loadDeviceKey, createDeviceKey, signIn…).
 */
/* «Recuérdame…» escrito en el chat → elemento de agenda. Puro y determinista (ES · NL · EN); no llama a ningún modelo.
 * Devuelve { date:'AAAA-MM-DD', time?:'HH:MM', text } o null si el mensaje no es un recordatorio. */
function parseWorkReminder(input, now) {
  const m = /^\s*(?:recu[eé]rdame|recordarme|herinner me(?: eraan)?|remind me)(?![a-záéíóúñ])[\s:,]*(.*)$/i.exec(String(input || ''));
  if (!m) return null;
  let rest = m[1].trim(); if (!rest) return null;
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate()), key = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const add = (n) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + n);
  let date = null, time = null;
  const take = (re, fn) => { const x = re.exec(rest); if (!x) return false; if (fn(x) === false) return false; rest = (rest.slice(0, x.index) + ' ' + rest.slice(x.index + x[0].length)).replace(/\s+/g, ' ').trim(); return true; };
  const B = '(?<![a-záéíóúñ0-9])', E = '(?![a-záéíóúñ0-9])'; // límites de palabra que entienden tildes y ñ
  // hora: «a las 17:30», «om 9 uur», «at 5pm», o un HH:MM suelto
  take(new RegExp(B + '(?:a las?|om|at)\\s+(\\d{1,2})(?:[:.h](\\d{2}))?\\s*(am|pm|uur)?' + E, 'i'), (x) => { let h = +x[1]; const mm = x[2] ? +x[2] : 0, ap = (x[3] || '').toLowerCase(); if (ap === 'pm' && h < 12) h += 12; if (ap === 'am' && h === 12) h = 0; if (h > 23 || mm > 59) return false; time = String(h).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); })
    || take(new RegExp(B + '(\\d{1,2}):(\\d{2})' + E), (x) => { if (+x[1] > 23 || +x[2] > 59) return false; time = x[1].padStart(2, '0') + ':' + x[2]; });
  // día
  take(new RegExp(B + '(?:pasado ma[ñn]ana|overmorgen|the day after tomorrow)' + E, 'i'), () => { date = add(2); })
    || take(new RegExp(B + '(?:ma[ñn]ana|morgen|tomorrow)' + E, 'i'), () => { date = add(1); })
    || take(new RegExp(B + '(?:hoy|vandaag|today)' + E, 'i'), () => { date = add(0); })
    || take(new RegExp(B + '(?:el |op |on )?(\\d{1,2})[\\/-](\\d{1,2})(?:[\\/-](\\d{4}))?' + E, 'i'), (x) => { const d = new Date(x[3] ? +x[3] : base.getFullYear(), +x[2] - 1, +x[1]); if (d.getMonth() !== +x[2] - 1 || d.getDate() !== +x[1]) return false; if (!x[3] && d < base) d.setFullYear(d.getFullYear() + 1); date = d; })
    || take(new RegExp(B + '(?:el pr[oó]ximo |el |op |on |next |volgende )?(domingo|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|zondag|maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|sunday|monday|tuesday|wednesday|thursday|friday|saturday)' + E, 'i'), (x) => {
      const names = ['domingo|zondag|sunday', 'lunes|maandag|monday', 'martes|dinsdag|tuesday', 'mi[eé]rcoles|woensdag|wednesday', 'jueves|donderdag|thursday', 'viernes|vrijdag|friday', 's[aá]bado|zaterdag|saturday'];
      const wd = names.findIndex((n) => new RegExp('^(?:' + n + ')$', 'i').test(x[1])); let delta = (wd - base.getDay() + 7) % 7; if (delta === 0) delta = 7; date = add(delta); });
  rest = rest.replace(/^(?:que|de|om|aan|to|that|about)\s+/i, '').replace(/^[\s,.:;-]+|[\s,.:;-]+$/g, '');
  if (!rest) return null;
  return Object.assign({ date: key(date || base), text: rest.charAt(0).toUpperCase() + rest.slice(1) }, time ? { time } : {});
}

const JanusWork = (() => {
  const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const LANGS = ['es', 'nl', 'en'];
  const S = {
    mode: typeof WORK_MODE === 'string' ? WORK_MODE : 'example',
    lang: 'es', data: null, projectId: '', loading: false, notice: '', noticeTone: '',
    form: null, formBusy: false, chat: {}, chatBusy: false, threads: {}, draft: '',
    login: { id: '', busy: false, error: '', pem: '', copied: false, hasKey: null },
    persona: 'colab-a', examples: null, uploadBusy: false, flash: '', newProject: false, alerted: {}, pushOn: false,
  };
  let $root = null, timer = null, loadedAt = 0;

  const t = (key, vars) => {
    const table = WORK_I18N[S.lang] || WORK_I18N.es;
    let text = table[key] != null ? table[key] : (WORK_I18N.es[key] != null ? WORK_I18N.es[key] : key);
    if (vars) for (const k of Object.keys(vars)) text = text.split('{' + k + '}').join(String(vars[k]));
    return text;
  };
  const localeTag = () => ({ es: 'es-ES', nl: 'nl-NL', en: 'en-GB' }[S.lang] || 'es-ES');
  const fmtDate = (iso) => { const d = new Date(iso); return isNaN(d) ? '—' : new Intl.DateTimeFormat(localeTag(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d); };
  const fmtDay = (d) => new Intl.DateTimeFormat(localeTag(), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  const fmtDur = (seconds) => { const s = Math.max(0, Math.round(seconds || 0)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h + ' h ' + String(m).padStart(2, '0') + ' min'; };
  const lines = (text) => String(text || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const timeZone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || '—'; } catch (_) { return '—'; } };
  const STATUS_CLASS = { queued: 'waiting', active: 'in-progress', blocked: 'blocked', handoff_required: 'pending-approval', completed: 'completed', cancelled: 'draft' };
  // Agentes con los que JANUS puede trabajar una tarea (lo decide el CEO). Nombres propios: no se traducen.
  const AGENT_NAMES = { anthropic: 'Claude', openai: 'ChatGPT', gemini: 'Gemini', perplexity: 'Perplexity', custom: 'JANUS local' };
  const PRIORITY_CLASS = { critical: 'urgent', high: 'high', normal: 'normal', low: 'low' };

  /* ── datos ── */
  const project = () => (S.data && S.data.projects.find((p) => p.id === S.projectId)) || (S.data && S.data.projects[0]) || null;
  const openTasks = () => (S.data ? S.data.assignments.filter((x) => x.assignment.status !== 'completed' && x.assignment.status !== 'cancelled') : []);
  const liveSession = () => {
    const open = S.data && S.data.sessions.open;
    if (!open) return null;
    const extra = open.state === 'running' || open.state === 'paused' ? Math.max(0, (Date.now() - loadedAt) / 1000) : 0;
    return Object.assign({}, open, { activeSeconds: open.activeSeconds + (open.state === 'running' ? extra : 0), pausedSeconds: open.pausedSeconds + (open.state === 'paused' ? extra : 0) });
  };

  async function api(path, init) {
    const headers = Object.assign({}, (init && init.headers) || {}, typeof authHeaders === 'function' ? authHeaders() : {});
    if (init && init.body && !headers['content-type']) headers['content-type'] = 'application/json';
    const response = await fetch(path, Object.assign({ cache: 'no-store' }, init || {}, { headers }));
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(String(body.error || body.code || ('HTTP ' + response.status))); error.status = response.status; throw error; }
    return body;
  }

  function adopt(data) {
    S.data = data; loadedAt = Date.now();
    if (!S.projectId || !data.projects.some((p) => p.id === S.projectId)) {
      const writable = data.projects.find((p) => p.canWrite);
      S.projectId = (data.sessions.open && data.sessions.open.projectId) || (writable && writable.id) || (data.projects[0] && data.projects[0].id) || '';
    }
  }

  async function load(keepNotice) {
    S.loading = true; if (!keepNotice) { S.notice = ''; } render();
    try {
      if (S.mode === 'example') {
        if (!S.examples) S.examples = workExample(new Date().toISOString());
        adopt(S.examples[S.persona]); S.lang = S.data.locale;
      } else {
        const body = await api('/api/dashboard/work');
        adopt(body.dashboard); S.lang = LANGS.includes(body.dashboard.locale) ? body.dashboard.locale : 'es';
        if (pushSupported() && Notification.permission === 'granted') navigator.serviceWorker.getRegistration('/work').then((r) => (r ? r.pushManager.getSubscription() : null)).then((sub) => { if (sub && !S.pushOn) { S.pushOn = true; render(); } }).catch(() => {});
      }
    } catch (error) {
      if (error.status === 401) { S.data = null; if (typeof signOut === 'function') await signOut(); }
      else { S.notice = t('loadError', { error: error.message }); S.noticeTone = 'warn'; }
    }
    S.loading = false; render();
  }

  /* ── acciones ── */
  async function setLang(lang) {
    if (!LANGS.includes(lang) || lang === S.lang) return;
    S.lang = lang; S.flash = lang; render(); S.flash = '';
    if (S.data) {
      S.data.locale = lang;
      if (S.mode === 'core') { try { await api('/api/dashboard/work/locale', { method: 'PUT', body: JSON.stringify({ locale: lang }) }); } catch (error) { S.notice = error.message; S.noticeTone = 'warn'; render(); } }
    }
  }

  async function sessionEvent(kind) {
    if (!S.data) return;
    if (S.mode === 'example') {
      const now = new Date().toISOString(), live = liveSession();
      if (kind === 'start') S.data.sessions.open = { sessionId: 'ws-' + Date.now(), principalId: S.data.principalId, state: 'running', startedAt: now, activeSeconds: 0, pausedSeconds: 0, pauses: 0, projectId: S.projectId, progress: [], blockers: [], deliveries: [], lastEventAt: now };
      else if (live) {
        const next = Object.assign({}, live, { lastEventAt: now });
        if (kind === 'pause') { next.state = 'paused'; next.pauses += 1; }
        if (kind === 'resume') next.state = 'running';
        if (kind === 'end') { next.state = 'ended'; next.endedAt = now; S.data.sessions.recent.unshift(next); S.data.sessions.open = null; }
        else S.data.sessions.open = next;
      }
      loadedAt = Date.now(); render(); return;
    }
    try {
      await api('/api/work/sessions/events', { method: 'POST', body: JSON.stringify(Object.assign({ kind }, S.projectId ? { projectId: S.projectId } : {})) });
      await load(true);
    } catch (error) { S.notice = error.message; S.noticeTone = 'warn'; render(); }
  }

  function openForm(assignmentId, delivery) {
    const tasks = openTasks();
    S.form = { assignmentId: assignmentId || (tasks[0] && tasks[0].assignment.id) || '', delivery: !!delivery, summary: '', done: '', pending: '', blockers: '', next: '', evidence: '', complete: !!delivery, error: '' };
    render();
    const el = document.getElementById('jw-form'); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  async function submitForm() {
    const f = S.form; if (!f || S.formBusy) return;
    if (!f.assignmentId) { f.error = t('formNeedTask'); render(); return; }
    if (!f.summary.trim()) { f.error = t('formNeedSummary'); render(); return; }
    const payload = { executiveSummary: f.summary.trim(), completed: lines(f.done), pending: lines(f.pending), blockers: lines(f.blockers), nextActions: lines(f.next), evidenceRefs: lines(f.evidence), completeAssignment: f.complete === true };
    S.formBusy = true; render();
    try {
      if (S.mode === 'example') {
        const now = new Date().toISOString();
        const handoff = Object.assign({ id: 'h-' + Date.now(), assignmentId: f.assignmentId, fromPrincipalId: S.data.principalId, createdAt: now, conclusions: [], decisions: [], checksum: 'ejemplo' }, payload);
        S.data.deliveries.unshift(handoff);
        const item = S.data.assignments.find((x) => x.assignment.id === f.assignmentId);
        if (item) { item.latestHandoff = handoff; item.assignment.status = payload.completeAssignment ? 'completed' : (payload.blockers.length ? item.assignment.status : 'active'); item.assignment.updatedAt = now; if (payload.nextActions.length) item.assignment.nextActions = payload.nextActions; }
      } else {
        await api('/api/coordination/assignments/' + encodeURIComponent(f.assignmentId) + '/handoffs', { method: 'POST', body: JSON.stringify(payload) });
        if (S.data.sessions.open) {
          await api('/api/work/sessions/events', { method: 'POST', body: JSON.stringify({ kind: f.complete ? 'delivery' : 'progress', note: payload.executiveSummary.slice(0, 2000), assignmentId: f.assignmentId, evidenceRefs: payload.evidenceRefs.slice(0, 12) }) }).catch(() => {});
        }
      }
      S.form = null; S.notice = t('formSaved'); S.noticeTone = '';
      if (S.mode === 'core') { S.formBusy = false; await load(true); return; }
    } catch (error) { f.error = error.message; }
    S.formBusy = false; render();
  }

  async function ensureThread(p) {
    if (S.threads[p.id]) return S.threads[p.id];
    const body = await api('/api/projects/' + encodeURIComponent(p.id) + '/threads', { method: 'POST', body: JSON.stringify({ title: 'Work · ' + new Date().toISOString().slice(0, 16) }) });
    S.threads[p.id] = body.thread.id; return body.thread.id;
  }

  async function sendChat(text) {
    const p = project(); text = String(text || '').trim();
    if (!p || !p.canWrite || !text || S.chatBusy) return;
    const log = S.chat[p.id] || (S.chat[p.id] = []);
    log.push({ role: 'user', text, at: new Date().toISOString() });
    const reminder = parseWorkReminder(text, new Date());
    if (reminder) {
      // No es una consulta al modelo: JANUS lo anota en la agenda (personal por defecto) y lo confirma.
      S.draft = ''; let saved = true;
      try { await agendaCreate(Object.assign({ kind: 'reminder', visibility: 'private' }, reminder)); } catch (error) { saved = false; log.push({ role: 'janus', text: t('chatError', { error: String(error.message || error) }), at: new Date().toISOString(), failed: true }); }
      if (saved) log.push({ role: 'janus', text: t('chatReminderSaved', { when: fmtDayKey(reminder.date) + (reminder.time ? ' · ' + reminder.time : ''), text: reminder.text }), at: new Date().toISOString(), meta: t('chatReminderMeta') });
      if (S.mode === 'core' && saved) await load(true); else render();
      return;
    }
    S.draft = ''; S.chatBusy = true; render();
    const reply = { role: 'janus', text: '', meta: '', at: '' };
    try {
      if (S.mode === 'example') {
        await new Promise((r) => setTimeout(r, 350));
        reply.text = t('chatSimReply', { project: p.name }); reply.meta = t('chatSimulated');
        if (S.data.usage && S.data.usage.limit > 0) S.data.usage.used += 1;
      } else {
        const threadId = await ensureThread(p);
        const active = S.data.assignments.find((x) => x.assignment.status === 'active');
        const result = await JanusGateway.ask({ messages: [{ role: 'user', content: text }], projectId: p.id, threadId, assignmentId: active ? active.assignment.id : undefined, inputMode: 'text' });
        if (result.via !== 'core') throw new Error(/429|operator_daily_limit|L[ií]mite diario/i.test(result.text || '') ? t('chatLimit') : (result.text || 'JANUS CORE'));
        if (S.data.usage && S.data.usage.limit > 0) { S.data.usage.used += 1; if (S.data.usage.remaining != null) S.data.usage.remaining = Math.max(0, S.data.usage.remaining - 1); }
        reply.text = result.text; reply.meta = result.label;
      }
    } catch (error) { reply.text = t('chatError', { error: String(error.message || error).slice(0, 240) }); reply.failed = true; }
    reply.at = new Date().toISOString(); log.push(reply);
    S.chatBusy = false; render();
    const input = document.getElementById('jw-chat-input'); if (input) input.focus();
  }

  async function upload(fileList, source) {
    const p = project(), files = Array.prototype.slice.call(fileList || [], 0, 6);
    if (!files.length || !p || S.uploadBusy) return;
    if (S.mode !== 'core') { S.notice = t('docsPreviewOnly'); S.noticeTone = ''; render(); return; }
    S.uploadBusy = true; render();
    let done = 0; const failed = [];
    for (const file of files) {
      try {
        const response = await fetch('/api/work/attachments', { method: 'POST', body: file, headers: Object.assign({ 'content-type': file.type || 'application/octet-stream', 'x-attachment-project-id': p.id, 'x-attachment-source': source || 'device-file', 'x-attachment-name': encodeURIComponent(file.name || 'archivo') }, authHeaders()) });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(String(body.error || body.code || response.status));
        done += 1;
      } catch (error) { failed.push((file.name || '?') + ': ' + String(error.message || error).slice(0, 120)); }
    }
    S.notice = (done ? t('docsUploadedN', { n: done }) : '') + (failed.length ? ' ' + failed.join(' · ') : ''); S.noticeTone = failed.length ? 'warn' : '';
    S.uploadBusy = false; await load(true);
  }

  // Visor interno: el archivo se abre DENTRO del panel, con marca de agua (quién y cuándo). No hay descarga ni
  // envío hacia fuera. Es disuasión + trazabilidad: ninguna app puede impedir una captura de pantalla.
  let viewerEl = null, viewerUrl = '';
  function closeViewer() { if (viewerEl) { viewerEl.remove(); viewerEl = null; } if (viewerUrl) { URL.revokeObjectURL(viewerUrl); viewerUrl = ''; } }
  function openViewer(name, kind, payload) {
    closeViewer();
    const who = S.data ? S.data.profile.displayName + ' · ' + S.data.principalId : '', stamp = fmtDate(new Date().toISOString());
    const mark = esc(who + ' · ' + stamp), o = document.createElement('div');
    o.className = 'jw-viewer'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', name);
    o.innerHTML = '<div class="jw-viewer-top"><strong>' + esc(name) + '</strong><span>' + esc(t('viewerNotice')) + '</span><button type="button" class="jw-viewer-x" aria-label="' + esc(t('viewerClose')) + '">×</button></div>' +
      '<div class="jw-viewer-body">' + (kind === 'image' ? '<img alt="" draggable="false" src="' + esc(payload) + '">' : kind === 'pdf' ? '<iframe title="' + esc(name) + '" src="' + esc(payload) + '#toolbar=0"></iframe>' : '<pre>' + esc(payload) + '</pre>') +
      '<div class="jw-viewer-mark" aria-hidden="true">' + new Array(40).join('<span>' + mark + '</span>') + '</div></div>';
    o.addEventListener('contextmenu', (event) => event.preventDefault());
    o.addEventListener('dragstart', (event) => event.preventDefault());
    o.addEventListener('copy', (event) => event.preventDefault());
    o.querySelector('.jw-viewer-x').addEventListener('click', closeViewer);
    o.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeViewer(); });
    document.body.appendChild(o); viewerEl = o; o.querySelector('.jw-viewer-x').focus();
  }
  async function viewFile(resourceId, name, mime) {
    if (S.mode !== 'core') { openViewer(name, 'text', t('viewerExample')); return; }
    try {
      const response = await fetch('/api/work/files/' + encodeURIComponent(resourceId) + '/view', { headers: authHeaders(), cache: 'no-store' });
      if (response.status === 415) throw new Error(t('viewerUnsupported'));
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const blob = await response.blob(), type = blob.type || mime || '';
      if (/^text\//.test(type)) openViewer(name, 'text', (await blob.text()).slice(0, 200000));
      else { const url = URL.createObjectURL(blob); openViewer(name, type === 'application/pdf' ? 'pdf' : 'image', url); viewerUrl = url; }
    } catch (error) { S.notice = t('viewerError', { error: String(error.message || error) }); S.noticeTone = 'warn'; render(); }
  }

  /* ── agenda personal ── */
  const todayKey = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const fmtDayKey = (key) => { const d = new Date(key + 'T12:00:00'); return isNaN(d) ? key : new Intl.DateTimeFormat(localeTag(), { weekday: 'short', day: 'numeric', month: 'short' }).format(d); };
  async function agendaCreate(body) {
    if (S.mode === 'example') {
      const now = new Date().toISOString();
      S.data.agenda.push(Object.assign({ id: 'ag-' + Date.now(), principalId: S.data.principalId, done: false, createdAt: now, updatedAt: now }, body, body.kind === 'availability' ? { visibility: 'work' } : {}));
      return;
    }
    let timeZone = ''; try { timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (_) { /* sin zona */ }
    await api('/api/work/agenda', { method: 'POST', body: JSON.stringify(Object.assign({}, body, timeZone ? { timeZone } : {})) });
  }
  // Avisos: al llegar la hora de un recordatorio de hoy se muestra en el panel y, si la persona lo permitió, como notificación.
  function checkDueReminders() {
    if (!S.data) return;
    const now = new Date(), today = todayKey(), hm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    const due = (S.data.agenda || []).filter((x) => x.kind === 'reminder' && !x.done && x.date === today && x.time && x.time <= hm && !S.alerted[x.id]);
    if (!due.length) return;
    for (const x of due) {
      S.alerted[x.id] = true;
      try { if (typeof Notification === 'function' && Notification.permission === 'granted') new Notification('JANUS Work', { body: x.time + ' · ' + x.text, tag: x.id }); } catch (_) { /* sin notificaciones del sistema */ }
    }
    S.notice = t('agendaDue', { text: due.map((x) => x.time + ' ' + x.text).join(' · ') }); S.noticeTone = '';
    if (!document.querySelector('#jw-form') && !(document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName))) render();
  }
  // Avisos al teléfono (Web Push): permiso del sistema → service worker → suscripción guardada en JANUS.
  const pushSupported = () => typeof navigator !== 'undefined' && 'serviceWorker' in navigator && typeof window.PushManager === 'function' && typeof Notification === 'function';
  const canAskNotify = () => typeof Notification === 'function' && !S.pushOn && Notification.permission !== 'denied';
  async function enablePush() {
    try {
      if (S.mode !== 'core') { S.notice = t('pushPreview'); S.noticeTone = ''; render(); return; }
      if (!pushSupported()) throw new Error(t('pushUnsupported'));
      const info = await api('/api/work/push');
      if (!info.enabled) throw new Error(t('pushPending'));
      if ((await Notification.requestPermission()) !== 'granted') throw new Error(t('pushDenied'));
      const registration = await navigator.serviceWorker.register('/work-sw.js', { scope: '/work' });
      await navigator.serviceWorker.ready;
      const pad = '='.repeat((4 - (info.publicKey.length % 4)) % 4), raw = atob((info.publicKey + pad).replace(/-/g, '+').replace(/_/g, '/'));
      const key = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i += 1) key[i] = raw.charCodeAt(i);
      const subscription = (await registration.pushManager.getSubscription()) || (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }));
      await api('/api/work/push/subscription', { method: 'POST', body: JSON.stringify(subscription.toJSON()) });
      S.pushOn = true; S.notice = t('pushOn'); S.noticeTone = '';
    } catch (error) { S.notice = String(error.message || error); S.noticeTone = 'warn'; }
    render();
  }
  async function agendaAdd(form) {
    const data = new FormData(form), kind = data.get('kind') === 'availability' ? 'availability' : 'reminder';
    const body = { kind, visibility: data.get('visibility') === 'work' ? 'work' : 'private', date: String(data.get('date') || ''), text: String(data.get('text') || '').trim() };
    if (data.get('time')) body.time = String(data.get('time'));
    if (data.get('endTime')) body.endTime = String(data.get('endTime'));
    if (!body.date || (kind === 'reminder' && !body.text)) { S.notice = t('agendaNeed'); S.noticeTone = 'warn'; render(); return; }
    try {
      await agendaCreate(body);
      if (S.mode === 'example') { S.notice = ''; render(); return; }
      await load();
    } catch (error) { S.notice = error.message; S.noticeTone = 'warn'; render(); }
  }
  async function agendaChange(id, action) {
    const item = S.data.agenda.find((x) => x.id === id); if (!item) return;
    try {
      if (S.mode === 'example') {
        if (action === 'delete') S.data.agenda = S.data.agenda.filter((x) => x.id !== id); else item.done = !item.done;
        render(); return;
      }
      if (action === 'delete') await api('/api/work/agenda/' + encodeURIComponent(id), { method: 'DELETE' });
      else await api('/api/work/agenda/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify({ done: !item.done }) });
      await load(true);
    } catch (error) { S.notice = error.message; S.noticeTone = 'warn'; render(); }
  }
  function viewAgenda() {
    const today = todayKey(), items = (S.data.agenda || []).slice().sort((a, b) => ((a.date + (a.time || '99')) < (b.date + (b.time || '99')) ? -1 : 1));
    const todayCount = items.filter((x) => x.date === today && !x.done).length;
    const projectName = (id) => { const p = S.data.projects.find((x) => x.id === id); return p ? p.name : ''; };
    const row = (x) => '<article class="' + (x.done ? 'jw-done' : '') + '"><div class="grow"><strong>' + esc(x.kind === 'availability' ? t('agendaAvailable') + (x.text ? ' · ' + x.text : '') : x.text) + '</strong>' +
      '<small>' + esc(x.date === today ? t('agendaToday') : fmtDayKey(x.date)) + (x.time ? ' · ' + esc(x.time) + (x.endTime ? '–' + esc(x.endTime) : '') : '') + (x.projectId && projectName(x.projectId) ? ' · ' + esc(projectName(x.projectId)) : '') + '</small>' +
      '<div class="cc-operation-links cc-row-actions jw-links">' + (x.kind === 'reminder' ? '<button type="button" data-act="agenda-done" data-v="' + esc(x.id) + '">' + (x.done ? '↺ ' + esc(t('agendaUndo')) : '✓ ' + esc(t('agendaDone'))) + '</button>' : '') + '<button type="button" data-act="agenda-del" data-v="' + esc(x.id) + '">× ' + esc(t('agendaDelete')) + '</button></div></div>' +
      '<span class="status status-' + (x.visibility === 'private' ? 'draft' : 'submitted') + '">' + esc(x.visibility === 'private' ? t('agendaPrivate') : t('agendaWork')) + '</span></article>';
    return '<section class="cc-panel" id="agenda">' + panelHead(t('agendaKicker'), t('agendaTitle'), '<div class="cc-inline-metrics"><span>' + esc(t('agendaTodayCount', { n: todayCount })) + '</span></div>') +
      '<form class="jw-agenda-form" data-form="agenda">' +
      '<label><span>' + esc(t('agendaDate')) + '</span><input type="date" name="date" value="' + today + '" required></label>' +
      '<label><span>' + esc(t('agendaFrom')) + '</span><input type="time" name="time"></label>' +
      '<label><span>' + esc(t('agendaTo')) + '</span><input type="time" name="endTime"></label>' +
      '<label><span>' + esc(t('agendaKind')) + '</span><select name="kind"><option value="reminder">' + esc(t('agendaReminder')) + '</option><option value="availability">' + esc(t('agendaAvailability')) + '</option></select></label>' +
      '<label><span>' + esc(t('agendaWho')) + '</span><select name="visibility"><option value="private">' + esc(t('agendaPrivateLong')) + '</option><option value="work">' + esc(t('agendaWorkLong')) + '</option></select></label>' +
      '<label class="wide"><span>' + esc(t('agendaText')) + '</span><input type="text" name="text" maxlength="500" autocomplete="off" placeholder="' + esc(t('agendaPlaceholder')) + '"></label>' +
      '<button type="submit">＋ ' + esc(t('agendaAdd')) + '</button></form>' +
      '<div class="cc-list compact">' + (items.length ? items.map(row).join('') : '<p class="empty">' + esc(t('agendaEmpty')) + '</p>') + '</div>' +
      (canAskNotify() ? '<div class="cc-row-actions jw-actions"><button type="button" data-act="notify">◔ ' + esc(t('agendaNotify')) + '</button></div><div class="cc-inline-notice">' + esc(t('pushHint')) + '</div>' : (S.pushOn ? '<div class="cc-inline-notice">● ' + esc(t('pushOn')) + '</div>' : '')) +
      '<div class="cc-admin-strip">' + esc(t('agendaTruth')) + '</div></section>';
  }

  // Lector de códigos (LEGO janus-attach): el contenido leído es un DATO que se añade al mensaje; nunca se abre solo.
  async function scanCode() {
    if (typeof JanusAttach !== 'object') return;
    // Misma pieza del chat del CEO, configurada para este panel: QR + códigos de barras, idioma del colaborador y piel de IBA.
    if (typeof JanusAttach.configure === 'function') JanusAttach.configure({ formats: ['qr_code', 'ean_13', 'upc_a', 'ean_8', 'code_128'], theme: 'iba',
      strings: { title: t('scanTitle'), aria: t('scanAria'), hint: t('scanHint'), torch: t('scanTorch'), photo: t('scanPhoto'), pick: t('scanPick'), close: t('scanClose'), slow: t('scanSlow'), notFound: t('scanNotFound'), fallback: t('scanFallback') } });
    const result = await JanusAttach.scan();
    if (result && result.raw) { S.draft = (S.draft ? S.draft + ' ' : '') + String(result.raw).slice(0, 2000); render(); const input = document.getElementById('jw-chat-input'); if (input) input.focus(); }
  }

  async function doLogin() {
    const L = S.login; if (L.busy) return;
    L.error = ''; L.busy = true; render();
    try {
      const pair = await loadDeviceKey();
      if (!pair) { L.hasKey = false; throw new Error(t('loginLinkText')); }
      await signIn(pair, L.id.trim());
      try { localStorage.setItem('janus.work.id', L.id.trim()); } catch (_) { /* opcional */ }
      L.busy = false; await load(); return;
    } catch (error) { L.error = String(error.message || error); }
    L.busy = false; render();
  }
  // Invitación del CEO: el código llega en el fragmento (#invite=…), que el navegador no envía al servidor ni queda en
  // registros. Se canjea una sola vez; la llave se crea en ESTE dispositivo y nunca sale de él.
  function inviteCodeFromUrl() {
    try { const m = /(?:^#|&)invite=([A-Za-z0-9_-]{43})(?:&|$)/.exec(location.hash || ''); return m ? m[1] : ''; } catch (_) { return ''; }
  }
  async function redeemInvite(code) {
    const L = S.login; L.busy = true; L.inviting = true; L.error = ''; render();
    try {
      try { history.replaceState(null, '', location.pathname); } catch (_) { /* sin historial */ }
      if (typeof sessionToken === 'function' && sessionToken()) throw new Error(t('inviteWrongDevice'));
      const pair = (await loadDeviceKey()) || (await createDeviceKey());
      const response = await fetch('/api/auth/operator/invites/redeem', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: code, publicKeyPem: await devicePublicKeyPem(pair) }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || t('inviteError'));
      L.id = body.principalId; L.hasKey = true;
      try { localStorage.setItem('janus.work.id', body.principalId); } catch (_) { /* opcional */ }
      await signIn(pair, body.principalId);
      L.busy = false; L.inviting = false; await load(); return;
    } catch (error) { L.error = String(error.message || error); }
    L.busy = false; L.inviting = false; render();
  }
  async function linkDevice() {
    const L = S.login; L.error = '';
    try { const pair = (await loadDeviceKey()) || (await createDeviceKey()); L.pem = await devicePublicKeyPem(pair); L.hasKey = true; }
    catch (error) { L.error = String(error.message || error); }
    render();
  }

  /* ── vistas ── */
  // Selector de idioma: medallones 3D aprobados del ecosistema (mismo componente `janus-language-button` de la PWA).
  const LANG_NAMES = { es: 'Español', nl: 'Nederlands', en: 'English' };
  const langButtons = () => '<div class="janus-language-switch" role="group" aria-label="Idioma / Taal / Language">' + LANGS.map((code) =>
    '<button type="button" class="janus-language-button jw-flag' + (S.lang === code ? ' is-lit' : '') + (S.flash === code ? ' jw-flash' : '') + '" data-act="lang" data-v="' + code + '" data-language="' + code + '" aria-pressed="' + (S.lang === code) + '" aria-label="' + LANG_NAMES[code] + '" title="' + LANG_NAMES[code] + '">' +
    '<img alt="" width="48" height="48" decoding="async" draggable="false" src="' + ((typeof WORK_LANG_ART === 'object' && WORK_LANG_ART[code]) || '') + '"></button>').join('') + '</div>';
  // Sello oficial de InfinitySeed Group (logo aportado por el CEO); si el build no lo trae, queda el rótulo de texto.
  const brandImg = () => (typeof WORK_BRAND === 'string' && WORK_BRAND ? '<img class="jw-brand-img" src="' + WORK_BRAND + '" alt="InfinitySeed Group" width="200" height="59" decoding="async" draggable="false">' : esc(t('brandTop')) + ' ');
  const wordmark = () => '<a class="cc-wordmark jw-brand" href="#today">' + brandImg() + '<em>' + esc(t('brandScript')) + '</em></a>';
  const brandBar = () => (typeof WORK_BRAND === 'string' && WORK_BRAND ? '<div class="jw-brand-bar" aria-hidden="true"><img src="' + WORK_BRAND + '" alt="" width="180" height="53" decoding="async" draggable="false"></div>' : '');
  const panelHead = (kicker, title, right) => '<div class="cc-panel-head"><div><small>' + esc(kicker) + '</small><h3>' + esc(title) + '</h3></div>' + (right || '') + '</div>';
  const exampleBar = () => (S.mode !== 'example' ? '' : '<div class="cc-notice jw-example" role="note"><b>' + esc(t('exampleBanner')) + '</b><span>' + esc(t('examplePersona')) + ' ' +
    Object.keys(S.examples || {}).map((id) => '<button type="button" data-act="persona" data-v="' + id + '" class="' + (S.persona === id ? 'active' : '') + '">' + esc(S.examples[id].profile.displayName) + ' · ' + S.examples[id].locale.toUpperCase() + '</button>').join('') + '</span></div>');

  function viewLogin() {
    const L = S.login, secure = typeof isSecureContext === 'undefined' ? true : isSecureContext;
    return '<main class="cc-login-shell"><section class="cc-login-card">' + wordmark() +
      '<p class="cc-kicker">' + esc(t('loginKicker')) + '</p><h1>' + esc(t('loginTitle')) + '</h1><p>' + esc(t('loginText')) + '</p>' +
      (L.inviting ? '<div class="cc-notice" role="status">' + esc(t('inviteBusy')) + '</div>' : '') +
      '<form data-form="login"><label for="jw-login-id">' + esc(t('loginId')) + '</label><input id="jw-login-id" name="id" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="64" value="' + esc(L.id) + '" required>' +
      '<button type="submit"' + (L.busy ? ' disabled' : '') + '>' + esc(L.busy ? t('loginBusy') : t('loginButton')) + '</button></form>' +
      (L.error ? '<div class="cc-notice">' + esc(L.error) + '</div>' : '') +
      (!secure ? '<div class="cc-notice">' + esc(t('loginNeedsHttps')) + '</div>' : '') +
      (L.pem ? '<div class="cc-notice"><b>' + esc(t('loginKeyReady')) + '</b><textarea class="jw-pem" readonly rows="5" aria-label="' + esc(t('loginCopy')) + '">' + esc(L.pem) + '</textarea></div>' : '') +
      '<div class="cc-lang-row jw-login-row">' + langButtons() + '<button type="button" data-act="' + (L.pem ? 'copy-pem' : 'link') + '">' + esc(L.pem ? (L.copied ? t('loginCopied') : t('loginCopy')) : t('loginLink')) + '</button></div>' +
      '</section></main>';
  }

  const usageBadge = () => { const u = S.data && S.data.usage; return u && u.limit > 0 ? '<span class="cc-readonly-badge jw-usage" title="' + esc(t('usageHint')) + '">' + esc(t('usageToday', { used: u.used, limit: u.limit })) + '</span>' : ''; };
  function viewChat(p) {
    const log = (p && S.chat[p.id]) || [], canChat = !!(p && p.canWrite);
    // Aviso claro de IBA (`cc-inline-notice`): su `cc-continuity-state` está pensado para fondo oscuro y aquí no se lee.
    const cont = p && p.resumeFrom
      ? '<div class="cc-inline-notice jw-cont"><b>● ' + esc(t('continuityOn')) + '</b> · ' + esc(t('continuityFrom', { point: p.resumeFrom.subject + ' — ' + p.resumeFrom.content })) + '</div>'
      : '<div class="cc-inline-notice jw-cont"><b>○ ' + esc(t('continuityNone')) + '</b> · ' + esc(t('continuityNoneHint')) + '</div>';
    const thread = log.length
      ? log.map((m) => '<div class="cc-assistant-answer jw-msg jw-' + m.role + '"><small>' + esc(m.role === 'user' ? t('chatYou') : t('chatJanus')) + ' · ' + esc(fmtDate(m.at)) + '</small><p>' + esc(m.text) + '</p>' + (m.meta ? '<small class="cc-assistant-limit">' + esc(m.meta) + '</small>' : '') + '</div>').join('')
      : '';
    return '<section class="cc-panel cc-assistant-panel" id="assistant">' +
      panelHead(t('chatKicker', { project: p ? p.name : '—' }), t('chatTitle'), '<div class="cc-assistant-head-actions">' + usageBadge() + (p && p.localOnly ? '<span class="cc-readonly-badge">' + esc(t('projLocalOnly')) + '</span>' : '') + '<span class="cc-readonly-badge">' + esc(t('chatBadge')) + '</span><button type="button" class="cc-new-chat" data-act="chat-new">' + esc(t('chatNew')) + '</button></div>') +
      (canChat
        ? '<form class="cc-assistant-form" data-form="chat"><input id="jw-chat-input" name="text" maxlength="4000" autocomplete="off" placeholder="' + esc(t('chatPlaceholder')) + '" value="' + esc(S.draft) + '" aria-label="' + esc(t('chatTitle')) + '"' + (S.chatBusy ? ' disabled' : '') + '><button type="submit"' + (S.chatBusy ? ' disabled' : '') + '>' + esc(S.chatBusy ? t('chatSending') : t('chatSend')) + '</button></form>' +
          '<div class="cc-assistant-prompts">' + ['prompt1', 'prompt2', 'prompt3'].map((k) => '<button type="button" data-act="prompt" data-v="' + k + '">' + esc(t(k)) + '</button>').join('') + '</div>'
        : '<p class="empty">' + esc(t('chatNoProject')) + '</p>') +
      cont + '<div id="jw-thread" aria-live="polite">' + thread + '</div></section>';
  }

  function viewForm() {
    const f = S.form; if (!f) return '';
    const field = (name, label, rows, wide) => '<label' + (wide ? ' class="wide"' : '') + '><span>' + esc(label) + '</span><textarea name="' + name + '" rows="' + rows + '" maxlength="4000">' + esc(f[name]) + '</textarea></label>';
    return '<section class="cc-panel cc-intake-panel" id="jw-form">' +
      '<div class="cc-panel-head"><div><small>' + esc(t('formKicker')) + '</small><h3>' + esc(f.delivery ? t('formTitleDelivery') : t('formTitleProgress')) + '</h3></div><button type="button" class="cc-close-intake" data-act="form-close" aria-label="' + esc(t('formCancel')) + '">×</button></div>' +
      '<form class="cc-intake-form" data-form="progress">' +
      '<label><span>' + esc(t('formTask')) + '</span><select name="assignmentId">' + openTasks().map((x) => '<option value="' + esc(x.assignment.id) + '"' + (x.assignment.id === f.assignmentId ? ' selected' : '') + '>' + esc(x.assignment.title) + '</option>').join('') + '</select></label>' +
      '<label class="wide"><span>' + esc(t('formSummary')) + '</span><textarea name="summary" rows="2" maxlength="2000" required>' + esc(f.summary) + '</textarea></label>' +
      field('done', t('formDone'), 3) + field('pending', t('formPending'), 3) + field('blockers', t('formBlockers'), 3) +
      field('next', t('formNext'), 2) + field('evidence', t('formEvidence'), 2) +
      '<label><span>' + esc(t('formComplete')) + '</span><select name="complete"><option value="0"' + (f.complete ? '' : ' selected') + '>—</option><option value="1"' + (f.complete ? ' selected' : '') + '>✓</option></select></label>' +
      (f.error ? '<div class="cc-inline-notice wide" role="alert">' + esc(f.error) + '</div>' : '') +
      '<div class="cc-intake-actions wide"><button type="button" data-act="form-close">' + esc(t('formCancel')) + '</button><button type="submit" class="primary"' + (S.formBusy ? ' disabled' : '') + '>' + esc(S.formBusy ? t('formSaving') : t('formSave')) + '</button></div>' +
      '</form></section>';
  }

  function viewTasks() {
    const list = S.data.assignments;
    return '<section class="cc-panel" id="tasks">' + panelHead(t('tasksKicker'), t('tasksTitle'), '<div class="cc-inline-metrics"><span>' + list.filter((x) => x.assignment.status === 'active').length + ' ' + esc(t('st_active')) + '</span><span>' + list.filter((x) => x.assignment.status === 'blocked').length + ' ' + esc(t('st_blocked')) + '</span></div>') +
      '<div class="cc-list">' + (list.length ? list.map((item) => {
        const a = item.assignment, done = a.status === 'completed' || a.status === 'cancelled';
        return '<article class="cc-operation-item"><div class="priority priority-' + (PRIORITY_CLASS[a.priority] || 'normal') + '" title="' + esc(t('pr_' + a.priority)) + '"></div>' +
          '<div class="grow"><strong>' + esc(a.title) + '</strong><small>' + esc(a.goal) + ' · ' + esc(t('pr_' + a.priority)) + '</small>' +
          (a.nextActions[0] ? '<small class="jw-next">↳ ' + esc(t('taskNext')) + ': ' + esc(a.nextActions[0]) + '</small>' : '') +
          (AGENT_NAMES[a.preferredProvider] ? '<small class="jw-agent">◈ ' + esc(t('taskAgent', { agent: AGENT_NAMES[a.preferredProvider] })) + '</small>' : '') +
          (done ? '' : '<div class="cc-operation-links cc-row-actions jw-links"><button type="button" data-act="progress" data-v="' + esc(a.id) + '">' + esc(t('taskRegister')) + '</button><button type="button" data-act="deliver" data-v="' + esc(a.id) + '">' + esc(t('taskDeliver')) + '</button></div>') +
          '</div><span class="status status-' + (STATUS_CLASS[a.status] || 'draft') + '">' + esc(t('st_' + a.status)) + '</span><time>' + esc(fmtDate(a.updatedAt)) + '</time></article>';
      }).join('') : '<p class="empty">' + esc(t('tasksEmpty')) + '</p>') + '</div></section>';
  }

  const newProjectBlock = () => (S.newProject
    ? '<form class="jw-agenda-form jw-project-form" data-form="project"><label class="wide"><span>' + esc(t('projNewName')) + '</span><input type="text" name="name" maxlength="80" required autocomplete="off"></label><label class="wide"><span>' + esc(t('projNewDesc')) + '</span><input type="text" name="description" maxlength="300" autocomplete="off"></label><button type="submit">' + esc(t('projNewCreate')) + '</button></form><div class="cc-inline-notice">' + esc(t('projNewTruth')) + '</div>'
    : '<div class="cc-row-actions jw-actions"><button type="button" data-act="project-new">＋ ' + esc(t('projNew')) + '</button></div>');
  async function projectCreate(form) {
    const data = new FormData(form), name = String(data.get('name') || '').trim(), description = String(data.get('description') || '').trim();
    if (!name) return;
    try {
      if (S.mode === 'example') {
        const id = 'p-' + Date.now();
        S.data.projects.push({ id, name, status: 'active', description, canWrite: true, ownedByMe: true, localOnly: false, nextActions: [], decisions: [], unresolvedErrors: [], threads: [], resources: [] });
        S.projectId = id; S.newProject = false; render(); return;
      }
      const body = await api('/api/projects', { method: 'POST', body: JSON.stringify(description ? { name, description } : { name }) });
      S.projectId = body.project.id; S.newProject = false; await load();
    } catch (error) { S.notice = error.message; S.noticeTone = 'warn'; render(); }
  }

  /* ── mensajes internos ── */
  async function messageSend(form) {
    const data = new FormData(form), body = { recipient: String(data.get('recipient') || ''), subject: String(data.get('subject') || '').trim(), body: String(data.get('body') || '').trim() };
    if (!body.subject || !body.body) { S.notice = t('msgNeed'); S.noticeTone = 'warn'; render(); return; }
    if (S.projectId) body.projectId = S.projectId;
    try {
      if (S.mode === 'example') {
        S.data.messaging.sent.unshift({ id: 'm-' + Date.now(), fromPrincipalId: S.data.principalId, recipientId: body.recipient, subject: body.subject, body: body.body, status: 'delivered', decision: 'internal_recipient', createdAt: new Date().toISOString() });
        S.notice = t('msgSent'); S.noticeTone = ''; render(); return;
      }
      await api('/api/work/messages', { method: 'POST', body: JSON.stringify(body) });
      S.notice = t('msgSent'); S.noticeTone = ''; await load(true);
    } catch (error) { S.notice = error.message; S.noticeTone = 'warn'; if (S.mode === 'core') await load(true); else render(); }
  }
  function viewMessages() {
    const M = S.data.messaging || { recipients: [], sent: [] }, label = (id) => { const r = M.recipients.find((x) => x.id === id); return r ? r.label : t('msgExternal'); };
    return '<section class="cc-panel" id="messages">' + panelHead(t('msgKicker'), t('msgTitle'), '<b>' + M.sent.length + '</b>') +
      '<form class="jw-agenda-form jw-msg-form" data-form="message">' +
      '<label class="wide"><span>' + esc(t('msgTo')) + '</span><select name="recipient">' + M.recipients.map((r) => '<option value="' + esc(r.id) + '">' + esc(r.label) + '</option>').join('') + '</select></label>' +
      '<label class="wide"><span>' + esc(t('msgSubject')) + '</span><input type="text" name="subject" maxlength="160" autocomplete="off"></label>' +
      '<label class="wide"><span>' + esc(t('msgBody')) + '</span><textarea name="body" rows="3" maxlength="4000"></textarea></label>' +
      '<button type="submit">' + esc(t('msgSend')) + '</button></form>' +
      '<div class="cc-list compact">' + (M.sent.length ? M.sent.slice(0, 5).map((x) => '<article><div class="grow"><strong>' + esc(x.subject) + '</strong><small>' + esc(label(x.recipientId)) + ' · ' + esc(fmtDate(x.createdAt)) + '</small></div><span class="status status-' + (x.status === 'rejected' ? 'blocked' : x.readAt ? 'completed' : 'submitted') + '">' + esc(x.status === 'rejected' ? t('msgRejected') : x.readAt ? t('msgRead') : t('msgDelivered')) + '</span></article>').join('') : '<p class="empty">' + esc(t('msgEmpty')) + '</p>') + '</div>' +
      '<div class="cc-admin-strip">' + esc(t('msgTruth')) + '</div></section>';
  }

  function viewProject(p) {
    if (!p) return '<section class="cc-panel" id="project">' + panelHead(t('projectKicker'), '—') + '<p class="empty">' + esc(t('projectEmpty')) + '</p></section>';
    const row = (title, body) => '<div><span class="priority priority-normal"></span><p class="grow"><strong>' + esc(title) + '</strong><small class="jw-wrap">' + body + '</small></p></div>';
    const list = (items, map) => (items.length ? items.map(map).join('<br>') : esc(t('projNone')));
    return '<section class="cc-panel" id="project">' + panelHead(t('projectKicker'), p.name, '<div class="cc-inline-metrics"><span>' + esc(t('projDocs', { n: p.resources.length })) + '</span><span>' + esc(t('projThreads', { n: p.threads.length })) + '</span>' + (p.canWrite ? '' : '<span>' + esc(t('projReadOnly')) + '</span>') + (p.localOnly ? '<span>' + esc(t('projLocalOnly')) + '</span>' : '') + (p.ownedByMe ? '<span>' + esc(t('projMine')) + '</span>' : '') + '</div>') +
      '<div class="cc-mini-list">' +
      (p.description ? row(t('projDescription'), esc(p.description)) : '') +
      row(t('projResume'), p.resumeFrom ? '<b>' + esc(p.resumeFrom.subject) + '</b> — ' + esc(p.resumeFrom.content) + ' · ' + esc(fmtDate(p.resumeFrom.at)) : esc(t('projNone'))) +
      row(t('projNext'), list(p.nextActions, (x) => '• ' + esc(x))) +
      row(t('projDecisions'), list(p.decisions, (x) => '• <b>' + esc(x.subject) + ':</b> ' + esc(x.content))) +
      row(t('projErrors'), list(p.unresolvedErrors, (x) => '• <b>' + esc(x.subject) + ':</b> ' + esc(x.content))) +
      '</div>' +
      newProjectBlock() +
      (p.instructions ? '<div class="cc-admin-strip"><strong>' + esc(t('projInstructions')) + ':</strong> ' + esc(p.instructions) + ' <span class="cc-readonly-badge">' + esc(t('projInstructionsBy')) + '</span></div>' : '') +
      '</section>';
  }

  function viewDocs(p) {
    const items = p ? p.resources : [], canUpload = !!(S.data.capabilities.uploadAttachments && p && p.canWrite);
    const live = S.mode === 'core', off = (S.uploadBusy ? ' disabled' : '');
    return '<section class="cc-panel" id="documents">' + panelHead(t('docsKicker'), t('docsTitle'), '<b>' + items.length + '</b>') +
      '<div class="cc-list compact">' + (items.length ? items.slice().reverse().map((r) => '<article><div class="grow"><strong>' + esc(r.name) + '</strong><small>' + esc((r.mimeType || '—')) + ' · ' + esc(r.addedBy) + '</small>' +
        (r.viewable ? '<div class="cc-operation-links cc-row-actions jw-links"><button type="button" data-act="view" data-v="' + esc(r.id) + '" data-name="' + esc(r.name) + '" data-mime="' + esc(r.mimeType || '') + '">◉ ' + esc(t('docsView')) + '</button></div>' : '') +
        '</div><span class="status status-' + (r.source === 'upload' ? 'received' : 'submitted') + '">' + esc(t('src_' + r.source)) + '</span><time>' + esc(fmtDate(r.createdAt)) + '</time></article>').join('') : '<p class="empty">' + esc(t('docsEmpty')) + '</p>') + '</div>' +
      (canUpload ? '<div class="cc-row-actions jw-actions jw-attach">' +
        '<input type="file" id="jw-file" multiple hidden><input type="file" id="jw-cam" accept="image/*" capture="environment" hidden>' +
        '<button type="button" data-act="pick-file"' + off + '>＋ ' + esc(S.uploadBusy ? t('docsUploading') : t('docsUpload')) + '</button>' +
        '<button type="button" data-act="pick-cam"' + off + '>◉ ' + esc(t('docsPhoto')) + '</button>' +
        (typeof JanusAttach === 'object' ? '<button type="button" data-act="scan">▦ ' + esc(t('docsScan')) + '</button>' : '') + '</div>' +
        (live ? '' : '<div class="cc-inline-notice">' + esc(t('docsPreviewOnly')) + '</div>')
        : '<div class="cc-inline-notice">' + esc(p && !p.canWrite ? t('docsReadOnly') : t('docsUploadOff')) + '</div>') +
      '<div class="cc-admin-strip">' + esc(t('docsNoExport')) + ' ' + esc(t('docsTruth')) + '</div></section>';
  }

  function viewDeliveries() {
    const items = S.data.deliveries, title = (id) => { const x = S.data.assignments.find((a) => a.assignment.id === id); return x ? x.assignment.title : id; };
    return '<section class="cc-panel" id="deliveries">' + panelHead(t('delivKicker'), t('delivTitle'), '<b>' + items.length + '</b>') +
      '<div class="cc-list compact">' + (items.length ? items.slice(0, 8).map((h) => '<article><div class="grow"><strong>' + esc(h.executiveSummary) + '</strong><small>' + esc(title(h.assignmentId)) + ' · ' + esc(t('delivDone', { n: h.completed.length })) + ' · ' + esc(t('delivPending', { n: h.pending.length })) + (h.blockers.length ? ' · ' + esc(t('delivBlockers', { n: h.blockers.length })) : '') + '</small></div>' +
        '<span class="status status-' + (h.blockers.length ? 'blocked' : 'done') + '">' + (h.evidenceRefs.length ? '◆ ' + h.evidenceRefs.length : '—') + '</span><time>' + esc(fmtDate(h.createdAt)) + '</time></article>').join('') : '<p class="empty">' + esc(t('delivEmpty')) + '</p>') + '</div></section>';
  }

  function viewInstructions() {
    const pr = S.data.profile, items = lines(pr.instructions);
    return '<section class="cc-panel" id="instructions">' + panelHead(t('instrKicker'), t('instrTitle'), '<span class="cc-readonly-badge">' + esc(t('permCeo')) + '</span>') +
      (pr.functions.length ? '<div class="cc-inline-metrics jw-left" aria-label="' + esc(t('instrFunctions')) + '">' + pr.functions.map((x) => '<span>' + esc(x) + '</span>').join('') + '</div>' : '') +
      '<div class="cc-mini-list">' + (items.length ? items.map((x) => '<div><span class="approval-icon">◆</span><p class="grow"><strong class="jw-wrap">' + esc(x) + '</strong></p></div>').join('') : '<p class="empty">' + esc(t('instrEmpty')) + '</p>') + '</div>' +
      '<div class="cc-admin-strip">' + esc(t('instrBy')) + '</div></section>';
  }

  function viewSession() {
    const s = liveSession(), state = s ? s.state : 'none', recent = S.data.sessions.recent.filter((x) => x.state === 'ended').slice(0, 3);
    const actions = state === 'none' ? '<button type="button" data-act="sess" data-v="start">▶ ' + esc(t('sessStart')) + '</button>'
      : (state === 'running' ? '<button type="button" data-act="sess" data-v="pause">❙❙ ' + esc(t('sessPause')) + '</button>' : '<button type="button" data-act="sess" data-v="resume">▶ ' + esc(t('sessResume')) + '</button>') + '<button type="button" data-act="sess" data-v="end">■ ' + esc(t('sessEnd')) + '</button>';
    return '<section class="cc-panel" id="session">' + panelHead(t('sessKicker'), t('sessTitle'), '<span class="status status-' + (state === 'running' ? 'in-progress' : state === 'paused' ? 'waiting' : 'draft') + '">' + esc(t('sess_' + state)) + '</span>') +
      '<div class="cc-team-grid"><div><strong id="jw-active">' + esc(fmtDur(s ? s.activeSeconds : 0)) + '</strong><small>' + esc(t('sessActive')) + '</small></div><div><strong>' + esc(fmtDur(S.data.sessions.todayActiveSeconds + (s && s.state === 'running' ? (Date.now() - loadedAt) / 1000 : 0))) + '</strong><small>' + esc(t('statToday')) + '</small></div>' +
      '<div><strong>' + (s ? s.pauses : 0) + '</strong><small>' + esc(t('sessPauses')) + '</small></div><div><strong>' + esc(fmtDur(s ? s.pausedSeconds : 0)) + '</strong><small>' + esc(t('sessPaused')) + '</small></div></div>' +
      '<div class="cc-row-actions jw-actions">' + actions + '</div>' +
      '<div class="cc-mini-list">' + (recent.length ? recent.map((x) => '<div><span class="priority priority-low"></span><p class="grow"><strong>' + esc(fmtDate(x.startedAt)) + '</strong><small>' + esc(fmtDur(x.activeSeconds)) + ' · ' + x.pauses + ' ' + esc(t('sessPauses').toLowerCase()) + '</small></p></div>').join('') : '') + '</div>' +
      '<div class="cc-admin-strip">' + esc(t('sessTruth')) + '</div></section>';
  }

  function viewPermissions() {
    const row = (ok, label, note) => '<div><span class="priority priority-' + (ok ? 'normal' : 'low') + '"></span><p class="grow"><strong>' + esc(label) + '</strong>' + (note ? '<small>' + esc(note) + '</small>' : '') + '</p><span class="status status-' + (ok ? 'completed' : 'draft') + '">' + esc(ok ? t('permAllowed') : t('permCeo')) + '</span></div>';
    return '<section class="cc-panel" id="permissions">' + panelHead(t('permKicker'), t('permTitle')) + '<div class="cc-mini-list">' +
      row(true, t('permText')) + row(true, t('permTasks')) + row(true, t('permProjects')) +
      '<div><span class="priority priority-low"></span><p class="grow"><strong>' + esc(t('permVoice')) + '</strong><small>' + esc(t('permVoiceNote')) + '</small></p><span class="status status-draft">—</span></div>' +
      S.data.reservedToCeo.map((k) => row(false, t('res_' + k))).join('') + '</div></section>';
  }

  function viewShell() {
    const d = S.data, p = project(), tasks = openTasks();
    const blocked = d.assignments.filter((x) => x.assignment.status === 'blocked').length;
    const active = d.assignments.filter((x) => x.assignment.status === 'active').length;
    const queued = d.assignments.filter((x) => x.assignment.status === 'queued' || x.assignment.status === 'handoff_required').length;
    const urgent = tasks.filter((x) => x.assignment.priority === 'high' || x.assignment.priority === 'critical').length;
    const attentionTotal = blocked + urgent;
    const nav = [['today', '⌂', 'navToday'], ['agenda', '▤', 'navAgenda'], ['tasks', '✓', 'navTasks'], ['project', '◫', 'navProjects'], ['assistant', '◌', 'navChat'], ['session', '◎', 'navSession'], ['documents', '◇', 'navDocs'], ['deliveries', '↗', 'navDeliveries'], ['messages', '✉', 'navMessages'], ['instructions', '◆', 'navInstructions'], ['permissions', '⌁', 'navPermissions']];
    const card = (label, value, tone) => '<article class="cc-attention ' + tone + '"><small>' + esc(label) + '</small><strong>' + value + '</strong><span>' + (value ? esc(t('attention')) : esc(t('ok'))) + '</span></article>';
    const info = (label, value) => '<article class="cc-attention"><small>' + esc(label) + '</small><strong>' + value + '</strong><span>&nbsp;</span></article>';
    return '<main class="cc-shell">' +
      '<aside class="cc-sidebar">' + wordmark() + '<nav aria-label="JANUS Work">' + nav.map((n, i) => '<a href="#' + n[0] + '"' + (i === 0 ? ' class="active"' : '') + '><span aria-hidden="true">' + n[1] + '</span>' + esc(t(n[2])) + '</a>').join('') + '</nav>' +
      '<div class="cc-sidebar-foot"><small>' + esc(d.profile.roleTitle || t('roleOperator')) + '</small><strong>' + esc(d.profile.displayName) + '</strong>' + (S.mode === 'core' ? '<button type="button" data-act="signout">' + esc(t('signOut')) + '</button>' : '<small>' + esc(t('skinNote')) + '</small>') + '</div></aside>' +
      '<section class="cc-main">' + brandBar() + exampleBar() +
      '<header class="cc-topbar"><div><small>' + esc(fmtDay(new Date())) + ' · ' + esc(timeZone()) + '</small><h1>' + esc(t('question')) + '</h1></div>' +
      '<div class="cc-top-actions"><select data-act="project" aria-label="' + esc(t('projectSelect')) + '">' + d.projects.map((x) => '<option value="' + esc(x.id) + '"' + (p && x.id === p.id ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '</select>' +
      langButtons() +
      '<button type="button" class="cc-primary-action" data-act="progress"' + (tasks.length ? '' : ' disabled') + '>＋ ' + esc(t('newProgress')) + '</button>' +
      '<button type="button" class="refresh" data-act="refresh"' + (S.loading ? ' disabled' : '') + '>' + (S.loading ? '…' : '↻ ' + esc(t('refresh'))) + '</button></div></header>' +
      (S.notice ? '<div class="cc-notice" role="status">' + esc(S.notice) + '</div>' : '') +
      viewForm() +
      '<section class="cc-summary" id="today"><div class="cc-summary-copy"><p class="cc-kicker"><span></span> ' + esc(t('today')) + '</p><h2>' + (attentionTotal ? attentionTotal + ' · ' + esc(t('attention')) : esc(t('allClear'))) + '</h2>' +
      '<p>' + esc(t('summaryHello', { name: d.profile.displayName })) + ' ' + (d.profile.roleTitle ? esc(t('summaryRole', { role: d.profile.roleTitle })) + ' ' : '') + esc(t('summaryText')) + '</p></div>' +
      '<div class="cc-summary-stats"><article><small>' + esc(t('statActive')) + '</small><strong>' + active + '</strong></article><article><small>' + esc(t('statBlocked')) + '</small><strong>' + blocked + '</strong></article><article><small>' + esc(t('statProjects')) + '</small><strong>' + d.projects.length + '</strong></article><article><small>' + esc(t('statToday')) + '</small><strong class="jw-time">' + esc(fmtDur(d.sessions.todayActiveSeconds + (d.sessions.open && d.sessions.open.state === 'running' ? (Date.now() - loadedAt) / 1000 : 0))) + '</strong></article></div></section>' +
      viewChat(p) +
      '<section class="cc-attention-grid">' + card(t('attCritical'), urgent, 'danger') + card(t('attBlocked'), blocked, 'warn') + info(t('attActive'), active) + info(t('attQueued'), queued) + info(t('attDocs'), p ? p.resources.length : 0) + info(t('attDeliveries'), d.deliveries.length) + '</section>' +
      '<div class="cc-two-col">' + viewAgenda() + viewSession() + '</div>' +
      '<div class="cc-two-col">' + viewTasks() + viewProject(p) + '</div>' +
      '<div class="cc-two-col">' + viewDocs(p) + viewDeliveries() + '</div>' +
      '<div class="cc-three-col">' + viewInstructions() + viewMessages() + viewPermissions() + '</div>' +
      (S.mode === 'core' ? '<div class="cc-prepare-generic jw-foot"><span>' + esc(d.profile.displayName) + ' · ' + esc(d.profile.roleTitle || t('roleOperator')) + '</span><button type="button" data-act="signout">' + esc(t('signOut')) + '</button></div>' : '') +
      '</section></main>';
  }

  function render() {
    if (!$root) return;
    const keep = document.activeElement && document.activeElement.id === 'jw-chat-input';
    const scroll = window.scrollY;
    document.documentElement.lang = S.lang;
    if (S.data) $root.innerHTML = viewShell();
    else if (S.mode === 'core' && !S.loading) $root.innerHTML = viewLogin();
    else $root.innerHTML = '<main class="cc-login-shell"><div class="cc-loading">' + esc(t('loading')) + '</div></main>';
    window.scrollTo(0, scroll);
    if (keep) { const input = document.getElementById('jw-chat-input'); if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); } }
  }

  function syncForm(formEl) {
    if (!S.form || !formEl) return;
    const data = new FormData(formEl);
    for (const key of ['assignmentId', 'summary', 'done', 'pending', 'blockers', 'next', 'evidence']) if (data.has(key)) S.form[key] = String(data.get(key));
    S.form.complete = data.get('complete') === '1';
  }

  function bind() {
    $root.addEventListener('click', (event) => {
      const el = event.target.closest('[data-act]'); if (!el || el.tagName === 'SELECT') return;
      const act = el.dataset.act, v = el.dataset.v;
      const open = document.querySelector('form[data-form="progress"]'); if (open) syncForm(open);
      if (act === 'lang') void setLang(v);
      else if (act === 'persona') { S.persona = v; S.projectId = ''; S.form = null; S.notice = ''; void load(); }
      else if (act === 'refresh') void load();
      else if (act === 'progress') openForm(v, false);
      else if (act === 'deliver') openForm(v, true);
      else if (act === 'form-close') { S.form = null; render(); }
      else if (act === 'sess') void sessionEvent(v);
      else if (act === 'prompt') { S.draft = t(v); render(); const input = document.getElementById('jw-chat-input'); if (input) input.focus(); }
      else if (act === 'chat-new') { const p = project(); if (p) { S.chat[p.id] = []; delete S.threads[p.id]; } render(); }
      else if (act === 'pick-file') { const input = document.getElementById('jw-file'); if (input) input.click(); }
      else if (act === 'pick-cam') { const input = document.getElementById('jw-cam'); if (input) input.click(); }
      else if (act === 'view') void viewFile(v, el.dataset.name, el.dataset.mime);
      else if (act === 'agenda-done') void agendaChange(v, 'done');
      else if (act === 'project-new') { S.newProject = true; render(); const input = document.querySelector('.jw-project-form input[name=name]'); if (input) input.focus(); }
      else if (act === 'notify') void enablePush();
      else if (act === 'agenda-del') void agendaChange(v, 'delete');
      else if (act === 'scan') void scanCode();
      else if (act === 'link') void linkDevice();
      else if (act === 'copy-pem') { if (navigator.clipboard) navigator.clipboard.writeText(S.login.pem).then(() => { S.login.copied = true; render(); }).catch(() => {}); }
      else if (act === 'signout') { closeViewer(); Promise.resolve(typeof signOut === 'function' ? signOut() : null).then(() => { S.data = null; S.chat = {}; S.threads = {}; render(); }); }
    });
    $root.addEventListener('change', (event) => {
      const el = event.target;
      if (el.dataset && el.dataset.act === 'project') { S.projectId = el.value; render(); }
      else if ((el.id === 'jw-file' || el.id === 'jw-cam') && el.files && el.files.length) void upload(el.files, el.id === 'jw-cam' ? 'photo' : 'device-file');
    });
    $root.addEventListener('input', (event) => {
      const el = event.target;
      if (el.id === 'jw-chat-input') S.draft = el.value;
      else if (el.id === 'jw-login-id') S.login.id = el.value;
    });
    $root.addEventListener('submit', (event) => {
      const form = event.target; event.preventDefault();
      if (form.dataset.form === 'chat') void sendChat(S.draft);
      else if (form.dataset.form === 'progress') { syncForm(form); void submitForm(); }
      else if (form.dataset.form === 'login') void doLogin();
      else if (form.dataset.form === 'agenda') void agendaAdd(form);
      else if (form.dataset.form === 'project') void projectCreate(form);
      else if (form.dataset.form === 'message') void messageSend(form);
    });
  }

  function start(root) {
    $root = root; bind();
    try { const nav = (navigator.language || 'es').slice(0, 2).toLowerCase(); if (LANGS.includes(nav)) S.lang = nav; } catch (_) { /* idioma por defecto */ }
    if (S.mode === 'core') {
      const invite = inviteCodeFromUrl();
      try { if (!S.login.id) S.login.id = localStorage.getItem('janus.work.id') || ''; } catch (_) { /* opcional */ }
      if (invite) void redeemInvite(invite);
      else if (typeof sessionToken === 'function' && sessionToken()) void load(); else render();
    } else void load();
    const veil = () => document.documentElement.classList.toggle('jw-veiled', document.hidden === true);
    document.addEventListener('visibilitychange', veil); window.addEventListener('pagehide', () => document.documentElement.classList.add('jw-veiled')); window.addEventListener('pageshow', veil);
    // Solo refresca los contadores de tiempo; no vuelve a pintar (no interrumpe formularios ni el chat).
    timer = setInterval(() => {
      const s = liveSession(), el = document.getElementById('jw-active');
      if (s && el) el.textContent = fmtDur(s.activeSeconds);
      checkDueReminders();
    }, 30000);
  }
  return { start, state: S, t };
})();
if (typeof document !== 'undefined') {
  const boot = () => JanusWork.start(document.getElementById('app'));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
}
