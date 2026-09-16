export type ModelCapability =
  | 'reasoning'
  | 'coding'
  | 'vision'
  | 'long_context'
  | 'tool_use'
  | 'structured_output'
  | 'fast'
  | 'local';

export interface ModelProfile {
  id: string;
  provider: string;
  capabilities: ModelCapability[];
  contextWindow: number;
  maxOutputTokens?: number;
  local: boolean;
  enabled: boolean;
  estimatedInputCostPerMillion?: number;
  estimatedOutputCostPerMillion?: number;
  latencyClass?: 'low' | 'medium' | 'high';
}

export interface ModelTaskRequirements {
  requiredCapabilities?: ModelCapability[];
  preferredCapabilities?: ModelCapability[];
  minimumContextWindow?: number;
  minimumOutputTokens?: number;
  requireLocal?: boolean;
  preferLocal?: boolean;
  preferLowLatency?: boolean;
  preferLowCost?: boolean;
}

export interface ModelRouteDecision {
  selected: ModelProfile;
  alternatives: ModelProfile[];
  reasons: string[];
}

export function routeModel(
  profiles: readonly ModelProfile[],
  requirements: ModelTaskRequirements,
): ModelRouteDecision {
  const required = new Set(requirements.requiredCapabilities ?? []);
  const preferred = new Set(requirements.preferredCapabilities ?? []);

  const eligible = profiles.filter((profile) => {
    if (!profile.enabled) return false;
    if (requirements.requireLocal && !profile.local) return false;
    if ((requirements.minimumContextWindow ?? 0) > profile.contextWindow) return false;
    if ((requirements.minimumOutputTokens ?? 0) > (profile.maxOutputTokens ?? Number.POSITIVE_INFINITY)) return false;
    return [...required].every((capability) => profile.capabilities.includes(capability));
  });

  if (eligible.length === 0) {
    throw new Error('No configured model satisfies the task requirements');
  }

  const ranked = eligible
    .map((profile) => ({ profile, score: scoreProfile(profile, requirements, preferred) }))
    .sort((a, b) => b.score - a.score || a.profile.id.localeCompare(b.profile.id));

  const selected = ranked[0]!.profile;
  const reasons = buildReasons(selected, requirements, preferred);
  return {
    selected,
    alternatives: ranked.slice(1).map((item) => item.profile),
    reasons,
  };
}

function scoreProfile(
  profile: ModelProfile,
  requirements: ModelTaskRequirements,
  preferred: ReadonlySet<ModelCapability>,
): number {
  let score = 0;
  for (const capability of preferred) {
    if (profile.capabilities.includes(capability)) score += 20;
  }
  if (requirements.preferLocal && profile.local) score += 35;
  if (requirements.preferLowLatency) {
    score += profile.latencyClass === 'low' ? 20 : profile.latencyClass === 'medium' ? 8 : 0;
  }
  if (requirements.preferLowCost) {
    const cost = (profile.estimatedInputCostPerMillion ?? 0) + (profile.estimatedOutputCostPerMillion ?? 0);
    score += cost === 0 ? 20 : Math.max(0, 20 - Math.log10(cost + 1) * 8);
  }
  score += Math.min(12, Math.log2(Math.max(1, profile.contextWindow / 8_192)) * 2);
  return score;
}

function buildReasons(
  profile: ModelProfile,
  requirements: ModelTaskRequirements,
  preferred: ReadonlySet<ModelCapability>,
): string[] {
  const reasons: string[] = [];
  const matched = [...preferred].filter((capability) => profile.capabilities.includes(capability));
  if (matched.length > 0) reasons.push(`preferred capabilities: ${matched.join(', ')}`);
  if (requirements.requireLocal) reasons.push('local execution required');
  else if (requirements.preferLocal && profile.local) reasons.push('local execution preferred');
  if (requirements.minimumContextWindow) reasons.push(`context >= ${requirements.minimumContextWindow}`);
  if (requirements.preferLowLatency && profile.latencyClass === 'low') reasons.push('low-latency profile');
  if (requirements.preferLowCost) reasons.push('cost-aware routing enabled');
  return reasons;
}
