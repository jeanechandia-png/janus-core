'use strict';
/* LEGO JanusPresence · referencia visual aprobada, reutilizable en ambos dashboards.
 * No confundir una fotografía animada con un rig 3D: JanusCreatureSlot controla los GLB.
 * Nunca necesita red; las imágenes aprobadas van incrustadas por build.cjs. */
const JanusPresence = (() => {
  const SPECIES = Object.freeze({
    lumi: { name: 'Lumi', accent: '#FFD36A', image: 'cLumi' },
    bombo: { name: 'Bombo', accent: '#59E4D4', image: 'cBombo' },
    musgo: { name: 'Musgo', accent: '#A9D87A', image: 'cMusgo' },
    nimbo: { name: 'Nimbo', accent: '#FFC5DC', image: 'cNimbo' }
  });
  const IDS = Object.keys(SPECIES);
  const normalize = (id) => IDS.includes(id) ? id : 'lumi';
  const current = (context) => context === 'founder' ? 'robot' :
    normalize(typeof compState === 'function' ? compState().creatureId : 'lumi');
  const source = (id) => (window.JanusOriginalArt && window.JanusOriginalArt.creature(normalize(id))) || (typeof APPROVED_ART !== 'undefined' && APPROVED_ART.creatures?.[normalize(id)]) || IMG[SPECIES[normalize(id)].image];
  function renderNexo(compact) {
    // Nexo 02 es el protagonista del Founder, en dos versiones de la MISMA IA.
    // FILTRO VISUAL: solo el GLB de Nexo validado puede activar WebGL.
    // El robot procedural anterior (caras/ojos/boca flotantes) queda histórico, invisible.
    const variant = ST.settings.nexoVariant === 'femenino' ? 'femenino' : 'masculino';
    const size = compact ? 'jpresence--mini' : 'jpresence--hero';
    const id = compact ? 'nexo-dashboard' : 'nexo-sala';
    // La variante es una preferencia de configuración, no un titular ni un botón sobre el robot.
    // El selector real sigue disponible dentro de Personalizar Nexo (src/avatar.js).
    const slotId = variant === 'femenino' ? 'robot-femenino' : 'robot';
    const approved3d = !!(window.JanusCreatureSlot?.has?.(slotId));
    const display = approved3d
      ? '<div class="jnexo-display" data-3d="bot" data-id="' + id + '" data-tap="#trabajo/voz" role="img" aria-label="Nexo 02 aprobado"></div>'
      : '<div class="jnexo-voice-standby" role="status" aria-label="Janus: asistente de voz">' +
        gIco('mic', 'jnexo-voice-icon') + '<strong>JANUS</strong></div>';
    return '<figure class="jpresence jnexo ' + size + '" data-janus-founder="nexo" data-nexo-variant="' + variant + '">' +
      display + '<figcaption class="jp-caption"><b>Nexo 02</b>' +
      (compact ? '' : '<span>JANUS · asistente operativo</span>') +
      '</figcaption></figure>';
  }
  function render(context, compact, creatureId) {
    if (context === 'founder') return renderNexo(compact);
    const id = normalize(creatureId || current(context)), meta = SPECIES[id];
    // Kendra nombra cada criatura a su gusto; no se sustituye por el nombre del adulto.
    const name = context === 'kendra' && typeof Companion !== 'undefined' &&
      typeof compProfile === 'function' ? Companion.displayName(compProfile(), id) : meta.name;
    const safeName = String(name).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
    const glb = !!(window.JanusCreatureSlot && window.JanusCreatureSlot.has && window.JanusCreatureSlot.has(id));
    const cls = compact ? 'jpresence jpresence--mini' : 'jpresence jpresence--hero';
    const link = context === 'founder' ? 'trabajo/voz' : 'companero';
    return '<figure class="' + cls + '" data-jpresence="' + id + '" style="--jp-accent:' + meta.accent + '">' +
      '<div class="jp-portrait" data-go="' + link + '" role="link" tabindex="0" aria-label="' + (context === 'founder' ? 'Hablar con Janus. ' : 'Compañero de Kendra. ') + safeName + '">' +
      '<img class="jp-image" src="' + source(id) + '" alt="' + safeName + ', criatura original de InfinitySeed; arte de referencia" draggable="false" loading="eager" decoding="async">' +
      '<span class="jp-light" aria-hidden="true"></span></div>' +
      (compact
        ? '<figcaption class="jp-caption"><b>' + safeName + '</b><span>Arte aprobado</span></figcaption><span class="jp-next" data-act="presenceNext" role="button" tabindex="0" aria-label="Cambiar criatura">✦</span>'
        : '<figcaption class="jp-caption"><b>' + safeName + '</b><span>' + (glb ? 'Modelo GLB disponible · entrar a escena 3D' : 'Arte aprobado · modelo 3D cinematográfico pendiente') + '</span></figcaption>') +
      '</figure>';
  }
  function hydrate(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('[data-jpresence]').forEach((el) => {
      if (el.dataset.jpWired) return; el.dataset.jpWired = '1';
      const portrait = el.querySelector('.jp-portrait'); if (!portrait) return;
      const reset = () => { el.style.setProperty('--jp-rx', '0deg'); el.style.setProperty('--jp-ry', '0deg'); };
      portrait.addEventListener('pointermove', (ev) => {
        if (ev.pointerType === 'touch' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const r = portrait.getBoundingClientRect(); if (!r.width || !r.height) return;
        const x = Math.max(-1, Math.min(1, (ev.clientX - r.left) / r.width * 2 - 1));
        const y = Math.max(-1, Math.min(1, (ev.clientY - r.top) / r.height * 2 - 1));
        el.style.setProperty('--jp-rx', (-y * 3).toFixed(2) + 'deg');
        el.style.setProperty('--jp-ry', (x * 4).toFixed(2) + 'deg');
      }, { passive: true });
      portrait.addEventListener('pointerleave', reset, { passive: true });
    });
  }
  // Acción obsoleta conservada como no-op para dashboards previamente empaquetados.
  // Nunca permite sustituir Nexo por una criatura de Kendra.
  const actions = { presenceNext: () => {} };
  return Object.freeze({ IDS, SPECIES, normalize, current, render, hydrate, actions });
})();
window.JanusPresence = JanusPresence;
