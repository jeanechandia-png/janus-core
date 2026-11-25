import { currentLanguage } from './language-buttons.js';
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
const AGENDA_KINDS = ['cita', 'logopedia', 'medico', 'turno', 'escuela', 'cumple', 'actividad', 'recordatorio'];
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
const dayLabel = (ymd, language='es') => {
  const date = new Date(`${ymd}T12:00:00`);
  return Number.isNaN(date.getTime()) ? ymd : date.toLocaleDateString(language==='nl'?'nl-NL':'es-NL', { weekday: 'short', day: 'numeric' });
};
const when = (iso,language='es') => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(language==='nl'?'nl-NL':'es-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

function ensureStyles() {
  if (document.getElementById('kp-style')) return;
  const style = document.createElement('style');
  style.id = 'kp-style';
  style.textContent = PARENT_PANEL_CSS;
  document.head.append(style);
}

const PARENT_NL=Object.freeze({
  "Hoy": "Vandaag",
  "Todavía no hay actividad hoy.": "Vandaag nog geen activiteit.",
  "Última semana": "Afgelopen week",
  "Minutos por día de la última semana": "Minuten per dag in de afgelopen week",
  "Avisos del filtro": "Filtermeldingen",
  "Sin avisos. El filtro es una primera capa: no sustituye a mirar de vez en cuando.": "Geen meldingen. Het filter is een eerste beveiligingslaag; blijf zelf af en toe kijken.",
  "Avisos marcados como vistos.": "Meldingen als gezien gemarkeerd.",
  "Marcar como vistos": "Markeren als gezien",
  "Vídeos actualizados.": "Video's bijgewerkt.",
  "Enlace o ID del vídeo de YouTube": "YouTube-link of video-ID",
  "Enlace del vídeo": "Videolink",
  "Nombre (p. ej. Baile de Stitch)": "Naam (bijv. Stitch-dans)",
  "Nombre del vídeo": "Videonaam",
  "Vídeos aprobados": "Goedgekeurde video's",
  "Solo se reproducen los vídeos de esta lista, sin buscador ni vídeos relacionados propios. Mira cada uno antes de aprobarlo.": "Alleen video's op deze lijst worden afgespeeld, zonder zoekfunctie. Bekijk elke video voordat je deze goedkeurt.",
  "Lo que ha pedido": "Wat ze heeft gevraagd",
  "Petición descartada.": "Verzoek afgewezen.",
  "Descartar": "Afwijzen",
  "Quitar": "Verwijderen",
  "Todavía no hay vídeos aprobados.": "Nog geen goedgekeurde video's.",
  "Aprobar vídeo": "Video goedkeuren",
  " YouTube activado (solo lista aprobada)": " YouTube aan (alleen goedgekeurde lijst)",
  "Título (p. ej. Entrada 2x1 en el parque)": "Titel (bijv. twee voor de prijs van één)",
  "Título": "Titel",
  "Tipo": "Type",
  "Lugar (opcional)": "Plaats (optioneel)",
  "Lugar": "Plaats",
  "Desde": "Vanaf",
  "Hasta": "Tot",
  "Enlace https (solo lo ves tú)": "HTTPS-link (alleen voor jou zichtbaar)",
  "Enlace": "Link",
  "Planes y ofertas para ella": "Uitjes en aanbiedingen voor haar",
  "Pendientes de tu aprobación": "Wachten op jouw goedkeuring",
  "Aprobado: ya lo ve ella.": "Goedgekeurd: ze kan het nu zien.",
  "Aprobar": "Goedkeuren",
  "Descartado.": "Afgewezen.",
  "Rechazar": "Afwijzen",
  "Lo que Janus encuentre por internet llega aquí como «pendiente»: ella solo ve lo que apruebas.": "Wat Janus online vindt, komt eerst hier terecht: ze ziet alleen wat jij goedkeurt.",
  "Añadido para ella.": "Voor haar toegevoegd.",
  "Desde ": "Vanaf ",
  "Hasta ": "Tot ",
  "Añadir para ella": "Voor haar toevoegen",
  "Minutos al día": "Minuten per dag",
  "sin tope": "geen limiet",
  "Minutos de YouTube": "YouTube-minuten",
  "Minutos de tele": "Tv-minuten",
  "Aviso previo": "Voorafgaande waarschuwing",
  "Minutos extra": "Extra minuten",
  "Horario y tiempo": "Tijden en tijdslimieten",
  "Límites guardados.": "Limieten opgeslagen.",
  "Puede usarla desde ": "Gebruik vanaf ",
  "hasta ": "tot ",
  "Ocio al día (min) ": "Vrije tijd per dag (min) ",
  "YouTube (min) ": "YouTube (min) ",
  "Tele (min) ": "Tv (min) ",
  "Avisarle antes (min) ": "Vooraf waarschuwen (min) ",
  "Guardar límites": "Limieten opslaan",
  "Cole, agenda y casa no se cortan por tiempo. Al acabarse el tiempo recibe un aviso amable unos minutos antes.": "School, agenda en huisbediening stoppen niet door de tijdslimiet. Voor het einde krijgt ze een vriendelijke waarschuwing.",
  "Minutos extra hoy ": "Extra minuten vandaag ",
  "Minutos extra concedidos para hoy.": "Extra minuten voor vandaag toegekend.",
  "Dar": "Geven",
  "Habitaciones permitidas": "Toegestane kamers",
  "Mínimo": "Minimum",
  "Máximo": "Maximum",
  "Control de la casa": "Huisbediening",
  "Nunca podrá tocar cerraduras, cámaras, alarmas ni cocina. Si está en otra casa, apaga el interruptor general.": "Ze kan nooit sloten, camera's, alarmen of keukenapparatuur bedienen. Zet de hoofdschakelaar uit als ze elders is.",
  "Casa actualizada.": "Huisbediening bijgewerkt.",
  " Interruptor general: puede controlar la casa": " Hoofdschakelaar: huisbediening toegestaan",
  "Habitaciones ": "Kamers ",
  " Puede apagar la calefacción": " Mag de verwarming uitzetten",
  " Puede encender la calefacción": " Mag de verwarming aanzetten",
  "Temperatura mín. ": "Minimumtemperatuur ",
  "máx. ": "max. ",
  "Guardar casa": "Huisinstellingen opslaan",
  "Nombre del lugar (p. ej. Amsterdam)": "Plaatsnaam (bijv. Amsterdam)",
  "Latitud": "Breedtegraad",
  "Longitud": "Lengtegraad",
  "Su zona (tiempo y ropa)": "Haar omgeving (weer en kleding)",
  "Solo se envían estas coordenadas a Open-Meteo para saber el tiempo. Sin zona, no hay consejo de ropa.": "Alleen deze coördinaten worden naar Open-Meteo gestuurd voor het weer. Zonder locatie is er geen kledingadvies.",
  "Zona guardada.": "Locatie opgeslagen.",
  "Guardar zona": "Locatie opslaan",
  "Qué (p. ej. dentista)": "Wat (bijv. tandarts)",
  "Fecha": "Datum",
  "Hora": "Tijd",
  "Con qué especialista": "Met welke specialist",
  "Sin especialista": "Zonder specialist",
  "Tarea para ella (p. ej. Leer 10 minutos)": "Taak voor haar (bijv. tien minuten lezen)",
  "Tarea": "Taak",
  "Para el día": "Voor de datum",
  "Agenda y tareas de ella": "Haar agenda en taken",
  "Añadido a su agenda con recordatorios.": "Aan haar agenda toegevoegd met herinneringen.",
  "Añadir a su agenda": "Aan haar agenda toevoegen",
  "Tarea añadida.": "Taak toegevoegd.",
  "Para el ": "Voor ",
  "Añadir tarea": "Taak toevoegen",
  "Nombre (p. ej. Dra. …)": "Naam (bijv. dr. …)",
  "Nombre": "Naam",
  "Especialidad": "Specialisme",
  "Centro (p. ej. Kentalis, Youz, huisartspraktijk)": "Instelling (bijv. Kentalis, Youz, huisartspraktijk)",
  "Centro": "Instelling",
  "Teléfono": "Telefoon",
  "Correo": "E-mail",
  "Dirección": "Adres",
  "Notas (días, qué trabaja con ella…)": "Notities (dagen, waar ze aan werkt…)",
  "Notas": "Notities",
  "Quitado del equipo.": "Uit het team verwijderd.",
  "Médicos, logopedia, Kentalis, Youz… Ella solo ve el nombre y el centro, nunca teléfonos ni notas.": "Artsen, logopedie, Kentalis, Youz… Ze ziet alleen naam en instelling, nooit telefoonnummers of notities.",
  "Todavía no hay nadie apuntado.": "Nog niemand geregistreerd.",
  "Añadido al equipo.": "Aan het team toegevoegd.",
  "Añadir al equipo": "Aan het team toevoegen",
  "Padre": "Vader",
  "Madre": "Moeder",
  "Tutor legal": "Wettelijke voogd",
  "Familiar": "Familielid",
  "Otro": "Anders",
  "País": "Land",
  "Relación": "Relatie",
  "Teléfono (+31 6…)": "Telefoon (+31 6…)",
  "Dirección privada (recogida segura)": "Privéadres (veilig ophalen)",
  "Dirección privada": "Privéadres",
  "Mensajes de la familia": "Familieberichten",
  "Un mensaje por línea: lo que quieres que ella recuerde siempre (lo ve en el Ángel Guardián y al practicar).": "Eén bericht per regel: wat je wilt dat ze onthoudt (zichtbaar bij de beschermengel en tijdens oefenen).",
  "👼 Ángel Guardián (SOS)": "👼 Beschermengel (SOS)",
  "Con el botón rojo SOS (pulsación larga) ella puede llamaros, mandaros un WhatsApp o un SMS con su ubicación exacta, o llamar a emergencias. El SOS intenta notificarte; comprueba la recepción. Las direcciones familiares son privadas y sirven para organizar una recogida por un adulto de confianza.": "Met de rode SOS-knop (lang indrukken) kan ze jullie bellen, WhatsApp of sms met haar locatie sturen, of de hulpdiensten bellen. SOS probeert je te waarschuwen; controleer de ontvangst. Familieadressen zijn privé en bedoeld voor veilig ophalen door een vertrouwde volwassene.",
  "🚨 ACTIVO": "🚨 ACTIEF",
  "✅ Resuelto": "✅ Opgelost",
  "Sin ubicación": "Geen locatie",
  "Contactos y mensajes guardados.": "Contacten en berichten opgeslagen.",
  "País: ": "Land: ",
  " Principal": " Primair",
  "Mensajes de la familia para ella (privados):": "Familieberichten voor haar (privé):",
  "Guardar contactos y mensajes": "Contacten en berichten opslaan",
  "Qué ves de sus charlas": "Wat je van haar gesprekken ziet",
  "Ahora ves las conversaciones completas, y ella lo sabe. Es lo más transparente, pero úsalo con criterio.": "Je ziet nu de volledige gesprekken en zij weet dat. Gebruik dit zorgvuldig.",
  "Ahora solo ves avisos y tiempos, no lo que escribe. Es el punto de partida más respetuoso.": "Je ziet nu alleen meldingen en tijden, niet wat ze schrijft. Dat respecteert haar privacy.",
  "Solo avisos.": "Alleen meldingen.",
  "Conversaciones visibles para ti (ella lo sabe).": "Gesprekken voor jou zichtbaar (zij weet het).",
  "Volver a solo avisos": "Terug naar alleen meldingen",
  "Ver conversaciones completas": "Volledige gesprekken bekijken",
  "Ella": "Zij",
  "Compañero": "Vriendje",
  "PIN de 4 a 8 cifras": "Pincode van 4 tot 8 cijfers",
  "PIN parental": "Ouderpincode",
  "Dispositivos y PIN": "Apparaten en pincode",
  "Ningún dispositivo emparejado todavía.": "Nog geen apparaat gekoppeld.",
  " · aún sin uso": " · nog niet gebruikt",
  " · revocado": " · ingetrokken",
  "Dispositivo desactivado.": "Apparaat gedeactiveerd.",
  "Desactivar": "Deactiveren",
  "No se pudo crear el código.": "Code aanmaken is niet gelukt.",
  "Emparejar un dispositivo nuevo": "Nieuw apparaat koppelen",
  "PIN cambiado.": "Pincode gewijzigd.",
  "PIN creado.": "Pincode aangemaakt.",
  "Cambiar PIN parental": "Ouderpincode wijzigen",
  "Crear PIN parental": "Ouderpincode aanmaken",
  "El PIN solo abre el área de padres en su app (se bloquea tras varios intentos). No es seguridad contra alguien con acceso al aparato: para eso está el emparejamiento.": "De pincode opent alleen de ouderzone in haar app (na meerdere pogingen geblokkeerd). De koppeling beschermt tegen toegang tot het apparaat.",
  "Actualizar": "Vernieuwen",
  "Cerrar": "Sluiten",
  "Cargando…": "Laden…",
  "Hecho.": "Gedaan.",
  "El área de padres está bloqueada.": "De ouderzone is vergrendeld.",
  "Alerta": "Alarm",
  "Bloqueado": "Geblokkeerd",
  "Aviso": "Melding",
  "Oferta": "Aanbieding",
  "Evento": "Evenement",
  "Película": "Film",
  "Producto": "Product",
  "Plan": "Uitje",
  "Luces": "Lampen",
  "Enchufes": "Stopcontacten",
  "Ventilador": "Ventilator",
  "Calefacción": "Verwarming",
  "Termostato": "Thermostaat",
  "Panel de padres · ": "Ouderpanel · ",
  "Equipo que cuida a ": "Zorgteam van ",
  "Tiempo de ocio hoy: ": "Vrije tijd vandaag: ",
  " · total: ": " · totaal: ",
  "Código: ": "Code: ",
  " (10 min, un solo uso). Escríbelo en el dispositivo de ella.": " (10 min, eenmalig). Voer deze in op haar apparaat.",
  " · visto ": " · gezien ",
  " — propuesto por ": " — voorgesteld door ",
  "Charla con su compañero": "Gesprek met haar maatje",
  "Vídeos (YouTube)": "Video’s (YouTube)",
  "Tele": "Televisie",
  "Sus intereses y planes": "Haar interesses en plannen",
  "Cole y tareas": "School en huiswerk",
  "Agenda": "Agenda",
  "Cámara y escáner": "Camera en scanner",
  "cita": "afspraak",
  "logopedia": "logopedie",
  "medico": "arts",
  "turno": "dienst",
  "escuela": "school",
  "cumple": "verjaardag",
  "actividad": "activiteit",
  "recordatorio": "herinnering",
  "Médico de cabecera (huisarts)": "Huisarts",
  "Pediatría": "Kindergeneeskunde",
  "Logopedia": "Logopedie",
  "Lenguaje · TOS": "Taal · TOS",
  "Salud mental juvenil (jeugd-ggz)": "Jeugd-ggz",
  "Psicología": "Psychologie",
  "Dentista": "Tandarts",
  "Ortodoncia": "Orthodontie",
  "Oftalmología": "Oogheelkunde",
  "Fisioterapia": "Fysiotherapie",
  "Colegio (apoyo)": "Schoolondersteuning",
  "ayuda": "hulp",
  "peligro": "gevaar",
  "herida": "gewond",
  "perdida": "verdwaald",
  "cama, sala, cocina": "slaapkamer, woonkamer, keuken",
  "Objetivo de práctica": "Oefendoel",
  "Sin objetivo": "Geen oefendoel",
  "Guardar objetivo": "Oefendoel opslaan",
  "Objetivo guardado.": "Oefendoel opgeslagen.",
  "Objetivo completado": "Oefendoel behaald",
  "Objetivo en curso": "Oefendoel in uitvoering",
  "Ver en el mapa": "Op de kaart bekijken"
});
export function mountKidParentPanel(host, options) {
  ensureStyles();
  const { request, mode = 'pin', kidId = 'kendra', onClose } = options;
  const founder = mode === 'founder';
  const locale=()=>currentLanguage(founder?'founder':'kendra');
  const pt=value=>locale()==='nl'?(PARENT_NL[value]??value):value;
  const kidParam = founder ? `kidId=${encodeURIComponent(kidId)}` : '';
  let destroyed = false;
  let overview = null;
  let notice = '';

  const withKid = (body = {}) => (founder ? { kidId, ...body } : body);
  const url = (path) => (founder && !path.includes('?') ? `${path}?${kidParam}` : path);

  async function act(method, path, body, okMessage) {
    const result = await request(method, path, body === undefined ? undefined : withKid(body));
    if (result.status >= 200 && result.status < 300) {
      notice = okMessage ?? pt('Hecho.');
      await load();
    } else {
      notice = (result.body && result.body.error) || `No se pudo (HTTP ${result.status}).`;
      render();
    }
    return result;
  }

  async function load() {
    const result = await request('GET', founder ? `/api/parent/kid/overview?${kidParam}` : '/api/parent/kid/overview');
    if (destroyed) return;
    if (result.status === 403 || result.status === 401) {
      host.replaceChildren(h('p', { class: 'kp-error' }, (result.body && result.body.error) || pt('El área de padres está bloqueada.')));
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
      h('h3', {}, pt('Hoy')),
      entries.length === 0
        ? h('p', { class: 'kp-muted' }, pt('Todavía no hay actividad hoy.'))
        : h('ul', { class: 'kp-list' }, entries.map(([key, value]) => h('li', {}, h('span', {}, pt(labels[key] ?? key)), h('strong', {}, minutes(value))))),
      h('p', { class: 'kp-muted' }, pt('Tiempo de ocio hoy: ')+minutes(overview.today.limitedMinutes)+pt(' · total: ')+minutes(overview.today.totalMinutes)),
      h('h4', {}, pt('Última semana')),
      h('div', { class: 'kp-bars', role: 'img', 'aria-label': pt('Minutos por día de la última semana') },
        [...overview.week].reverse().map((day) => h('div', { class: 'kp-bar' },
          h('div', { class: 'kp-bar-fill', style: `height:${Math.max(3, Math.round((day.totalMinutes / maxDay) * 100))}%`, title: minutes(day.totalMinutes) }),
          h('span', {}, dayLabel(day.date,locale()))))),
    );
  }

  function sectionFlags() {
    const unseen = overview.flags.filter((flag) => !flag.seen);
    return h('section', { class: 'kp-card' },
      h('h3', {}, pt('Avisos del filtro'), unseen.length > 0 ? h('span', { class: 'kp-badge' }, String(unseen.length)) : null),
      overview.flags.length === 0
        ? h('p', { class: 'kp-muted' }, pt('Sin avisos. El filtro es una primera capa: no sustituye a mirar de vez en cuando.'))
        : h('ul', { class: 'kp-list' }, overview.flags.slice(0, 15).map((flag) => h('li', { class: flag.seen ? 'kp-seen' : '' },
          h('span', {}, h('b', { class: `kp-sev kp-sev-${flag.severity}` }, pt(SEVERITY[flag.severity] ?? flag.severity)), ' ', flag.summary),
          h('small', {}, when(flag.at,locale()))))),
      unseen.length > 0 ? h('button', { type: 'button', onClick: () => act('POST', '/api/parent/kid/flags/seen', {}, pt('Avisos marcados como vistos.')) }, pt('Marcar como vistos')) : null,
    );
  }

  const youtube = () => overview.settings.media.youtube;

  async function saveMedia(next) {
    return act('PUT', '/api/parent/kid/settings', { media: next }, pt('Vídeos actualizados.'));
  }

  function sectionVideo() {
    const policy = overview.settings.media;
    const yt = youtube();
    const link = h('input', { type: 'text', placeholder: pt('Enlace o ID del vídeo de YouTube'), 'aria-label': pt('Enlace del vídeo'), autocomplete: 'off' });
    const label = h('input', { type: 'text', placeholder: pt('Nombre (p. ej. Baile de Stitch)'), 'aria-label': pt('Nombre del vídeo'), maxlength: '80' });
    return h('section', { class: 'kp-card' },
      h('h3', {}, pt('Vídeos aprobados')),
      h('p', { class: 'kp-muted' }, pt('Solo se reproducen los vídeos de esta lista, sin buscador ni vídeos relacionados propios. Mira cada uno antes de aprobarlo.')),
      overview.mediaRequests.length > 0 ? h('div', { class: 'kp-sub' },
        h('h4', {}, pt('Lo que ha pedido')),
        h('ul', { class: 'kp-list' }, overview.mediaRequests.map((item) => h('li', {},
          h('span', {}, item.text),
          h('button', { type: 'button', class: 'kp-small', onClick: () => act('POST', `/api/parent/kid/media-requests/${item.id}/dismiss`, {}, pt('Petición descartada.')) }, pt('Descartar')))))) : null,
      yt.mode === 'allowlist' && yt.videos.length > 0
        ? h('ul', { class: 'kp-list' }, yt.videos.map((video) => h('li', {},
          h('a', { href: `https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`, target: '_blank', rel: 'noopener noreferrer' }, video.label),
          h('button', { type: 'button', class: 'kp-small', onClick: () => saveMedia({ ...policy, youtube: { ...yt, videos: yt.videos.filter((item) => item.id !== video.id) } }) }, pt('Quitar')))))
        : h('p', { class: 'kp-muted' }, pt('Todavía no hay vídeos aprobados.')),
      h('form', { class: 'kp-form', onSubmit: (event) => {
        event.preventDefault();
        if (!link.value.trim() || !label.value.trim()) return;
        saveMedia({ ...policy, youtube: { ...yt, mode: 'allowlist', videos: [...yt.videos, { id: link.value.trim(), label: label.value.trim() }] } });
      } }, link, label, h('button', { type: 'submit' }, pt('Aprobar vídeo'))),
      h('label', { class: 'kp-check' },
        h('input', { type: 'checkbox', checked: yt.mode === 'allowlist', onChange: (event) => saveMedia({ ...policy, youtube: { ...yt, mode: event.target.checked ? 'allowlist' : 'off' } }) }),
        pt(' YouTube activado (solo lista aprobada)')),
    );
  }

  function sectionFeed() {
    const title = h('input', { type: 'text', placeholder: pt('Título (p. ej. Entrada 2x1 en el parque)'), 'aria-label': pt('Título'), maxlength: '120' });
    const kind = h('select', { 'aria-label': pt('Tipo') }, Object.entries(KIND_LABELS).map(([value, text]) => h('option', { value }, pt(text))));
    const place = h('input', { type: 'text', placeholder: pt('Lugar (opcional)'), 'aria-label': pt('Lugar'), maxlength: '80' });
    const from = h('input', { type: 'date', 'aria-label': pt('Desde') });
    const until = h('input', { type: 'date', 'aria-label': pt('Hasta') });
    const link = h('input', { type: 'url', placeholder: pt('Enlace https (solo lo ves tú)'), 'aria-label': pt('Enlace') });
    return h('section', { class: 'kp-card' },
      h('h3', {}, pt('Planes y ofertas para ella')),
      overview.pendingFeed.length > 0 ? h('div', { class: 'kp-sub' },
        h('h4', {}, pt('Pendientes de tu aprobación')),
        h('ul', { class: 'kp-list' }, overview.pendingFeed.map((item) => h('li', {},
          h('span', {}, h('b', {}, pt(KIND_LABELS[item.kind] ?? item.kind)), ' ', item.title, item.place ? ` · ${item.place}` : '', item.url ? h('small', {}, ` (${item.url})`) : null, h('small', {}, pt(' — propuesto por ')+item.source)),
          h('span', { class: 'kp-actions' },
            h('button', { type: 'button', class: 'kp-small', onClick: () => act('POST', `/api/parent/kid/feed/${item.id}/decision`, { decision: 'approved' }, pt('Aprobado: ya lo ve ella.')) }, pt('Aprobar')),
            h('button', { type: 'button', class: 'kp-small kp-danger', onClick: () => act('POST', `/api/parent/kid/feed/${item.id}/decision`, { decision: 'rejected' }, pt('Descartado.')) }, pt('Rechazar')))))) ) : null,
      h('p', { class: 'kp-muted' }, pt('Lo que Janus encuentre por internet llega aquí como «pendiente»: ella solo ve lo que apruebas.')),
      h('form', { class: 'kp-form', onSubmit: (event) => {
        event.preventDefault();
        if (!title.value.trim()) return;
        const item = { title: title.value.trim(), kind: kind.value };
        if (place.value.trim()) item.place = place.value.trim();
        if (from.value) item.from = from.value;
        if (until.value) item.until = until.value;
        if (link.value.trim()) item.url = link.value.trim();
        act('POST', '/api/parent/kid/feed', { item, source: 'tutor' }, pt('Añadido para ella.'));
      } }, title, kind, place, h('div', { class: 'kp-row' }, h('label', {}, pt('Desde '), from), h('label', {}, pt('Hasta '), until)), link, h('button', { type: 'submit' }, pt('Añadir para ella'))),
    );
  }

  function sectionLimits() {
    const limits = overview.settings.limits;
    const from = h('input', { type: 'time', value: limits.allowedFrom, 'aria-label': pt('Desde') });
    const until = h('input', { type: 'time', value: limits.allowedUntil, 'aria-label': pt('Hasta') });
    const total = h('input', { type: 'number', min: '0', max: '600', value: String(limits.totalDailyMinutes), 'aria-label': pt('Minutos al día') });
    const yt = h('input', { type: 'number', min: '0', max: '600', value: String(limits.perCategoryMinutes.youtube ?? ''), placeholder: pt('sin tope'), 'aria-label': pt('Minutos de YouTube') });
    const tv = h('input', { type: 'number', min: '0', max: '600', value: String(limits.perCategoryMinutes.tv ?? ''), placeholder: pt('sin tope'), 'aria-label': pt('Minutos de tele') });
    const warn = h('input', { type: 'number', min: '0', max: '30', value: String(limits.warnMinutesBefore), 'aria-label': pt('Aviso previo') });
    const bonus = h('input', { type: 'number', min: '0', max: '120', value: '15', 'aria-label': pt('Minutos extra') });
    return h('section', { class: 'kp-card' },
      h('h3', {}, pt('Horario y tiempo')),
      h('form', { class: 'kp-form', onSubmit: (event) => {
        event.preventDefault();
        const perCategoryMinutes = { ...limits.perCategoryMinutes };
        for (const [key, input] of [['youtube', yt], ['tv', tv]]) {
          if (input.value === '') delete perCategoryMinutes[key]; else perCategoryMinutes[key] = Number(input.value);
        }
        act('PUT', '/api/parent/kid/settings', { limits: { allowedFrom: from.value, allowedUntil: until.value, totalDailyMinutes: Number(total.value), perCategoryMinutes, warnMinutesBefore: Number(warn.value) } }, pt('Límites guardados.'));
      } },
        h('div', { class: 'kp-row' }, h('label', {}, pt('Puede usarla desde '), from), h('label', {}, pt('hasta '), until)),
        h('label', {}, pt('Ocio al día (min) '), total),
        h('div', { class: 'kp-row' }, h('label', {}, pt('YouTube (min) '), yt), h('label', {}, pt('Tele (min) '), tv)),
        h('label', {}, pt('Avisarle antes (min) '), warn),
        h('button', { type: 'submit' }, pt('Guardar límites'))),
      h('p', { class: 'kp-muted' }, pt('Cole, agenda y casa no se cortan por tiempo. Al acabarse el tiempo recibe un aviso amable unos minutos antes.')),
      h('div', { class: 'kp-row' }, h('label', {}, pt('Minutos extra hoy '), bonus), h('button', { type: 'button', onClick: () => act('POST', '/api/parent/kid/bonus', { minutes: Number(bonus.value) }, pt('Minutos extra concedidos para hoy.')) }, pt('Dar'))),
    );
  }

  function sectionHome() {
    const home = overview.settings.home;
    const rooms = h('input', { type: 'text', value: home.allowedRooms.join(', '), placeholder: pt('cama, sala, cocina'), 'aria-label': pt('Habitaciones permitidas') });
    const boxes = Object.entries(HOME_KINDS).map(([kind, text]) => ({ kind, input: h('input', { type: 'checkbox', checked: home.allowedKinds.includes(kind) }), text }));
    const allowOn = h('input', { type: 'checkbox', checked: home.heating.allowOn });
    const allowOff = h('input', { type: 'checkbox', checked: home.heating.allowOff });
    const minTemp = h('input', { type: 'number', min: '10', max: '24', value: String(home.heating.minTemp), 'aria-label': pt('Mínimo') });
    const maxTemp = h('input', { type: 'number', min: '10', max: '24', value: String(home.heating.maxTemp), 'aria-label': pt('Máximo') });
    const enabled = h('input', { type: 'checkbox', checked: home.enabled });
    return h('section', { class: 'kp-card' },
      h('h3', {}, pt('Control de la casa')),
      h('p', { class: 'kp-muted' }, pt('Nunca podrá tocar cerraduras, cámaras, alarmas ni cocina. Si está en otra casa, apaga el interruptor general.')),
      h('form', { class: 'kp-form', onSubmit: (event) => {
        event.preventDefault();
        act('PUT', '/api/parent/kid/settings', { home: {
          enabled: enabled.checked,
          allowedRooms: rooms.value.split(',').map((room) => room.trim()).filter(Boolean),
          allowedKinds: boxes.filter((box) => box.input.checked).map((box) => box.kind),
          heating: { allowOff: allowOff.checked, allowOn: allowOn.checked, minTemp: Number(minTemp.value), maxTemp: Number(maxTemp.value) },
        } }, pt('Casa actualizada.'));
      } },
        h('label', { class: 'kp-check' }, enabled, pt(' Interruptor general: puede controlar la casa')),
        h('label', {}, pt('Habitaciones '), rooms),
        h('div', { class: 'kp-row kp-wrap' }, boxes.map((box) => h('label', { class: 'kp-check' }, box.input, ' '+pt(box.text)))),
        h('label', { class: 'kp-check' }, allowOff, pt(' Puede apagar la calefacción')),
        h('label', { class: 'kp-check' }, allowOn, pt(' Puede encender la calefacción')),
        h('div', { class: 'kp-row' }, h('label', {}, pt('Temperatura mín. '), minTemp), h('label', {}, pt('máx. '), maxTemp)),
        h('button', { type: 'submit' }, pt('Guardar casa'))),
    );
  }

  function sectionPlace() {
    const place = overview.settings.locality;
    const label = h('input', { type: 'text', value: place ? place.label : '', placeholder: pt('Nombre del lugar (p. ej. Amsterdam)'), 'aria-label': pt('Lugar') });
    const lat = h('input', { type: 'number', step: '0.0001', value: place ? String(place.lat) : '', placeholder: pt('Latitud'), 'aria-label': pt('Latitud') });
    const lon = h('input', { type: 'number', step: '0.0001', value: place ? String(place.lon) : '', placeholder: pt('Longitud'), 'aria-label': pt('Longitud') });
    return h('section', { class: 'kp-card' },
      h('h3', {}, pt('Su zona (tiempo y ropa)')),
      h('p', { class: 'kp-muted' }, pt('Solo se envían estas coordenadas a Open-Meteo para saber el tiempo. Sin zona, no hay consejo de ropa.')),
      h('form', { class: 'kp-form', onSubmit: (event) => {
        event.preventDefault();
        act('PUT', '/api/parent/kid/settings', { locality: label.value.trim() ? { label: label.value.trim(), lat: Number(lat.value), lon: Number(lon.value) } : null }, pt('Zona guardada.'));
      } }, label, h('div', { class: 'kp-row' }, lat, lon), h('button', { type: 'submit' }, pt('Guardar zona'))),
    );
  }

  function sectionSchool() {
    const goal = overview.schoolGoal;
    const choices = overview.schoolChoices ?? [];
    const active = choices.find(choice => choice.id === goal?.lessonId);
    const title = choice => locale() === 'nl' ? choice.nl : choice.es;
    const select = h('select', { 'aria-label': pt('Objetivo de práctica') },
      h('option', { value: '' }, pt('Sin objetivo')),
      ...choices.map(choice => h('option', { value: choice.id }, title(choice))));
    select.value = active?.id ?? '';
    return h('section', { class: 'kp-card' }, h('h3', {}, 'Janus School'),
      active ? h('p', {}, pt(goal.completed ? 'Objetivo completado' : 'Objetivo en curso'), ' · ', title(active)) : null,
      h('form', { class: 'kp-form', onSubmit: async event => {
        event.preventDefault();
        const submit = event.currentTarget.querySelector('button');
        submit.disabled = true;
        try {
          await act('PUT', '/api/parent/kid/school-goal', { lessonId: select.value || null }, pt('Objetivo guardado.'));
        } finally { submit.disabled = false; }
      } }, h('label', {}, pt('Objetivo de práctica'), select), h('button', { type: 'submit' }, pt('Guardar objetivo'))));
  }

  function sectionAgenda() {
    const title = h('input', { type: 'text', placeholder: pt('Qué (p. ej. dentista)'), 'aria-label': pt('Título'), maxlength: '80' });
    const date = h('input', { type: 'date', 'aria-label': pt('Fecha') });
    const time = h('input', { type: 'time', 'aria-label': pt('Hora') });
    const kind = h('select', { 'aria-label': pt('Tipo') }, AGENDA_KINDS.map((value) => h('option', { value }, pt(value))));
    const team = overview.careTeam ?? [];
    const who = h('select', { 'aria-label': pt('Con qué especialista') }, h('option', { value: '' }, pt('Sin especialista')), ...team.map((provider) => h('option', { value: provider.id }, `${provider.name} · ${labelOf(provider.specialty)}`)));
    const byId = new Map(team.map((provider) => [provider.id, provider]));
    const upcoming = (overview.agenda ?? []).filter((item) => item.date >= (overview.today?.date ?? '')).sort((a, b) => `${a.date} ${a.time ?? ''}`.localeCompare(`${b.date} ${b.time ?? ''}`)).slice(0, 8);
    const task = h('input', { type: 'text', placeholder: pt('Tarea para ella (p. ej. Leer 10 minutos)'), 'aria-label': pt('Tarea'), maxlength: '100' });
    const due = h('input', { type: 'date', 'aria-label': pt('Para el día') });
    return h('section', { class: 'kp-card' },
      h('h3', {}, pt('Agenda y tareas de ella')),
      h('form', { class: 'kp-form', onSubmit: (event) => {
        event.preventDefault();
        if (!title.value.trim() || !date.value) return;
        act('POST', '/api/parent/kid/agenda', { item: { title: title.value.trim(), date: date.value, ...(time.value ? { time: time.value } : {}), kind: kind.value, ...(who.value ? { providerId: who.value } : {}) } }, pt('Añadido a su agenda con recordatorios.'));
      } }, title, h('div', { class: 'kp-row' }, date, time, kind), team.length ? who : null, h('button', { type: 'submit' }, pt('Añadir a su agenda'))),
      upcoming.length ? h('ul', { class: 'kp-list' }, upcoming.map((item) => { const p = item.providerId ? byId.get(item.providerId) : null; return h('li', {}, h('strong', {}, item.title), ` · ${item.date}${item.time ? ` ${item.time}` : ''}`, p ? h('span', { class: 'kp-muted' }, ` · ${p.name} (${labelOf(p.specialty)}${p.organization ? `, ${p.organization}` : ''})`) : null); })) : null,
      h('form', { class: 'kp-form', onSubmit: (event) => {
        event.preventDefault();
        if (!task.value.trim()) return;
        act('POST', '/api/parent/kid/tasks', { task: { title: task.value.trim(), ...(due.value ? { due: due.value } : {}) } }, pt('Tarea añadida.'));
      } }, task, h('label', {}, pt('Para el '), due), h('button', { type: 'submit' }, pt('Añadir tarea'))),
    );
  }

  function labelOf(specialty) { return pt((overview.careSpecialties ?? []).find((item) => item.id === specialty)?.label ?? specialty); }

  // Equipo que cuida a la niña: nombre, especialidad, centro y contacto. Privado: la niña solo ve nombre, etiqueta y centro.
  function sectionCareTeam() {
    const team = overview.careTeam ?? [];
    const name = h('input', { type: 'text', placeholder: pt('Nombre (p. ej. Dra. …)'), 'aria-label': pt('Nombre'), maxlength: '80' });
    const specialty = h('select', { 'aria-label': pt('Especialidad') }, (overview.careSpecialties ?? []).map((item) => h('option', { value: item.id }, pt(item.label))));
    const org = h('input', { type: 'text', placeholder: pt('Centro (p. ej. Kentalis, Youz, huisartspraktijk)'), 'aria-label': pt('Centro'), maxlength: '80' });
    const phone = h('input', { type: 'tel', placeholder: pt('Teléfono'), 'aria-label': pt('Teléfono'), maxlength: '30' });
    const email = h('input', { type: 'email', placeholder: pt('Correo'), 'aria-label': pt('Correo'), maxlength: '120' });
    const address = h('input', { type: 'text', placeholder: pt('Dirección'), 'aria-label': pt('Dirección'), maxlength: '160' });
    const notes = h('input', { type: 'text', placeholder: pt('Notas (días, qué trabaja con ella…)'), 'aria-label': pt('Notas'), maxlength: '300' });
    const row = (provider) => h('li', {},
      h('strong', {}, provider.name), ` · ${labelOf(provider.specialty)}${provider.organization ? ` · ${provider.organization}` : ''}`,
      provider.phone ? h('div', { class: 'kp-muted' }, `Tel. ${provider.phone}`) : null,
      provider.email ? h('div', { class: 'kp-muted' }, provider.email) : null,
      provider.address ? h('div', { class: 'kp-muted' }, provider.address) : null,
      provider.notes ? h('div', { class: 'kp-muted' }, provider.notes) : null,
      h('button', { type: 'button', class: 'kp-small', onClick: () => { if (confirm(`¿Quitar a ${provider.name} del equipo? Sus citas se conservan.`)) act('DELETE', url(`/api/parent/kid/care-team/${provider.id}`), undefined, pt('Quitado del equipo.')); } }, pt('Quitar')));
    return h('section', { class: 'kp-card' },
      h('h3', {}, pt('Equipo que cuida a ')+overview.profile.displayName),
      h('p', { class: 'kp-muted' }, pt('Médicos, logopedia, Kentalis, Youz… Ella solo ve el nombre y el centro, nunca teléfonos ni notas.')),
      team.length ? h('ul', { class: 'kp-list' }, team.map(row)) : h('p', { class: 'kp-muted' }, pt('Todavía no hay nadie apuntado.')),
      h('form', { class: 'kp-form', onSubmit: (event) => {
        event.preventDefault();
        if (name.value.trim().length < 2) return;
        act('POST', '/api/parent/kid/care-team', { provider: { name: name.value.trim(), specialty: specialty.value, organization: org.value.trim(), phone: phone.value.trim(), email: email.value.trim(), address: address.value.trim(), notes: notes.value.trim() } }, pt('Añadido al equipo.'));
      } }, name, h('div', { class: 'kp-row' }, specialty, org), h('div', { class: 'kp-row' }, phone, email), address, notes, h('button', { type: 'submit' }, pt('Añadir al equipo'))),
    );
  }

  // Ángel Guardián: plantilla de contactos de emergencia (padre, madre, tutor legal…) y últimos avisos SOS.
  function sectionGuardianAngel() {
    const current = overview.guardianAngel;
    const roles = [['padre', pt('Padre')], ['madre', pt('Madre')], ['tutor_legal', pt('Tutor legal')], ['familiar', pt('Familiar')], ['otro', pt('Otro')]];
    const countries = [['NL', 'Países Bajos · 112'], ['BE', 'Bélgica · 112'], ['DE', 'Alemania · 112'], ['ES', 'España · 112'], ['FR', 'Francia · 112'], ['IT', 'Italia · 112'], ['PT', 'Portugal · 112'], ['GB', 'Reino Unido · 999'], ['US', 'EE. UU. · 911'], ['MX', 'México · 911'], ['CO', 'Colombia · 123']];
    const regionNames = new Intl.DisplayNames([locale()], { type: 'region' });
    const country = h('select', { 'aria-label': pt('País') }, countries.map(([value, label]) => h('option', { value, selected: (current?.country ?? 'NL') === value }, locale() === 'nl' ? regionNames.of(value) + label.slice(label.indexOf(' · ')) : label)));
    const rows = Array.from({ length: 5 }, (_, index) => {
      const g = current?.guardians?.[index];
      return {
        role: h('select', { 'aria-label': pt('Relación') }, roles.map(([value, label]) => h('option', { value, selected: (g?.role ?? (index === 0 ? 'padre' : index === 1 ? 'madre' : 'tutor_legal')) === value }, label))),
        name: h('input', { type: 'text', placeholder: pt('Nombre'), 'aria-label': pt('Nombre'), maxlength: '60', value: g?.name ?? '' }),
        phone: h('input', { type: 'tel', placeholder: pt('Teléfono (+31 6…)'), 'aria-label': pt('Teléfono'), maxlength: '30', value: g?.phone ?? '' }),
        address: h('input', { type:'text', placeholder:pt('Dirección privada (recogida segura)'), 'aria-label':pt('Dirección privada'), maxlength:'240', value:g?.address ?? '' }),
        wa: h('input', { type: 'checkbox', checked: g ? g.whatsapp : true }),
        primary: h('input', { type: 'radio', name: 'ga-primary', checked: g ? g.primary : index === 0 }),
      };
    });
    const events = overview.sos ?? [];
    const messages = h('textarea', { rows: '6', 'aria-label': pt('Mensajes de la familia'), placeholder: pt('Un mensaje por línea: lo que quieres que ella recuerde siempre (lo ve en el Ángel Guardián y al practicar).') });
    messages.value = (current?.messages ?? []).join('\n');
    return h('section', { class: 'kp-card' },
      h('h3', {}, pt('👼 Ángel Guardián (SOS)')),
      h('p', { class: 'kp-muted' }, pt('Con el botón rojo SOS (pulsación larga) ella puede llamaros, mandaros un WhatsApp o un SMS con su ubicación exacta, o llamar a emergencias. El SOS intenta notificarte; comprueba la recepción. Las direcciones familiares son privadas y sirven para organizar una recogida por un adulto de confianza.')),
      events.length ? h('ul', { class: 'kp-list' }, events.map((e) => { const last = e.locations[e.locations.length - 1]; return h('li', {}, h('strong', {}, e.status === 'activo' ? pt('🚨 ACTIVO') : pt('✅ Resuelto')), ` · ${pt(e.kind)} · ${e.startedAt.slice(0, 16).replace('T', ' ')}`, last ? h('div', {}, h('a', { href: `https://maps.google.com/?q=${last.lat},${last.lon}`, target: '_blank', rel: 'noopener' }, pt('Ver en el mapa')+(last.accuracy !== undefined ? ` (±${last.accuracy} m)` : ''))) : h('div', { class: 'kp-muted' }, pt('Sin ubicación'))); })) : null,
      h('form', { class: 'kp-form', onSubmit: (event) => {
        event.preventDefault();
        const guardians = rows.filter((r) => r.name.value.trim() && r.phone.value.trim()).map((r) => ({ role: r.role.value, name: r.name.value.trim(), phone: r.phone.value.trim(), address: r.address.value.trim(), whatsapp: r.wa.checked, primary: r.primary.checked }));
        act('PUT', '/api/parent/kid/guardian-angel', { config: { country: country.value, childName: overview.profile.displayName, guardians, messages: messages.value.split('\n').map((line) => line.trim()).filter(Boolean) } }, pt('Contactos y mensajes guardados.'));
      } }, h('label', {}, pt('País: '), country),
        ...rows.map((r, index) => h('div', { class: 'kp-row' }, r.role, r.name, r.phone, r.address, h('label', {}, r.wa, ' WhatsApp'), h('label', {}, r.primary, index === 0 ? pt(' Principal') : pt(' Principal')))),
        h('label', {}, pt('Mensajes de la familia para ella (privados):')), messages,
        h('button', { type: 'submit' }, pt('Guardar contactos y mensajes'))),
    );
  }

  function sectionPrivacy() {
    const full = overview.settings.transcriptVisibility === 'full';
    return h('section', { class: 'kp-card' },
      h('h3', {}, pt('Qué ves de sus charlas')),
      h('p', { class: 'kp-muted' }, full
        ? pt('Ahora ves las conversaciones completas, y ella lo sabe. Es lo más transparente, pero úsalo con criterio.')
        : pt('Ahora solo ves avisos y tiempos, no lo que escribe. Es el punto de partida más respetuoso.')),
      h('button', { type: 'button', onClick: () => act('PUT', '/api/parent/kid/settings', { transcriptVisibility: full ? 'flags' : 'full' }, full ? pt('Solo avisos.') : pt('Conversaciones visibles para ti (ella lo sabe).')) }, full ? pt('Volver a solo avisos') : pt('Ver conversaciones completas')),
      full && overview.transcripts ? h('ul', { class: 'kp-list kp-transcript' }, overview.transcripts.map((line) => h('li', {}, h('b', {}, line.role === 'kid' ? pt('Ella') : pt('Compañero')), ': ', line.text, h('small', {}, ` ${when(line.at,locale())}`)))) : null,
    );
  }

  function sectionDevices() {
    if (!founder) return null;
    const pin = h('input', { type: 'password', inputmode: 'numeric', pattern: '[0-9]*', maxlength: '8', placeholder: pt('PIN de 4 a 8 cifras'), autocomplete: 'new-password', 'aria-label': pt('PIN parental') });
    let codeBox = null;
    const codeOut = h('p', { class: 'kp-code', 'aria-live': 'polite' });
    codeBox = codeOut;
    return h('section', { class: 'kp-card' },
      h('h3', {}, pt('Dispositivos y PIN')),
      h('ul', { class: 'kp-list' }, overview.devices.length === 0 ? h('li', {}, h('span', { class: 'kp-muted' }, pt('Ningún dispositivo emparejado todavía.'))) : overview.devices.map((device) => h('li', {},
        h('span', {}, device.label, h('small', {}, device.lastSeenAt ? pt(' · visto ')+when(device.lastSeenAt,locale()) : pt(' · aún sin uso')), device.revokedAt ? h('small', {}, pt(' · revocado')) : null),
        device.revokedAt ? null : h('button', { type: 'button', class: 'kp-small kp-danger', onClick: () => act('DELETE', `/api/parent/kid/devices/${device.id}`, undefined, pt('Dispositivo desactivado.')) }, pt('Desactivar'))))),
      h('button', { type: 'button', onClick: async () => {
        const result = await request('POST', '/api/parent/kid/pairing', { kidId });
        codeBox.textContent = result.status === 201 ? pt('Código: ')+result.body.code+pt(' (10 min, un solo uso). Escríbelo en el dispositivo de ella.') : ((result.body && result.body.error) || pt('No se pudo crear el código.'));
      } }, pt('Emparejar un dispositivo nuevo')),
      codeOut,
      h('form', { class: 'kp-form', onSubmit: async (event) => {
        event.preventDefault();
        const ok = await act('POST', '/api/parent/kid/pin', { pin: pin.value }, overview.pinSet ? pt('PIN cambiado.') : pt('PIN creado.'));
        if (ok.status === 200) pin.value = '';
      } }, pin, h('button', { type: 'submit' }, overview.pinSet ? pt('Cambiar PIN parental') : pt('Crear PIN parental'))),
      h('p', { class: 'kp-muted' }, pt('El PIN solo abre el área de padres en su app (se bloquea tras varios intentos). No es seguridad contra alguien con acceso al aparato: para eso está el emparejamiento.')),
    );
  }

  function render() {
    if (destroyed || !overview) return;
    host.replaceChildren(...[
      h('div', { class: 'kp-head' },
        h('h2', {}, pt('Panel de padres · ')+overview.profile.displayName),
        h('span', { class: 'kp-actions' },
          h('button', { type: 'button', class: 'kp-small', onClick: load }, pt('Actualizar')),
          onClose ? h('button', { type: 'button', class: 'kp-small', onClick: onClose }, pt('Cerrar')) : null)),
      notice ? h('p', { class: 'kp-notice', role: 'status' }, notice) : null,
      sectionToday(), sectionFlags(), sectionVideo(), sectionFeed(), sectionLimits(), sectionHome(), sectionGuardianAngel(), sectionPlace(), sectionCareTeam(), sectionAgenda(), sectionSchool(), sectionPrivacy(), sectionDevices(),
    ].filter(Boolean));
    notice = '';
  }

  host.classList.add('kp-root');
  host.replaceChildren(h('p', { class: 'kp-muted' }, pt('Cargando…')));
  void load();
  return { reload: load, destroy: () => { destroyed = true; overview = null; host.replaceChildren(); } };
}

export const PARENT_PANEL_CSS = `
.kp-root{display:grid;gap:12px;font:15px/1.4 system-ui,sans-serif;color:inherit}
.kp-head{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between}
.kp-head h2{margin:0;font-size:1.15rem}
.kp-card{padding:12px 14px;border-radius:14px;border:1px solid var(--kp-border,rgba(128,128,128,.35));background:var(--kp-bg,rgba(128,128,128,.08));display:grid;gap:8px}
.kp-list{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.kp-list li{padding:8px 10px;border-radius:10px;border:1px solid var(--kp-border,rgba(128,128,128,.35))}
.kp-card h3,.kp-card h4{margin:0}
.kp-list{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.kp-list li{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.kp-seen{opacity:.55}
.kp-muted{margin:0;opacity:.75;font-size:.9em}
.kp-form{display:grid;gap:8px}
.kp-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.kp-wrap{row-gap:4px}
.kp-check{display:flex;gap:6px;align-items:center}
.kp-root input[type=text],.kp-root input[type=url],.kp-root input[type=number],.kp-root input[type=date],.kp-root input[type=time],.kp-root input[type=password],.kp-root input[type=tel],.kp-root input[type=email],.kp-root select{min-block-size:42px;padding:6px 10px;border-radius:10px;border:1px solid var(--kp-border,rgba(128,128,128,.45));background:transparent;color:inherit;font:inherit;max-inline-size:100%}
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
