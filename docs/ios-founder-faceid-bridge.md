# iOS Founder Face ID / Secure Enclave bridge

Status: CODE IMPLEMENTED — physical Founder-device deployment and acceptance test still pending.

## Purpose

This bridge turns a physical Face ID approval on the Founder iPhone into the short-lived cryptographic proof expected by JANUS CORE. Janus never receives Apple's Face ID template, a face image, or the Secure Enclave private key.

Native sources:

- `platform/ios/JanusFounderFaceSigner.swift`
- `platform/ios/JanusFounderBiometricClient.swift`

## Security contract

The signer:

- generates a 256-bit EC private key using `kSecAttrTokenIDSecureEnclave`;
- marks private-key operations with `privateKeyUsage`;
- binds use to `biometryCurrentSet`, so Face ID re-enrollment invalidates the key;
- requires `LAContext.biometryType == .faceID` and does not accept the generic device-passcode policy as a substitute;
- uses `ecdsaSignatureMessageX962SHA256`;
- exports only the P-256 public point and converts it to SPKI PEM for Janus;
- never exports the private key.

Core:

- stores only biometric public-key metadata in SQLite;
- creates single-use enrollment and action challenges;
- requires candidate-key proof of possession before enrollment;
- disables first API enrollment by default;
- requires an already enrolled Face ID proof for key rotation;
- keeps biometric key IDs append-only;
- refuses to revoke the last active Founder Face ID key through the API;
- separates server revocation from optional local Secure Enclave key deletion.

## First-device enrollment

1. Expose JANUS CORE through the already trusted HTTPS authority path. Do not weaken `requireSecureAuthorityTransport`.
2. Temporarily start Janus with `JANUS_ALLOW_BIOMETRIC_BOOTSTRAP=true`. Keep this flag off during normal operation.
3. From an authenticated Founder session, call `JanusFounderBiometricClient.enroll(...)` with a new key ID such as `founder-iphone-01-v1`.
4. Verify the Face ID prompt on the physical device, verify `GET /api/auth/status` reports an active face key, then restart Janus without the bootstrap flag.

A configured `JANUS_FOUNDER_BIOMETRIC_PUBLIC_KEY_PEM` remains an out-of-band bootstrap path when the public key is provisioned manually.

## Rotation

1. Create a new key ID; never reuse a prior ID.
2. Enroll it with `existingKeyIdForRotation`. The old enrolled key must authorize `security.biometric.enroll`.
3. Test an ordinary Founder-only action with the new key.
4. Revoke the old server-side key using the new key to authorize `security.biometric.revoke`; only after success may the native client delete the old local key.

If Face ID enrollment changes and invalidates the only key before a replacement exists, recovery is an explicit local/root procedure. Janus must not silently fall back to an administrator.

## API sequence

Enrollment:

- `POST /api/auth/biometric/enrollment/challenge`
- Face ID signs `challenge.signingPayload` with the candidate Secure Enclave key.
- For rotation only: obtain a one-time proof for `security.biometric.enroll` using the currently enrolled key.
- `POST /api/auth/biometric/enroll` with `confirmAction=enroll_founder_face_key`.

Protected action:

- `POST /api/auth/biometric/challenge` with the exact action.
- Face ID signs the returned payload.
- `POST /api/auth/biometric/verify`.
- Send the resulting one-time proof ID in `x-janus-biometric-proof` to the protected request.

Revocation:

- obtain a one-time proof for `security.biometric.revoke`;
- `POST /api/auth/biometric/keys/:keyId/revoke` with `confirmAction=revoke_founder_face_key`;
- optionally delete the local Secure Enclave key only after the server confirms revocation.

## External platform facts used by the implementation

Apple Security documentation describes Secure Enclave EC keys as 256-bit elliptic-curve keys, `privateKeyUsage` as necessary for private-key signing use, and `biometryCurrentSet` as invalidated when the enrolled biometric set changes.

Primary references:

- https://developer.apple.com/documentation/security/protecting-keys-with-the-secure-enclave
- https://developer.apple.com/documentation/security/secaccesscontrolcreateflags/biometrycurrentset
- https://developer.apple.com/documentation/security/seckeyalgorithm/ecdsasignaturemessagex962sha256

## Acceptance gate

Do not mark physical Face ID end-to-end as HECHO until all of these pass on the actual Founder iPhone:

- Secure Enclave key creation succeeds;
- Face ID is visibly requested for enrollment proof signing;
- Core accepts the candidate-key enrollment proof;
- the public key survives Janus restart through SQLite metadata;
- a Founder-private action succeeds once with a fresh proof and replay fails;
- adding/removing/re-enrolling Face ID invalidates the previous protected key as expected;
- rotation works without revoking the last usable key;
- no private key, face image, biometric template, bearer token, or signing secret is found in Janus SQLite/source/logs.
