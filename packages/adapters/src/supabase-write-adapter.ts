import type { ToolAdapter, ToolProgress, ToolRequest, ToolResult } from '../../gateways/src/contracts.js';
import { isRecord, requestJson } from './http-json.js';

/**
 * Supabase WRITE adapter — applies database migrations and runs SQL on projects the
 * Founder allowlists. Verified 2026-10-16 (supabase.com/docs/reference/api):
 *  - POST /v1/projects/{ref}/database/migrations  body { query (required), name?, rollback? }  → 200 {}
 *  - POST /v1/projects/{ref}/database/query       body { query (required), parameters?, read_only? } → 201
 *    (documented by Supabase as an EXPERIMENTAL endpoint that may change).
 *
 * Separate tool + separate credential (SUPABASE_WRITE_ACCESS_TOKEN) so the read-only adapter can never
 * change a database. Every action is forced to explicit Founder approval by the sensitive-action policy and
 * is privileged in the Tool Gateway (idempotency key + audited authority permit).
 *
 * Guards inside the adapter (defence in depth, independent of the planner):
 *  - project must be in the allowlist (JANUS_SUPABASE_WRITE_PROJECTS, comma-separated refs);
 *  - destructive SQL (DROP, TRUNCATE, DELETE/UPDATE without WHERE, ALTER … DROP) is refused unless the
 *    approved input carries allowDestructive: true;
 *  - sql.execute NEVER returns table rows (tenant/client data stays out of Janus): only a row count and
 *    column names. Use migrations for schema changes and sql.execute for controlled maintenance.
 */
export interface SupabaseWriteAdapterOptions {
  tokenProvider?: () => Promise<string | undefined>;
  token?: string;
  allowedProjectRefs?: readonly string[];
  apiBase?: string;
  fetchImpl?: typeof fetch;
}

const REF = /^[a-z0-9]{20}$/;
const MIGRATION_NAME = /^[a-z0-9_]{1,80}$/;
const MAX_SQL_BYTES = 100 * 1024;

export function stripSqlNoise(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Returns a short reason when the SQL is destructive, otherwise null. */
export function destructiveSqlReason(sql: string): string | null {
  const clean = stripSqlNoise(sql);
  if (/\bdrop\s+(table|schema|database|column|index|view|function|policy|trigger|type|extension|role)\b/i.test(clean)) return 'contiene DROP';
  if (/\btruncate\b/i.test(clean)) return 'contiene TRUNCATE';
  if (/\balter\s+table\b[^;]*\bdrop\b/i.test(clean)) return 'contiene ALTER TABLE … DROP';
  for (const statement of clean.split(';')) {
    if (/^\s*delete\s+from\b/i.test(statement) && !/\bwhere\b/i.test(statement)) return 'DELETE sin WHERE';
    if (/^\s*update\b/i.test(statement) && !/\bwhere\b/i.test(statement)) return 'UPDATE sin WHERE';
  }
  return null;
}

export class SupabaseWriteAdapter implements ToolAdapter {
  readonly name = 'supabase-write';
  readonly capabilities: string[] = ['migration.apply', 'sql.execute'];
  private readonly apiBase: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: SupabaseWriteAdapterOptions = {}) {
    this.apiBase = (options.apiBase ?? 'https://api.supabase.com').replace(/\/$/, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async execute(request: ToolRequest, onProgress: (progress: ToolProgress) => void | Promise<void>): Promise<ToolResult> {
    if (!this.capabilities.includes(request.action)) return { ok: false, error: `Unsupported Supabase write action: ${request.action}` };
    const input = request.input;
    const ref = typeof input.projectRef === 'string' ? input.projectRef.trim() : '';
    if (!REF.test(ref)) return { ok: false, error: 'Supabase input projectRef is invalid (20 lowercase letters/digits)' };
    if (!this.options.allowedProjectRefs?.includes(ref)) return { ok: false, error: `Project ${ref} is not in the Founder's Supabase write allowlist (JANUS_SUPABASE_WRITE_PROJECTS)` };
    const sql = typeof input.sql === 'string' ? input.sql : '';
    if (!sql.trim()) return { ok: false, error: 'Supabase write actions need non-empty sql' };
    if (Buffer.byteLength(sql, 'utf8') > MAX_SQL_BYTES) return { ok: false, error: 'Supabase sql is too large (100 KiB max)' };
    const destructive = destructiveSqlReason(sql);
    if (destructive && input.allowDestructive !== true) {
      return { ok: false, error: `Destructive SQL refused (${destructive}). The Founder must approve it explicitly with allowDestructive: true.` };
    }
    const token = (this.options.tokenProvider ? await this.options.tokenProvider() : this.options.token)?.trim();
    if (!token) return { ok: false, error: 'Supabase write is not authenticated (SUPABASE_WRITE_ACCESS_TOKEN).' };
    const headers = { authorization: `Bearer ${token}` };
    const base = `${this.apiBase}/v1/projects/${ref}/database`;

    if (request.action === 'migration.apply') {
      const name = typeof input.name === 'string' ? input.name.trim() : '';
      if (name && !MIGRATION_NAME.test(name)) return { ok: false, error: 'Supabase migration name must be snake_case (a-z, 0-9, _; 80 max)' };
      await onProgress({ phase: 'progress', message: `Supabase: aplicando migración${name ? ` ${name}` : ''}`, percent: 50 });
      const result = await requestJson({ fetchImpl: this.fetchImpl, url: `${base}/migrations`, method: 'POST', headers, body: { query: sql, ...(name ? { name } : {}) }, service: 'Supabase', timeoutMs: 60_000 });
      if (!result.ok) return { ok: false, error: result.error };
      return {
        ok: true,
        output: { projectRef: ref, migration: name || null, applied: true, destructiveApproved: Boolean(destructive), note: 'Verifica después con supabase.migrations.list y supabase.advisors.security.' },
        externalReference: `supabase:${ref}/migration/${name || 'unnamed'}`,
      };
    }

    await onProgress({ phase: 'progress', message: `Supabase: ejecutando SQL en ${ref}`, percent: 50 });
    const result = await requestJson({ fetchImpl: this.fetchImpl, url: `${base}/query`, method: 'POST', headers, body: { query: sql }, service: 'Supabase', timeoutMs: 60_000 });
    if (!result.ok) return { ok: false, error: result.error };
    const rows = Array.isArray(result.body) ? result.body.filter(isRecord) : [];
    return {
      ok: true,
      output: { projectRef: ref, executed: true, rowCount: rows.length, columns: rows[0] ? Object.keys(rows[0]).slice(0, 50) : [], rowsReturned: false, destructiveApproved: Boolean(destructive) },
      externalReference: `supabase:${ref}/sql`,
    };
  }
}
