'use strict';
/* ===== LEGO janus-3d v1.0 · Robot de Janus y micrófono 3D en tiempo real =====
 * three.js r160 (MeshPhysicalMaterial metálico + entorno PMREM de estudio), sin red ni dependencias del host.
 * Uso: <div data-3d="bot|mic" data-id="único" data-tap="#ruta"></div>  →  Janus3D.hydrate(document)
 *  - Se gira arrastrando con el dedo (inercia). Un toque sin arrastre ejecuta onTap / navega a data-tap.
 *  - El canvas de cada id se conserva entre re-renders (no se recrea WebGL).
 *  - Janus3D.state.talking / listening / thinking animan boca, ojos, ondas.
 * Reutilizable en landings y webs de InfinitySeed (solo necesita window.THREE + window.RoomEnvironment).
 */
const Janus3D = (() => {
  const T = window.THREE; if (!T) return { hydrate() {}, state: {} };
  const state = { talking: false, listening: false, thinking: false, wave: 0 };
  const inst = {};
  let raf = 0, t0 = performance.now();

  function makeRenderer(w, h) {
    const r = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.5)); r.setSize(w, h, false);
    r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1.3; r.outputColorSpace = T.SRGBColorSpace;
    return r;
  }
  // Estudio de joyería: fondo oscuro cálido + cajas de luz (como tools/gold3d), para que el oro se vea oro y no cobre.
  function studio(renderer) {
    const sc = new T.Scene(); sc.background = new T.Color(0x3a2a16);
    const box = (w, h, x, y, z, i, col) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(col || 0xffffff).multiplyScalar(i), side: T.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); sc.add(m); };
    box(7, 3, 0, 7, 3, 5.5, 0xfff4e0); box(3, 9, -7, 1, 3, 3.6, 0xffe2b0); box(3, 9, 7, 0.5, -1, 4.2, 0xfff0d8); box(9, 2, 0, -6, 4, 1.4, 0xffc890); box(4, 4, 0, 1, 8, 2.2, 0xfff8ec); box(12, 12, 0, 0, -10, 0.9, 0x8a6a3a); box(10, 4, 0, -2, 9, 1.6, 0xffe6c0);
    const pm = new T.PMREMGenerator(renderer), env = pm.fromScene(sc, 0.025).texture; pm.dispose(); return env;
  }
  const gold = () => new T.MeshPhysicalMaterial({ color: 0xFFCF5C, metalness: 1, roughness: 0.14, clearcoat: 0.7, clearcoatRoughness: 0.08, envMapIntensity: 1.25 });
  const obsid = () => new T.MeshPhysicalMaterial({ color: 0x07070A, metalness: 0.35, roughness: 0.07, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.1 });
  const glow = (c) => new T.MeshBasicMaterial({ color: c || 0xFFD36A, toneMapped: false });
  function glowSprite(size, color) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,214,120,1)'); gr.addColorStop(0.35, 'rgba(255,190,80,.45)'); gr.addColorStop(1, 'rgba(255,170,60,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const s = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(cv), color: color || 0xffffff, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
    s.scale.set(size, size, 1); return s;
  }
  function lights(scene) {
    const k = new T.DirectionalLight(0xFFF0D0, 3.2); k.position.set(3, 5, 6); scene.add(k);
    const r = new T.DirectionalLight(0xFFB86B, 1.6); r.position.set(-5, 2, -4); scene.add(r);
    scene.add(new T.AmbientLight(0x332211, 0.6));
  }

  /* ---------- Robot ---------- */
  function buildBot() {
    const G = gold(), O = obsid(), root = new T.Group(), P = {};
    const head = new T.Group(); head.position.y = 1.2; root.add(head); P.head = head;
    const hs = new T.Mesh(new T.SphereGeometry(1, 64, 48), G); hs.scale.set(1, 0.92, 0.95); head.add(hs);
    const VM = new T.MeshPhysicalMaterial({ color: 0x050507, metalness: 0.2, roughness: 0.32, clearcoat: 0.5, clearcoatRoughness: 0.25, envMapIntensity: 0.28 }); /* visor mate: sin reflejos fantasma que parezcan una segunda cara */
    const visor = new T.Mesh(new T.SphereGeometry(1.012, 64, 32, Math.PI / 2 - 0.92, 1.84, Math.PI / 2 - 0.5, 0.98), VM); visor.scale.set(1, 0.92, 0.95); head.add(visor);
        const eyeG = new T.CircleGeometry(0.135, 32), eyes = [];
    [-0.31, 0.31].forEach((x) => { const e = new T.Mesh(eyeG, glow()); e.position.set(x, 0.07, 0.93); e.lookAt(x * 3, 0.2, 4); head.add(e); eyes.push(e); const s = glowSprite(0.75); s.position.set(x, 0.07, 1.0); head.add(s); e.userData.spr = s; });
    P.eyes = eyes;
    const smile = new T.Mesh(new T.TorusGeometry(0.17, 0.028, 10, 32, Math.PI * 0.75), glow()); smile.rotation.z = Math.PI + Math.PI * 0.125; smile.position.set(0, -0.2, 0.93); head.add(smile); P.smile = smile;
    [-1, 1].forEach((sx) => { const ear = new T.Mesh(new T.CylinderGeometry(0.27, 0.27, 0.22, 48), G); ear.rotation.z = Math.PI / 2; ear.position.set(sx * 0.98, 0, 0); head.add(ear); const ein = new T.Mesh(new T.CylinderGeometry(0.17, 0.17, 0.24, 40), O); ein.rotation.z = Math.PI / 2; ein.position.set(sx * 1.0, 0, 0); head.add(ein); });
    const ant = new T.Mesh(new T.CylinderGeometry(0.03, 0.035, 0.42, 16), G); ant.position.y = 1.08; head.add(ant);
    const ball = new T.Mesh(new T.SphereGeometry(0.11, 32, 24), G); ball.position.y = 1.32; head.add(ball); P.ball = ball;
    const bglow = glowSprite(0.6); bglow.position.y = 1.32; head.add(bglow); P.bglow = bglow;
    const neck = new T.Mesh(new T.CylinderGeometry(0.22, 0.28, 0.16, 32), O); neck.position.y = 0.32; root.add(neck);
    const body = new T.Mesh(new T.CapsuleGeometry(0.55, 0.32, 16, 40), G); body.scale.set(1.08, 1, 0.92); body.position.y = -0.3; root.add(body);
    const badge = new T.Mesh(new T.CylinderGeometry(0.2, 0.2, 0.05, 40), O); badge.rotation.x = Math.PI / 2; badge.position.set(0, -0.2, 0.52); root.add(badge);
    const core = new T.Mesh(new T.TorusGeometry(0.12, 0.022, 10, 40), glow()); core.position.set(0, -0.2, 0.555); root.add(core); P.core = core;
    const arm = (sx) => {
      const sh = new T.Group(); sh.position.set(sx * 0.68, -0.02, 0); root.add(sh);
      const ball = new T.Mesh(new T.SphereGeometry(0.17, 32, 24), O); sh.add(ball);
      const up = new T.Mesh(new T.CapsuleGeometry(0.12, 0.3, 10, 24), G); up.position.y = -0.28; sh.add(up);
      const el = new T.Group(); el.position.y = -0.52; sh.add(el);
      const fo = new T.Mesh(new T.CapsuleGeometry(0.11, 0.24, 10, 24), G); fo.position.y = -0.2; el.add(fo);
      const hand = new T.Group(); hand.position.y = -0.44; el.add(hand);
      const palm = new T.Mesh(new T.SphereGeometry(0.16, 32, 24), G); palm.scale.set(1, 1.1, 0.8); hand.add(palm);
      const th = new T.Mesh(new T.SphereGeometry(0.065, 20, 16), G); th.position.set(-sx * 0.14, 0.05, 0.05); hand.add(th);
      return { sh, el, hand };
    };
    P.armL = arm(-1); P.armR = arm(1);
    const leg = (sx) => {
      const hip = new T.Group(); hip.position.set(sx * 0.27, -0.82, 0); root.add(hip);
      const l = new T.Mesh(new T.CapsuleGeometry(0.14, 0.24, 10, 24), O); l.position.y = -0.22; hip.add(l);
      const foot = new T.Mesh(new T.SphereGeometry(0.25, 32, 20), G); foot.scale.set(1, 0.5, 1.4); foot.position.set(0, -0.52, 0.1); hip.add(foot);
      return hip;
    };
    P.legL = leg(-1); P.legR = leg(1);
    const pl = new T.PointLight(0xFFC060, 2.2, 3.5); pl.position.set(0, 1.2, 1.6); root.add(pl); P.pl = pl;
    root.position.y = -0.35;
    return { root, P };
  }
  function animBot(o, t, dt) {
    const P = o.P, S = state, tap = Math.max(0, o.tapT - t + 1.6);
    o.root.position.y = -0.35 + Math.sin(t * 2.1) * 0.05 + (tap > 0 ? Math.sin((1.6 - tap) / 1.6 * Math.PI) * 0.35 : 0);
    P.head.rotation.z = Math.sin(t * 1.3) * 0.07; P.head.rotation.x = Math.sin(t * 0.9) * 0.05 + (S.thinking ? -0.12 : 0);
    const blink = (t % 4.2) < 0.12 ? 0.12 : 1; P.eyes.forEach((e) => { e.scale.y = blink; e.userData.spr.material.opacity = S.listening ? 1 : 0.75; });
    const talk = S.talking ? 0.55 + Math.abs(Math.sin(t * 14)) * 0.9 : 1; P.smile.scale.set(1, talk, 1);
    P.core.rotation.z = t * 1.5; P.bglow.material.opacity = 0.55 + Math.sin(t * 3) * 0.35; P.pl.intensity = 1.8 + (S.talking ? Math.sin(t * 14) * 0.6 : 0);
    const waving = tap > 0 || (t % 8) < 2.2 || S.wave > 0;
    const R = P.armR, L = P.armL;
    R.sh.rotation.z = waving ? 2.5 : 0.12 + Math.sin(t * 1.6) * 0.06; R.el.rotation.z = waving ? Math.sin(t * 9) * 0.55 : 0.1; R.sh.rotation.x = waving ? -0.2 : Math.sin(t * 1.6) * 0.12;
    L.sh.rotation.z = -0.12 - Math.sin(t * 1.6 + 1) * 0.06 - (S.talking ? Math.abs(Math.sin(t * 3)) * 0.4 : 0); L.el.rotation.z = -0.1 - (S.talking ? 0.5 : 0); L.sh.rotation.x = -Math.sin(t * 1.6) * 0.12;
    const step = (t % 10) > 7.5 || tap > 0 ? Math.sin(t * 8) * 0.35 : 0; P.legL.rotation.x = step; P.legR.rotation.x = -step;
  }

  /* ---------- Micrófono ---------- */
  function buildMic() {
    const G = gold(), O = obsid(), root = new T.Group(), P = {};
    const base = new T.Mesh(new T.CylinderGeometry(0.85, 0.95, 0.16, 64), O); base.position.y = -1.65; root.add(base);
    const brim = new T.Mesh(new T.TorusGeometry(0.9, 0.035, 12, 64), G); brim.rotation.x = Math.PI / 2; brim.position.y = -1.57; root.add(brim);
    const stem = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 0.9, 24), G); stem.position.y = -1.15; root.add(stem);
    const yoke = new T.Mesh(new T.TorusGeometry(0.72, 0.055, 16, 64, Math.PI), G); yoke.rotation.z = Math.PI; yoke.position.y = -0.1; root.add(yoke);
    [-0.72, 0.72].forEach((x) => { const k = new T.Mesh(new T.SphereGeometry(0.11, 24, 16), G); k.position.set(x, -0.1, 0); root.add(k); });
    const head = new T.Group(); root.add(head); P.head = head;
    const core = new T.Mesh(new T.CapsuleGeometry(0.58, 1.0, 16, 48), O); head.add(core);
    for (let i = -7; i <= 7; i++) { const y = i * 0.1, r = Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, Math.abs(y) - 0.5) / 0.58, 2))) * 0.6 + 0.005; if (Math.abs(y) > 1.05) continue; const ring = new T.Mesh(new T.TorusGeometry(r, i === 0 ? 0.05 : 0.022, 10, 64), G); ring.rotation.x = Math.PI / 2; ring.position.y = y; head.add(ring); }
    const capT = new T.Mesh(new T.SphereGeometry(0.585, 48, 24, 0, Math.PI * 2, 0, 0.6), G); capT.position.y = 0.5; head.add(capT);
    const capB = new T.Mesh(new T.SphereGeometry(0.585, 48, 24, 0, Math.PI * 2, Math.PI - 0.6, 0.6), G); capB.position.y = -0.5; head.add(capB);
    const emb = new T.Mesh(new T.CylinderGeometry(0.13, 0.13, 0.05, 32), G); emb.rotation.x = Math.PI / 2; emb.position.set(0, 0, 0.62); head.add(emb);
    P.waves = [];
    for (let i = 0; i < 4; i++) { const w = new T.Mesh(new T.TorusGeometry(1, 0.018, 8, 96), new T.MeshBasicMaterial({ color: 0xFFC766, transparent: true, opacity: 0.5, toneMapped: false, depthWrite: false })); root.add(w); P.waves.push(w); }
    const pl = new T.PointLight(0xFFC060, 1.5, 4); pl.position.set(0, 0, 1.6); root.add(pl); P.pl = pl;
    root.position.y = 0.25;
    return { root, P };
  }
  function animMic(o, t) {
    const P = o.P, S = state, speed = S.listening ? 1.4 : 0.45, amp = S.listening ? 1 : 0.55;
    P.waves.forEach((w, i) => { const ph = ((t * speed + i / P.waves.length) % 1); const s = 0.95 + ph * 0.95; /* radio máx. 1.9 < semiancho visible (≈2.2): las ondas ya no se cortan en el borde */ w.scale.set(s, s, s); w.material.opacity = (1 - ph) * 0.6 * amp; w.rotation.y = Math.sin(t * 0.35 + i * 0.9) * 0.55; });
    P.head.rotation.y = Math.sin(t * 0.6) * 0.08; P.pl.intensity = S.listening ? 2.2 + Math.sin(t * 10) * 0.6 : 1.4;
    o.root.position.y = 0.25 + Math.sin(t * 1.8) * 0.03;
  }

  /* ---------- Montaje / ciclo ---------- */
  function create(kind, host) {
    const w = Math.max(60, host.clientWidth), h = Math.max(60, host.clientHeight);
    const renderer = makeRenderer(w, h), scene = new T.Scene(); scene.environment = studio(renderer); lights(scene);
    const cam = new T.PerspectiveCamera(kind === 'bot' ? 28 : 30, w / h, 0.1, 100);
    cam.position.set(0, kind === 'bot' ? 0.45 : 0.2, kind === 'bot' ? 9.3 : 8.2); cam.lookAt(0, kind === 'bot' ? 0.35 : 0.0, 0);
    const built = kind === 'bot' ? buildBot() : buildMic(), pivot = new T.Group(); pivot.add(built.root); scene.add(pivot);
    const o = { kind, renderer, scene, cam, pivot, root: built.root, P: built.P, rotY: kind === 'bot' ? -0.25 : 0.35, rotX: 0, vel: 0, drag: null, tapT: -10, onTap: null, w, h };
    const cv = renderer.domElement; cv.className = 'j3d-cv'; cv.style.touchAction = 'pan-y';
    cv.addEventListener('pointerdown', (e) => { o.drag = { x: e.clientX, y: e.clientY, moved: 0, lx: e.clientX, ly: e.clientY }; o.vel = 0; try { cv.setPointerCapture(e.pointerId); } catch (_) { } });
    cv.addEventListener('pointermove', (e) => { if (!o.drag) return; const dx = e.clientX - o.drag.lx, dy = e.clientY - o.drag.ly; o.drag.lx = e.clientX; o.drag.ly = e.clientY; o.drag.moved += Math.abs(dx) + Math.abs(dy); o.rotY += dx * 0.012; o.rotX = Math.max(-0.5, Math.min(0.5, o.rotX + dy * 0.006)); o.vel = dx * 0.012; });
    const up = () => { if (!o.drag) return; const tap = o.drag.moved < 8; o.drag = null; if (tap) { o.tapT = (performance.now() - t0) / 1000; if (o.onTap) setTimeout(o.onTap, kind === 'bot' ? 450 : 0); } };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', () => { o.drag = null; });
    return o;
  }
  function frame() {
    raf = requestAnimationFrame(frame);
    const t = (performance.now() - t0) / 1000;
    Object.values(inst).forEach((o) => {
      const cv = o.renderer.domElement; if (!cv.isConnected || !cv.offsetParent) return; const vw = document.getElementById('view'); if (vw && !vw.hidden && !vw.contains(cv)) return;
      const host = cv.parentElement, w = host.clientWidth, h = host.clientHeight;
      if (w && h && (w !== o.w || h !== o.h)) { o.w = w; o.h = h; o.renderer.setSize(w, h, false); o.cam.aspect = w / h; o.cam.updateProjectionMatrix(); }
      if (!o.drag) { o.rotY += o.vel; o.vel *= 0.94; if (Math.abs(o.vel) < 0.0005) { o.vel = 0; o.rotY += ((o.kind === 'bot' ? -0.25 : 0.35) - o.rotY) * 0.01; o.rotX *= 0.97; } }
      o.pivot.rotation.y = o.rotY; o.pivot.rotation.x = o.rotX;
      if (o.kind === 'bot') animBot(o, t); else animMic(o, t);
      o.renderer.render(o.scene, o.cam);
    });
  }
  function hydrate(root) {
    (root || document).querySelectorAll('[data-3d]').forEach((host) => {
      const kind = host.getAttribute('data-3d'), id = host.getAttribute('data-id') || kind;
      let o = inst[id];
      if (!o) { try { o = inst[id] = create(kind, host); } catch (e) { host.classList.add('j3d-off'); if (host.getAttribute('data-tapact')) host.setAttribute('data-act', host.getAttribute('data-tapact')); if (host.getAttribute('data-tap')) host.setAttribute('data-go', host.getAttribute('data-tap').replace(/^#/, '')); return; } }
      if (o.renderer.domElement.parentElement !== host) host.appendChild(o.renderer.domElement);
      const to = host.getAttribute('data-tap'), ta = host.getAttribute('data-tapact');
      o.onTap = to ? () => { location.hash = to; } : ta ? () => { try { if (typeof ACTS !== 'undefined' && ACTS[ta]) { ACTS[ta](); if (typeof rerender === 'function') rerender(); } } catch (e) { } } : null;
    });
    if (!raf) frame();
  }
  return { hydrate, state, _inst: inst };
})();
window.Janus3D = Janus3D;
