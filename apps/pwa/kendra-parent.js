/**
 * Panel de padres del dashboard de la niña (pieza reutilizable).
 *
 * Se usa en dos sitios con el MISMO código:
 *  · dentro del dashboard de Jean (sesión de Founder → mode 'founder': puede emparejar, revocar y cambiar el PIN);
 *  · dentro de la app de la niña, tras escribir el PIN parental (mode 'pin': solo lo que el servidor deja hacer con el PIN).
 *
 * No hace `fetch` por sí mismo: recibe `request(method, path, body)` → Promise<{ status, body }>, de modo que cada sitio
 * pone su propia credencial. Todo el texto variable se inserta con textContent (nunca innerHTML).
 */

const SEVERITY = { alert: 'Alerta', block: 'Bloqueado', note: 'Aviso' };
const KIND_LABELS = { oferta: 'Oferta', evento: 'Evento', peli: 'Película', producto: 'Producto', plan: 'Plan' };
const AGENDA_KINDS = ['cita', 'turno', 'escuela', 'cumple', 'actividad', 'recordatorio'];
const HOME_KINDS = { light: 'Luces', plug: 'Enchufes', fan: 'Ventilador', heater: 'Calefacción', thermostat: 'Termostato' };

export function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'value') node.value = value;
    else if (key === 'checked') node.checked = Boolean(value);
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children.flat()) {
    if (child === undefined || child === null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

const minutes = (value) => `${Math.round(Number(value) || 0)} min`;
const dayLabel = (ymd) => {
  const date = new Date(`${ymd}T12:00:00`);
  return Number.isNaN(date.getTime()) ? ymd : date.toLocaleDateString('es', { weekday: 'short', day: 'numeric' });
};
const when = (iso) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

function ensureStyles() {
  if (document.getElementById('kp-style')) return;
  const style = document.createElement('style');
  style.id = 'kp-style';
  style.textContent = PARENT_PANEL_CSS;
  document.head.append(style);
}

export function mountKidParentPanel(host, options) {
  ensureStyles();
  const { request, mode = 'pin', kidId = 'kendra', onClose } = options;
  const founder = mode === 'founder';
  const kidParam = founder ? `kidId=${encodeURIComponent(kidId)}` : '';
  let overview = null;
  let notice = '';

  const withKid = (body = {}) => (founder ? { kidId, ...body } : body);
  const url = (path) => (founder && !path.includes('?') ? `${path}?${kidParam}` : path);

  async function act(method, path, body, okMessage) {
    const result = await request(method, path, body === undefined ? undefined : withKid(body));
    if (result.status >= 200 && result.status < 300) {
      notice = okMessage ?? 'Hecho.';
      await load();
    } else {
      notice = (result.body && result.body.error) || `No se pudo (HTTP ${result.status}).`;
      render();
    }
    return result;
  }

  async function load() {
    const result = await request('GET', founder ? `/api/parent/kid/overview?${kidParam}` : '/api/parent/kid/overview');
    if (result.status === 403 || result.status === 401) {
      host.replaceChildren(h('p', { class: 'kp-error' }, (result.body && result.body.error) || 'El área de padres está bloqueada.'));
      return;
    }
    if (result.status !== 200) {
      host.replaceChildren(h('p', { class: 'kp-error' }, (result.body && result.body.error) || `No se pudo cargar (HTTP ${result.status}).`));
      return;
    }
    overview = result.body;
    render();
  }

  // ── Secciones ──────────────────────────────────────────────────────────────────────────────────────────

  function sectionToday() {
    const labels = overview.categories;
    const entries = Object.entries(overview.today.byCategory);
    const maxDay = Math.max(30, ...overview.week.map((day) => day.totalMinutes));
    return h('section', { class: 'kp-card' },
      h('h3', {}, 'Hoy'),
      entries.length === 0
        ? h('p', { class: 'kp-muted' }, 'Todavía no hay actividad hoy.')
        : h('ul', { class: 'kp-list' }, entries.map(([key, value]) => h('li', {}, h('span', {}, labels[key] ?? key), h('strong', {}, minutes(value))))),
      h('p', { class: 'kp-muted' }, `Tiempo de ocio hoy: ${minutes(overview.today.limitedMinutes)} · total: ${minutes(overview.today.totalMinutes)}`),
      h('h4', {}, 'Última semana'),
      h('div', { class: 'kp-bars', role: 'img', 'aria-label': 'Minutos por día de la última semana' },
        [...overview.week].reverse().map((day) => h('div', { class: 'kp-bar' },
          h('div', { class: 'kp-bar-fill', style: `height:${Math.max(3, Math.round((day.totalMinutes / maxDay) * 100))}%`, title: minutes(day.totalMinutes) }),
          h('span', {}, dayLabel(day.date))))),
    );
  }

  function sectionFlags() {
    const unseen = overview.flags.filter((flag) => !flag.seen);
    return h('section', { class: 'kp-card' },
      h('h3', {}, 'Avisos del filtro', unseen.length > 0 ? h('span', { class: 'kp-badge' }, String(unseen.length)) : null),
      overview.flags.length === 0
        ? h('p', { class: 'kp-muted' }, 'Sin avisos. El filtro es una primera capa: no sustituye a mirar de vez en cuando.')
        : h('ul', { class: 'kp-list' }, overview.flags.slice(0, 15).map((flag) => h('li', { class: flag.seen ? 'kp-seen' : '' },
          h('span', {}, h('b', { class: `kp-sev kp-sev-${flag.severity}` }, SEVERITY[flag.severity] ?? flag.severity), ' ', flag.summary),
          h('small', {}, when(flag.at))))),
      unseen.length > 0 ? h('button', { type: 'button', onClick: () => act('POST', '/api/parent/kid/flags/seen', {}, 'Avisos marcados como vistos.') }, 'Marcar como vistos') : null,
    );
  }

  const youtube = () => overview.settings.media.youtube;

  async function saveMedia(next) {
    return act('PUT', '/api/parent/kid/settings', { media: next }, 'Vídeos actualizados.');
  }

  function sectionVideo() {
    const policy = overview.settings.media;
    const yt = youtube();
    const link = h('input', { type: 'text', placeholder: 'Enlace o ID del vídeo de YouTube', 'aria-label': 'Enlace del vídeo', autocomplete: 'off' });
    const label = h('input', { type: 'text', placeholder: 'Nombre (p. ej. Baile de Stitch)', 'aria-label': 'Nombre del vídeo', maxlength: '80' });
    return h('section', { class: 'kp-card' },
      h('h3', {}, 'Vídeos aprobados'),
      h('p', { class: 'kp-muted' }, 'Solo se reproducen los vídeos de esta lista, sin buscador ni vídeos relacionados propios. Mira cada uno antes de aprobarlo.'),
      overview.mediaRequests.length > 0 ? h('div', { class: 'kp-sub' },
        h('h4', {}, 'Lo que ha pedido'),
        h('ul', { class: 'kp-list' }, overview.mediaRequests.map((item) => h('li', {},
          h('span', {}, item.text),
          h('button', { type: 'button', class: 'kp-small', onClick: () => act('POST', `/api/parent/kid/media-requests/${item.id}/dismiss`, {}, 'Petición descartada.') }, 'Descartar'))))) : null,
      yt.mode === 'allowlist' && yt.videos.length > 0
        ? h('ul', { class: 'kp-list' }, yt.videos.map((video) => h('li', {},
          h('a', { href: `https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`, target: '_blank', rel: 'noopener noreferrer' }, video.label),
          h('button', { type: 'button', class: 'kp-small', onClick: () => saveMedia({ ...policy, youtube: { ...yt, videos: yt.videos.filter((item) => item.id !== video.id) } }) }, 'Quitar'))))
        : h('p', { class: 'kp-muted' }, 'Todavía no hay vídeos aprobados.'),
      h('form', { class: 'kp-form', onSubmit: (event) => {
        event.preventDefault();
        if (!link.value.trim() || !label.value.trim()) return;
        saveMedia({ ...policy, youtube: { ...yt, mode: 'allowlist', videos: [...yt.videos, { id: link.value.trim(), label: label.value.trim() }] } });
      } }, link, label, h('button', { type: 'submit' }, 'Aprobar vídeo')),
      h('label', { class: 'kp-check' },
        h('input', { type: 'checkbox', checked: yt.mode === 'allowlist', onChange: (event) => saveMedia({ ...policy, youtube: { ...yt, mode: event.target.checked ? 'allowlist' : 'off' } }) }),
        ' YouTube activado (solo lista aprobada)'),
    );
  }

  function sectionFeed() {
    const title = h('input', { type: 'text', placeholder: 'Título (p. ej. Entrada 2x1 en el parque)', 'aria-label': 'Título', maxlength: '120' });
    const kind = h('select', { 'aria-label': 'Tipo' }, Object.entries(KIND_LABELS).map(([value, text]) => h('option', { value }, text)));
    const place = h('input', { type: 'text', placeholder: 'Lugar (opcional)', 'aria-label': 'Lugar', maxlength: '80' });
    const from = h('input', { type: 'date', 'aria-label': 'Desde' });
    const until = h('input', { type: 'date', 'aria-label': 'Hasta' });
    const link = h('input', { type: 'url', placeholder: 'Enlace https (solo lo ves tú)', 'aria-label': 'Enlace' });
    return h('section', { class: 'kp-card' },
      h('h3', {}, 'Planes y ofertas para ella'),
      overview.pendingFeed.length > 0 ? h('div', { class: 'kp-sub' },
        h('h4', {}, 'Pendientes de tu aprobación'),
        h('ul', { class: 'kp-list' }, overview.pendingFeed.map((item) => h('li', {},
          h('span', {}, h('b', {}, KIND_LABELS[item.kind] ?? item.kind), ' ', item.title, item.place ? ` · ${item.place}` : '', item.url ? h('small', {}, ` (${item.url})`) : null, h('small', {}, ` — propuesto por ${item.source}`)),
          h('span', { class: 'kp-actions' },
            h('button', { type: 'button', class: 'kp-small', onClick: () => act('POST', `/api/parent/kid/feed/${item.id}/decision`, { decision: 'approved' }, 'Aprobado: ya lo ve ella.') }, 'Aprobar'),
            h('button', { type: 'button', class: 'kp-small kp-danger', onClick: () => act('POST', `/api/parent/kid/feed/${item.id}/decision`, { decision: 'rejected' }, 'Descartado.') }, 'Rechazar'))))) ) : null,
      h('p', { class: 'kp-muted' }, 'Lo que Janus encuentre por internet llega aquí como «pendiente»: ella solo ve lo que apruebas.'),
      h('form', { class: 'kp-form', onSubmit: (event) => {
        event.preventDefault();
        if (!title.value.trim()) return;
        const item = { title: title.value.trim(), kind: kind.value };
        if (place.value.trim()) item.place = place.value.trim();
        if (from.value) item.from = from.value;
        if (until.value) item.until = until.value;
        if (link.value.trim()) item.url = link.value.trim();
        act('POST', '/api/parent/kid/feed', { item, source: 'tutor' }, 'Añadido para ella.');
      } }, title, kind, place, h('div', { class: 'kp-row' }, h('label', {}, 'Desde ', from), h('label', {}, 'Hasta ', until)), link, h('button', { type: 'submit' }, 'Añadir para ella')),
    );
  }

  function sectionLimits() {
    const limits = overview.settings.limits;
    const from = h('input', { type: 'time', value: limits.allowedFrom, 'aria-label': 'Desde' });
    const until = h('input', { type: 'time', value: limits.allowedUntil, 'aria-label': 'Hasta' });
    const total = h('input', { type: 'number', min: '0', max: '600', value: String(limits.totalDailyMinutes), 'aria-label': 'Minutos al día' });
    const yt = h('input', { type: 'number', min: '0', max: '600', value: String(limits.perCategoryMinutes.youtube ?? ''), placeholder: 'sin tope', 'aria-label': 'Minutos de YouTube' });
    const tv = h('input', { type: 'number', min: '0', max: '600', value: String(limits.perCategoryMinutes.tv ?? ''), placeholder: 'sin tope', 'aria-label': 'Minutos de tele' });
    const warn = h('input', { type: 'number', min: '0', max: '30', value: String(limits.warnMinutesBefore), 'aria-label': 'Aviso previo' });
    const bonus = h('input', { type: 'number', min: '0', max: '120', value: '15', 'aria-label': 'Minutos extra' });
    return h('section', { class: 'kp-card' },
      h('h3', {}, 'Horario y tiempo'),
      h('form', { class: 'kp-form', onSubmit: (event) => {
        event.preventDefault();
        const perCategoryMinutes = { ...limits.perCategoryMinutes };
        for (const [key, input] of [['youtube', yt], ['tv', tv]]) {
          if (input.value === '') delete perCategoryMinutes[key]; else perCategoryMinutes[key] = Number(input.value);
        }
        act('PUT', '/api/parent/kid/settings', { limits: { allowedFrom: from.value, allowedUntil: until.value, totalDailyMinutes: Number(total.value), perCategoryMinutes, warnMinutesBefore: Number(warn.value) } }, 'Límites guardados.');
      } },
        h('div', { class: 'kp-row' }, h('label', {}, 'Puede usarla desde ', from), h('label', {}, 'hasta ', until)),
        h('label', {}, 'Ocio al día (min) ', total),
        h('div', { class: 'kp-row' }, h('label', {}, 'YouTube (min) ', yt), h('label', {}, 'Tele (min) ', tv)),
        h('label', {}, 'Avisarle antes (min) ', warn),
        h('button', { type: 'submit' }, 'Guardar límites')),
      h('p', { class: 'kp-muted' }, 'Cole, agenda y casa no se cortan por tiempo. Al acabarse el tiempo recibe un aviso amable unos minutos antes.'),
      h('div', { class: 'kp-row' }, h('label', {}, 'Minutos extra hoy ', bonus), h('button', { type: 'button', onClick: () => act('POST', '/api/parent/kid/bonus', { minutes: Number(bonus.value) }, 'Minutos extra concedidos para hoy.') }, 'Dar')),
    );
  }

  function sectionHome() {
    const home = overview.settings.home;
    const rooms = h('input', { type: 'text', value: home.allowedRooms.join(', '), placeholder: 'cama, sala, cocina', 'aria-label': 'Habitaciones permitidas' });
    const boxes = Object.entries(HOME_KINDS).map(([kind, text]) => ({ kind, input: h('input', { type: 'checkbox', checked: home.allowedKinds.includes(kind) }), text }));
    const allowOn = h('input', { type: 'checkbox', checked: home.heating.allowOn });
    const allowOff = h('input', { type: 'checkbox', checked: home.heating.allowOff });
    const minTemp = h('input', { type: 'number', min: '10', max: '24', value: String(home.heating.minTemp), 'aria-label': 'Mínimo' });
    const maxTemp = h('input', { type: 'number', min: '10', max: '24', value: String(home.heating.maxTemp), 'aria-label': 'Máximo' });
    const enabled = h('input', { type: 'checkbox', checked: home.enabled });
    return h('section', { class: 'kp-card' },
      h('h3', {}, 'Control de la casa'),
      h('p', { class: 'kp-muted' }, 'Nunca podrá tocar cerraduras, cámaras, alarmas ni cocina. Si está en otra casa, apaga el interruptor general.'),
      h('form', { class: 'kp-form', onSubmit: (event) => {
        event.preventDefault();
        act('PUT', '/api/parent/kid/settings', { home: {
          enabled: enabled.checked,
          allowedRooms: rooms.value.split(',').map((room) => room.trim()).filter(Boolean),
          allowedKinds: boxes.filter((box) => box.input.checked).map((box) => box.kind),
          heating: { allowOff: allowOff.checked, allowOn: allowOn.checked, minTemp: Number(minTemp.value), maxTemp: Number(maxTemp.value) },
        } }, 'Casa actualizada.');
      } },
        h('label', { class: 'kp-check' }, enabled, ' Interruptor general: puede controlar la casa'),
        h('label', {}, 'Habitaciones ', rooms),
        h('div', { class: 'kp-row kp-wrap' }, boxes.map((box) => h('label', { class: 'kp-check' }, box.input, ` ${box.text}`))),
        h('label', { class: 'kp-check' }, allowOff, ' Puede apagar la calefacción'),
        h('label', { class: 'kp-check' }, allowOn, ' Puede encender la calefacción'),
        h('div', { class: 'kp-row' }, h('label', {}, 'Temperatura mín. ', minTemp), h('label', {}, 'máx. ', maxTemp)),
        h('button', { type: 'submit' }, 'Guardar casa')),
    );
  }

  function sectionPlace() {
    const place = overview.settings.locality;
    const label = h('input', { type: 'text', value: place ? place.label : '', placeholder: 'Nombre del lugar (p. ej. Amsterdam)', 'aria-label': 'Lugar' });
    const lat = h('input', { type: 'number', step: '0.0001', value: place ? String(place.lat) : '', placeholder: 'Latitud', 'aria-label': 'Latitud' });
    const lon = h('input', { type: 'number', step: '0.0001', value: place ? String(place.lon) : '', placeholder: 'Longitud', 'aria-label': 'Longitud' });
    return h('section', { class: 'kp-card' },
      h('h3', {}, 'Su zona (tiempo y ropa)'),
      h('p', { class: 'kp-muted' }, 'Solo se envían estas coordenadas a Open-Meteo para saber el tiempo. Sin zona, no hay consejo de ropa.'),
      h('form', { class: 'kp-form', onSubmit: (event) => {
        event.preventDefault();
        act('PUT', '/api/parent/kid/settings', { locality: label.value.trim() ? { label: label.value.trim(), lat: Number(lat.value), lon: Number(lon.value) } : null }, 'Zona guardada.');
      } }, label, h('div', { class: 'kp-row' }, lat, lon), h('button', { type: 'submit' }, 'Guardar zona')),
    );
  }

  function sectionAgenda() {
    const title = h('input', { type: 'text', placeholder: 'Qué (p. ej. dentista)', 'aria-label': 'Título', maxlength: '80' });
    const date = h('input', { type: 'date', 'aria-label': 'Fecha' });
    const time = h('input', { type: 'time', 'aria-label': 'Hora' });
    const kind = h('select', { 'aria-label': 'Tipo' }, AGENDA_KINDS.map((value) => h('option', { value }, value)));
    const task = h('input', { type: 'text', placeholder: 'Tarea para ella (p. ej. Leer 10 minutos)', 'aria-label': 'Tarea', maxlength: '100' });
    const due = h('input', { type: 'date', 'aria-label': 'Para el día' });
    return h('section', { class: 'kp-card' },
      h('h3', {}, 'Agenda y tareas de ella'),
      h('form', { class: 'kp-form', onSubmit: (event) => {
        event.preventDefault();
        if (!title.value.trim() || !date.value) return;
        act('POST', '/api/parent/kid/agenda', { item: { title: title.value.trim(), date: date.value, ...(time.value ? { time: time.value } : {}), kind: kind.value } }, 'Añadido a su agenda con recordatorios.');
      } }, title, h('div', { class: 'kp-row' }, date, time, kind), h('button', { type: 'submit' }, 'Añadir a su agenda')),
      h('form', { class: 'kp-form', onSubmit: (event) => {
        event.preventDefault();
        if (!task.value.trim()) return;
        act('POST', '/api/parent/kid/tasks', { task: { title: task.value.trim(), ...(due.value ? { due: due.value } : {}) } }, 'Tarea añadida.');
      } }, task, h('label', {}, 'Para el ', due), h('button', { type: 'submit' }, 'Añadir tarea')),
    );
  }

  function sectionPrivacy() {
    const full = overview.settings.transcriptVisibility === 'full';
    return h('section', { class: 'kp-card' },
      h('h3', {}, 'Qué ves de sus charlas'),
      h('p', { class: 'kp-muted' }, full
        ? 'Ahora ves las conversaciones completas, y ella lo sabe. Es lo más transparente, pero úsalo con criterio.'
        : 'Ahora solo ves avisos y tiempos, no lo que escribe. Es el punto de partida más respetuoso.'),
      h('button', { type: 'button', onClick: () => act('PUT', '/api/parent/kid/settings', { transcriptVisibility: full ? 'flags' : 'full' }, full ? 'Solo avisos.' : 'Conversaciones visibles para ti (ella lo sabe).') }, full ? 'Volver a solo avisos' : 'Ver conversaciones completas'),
      full && overview.transcripts ? h('ul', { class: 'kp-list kp-transcript' }, overview.transcripts.map((line) => h('li', {}, h('b', {}, line.role === 'kid' ? 'Ella' : 'Compañero'), ': ', line.text, h('small', {}, ` ${when(line.at)}`)))) : null,
    );
  }

  function sectionDevices() {
    if (!founder) return null;
    const pin = h('input', { type: 'password', inputmode: 'numeric', pattern: '[0-9]*', maxlength: '8', placeholder: 'PIN de 4 a 8 cifras', autocomplete: 'new-password', 'aria-label': 'PIN parental' });
    let codeBox = null;
    const codeOut = h('p', { class: 'kp-code', 'aria-live': 'polite' });
    codeBox = codeOut;
    return h('section', { class: 'kp-card' },
      h('h3', {}, 'Dispositivos y PIN'),
      h('ul', { class: 'kp-list' }, overview.devices.length === 0 ? h('li', {}, h('span', { class: 'kp-muted' }, 'Ningún dispositivo emparejado todavía.')) : overview.devices.map((device) => h('li', {},
        h('span', {}, device.label, h('small', {}, device.lastSeenAt ? ` · visto ${when(device.lastSeenAt)}` : ' · aún sin uso'), device.revokedAt ? h('small', {}, ' · revocado') : null),
        device.revokedAt ? null : h('button', { type: 'button', class: 'kp-small kp-danger', onClick: () => act('DELETE', `/api/parent/kid/devices/${device.id}`, undefined, 'Dispositivo desactivado.') }, 'Desactivar')))),
      h('button', { type: 'button', onClick: async () => {
        const result = await request('POST', '/api/parent/kid/pairing', { kidId });
        codeBox.textContent = result.status === 201 ? `Código: ${result.body.code} (10 min, un solo uso). Escríbelo en el dispositivo de ella.` : ((result.body && result.body.error) || 'No se pudo crear el código.');
      } }, 'Emparejar un dispositivo nuevo'),
      codeOut,
      h('form', { class: 'kp-form', onSubmit: async (event) => {
        event.preventDefault();
        const ok = await act('POST', '/api/parent/kid/pin', { pin: pin.value }, overview.pinSet ? 'PIN cambiado.' : 'PIN creado.');
        if (ok.status === 200) pin.value = '';
      } }, pin, h('button', { type: 'submit' }, overview.pinSet ? 'Cambiar PIN parental' : 'Crear PIN parental')),
      h('p', { class: 'kp-muted' }, 'El PIN solo abre el área de padres en su app (se bloquea tras varios intentos). No es seguridad contra alguien con acceso al aparato: para eso está el emparejamiento.'),
    );
  }

  function render() {
    if (!overview) return;
    host.replaceChildren(...[
      h('div', { class: 'kp-head' },
        h('h2', {}, `Panel de padres · ${overview.profile.displayName}`),
        h('span', { class: 'kp-actions' },
          h('button', { type: 'button', class: 'kp-small', onClick: load }, 'Actualizar'),
          onClose ? h('button', { type: 'button', class: 'kp-small', onClick: onClose }, 'Cerrar') : null)),
      notice ? h('p', { class: 'kp-notice', role: 'status' }, notice) : null,
      sectionToday(), sectionFlags(), sectionVideo(), sectionFeed(), sectionLimits(), sectionHome(), sectionPlace(), sectionAgenda(), sectionPrivacy(), sectionDevices(),
    ].filter(Boolean));
    notice = '';
  }

  host.classList.add('kp-root');
  host.replaceChildren(h('p', { class: 'kp-muted' }, 'Cargando…'));
  void load();
  return { reload: load, destroy: () => host.replaceChildren() };
}

export const PARENT_PANEL_CSS = `
.kp-root{display:grid;gap:12px;font:15px/1.4 system-ui,sans-serif;color:inherit}
.kp-head{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between}
.kp-head h2{margin:0;font-size:1.15rem}
.kp-card{padding:12px 14px;border-radius:14px;border:1px solid var(--kp-border,rgba(128,128,128,.35));background:var(--kp-bg,rgba(128,128,128,.08));display:grid;gap:8px}
.kp-card h3,.kp-card h4{margin:0}
.kp-list{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.kp-list li{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.kp-seen{opacity:.55}
.kp-muted{margin:0;opacity:.75;font-size:.9em}
.kp-form{display:grid;gap:8px}
.kp-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.kp-wrap{row-gap:4px}
.kp-check{display:flex;gap:6px;align-items:center}
.kp-root input[type=text],.kp-root input[type=url],.kp-root input[type=number],.kp-root input[type=date],.kp-root input[type=time],.kp-root input[type=password],.kp-root select{min-block-size:42px;padding:6px 10px;border-radius:10px;border:1px solid var(--kp-border,rgba(128,128,128,.45));background:transparent;color:inherit;font:inherit;max-inline-size:100%}
.kp-root button{min-block-size:42px;padding:6px 14px;border-radius:10px;border:1px solid var(--kp-border,rgba(128,128,128,.45));background:var(--kp-btn,rgba(128,128,128,.18));color:inherit;font:inherit;cursor:pointer}
.kp-root button.kp-small{min-block-size:34px;padding:2px 10px;font-size:.9em}
.kp-root button.kp-danger{border-color:#d66}
.kp-badge{margin-inline-start:8px;padding:0 8px;border-radius:999px;background:#d66;color:#fff;font-size:.8em}
.kp-sev{padding:0 6px;border-radius:6px;font-size:.8em;background:rgba(128,128,128,.3)}
.kp-sev-alert{background:#d66;color:#fff}
.kp-sev-block{background:#e9a23b;color:#111}
.kp-bars{display:flex;gap:6px;align-items:flex-end;block-size:90px}
.kp-bar{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;block-size:100%;gap:2px;font-size:.7em}
.kp-bar-fill{inline-size:100%;border-radius:6px 6px 0 0;background:var(--kp-accent,#7a8cff);min-block-size:3px}
.kp-notice{margin:0;padding:8px 12px;border-radius:10px;background:rgba(80,180,120,.2)}
.kp-error{color:#d66}
.kp-root a{color:var(--kp-accent,#5a6cff)}
.kp-code{margin:0;font-weight:600}
.kp-actions{display:inline-flex;gap:6px}
.kp-transcript{max-block-size:240px;overflow:auto}
`;
