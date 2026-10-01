import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const signer = readFileSync(
  new URL('../platform/ios/JanusFounderFaceSigner.swift', import.meta.url),
  'utf8',
);
const client = readFileSync(
  new URL('../platform/ios/JanusFounderBiometricClient.swift', import.meta.url),
  'utf8',
);

test('iOS Founder signer pins Secure Enclave, current Face ID set and P-256 signing', () => {
  assert.match(signer, /kSecAttrTokenIDSecureEnclave/);
  assert.match(signer, /\.privateKeyUsage/);
  assert.match(signer, /\.biometryCurrentSet/);
  assert.match(signer, /kSecAttrAccessibleWhenUnlockedThisDeviceOnly/);
  assert.match(signer, /biometryType\s*==\s*\.faceID/);
  assert.match(signer, /ecdsaSignatureMessageX962SHA256/);
  assert.doesNotMatch(signer, /\.deviceOwnerAuthentication\s*[,)]/);
  assert.doesNotMatch(signer, /SecKeyCopyExternalRepresentation\(\s*privateKey/);
});

test('iOS biometric client keeps authority token ephemeral and separates rotation revocation', () => {
  assert.match(client, /authoritySessionToken: String/);
  assert.match(client, /security\.biometric\.enroll/);
  assert.match(client, /security\.biometric\.revoke/);
  assert.match(client, /x-janus-biometric-proof/);
  assert.doesNotMatch(client, /UserDefaults/);
  assert.doesNotMatch(client, /Keychain/);
  assert.match(client, /deleteLocalKeyAfterServerRevocation/);
});
