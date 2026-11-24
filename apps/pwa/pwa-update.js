// JANUS · actualización automática de la app instalada (orden del Founder, 24-nov-2026: «mi sí es sí»).
// Pieza LEGO reutilizable: la usan el dashboard del Founder, la tablet de Kendra y la PWA clásica.
// Qué hace: registra el trabajador de servicio, pregunta por versión nueva cada 30 minutos y al volver a la app, y
// cuando la nueva versión toma el control recarga la página en un momento tranquilo (app oculta o 60 s sin tocar),
// para no cortar a Kendra en mitad de un juego o una oración. Sin red, no hace nada: sigue la versión guardada.

export const CHECK_EVERY_MS = 30 * 60 * 1000;
export const IDLE_MS = 60 * 1000;

/** Decide si es buen momento para recargar. Pura, para poder probarla. */
export function quietMoment({ hidden, lastInputAt, now, idleMs = IDLE_MS }) {
  return Boolean(hidden) || now - lastInputAt >= idleMs;
}

export function registerWithAutoUpdate(swUrl = '/sw.js', win = globalThis) {
  const nav = win.navigator;
  if (!nav || !('serviceWorker' in nav)) return null;
  const sw = nav.serviceWorker;
  const doc = win.document;
  const hadController = Boolean(sw.controller);
  let lastInputAt = Date.now();
  let pending = false;
  let reloaded = false;

  const reloadIfQuiet = () => {
    if (!pending || reloaded) return;
    if (!quietMoment({ hidden: doc?.visibilityState === 'hidden', lastInputAt, now: Date.now() })) return;
    reloaded = true;
    win.location.reload();
  };
  for (const type of ['pointerdown', 'keydown', 'touchstart']) {
    win.addEventListener?.(type, () => { lastInputAt = Date.now(); }, { passive: true, capture: true });
  }
  // La primera instalación también «toma el control»: eso no es una actualización y no se recarga.
  sw.addEventListener('controllerchange', () => { if (hadController) { pending = true; reloadIfQuiet(); } });

  const ready = sw.register(swUrl).then((reg) => {
    const check = () => { reg.update().catch(() => { /* sin conexión: se intenta en la próxima vuelta */ }); };
    win.setInterval(() => { check(); reloadIfQuiet(); }, CHECK_EVERY_MS);
    win.setInterval(reloadIfQuiet, IDLE_MS / 2);
    doc?.addEventListener?.('visibilitychange', () => { if (doc.visibilityState === 'visible') check(); else reloadIfQuiet(); });
    return reg;
  }).catch(() => null); // sin trabajador de servicio: la app funciona igual con conexión
  return ready;
}
