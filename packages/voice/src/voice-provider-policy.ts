/** Voice selection metadata only. Provider credentials must remain in a secret store. */
export type VoiceProvider = "elevenlabs" | "local";
export interface VoiceChoice {
  readonly provider: VoiceProvider;
  readonly providerVoiceId: string;
  readonly canonicalVoiceId: string;
  readonly mode: "temporary" | "approved-local";
}
export interface VoiceSelectionResult {
  readonly accepted: boolean;
  readonly reason: string;
  readonly choice?: VoiceChoice;
}
export function validateVoiceChoice(
  requested: VoiceChoice,
  availableVoiceIds: Readonly<Record<VoiceProvider, readonly string[]>>,
): VoiceSelectionResult {
  if (!requested.canonicalVoiceId.trim() || !requested.providerVoiceId.trim())
    return { accepted: false, reason: "voice identifiers required" };
  if (requested.mode === "approved-local" && requested.provider !== "local")
    return { accepted: false, reason: "approved-local requires local provider" };
  if (!availableVoiceIds[requested.provider].includes(requested.providerVoiceId))
    return { accepted: false, reason: "voice must be listed by connected provider" };
  return { accepted: true, reason: "voice metadata validated; runtime activation still required", choice: requested };
}
export const voiceIndependenceRules = Object.freeze({
  providerIsReplaceable: true,
  voiceChoiceTemporaryByDefault: true,
  approvedVoiceConsentRequired: true,
  clonedAudioStaysLocal: true,
  noSecretInSQLite: true,
  noUnapprovedVoiceImpersonation: true,
  offlineFallback: "local",
  noProviderModelExtraction: true,
});
