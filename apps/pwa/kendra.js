/**
 * App de la niña (módulo kid-dashboard). PWA propia: se empareja una vez con un código de papá y habla SOLO con /api/kid/*
 * usando su token propio (kdv_…), nunca con la sesión del Founder.
 *
 * Reglas que cumple esta pantalla (el servidor las impone también; aquí solo se muestran):
 *  · Vídeo: solo los vídeos aprobados por papá, en un iframe youtube-nocookie con sandbox; sin buscador.
 *  · Enlaces: nada de lo que se escanee o se escriba se convierte en enlace pulsable.
 *  · Voz: dictado con el servicio del navegador; lectura en voz alta con la voz LOCAL del aparato (sin nube de pago).
 *  · Todo texto variable entra con textContent (h() de kendra-parent.js), nunca con innerHTML.
 */
import { mountAttachMenu } from './attach.js';
import { h, mountKidParentPanel } from './kendra-parent.js';
import { createApprovedStage, createApprovedAssetControls, initApprovedPresence } from './approved-presence.js';
import { mountLanguageButtons, uiLabel } from './language-buttons.js';

const TOKEN_KEY = 'kendra.device.v1';
const PREF_KEY = 'kendra.prefs.v1';
const ICONS = ['🦄', '🐙', '🦊', '🐱', '🐼', '🐸', '🐰', '🦋', '🌟', '🌈', '🎀', '🚀', '🎵', '🧸', '🍓', '🐬'];
const THEMES = { lila: '#7b5cff', menta: '#1f9d6b', sol: '#e08a00', oceano: '#1c7ed6', rosa: '#d6336c' };
const FEED_LABEL = { oferta: '🏷️ Oferta', evento: '🎪 Evento', peli: '🎬 Peli', producto: '🛍️ Producto', plan: '🗺️ Plan' };
const TABS = [['inicio', '🏠', 'Inicio'], ['chat', '💬', 'Charla'], ['dia', '📒', 'Mi día'], ['ver', '▶️', 'Ver'], ['casa', '💡', 'Casa'], ['cosas', '⭐', 'Mis cosas']];

const app = document.querySelector('#app');
const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;

let token = readStorage(TOKEN_KEY);
let prefs = parseJson(readStorage(PREF_KEY)) ?? { speak: true };
let view = null;
let tab = 'inicio';
let player = null;
let chat = null;
let warnText = '';
let toast = '';
const mainEl = h('main');
let topEl = null;
let navEl = null;

// ── Utilidades ──────────────────────────────────────────────────────────────────────────────────────────────
function readStorage(key) { try { return localStorage.getItem(key) ?? ''; } catch { return ''; } }
function writeStorage(key, value) { try { if (value) localStorage.setItem(key, value); else localStorage.removeItem(key); } catch { /* sin almacenamiento: queda en memoria */ } }
function parseJson(text) { try { return text ? JSON.parse(text) : null; } catch { return null; } }
const savePrefs = () => writeStorage(PREF_KEY, JSON.stringify(prefs));

async function api(method, path, body, headers = {}) {
  try {
    const response = await fetch(path, {
      method,
      cache: 'no-store',
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    let data = {};
    try { data = await response.json(); } catch { data = {}; }
    if (response.status === 401 && token && path.startsWith('/api/kid/') && path !== '/api/kid/redeem') unpair();
    return { status: response.status, body: data };
  } catch {
    return { status: 0, body: { error: 'Parece que no hay internet. Inténtalo en un ratito.' } };
  }
}

function unpair() {
  token = '';
  writeStorage(TOKEN_KEY, '');
  view = null;
  chat = null;
  player = null;
  topEl = null;
  navEl = null;
  renderPair('Este dispositivo ya no está emparejado. Pídele a papá un código nuevo.');
}

function creature() { return view?.creatures?.find((item) => item.id === view.profile.companionId); }

function ymdToday() { return view?.today ?? new Date().toISOString().slice(0, 10); }
function dateLabel(ymd) {
  const today = ymdToday();
  const tomorrow = new Date(`${today}T12:00:00`); tomorrow.setDate(tomorrow.getDate() + 1);
  if (ymd === today) return 'Hoy';
  if (ymd === tomorrow.toLocaleDateString('sv')) return 'Mañana';
  const date = new Date(`${ymd}T12:00:00`);
  return Number.isNaN(date.getTime()) ? ymd : date.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
}
const euros = (cents) => (cents / 100).toLocaleString('es', { style: 'currency', currency: 'EUR' });

function speak(text) {
  if (!prefs.speak || !('speechSynthesis' in window) || !text) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ''));
    utterance.lang = 'es-ES'; utterance.pitch = 1.15; utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
  } catch { /* sin voz local */ }
}

function dictate(input, button) {
  if (!SpeechRecognitionCtor) return;
  try {
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'es-ES'; recognition.interimResults = false; recognition.maxAlternatives = 1;
    button.setAttribute('aria-pressed', 'true');
    recognition.onresult = (event) => { input.value = (input.value ? `${input.value} ` : '') + (event.results[0]?.[0]?.transcript ?? ''); input.focus(); };
    recognition.onend = () => button.setAttribute('aria-pressed', 'false');
    recognition.onerror = () => button.setAttribute('aria-pressed', 'false');
    recognition.start();
  } catch { button.setAttribute('aria-pressed', 'false'); }
}

function micButton(input) {
  if (!SpeechRecognitionCtor) return null;
  const button = h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'Hablar en vez de escribir', 'aria-pressed': 'false' }, '🎤');
  button.addEventListener('click', () => dictate(input, button));
  return button;
}

// ── Emparejamiento ──────────────────────────────────────────────────────────────────────────────────────────
function renderPair(message = '') {
  const code = h('input', { type: 'text', class: 'code', placeholder: 'XXXX-XXXX', maxlength: '9', autocomplete: 'off', autocapitalize: 'characters', 'aria-label': 'Código de papá' });
  const error = h('p', { class: 'err', role: 'alert' }, message);
  const form = h('form', { class: 'pair' },
    h('div', { class: 'avatar', style: 'margin-inline:auto;inline-size:84px;block-size:84px;font-size:48px' }, '🦄'),
    h('h1', {}, '¡Hola! Vamos a conocernos'),
    h('p', { class: 'muted' }, 'Pídele a papá el código para activar tu compañero en este aparato.'),
    code, error,
    h('button', { type: 'submit', class: 'primary' }, 'Activar'));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.textContent = '';
    const result = await api('POST', '/api/kid/redeem', { code: code.value, label: 'Dispositivo de la niña' });
    if (result.status === 201) { token = result.body.token; writeStorage(TOKEN_KEY, token); await start(); }
    else error.textContent = result.body.error || 'No pude activarlo. Inténtalo otra vez.';
  });
  app.replaceChildren(form);
}

// ── Carga y pintado ─────────────────────────────────────────────────────────────────────────────────────────
async function load() {
  const result = await api('GET', '/api/kid/state');
  if (result.status !== 200) {
    if (result.status === 0 && view) return;
    if (result.status !== 401) app.replaceChildren(h('p', { class: 'loading' }, result.body.error || 'No pude cargar. Inténtalo en un ratito.'));
    return;
  }
  view = result.body;
  applyTheme();
  if (!topEl) buildShell(); else { rebuildTop(); if (tab !== 'chat') renderMain(); }
}

function applyTheme() {
  document.documentElement.dataset.theme = view.profile.theme in THEMES ? view.profile.theme : 'lila';
  const pet = creature();
  if (pet) { document.documentElement.style.setProperty('--primary', pet.primary); document.documentElement.style.setProperty('--glow', pet.glow); }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEMES[view.profile.theme] ?? '#7b5cff');
}

function buildShell() {
  topEl = h('header', { class: 'top' });
  navEl = h('nav', { class: 'tabs', 'aria-label': 'Secciones' });
  app.replaceChildren(topEl, mainEl, navEl);
  rebuildTop();
  rebuildNav();
  renderMain();
}

function rebuildTop() {
  const pet = creature();
  const access = view.access;
  const pill = access && access.allowed && access.minutesLeft !== undefined ? h('span', { class: 'pill' }, `⏳ ${access.minutesLeft} min`) : null;
  const languageHost = h('div', { class: 'janus-language-switch' });
  topEl.replaceChildren(...[
    h('button', { type: 'button', class: 'who', onClick: openProfile, 'aria-label': 'Cambiar mi nombre, mi icono o mi compañero' },
      h('span', { class: 'avatar', 'aria-hidden': 'true' }, view.profile.icon),
      h('span', { style: 'min-inline-size:0' }, h('strong', {}, view.profile.displayName), h('small', {}, pet ? `con ${pet.name}` : ''))),
    pill,
    languageHost,
    h('button', { type: 'button', class: 'iconbtn', 'aria-pressed': String(prefs.speak), 'aria-label': uiLabel('kendra', 'voice'), onClick: () => { prefs.speak = !prefs.speak; savePrefs(); if (!prefs.speak) window.speechSynthesis?.cancel(); rebuildTop(); } }, prefs.speak ? '🔊' : '🔇'),
    h('button', { type: 'button', class: 'iconbtn', 'aria-label': uiLabel('kendra', 'parent'), onClick: openParent }, '🔒')].filter(Boolean));
  mountLanguageButtons(languageHost, 'kendra', { onChange: () => { rebuildNav(); rebuildTop(); } });
}

function rebuildNav() {
  const keys = { inicio: 'home', chat: 'chat', dia: 'day', ver: 'watch', casa: 'house', cosas: 'things' };
  navEl.replaceChildren(...TABS.map(([id, icon, label]) => h('button', { type: 'button', 'aria-current': id === tab ? 'page' : null, onClick: () => go(id) }, h('span', { 'aria-hidden': 'true' }, icon), uiLabel('kendra', keys[id], label))));
}

function go(next) {
  tab = next;
  if (tab !== 'ver') player = null;
  rebuildNav();
  renderMain();
  window.scrollTo({ top: 0 });
}

function renderMain() {
  const builders = { inicio: tabInicio, chat: tabChat, dia: tabDia, ver: tabVer, casa: tabCasa, cosas: tabCosas };
  const nodes = [];
  if (warnText) nodes.push(h('p', { class: 'banner', role: 'status' }, warnText));
  if (toast) nodes.push(h('p', { class: 'banner ok', role: 'status' }, toast));
  nodes.push(...[].concat(builders[tab]()));
  mainEl.replaceChildren(...nodes.filter(Boolean));
}

function flash(message) { toast = message; if (tab !== 'chat') renderMain(); setTimeout(() => { if (toast === message) { toast = ''; if (tab !== 'chat') renderMain(); } }, 3500); }

function showLock(message) {
  const overlay = h('div', { class: 'lock', role: 'alertdialog', 'aria-modal': 'true', 'aria-label': 'Aviso' },
    h('div', {}, h('div', { class: 'avatar', style: 'margin-inline:auto;inline-size:72px;block-size:72px;font-size:40px' }, view?.profile.icon ?? '🌙'),
      h('p', {}, message), h('button', { type: 'button', class: 'primary', onClick: () => { overlay.remove(); go('inicio'); } }, 'Vale')));
  document.body.append(overlay);
}

// ── Pestañas ────────────────────────────────────────────────────────────────────────────────────────────────
function tabInicio() {
  const pet = creature();
  const out = [];
  const say = h('p', { class: 'muted' }, pet ? `${pet.name}: «${pet.catchphrase}»` : '');
  const stage = pet
    ? h('button', { type: 'button', class: 'big creature-btn', 'aria-label': `Saludar a ${pet.name}`, onClick: (event) => cheer(event.currentTarget, pet, say) }, createApprovedStage(pet.id))
    : h('div', { class: 'big', 'aria-hidden': 'true' }, view.profile.icon);
  out.push(h('section', { class: 'card hero' }, stage, h('div', {}, h('h2', {}, `¡Hola, ${view.profile.displayName}!`), say)));

  if (view.reminders.length > 0) {
    out.push(h('section', { class: 'card' },
      h('h3', {}, '⏰ Te toca recordar'),
      h('ul', { class: 'list' }, view.reminders.map((item) => h('li', {}, h('span', { class: 'grow' }, item.text)))),
      h('button', { type: 'button', class: 'primary', onClick: async () => { await api('POST', '/api/kid/reminders/ack', { keys: view.reminders.map((item) => item.key) }); await load(); } }, 'Vale, ya lo sé')));
  }

  const access = view.access;
  if (!access.allowed) out.push(h('p', { class: 'banner lock', role: 'status' }, access.message));
  else if (access.warn) out.push(h('p', { class: 'banner', role: 'status' }, access.warn.message));

  out.push(outfitCard());

  out.push(h('section', { class: 'card' },
    h('h3', {}, '📅 Lo que viene'),
    view.agenda.length === 0 ? h('p', { class: 'muted' }, 'No tienes nada apuntado estos días.') : h('ul', { class: 'list' }, view.agenda.slice(0, 5).map((item) => h('li', {}, h('span', { class: 'grow' }, h('strong', {}, item.title), h('br'), h('small', {}, `${dateLabel(item.date)}${item.time ? ` · ${item.time}` : ''}`)))))));

  const pending = [...view.tasks.overdue, ...view.tasks.soon.filter((task) => !view.tasks.overdue.some((late) => late.id === task.id))];
  if (pending.length > 0) {
    out.push(h('section', { class: 'card' },
      h('h3', {}, '✏️ Para ir pensando'),
      h('ul', { class: 'list' }, pending.slice(0, 4).map((task) => h('li', {}, h('span', { class: 'grow' }, task.title, task.due ? h('small', {}, ` · ${dateLabel(task.due)}`) : null))))));
  }
  return out;
}

// Al tocar a la criatura: salta, pone cara de fiesta, dice una de sus frases y la lee con la voz LOCAL (si ella lo tiene activado).
function cheer(button, pet, say) {
  const lines = Array.isArray(pet.catchphrases) && pet.catchphrases.length > 0 ? pet.catchphrases : [pet.catchphrase];
  const next = (Number(say.dataset.i ?? 0) + 1) % lines.length; // la portada muestra la frase 0; cada toque pasa a la siguiente
  say.dataset.i = String(next);
  const line = lines[next];
  say.textContent = `${pet.name}: «${line}»`;
  button.classList.add('is-cheer');
  setTimeout(() => button.classList.remove('is-cheer'), 1400);
  speak(line);
}

function outfitCard() {
  const outfit = view.outfit;
  if (!outfit.configured) return h('section', { class: 'card' }, h('h3', {}, '🌤️ El tiempo'), h('p', { class: 'muted' }, 'Pídele a papá que ponga dónde vives y te digo qué ropa llevar.'));
  if (!outfit.available) return h('section', { class: 'card' }, h('h3', {}, '🌤️ El tiempo'), h('p', { class: 'muted' }, outfit.message));
  const today = outfit.today;
  return h('section', { class: 'card' },
    h('h3', {}, `🌤️ Hoy en ${outfit.place}`),
    today ? h('ul', { class: 'list' }, today.lines.map((line) => h('li', {}, h('span', { class: 'grow' }, line)))) : h('p', { class: 'muted' }, 'No tengo el tiempo de hoy.'),
    today && today.wear.length > 0 ? h('p', {}, h('strong', {}, 'Ponte: '), today.wear.join(', '), today.bring.length > 0 ? ` · Lleva: ${today.bring.join(', ')}` : '') : null,
    outfit.tomorrow ? h('p', { class: 'muted' }, `Mañana: ${outfit.tomorrow.summary}`) : null,
    h('small', { class: 'muted' }, outfit.attribution));
}

// Chat (persistente: no se reconstruye al refrescar datos para no perder lo escrito ni los adjuntos)
function tabChat() {
  if (!chat) chat = buildChat();
  setTimeout(() => { chat.msgs.scrollTop = chat.msgs.scrollHeight; }, 0);
  return chat.root;
}

function buildChat() {
  const msgs = h('div', { class: 'msgs', role: 'log', 'aria-live': 'polite' });
  const pet = creature();
  const add = (who, text) => {
    const bubble = h('div', { class: `msg ${who}` }, text);
    msgs.append(who === 'pet' && pet ? h('div', { class: 'petrow' }, h('span', { class: 'mini', 'aria-hidden': 'true' }, createApprovedStage(pet.id, { compact: true })), bubble) : bubble);
    msgs.scrollTop = msgs.scrollHeight;
  };
  add('pet', `¡Hola, ${view.profile.displayName}! Soy ${pet ? pet.name : 'tu compañero'}. ¿De qué hablamos?`);
  const attachHost = h('div');
  const input = h('input', { type: 'text', placeholder: 'Escribe o dicta…', maxlength: '500', autocomplete: 'off', 'aria-label': 'Mensaje' });
  const send = h('button', { type: 'submit', class: 'primary' }, 'Enviar');
  const mic = micButton(input);
  const form = h('form', { class: 'composer' }, attachHost, h('div', { class: 'row' }, input, mic, send));
  const attach = mountAttachMenu({ host: attachHost, profile: 'kid', uploadUrl: '/api/kid/attachments', headers: () => ({ authorization: `Bearer ${token}` }) });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    const attachments = attach.getAttachments();
    const scans = attach.getScans();
    add('kid', attachments.length + scans.length > 0 ? `${text}  📎${attachments.length + scans.length}` : text);
    input.value = '';
    send.disabled = true;
    const body = { text, ...(attachments.length + scans.length > 0 ? { attachments: attachments.map((item) => item.id), scans: scans.map((item) => ({ raw: item.raw, ...(item.format ? { format: item.format } : {}) })) } : {}) };
    const result = await api('POST', '/api/kid/chat', body);
    attach.clear();
    send.disabled = false;
    if (result.status === 200) {
      add('pet', result.body.reply);
      speak(result.body.reply);
      if (result.body.blocked === 'access') showLock(result.body.reply);
    } else add('pet', result.body.error || 'Uy, no pude responder. ¿Lo intentamos otra vez?');
  });
  const root = h('div', { class: 'chat' }, h('div', { class: 'card' }, msgs), form);
  return { root, msgs };
}

function tabDia() {
  const out = [];
  const agendaInput = h('input', { type: 'text', placeholder: 'Ej.: el sábado tengo el cumple de mi prima', maxlength: '120', 'aria-label': 'Apuntar en mi agenda' });
  const agendaMsg = h('p', { class: 'err', role: 'alert' });
  const agendaForm = h('form', { class: 'row' }, agendaInput, micButton(agendaInput), h('button', { type: 'submit', class: 'primary' }, 'Apuntar'));
  agendaForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!agendaInput.value.trim()) return;
    const result = await api('POST', '/api/kid/agenda', { text: agendaInput.value });
    if (result.status === 201) { flash('¡Apuntado! Te lo recordaré. ✨'); await load(); } else agendaMsg.textContent = result.body.error || 'No pude apuntarlo.';
  });
  out.push(h('section', { class: 'card' },
    h('h2', {}, '📅 Mi agenda'),
    view.agenda.length === 0 ? h('p', { class: 'muted' }, 'Todavía no hay nada. ¡Apunta algo!') : h('ul', { class: 'list' }, view.agenda.map((item) => h('li', {},
      h('span', { class: 'grow' }, h('strong', {}, item.title), h('br'), h('small', {}, `${dateLabel(item.date)}${item.time ? ` · ${item.time}` : ''}`)),
      h('button', { type: 'button', 'aria-label': `Ya pasó: ${item.title}`, onClick: async () => { await api('POST', `/api/kid/agenda/${item.id}/done`, {}); await load(); } }, '✔')))),
    agendaForm, agendaMsg));

  const lateIds = new Set(view.tasks.overdue.map((task) => task.id));
  const taskInput = h('input', { type: 'text', placeholder: 'Ej.: terminar el dibujo', maxlength: '100', 'aria-label': 'Nueva tarea' });
  const taskDue = h('input', { type: 'date', 'aria-label': 'Para qué día' });
  const taskMsg = h('p', { class: 'err', role: 'alert' });
  const taskForm = h('form', { class: 'row' }, taskInput, taskDue, h('button', { type: 'submit', class: 'primary' }, 'Añadir'));
  taskForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!taskInput.value.trim()) return;
    const result = await api('POST', '/api/kid/tasks', { title: taskInput.value, ...(taskDue.value ? { due: taskDue.value } : {}) });
    if (result.status === 201) { flash('Tarea añadida.'); await load(); } else taskMsg.textContent = result.body.error || 'No pude añadirla.';
  });
  out.push(h('section', { class: 'card' },
    h('h2', {}, '✏️ Mis tareas'),
    view.tasks.all.length === 0 ? h('p', { class: 'muted' }, '¡Nada pendiente! 🎉') : h('ul', { class: 'list' }, view.tasks.all.map((task) => h('li', { style: 'align-items:flex-start;flex-wrap:wrap' },
      h('label', { class: 'check grow' },
        h('input', { type: 'checkbox', onChange: async () => { await api('POST', `/api/kid/tasks/${task.id}/status`, { status: 'hecha' }); flash('¡Bien hecho! 🎉'); await load(); } }),
        h('span', {}, task.title, task.due ? h('small', {}, ` · ${dateLabel(task.due)}${lateIds.has(task.id) ? ' (¡ya pasó!)' : ''}`) : null)),
      task.steps && task.steps.length > 0 ? h('ul', { class: 'list', style: 'inline-size:100%' }, task.steps.map((step, index) => h('li', {},
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: step.done, onChange: async () => { await api('POST', `/api/kid/tasks/${task.id}/step`, { index }); await load(); } }), h('span', { class: step.done ? 'done' : '' }, step.text))))) : null))),
    taskForm, taskMsg));

  const projectInput = h('input', { type: 'text', placeholder: 'Ej.: maqueta del sistema solar', maxlength: '60', 'aria-label': 'Nuevo proyecto' });
  const projectForm = h('form', { class: 'row' }, projectInput, h('button', { type: 'submit', class: 'primary' }, 'Crear'));
  projectForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!projectInput.value.trim()) return;
    const result = await api('POST', '/api/kid/projects', { title: projectInput.value });
    if (result.status === 201) { flash('Proyecto creado.'); await load(); }
  });
  out.push(h('section', { class: 'card' },
    h('h2', {}, '🧩 Mis proyectos'),
    view.projects.length === 0 ? h('p', { class: 'muted' }, 'Aquí van tus proyectos del cole o los tuyos.') : h('ul', { class: 'list' }, view.projects.map((project) => h('li', { style: 'display:grid' },
      h('strong', {}, `${project.emoji ?? '🧩'} ${project.title}`),
      h('div', { class: 'bar', role: 'progressbar', 'aria-valuenow': String(project.progress.percent), 'aria-valuemin': '0', 'aria-valuemax': '100' }, h('i', { style: `inline-size:${project.progress.percent}%` })),
      h('small', {}, `${project.progress.done} de ${project.progress.total} tareas`)))),
    projectForm));
  return out;
}

function stopPlayer() { player = null; }

function tabVer() {
  const out = [];
  const status = h('p', { class: 'muted', role: 'status' });
  const input = h('input', { type: 'text', placeholder: '¿Qué quieres ver? (ej.: videos de baile)', maxlength: '120', 'aria-label': '¿Qué quieres ver?' });
  const form = h('form', { class: 'row' }, input, micButton(input), h('button', { type: 'submit', class: 'primary' }, 'Pedir'));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!input.value.trim()) return;
    const result = await api('POST', '/api/kid/media', { text: input.value });
    status.textContent = result.body.message || result.body.error || '';
    if (result.status === 200 && result.body.status === 'allow' && result.body.videos?.length === 1) open(result.body.videos[0]);
  });
  async function open(video) {
    const check = await api('POST', '/api/kid/media', { text: 'ponme youtube' });
    if (check.status === 200 && check.body.status === 'allow') { player = video; renderMain(); }
    else { status.textContent = check.body.message || 'Ahora no se puede.'; if (check.body.status === 'blocked') showLock(check.body.message); }
  }
  if (player) {
    out.push(h('section', { class: 'card' },
      h('h2', {}, player.label),
      h('div', { class: 'player' }, h('iframe', { src: player.embedUrl, title: player.label, allow: 'encrypted-media; picture-in-picture', referrerpolicy: 'strict-origin-when-cross-origin', sandbox: 'allow-scripts allow-same-origin allow-presentation', allowfullscreen: true, loading: 'lazy' })),
      h('button', { type: 'button', onClick: () => { stopPlayer(); renderMain(); } }, 'Cerrar el vídeo')));
  }
  out.push(h('section', { class: 'card' },
    h('h2', {}, '▶️ Vídeos para ti'),
    view.videos.length === 0
      ? h('p', { class: 'muted' }, 'Papá todavía no ha elegido vídeos. Pídele alguno y él lo mira antes. 💜')
      : h('ul', { class: 'list' }, view.videos.map((video) => h('li', {}, h('button', { type: 'button', class: 'vid', onClick: () => open(video) }, h('span', { 'aria-hidden': 'true' }, '▶️'), h('span', {}, video.label))))),
    form, status,
    h('p', { class: 'muted' }, 'Si pides algo nuevo, papá recibe el aviso y decide si lo añade.')));
  return out;
}

function tabCasa() {
  const status = h('p', { class: 'muted', role: 'status', 'aria-live': 'polite' });
  async function run(text) {
    status.textContent = '…';
    const result = await api('POST', '/api/kid/home', { text });
    status.textContent = result.body.message || result.body.summary || result.body.error || 'Hecho.';
    if (result.body.status === 'blocked') showLock(result.body.message);
  }
  const input = h('input', { type: 'text', placeholder: 'Ej.: apaga la luz de la cama', maxlength: '120', 'aria-label': 'Qué quieres hacer en la casa' });
  const form = h('form', { class: 'row' }, input, micButton(input), h('button', { type: 'submit', class: 'primary' }, 'Hacer'));
  form.addEventListener('submit', (event) => { event.preventDefault(); if (input.value.trim()) { run(input.value); input.value = ''; } });
  const quick = [['💡 Prende la luz', 'prende la luz'], ['🌙 Apaga la luz', 'apaga la luz'], ['🌀 Enciende el ventilador', 'enciende el ventilador'], ['🥵 Hace calor: apaga la calefacción', 'apaga la calefacción']];
  return [h('section', { class: 'card' },
    h('h2', {}, '🏠 La casa'),
    view.home.enabled ? null : h('p', { class: 'banner' }, 'Papá todavía no ha activado la casa para ti.'),
    h('div', { class: 'quick' }, quick.map(([label, command]) => h('button', { type: 'button', disabled: !view.home.enabled, onClick: () => run(command) }, label))),
    form, status,
    view.home.devices.length > 0 ? h('p', { class: 'muted' }, `Puedo ayudarte con: ${view.home.devices.join(', ')}.`) : null,
    h('p', { class: 'muted' }, 'Las puertas, las alarmas y la cocina nunca las toco: eso es de papá.'))];
}

function tabCosas() {
  const out = [];
  const input = h('input', { type: 'text', placeholder: 'Ej.: Minecraft', maxlength: '30', 'aria-label': 'Nuevo interés' });
  const form = h('form', { class: 'row' }, input, h('button', { type: 'submit', class: 'primary' }, 'Añadir'));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!input.value.trim()) return;
    const result = await api('POST', '/api/kid/interests', { label: input.value });
    if (result.status === 201) { flash('¡Anotado! ⭐'); await load(); }
  });
  out.push(h('section', { class: 'card' },
    h('h2', {}, '⭐ Lo que me gusta'),
    h('div', { class: 'chips' }, view.interests.map((item) => h('span', { class: 'chip' }, item.label))),
    form));
  out.push(h('section', { class: 'card' },
    h('h2', {}, '🎈 Planes y ofertas para ti'),
    view.feed.length === 0 ? h('p', { class: 'muted' }, 'Cuando papá apruebe planes, ofertas o pelis, aparecerán aquí.') : h('ul', { class: 'list' }, view.feed.map((item) => h('li', { style: 'display:grid' },
      h('strong', {}, `${FEED_LABEL[item.kind] ?? item.kind} · ${item.title}`),
      h('small', {}, [item.place, item.from ? `desde ${dateLabel(item.from)}` : null, item.until ? `hasta ${dateLabel(item.until)}` : null, item.priceCents !== undefined ? euros(item.priceCents) : null].filter(Boolean).join(' · '))))),
    h('p', { class: 'muted' }, 'Papá mira todo esto antes de que lo veas. 💜')));
  return out;
}

// ── Personalizar (lo que ELLA puede cambiar) ────────────────────────────────────────────────────────────────
function openProfile() {
  const draft = { ...view.profile };
  const name = h('input', { type: 'text', value: draft.displayName, maxlength: '20', 'aria-label': 'Mi nombre' });
  const error = h('p', { class: 'err', role: 'alert' });
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Personalizar' });
  const icons = h('div', { class: 'icons' }, ICONS.map((icon) => h('button', { type: 'button', 'aria-pressed': String(icon === draft.icon), 'aria-label': `Icono ${icon}`, onClick: (event) => { draft.icon = icon; icons.querySelectorAll('button').forEach((button) => button.setAttribute('aria-pressed', String(button === event.currentTarget))); } }, icon)));
  const themes = h('div', { class: 'themes' }, Object.entries(THEMES).map(([id, color]) => h('button', { type: 'button', style: `background:${color}`, 'aria-label': `Color ${id}`, 'aria-pressed': String(id === draft.theme), onClick: (event) => { draft.theme = id; themes.querySelectorAll('button').forEach((button) => button.setAttribute('aria-pressed', String(button === event.currentTarget))); } })));
  const creatures = h('div', { class: 'creatures' }, (view.creatures ?? []).map((item) => h('button', { type: 'button', 'aria-pressed': String(item.id === draft.companionId), onClick: (event) => { draft.companionId = item.id; creatures.querySelectorAll('button').forEach((button) => button.setAttribute('aria-pressed', String(button === event.currentTarget))); } }, createApprovedStage(item.id, { compact: true }), h('strong', {}, item.name), h('small', {}, item.catchphrase))));
  sheet.append(h('div', {},
    h('h2', {}, 'Hazlo tuyo'),
    h('label', {}, 'Mi nombre', name), h('p', {}, 'Mi icono'), icons, h('p', {}, 'Mi color'), themes, h('p', {}, 'Mi compañero'), creatures, error,
    h('div', { class: 'row' },
      h('button', { type: 'button', class: 'primary', onClick: async () => {
        const result = await api('PUT', '/api/kid/profile', { displayName: name.value, icon: draft.icon, theme: draft.theme, companionId: draft.companionId });
        if (result.status === 200) { sheet.remove(); chat = null; await load(); flash('¡Listo! Ahora es todo tuyo. 🌈'); } else error.textContent = result.body.error || 'No pude guardarlo.';
      } }, 'Guardar'),
      h('button', { type: 'button', onClick: () => sheet.remove() }, 'Cancelar'))));
  document.body.append(sheet);
}

// ── Zona de padres (PIN) ────────────────────────────────────────────────────────────────────────────────────
function openParent() {
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Zona de padres' });
  const body = h('div');
  sheet.append(body);
  let timer = 0;
  const close = () => { clearTimeout(timer); sheet.remove(); };
  const pin = h('input', { type: 'password', class: 'pin', inputmode: 'numeric', pattern: '[0-9]*', maxlength: '8', autocomplete: 'off', 'aria-label': 'PIN de padres' });
  const error = h('p', { class: 'err', role: 'alert' });
  const form = h('form', { class: 'pair', style: 'min-block-size:0;padding:8px' },
    h('h2', {}, '🔒 Zona de padres'), h('p', { class: 'muted' }, 'Escribe el PIN.'), pin, error,
    h('div', { class: 'row' }, h('button', { type: 'submit', class: 'primary' }, 'Entrar'), h('button', { type: 'button', onClick: close }, 'Volver')));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const result = await api('POST', '/api/kid/parent/unlock', { pin: pin.value });
    pin.value = '';
    if (result.status !== 200) { error.textContent = result.body.error || 'No se pudo abrir.'; return; }
    const unlockToken = result.body.unlockToken;
    timer = setTimeout(close, Math.max(10_000, new Date(result.body.expiresAt).getTime() - Date.now()));
    const host = h('div');
    body.replaceChildren(host);
    mountKidParentPanel(host, { mode: 'pin', onClose: close, request: (method, path, payload) => api(method, path, payload, { 'x-janus-parent-unlock': unlockToken }) });
    // Importación offline de originales verificados, solo después de validar PIN.
    host.append(createApprovedAssetControls({ family: 'kendra' }));
  });
  body.append(form);
  document.body.append(sheet);
  pin.focus();
}

// ── Actividad (tiempo por actividad, avisos antes del corte) ───────────────────────────────────────────────
function currentCategory() {
  if (!view || document.visibilityState !== 'visible') return null;
  if (tab === 'chat') return 'chat';
  if (tab === 'ver' && player) return 'youtube';
  if (tab === 'cosas') return 'interests';
  if (tab === 'dia') return 'school';
  return null;
}

async function heartbeat() {
  const category = currentCategory();
  if (!category) return;
  const result = await api('POST', '/api/kid/activity', { category, seconds: 30 });
  if (result.status !== 200) return;
  const access = result.body.access;
  if (!access.allowed) { stopPlayer(); showLock(access.message); return; }
  const next = access.warn ? access.warn.message : '';
  if (next !== warnText) { warnText = next; if (tab !== 'chat') renderMain(); }
}

async function start() {
  if (!token) { renderPair(); return; }
  await load();
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => { /* sin trabajador de servicio: funciona igual con conexión */ });
setInterval(heartbeat, 30_000);
setInterval(() => { if (document.visibilityState === 'visible' && view && tab !== 'chat') load(); }, 5 * 60_000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && token) load(); });
void initApprovedPresence();
start();
