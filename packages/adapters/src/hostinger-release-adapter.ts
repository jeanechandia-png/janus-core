import type { ToolAdapter, ToolProgress, ToolRequest, ToolResult } from '../../gateways/src/contracts.js';
import { isRecord, requestJson } from './http-json.js';
import { buildZip, validateArchivePath, type ZipEntry } from './zip-writer.js';

/**
 * Hostinger RELEASE adapter — publishes or replaces a STATIC website on a domain the Founder allowlists.
 *
 * Flow (docs.hostinger.com + the official hostinger/api-mcp-server, verified 2026-10-16):
 *  1. POST /api/hosting/v1/files/upload-urls → { url, auth_key, rest_auth_key }.
 *  2. TUS 1.0.0 upload of the archive into public_html: POST {url}/{file}?override=true with
 *     `upload-length` + `upload-offset: 0` (expect 201), then PATCH with
 *     `Content-Type: application/offset+octet-stream` (expect 204); both with X-Auth / X-Auth-Rest.
 *  3. POST /api/hosting/v1/accounts/{username}/websites/{domain}/deploy ("Deploy a static application from an archive file").
 *
 * POR CONFIRMAR (the public docs pages do not render the request-body schemas, and the OpenAPI file
 * was not retrievable from this environment): the body of step 1 is sent as { username, domain } and the
 * body of step 3 as { archive_path }. If Hostinger answers 4xx the adapter returns its message so the
 * first real call corrects it in one place (the two constants below). Also POR CONFIRMAR: whether the
 * deploy replaces the whole site or extracts on top, and whether the uploaded .zip stays in public_html.
 *
 * Separate tool + separate token (HOSTINGER_RELEASE_TOKEN). Sites come from JANUS_HOSTINGER_SITES
 * ({"domain":"username"}) — nothing outside that map can be touched. Forced to explicit approval by the
 * sensitive-action policy and privileged in the Tool Gateway. Archive must contain index.html at its root;
 * paths that look like secrets (.env, .git, keys) are refused.
 */
export interface HostingerReleaseAdapterOptions {
  tokenProvider?: () => Promise<string | undefined>;
  token?: string;
  /** domain → hosting account username */
  sites?: Readonly<Record<string, string>>;
  apiBase?: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

const DOMAIN = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const USERNAME = /^[A-Za-z0-9_.-]{1,64}$/;
const MAX_FILES = 300;
const MAX_TOTAL_BYTES = 40 * 1024 * 1024;
const UPLOAD_URL_BODY = (username: string, domain: string): Record<string, unknown> => ({ username, domain }); // POR CONFIRMAR
const DEPLOY_BODY = (archivePath: string): Record<string, unknown> => ({ archive_path: archivePath }); // POR CONFIRMAR

export function parseHostingerSites(value: string | undefined): Record<string, string> {
  if (!value?.trim()) return {};
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error('JANUS_HOSTINGER_SITES must be a JSON object { "domain": "username" }'); }
  if (!isRecord(parsed)) throw new Error('JANUS_HOSTINGER_SITES must be a JSON object { "domain": "username" }');
  const out: Record<string, string> = {};
  for (const [domain, username] of Object.entries(parsed)) {
    if (!DOMAIN.test(domain) || typeof username !== 'string' || !USERNAME.test(username)) throw new Error('JANUS_HOSTINGER_SITES entries must be domain → account username');
    out[domain] = username;
  }
  return out;
}

export class HostingerReleaseAdapter implements ToolAdapter {
  readonly name = 'hostinger-release';
  readonly capabilities: string[] = ['site.deploy'];
  private readonly apiBase: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: HostingerReleaseAdapterOptions = {}) {
    this.apiBase = (options.apiBase ?? 'https://developers.hostinger.com').replace(/\/$/, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async execute(request: ToolRequest, onProgress: (progress: ToolProgress) => void | Promise<void>): Promise<ToolResult> {
    if (!this.capabilities.includes(request.action)) return { ok: false, error: `Unsupported Hostinger release action: ${request.action}` };
    const input = request.input;
    const domain = typeof input.domain === 'string' ? input.domain.trim().toLowerCase() : '';
    if (!DOMAIN.test(domain)) return { ok: false, error: 'Hostinger site.deploy needs a valid domain' };
    const username = this.options.sites?.[domain];
    if (!username) return { ok: false, error: `Domain ${domain} is not in the Founder's Hostinger allowlist (JANUS_HOSTINGER_SITES)` };

    const built = this.buildArchive(input);
    if ('error' in built) return { ok: false, error: built.error };
    const token = (this.options.tokenProvider ? await this.options.tokenProvider() : this.options.token)?.trim();
    if (!token) return { ok: false, error: 'Hostinger release is not authenticated (HOSTINGER_RELEASE_TOKEN).' };
    const bearer = { authorization: `Bearer ${token}` };

    await onProgress({ phase: 'progress', message: `Hostinger: preparando subida para ${domain}`, percent: 15 });
    const urls = await requestJson({ fetchImpl: this.fetchImpl, url: `${this.apiBase}/api/hosting/v1/files/upload-urls`, method: 'POST', headers: bearer, body: UPLOAD_URL_BODY(username, domain), service: 'Hostinger' });
    if (!urls.ok) return { ok: false, error: urls.error };
    const body = isRecord(urls.body) ? urls.body : {};
    const uploadUrl = typeof body.url === 'string' ? body.url.replace(/\/$/, '') : '';
    const authKey = typeof body.auth_key === 'string' ? body.auth_key : '';
    const restKey = typeof body.rest_auth_key === 'string' ? body.rest_auth_key : '';
    if (!uploadUrl.startsWith('https://') || !authKey || !restKey) return { ok: false, error: 'Hostinger upload-urls response is missing url/auth_key/rest_auth_key' };

    const stamp = (this.options.now?.() ?? new Date()).toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, '').replace('T', '_');
    const archiveName = `janus_${stamp}.zip`;
    const target = `${uploadUrl}/${archiveName}`;
    const tusHeaders = { 'x-auth': authKey, 'x-auth-rest': restKey, 'tus-resumable': '1.0.0' };

    await onProgress({ phase: 'progress', message: `Hostinger: subiendo ${built.fileCount} archivos (${built.bytes.length} B)`, percent: 40 });
    const created = await this.tus(`${target}?override=true`, 'POST', { ...tusHeaders, 'upload-length': String(built.bytes.length), 'upload-offset': '0' });
    if (created.status !== 201) return { ok: false, error: `Hostinger upload creation responded ${created.status}` };
    const sent = await this.tus(target, 'PATCH', { ...tusHeaders, 'content-type': 'application/offset+octet-stream', 'upload-offset': '0' }, built.bytes);
    if (sent.status !== 204) return { ok: false, error: `Hostinger upload responded ${sent.status}` };
    if (sent.offset !== String(built.bytes.length)) return { ok: false, error: `Hostinger upload incomplete (offset ${sent.offset ?? 'unknown'} of ${built.bytes.length})` };

    await onProgress({ phase: 'progress', message: `Hostinger: publicando ${domain}`, percent: 75 });
    const deploy = await requestJson({
      fetchImpl: this.fetchImpl,
      url: `${this.apiBase}/api/hosting/v1/accounts/${encodeURIComponent(username)}/websites/${encodeURIComponent(domain)}/deploy`,
      method: 'POST', headers: bearer, body: DEPLOY_BODY(archiveName), service: 'Hostinger', timeoutMs: 60_000,
    });
    if (!deploy.ok) return { ok: false, error: `${deploy.error} (archivo ${archiveName} ya subido a public_html)` };
    return {
      ok: true,
      output: { domain, archive: archiveName, files: built.fileCount, bytes: built.bytes.length, response: isRecord(deploy.body) ? deploy.body : null, note: `Verifica en https://${domain} que se ve el contenido nuevo; si no, limpia la caché.` },
      externalReference: `hostinger:${domain}/deploy/${archiveName}`,
    };
  }

  private buildArchive(input: Record<string, unknown>): { bytes: Uint8Array; fileCount: number } | { error: string } {
    if (!isRecord(input.files)) return { error: 'Hostinger site.deploy needs files: { "index.html": "<html>…", … }' };
    const entries: ZipEntry[] = [];
    let total = 0;
    for (const [path, content] of Object.entries(input.files)) {
      if (typeof content !== 'string') return { error: `Hostinger file ${path} must be a string (text); use binaryFiles for base64 content` };
      const problem = validateArchivePath(path);
      if (problem) return { error: `Hostinger file path "${path.slice(0, 80)}" rejected: ${problem}` };
      const bytes = new TextEncoder().encode(content);
      total += bytes.length;
      entries.push({ path, content: bytes });
    }
    if (isRecord(input.binaryFiles)) {
      for (const [path, value] of Object.entries(input.binaryFiles)) {
        const problem = validateArchivePath(path);
        if (problem) return { error: `Hostinger file path "${path.slice(0, 80)}" rejected: ${problem}` };
        if (typeof value !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) return { error: `Hostinger binary file ${path} must be base64` };
        const bytes = new Uint8Array(Buffer.from(value, 'base64'));
        total += bytes.length;
        entries.push({ path, content: bytes });
      }
    }
    if (entries.length === 0 || entries.length > MAX_FILES) return { error: `Hostinger site.deploy needs 1–${MAX_FILES} files` };
    if (total > MAX_TOTAL_BYTES) return { error: 'Hostinger site content is too large (40 MiB max)' };
    if (!entries.some((entry) => entry.path === 'index.html')) return { error: 'Hostinger static site needs index.html at the archive root' };
    return { bytes: buildZip(entries), fileCount: entries.length };
  }

  private async tus(url: string, method: 'POST' | 'PATCH', headers: Record<string, string>, body?: Uint8Array): Promise<{ status: number; offset: string | null }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);
    try {
      const response = await this.fetchImpl(url, { method, redirect: 'error', headers, ...(body ? { body: body as unknown as BodyInit } : {}), signal: controller.signal });
      await response.text().catch(() => '');
      return { status: response.status, offset: response.headers.get('upload-offset') };
    } catch {
      return { status: 0, offset: null };
    } finally {
      clearTimeout(timer);
    }
  }
}
