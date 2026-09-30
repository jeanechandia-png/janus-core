import type {
  ToolAdapter,
  ToolProgress,
  ToolRequest,
  ToolResult,
} from '../../gateways/src/contracts.js';

export interface GitHubAdapterOptions {
  token?: string;
  tokenProvider?: () => Promise<string | undefined>;
  apiBase?: string;
  fetchImpl?: typeof fetch;
  userAgent?: string;
}

type JsonRecord = Record<string, unknown>;

export class GitHubAdapter implements ToolAdapter {
  readonly name = 'github';
  readonly capabilities: string[] = ['repo.get', 'contents.list', 'branch.get', 'file.read', 'file.publish'];

  private readonly token?: string;
  private readonly tokenProvider?: () => Promise<string | undefined>;
  private readonly apiBase: string;
  private readonly fetchImpl: typeof fetch;
  private readonly userAgent: string;

  constructor(options: GitHubAdapterOptions = {}) {
    this.token = options.token;
    this.tokenProvider = options.tokenProvider;
    this.apiBase = (options.apiBase ?? 'https://api.github.com').replace(/\/$/, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.userAgent = options.userAgent ?? 'janus-core/0.1';
  }

  async execute(
    request: ToolRequest,
    onProgress: (progress: ToolProgress) => void | Promise<void>,
  ): Promise<ToolResult> {
    if (!this.capabilities.includes(request.action)) {
      return { ok: false, error: `Unsupported GitHub action: ${request.action}` };
    }

    const owner = requiredString(request.input, 'owner');
    const repo = requiredString(request.input, 'repo');
    const encodedOwner = encodeURIComponent(owner);
    const encodedRepo = encodeURIComponent(repo);

    await onProgress({
      phase: 'progress',
      message: `GitHub: ${owner}/${repo}`,
      percent: 15,
    });

    if (request.action === 'branch.get') {
      const ref = requiredString(request.input, 'ref');
      const response = await this.getJson(
        `/repos/${encodedOwner}/${encodedRepo}/git/ref/heads/${encodePath(ref)}`,
      );
      if (!response.ok) return response;
      const body = response.output?.body as JsonRecord;
      const object = isRecord(body.object) ? body.object : {};
      const sha = typeof object.sha === 'string' ? object.sha : undefined;
      if (!sha) return { ok: false, error: 'GitHub branch response did not include a commit SHA' };
      return {
        ok: true,
        output: {
          owner,
          repo,
          ref,
          sha,
        },
        externalReference:
          `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/tree/${encodeURIComponent(ref)}`,
      };
    }

    if (request.action === 'repo.get') {
      const response = await this.getJson(`/repos/${encodedOwner}/${encodedRepo}`);
      if (!response.ok) return response;
      const body = response.output?.body as JsonRecord;
      return {
        ok: true,
        output: {
          owner,
          repo,
          fullName: body.full_name,
          private: body.private,
          defaultBranch: body.default_branch,
          description: body.description,
          updatedAt: body.updated_at,
          url: body.html_url,
        },
        externalReference: typeof body.html_url === 'string' ? body.html_url : undefined,
      };
    }

    if (request.action === 'contents.list') {
      const path = optionalString(request.input, 'path') ?? '';
      const ref = optionalString(request.input, 'ref');
      const suffix = ref ? `?ref=${encodeURIComponent(ref)}` : '';
      const response = await this.getJson(
        `/repos/${encodedOwner}/${encodedRepo}/contents/${encodePath(path)}${suffix}`,
      );
      if (!response.ok) return response;
      const body = response.output?.body;
      if (!Array.isArray(body)) {
        return { ok: false, error: 'GitHub contents response was not a directory listing' };
      }
      return {
        ok: true,
        output: {
          owner,
          repo,
          path,
          entries: body.map((entry) => {
            const item = entry as JsonRecord;
            return {
              name: item.name,
              path: item.path,
              type: item.type,
              size: item.size,
              sha: item.sha,
            };
          }),
        },
      };
    }

    const path = requiredString(request.input, 'path');
    const ref = optionalString(request.input, 'ref');

    if (request.action === 'file.publish') {
      if (!ref) return { ok: false, error: 'GitHub file.publish requires an explicit ref' };
      const content = requiredString(request.input, 'content');
      const message = requiredString(request.input, 'message');
      const expectedHeadSha = optionalString(request.input, 'expectedHeadSha');
      const token = await this.resolveToken();
      if (!token) return { ok: false, error: 'GitHub file.publish requires authentication' };

      const headPath =
        `/repos/${encodedOwner}/${encodedRepo}/git/ref/heads/${encodePath(ref)}`;
      const head = await this.requestJson(headPath, { token });
      if (!head.ok) return { ok: false, error: head.error };
      const headBody = isRecord(head.body) ? head.body : {};
      const headObject = isRecord(headBody.object) ? headBody.object : {};
      const headSha = typeof headObject.sha === 'string' ? headObject.sha : undefined;
      if (!headSha) return { ok: false, error: 'GitHub branch head SHA is unavailable' };
      if (expectedHeadSha && expectedHeadSha !== headSha) {
        return {
          ok: false,
          error:
            `GitHub branch head changed before publish: expected ${expectedHeadSha}, got ${headSha}`,
        };
      }

      const suffix = `?ref=${encodeURIComponent(ref)}`;
      const filePath =
        `/repos/${encodedOwner}/${encodedRepo}/contents/${encodePath(path)}`;
      const existing = await this.requestJson(filePath + suffix, { token });
      if (!existing.ok && existing.status !== 404) {
        return { ok: false, error: existing.error };
      }

      let existingSha: string | undefined;
      if (existing.ok) {
        const body = isRecord(existing.body) ? existing.body : {};
        if (body.type !== 'file') {
          return { ok: false, error: `GitHub publish path is not a file: ${path}` };
        }
        existingSha = typeof body.sha === 'string' ? body.sha : undefined;
        if (typeof body.content === 'string') {
          const encoding = typeof body.encoding === 'string' ? body.encoding : 'base64';
          if (encoding === 'base64') {
            const existingContent = Buffer.from(
              body.content.replace(/\n/g, ''),
              'base64',
            ).toString('utf8');
            if (existingContent === content) {
              return {
                ok: true,
                output: {
                  owner,
                  repo,
                  path,
                  ref,
                  unchanged: true,
                  branchHeadSha: headSha,
                  fileSha: existingSha,
                  commitSha: headSha,
                },
                externalReference:
                  typeof body.html_url === 'string' ? body.html_url : undefined,
              };
            }
          }
        }
      }

      const revalidatedHead = await this.requestJson(headPath, { token });
      if (!revalidatedHead.ok) return { ok: false, error: revalidatedHead.error };
      const revalidatedBody = isRecord(revalidatedHead.body) ? revalidatedHead.body : {};
      const revalidatedObject = isRecord(revalidatedBody.object)
        ? revalidatedBody.object
        : {};
      const revalidatedSha = typeof revalidatedObject.sha === 'string'
        ? revalidatedObject.sha
        : undefined;
      if (!revalidatedSha || revalidatedSha !== headSha) {
        return {
          ok: false,
          error: 'GitHub branch changed during publish revalidation; retry from fresh state',
        };
      }

      const published = await this.requestJson(filePath, {
        method: 'PUT',
        token,
        body: {
          message,
          content: Buffer.from(content, 'utf8').toString('base64'),
          branch: ref,
          ...(existingSha ? { sha: existingSha } : {}),
        },
      });
      if (!published.ok) return { ok: false, error: published.error };
      const publishedBody = isRecord(published.body) ? published.body : {};
      const publishedContent = isRecord(publishedBody.content) ? publishedBody.content : {};
      const publishedCommit = isRecord(publishedBody.commit) ? publishedBody.commit : {};
      return {
        ok: true,
        output: {
          owner,
          repo,
          path,
          ref,
          unchanged: false,
          branchHeadSha: headSha,
          fileSha:
            typeof publishedContent.sha === 'string' ? publishedContent.sha : undefined,
          commitSha:
            typeof publishedCommit.sha === 'string' ? publishedCommit.sha : undefined,
        },
        externalReference:
          typeof publishedCommit.html_url === 'string'
            ? publishedCommit.html_url
            : typeof publishedContent.html_url === 'string'
              ? publishedContent.html_url
              : undefined,
      };
    }

    const suffix = ref ? `?ref=${encodeURIComponent(ref)}` : '';
    const response = await this.getJson(
      `/repos/${encodedOwner}/${encodedRepo}/contents/${encodePath(path)}${suffix}`,
    );
    if (!response.ok) return response;
    const body = response.output?.body as JsonRecord;
    if (body.type !== 'file' || typeof body.content !== 'string') {
      return { ok: false, error: `GitHub path is not a readable file: ${path}` };
    }

    const encoding = typeof body.encoding === 'string' ? body.encoding : 'base64';
    if (encoding !== 'base64') {
      return { ok: false, error: `Unsupported GitHub file encoding: ${encoding}` };
    }

    const content = Buffer.from(body.content.replace(/\n/g, ''), 'base64').toString('utf8');
    return {
      ok: true,
      output: {
        owner,
        repo,
        path,
        sha: body.sha,
        size: body.size,
        content,
      },
      externalReference: typeof body.html_url === 'string' ? body.html_url : undefined,
    };
  }

  private async resolveToken(): Promise<string | undefined> {
    return (this.tokenProvider ? await this.tokenProvider() : this.token)?.trim() || undefined;
  }

  private async requestJson(
    path: string,
    options: {
      method?: 'GET' | 'PUT';
      token?: string;
      body?: Record<string, unknown>;
    } = {},
  ): Promise<{
    ok: boolean;
    status: number;
    body: unknown;
    error?: string;
  }> {
    const headers: Record<string, string> = {
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': this.userAgent,
    };
    const token = options.token ?? await this.resolveToken();
    if (token) headers.authorization = `Bearer ${token}`;
    if (options.body) headers['content-type'] = 'application/json';

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.apiBase}${path}`, {
        method: options.method ?? 'GET',
        headers,
        ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      });
    } catch (error) {
      return {
        ok: false,
        status: 0,
        body: null,
        error: `GitHub network error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    const text = await response.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    if (!response.ok) {
      const message = isRecord(body) && typeof body.message === 'string'
        ? body.message
        : `HTTP ${response.status}`;
      return {
        ok: false,
        status: response.status,
        body,
        error: `GitHub ${response.status}: ${message}`,
      };
    }
    return { ok: true, status: response.status, body };
  }

  private async getJson(path: string): Promise<ToolResult> {
    const headers: Record<string, string> = {
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': this.userAgent,
    };
    void headers;
    const result = await this.requestJson(path);
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, output: { body: result.body } };
  }
}

function requiredString(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`GitHub input '${key}' is required`);
  }
  return value.trim();
}

function optionalString(input: Record<string, unknown>, key: string): string | undefined {
  const value = input[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function encodePath(path: string): string {
  return path
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
