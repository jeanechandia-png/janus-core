// Panel del Founder: una sola vista para la mañana. Solo lectura.
// Nunca muestra cifras que el servidor no haya observado.
import { authHeaders, sessionToken } from './founder-session.js';

const STATE_TEXT = {
  live: 'Comprobado ahora',
  declared: 'Declarado por ti',
  unconfigured: 'Falta configurar',
  pending: 'Pendiente',
  error: 'No se pudo comprobar',
};

const SCOPE_TEXT = {
  work: { title: 'Empresa', empty: 'Sin citas de la empresa hoy.' },
  personal: { title: 'Personal', empty: 'Sin citas personales hoy.' },
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

function formatLongDate(isoDate, timeZone) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  const weekday = new Intl.DateTimeFormat('es', { weekday: 'long', timeZone: 'UTC' }).format(date);
  const rest = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(date);
  return { weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1), rest, timeZone };
}

function greeting(timeZone) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone }).format(new Date()));
  if (hour < 12) return 'Buenos días, Patrón';
  if (hour < 20) return 'Buenas tardes, Patrón';
  return 'Buenas noches, Patrón';
}

function eventTime(event, timeZone) {
  if (event.allDay) return 'Todo el día';
  return new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit', timeZone }).format(new Date(event.start));
}

function renderAgendaFace(block, timeZone) {
  const face = el('section', `face face-${block.scope}`);
  face.setAttribute('aria-labelledby', `face-${block.scope}`);
  const head = el('header', 'face-head');
  const title = el('h3', null, SCOPE_TEXT[block.scope].title);
  title.id = `face-${block.scope}`;
  head.append(title);
  if (block.state === 'live') head.append(el('span', 'face-count', `${block.today.length} hoy`));
  face.append(head);

  if (block.state !== 'live') {
    face.append(el('p', `face-note state-${block.state}`, `${STATE_TEXT[block.state]}. ${block.reason ?? ''}`.trim()));
    return face;
  }
  if (block.today.length === 0) {
    face.append(el('p', 'face-note', SCOPE_TEXT[block.scope].empty));
  } else {
    const list = el('ol', 'agenda');
    for (const event of block.today) {
      const item = el('li', 'agenda-item');
      const time = el('time', 'agenda-time', eventTime(event, timeZone));
      time.dateTime = event.start;
      const body = el('div', 'agenda-body');
      body.append(el('span', 'agenda-title', event.title));
      if (event.location) body.append(el('span', 'agenda-place', event.location));
      item.append(time, body);
      list.append(item);
    }
    face.append(list);
  }
  if (block.tomorrow.length > 0) {
    face.append(el('p', 'face-tomorrow', `Mañana: ${block.tomorrow.length} ${block.tomorrow.length === 1 ? 'cita' : 'citas'}, la primera «${block.tomorrow[0].title}».`));
  }
  return face;
}

function renderProduct(product) {
  const row = el('li', `product state-${product.state}`);
  const pip = el('span', 'pip');
  pip.setAttribute('aria-hidden', 'true');
  const main = el('div', 'product-main');
  const name = el('span', 'product-name', product.name);
  const summary = el('span', 'product-summary', product.summary);
  main.append(name, summary);
  const facts = el('ul', 'product-facts');
  if (product.declared) {
    facts.append(el('li', 'fact-declared', `Tú: ${product.declared.label.toLowerCase()} (${product.declared.at})`));
  }
  for (const probe of product.probes) {
    facts.append(el('li', `fact state-${probe.state}`, `${probe.label}: ${probe.detail ?? STATE_TEXT[probe.state]}`));
  }
  if (facts.childElementCount > 0) main.append(facts);
  const status = el('span', 'product-state', STATE_TEXT[product.state]);
  row.append(pip, main, status);
  return row;
}

function render(snapshot) {
  root.replaceChildren();
  const tz = snapshot.timeZone;
  const date = formatLongDate(snapshot.date, tz);

  const hero = el('header', 'dash-hero');
  hero.append(el('p', 'dash-greeting', greeting(tz)));
  const h = el('h2', 'dash-date');
  h.append(el('span', 'dash-weekday', date.weekday), el('span', 'dash-day', date.rest));
  hero.append(h);
  root.append(hero);

  const attention = el('section', 'attention');
  attention.setAttribute('aria-label', 'Lo que necesita tu atención');
  if (snapshot.attention.length === 0) {
    attention.append(el('p', 'attention-calm', 'Nada urgente. Todo lo comprobado está en orden.'));
  } else {
    const list = el('ul', 'attention-list');
    for (const item of snapshot.attention) list.append(el('li', `attention-${item.level}`, item.text));
    attention.append(list);
    if (snapshot.janus.approvalsPending > 0) {
      const go = el('button', 'primary attention-go', 'Revisar aprobaciones');
      go.type = 'button';
      go.addEventListener('click', () => onOpenWork());
      attention.append(go);
    }
  }
  root.append(attention);

  const agenda = el('section', 'two-faces');
  agenda.setAttribute('aria-label', 'Agenda de hoy');
  agenda.append(renderAgendaFace(snapshot.agenda.work, tz));
  const axis = el('div', 'axis');
  axis.setAttribute('aria-hidden', 'true');
  agenda.append(axis, renderAgendaFace(snapshot.agenda.personal, tz));
  root.append(agenda);

  const group = el('section', 'group');
  group.setAttribute('aria-labelledby', 'groupTitle');
  const groupTitle = el('h3', 'dash-h', 'Infinity Seed Group');
  groupTitle.id = 'groupTitle';
  group.append(groupTitle);
  const products = el('ul', 'products');
  for (const product of snapshot.products) products.append(renderProduct(product));
  group.append(products);

  const sales = el('div', `sales state-${snapshot.sales.state}`);
  sales.append(el('span', 'sales-label', 'Ventas e ingresos'));
  if (snapshot.sales.today == null) {
    sales.append(el('span', 'sales-reason', snapshot.sales.reason));
  } else {
    const fmt = new Intl.NumberFormat('es-ES', { style: 'currency', currency: snapshot.sales.currency });
    sales.append(el('span', 'sales-value', `Hoy ${fmt.format(snapshot.sales.today)} · mes ${fmt.format(snapshot.sales.month ?? 0)}`));
  }
  group.append(sales);
  root.append(group);

  const janus = el('section', 'janus-line');
  janus.setAttribute('aria-labelledby', 'janusTitle');
  const janusTitle = el('h3', 'dash-h', 'Janus');
  janusTitle.id = 'janusTitle';
  janus.append(janusTitle);
  const stats = el('dl', 'janus-stats');
  const stat = (term, value) => { const pair = el('div', 'stat'); pair.append(el('dt', null, term), el('dd', null, value)); stats.append(pair); };
  stat('Por aprobar', String(snapshot.janus.approvalsPending));
  stat('Capacidades activas', `${snapshot.janus.capabilities.available} de ${snapshot.janus.capabilities.total}`);
  if (snapshot.janus.confidence) {
    const c = snapshot.janus.confidence;
    stat('Confianza de ejecución', c.samples > 0 ? `${Math.round(c.value * 100)} % (${c.samples} casos)` : 'Neutral, sin historial aún');
  }
  janus.append(stats);

  const keys = el('div', 'keys');
  const present = snapshot.integrations.filter((row) => row.state === 'key_present').length;
  keys.append(el('p', 'keys-summary', `Llaves: ${present} de ${snapshot.integrations.length} configuradas. Ninguna validada aún con cuenta real.`));
  const chips = el('ul', 'keys-list');
  for (const row of snapshot.integrations) {
    const chip = el('li', row.state === 'key_present' ? 'key-on' : 'key-off', row.name);
    chip.title = row.state === 'key_present' ? 'Llave presente (sin validar en real)' : 'Sin llave';
    chips.append(chip);
  }
  keys.append(chips);
  janus.append(keys);
  root.append(janus);

  const foot = el('p', 'dash-foot');
  const at = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit', timeZone: tz }).format(new Date(snapshot.generatedAt));
  foot.append(`Actualizado a las ${at}. `);
  const refresh = el('button', 'ghost', 'Actualizar ahora');
  refresh.type = 'button';
  refresh.addEventListener('click', () => loadDashboard(true));
  foot.append(refresh);
  root.append(foot);
}

function renderMessage(text, action) {
  root.replaceChildren();
  const box = el('div', 'dash-empty');
  box.append(el('p', null, text));
  if (action) {
    const button = el('button', 'primary', action.label);
    button.type = 'button';
    button.addEventListener('click', action.run);
    box.append(button);
  }
  root.append(box);
}

export async function loadDashboard(force = false) {
  if (!root) return;
  clearTimeout(timer);
  if (!sessionToken()) {
    renderMessage('Tu panel es privado. Entra como Founder para verlo.', { label: 'Entrar como Founder', run: () => onOpenWork() });
    return;
  }
  root.setAttribute('aria-busy', 'true');
  try {
    const response = await fetch(`/api/dashboard${force ? '?refresh=1' : ''}`, { headers: authHeaders(), cache: 'no-store' });
    if (response.status === 401 || response.status === 403) {
      renderMessage('Tu sesión de Founder caducó. Vuelve a entrar para ver el panel.', { label: 'Entrar como Founder', run: () => onOpenWork() });
      return;
    }
    const data = await response.json();
    if (!response.ok || !data.dashboard) throw new Error(data.error ?? `HTTP ${response.status}`);
    render(data.dashboard);
  } catch (error) {
    renderMessage(`No se pudo cargar el panel: ${error?.message ?? error}. Comprueba que Janus está encendido.`, { label: 'Reintentar', run: () => loadDashboard(true) });
  } finally {
    root.removeAttribute('aria-busy');
  }
  if (document.visibilityState === 'visible') timer = setTimeout(() => loadDashboard(false), 60_000);
}

export function mountDashboard(element, options = {}) {
  root = element;
  onOpenWork = options.onOpenWork ?? onOpenWork;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !root.closest('[hidden]')) loadDashboard(false);
  });
}

export function stopDashboard() {
  clearTimeout(timer);
}
