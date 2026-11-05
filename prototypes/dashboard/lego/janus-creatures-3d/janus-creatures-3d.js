'use strict';
/* ===== LEGO janus-creatures-3d v1.0 · criaturas procedurales =====
 * Cuatro criaturas originales de InfinitySeed (Lumi, Bombo, Musgo, Nimbo) construidas con geometría de three.js r160.
 * Cada una tiene su propio movimiento (revolotea / rebota / guiña / flota) que NO cambia al vestirla.
 * Aspecto: pelo, detalles, ojos, prenda y accesorios (catálogo cerrado; los ids los valida el módulo `companion`).
 * API:  const c = JanusCreatures3D.build('lumi', glowHex);  c.setLook(look);  c.update(t, dt, ctl);  c.root (THREE.Group)
 *   look = { fur, accent, eyes, outfitColor, accessoryColor: '#rrggbb', outfit: 'camiseta'…, accessories: { cabeza, cara, cuello, espalda } }
 *   ctl  = { pose: idle|habla|piensa|celebra|senala|saluda, walk: 0..1, excite: 0..1, pointYaw: rad|null,
 *            mood: alegre|contento|triste|enojado|sorprendido|pensativo (opcional; por defecto contento) }
 */
const JanusCreatures3D = (() => {
  const T = window.THREE; if (!T) return null;
  const col = (h) => new T.Color(h);
  const std = (hex, o) => new T.MeshPhysicalMaterial(Object.assign({ color: hex, roughness: 0.8, metalness: 0, envMapIntensity: 0.9 }, o || {}));
  const plush = (hex) => std(hex, { sheen: 0.9, sheenRoughness: 0.45, sheenColor: col(hex).lerp(col(0xffffff), 0.55) });
  const shiny = (hex, o) => std(hex, Object.assign({ roughness: 0.28, metalness: 0.5, clearcoat: 0.6, clearcoatRoughness: 0.12 }, o || {}));
  const glowM = (hex) => new T.MeshBasicMaterial({ color: hex, toneMapped: false });
  const cast = (m) => { m.castShadow = true; m.receiveShadow = false; return m; };
  const ell = (r, sx, sy, sz, mat, w = 28, h = 20) => { const o = cast(new T.Mesh(new T.SphereGeometry(r, w, h), mat)); o.scale.set(sx, sy, sz); return o; };
  const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };
  const grp = (...kids) => { const g = new T.Group(); kids.forEach((k) => g.add(k)); return g; };
  const lerpA = (a, b, k) => a + (b - a) * k;
  const damp = (cur, target, k, dt) => cur + (target - cur) * (1 - Math.exp(-k * dt));

  function starShape(outer, inner, pts) {
    const s = new T.Shape(), n = pts || 5;
    for (let i = 0; i < n * 2; i++) { const r = i % 2 ? inner : outer, a = Math.PI / 2 + (i * Math.PI) / n; const x = Math.cos(a) * r, y = Math.sin(a) * r; if (!i) s.moveTo(x, y); else s.lineTo(x, y); }
    s.closePath(); return s;
  }
  const starGeo = (outer, inner, depth) => new T.ExtrudeGeometry(starShape(outer, inner), { depth, bevelEnabled: true, bevelSize: depth * 0.25, bevelThickness: depth * 0.25, bevelSegments: 1 });

  function wingTexture() {
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128; const g = cv.getContext('2d');
    const gr = g.createRadialGradient(40, 64, 4, 56, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(0.55, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(52, 64, 52, 40, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 1.5; for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(4, 64); g.quadraticCurveTo(40, 64 + i * 8, 100, 64 + i * 14); g.stroke(); }
    const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; return t;
  }

  /* ---------- cara: ojos, boca y mofletes ---------- */
  function faceKit(head, o, M) {
    const eyes = [];
    [-1, 1].forEach((s) => {
      const eg = new T.Group(); eg.position.set(s * o.ex, o.ey, o.ez); eg.rotation.y = s * (o.spread || 0.18); head.add(eg);
      eg.add(at(ell(o.er, 1, 1.12, 0.5, M.white, 20, 14), 0, 0, 0));
      eg.add(at(ell(o.er * 0.74, 1, 1.1, 0.4, M.iris, 20, 14), 0, -o.er * 0.04, o.er * 0.26));
      eg.add(at(ell(o.er * 0.4, 1, 1.1, 0.4, M.dark, 16, 12), 0, -o.er * 0.04, o.er * 0.4));
      eg.add(at(ell(o.er * 0.18, 1, 1, 0.5, M.hi, 10, 8), o.er * 0.22, o.er * 0.3, o.er * 0.5));
      eg.add(at(ell(o.er * 0.1, 1, 1, 0.5, M.hi, 8, 6), -o.er * 0.2, -o.er * 0.22, o.er * 0.48));
      eyes.push(eg);
    });
    const smile = new T.Mesh(new T.TorusGeometry(o.mw, o.mt || 0.03, 8, 28, Math.PI), M.dark); smile.rotation.z = Math.PI; smile.position.set(0, o.my, o.mz); head.add(smile);
    const mouth = ell(o.mw * 0.78, 1, 0.1, 0.12, M.mouth, 18, 12); mouth.position.set(0, o.my - o.mw * 0.34, o.mz - 0.004); mouth.scale.y = 0.001; head.add(mouth);
    const tongue = ell(o.mw * 0.4, 1, 0.5, 0.2, M.tongue, 12, 8); tongue.position.set(0, o.my - o.mw * 0.6, o.mz + 0.002); tongue.visible = false; head.add(tongue);
    const cheeks = [-1, 1].map((s) => { const c = new T.Mesh(new T.CircleGeometry(o.er * 0.8, 20), M.blush); c.position.set(s * (o.ex + o.er * 0.9), o.my + o.er * 0.1, o.ez - 0.03); c.rotation.y = s * 0.55; head.add(c); return c; });
    // expresiones: cejas (aparecen solo cuando la emoción las pide) y boca de pena/enfado (arco invertido)
    const brows = [-1, 1].map((s) => {
      const b = new T.Mesh(new T.CapsuleGeometry(o.er * 0.11, o.er * 1.05, 4, 8), M.dark); b.rotation.z = Math.PI / 2;
      const bg = new T.Group(); bg.position.set(s * o.ex, o.ey + o.er * 1.5, o.ez + o.er * 0.1); bg.rotation.y = s * (o.spread || 0.18); bg.scale.set(1, 0.001, 1);
      bg.userData = { s, y0: o.ey + o.er * 1.5, er: o.er }; bg.add(b); head.add(bg); return bg;
    });
    const frown = new T.Mesh(new T.TorusGeometry(o.mw * 0.9, o.mt || 0.03, 8, 28, Math.PI), M.dark); frown.position.set(0, o.my - o.mw * 0.55, o.mz); frown.visible = false; head.add(frown);
    return { eyes, smile, mouth, tongue, cheeks, brows, frown, mouthW: o.mw, mouthY: o.my, mood: null };
  }

  /* Emociones: alegre · contento · triste · enojado · sorprendido · pensativo. Solo cambian la cara, nunca el carácter.
     eyeY/eyeS: alto/tamaño del ojo · brow: ceja visible · browA: inclinación (+ enfado, − pena) · browY: altura de la ceja (× radio del ojo)
     smile/frown: arco visible · smW/smH, fW/fH: tamaño del arco · open/openW: boca abierta (alto/ancho) · blush: opacidad de los mofletes */
  const MOODS = {
    contento: { eyeY: 1, eyeS: 1, brow: 0, browA: 0, browY: 0, smile: 1, smW: 1, smH: 1, frown: 0, fW: 1, fH: 1, open: 0, openW: 1, blush: 0.42 },
    alegre: { eyeY: 0.78, eyeS: 1, brow: 1, browA: 0, browY: 0.25, smile: 1, smW: 1.32, smH: 1.7, frown: 0, fW: 1, fH: 1, open: 0.2, openW: 1.15, blush: 0.75 },
    triste: { eyeY: 0.86, eyeS: 1, brow: 1, browA: -0.42, browY: 0.1, smile: 0, smW: 1, smH: 1, frown: 1, fW: 0.78, fH: 0.8, open: 0, openW: 1, blush: 0.12 },
    enojado: { eyeY: 0.68, eyeS: 1, brow: 1, browA: 0.5, browY: -0.1, smile: 0, smW: 1, smH: 1, frown: 1, fW: 0.85, fH: 0.5, open: 0, openW: 1, blush: 0.08 },
    sorprendido: { eyeY: 1.12, eyeS: 1.18, brow: 1, browA: 0, browY: 0.55, smile: 0, smW: 1, smH: 1, frown: 0, fW: 1, fH: 1, open: 0.9, openW: 0.5, blush: 0.42 },
    pensativo: { eyeY: 1, eyeS: 1, brow: 1, browA: -0.16, browY: 0.2, smile: 1, smW: 0.6, smH: 0.8, frown: 0, fW: 1, fH: 1, open: 0, openW: 1, blush: 0.3 }
  };
  const MOOD_IDS = Object.keys(MOODS);

  function armKit(sx, x, y, z, len, r, mat, handMat) {
    const sh = new T.Group(); sh.position.set(x, y, z);
    sh.add(at(cast(new T.Mesh(new T.CapsuleGeometry(r, len, 8, 14), mat)), 0, -len / 2 - r * 0.4, 0));
    sh.add(at(ell(r * 1.3, 1, 1, 1, handMat || mat, 16, 12), 0, -len - r * 0.9, 0));
    sh.userData.sx = sx; return sh;
  }
  const footKit = (x, y, z, r, mat) => at(ell(r, 1.1, 0.55, 1.45, mat, 16, 12), x, y, z);

  /* ---------- catálogo de prendas y accesorios (construidos en tamaño unidad) ---------- */
  function shellBand(r, sx, sy, sz, t0, t1, mat) {
    const g = new T.SphereGeometry(r, 36, 18, 0, Math.PI * 2, t0, t1 - t0); g.scale(sx, sy, sz);
    const m = cast(new T.Mesh(g, mat)); m.material.side = T.DoubleSide; return m;
  }
  function outfitMesh(id, B, mat, acc) {
    const g = new T.Group(); if (id === 'ninguna') return g;
    const { r, sx, sy, sz } = B; // elipsoide del torso (en coordenadas del cuerpo)
    const k = 1.045, cut = B.cut || 0, flare = B.flare || 1.65; // cut: ángulo polar desde el que empieza la prenda (la cara queda libre)
    const sb = (rr, t0, t1) => shellBand(rr, sx, sy, sz, Math.max(t0, cut), Math.max(t1, cut + 0.12), mat);
    if (id === 'camiseta') {
      g.add(sb(r * k, 0.55, 2.35));
      if (!cut) g.add(at(cast(new T.Mesh(new T.TorusGeometry(r * 0.46 * sx, r * 0.04, 8, 28), mat)), 0, r * sy * 0.73, 0)).children[1].rotation.x = Math.PI / 2;
    } else if (id === 'jersey') {
      g.add(sb(r * 1.07, 0.45, 2.5));
      if (!cut) { const c1 = cast(new T.Mesh(new T.TorusGeometry(r * 0.52 * sx, r * 0.1, 10, 28), mat)); c1.rotation.x = Math.PI / 2; c1.position.y = r * sy * 0.8; g.add(c1); }
      const c2 = cast(new T.Mesh(new T.TorusGeometry(r * 0.84 * sx, r * 0.07, 8, 32), acc)); c2.rotation.x = Math.PI / 2; c2.position.y = -r * sy * 0.55; g.add(c2);
      if (!cut) { const c3 = cast(new T.Mesh(new T.TorusGeometry(r * 0.99 * sx, r * 0.05, 8, 32), acc)); c3.rotation.x = Math.PI / 2; c3.position.y = r * sy * 0.1; g.add(c3); }
    } else if (id === 'vestido') {
      g.add(sb(r * k, 0.55, 1.9));
      const sk = cast(new T.Mesh(new T.CylinderGeometry(r * 0.95 * sx, r * flare * sx, r * sy * 0.8, 32, 1, true), mat)); sk.material.side = T.DoubleSide; sk.position.y = -r * sy * 0.42; sk.scale.z = sz / sx; g.add(sk);
      const hem = cast(new T.Mesh(new T.TorusGeometry(r * flare * sx, r * 0.045, 8, 36), acc)); hem.rotation.x = Math.PI / 2; hem.position.y = -r * sy * 0.82; hem.scale.y = sz / sx; g.add(hem);
    } else if (id === 'peto') {
      g.add(sb(r * 1.05, 1.25, 2.75));
      if (!cut) {
      const bib = cast(new T.Mesh(new T.CylinderGeometry(r * 0.46 * sx, r * 0.56 * sx, r * sy * 0.62, 20, 1, true, -Math.PI * 0.32, Math.PI * 0.64), mat)); bib.material.side = T.DoubleSide; bib.rotation.y = 0; bib.position.set(0, r * sy * 0.12, r * sz * 0.2); bib.scale.z = sz / sx * 1.05; g.add(bib);
      [-1, 1].forEach((s) => { const st = cast(new T.Mesh(new T.BoxGeometry(r * 0.1, r * sy * 0.8, r * 0.05), mat)); st.position.set(s * r * sx * 0.38, r * sy * 0.45, r * sz * 0.64); st.rotation.z = s * -0.18; st.rotation.x = -0.3; g.add(st); const bt = at(ell(r * 0.075, 1, 1, 0.7, acc, 12, 8), s * r * sx * 0.4, r * sy * 0.13, r * sz * 0.9); g.add(bt); });
      }
    } else if (id === 'capa') {
      const cp = cast(new T.Mesh(new T.CylinderGeometry(r * 0.92 * sx, r * 1.5 * sx, r * sy * 2.05, 32, 1, true, Math.PI * 0.62, Math.PI * 0.76 + 0.9), mat)); cp.material.side = T.DoubleSide; cp.position.set(0, -r * sy * 0.1, -r * sz * 0.1); cp.scale.z = sz / sx; g.add(cp);
      if (!cut) { const cl = cast(new T.Mesh(new T.TorusGeometry(r * 0.56 * sx, r * 0.085, 10, 28), mat)); cl.rotation.x = Math.PI / 2; cl.position.y = r * sy * 0.78; g.add(cl);
      g.add(at(ell(r * 0.11, 1, 1, 1, acc, 14, 10), 0, r * sy * 0.74, r * sz * 0.52)); }
    }
    return g;
  }

  function accessoryMesh(slot, id, mat, M) {
    const g = new T.Group(), A = mat, dark = M.dark;
    const ring = (R, tube, m, ax) => { const t = cast(new T.Mesh(new T.TorusGeometry(R, tube, 10, 36), m || A)); if (ax === 'x') t.rotation.x = Math.PI / 2; return t; };
    if (slot === 'cabeza') {
      if (id === 'gorro') {
        const cap = cast(new T.Mesh(new T.SphereGeometry(1.06, 32, 16, 0, Math.PI * 2, 0, 1.12), A)); cap.position.y = -1; g.add(cap);
        const br = ring(0.96, 0.13, A, 'x'); br.position.y = -1 + Math.cos(1.1) * 1.06 - 0.02; g.add(br);
        g.add(at(ell(0.2, 1, 1, 1, M.white, 16, 12), 0, 0.12, 0));
      } else if (id === 'corona') {
        const band = cast(new T.Mesh(new T.CylinderGeometry(0.62, 0.7, 0.3, 28, 1, true), shiny(0xffffff, { color: A.color }))); band.material.side = T.DoubleSide; band.position.y = -0.12; g.add(band);
        for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2, c = cast(new T.Mesh(new T.ConeGeometry(0.13, 0.4, 10), band.material)); c.position.set(Math.cos(a) * 0.66, 0.2, Math.sin(a) * 0.66); g.add(c); g.add(at(ell(0.07, 1, 1, 1, M.gem, 10, 8), Math.cos(a) * 0.66, 0.43, Math.sin(a) * 0.66)); }
      } else if (id === 'lazo') {
        const b = new T.Group(); [-1, 1].forEach((s) => { const c = cast(new T.Mesh(new T.ConeGeometry(0.32, 0.55, 14), A)); c.rotation.z = s * -Math.PI / 2; c.position.x = s * 0.27; b.add(c); }); b.add(at(ell(0.15, 1, 1, 0.9, A, 14, 10), 0, 0, 0)); b.position.set(0.5, -0.12, 0.38); b.rotation.set(0.25, -0.5, -0.45); g.add(b);
      } else if (id === 'copa') {
        const h = cast(new T.Mesh(new T.CylinderGeometry(0.5, 0.54, 0.8, 28), shiny(0x15121a))); h.position.y = 0.34; g.add(h);
        const br = cast(new T.Mesh(new T.CylinderGeometry(0.9, 0.9, 0.07, 32), h.material)); br.position.y = -0.04; g.add(br);
        const bn = ring(0.53, 0.07, A, 'x'); bn.position.y = 0.0; g.add(bn);
      } else if (id === 'flor') {
        const f = new T.Group(); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; f.add(at(ell(0.17, 1, 1.5, 0.45, A, 12, 8), Math.cos(a) * 0.22, Math.sin(a) * 0.22, 0)).children[i].rotation.z = a - Math.PI / 2; } f.add(at(ell(0.12, 1, 1, 0.8, shiny(0xFFD54A), 12, 8), 0, 0, 0.05)); f.position.set(0.52, -0.2, 0.5); f.rotation.set(0.1, 0.5, 0.2); g.add(f);
      } else if (id === 'diadema') {
        const band = cast(new T.Mesh(new T.TorusGeometry(1.03, 0.045, 8, 48, Math.PI), A)); band.position.set(0, -1, 0); band.rotation.set(0, 0, 0); g.add(band);
        const st = cast(new T.Mesh(starGeo(0.26, 0.11, 0.07), A)); st.position.set(0, 0.0, 0.0); st.rotation.x = 0; st.position.z = -0.04; g.add(st);
      }
    } else if (slot === 'cara') {
      if (id === 'gafas-redondas' || id === 'gafas-sol') {
        const sun = id === 'gafas-sol', lens = new T.MeshPhysicalMaterial({ color: sun ? 0x0a0a10 : 0xcfe8ff, roughness: 0.05, metalness: sun ? 0.6 : 0, transparent: !sun, opacity: sun ? 1 : 0.18, clearcoat: 1 });
        [-1, 1].forEach((s) => { const l = ell(0.31, 1, 1, 0.12, lens, 24, 14); l.position.set(s * 0.34, 0, 0.0); g.add(l); const rim = ring(0.31, 0.035, sun ? shiny(0x111111) : A); rim.position.set(s * 0.34, 0, 0.02); g.add(rim); const arm = cast(new T.Mesh(new T.CylinderGeometry(0.022, 0.022, 0.8, 8), sun ? rim.material : A)); arm.rotation.x = Math.PI / 2; arm.position.set(s * 0.66, 0, -0.4); g.add(arm); });
        const br = ring(0.09, 0.028, sun ? shiny(0x111111) : A); br.position.set(0, 0.05, 0.02); g.add(br);
      } else if (id === 'gafas-estrella') {
        const lens = new T.MeshPhysicalMaterial({ color: 0xff9ad0, roughness: 0.1, transparent: true, opacity: 0.45 });
        [-1, 1].forEach((s) => { const f = cast(new T.Mesh(starGeo(0.36, 0.17, 0.05), A)); f.position.set(s * 0.36, 0.0, 0.01); g.add(f); const l = new T.Mesh(new T.ShapeGeometry(starShape(0.3, 0.14)), lens); l.position.set(s * 0.36, 0, 0.09); g.add(l); const arm = cast(new T.Mesh(new T.CylinderGeometry(0.022, 0.022, 0.8, 8), A)); arm.rotation.x = Math.PI / 2; arm.position.set(s * 0.7, 0, -0.4); g.add(arm); });
      } else if (id === 'antifaz') {
        [-1, 1].forEach((s) => { const m = cast(new T.Mesh(new T.TorusGeometry(0.27, 0.12, 10, 28), A)); m.scale.set(1, 0.9, 0.5); m.position.set(s * 0.34, 0, 0.02); g.add(m); });
        const br = ell(0.2, 1, 0.45, 0.35, A, 14, 10); br.position.set(0, 0.04, 0.02); g.add(br);
        const band = cast(new T.Mesh(new T.TorusGeometry(0.98, 0.04, 6, 36, Math.PI * 1.1), A)); band.position.set(0, 0, -0.6); band.rotation.set(Math.PI / 2, 0, Math.PI * 0.95); band.scale.set(0.6, 0.6, 1); /* cinta invisible tras la cabeza */ band.visible = false; g.add(band);
      }
    } else if (slot === 'cuello') {
      if (id === 'bufanda') {
        const t = ring(0.62, 0.17, A, 'x'); t.scale.set(1, 1, 0.8); g.add(t);
        const tail = cast(new T.Mesh(new T.BoxGeometry(0.28, 0.75, 0.1), A)); tail.position.set(0.28, -0.42, 0.55); tail.rotation.set(0.1, 0, -0.12); g.add(tail);
        const st = cast(new T.Mesh(new T.BoxGeometry(0.285, 0.1, 0.105), M.white)); st.position.set(0.3, -0.42, 0.555); st.rotation.copy(tail.rotation); g.add(st);
      } else if (id === 'pajarita') {
        [-1, 1].forEach((s) => { const c = cast(new T.Mesh(new T.ConeGeometry(0.3, 0.5, 14), A)); c.rotation.z = s * -Math.PI / 2; c.position.set(s * 0.26, 0, 0.58); g.add(c); }); g.add(at(ell(0.14, 1, 1, 0.9, A, 14, 10), 0, 0, 0.58));
      } else if (id === 'perlas') {
        const pm = shiny(0xfff6ea, { metalness: 0.1, roughness: 0.2 });
        for (let i = 0; i < 13; i++) { const a = -Math.PI * 0.5 + (i / 12) * Math.PI, x = Math.sin(a) * 0.64, z = Math.cos(a) * 0.64 * 0.85 + 0.0, y = -Math.sin((i / 12) * Math.PI) * 0.16; g.add(at(ell(0.075, 1, 1, 1, pm, 12, 8), x, y, Math.max(0.05, z))); }
      } else if (id === 'medalla') {
        const rb = ring(0.6, 0.04, A, 'x'); g.add(rb);
        const m = cast(new T.Mesh(new T.CylinderGeometry(0.2, 0.2, 0.06, 28), shiny(0xFFD25A))); m.rotation.x = Math.PI / 2; m.position.set(0, -0.42, 0.56); g.add(m);
        const st = cast(new T.Mesh(starGeo(0.12, 0.055, 0.03), A)); st.position.set(0, -0.42, 0.6); g.add(st);
      }
    } else if (slot === 'espalda') {
      if (id === 'mochila') {
        const bag = ell(0.5, 1, 1.15, 0.6, A, 24, 16); bag.position.set(0, -0.1, -0.2); g.add(bag);
        const pk = ell(0.3, 1, 0.8, 0.5, A, 20, 12); pk.position.set(0, -0.3, -0.52); g.add(pk);
        const h = cast(new T.Mesh(new T.TorusGeometry(0.16, 0.035, 8, 20, Math.PI), M.white)); h.position.set(0, 0.52, -0.2); g.add(h);
        [-1, 1].forEach((s) => { const st = cast(new T.Mesh(new T.TorusGeometry(0.62, 0.04, 6, 24, Math.PI * 0.55), M.white)); st.position.set(s * 0.26, 0.2, 0.0); st.rotation.set(Math.PI / 2, 0, s > 0 ? Math.PI * 0.5 : Math.PI * 0.5); st.visible = false; g.add(st); });
      } else if (id === 'alas-hada') {
        const tex = M.wingTex, wm = new T.MeshBasicMaterial({ map: tex, color: A.color, transparent: true, opacity: 0.8, side: T.DoubleSide, depthWrite: false, blending: T.NormalBlending, toneMapped: false });
        g.userData.wings = [-1, 1].map((s) => { const w = new T.Group(); const p = new T.Mesh(new T.PlaneGeometry(1.5, 1.5), wm); p.position.set(s * 0.72, 0.1, 0); p.scale.x = s; w.add(p); w.position.set(s * 0.1, 0.1, -0.15); g.add(w); w.userData.s = s; return w; });
      } else if (id === 'estrellas') {
        const ring3 = new T.Group(); for (let i = 0; i < 3; i++) { const st = new T.Mesh(starGeo(0.2, 0.09, 0.06), glowM(0xFFE08A)); const a = (i / 3) * Math.PI * 2; st.position.set(Math.cos(a) * 0.95, 0.15 + i * 0.1, Math.sin(a) * 0.95); ring3.add(st); } ring3.userData.spin = true; g.add(ring3); g.userData.orbit = ring3;
      }
    }
    g.traverse((o) => { if (o.isMesh && o.material !== M.white) o.castShadow = true; });
    return g;
  }

  /* ---------- construcción por especie ---------- */
  const SPECIES = {
    lumi: { scale: 1.0, headR: 0.6, headS: [1.1, 0.95, 1.0], headY: 1.98, body: { r: 0.62, s: [1, 1.08, 0.92], y: 1.0 }, hover: true },
    bombo: { scale: 1.0, headR: 0.68, headS: [1.3, 0.92, 1.05], headY: 1.78, body: { r: 0.72, s: [1.02, 0.96, 0.96], y: 0.95 }, hover: false },
    musgo: { scale: 1.0, headR: 0.62, headS: [1.0, 0.9, 0.95], headY: 0.98, body: { r: 0.85, s: [1.1, 0.9, 1.0], y: 0.72 }, hover: false },
    nimbo: { scale: 1.0, headR: 0.62, headS: [1.12, 0.98, 1.0], headY: 1.96, body: { r: 0.6, s: [1.1, 1.0, 0.95], y: 0.98 }, hover: true }
  };

  function build(id, glowHex) {
    const sp = SPECIES[id] || SPECIES.lumi, glow = col(glowHex || '#FFD27A');
    const M = {
      fur: plush('#FBE7C6'), accent: plush('#C9B6E8'), belly: plush('#FFF6EA'), iris: std('#F2A63B', { roughness: 0.2, clearcoat: 1 }), white: std(0xfffaf2, { roughness: 0.25, clearcoat: 0.6 }), dark: std(0x2a1710, { roughness: 0.45 }), hi: new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
      mouth: std(0x4a1d1d, { roughness: 0.6 }), tongue: std(0xff7a93, { roughness: 0.5 }), blush: new T.MeshBasicMaterial({ color: 0xff8fa3, transparent: true, opacity: 0.42, depthWrite: false, toneMapped: false }),
      outfit: shiny(0x8EC8FF, { metalness: 0.0, roughness: 0.62, clearcoat: 0.1 }), acc: shiny(0xF6C453, { metalness: 0.15, roughness: 0.4 }), gem: shiny(0xff5f8f, { roughness: 0.1, metalness: 0.2 }), glow: glowM(glow), wingTex: wingTexture()
    };
    const root = new T.Group(), hop = new T.Group(), body = new T.Group(); root.add(hop); hop.add(body);
    const head = new T.Group(); head.position.set(0, sp.headY, 0); hop.add(head);
    const R = { root, hop, body, head, M, id, spec: sp, parts: {}, slots: {}, outfitKey: '', accKey: {}, blinkT: 2 + Math.random() * 3, phase: Math.random() * 6, yaw: 0, wink: 0, y0: 0 };

    // cuerpo
    const bodyMat = M.fur;
    const torso = id === 'musgo' ? rockMesh(sp.body.r, sp.body.s, M.accent) : ell(sp.body.r, sp.body.s[0], sp.body.s[1], sp.body.s[2], bodyMat, 32, 22);
    torso.position.y = sp.body.y; body.add(torso); R.parts.torso = torso;
    const B = { r: sp.body.r, sx: sp.body.s[0], sy: sp.body.s[1], sz: sp.body.s[2] };
    if (id === 'musgo') { B.cut = 1.75; B.flare = 1.12; } // la cara de la roca queda libre: la prenda es un faldón bajo
    R.torsoB = B;
    const slotOutfit = new T.Group(); slotOutfit.position.y = sp.body.y; body.add(slotOutfit); R.slots.outfit = slotOutfit;
    const hr = sp.headR;
    const headMesh = id === 'musgo' ? null : ell(hr, sp.headS[0], sp.headS[1], sp.headS[2], id === 'bombo' ? M.fur : M.fur, 36, 24);
    if (headMesh) head.add(headMesh);
    R.parts.headMesh = headMesh;
    // casillas de accesorios (con la misma deformación que su parte del cuerpo)
    const sH = new T.Group(); sH.scale.set(sp.headS[0] * hr, sp.headS[1] * hr, sp.headS[2] * hr); R.slots.cabeza = sH; head.add(sH);
    const sF = new T.Group(); sF.scale.setScalar(hr); R.slots.cara = sF; head.add(sF);
    const sN = new T.Group(); sN.scale.setScalar(sp.body.r * 0.95); R.slots.cuello = sN; body.add(sN);
    const sB = new T.Group(); sB.scale.setScalar(sp.body.r * 0.95); R.slots.espalda = sB; body.add(sB);

    if (id === 'lumi') buildLumi(R, M, glow); else if (id === 'bombo') buildBombo(R, M, glow); else if (id === 'musgo') buildMusgo(R, M, glow); else buildNimbo(R, M, glow);

    // Fibras 3D ancladas a la superficie de la malla; deformacion GPU por viento.
    // No hay pelo en Bombo (ajolote), para preservar su piel humeda.
    R.furCoats = []; R.wind = 0.25; R.windYaw = 0.3;
    const FW = window.JanusFurWind;
    if (FW && FW.supported() && id !== 'bombo') {
      const qt = FW.tier(), factor = qt === 'eco' ? 0.18 : qt === 'mobile' ? 0.38 : 1;
      const coat = (mesh, n, length, part, seed) => {
        if (!mesh || !mesh.geometry) return;
        const color = part === 'accent' ? M.accent.color : M.fur.color;
        const c = FW.attach(mesh, { count: Math.floor(n * factor), length, color,
          quality: qt, seed: id + ':' + seed, roughness: part === 'accent' ? 0.95 : 0.78 });
        if (c) R.furCoats.push({ coat: c, part });
      };
      if (id === 'lumi') {
        coat(torso, 1300, 0.09, 'fur', 'torso');
        coat(headMesh, 950, 0.065, 'fur', 'head');
        R.parts.tail.children.forEach((m, i) => coat(m, i ? 500 : 850, i ? 0.085 : 0.13, i ? 'accent' : 'fur', 'tail' + i));
      } else if (id === 'musgo') {
        R.parts.moss.children.forEach((m, i) => coat(m, 240, 0.16, 'fur', 'moss' + i));
      } else if (id === 'nimbo') {
        coat(torso, 600, 0.055, 'fur', 'body');
        coat(headMesh, 550, 0.058, 'fur', 'head');
        R.parts.puffs.forEach((m, i) => coat(m, 130, 0.08, 'fur', 'puff' + i));
      }
    }

    const sc = sp.scale; root.scale.setScalar(sc);
    root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    R.setLook = (look) => applyLook(R, look);
    R.setWind = (amount, yaw) => {
      R.wind = Math.max(0, Math.min(1, Number(amount) || 0));
      if (Number.isFinite(yaw)) R.windYaw = yaw;
    };
    R.furDetailRatio = 1;
    R.setDetail = (ratio) => {
      R.furDetailRatio = Math.max(0.2, Math.min(1, Number(ratio) || 1));
      R.furCoats.forEach(({ coat }) => { coat.mesh.count = Math.max(1, Math.round(coat.count * R.furDetailRatio)); });
    };
    R.update = (t, dt, ctl) => {
      const c = ctl || {}; animate(R, t, dt, c);
      const breeze = Number.isFinite(c.wind) ? c.wind : R.wind;
      R.furCoats.forEach((e) => e.coat.update(t, breeze, c.windYaw == null ? R.windYaw : c.windYaw));
    };
    R.dispose = () => { R.furCoats.forEach((e) => e.coat.dispose()); root.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); };
    return R;
  }

  function rockMesh(r, s, mat) {
    const g = new T.SphereGeometry(r, 56, 40), p = g.attributes.position, v = new T.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); v.normalize(); const n = Math.sin(v.x * 3.1 + 1.3) * Math.cos(v.y * 2.7) * Math.sin(v.z * 3.7 + 0.4) + Math.sin(v.x * 7.3 + v.z * 5.1) * 0.35; const k = r * (1 + n * 0.055 - (v.y < -0.4 ? 0.06 : 0)); p.setXYZ(i, v.x * k * s[0], v.y * k * s[1], v.z * k * s[2]); }
    g.computeVertexNormals(); const m = new T.Mesh(g, mat); m.castShadow = true; return m;
  }

  function limbs(R, o) {
    const M = R.M; R.parts.armL = armKit(-1, -o.ax, o.ay, o.az || 0, o.al, o.ar, o.armMat || M.fur, o.handMat); R.parts.armR = armKit(1, o.ax, o.ay, o.az || 0, o.al, o.ar, o.armMat || M.fur, o.handMat);
    R.body.add(R.parts.armL, R.parts.armR);
    if (o.feet) { R.parts.footL = footKit(-o.fx, o.fy, o.fz, o.fr, o.footMat || M.accent); R.parts.footR = footKit(o.fx, o.fy, o.fz, o.fr, o.footMat || M.accent); R.body.add(R.parts.footL, R.parts.footR); }
  }

  function buildLumi(R, M, glow) {
    const head = R.head, body = R.body;
    R.face = faceKit(head, { ex: 0.27, ey: 0.05, ez: 0.54, er: 0.135, spread: 0.2, mw: 0.095, my: -0.235, mz: 0.6, mt: 0.026 }, M);
    head.add(at(ell(0.17, 1.25, 0.8, 0.85, M.belly, 20, 14), 0, -0.2, 0.47)); // hocico claro
    head.add(at(ell(0.075, 1.3, 0.85, 0.9, M.dark, 14, 10), 0, -0.1, 0.6)); // nariz
    R.parts.ears = [-1, 1].map((s) => { const e = new T.Group(); e.position.set(s * 0.4, 0.5, 0.0); const o = cast(new T.Mesh(new T.ConeGeometry(0.24, 0.62, 18), M.fur)); const i = cast(new T.Mesh(new T.ConeGeometry(0.15, 0.46, 16), M.accent)); i.position.set(0, -0.03, 0.07); e.add(o, i); e.rotation.z = -s * 0.32; e.rotation.x = -0.1; head.add(e); return e; });
    R.parts.antennae = [-1, 1].map((s) => { const a = new T.Group(); a.position.set(s * 0.17, 0.52, 0.18); const st = cast(new T.Mesh(new T.CylinderGeometry(0.015, 0.025, 0.55, 8), M.dark)); st.position.y = 0.27; const bulb = ell(0.07, 1, 1, 1, M.glow, 12, 8); bulb.position.y = 0.56; const hl = glowSprite(glow, 0.5); hl.position.y = 0.56; a.add(st, bulb, hl); a.rotation.z = -s * 0.42; a.rotation.x = 0.12; head.add(a); return a; });
    body.add(at(ell(0.46, 1, 1.1, 0.5, M.belly, 22, 14), 0, 0.98, 0.42)); // barriga
    R.parts.wings = [-1, 1].map((s) => { const w = new T.Group(); w.position.set(s * 0.18, 1.2, -0.45); const wm = new T.MeshBasicMaterial({ map: M.wingTex, color: 0xC9B6E8, transparent: true, opacity: 0.85, side: T.DoubleSide, depthWrite: false, toneMapped: false }); const p = new T.Mesh(new T.PlaneGeometry(1.55, 1.55), wm); p.position.set(s * 0.75, 0.12, 0); p.scale.x = s; w.add(p); w.rotation.y = s * 0.5; body.add(w); w.userData.mat = wm; return w; });
    const tail = new T.Group(); tail.position.set(0, 0.62, -0.5); const t1 = ell(0.3, 0.9, 1.0, 1.4, M.fur, 22, 14); t1.position.set(0, 0.1, -0.22); const t2 = ell(0.2, 0.9, 0.9, 1.2, M.accent, 18, 12); t2.position.set(0, 0.28, -0.6); tail.add(t1, t2); tail.rotation.x = -0.5; body.add(tail); R.parts.tail = tail;
    limbs(R, { ax: 0.58, ay: 1.26, al: 0.3, ar: 0.1, feet: true, fx: 0.26, fy: 0.12, fz: 0.1, fr: 0.2 });
    R.parts.faceBase = 0;
  }

  function buildBombo(R, M, glow) {
    const head = R.head, body = R.body;
    R.face = faceKit(head, { ex: 0.4, ey: 0.14, ez: 0.58, er: 0.105, spread: 0.5, mw: 0.27, my: -0.14, mz: 0.69, mt: 0.034 }, M);
    R.parts.gills = [-1, 1].map((s) => [0, 1, 2].map((i) => { const gg = new T.Group(); gg.position.set(s * 0.74, 0.12 + i * 0.14, -0.04); const st = cast(new T.Mesh(new T.CylinderGeometry(0.012, 0.03, 0.46, 8), M.accent)); st.position.y = 0.23; const tipL = ell(0.075, 1, 1.6, 0.6, M.accent, 12, 8); tipL.position.y = 0.46; [-1, 1].forEach((q) => { const lf = ell(0.05, 1, 2, 0.5, M.accent, 8, 6); lf.position.set(q * 0.05, 0.34, 0); lf.rotation.z = q * -0.5; gg.add(lf); }); gg.add(st, tipL); gg.rotation.z = -s * (0.9 + i * 0.4); head.add(gg); return gg; }));
    body.add(at(ell(0.5, 1, 1.05, 0.5, M.belly, 22, 14), 0, 0.92, 0.45));
    const tail = new T.Group(); tail.position.set(0, 0.35, -0.55); const tt = ell(0.34, 0.55, 0.28, 1.5, M.fur, 20, 14); tt.position.set(0, 0.05, -0.38); const tf = ell(0.2, 0.6, 0.3, 0.9, M.accent, 16, 10); tf.position.set(0, 0.05, -0.8); tail.add(tt, tf); tail.rotation.x = -0.25; body.add(tail); R.parts.tail = tail;
    R.parts.ears = [];
    limbs(R, { ax: 0.68, ay: 1.18, al: 0.28, ar: 0.12, feet: true, fx: 0.32, fy: 0.12, fz: 0.12, fr: 0.24 });
  }

  function buildMusgo(R, M, glow) {
    const head = R.head, body = R.body;
    // rostro sobre la roca: la "cabeza" es la parte alta de la piedra
    R.face = faceKit(head, { ex: 0.3, ey: 0.04, ez: 0.62, er: 0.125, spread: 0.22, mw: 0.12, my: -0.2, mz: 0.7, mt: 0.03 }, M);
    head.position.z = 0.15; // la cara va sobre la superficie de la roca (la roca es cuerpo y cabeza a la vez)
    // musgo (pelo): cúmulos encima y en los costados
    const moss = new T.Group(); body.add(moss);
    [[0, 1.56, -0.12, 0.55, 0.42, 0.5], [0.5, 1.4, -0.1, 0.34, 0.3, 0.34], [-0.5, 1.4, -0.08, 0.34, 0.3, 0.34], [0.2, 1.46, -0.5, 0.4, 0.34, 0.36], [-0.3, 1.0, -0.62, 0.32, 0.28, 0.3], [0.45, 0.95, -0.55, 0.3, 0.26, 0.28], [0.0, 1.62, 0.2, 0.28, 0.2, 0.24]].forEach((c, i) => { const m = ell(c[3], 1, c[4] / c[3], c[5] / c[3], M.fur, 20, 14); m.position.set(c[0], c[1], c[2]); moss.add(m); });
    R.parts.moss = moss;
    // flores diminutas
    R.parts.flowers = [[0.28, 1.9, 0.0, 0xFFE07A], [-0.3, 1.84, -0.1, 0xFF9CC8], [0.05, 1.98, -0.3, 0xffffff]].map((f) => { const fl = new T.Group(); fl.position.set(f[0], f[1], f[2]); for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; fl.add(at(ell(0.05, 1, 1, 0.5, std(f[3], { roughness: 0.5 }), 8, 6), Math.cos(a) * 0.06, Math.sin(a) * 0.06, 0)); } fl.add(at(ell(0.035, 1, 1, 1, std(0xFFB300), 8, 6), 0, 0, 0.02)); fl.rotation.x = -0.6; body.add(fl); return fl; });
    // luciérnaga en un tallo
    const fire = new T.Group(); fire.position.set(-0.55, 1.6, -0.1); const st = cast(new T.Mesh(new T.CylinderGeometry(0.012, 0.02, 0.7, 8), M.dark)); st.position.y = 0.35; st.rotation.z = 0.0; fire.add(st); const bulb = ell(0.07, 1, 1, 1, M.glow, 12, 8); bulb.position.y = 0.72; const gs = glowSprite(glow, 0.6); gs.position.y = 0.72; fire.add(bulb, gs); fire.rotation.z = 0.35; body.add(fire); R.parts.firefly = fire;
    // piedrecitas de brazos y pies
    limbs(R, { ax: 0.88, ay: 0.95, al: 0.2, ar: 0.14, feet: true, fx: 0.38, fy: 0.12, fz: 0.18, fr: 0.26, armMat: M.accent, handMat: M.accent, footMat: M.accent });
    R.parts.ears = [];
  }

  function buildNimbo(R, M, glow) {
    const head = R.head, body = R.body;
    R.face = faceKit(head, { ex: 0.27, ey: 0.03, ez: 0.54, er: 0.135, spread: 0.2, mw: 0.11, my: -0.2, mz: 0.585, mt: 0.027 }, M);
    // nube: cúmulos alrededor del cuerpo y copete en la cabeza (sin orejas: no es un osito)
    const puffs = [];
    const add = (parent, x, y, z, r, sy) => { const p = ell(r, 1, sy || 0.9, 1, M.fur, 22, 16); p.position.set(x, y, z); parent.add(p); puffs.push(p); return p; };
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2, rr = 0.66; add(body, Math.cos(a) * rr * 1.05, 0.62 + (i % 3) * 0.22, Math.sin(a) * rr * 0.8, 0.33 + (i % 2) * 0.05); }
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.3; add(body, Math.cos(a) * 0.5, 0.22 + (i % 2) * 0.06, Math.sin(a) * 0.45, 0.3); }
    add(body, 0, 1.38, -0.05, 0.36);
    [[0, 0.7, 0.02, 0.24], [-0.26, 0.64, 0.04, 0.2], [0.26, 0.64, 0.04, 0.2], [-0.44, 0.5, 0.0, 0.17], [0.44, 0.5, 0.0, 0.17]].forEach((p) => add(head, p[0], p[1], p[2], p[3], 1));
    [-1, 1].forEach((s) => add(head, s * 0.58, -0.16, 0.02, 0.2));
    R.parts.puffs = puffs;
    body.add(at(ell(0.46, 1, 1.1, 0.5, M.belly, 22, 14), 0, 0.95, 0.5));
    // arcoíris (tres bandas a partir del color de detalle)
    const rb = new T.Group();
    R.parts.rainbow = rb; R.parts.rbMats = [0, 1, 2].map((i) => { const m = new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }); const tor = new T.Mesh(new T.TorusGeometry(0.92 - i * 0.13, 0.065, 8, 48, Math.PI), m); tor.castShadow = false; rb.add(tor); return m; });
    rb.position.set(0.1, 0.55, -0.62); rb.rotation.set(0, 0.35, 0.18); body.add(rb);
    // chispas
    R.parts.sparks = [0, 1, 2, 3].map((i) => { const s = glowSprite(glow, 0.32); body.add(s); return s; });
    limbs(R, { ax: 0.82, ay: 0.92, al: 0.16, ar: 0.11, feet: false });
    R.parts.ears = [];
  }

  function glowSprite(c, size) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const s = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(cv), color: c, transparent: true, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false })); s.scale.set(size, size, 1); return s;
  }

  /* ---------- aspecto ---------- */
  function applyLook(R, look) {
    const M = R.M, c = (h) => col(h);
    M.fur.color.copy(c(look.fur)); M.fur.sheenColor.copy(c(look.fur).lerp(c('#ffffff'), 0.55));
    M.accent.color.copy(c(look.accent)); M.accent.sheenColor.copy(c(look.accent).lerp(c('#ffffff'), 0.55));
    M.belly.color.copy(c(look.fur).lerp(c('#ffffff'), 0.55)); M.belly.sheenColor.copy(M.belly.color);
    M.iris.color.copy(c(look.eyes)); M.outfit.color.copy(c(look.outfitColor)); M.acc.color.copy(c(look.accessoryColor));
    (R.furCoats || []).forEach(({ coat, part }) => coat.setColor(part === 'accent' ? look.accent : look.fur));
    if (R.id === 'musgo') { /* la roca es el detalle (piedra) y el musgo el pelo */ }
    if (R.id === 'nimbo' && R.parts.rbMats) { const a = c(look.accent), hsl = {}; a.getHSL(hsl); R.parts.rbMats.forEach((m, i) => m.color.setHSL((hsl.h + (i - 1) * 0.1 + 1) % 1, Math.max(0.55, hsl.s), Math.min(0.68, Math.max(0.55, hsl.l)))); }
    if (R.parts.wings) R.parts.wings.forEach((w) => w.userData.mat.color.copy(c(look.accent).lerp(c('#ffffff'), 0.25)));
    // prenda
    const ok = look.outfit + '|' + look.outfitColor + '|' + look.accessoryColor;
    if (R.outfitKey !== ok) { R.slots.outfit.clear(); R.outfitKey = ok; const o = outfitMesh(look.outfit, R.torsoB, M.outfit, M.acc); R.slots.outfit.add(o); R.outfitOn = look.outfit !== 'ninguna'; }
    // accesorios
    ['cabeza', 'cara', 'cuello', 'espalda'].forEach((slot) => {
      const id = look.accessories && look.accessories[slot] || '', key = id + '|' + look.accessoryColor;
      if (R.accKey[slot] === key) return; R.accKey[slot] = key;
      const sl = R.slots[slot]; sl.clear(); R.wingsAcc = slot === 'espalda' ? null : R.wingsAcc;
      if (!id) return;
      const mesh = accessoryMesh(slot, id, M.acc, M); sl.add(mesh);
      if (slot === 'espalda') R.backAcc = mesh;
    });
    if (!look.accessories || !look.accessories.espalda) R.backAcc = null;
    positionSlots(R);
    if (R.id === 'musgo') { // el cuello de la roca: los adornos que rodean van grandes y bajos; los de pecho, pequeños sobre la superficie
      const nk = (look.accessories && look.accessories.cuello) || '', N = R.slots.cuello;
      if (nk === 'bufanda') { N.position.set(0, 0.66, 0); N.scale.setScalar(1.5); }
      else if (nk === 'perlas') { N.position.set(0, 0.6, 0); N.scale.setScalar(1.5); }
      else if (nk === 'medalla') { N.position.set(0, 0.76, 0.3); N.scale.setScalar(1.1); }
      else { N.position.set(0, 0.62, 0.4); N.scale.setScalar(0.8); }
    }
  }

  // coloca cada casilla según la especie (coordenadas locales de la cabeza / del cuerpo)
  function positionSlots(R) {
    const sp = R.spec, hr = sp.headR, hs = sp.headS, id = R.id;
    R.slots.cabeza.position.set(0, hs[1] * hr, 0);
    R.slots.cara.position.set(0, id === 'bombo' ? 0.13 : id === 'musgo' ? 0.05 : 0.03, id === 'bombo' ? 0.56 * hr / 0.68 : id === 'musgo' ? 0.64 : 0.56);
    if (id === 'bombo') { R.slots.cara.scale.set(0.85, 0.6, 0.65); R.slots.cara.position.set(0, 0.16, 0.64); }
    R.slots.cuello.position.set(0, sp.body.y + sp.body.r * sp.body.s[1] * 0.86, id === 'musgo' ? 0.2 : 0.06);
    R.slots.espalda.position.set(0, sp.body.y + 0.0, -sp.body.r * sp.body.s[2] * 0.95);
    if (id === 'musgo') { R.slots.cabeza.position.set(0, 0.52 + 0.18, 0.0); R.slots.cabeza.scale.setScalar(0.62); R.slots.cara.scale.set(0.85, 0.7, 0.7); R.slots.cara.position.set(0, 0.06, 0.88); }
    if (id === 'nimbo') { R.slots.cuello.position.set(0, sp.body.y + sp.body.r * 0.92, 0.12); }
  }

  /* ---------- animación ---------- */
  function animate(R, t, dt, ctl) {
    const sp = R.spec, S = R.parts, pose = ctl.pose || 'idle', walk = ctl.walk || 0, ex = ctl.excite || 0;
    const talking = pose === 'habla' || ctl.talk, cel = pose === 'celebra', think = pose === 'piensa', point = pose === 'senala', wave = pose === 'saluda';
    const ph = t + R.phase, hopAmp = (R.id === 'bombo' ? 0.1 : 0.05), sig = sp.hover ? 0 : 1;
    // postura general: respiración, salto, hover
    let y = 0, sqx = 1, sqy = 1;
    const breath = Math.sin(ph * 2.1);
    sqy = 1 + breath * 0.014; sqx = 1 - breath * 0.008;
    if (R.id === 'lumi') y = 0.1 + Math.sin(ph * 2.2) * 0.06 + (cel ? Math.abs(Math.sin(ph * 6)) * 0.4 : 0) + (walk ? 0.12 : 0);
    else if (R.id === 'nimbo') { y = 0.34 + Math.sin(ph * 1.4) * 0.1 + (cel ? Math.abs(Math.sin(ph * 4)) * 0.35 : 0); R.body.rotation.y = Math.sin(ph * 0.8) * 0.18 + (cel ? ph * 3 % (Math.PI * 2) : 0); if (cel) R.body.rotation.y = (ph * 4) % (Math.PI * 2); }
    else if (R.id === 'bombo') { const hp = Math.abs(Math.sin(ph * (cel ? 6.5 : walk ? 8 : 3.2))); y = hp * (cel ? 0.5 : walk ? 0.2 : hopAmp * (0.6 + ex)); const sq = 1 - Math.max(0, 0.18 - hp) * 0.9; sqy *= sq; sqx *= 2 - sq; }
    else if (R.id === 'musgo') { const hp = walk ? Math.abs(Math.sin(ph * 7)) * 0.12 : 0; y = hp + (cel ? Math.abs(Math.sin(ph * 5)) * 0.3 : 0); R.body.rotation.z = Math.sin(ph * 0.7) * 0.025; }
    if (R.id !== 'nimbo') R.body.rotation.y = damp(R.body.rotation.y, 0, 6, dt);
    R.hop.position.y = y; R.body.scale.set(sqx, sqy, sqx);
    R.body.rotation.x = walk * 0.1;

    // cabeza
    const nod = talking ? Math.sin(ph * 9) * 0.05 : 0;
    R.head.rotation.x = damp(R.head.rotation.x, nod + (think ? -0.12 : 0) + walk * 0.04, 10, dt);
    R.head.rotation.z = damp(R.head.rotation.z, think ? 0.2 : Math.sin(ph * 1.1) * 0.025, 6, dt);
    R.head.position.y = sp.headY + breath * 0.01 + (R.id === 'bombo' ? 0 : 0);
    if (R.id === 'bombo') R.head.position.y += (1 - sqy) * 0.5;

    // ojos y parpadeo
    R.blinkT -= dt; let bl = 1; if (R.blinkT < 0.12) bl = 0.1; if (R.blinkT < 0) R.blinkT = 2.2 + Math.random() * 3.2;
    const F = R.face;
    const mk = MOODS[ctl.mood] ? ctl.mood : think ? 'pensativo' : 'contento', MD = MOODS[mk]; F.mood = mk;
    F.eyes.forEach((e, i) => { const wk = R.id === 'musgo' && i === 0 && R.wink > 0 ? 0.08 : 1; e.scale.y = damp(e.scale.y, Math.min(bl, wk) * MD.eyeY * MD.eyeS, 40, dt); e.scale.x = damp(e.scale.x, MD.eyeS, 14, dt); });
    if (R.id === 'musgo') { R.wink = Math.max(0, R.wink - dt); if (R.wink <= 0 && Math.sin(ph * 0.31) > 0.995) R.wink = 0.45; if (cel && R.wink <= 0) R.wink = 0.6; }
    // cejas, mofletes y boca según la emoción
    F.brows.forEach((b) => { const u = b.userData; b.scale.y = damp(b.scale.y, MD.brow ? 1 : 0.001, 18, dt); b.rotation.z = damp(b.rotation.z, u.s * MD.browA, 14, dt); b.position.y = damp(b.position.y, u.y0 + MD.browY * u.er, 14, dt); });
    R.M.blush.opacity = damp(R.M.blush.opacity, MD.blush, 8, dt);
    const open = talking ? 0.35 + Math.abs(Math.sin(ph * 13)) * 0.6 : cel ? 0.85 : MD.open;
    F.mouth.scale.y = damp(F.mouth.scale.y, Math.max(0.001, open * F.mouthW * 1.4), 22, dt); F.mouth.scale.x = damp(F.mouth.scale.x, talking ? 1 : MD.openW, 14, dt); F.tongue.visible = open > 0.5 && mk !== 'sorprendido';
    F.smile.visible = open < 0.25 || (mk === 'alegre' && !talking && !cel); F.smile.scale.x = damp(F.smile.scale.x, MD.smW, 14, dt); F.smile.scale.y = damp(F.smile.scale.y, MD.smH, 14, dt);
    F.frown.visible = MD.frown > 0 && open < 0.25; F.frown.scale.x = damp(F.frown.scale.x, MD.fW, 14, dt); F.frown.scale.y = damp(F.frown.scale.y, MD.fH, 14, dt);

    // brazos
    const aL = S.armL, aR = S.armR; let rz = 0.14 + Math.sin(ph * 1.7) * 0.05, rx = Math.sin(ph * 1.7) * 0.1, lz = -0.14 - Math.sin(ph * 1.7 + 1) * 0.05, lx = -Math.sin(ph * 1.7) * 0.1, rEl = 0;
    if (talking) { lz = -0.35 - Math.abs(Math.sin(ph * 3)) * 0.35; rz = 0.35 + Math.abs(Math.sin(ph * 3 + 1)) * 0.3; }
    if (think) { rz = 0.6; rx = -1.9; lz = -0.14; }
    if (cel) { rz = 2.5 + Math.sin(ph * 10) * 0.15; lz = -2.5 - Math.sin(ph * 10) * 0.15; rx = 0; lx = 0; }
    if (wave) { rz = 2.4; rx = -0.1; rEl = Math.sin(ph * 10) * 0.5; }
    if (point) { rz = 0.28; rx = -1.38 + Math.sin(ph * 3) * 0.04; }
    if (walk) { rx += Math.sin(ph * 8) * 0.5 * walk; lx -= Math.sin(ph * 8) * 0.5 * walk; }
    aR.rotation.z = damp(aR.rotation.z, rz + rEl, 12, dt); aR.rotation.x = damp(aR.rotation.x, rx, 12, dt); aL.rotation.z = damp(aL.rotation.z, lz, 12, dt); aL.rotation.x = damp(aL.rotation.x, lx, 12, dt);
    if (S.footL) { const st = walk ? Math.sin(ph * 8) * 0.18 : 0; S.footL.position.z = lerpA(S.footL.position.z, 0.12 + st, 0.5); S.footR.position.z = lerpA(S.footR.position.z, 0.12 - st, 0.5); }

    // firma de cada criatura (no cambia al vestirla)
    if (R.id === 'lumi') {
      const rate = cel ? 18 : talking ? 9 : 4, amp = cel ? 0.7 : talking ? 0.42 : 0.2;
      S.wings.forEach((w) => { w.rotation.y = w.position.x > 0 ? 0.5 + Math.sin(ph * rate) * amp : -0.5 - Math.sin(ph * rate) * amp; });
      S.antennae.forEach((a, i) => { a.rotation.x = 0.12 + Math.sin(ph * 2.2 + i) * 0.14; }); S.ears.forEach((e, i) => { e.rotation.x = -0.1 + Math.sin(ph * 1.3 + i * 2) * 0.05 + (talking ? Math.sin(ph * 8) * 0.06 : 0); });
      S.tail.rotation.z = Math.sin(ph * 2.0) * 0.3; S.tail.rotation.x = -0.5 + Math.sin(ph * 1.6) * 0.06;
    } else if (R.id === 'bombo') {
      S.gills.forEach((side, si) => side.forEach((g, i) => { const s = si ? 1 : -1; g.rotation.z = -s * (0.9 + i * 0.4) + Math.sin(ph * (cel ? 12 : 3.4) + i * 0.8 + si) * (cel ? 0.28 : 0.1); }));
      S.tail.rotation.y = Math.sin(ph * 3.2) * 0.5; S.tail.rotation.x = -0.25 + Math.abs(Math.sin(ph * 3.2)) * 0.1;
    } else if (R.id === 'musgo') {
      S.firefly.rotation.z = 0.35 + Math.sin(ph * 1.2) * 0.2; S.firefly.rotation.x = Math.sin(ph * 0.9) * 0.2; S.firefly.children[2].material.opacity = 0.65 + Math.sin(ph * 4) * 0.3;
      S.flowers.forEach((f, i) => { f.rotation.z = Math.sin(ph * 1.5 + i) * 0.2; });
      R.head.rotation.z += Math.sin(ph * 0.35) * 0.05;
    } else if (R.id === 'nimbo') {
      S.puffs.forEach((p, i) => { const k = 1 + Math.sin(ph * 1.5 + i * 1.3) * 0.045; p.scale.set(k, 0.9 * k, k); });
      S.rainbow.rotation.y = 0.2 + Math.sin(ph * 0.9) * 0.15; S.rbMats.forEach((m, i) => { /* brillo suave */ });
      S.sparks.forEach((s, i) => { const a = ph * (0.9 + i * 0.15) + i * 1.7; s.position.set(Math.cos(a) * (0.95 + i * 0.1), 0.6 + (i % 2) * 0.9 + Math.sin(a * 2) * 0.1, Math.sin(a) * 0.8); s.material.opacity = 0.5 + Math.sin(ph * 5 + i * 2) * 0.5; });
    }
    // alas y estrellas de los accesorios
    if (R.backAcc) { const ud = R.backAcc.userData; if (ud.wings) ud.wings.forEach((w) => { w.rotation.y = w.userData.s * (0.35 + Math.sin(ph * (cel ? 16 : 5)) * (cel ? 0.5 : 0.22)); }); if (ud.orbit) ud.orbit.rotation.y = ph * 1.2; }
  }

  return { build, SPECIES, starGeo, glowSprite, MOODS: MOOD_IDS };
})();
window.JanusCreatures3D = JanusCreatures3D;
