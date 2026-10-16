import type { ToolAdapter, ToolProgress, ToolRequest, ToolResult } from '../../gateways/src/contracts.js';
import { cleanId, isRecord, requestJson } from './http-json.js';

/**
 * Vercel RELEASE adapter — the only Vercel write Janus has: redeploying an existing deployment.
 * Verified 2026-10-16 (vercel.com/docs/rest-api/deployments/create-a-new-deployment):
 * POST https://api.vercel.com/v13/deployments?forceNew=1[&teamId=…] with body
 * { name, deploymentId, target?, withLatestCommit? } — "to redeploy an existing deployment, provide its
 * deploymentId; all settings are inherited unless explicitly overridden".
 *
 * Separate tool + separate credential (VERCEL_RELEASE_TOKEN). Allowlist of project names
 * (JANUS_VERCEL_RELEASE_PROJECTS, comma-separated). Never touches domains, env vars or promotions.
 * Forced to explicit approval by the sensitive-action policy.
 */
export interface VercelReleaseAdapterOptions {
  tokenProvider?: () => Promise<string | undefined>;
  token?: string;
  allowedProjects?: readonly string[];
  defaultTeamId?: string;
  apiBase?: string;
  fetchImpl?: typeof fetch;
}

const ID = /^[A-Za-z0-9_.-]{1,120}$/;

export class VercelReleaseAdapter implements ToolAdapter {
  readonly name = 'vercel-release';
  readonly capabilities: string[] = ['deployment.redeploy'];
  private readonly apiBase: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: VercelReleaseAdapterOptions = {}) {
    this.apiBase = (options.apiBase ?? 'https://api.vercel.com').replace(/\/$/, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async execute(request: ToolRequest, onProgress: (progress: ToolProgress) => void | Promise<void>): Promise<ToolResult> {
    if (!this.capabilities.includes(request.action)) return { ok: false, error: `Unsupported Vercel release action: ${request.action}` };
    const input = request.input;
    const project = cleanId(input.project, ID);
    const deploymentId = cleanId(input.deploymentId, ID);
    if (!project || !deploymentId) return { ok: false, error: 'Vercel deployment.redeploy needs valid project (name) and deploymentId' };
    if (!this.options.allowedProjects?.includes(project)) return { ok: false, error: `Project ${project} is not in the Founder's Vercel release allowlist (JANUS_VERCEL_RELEASE_PROJECTS)` };
    const target = input.target === 'production' || input.target === 'preview' ? input.target : undefined;
    const token = (this.options.tokenProvider ? await this.options.tokenProvider() : this.options.token)?.trim();
    if (!token) return { ok: false, error: 'Vercel release is not authenticated (VERCEL_RELEASE_TOKEN).' };
    const teamId = cleanId(input.teamId, ID) ?? cleanId(this.options.defaultTeamId, ID);
    const params = new URLSearchParams({ forceNew: '1' });
    if (teamId) params.set('teamId', teamId);
    await onProgress({ phase: 'progress', message: `Vercel: redesplegando ${project}`, percent: 50 });
    const result = await requestJson({
      fetchImpl: this.fetchImpl,
      url: `${this.apiBase}/v13/deployments?${params}`,
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: { name: project, deploymentId, ...(target ? { target } : {}), ...(input.withLatestCommit === true ? { withLatestCommit: true } : {}) },
      service: 'Vercel',
      timeoutMs: 30_000,
    });
    if (!result.ok) return { ok: false, error: result.error };
    const body = isRecord(result.body) ? result.body : {};
    const id = body.id ?? body.uid ?? null;
    return {
      ok: true,
      output: { project, fromDeployment: deploymentId, newDeploymentId: id, state: body.readyState ?? body.state ?? null, url: body.url ?? null, note: 'Sigue el estado con vercel.deployment.get.' },
      externalReference: `vercel:${project}/deployment/${String(id ?? deploymentId)}`,
    };
  }
}
