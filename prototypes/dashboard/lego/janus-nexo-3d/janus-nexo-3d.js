'use strict';
/**
 * janus-nexo-3d · versiones masculina y femenina aprobadas (4 noviembre 2026).
 * Modelo tridimensional PROCEDURAL en Three.js; no es la fotografía 2D pegada al canvas.
 * La lámina cinematográfica aprobada es la REFERENCIA VISUAL, no un GLB fotorrealista.
 * Ambas identidades son independientes y no alteran el robot legacy (oro).
 *
 * Contrato del escenario Janus3D: build() -> { id, root, update(t,dt,ctl), setLook() }.
 * El modelo se monta en el MISMO canvas WebGL manipulable (giro táctil, animación).
 * Ambas referencias visuales son independientes; no se modifica el diseño femenino.
 * La geometría procedural es un fallback 3D mientras los GLB cinematográficos
 * aprobados se modelan y riggean (una imagen sola no es un activo 3D).
 */
const JanusNexo3D = (() => {
  const T = window.THREE;
  if (!T) return null;

  const APPROVED = Object.freeze({
    id: 'nexo-masculino',
    version: '1.0.0',
    approvedOn: '2026-11-04',
    status: 'approved-reference',
    description: 'JANUS · 02 NEXO masculino; expresión amable, boca pequeña, labios voluminosos arriba y abajo, nariz definida, ojos grandes azules',
    eyes: '#2385cb',
    metal: '#bfc7d1',
    mouthHalfWidth: 0.17,
    upperLipRadius: 0.044,
    lowerLipRadius: 0.055,
    noseDepth: 0.17
  });

  const FEMALE = Object.freeze({
    id: 'nexo-femenino',
    version: '1.0.0',
    approvedOn: '2026-11-04',
    status: 'approved-reference',
    description: 'Versión femenina original: cabeza amable y redondeada, ojos azules grandes, labios definidos, metal plateado y silueta ligera',
    eyes: '#2385cb',
    metal: '#bfc7d1',
    mouthHalfWidth: 0.16,
    upperLipRadius: 0.039,
    lowerLipRadius: 0.048,
    noseDepth: 0.14
  });
  const PRESETS = Object.freeze({ masculino: APPROVED, femenino: FEMALE });

  const MOODS = Object.freeze({
    contento:    { brow: 0,     tilt: 0,     lid: 1,    width: 1,    open: 0.012, corner: 0.01 },
    alegre:      { brow: 0.025, tilt: -0.08, lid: 0.88, width: 1.04, open: 0.06, corner: 0.03 },
    sorprendido: { brow: 0.075, tilt: 0,     lid: 1.1,  width: 0.72, open: 0.22, corner: 0 },
    triste:      { brow: -0.03, tilt: 0.18,  lid: 0.78, width: 0.94, open: 0.006, corner: -0.018 },
    pensativo:   { brow: -0.015,tilt: -0.13, lid: 0.80, width: 0.88, open: 0.008, corner: 0 },
    enojado:     { brow: -0.06, tilt: -0.28, lid: 0.73, width: 0.91, open: 0.01, corner: -0.018 }
  });
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const approach = (now, target, rate, dt) => now + (target - now) * (1 - Math.exp(-rate * dt));
  const material = (color, metalness, roughness, extra) =>
    new T.MeshPhysicalMaterial(Object.assign({
      color, metalness, roughness, clearcoat: 0.65, clearcoatRoughness: 0.13
    }, extra || {}));

  function build(variant = 'masculino') {
    if (!Object.prototype.hasOwnProperty.call(PRESETS, variant)) throw new Error('Variante NEXO desconocida');
    const female = variant === 'femenino';
    const spec = PRESETS[variant];
    const root = new T.Group();
    root.name = 'JANUS NEXO ' + variant + ' · geometría 3D';
    root.userData.approvedIdentity = spec.id;
    root.userData.referenceStatus = spec.status;
    const silver = material(spec.metal, 0.83, 0.22);
    const bright = material('#e3e7eb', 0.72, 0.24);
    const shadow = material('#171b23', 0.47, 0.3);
    const seam = material('#4b515c', 0.72, 0.28);
    const lipMat = material('#a8a7b2', 0.55, 0.3);
    const sclera = material('#e7f3ff', 0.18, 0.15);
    const irisMat = material(spec.eyes, 0.25, 0.19, { clearcoat: 1 });
    const pupilMat = material('#091522', 0.1, 0.09, { clearcoat: 1 });
    const glintMat = new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });

    const sphere = (parent, name, mat, xyz, scale, segments = 28) => {
      const obj = new T.Mesh(new T.SphereGeometry(1, segments, 20), mat);
      obj.name = name; obj.position.set(...xyz); obj.scale.set(...scale);
      parent.add(obj); return obj;
    };
    const capsule = (parent, name, mat, xyz, radius, length, scale) => {
      const obj = new T.Mesh(new T.CapsuleGeometry(radius, length, 8, 16), mat);
      obj.name = name; obj.position.set(...xyz);
      if (scale) obj.scale.set(...scale);
      parent.add(obj); return obj;
    };
    const tube = (parent, name, mat, coords, radius) => {
      const curve = new T.CatmullRomCurve3(coords.map(p => new T.Vector3(...p)));
      const obj = new T.Mesh(new T.TubeGeometry(curve, 20, radius, 7, false), mat);
      obj.name = name; parent.add(obj); return obj;
    };

    // Cuerpo masculino esbelto: hombros ligeramente más anchos, abdomen marcado,
    // paneles metálicos separados por articulaciones oscuras (sin ropa ni accesorios).
    sphere(root, 'núcleo-pélvico', shadow, [0, 2.04, 0], [0.43, 0.31, 0.31]);
    sphere(root, 'placa-pélvica', silver, [0, 2.11, 0.21], [0.35, 0.27, 0.14]);
    sphere(root, 'torso', shadow, [0, 2.61, 0], [female ? 0.51 : 0.56, 0.66, 0.32]);
    sphere(root, 'pecho-metal-izquierdo', silver, [-0.285, 2.77, 0.22], [0.31, 0.43, 0.20]);
    sphere(root, 'pecho-metal-derecho', silver, [0.285, 2.77, 0.22], [0.31, 0.43, 0.20]);
    sphere(root, 'abdomen-metal', bright, [0, 2.34, 0.27], [0.31, 0.34, 0.12]);
    for (let i = 0; i < 3; i++) {
      sphere(root, 'costilla-mecánica-' + i, seam, [0, 2.31 + i * 0.12, 0.386], [0.24, 0.012, 0.013], 20);
    }
    capsule(root, 'cuello-articulado', shadow, [0, 3.22, 0], 0.20, 0.22);
    for (let i = 0; i < 4; i++) {
      sphere(root, 'anillo-cervical-' + i, seam, [0, 3.15 + 0.07 * i, 0.01], [0.207, 0.022, 0.212], 20);
    }

    const arms = [];
    for (const sign of [-1, 1]) {
      const shoulder = new T.Group();
      shoulder.position.set(sign * (female ? 0.60 : 0.65), 2.94, 0);
      root.add(shoulder);
      sphere(shoulder, 'hombro-' + sign, silver, [0, 0, 0], [0.27, 0.28, 0.3]);
      sphere(shoulder, 'articulación-hombro-' + sign, shadow, [sign * 0.035, -0.25, 0], [0.16, 0.18, 0.16]);
      capsule(shoulder, 'brazo-superior-' + sign, silver, [sign * 0.025, -0.45, 0], 0.145, 0.43);
      const elbow = new T.Group(); elbow.position.set(0, -0.78, 0); shoulder.add(elbow);
      sphere(elbow, 'codo-' + sign, shadow, [0, 0, 0], [0.16, 0.16, 0.16]);
      capsule(elbow, 'antebrazo-' + sign, silver, [0, -0.32, 0.01], 0.135, 0.4);
      const wrist = new T.Group(); wrist.position.set(0, -0.69, 0.02); elbow.add(wrist);
      sphere(wrist, 'muñeca-' + sign, seam, [0, 0, 0], [0.115, 0.12, 0.115]);
      sphere(wrist, 'palma-' + sign, bright, [0, -0.14, 0], [0.175, 0.22, 0.09]);
      for (let i = 0; i < 4; i++) {
        capsule(wrist, 'dedo-' + sign + '-' + i, silver,
          [-0.125 + i * 0.08, -0.38 - Math.min(i, 3 - i) * 0.032, 0], 0.032, 0.16);
      }
      capsule(wrist, 'pulgar-' + sign, silver, [-sign * 0.21, -0.19, 0.04], 0.05, 0.13,
        [1, 1, 1]).rotation.z = sign * 0.66;
      arms.push({ shoulder, elbow, sign });
    }

    const legs = [];
    for (const sign of [-1, 1]) {
      const hip = new T.Group(); hip.position.set(sign * 0.235, 1.98, 0); root.add(hip);
      sphere(hip, 'cadera-' + sign, shadow, [0, 0, 0], [0.235, 0.23, 0.23]);
      capsule(hip, 'muslo-' + sign, silver, [0, -0.46, 0], 0.22, 0.53);
      const knee = new T.Group(); knee.position.set(0, -0.91, 0); hip.add(knee);
      sphere(knee, 'rodilla-' + sign, seam, [0, 0, 0.05], [0.21, 0.23, 0.22]);
      capsule(knee, 'espinilla-' + sign, silver, [0, -0.44, 0], 0.185, 0.52);
      sphere(knee, 'tobillo-' + sign, shadow, [0, -0.83, 0], [0.16, 0.16, 0.16]);
      sphere(knee, 'pie-' + sign, bright, [0, -0.95, 0.18], [0.235, 0.16, 0.39]);
      legs.push({ hip, knee, sign });
    }

    // Cabeza completamente volumétrica; la cara no es una textura plana.
    const head = new T.Group(); head.position.set(0, 3.67, 0); head.scale.setScalar(female ? 1.08 : 1); root.add(head);
    sphere(head, 'cráneo-metálico', silver, [0, 0, 0], [0.53, 0.62, 0.47], 40);
    sphere(head, female ? 'mandíbula-femenina' : 'mandíbula-masculina', silver, [0, -0.31, 0.12], [female ? 0.395 : 0.42, female ? 0.265 : 0.29, 0.35]);
    sphere(head, 'máscara-facial', bright, [0, -0.035, 0.37], [0.455, 0.48, 0.13], 40);
    [-1, 1].forEach(sign => {
      sphere(head, 'oreja-mecánica-' + sign, silver, [sign * 0.535, -0.01, 0], [0.13, 0.22, 0.17]);
      sphere(head, 'articulación-auricular-' + sign, seam, [sign * 0.645, -0.01, 0], [0.04, 0.11, 0.10]);
      tube(head, 'contorno-sien-' + sign, seam, [
        [sign * 0.40, 0.50, 0.14], [sign * 0.46, 0.27, 0.23],
        [sign * 0.47, 0.04, 0.21]
      ], 0.018);
    });

    const eyes = [];
    for (const sign of [-1, 1]) {
      const eye = new T.Group(); eye.position.set(sign * 0.215, 0.155, 0.51); head.add(eye);
      sphere(eye, 'esclerótica-' + sign, sclera, [0, 0, 0], [0.166, 0.196, 0.077], 36);
      const iris = sphere(eye, 'iris-azul-' + sign, irisMat, [sign * -0.009, -0.005, 0.073], [female ? 0.112 : 0.102, female ? 0.141 : 0.13, 0.025], 32);
      const pupil = sphere(eye, 'pupila-' + sign, pupilMat, [sign * -0.009, -0.005, 0.096], [0.057, 0.076, 0.015], 28);
      sphere(eye, 'brillo-ocular-' + sign, glintMat, [-0.028, 0.04, 0.111], [0.022, 0.026, 0.012], 20);
      const eyebrow = new T.Group(); eyebrow.position.set(sign * 0.215, 0.375, 0.535); head.add(eyebrow);
      tube(eyebrow, 'ceja-' + sign, seam, [
        [-0.14, -0.005, -0.011], [0, 0.04, 0.025], [0.15, -0.005, -0.01]
      ], 0.029);
      eyes.push({ eye, iris, pupil, eyebrow, sign });
    }

    // NARIZ: volumen real algo mayor que en los bocetos previos.
    const nose = sphere(head, 'nariz-nexo', bright, [0, -0.083, 0.548],
      [0.10, 0.143, spec.noseDepth], 36);
    sphere(head, 'punta-nasal', silver, [0, -0.15, 0.667], [0.12, 0.065, 0.085]);

    // BOCA: menor anchura que la sonrisa descartada, pero labios voluminosos
    // tanto en el arco superior como el inferior; piezas 3D independientes.
    const mouth = new T.Group(); mouth.position.set(0, -0.31, 0.594); head.add(mouth);
    const opening = sphere(mouth, 'apertura-bucal', shadow, [0, -0.022, 0.015],
      [spec.mouthHalfWidth * 0.88, 0.013, 0.029], 28);
    const upper = tube(mouth, 'labio-superior-voluminoso', lipMat, [
      [-spec.mouthHalfWidth, 0.012, 0.033],
      [-0.08, -0.010, 0.045], [0, -0.021, 0.054],
      [0.08, -0.010, 0.045], [spec.mouthHalfWidth, 0.012, 0.033]
    ], spec.upperLipRadius);
    const lower = new T.Group(); mouth.add(lower);
    tube(lower, 'labio-inferior-voluminoso', lipMat, [
      [-spec.mouthHalfWidth, -0.047, 0.033],
      [-0.08, -0.064, 0.050], [0, -0.075, 0.058],
      [0.08, -0.064, 0.050], [spec.mouthHalfWidth, -0.047, 0.033]
    ], spec.lowerLipRadius);
    mouth.userData.upperLip = upper.name; mouth.userData.lowerLip = lower.children[0].name;
    mouth.userData.relativeWidth = spec.mouthHalfWidth / 0.53;
    nose.userData.relativeDepth = spec.noseDepth;

    // Animación independiente de la fuente de voz. La sincronía fonémica exacta
    // depende de disponer de visemas/audio timings o de un GLB final con morphs.
    let eyeClose = 1, openingAmount = 0, mouthWidth = 1, browRise = 0, browTilt = 0, corner = 0;
    const update = (t, dt, ctl = {}) => {
      const delta = clamp(Number.isFinite(dt) ? dt : 0.016, 0.001, 0.05);
      const mood = MOODS[ctl.mood] || MOODS.contento;
      const pose = ctl.pose || 'idle';
      const talking = !!ctl.talk || pose === 'habla';
      const blink = (t % 4.7) < 0.13 ? 0.10 : 1;
      eyeClose = approach(eyeClose, mood.lid * blink, blink < 1 ? 43 : 14, delta);
      const speechOpen = talking ? (0.055 + Math.abs(Math.sin(t * 11.7)) * 0.09) : 0;
      openingAmount = approach(openingAmount, Math.max(mood.open, speechOpen), 17, delta);
      mouthWidth = approach(mouthWidth, mood.width, 12, delta);
      browRise = approach(browRise, mood.brow, 11, delta);
      browTilt = approach(browTilt, mood.tilt, 11, delta);
      corner = approach(corner, mood.corner, 11, delta);
      eyes.forEach((part) => {
        part.eye.scale.y = clamp(eyeClose, 0.07, 1.18);
        part.eyebrow.position.y = 0.375 + browRise;
        part.eyebrow.rotation.z = part.sign * browTilt;
        part.iris.position.x = -part.sign * (pose === 'piensa' ? 0.035 : 0.009);
        part.pupil.position.x = part.iris.position.x;
      });
      opening.scale.y = Math.max(0.2, openingAmount / 0.027);
      lower.position.y = -openingAmount * 0.75;
      mouth.scale.x = mouthWidth;
      mouth.position.y = -0.31 + corner;
      mouth.rotation.z = mood === MOODS.triste ? -0.02 : 0;
      head.rotation.z = Math.sin(t * 1.15) * 0.028 + (pose === 'piensa' ? 0.06 : 0);
      head.rotation.x = Math.sin(t * 0.85) * 0.022 + (ctl.mood === 'triste' ? 0.08 : 0) + (ctl.listening ? -0.06 : 0);
      head.rotation.y = Math.sin(t * 0.65) * (talking ? 0.09 : 0.03);
      head.position.y = 3.67 + (talking ? Math.sin(t * 7) * 0.006 : 0);
      arms.forEach(({ shoulder, elbow, sign }) => {
        const waving = pose === 'saluda' || pose === 'celebra';
        shoulder.rotation.z = approach(shoulder.rotation.z,
          waving && sign === 1 ? -2.3 : (sign === -1 ? -0.10 : 0.10), 7, delta);
        elbow.rotation.x = approach(elbow.rotation.x,
          talking ? (-0.25 - Math.sin(t * 3.5 + sign) * 0.18) : ctl.listening ? -0.09 : 0, 7, delta);
        shoulder.rotation.x = approach(shoulder.rotation.x,
          talking ? Math.sin(t * 2.7 + sign * 0.9) * 0.12 : 0, 6, delta);
      });
      legs.forEach(({ hip, sign }) => { hip.rotation.x = approach(hip.rotation.x,
        ctl.walk ? Math.sin(t * 7 + sign) * 0.18 * ctl.walk : 0, 8, delta); });
      root.position.y = Math.sin(t * 1.5) * 0.014;
    };
    update(0, 0.016, {});
    return {
      id: spec.id, root, glb: false, face: false, approved: spec,
      update,
      // La identidad aprobada no se recolorea por el vestidor de criaturas.
      setLook() {},
      setVoiceState(talking, now = 0) { update(now, 0.016, { talk: !!talking }); }
    };
  }
  return { build, APPROVED, FEMALE, PRESETS, MOODS: Object.keys(MOODS) };
})();
window.JanusNexo3D = JanusNexo3D;
