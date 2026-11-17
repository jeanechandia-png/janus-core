import test from 'node:test';
import assert from 'node:assert/strict';
import { createShop, earn, owns, DAILY_CAP, MAX_DECOR, WORLD_ITEMS, type ShopItem } from '../packages/modules/star-shop/src/index.js';

const EXTRA: ShopItem[] = [{ key: 'hat:gratis', kind: 'hat', label: 'Gorro', icon: '🧢', price: 0 }, { key: 'hat:corona', kind: 'hat', label: 'Corona', icon: '👑', price: 12 }];
const shop = createShop(EXTRA);

test('estrellas: se ganan por esfuerzo, con tope diario e idempotencia', () => {
  let w = shop.newWorld(); const day = '2026-11-02';
  let r = earn(w, 'leccion', day, 'ev1'); w = r.world; assert.equal(r.gained, 2);
  r = earn(w, 'leccion', day, 'ev1'); assert.equal(r.duplicate, true); assert.equal(r.gained, 0); assert.equal(r.world.stars, 2);
  for (let i = 0; i < 30; i++) w = earn(w, 'racha', day, 'x' + i).world;
  assert.equal(w.earnedToday, DAILY_CAP); assert.equal(w.stars, DAILY_CAP);
  const capped = earn(w, 'acierto', day, 'otro'); assert.equal(capped.gained, 0); assert.equal(capped.capped, true);
  const next = earn(w, 'acierto', '2026-11-03', 'otro2'); assert.equal(next.gained, 1); assert.equal(next.world.earnedToday, 1);
  assert.equal(next.world.stars, DAILY_CAP + 1);
  assert.throws(() => earn(w, 'acierto', 'mañana'));
  assert.equal(w.stars, DAILY_CAP, 'earn no muta el mundo recibido');
});

test('tienda: compra idempotente, sin deudas y sin castigos', () => {
  let w = shop.newWorld();
  const poor = shop.buy(w, 'home:nube'); assert.equal(poor.ok, false); assert.equal(poor.why, 'faltan-estrellas'); assert.equal(poor.missing, 45); assert.equal(poor.world.stars, 0);
  assert.equal(shop.buy(w, 'veh:nave-ilegal').why, 'no-existe');
  w = { ...w, stars: 50 };
  const b1 = shop.buy(w, 'veh:moto'); assert.ok(b1.ok); assert.equal(b1.world.stars, 25);
  const b2 = shop.buy(b1.world, 'veh:moto'); assert.equal(b2.ok, false); assert.equal(b2.why, 'ya-lo-tienes'); assert.equal(b2.world.stars, 25, 'no cobra dos veces');
  assert.throws(() => shop.setVehicle(w, 'veh:moto'), /todavía no es tuyo/);
  assert.equal(shop.setVehicle(b1.world, 'veh:moto').vehicle, 'veh:moto');
  assert.equal(shop.setVehicle(b1.world, null).vehicle, null);
  assert.throws(() => shop.setHome(w, 'home:arbol'));
  assert.equal(shop.setHome(w, 'home:cabana').home, 'home:cabana');
  assert.equal(w.stars, 50, 'comprar no muta el mundo original');
});

test('el producto aporta sus propios objetos a la tienda', () => {
  const w = { ...shop.newWorld(), stars: 12 };
  assert.ok(owns(w, 'hat:gratis'), 'lo gratuito es suyo de partida'); assert.ok(!owns(w, 'hat:corona'));
  const b = shop.buy(w, 'hat:corona'); assert.ok(b.ok); assert.equal(b.world.stars, 0);
  assert.throws(() => createShop([...EXTRA, EXTRA[0]!]), /repetida/);
  assert.throws(() => createShop([{ key: 'x', kind: 'k', label: 'x', icon: 'x', price: 1.5 }]), /Precio inválido/);
  assert.equal(shop.catalog.length, EXTRA.length + WORLD_ITEMS.length);
});

test('decoración: máximo permitido y solo lo comprado', () => {
  let w = { ...shop.newWorld(), stars: 100 };
  for (const k of ['dec:planta', 'dec:alfombra', 'dec:lampara', 'dec:cama', 'dec:estanteria']) w = shop.buy(w, k).world;
  for (const k of ['dec:planta', 'dec:alfombra', 'dec:lampara', 'dec:cama']) w = shop.toggleDecor(w, k);
  assert.equal(w.decor.length, MAX_DECOR);
  assert.throws(() => shop.toggleDecor(w, 'dec:estanteria'), /Ya tienes/);
  assert.equal(shop.toggleDecor(w, 'dec:planta').decor.length, MAX_DECOR - 1);
  assert.throws(() => shop.toggleDecor(shop.newWorld(), 'dec:cama'), /todavía no es tuyo/);
});

test('un mundo guardado corrupto se repara y nada queda equipado sin ser suyo', () => {
  const w = shop.sanitize({ stars: -5, home: 'home:nube', vehicle: 'veh:cohete', decor: ['dec:cama', 'dec:inventado'], owned: ['veh:fantasma', 7], day: 'ayer', earnedToday: 9999, seen: [1, 'a'] });
  assert.equal(w.stars, 0); assert.equal(w.home, 'home:cabana'); assert.equal(w.vehicle, null); assert.deepEqual(w.decor, []);
  assert.equal(w.day, ''); assert.equal(w.earnedToday, DAILY_CAP); assert.deepEqual(w.seen, ['a']);
  assert.ok(shop.catalog.filter((i) => i.price === 0).every((i) => w.owned.includes(i.key)));
  assert.deepEqual(shop.sanitize(undefined), shop.newWorld());
});

test('el catálogo nunca habla de dinero real', () => {
  for (const it of shop.catalog) { assert.ok(Number.isInteger(it.price) && it.price >= 0); assert.ok(!/€|euro|\$|dólar/i.test(it.label)); }
});
