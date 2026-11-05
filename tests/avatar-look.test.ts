import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultLook, sanitizeLook, applyLookChange, randomLook, reactionTo, lookItems, outfitKey, accessoryKey,
  SWATCH_IDS, OUTFITS, ACCESSORIES, SLOTS
} from '../packages/modules/avatar-look/src/index.js';

test('aspecto: el de fábrica es válido y lo corrupto se repara', () => {
  const d = defaultLook({ fur: 'coral', accent: 'menta', eyes: 'chocolate' });
  assert.deepEqual(sanitizeLook(d, d), d);
  const bad = sanitizeLook({ fur: 'rojo-fosforito', eyes: 7, outfit: '<script>', accessories: { cabeza: 'cohete', cara: 'gafas-sol', zapatos: 'x' } }, d);
  assert.equal(bad.fur, d.fur); assert.equal(bad.eyes, d.eyes); assert.equal(bad.outfit, 'ninguna');
  assert.deepEqual(bad.accessories, { cara: 'gafas-sol' });
  assert.deepEqual(sanitizeLook(null), defaultLook());
  assert.deepEqual(sanitizeLook('texto'), defaultLook());
});

test('aspecto: los cambios son puros y el catálogo es cerrado', () => {
  const l0 = defaultLook({ fur: 'coral' }), l1 = applyLookChange(l0, { part: 'fur', value: 'violeta' });
  assert.equal(l0.fur, 'coral'); assert.equal(l1.fur, 'violeta');
  assert.throws(() => applyLookChange(l0, { part: 'fur', value: 'verde-radiactivo' as never }));
  assert.throws(() => applyLookChange(l0, { part: 'accessory', slot: 'cabeza', value: 'bazuca' }));
  assert.throws(() => applyLookChange(l0, { part: 'accessory', slot: 'zapatos' as never, value: 'x' }));
  assert.throws(() => applyLookChange(l0, { part: 'outfit', value: 'armadura' as never }));
  const l2 = applyLookChange(applyLookChange(l1, { part: 'accessory', slot: 'cabeza', value: 'gorro' }), { part: 'accessory', slot: 'cabeza', value: null });
  assert.deepEqual(l2.accessories, {});
});

test('aspecto: las frases del personaje no hablan de cuerpos ni de género', () => {
  const l = defaultLook();
  const changes = [
    { part: 'fur', value: 'rosa' }, { part: 'accent', value: 'azul' }, { part: 'eyes', value: 'verde' }, { part: 'outfitColor', value: 'coral' }, { part: 'accessoryColor', value: 'lila' },
    ...OUTFITS.map((o) => ({ part: 'outfit', value: o.id })),
    ...SLOTS.flatMap((s) => [{ part: 'accessory', slot: s, value: null }, ...ACCESSORIES[s].map((a) => ({ part: 'accessory', slot: s, value: a.id }))])
  ] as const;
  for (const ch of changes) {
    const say = reactionTo(ch as never, applyLookChange(l, ch as never));
    assert.ok(!/gord[ao]|flac[ao]|peso|dieta|talla|barriga|kilos?/i.test(say), say); assert.ok(!/[<>]/.test(say));
    assert.ok(!/\b(guapa|guapo|linda|lindo|niña|niño)\b/i.test(say), 'sin género: ' + say);
  }
});

test('aspecto: «sorpréndeme» respeta lo permitido y devuelve siempre un aspecto válido', () => {
  let i = 0; const rnd = () => ((i++ * 0.37) % 1);
  const only = (k: string) => k === outfitKey('camiseta') || k === accessoryKey('cabeza', 'gorro');
  for (let k = 0; k < 40; k++) {
    const l = randomLook(defaultLook(), rnd, only);
    assert.ok(['ninguna', 'camiseta'].includes(l.outfit));
    for (const s of SLOTS) { const a = l.accessories[s]; if (a) assert.equal(s + ':' + a, 'cabeza:gorro'); }
    assert.ok(SWATCH_IDS.includes(l.fur));
    assert.deepEqual(sanitizeLook(l), l, 'lo generado pasa su propia validación');
  }
});

test('catálogo con precio: claves únicas, precios enteros y gratuitos de partida', () => {
  const items = lookItems(), keys = new Set(items.map((i) => i.key));
  assert.equal(keys.size, items.length);
  for (const it of items) { assert.ok(Number.isInteger(it.price) && it.price >= 0); assert.ok(!/€|euro|\$|dólar/i.test(it.label)); }
  assert.ok(items.some((i) => i.price === 0) && items.some((i) => i.price > 0));
  assert.equal(items.length, OUTFITS.length + SLOTS.reduce((t, s) => t + ACCESSORIES[s].length, 0));
});
