'use strict';
/**
 * JANUS Pilot Camera v1 — reusable offline/local-first capture.
 * Founder and Kendra have distinct, ephemeral sessions. No upload, no AI,
 * no facial analysis, no persistence, no remote service, no extra credits.
 * Never copies images into JanusAttach's global chat attachment queue.
 *
 * API: window.JanusPilotCamera.open('founder'|'kendra'), .close(), .state().
 * Camera permissions originate ONLY from an explicit user gesture.
 */
const JanusPilotCamera = (() => {
  let overlay = null, stream = null, photoUrl = null, scope = null, pending = 0, previousFocus = null;
  const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
  const status = (msg) => {
    const el = overlay && overlay.querySelector('[data-jpc-status]');
    if (el) el.textContent = msg;
  };
  const stopStream = () => {
    if (stream && typeof stream.getTracks === 'function') {
      stream.getTracks().forEach((track) => { try { track.stop(); } catch (_) {} });
    }
    stream = null;
    const vid = overlay && overlay.querySelector('video');
    if (vid) { try { vid.pause(); vid.srcObject = null; } catch (_) {} }
  };
  const clearPhoto = () => {
    if (photoUrl) { URL.revokeObjectURL(photoUrl); photoUrl = null; }
    const img = overlay && overlay.querySelector('[data-jpc-image]');
    if (img) { img.removeAttribute('src'); img.hidden = true; }
    const dl = overlay && overlay.querySelector('[data-jpc-save]');
    if (dl) { dl.removeAttribute('href'); dl.hidden = true; }
  };
  function controls(mode) {
    if (!overlay) return;
    const set = (name, visible) => {
      const el = overlay.querySelector('[data-jpc="' + name + '"]');
      if (el) el.hidden = !visible;
    };
    set('shoot', mode === 'live');
    set('choose', mode !== 'photo');
    set('retry', mode === 'photo');
    const video = overlay.querySelector('video');
    if (video) video.hidden = mode !== 'live';
  }
  function close() {
    ++pending;
    stopStream();
    clearPhoto();
    if (overlay) { overlay.remove(); overlay = null; }
    scope = null;
    const focus = previousFocus; previousFocus = null;
    if (focus && typeof focus.focus === 'function' && focus.isConnected) {
      try { focus.focus(); } catch (_) {}
    }
  }
  async function start() {
    if (!overlay) return false;
    stopStream();
    const request = ++pending;
    const md = typeof navigator !== 'undefined' && navigator.mediaDevices;
    if (!md || typeof md.getUserMedia !== 'function') {
      controls('fallback');
      status('Cámara en vivo no disponible aquí. Toca «Hacer foto con el móvil»; en iPhone, abre esta página en Safari con HTTPS.');
      return false;
    }
    controls('fallback');
    status('Solicitando permiso del navegador para usar la cámara. No se graba audio.');
    try {
      const got = await md.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      if (!overlay || pending !== request) {
        got.getTracks().forEach((track) => track.stop());
        return false;
      }
      stream = got;
      const video = overlay.querySelector('video');
      video.srcObject = got;
      try { await video.play(); } catch (_) { /* still preview if autoplay disallowed */ }
      if (!overlay || pending !== request) { stopStream(); return false; }
      controls('live');
      status('Cámara encendida solo en este dispositivo. Toca «Capturar» para tomar una foto.');
      return true;
    } catch (e) {
      if (overlay && pending === request) {
        controls('fallback');
        const name = e && e.name;
        status(name === 'NotAllowedError' || name === 'SecurityError'
          ? 'Permiso de cámara denegado o página sin HTTPS. Puedes usar la cámara del móvil con el botón inferior.'
          : 'No se pudo abrir la cámara en vivo. Puedes usar la cámara del móvil sin enviar nada.');
      }
      return false;
    }
  }
  function fromCanvas(canvas) {
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86));
  }
  function encode(source, width, height) {
    const max = 1440, scale = Math.min(1, max / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return Promise.resolve(null);
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    return fromCanvas(canvas);
  }
  function setPhoto(blob) {
    if (!overlay) return false;
    if (!blob || !blob.size) {
      status('La foto no se pudo procesar. Prueba otra vez.');
      return false;
    }
    stopStream();
    clearPhoto();
    photoUrl = URL.createObjectURL(blob);
    const img = overlay.querySelector('[data-jpc-image]');
    img.src = photoUrl; img.hidden = false;
    const save = overlay.querySelector('[data-jpc-save]');
    save.href = photoUrl;
    save.download = 'janus-foto-local-' + Date.now() + '.jpg';
    save.hidden = false;
    controls('photo');
    status('Foto local preparada. No se ha guardado ni enviado. Puedes guardarla tú o eliminarla.');
    return true;
  }
  async function shoot() {
    if (!overlay || !stream) return;
    const video = overlay.querySelector('video');
    if (!video.videoWidth || !video.videoHeight) {
      status('Aún no hay imagen de la cámara. Intenta de nuevo.');
      return;
    }
    try { const blob = await encode(video, video.videoWidth, video.videoHeight); if (overlay) setPhoto(blob); }
    catch (_) { status('La captura falló; vuelve a intentarlo.'); }
  }
  async function chosen(file) {
    if (!overlay || !file) return;
    if (!/^image\//.test(file.type) || file.size > MAX_IMAGE_BYTES) {
      status('Se admite una imagen de hasta 20 MB.');
      return;
    }
    const active = overlay;
    let original = URL.createObjectURL(file);
    try {
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve; img.onerror = reject;
        img.src = original;
      });
      if (overlay !== active) return;
      const blob = await encode(img, img.naturalWidth, img.naturalHeight);
      if (overlay === active) setPhoto(blob);
    } catch (_) { if (overlay === active) status('La foto no se puede leer en este navegador.'); }
    finally { URL.revokeObjectURL(original); original = null; }
  }
  function open(mode) {
    if (mode !== 'founder' && mode !== 'kendra') return false;
    close();
    scope = mode;
    previousFocus = document.activeElement;
    const panel = document.createElement('section');
    panel.className = 'jpc-backdrop';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'Cámara local de ' + (mode === 'kendra' ? 'Kendra' : 'JANUS'));
    panel.innerHTML = '<div class="jpc-dialog">' +
      '<div class="jpc-header"><strong>📷 ' + (mode === 'kendra' ? 'Mi cámara' : 'Cámara JANUS') + '</strong>' +
      '<button type="button" data-jpc="close" aria-label="Cerrar cámara">✕</button></div>' +
      '<p class="jpc-status" data-jpc-status role="status" aria-live="polite">La cámara solo funciona si lo permites.</p>' +
      '<div class="jpc-stage"><video autoplay muted playsinline hidden></video><img data-jpc-image alt="Fotografía capturada, todavía sin guardar" hidden></div>' +
      '<p class="jpc-privacy">' + (mode === 'kendra'
        ? 'Esta foto es privada. No se comparte con nadie ni con ninguna inteligencia artificial. Si quieres conservarla, pide ayuda a un adulto.'
        : 'Captura privada: sin nube, reconocimiento facial ni envío automático.') + '</p>' +
      '<div class="jpc-actions"><button type="button" data-jpc="shoot" hidden>📸 Capturar</button>' +
      '<button type="button" data-jpc="choose">📷 Hacer foto con el móvil</button>' +
      '<button type="button" data-jpc="retry" hidden>↺ Otra foto</button>' +
      '<a data-jpc-save hidden>Guardar en mi dispositivo</a>' +
      '<button type="button" data-jpc="discard">Eliminar y cerrar</button></div>' +
      '<input data-jpc-file type="file" accept="image/*" capture="environment" hidden></div>';
    overlay = panel;
    panel.addEventListener('click', (ev) => {
      if (ev.target === panel) { close(); return; }
      const b = ev.target.closest('[data-jpc]');
      if (!b || !panel.contains(b)) return;
      const action = b.getAttribute('data-jpc');
      if (action === 'close' || action === 'discard') close();
      else if (action === 'shoot') { void shoot(); }
      else if (action === 'choose') panel.querySelector('[data-jpc-file]').click();
      else if (action === 'retry') { clearPhoto(); void start(); }
    });
    panel.querySelector('[data-jpc-file]').addEventListener('change', (ev) => {
      const file = ev.target.files && ev.target.files[0];
      ev.target.value = '';
      if (file) void chosen(file);
    });
    panel.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); close(); }
    });
    document.body.appendChild(panel);
    panel.querySelector('[data-jpc="close"]').focus();
    void start(); // getUserMedia request is originated by a direct click.
    return true;
  }
  function state() {
    return Object.freeze({ active: !!overlay, scope, live: !!stream, photoReady: !!photoUrl, localOnly: true });
  }
  window.addEventListener('pagehide', close);
  window.addEventListener('hashchange', close);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && overlay) {
      ++pending; stopStream();
      if (!photoUrl) {
        controls('fallback');
        status('Cámara detenida al salir de la página. Puedes usar la cámara del móvil si quieres.');
      }
    }
  });
  return Object.freeze({ open, close, state });
})();
window.JanusPilotCamera = JanusPilotCamera;
