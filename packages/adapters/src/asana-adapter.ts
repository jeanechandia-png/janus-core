import type { ToolAdapter, ToolProgress, ToolRequest, ToolResult } from '../../gateways/src/contracts.js';
import { cleanId, isRecord, requestJson } from './http-json.js';

/**
 * Asana adapter (Tool Gateway). Verified 2026-10-14 (developers.asana.com):
 * base https://app.asana.com/api/1.0, `Authorization: Bearer <PAT>`,
 * GET /workspaces, GET /projects?workspace=, GET /tasks (project, or assignee+workspace; limit 1..100),
 * POST /tasks with {"data": {...}} (workspace or projects required).
 *
 * Reads are free. `task.create` is a mutation: its name makes it privileged in
 * the TaskRunner, so it passes authority + explicit confirmation before running.
 */
export interface AsanaAdapterOptions {
  tokenProvider?: () => Promise<string | undefined>;
  token?: string;
  apiBase?: string;
  fetchImpl?: typeof fetch;
}

const GID = /^\d{1,30}$/;
const TASK_FIELDS = 'name,completed,due_on,assignee.name,permalink_url,projects.name';

export class AsanaAdapter implements ToolAdapter {
  readonly name = 'asana';
  readonly capabilities: string[] = ['workspaces.list', 'projects.list', 'tasks.list', 'task.create'];
  private readonly apiBase: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: AsanaAdapterOptions = {}) {
    this.apiBase = (options.apiBase ?? 'https://app.asana.com/api/1.0').replace(/\/$/, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async execute(request: ToolRequest, onProgress: (progress: ToolProgress) => void | Promise<void>): Promise<ToolResult> {
    if (!this.capabilities.includes(request.action)) return { ok: false, error: `Unsupported Asana action: ${request.action}` };
    const token = (this.options.tokenProvider ? await this.options.tokenProvider() : this.options.token)?.trim();
    if (!token) return { ok: false, error: 'Asana is not authenticated; provide a personal access token through the secure credential provider.' };
    const headers = { authorization: `Bearer ${token}` };
    const input = request.input;

    if (request.action === 'workspaces.list') {
      await onProgress({ phase: 'progress', message: 'Asana: espacios de trabajo', percent: 40 });
      const result = await requestJson({ fetchImpl: this.fetchImpl, url: `${this.apiBase}/workspaces?limit=100`, headers, service: 'Asana' });
      if (!result.ok) return { ok: false, error: result.error };
      return { ok: true, output: { workspaces: dataArray(result.body).map((item) => ({ gid: item.gid, name: item.name })) } };
    }

    if (request.action === 'projects.list') {
      const workspace = cleanId(input.workspace, GID);
      if (!workspace) return { ok: false, error: 'Asana input workspace (gid) is required' };
      await onProgress({ phase: 'progress', message: 'Asana: proyectos', percent: 40 });
      const result = await requestJson({ fetchImpl: this.fetchImpl, url: `${this.apiBase}/projects?workspace=${workspace}&limit=100&opt_fields=name,archived,permalink_url`, headers, service: 'Asana' });
      if (!result.ok) return { ok: false, error: result.error };
      return { ok: true, output: { projects: dataArray(result.body).map((item) => ({ gid: item.gid, name: item.name, archived: item.archived ?? null, url: item.permalink_url ?? null })) } };
    }

    if (request.action === 'tasks.list') {
      const project = cleanId(input.project, GID);
      const workspace = cleanId(input.workspace, GID);
      const assignee = input.assignee === 'me' ? 'me' : cleanId(input.assignee, GID);
      const limit = Math.min(100, Math.max(1, Number(input.limit) || 50));
      let filter: string;
      if (project) filter = `project=${project}`;
      else if (workspace && assignee) filter = `workspace=${workspace}&assignee=${assignee}`;
      else return { ok: false, error: 'Asana tasks.list needs project, or workspace + assignee' };
      const completedSince = input.includeCompleted === true ? '' : '&completed_since=now';
      await onProgress({ phase: 'progress', message: 'Asana: tareas', percent: 40 });
      const result = await requestJson({ fetchImpl: this.fetchImpl, url: `${this.apiBase}/tasks?${filter}&limit=${limit}${completedSince}&opt_fields=${TASK_FIELDS}`, headers, service: 'Asana' });
      if (!result.ok) return { ok: false, error: result.error };
      return { ok: true, output: { tasks: dataArray(result.body).map(taskSummary) } };
    }

    // task.create — mutation (privileged by name; authority + confirmation enforced by TaskRunner).
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (!name || name.length > 1024) return { ok: false, error: 'Asana task.create needs a name (1..1024 chars)' };
    const project = cleanId(input.project, GID);
    const workspace = cleanId(input.workspace, GID);
    if (!project && !workspace) return { ok: false, error: 'Asana task.create needs project or workspace' };
    const dueOn = typeof input.dueOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.dueOn) ? input.dueOn : undefined;
    const notes = typeof input.notes === 'string' ? input.notes.slice(0, 10_000) : undefined;
    const assignee = input.assignee === 'me' ? 'me' : cleanId(input.assignee, GID) ?? undefined;
    await onProgress({ phase: 'progress', message: 'Asana: creando tarea', percent: 50 });
    const result = await requestJson({
      fetchImpl: this.fetchImpl,
      url: `${this.apiBase}/tasks?opt_fields=${TASK_FIELDS}`,
      method: 'POST',
      headers,
      service: 'Asana',
      body: { data: { name, ...(project ? { projects: [project] } : { workspace }), ...(notes ? { notes } : {}), ...(dueOn ? { due_on: dueOn } : {}), ...(assignee ? { assignee } : {}) } },
    });
    if (!result.ok) return { ok: false, error: result.error };
    const created = isRecord(result.body) && isRecord(result.body.data) ? result.body.data : {};
    const task = taskSummary(created);
    return { ok: true, output: { task }, ...(typeof task.url === 'string' ? { externalReference: task.url } : {}) };
  }
}

function dataArray(body: unknown): Record<string, unknown>[] {
  return isRecord(body) && Array.isArray(body.data) ? body.data.filter(isRecord) : [];
}

function taskSummary(item: Record<string, unknown>): Record<string, unknown> {
  const assignee = isRecord(item.assignee) ? item.assignee.name ?? null : null;
  const projects = Array.isArray(item.projects) ? item.projects.filter(isRecord).map((project) => project.name) : [];
  return { gid: item.gid ?? null, name: item.name ?? null, completed: item.completed ?? null, dueOn: item.due_on ?? null, assignee, projects, url: item.permalink_url ?? null };
}
