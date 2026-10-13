import type { ToolAdapter, ToolProgress, ToolRequest, ToolResult } from '../../gateways/src/contracts.js';
import { cleanId, isRecord, requestJson } from './http-json.js';

/**
 * n8n adapter. Verified 2026-10-14 (docs.n8n.io): public REST API at {instance}/api/v1 with header
 * `X-N8N-API-KEY`; GET /workflows (active, limit ≤250, cursor), GET /executions (workflowId, status, limit ≤250, cursor),
 * GET /executions/{id}; responses paginate with `nextCursor`. Not available on the free trial.
 *
 * Triggering is done ONLY through webhook URLs the Founder allowlists by name (JANUS_N8N_WEBHOOKS JSON),
 * never arbitrary URLs. `workflow.trigger` is an external action → forced to explicit approval.
 */
export interface N8nAdapterOptions {
  baseUrl?: string;
  tokenProvider?: () => Promise<string | undefined>;
  token?: string;
  webhooks?: Readonly<Record<string, string>>;
  fetchImpl?: typeof fetch;
}

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const STATUS = new Set(['canceled', 'crashed', 'error', 'new', 'running', 'success', 'unknown', 'waiting']);

export function parseN8nWebhooks(value: string | undefined): Record<string, string> {
  if (!value?.trim()) return {};
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error('JANUS_N8N_WEBHOOKS must be a JSON object { name: https-url }'); }
  if (!isRecord(parsed)) throw new Error('JANUS_N8N_WEBHOOKS must be a JSON object { name: https-url }');
  const out: Record<string, string> = {};
  for (const [name, url] of Object.entries(parsed)) {
    if (!ID.test(name) || typeof url !== 'string' || !url.startsWith('https://')) throw new Error('JANUS_N8N_WEBHOOKS entries must be name → https URL');
    out[name] = url;
  }
  return out;
}

export class N8nAdapter implements ToolAdapter {
  readonly name = 'n8n';
  readonly capabilities: string[] = ['workflows.list', 'executions.list', 'execution.get', 'workflow.trigger'];
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: N8nAdapterOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async execute(request: ToolRequest, onProgress: (progress: ToolProgress) => void | Promise<void>): Promise<ToolResult> {
    if (!this.capabilities.includes(request.action)) return { ok: false, error: `Unsupported n8n action: ${request.action}` };
    const input = request.input;

    if (request.action === 'workflow.trigger') {
      const name = cleanId(input.webhook, ID);
      const url = name ? this.options.webhooks?.[name] : undefined;
      if (!url) return { ok: false, error: `n8n webhook "${String(input.webhook)}" is not in the Founder allowlist` };
      const payload = isRecord(input.payload) ? input.payload : {};
      if (JSON.stringify(payload).length > 64 * 1024) return { ok: false, error: 'n8n payload is too large' };
      await onProgress({ phase: 'progress', message: `n8n: disparando ${name}`, percent: 40 });
      const result = await requestJson({ fetchImpl: this.fetchImpl, url, method: 'POST', headers: {}, body: payload, service: 'n8n webhook' });
      if (!result.ok) return { ok: false, error: result.error };
      return { ok: true, output: { webhook: name, response: result.body }, externalReference: `n8n:webhook:${name}` };
    }

    const base = this.options.baseUrl?.trim().replace(/\/$/, '');
    if (!base || !base.startsWith('https://')) return { ok: false, error: 'n8n base URL (https) is not configured (N8N_BASE_URL)' };
    const token = (this.options.tokenProvider ? await this.options.tokenProvider() : this.options.token)?.trim();
    if (!token) return { ok: false, error: 'n8n is not authenticated; provide the API key through the secure credential provider.' };
    const headers = { 'x-n8n-api-key': token };
    const limit = String(Math.min(250, Math.max(1, Number(input.limit) || 50)));
    const cursor = typeof input.cursor === 'string' && /^[A-Za-z0-9+/=_-]{1,500}$/.test(input.cursor) ? input.cursor : undefined;

    if (request.action === 'workflows.list') {
      const params = new URLSearchParams({ limit });
      if (input.active === true || input.active === false) params.set('active', String(input.active));
      if (cursor) params.set('cursor', cursor);
      await onProgress({ phase: 'progress', message: 'n8n: flujos', percent: 40 });
      const result = await requestJson({ fetchImpl: this.fetchImpl, url: `${base}/api/v1/workflows?${params}`, headers, service: 'n8n' });
      if (!result.ok) return { ok: false, error: result.error };
      const body = isRecord(result.body) ? result.body : {};
      const items = Array.isArray(body.data) ? body.data.filter(isRecord) : [];
      return { ok: true, output: { workflows: items.map((item) => ({ id: item.id ?? null, name: item.name ?? null, active: item.active ?? null, updatedAt: item.updatedAt ?? null })), nextCursor: body.nextCursor ?? null } };
    }

    if (request.action === 'executions.list') {
      const params = new URLSearchParams({ limit });
      const workflowId = cleanId(input.workflowId, ID);
      if (workflowId) params.set('workflowId', workflowId);
      if (typeof input.status === 'string' && STATUS.has(input.status)) params.set('status', input.status);
      if (cursor) params.set('cursor', cursor);
      await onProgress({ phase: 'progress', message: 'n8n: ejecuciones', percent: 40 });
      const result = await requestJson({ fetchImpl: this.fetchImpl, url: `${base}/api/v1/executions?${params}`, headers, service: 'n8n' });
      if (!result.ok) return { ok: false, error: result.error };
      const body = isRecord(result.body) ? result.body : {};
      const items = Array.isArray(body.data) ? body.data.filter(isRecord) : [];
      return { ok: true, output: { executions: items.map(executionSummary), nextCursor: body.nextCursor ?? null } };
    }

    const id = cleanId(input.executionId, ID);
    if (!id) return { ok: false, error: 'n8n execution.get needs executionId' };
    await onProgress({ phase: 'progress', message: `n8n: ejecución ${id}`, percent: 40 });
    const result = await requestJson({ fetchImpl: this.fetchImpl, url: `${base}/api/v1/executions/${encodeURIComponent(id)}`, headers, service: 'n8n' });
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, output: executionSummary(isRecord(result.body) ? result.body : {}) };
  }
}

function executionSummary(item: Record<string, unknown>): Record<string, unknown> {
  return { id: item.id ?? null, workflowId: item.workflowId ?? null, status: item.status ?? null, finished: item.finished ?? null, mode: item.mode ?? null, startedAt: item.startedAt ?? null, stoppedAt: item.stoppedAt ?? null };
}
