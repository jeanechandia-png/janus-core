/**
 * Language controls as a reusable, local-first piece. Existing dashboard layouts
 * are not replaced. Artist-supplied flag images are kept intact via <img>.
 */
export const LANGUAGES = Object.freeze([
  { code: 'nl', name: 'Nederlands', image: '/language-art/nederland.webp.b64' },
  { code: 'es', name: 'Español', image: '/language-art/espana.webp.b64' },
]);

const dictionaries = {
  founder: {
    es: {
      'h1': 'Trabajo en vivo',
      '#approvalsTitle': 'Tu visto bueno',
      '#capabilityTitle': 'Disponibilidad real',
      '.capability-legend': 'Core decide antes de ejecutar',
      '#sendButton': 'Ejecutar',
      '#pauseButton': 'Pausar',
      '#stopButton': 'Detener',
      '#clearButton': 'Limpiar vista',
      '.command-card textarea': 'Dile a Janus qué quieres conseguir…',
      '.companion-entry': 'Mundo compañero',
    },
    nl: {
      'h1': 'Live aan het werk',
      '#approvalsTitle': 'Jouw goedkeuring',
      '#capabilityTitle': 'Werkelijke beschikbaarheid',
      '.capability-legend': 'Core beslist vóór uitvoering',
      '#sendButton': 'Uitvoeren',
      '#pauseButton': 'Pauzeren',
      '#stopButton': 'Stoppen',
      '#clearButton': 'Weergave wissen',
      '.command-card textarea': 'Vertel Janus wat je wilt bereiken…',
      '.companion-entry': 'Metgezelwereld',
    },
  },
  companion: {
    es: {
      'h1': 'Tu compañero',
      '#chooseTitle': 'Elige un personaje',
      '#saveNames': 'Guardar nombres',
      '#wardrobeTitle': 'Armario y aventuras',
      '#learningTitle': 'Un pequeño reto',
      '#waveButton': 'Saludar',
      '#danceButton': 'Bailar',
      '#laughButton': 'Reír',
      '#nextChallenge': 'Otro reto',
      '#challengeForm button[type="submit"]': 'Comprobar',
      '.back-link': '← Janus',
    },
    nl: {
      'h1': 'Jouw metgezel',
      '#chooseTitle': 'Kies een personage',
      '#saveNames': 'Namen opslaan',
      '#wardrobeTitle': 'Kledingkast en avonturen',
      '#learningTitle': 'Een kleine uitdaging',
      '#waveButton': 'Zwaaien',
      '#danceButton': 'Dansen',
      '#laughButton': 'Lachen',
      '#nextChallenge': 'Nog een opdracht',
      '#challengeForm button[type="submit"]': 'Controleren',
      '.back-link': '← Janus',
    },
  },
};
export function currentLanguage(scope, storage = globalThis.localStorage) {
  try {
    const stored = storage?.getItem('janus.language.' + scope);
    return stored === 'nl' ? 'nl' : 'es';
  } catch { return 'es'; }
}
export function translations(scope, language) {
  return dictionaries[scope]?.[language === 'nl' ? 'nl' : 'es'] ?? {};
}
export function mountLanguageButtons(container, scope, {
  root = document,
  storage = globalThis.localStorage,
} = {}) {
  if (!container || !dictionaries[scope]) return () => {};
  container.replaceChildren();
  const buttons = [];
  for (const language of LANGUAGES) {
    const button = root.createElement('button');
    button.type = 'button';
    button.className = 'janus-language-button';
    button.dataset.language = language.code;
    button.setAttribute('aria-label', language.name);
    button.title = language.name;
    const flag = root.createElement('img');
    flag.alt = '';
    flag.width = 32;
    flag.height = 32;
    // Local bundled copies of the exact user-supplied glossy flags; never a generated replacement.
    fetch(language.image).then(async (response) => {
      if (!response.ok) throw new Error('Flag art unavailable');
      const encoded = (await response.text()).trim();
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length > 40000) {
        throw new Error('Invalid bundled art');
      }
      flag.src = 'data:image/webp;base64,' + encoded;
    }).catch(() => { button.setAttribute('data-asset-missing', 'true'); });
    flag.decoding = 'async';
    flag.loading = 'eager';
    button.append(flag);
    buttons.push(button);
    container.append(button);
    button.addEventListener('click', () => apply(language.code, true));
  }
  function apply(lang, save) {
    const selected = lang === 'nl' ? 'nl' : 'es';
    root.documentElement.lang = selected;
    for (const button of buttons) {
      const active = button.dataset.language === selected;
      button.setAttribute('aria-pressed', String(active));
      button.classList.toggle('is-lit', active);
    }
    const texts = translations(scope, selected);
    for (const [selector, text] of Object.entries(texts)) {
      const target = root.querySelector(selector);
      if (!target) continue;
      if (target.matches('textarea')) target.placeholder = text;
      else target.textContent = text;
    }
    if (save) {
      try { storage?.setItem('janus.language.' + scope, selected); } catch { /* offline memory optional */ }
      root.dispatchEvent(new CustomEvent('janus:language-changed', { detail: { scope, language: selected } }));
    }
  }
  apply(currentLanguage(scope, storage), false);
  return () => { container.replaceChildren(); };
}
