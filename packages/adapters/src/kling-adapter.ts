import type { ToolAdapter, ToolProgress, ToolRequest, ToolResult } from '../../gateways/src/contracts.js';
import { cleanId, isRecord, requestJson } from './http-json.js';

/**
 * Kling AI video adapter. Verified 2026-10-14 (kling.ai/document-api):
 * base https://api-singapore.klingai.com (replaces api.klingai.com, for servers outside China);
 * "API Key authentication must be used" → `Authorization: Bearer <API_KEY>` (legacy AK/SK JWT not implemented);
 * POST /text-to-video/{model-version} e.g. /text-to-video/kling-3.0 { prompt, settings: { duration, aspect_ratio, resolution, audio } };
 * response { code, message, data: { id, status } }; GET /tasks?task_ids=… → data[].outputs[] (type video → url),
 * status submitted|processing|succeeded|failed. (task_ids query form taken from the params table; not shown in an example.)
 * Generations SPEND credits → `video.create` is forced to explicit approval by the sensitive-action policy.
 */
export interface KlingAdapterOptions {
  tokenProvider?: () => Promise<string | undefined>;
  token?: string;
  apiBase?: string;
  defaultModel?: string;
  fetchImpl?: typeof fetch;
}

const MODEL = /^kling-[0-9a-z.-]{1,20}$/;
const TASK_ID = /^[A-Za-z0-9_-]{4,80}$/;
const ASPECT = /^\d{1,2}:\d{1,2}$/;
const RESOLUTION = /^\d{3,4}p$/i;

export class KlingAdapter implements ToolAdapter {
  readonly name = 'kling';
  readonly capabilities: string[] = ['task.get', 'video.create'];
  private readonly apiBase: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: KlingAdapterOptions = {}) {
    this.apiBase = (options.apiBase ?? 'https://api-singapore.klingai.com').replace(/\/$/, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async execute(request: ToolRequest, onProgress: (progress: ToolProgress) => void | Promise<void>): Promise<ToolResult> {
    if (!this.capabilities.includes(request.action)) return { ok: false, error: `Unsupported Kling action: ${request.action}` };
    const token = (this.options.tokenProvider ? await this.options.tokenProvider() : this.options.token)?.trim();
    if (!token) return { ok: false, error: 'Kling AI is not authenticated; provide the API key through the secure credential provider.' };
    const headers = { authorization: `Bearer ${token}` };
    const input = request.input;

    if (request.action === 'task.get') {
      const id = cleanId(input.taskId, TASK_ID);
      if (!id) return { ok: false, error: 'Kling task.get needs a valid taskId' };
      await onProgress({ phase: 'progress', message: `Kling: tarea ${id}`, percent: 40 });
      const result = await requestJson({ fetchImpl: this.fetchImpl, url: `${this.apiBase}/tasks?task_ids=${encodeURIComponent(id)}`, headers, service: 'Kling' });
      if (!result.ok) return { ok: false, error: result.error };
      const body = isRecord(result.body) ? result.body : {};
      if (typeof body.code === 'number' && body.code !== 0) return { ok: false, error: `Kling error ${body.code}: ${String(body.message ?? '')}` };
      const tasks = Array.isArray(body.data) ? body.data.filter(isRecord) : isRecord(body.data) ? [body.data] : [];
      const task = tasks[0] ?? {};
      const outputs = Array.isArray(task.outputs) ? task.outputs.filter(isRecord) : [];
      return {
        ok: true,
        output: {
          taskId: task.id ?? id,
          status: task.status ?? null,
          videos: outputs.filter((item) => item.type === 'video' && typeof item.url === 'string').map((item) => ({ url: item.url, watermarkUrl: item.watermark_url ?? null, duration: item.duration ?? null })),
        },
      };
    }

    const prompt = typeof input.prompt === 'string' ? input.prompt.trim() : '';
    if (!prompt || prompt.length > 5000) return { ok: false, error: 'Kling video.create needs a prompt (1..5000 chars)' };
    const model = typeof input.model === 'string' && MODEL.test(input.model) ? input.model : (this.options.defaultModel ?? 'kling-3.0');
    const settings: Record<string, unknown> = {};
    const duration = Number(input.duration);
    if (Number.isInteger(duration) && duration >= 3 && duration <= 15) settings.duration = duration;
    if (typeof input.aspectRatio === 'string' && ASPECT.test(input.aspectRatio)) settings.aspect_ratio = input.aspectRatio;
    if (typeof input.resolution === 'string' && RESOLUTION.test(input.resolution)) settings.resolution = input.resolution.toLowerCase();
    if (typeof input.audio === 'boolean') settings.audio = input.audio;
    await onProgress({ phase: 'progress', message: `Kling: creando vídeo (${model})`, percent: 40 });
    const result = await requestJson({
      fetchImpl: this.fetchImpl,
      url: `${this.apiBase}/text-to-video/${model}`,
      method: 'POST',
      headers,
      body: { prompt, ...(Object.keys(settings).length ? { settings } : {}) },
      service: 'Kling',
    });
    if (!result.ok) return { ok: false, error: result.error };
    const body = isRecord(result.body) ? result.body : {};
    if (typeof body.code === 'number' && body.code !== 0) return { ok: false, error: `Kling error ${body.code}: ${String(body.message ?? '')}` };
    const data = isRecord(body.data) ? body.data : {};
    if (typeof data.id !== 'string' && typeof data.id !== 'number') return { ok: false, error: 'Kling did not return a task id' };
    return {
      ok: true,
      output: { taskId: String(data.id), status: data.status ?? 'submitted', model, next: 'Consulta el resultado con kling.task.get' },
      externalReference: `kling:task:${String(data.id)}`,
    };
  }
}
