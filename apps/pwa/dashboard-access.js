import { mountAppInstall } from './app-install.js';
import './knowledge-review.js';
import { currentLanguage, mountLanguageButtons, uiLabel } from './language-buttons.js';
import { sessionToken } from './founder-session.js';
import { mountTeamChip } from './team-chip.js';
import { createApprovedStage, createApprovedAssetControls, initApprovedPresence } from './approved-presence.js';

// Core owns the session. This adds approved medallions to the ACTUAL A/B header,
// not a second navigation bar floating over Janus or Kendra's 3D scene.
const back = encodeURIComponent(location.pathname === '/dashboard/b' ? '/dashboard/b' : '/dashboard/a');
const controls = document.createElement('div');
controls.className = 'janus-header-tools';
controls.setAttribute('aria-label', 'Idioma y acceso de JANUS');
const languageControl = document.createElement('div');
languageControl.className = 'janus-language-switch';
controls.append(languageControl);
// Acceso simplificado a «¿Cómo va el equipo?» (/work/team). Una sola pastilla; el resumen sale del mismo servicio que la vista de equipo.
const teamText = {
  es: { working: (n) => (n === 1 ? '1 persona trabajando' : `${n} personas trabajando`), attention: (n) => (n === 1 ? '1 asunto requiere atención' : `${n} asuntos requieren atención`) },
  nl: { working: (n) => (n === 1 ? '1 persoon aan het werk' : `${n} personen aan het werk`), attention: (n) => (n === 1 ? '1 punt vraagt aandacht' : `${n} punten vragen aandacht`) },
};
const teamChip = mountTeamChip({
  back: location.pathname === '/dashboard/b' ? '/dashboard/b' : '/dashboard/a',
  labels: () => ({
    team: uiLabel('founder', 'team'),
    open: uiLabel('founder', 'teamOpen'),
    ...teamText[currentLanguage('founder')],
  }),
});
controls.prepend(teamChip.element);
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
const robot = document.createElement('button');
robot.type = 'button'; robot.textContent = 'JANUS 02 NEXO · 3D';
robot.addEventListener('click', () => {
  menu.open = false;
  const dialog = document.createElement('dialog'); dialog.className = 'janus-3d-dialog';
  const title = document.createElement('h2'); title.textContent = 'JANUS · 02 NEXO';
  const close = document.createElement('button'); close.type = 'button'; close.textContent = 'Cerrar';
  close.addEventListener('click', () => dialog.close());
  dialog.append(title, createApprovedStage('nexo-masculino'));
  if (sessionToken()) dialog.append(createApprovedAssetControls({ family: 'janus' }));
  dialog.append(close);
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog); dialog.showModal();
  void initApprovedPresence();
});
accessList.append(robot);
const status = document.createElement('span');
status.setAttribute('role', 'status');
status.className = 'janus-access-status';
accessList.append(status);
menu.append(accessList);
controls.append(menu);

function refreshLabels() {
  teamChip.repaint();
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
