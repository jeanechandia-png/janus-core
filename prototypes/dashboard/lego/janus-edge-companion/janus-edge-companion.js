'use strict';
/* LEGO JanusEdgeCompanion · 3D nativo dentro del escenario de Kendra.
 * Reutiliza JanusCreatures3D y JanusCreatureSlot: no crea personajes ni APIs nuevas.
 * Un solo renderer WebGL transparente, sin red. "Arte aprobado" queda como fallback.
 * Margen interno del escenario, arrastre tactil, mirada, gestos, emociones y accesibilidad.
 * En lecciones y "Mi mundo" se oculta: JanusStage3D conserva su propia escena.
 */
const JanusEdgeCompanion = (() => {
  const T = window.THREE;
  const limit = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const still = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };
  if (!T || !T.WebGLRenderer) return {
    supported: () => false, sync: () => false, hide() {}, react() {}, state: () => ({ active: false, unavailable: true })
  };

  let host = null, canvas = null, renderer = null, scene = null, camera = null;
  let rig = null, rigId = '', raf = 0, active = false, unavailable = false;
  let options = {}, reaction = null, last = 0, start = 0, frames = 0, fpsTime = 0;
  let reducedDetail = 1, poor = 0, good = 0;
  const spot = { x: 8, y: 150, side: 'left', drag: null, dragUntil: 0, aimX: 0, aimY: 0, resetAt: 0 };
  let nameNode = null;

  const smallScreen = () => window.innerWidth <= 760 || window.innerHeight <= 500;
  // Coordinate system is ALWAYS local to the existing Kendra stage, never the viewport.
  // This prevents the WebGL creature from turning into a floating window over lessons.
  const stageHost = () => document.querySelector?.('.vb-companero .cpst3.edge-hero') || null;
  function box() {
    const stage = stageHost();
    if (!stage || !stage.isConnected) return { width: 0, height: 0, left: 0, right: 0, top: 0, bottom: 0, visible: false };
    const rect = stage.getBoundingClientRect(), mobile = smallScreen();
    const vw = window.innerWidth || 1024, vh = window.innerHeight || 768;
    const pad = mobile ? 10 : 16;
    const topReserve = mobile ? 122 : 96;
    const bottomReserve = mobile ? 104 : 84;
    let ceiling = topReserve, floor = rect.height - bottomReserve;
    for (const selector of ['.cp-edge-tools', '.cpsay']) {
      const r = stage.querySelector?.(selector)?.getBoundingClientRect?.();
      if (r && r.height && r.bottom > rect.top && r.top < rect.bottom)
        ceiling = Math.max(ceiling, r.bottom - rect.top + pad);
    }
    for (const selector of ['.cpbar', '.cphud']) {
      const r = stage.querySelector?.(selector)?.getBoundingClientRect?.();
      if (r && r.height && r.top < rect.bottom && r.bottom > rect.top)
        floor = Math.min(floor, r.top - rect.top - pad);
    }
    const room = floor - ceiling;
    const width = Math.min(mobile ? 174 : 340,
      Math.max(96, rect.width * (mobile ? 0.38 : 0.27)),
      Math.max(0, room / 1.33), Math.max(0, (rect.width - 2 * pad) * 0.47));
    const height = width * 1.33;
    const left = pad, right = Math.max(pad, rect.width - width - pad);
    const top = Math.max(pad, ceiling), bottom = Math.max(top, floor - height);
    const visible = rect.bottom > Math.max(70, vh * 0.08) &&
      rect.top < vh - 64 && room >= 115 && width >= 86 && height <= room;
    return { width, height, left, right, top, bottom, visible, stageBound: true };
  }
  function position(x, y) {
    const b = box();
    spot.x = limit(x, b.left, b.right); spot.y = limit(y, b.top, Math.max(b.top, b.bottom));
    if (host) host.style.transform = 'translate3d(' + spot.x.toFixed(1) + 'px,' + spot.y.toFixed(1) + 'px,0)';
  }
  function setCanvasSize() {
    if (!host || !renderer) return;
    const b = box();
    host.style.width = b.width + 'px'; host.style.height = b.height + 'px';
    renderer.setSize(b.width, b.height, false);
    camera.aspect = b.width / b.height; camera.updateProjectionMatrix();
    position(spot.x, spot.y);
  }
  function newRig(id) {
    if (rig) {
      scene.remove(rig.root);
      if (typeof rig.dispose === 'function') rig.dispose();
      rig = null;
    }
    const slots = window.JanusCreatureSlot, model = window.JanusCreatures3D;
    if (!model || !model.build) return;
    rig = (slots && slots.has && slots.has(id) && slots.rigFor ? slots.rigFor(id) : null) || model.build(id, '#FFD27A');
    rigId = id;
    if (!rig || !rig.root) return;
    if (rig.setDetail) rig.setDetail(reducedDetail);
    scene.add(rig.root);
    rig.root.position.y = -0.08;
  }
  function updateIdentity(opts) {
    options = opts;
    spot.side = opts.side === 'right' ? 'right' : 'left';
    if (rigId !== opts.id || !rig) newRig(opts.id);
    if (rig && rig.setLook && opts.look) rig.setLook(opts.look);
    if (rig && rig.setFurStyle) rig.setFurStyle(opts.style || 'natural');
    if (nameNode) nameNode.textContent = opts.name || '';
    if (canvas) canvas.setAttribute('aria-label', 'Criatura 3D ' + (opts.name || '') + '. Toca para saludar o arrastra para cambiarla de lugar.');
  }
  function ensure() {
    const stage = stageHost();
    if (!stage) return false; // fail closed: no detached/viewport avatar
    if (renderer) {
      if (host && host.parentNode !== stage) {
        stage.appendChild(host); // rerender of #view replaces the previous stage
        setCanvasSize();
      }
      return true;
    }
    if (unavailable) return false;
    try {
      renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power', premultipliedAlpha: true });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, smallScreen() ? 1.5 : 2));
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      renderer.outputColorSpace = T.SRGBColorSpace;
      scene = new T.Scene();
      scene.add(new T.HemisphereLight(0xf7eeff, 0x403245, 2.0));
      const key = new T.DirectionalLight(0xffdfb4, 3.4); key.position.set(-3, 7, 8); scene.add(key);
      const rim = new T.DirectionalLight(0xa4bcff, 2.4); rim.position.set(4, 5, -6); scene.add(rim);
      const fill = new T.DirectionalLight(0xffffff, 1.0); fill.position.set(1, 2, 6); scene.add(fill);
      camera = new T.PerspectiveCamera(33, 0.8, 0.1, 100);
      camera.position.set(0, 1.55, 5.7); camera.lookAt(0, 1.25, 0);
      host = document.createElement('div');
      host.className = 'kedge-root'; host.setAttribute('data-kendra-edge', '3d');
      host.setAttribute('aria-label', 'Compañero 3D de Kendra');
      canvas = renderer.domElement; canvas.className = 'kedge-canvas';
      canvas.style.touchAction = 'none'; canvas.setAttribute('role', 'button');
      canvas.setAttribute('tabindex', '0');
      const callTap = () => {
        react('saluda', 2.2, 'alegre');
        if (options && typeof options.onTap === 'function') options.onTap();
      };
      canvas.addEventListener('pointerdown', (ev) => {
        spot.drag = { id: ev.pointerId, mx: ev.clientX, my: ev.clientY, x: spot.x, y: spot.y, moved: 0 };
        spot.aimX = 0; spot.aimY = 0;
        try { canvas.setPointerCapture(ev.pointerId); } catch (_) {}
      });
      canvas.addEventListener('pointermove', (ev) => {
        const bounds = canvas.getBoundingClientRect();
        spot.aimX = limit((ev.clientX - bounds.left) / Math.max(bounds.width, 1) * 2 - 1, -1, 1);
        spot.aimY = limit(1 - (ev.clientY - bounds.top) / Math.max(bounds.height, 1) * 2, -1, 1);
        const d = spot.drag;
        if (!d || d.id !== ev.pointerId) return;
        d.moved = Math.max(d.moved, Math.hypot(ev.clientX - d.mx, ev.clientY - d.my));
        if (d.moved > 6) {
          position(d.x + ev.clientX - d.mx, d.y + ev.clientY - d.my);
          spot.dragUntil = performance.now() + 18000;
        }
      });
      const endDrag = (ev, cancelled) => {
        const d = spot.drag; if (!d || (ev && d.id !== ev.pointerId)) return;
        spot.drag = null;
        if (!cancelled && d.moved < 8) callTap();
        if (d.moved >= 8) {
          const b = box(); spot.side = spot.x < (b.left + b.right) / 2 ? 'left' : 'right';
          if (options && typeof options.onDock === 'function') options.onDock(spot.side);
        }
      };
      canvas.addEventListener('pointerup', (ev) => endDrag(ev, false));
      canvas.addEventListener('pointercancel', (ev) => endDrag(ev, true));
      canvas.addEventListener('pointerleave', () => { if (!spot.drag) { spot.aimX = 0; spot.aimY = 0; } });
      canvas.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); callTap(); } });
      host.appendChild(canvas);
      nameNode = document.createElement('span'); nameNode.className = 'kedge-name'; host.appendChild(nameNode);
      stage.appendChild(host);
      setCanvasSize();
      window.addEventListener('resize', setCanvasSize, { passive: true });
      return true;
    } catch (e) {
      unavailable = true;
      if (renderer) { try { renderer.dispose(); } catch (_) {} }
      renderer = null;
      if (host && host.parentNode) host.parentNode.removeChild(host);
      host = null;
      return false;
    }
  }
  function react(pose, seconds, mood) {
    reaction = { pose: pose || 'saluda', mood: mood || 'alegre', until: (performance.now ? performance.now() : 0) + Math.max(0.1, seconds || 2) * 1000 };
  }
  function tick(ms) {
    if (!active) { raf = 0; return; }
    raf = requestAnimationFrame(tick);
    if (!host || !host.isConnected || document.hidden || !rig) return;
    const dt = Math.min(0.05, Math.max(0, (ms - (last || ms)) / 1000));
    last = ms;
    const b = box();
    // The scene is the mounting and clipping boundary; no viewport overlay is allowed.
    host.hidden = !b.visible;
    if (!b.visible) return;
    if (!spot.drag && ms > spot.dragUntil) {
      // Paseo local por la escena, sin atravesar los formularios ni otras tarjetas.
      const anchor = spot.side === 'right' ? b.right : b.left;
      const range = Math.max(0, b.bottom - b.top);
      const sway = options.roam !== false && !still() ? Math.sin((ms - start) * 0.00043) : 0;
      const targetY = b.top + range * (0.53 + sway * 0.32);
      const targetX = anchor + (options.roam !== false && !still() ? Math.sin((ms - start) * 0.00017) * 4 : 0);
      position(spot.x + (targetX - spot.x) * Math.min(1, dt * 2.8),
        spot.y + (targetY - spot.y) * Math.min(1, dt * 2.3));
    }
    const now = ms, r = reaction && now < reaction.until ? reaction : null;
    const gazeX = spot.aimX, gazeY = spot.aimY;
    rig.root.rotation.y += (limit(-gazeX * 0.24, -0.27, 0.27) - rig.root.rotation.y) * Math.min(1, dt * 3.5);
    const t = (ms - start) / 1000;
    rig.update(t, dt, {
      pose: r ? r.pose : 'idle',
      mood: r ? r.mood : 'contento',
      gaze: { x: gazeX, y: gazeY },
      walk: !still() && options.roam !== false ? 0.09 : 0,
      wind: Number.isFinite(options.wind) ? options.wind : 0.3
    });
    try { renderer.render(scene, camera); }
    catch (e) { hide(); unavailable = true; if (options && options.onError) options.onError(); return; }
    frames++; fpsTime += dt;
    if (fpsTime > 1.1) {
      const fps = frames / fpsTime; frames = 0; fpsTime = 0;
      if (fps < 23) { poor++; good = 0; } else if (fps > 48) { good++; poor = 0; } else { good = 0; poor = 0; }
      if (poor >= 3) { reducedDetail = Math.max(0.25, reducedDetail - 0.25); poor = 0; if (rig.setDetail) rig.setDetail(reducedDetail); }
      if (good >= 10) { reducedDetail = Math.min(1, reducedDetail + 0.1); good = 0; if (rig.setDetail) rig.setDetail(reducedDetail); }
    }
  }
  function sync(opts) {
    if (!opts || !opts.active) { hide(); return false; }
    if (!ensure()) { if (opts.onError) opts.onError(); return false; }
    if (!active) {
      const b = box(); spot.side = opts.side === 'right' ? 'right' : 'left';
      spot.x = spot.side === 'right' ? b.right : b.left;
      spot.y = b.top + Math.max(0, b.bottom - b.top) * 0.56;
      position(spot.x, spot.y); start = performance.now(); last = 0;
    }
    updateIdentity(opts);
    active = true; host.hidden = false;
    if (!raf) raf = requestAnimationFrame(tick);
    return true;
  }
  function hide() {
    active = false;
    if (host) host.hidden = true;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }
  return { supported: () => !unavailable && !!T.WebGLRenderer, sync, hide, react,
    state: () => ({ active, id: rigId, side: spot.side, detail: reducedDetail, unavailable }) };
})();
window.JanusEdgeCompanion = JanusEdgeCompanion;
