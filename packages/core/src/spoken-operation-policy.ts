/** A speech transcript is an instruction proposal, never proof of authority. */
export type SpokenOperationKind =
  | "memory.add" | "memory.correct" | "memory.forget"
  | "website.product.add" | "website.product.update" | "website.product.remove"
  | "website.team.add" | "website.team.update" | "website.team.remove"
  | "website.content.update" | "assistant.profile.sync"
  | "voice.select.temporary";
export type OperationRisk = "low" | "medium" | "high";
export interface SpokenOperationProposal {
  readonly kind: SpokenOperationKind;
  readonly transcript: string;
  readonly targetId?: string;
  readonly proposedValue?: unknown;
  readonly actorId: string;
  readonly authenticated: boolean;
  readonly source: "voice" | "text";
  readonly idempotencyKey: string;
}
export interface SpokenOperationDecision {
  readonly risk: OperationRisk;
  readonly approvalRequired: boolean;
  readonly publishAllowed: false;
  readonly reason: string;
}
const highRisk = new Set<SpokenOperationKind>([
  "memory.forget", "website.product.remove", "website.team.remove",
  "website.content.update", "website.product.add", "website.product.update",
  "website.team.add", "website.team.update", "assistant.profile.sync",
]);
export function classifySpokenOperation(proposal: SpokenOperationProposal): SpokenOperationDecision {
  if (!proposal.authenticated || !proposal.actorId.trim()) {
    return { risk: "high", approvalRequired: true, publishAllowed: false, reason: "authenticated authority required" };
  }
  if (!proposal.transcript.trim() || !proposal.idempotencyKey.trim()) {
    return { risk: "high", approvalRequired: true, publishAllowed: false, reason: "missing transcript or idempotency key" };
  }
  const risk: OperationRisk = highRisk.has(proposal.kind) ? "high"
    : proposal.kind === "memory.correct" ? "medium" : "low";
  return {
    risk,
    approvalRequired: risk !== "low",
    publishAllowed: false,
    reason: risk === "high" ? "preview, founder approval, revision and deployment verification required"
      : risk === "medium" ? "verify existing memory and approve correction" : "local proposal only",
  };
}
/** All external writes must go through the existing Janus authority/approval and Tool Gateway. */
export const spokenOperationExecutionRules = Object.freeze({
  noDirectWebsiteWrites: true,
  noAutomaticDeletion: true,
  requireReadbackVerification: true,
  preservePreviousRevision: true,
  queueOfflineThenRevalidate: true,
  propagateSharedAssistantConfigByVersion: true,
  neverTreatTranscriptAsAuthentication: true,
});
