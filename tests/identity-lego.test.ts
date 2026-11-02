import { test } from "node:test";
import assert from "node:assert/strict";
import { IdentityLego, assertConsent } from "../packages/identity-lego/contracts.js";
const consent = { subject: "jean" as const, purpose: "voice-synthesis" as const, grantedBy: "jean", grantedAt: "2026-11-01T00:00:00Z" };
test("consent enforces purpose, revocation and expiry", () => {
  assert.doesNotThrow(() => assertConsent(consent, "jean", "voice-synthesis", new Date("2026-11-02")));
  assert.throws(() => assertConsent(consent, "kendra", "voice-synthesis"));
  assert.throws(() => assertConsent({ ...consent, revokedAt: "2026-11-02" }, "jean", "voice-synthesis"));
  assert.throws(() => assertConsent({ ...consent, expiresAt: "2026-11-01" }, "jean", "voice-synthesis"));
});
test("adapters are replaceable and identity never authorizes privileged actions", async () => {
  const identity = new IdentityLego(
    { id: "local-tts", synthesize: async () => new Uint8Array([1]) },
    { id: "local-face", recognize: async () => ({ subject: "jean", confidence: 0.99 }) },
    { id: "local-speaker", recognize: async () => ({ subject: "kendra", confidence: 0.98 }) },
  );
  assert.deepEqual(await identity.synthesize({ subject: "jean", text: "hola", consent }), new Uint8Array([1]));
  assert.equal((await identity.recognizeFace(new Uint8Array([1])))?.authorized, false);
  assert.equal((await identity.recognizeVoice(new Uint8Array([1])))?.subject, "kendra");
  await assert.rejects(identity.synthesize({ subject: "kendra", text: "hola", consent }));
});
