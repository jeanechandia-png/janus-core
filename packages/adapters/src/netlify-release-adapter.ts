import type { ToolAdapter, ToolProgress, ToolRequest, ToolResult } from '../../gateways/src/contracts.js';
import { isRecord, requestJson } from './http-json.js';

/**
 * Netlify RELEASE adapter — the only Netlify write Janus has: restoring
 * (rolling back to) a previous deploy of a site. Verified against
 * @netlify/open-api 2.60.0: POST /api/v1/sites/{site_id}/deploys/{deploy_id}/restore (restoreSiteDeploy).
 *
 * Separate tool + separate credential (NETLIFY_RELEASE_TOKEN) so the read-only
 * adapter can never change production. `deploy.restore` changes what visitors
 * see → forced to explicit approval by the sensitive-action policy, and it is
 * privileged in the TaskRunner (authenticated authority). Sites can be limited
 * with an allowlist (JANUS_NETLIFY_RELEASE_SITES, comma-separated site ids).
 */
export interface NetlifyReleaseAdapterOptions {
  tokenProvider?: () => Promise<string | undefined>;
  token?: string;
  allowedSiteIds?: readonly string[];
  apiBase?: string;
  fetchImpl?: typeof fetch;
}

const ID = /^[A-Za-z0-9._-]{1,100}$/;

export class NetlifyReleaseAdapter implements ToolAdapter {
  readonly name = 'netlify-release';
  readonly capabilities: string[] = ['deploy.restore'];
  private readonly apiBase: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: NetlifyReleaseAdapterOptions = {}) {
    this.apiBase = (options.apiBase ?? 'https://api.netlify.com/api/v1').replace(/\/$/, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async execute(request: ToolRequest, onProgress: (progress: ToolProgress) => void | Promise<void>): Promise<ToolResult> {
    if (!this.capabilities.includes(request.action)) return { ok: false, error: `Unsupported Netlify release action: ${request.action}` };
    const siteId = typeof request.input.siteId === 'string' ? request.input.siteId.trim() : '';
    const deployId = typeof request.input.deployId === 'string' ? request.input.deployId.trim() : '';
    if (!ID.test(siteId) || !ID.test(deployId)) return { ok: false, error: 'Netlify deploy.restore needs valid siteId and deployId' };
    if (!this.options.allowedSiteIds?.includes(siteId)) return { ok: false, error: `Site ${siteId} is not in the Founder's Netlify release allowlist` };
    const token = (this.options.tokenProvider ? await this.options.tokenProvider() : this.options.token)?.trim();
    if (!token) return { ok: false, error: 'Netlify release is not authenticated (NETLIFY_RELEASE_TOKEN).' };
    await onProgress({ phase: 'progress', message: `Netlify: restaurando despliegue ${deployId}`, percent: 50 });
    const result = await requestJson({
      fetchImpl: this.fetchImpl,
      url: `${this.apiBase}/sites/${encodeURIComponent(siteId)}/deploys/${encodeURIComponent(deployId)}/restore`,
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      service: 'Netlify',
    });
    if (!result.ok) return { ok: false, error: result.error };
    const deploy = isRecord(result.body) ? result.body : {};
    return {
      ok: true,
      output: { siteId, deployId: deploy.id ?? deployId, state: deploy.state ?? null, commitSha: deploy.commit_ref ?? null, note: 'Verifica después con netlify.site.published_deploy.' },
      externalReference: `netlify:site/${siteId}/deploy/${deployId}/restore`,
    };
  }
}
