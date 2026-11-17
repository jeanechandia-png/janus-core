/**
 * JANUS CORE — non-destructive cross-agent checkout gate.
 * Pure logic: local state remains usable offline, but an unverifiable checkout
 * must never be represented as synchronized or publishable.
 */
export const CANONICAL_JANUS_REPOSITORY = 'jeanechandia-png/janus-core';

export type ContinuityGateState = 'ready' | 'local-only' | 'blocked';

export interface ContinuityGateInput {
  originUrl?: string;
  branch?: string;
  headSha?: string;
  baseRef?: string;
  baseSha?: string;
  baseAncestor?: boolean;
  fetchVerified: boolean;
  offlineAllowed?: boolean;
  requiredFilesPresent: boolean;
}

export interface ContinuityGateResult {
  state: ContinuityGateState;
  reasons: string[];
  repository?: string;
}

/** Supports common GitHub remote forms; rejects lookalike hosts and forks. */
export function repositoryFromGitRemote(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const remote = url.trim();
  const match = /^(?:https:\/\/github\.com\/|ssh:\/\/git@github\.com\/|git@github\.com:)([^\s]+)$/i.exec(remote);
  if (!match) return undefined;
  const path = match[1]!.replace(/\/$/, '').replace(/\.git$/i, '');
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(path)) return undefined;
  return path.toLowerCase();
}

/**
 * Fails closed for wrong repos/branches. If the network is unavailable, an
 * explicit offline request allows local editing only (never publication).
 */
export function evaluateContinuityGate(input: ContinuityGateInput): ContinuityGateResult {
  const repository = repositoryFromGitRemote(input.originUrl);
  const reasons: string[] = [];
  if (repository !== CANONICAL_JANUS_REPOSITORY) {
    reasons.push('El remoto origin no identifica el repositorio canónico JANUS.');
  }
  if (!input.branch || input.branch === 'HEAD') {
    reasons.push('HEAD desacoplado o rama no identificada.');
  } else if (input.branch === 'main') {
    reasons.push('Trabaja en una rama del mismo repositorio; no edites main directamente.');
  }
  if (!input.headSha) reasons.push('No se ha verificado el commit local.');
  if (!input.requiredFilesPresent) reasons.push('Faltan archivos esenciales del producto JANUS.');
  if (reasons.length) return { state: 'blocked', reasons, ...(repository ? { repository } : {}) };

  if (!input.fetchVerified) {
    return {
      state: input.offlineAllowed ? 'local-only' : 'blocked',
      reasons: [input.offlineAllowed
        ? 'Sin verificación remota: trabajo LOCAL permitido; publicar, fusionar y desplegar están bloqueados hasta revalidar.'
        : 'No se pudo sincronizar la rama base remota: no se permite comenzar desde estado no verificado.'],
      repository,
    };
  }
  if (!input.baseRef || !input.baseSha) {
    return { state: 'blocked', reasons: ['No existe la referencia remota de la rama base seleccionada.'], repository };
  }
  if (!input.baseAncestor) {
    return {
      state: 'blocked',
      reasons: ['La rama de trabajo no contiene el último commit de su rama base remota. Reconcilia el historial antes de escribir.'],
      repository,
    };
  }
  return { state: 'ready', reasons: [], repository };
}
