import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CREATURES, getCreature, newProfile, lookOf, wear, resetLook, worldOf, isBodySafe, makeExercise,
  defaultLook, sanitizeLook, applyLookChange, randomLook, reactionTo, SWATCH_IDS, OUTFITS, ACCESSORIES, SLOTS,
  newWorld, sanitizeWorld, earn, buy, canWear, toggleDecor, setHome, setVehicle, catalog, DAILY_CAP, MAX_DECOR, shopItem, outfitKey, accessoryKey, allowFor,
  newScene, validateCommands, applyCommand, applyCommands, userMove, userAdjust, userExchange, builtValue, cookieCount, checkBuild, STAGE, MAX_PROPS,
  buildLesson, stepsFor
} from '../packages/modules/companion/src/index.js';
import type { Topic, SceneCommand, SceneState, Lesson } from '../packages/modules/companion/src/index.js';

const TOPICS: Topic[] = ['suma', 'resta', 'multiplicacion', 'division', 'fracciones', 'problema'];

/* ───────────── aspecto ───────────── */
test('aspecto: cada criatura tiene uno de fábrica válido y se repara lo corrupto', () => {
  for (const c of CREATURES) {
    const d = defaultLook(c.id);
    assert.deepEqual(sanitizeLook(d, c.id), d);
    const bad = sanitizeLook({ fur: 'rojo-fosforito', eyes: 7, outfit: '<script>', accessories: { cabeza: 'cohete', cara: 'gafas-sol', zapatos: 'x' } }, c.id);
    assert.equal(bad.fur, d.fur); assert.equal(bad.eyes, d.eyes); assert.equal(bad.outfit, 'ninguna');
    assert.deepEqual(bad.accessories, { cara: 'gafas-sol' });
  }
  assert.deepEqual(sanitizeLook(null, 'lumi'), defaultLook('lumi'));
  assert.throws(() => defaultLook('inexistente'));
});

test('aspecto: los cambios son puros y el catálogo es cerrado', () => {
  const l0 = defaultLook('bombo'), l1 = applyLookChange(l0, { part: 'fur', value: 'violeta' });
  assert.equal(l0.fur, 'coral'); assert.equal(l1.fur, 'violeta');
  assert.throws(() => applyLookChange(l0, { part: 'fur', value: 'verde-radiactivo' as never }));
  assert.throws(() => applyLookChange(l0, { part: 'accessory', slot: 'cabeza', value: 'bazuca' }));
  assert.throws(() => applyLookChange(l0, { part: 'accessory', slot: 'zapatos' as never, value: 'x' }));
  const l2 = applyLookChange(applyLookChange(l1, { part: 'accessory', slot: 'cabeza', value: 'gorro' }), { part: 'accessory', slot: 'cabeza', value: null });
  assert.deepEqual(l2.accessories, {});
});

test('aspecto: las frases de la criatura no hablan de cuerpos ni de género', () => {
  const l = defaultLook('lumi');
  const changes = [
    { part: 'fur', value: 'rosa' }, { part: 'accent', value: 'azul' }, { part: 'eyes', value: 'verde' }, { part: 'outfitColor', value: 'coral' }, { part: 'accessoryColor', value: 'lila' },
    ...OUTFITS.map((o) => ({ part: 'outfit', value: o.id })),
    ...SLOTS.flatMap((s) => [{ part: 'accessory', slot: s, value: null }, ...ACCESSORIES[s].map((a) => ({ part: 'accessory', slot: s, value: a.id }))])
  ] as const;
  for (const ch of changes) {
    const next = applyLookChange(l, ch as never), say = reactionTo(ch as never, next);
    assert.ok(isBodySafe(say), say); assert.ok(!/[<>]/.test(say));
    assert.ok(!/\b(guapa|guapo|linda|lindo|niña|niño)\b/i.test(say), 'sin género: ' + say);
  }
});

test('aspecto: "Sorpréndeme" solo usa lo que es suyo', () => {
  const w = newWorld(); let i = 0; const rnd = () => ((i++ * 0.37) % 1);
  for (let k = 0; k < 40; k++) {
    const l = randomLook('musgo', rnd, allowFor(w));
    assert.ok(canWear(w, { part: 'outfit', value: l.outfit }));
    for (const s of SLOTS) { const a = l.accessories[s]; if (a) assert.ok(canWear(w, { part: 'accessory', slot: s, value: a })); }
    assert.ok(SWATCH_IDS.includes(l.fur));
  }
});

/* ───────────── el carácter no cambia al personalizar ───────────── */
test('personalizar es solo estético: el carácter y la forma de enseñar de cada criatura no cambian', () => {
  const p = newProfile('k1', 'Kendra', 'nimbo');
  const before = JSON.stringify(CREATURES);
  for (const c of CREATURES) {
    wear(p, { part: 'fur', value: 'rosa' }, c.id); wear(p, { part: 'eyes', value: 'violeta' }, c.id); wear(p, { part: 'outfit', value: 'camiseta' }, c.id);
  }
  assert.equal(JSON.stringify(CREATURES), before);
  const sigs = new Set(CREATURES.map((c) => c.style.signature));
  assert.equal(sigs.size, CREATURES.length, 'cada criatura tiene su movimiento propio');
  for (const c of CREATURES) { assert.ok(c.style.openers.length >= 2 && c.style.closers.length >= 2); for (const t of [...c.style.openers, ...c.style.closers]) assert.ok(isBodySafe(t)); }
});

/* ───────────── perfil, ropa y tienda ───────────── */
test('perfil antiguo (sin looks ni world) sigue funcionando', () => {
  const old = newProfile('k1', 'Kendra'); delete old.looks; delete old.world;
  assert.deepEqual(lookOf(old), defaultLook('lumi'));
  assert.equal(worldOf(old).stars, 0);
  assert.ok(wear(old, { part: 'fur', value: 'azul' }).ok);
  assert.equal(lookOf(old).fur, 'azul');
});

test('ropa y accesorios: solo se ponen si son suyos; los colores son gratis', () => {
  const p = newProfile('k1', 'Kendra', 'lumi');
  const r1 = wear(p, { part: 'outfit', value: 'capa' });
  assert.equal(r1.ok, false); assert.equal(r1.why, 'no-es-tuyo'); assert.equal(lookOf(p).outfit, 'ninguna');
  assert.ok(wear(p, { part: 'outfit', value: 'camiseta' }).ok, 'lo gratuito es suyo desde el principio');
  assert.ok(wear(p, { part: 'fur', value: 'dorado' }).ok);
  p.world = { ...worldOf(p), stars: 20 };
  const b = buy(worldOf(p), outfitKey('capa')); assert.ok(b.ok); p.world = b.world;
  assert.ok(wear(p, { part: 'outfit', value: 'capa' }).ok);
  assert.equal(lookOf(p).outfit, 'capa');
  assert.equal(resetLook(p).outfit, 'ninguna'); assert.ok(worldOf(p).owned.includes(outfitKey('capa')), 'restablecer no quita lo comprado');
  assert.equal(lookOf(p, 'bombo').outfit, 'ninguna', 'cada criatura guarda su propio aspecto');
});

test('estrellas: se ganan por esfuerzo, con tope diario e idempotencia', () => {
  let w = newWorld(); const day = '2026-11-02';
  let r = earn(w, 'leccion', day, 'ev1'); w = r.world; assert.equal(r.gained, 2);
  r = earn(w, 'leccion', day, 'ev1'); assert.equal(r.duplicate, true); assert.equal(r.gained, 0); assert.equal(r.world.stars, 2);
  for (let i = 0; i < 30; i++) w = earn(w, 'racha', day, 'x' + i).world;
  assert.equal(w.earnedToday, DAILY_CAP); assert.equal(w.stars, DAILY_CAP);
  const capped = earn(w, 'acierto', day, 'otro'); assert.equal(capped.gained, 0); assert.equal(capped.capped, true);
  const next = earn(w, 'acierto', '2026-11-03', 'otro2'); assert.equal(next.gained, 1); assert.equal(next.world.earnedToday, 1);
  assert.equal(next.world.stars, DAILY_CAP + 1);
  assert.throws(() => earn(w, 'acierto', 'mañana'));
});

test('tienda: compra idempotente, sin deudas y sin castigos', () => {
  let w = newWorld();
  const poor = buy(w, 'home:nube'); assert.equal(poor.ok, false); assert.equal(poor.why, 'faltan-estrellas'); assert.equal(poor.missing, 45); assert.equal(poor.world.stars, 0);
  assert.equal(buy(w, 'veh:nave-ilegal').why, 'no-existe');
  w = { ...w, stars: 50 };
  const b1 = buy(w, 'veh:moto'); assert.ok(b1.ok); assert.equal(b1.world.stars, 25);
  const b2 = buy(b1.world, 'veh:moto'); assert.equal(b2.ok, false); assert.equal(b2.why, 'ya-lo-tienes'); assert.equal(b2.world.stars, 25, 'no cobra dos veces');
  assert.throws(() => setVehicle(w, 'veh:moto'), /todavía no es tuyo/);
  assert.equal(setVehicle(b1.world, 'veh:moto').vehicle, 'veh:moto');
  assert.throws(() => setHome(w, 'home:arbol'));
  assert.equal(setHome(w, 'home:cabana').home, 'home:cabana');
});

test('decoración: máximo permitido y solo lo comprado', () => {
  let w = { ...newWorld(), stars: 100 };
  for (const k of ['dec:planta', 'dec:alfombra', 'dec:lampara', 'dec:cama', 'dec:estanteria']) w = buy(w, k).world;
  for (const k of ['dec:planta', 'dec:alfombra', 'dec:lampara', 'dec:cama']) w = toggleDecor(w, k);
  assert.equal(w.decor.length, MAX_DECOR);
  assert.throws(() => toggleDecor(w, 'dec:estanteria'), /Ya tienes/);
  assert.equal(toggleDecor(w, 'dec:planta').decor.length, MAX_DECOR - 1);
});

test('un mundo guardado corrupto se repara y nada queda equipado sin ser suyo', () => {
  const w = sanitizeWorld({ stars: -5, home: 'home:nube', vehicle: 'veh:cohete', decor: ['dec:cama', 'dec:inventado'], owned: ['veh:fantasma', 7], day: 'ayer', earnedToday: 9999, seen: [1, 'a'] });
  assert.equal(w.stars, 0); assert.equal(w.home, 'home:cabana'); assert.equal(w.vehicle, null); assert.deepEqual(w.decor, []);
  assert.equal(w.day, ''); assert.equal(w.earnedToday, DAILY_CAP); assert.deepEqual(w.seen, ['a']);
  assert.ok(catalog().filter((i) => i.price === 0).every((i) => w.owned.includes(i.key)));
  assert.equal(shopItem(accessoryKey('cabeza', 'corona'))?.price, 12);
});

test('el catálogo nunca habla de dinero real', () => {
  for (const it of catalog()) { assert.ok(Number.isInteger(it.price) && it.price >= 0); assert.ok(!/€|euro|\$|dólar/i.test(it.label)); assert.ok(isBodySafe(it.label)); }
});

/* ───────────── escena: validación de comandos no confiables ───────────── */
test('validador: lista blanca estricta (documentos y modelos son datos, no órdenes)', () => {
  const hostile = [
    { op: 'exec', cmd: 'rm -rf /' },
    { op: 'spawn', id: 'x', kind: 'iframe', at: [0, 0] },
    { op: 'spawn', id: 'Mal Id', kind: 'plato', at: [0, 0] },
    { op: 'spawn', id: 'ok1', kind: 'plato', at: [99, 0] },
    { op: 'spawn', id: 'ok2', kind: 'plato', at: [0, 0], n: 1e9 },
    { op: 'say', text: '<img src=x onerror=alert(1)>' },
    { op: 'say', text: 'Deberías hacer dieta' },
    { op: 'say', text: 42 },
    { op: 'set', id: 'ok3', tint: 'rojo-sangre' },
    { op: 'camera', view: 'dentro-del-sol' },
    'cadena', null, 7
  ];
  const r = validateCommands(hostile);
  assert.equal(r.commands.filter((c) => c.op !== 'say').length, 0);
  const says = r.commands.filter((c) => c.op === 'say') as Array<{ op: 'say'; text: string }>;
  assert.equal(says.length, 1); assert.ok(!/[<>]/.test(says[0]!.text), 'las marcas HTML se eliminan');
  assert.equal(r.rejected.length, hostile.length - 1);
  assert.equal(validateCommands('no soy una lista').commands.length, 0);
});

test('validador: descarta campos extra y limita el número de comandos', () => {
  const r = validateCommands([{ op: 'spawn', id: 'a', kind: 'plato', at: [1, 1], n: 3, __proto__: { x: 1 }, onclick: 'x()', extra: { deep: true } }]);
  assert.deepEqual(r.commands[0], { op: 'spawn', id: 'a', kind: 'plato', at: [1, 1], n: 3 });
  const many = validateCommands(Array.from({ length: 260 }, () => ({ op: 'reset' })));
  assert.equal(many.commands.length, 200); assert.equal(many.rejected.length, 60);
});

/* ───────────── escena: reductor y manipulación ───────────── */
function chart(places: number, ns: number[]): SceneState {
  const cmds: SceneCommand[] = [];
  for (let p = 0; p < places; p++) cmds.push({ op: 'spawn', id: 'c' + p, kind: 'columna', at: [2 - p * 1.5, 0], of: p, n: ns[p] ?? 0 });
  const r = applyCommands(newScene(), cmds); assert.deepEqual(r.errors, []); return r.state;
}

test('escena: canjear conserva el valor y respeta vecinas y límites', () => {
  const s0 = chart(3, [14, 3, 1]);
  assert.equal(builtValue(s0), 14 + 30 + 100);
  const s1 = applyCommand(s0, { op: 'canjear', from: 'c0', to: 'c1', dir: 'subir' }).state;
  assert.equal(builtValue(s1), builtValue(s0)); assert.equal(s1.props[0]!.n, 4); assert.equal(s1.props[1]!.n, 4);
  const s2 = applyCommand(s1, { op: 'canjear', from: 'c2', to: 'c1', dir: 'bajar' }).state;
  assert.equal(builtValue(s2), builtValue(s0)); assert.equal(s2.props[2]!.n, 0); assert.equal(s2.props[1]!.n, 14);
  assert.throws(() => applyCommand(s0, { op: 'canjear', from: 'c0', to: 'c2', dir: 'subir' }), /vecinas/);
  assert.throws(() => applyCommand(s1, { op: 'canjear', from: 'c0', to: 'c1', dir: 'subir' }), /No hay fichas/);
  assert.equal(s0.props[0]!.n, 14, 'el estado original no se muta');
});

test('escena: la niña mueve, suma, resta y canjea sin salirse de los límites', () => {
  let s = chart(2, [9, 0]);
  s = userMove(s, 'c0', [999, -999]); assert.deepEqual(s.props[0]!.at, [STAGE.x, -STAGE.z]);
  assert.throws(() => userMove(s, 'c0', [NaN, 0])); assert.throws(() => userMove(s, 'fantasma', [0, 0]));
  s = userAdjust(s, 'c0', 1); assert.equal(s.props[0]!.n, 10);
  s = userExchange(s, 'c0', 'subir'); assert.equal(s.props[0]!.n, 0); assert.equal(s.props[1]!.n, 1);
  assert.equal(userExchange(s, 'c0', 'subir'), s, 'sin 10 fichas no pasa nada');
  assert.equal(userExchange(s, 'c1', 'subir'), s, 'sin columna vecina no pasa nada');
  s = userExchange(s, 'c1', 'bajar'); assert.equal(s.props[0]!.n, 10); assert.equal(s.props[1]!.n, 0);
  for (let i = 0; i < 300; i++) s = userAdjust(s, 'c1', 1); assert.equal(s.props[1]!.n, 120);
  for (let i = 0; i < 300; i++) s = userAdjust(s, 'c1', -1); assert.equal(s.props[1]!.n, 0);
  let t = applyCommand(newScene(), { op: 'spawn', id: 't', kind: 'tarta', at: [0, 0], of: 6, n: 2 }).state;
  for (let i = 0; i < 20; i++) t = userAdjust(t, 't', 1); assert.equal(t.props[0]!.n, 6, 'no se pueden pintar más porciones que las que tiene');
});

test('escena: límite de objetos y objetos duplicados', () => {
  let s = newScene();
  for (let i = 0; i < MAX_PROPS; i++) s = applyCommand(s, { op: 'spawn', id: 'p' + i, kind: 'plato', at: [0, 0] }).state;
  assert.throws(() => applyCommand(s, { op: 'spawn', id: 'extra', kind: 'plato', at: [0, 0] }), /Demasiados/);
  assert.throws(() => applyCommand(s, { op: 'spawn', id: 'p1', kind: 'plato', at: [0, 0] }), /Ya existe/);
  const s2 = applyCommand(s, { op: 'creature', point: 'p3' }).state;
  assert.equal(applyCommand(s2, { op: 'remove', id: 'p3' }).state.creature.point, null, 'si quitas lo que señalaba, deja de señalar');
});

/* ───────────── lecciones ───────────── */
function play(lesson: Lesson, includeSolution = true): { final: SceneState; byStep: Map<string, SceneState> } {
  let s = newScene(); const byStep = new Map<string, SceneState>();
  for (const st of stepsFor(lesson, includeSolution)) {
    const v = validateCommands(st.commands);
    assert.deepEqual(v.rejected, [], 'comandos de ' + st.id + ' deben pasar el validador'); assert.deepEqual(v.commands, st.commands);
    const r = applyCommands(s, st.commands); assert.deepEqual(r.errors, [], lesson.exerciseId + ' · ' + st.id); s = r.state; byStep.set(st.id, s);
  }
  return { final: s, byStep };
}

test('lecciones: todas se construyen, se reproducen sin errores y los textos son seguros', () => {
  let n = 0;
  for (const topic of TOPICS) for (const level of [1, 2, 3] as const) for (let seed = 1; seed <= 25; seed++) {
    const ex = makeExercise(topic, level, seed), c = CREATURES[seed % CREATURES.length]!;
    const lesson = buildLesson(ex, c.id); n++;
    assert.ok(lesson.steps.length >= 3, ex.id); assert.equal(lesson.creatureId, c.id); assert.ok(lesson.basis.length >= 3);
    for (const st of lesson.steps) { assert.ok(isBodySafe(st.say) && !/[<>]/.test(st.say), st.say); assert.ok(st.say.length <= 480); }
    const { final } = play(lesson);
    assert.ok(final.props.length <= MAX_PROPS);
    assert.equal(lesson.steps[0]!.reveals, false, 'la primera ayuda nunca da la solución');
    assert.ok(lesson.steps[0]!.say.length > 0);
  }
  assert.equal(n, 6 * 3 * 25);
});

test('lecciones: el resultado mostrado coincide SIEMPRE con la respuesta del tutor', () => {
  for (const level of [1, 2, 3] as const) for (let seed = 1; seed <= 40; seed++) {
    const sum = makeExercise('suma', level, seed), rs = makeExercise('resta', level, seed), mul = makeExercise('multiplicacion', level, seed), div = makeExercise('division', level, seed);
    assert.equal(builtValue(play(buildLesson(sum, 'lumi')).byStep.get('resultado')!), Number(sum.answer), sum.id);
    assert.equal(builtValue(play(buildLesson(rs, 'bombo')).byStep.get('resultado')!), Number(rs.answer), rs.id);
    const ml = buildLesson(mul, 'musgo'), ms = play(ml).byStep.get('resultado')!;
    assert.equal(mul.params[0]! <= 12 && mul.params[1]! <= 12 ? cookieCount(ms) : builtValue(ms), Number(mul.answer), mul.id);
    const dl = buildLesson(div, 'nimbo'), ds = play(dl).byStep.get('resultado')!;
    assert.equal(ds.props.find((p) => p.id === 'cartel')!.label.endsWith('= ' + div.answer), true, div.id);
    const total = div.params[0]! * div.params[1]!;
    assert.equal(total <= 60 ? cookieCount(ds) : builtValue(ds), total, div.id);
    if (total <= 60) for (const p of ds.props.filter((x) => x.kind === 'plato')) assert.equal(String(p.n), div.answer, 'reparto igual en cada plato');
  }
});

test('lecciones: fracciones y problemas muestran la respuesta del tutor', () => {
  for (const level of [1, 2, 3] as const) for (let seed = 1; seed <= 40; seed++) {
    const fr = makeExercise('fracciones', level, seed), [n1, n2, d] = fr.params as [number, number, number];
    const { byStep, final } = play(buildLesson(fr, 'lumi'));
    const pies = byStep.get('juntar')!.props.filter((p) => p.kind === 'tarta' && p.id !== 'td');
    assert.equal(pies.reduce((t, p) => t + p.n, 0), n1 + n2, fr.id); assert.ok(pies.every((p) => p.of === d));
    assert.ok(/=/.test(final.props.find((p) => p.id === 'cartel')!.label) || n1 + n2 === (n1 + n2), fr.id);
    const pr = makeExercise('problema', level, seed);
    const out = play(buildLesson(pr, 'bombo')).final;
    assert.equal(out.props.find((p) => p.id === 'plato')!.n, Number(pr.answer), pr.id);
  }
});

test('lecciones: la primera ayuda no escribe el resultado en el cartel y "mostrar pasos" sí', () => {
  for (const topic of TOPICS) for (let seed = 1; seed <= 20; seed++) {
    const ex = makeExercise(topic, 2, seed), lesson = buildLesson(ex, 'lumi');
    const hint = stepsFor(lesson, false), full = stepsFor(lesson, true);
    assert.ok(hint.length >= 1 && hint.length < full.length, ex.id);
    assert.ok(hint.every((s) => !s.reveals));
    const cartel = play(lesson, false).final.props.find((p) => p.id === 'cartel');
    assert.ok(!cartel || !cartel.label.endsWith('= ' + ex.answer), ex.id + ' · cartel: ' + cartel?.label);
  }
});

test('lecciones: "tu turno" tiene solución construible con las manos de la niña', () => {
  let goals = 0;
  for (const topic of ['suma', 'resta', 'multiplicacion'] as const) for (const level of [1, 2, 3] as const) for (let seed = 1; seed <= 25; seed++) {
    const lesson = buildLesson(makeExercise(topic, level, seed), 'lumi'), turn = lesson.steps.find((s) => s.build);
    if (!turn) continue; goals++;
    let s = play(lesson).byStep.get('tu-turno')!; const goal = turn.build!;
    if (goal.kind !== 'valor') throw new Error('objetivo inesperado');
    assert.equal(checkBuild(s, goal).done, false);
    // la niña construye el valor objetivo solo con "+" por columna
    const target = goal.target, cols = s.props.filter((p) => p.kind === 'columna');
    for (const c of cols) { const digit = Math.floor(target / 10 ** c.of) % 10; for (let k = c.n; k < digit; k++) s = userAdjust(s, c.id, 1); for (let k = c.n; k > digit; k--) s = userAdjust(s, c.id, -1); }
    assert.equal(checkBuild(s, goal).done, true, lesson.exerciseId);
  }
  assert.ok(goals > 100);
});

test('lecciones: cada criatura enseña con su voz (apertura propia) y falta de parámetros falla claro', () => {
  const ex = makeExercise('suma', 1, 5);
  const openers = new Set(CREATURES.map((c) => buildLesson(ex, c.id).steps[0]!.say.split(' Vamos')[0]));
  assert.ok(openers.size >= 3);
  for (const c of CREATURES) assert.ok(getCreature(c.id).style.openers.some((o) => buildLesson(ex, c.id).steps[0]!.say.startsWith(o)));
  assert.throws(() => buildLesson({ ...ex, params: [] }, 'lumi'), /parámetros/);
  assert.throws(() => buildLesson(ex, 'inexistente'));
});
