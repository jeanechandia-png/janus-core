/**
 * Controls ES/NL from the original founder-approved artwork (#65).
 * Shared visual component only: does not replace dashboard or authorization flows.
 * UI chrome translations are deliberately partial until content localization is reviewed.
 */
export const LANGUAGES = Object.freeze([
  { code: 'nl', name: 'Nederlands', image: '/language-art/nederland.webp.b64' },
  { code: 'es', name: 'Español', image: '/language-art/espana.webp.b64' },
]);
const UI = Object.freeze({
  founder: {
    es: { signIn: 'Identificarme', controls: 'Controles y familia', kidApp: 'App de Kendra', install: 'Instalar app', heading: 'Trabajo en vivo', approvals: 'Tu visto bueno', capabilities: 'Disponibilidad real', run: 'Ejecutar', pause: 'Pausar', stop: 'Detener' },
    nl: { signIn: 'Inloggen', controls: 'Bediening en gezin', kidApp: "Kendra's app", install: 'App installeren', heading: 'Live aan het werk', approvals: 'Jouw goedkeuring', capabilities: 'Werkelijke beschikbaarheid', run: 'Uitvoeren', pause: 'Pauzeren', stop: 'Stoppen' },
  },
  kendra: {
    es: { home: 'Inicio', chat: 'Charla', day: 'Mi día', watch: 'Ver', house: 'Casa', things: 'Mis cosas', parent: 'Zona de padres', voice: 'Leer en voz alta las respuestas' },
    nl: { home: 'Start', chat: 'Praten', day: 'Mijn dag', watch: 'Kijken', house: 'Thuis', things: 'Mijn spullen', parent: 'Ouderzone', voice: 'Antwoorden voorlezen' },
  },
});
export function currentLanguage(scope, storage = globalThis.localStorage) {
  try { return storage?.getItem('janus.language.' + scope) === 'nl' ? 'nl' : 'es'; }
  catch { return 'es'; }
}
export function uiLabel(scope, key, fallback = '') {
  return UI[scope]?.[currentLanguage(scope)]?.[key] ?? fallback;
}
const artCache = new Map();
function imageData(image) {
  if (!artCache.has(image)) {
    artCache.set(image, fetch(image, { credentials: 'same-origin' }).then(async (response) => {
      if (!response.ok) throw new Error('Approved medallion asset missing');
      const encoded = (await response.text()).trim();
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length > 40000) {
        throw new Error('Invalid bundled medallion');
      }
      return 'data:image/webp;base64,' + encoded;
    }).catch(() => null));
  }
  return artCache.get(image);
}
export function mountLanguageButtons(container, scope, { storage = globalThis.localStorage, onChange } = {}) {
  if (!container || !UI[scope]) return () => {};
  const doc = container.ownerDocument;
  const buttons = [];
  container.replaceChildren();
  container.setAttribute('role', 'group');
  container.setAttribute('aria-label', 'Idioma / Taal');
  for (const lang of LANGUAGES) {
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'janus-language-button';
    button.dataset.language = lang.code;
    button.setAttribute('aria-label', lang.name);
    button.title = lang.name;
    const flag = doc.createElement('img');
    flag.width = 32;
    flag.height = 32;
    flag.alt = '';
    flag.loading = 'eager';
    flag.decoding = 'async';
    imageData(lang.image).then((url) => {
      if (url && button.isConnected) flag.src = url;
      else if (!url) button.setAttribute('data-asset-missing', 'true');
    });
    button.append(flag);
    button.addEventListener('click', () => select(lang.code, true));
    container.append(button);
    buttons.push(button);
  }
  function select(language, persist) {
    const active = language === 'nl' ? 'nl' : 'es';
    doc.documentElement.lang = active;
    for (const button of buttons) {
      const selected = button.dataset.language === active;
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('is-lit', selected);
    }
    if (persist) {
      try { storage?.setItem('janus.language.' + scope, active); } catch { /* localStorage optional */ }
      if (typeof onChange === 'function') onChange(active);
      doc.dispatchEvent(new CustomEvent('janus:language-changed', { detail: { scope, language: active } }));
    }
  }
  select(currentLanguage(scope, storage), false);
  return () => { container.replaceChildren(); };
}
