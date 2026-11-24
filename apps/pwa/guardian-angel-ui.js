/**
 * Ángel Guardián · interfaz reutilizable (botón SOS + guía paso a paso). Sin dependencias: solo DOM y el módulo
 * ./guardian-angel.js (espejo idéntico de packages/modules/guardian-angel). Otros productos la montan igual:
 *   mountGuardianAngel(document.body, { request, childName, practice })
 * request(method, path, body) → { status, body } habla con el anfitrión: GET /api/kid/guardian-angel, POST /api/kid/sos…
 * Nunca llama ni envía mensajes sola: deja los botones de llamada, WhatsApp y SMS listos para pulsar.
 */
import {
  HOLD_MS, ROLE_LABEL, FIRST_AID, FIRST_AID_ENTRIES, COMPRESSIONS_PER_MINUTE, SELF_DEFENSE, STREET_SAFETY, FAMILY_VALUES, FIRST_AID_WORDS,
  alertText, contactLinks, emergencyCall, validLocation,
} from './guardian-angel.js';

const CSS = `
.ga-btn{position:fixed;inset-inline-end:14px;inset-block-end:calc(84px + env(safe-area-inset-bottom));z-index:60;inline-size:68px;block-size:68px;border-radius:50%;border:3px solid #fff;
 background:radial-gradient(circle at 35% 30%,#ff8a8a,#e11d48 55%,#9f1239);color:#fff;font:800 18px/1 system-ui,sans-serif;letter-spacing:.5px;box-shadow:0 8px 20px rgba(159,18,57,.45);touch-action:none;user-select:none}
.ga-btn .ga-ring{position:absolute;inset:-7px;border-radius:50%;border:5px solid #fde047;clip-path:inset(0 0 100% 0);pointer-events:none}
.ga-btn.ga-hold .ga-ring{animation:ga-fill ${HOLD_MS}ms linear forwards}
@keyframes ga-fill{to{clip-path:inset(0 0 0 0)}}
.ga-sheet{position:fixed;inset:0;z-index:70;background:#fff7f7;color:#1f1235;overflow:auto;padding:16px 16px 40px;font:500 18px/1.45 system-ui,sans-serif}
.ga-sheet h2{margin:.2em 0;font-size:26px}.ga-sheet h3{margin:.6em 0 .3em;font-size:21px}
.ga-row{display:flex;flex-wrap:wrap;gap:10px;margin:10px 0}
.ga-sheet a,.ga-sheet button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-block-size:58px;padding:0 16px;border-radius:16px;border:2px solid #e5e7eb;background:#fff;color:#1f1235;font:700 18px system-ui,sans-serif;text-decoration:none}
.ga-112{background:#dc2626!important;color:#fff!important;border-color:#991b1b!important;font-size:22px!important;min-inline-size:140px}
.ga-call{background:#16a34a!important;color:#fff!important;border-color:#166534!important}
.ga-wa{background:#22c55e!important;color:#fff!important}
.ga-step{background:#fff;border:3px solid #fda4af;border-radius:22px;padding:16px;margin:12px 0}
.ga-step .ga-say{font-size:24px;font-weight:700;line-height:1.35}.ga-step .ga-simple{color:#6b21a8;margin-top:8px}
.ga-beat{inline-size:90px;block-size:90px;border-radius:50%;background:#dc2626;margin:12px auto;animation:ga-beat calc(60s / ${COMPRESSIONS_PER_MINUTE}) ease-out infinite}
@keyframes ga-beat{0%{transform:scale(1)}15%{transform:scale(.72)}100%{transform:scale(1)}}
.ga-status{font-size:15px;color:#475569}.ga-love{background:#fdf2f8;border-radius:16px;padding:12px 14px;margin-top:14px}
.ga-practice{background:#fef9c3;border:2px dashed #ca8a04;border-radius:14px;padding:8px 12px;font-weight:700}
`;

function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v; else if (k.startsWith('on')) node.addEventListener(k.slice(2), v); else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat()) if (c != null && c !== false) node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return node;
}

function speak(text) {
  try {
    const synth = globalThis.speechSynthesis; if (!synth) return;
    synth.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = 'es-ES'; u.rate = 0.9; synth.speak(u);
  } catch { /* sin voz: el texto se ve en grande */ }
}

/** Metrónomo de reanimación: un «tic» a 110 por minuto (ERC: 100–120). */
function metronome() {
  let ctx = null, timer = 0;
  return {
    start() {
      try { ctx = ctx || new (globalThis.AudioContext || globalThis.webkitAudioContext)(); } catch { return; }
      const beat = () => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 880; g.gain.value = 0.25; o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.06); };
      clearInterval(timer); timer = setInterval(beat, 60000 / COMPRESSIONS_PER_MINUTE); beat();
    },
    stop() { clearInterval(timer); timer = 0; },
  };
}

// Estados de transporte: guardar en el servidor no demuestra que un tutor haya recibido el push.
export function sosDeliveryLabel({ practice, sosId, createFailed, lastLoc, sentAt, gpsError }) {
  if (practice) return 'Práctica: no se envía ubicación ni se avisa a nadie.';
  const event = sosId ? 'SOS registrado en Janus; recepción por la familia sin confirmar.'
    : createFailed ? 'No se confirmó el SOS. Llama al 112 o a tu familia.' : 'Intentando registrar el SOS. Puedes llamar ya.';
  const location = gpsError ? 'GPS no disponible; di dónde estás o pide ayuda al personal.'
    : !lastLoc ? 'Buscando ubicación…'
    : lastLoc.at && sentAt === lastLoc.at ? 'Última ubicación registrada en Janus'
    : 'Ubicación obtenida; envío todavía sin confirmar';
  return event + ' ' + location + (lastLoc && !gpsError && Number.isFinite(lastLoc.accuracy) ? ' (±' + Math.round(lastLoc.accuracy) + ' m).' : '');
}

// Búsqueda opcional, no navegación certificada ni afirmación de horario o seguridad.
// No se envían datos a mapas hasta pulsar el enlace. Nunca buscar un domicilio familiar en persecución.
export function refugeSearchUrl(location, category) {
  if (typeof location?.lat !== 'number' || typeof location?.lon !== 'number') return null;
  const loc = validLocation(location);
  const terms = { police: 'politie', hospital: 'spoedeisende hulp', staffed: 'supermarkt hotel receptie' };
  if (!loc || !Object.prototype.hasOwnProperty.call(terms, category)) return null;
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(terms[category] + ' near ' + loc.lat + ',' + loc.lon);
}
export function orderedGuardians(guardians) {
  const rank = { padre: 0, madre: 1, tutor_legal: 2, familiar: 3, otro: 4 };
  return (guardians ?? []).slice().sort((a,b) => Number(b.primary) - Number(a.primary) || (rank[a.role] ?? 9) - (rank[b.role] ?? 9));
}

export function mountGuardianAngel(host, { request, childName = '', practice = false } = {}) {
  if (!document.getElementById('ga-css')) document.head.append(el('style', { id: 'ga-css' }, CSS));
  let config = null, sosId = null, watch = null, lastSent = 0, lastLoc = null, sheet = null, stepId = null, kind = 'ayuda';
  let sentAt = null, gpsError = false, createFailed = false, creating = false, sending = false, closing = false, closeError = '', silent = false;
  let followup = 0, generation = 0, beatActive = false, reportedKind = 'ayuda', kindSending = false, retryTimer = 0;
  const beat = metronome();

  async function loadConfig() {
    const result = await request('GET', '/api/kid/guardian-angel');
    if (result.status === 200) { config = result.body.config; childName = result.body.childName || childName; }
  }

  async function sendLocation(force = false) {
    if (practice || !sheet || !sosId || !lastLoc || sending || closing || sentAt === lastLoc.at) return;
    if (!force && Date.now() - lastSent < 20_000) return;
    const current = generation, id = sosId, point = lastLoc;
    sending = true; lastSent = Date.now();
    try {
      const result = await request('POST', '/api/kid/sos/' + id + '/location', { location: point });
      if (current === generation && result.status === 200) sentAt = point.at;
    } catch { /* No se afirma entrega. Se reintenta en la próxima actualización GPS. */ }
    finally { if (current === generation) { sending = false; refreshLocation(); } }
  }

  function refreshLocation() {
    if (!sheet) return;
    const status = sheet.querySelector('[data-ga-status]');
    if (status) status.textContent = sosDeliveryLabel({ practice, sosId, createFailed, lastLoc, sentAt, gpsError }) + (!practice && lastLoc?.at ? ' Medición: ' + new Date(lastLoc.at).toLocaleTimeString() + '.' : '');
    const text = alertText({ childName, kind, location: lastLoc, lang: 'es' });
    for (const link of sheet.querySelectorAll('[data-ga-contact]')) {
      const guardian = orderedGuardians(config?.guardians)[Number(link.dataset.gaIndex)];
      const href = guardian && contactLinks(guardian, text)[link.dataset.gaContact];
      if (!practice && href) link.href = href;
    }
    for (const link of sheet.querySelectorAll('[data-ga-refuge]')) {
      const fresh = lastLoc?.at && Date.now() - Date.parse(lastLoc.at) < 60_000;
      const href = !practice && !gpsError && fresh && refugeSearchUrl(lastLoc, link.dataset.gaRefuge);
      if (href) { link.href = href; link.removeAttribute('aria-disabled'); link.tabIndex = 0; }
      else { link.removeAttribute('href'); link.setAttribute('aria-disabled','true'); link.tabIndex = -1; }
    }
  }

  function startLocation() {
    if (practice) return;
    if (!navigator.geolocation) { gpsError = true; refreshLocation(); return; }
    const current = generation;
    try {
      watch = navigator.geolocation.watchPosition((pos) => {
        if (current !== generation || !sheet || closing) return;
        lastLoc = validLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy, at: new Date(pos.timestamp).toISOString() });
        gpsError = !lastLoc;
        refreshLocation(); void sendLocation(); void sendKind();
      }, () => { if (current === generation) { gpsError = true; refreshLocation(); } }, { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 });
    } catch { gpsError = true; refreshLocation(); }
  }

  async function activate() {
    if (sheet || creating || closing) return;
    const current = ++generation;
    sosId = null; lastLoc = null; sentAt = null; lastSent = 0; gpsError = false;
    createFailed = false; closeError = ''; silent = false; followup = 0; stepId = null; kind = 'ayuda';
    creating = !practice; reportedKind = 'ayuda'; kindSending = false;
    // La ayuda y el número de emergencia no dependen de la red ni del permiso de GPS.
    open();
    if (practice) return;
    startLocation();
    retryTimer = setInterval(() => { refreshLocation(); void sendLocation(); void sendKind(); }, 20_000);
    void loadConfig().then(() => { if (current === generation && sheet) render(); }).catch(() => {});
    const initial = lastLoc;
    try {
      const created = await request('POST', '/api/kid/sos', { kind, location: initial });
      if (current !== generation) return;
      if (created.status === 201 && typeof created.body?.id === 'string') {
        sosId = created.body.id; sentAt = initial?.at ?? null;
      } else createFailed = true;
    } catch { if (current === generation) createFailed = true; }
    finally {
      if (current === generation) { creating = false; render(); void sendLocation(true); void sendKind(); }
    }
  }

  async function close(ok) {
    if (closing) return;
    if (creating) { closeError = 'Aún no se sabe si el aviso llegó. Puedes llamar o esperar; no se ha cerrado.'; render(); return; }
    closing = true; closeError = '';
    if (ok && sosId && !practice) {
      try {
        const result = await request('POST', '/api/kid/sos/' + sosId + '/ok', {});
        if (result.status !== 200) throw new Error('No confirmado');
      } catch {
        closing = false; closeError = 'No se confirmó el cierre. Sigue activo en Janus hasta confirmarlo; puedes volver a intentarlo.'; render(); return;
      }
    }
    generation++; clearInterval(retryTimer); retryTimer = 0; beat.stop(); beatActive = false;
    try { globalThis.speechSynthesis?.cancel(); } catch { /* nada */ }
    if (watch != null) navigator.geolocation?.clearWatch(watch);
    sosId = null; watch = null; sending = false; closing = false; sheet?.remove(); sheet = null;
  }

  async function sendKind() {
    if (practice || !sosId || kindSending || closing || reportedKind === kind) return;
    const current = generation, selected = kind, id = sosId;
    kindSending = true;
    let success = false;
    try {
      const result = await request('POST', '/api/kid/sos/' + id + '/kind', { kind: selected });
      if (current === generation && result.status === 200) { reportedKind = selected; success = true; }
    } catch { /* Los botones de llamada siguen activos. */ }
    finally { if (current === generation) { kindSending = false; if (success && kind !== reportedKind) void sendKind(); } }
  }
  function say(text) { if (!silent) speak(text); }
  function enter(id, nextKind = kind) {
    kind = nextKind; stepId = id; void sendKind();
    if (id.startsWith('calle') || id === 'llamar_calle') {
      silent = true; try { globalThis.speechSynthesis?.cancel(); } catch { /* nada */ }
    }
    render();
    if (FIRST_AID[id]) say(safeStepText(FIRST_AID[id].say));
  }
  function safeStepText(text) {
    return text.replace(/Yo (ya )?aviso a (papá con tu ubicación|tu familia)\./g, 'Usa los botones para avisar a tu familia.')
      .replace(/Tu familia ya está avisada\./g, 'Confirma con tu familia que recibió el aviso.')
      .replace(/No estás sola\./g, 'Busca a una persona adulta que pueda ayudarte.');
  }
  function refugeCard() {
    const labels = [['police','Buscar policía'],['hospital','Buscar urgencias hospitalarias'],['staffed','Buscar tienda u hotel con personal']];
    return el('section', { class: 'ga-step' }, el('h3', {}, 'Busca ayuda cerca'),
      el('p', {}, 'Si te siguen, entra en el lugar abierto con personal y gente más cercano que puedas ver. No vayas a casa, a un atajo ni a un sitio aislado. Pide que llamen al 112.'),
      el('p', { class:'ga-status' }, 'Solo si puedes mirar el móvil sin riesgo: el mapa externo puede recibir tu ubicación. Comprueba que el lugar esté abierto y tenga personal; no podemos garantizar horarios, cámaras ni rutas seguras.'),
      el('div', { class:'ga-row' }, ...labels.map(([key,label]) => el('a', { 'data-ga-refuge':key, target:'_blank', rel:'noopener noreferrer', 'aria-disabled':'true', tabindex:'-1', onclick:(event)=>{if(!lastLoc?.at || Date.now()-Date.parse(lastLoc.at)>=60_000 || gpsError){event.preventDefault(); refreshLocation();}} }, label))),
      el('p', {}, 'Quédate con el personal o la policía. Si papá no contesta, llama a mamá u otro adulto de confianza. No subas sola a un taxi ni a un coche de desconocidos.'),
      el('button', { type:'button', onclick: () => { followup = Math.min(followup + 1, Math.max(0, orderedGuardians(config?.guardians).length - 1)); render(); } }, 'No me contestan: siguiente contacto'));
  }

  function contacts() {
    const text = alertText({ childName, kind, location: lastLoc, lang: 'es' });
    const list = orderedGuardians(config?.guardians);
    const href = (link) => (practice ? null : link);
    return el('div', {},
      el('div', { class: 'ga-row' }, el('a', { class: 'ga-112', href: href(emergencyCall(config ?? undefined)), 'aria-label': 'Llamar a emergencias' }, `📞 ${config?.emergencyNumber ?? '112'}`), el('span', { class: 'ga-status' }, 'Policía, ambulancia y bomberos')),
      list.length === 0 ? el('p', { class: 'ga-status' }, 'Papá todavía no ha puesto sus teléfonos aquí.') : null,
      ...list.map((g, index) => { const L = contactLinks(g, text); return el('div', { class: 'ga-row' },
        el('a', { class: 'ga-call', href: href(L.call), 'data-ga-contact':'call', 'data-ga-index':index }, `${index === followup ? 'Siguiente: ' : ''}${ROLE_LABEL[g.role] ?? g.name} · ${g.name}`),
        L.whatsapp ? el('a', { class: 'ga-wa', href: href(L.whatsapp), 'data-ga-contact':'whatsapp','data-ga-index':index, target: '_blank', rel: 'noopener noreferrer' }, 'WhatsApp') : null,
        el('a', { href: href(L.sms), 'data-ga-contact':'sms','data-ga-index':index }, 'SMS')); }));
  }

  function stepCard() {
    const step = FIRST_AID[stepId];
    if (!step) return null;
    if (step.metronome && !beatActive) { beat.start(); beatActive = true; } else if (!step.metronome && beatActive) { beat.stop(); beatActive = false; }
    return el('section', { class: 'ga-step', 'aria-live': 'polite' },
      el('h3', {}, step.title),
      el('div', { class: 'ga-say' }, safeStepText(step.say)),
      el('div', { class: 'ga-simple' }, step.simple),
      step.metronome ? el('div', { class: 'ga-beat', 'aria-hidden': 'true' }) : null,
      el('div', { class: 'ga-row' }, ...step.next.map(([label, next]) => el('button', { type: 'button', onclick: () => enter(next) }, label)),
        el('button', { type: 'button', onclick: () => { silent = false; speak(safeStepText(step.say)); } }, 'Escuchar otra vez')));
  }

  function render() {
    if (!sheet) return;
    sheet.replaceChildren(...[
      practice ? el('p', { class: 'ga-practice' }, 'MODO PRÁCTICA: no avisa a nadie ni llama de verdad.') : null,
      el('h2', {}, '👼 Ángel Guardián'),
      el('p', { class: 'ga-status', 'data-ga-status':'', role:'status' }, sosDeliveryLabel({ practice, sosId, createFailed, lastLoc, sentAt, gpsError })),
      el('p', {}, 'Busca ayuda. Respira despacio. Si hay peligro inmediato, llama a emergencias ahora. No necesitas esperar a Janus.'),
      el('div', { class:'ga-row' }, el('button', { type:'button', onclick:()=>{ silent=true; globalThis.speechSynthesis?.cancel(); beat.stop(); beatActive=false; } }, 'Silenciar voz')),
      contacts(),
      stepId ? stepCard() : el('div', {}, el('h3', {}, '¿Qué pasa?'),
        el('div', { class: 'ga-row' }, ...FIRST_AID_ENTRIES.map(([label, entry]) => el('button', { type: 'button', onclick: () => enter(entry, entry === 'calle' ? 'peligro' : 'ayuda') }, label)),
          el('button', { type: 'button', onclick: () => enter('calle_dentro', 'perdida') }, 'Me he perdido'),
          el('button', { type: 'button', onclick: () => { kind = 'herida'; stepId = null; void sendKind(); render(); say('Si estás herida, pide ayuda a una persona adulta. Si es grave, llama a emergencias.'); } }, 'Estoy herida'))),
      !practice && (kind === 'peligro' || kind === 'perdida') ? refugeCard() : null,
      closeError ? el('p', { role:'alert' }, closeError) : null,
      !practice && createFailed && !sosId ? el('button', {type:'button', onclick:()=>{generation++; clearInterval(retryTimer); retryTimer=0; if(watch!=null) navigator.geolocation?.clearWatch(watch); watch=null; beat.stop(); beatActive=false; globalThis.speechSynthesis?.cancel(); sheet?.remove(); sheet=null;}}, 'Salir de esta pantalla (aviso no confirmado)') : null,
      !practice ? el('p', { class:'ga-status' }, 'Sin internet: prueba llamada o SMS si hay cobertura. Sin cobertura: usa SOS satelital del teléfono si está disponible; pide ayuda al personal. No grabes ni enfrentes a nadie si te pone en riesgo.') : null,
      el('div', { class: 'ga-love' }, (config?.messages?.length ? config.messages[Math.floor(Date.now() / 60000) % config.messages.length] : FAMILY_VALUES[2])),
      el('div', { class: 'ga-row' }, el('button', { type: 'button', onclick: () => { if (createFailed && !sosId && !practice) { closeError = 'No se pudo confirmar si se registró el SOS. Confirma con un adulto por llamada o SMS.'; render(); return; } void close(true); } }, practice ? 'Terminar la práctica' : '✅ Estoy bien')),
      practice ? learnMore() : null,
    ].filter(Boolean));
    refreshLocation();
  }

  function learnMore() {
    return el('div', {},
      el('h3', {}, 'Defensa personal básica (se practica con papá)'), el('ul', {}, SELF_DEFENSE.map(([t, d]) => el('li', {}, el('b', {}, t), ': ', d))),
      el('h3', {}, 'En la calle'), el('ul', {}, STREET_SAFETY.map((t) => el('li', {}, t))),
      el('h3', {}, 'Palabras nuevas'), el('ul', {}, FIRST_AID_WORDS.map(([w, easy]) => el('li', {}, el('b', {}, w), ' = ', easy))),
      el('h3', {}, 'Lo que tu familia quiere que recuerdes'), el('ul', {}, [...(config?.messages ?? []), ...FAMILY_VALUES.slice(0, 2)].map((t) => el('li', {}, t))));
  }

  function open() {
    sheet = el('div', { class: 'ga-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Ángel Guardián' });
    document.body.append(sheet); render();
    // Voz voluntaria: en una persecución, hablar sin permiso podría llamar la atención.
  }

  // Botón con pulsación larga (evita avisos por accidente). En modo práctica se abre al momento.
  const button = el('button', { type: 'button', class: 'ga-btn', 'aria-label': practice ? 'Practicar Ángel Guardián' : `SOS: mantén pulsado ${HOLD_MS / 1000} segundos` }, el('span', { class: 'ga-ring' }), 'SOS');
  let holdTimer = 0;
  const cancel = () => { clearTimeout(holdTimer); button.classList.remove('ga-hold'); };
  button.addEventListener('pointerdown', () => { if (practice) return; button.classList.add('ga-hold'); holdTimer = setTimeout(() => { cancel(); navigator.vibrate?.(200); activate(); }, HOLD_MS); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((e) => button.addEventListener(e, cancel));
  button.addEventListener('click', (event) => { if (practice || event.detail === 0) void activate(); });
  if (!practice) { host.append(button); void loadConfig().catch(() => {}); }
  return { button, practice: () => mountGuardianAngel(host, { request, childName, practice: true }).open(), open: activate };
}
