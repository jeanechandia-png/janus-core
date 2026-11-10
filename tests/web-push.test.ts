import assert from 'node:assert/strict';
import test from 'node:test';
import { createDecipheriv, createECDH, hkdfSync, randomBytes, verify } from 'node:crypto';
import {
  buildPushRequest, encryptPushPayload, generateVapidPrivateKey, loadVapidKeys, localDateTime,
  validatePushSubscription, vapidAuthorization, vapidPublicKeyObject,
} from '../packages/core/src/web-push.js';

// Receptor simulado (lo que hace el navegador del teléfono), escrito desde el lado contrario del RFC 8291.
function receiver() {
  const ecdh = createECDH('prime256v1'); ecdh.generateKeys();
  const auth = randomBytes(16);
  const subscription = { endpoint: 'https://web.push.apple.com/abc', p256dh: ecdh.getPublicKey().toString('base64url'), auth: auth.toString('base64url') };
  const open = (body: Buffer): Buffer => {
    const salt = body.subarray(0, 16), idLen = body.readUInt8(20), asPublic = body.subarray(21, 21 + idLen), sealed = body.subarray(21 + idLen);
    assert.equal(body.readUInt32BE(16), 4096); assert.equal(idLen, 65);
    const shared = ecdh.computeSecret(asPublic);
    const z = (text: string) => Buffer.concat([Buffer.from(text), Buffer.from([0])]);
    const ikm = Buffer.from(hkdfSync('sha256', shared, auth, Buffer.concat([z('WebPush: info'), ecdh.getPublicKey(), asPublic]), 32));
    const cek = Buffer.from(hkdfSync('sha256', ikm, salt, z('Content-Encoding: aes128gcm'), 16));
    const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, z('Content-Encoding: nonce'), 12));
    const decipher = createDecipheriv('aes-128-gcm', cek, nonce);
    decipher.setAuthTag(sealed.subarray(sealed.length - 16));
    const plain = Buffer.concat([decipher.update(sealed.subarray(0, sealed.length - 16)), decipher.final()]);
    assert.equal(plain.at(-1), 2, 'delimitador de último registro');
    return plain.subarray(0, plain.length - 1);
  };
  return { subscription, open };
}

test('el aviso cifrado solo lo abre el teléfono suscrito (ida y vuelta RFC 8291)', () => {
  const phone = receiver(), other = receiver();
  const body = encryptPushPayload(phone.subscription, Buffer.from('Recordatorio: llamar a las 17:00 ñ'));
  assert.equal(phone.open(body).toString('utf8'), 'Recordatorio: llamar a las 17:00 ñ');
  assert.throws(() => other.open(body), 'otro dispositivo no puede leerlo');
  assert.doesNotMatch(body.toString('latin1'), /Recordatorio/);
  const tampered = Buffer.from(body); tampered.writeUInt8(tampered.readUInt8(tampered.length - 20) ^ 1, tampered.length - 20);
  assert.throws(() => phone.open(tampered), 'un aviso manipulado se rechaza');
  assert.notDeepEqual(encryptPushPayload(phone.subscription, Buffer.from('x')), encryptPushPayload(phone.subscription, Buffer.from('x')), 'sal y clave efímera nuevas en cada envío');
  assert.throws(() => encryptPushPayload(phone.subscription, Buffer.alloc(3001)), /too large/);
});

test('VAPID: firma válida para el origen del servicio y caducidad acotada', () => {
  const generated = generateVapidPrivateKey();
  const keys = loadVapidKeys(generated.privateKey, 'mailto:equipo@example.invalid');
  assert.ok(keys); assert.equal(keys.publicKey, generated.publicKey);
  const header = vapidAuthorization('https://fcm.googleapis.com/fcm/send/abc', keys, 1_800_000_000);
  const match = /^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=([\w-]+)$/.exec(header);
  assert.ok(match);
  const claims = JSON.parse(Buffer.from(match[2]!, 'base64url').toString());
  assert.deepEqual(claims, { aud: 'https://fcm.googleapis.com', exp: 1_800_000_000 + 43200, sub: 'mailto:equipo@example.invalid' });
  assert.equal(match[4], generated.publicKey);
  assert.ok(verify('sha256', Buffer.from(`${match[1]}.${match[2]}`), { key: vapidPublicKeyObject(generated.publicKey), dsaEncoding: 'ieee-p1363' }, Buffer.from(match[3]!, 'base64url')));
  assert.equal(loadVapidKeys(undefined, undefined), null);
  assert.equal(loadVapidKeys('corta', undefined), null);
});

test('la petición lleva las cabeceras del estándar y un cuerpo que el teléfono descifra', () => {
  const phone = receiver(), keys = loadVapidKeys(generateVapidPrivateKey().privateKey, undefined)!;
  const request = buildPushRequest(phone.subscription, { title: 'JANUS Work', body: '17:00 · Llamar', tag: 'ag_1' }, keys);
  assert.equal(request.url, 'https://web.push.apple.com/abc');
  assert.equal(request.headers['content-encoding'], 'aes128gcm'); assert.equal(request.headers.ttl, '3600');
  assert.match(request.headers.authorization!, /^vapid t=/);
  assert.deepEqual(JSON.parse(phone.open(request.body).toString('utf8')), { title: 'JANUS Work', body: '17:00 · Llamar', tag: 'ag_1', url: '/work' });
});

test('solo se aceptan suscripciones de servicios de avisos conocidos, por HTTPS y con claves bien formadas', () => {
  const phone = receiver();
  const keys = { p256dh: phone.subscription.p256dh, auth: phone.subscription.auth };
  assert.equal(validatePushSubscription({ endpoint: 'https://fcm.googleapis.com/fcm/send/x', keys }).endpoint, 'https://fcm.googleapis.com/fcm/send/x');
  assert.ok(validatePushSubscription({ endpoint: 'https://web.push.apple.com/x', keys }));
  for (const endpoint of ['http://fcm.googleapis.com/x', 'https://127.0.0.1/x', 'https://evil.example/x', 'https://fcm.googleapis.com.evil.example/x', 'nada']) {
    assert.throws(() => validatePushSubscription({ endpoint, keys }), /push (service|endpoint)/, endpoint);
  }
  assert.throws(() => validatePushSubscription({ endpoint: 'https://web.push.apple.com/x', keys: { p256dh: 'AAAA', auth: keys.auth } }), /keys/);
  assert.throws(() => validatePushSubscription(null), /endpoint/);
});

test('hora local por zona horaria: Ámsterdam y Bogotá no coinciden', () => {
  assert.deepEqual(localDateTime('2026-11-10T23:30:00Z', 'Europe/Amsterdam'), { date: '2026-11-11', time: '00:30' });
  assert.deepEqual(localDateTime('2026-11-10T23:30:00Z', 'America/Bogota'), { date: '2026-11-10', time: '18:30' });
  assert.deepEqual(localDateTime('2026-11-10T23:30:00Z', 'Zona/Inventada'), { date: '2026-11-10', time: '23:30' });
});
