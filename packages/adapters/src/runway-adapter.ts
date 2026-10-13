import type { ToolAdapter, ToolProgress, ToolRequest, ToolResult } from '../../gateways/src/contracts.js';
import { cleanId, isRecord, requestJson } from './http-json.js';

/**
 * Runway adapter. Verified 2026-10-14 against the official Node SDK
 * (github.com/runwayml/sdk-node): base https://api.dev.runwayml.com,
 * `Authorization: Bearer <key>`, `X-Runway-Version: 2024-11-06`;
 * POST /v1/text_to_image, POST /v1/image_to_video → { id, estimatedCost.credits };
 * GET /v1/tasks/{id} → status PENDING|THROTTLED|RUNNING|SUCCEEDED|FAILED|CANCELLED, output[] (URLs expire 24–48h);
 * GET /v1/organization → creditBalance.
 *
 * Generations SPEND credits: `image.create` / `video.create` are privileged by
 * name, so the TaskRunner requires authority + explicit confirmation first.
 * Model ids and ratios are passed through (they change often); Runway validates them.
 */
export interface RunwayAdapterOptions {
  tokenProvider?: () => Promise<string | undefined>;
  token?: string;
  apiBase?: string;
  runwayVersion?: string;
  fetchImpl?: typeof fetch;
}

const TASK_ID = /^[A-Za-z0-9-]{8,80}$/;
const MODEL = /^[A-Za-z0-9_.-]{2,60}$/;
const RATIO = /^(?:\d{2,5}:\d{2,5}|auto(?:_\w+)?|adaptive|\d{1,2}:\d{1,2})$/;

export class RunwayAdapter implements ToolAdapter {
  readonly name = 'runway';
  readonly capabilities: string[] = ['organization.read', 'task.get', 'image.create', 'video.create'];
  private readonly apiBase: string;
  private readonly version: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: RunwayAdapterOptions = {}) {
    this.apiBase = (options.apiBase ?? 'https://api.dev.runwayml.com').replace(/\/$/, '');
    this.version = options.runwayVersion?.trim() || '2024-11-06';
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async execute(request: ToolRequest, onProgress: (progress: ToolProgress) => void | Promise<void>): Promise<ToolResult> {
    if (!this.capabilities.includes(request.action)) return { ok: false, error: `Unsupported Runway action: ${request.action}` };
    const token = (this.options.tokenProvider ? await this.options.tokenProvider() : this.options.token)?.trim();
    if (!token) return { ok: false, error: 'Runway is not authenticated; provide the API secret through the secure credential provider.' };
    const headers = { authorization: `Bearer ${token}`, 'x-runway-version': this.version };
    const input = request.input;

    if (request.action === 'organization.read') {
      await onProgress({ phase: 'progress', message: 'Runway: saldo de créditos', percent: 40 });
      const result = await requestJson({ fetchImpl: this.fetchImpl, url: `${this.apiBase}/v1/organization`, headers, service: 'Runway' });
      if (!result.ok) return { ok: false, error: result.error };
      const body = isRecord(result.body) ? result.body : {};
      return { ok: true, output: { creditBalance: typeof body.creditBalance === 'number' ? body.creditBalance : null } };
    }

    if (request.action === 'task.get') {
      const id = cleanId(input.taskId, TASK_ID);
      if (!id) return { ok: false, error: 'Runway task.get needs a valid taskId' };
      await onProgress({ phase: 'progress', message: `Runway: tarea ${id}`, percent: 40 });
      const result = await requestJson({ fetchImpl: this.fetchImpl, url: `${this.apiBase}/v1/tasks/${encodeURIComponent(id)}`, headers, service: 'Runway' });
      if (!result.ok) return { ok: false, error: result.error };
      const body = isRecord(result.body) ? result.body : {};
      return {
        ok: true,
        output: {
          taskId: body.id ?? id,
          status: body.status ?? null,
          progress: typeof body.progress === 'number' ? body.progress : null,
          output: Array.isArray(body.output) ? body.output.filter((item) => typeof item === 'string') : [],
          failure: typeof body.failure === 'string' ? body.failure : null,
          note: 'Las URLs de salida de Runway caducan en 24–48 h; guarda el resultado si lo necesitas.',
        },
      };
    }

    const model = cleanId(input.model, MODEL);
    if (!model) return { ok: false, error: 'Runway generation needs a model id (e.g. from Runway docs)' };
    const ratio = typeof input.ratio === 'string' && RATIO.test(input.ratio.trim()) ? input.ratio.trim() : undefined;
    const promptText = typeof input.promptText === 'string' ? input.promptText.trim() : '';
    if (promptText.length > 32_000) return { ok: false, error: 'Runway promptText is too long' };

    let path: string;
    let body: Record<string, unknown>;
    if (request.action === 'image.create') {
      if (!promptText) return { ok: false, error: 'Runway image.create needs promptText' };
      if (!ratio) return { ok: false, error: 'Runway image.create needs a ratio (e.g. 1920:1080)' };
      path = '/v1/text_to_image';
      body = { model, promptText, ratio };
    } else {
      const promptImage = typeof input.promptImage === 'string' ? input.promptImage.trim() : '';
      if (!/^https:\/\//.test(promptImage) && !/^data:image\//.test(promptImage) && !/^runway:\/\//.test(promptImage)) {
        return { ok: false, error: 'Runway video.create needs promptImage as an https URL, data URI or Runway upload URI' };
      }
      path = '/v1/image_to_video';
      body = { model, promptImage, ...(promptText ? { promptText } : {}), ...(ratio ? { ratio } : {}) };
      const duration = Number(input.duration);
      if (Number.isInteger(duration) && duration >= 2 && duration <= 15) body.duration = duration;
    }
    if (Number.isInteger(Number(input.seed))) body.seed = Number(input.seed);

    await onProgress({ phase: 'progress', message: `Runway: creando ${request.action === 'image.create' ? 'imagen' : 'vídeo'} (${model})`, percent: 40 });
    const result = await requestJson({ fetchImpl: this.fetchImpl, url: `${this.apiBase}${path}`, method: 'POST', headers, body, service: 'Runway' });
    if (!result.ok) return { ok: false, error: result.error };
    const created = isRecord(result.body) ? result.body : {};
    const cost = isRecord(created.estimatedCost) && typeof created.estimatedCost.credits === 'number' ? created.estimatedCost.credits : null;
    if (typeof created.id !== 'string') return { ok: false, error: 'Runway did not return a task id' };
    return {
      ok: true,
      output: { taskId: created.id, status: 'PENDING', estimatedCredits: cost, next: 'Consulta el resultado con runway.task.get' },
      externalReference: `runway:task:${created.id}`,
    };
  }
}
