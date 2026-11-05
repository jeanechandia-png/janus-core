import { strict as assert } from "node:assert";
import { test } from "node:test";
import { classifySpokenOperation, spokenOperationExecutionRules } from "../packages/core/src/spoken-operation-policy.js";
import { validateVoiceChoice, voiceIndependenceRules } from "../packages/voice/src/voice-provider-policy.js";
const proposal = { kind: "website.product.remove" as const, transcript: "borra este producto", actorId: "founder", authenticated: true, source: "voice" as const, idempotencyKey: "unique-1" };
test("spoken website deletion is high risk and never directly publishes", () => {
  const result = classifySpokenOperation(proposal);
  assert.equal(result.risk, "high");
  assert.equal(result.approvalRequired, true);
  assert.equal(result.publishAllowed, false);
});
test("voice transcript cannot authenticate itself", () => {
  const result = classifySpokenOperation({ ...proposal, authenticated: false });
  assert.equal(result.approvalRequired, true);
  assert.equal(result.publishAllowed, false);
});
test("memory correction requires verification and approval", () => {
  assert.equal(classifySpokenOperation({ ...proposal, kind: "memory.correct" }).risk, "medium");
  assert.equal(spokenOperationExecutionRules.queueOfflineThenRevalidate, true);
});
test("ElevenLabs voice selection is provider-checked and temporary", () => {
  const choice = { provider: "elevenlabs" as const, providerVoiceId: "v1", canonicalVoiceId: "janus-temp", mode: "temporary" as const };
  assert.equal(validateVoiceChoice(choice, { elevenlabs: ["v1"], local: [] }).accepted, true);
  assert.equal(validateVoiceChoice(choice, { elevenlabs: [], local: [] }).accepted, false);
  assert.equal(voiceIndependenceRules.noProviderModelExtraction, true);
});
