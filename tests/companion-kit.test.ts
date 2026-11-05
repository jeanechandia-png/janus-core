import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CREATURES, getCreature, isBodySafe, makeExercise, newProfile,
  newKitProfile, kitShop, lookOf, worldOf, wear, resetLook, surpriseLook, defaultLookFor, canWear, buildCreatureLesson, validateCreatureScene,
  defaultLook, outfitKey, accessoryKey, sanitizeLook, SLOTS, ACCESSORIES, OUTFITS,
  stepsFor, newScene, applyCommands, type Topic
} from '../packages/adapters/src/companion-kit.js';

const TOPICS: Topic[] = ['suma', 'resta', 'multiplicacion', 'division', 'fracciones', 'problema'];

test('cada criatura declara un aspecto de fábrica válido para avatar-look', () => {
  for (const c of CREATURES) {
    const d = defaultLookFor(c.id);
    assert.equal(d.fur, c.look.fur); assert.equal(d.accent, c.look.accent); assert.equal(d.eyes, c.look.eyes);
    assert.deepEqual(sanitizeLook(d, defaultLook()), d, 'los ids de companion existen en la paleta de avatar-look');
  }
  assert.throws(() => defaultLookFor('inexistente'));
});

test('personalizar es solo estético: el carácter y la forma de enseñar de cada criatura no cambian', () => {
  const p = newKitProfile('k1', 'Kendra', 'nimbo');
  const before = JSON.stringify(CREATURES);
  for (const c of CREATURES) { wear(p, { part: 'fur', value: 'rosa' }, c.id); wear(p, { part: 'eyes', value: 'violeta' }, c.id); wear(p, { part: 'outfit', value: 'camiseta' }, c.id); }
  assert.equal(JSON.stringify(CREATURES), before);
  assert.equal(new Set(CREATURES.map((c) => c.style.signature)).size, CREATURES.length, 'cada criatura tiene su movimiento propio');
  for (const c of CREATURES) { assert.ok(c.style.openers.length >= 2 && c.style.closers.length >= 2); for (const t of [...c.style.openers, ...c.style.closers]) assert.ok(isBodySafe(t)); }
});

test('perfil antiguo (sin looks ni world) sigue funcionando', () => {
  const old = { ...newKitProfile('k1', 'Kendra') }; delete old.looks; delete old.world;
  assert.deepEqual(lookOf(old), defaultLookFor('lumi'));
  assert.equal(worldOf(old).stars, 0);
  assert.ok(wear(old, { part: 'fur', value: 'azul' }).ok);
  assert.equal(lookOf(old).fur, 'azul');
  const plain = newProfile('k2', 'Ana'); assert.ok(!('looks' in plain), 'companion no sabe de aspecto ni de tienda');
});

test('ropa y accesorios: solo se ponen si son suyos; los colores son gratis', () => {
  const p = newKitProfile('k1', 'Kendra', 'lumi');
  const r1 = wear(p, { part: 'outfit', value: 'capa' });
  assert.equal(r1.ok, false); assert.equal(r1.why, 'no-es-tuyo'); assert.equal(lookOf(p).outfit, 'ninguna');
  assert.ok(wear(p, { part: 'outfit', value: 'camiseta' }).ok, 'lo gratuito es suyo desde el principio');
  assert.ok(wear(p, { part: 'fur', value: 'dorado' }).ok);
  p.world = { ...worldOf(p), stars: 20 };
  const b = kitShop.buy(worldOf(p), outfitKey('capa')); assert.ok(b.ok); p.world = b.world;
  assert.ok(wear(p, { part: 'outfit', value: 'capa' }).ok); assert.equal(lookOf(p).outfit, 'capa');
  assert.equal(resetLook(p).outfit, 'ninguna'); assert.ok(worldOf(p).owned.includes(outfitKey('capa')), 'restablecer no quita lo comprado');
  assert.equal(lookOf(p, 'bombo').outfit, 'ninguna', 'cada criatura guarda su propio aspecto');
  assert.ok(canWear(worldOf(p), { part: 'accessory', slot: 'cabeza', value: null }), 'quitar siempre se puede');
  assert.equal(canWear(worldOf(p), { part: 'accessory', slot: 'cabeza', value: 'corona' }), false);
});

test('«sorpréndeme» solo usa lo que es suyo', () => {
  const p = newKitProfile('k1', 'Kendra', 'musgo'); let i = 0; const rnd = () => ((i++ * 0.37) % 1);
  for (let k = 0; k < 40; k++) {
    const l = surpriseLook(p, rnd);
    assert.ok(canWear(worldOf(p), { part: 'outfit', value: l.outfit }));
    for (const s of SLOTS) { const a = l.accessories[s]; if (a) assert.ok(canWear(worldOf(p), { part: 'accessory', slot: s, value: a })); }
  }
});

test('la tienda del kit vende ropa, accesorios, casa, vehículos y decoración', () => {
  const kinds = new Set(kitShop.catalog.map((i) => i.kind));
  assert.deepEqual([...kinds].sort(), ['acc', 'dec', 'home', 'out', 'veh']);
  for (const o of OUTFITS) assert.ok(kitShop.item(outfitKey(o.id)));
  for (const s of SLOTS) for (const a of ACCESSORIES[s]) assert.ok(kitShop.item(accessoryKey(s, a.id)));
});

test('lecciones con la voz de la criatura y el filtro de companion aplicado a todo texto', () => {
  for (const topic of TOPICS) for (const level of [1, 2, 3] as const) for (let seed = 1; seed <= 12; seed++) {
    const ex = makeExercise(topic, level, seed), c = CREATURES[seed % CREATURES.length]!;
    const lesson = buildCreatureLesson(ex, c.id);
    assert.equal(lesson.voiceId, c.id);
    assert.ok(c.style.openers.some((o) => lesson.steps[0]!.say.startsWith(o)), 'abre con la voz de ' + c.id);
    assert.ok(c.style.closers.some((o) => lesson.steps[lesson.steps.length - 1]!.say.endsWith(o)), 'cierra con la voz de ' + c.id);
    for (const st of lesson.steps) assert.ok(isBodySafe(st.say), st.say);
    const r = applyCommands(newScene(), stepsFor(lesson, true).flatMap((s) => s.commands)); assert.deepEqual(r.errors, []);
  }
  assert.throws(() => buildCreatureLesson(makeExercise('suma', 1, 1), 'inexistente'));
});

test('comandos de escena no confiables: se aplica el filtro «nunca hablar de cuerpos»', () => {
  const r = validateCreatureScene([{ op: 'say', text: 'Deberías hacer dieta' }, { op: 'say', text: '¡Muy bien!' }, { op: 'exec', cmd: 'rm -rf /' }]);
  assert.deepEqual(r.commands, [{ op: 'say', text: '¡Muy bien!' }]);
  assert.equal(r.rejected.length, 2);
  assert.equal(getCreature('lumi').id, 'lumi');
});
