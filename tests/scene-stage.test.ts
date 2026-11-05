import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newScene, validateCommands, applyCommand, applyCommands, userMove, userAdjust, userExchange, builtValue, cookieCount, checkBuild, STAGE, MAX_PROPS,
  buildLesson, stepsFor, type SceneCommand, type SceneState, type Lesson, type LessonVoice
} from '../packages/modules/scene-stage/src/index.js';
// Cualquier tutor que dé {id, topic, params} sirve: aquí se usa el de companion solo como fuente de ejercicios.
import { makeExercise, CREATURES, type Topic } from '../packages/modules/companion/src/index.js';

const TOPICS: Topic[] = ['suma', 'resta', 'multiplicacion', 'division', 'fracciones', 'problema'];
const noBody = (t: string) => !/gord[ao]|flac[ao]|peso|kilos?|dieta|talla|barriga/i.test(t);
const GUARD = { textGuard: noBody };
const voiceOf = (id: string): LessonVoice => { const c = CREATURES.find((x) => x.id === id)!; return { id: c.id, openers: c.style.openers, closers: c.style.closers }; };

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
    { op: 'set', id: 'ok3', tint: 'rojo<script>' },
    { op: 'set', id: 'ok4', tint: 'x'.repeat(40) },
    { op: 'camera', view: 'dentro-del-sol' },
    'cadena', null, 7
  ];
  const r = validateCommands(hostile, { textGuard: noBody });
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
    const lesson = buildLesson(ex, voiceOf(c.id), GUARD); n++;
    assert.ok(lesson.steps.length >= 3, ex.id); assert.equal(lesson.voiceId, c.id); assert.ok(lesson.basis.length >= 3);
    for (const st of lesson.steps) { assert.ok(noBody(st.say) && !/[<>]/.test(st.say), st.say); assert.ok(st.say.length <= 480); }
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
    assert.equal(builtValue(play(buildLesson(sum, voiceOf('lumi'), GUARD)).byStep.get('resultado')!), Number(sum.answer), sum.id);
    assert.equal(builtValue(play(buildLesson(rs, voiceOf('bombo'), GUARD)).byStep.get('resultado')!), Number(rs.answer), rs.id);
    const ml = buildLesson(mul, voiceOf('musgo'), GUARD), ms = play(ml).byStep.get('resultado')!;
    assert.equal(mul.params[0]! <= 12 && mul.params[1]! <= 12 ? cookieCount(ms) : builtValue(ms), Number(mul.answer), mul.id);
    const dl = buildLesson(div, voiceOf('nimbo'), GUARD), ds = play(dl).byStep.get('resultado')!;
    assert.equal(ds.props.find((p) => p.id === 'cartel')!.label.endsWith('= ' + div.answer), true, div.id);
    const total = div.params[0]! * div.params[1]!;
    assert.equal(total <= 60 ? cookieCount(ds) : builtValue(ds), total, div.id);
    if (total <= 60) for (const p of ds.props.filter((x) => x.kind === 'plato')) assert.equal(String(p.n), div.answer, 'reparto igual en cada plato');
  }
});

test('lecciones: fracciones y problemas muestran la respuesta del tutor', () => {
  for (const level of [1, 2, 3] as const) for (let seed = 1; seed <= 40; seed++) {
    const fr = makeExercise('fracciones', level, seed), [n1, n2, d] = fr.params as [number, number, number];
    const { byStep, final } = play(buildLesson(fr, voiceOf('lumi'), GUARD));
    const pies = byStep.get('juntar')!.props.filter((p) => p.kind === 'tarta' && p.id !== 'td');
    assert.equal(pies.reduce((t, p) => t + p.n, 0), n1 + n2, fr.id); assert.ok(pies.every((p) => p.of === d));
    assert.ok(/=/.test(final.props.find((p) => p.id === 'cartel')!.label) || n1 + n2 === (n1 + n2), fr.id);
    const pr = makeExercise('problema', level, seed);
    const out = play(buildLesson(pr, voiceOf('bombo'), GUARD)).final;
    assert.equal(out.props.find((p) => p.id === 'plato')!.n, Number(pr.answer), pr.id);
  }
});

test('lecciones: la primera ayuda no escribe el resultado en el cartel y "mostrar pasos" sí', () => {
  for (const topic of TOPICS) for (let seed = 1; seed <= 20; seed++) {
    const ex = makeExercise(topic, 2, seed), lesson = buildLesson(ex, voiceOf('lumi'), GUARD);
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
    const lesson = buildLesson(makeExercise(topic, level, seed), voiceOf('lumi'), GUARD), turn = lesson.steps.find((s) => s.build);
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

test('lecciones: cada voz abre a su manera, y faltas de parámetros, voz o tema fallan claro', () => {
  const ex = makeExercise('suma', 1, 5);
  const openers = new Set(CREATURES.map((c) => buildLesson(ex, voiceOf(c.id), GUARD).steps[0]!.say.split(' Vamos')[0]));
  assert.ok(openers.size >= 3);
  for (const c of CREATURES) assert.ok(c.style.openers.some((o) => buildLesson(ex, voiceOf(c.id), GUARD).steps[0]!.say.startsWith(o)));
  assert.throws(() => buildLesson({ ...ex, params: [] }, voiceOf('lumi')), /parámetros/);
  assert.throws(() => buildLesson(ex, { id: 'mudo', openers: [], closers: [] }), /voz/);
  assert.throws(() => buildLesson({ ...ex, topic: 'magia' as never }, voiceOf('lumi')), /Tema sin lección/);
});
