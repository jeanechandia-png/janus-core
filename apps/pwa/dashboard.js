// Panel del Founder ("Inicio"): una sola vista para la mañana. Solo lectura.
// Identidad: mockups Janus aprobados (sept. 2026) — negro profundo, oro cálido,
// mayúsculas romanas, medallón de dos caras con eje de luz.
// Nunca muestra cifras que el servidor no haya observado.
import { authHeaders, sessionToken } from './founder-session.js';
import { bindLight, createMedal, createWordmark } from './janus-gold.js';

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
  kendra: { title: 'Kendra', empty: 'Kendra no tiene nada en agenda hoy.' },
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

// Paleta categórica validada (dataviz validator, modo oscuro sobre #101115):
// el color sigue al producto, nunca al orden.
const PRODUCT_COLOR = {
  chatbox: '#3987e5',
  'infinityseed-group': '#d95926',
  janus: '#199e70',
  tribuna: '#c98500',
  iba: '#d55181',
  api: '#9085e9',
};
const compact = new Intl.NumberFormat('es-ES', { notation: 'compact', maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat('es-ES');

let root;
let timer;
let lastSnapshot = null;
let resizeObserver;
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
  bindLight(section);
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
  const medal = createMedal();
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
    const kind = isApproval ? 'approval' : /cita|Kendra|agenda/.test(item.text) ? 'calendar' : /llave/.test(item.text) ? 'key' : 'alert';
    const row = el(isApproval ? 'button' : 'div', `jd-row jd-row-${item.level}`);
    if (isApproval) { row.type = 'button'; row.addEventListener('click', () => onOpenWork()); bindLight(row); }
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
  const personal = renderFace(snapshot.agenda.personal, snapshot.timeZone);
  if (snapshot.agenda.kendra) personal.append(renderFace(snapshot.agenda.kendra, snapshot.timeZone));
  faces.append(renderFace(snapshot.agenda.work, snapshot.timeZone), axis, personal);
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


// ---------------------------------------------------------------------------
// Redes y reels: gráficas profesionales (marcas finas, rejilla tenue, una sola
// escala, etiquetas selectivas, tooltip al tocar, tabla accesible).
// ---------------------------------------------------------------------------
function svg(tag, attrs = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

function niceTicks(min, max, count = 3) {
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((m) => span / m <= count) ?? 10 * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}

function shortDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
}

function followerChart(account, width) {
  const box = el('div', 'jd-chart');
  const history = account.history;
  if (history.length < 2) {
    box.append(el('p', 'jd-chart-empty', history.length === 1
      ? 'La gráfica aparece desde el segundo día de mediciones. Janus guarda una foto diaria.'
      : 'Sin mediciones todavía.'));
    return box;
  }
  const color = PRODUCT_COLOR[account.productId] ?? '#d4af69';
  const H = 168, padL = 44, padR = 56, padT = 12, padB = 26;
  const W = Math.max(260, width);
  const values = history.map((p) => p.followers);
  const ticks = niceTicks(Math.min(...values), Math.max(...values));
  const yMin = ticks[0], yMax = ticks[ticks.length - 1];
  const x = (i) => padL + (i / (history.length - 1)) * (W - padL - padR);
  const y = (v) => padT + (1 - (v - yMin) / (yMax - yMin || 1)) * (H - padT - padB);
  const chart = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: H, role: 'img', 'aria-label': `Seguidores de ${account.label}: de ${whole.format(values[0])} a ${whole.format(values.at(-1))}` });
  for (const t of ticks) {
    chart.append(svg('line', { x1: padL, x2: W - padR + 8, y1: y(t), y2: y(t), class: 'jd-grid' }));
    const label = svg('text', { x: padL - 8, y: y(t) + 4, 'text-anchor': 'end', class: 'jd-tick' });
    label.textContent = compact.format(t);
    chart.append(label);
  }
  for (const [i, anchor] of [[0, 'start'], [history.length - 1, 'end']]) {
    const label = svg('text', { x: x(i), y: H - 6, 'text-anchor': anchor, class: 'jd-tick' });
    label.textContent = shortDate(history[i].date);
    chart.append(label);
  }
  const d = history.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.followers).toFixed(1)}`).join('');
  chart.append(svg('path', { d: `${d}L${x(history.length - 1)},${H - padB}L${padL},${H - padB}Z`, fill: color, 'fill-opacity': .1 }));
  chart.append(svg('path', { d, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
  const last = history.length - 1;
  chart.append(svg('circle', { cx: x(last), cy: y(values[last]), r: 4, fill: color, stroke: 'var(--jd-panel)', 'stroke-width': 2 }));
  const end = svg('text', { x: x(last) + 8, y: y(values[last]) + 4, class: 'jd-endlabel' });
  end.textContent = compact.format(values[last]);
  chart.append(end);

  // Cruz de lectura + tooltip
  const cross = svg('line', { y1: padT, y2: H - padB, class: 'jd-cross', visibility: 'hidden' });
  const dot = svg('circle', { r: 5, fill: color, stroke: 'var(--jd-panel)', 'stroke-width': 2, visibility: 'hidden' });
  chart.append(cross, dot);
  const tip = el('div', 'jd-tip');
  tip.hidden = true;
  const hit = svg('rect', { x: padL, y: padT, width: W - padL - padR, height: H - padT - padB, fill: 'transparent' });
  const show = (event) => {
    const rect = chart.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * W;
    const i = Math.max(0, Math.min(last, Math.round(((px - padL) / (W - padL - padR)) * last)));
    cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('visibility', 'visible');
    dot.setAttribute('cx', x(i)); dot.setAttribute('cy', y(values[i])); dot.setAttribute('visibility', 'visible');
    tip.hidden = false;
    tip.replaceChildren(el('strong', null, whole.format(values[i])), el('span', null, ` seguidores · ${shortDate(history[i].date)}`));
    tip.style.left = `${(x(i) / W) * 100}%`;
  };
  const hide = () => { cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); tip.hidden = true; };
  hit.addEventListener('pointermove', show);
  hit.addEventListener('pointerdown', show);
  hit.addEventListener('pointerleave', hide);
  chart.append(hit);
  box.append(chart, tip);
  return box;
}

function renderAccount(account, width) {
  const card = el('article', `jd-account jd-s-${account.state}`);
  const head = el('header', 'jd-account-head');
  const swatch = el('span', 'jd-swatch');
  swatch.style.background = PRODUCT_COLOR[account.productId] ?? '#d4af69';
  const names = el('div', 'jd-account-names');
  names.append(el('span', 'jd-account-name', account.label), el('span', 'jd-account-user', account.username ? `@${account.username}` : 'Instagram'));
  head.append(swatch, names);
  card.append(head);

  const figure = el('div', 'jd-hero-figure');
  figure.append(el('span', 'jd-hero-value', account.followers == null ? '—' : whole.format(account.followers)));
  const meta = el('span', 'jd-hero-meta');
  meta.append('seguidores');
  if (account.delta7d != null) {
    const delta = el('span', `jd-delta ${account.delta7d >= 0 ? 'up' : 'down'}`, `${account.delta7d >= 0 ? '▲ +' : '▼ '}${whole.format(account.delta7d)} en 7 días`);
    meta.append(delta);
  }
  figure.append(meta);
  card.append(figure);

  if (account.goal) {
    const meter = el('div', 'jd-meter');
    const bar = el('div', 'jd-meter-track');
    const fill = el('span', 'jd-meter-fill');
    fill.style.width = `${Math.max(1.5, (account.progress ?? 0) * 100)}%`;
    bar.append(fill);
    bar.setAttribute('role', 'meter');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', String(account.goal));
    bar.setAttribute('aria-valuenow', String(account.followers ?? 0));
    bar.setAttribute('aria-label', 'Avance hacia la meta de seguidores');
    meter.append(bar, el('span', 'jd-meter-text', `${Math.round((account.progress ?? 0) * 100)} % de tu meta de ${whole.format(account.goal)} · faltan ${whole.format(Math.max(0, account.goal - (account.followers ?? 0)))}`));
    card.append(meter);
  } else {
    card.append(el('p', 'jd-note', 'Define tu meta de seguidores para esta cuenta (followerGoal).'));
  }
  if (account.state !== 'live' && account.reason) card.append(el('p', `jd-note jd-note-${account.state}`, account.reason));
  card.append(followerChart(account, width));
  return card;
}

function renderReels(reels, productName) {
  const wrap = el('div', 'jd-reels');
  const head = el('div', 'jd-reels-head');
  head.append(el('h4', null, 'Últimos 8 reels, ordenados por reproducciones'));
  const used = [...new Set(reels.map((reel) => reel.productId))];
  const legend = el('ul', 'jd-legend');
  for (const id of used) {
    const li = el('li');
    const sw = el('span', 'jd-swatch');
    sw.style.background = PRODUCT_COLOR[id] ?? '#d4af69';
    li.append(sw, productName(id));
    legend.append(li);
  }
  head.append(legend);
  wrap.append(head);
  if (reels.length === 0) {
    wrap.append(el('p', 'jd-chart-empty', 'Sin reels leídos todavía.'));
    return wrap;
  }
  const max = Math.max(1, ...reels.map((reel) => reel.views ?? reel.likes ?? 0));
  const list = el('ol', 'jd-bars');
  for (const reel of reels) {
    const value = reel.views ?? null;
    const li = el('li');
    const row = el(reel.permalink ? 'a' : 'div', 'jd-bar-row');
    if (reel.permalink) { row.href = reel.permalink; row.target = '_blank'; row.rel = 'noopener noreferrer'; }
    const label = el('span', 'jd-bar-label');
    label.append(el('span', 'jd-bar-title', reel.title), el('span', 'jd-bar-sub', `${productName(reel.productId)}${reel.attribution === 'hashtag' ? ' (por hashtag)' : ''}${reel.publishedAt ? ` · ${shortDate(reel.publishedAt.slice(0, 10))}` : ''}`));
    const track = el('span', 'jd-bar-track');
    const bar = el('span', 'jd-bar');
    bar.style.width = `${value == null ? 0 : Math.max(1, (value / max) * 100)}%`;
    bar.style.background = PRODUCT_COLOR[reel.productId] ?? '#d4af69';
    const tipText = [
      value == null ? 'Reproducciones no disponibles' : `${whole.format(value)} reproducciones`,
      reel.likes != null ? `${whole.format(reel.likes)} me gusta` : null,
      reel.comments != null ? `${whole.format(reel.comments)} comentarios` : null,
      reel.shares != null ? `${whole.format(reel.shares)} compartidos` : null,
      reel.saved != null ? `${whole.format(reel.saved)} guardados` : null,
    ].filter(Boolean).join(' · ');
    row.title = tipText;
    row.setAttribute('aria-label', `${reel.title}. ${tipText}`);
    track.append(bar, el('span', 'jd-bar-value', value == null ? '—' : compact.format(value)));
    const detail = el('span', 'jd-bar-detail', [reel.likes != null ? `${compact.format(reel.likes)} me gusta` : null, reel.comments != null ? `${compact.format(reel.comments)} coment.` : null, reel.shares != null ? `${compact.format(reel.shares)} compart.` : null].filter(Boolean).join(' · '));
    row.append(label, track, detail);
    li.append(row);
    list.append(li);
  }
  wrap.append(list);

  const table = el('details', 'jd-table');
  table.append(el('summary', null, 'Ver tabla con todas las cifras'));
  const t = el('table');
  const thead = el('thead');
  const hr = el('tr');
  for (const h of ['Reel', 'Producto', 'Reproducciones', 'Alcance', 'Me gusta', 'Comentarios', 'Compartidos', 'Guardados']) hr.append(el('th', null, h));
  thead.append(hr);
  const tbody = el('tbody');
  const n = (v) => (v == null ? '—' : whole.format(v));
  for (const reel of reels) {
    const tr = el('tr');
    for (const cell of [reel.title, productName(reel.productId), n(reel.views), n(reel.reach), n(reel.likes), n(reel.comments), n(reel.shares), n(reel.saved)]) tr.append(el('td', null, cell));
    tbody.append(tr);
  }
  t.append(thead, tbody);
  table.append(t);
  wrap.append(table);
  return wrap;
}

function renderSocial(snapshot) {
  const social = snapshot.social;
  const section = panel('jd-social', 'Redes y reels', 'Instagram · seguidores, metas y rendimiento');
  if (!social || social.state === 'unconfigured' && social.accounts.length === 0) {
    const empty = el('div', 'jd-social-empty');
    empty.append(el('p', null, social?.reason ?? 'Sin cuentas configuradas.'));
    empty.append(el('p', 'jd-note', 'Cuentas registradas: @infinityseedgroup, @la_tribuna_virtual y @jean_echandia. Falta su ID de Instagram profesional y la llave de Meta (solo lectura).'));
    section.append(empty);
    return section;
  }
  const productName = (id) => snapshot.products.find((p) => p.id === id)?.name ?? id;
  const grid = el('div', 'jd-accounts');
  const width = Math.min(560, (root?.clientWidth ?? 400) - 72);
  for (const account of social.accounts) grid.append(renderAccount(account, social.accounts.length > 1 && window.innerWidth >= 1024 ? width / 1.6 : width));
  section.append(grid);
  const reels = social.accounts.flatMap((account) => account.reels)
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
    .slice(0, 8)
    .sort((a, b) => (b.views ?? -1) - (a.views ?? -1));
  section.append(renderReels(reels, productName));
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
  lastSnapshot = snapshot;
  const frame = el('div', 'jd');
  const brand = el('header', 'jd-brand');
  brand.append(createWordmark('JANUS'), el('span', 'jd-brand-sub', 'Centro de mando'));
  frame.append(brand, renderHero(snapshot));

  const grid = el('div', 'jd-grid');
  grid.append(renderToday(snapshot), renderAgenda(snapshot), renderGroup(snapshot), renderSocial(snapshot), renderSales(snapshot), renderSystem(snapshot));
  frame.append(grid);

  const voice = el('button', 'jd-voice');
  voice.type = 'button';
  const ring = el('span', 'jd-voice-ring');
  ring.append(icon('mic'));
  voice.append(ring, el('span', null, 'Habla con Janus'));
  voice.addEventListener('click', () => onOpenWork());
  bindLight(voice);
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
  brand.append(createWordmark('JANUS'), el('span', 'jd-brand-sub', 'Centro de mando'));
  const medal = createMedal({ solo: true });
  const box = el('div', 'jd-locked-box');
  box.append(el('p', null, text));
  if (action) {
    const button = el('button', 'jd-cta', action.label);
    button.type = 'button';
    button.addEventListener('click', action.run);
    bindLight(button);
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
  let lastWidth = 0;
  resizeObserver = new ResizeObserver(() => {
    const width = Math.round(root.clientWidth / 40);
    if (lastSnapshot && width !== lastWidth && !root.hidden) render(lastSnapshot);
    lastWidth = width;
  });
  resizeObserver.observe(root);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !root.hidden) loadDashboard(false);
  });
}

export function stopDashboard() {
  clearTimeout(timer);
}
