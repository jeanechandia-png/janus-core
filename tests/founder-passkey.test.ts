import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, randomBytes, sign, type KeyObject } from 'node:crypto';
import test from 'node:test';
import { DEFAULT_AUTHORITY_POLICY, evaluateAuthority, type AuthorityPrincipal } from '../packages/core/src/authority.js';
import {
  FounderPasskeyError,
  FounderPasskeyService,
  parsePasskeyOrigins,
  type FounderPasskeyRecord,
  type FounderPasskeyStore,
} from '../packages/security/src/founder-passkey.js';

const ORIGIN = 'https://janus.example.ts.net';
const ACTION = 'security.authority.delegate_operator';
const sha = (data: Buffer | string) => createHash('sha256').update(data).digest();

/** Autenticador de software: hace lo que haría el iPhone, para poder probar también las respuestas manipuladas. */
class SoftAuthenticator {
  readonly keys = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  readonly credentialId = randomBytes(20);
  counter = 0;
  constructor(readonly rpId = new URL(ORIGIN).hostname) {}
  private authData(flags: number, attested: boolean): Buffer {
    const head = Buffer.alloc(37);
    sha(this.rpId).copy(head, 0); head[32] = flags | (attested ? 0x40 : 0); head.writeUInt32BE(this.counter, 33);
    if (!attested) return head;
    const jwk = this.keys.publicKey.export({ format: 'jwk' }) as { x: string; y: string };
    const bytes = (b: Buffer) => Buffer.concat([Buffer.from([0x58, b.length]), b]);
    const cose = Buffer.concat([Buffer.from([0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21]), bytes(Buffer.from(jwk.x, 'base64url')), Buffer.from([0x22]), bytes(Buffer.from(jwk.y, 'base64url'))]);
    const idLen = Buffer.alloc(2); idLen.writeUInt16BE(this.credentialId.length);
    return Buffer.concat([head, Buffer.alloc(16), idLen, this.credentialId, cose]);
  }
  create(challenge: string, options: { origin?: string; flags?: number } = {}) {
    const clientDataJSON = Buffer.from(JSON.stringify({ type: 'webauthn.create', challenge, origin: options.origin ?? ORIGIN, crossOrigin: false }));
    const authData = this.authData(options.flags ?? 0x05, true);
    const lenPrefix = authData.length < 256 ? Buffer.from([0x58, authData.length]) : Buffer.from([0x59, authData.length >> 8, authData.length & 255]);
    const attestationObject = Buffer.concat([Buffer.from([0xa3, 0x63]), Buffer.from('fmt'), Buffer.from([0x64]), Buffer.from('none'), Buffer.from([0x67]), Buffer.from('attStmt'), Buffer.from([0xa0, 0x68]), Buffer.from('authData'), lenPrefix, authData]);
    return { clientDataJSON: clientDataJSON.toString('base64url'), attestationObject: attestationObject.toString('base64url') };
  }
  get(challenge: string, options: { origin?: string; flags?: number; type?: string; key?: KeyObject; counter?: number } = {}) {
    this.counter = options.counter ?? this.counter + 1;
    const clientData = Buffer.from(JSON.stringify({ type: options.type ?? 'webauthn.get', challenge, origin: options.origin ?? ORIGIN }));
    const authData = this.authData(options.flags ?? 0x05, false);
    const signature = sign('sha256', Buffer.concat([authData, sha(clientData)]), options.key ?? this.keys.privateKey);
    return { credentialId: this.credentialId.toString('base64url'), clientDataJSON: clientData.toString('base64url'), authenticatorData: authData.toString('base64url'), signature: signature.toString('base64url') };
  }
}

function setup(now = () => new Date()) {
  const map = new Map<string, FounderPasskeyRecord>();
  const store: FounderPasskeyStore = { get: (id) => map.get(id) ?? null, list: (activeOnly) => [...map.values()].filter((x) => !activeOnly || x.active), upsert: (record) => { map.set(record.credentialId, record); } };
  const service = new FounderPasskeyService(store, { origins: [ORIGIN], allowedActions: [ACTION], now });
  return { map, service };
}
type Options = { challengeId: string; publicKey: { challenge: string; rpId?: string; allowCredentials?: unknown[] } };
const enroll = (service: FounderPasskeyService, device = new SoftAuthenticator()) => {
  const options = service.registrationOptions(ORIGIN) as Options;
  service.verifyRegistration({ challengeId: options.challengeId, ...device.create(options.publicKey.challenge) });
  return device;
};
const code = (fn: () => unknown) => { try { fn(); } catch (error) { return error instanceof FounderPasskeyError ? error.code : `otro:${String(error)}`; } return 'ok'; };

test('orígenes: solo HTTPS con nombre (o localhost); nunca IP ni http remoto', () => {
  assert.deepEqual(parsePasskeyOrigins('https://janus.example.ts.net/, http://evil.example, https://192.168.1.5, basura, http://localhost:9000', 8787),
    ['http://localhost:8787', 'https://janus.example.ts.net', 'http://localhost:9000']);
  assert.deepEqual(parsePasskeyOrigins(undefined, 8787), ['http://localhost:8787']);
});

test('alta y confirmación: la prueba vale una vez, para esa acción, y la política la acepta solo ahí', () => {
  const { service, map } = setup();
  const device = enroll(service);
  assert.equal(map.size, 1);
  assert.doesNotMatch(JSON.stringify([...map.values()]), /PRIVATE/);
  const options = service.assertionOptions(ORIGIN, ACTION) as Options;
  assert.equal(options.publicKey.rpId, 'janus.example.ts.net');
  const proof = service.verifyAssertion({ challengeId: options.challengeId, ...device.get(options.publicKey.challenge) });
  assert.match(proof.proofId, /^bio_proof_[A-Za-z0-9_-]+$/);
  const requestedAt = new Date().toISOString();
  assert.equal(service.consumeProof({ proofId: proof.proofId, principalId: 'founder', action: 'security.secrets.read', requestedAt }), undefined, 'otra acción: no vale (y se quema)');
  assert.equal(service.consumeProof({ proofId: proof.proofId, principalId: 'founder', action: ACTION, requestedAt }), undefined, 'ya consumida');

  const second = service.assertionOptions(ORIGIN, ACTION) as Options;
  const proof2 = service.verifyAssertion({ challengeId: second.challengeId, ...device.get(second.publicKey.challenge) });
  const attestation = service.consumeProof({ proofId: proof2.proofId, principalId: 'founder', action: ACTION, requestedAt: new Date().toISOString() });
  assert.equal(attestation?.method, 'webauthn-uv');
  const founder: AuthorityPrincipal = { id: 'founder', role: 'founder_director', active: true };
  const instruction = (action: string) => ({ id: 'i1', principalId: 'founder', source: 'authenticated_human' as const, authenticated: true, instruction: action, requestedAt: new Date().toISOString(), biometricAttestation: { ...attestation!, action } });
  assert.equal(evaluateAuthority(founder, instruction(ACTION), ACTION).allowed, true, 'dar acceso: aceptada');
  for (const action of ['security.secrets.read', 'security.biometric.enroll', 'finance.export_unredacted', 'delete_all', 'security.authority.delegate_admin']) {
    assert.equal(evaluateAuthority(founder, instruction(action), action).allowed, false, `${action}: sigue exigiendo el puente nativo`);
  }
  assert.deepEqual(DEFAULT_AUTHORITY_POLICY.passkeyActions, [ACTION]);
});

test('no se piden pruebas para acciones fuera de la lista ni desde otra dirección', () => {
  const { service } = setup();
  assert.equal(code(() => service.assertionOptions(ORIGIN, ACTION)), 'passkey_unavailable');
  enroll(service);
  assert.equal(code(() => service.assertionOptions(ORIGIN, 'security.secrets.read')), 'invalid_action');
  assert.equal(code(() => service.assertionOptions('https://evil.example', ACTION)), 'invalid_origin');
  assert.equal(code(() => service.registrationOptions('https://evil.example')), 'invalid_origin');
});

test('rechaza: otro origen, sin verificación de usuario, firma ajena, repetición, tipo incorrecto y contador que retrocede', () => {
  const { service } = setup();
  const device = enroll(service);
  const attempt = (make: (challenge: string) => ReturnType<SoftAuthenticator['get']>, reuse?: Options) => {
    const options = reuse ?? service.assertionOptions(ORIGIN, ACTION) as Options;
    return code(() => service.verifyAssertion({ challengeId: options.challengeId, ...make(options.publicKey.challenge) }));
  };
  assert.equal(attempt((c) => device.get(c, { origin: 'https://evil.example' })), 'invalid_origin');
  assert.equal(attempt((c) => device.get(c, { flags: 0x01 })), 'user_verification_required');
  assert.equal(attempt((c) => device.get(c, { key: generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey })), 'invalid_signature');
  assert.equal(attempt((c) => device.get(c, { type: 'webauthn.create' })), 'invalid_response');
  assert.equal(attempt(() => device.get('otro-desafio')), 'invalid_challenge');
  const options = service.assertionOptions(ORIGIN, ACTION) as Options;
  assert.equal(attempt((c) => device.get(c, { counter: 50 }), options), 'ok');
  assert.equal(attempt((c) => device.get(c, { counter: 51 }), options), 'invalid_challenge', 'el mismo desafío no sirve dos veces');
  assert.equal(attempt((c) => device.get(c, { counter: 50 })), 'invalid_signature', 'contador repetido: posible copia de la llave');
  assert.equal(attempt((c) => ({ ...device.get(c), credentialId: randomBytes(20).toString('base64url') })), 'passkey_unavailable');
});

test('alta: exige verificación del usuario, origen permitido y desafío vigente; no admite duplicados', () => {
  let clock = Date.parse('2026-11-10T12:00:00Z');
  const { service, map } = setup(() => new Date(clock));
  const device = new SoftAuthenticator();
  const fresh = () => service.registrationOptions(ORIGIN) as Options;
  let options = fresh();
  assert.equal(code(() => service.verifyRegistration({ challengeId: options.challengeId, ...device.create(options.publicKey.challenge, { flags: 0x01 }) })), 'user_verification_required');
  options = fresh();
  assert.equal(code(() => service.verifyRegistration({ challengeId: options.challengeId, ...device.create(options.publicKey.challenge, { origin: 'https://evil.example' }) })), 'invalid_origin');
  options = fresh();
  assert.equal(code(() => service.verifyRegistration({ challengeId: options.challengeId, ...new SoftAuthenticator('evil.example').create(options.publicKey.challenge) })), 'invalid_origin', 'llave creada para otro sitio');
  options = fresh(); clock += 121_000;
  assert.equal(code(() => service.verifyRegistration({ challengeId: options.challengeId, ...device.create(options.publicKey.challenge) })), 'invalid_challenge', 'caducado (ya purgado)');
  options = fresh();
  assert.equal(code(() => service.verifyRegistration({ challengeId: options.challengeId, clientDataJSON: 'x', attestationObject: '!!' })), 'invalid_response');
  assert.equal(map.size, 0);
  options = fresh();
  service.verifyRegistration({ challengeId: options.challengeId, ...device.create(options.publicKey.challenge) });
  options = fresh();
  assert.equal(code(() => service.verifyRegistration({ challengeId: options.challengeId, ...device.create(options.publicKey.challenge) })), 'invalid_response', 'duplicado');
  assert.equal(map.size, 1);
});
