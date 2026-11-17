'use strict';
/* ===== Bienvenida y resumen del día (voz + texto) =====
 * Al abrir Janus: saludo ("Hola, Jean. ¿Qué tal tu día?" / "Buenos días, Jean.") y resumen: agenda, clima para la bici,
 * __HIJA__, citas, pendientes. Voz del navegador (es-ES) hasta conectar la voz propia de Janus (ElevenLabs).
 * iOS/Safari solo permite hablar tras un toque: si el navegador lo bloquea, habla en el primer toque del usuario.
 */
const OWNER = 'Jean';
// Saludos variados (Jean, 22-10): no siempre el mismo. Se elige uno por sesión.
const GREETS_DAY = ['Hola, Jean. ¿Qué tal tu día?', '¿Por dónde comenzamos, Jean?', '¿Qué tienes en mente, Jean?', '¿En qué te inspiraste hoy, Jean?', 'Hola, Jean. ¿Qué construimos hoy?', 'Aquí estoy, Jean. ¿Qué hacemos primero?'];
const GREETS_AM = ['Buenos días, Jean.', 'Buenos días, Jean. ¿Por dónde comenzamos?', 'Buen día, Jean. ¿Qué tienes en mente para hoy?'];
const GREET_PICK = Math.random();
function janusBriefing(M, X) {
  const now = new Date(), am = now.getHours() >= 5 && now.getHours() < 11, L = am ? GREETS_AM : GREETS_DAY, greet = L[Math.floor(GREET_PICK * L.length)];
  const ag = X.agenda.slice(0, 3).map((a) => a.h + ' ' + a.t).join('; ');
  const d1 = M.raw.daily[M.nowDay + 1] || M.raw.daily[0];
  const bike = M.ida.verdict === 'g' ? 'Buen día para ir en bici' : M.ida.verdict === 'r' ? 'Hoy mejor no ir en bici' : 'Bici con precaución';
  const K = X.kweek[0] && X.kweek[0].it.length ? '__HIJA__ tiene actividades hoy' : '';
  const cita = X.citas[0] ? 'Cita médica en ' + X.citas[0].days + ' días' : '';
  const pend = X.mailsOpen.length + ' correos por atender y ' + X.apprOpen.length + ' aprobaciones';
  const lines = [
    'Hoy tienes: ' + (ag || 'agenda libre') + '.',
    'Ahora ' + M.nowE.t + '°, lluvia ' + (M.raw.daily[M.nowDay] || d1).rmax + '%. ' + bike + (M.suggest != null ? '; sal a las ' + minToHm(M.suggest) : '') + '. Mañana ' + d1.tmax + '°.',
    [K, cita].filter(Boolean).join('. ') + (K || cita ? '.' : ''),
    'Pendientes: ' + pend + '.'
  ].filter((l) => l && l !== '.');
  return { greet, lines };
}
let BRIEF_SPOKEN = false;
function speakText(t) {
  try { if (!('speechSynthesis' in window)) return false; speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.lang = 'es-ES'; u.rate = 1.02;
    u.onstart = () => { if (window.Janus3D) Janus3D.state.talking = true; }; u.onend = u.onerror = () => { if (window.Janus3D) Janus3D.state.talking = false; };
    speechSynthesis.speak(u); return true; } catch (e) { return false; }
}
function speakBriefing(full) {
  const M = model(), X = derived(M), B = janusBriefing(M, X);
  BRIEF_SPOKEN = speakText(B.greet + ' ' + (full ? B.lines.join(' ') : ''));
}
const BRIEF_ACTS = { brief: () => speakBriefing(true) };
// Saludo al abrir (una vez por sesión). Si el navegador bloquea la voz, se hace en el primer toque.
(function autoGreet() {
  let done = false; try { done = sessionStorage.getItem('janus.greeted') === '1'; } catch (e) { }
  if (done) return;
  const go = () => { if (BRIEF_SPOKEN) return; speakBriefing(true); try { sessionStorage.setItem('janus.greeted', '1'); } catch (e) { } };
  setTimeout(go, 900);
  document.addEventListener('pointerdown', function once() { document.removeEventListener('pointerdown', once); if (!BRIEF_SPOKEN || (window.speechSynthesis && !speechSynthesis.speaking)) go(); }, { once: true });
})();
