/** Janus controls OpenAI usage, never the OpenAI account's billing or secrets. */
export interface OpenAIUsagePolicy {
  readonly enabled: boolean;
  readonly model: string;
  readonly maxInputCharacters: number;
  readonly maxOutputTokens: number;
  readonly dailyRequestLimit: number;
  readonly estimatedDailyUsdLimit: number;
  readonly allowAutomaticModelChanges: false;
  readonly allowBillingChanges: false;
}
export interface OpenAIUsageSnapshot {
  readonly requestsToday: number;
  readonly estimatedSpendTodayUsd: number;
}
export interface OpenAIRequestDecision {
  readonly allowed: boolean;
  readonly reason: string;
}
export function authorizeOpenAIChat(
  policy: OpenAIUsagePolicy,
  usage: OpenAIUsageSnapshot,
  text: string,
): OpenAIRequestDecision {
  if (!policy.enabled) return { allowed: false, reason: "OpenAI disabled" };
  if (!policy.model.trim()) return { allowed: false, reason: "model not configured" };
  if (!text.trim() || text.length > policy.maxInputCharacters || policy.maxInputCharacters <= 0)
    return { allowed: false, reason: "invalid input size" };
  if (!Number.isInteger(policy.maxOutputTokens) || policy.maxOutputTokens < 1)
    return { allowed: false, reason: "invalid output token limit" };
  if (!Number.isInteger(policy.dailyRequestLimit) || policy.dailyRequestLimit < 1 ||
      usage.requestsToday >= policy.dailyRequestLimit)
    return { allowed: false, reason: "daily request limit reached" };
  if (!Number.isFinite(policy.estimatedDailyUsdLimit) || policy.estimatedDailyUsdLimit <= 0 ||
      !Number.isFinite(usage.estimatedSpendTodayUsd) || usage.estimatedSpendTodayUsd >= policy.estimatedDailyUsdLimit)
    return { allowed: false, reason: "estimated daily budget reached or unknown" };
  if (policy.allowAutomaticModelChanges !== false || policy.allowBillingChanges !== false)
    return { allowed: false, reason: "unapproved administrative capability" };
  return { allowed: true, reason: "preflight accepted; actual billing and account credit unverified" };
}
export const openAIManagementCapabilities = Object.freeze({
  chatText: true,
  modelConfigurationProposals: true,
  usageMonitoring: true,
  errorRecovery: true,
  correctionsThroughApproval: true,
  accountBillingChanges: false,
  apiKeyDisclosure: false,
  providerLockIn: false,
});
