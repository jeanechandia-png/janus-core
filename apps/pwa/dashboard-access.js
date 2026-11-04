import { mountAppInstall } from './app-install.js';
import './knowledge-review.js';

// Shared session, same tab and origin. No embedded token, no second login implementation.
const nav = document.createElement('nav');
nav.setAttribute('aria-label', 'Acceso a JANUS');
nav.style.cssText = 'position:fixed;z-index:1000;top:calc(env(safe-area-inset-top,0px) + 6px);right:8px;display:flex;flex-wrap:wrap;gap:6px;max-width:95vw;background:#0b1019e8;border:1px solid #7f8ba755;border-radius:14px;padding:6px;font:13px/1.2 system-ui';
const back = encodeURIComponent(location.pathname === '/dashboard/b' ? '/dashboard/b' : '/dashboard/a');
for (const [text, href] of [['Identificarme', `/?returnTo=${back}#approvals`], ['Controles y familia', '/'], ['App de Kendra', '/kendra']]) {
  const a = document.createElement('a'); a.textContent = text; a.href = href;
  a.style.cssText = 'color:#eef3ff;padding:8px;text-decoration:none'; nav.append(a);
}
const install = document.createElement('button'); install.type = 'button'; install.textContent = 'Instalar app';
install.setAttribute('data-app-install', ''); install.style.cssText = 'font:inherit;border:1px solid #8b98ae;border-radius:8px;background:#1b273b;color:#fff;padding:8px';
nav.append(install); document.body.append(nav);
const status = document.createElement('span'); status.setAttribute('role', 'status'); status.style.cssText = 'color:#e8efff;padding:8px';
nav.append(status);
addEventListener('janus:knowledge-applied', (event) => { status.textContent = `Cambio guardado · revisión ${event.detail.revision}`; });
addEventListener('janus:review-error', (event) => { status.textContent = event.detail.message; });
mountAppInstall({ appName: 'JANUS', iconSrc: '/icons/janus-icon-180.png' });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
