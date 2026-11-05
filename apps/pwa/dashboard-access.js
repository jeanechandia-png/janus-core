import { mountAppInstall } from './app-install.js';
import './knowledge-review.js';
import { mountLanguageButtons, uiLabel } from './language-buttons.js';

// Shared session, same tab and origin. No embedded token, no second login implementation.
const nav = document.createElement('nav');
nav.setAttribute('aria-label', 'Acceso a JANUS');
nav.style.cssText = 'position:fixed;z-index:1000;top:calc(env(safe-area-inset-top,0px) + 6px);right:8px;display:flex;flex-wrap:wrap;gap:6px;max-width:95vw;background:#0b1019e8;border:1px solid #7f8ba755;border-radius:14px;padding:6px;font:13px/1.2 system-ui';
const back = encodeURIComponent(location.pathname === '/dashboard/b' ? '/dashboard/b' : '/dashboard/a');
const accessLinks = [
  ['signIn', `/?returnTo=${back}#approvals`],
  ['controls', '/'],
  ['kidApp', '/kendra'],
];
const linkNodes = new Map();
for (const [key, href] of accessLinks) {
  const a = document.createElement('a');
  a.textContent = uiLabel('founder', key);
  a.href = href;
  a.style.cssText = 'color:#eef3ff;padding:8px;text-decoration:none';
  nav.append(a);
  linkNodes.set(key, a);
}
const languageControl = document.createElement('div');
languageControl.className = 'janus-language-switch';
nav.append(languageControl);
const install = document.createElement('button'); install.type = 'button'; install.textContent = 'Instalar app';
install.setAttribute('data-app-install', ''); install.style.cssText = 'font:inherit;border:1px solid #8b98ae;border-radius:8px;background:#1b273b;color:#fff;padding:8px';
nav.append(install); document.body.append(nav);
function refreshAccessLabels() {
  for (const [key, node] of linkNodes) node.textContent = uiLabel('founder', key);
  install.textContent = uiLabel('founder', 'install');
}
mountLanguageButtons(languageControl, 'founder', { onChange: refreshAccessLabels });
refreshAccessLabels();
const status = document.createElement('span'); status.setAttribute('role', 'status'); status.style.cssText = 'color:#e8efff;padding:8px';
nav.append(status);
addEventListener('janus:knowledge-applied', (event) => { status.textContent = `Cambio guardado · revisión ${event.detail.revision}`; });
addEventListener('janus:review-error', (event) => { status.textContent = event.detail.message; });
mountAppInstall({ appName: 'JANUS', iconSrc: '/icons/janus-icon-180.png' });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
