import type { ToolAdapter, ToolProgress, ToolRequest, ToolResult } from '../../gateways/src/contracts.js';
import { isRecord, requestJson } from './http-json.js';

/**
 * Supabase Management API adapter — READ-ONLY operations/health view.
 * Verified 2026-10-14 (supabase.com/docs/reference/api + official
 * supabase-management-js 2.0.2 client): base https://api.supabase.com, Bearer PAT/OAuth,
 * 120 req/min; GET /v1/projects, GET /v1/projects/{ref}/health?services=…,
 * GET /v1/projects/{ref}/advisors/security|performance, GET /v1/projects/{ref}/database/migrations.
 *
 * By design it never runs SQL, never reads table rows, never changes config,
 * keys, branches or backups: client/tenant data stays out of Janus (GDPR,
 * tenant isolation). A personal access token has broad account access, so
 * only GET requests exist in this adapter.
 */
export interface SupabaseManagementAdapterOptions {
  tokenProvider?: () => Promise<string | undefined>;
  token?: string;
  apiBase?: string;
  fetchImpl?: typeof fetch;
}

const REF = /^[a-z0-9]{20}$/;
const SERVICES = ['auth', 'db', 'db_postgres_user', 'pooler', 'realtime', 'rest', 'storage', 'pg_bouncer'];

export class SupabaseManagementAdapter implements ToolAdapter {
  readonly name = 'supabase';
  readonly capabilities: string[] = ['projects.list', 'project.health', 'advisors.security', 'advisors.performance', 'migrations.list'];
  private readonly apiBase: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: SupabaseManagementAdapterOptions = {}) {
    this.apiBase = (options.apiBase ?? 'https://api.supabase.com').replace(/\/$/, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async execute(request: ToolRequest, onProgress: (progress: ToolProgress) => void | Promise<void>): Promise<ToolResult> {
    if (!this.capabilities.includes(request.action)) return { ok: false, error: `Unsupported Supabase action: ${request.action}` };
    const token = (this.options.tokenProvider ? await this.options.tokenProvider() : this.options.token)?.trim();
    if (!token) return { ok: false, error: 'Supabase is not authenticated; provide an access token through the secure credential provider.' };
    const headers = { authorization: `Bearer ${token}` };

    if (request.action === 'projects.list') {
      await onProgress({ phase: 'progress', message: 'Supabase: proyectos', percent: 40 });
      const result = await requestJson({ fetchImpl: this.fetchImpl, url: `${this.apiBase}/v1/projects`, headers, service: 'Supabase' });
      if (!result.ok) return { ok: false, error: result.error };
      const projects = Array.isArray(result.body) ? result.body.filter(isRecord) : [];
      return { ok: true, output: { projects: projects.map((project) => ({ ref: project.id ?? project.ref ?? null, name: project.name ?? null, region: project.region ?? null, status: project.status ?? null, createdAt: project.created_at ?? null })) } };
    }

    const ref = typeof request.input.projectRef === 'string' ? request.input.projectRef.trim() : '';
    if (!REF.test(ref)) return { ok: false, error: 'Supabase input projectRef is invalid (20 lowercase letters/digits)' };
    const base = `${this.apiBase}/v1/projects/${ref}`;

    if (request.action === 'project.health') {
      const requested = Array.isArray(request.input.services) ? request.input.services.filter((item): item is string => typeof item === 'string' && SERVICES.includes(item)) : [];
      const services = requested.length ? requested : ['auth', 'db', 'rest', 'storage', 'realtime'];
      await onProgress({ phase: 'progress', message: `Supabase: salud de ${ref}`, percent: 40 });
      const result = await requestJson({ fetchImpl: this.fetchImpl, url: `${base}/health?services=${services.join(',')}`, headers, service: 'Supabase' });
      if (!result.ok) return { ok: false, error: result.error };
      const items = Array.isArray(result.body) ? result.body.filter(isRecord) : [];
      const health = items.map((item) => ({ service: item.name ?? null, healthy: item.healthy ?? null, status: item.status ?? null, error: typeof item.error === 'string' ? item.error.slice(0, 300) : null }));
      return { ok: true, output: { projectRef: ref, allHealthy: health.length > 0 && health.every((item) => item.healthy === true), services: health } };
    }

    if (request.action === 'migrations.list') {
      await onProgress({ phase: 'progress', message: `Supabase: migraciones de ${ref}`, percent: 40 });
      const result = await requestJson({ fetchImpl: this.fetchImpl, url: `${base}/database/migrations`, headers, service: 'Supabase' });
      if (!result.ok) return { ok: false, error: result.error };
      const items = Array.isArray(result.body) ? result.body.filter(isRecord) : [];
      return { ok: true, output: { projectRef: ref, migrations: items.map((item) => ({ version: item.version ?? null, name: item.name ?? null })) } };
    }

    const kind = request.action === 'advisors.security' ? 'security' : 'performance';
    await onProgress({ phase: 'progress', message: `Supabase: asesor de ${kind === 'security' ? 'seguridad' : 'rendimiento'}`, percent: 40 });
    const result = await requestJson({ fetchImpl: this.fetchImpl, url: `${base}/advisors/${kind}`, headers, service: 'Supabase' });
    if (!result.ok) return { ok: false, error: result.error };
    const lints = isRecord(result.body) && Array.isArray(result.body.lints) ? result.body.lints.filter(isRecord) : [];
    const findings = lints.map((lint) => ({ name: lint.name ?? null, title: lint.title ?? null, level: lint.level ?? null, facing: lint.facing ?? null, categories: Array.isArray(lint.categories) ? lint.categories : [], remediation: lint.remediation ?? null }));
    const counts: Record<string, number> = {};
    for (const finding of findings) counts[String(finding.level)] = (counts[String(finding.level)] ?? 0) + 1;
    return { ok: true, output: { projectRef: ref, kind, counts, findings } };
  }
}
