import {
  createCipheriv, createECDH, createPrivateKey, createPublicKey, hkdfSync, randomBytes, sign, generateKeyPairSync,
  type KeyObject,
} from 'node:crypto';

/**
 * Web Push sin dependencias (RFC 8291 cifrado aes128gcm + RFC 8292 VAPID), para avisar al teléfono del colaborador.
 * - Gratis: usa el servicio de avisos del propio navegador/sistema (Apple, Google, Mozilla). JANUS no contrata nada.
 * - El contenido viaja cifrado de extremo a extremo: el servicio intermedio no puede leer el recordatorio.
 * - La clave privada VAPID es un secreto: vive en una variable de entorno, nunca en SQLite ni en el repositorio.
 * Módulo sin red: `buildPushRequest` devuelve la petición lista; el runtime decide enviarla.
 */
export interface PushSubscriptionKeys { endpoint: string; p256dh: string; auth: string }

/** Servicios de avisos admitidos (evita que un «endpoint» apunte a cualquier servidor). */
const PUSH_HOSTS = [/\.push\.apple\.com$/, /^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/];

export function validatePushSubscription(input: unknown): PushSubscriptionKeys {
  const body = (input ?? {}) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (typeof body.endpoint !== 'string' || body.endpoint.length > 1000) throw new Error('push endpoint is invalid');
  let url: URL;
  try { url = new URL(body.endpoint); } catch { throw new Error('push endpoint is invalid'); }
  if (url.protocol !== 'https:' || !PUSH_HOSTS.some((host) => host.test(url.hostname))) throw new Error('push service is not allowed');
  const p256dh = typeof body.keys?.p256dh === 'string' ? body.keys.p256dh : '';
  const auth = typeof body.keys?.auth === 'string' ? body.keys.auth : '';
  if (Buffer.from(p256dh, 'base64url').length !== 65 || Buffer.from(auth, 'base64url').length !== 16) throw new Error('push keys are invalid');
  return { endpoint: url.toString(), p256dh, auth };
}

export interface VapidKeys { privateKey: KeyObject; publicKey: string; subject: string }

/** JANUS_PUSH_VAPID_PRIVATE_KEY = clave privada P-256 (32 bytes) en base64url. Sin ella, los avisos quedan apagados. */
export function loadVapidKeys(privateKeyBase64Url: string | undefined, subject: string | undefined): VapidKeys | null {
  const raw = Buffer.from((privateKeyBase64Url ?? '').trim(), 'base64url');
  if (raw.length !== 32) return null;
  try {
    const ecdh = createECDH('prime256v1'); ecdh.setPrivateKey(raw);
    const pub = ecdh.getPublicKey();
    const jwk = { kty: 'EC', crv: 'P-256', d: raw.toString('base64url'), x: pub.subarray(1, 33).toString('base64url'), y: pub.subarray(33, 65).toString('base64url') };
    return {
      privateKey: createPrivateKey({ key: jwk, format: 'jwk' }),
      publicKey: pub.toString('base64url'),
      subject: /^(mailto:|https:\/\/)/.test(subject ?? '') ? subject! : 'https://janus.invalid/work',
    };
  } catch { return null; }
}

export function generateVapidPrivateKey(): { privateKey: string; publicKey: string } {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = privateKey.export({ format: 'jwk' }) as { d: string; x: string; y: string };
  return {
    privateKey: jwk.d,
    publicKey: Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')]).toString('base64url'),
  };
}

const info = (text: string) => Buffer.concat([Buffer.from(text, 'utf8'), Buffer.from([0])]);

/** RFC 8291: cifra `payload` para una suscripción. `ephemeral`/`salt` solo se pasan en pruebas. */
export function encryptPushPayload(
  subscription: Pick<PushSubscriptionKeys, 'p256dh' | 'auth'>,
  payload: Buffer,
  fixed?: { ephemeralPrivateKey: Buffer; salt: Buffer },
): Buffer {
  if (payload.length > 3000) throw new Error('push payload is too large');
  const uaPublic = Buffer.from(subscription.p256dh, 'base64url');
  const authSecret = Buffer.from(subscription.auth, 'base64url');
  const ecdh = createECDH('prime256v1');
  if (fixed) ecdh.setPrivateKey(fixed.ephemeralPrivateKey); else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(uaPublic);
  const ikm = Buffer.from(hkdfSync('sha256', shared, authSecret, Buffer.concat([info('WebPush: info'), uaPublic, asPublic]), 32));
  const salt = fixed?.salt ?? randomBytes(16);
  const cek = Buffer.from(hkdfSync('sha256', ikm, salt, info('Content-Encoding: aes128gcm'), 16));
  const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, info('Content-Encoding: nonce'), 12));
  const cipher = createCipheriv('aes-128-gcm', cek, nonce);
  const sealed = Buffer.concat([cipher.update(Buffer.concat([payload, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const header = Buffer.alloc(21); salt.copy(header, 0); header.writeUInt32BE(4096, 16); header.writeUInt8(asPublic.length, 20);
  return Buffer.concat([header, asPublic, sealed]);
}

/** RFC 8292: cabecera Authorization «vapid t=…, k=…» para el origen del servicio de avisos. */
export function vapidAuthorization(endpoint: string, keys: VapidKeys, nowSeconds: number): string {
  const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${b64({ typ: 'JWT', alg: 'ES256' })}.${b64({ aud: new URL(endpoint).origin, exp: nowSeconds + 12 * 3600, sub: keys.subject })}`;
  const signature = sign('sha256', Buffer.from(unsigned), { key: keys.privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `vapid t=${unsigned}.${signature}, k=${keys.publicKey}`;
}

export function buildPushRequest(subscription: PushSubscriptionKeys, message: { title: string; body: string; tag?: string; url?: string }, keys: VapidKeys, now = Date.now()): {
  url: string; method: 'POST'; headers: Record<string, string>; body: Buffer;
} {
  const body = encryptPushPayload(subscription, Buffer.from(JSON.stringify({
    title: message.title.slice(0, 80), body: message.body.slice(0, 300), ...(message.tag ? { tag: message.tag } : {}), url: message.url ?? '/work',
  }), 'utf8'));
  return {
    url: subscription.endpoint,
    method: 'POST',
    headers: {
      authorization: vapidAuthorization(subscription.endpoint, keys, Math.floor(now / 1000)),
      'content-encoding': 'aes128gcm',
      'content-type': 'application/octet-stream',
      'content-length': String(body.length),
      ttl: '3600',
      urgency: 'normal',
    },
    body,
  };
}

/** Comprueba una firma VAPID (lo usan las pruebas; un servicio de avisos hace lo mismo). */
export function vapidPublicKeyObject(publicKeyBase64Url: string): KeyObject {
  const raw = Buffer.from(publicKeyBase64Url, 'base64url');
  return createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: raw.subarray(1, 33).toString('base64url'), y: raw.subarray(33, 65).toString('base64url') }, format: 'jwk' });
}

/** Hora local (AAAA-MM-DD, HH:MM) de un instante en una zona horaria IANA; cae a UTC si la zona no es válida. */
export function localDateTime(nowIso: string, timeZone: string | undefined): { date: string; time: string } {
  const date = new Date(nowIso);
  const format = (zone: string | undefined) => {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
    return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
  };
  try { return format(timeZone || 'UTC'); } catch { return format('UTC'); }
}
