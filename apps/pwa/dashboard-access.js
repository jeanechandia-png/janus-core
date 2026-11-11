import { mountAppInstall } from './app-install.js';
import './knowledge-review.js';
import { currentLanguage, mountLanguageButtons, uiLabel } from './language-buttons.js';
import { sessionToken } from './founder-session.js';
import { mountTeamPanel } from './team-panel.js';
import { mountApprovalChip } from './approval-chip.js';
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
// «Mi equipo»: tarjeta con una lucecita por colaborador; al tocarla se abre «¿Cómo va el equipo?» (/work/team).
// Tablet/escritorio: en la cabecera (la rejilla aprobada no se toca). Teléfono: tarjeta en la columna.
const teamText = {
  es: { states: { working: 'Trabajando', unconfirmed: 'Sesión abierta, sin señal', paused: 'En pausa', online: 'Conectado', offline: 'Desconectado' },
    since: (t) => `desde las ${t}`, seen: (m) => `visto hace ${m} min`, attention: (n) => (n === 1 ? '1 asunto requiere atención' : `${n} asuntos requieren atención`) },
  nl: { states: { working: 'Aan het werk', unconfirmed: 'Sessie open, geen signaal', paused: 'Gepauzeerd', online: 'Online', offline: 'Offline' },
    since: (t) => `sinds ${t}`, seen: (m) => `${m} min geleden gezien`, attention: (n) => (n === 1 ? '1 punt vraagt aandacht' : `${n} punten vragen aandacht`) },
};
const team = mountTeamPanel({
  back: location.pathname === '/dashboard/b' ? '/dashboard/b' : '/dashboard/a',
  labels: () => ({
    title: uiLabel('founder', 'team'),
    open: uiLabel('founder', 'teamOpen'),
    empty: uiLabel('founder', 'teamEmpty'),
    ...teamText[currentLanguage('founder')],
  }),
});
controls.prepend(team.compact);
// «Aprobar»: visible solo si hay acciones en pausa esperando la decisión del CEO (cola de aprobaciones existente).
const approvals = mountApprovalChip();
controls.prepend(approvals.element);
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
  team.repaint();
  for (const [key, element] of linkNodes) element.textContent = uiLabel('founder', key);
  install.textContent = uiLabel('founder', 'install');
}
mountLanguageButtons(languageControl, 'founder', { onChange: refreshLabels });
refreshLabels();

function mountInExistingHeader() {
  const header = document.querySelector('#view:not([hidden]) .vh')
    || document.querySelector('#dash .a2h, #dash .pvh, #dash .hd, #dash .pl-hd');
  if (!header || controls.parentElement === header) return;
  // Dashboard pages regenerate the header on navigation; reattach instead of
  // injecting another header or replacing any real dashboard DOM.
  header.append(controls);
  menu.open = false;
}
function mountTeamCard() {
  // Solo en la columna del teléfono: justo después de los accesos rápidos. Fuera de ella la tarjeta no existe.
  const quick = document.querySelector('#dash .a2hs, .pa2 > .a2hs');
  document.documentElement.classList.toggle('janus-team-in-column', Boolean(quick));
  if (!quick) { team.card.remove(); return; }
  if (quick.nextElementSibling !== team.card) quick.after(team.card);
}
const app = document.getElementById('app');
if (app) {
  new MutationObserver(() => { mountInExistingHeader(); mountTeamCard(); }).observe(app, { childList: true, subtree: true });
  mountInExistingHeader();
  mountTeamCard();
}

addEventListener('janus:knowledge-applied', (event) => {
  status.textContent = `Cambio guardado · revisión ${event.detail.revision}`;
});
addEventListener('janus:review-error', (event) => { status.textContent = event.detail.message; });
mountAppInstall({ appName: 'JANUS', iconSrc: '/icons/janus-icon-180.png' });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
