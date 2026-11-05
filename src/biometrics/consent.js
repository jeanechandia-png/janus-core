/** Local-first biometric consent policy. No raw face images, embeddings or recordings are persisted here. */
export class BiometricConsentRegistry {
  constructor({ clock = () => new Date().toISOString() } = {}) {
    this.clock = clock;
    this.grants = new Map();
  }
  grant({ subjectId, modality, guardianApproved = false, subjectApproved = false, minor = false }) {
    if (!subjectId || !["face", "voice-clone"].includes(modality)) throw new Error("Invalid biometric request");
    if (!subjectApproved || (minor && !guardianApproved)) throw new Error("Explicit consent required");
    const key = JSON.stringify([subjectId, modality]);
    const record = Object.freeze({ subjectId, modality, minor, grantedAt: this.clock() });
    this.grants.set(key, record);
    return record;
  }
  revoke(subjectId, modality) {
    return this.grants.delete(JSON.stringify([subjectId, modality]));
  }
  require(subjectId, modality) {
    const grant = this.grants.get(JSON.stringify([subjectId, modality]));
    if (!grant) throw new Error("Biometric operation blocked: consent missing or revoked");
    return grant;
  }
}
/** Adapter boundary: the caller must supply an authorized, provider-specific implementation. */
export async function runBiometricOperation({ registry, subjectId, modality, adapter, payload }) {
  registry.require(subjectId, modality);
  if (typeof adapter !== "function") throw new Error("Biometric adapter unavailable");
  return adapter(payload);
}
