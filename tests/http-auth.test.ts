import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bearerTokenFromAuthorization,
  confirmedActionsFromBody,
  isSecureAuthorityTransport,
} from '../packages/security/src/http-auth.js';

test('bearer token parser accepts one token and rejects malformed authorization', () => {
  assert.equal(bearerTokenFromAuthorization('Bearer janus_auth_abc'), 'janus_auth_abc');
  assert.equal(bearerTokenFromAuthorization('bearer token-2'), 'token-2');
  assert.equal(bearerTokenFromAuthorization('Basic abc'), undefined);
  assert.equal(bearerTokenFromAuthorization('Bearer a b'), undefined);
});

test('authority transport accepts loopback and trusted HTTPS proxy only', () => {
  assert.equal(isSecureAuthorityTransport({ remoteAddress: '127.0.0.1' }), true);
  assert.equal(isSecureAuthorityTransport({ remoteAddress: '::1' }), true);
  assert.equal(isSecureAuthorityTransport({ remoteAddress: '::ffff:127.0.0.1' }), true);
  assert.equal(isSecureAuthorityTransport({ remoteAddress: '192.168.1.20' }), false);
  assert.equal(isSecureAuthorityTransport({
    remoteAddress: '192.168.1.20',
    forwardedProto: 'https',
    trustSecureProxy: true,
  }), true);
  assert.equal(isSecureAuthorityTransport({
    remoteAddress: '192.168.1.20',
    forwardedProto: 'http',
    trustSecureProxy: true,
  }), false);
  assert.equal(isSecureAuthorityTransport({
    remoteAddress: '192.168.1.20',
    forwardedProto: 'https',
    trustSecureProxy: false,
  }), false);
});

test('confirmed action parser keeps bounded safe identifiers only', () => {
  assert.deepEqual(
    confirmedActionsFromBody([
      'rotate_root_keys',
      ' rotate_root_keys ',
      'delete_all',
      'bad action',
      123,
      '',
    ]),
    ['rotate_root_keys', 'delete_all'],
  );
});
