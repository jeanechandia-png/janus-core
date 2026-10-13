/**
 * Reusable "app-style access" module (LEGO piece).
 *
 * Provenance: generalised from infinityseed-group-website@31306eb3
 * ("app-style download button with native prompt and iPhone install guide").
 * Product-agnostic: any InfinitySeed surface (Janus, ChatBox, IBA, website)
 * mounts it with its own name, icon and language.
 *
 * Behaviour:
 * - Already running as an installed app  -> buttons stay hidden.
 * - Chromium (Android / desktop)        -> native install prompt.
 * - iPhone / iPad (no prompt API)       -> two-step guide: Share -> Add to Home Screen.
 * - Other browsers                       -> two-step guide via the browser menu.
 *
 * Importing this module has no side effects; nothing touches the DOM until
 * mountAppInstall() is called, so the pure helpers are testable in Node.
 */

const SHARE_ICON = '<span class="app-install-share" aria-hidden="true"></span>';

export const APP_INSTALL_COPY = Object.freeze({
  es: {
    button: 'Instalar app',
    title: 'Instala {app}',
    ios: [`Toca <b>Compartir</b> ${SHARE_ICON} en Safari.`, 'Elige <b>Añadir a pantalla de inicio</b> y toca <b>Añadir</b>.'],
    other: ['Abre el menú del navegador.', 'Elige <b>Instalar aplicación</b> o <b>Añadir a pantalla de inicio</b>.'],
    close: 'Cerrar',
  },
  en: {
    button: 'Install app',
    title: 'Install {app}',
    ios: [`Tap <b>Share</b> ${SHARE_ICON} in Safari.`, 'Choose <b>Add to Home Screen</b> and tap <b>Add</b>.'],
    other: ['Open your browser menu.', 'Choose <b>Install app</b> or <b>Add to Home screen</b>.'],
    close: 'Close',
  },
  nl: {
    button: 'App installeren',
    title: 'Installeer {app}',
    ios: [`Tik op <b>Deel</b> ${SHARE_ICON} onderin Safari.`, 'Kies <b>Zet op beginscherm</b> en tik op <b>Voeg toe</b>.'],
    other: ['Open het browsermenu.', 'Kies <b>App installeren</b> of <b>Toevoegen aan startscherm</b>.'],
    close: 'Sluiten',
  },
  tr: {
    button: 'Uygulamayı yükle',
    title: '{app} uygulamasını yükleyin',
    ios: [`Safari'de <b>Paylaş</b> ${SHARE_ICON} simgesine dokunun.`, '<b>Ana Ekrana Ekle</b>\'yi seçin ve <b>Ekle</b>\'ye dokunun.'],
    other: ['Tarayıcı menüsünü açın.', '<b>Uygulamayı yükle</b> veya <b>Ana ekrana ekle</b>\'yi seçin.'],
    close: 'Kapat',
  },
});

/** Pure: which install path applies. */
export function appInstallMode({ standalone, ios, hasPrompt }) {
  if (standalone) return 'installed';
  if (hasPrompt) return 'native';
  return ios ? 'ios-guide' : 'browser-guide';
}

/** Pure: localized copy with the app name (plain text, never HTML). */
export function appInstallCopy(lang, appName) {
  const base = APP_INSTALL_COPY[String(lang || '').slice(0, 2).toLowerCase()] ?? APP_INSTALL_COPY.es;
  return { ...base, title: base.title.replace('{app}', String(appName)) };
}

/** Pure: detect iOS/iPadOS (iPadOS reports as MacIntel with touch). */
export function isAppleTouchDevice(nav) {
  return /iphone|ipad|ipod/i.test(nav?.userAgent ?? '')
    || (nav?.platform === 'MacIntel' && Number(nav?.maxTouchPoints) > 1);
}

/**
 * Mount on a page. Buttons are any elements matching `buttonSelector`
 * (they should start `hidden`). Returns an unmount function.
 */
export function mountAppInstall({
  appName,
  iconSrc = '',
  lang = document.documentElement.lang || 'es',
  buttonSelector = '[data-app-install]',
} = {}) {
  if (!appName) throw new Error('mountAppInstall requires appName');
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const ios = isAppleTouchDevice(navigator);
  const copy = appInstallCopy(lang, appName);
  const buttons = [...document.querySelectorAll(buttonSelector)];
  let deferredPrompt = null;
  let sheet = null;
  let lastFocus = null;

  for (const button of buttons) {
    if (!button.textContent.trim()) button.textContent = copy.button;
    button.hidden = standalone;
  }

  const onBeforeInstall = (event) => { event.preventDefault(); deferredPrompt = event; };
  const onInstalled = () => { for (const button of buttons) button.hidden = true; close(); };

  const close = () => {
    if (!sheet || sheet.hidden) return;
    sheet.classList.remove('on');
    document.body.classList.remove('app-install-open');
    setTimeout(() => { if (sheet) sheet.hidden = true; }, 220);
    lastFocus?.focus?.({ preventScroll: true });
  };

  const open = () => {
    lastFocus = document.activeElement;
    if (!sheet) {
      sheet = document.createElement('div');
      sheet.className = 'app-install-sheet';
      sheet.setAttribute('role', 'dialog');
      sheet.setAttribute('aria-modal', 'true');
      sheet.addEventListener('click', (event) => {
        if (event.target === sheet || event.target.closest('[data-app-install-close]')) close();
      });
      document.body.append(sheet);
    }
    const card = document.createElement('div');
    card.className = 'app-install-card';
    if (iconSrc) {
      const img = document.createElement('img');
      img.src = iconSrc;
      img.alt = '';
      img.width = 64;
      img.height = 64;
      img.addEventListener('error', () => img.remove());
      card.append(img);
    }
    const title = document.createElement('h3');
    title.textContent = copy.title;
    const list = document.createElement('ol');
    // Steps are trusted constants from APP_INSTALL_COPY (no user/app input).
    list.innerHTML = (ios ? copy.ios : copy.other)
      .map((step, index) => `<li><span class="app-install-step">${index + 1}</span><span>${step}</span></li>`)
      .join('');
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'secondary';
    closeButton.setAttribute('data-app-install-close', '');
    closeButton.textContent = copy.close;
    card.append(title, list, closeButton);
    sheet.replaceChildren(card);
    sheet.setAttribute('aria-label', copy.title);
    sheet.hidden = false;
    document.body.classList.add('app-install-open');
    requestAnimationFrame(() => sheet.classList.add('on'));
    closeButton.focus({ preventScroll: true });
  };

  const onKey = (event) => { if (event.key === 'Escape') close(); };
  const onClick = async () => {
    const mode = appInstallMode({ standalone, ios, hasPrompt: Boolean(deferredPrompt) });
    if (mode === 'native') {
      const promptEvent = deferredPrompt;
      deferredPrompt = null;
      promptEvent.prompt();
      try { await promptEvent.userChoice; } catch { /* user dismissed */ }
      return;
    }
    if (mode !== 'installed') open();
  };

  addEventListener('beforeinstallprompt', onBeforeInstall);
  addEventListener('appinstalled', onInstalled);
  addEventListener('keydown', onKey);
  for (const button of buttons) button.addEventListener('click', onClick);

  return () => {
    removeEventListener('beforeinstallprompt', onBeforeInstall);
    removeEventListener('appinstalled', onInstalled);
    removeEventListener('keydown', onKey);
    for (const button of buttons) button.removeEventListener('click', onClick);
    sheet?.remove();
  };
}
