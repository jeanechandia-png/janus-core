// Panel del Founder ("Inicio"): una sola vista para la mañana. Solo lectura.
// Identidad: mockups Janus aprobados (sept. 2026) — negro profundo, oro cálido,
// mayúsculas romanas, medallón de dos caras con eje de luz.
// Nunca muestra cifras que el servidor no haya observado.
import { authHeaders, sessionToken } from './founder-session.js';

const STATE_TEXT = {
  live: 'Comprobado',
  declared: 'Declarado por ti',
  unconfigured: 'Falta configurar',
  pending: 'Pendiente',
  error: 'Sin respuesta',
};

const SCOPE = {
  work: { title: 'Empresa', empty: 'Sin citas de la empresa hoy.' },
  personal: { title: 'Personal', empty: 'Sin citas personales hoy.' },
};

// Iconos de línea propios (trazo dorado), sin dependencias externas.
const ICON = {
  approval: '<path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5"/><circle cx="12" cy="16.5" r=".6" fill="currentColor"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l2.5 2.5M14 9l2 2"/>',
  chevron: '<path d="M9.5 6l6 6-6 6"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21"/>',
  refresh: '<path d="M19.5 12a7.5 7.5 0 11-2.2-5.3"/><path d="M19.5 4v4.5H15"/>',
};

let root;
let timer;
let onOpenWork = () => {};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function icon(name, className = 'jd-ico') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', className);
  svg.innerHTML = ICON[name]; // constantes locales, nunca datos externos
  return svg;
}

function panel(className, title, subtitle) {
  const section = el('section', `jd-panel ${className}`);
  const head = el('header', 'jd-panel-head');
  const h = el('h3', null, title);
  h.id = `${className}-title`;
  section.setAttribute('aria-labelledby', h.id);
  head.append(h);
  if (subtitle) head.append(el('p', 'jd-panel-sub', subtitle));
  section.append(head);
  return section;
}

function longDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  const text = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function greeting(timeZone) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone }).format(new Date()));
  if (hour < 12) return 'Buenos días, Patrón.';
  if (hour < 20) return 'Buenas tardes, Patrón.';
  return 'Buenas noches, Patrón.';
}

function eventTime(event, timeZone) {
  if (event.allDay) return 'Día';
  return new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit', timeZone }).format(new Date(event.start));
}

function renderHero(snapshot) {
  const hero = el('section', 'jd-hero');
  const medal = el('figure', 'jd-medal');
  const img = el('img');
  img.src = '/icons/janus-icon-512.png';
  img.alt = '';
  img.width = 512;
  img.height = 512;
  img.decoding = 'async';
  medal.append(img, el('span', 'jd-medal-axis'), el('span', 'jd-medal-halo'));
  medal.setAttribute('aria-hidden', 'true');
  const words = el('div', 'jd-greet');
  words.append(el('h2', null, greeting(snapshot.timeZone)));
  words.append(el('p', null, `${longDate(snapshot.date)}. Aquí está lo importante hoy.`));
  hero.append(medal, words);
  return hero;
}

function renderToday(snapshot) {
  const count = snapshot.attention.length;
  const section = panel('jd-today', 'Hoy', count === 0 ? 'Nada urgente' : `${count} ${count === 1 ? 'prioridad' : 'prioridades'}`);
  if (count === 0) {
    section.append(el('p', 'jd-calm', 'Todo lo que Janus pudo comprobar está en orden.'));
    return section;
  }
  const list = el('ul', 'jd-rows');
  for (const item of snapshot.attention) {
    const isApproval = /visto bueno/.test(item.text);
    const kind = isApproval ? 'approval' : /cita/.test(item.text) ? 'calendar' : /llave/.test(item.text) ? 'key' : 'alert';
    const row = el(isApproval ? 'button' : 'div', `jd-row jd-row-${item.level}`);
    if (isApproval) { row.type = 'button'; row.addEventListener('click', () => onOpenWork()); }
    const badge = el('span', `jd-row-badge jd-badge-${kind}`);
    badge.append(icon(kind));
    const text = el('span', 'jd-row-text', item.text);
    row.append(badge, text);
    if (isApproval) row.append(icon('chevron', 'jd-ico jd-chev'));
    const li = el('li');
    li.append(row);
    list.append(li);
  }
  section.append(list);
  return section;
}

function renderFace(block, timeZone) {
  const face = el('div', `jd-face jd-face-${block.scope}`);
  const head = el('div', 'jd-face-head');
  head.append(el('h4', null, SCOPE[block.scope].title));
  if (block.state === 'live') head.append(el('span', 'jd-face-count', `${block.today.length} hoy`));
  face.append(head);
  if (block.state !== 'live') {
    face.append(el('p', `jd-note jd-note-${block.state}`, block.reason ?? STATE_TEXT[block.state]));
    return face;
  }
  if (block.today.length === 0) face.append(el('p', 'jd-note', SCOPE[block.scope].empty));
  else {
    const list = el('ol', 'jd-agenda');
    for (const event of block.today) {
      const li = el('li');
      const time = el('time', null, eventTime(event, timeZone));
      time.dateTime = event.start;
      const body = el('span', 'jd-agenda-body');
      body.append(el('span', 'jd-agenda-title', event.title));
      if (event.location) body.append(el('span', 'jd-agenda-place', event.location));
      li.append(time, body);
      list.append(li);
    }
    face.append(list);
  }
  if (block.tomorrow.length > 0) {
    face.append(el('p', 'jd-tomorrow', `Mañana ${block.tomorrow.length}: «${block.tomorrow[0].title}»${block.tomorrow.length > 1 ? ' y más' : ''}.`));
  }
  return face;
}

function renderAgenda(snapshot) {
  const section = panel('jd-agenda-panel', 'Agenda', 'Empresa y personal, sin mezclar');
  const faces = el('div', 'jd-faces');
  const axis = el('span', 'jd-axis');
  axis.setAttribute('aria-hidden', 'true');
  faces.append(renderFace(snapshot.agenda.work, snapshot.timeZone), axis, renderFace(snapshot.agenda.personal, snapshot.timeZone));
  section.append(faces);
  return section;
}

function renderGroup(snapshot) {
  const live = snapshot.products.filter((product) => product.state === 'live').length;
  const section = panel('jd-group', 'Infinity Seed Group', `${live} de ${snapshot.products.length} comprobados ahora`);
  const list = el('ul', 'jd-products');
  for (const product of snapshot.products) {
    const li = el('li', `jd-product jd-s-${product.state}`);
    const dot = el('span', 'jd-dot');
    dot.setAttribute('aria-hidden', 'true');
    const main = el('div', 'jd-product-main');
    const top = el('div', 'jd-product-top');
    top.append(el('span', 'jd-product-name', product.name), el('span', 'jd-product-state', STATE_TEXT[product.state]));
    main.append(top);
    const facts = [];
    if (product.declared) facts.push(`Tú: ${product.declared.label.toLowerCase()}`);
    for (const probe of product.probes) facts.push(`${probe.label.replace(/^Asistente landing\./, 'Asistente ')}: ${probe.detail ?? STATE_TEXT[probe.state]}`);
    main.append(el('p', 'jd-product-facts', facts.length ? facts.join(' · ') : product.summary));
    li.append(dot, main);
    list.append(li);
  }
  section.append(list);
  return section;
}

function renderSales(snapshot) {
  const section = panel('jd-sales', 'Ventas e ingresos', 'En euros');
  if (snapshot.sales.today == null) {
    const empty = el('div', 'jd-sales-empty');
    empty.append(el('span', 'jd-sales-dash', '— €'));
    empty.append(el('p', null, snapshot.sales.reason));
    section.append(empty);
  } else {
    const fmt = new Intl.NumberFormat('es-ES', { style: 'currency', currency: snapshot.sales.currency });
    const figures = el('dl', 'jd-figures');
    for (const [term, value] of [['Hoy', snapshot.sales.today], ['Este mes', snapshot.sales.month ?? 0]]) {
      const pair = el('div');
      pair.append(el('dt', null, term), el('dd', null, fmt.format(value)));
      figures.append(pair);
    }
    section.append(figures);
  }
  return section;
}

function renderSystem(snapshot) {
  const section = panel('jd-system', 'Estado de Janus', 'Este equipo, ahora');
  const stats = el('dl', 'jd-stats');
  const add = (term, value, state) => {
    const pair = el('div', `jd-stat${state ? ` jd-s-${state}` : ''}`);
    pair.append(el('dt', null, term), el('dd', null, value));
    stats.append(pair);
  };
  add('Por aprobar', String(snapshot.janus.approvalsPending), snapshot.janus.approvalsPending > 0 ? 'pending' : 'live');
  add('Capacidades', `${snapshot.janus.capabilities.available}/${snapshot.janus.capabilities.total}`);
  const c = snapshot.janus.confidence;
  add('Confianza', c && c.samples > 0 ? `${Math.round(c.value * 100)} %` : 'Neutral');
  section.append(stats);

  const present = snapshot.integrations.filter((row) => row.state === 'key_present').length;
  const keys = el('details', 'jd-keys');
  const summary = el('summary');
  summary.append(icon('key'), el('span', null, `Llaves ${present} de ${snapshot.integrations.length}`), el('span', 'jd-keys-hint', 'ninguna validada aún en real'));
  keys.append(summary);
  const chips = el('ul', 'jd-chips');
  for (const row of snapshot.integrations) {
    const chip = el('li', row.state === 'key_present' ? 'on' : 'off', row.name);
    chip.title = row.state === 'key_present' ? 'Llave presente, sin validar en real' : 'Sin llave';
    chips.append(chip);
  }
  keys.append(chips);
  section.append(keys);
  return section;
}

function render(snapshot) {
  const frame = el('div', 'jd');
  const brand = el('header', 'jd-brand');
  brand.append(el('span', 'jd-word', 'Janus'), el('span', 'jd-brand-sub', 'Centro de mando'));
  frame.append(brand, renderHero(snapshot));

  const grid = el('div', 'jd-grid');
  grid.append(renderToday(snapshot), renderAgenda(snapshot), renderGroup(snapshot), renderSales(snapshot), renderSystem(snapshot));
  frame.append(grid);

  const voice = el('button', 'jd-voice');
  voice.type = 'button';
  const ring = el('span', 'jd-voice-ring');
  ring.append(icon('mic'));
  voice.append(ring, el('span', null, 'Habla con Janus'));
  voice.addEventListener('click', () => onOpenWork());
  frame.append(voice);

  const foot = el('footer', 'jd-foot');
  const at = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit', timeZone: snapshot.timeZone }).format(new Date(snapshot.generatedAt));
  foot.append(el('span', 'jd-motto', 'Privado · local · tuyo'));
  const refresh = el('button', 'jd-refresh');
  refresh.type = 'button';
  refresh.append(icon('refresh'), el('span', null, `Actualizado ${at}`));
  refresh.addEventListener('click', () => loadDashboard(true));
  foot.append(refresh);
  frame.append(foot);

  root.replaceChildren(frame);
}

function renderMessage(text, action) {
  const frame = el('div', 'jd jd-locked');
  const brand = el('header', 'jd-brand');
  brand.append(el('span', 'jd-word', 'Janus'), el('span', 'jd-brand-sub', 'Centro de mando'));
  const medal = el('figure', 'jd-medal jd-medal-solo');
  const img = el('img');
  img.src = '/icons/janus-icon-512.png';
  img.alt = '';
  medal.append(img, el('span', 'jd-medal-axis'), el('span', 'jd-medal-halo'));
  medal.setAttribute('aria-hidden', 'true');
  const box = el('div', 'jd-locked-box');
  box.append(el('p', null, text));
  if (action) {
    const button = el('button', 'jd-cta', action.label);
    button.type = 'button';
    button.addEventListener('click', action.run);
    box.append(button);
  }
  frame.append(brand, medal, box);
  root.replaceChildren(frame);
}

export async function loadDashboard(force = false) {
  if (!root) return;
  clearTimeout(timer);
  if (!sessionToken()) {
    renderMessage('Tu centro de mando es privado. Entra como Founder para verlo.', { label: 'Entrar como Founder', run: () => onOpenWork() });
    return;
  }
  root.setAttribute('aria-busy', 'true');
  try {
    const response = await fetch(`/api/dashboard${force ? '?refresh=1' : ''}`, { headers: authHeaders(), cache: 'no-store' });
    if (response.status === 401 || response.status === 403) {
      renderMessage('Tu sesión de Founder caducó. Vuelve a entrar para ver tu centro de mando.', { label: 'Entrar como Founder', run: () => onOpenWork() });
      return;
    }
    const data = await response.json();
    if (!response.ok || !data.dashboard) throw new Error(data.error ?? `HTTP ${response.status}`);
    render(data.dashboard);
  } catch (error) {
    renderMessage(`No se pudo cargar el panel (${error?.message ?? error}). Comprueba que Janus está encendido.`, { label: 'Reintentar', run: () => loadDashboard(true) });
  } finally {
    root.removeAttribute('aria-busy');
  }
  if (document.visibilityState === 'visible') timer = setTimeout(() => loadDashboard(false), 60_000);
}

export function mountDashboard(element, options = {}) {
  root = element;
  onOpenWork = options.onOpenWork ?? onOpenWork;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !root.hidden) loadDashboard(false);
  });
}

export function stopDashboard() {
  clearTimeout(timer);
}
