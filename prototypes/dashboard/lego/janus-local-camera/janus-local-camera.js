'use strict';
/*
 * InfinitySeed LEGO — local, opt-in camera preview for JANUS and Kendra.
 * Does not capture frames, identify a person, persist media, upload or record.
 * Camera availability depends on iOS Safari/browser permissions and secure origin.
 */
const JanusLocalCamera = (() => {
  let modal = null;
  let stream = null;
  let serial = 0;
  let focusBefore = null;

  function stopTracks(media) {
    if (!media || typeof media.getTracks !== 'function') return;
    for (const track of media.getTracks()) {
      try { track.stop(); } catch (_) {}
    }
  }
  function close() {
    serial++; // invalidate even a permission dialog that is still pending
    stopTracks(stream);
    stream = null;
    if (modal) {
      const video = modal.querySelector('video');
      if (video) { try { video.pause(); video.srcObject = null; } catch (_) {} }
      modal.remove();
      modal = null;
    }
    const prior = focusBefore;
    focusBefore = null;
    try { if (prior && prior.isConnected && prior.focus) prior.focus(); } catch (_) {}
    return { ok: true, active: false };
  }

  function state() { return Object.freeze({ active: !!stream, visible: !!modal }); }
  function element(type, className, value) {
    const e = document.createElement(type);
    if (className) e.className = className;
    if (value) e.textContent = value;
    return e;
  }
  function mount(profile) {
    const wrap = element('div', 'jlc-backdrop');
    wrap.setAttribute('role', 'presentation');
    const panel = element('section', 'jlc-panel');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'Vista previa local de cámara');
    const title = element('h2', 'jlc-title', 'Cámara local · ' + (profile === 'kendra' ? 'Kendra' : 'JANUS'));
    const note = element('p', 'jlc-note', 'Solo vista previa en este dispositivo. No graba, no envía imágenes y no verifica identidades.');
    const video = element('video', 'jlc-video');
    video.autoplay = true; video.muted = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('aria-label', 'Imagen en vivo de la cámara, sin grabación');
    const status = element('p', 'jlc-status', 'Solicitando permiso explícito del dispositivo…');
    status.setAttribute('role', 'status');
    const quit = element('button', 'jlc-close', 'Detener cámara y cerrar');
    quit.type = 'button';
    quit.addEventListener('click', close);
    panel.append(title, note, video, status, quit);
    wrap.append(panel);
    document.body.append(wrap);
    quit.focus();
    return { wrap, video, status };
  }

  async function open(profile = 'janus') {
    if (modal) return { ok: false, reason: 'already-open' };
    focusBefore = document.activeElement;
    const view = mount(profile);
    modal = view.wrap;
    const ticket = ++serial;
    const api = typeof navigator !== 'undefined' && navigator.mediaDevices;
    if (!api || typeof api.getUserMedia !== 'function' || window.isSecureContext === false) {
      view.status.textContent = 'La cámara no está disponible aquí. Ábrela desde HTTPS o localhost en Safari con permisos de cámara.';
      return { ok: false, reason: 'unavailable' };
    }
    try {
      // The single user click invokes permission. No audio or hidden capture.
      const media = await api.getUserMedia({ audio: false, video: { facingMode: 'user' } });
      if (ticket !== serial || modal !== view.wrap || document.hidden) {
        stopTracks(media);
        return { ok: false, reason: 'cancelled' };
      }
      stream = media;
      view.video.srcObject = media;
      try { await view.video.play(); } catch (_) {
        // Safari might keep autoplay suspended; video control remains visible.
      }
      if (ticket !== serial) {
        stopTracks(media);
        return { ok: false, reason: 'cancelled' };
      }
      view.status.textContent = 'Cámara encendida únicamente aquí. Pulsa «Detener» para apagarla.';
      return { ok: true, active: true };
    } catch (e) {
      if (ticket !== serial) return { ok: false, reason: 'cancelled' };
      view.status.textContent = 'Permiso denegado o cámara ocupada. No se ha guardado ningún vídeo.';
      return { ok: false, reason: 'permission-or-device' };
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => { if (document.hidden) close(); });
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && modal) close(); });
  }
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('pagehide', close);
  }
  return Object.freeze({ open, close, state });
})();
window.JanusLocalCamera = JanusLocalCamera;
