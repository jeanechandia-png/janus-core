import type { ToolAdapter, ToolProgress, ToolRequest, ToolResult } from '../../gateways/src/contracts.js';
import { cleanId, isRecord, requestJson } from './http-json.js';

/**
 * Read-only Vercel adapter. Verified 2026-10-14 (vercel.com/docs/rest-api):
 * GET https://api.vercel.com/v7/deployments (projectId, target, state, limit, teamId),
 * GET https://api.vercel.com/v13/deployments/{idOrUrl} (teamId, withGitRepoInfo); Bearer token.
 * It never deploys, promotes, rolls back or changes domains — those stay with the Founder.
 */
export interface VercelAdapterOptions {
  tokenProvider?: () => Promise<string | undefined>;
  token?: string;
  defaultTeamId?: string;
  apiBase?: string;
  fetchImpl?: typeof fetch;
}

const ID = /^[A-Za-z0-9_.-]{1,120}$/;
const STATES = new Set(['BUILDING', 'ERROR', 'INITIALIZING', 'QUEUED', 'READY', 'CANCELED', 'BLOCKED']);

export class VercelAdapter implements ToolAdapter {
  readonly name = 'vercel';
  readonly capabilities: string[] = ['deployments.list', 'deployment.get'];
  private readonly apiBase: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: VercelAdapterOptions = {}) {
    this.apiBase = (options.apiBase ?? 'https://api.vercel.com').replace(/\/$/, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async execute(request: ToolRequest, onProgress: (progress: ToolProgress) => void | Promise<void>): Promise<ToolResult> {
    if (!this.capabilities.includes(request.action)) return { ok: false, error: `Unsupported Vercel action: ${request.action}` };
    const token = (this.options.tokenProvider ? await this.options.tokenProvider() : this.options.token)?.trim();
    if (!token) return { ok: false, error: 'Vercel is not authenticated; provide a read token through the secure credential provider.' };
    const input = request.input;
    const teamId = cleanId(input.teamId, ID) ?? cleanId(this.options.defaultTeamId, ID);
    const team = teamId ? `teamId=${encodeURIComponent(teamId)}` : '';
    const headers = { authorization: `Bearer ${token}` };

    if (request.action === 'deployments.list') {
      const params = new URLSearchParams();
      const projectId = cleanId(input.projectId, ID);
      if (projectId) params.set('projectId', projectId);
      if (input.target === 'production' || input.target === 'preview') params.set('target', input.target);
      if (typeof input.state === 'string' && STATES.has(input.state.toUpperCase())) params.set('state', input.state.toUpperCase());
      params.set('limit', String(Math.min(20, Math.max(1, Number(input.limit) || 10))));
      if (teamId) params.set('teamId', teamId);
      await onProgress({ phase: 'progress', message: 'Vercel: despliegues', percent: 40 });
      const result = await requestJson({ fetchImpl: this.fetchImpl, url: `${this.apiBase}/v7/deployments?${params}`, headers, service: 'Vercel' });
      if (!result.ok) return { ok: false, error: result.error };
      const deployments = isRecord(result.body) && Array.isArray(result.body.deployments) ? result.body.deployments.filter(isRecord) : [];
      return { ok: true, output: { deployments: deployments.map(summary) } };
    }

    const idOrUrl = cleanId(input.idOrUrl, ID);
    if (!idOrUrl) return { ok: false, error: 'Vercel deployment.get needs idOrUrl' };
    await onProgress({ phase: 'progress', message: `Vercel: despliegue ${idOrUrl}`, percent: 40 });
    const query = ['withGitRepoInfo=true', team].filter(Boolean).join('&');
    const result = await requestJson({ fetchImpl: this.fetchImpl, url: `${this.apiBase}/v13/deployments/${encodeURIComponent(idOrUrl)}?${query}`, headers, service: 'Vercel' });
    if (!result.ok) return { ok: false, error: result.error };
    if (!isRecord(result.body)) return { ok: false, error: 'Vercel deployment response is malformed' };
    const body = result.body;
    const git = isRecord(body.gitSource) ? body.gitSource : {};
    return {
      ok: true,
      output: {
        ...summary(body),
        id: body.id ?? body.uid ?? null,
        aliases: Array.isArray(body.alias) ? body.alias.filter((item) => typeof item === 'string') : [],
        commitSha: typeof git.sha === 'string' ? git.sha : null,
        branch: typeof git.ref === 'string' ? git.ref : null,
      },
    };
  }
}

function summary(item: Record<string, unknown>): Record<string, unknown> {
  return {
    uid: item.uid ?? item.id ?? null,
    name: item.name ?? null,
    url: item.url ?? null,
    state: item.state ?? item.readyState ?? null,
    target: item.target ?? null,
    readySubstate: item.readySubstate ?? null,
    createdAt: item.createdAt ?? item.created ?? null,
    projectId: item.projectId ?? null,
  };
}
