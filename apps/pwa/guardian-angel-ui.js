/**
 * Ángel Guardián · interfaz reutilizable (botón SOS + guía paso a paso). Sin dependencias: solo DOM y el módulo
 * ./guardian-angel.js (espejo idéntico de packages/modules/guardian-angel). Otros productos la montan igual:
 *   mountGuardianAngel(document.body, { request, childName, practice })
 * request(method, path, body) → { status, body } habla con el anfitrión: GET /api/kid/guardian-angel, POST /api/kid/sos…
 * Nunca llama ni envía mensajes sola: deja los botones de llamada, WhatsApp y SMS listos para pulsar.
 */
import {
  HOLD_MS, ROLE_LABEL, FIRST_AID, FIRST_AID_ENTRIES, COMPRESSIONS_PER_MINUTE, SELF_DEFENSE, STREET_SAFETY, FAMILY_VALUES, FIRST_AID_WORDS,
  alertText, contactLinks, emergencyCall,
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

export function mountGuardianAngel(host, { request, childName = '', practice = false } = {}) {
  if (!document.getElementById('ga-css')) document.head.append(el('style', { id: 'ga-css' }, CSS));
  let config = null, sosId = null, watch = null, lastSent = 0, lastLoc = null, sheet = null, stepId = null, kind = 'ayuda';
  const beat = metronome();

  async function loadConfig() {
    const result = await request('GET', '/api/kid/guardian-angel');
    if (result.status === 200) { config = result.body.config; childName = result.body.childName || childName; }
  }

  function startLocation() {
    if (!navigator.geolocation) return;
    watch = navigator.geolocation.watchPosition((pos) => {
      lastLoc = { lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy, at: new Date(pos.timestamp).toISOString() };
      render();
      if (!practice && sosId && Date.now() - lastSent > 20_000) { lastSent = Date.now(); request('POST', `/api/kid/sos/${sosId}/location`, { location: lastLoc }); }
    }, () => render(), { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 });
  }

  async function activate() {
    await loadConfig().catch(() => {});
    if (!practice) {
      const created = await request('POST', '/api/kid/sos', { kind, location: lastLoc }).catch(() => ({ status: 0 }));
      if (created.status === 201) sosId = created.body.id;
    }
    stepId = null;
    startLocation();
    open();
  }

  async function close(ok) {
    beat.stop(); try { globalThis.speechSynthesis?.cancel(); } catch { /* nada */ }
    if (watch != null) navigator.geolocation.clearWatch(watch);
    if (ok && sosId && !practice) await request('POST', `/api/kid/sos/${sosId}/ok`, {}).catch(() => {});
    sosId = null; watch = null; sheet?.remove(); sheet = null;
  }

  function contacts() {
    const text = alertText({ childName, kind, location: lastLoc, lang: 'es' });
    const list = (config?.guardians ?? []).slice().sort((a, b) => Number(b.primary) - Number(a.primary));
    const href = (link) => (practice ? null : link);
    return el('div', {},
      el('div', { class: 'ga-row' }, el('a', { class: 'ga-112', href: href(emergencyCall(config ?? undefined)), 'aria-label': 'Llamar a emergencias' }, `📞 ${config?.emergencyNumber ?? '112'}`), el('span', { class: 'ga-status' }, 'Policía, ambulancia y bomberos')),
      list.length === 0 ? el('p', { class: 'ga-status' }, 'Papá todavía no ha puesto sus teléfonos aquí.') : null,
      ...list.map((g) => { const L = contactLinks(g, text); return el('div', { class: 'ga-row' },
        el('a', { class: 'ga-call', href: href(L.call) }, `📞 ${ROLE_LABEL[g.role] ?? g.name}`),
        L.whatsapp ? el('a', { class: 'ga-wa', href: href(L.whatsapp), target: '_blank', rel: 'noopener' }, '💬 WhatsApp') : null,
        el('a', { href: href(L.sms) }, '✉️ SMS')); }));
  }

  function stepCard() {
    const step = FIRST_AID[stepId];
    if (!step) return null;
    if (step.metronome) beat.start(); else beat.stop();
    return el('section', { class: 'ga-step', 'aria-live': 'polite' },
      el('h3', {}, step.title),
      el('div', { class: 'ga-say' }, step.say),
      el('div', { class: 'ga-simple' }, step.simple),
      step.metronome ? el('div', { class: 'ga-beat', 'aria-hidden': 'true' }) : null,
      el('div', { class: 'ga-row' }, ...step.next.map(([label, next]) => el('button', { type: 'button', onclick: () => { stepId = next; render(); speak(FIRST_AID[next].say); } }, label)),
        el('button', { type: 'button', onclick: () => speak(step.say) }, '🔊 Otra vez')));
  }

  function render() {
    if (!sheet) return;
    const where = lastLoc ? `📍 Ubicación enviada (±${Math.round(lastLoc.accuracy)} m)` : '📍 Buscando tu ubicación…';
    sheet.replaceChildren(...[
      practice ? el('p', { class: 'ga-practice' }, 'MODO PRÁCTICA: no avisa a nadie ni llama de verdad.') : null,
      el('h2', {}, '👼 Ángel Guardián'),
      el('p', { class: 'ga-status' }, practice ? where.replace('enviada', 'de práctica') : (sosId ? '✅ Papá ya está avisado. ' : '') + where),
      contacts(),
      stepId ? stepCard() : el('div', {}, el('h3', {}, '¿Qué pasa?'),
        el('div', { class: 'ga-row' }, ...FIRST_AID_ENTRIES.map(([label, entry]) => el('button', { type: 'button', onclick: () => { kind = entry === 'calle' ? 'peligro' : 'ayuda'; stepId = entry; render(); speak(FIRST_AID[entry].say); } }, label)),
          el('button', { type: 'button', onclick: () => { kind = 'perdida'; stepId = 'calle_dentro'; render(); speak(FIRST_AID.calle_dentro.say); } }, 'Me he perdido'),
          el('button', { type: 'button', onclick: () => { kind = 'herida'; stepId = 'calma'; render(); speak('Estoy contigo. Llama a papá o al 112 con los botones de arriba.'); } }, 'Estoy herida'))),
      el('div', { class: 'ga-love' }, (config?.messages?.length ? config.messages[Math.floor(Date.now() / 60000) % config.messages.length] : FAMILY_VALUES[2])),
      el('div', { class: 'ga-row' }, el('button', { type: 'button', onclick: () => close(true) }, practice ? 'Terminar la práctica' : '✅ Estoy bien')),
      practice ? learnMore() : null,
    ].filter(Boolean));
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
    if (!practice) speak('Estoy contigo. Papá ya está avisado. Respira despacio. Si es peligro, pulsa el botón rojo.');
  }

  // Botón con pulsación larga (evita avisos por accidente). En modo práctica se abre al momento.
  const button = el('button', { type: 'button', class: 'ga-btn', 'aria-label': practice ? 'Practicar Ángel Guardián' : `SOS: mantén pulsado ${HOLD_MS / 1000} segundos` }, el('span', { class: 'ga-ring' }), 'SOS');
  let holdTimer = 0;
  const cancel = () => { clearTimeout(holdTimer); button.classList.remove('ga-hold'); };
  button.addEventListener('pointerdown', () => { if (practice) return; button.classList.add('ga-hold'); holdTimer = setTimeout(() => { cancel(); navigator.vibrate?.(200); activate(); }, HOLD_MS); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((e) => button.addEventListener(e, cancel));
  button.addEventListener('click', () => { if (practice) activate(); });
  if (!practice) host.append(button);
  return { button, practice: () => mountGuardianAngel(host, { request, childName, practice: true }).open(), open: activate };
}
