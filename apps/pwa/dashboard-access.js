import { mountAppInstall } from './app-install.js';
import './knowledge-review.js';
import { mountLanguageButtons, uiLabel } from './language-buttons.js';

// Core owns the session. This adds approved medallions to the ACTUAL A/B header,
// not a second navigation bar floating over Janus or Kendra's 3D scene.
const back = encodeURIComponent(location.pathname === '/dashboard/b' ? '/dashboard/b' : '/dashboard/a');
const controls = document.createElement('div');
controls.className = 'janus-header-tools';
controls.setAttribute('aria-label', 'Idioma y acceso de JANUS');
const languageControl = document.createElement('div');
languageControl.className = 'janus-language-switch';
controls.append(languageControl);
const menu = document.createElement('details');
menu.className = 'janus-access-menu';
const summary = document.createElement('summary');
summary.textContent = '☰';
summary.setAttribute('aria-label', 'Accesos y controles de JANUS');
summary.title = 'Accesos JANUS';
menu.append(summary);
const accessList = document.createElement('nav');
accessList.className = 'janus-access-links';
accessList.setAttribute('aria-label', 'Accesos JANUS');
const links = [
  ['signIn', `/?returnTo=${back}#approvals`],
  ['controls', '/'],
  ['kidApp', '/kendra'],
];
const linkNodes = new Map();
for (const [key, href] of links) {
  const a = document.createElement('a');
  a.textContent = uiLabel('founder', key);
  a.href = href;
  accessList.append(a);
  linkNodes.set(key, a);
}
const install = document.createElement('button');
install.type = 'button';
install.textContent = uiLabel('founder', 'install');
install.setAttribute('data-app-install', '');
accessList.append(install);
const status = document.createElement('span');
status.setAttribute('role', 'status');
status.className = 'janus-access-status';
accessList.append(status);
menu.append(accessList);
controls.append(menu);

function refreshLabels() {
  for (const [key, element] of linkNodes) element.textContent = uiLabel('founder', key);
  install.textContent = uiLabel('founder', 'install');
}
mountLanguageButtons(languageControl, 'founder', { onChange: refreshLabels });
refreshLabels();

function mountInExistingHeader() {
  const header = document.querySelector('#view:not([hidden]) .vh')
    || document.querySelector('#dash .a2h, #dash .pvh, #dash .hd');
  if (!header || controls.parentElement === header) return;
  // Dashboard pages regenerate the header on navigation; reattach instead of
  // injecting another header or replacing any real dashboard DOM.
  header.append(controls);
  menu.open = false;
}
const app = document.getElementById('app');
if (app) {
  new MutationObserver(mountInExistingHeader).observe(app, { childList: true, subtree: true });
  mountInExistingHeader();
}

addEventListener('janus:knowledge-applied', (event) => {
  status.textContent = `Cambio guardado · revisión ${event.detail.revision}`;
});
addEventListener('janus:review-error', (event) => { status.textContent = event.detail.message; });
mountAppInstall({ appName: 'JANUS', iconSrc: '/icons/janus-icon-180.png' });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
