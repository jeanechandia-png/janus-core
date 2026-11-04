'use strict';
/* ===== LEGO janus-face-3d v1.0 · cara flotante expresiva (ojos + sonrisa) =====
 * La cara del robot de Janus sin cuerpo: dos ojos y una boca que flotan dentro de la escena 3D y expresan emociones
 * con la forma de los ojos (párpados, mejillas), la boca y el color. Comparte la interfaz de JanusCreatures3D.build():
 *   const rig = JanusFace3D.build('lumi', '#FFD36A');  scene.add(rig.root);
 *   rig.setLook({ eyes: '#59E4D4' });                 // el color de los ojos lo elige quien la usa
 *   rig.update(t, dt, { pose: 'idle|habla|piensa|celebra|senala|saluda', walk: 0..1, pointYaw, mood, camPos })
 *   mood: alegre | contento | triste | enojado | sorprendido | pensativo (opcional)
 * Solo cambia la cara; el carácter y la voz los pone el módulo `companion`. Sin red ni texturas externas.
 */
const JanusFace3D = (() => {
  const T = window.THREE; if (!T) return null;
  const MOOD_IDS = ['alegre', 'contento', 'triste', 'enojado', 'sorprendido', 'pensativo'];
  /* ew/eh: medio ancho/alto del ojo · close: párpado superior · slant: inclinación (+ enfado, − pena) · cheek: mejilla que sube (ojos ^_^)
     mw: medio ancho de la boca · curv: curvatura (+ sonrisa, − pena) · mh: alto del arco · openD/openU: boca abierta hacia abajo/arriba
     tint/tintK: color de la emoción y cuánto se mezcla con el color de ojos elegido · eyeDY: caída de los ojos · sc: tamaño general */
  const FACE = {
    contento: { ew: 0.34, eh: 0.31, close: 0, slant: 0, cheek: 0.1, mw: 0.34, curv: 0.55, mh: 0.3, openD: 0, openU: 0, thick: 0.075, tint: '#ffffff', tintK: 0, eyeDY: 0, sc: 1 },
    alegre: { ew: 0.37, eh: 0.3, close: 0, slant: 0, cheek: 1, mw: 0.48, curv: 0.95, mh: 0.38, openD: 0.55, openU: 0, thick: 0.08, tint: '#FFD36A', tintK: 0.3, eyeDY: 0.02, sc: 1.04 },
    triste: { ew: 0.32, eh: 0.33, close: 0.12, slant: -0.85, cheek: 0, mw: 0.3, curv: -0.6, mh: 0.22, openD: 0, openU: 0, thick: 0.07, tint: '#6FA8FF', tintK: 0.6, eyeDY: -0.07, sc: 0.96 },
    enojado: { ew: 0.37, eh: 0.3, close: 0.1, slant: 0.9, cheek: 0, mw: 0.36, curv: -0.4, mh: 0.2, openD: 0, openU: 0, thick: 0.085, tint: '#FF4A3D', tintK: 0.7, eyeDY: 0, sc: 1 },
    sorprendido: { ew: 0.37, eh: 0.43, close: 0, slant: 0, cheek: 0, mw: 0.16, curv: 0, mh: 0.2, openD: 0.95, openU: 0.95, thick: 0.07, tint: '#ffffff', tintK: 0.4, eyeDY: 0.05, sc: 1.08 },
    pensativo: { ew: 0.32, eh: 0.3, close: 0.22, slant: -0.12, cheek: 0, mw: 0.17, curv: -0.04, mh: 0.1, openD: 0, openU: 0, thick: 0.07, tint: '#B79CFF', tintK: 0.5, eyeDY: 0.03, sc: 1, asym: 0.42 } // un ojo más abierto que el otro y mirada de lado: «hmm»
  };
  const NE = 44, NM = 30, damp = (c, g, k, dt) => c + (g - c) * (1 - Math.exp(-k * dt));
  const radial = (stops, size) => { const cv = document.createElement('canvas'); cv.width = cv.height = size || 64; const g = cv.getContext('2d'), r = cv.width / 2, gr = g.createRadialGradient(r, r, 0, r, r, r); stops.forEach((s) => gr.addColorStop(s[0], s[1])); g.fillStyle = gr; g.fillRect(0, 0, cv.width, cv.height); const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; return t; };
  let TEX = null;
  const tex = () => TEX || (TEX = { glow: radial([[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,255,255,.4)'], [1, 'rgba(255,255,255,0)']]), plate: radial([[0, 'rgba(8,6,18,.62)'], [0.55, 'rgba(8,6,18,.4)'], [1, 'rgba(8,6,18,0)']]), floor: radial([[0, 'rgba(0,0,0,.42)'], [1, 'rgba(0,0,0,0)']]) });

  function build(id, hex, opts) {
    const mount = !!(opts && opts.mount); // mount: la cara se monta sobre otra cabeza (p. ej. el visor del robot): sin placa, sin sombra, sin flotar ni girar
    const root = new T.Group(), fl = new T.Group(); root.add(fl);
    const base = new T.Color(hex || '#FFD36A'), cur = new T.Color(base), tgt = new T.Color(), tint = new T.Color();
    const mat = new T.MeshBasicMaterial({ color: cur, toneMapped: false, side: T.DoubleSide });
    const TX = tex();
    // placa oscura suave detrás: asegura el contraste sobre cualquier fondo
    const plate = new T.Sprite(new T.SpriteMaterial({ map: TX.plate, transparent: true, depthWrite: false })); plate.scale.set(4.2, 2.8, 1); plate.position.set(0, 0, -0.1); if (!mount) fl.add(plate);
    const eyes = [-1, 1].map((s) => {
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array((NE + 1) * 3), 3));
      const idx = []; for (let i = 0; i < NE; i++) idx.push(NE, i, (i + 1) % NE); g.setIndex(idx);
      const m = new T.Mesh(g, mat); m.frustumCulled = false; fl.add(m);
      const sp = new T.Sprite(new T.SpriteMaterial({ map: TX.glow, color: cur, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0.55 })); sp.scale.set(1.5, 1.3, 1); sp.position.z = 0.02; fl.add(sp);
      return { s, d: -s, g, m, sp, hv: 1 };
    });
    const mg = new T.BufferGeometry(); mg.setAttribute('position', new T.BufferAttribute(new Float32Array((NM + 1) * 2 * 3), 3));
    const mi = []; for (let j = 0; j < NM; j++) { const a = j * 2, b = a + 1, c = a + 2, d = a + 3; mi.push(a, b, c, b, d, c); } mg.setIndex(mi);
    const mouth = new T.Mesh(mg, mat); mouth.frustumCulled = false; fl.add(mouth);
    const fg = new T.BufferGeometry(); fg.setAttribute('position', new T.BufferAttribute(new Float32Array((NM + 1) * 2 * 3), 3)); fg.setIndex(mi);
    const fill = new T.Mesh(fg, mat); fill.frustumCulled = false; fl.add(fill);
    const msp = new T.Sprite(new T.SpriteMaterial({ map: TX.glow, color: cur, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0.4 })); msp.scale.set(1.4, 0.8, 1); fl.add(msp);
    const shadow = new T.Mesh(new T.CircleGeometry(1, 28), new T.MeshBasicMaterial({ map: TX.floor, transparent: true, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.04; shadow.userData.noFit = true; if (!mount) root.add(shadow);

    const P = Object.assign({}, FACE.contento, { gx: 0, gy: 0, wink: 0, asym: 0 });
    const R = { root, fl, mount, mountScale: (opts && opts.scale) || 0.58, id, face: true, glb: false, phase: Math.random() * 6, blinkT: 2 + Math.random() * 2.5, gazeT: 1, gtx: 0, gty: 0, mood: 'contento', P, yawL: 0 };
    const EX = 0.66, EY = 0.1, MY = mount ? -0.44 : -0.64, MHK = mount ? 0.55 : 1, V = new T.Vector3(); // montada en un visor la boca es más compacta (cabe en el cristal)

    function drawEye(e, ox, oy) {
      const a = e.g.attributes.position.array, w = P.ew, h = P.eh * (e.s > 0 ? 1 + P.asym : 1 - P.asym * 0.55), hv = e.hv; let cy = 0;
      for (let i = 0; i < NE; i++) {
        const th = (i / NE) * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
        const x = Math.sign(c) * Math.pow(Math.abs(c), 0.77) * w, yy = Math.sign(s) * Math.pow(Math.abs(s), 0.77) * h, u = x / w, v = u * e.d;
        const yU = h * (1 - P.close * 2) - P.slant * v * h * 0.95, yL = -h + P.cheek * h * 1.55 * (1 - u * u);
        let y = Math.min(Math.max(yy, yL), yU); if (yL > yU) y = (yL + yU) / 2;
        a[i * 3] = x + ox; a[i * 3 + 1] = y * hv + oy; a[i * 3 + 2] = 0; cy += y * hv;
      }
      a[NE * 3] = ox; a[NE * 3 + 1] = oy + cy / NE; a[NE * 3 + 2] = 0; e.g.attributes.position.needsUpdate = true;
    }
    function drawMouth(ox, oy) {
      const A = mg.attributes.position.array, B = fg.attributes.position.array, mw = P.mw, th = P.thick;
      for (let j = 0; j <= NM; j++) {
        const u = -1 + (2 * j) / NM, sq = Math.sqrt(Math.max(0, 1 - u * u)), base = -P.curv * (1 - u * u) * P.mh * MHK, up = base + P.openU * P.mh * MHK * 0.95 * sq, lo = base - P.openD * P.mh * MHK * 0.95 * sq;
        const x = u * mw + ox, tk = th * (0.35 + 0.65 * Math.pow(sq, 0.5)) * 0.5;
        A[j * 6] = x; A[j * 6 + 1] = oy + up + tk; A[j * 6 + 2] = 0; A[j * 6 + 3] = x; A[j * 6 + 4] = oy + up - tk; A[j * 6 + 5] = 0;
        B[j * 6] = x; B[j * 6 + 1] = oy + up; B[j * 6 + 2] = 0; B[j * 6 + 3] = x; B[j * 6 + 4] = oy + lo; B[j * 6 + 5] = 0;
      }
      mg.attributes.position.needsUpdate = true; fg.attributes.position.needsUpdate = true;
    }

    R.setLook = (look) => { if (look && look.eyes) base.set(look.eyes); };
    R.update = (t, dt, ctl) => {
      ctl = ctl || {}; dt = Math.min(dt || 0.016, 0.05);
      const pose = ctl.pose || 'idle', walk = ctl.walk || 0, talking = pose === 'habla' || ctl.talk, cel = pose === 'celebra', think = pose === 'piensa', wave = pose === 'saluda', point = pose === 'senala';
      const mk = FACE[ctl.mood] ? ctl.mood : cel ? 'alegre' : think ? 'pensativo' : 'contento', M = FACE[mk]; R.mood = mk;
      ['ew', 'eh', 'close', 'slant', 'cheek', 'mw', 'curv', 'mh', 'thick', 'eyeDY', 'sc', 'asym'].forEach((k) => { P[k] = damp(P[k], M[k] != null ? M[k] : 0, 13, dt); });
      const talk = talking ? 0.35 + Math.abs(Math.sin((t + R.phase) * 13)) * 0.6 : 0;
      P.openD = damp(P.openD, Math.max(M.openD, talk * 0.95), 20, dt); P.openU = damp(P.openU, M.openU, 16, dt);
      // parpadeo, guiño al saludar y mirada
      R.blinkT -= dt; const bl = R.blinkT < 0.13 ? 1 : 0; if (R.blinkT < 0) R.blinkT = 2 + Math.random() * 3.4;
      const winkR = wave && Math.sin(t * 5) > 0.55 ? 1 : 0;
      eyes.forEach((e) => { const tg = Math.max(bl, e.s > 0 ? winkR : 0); e.hv = damp(e.hv, 1 - 0.93 * tg, tg ? 45 : 22, dt); });
      R.gazeT -= dt; if (R.gazeT < 0) { R.gazeT = 1.4 + Math.random() * 2.6; R.gtx = (Math.random() - 0.5) * 0.5; R.gty = (Math.random() - 0.5) * 0.25; }
      let gx = R.gtx, gy = R.gty; if (think) { gx = 0.7; gy = 0.55; } else if (point && ctl.pointYaw != null) { gx = Math.max(-1, Math.min(1, ctl.pointYaw)) * 0.9; gy = 0; } else if (talking) { gx *= 0.3; gy *= 0.3; }
      P.gx = damp(P.gx, gx, 9, dt); P.gy = damp(P.gy, gy, 9, dt);
      eyes.forEach((e) => drawEye(e, e.s * EX + P.gx * 0.1, EY + P.eyeDY + P.gy * 0.07));
      drawMouth(P.gx * 0.05, MY + P.eyeDY * 0.6 + P.gy * 0.03);
      // color: el elegido + un matiz de la emoción
      tint.set(M.tint); tgt.copy(base).lerp(tint, M.tintK); cur.lerp(tgt, 1 - Math.exp(-7 * dt));
      eyes.forEach((e) => { e.sp.material.color.copy(cur); e.sp.position.set(e.s * EX + P.gx * 0.1, EY + P.eyeDY + P.gy * 0.07, 0.02); e.sp.material.opacity = 0.5 + (talking ? Math.sin(t * 14) * 0.08 : 0) + (ctl.listening ? 0.15 : 0); });
      msp.material.color.copy(cur); msp.position.set(0, MY + 0.04, 0.02);
      // flotar, inclinarse, saltar, mirar a la cámara
      const bob = Math.sin((t + R.phase) * 1.6) * 0.07, cy = cel ? Math.abs(Math.sin(t * 6)) * 0.42 : 0, wk = walk ? Math.sin(t * 7) * 0.04 * walk : 0;
      if (mount) { fl.position.set(0, bob * 0.12, 0); fl.scale.setScalar(R.mountScale * (mk === 'sorprendido' ? 0.9 : P.sc) * (1 + (talking ? Math.sin(t * 13) * 0.012 : 0))); return; }
      fl.position.y = 1.92 + bob + cy + wk; fl.scale.setScalar(P.sc * (1 + (talking ? Math.sin(t * 13) * 0.012 : 0)));
      fl.rotation.z = damp(fl.rotation.z, Math.sin(t * 1.1) * 0.04 + (wave ? Math.sin(t * 8) * 0.07 : 0) + (think ? 0.14 : 0) - (mk === 'triste' ? 0.06 : 0), 8, dt); fl.rotation.x = damp(fl.rotation.x, walk * 0.1 + (mk === 'triste' ? 0.06 : 0), 8, dt);
      if (ctl.camPos) { root.getWorldPosition(V); const want = Math.atan2(ctl.camPos.x - V.x, ctl.camPos.z - V.z) - root.rotation.y, wrapped = Math.atan2(Math.sin(want), Math.cos(want)); R.yawL = damp(R.yawL, wrapped * 0.9, 6, dt); fl.rotation.y = R.yawL; }
      const k = 1 - Math.min(0.35, (fl.position.y - 1.92) * 0.25); shadow.scale.set(1.0 * k, 1.0 * k, 1); shadow.material.opacity = 0.9 * k;
    };
    R.update(0, 0.016, {});
    return R;
  }
  return { build, MOODS: MOOD_IDS, FACE };
})();
window.JanusFace3D = JanusFace3D;
