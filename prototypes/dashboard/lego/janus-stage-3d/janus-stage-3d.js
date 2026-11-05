'use strict';
/* ===== LEGO janus-stage-3d v1.0 · Escenario 3D manipulable (isla, mundo, objetos de lección, cámara, arrastre táctil) =====
 * three.js r160 (global THREE). Independiente del dashboard: lo único que necesita es un <div> y, opcionalmente, JanusCreatures3D.
 * El render es una FUNCIÓN DEL ESTADO de escena (módulo scene-stage): stage.apply(state, events).
 * Uso:   <div data-stage3d data-id="kendra"></div>  →  JanusStage3D.hydrate(document); const st = JanusStage3D.get('kendra');
 *        st.setCreature('lumi', look); st.setWorld({ home, vehicle, decor }); st.apply(sceneState, events);
 *        st.on({ move(id,[x,z]), tapProp(id), tapCreature(), tapHome(), tapVehicle(), tapEmpty() });
 * Manipulación: arrastrar un objeto lo mueve; tocar lo selecciona; arrastrar el vacío gira la cámara; pellizcar/rueda = zoom.
 * El canvas de cada data-id se conserva entre re-renders. Sin WebGL: supported() === false.
 */
const JanusStage3D = (() => {
  const T = window.THREE;
  if (!T) return { supported: () => false, create() { throw new Error('three.js no está cargado'); }, hydrate() {}, get() { return null; }, _inst: {} };

  const STAGE = { x: 6, z: 4 }, DECK_Y = 0.18;
  const TINTS = { dorado: '#F6C453', menta: '#7FE3C4', rosa: '#FF9CC8', azul: '#4F8DF0', cielo: '#8EC8FF', lila: '#C9B6E8', violeta: '#9B7BE0', coral: '#FF8E7A', verde: '#8FBF5A', naranja: '#FF9F43', rojo: '#FF5A5A', turquesa: '#4CC9C0', crema: '#FBE7C6' };
  const PLACE_COL = ['#F6C453', '#4CC9C0', '#FF7AA2', '#A78BFA', '#FF9F43'];
  const SPOTS = { home: [-5.0, -8.8], vehicle: [1.6, -6.8], dec: { 'dec:planta': [-8.4, -6.4], 'dec:alfombra': [-5.0, -6.3], 'dec:lampara': [-2.0, -7.8], 'dec:cama': [-9.0, -9.0], 'dec:estanteria': [-1.2, -9.8] } };
  const S0 = { home: 1.6, vehicle: 1.45, decor: 1.3 };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
  const easeBack = (x) => { x = clamp(x, 0, 1); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const tintHex = (id, fb) => (id && TINTS[id]) || fb;

  /* ---------- utilidades de malla ---------- */
  const mat = (c, o) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.72, metalness: 0, envMapIntensity: 0.5 }, o || {}));
  const shiny = (c, o) => new T.MeshPhysicalMaterial(Object.assign({ color: c, roughness: 0.3, metalness: 0.1, clearcoat: 0.8, clearcoatRoughness: 0.2, envMapIntensity: 0.9 }, o || {}));
  const glowM = (c) => new T.MeshBasicMaterial({ color: c, toneMapped: false });
  const put = (m, x, y, z) => { m.position.set(x, y, z); return m; };
  const shade = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
  const box = (w, h, d, m, x, y, z) => put(shade(new T.Mesh(new T.BoxGeometry(w, h, d), m)), x || 0, y || 0, z || 0);
  const cyl = (rt, rb, h, m, x, y, z, seg) => put(shade(new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg || 24), m)), x || 0, y || 0, z || 0);
  const sph = (r, m, x, y, z, sx, sy, sz) => { const s = shade(new T.Mesh(new T.SphereGeometry(r, 24, 16), m)); s.scale.set(sx || 1, sy || 1, sz || 1); return put(s, x || 0, y || 0, z || 0); };
  const torus = (R, r, m, x, y, z, arc) => put(shade(new T.Mesh(new T.TorusGeometry(R, r, 10, 36, arc || Math.PI * 2), m)), x || 0, y || 0, z || 0);
  function canvasTex(w, h, draw) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t; }
  function glowTex() { return canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }); }
  let GLOW = null;
  function glowSprite(color, size, opacity) {
    GLOW = GLOW || glowTex();
    const s = new T.Sprite(new T.SpriteMaterial({ map: GLOW, color: new T.Color(color), transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: opacity == null ? 1 : opacity, fog: false }));
    s.scale.set(size, size, 1); return s;
  }
  function rrect(w, h, r) { const s = new T.Shape(), x = -w / 2, y = -h / 2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; }
  const pickBox = (w, h, d, x, y, z, kind) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), new T.MeshBasicMaterial({ visible: false })); m.position.set(x || 0, y == null ? h / 2 : y, z || 0); m.userData.pickKind = kind; return m; };

  /* ---------- cielo, estrellas, luna, nubes ---------- */
  function makeSky() {
    const g = new T.SphereGeometry(95, 40, 24), pos = g.attributes.position, cols = new Float32Array(pos.count * 3);
    const stops = [[-1, '#2a1f3d'], [-0.06, '#47305a'], [0.0, '#f2a46a'], [0.07, '#cf7080'], [0.22, '#6a4690'], [0.5, '#2b2252'], [1, '#0c0a1d']].map((s) => [s[0], new T.Color(s[1])]);
    const c = new T.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 95; let k = 0; while (k < stops.length - 2 && y > stops[k + 1][0]) k++;
      const a = stops[k], b = stops[k + 1], f = clamp((y - a[0]) / (b[0] - a[0]), 0, 1); c.copy(a[1]).lerp(b[1], f);
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new T.BufferAttribute(cols, 3));
    const sky = new T.Mesh(g, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide, fog: false, depthWrite: false }));
    sky.renderOrder = -10;
    const grp = new T.Group(); grp.add(sky);
    const r = rng(11), sp = [], big = [];
    for (let i = 0; i < 360; i++) { const a = r() * Math.PI * 2, e = 0.06 + Math.pow(r(), 0.8) * 1.45, R = 88; const p = [Math.cos(a) * Math.cos(e) * R, Math.sin(e) * R, Math.sin(a) * Math.cos(e) * R]; (i % 9 === 0 ? big : sp).push(...p); }
    const mkPts = (arr, size, op) => { const bg = new T.BufferGeometry(); bg.setAttribute('position', new T.Float32BufferAttribute(arr, 3)); return new T.Points(bg, new T.PointsMaterial({ size, sizeAttenuation: false, color: 0xfff6e0, transparent: true, opacity: op, fog: false, depthWrite: false })); };
    const stars = mkPts(sp, 1.6, 0.85), stars2 = mkPts(big, 2.6, 0.9); grp.add(stars, stars2); grp.userData.twinkle = stars2;
    const moon = new T.Mesh(new T.CircleGeometry(5.2, 48), new T.MeshBasicMaterial({ color: 0xfff1cc, fog: false, toneMapped: false })); moon.position.set(-36, 40, -68); moon.lookAt(0, 0, 0); grp.add(moon);
    const mg = glowSprite('#ffd9a0', 40, 0.55); mg.position.copy(moon.position).multiplyScalar(0.99); grp.add(mg);
    return grp;
  }
  function makeClouds() {
    const g = new T.Group(), r = rng(5), m = new T.MeshBasicMaterial({ color: 0xffd8c0, transparent: true, opacity: 0.5, fog: false, depthWrite: false });
    for (let i = 0; i < 5; i++) { const c = new T.Group(); for (let j = 0; j < 6; j++) { const s = new T.Mesh(new T.SphereGeometry(2 + r() * 2.2, 14, 10), m); s.scale.set(1.6, 0.6, 1); s.position.set((j - 2.5) * 3.2, r() * 1.2, r() * 2); c.add(s); } c.position.set(-60 + i * 34, 17 + r() * 8, -52 - r() * 20); c.userData.v = 0.25 + r() * 0.3; g.add(c); }
    return g;
  }

  /* ---------- isla, plataforma, vegetación ---------- */
  function makeIsland() {
    const g = new T.Group();
    const grassTex = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#4c8a3e'; c.fillRect(0, 0, w, h); const r = rng(7); for (let i = 0; i < 1500; i++) { c.fillStyle = 'hsla(' + (92 + r() * 42) + ',' + (42 + r() * 22) + '%,' + (26 + r() * 22) + '%,' + (0.22 + r() * 0.35) + ')'; c.beginPath(); c.arc(r() * w, r() * h, 1 + r() * 3.2, 0, 7); c.fill(); } });
    grassTex.wrapS = grassTex.wrapT = T.RepeatWrapping; grassTex.repeat.set(9, 9);
    const top = new T.Mesh(new T.CylinderGeometry(13.5, 12.8, 0.7, 80), [mat('#6b4a35'), mat('#ffffff', { map: grassTex, roughness: 0.95 }), mat('#4a3a46')]);
    top.position.y = -0.35; top.receiveShadow = true; g.add(top);
    const cg = new T.ConeGeometry(12.8, 8, 56, 5, true), p = cg.attributes.position, r2 = rng(3);
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > -3.9) { const k = 1 + (r2() - 0.5) * 0.12; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); p.setY(i, y + (r2() - 0.5) * 0.4); } }
    cg.computeVertexNormals();
    const rock = new T.Mesh(cg, mat('#5b4a58', { flatShading: true, roughness: 0.95 })); rock.rotation.x = Math.PI; rock.position.y = -4.7; rock.castShadow = true; g.add(rock);
    // plataforma de juego (mesa de práctica)
    const trim = new T.Mesh(new T.ExtrudeGeometry(rrect(13.4, 9.4, 1.1), { depth: 0.08, bevelEnabled: false, curveSegments: 12 }), mat('#C9953A', { metalness: 0.7, roughness: 0.38 }));
    trim.rotation.x = -Math.PI / 2; trim.position.y = 0.0; trim.receiveShadow = true; g.add(trim);
    const deck = new T.Mesh(new T.ExtrudeGeometry(rrect(13.0, 9.0, 1.0), { depth: 0.1, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 12 }), mat('#1b1626', { roughness: 0.55, metalness: 0.15 }));
    deck.rotation.x = -Math.PI / 2; deck.position.y = 0.05; deck.receiveShadow = true; g.add(deck);
    const gridTex = canvasTex(1024, 704, (c, w, h) => {
      const gr = c.createRadialGradient(w * 0.55, h * 0.5, 40, w * 0.5, h * 0.5, w * 0.62); gr.addColorStop(0, '#51426f'); gr.addColorStop(1, '#2b2142'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(246,196,83,.20)'; c.lineWidth = 2; for (let x = 0; x <= w; x += w / 13) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } for (let y = 0; y <= h; y += h / 9) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
      c.strokeStyle = 'rgba(246,196,83,.55)'; c.lineWidth = 4; c.strokeRect(16, 16, w - 32, h - 32);
    });
    const top2 = new T.Mesh(new T.PlaneGeometry(12.6, 8.6), mat('#ffffff', { map: gridTex, roughness: 0.6 })); top2.rotation.x = -Math.PI / 2; top2.position.y = DECK_Y + 0.004; top2.receiveShadow = true; g.add(top2);
    // hierba, flores
    const r = rng(21), onDeck = (x, z) => Math.abs(x) < 7.4 && Math.abs(z) < 5.2;
    const tuft = new T.InstancedMesh(new T.ConeGeometry(0.045, 0.17, 4), mat('#ffffff', { roughness: 1 }), 420), m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), sc = new T.Vector3(), ps = new T.Vector3(), cc = new T.Color();
    let n = 0; while (n < 420) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 12.6, x = Math.cos(a) * d, z = Math.sin(a) * d; if (onDeck(x, z)) continue; const s = 0.6 + r() * 1.1; e.set((r() - 0.5) * 0.3, r() * 6, (r() - 0.5) * 0.3); q.setFromEuler(e); m4.compose(ps.set(x, 0.18 * s, z), q, sc.set(s, s, s)); tuft.setMatrixAt(n, m4); cc.setHSL(0.27 + r() * 0.07, 0.55, 0.17 + r() * 0.1); tuft.setColorAt(n, cc); n++; }
    tuft.receiveShadow = true; g.add(tuft);
    const fl = new T.InstancedMesh(new T.SphereGeometry(0.1, 8, 6), mat('#ffffff', { roughness: 0.5 }), 90); n = 0;
    const FC = ['#FF9CC8', '#FFE07A', '#ffffff', '#C9B6E8', '#FF8E7A'];
    while (n < 90) { const a = r() * Math.PI * 2, d = 4 + r() * 8.4, x = Math.cos(a) * d, z = Math.sin(a) * d; if (onDeck(x, z)) continue; m4.compose(ps.set(x, 0.3, z), q.identity(), sc.set(1, 1, 1)); fl.setMatrixAt(n, m4); fl.setColorAt(n, cc.set(FC[n % FC.length])); n++; }
    g.add(fl);
    // árboles, arbustos, rocas
    const tree = (x, z, s, c1) => { const t = new T.Group(); t.add(cyl(0.2 * s, 0.3 * s, 1.5 * s, mat('#6a4630'), 0, 0.75 * s, 0, 10)); [[0, 2.0, 0, 1.0], [0.55, 1.7, 0.2, 0.7], [-0.5, 1.8, -0.2, 0.75]].forEach((b) => t.add(sph(b[3] * s, mat(c1, { roughness: 0.9 }), b[0] * s, b[1] * s, b[2] * s))); t.position.set(x, 0, z); return t; };
    [[-10.2, -3.5, 1.3, '#2f7d5b'], [-9.5, 4.8, 1.0, '#3b8a4f'], [10.2, -4.2, 1.4, '#2a6f58'], [9.4, 5.2, 1.1, '#3f8f5a'], [4.8, -10, 1.2, '#2f7d5b'], [-1.2, -11, 1.5, '#357f50'], [8.8, -8.6, 1.0, '#3b8a4f'], [-8.6, -9.4, 1.2, '#2a6f58'], [3, 9.6, 0.9, '#3f8f5a']].forEach((t) => g.add(tree(t[0], t[1], t[2], t[3])));
    for (let i = 0; i < 9; i++) { const a = r() * 6.28, d = 8.6 + r() * 3.4, x = Math.cos(a) * d, z = Math.sin(a) * d; if (Math.abs(x) < 7.4 && Math.abs(z) < 5.2) continue; g.add(sph(0.5 + r() * 0.3, mat('#3b8a4f', { roughness: 0.95 }), x, 0.3, z, 1.2, 0.8, 1)); }
    for (let i = 0; i < 7; i++) { const a = r() * 6.28, d = 9 + r() * 3, rk = shade(new T.Mesh(new T.DodecahedronGeometry(0.35 + r() * 0.35, 0), mat('#8b8294', { flatShading: true, roughness: 0.95 }))); rk.position.set(Math.cos(a) * d, 0.18, Math.sin(a) * d); rk.rotation.set(r(), r(), r()); g.add(rk); }
    // faroles en las esquinas de la plataforma
    g.userData.lanterns = [];
    [[-6.9, -4.8], [6.9, -4.8], [-6.9, 4.8], [6.9, 4.8]].forEach((p) => { const l = new T.Group(); l.add(cyl(0.05, 0.07, 1.3, mat('#2a2432'), 0, 0.65, 0, 8)); l.add(put(new T.Mesh(new T.SphereGeometry(0.15, 14, 10), glowM(0xFFD27A)), 0, 1.36, 0)); const s = glowSprite('#FFC060', 1.5, 0.85); s.position.y = 1.36; l.add(s); l.position.set(p[0], 0, p[1]); g.add(l); g.userData.lanterns.push(s); });
    // luciérnagas
    const fr = rng(99), fp = new Float32Array(48 * 3); for (let i = 0; i < 48; i++) { fp[i * 3] = (fr() - 0.5) * 22; fp[i * 3 + 1] = 0.4 + fr() * 2.4; fp[i * 3 + 2] = (fr() - 0.5) * 18 - 2; }
    const fg = new T.BufferGeometry(); fg.setAttribute('position', new T.BufferAttribute(fp, 3)); GLOW = GLOW || glowTex();
    const flies = new T.Points(fg, new T.PointsMaterial({ size: 0.26, map: GLOW, color: 0xffe9a0, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0.95 }));
    flies.userData.base = fp.slice(); g.add(flies); g.userData.flies = flies;
    return g;
  }

  /* ---------- tienda: casas, vehículos, decoración ---------- */
  const woodTex = () => { const t = canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#b98757'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 16) { c.fillStyle = 'rgba(70,40,20,.28)'; c.fillRect(0, y, w, 2); c.fillStyle = 'rgba(255,230,190,.12)'; c.fillRect(0, y + 3, w, 3); } }); t.wrapS = t.wrapT = T.RepeatWrapping; return t; };
  const windowM = () => glowM(0xFFD27A);
  function buildHome(key) {
    const g = new T.Group(); g.userData.pickR = 2.0;
    if (key === 'home:hongo') {
      g.add(cyl(0.9, 1.05, 1.7, mat('#f6e8d0'), 0, 0.85, 0, 28));
      const cap = shade(new T.Mesh(new T.SphereGeometry(2.1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), mat('#e8505b', { roughness: 0.55 }))); cap.scale.y = 0.85; cap.position.y = 1.6; g.add(cap);
      const rr = rng(2); for (let i = 0; i < 9; i++) { const a = rr() * 6.28, e = 0.35 + rr() * 0.9, R = 2.12; const s = sph(0.2 + rr() * 0.14, mat('#fff7ea'), Math.cos(a) * Math.sin(e) * R, 1.6 + Math.cos(e) * R * 0.85, Math.sin(a) * Math.sin(e) * R, 1, 0.35, 1); s.lookAt(0, 1.6, 0); g.add(s); }
      g.add(put(shade(new T.Mesh(new T.CircleGeometry(0.36, 24, 0, Math.PI), mat('#4a2c20'))), 0, 0.02, 1.02)); g.add(box(0.72, 0.62, 0.06, mat('#4a2c20'), 0, 0.31, 1.01));
      g.add(put(new T.Mesh(new T.CircleGeometry(0.22, 20), windowM()), 0.62, 1.1, 0.92).rotateY(0.5));
      g.add(sph(0.34, mat('#fff7ea'), -0.55, 0.14, 1.2, 1, 0.5, 1));
    } else if (key === 'home:arbol') {
      g.add(cyl(0.75, 1.1, 4.8, mat('#6a4630', { roughness: 0.95 }), 0, 2.4, 0, 14));
      [[0, 5.6, 0, 1.7], [1.5, 5.0, 0.3, 1.2], [-1.5, 5.1, -0.3, 1.3], [0.2, 6.5, 0.2, 1.1]].forEach((b) => g.add(sph(b[3], mat('#3b8a4f', { roughness: 0.9 }), b[0], b[1], b[2])));
      g.add(cyl(1.45, 1.45, 0.14, mat('#a8774a'), 0, 2.2, 0.35, 20)); g.add(box(1.5, 1.1, 1.3, mat('#ffffff', { map: woodTex() }), 0, 2.85, 0.35));
      const roof = shade(new T.Mesh(new T.ConeGeometry(1.35, 0.8, 4), mat('#8e3b46'))); roof.rotation.y = Math.PI / 4; roof.position.set(0, 3.8, 0.35); g.add(roof);
      g.add(put(new T.Mesh(new T.PlaneGeometry(0.4, 0.4), windowM()), 0, 2.9, 1.02));
      for (let i = 0; i < 7; i++) g.add(box(0.5, 0.05, 0.06, mat('#8a5a36'), 0.55, 0.3 + i * 0.3, 1.0));
      g.add(box(0.05, 2.2, 0.06, mat('#8a5a36'), 0.32, 1.2, 1.0)); g.add(box(0.05, 2.2, 0.06, mat('#8a5a36'), 0.78, 1.2, 1.0));
    } else if (key === 'home:nube') {
      const cm = mat('#ffffff', { roughness: 1 }); const cl = new T.Group(); cl.name = 'cloud';
      [[0, 0, 0, 1.5], [1.4, -0.1, 0.3, 1.1], [-1.4, -0.1, -0.2, 1.2], [0.6, 0.3, 1.0, 1.0], [-0.7, 0.2, 0.9, 0.95], [0, 0.4, -1.0, 1.0], [2.2, -0.2, -0.3, 0.8], [-2.2, -0.2, 0.2, 0.8]].forEach((b) => cl.add(sph(b[3], cm, b[0], b[1], b[2], 1, 0.7, 1)));
      cl.position.y = 1.0; g.add(cl); g.userData.float = cl;
      g.add(box(1.7, 1.2, 1.4, mat('#ffe9d6'), 0, 2.15, 0)); const roof = shade(new T.Mesh(new T.ConeGeometry(1.5, 0.9, 4), mat('#6f5be0'))); roof.rotation.y = Math.PI / 4; roof.position.set(0, 3.2, 0); g.add(roof);
      g.add(box(0.5, 0.8, 0.06, mat('#6f5be0'), 0, 1.75, 0.72)); g.add(put(new T.Mesh(new T.PlaneGeometry(0.4, 0.4), windowM()), 0.55, 2.3, 0.72));
      ['#ff5a5a', '#ffb454', '#ffe07a', '#7fe3c4', '#6aa6ff'].forEach((c, i) => { const rb = torus(2.4 - i * 0.14, 0.07, glowM(c), 0, 1.0, -1.4, Math.PI); g.add(rb); });
    } else { // cabaña
      g.add(box(2.7, 1.7, 2.3, mat('#ffffff', { map: woodTex() }), 0, 0.85, 0));
      const roof = shade(new T.Mesh(new T.ConeGeometry(2.45, 1.3, 4), mat('#8e3b46', { roughness: 0.8 }))); roof.rotation.y = Math.PI / 4; roof.scale.z = 0.88; roof.position.y = 2.3; g.add(roof);
      g.add(box(0.7, 1.15, 0.07, mat('#5b3a29'), -0.55, 0.58, 1.16)); g.add(sph(0.05, mat('#F6C453', { metalness: 1, roughness: 0.3 }), -0.3, 0.55, 1.22));
      g.add(box(0.7, 0.62, 0.05, mat('#3a2418'), 0.75, 1.05, 1.16)); g.add(put(new T.Mesh(new T.PlaneGeometry(0.56, 0.5), windowM()), 0.75, 1.05, 1.19));
      g.add(box(0.36, 0.9, 0.36, mat('#7a5a4a'), 0.85, 2.7, -0.4));
      const sm = []; for (let i = 0; i < 4; i++) { const s = glowSprite('#cfc6d8', 0.7, 0.3); s.userData.i = i; g.add(s); sm.push(s); } g.userData.smoke = sm; g.userData.smokeAt = [0.85, 3.2, -0.4];
    }
    g.add(pickBox(4.2, 3.4, 3.4, 0, 1.7, 0, 'home'));
    return g;
  }

  function wheel(R, tube, m) { const g = new T.Group(); g.add(torus(R, tube, m || mat('#1b1626', { roughness: 0.9 }), 0, 0, 0)); g.add(cyl(R * 0.2, R * 0.2, tube * 2.4, mat('#c8ccd6', { metalness: 0.8, roughness: 0.3 }), 0, 0, 0, 12).rotateX(Math.PI / 2)); g.userData.wheel = true; return g; }
  function buildVehicle(key) {
    const g = new T.Group(); g.userData.speed = 0;
    const paint = (c) => shiny(c, { roughness: 0.28 });
    if (key === 'veh:patinete') {
      g.add(box(1.2, 0.08, 0.3, paint('#4F8DF0'), 0, 0.18, 0)); const w1 = wheel(0.12, 0.04), w2 = wheel(0.12, 0.04); w1.position.set(-0.5, 0.12, 0); w2.position.set(0.55, 0.12, 0); g.add(w1, w2);
      g.add(cyl(0.025, 0.025, 1.0, mat('#c8ccd6', { metalness: 0.8 }), 0.58, 0.68, 0, 8)); g.add(box(0.06, 0.05, 0.5, mat('#1b1626'), 0.58, 1.18, 0));
    } else if (key === 'veh:bici') {
      const w1 = wheel(0.4, 0.035), w2 = wheel(0.4, 0.035); w1.position.set(-0.65, 0.42, 0); w2.position.set(0.65, 0.42, 0); g.add(w1, w2);
      const fm = paint('#FF8E7A'); const bar = (x1, y1, x2, y2) => { const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), c = cyl(0.03, 0.03, L, fm, (x1 + x2) / 2, (y1 + y2) / 2, 0, 8); c.rotation.z = Math.atan2(dx, dy) * -1; return c; };
      g.add(bar(-0.65, 0.42, -0.1, 0.85), bar(-0.1, 0.85, 0.5, 0.82), bar(-0.65, 0.42, 0.1, 0.42), bar(0.1, 0.42, -0.1, 0.85), bar(0.1, 0.42, 0.65, 0.42), bar(0.5, 0.82, 0.65, 0.42));
      g.add(box(0.3, 0.06, 0.2, mat('#1b1626'), -0.12, 0.92, 0)); g.add(box(0.05, 0.05, 0.6, mat('#1b1626'), 0.5, 0.98, 0));
    } else if (key === 'veh:moto') {
      const w1 = wheel(0.34, 0.09), w2 = wheel(0.34, 0.09); w1.position.set(-0.8, 0.36, 0); w2.position.set(0.8, 0.36, 0); g.add(w1, w2);
      g.add(sph(0.5, paint('#7B5BE0'), 0.15, 0.85, 0, 1.4, 0.7, 0.6)); g.add(box(0.8, 0.14, 0.3, mat('#1b1626'), -0.35, 0.92, 0)); g.add(box(1.2, 0.12, 0.3, paint('#5b3fc0'), 0, 0.5, 0));
      g.add(cyl(0.03, 0.03, 0.7, mat('#c8ccd6', { metalness: 0.8 }), 0.78, 0.7, 0, 8).rotateZ(-0.35)); g.add(box(0.05, 0.05, 0.6, mat('#1b1626'), 0.9, 1.03, 0));
      g.add(sph(0.1, glowM(0xFFE9A8), 0.95, 0.88, 0)); const hl = glowSprite('#FFE9A8', 0.9, 0.8); hl.position.set(1.0, 0.88, 0); g.add(hl);
    } else if (key === 'veh:coche') {
      g.add(box(1.9, 0.5, 1.0, paint('#FF5A5A'), 0, 0.5, 0)); g.add(box(1.0, 0.46, 0.9, paint('#FF5A5A'), -0.1, 0.98, 0));
      g.add(box(0.8, 0.34, 0.92, shiny('#9ad4ff', { transmission: 0, opacity: 0.85, transparent: true, roughness: 0.05 }), -0.1, 1.0, 0));
      [[-0.62, 0.55], [0.62, 0.55], [-0.62, -0.55], [0.62, -0.55]].forEach((p) => { const w = wheel(0.26, 0.09); w.rotation.y = Math.PI / 2; w.position.set(p[0], 0.27, p[1]); g.add(w); });
      [-0.3, 0.3].forEach((z) => { g.add(sph(0.1, glowM(0xFFF0B8), 0.96, 0.55, z, 0.5, 1, 1)); }); const hl = glowSprite('#FFF0B8', 1.0, 0.7); hl.position.set(1.05, 0.55, 0); g.add(hl);
    } else { // cohete
      const bm = paint('#f4f4f8'); g.add(shade(new T.Mesh(new T.CapsuleGeometry(0.4, 1.2, 8, 20), bm)).translateY(1.2)); const nose = shade(new T.Mesh(new T.ConeGeometry(0.4, 0.7, 20), paint('#FF5A5A'))); nose.position.y = 2.15; g.add(nose);
      [0, 1, 2].forEach((i) => { const f = shade(new T.Mesh(new T.ConeGeometry(0.3, 0.8, 3), paint('#FF5A5A'))); const a = i * 2.094; f.position.set(Math.cos(a) * 0.45, 0.55, Math.sin(a) * 0.45); f.rotation.y = -a; f.rotation.z = -0.35; g.add(f); });
      g.add(torus(0.18, 0.05, mat('#c8ccd6', { metalness: 0.8 }), 0, 1.5, 0.38)); g.add(put(new T.Mesh(new T.CircleGeometry(0.16, 20), shiny('#7fd3ff', { roughness: 0.05 })), 0, 1.5, 0.4));
      const fl = glowSprite('#FFB454', 1.3, 0.9); fl.position.y = 0.35; g.add(fl); g.userData.flame = fl;
      g.userData.rocket = true;
    }
    g.add(pickBox(2.2, 1.6, 1.4, 0, 0.8, 0, 'vehicle'));
    return g;
  }

  function buildDecor(key) {
    const g = new T.Group();
    if (key === 'dec:planta') {
      g.add(cyl(0.34, 0.26, 0.5, mat('#c8603f'), 0, 0.25, 0, 18)); g.add(cyl(0.3, 0.3, 0.05, mat('#4a2c20'), 0, 0.5, 0, 18));
      const lm = mat('#4da34f', { roughness: 0.6 }); for (let i = 0; i < 7; i++) { const a = (i / 7) * 6.28; const l = sph(0.22, lm, Math.cos(a) * 0.2, 0.9 + (i % 2) * 0.25, Math.sin(a) * 0.2, 0.5, 1.8, 0.2); l.rotation.set(Math.sin(a) * 0.5, -a, Math.cos(a) * 0.5); g.add(l); }
    } else if (key === 'dec:alfombra') {
      const tx = canvasTex(256, 256, (c, w, h) => { const cols = ['#7B5BE0', '#F6C453', '#FF9CC8', '#7FE3C4']; for (let i = 0; i < 4; i++) { c.fillStyle = cols[i]; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - i * 28, 0, 7); c.fill(); } });
      const m = new T.Mesh(new T.CircleGeometry(1.15, 40), mat('#ffffff', { map: tx })); m.rotation.x = -Math.PI / 2; m.position.y = 0.025; m.receiveShadow = true; g.add(m);
    } else if (key === 'dec:lampara') {
      g.add(cyl(0.05, 0.08, 1.7, mat('#2a2432'), 0, 0.85, 0, 8)); g.add(cyl(0.3, 0.2, 0.35, glowM(0xFFD27A), 0, 1.85, 0, 16)); const s = glowSprite('#FFC060', 2.6, 0.8); s.position.y = 1.85; g.add(s); g.userData.glow = s;
    } else if (key === 'dec:cama') {
      g.add(box(1.0, 0.3, 1.9, mat('#a8774a'), 0, 0.2, 0)); g.add(box(0.9, 0.2, 1.75, mat('#fff7ea'), 0, 0.45, 0)); g.add(box(0.9, 0.16, 1.0, mat('#7B5BE0'), 0, 0.6, 0.4)); g.add(sph(0.3, mat('#ffffff'), 0, 0.62, -0.7, 1.5, 0.5, 0.9)); g.add(box(1.0, 0.8, 0.1, mat('#8a5a36'), 0, 0.55, -0.98));
    } else { // estantería
      g.add(box(1.5, 1.8, 0.45, mat('#8a5a36'), 0, 0.9, 0)); [0.5, 1.0, 1.5].forEach((y) => g.add(box(1.4, 0.05, 0.5, mat('#6a4630'), 0, y, 0.02)));
      const bc = ['#ff5a5a', '#4F8DF0', '#F6C453', '#7fe3c4', '#9B7BE0']; [0.25, 0.75, 1.25].forEach((y, r) => { for (let i = 0; i < 6; i++) g.add(box(0.12, 0.3 + (i % 3) * 0.05, 0.3, mat(bc[(i + r) % 5]), -0.55 + i * 0.2, y + 0.03, 0.05)); });
    }
    g.add(pickBox(1.4, 1.6, 1.4, 0, 0.8, 0, 'decor'));
    return g;
  }

  /* ---------- objetos de lección (derivan de un Prop de scene-stage) ---------- */
  function chipTex(top, bottom, color, w, h) {
    return canvasTex(w || 256, h || 128, (c, W, H) => {
      c.fillStyle = 'rgba(14,11,26,.88)'; c.beginPath(); c.roundRect(4, 4, W - 8, H - 8, 26); c.fill();
      c.strokeStyle = color; c.lineWidth = 6; c.stroke();
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = color; c.font = '800 ' + (bottom ? 62 : 74) + 'px system-ui,Segoe UI,Arial,sans-serif'; c.fillText(top, W / 2, bottom ? H * 0.38 : H / 2 + 3);
      if (bottom) { c.fillStyle = '#fff'; c.font = '700 34px system-ui,Segoe UI,Arial,sans-serif'; c.fillText(bottom, W / 2, H * 0.78); }
    });
  }
  function setChip(sprite, top, bottom, color) {
    const old = sprite.material.map; sprite.material.map = chipTex(top, bottom, color); sprite.material.needsUpdate = true; if (old) old.dispose();
  }
  const chipSprite = (sx, sy) => { const s = new T.Sprite(new T.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false })); s.scale.set(sx, sy, 1); s.renderOrder = 20; return s; };
  const haloMesh = (r) => { const m = new T.Mesh(new T.RingGeometry(r, r + 0.22, 56), new T.MeshBasicMaterial({ color: 0xFFD36A, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, toneMapped: false })); m.rotation.x = -Math.PI / 2; m.position.y = 0.09; return m; };

  let DISC = null, COOKIE = null;
  function cookieAssets() {
    if (COOKIE) return COOKIE;
    const tx = canvasTex(64, 64, (c) => { c.fillStyle = '#d29a58'; c.fillRect(0, 0, 64, 64); const r = rng(4); c.fillStyle = '#5a3320'; for (let i = 0; i < 9; i++) { c.beginPath(); c.arc(8 + r() * 48, 8 + r() * 48, 3 + r() * 2.5, 0, 7); c.fill(); } });
    COOKIE = { geo: new T.CylinderGeometry(0.17, 0.17, 0.055, 20), mats: [mat('#c58a4a', { roughness: 0.9 }), mat('#ffffff', { map: tx, roughness: 0.9 }), mat('#a96f3a', { roughness: 0.9 })] };
    return COOKIE;
  }

  function makeColumn() {
    const g = new T.Group(), o = { group: g, kind: 'columna', radius: 1.15, n: 0, of: -1, label: null, birth: [], spread: 0, delay: 0, lit: false };
    DISC = DISC || new T.CylinderGeometry(0.27, 0.27, 0.075, 28);
    const ringM = new T.MeshBasicMaterial({ color: PLACE_COL[0], toneMapped: false });
    g.add(cyl(1.0, 1.06, 0.07, mat('#1d1830', { roughness: 0.5, metalness: 0.2 }), 0, 0.035, 0, 44));
    const ring = put(new T.Mesh(new T.TorusGeometry(1.0, 0.03, 8, 56), ringM), 0, 0.075, 0); ring.rotation.x = Math.PI / 2; g.add(ring);
    const discM = new T.MeshStandardMaterial({ color: PLACE_COL[0], metalness: 0.45, roughness: 0.32, envMapIntensity: 0.9 });
    const inst = new T.InstancedMesh(DISC, discM, 120); inst.castShadow = true; inst.count = 0; g.add(inst);
    const lab = chipSprite(1.25, 0.62); lab.position.set(0, 0.62, 1.12); g.add(lab);
    const halo = haloMesh(1.05); g.add(halo);
    g.add(pickBox(2.0, 1.4, 2.0, 0, 0.7, 0, 'prop'));
    const m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), sc = new T.Vector3(), ps = new T.Vector3();
    o.sync = (p, t) => {
      const color = PLACE_COL[clamp(p.of, 0, 4)];
      if (p.of !== o.of) { discM.color.set(color); ringM.color.set(color); o.of = p.of; o.label = null; }
      if (p.n > o.n) for (let i = o.n; i < p.n; i++) o.birth[i] = t + o.delay + (i - o.n) * 0.035;
      if (p.n !== o.n || p.label !== o.label) { o.n = p.n; o.label = p.label; setChip(lab, p.label || '', '×' + p.n, color); }
      o.lit = p.lit; o.delay = 0;
    };
    o.update = (t, dt) => {
      const S = Math.max(1, Math.ceil(o.n / 10)), want = S > 1 ? 1 : 0; o.spread = damp(o.spread, want, 6, dt);
      for (let i = 0; i < o.n; i++) {
        const st = Math.floor(i / 10), h = i % 10, col = st % 2, row = Math.floor(st / 2);
        const x = (col ? 1 : -1) * 0.34 * o.spread * (st === 0 && S === 1 ? 0 : 1) + (S === 1 ? 0 : 0), z = -row * 0.64 + 0.0;
        const k = easeBack((t - (o.birth[i] || 0)) / 0.32), s = t < (o.birth[i] || 0) ? 0.0001 : Math.max(0.0001, k);
        e.set(0, (i * 2.399) % 6.283, 0); q.setFromEuler(e); m4.compose(ps.set(x, 0.075 + h * 0.08 + (1 - Math.min(1, k)) * 0.5, z), q, sc.set(s, s, s)); inst.setMatrixAt(i, m4);
      }
      inst.count = o.n; inst.instanceMatrix.needsUpdate = true;
      halo.material.opacity = o.lit ? 0.55 + Math.sin(t * 5) * 0.3 : 0;
    };
    o.top = () => 0.2 + Math.min(10, o.n) * 0.08;
    return o;
  }

  function makePlate(kind) {
    const g = new T.Group(), o = { group: g, kind, radius: kind === 'caja' ? 1.1 : 0.95, n: 0, birth: [], delay: 0, lit: false };
    const A = cookieAssets(), inst = new T.InstancedMesh(A.geo, A.mats, 60); inst.castShadow = true; inst.count = 0; g.add(inst);
    if (kind === 'caja') {
      const wm = mat('#ffffff', { map: woodTex() }), w = 1.5;
      g.add(box(w, 0.06, w, wm, 0, 0.03, 0)); [[0, w / 2], [0, -w / 2]].forEach((p) => g.add(box(w + 0.1, 0.5, 0.06, wm, 0, 0.25, p[1]))); [[w / 2, 0], [-w / 2, 0]].forEach((p) => g.add(box(0.06, 0.5, w, wm, p[0], 0.25, 0)));
    } else {
      const prof = [[0, 0], [0.5, 0], [0.78, 0.07], [0.88, 0.13], [0.84, 0.14], [0.76, 0.09], [0, 0.07]].map((p) => new T.Vector2(p[0], p[1]));
      g.add(shade(new T.Mesh(new T.LatheGeometry(prof, 44), mat('#fff6ea', { roughness: 0.35, side: T.DoubleSide }))));
      g.add(put(torus(0.86, 0.018, mat('#F6C453', { metalness: 0.9, roughness: 0.3 }), 0, 0.135, 0), 0, 0.135, 0).rotateX(Math.PI / 2));
    }
    const chip = chipSprite(0.7, 0.45); chip.visible = false; g.add(chip);
    const halo = haloMesh(kind === 'caja' ? 1.1 : 0.95); g.add(halo);
    g.add(pickBox(kind === 'caja' ? 1.8 : 1.8, 1.0, kind === 'caja' ? 1.8 : 1.8, 0, 0.5, 0, 'prop'));
    const m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), sc = new T.Vector3(), ps = new T.Vector3();
    const base = kind === 'caja' ? 0.08 : 0.1;
    o.sync = (p, t) => {
      if (p.n > o.n) for (let i = o.n; i < p.n; i++) o.birth[i] = t + o.delay + (i - o.n) * 0.03;
      if (p.n !== o.n) { o.n = p.n; chip.visible = p.n > 0; if (p.n > 0) setChip(chip, String(p.n), '', '#F6C453'); }
      o.lit = p.lit; o.delay = 0;
    };
    o.update = (t) => {
      const per = kind === 'caja' ? 9 : 7; let topY = base;
      for (let i = 0; i < o.n; i++) {
        const layer = Math.floor(i / per), j = i % per; let x, z;
        if (kind === 'caja') { x = ((j % 3) - 1) * 0.42; z = (Math.floor(j / 3) - 1) * 0.42; } else if (j === 0) { x = 0; z = 0; } else { const a = ((j - 1) / 6) * 6.283 + layer * 0.55; x = Math.cos(a) * 0.43; z = Math.sin(a) * 0.43; }
        const y = base + layer * 0.062 + 0.03, k = easeBack((t - (o.birth[i] || 0)) / 0.3), s = t < (o.birth[i] || 0) ? 0.0001 : Math.max(0.0001, k);
        e.set(((i * 37) % 7) * 0.012, (i * 1.7) % 6.283, ((i * 53) % 7) * 0.012); q.setFromEuler(e); m4.compose(ps.set(x, y + (1 - Math.min(1, k)) * 0.6, z), q, sc.set(s, s, s)); inst.setMatrixAt(i, m4); topY = Math.max(topY, y);
      }
      inst.count = o.n; inst.instanceMatrix.needsUpdate = true; chip.position.set(0, topY + 0.65, 0);
      halo.material.opacity = o.lit ? 0.55 + Math.sin(t * 5) * 0.3 : 0;
    };
    o.top = () => 0.5;
    return o;
  }

  function makeCake() {
    const g = new T.Group(), o = { group: g, kind: 'tarta', radius: 1.2, n: 0, of: 0, tint: null, lit: false, slices: [], pop: [] };
    g.add(cyl(1.12, 1.18, 0.06, mat('#e9e4f2', { metalness: 0.5, roughness: 0.3 }), 0, 0.03, 0, 44));
    const slicesG = new T.Group(); g.add(slicesG);
    const plaque = chipSprite(1.0, 0.5); plaque.position.set(0, 0.45, 1.3); g.add(plaque);
    const halo = haloMesh(1.2); g.add(halo);
    g.add(pickBox(2.4, 1.0, 2.4, 0, 0.5, 0, 'prop'));
    const sponge = mat('#f3d9a4', { roughness: 0.85 });
    function build(of) {
      while (slicesG.children.length) { const c = slicesG.children.pop(); c.traverse((m) => { if (m.geometry) m.geometry.dispose(); }); }
      o.slices = []; o.pop = [];
      const d = (Math.PI * 2) / of;
      for (let i = 0; i < of; i++) {
        const top = mat('#fff3dc', { roughness: 0.55 });
        const sl = shade(new T.Mesh(new T.CylinderGeometry(1.0, 1.0, 0.45, 24, 1, false, Math.PI - (i + 1) * d + d * 0.015, d * 0.97), [sponge, top, sponge]));
        sl.position.y = 0.285; slicesG.add(sl);
        const mid = Math.PI - (i + 0.5) * d, ch = sph(0.1, mat('#e0263c', { roughness: 0.3 }), Math.sin(mid) * 0.62, 0.55, Math.cos(mid) * 0.62); ch.visible = false; slicesG.add(ch);
        o.slices.push({ mesh: sl, topM: top, cherry: ch, on: false, t0: -9 });
      }
    }
    o.sync = (p, t) => {
      if (p.of !== o.of) { o.of = p.of; build(Math.max(2, p.of)); o.n = 0; }
      const paint = tintHex(p.tint, '#FF7AA2');
      o.slices.forEach((s, i) => { const on = i < p.n; if (on !== s.on) { s.on = on; s.t0 = t; } s.topM.color.set(on ? paint : '#fff3dc'); s.cherry.visible = on; });
      if (p.n !== o.n || p.of !== o.fo) { o.n = p.n; o.fo = p.of; setChip(plaque, p.n + '/' + p.of, '', '#FF9CC8'); }
      o.lit = p.lit;
    };
    o.update = (t) => {
      o.slices.forEach((s) => { const k = clamp((t - s.t0) / 0.4, 0, 1), up = s.on ? Math.sin(k * Math.PI) * 0.14 : 0; s.mesh.position.y = 0.285 + up; s.cherry.position.y = 0.55 + up; });
      halo.material.opacity = o.lit ? 0.55 + Math.sin(t * 5) * 0.3 : 0;
    };
    o.top = () => 0.5;
    return o;
  }

  function makeSign() {
    const g = new T.Group(), o = { group: g, kind: 'cartel', radius: 1.6, label: null, tint: null, w: 0, lit: false };
    const gold = mat('#C9953A', { metalness: 0.8, roughness: 0.35 });
    const board = new T.Group(); g.add(board);
    const body = box(1, 0.95, 0.09, mat('#0d0a14', { roughness: 0.45, metalness: 0.2 }), 0, 1.5, 0); board.add(body);
    const frame = [box(1, 0.06, 0.12, gold, 0, 1.5 + 0.5, 0), box(1, 0.06, 0.12, gold, 0, 1.5 - 0.5, 0), box(0.06, 1.0, 0.12, gold, -0.5, 1.5, 0), box(0.06, 1.0, 0.12, gold, 0.5, 1.5, 0)]; frame.forEach((f) => board.add(f));
    const face = put(new T.Mesh(new T.PlaneGeometry(1, 0.8), new T.MeshBasicMaterial({ transparent: true, toneMapped: false })), 0, 1.5, 0.05); board.add(face);
    const posts = [cyl(0.06, 0.07, 1.3, gold, -0.4, 0.65, 0, 10), cyl(0.06, 0.07, 1.3, gold, 0.4, 0.65, 0, 10)]; posts.forEach((p) => g.add(p));
    board.rotation.x = -0.1;
    const halo = haloMesh(1.5); g.add(halo);
    const hit = pickBox(2, 1.9, 0.6, 0, 0.95, 0, 'prop'); g.add(hit);
    o.sync = (p) => {
      o.lit = p.lit;
      if (p.label === o.label && p.tint === o.tint) return; o.label = p.label; o.tint = p.tint;
      const text = p.label || '', color = tintHex(p.tint, '#F6C453'), w = clamp(1.4 + text.length * 0.2, 2.2, 5.4); o.w = w;
      body.scale.x = w; frame[0].scale.x = w; frame[1].scale.x = w; frame[2].position.x = -w / 2; frame[3].position.x = w / 2; posts[0].position.x = -w / 2 + 0.3; posts[1].position.x = w / 2 - 0.3; face.scale.x = w - 0.2; hit.scale.x = w / 2 + 0.3;
      const tx = canvasTex(1024, Math.round(1024 * 0.8 / (w - 0.2)), (c, W, H) => { let fs = H * 0.62; c.font = '800 ' + fs + 'px system-ui,Segoe UI,Arial,sans-serif'; while (c.measureText(text).width > W * 0.92 && fs > 20) { fs -= 4; c.font = '800 ' + fs + 'px system-ui,Segoe UI,Arial,sans-serif'; } c.textAlign = 'center'; c.textBaseline = 'middle'; c.shadowColor = color; c.shadowBlur = 18; c.fillStyle = color; c.fillText(text, W / 2, H / 2 + fs * 0.04); });
      if (face.material.map) face.material.map.dispose(); face.material.map = tx; face.material.needsUpdate = true; halo.scale.set(w / 2.6, 1, 0.5);
    };
    o.update = (t) => { halo.material.opacity = o.lit ? 0.55 + Math.sin(t * 5) * 0.3 : 0; };
    o.top = () => 2.0;
    return o;
  }

  function makeLight() {
    const g = new T.Group(), o = { group: g, kind: 'semaforo', radius: 0.8, n: 0, lit: false, label: null };
    const dark = mat('#14111d', { roughness: 0.4, metalness: 0.3 });
    g.add(cyl(0.06, 0.08, 2.0, dark, 0, 1.0, 0, 10)); g.add(box(0.62, 1.55, 0.44, dark, 0, 2.2, 0));
    const cols = [0xFF4D4D, 0xFFD23F, 0x4DE08A], lamps = [], sprs = [];
    cols.forEach((c, i) => { const m = new T.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0, roughness: 0.3 }); const l = sph(0.17, m, 0, 2.65 - i * 0.46, 0.2); g.add(l); lamps.push(m); const s = glowSprite(c, 1.5, 0); s.position.set(0, 2.65 - i * 0.46, 0.3); g.add(s); sprs.push(s); });
    const lab = chipSprite(1.0, 0.5); lab.position.set(0, 0.35, 0.85); lab.visible = false; g.add(lab);
    g.add(pickBox(1.0, 3.2, 1.0, 0, 1.6, 0, 'prop'));
    const halo = haloMesh(0.8); g.add(halo);
    o.sync = (p) => {
      o.n = p.n; o.lit = p.lit; lamps.forEach((m, i) => { m.emissiveIntensity = p.n === i + 1 ? 2.2 : 0.04; m.color.set(p.n === i + 1 ? cols[i] : 0x3a3340); m.emissive.set(cols[i]); }); sprs.forEach((s, i) => { s.material.opacity = p.n === i + 1 ? 0.95 : 0; });
      if (p.label !== o.label) { o.label = p.label; lab.visible = !!p.label; if (p.label) setChip(lab, p.label, '', '#F6C453'); }
    };
    o.update = (t) => { halo.material.opacity = o.lit ? 0.55 + Math.sin(t * 5) * 0.3 : 0; };
    o.top = () => 3.4;
    return o;
  }
  const MAKERS = { columna: makeColumn, plato: () => makePlate('plato'), caja: () => makePlate('caja'), tarta: makeCake, cartel: makeSign, semaforo: makeLight };

  /* ---------- efectos: chispas y confeti ---------- */
  function makeFx(scene) {
    const sprites = [], parts = [];
    for (let i = 0; i < 70; i++) { const s = glowSprite('#ffe9a0', 0.4, 1); s.visible = false; scene.add(s); sprites.push(s); parts.push({ life: 0, max: 1, v: new T.Vector3(), g: 0 }); }
    const N = 150, conf = new T.InstancedMesh(new T.PlaneGeometry(0.17, 0.1), new T.MeshBasicMaterial({ side: T.DoubleSide, toneMapped: false }), N); conf.frustumCulled = false; conf.count = N;
    const cs = [], m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), sc = new T.Vector3(), cc = new T.Color(), PAL = ['#F6C453', '#FF7AA2', '#4CC9C0', '#A78BFA', '#FF9F43', '#ffffff', '#7fe3c4'];
    for (let i = 0; i < N; i++) { cs.push({ p: new T.Vector3(0, -50, 0), v: new T.Vector3(), r: new T.Vector3(), w: new T.Vector3(), life: 0 }); m4.compose(cs[i].p, q.identity(), sc.set(0, 0, 0)); conf.setMatrixAt(i, m4); conf.setColorAt(i, cc.set(PAL[i % PAL.length])); }
    scene.add(conf);
    let cnext = 0;
    return {
      burst(x, y, z, n, color, spd) {
        let k = 0; for (let i = 0; i < sprites.length && k < n; i++) { const s = sprites[i], p = parts[i]; if (p.life > 0) continue; k++; s.visible = true; s.position.set(x, y, z); s.material.color.set(color || '#ffe9a0'); p.max = p.life = 0.7 + Math.random() * 0.6; const a = Math.random() * 6.283, u = Math.random() * 0.9 + 0.1; p.v.set(Math.cos(a) * u * (spd || 2.2), 1.2 + Math.random() * (spd || 2.2), Math.sin(a) * u * (spd || 2.2)); p.g = -3.2; p.size = 0.3 + Math.random() * 0.35; }
      },
      confetti(x, y, z, n) {
        for (let k = 0; k < (n || 70); k++) { const c = cs[cnext++ % N]; c.p.set(x + (Math.random() - 0.5) * 1.2, y + Math.random() * 0.6, z + (Math.random() - 0.5) * 1.2); c.v.set((Math.random() - 0.5) * 4.5, 3 + Math.random() * 4, (Math.random() - 0.5) * 4.5); c.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6); c.w.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12); c.life = 2.4 + Math.random() * 0.8; }
      },
      update(dt) {
        sprites.forEach((s, i) => { const p = parts[i]; if (p.life <= 0) return; p.life -= dt; if (p.life <= 0) { s.visible = false; return; } p.v.y += p.g * dt; s.position.addScaledVector(p.v, dt); const k = p.life / p.max; s.material.opacity = k; s.scale.setScalar(p.size * (0.4 + k)); });
        let any = false;
        for (let i = 0; i < N; i++) { const c = cs[i]; if (c.life > 0) { any = true; c.life -= dt; c.v.y -= 6 * dt; c.v.multiplyScalar(1 - dt * 0.6); c.p.addScaledVector(c.v, dt); c.r.addScaledVector(c.w, dt); if (c.p.y < DECK_Y) { c.p.y = DECK_Y; c.v.set(0, 0, 0); c.w.multiplyScalar(0.9); } const s = c.life < 0.4 ? Math.max(0, c.life / 0.4) : 1; e.set(c.r.x, c.r.y, c.r.z); q.setFromEuler(e); m4.compose(c.p, q, sc.set(s, s, s)); conf.setMatrixAt(i, m4); } else if (c.p.y > -40) { c.p.y = -50; m4.compose(c.p, q.identity(), sc.set(0, 0, 0)); conf.setMatrixAt(i, m4); any = true; } }
        if (any) conf.instanceMatrix.needsUpdate = true;
      }
    };
  }

  /* ---------- el escenario ---------- */
  const inst = {};
  let raf = 0, last = performance.now(), webgl = null;
  const supported = () => { if (webgl === null) { try { const c = document.createElement('canvas'); webgl = !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { webgl = false; } } return webgl; };

  function create(host, opts) {
    opts = opts || {};
    const renderer = new T.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    const maxPR = opts.maxPixelRatio || 2, small = Math.min(screen.width, screen.height) < 700;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92; renderer.outputColorSpace = T.SRGBColorSpace;
    const el = renderer.domElement; el.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline:none;-webkit-user-select:none;user-select:none';
    el.setAttribute('role', 'img'); el.setAttribute('aria-label', opts.label || 'Escenario 3D: puedes mover los objetos con el dedo');
    const wrap = document.createElement('div'); wrap.className = 'js3d-stage'; wrap.style.cssText = 'position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden'; wrap.appendChild(el);

    const scene = new T.Scene(); scene.fog = new T.Fog(0x3a2a55, 30, 78);
    const envScene = new T.Scene(); envScene.add(makeSky());
    const warm = new T.Mesh(new T.PlaneGeometry(40, 14), new T.MeshBasicMaterial({ color: new T.Color(0xffd9a0).multiplyScalar(5), side: T.DoubleSide })); warm.position.set(18, 14, 24); warm.lookAt(0, 0, 0); envScene.add(warm);
    const cool = new T.Mesh(new T.PlaneGeometry(40, 14), new T.MeshBasicMaterial({ color: new T.Color(0x9a8cff).multiplyScalar(2.2), side: T.DoubleSide })); cool.position.set(-24, 10, -18); cool.lookAt(0, 0, 0); envScene.add(cool);
    const pm = new T.PMREMGenerator(renderer); scene.environment = pm.fromScene(envScene, 0.04).texture; pm.dispose();
    envScene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });

    const sky = makeSky(), clouds = makeClouds(), island = makeIsland(); scene.add(sky, clouds, island);
    scene.add(new T.HemisphereLight(0xb9a8ff, 0x4a3a2a, 0.9));
    const sun = new T.DirectionalLight(0xffe2b8, 2.1); sun.position.set(7, 12, 9); sun.castShadow = true;
    sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048); const sc0 = sun.shadow.camera; sc0.left = -15; sc0.right = 15; sc0.top = 15; sc0.bottom = -15; sc0.near = 2; sc0.far = 48; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
    scene.add(sun, sun.target); const rim = new T.DirectionalLight(0x8f7cff, 1.0); rim.position.set(-9, 6, -10); scene.add(rim);
    const fx = makeFx(scene);

    const cam = new T.PerspectiveCamera(36, 1.4, 0.1, 300);
    const cb = {}; // callbacks del anfitrión
    const props = new Map(); const state = { scene: null, view: 'amplia', viewOverride: null, mode: 'escena', selected: null, wind: 0.3, furStyle: 'natural' };
    const wp = { home: null, homeKey: null, vehicle: null, vehKey: null, decor: new Map(), vehLap: null };
    const cre = { id: null, rig: null, rigs: {}, pos: [-4, 1.5], target: [-4, 1.5], pose: 'idle', point: null, yaw: 0, walk: 0, reactUntil: 0, reactPose: null, hop: 0, look: null, mood: null, moodUntil: 0, aspect: 'criatura', key: null };
    const FACE_COL = { lumi: '#FFD36A', bombo: '#59E4D4', musgo: '#F2A63B', nimbo: '#8EC8FF' };
    const view = { tx: 0, ty: 0.6, tz: 0, d: 18, yaw: 0, pitch: 0.5 }, goal = Object.assign({}, view), user = { yaw: 0, pitch: 0, zoom: 1 };
    const flights = []; let curHost = null, ro = null, tNow = 0, frames = 0, fpsAcc = 0, fps = 60, disposed = false, snapCam = true, drag = null, pinch = null;
    let furDetail = 1, slowSamples = 0, fastSamples = 0; // perf: 0.2-1 sin recomponer mallas
    const selRing = haloMesh(1.0); selRing.material.color.set(0xFFFFFF); scene.add(selRing);
    const pts = new Map();

    /* ----- cámara ----- */
    function propsBox(incl) {
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, n = 0;
      props.forEach((p) => { if (p.dying) return; x0 = Math.min(x0, p.pos[0] - 1); x1 = Math.max(x1, p.pos[0] + 1); z0 = Math.min(z0, p.pos[1] - 1); z1 = Math.max(z1, p.pos[1] + 1); n++; });
      if (!n) { x0 = -1; x1 = 1; z0 = -1; z1 = 1; }
      if (incl && cre.rig) { x0 = Math.min(x0, cre.target[0] - 1.2); x1 = Math.max(x1, cre.target[0] + 1.2); z0 = Math.min(z0, cre.target[1] - 1); z1 = Math.max(z1, cre.target[1] + 1); }
      return { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, w: x1 - x0, h: z1 - z0, n };
    }
    function computeGoal() {
      const asp = cam.aspect || 1.4, tf = Math.tan((cam.fov * Math.PI) / 360), k = state.viewOverride || state.view;
      let cx = 0.2, cz = 0.5, hw = 7.2, hh = 3.7, pitch = 0.52, ty = 0.5;
      if (k === 'mundo') { cx = -3.6; cz = -7.0; hw = 8.0; hh = 4.4; pitch = 0.42; ty = 1.7; }
      else if (k === 'mesa') { const b = propsBox(true); cx = b.cx; cz = b.cz + 0.3; hw = Math.max(4.4, b.w / 2 + 1.3); hh = Math.max(2.9, b.h * 0.5 + 1.9); pitch = 0.62; }
      else if (k === 'primer-plano') { const sel = props.get(state.selected) || props.get(cre.point) || null, b = propsBox(); cx = sel ? sel.pos[0] : b.cx; cz = sel ? sel.pos[1] : b.cz; hw = sel ? 2.8 : Math.max(3.0, b.w / 2 + 1.2); hh = sel ? 2.1 : 2.4; pitch = 0.78; }
      /* vertical (móvil): la vista amplia se estrecha; la de la mesa se ajusta al contenido (criatura incluida) con margen por la perspectiva */
      if (asp < 0.85) { if (k === 'amplia') { hw *= 0.74; pitch = 0.72; hh = 4.6; } else if (k === 'mesa') hw *= 1.12; else if (k === 'mundo') hw *= 0.9; else hw *= 0.8; }
      goal.tx = cx; goal.ty = ty; goal.tz = cz; goal.pitch = pitch; goal.yaw = 0; goal.d = Math.max(hw / (tf * asp), hh / tf);
    }
    function placeCamera(dt) {
      const k = snapCam ? 1 : 1 - Math.exp(-4.5 * dt);
      ['tx', 'ty', 'tz', 'd', 'yaw', 'pitch'].forEach((f) => { const g = f === 'yaw' ? goal.yaw + user.yaw : f === 'pitch' ? goal.pitch + user.pitch : f === 'd' ? goal.d * user.zoom : goal[f]; view[f] += (g - view[f]) * k; });
      snapCam = false;
      const cp = Math.cos(view.pitch), idle = Math.sin(tNow * 0.15) * 0.018;
      cam.position.set(view.tx + view.d * Math.sin(view.yaw + idle) * cp, view.ty + view.d * Math.sin(view.pitch), view.tz + view.d * Math.cos(view.yaw + idle) * cp);
      cam.lookAt(view.tx, view.ty, view.tz);
    }

    /* ----- criatura ----- */
    function setCreature(id, look) {
      if (!window.JanusCreatures3D) return;
      const key = cre.aspect === 'cara' && window.JanusFace3D ? id + '#cara' : id;
      if (id && (id !== cre.id || key !== cre.key)) {
        if (cre.rig) scene.remove(cre.rig.root);
        let rig = cre.rigs[key]; if (!rig) { rig = cre.rigs[key] = (key !== id ? window.JanusFace3D.build(id, FACE_COL[id]) : null) || (window.JanusCreatureSlot && window.JanusCreatureSlot.rigFor(id)) || window.JanusCreatures3D.build(id, '#FFD27A'); const hit = new T.Mesh(new T.CylinderGeometry(0.95, 0.95, 2.6, 10), new T.MeshBasicMaterial({ visible: false })); hit.position.y = 1.3; hit.userData.pickKind = 'creature'; rig.root.add(hit); }
        cre.id = id; cre.key = key; cre.rig = rig; if (rig.setDetail) rig.setDetail(furDetail); if (rig.setFurStyle) rig.setFurStyle(state.furStyle); scene.add(rig.root); rig.root.position.set(cre.pos[0], DECK_Y, cre.pos[1]); fx.burst(cre.pos[0], 1.4, cre.pos[1], 16, '#FFE9A0', 2.6);
      }
      if (look && cre.rig) { cre.look = look; cre.rig.setLook(look); }
    }
    function creatureTarget() { return state.mode === 'mundo' ? [-1.6, -4.4] : (state.scene ? state.scene.creature.at : [-4, 1.5]); }

    /* ----- mundo: casa, vehículo, decoración ----- */
    function popIn(g, t, s0) { g.userData.born = t; g.userData.s0 = s0 || 1; g.scale.setScalar(0.001); }
    function setWorld(w) {
      if (!w) return; const t = tNow;
      if (w.home && w.home !== wp.homeKey) { if (wp.home) scene.remove(wp.home); const h = buildHome(w.home); h.position.set(SPOTS.home[0], 0, SPOTS.home[1]); scene.add(h); popIn(h, t, S0.home); fx.burst(SPOTS.home[0], 2.4, SPOTS.home[1], 18, '#FFE9A0', 3); wp.home = h; wp.homeKey = w.home; }
      const vk = w.vehicle || null; if (vk !== wp.vehKey) { if (wp.vehicle) scene.remove(wp.vehicle); wp.vehLap = null; wp.vehicle = null; wp.vehKey = vk; if (vk) { const v = buildVehicle(vk); v.position.set(SPOTS.vehicle[0], 0, SPOTS.vehicle[1]); v.rotation.y = 0.5; v.userData.home = v.position.clone(); scene.add(v); popIn(v, t, S0.vehicle); fx.burst(SPOTS.vehicle[0], 1, SPOTS.vehicle[1], 14, '#9ad4ff', 2.6); wp.vehicle = v; } }
      const want = new Set(w.decor || []);
      wp.decor.forEach((g, k) => { if (!want.has(k)) { scene.remove(g); wp.decor.delete(k); } });
      want.forEach((k) => { if (wp.decor.has(k)) return; const sp = SPOTS.dec[k]; if (!sp) return; const g = buildDecor(k); g.position.set(sp[0], 0, sp[1]); g.userData.decorKey = k; scene.add(g); popIn(g, t, S0.decor); fx.burst(sp[0], 1.0, sp[1], 10, '#ffffff', 2.2); wp.decor.set(k, g); });
    }

    /* ----- escena (estado de scene-stage) ----- */
    function apply(st, events) {
      const t = tNow; state.scene = st; state.view = st.camera || 'amplia';
      (events || []).forEach((ev) => {
        if (ev.type === 'canje') {
          const a = props.get(ev.from), b = props.get(ev.to); if (!a || !b) return; b.o.delay = 0.78;
          const col = PLACE_COL[clamp(a.o.of, 0, 4)], n = Math.min(10, ev.times * 10 || 10);
          for (let i = 0; i < n; i++) flights.push({ from: [a.pos[0], DECK_Y + 0.5 + i * 0.05, a.pos[1]], to: [b.pos[0], DECK_Y + 0.5, b.pos[1]], t0: t + i * 0.045, dur: 0.62, color: ev.dir === 'subir' ? col : PLACE_COL[clamp(b.o.of, 0, 4)], mesh: null, done: false });
        }
      });
      const seen = new Set();
      st.props.forEach((p) => {
        seen.add(p.id); let e = props.get(p.id);
        if (!e) {
          const mk = MAKERS[p.kind]; if (!mk) return; const o = mk(), w = new T.Group(); w.add(o.group); w.userData.propId = p.id; w.position.set(p.at[0], DECK_Y, p.at[1]); w.scale.setScalar(0.001); scene.add(w);
          e = { o, w, pos: [p.at[0], p.at[1]], born: t, dying: 0, dragging: false, kind: p.kind }; props.set(p.id, e);
        }
        e.dying = 0; e.kind = p.kind; e.o.sync(p, t); if (!e.dragging) e.target = [p.at[0], p.at[1]];
      });
      props.forEach((e, id) => { if (!seen.has(id) && !e.dying) e.dying = t; });
      if (state.mode === 'escena') { cre.target = st.creature.at.slice(); }
      if (st.creature.pose === 'celebra' && cre.pose !== 'celebra') { fx.confetti(cre.pos[0], 2.4, cre.pos[1], 60); fx.burst(cre.pos[0], 2.2, cre.pos[1], 20, '#FFE9A0', 3.4); }
      cre.pose = st.creature.pose; cre.point = st.creature.point;
      computeGoal();
    }

    /* ----- interacción ----- */
    function ndcOf(ev) { const r = el.getBoundingClientRect(); return new T.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1); }
    const ray = new T.Raycaster(), plane = new T.Plane(new T.Vector3(0, 1, 0), -DECK_Y), tmp = new T.Vector3();
    function pick(ev) {
      ray.setFromCamera(ndcOf(ev), cam);
      const targets = []; props.forEach((e) => { if (!e.dying) targets.push(e.w); }); if (cre.rig) targets.push(cre.rig.root); if (wp.home) targets.push(wp.home); if (wp.vehicle) targets.push(wp.vehicle); wp.decor.forEach((g) => targets.push(g));
      const hits = ray.intersectObjects(targets, true);
      for (const h of hits) { let o = h.object; while (o) { if (o.userData.propId) return { t: 'prop', id: o.userData.propId }; if (cre.rig && o === cre.rig.root) return { t: 'creature' }; if (o === wp.home) return { t: 'home' }; if (o === wp.vehicle) return { t: 'vehicle' }; if (o.userData.decorKey) return { t: 'decor', id: o.userData.decorKey }; o = o.parent; } }
      return null;
    }
    function groundAt(ev) { ray.setFromCamera(ndcOf(ev), cam); return ray.ray.intersectPlane(plane, tmp) ? [tmp.x, tmp.z] : null; }
    const r2 = (v) => Math.round(v * 100) / 100;
    function select(id) { state.selected = id; if (state.viewOverride === null && (state.scene ? state.scene.camera : state.view) === 'primer-plano') computeGoal(); }
    function onDown(ev) {
      if (ev.button > 0 && ev.pointerType === 'mouse') return;
      try { el.setPointerCapture(ev.pointerId); } catch (e) { }
      pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (pts.size === 2) { const a = [...pts.values()]; pinch = { d0: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1, z0: user.zoom }; if (drag && drag.hit && drag.hit.t === 'prop') cancelDrag(); drag = null; return; }
      const hit = pick(ev); drag = { hit, sx: ev.clientX, sy: ev.clientY, moved: false, lx: ev.clientX, ly: ev.clientY, off: null };
      if (hit && hit.t === 'prop') { const e = props.get(hit.id), g = groundAt(ev); if (e && g) { drag.off = [e.pos[0] - g[0], e.pos[1] - g[1]]; } select(hit.id); }
    }
    function cancelDrag() { if (!drag || !drag.hit || drag.hit.t !== 'prop') return; const e = props.get(drag.hit.id); if (e) { e.dragging = false; if (state.scene) { const p = state.scene.props.find((q) => q.id === drag.hit.id); if (p) e.target = [p.at[0], p.at[1]]; } } }
    function onMove(ev) {
      if (pts.has(ev.pointerId)) pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (pinch && pts.size >= 2) { const a = [...pts.values()]; const d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1; user.zoom = clamp(pinch.z0 * (pinch.d0 / d), 0.55, 1.7); return; }
      if (!drag) { if (ev.pointerType === 'mouse') { const h = pick(ev); el.style.cursor = h ? (h.t === 'prop' ? 'grab' : 'pointer') : 'default'; } return; }
      const dx = ev.clientX - drag.sx, dy = ev.clientY - drag.sy;
      if (!drag.moved && Math.hypot(dx, dy) > 7) { drag.moved = true; if (drag.hit && drag.hit.t === 'prop' && drag.off) { const e = props.get(drag.hit.id); if (e) e.dragging = true; el.style.cursor = 'grabbing'; } }
      if (!drag.moved) return;
      if (drag.hit && drag.hit.t === 'prop' && drag.off) {
        const g = groundAt(ev), e = props.get(drag.hit.id); if (g && e) { e.target = [clamp(g[0] + drag.off[0], -STAGE.x, STAGE.x), clamp(g[1] + drag.off[1], -STAGE.z, STAGE.z)]; e.pos = e.target.slice(); }
      } else { user.yaw = clamp(user.yaw - (ev.clientX - drag.lx) * 0.006, -1.1, 1.1); user.pitch = clamp(user.pitch + (ev.clientY - drag.ly) * 0.004, -0.3, 0.55); }
      drag.lx = ev.clientX; drag.ly = ev.clientY;
    }
    function onUp(ev) {
      pts.delete(ev.pointerId); if (pinch && pts.size < 2) { pinch = null; drag = null; return; }
      if (!drag) return; const d = drag; drag = null; el.style.cursor = 'default';
      if (d.hit && d.hit.t === 'prop') {
        const e = props.get(d.hit.id);
        if (d.moved && e) { e.dragging = false; e.hop = tNow; fx.burst(e.pos[0], 0.4, e.pos[1], 6, '#ffe9a0', 1.6); if (cb.move) cb.move(d.hit.id, [r2(e.pos[0]), r2(e.pos[1])]); }
        else if (cb.tapProp) cb.tapProp(d.hit.id);
        return;
      }
      if (d.moved) return;
      const h = d.hit;
      if (!h) { if (cb.tapEmpty) cb.tapEmpty(); return; }
      if (h.t === 'creature') { cre.hop = tNow; cre.reactPose = 'saluda'; cre.reactUntil = tNow + 1.6; fx.burst(cre.pos[0], 2.2, cre.pos[1], 10, '#FFE9A0', 2.4); if (cb.tapCreature) cb.tapCreature(); }
      else if (h.t === 'home') { wp.home.userData.bounce = tNow; fx.burst(SPOTS.home[0], 3.0, SPOTS.home[1] + 1.5, 16, '#FF9CC8', 2.8); if (cb.tapHome) cb.tapHome(); }
      else if (h.t === 'vehicle') { driveLap(); if (cb.tapVehicle) cb.tapVehicle(); }
      else if (h.t === 'decor') { const g = wp.decor.get(h.id); if (g) g.userData.bounce = tNow; fx.burst(g.position.x, 1.0, g.position.z, 8, '#ffffff', 2); if (cb.tapDecor) cb.tapDecor(h.id); }
    }
    function onCancel(ev) { pts.delete(ev.pointerId); pinch = null; cancelDrag(); drag = null; }
    function onWheel(ev) { ev.preventDefault(); user.zoom = clamp(user.zoom * (1 + ev.deltaY * 0.0012), 0.55, 1.7); }
    el.addEventListener('pointerdown', onDown); el.addEventListener('pointermove', onMove); el.addEventListener('pointerup', onUp); el.addEventListener('pointercancel', onCancel); el.addEventListener('wheel', onWheel, { passive: false });

    function driveLap() {
      const v = wp.vehicle; if (!v || wp.vehLap) return;
      if (v.userData.rocket) { wp.vehLap = { t0: tNow, dur: 4.6, rocket: true }; fx.burst(v.position.x, 0.3, v.position.z, 24, '#FFB454', 3.4); return; }
      wp.vehLap = { t0: tNow, dur: 9, a: 8.4, b: 6.1, cx: 0, cz: -1, th0: Math.atan2((SPOTS.vehicle[1] + 1) / 6.1, SPOTS.vehicle[0] / 8.4) };
    }

    /* ----- bucle ----- */
    function tick(dt, t) {
      tNow = t;
      sky.userData.twinkle.material.opacity = 0.7 + Math.sin(t * 2.1) * 0.25;
      clouds.children.forEach((c) => { c.position.x += c.userData.v * dt; if (c.position.x > 90) c.position.x = -90; });
      const fl = island.userData.flies, base = fl.userData.base, arr = fl.geometry.attributes.position.array; for (let i = 0; i < 48; i++) { arr[i * 3] = base[i * 3] + Math.sin(t * 0.5 + i) * 0.7; arr[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 0.9 + i * 1.7) * 0.35; arr[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 0.4 + i * 2.1) * 0.7; } fl.geometry.attributes.position.needsUpdate = true;
      island.userData.lanterns.forEach((s, i) => { s.material.opacity = 0.7 + Math.sin(t * 2 + i) * 0.15; });
      // props
      props.forEach((e, id) => {
        if (e.dying) { const k = 1 - (t - e.dying) / 0.25; if (k <= 0) { scene.remove(e.w); props.delete(id); return; } e.w.scale.setScalar(Math.max(0.001, k)); }
        else { const s = easeBack((t - e.born) / 0.4); e.w.scale.setScalar(Math.max(0.001, s)); }
        if (!e.dragging && e.target) { e.pos[0] = damp(e.pos[0], e.target[0], 11, dt); e.pos[1] = damp(e.pos[1], e.target[1], 11, dt); }
        const lift = e.dragging ? 0.35 : Math.max(0, 1 - (t - (e.hop || -9)) / 0.35) * Math.sin(Math.min(1, (t - (e.hop || -9)) / 0.35) * Math.PI) * 0.0;
        e.w.position.set(e.pos[0], DECK_Y + lift + (e.dragging ? 0.3 : 0), e.pos[1]); e.o.update(t, dt);
      });
      const sel = props.get(state.selected);
      if (sel && !sel.dying) { selRing.visible = true; selRing.position.set(sel.pos[0], DECK_Y + 0.02, sel.pos[1]); const r = (sel.o.radius || 1) / 1.0; selRing.scale.set(r, r, r); selRing.material.opacity = 0.55 + Math.sin(t * 4) * 0.25; } else selRing.visible = false;
      // mundo
      [wp.home, wp.vehicle].concat([...wp.decor.values()]).forEach((g) => {
        if (!g) return; const s0 = g.userData.s0 || 1; if (g.userData.born != null) { const s = easeBack((t - g.userData.born) / 0.5); g.scale.setScalar(Math.max(0.001, s) * s0); if ((t - g.userData.born) / 0.5 >= 1) { g.userData.born = null; g.scale.setScalar(s0); } }
        if (g.userData.bounce != null) { const k = (t - g.userData.bounce) / 0.5; if (k >= 1) { g.userData.bounce = null; g.scale.setScalar(s0); } else { const s = 1 + Math.sin(k * Math.PI) * 0.1; g.scale.set(s * s0, (2 - s) * s0, s * s0); } }
        if (g.userData.float) g.userData.float.position.y = 1.0 + Math.sin(t * 1.2) * 0.12;
        if (g.userData.smoke) g.userData.smoke.forEach((s) => { const k = ((t * 0.4 + s.userData.i * 0.25) % 1); s.position.set(g.userData.smokeAt[0] + k * 0.5, g.userData.smokeAt[1] + k * 1.6, g.userData.smokeAt[2]); s.material.opacity = 0.35 * (1 - k); s.scale.setScalar(0.5 + k * 1.2); });
        if (g.userData.glow) g.userData.glow.material.opacity = 0.7 + Math.sin(t * 3) * 0.15;
        if (g.userData.flame) { g.userData.flame.scale.setScalar(1.2 + Math.sin(t * 22) * 0.18); g.userData.flame.material.opacity = wp.vehLap ? 1 : 0.35; }
      });
      const v = wp.vehicle, L = wp.vehLap;
      if (v && L) {
        const k = (t - L.t0) / L.dur;
        if (k >= 1) { wp.vehLap = null; v.position.set(SPOTS.vehicle[0], 0, SPOTS.vehicle[1]); v.rotation.y = 0.5; }
        else if (L.rocket) { const h = Math.sin(Math.min(1, k) * Math.PI) * 13; v.position.set(SPOTS.vehicle[0], h, SPOTS.vehicle[1]); v.rotation.y = 0.5 + k * 6; if (frames % 4 === 0) fx.burst(v.position.x, Math.max(0.2, h - 0.2), v.position.z, 2, '#FFB454', 1.2); }
        else { const th = L.th0 + k * Math.PI * 2, x = L.cx + L.a * Math.cos(th), z = L.cz + L.b * Math.sin(th), dx = -L.a * Math.sin(th), dz = L.b * Math.cos(th); v.position.set(x, 0, z); v.rotation.y = Math.atan2(-dz, dx); v.children.forEach((c) => { if (c.userData.wheel) c.rotation.z -= dt * 9; }); if (frames % 5 === 0) fx.burst(x - dx * 0.05, 0.2, z - dz * 0.05, 1, '#e8dcc8', 0.8); }
      }
      // criatura
      if (cre.rig) {
        cre.target = creatureTarget(); const dx = cre.target[0] - cre.pos[0], dz = cre.target[1] - cre.pos[1], dist = Math.hypot(dx, dz);
        let yawT = 0, walk = 0;
        if (dist > 0.06) { const step = Math.min(dist, 3.4 * dt); cre.pos[0] += (dx / dist) * step; cre.pos[1] += (dz / dist) * step; walk = 1; yawT = Math.atan2(dx, dz); }
        else {
          const pe = props.get(cre.point);
          if (cre.pose === 'senala' && pe) yawT = clamp(Math.atan2(pe.pos[0] - cre.pos[0], pe.pos[1] - cre.pos[1]), -1.2, 1.2) * 0.65;
          else if (state.mode === 'mundo') yawT = 0.2;
        }
        let dyaw = yawT - cre.yaw; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw)); cre.yaw += dyaw * (1 - Math.exp(-(walk ? 9 : 5) * dt));
        const react = t < cre.reactUntil, pose = react ? cre.reactPose : cre.pose;
        const hopY = Math.max(0, Math.sin(clamp((t - cre.hop) / 0.5, 0, 1) * Math.PI)) * 0.35;
        cre.rig.root.position.set(cre.pos[0], DECK_Y + hopY, cre.pos[1]); cre.rig.root.rotation.y = cre.yaw;
        cre.rig.update(t, dt, { pose, walk, excite: pose === 'celebra' ? 1 : 0, mood: t < cre.moodUntil ? cre.mood : null, camPos: cam.position, wind: Math.min(1, state.wind + (walk ? 0.18 : 0)), windYaw: cre.yaw });
      }
      // vuelos de fichas (canje)
      for (let i = flights.length - 1; i >= 0; i--) {
        const f = flights[i], k = (t - f.t0) / f.dur;
        if (k < 0) continue;
        if (!f.mesh) { DISC = DISC || new T.CylinderGeometry(0.27, 0.27, 0.075, 28); f.mesh = new T.Mesh(DISC, new T.MeshStandardMaterial({ color: f.color, metalness: 0.45, roughness: 0.3, emissive: f.color, emissiveIntensity: 0.35 })); scene.add(f.mesh); }
        if (k >= 1) { scene.remove(f.mesh); f.mesh.material.dispose(); fx.burst(f.to[0], f.to[1] < 0 ? 0.6 : 0.6, f.to[2], 3, f.color, 1.6); flights.splice(i, 1); continue; }
        const s = k * k * (3 - 2 * k); f.mesh.position.set(f.from[0] + (f.to[0] - f.from[0]) * s, f.from[1] + (f.to[1] - f.from[1]) * s + Math.sin(s * Math.PI) * 1.9, f.from[2] + (f.to[2] - f.from[2]) * s); f.mesh.rotation.x = s * 9; f.mesh.rotation.z = s * 5;
      }
      fx.update(dt); placeCamera(dt);
    }
    function visible() { return !disposed && el.isConnected && !document.hidden && el.clientWidth > 2 && el.clientHeight > 2; }
    function resize() {
      if (!curHost) return; const w = Math.max(2, curHost.clientWidth), h = Math.max(2, curHost.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPR)); renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); computeGoal();
    }

    const api = {
      el, supported: true,
      mount(h) {
        if (curHost === h && wrap.parentElement === h) return; curHost = h; if (getComputedStyle(h).position === 'static') h.style.position = 'relative';
        h.appendChild(wrap); if (ro) ro.disconnect(); if (window.ResizeObserver) { ro = new ResizeObserver(() => resize()); ro.observe(h); } resize();
      },
      setCreature, setLook(look) { if (cre.rig) { cre.look = look; cre.rig.setLook(look); } }, setWorld, apply,
      setWind(value) { if (Number.isFinite(value)) state.wind = Math.max(0, Math.min(1, value)); },
      setFurStyle(style) {
        const next = ['natural', 'corto', 'esponjoso', 'rebelde'].includes(style) ? style : 'natural';
        state.furStyle = next;
        if (cre.rig && cre.rig.setFurStyle) cre.rig.setFurStyle(next);
      },
      setView(v) { state.viewOverride = v || null; computeGoal(); },
      setMode(m) { state.mode = m === 'mundo' ? 'mundo' : 'escena'; state.viewOverride = state.mode === 'mundo' ? 'mundo' : null; computeGoal(); },
      select(id) { select(id); },
      on(c) { Object.assign(cb, c || {}); },
      react(pose, secs, mood) { cre.reactPose = pose || 'saluda'; cre.reactUntil = tNow + (secs || 1.6); if (mood) { const hasta = cre.reactUntil + 0.4; if (mood === cre.mood) cre.moodUntil = Math.max(cre.moodUntil, hasta); else { cre.mood = mood; cre.moodUntil = hasta; } } /* no acorta un ánimo elegido a propósito (setMood) con el de un gesto */ if (pose === 'celebra') { fx.confetti(cre.pos[0], 2.4, cre.pos[1], 70); } },
      /** Emoción de la cara durante `secs` segundos (alegre|contento|triste|enojado|sorprendido|pensativo). null = vuelve a contento. */
      setMood(mood, secs) { cre.mood = mood || null; cre.moodUntil = mood ? tNow + (secs || 5) : 0; },
      /** Vuelve a crear la criatura `id` (p. ej. al importar o quitar un modelo GLB en el módulo JanusCreatureSlot). */
      refreshRig(id) { const old = cre.rigs[id]; if (!old) return; if (cre.rig === old) scene.remove(old.root); delete cre.rigs[id]; if (cre.id === id) { cre.id = null; cre.key = null; setCreature(id, cre.look); } },
      /** Aspecto del compañero: 'criatura' (cuerpo 3D) o 'cara' (ojos y sonrisa flotantes, la cara del robot de Janus). */
      setAspect(a) { const n = a === 'cara' && window.JanusFace3D ? 'cara' : 'criatura'; if (n === cre.aspect) return; cre.aspect = n; if (cre.id) { const id = cre.id; setCreature(id, cre.look); } },
      aspect() { return cre.aspect; },
      celebrate() { fx.confetti(0, 5, 0, 110); fx.burst(cre.pos[0], 2.2, cre.pos[1], 24, '#FFE9A0', 3.6); cre.hop = tNow; cre.reactPose = 'celebra'; cre.reactUntil = tNow + 2.4; },
      sparkle(x, z, color) { fx.burst(x, 1.0, z, 14, color || '#FFE9A0', 2.6); },
      resetView() { user.yaw = 0; user.pitch = 0; user.zoom = 1; },
      resize,
      screenOf(what) {
        let p = null; const e = props.get(what);
        if (e) p = new T.Vector3(e.pos[0], DECK_Y + 0.5, e.pos[1]); else if (what === 'creature' && cre.rig) p = new T.Vector3(cre.pos[0], 1.3, cre.pos[1]); else if (what === 'home') p = new T.Vector3(SPOTS.home[0], 1.8, SPOTS.home[1]); else if (what === 'vehicle' && wp.vehicle) p = wp.vehicle.position.clone().setY(0.7);
        if (!p) return null; p.project(cam); const r = el.getBoundingClientRect(); return { x: r.left + (p.x * 0.5 + 0.5) * r.width, y: r.top + (-p.y * 0.5 + 0.5) * r.height, onScreen: p.z < 1 && Math.abs(p.x) < 1 && Math.abs(p.y) < 1 };
      },
      propIds() { return [...props.keys()]; },
      worldInfo() { return { home: wp.homeKey, vehicle: wp.vehKey, decor: [...wp.decor.keys()] }; },
      stats() { return { fps: Math.round(fps), calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, props: props.size, furDetailRatio: +furDetail.toFixed(2), creature: cre.id, kind: cre.rig ? (cre.rig.glb ? 'glb' : cre.rig.face === true ? 'cara' : 'procedural') : null, mood: cre.rig && cre.rig.face === true ? cre.rig.mood : undefined, view: state.viewOverride || state.view, mode: state.mode, camera: { d: +view.d.toFixed(2), yaw: +view.yaw.toFixed(2), pitch: +view.pitch.toFixed(2) }, size: [el.width, el.height] }; },
      _tick: tick, _visible: visible,
      _render() { renderer.render(scene, cam); frames++; },
      dispose() { disposed = true; if (ro) ro.disconnect(); renderer.dispose(); if (wrap.parentElement) wrap.parentElement.removeChild(wrap); }
    };
    api._frame = (dt, t) => {
      tick(dt, t); renderer.render(scene, cam); frames++; fpsAcc += dt;
      if (fpsAcc > 0.5) {
        fps = frames / fpsAcc; frames = 0; fpsAcc = 0;
        // Cambiar solo el numero de hebras instanciadas (no el rig, ropa, contexto ni malla base).
        // Histeresis evita oscilacion de calidad por picos de carga o cambios de pestana.
        const rig = cre.rig;
        if (rig && rig.setDetail) {
          if (fps < 24) { slowSamples++; fastSamples = 0; }
          else if (fps > 48) { fastSamples++; slowSamples = 0; }
          else { slowSamples = 0; fastSamples = 0; }
          let next = furDetail;
          if (slowSamples >= 4) { next = Math.max(0.2, furDetail - 0.2); slowSamples = 0; }
          if (fastSamples >= 12) { next = Math.min(1, furDetail + 0.1); fastSamples = 0; }
          if (next !== furDetail) { furDetail = next; rig.setDetail(furDetail); }
        }
      }
    };
    if (host) api.mount(host);
    computeGoal(); snapCam = true;
    return api;
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    Object.keys(inst).forEach((k) => { const s = inst[k]; if (s._visible()) s._frame(dt, now / 1000); });
  }
  function hydrate(root) {
    (root || document).querySelectorAll('[data-stage3d]').forEach((host) => {
      const id = host.getAttribute('data-id') || 'stage'; let s = inst[id];
      if (!s) { try { s = inst[id] = create(null, { label: host.getAttribute('aria-label') || undefined }); } catch (e) { host.classList.add('j3d-off'); return; } }
      s.mount(host);
    });
    if (!raf) raf = requestAnimationFrame(frame);
  }
  return { supported, create, hydrate, get: (id) => inst[id] || null, _inst: inst, TINTS, PLACE_COL, SPOTS };
})();
window.JanusStage3D = JanusStage3D;
