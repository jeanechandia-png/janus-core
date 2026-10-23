import type { BlueprintToolPolicy, DecisionBlueprint } from './decision-blueprint.js';

/**
 * Run policy derived from a speaker-recognition HINT (convenience only).
 *
 * This is a privacy safeguard, not a security boundary: when the voice is positively matched to someone
 * other than the owner (e.g. a minor in the household), the run is started with a reduced tool catalogue so
 * that the owner's mail, files, calendar and business tools are not reachable by that voice. A voice that is
 * unknown, ambiguous or too short keeps today's behaviour (voice still cannot perform privileged actions:
 * those require an authenticated authority, see ADR-005/006/008).
 */
export interface SpeakerLike {
  decision: 'match' | 'ambiguous' | 'unknown' | 'insufficient_audio';
  profile?: 'owner' | 'household_adult' | 'minor';
}

export interface SpeakerRunPolicy {
  restricted: boolean;
  allowedTools: readonly string[];
  reason: string;
}

/** Read-only, local, non-personal tools that are safe for any household member. */
export const HOUSEHOLD_SAFE_TOOLS: readonly string[] = Object.freeze(['seneca', 'marcus-aurelius']);

export function policyForSpeaker(speaker: SpeakerLike | undefined): SpeakerRunPolicy {
  if (!speaker || speaker.decision !== 'match' || speaker.profile === 'owner' || !speaker.profile) {
    return { restricted: false, allowedTools: [], reason: 'No restriction: owner, unknown or no speaker hint.' };
  }
  return {
    restricted: true,
    allowedTools: HOUSEHOLD_SAFE_TOOLS,
    reason: speaker.profile === 'minor'
      ? 'Recognised household minor: only household-safe tools.'
      : 'Recognised household member (not the owner): only household-safe tools.',
  };
}

export function restrictBlueprintTools(blueprint: DecisionBlueprint, allowedTools: readonly string[]): DecisionBlueprint {
  const tools: BlueprintToolPolicy[] = blueprint.tools.filter((policy) => allowedTools.includes(policy.tool));
  return { ...blueprint, tools };
}
