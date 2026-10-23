/**
 * Editor visual de flujos — modelo (sin DOM, sin red, sin reloj).
 *
 * Todo lo que el editor afirma sale del motor real: el catálogo de nodos (`builtinNodeManifests`), la validación
 * (`validateAutomationWorkflow`), el registro (`AutomationNodeRegistry.checkNode`) y las plantillas (`FLOW_TEMPLATES`).
 * El editor no tiene reglas propias que puedan contradecir al motor; solo añade ayudas (valores por defecto, avisos en
 * español, orden previsto, disposición en el lienzo) y barreras (no exportar claves pegadas a mano).
 *
 * El editor trabaja con BORRADORES: nada se publica ni se ejecuta desde aquí.
 */
import { AutomationNodeRegistry, type AutomationNodeManifest } from '../../../packages/automation/src/node-registry.js';
import { builtinNodeManifests, type NodeCatalogEnv } from '../../../packages/automation/src/node-catalog.js';
import { FLOW_TEMPLATES, type FlowTemplate } from '../../../packages/automation/src/flow-templates.js';
import { findSecretLikeValues } from '../../../packages/automation/src/secret-shape.js';
import {
  AUTOMATION_WORKFLOW_SCHEMA_VERSION,
  validateAutomationWorkflow,
  type AutomationWorkflow,
  type WorkflowConnection,
  type WorkflowNode,
  type WorkflowNodeKind,
  type WorkflowRisk,
} from '../../../packages/automation/src/workflow.js';

/* ───────────────────────────── Tipos y constantes ───────────────────────────── */

export interface Pos { x: number; y: number }
export interface FlowDraft {
  workflow: AutomationWorkflow;
  /** Posición de cada nodo en el lienzo (el motor no guarda posiciones; viven junto al borrador). */
  layout: Record<string, Pos>;
}

export const NODE_W = 208;
export const NODE_H = 76;
export const GAP_X = 88;
export const GAP_Y = 36;
/** Disposición del lienzo: «h» = pasos de izquierda a derecha; «v» = pasos de arriba abajo (la que mejor cabe en móvil y tablet). */
export type Orientation = 'h' | 'v';
export const V_GAP_Y = 56;
export const V_GAP_X = 24;
const MARGIN = 40;
const MAX_NODES = 200;
const MAX_DRAFT_BYTES = 512 * 1024;
const POS_MIN = -5000;
const POS_MAX = 20000;

export const KIND_ORDER: readonly WorkflowNodeKind[] = ['trigger', 'logic', 'wait', 'approval', 'verification', 'subflow', 'transform', 'code', 'ai', 'action'];
export const KIND_LABEL: Record<WorkflowNodeKind, string> = {
  trigger: 'Disparadores', logic: 'Lógica', wait: 'Esperas', approval: 'Aprobación', verification: 'Verificación',
  subflow: 'Subflujos', transform: 'Datos', code: 'Código', ai: 'Inteligencia artificial', action: 'Conectores',
};

const KINDS = new Set<string>(KIND_ORDER);
const RISKS: readonly WorkflowRisk[] = ['none', 'low', 'medium', 'high'];
const MODES = new Set(['deterministic', 'agentic']);
const ON_ERROR = new Set(['fail', 'continue', 'error_branch']);

/** Entornos que el editor puede SIMULAR. No son el estado real del runtime: el runtime todavía no publica su catálogo. */
export const ENV_PRESETS: Record<string, { label: string; env: NodeCatalogEnv }> = {
  hoy: { label: 'Hoy, sin gastar nada', env: { tools: true, javascript: true, httpEndpoints: [] } },
  conectado: { label: 'Con modelo, planificador y endpoints', env: { tools: true, javascript: true, models: true, scheduler: true, httpEndpoints: ['clima'] } },
  todo: { label: 'Todo disponible', env: { tools: true, javascript: true, python: true, models: true, agent: true, research: true, scheduler: true, webhookServer: true, eventBus: true, httpEndpoints: ['clima'] } },
};

export const EXPRESSION_HELP: ReadonlyArray<{ code: string; text: string }> = [
  { code: '{{ $input }}', text: 'Lo que entrega el nodo anterior.' },
  { code: '{{ $trigger }}', text: 'Los datos con los que arrancó el flujo.' },
  { code: '{{ $nodes.<id>.output }}', text: 'La salida de cualquier nodo anterior, por su ID.' },
  { code: '{{ $vars.<nombre> }}', text: 'Una variable local (ciudad, coordenadas…; nunca datos personales en el flujo).' },
];

/* ───────────────────────────── Guía por tipo de nodo ───────────────────────────── */

interface Guide {
  hint: string;
  params: Record<string, unknown>;
  /** Textos de ayuda por parámetro. */
  help?: Record<string, string>;
  toolOperation?: { tool: string; action: string };
  timeoutMs?: number;
  retry?: { maxAttempts: number; backoffMs: number; maxBackoffMs?: number };
}

const GUIDES: Record<string, Guide> = {
  'trigger.manual': { hint: 'Arranca el flujo a mano o desde otra parte de Janus.', params: {}, toolOperation: { tool: 'manual', action: 'receive' } },
  'trigger.schedule': { hint: 'Arranca el flujo con un horario (cron).', params: { cron: '0 7 * * 1-5', timezone: 'Europe/Amsterdam' }, help: { cron: 'Minuto hora día mes día-semana. Ej.: 0 7 * * 1-5 = laborables a las 7:00.' }, toolOperation: { tool: 'scheduler', action: 'tick' } },
  'trigger.poll': { hint: 'Consulta algo cada cierto tiempo.', params: { intervalMs: 900000 }, help: { intervalMs: 'Milisegundos entre consultas (mínimo 1000).' }, toolOperation: { tool: 'scheduler', action: 'tick' } },
  'trigger.webhook': { hint: 'Arranca cuando llega una llamada autenticada.', params: { method: 'POST', path: '/hooks/nuevo' }, toolOperation: { tool: 'webhook', action: 'receive' } },
  'trigger.event': { hint: 'Arranca cuando Janus publica un evento.', params: { topic: '' }, toolOperation: { tool: 'events', action: 'receive' } },
  'logic.if': { hint: 'Elige entre «true» y «false».', params: { left: '{{ $input.value }}', op: 'eq', right: '' }, help: { op: 'eq, neq, gt, gte, lt, lte, contains, exists, truthy, not. También all / any con una lista de condiciones.' } },
  'logic.switch': { hint: 'Elige una rama según el valor.', params: { value: '{{ $input.value }}', cases: { opcion_a: 'a', opcion_b: 'b' }, default: 'otro' }, help: { cases: 'Etiqueta de la rama → valor que la activa.' } },
  'wait.delay': { hint: 'Espera un tiempo antes de seguir.', params: { ms: 60000 }, help: { ms: 'Milisegundos.' } },
  'approval.request': { hint: 'Pausa el flujo hasta que el Founder apruebe.', params: { message: '¿Apruebas continuar?' } },
  'verification.assert': { hint: 'Detiene el flujo si la condición no se cumple.', params: { left: '{{ $input.ok }}', op: 'truthy', message: 'La verificación falló' } },
  'subflow.run': { hint: 'Ejecuta otro flujo y recoge su resultado.', params: { workflowId: '', input: '{{ $input }}' }, toolOperation: { tool: 'workflow', action: 'run' } },
  'transform.set': { hint: 'Crea un objeto con los valores que indiques.', params: { values: {} } },
  'transform.pick': { hint: 'Se queda solo con algunos campos.', params: { from: '{{ $input }}', keys: [] }, help: { keys: 'Lista de nombres de campo.' } },
  'transform.template': { hint: 'Compone un texto con datos del flujo.', params: { template: 'Hola {{ $input.nombre }}' } },
  'code.js': { hint: 'JavaScript aislado: recibe `input` y devuelve un resultado.', params: { source: 'return input;', input: '{{ $input }}' }, timeoutMs: 5000 },
  'code.python': { hint: 'Python (necesita aislamiento real; hoy en reposo).', params: { source: 'return input', input: '{{ $input }}' }, timeoutMs: 5000 },
  'ai.summarize': { hint: 'Resume un texto sin añadir nada que no aparezca en él.', params: { text: '{{ $input }}', maxWords: 80 } },
  'ai.classify': { hint: 'Clasifica y manda el flujo por la rama de la etiqueta.', params: { text: '{{ $input }}', labels: ['si', 'no'] }, help: { labels: 'Al menos dos etiquetas; cada una es una rama.' } },
  'ai.extract': { hint: 'Extrae campos concretos de un texto.', params: { text: '{{ $input }}', fields: ['nombre', 'importe'] } },
  'ai.complete': { hint: 'Instrucción libre a un modelo.', params: { prompt: '', text: '{{ $input }}', json: false } },
  'ai.research': { hint: 'Investiga y responde con fuentes numeradas y verificación.', params: { question: '{{ $input.question }}', maxSources: 8 }, timeoutMs: 120000 },
  'ai.agent': { hint: 'Delega en un agente especializado del Agent Swarm.', params: {} },
  'action.tool': { hint: 'Ejecuta una acción de un conector registrado.', params: {}, toolOperation: { tool: '', action: '' }, help: { tool: 'Nombre del conector (p. ej. google-workspace).', action: 'Acción (p. ej. calendar.events.list).' } },
  'http.request': { hint: 'Llama a un endpoint HTTP autorizado por nombre (nunca una URL libre).', params: { endpoint: '', method: 'GET', path: '/', query: {} }, help: { endpoint: 'Nombre autorizado en JANUS_HTTP_ENDPOINTS.' }, toolOperation: { tool: 'http', action: 'request.read' }, timeoutMs: 20000, retry: { maxAttempts: 3, backoffMs: 500, maxBackoffMs: 4000 } },
};

export function guideFor(type: string): { hint: string; help: Record<string, string> } {
  const guide = GUIDES[type];
  return { hint: guide?.hint ?? '', help: guide?.help ?? {} };
}

/** Nombres de parámetro que el editor sugiere añadir para un tipo y que aún no están en el nodo. */
export function suggestedParams(node: WorkflowNode): string[] {
  const guide = GUIDES[node.type];
  if (!guide) return [];
  return Object.keys(guide.params).filter((key) => !(key in node.parameters));
}

/* ───────────────────────────── Catálogo y entorno ───────────────────────────── */

export type CatalogStatus = 'listo' | 'reposo';
export interface CatalogEntry { manifest: AutomationNodeManifest; hint: string; status: CatalogStatus; reason?: string }

export function registryFor(env: NodeCatalogEnv): AutomationNodeRegistry {
  const registry = new AutomationNodeRegistry();
  for (const manifest of builtinNodeManifests(env)) registry.register(manifest);
  return registry;
}

/** Catálogo agrupado por tipo. «En reposo» = construido pero sin lo que necesita (norma 7: no es un fallo). */
export function catalogView(env: NodeCatalogEnv): Array<{ kind: WorkflowNodeKind; label: string; entries: CatalogEntry[] }> {
  const manifests = builtinNodeManifests(env);
  return KIND_ORDER.map((kind) => ({
    kind,
    label: KIND_LABEL[kind],
    entries: manifests.filter((m) => m.kind === kind).map((manifest) => ({
      manifest,
      hint: GUIDES[manifest.type]?.hint ?? '',
      status: manifest.availability === 'available' ? 'listo' as const : 'reposo' as const,
      ...(manifest.reason ? { reason: manifest.reason } : {}),
    })),
  })).filter((group) => group.entries.length > 0);
}

export interface TemplateView { template: FlowTemplate; nodeIssues: string[]; tools: string[]; endpoints: string[] }

/** Lo que cada plantilla necesita. Conectores y endpoints reales solo los conoce el runtime: aquí se listan, no se afirman. */
export function templatesView(env: NodeCatalogEnv): TemplateView[] {
  const registry = registryFor(env);
  return FLOW_TEMPLATES.map((template) => {
    const issues = new Set<string>();
    for (const node of template.build().nodes) {
      const check = registry.checkNode(node);
      if (!check.ok) for (const error of check.errors) issues.add(`${node.label}: ${error}`);
    }
    return { template, nodeIssues: [...issues], tools: [...template.requires.tools], endpoints: [...template.requires.endpoints] };
  });
}

/** Conectores y acciones conocidos por las plantillas (para sugerir al escribir; no prueban que existan en el runtime). */
export function knownToolActions(): Array<{ tool: string; action: string }> {
  const seen = new Set<string>();
  const out: Array<{ tool: string; action: string }> = [];
  for (const template of FLOW_TEMPLATES) {
    for (const requirement of template.requires.tools) {
      const dot = requirement.indexOf('.');
      const key = requirement;
      if (dot < 1 || seen.has(key)) continue;
      seen.add(key);
      out.push({ tool: requirement.slice(0, dot), action: requirement.slice(dot + 1) });
    }
  }
  return out;
}

/* ───────────────────────────── Nodos ───────────────────────────── */

export function slug(text: string): string {
  const base = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!base) return 'nodo';
  return /^[a-z]/.test(base) ? base.slice(0, 32) : `n_${base}`.slice(0, 32).replace(/_+$/, '');
}

export function uniqueId(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const root = slug(base) || 'nodo';
  if (!used.has(root)) return root;
  for (let i = 2; i < 10_000; i += 1) {
    const candidate = `${root}_${i}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${root}_${used.size + 1}`;
}

const RISK_RANK: Record<WorkflowRisk, number> = { none: 0, low: 1, medium: 2, high: 3 };

/** Invariantes del motor que el editor aplica siempre, para que un cambio no deje un nodo imposible de publicar. */
export function normalizeNode(input: WorkflowNode): WorkflowNode {
  const node: WorkflowNode = { ...input, parameters: input.parameters };
  if (node.type === 'http.request') {
    const method = String(node.parameters.method ?? 'GET').toUpperCase();
    const read = method === 'GET' || method === 'HEAD';
    node.toolOperation = { tool: 'http', action: read ? 'request.read' : 'request.send' };
    if (!read) {
      node.reversible = false;
      if (RISK_RANK[node.risk] < RISK_RANK.medium) node.risk = 'medium';
    }
  }
  if (node.kind === 'approval' || node.risk === 'high' || !node.reversible) node.requiresApproval = true;
  if (node.timeoutMs !== undefined && !(node.timeoutMs > 0)) delete node.timeoutMs;
  if (node.retry && (!Number.isInteger(node.retry.maxAttempts) || node.retry.maxAttempts < 1)) delete node.retry;
  // Una propiedad opcional puesta a «undefined» (p. ej. al vaciar un campo) se quita: así el JSON y la validación ven lo mismo.
  const bag = node as unknown as Record<string, unknown>;
  for (const key of Object.keys(bag)) if (bag[key] === undefined) delete bag[key];
  return node;
}

export function createNode(manifest: AutomationNodeManifest, id: string, label?: string): WorkflowNode {
  const guide = GUIDES[manifest.type];
  const executionMode = manifest.executionModes[0] ?? 'deterministic';
  const node: WorkflowNode = {
    id,
    type: manifest.type,
    version: manifest.version,
    label: label ?? manifest.displayName,
    kind: manifest.kind,
    executionMode,
    parameters: structuredClone(guide?.params ?? {}),
    risk: 'none',
    reversible: true,
    requiresApproval: false,
  };
  if (guide?.toolOperation) node.toolOperation = { ...guide.toolOperation };
  if (guide?.timeoutMs) node.timeoutMs = guide.timeoutMs;
  if (guide?.retry) node.retry = { ...guide.retry };
  if (executionMode === 'agentic') node.agentOperation = { objective: '', requiredCapabilities: [...manifest.capabilities] };
  return normalizeNode(node);
}

/** Etiquetas de salida que el nodo ofrece para conectar ramas (además de la salida normal y la de error). */
export function branchOutputs(node: WorkflowNode): string[] {
  const params = node.parameters;
  if (node.type === 'logic.if') return ['true', 'false'];
  if (node.type === 'logic.switch') {
    const cases = params.cases && typeof params.cases === 'object' && !Array.isArray(params.cases) ? Object.keys(params.cases as Record<string, unknown>) : [];
    const fallback = typeof params.default === 'string' && params.default ? params.default : 'default';
    return [...cases, fallback];
  }
  if (node.type === 'ai.classify') return Array.isArray(params.labels) ? (params.labels as unknown[]).map(String).filter(Boolean) : [];
  return [];
}

/* ───────────────────────────── Borrador: edición ───────────────────────────── */

export type EditResult = { ok: true; draft: FlowDraft; id?: string } | { ok: false; error: string };

export function newDraft(createdAt: string, manifests: readonly AutomationNodeManifest[]): FlowDraft {
  const manual = manifests.find((m) => m.type === 'trigger.manual');
  if (!manual) throw new Error('El catálogo no tiene «Inicio manual»');
  const node = createNode(manual, 'inicio', 'Inicio manual');
  return {
    workflow: {
      schemaVersion: AUTOMATION_WORKFLOW_SCHEMA_VERSION, id: 'flujo-nuevo', name: 'Flujo nuevo', revision: 1, status: 'draft',
      nodes: [node], connections: [], maxConcurrency: 1, executionTimeoutMs: 120_000, tags: [], createdAt,
    },
    layout: { inicio: { x: MARGIN, y: MARGIN } },
  };
}

export function draftFromTemplate(template: FlowTemplate, orientation: Orientation = 'h'): FlowDraft {
  const workflow = template.build();
  return { workflow, layout: autoLayout(workflow, {}, orientation) };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function overlaps(a: Pos, b: Pos): boolean {
  return Math.abs(a.x - b.x) < NODE_W + 12 && Math.abs(a.y - b.y) < NODE_H + 12;
}

/** Primer hueco libre del lienzo; si hay un nodo de referencia, a su derecha («h») o debajo («v»). */
export function findFreeSpot(layout: Record<string, Pos>, near?: Pos, orientation: Orientation = 'h'): Pos {
  const taken = Object.values(layout);
  const free = (p: Pos) => taken.every((t) => !overlaps(p, t));
  if (near) {
    if (orientation === 'v') {
      for (let row = 0; row < 30; row += 1) {
        for (const col of [0, 1, -1, 2, -2, 3]) {
          const p = { x: near.x + col * (NODE_W + V_GAP_X), y: near.y + (row + 1) * (NODE_H + V_GAP_Y) };
          if (p.x >= 0 && free(p)) return p;
        }
      }
    } else {
      for (let row = 0; row < 40; row += 1) {
        const p = { x: near.x + NODE_W + GAP_X, y: near.y + row * (NODE_H + GAP_Y) };
        if (free(p)) return p;
      }
    }
  }
  for (let row = 0; row < 200; row += 1) {
    for (let col = 0; col < 12; col += 1) {
      const p = orientation === 'v'
        ? { x: MARGIN + col * (NODE_W + V_GAP_X), y: MARGIN + row * (NODE_H + V_GAP_Y) }
        : { x: MARGIN + col * (NODE_W + GAP_X), y: MARGIN + row * (NODE_H + GAP_Y) };
      if (free(p)) return p;
    }
  }
  return { x: MARGIN, y: MARGIN };
}

export function addNode(draft: FlowDraft, manifest: AutomationNodeManifest, nearNodeId?: string, orientation: Orientation = 'h'): EditResult {
  if (draft.workflow.nodes.length >= MAX_NODES) return { ok: false, error: `Máximo ${MAX_NODES} nodos por flujo.` };
  const next = clone(draft);
  const id = uniqueId(manifest.type.replace('.', '_'), next.workflow.nodes.map((n) => n.id));
  next.workflow.nodes.push(createNode(manifest, id));
  const near = nearNodeId ? next.layout[nearNodeId] : undefined;
  next.layout[id] = findFreeSpot(next.layout, near, orientation);
  return { ok: true, draft: next, id };
}

export function duplicateNode(draft: FlowDraft, nodeId: string, orientation: Orientation = 'h'): EditResult {
  const source = draft.workflow.nodes.find((n) => n.id === nodeId);
  if (!source) return { ok: false, error: 'El nodo ya no existe.' };
  if (draft.workflow.nodes.length >= MAX_NODES) return { ok: false, error: `Máximo ${MAX_NODES} nodos por flujo.` };
  const next = clone(draft);
  const id = uniqueId(source.id, next.workflow.nodes.map((n) => n.id));
  next.workflow.nodes.push({ ...clone(source), id, label: `${source.label} (copia)` });
  next.layout[id] = findFreeSpot(next.layout, draft.layout[nodeId], orientation);
  return { ok: true, draft: next, id };
}

export function removeNode(draft: FlowDraft, nodeId: string): EditResult {
  if (!draft.workflow.nodes.some((n) => n.id === nodeId)) return { ok: false, error: 'El nodo ya no existe.' };
  const next = clone(draft);
  next.workflow.nodes = next.workflow.nodes.filter((n) => n.id !== nodeId);
  next.workflow.connections = next.workflow.connections.filter((c) => c.from !== nodeId && c.to !== nodeId);
  delete next.layout[nodeId];
  return { ok: true, draft: next };
}

export function updateNode(draft: FlowDraft, nodeId: string, patch: Partial<WorkflowNode>): EditResult {
  const index = draft.workflow.nodes.findIndex((n) => n.id === nodeId);
  if (index < 0) return { ok: false, error: 'El nodo ya no existe.' };
  const next = clone(draft);
  const current = next.workflow.nodes[index]!;
  // El id, el tipo y el tipo de nodo no se cambian desde la edición: otros nodos los referencian.
  const { id: _id, type: _type, kind: _kind, version: _version, ...safe } = patch;
  void _id; void _type; void _kind; void _version;
  next.workflow.nodes[index] = normalizeNode({ ...current, ...safe });
  return { ok: true, draft: next };
}

export function moveNode(draft: FlowDraft, nodeId: string, to: Pos): FlowDraft {
  if (!draft.workflow.nodes.some((n) => n.id === nodeId)) return draft;
  return { ...draft, layout: { ...draft.layout, [nodeId]: clampPos(to) } };
}

export function renameFlow(draft: FlowDraft, name: string): FlowDraft {
  const clean = name.replace(/\s+/g, ' ').trim().slice(0, 80) || 'Flujo sin nombre';
  return { ...draft, workflow: { ...draft.workflow, name: clean } };
}

export interface FlowSettingsPatch {
  id?: string;
  maxConcurrency?: number;
  /** `null` quita el límite propio del flujo. */
  executionTimeoutMs?: number | null;
  tags?: string[];
}

/** Ajustes generales del flujo, con los mismos límites que el editor aplica al importar. */
export function updateFlowSettings(draft: FlowDraft, patch: FlowSettingsPatch): EditResult {
  const next = clone(draft);
  const wf = next.workflow;
  if (patch.id !== undefined) {
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(patch.id)) return { ok: false, error: 'El ID admite minúsculas, números, guion y guion bajo (máximo 64), y no puede empezar por símbolo.' };
    wf.id = patch.id;
  }
  if (patch.maxConcurrency !== undefined) {
    if (!Number.isInteger(patch.maxConcurrency) || patch.maxConcurrency < 1 || patch.maxConcurrency > 20) return { ok: false, error: 'Las ejecuciones a la vez deben ser un entero entre 1 y 20.' };
    wf.maxConcurrency = patch.maxConcurrency;
  }
  if (patch.executionTimeoutMs !== undefined) {
    if (patch.executionTimeoutMs === null) delete wf.executionTimeoutMs;
    else if (!Number.isInteger(patch.executionTimeoutMs) || patch.executionTimeoutMs < 1000 || patch.executionTimeoutMs > 3_600_000) return { ok: false, error: 'El tiempo límite va de 1000 ms (1 s) a 3 600 000 ms (1 h).' };
    else wf.executionTimeoutMs = patch.executionTimeoutMs;
  }
  if (patch.tags !== undefined) {
    const tags = [...new Set(patch.tags.map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean))];
    if (tags.length > 12 || tags.some((t) => t.length > 32)) return { ok: false, error: 'Máximo 12 etiquetas de hasta 32 caracteres.' };
    wf.tags = tags;
  }
  return { ok: true, draft: next };
}

function clampPos(p: Pos): Pos {
  const c = (v: number) => (Number.isFinite(v) ? Math.min(POS_MAX, Math.max(POS_MIN, Math.round(v))) : 0);
  return { x: c(p.x), y: c(p.y) };
}

function reaches(connections: readonly WorkflowConnection[], from: string, target: string): boolean {
  const seen = new Set<string>();
  const stack = [from];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === target) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const c of connections) if (c.from === current && c.branch !== 'error') stack.push(c.to);
  }
  return false;
}

export function connect(draft: FlowDraft, from: string, to: string, branch?: string): EditResult {
  const ids = new Set(draft.workflow.nodes.map((n) => n.id));
  if (!ids.has(from) || !ids.has(to)) return { ok: false, error: 'Uno de los nodos ya no existe.' };
  if (from === to) return { ok: false, error: 'Un nodo no puede conectarse consigo mismo.' };
  const target = draft.workflow.nodes.find((n) => n.id === to)!;
  if (target.kind === 'trigger') return { ok: false, error: 'Un disparador no recibe conexiones: es donde empieza el flujo.' };
  const same = (c: WorkflowConnection) => c.from === from && c.to === to && (c.branch ?? '') === (branch ?? '');
  if (draft.workflow.connections.some(same)) return { ok: false, error: 'Esa conexión ya existe.' };
  if (branch !== 'error' && reaches(draft.workflow.connections, to, from)) return { ok: false, error: 'Esa conexión crearía un ciclo; el motor no admite ciclos entre nodos.' };
  const next = clone(draft);
  next.workflow.connections.push({ from, to, ...(branch ? { branch } : {}) });
  return { ok: true, draft: next };
}

export function disconnect(draft: FlowDraft, from: string, to: string, branch?: string): FlowDraft {
  const next = clone(draft);
  next.workflow.connections = next.workflow.connections.filter((c) => !(c.from === from && c.to === to && (c.branch ?? '') === (branch ?? '')));
  return next;
}

/* ───────────────────────────── Orden, niveles y disposición ───────────────────────────── */

/** Nivel de cada nodo activo (0 = sin entradas). Ignora las ramas de error y los nodos desactivados. */
export function levelsOf(workflow: AutomationWorkflow): Map<string, number> {
  const enabled = workflow.nodes.filter((n) => !n.disabled).map((n) => n.id);
  const set = new Set(enabled);
  const incoming = new Map<string, string[]>(enabled.map((id) => [id, []]));
  for (const c of workflow.connections) {
    if (c.branch === 'error' || !set.has(c.from) || !set.has(c.to)) continue;
    incoming.get(c.to)!.push(c.from);
  }
  const level = new Map<string, number>();
  const visiting = new Set<string>();
  const visit = (id: string): number => {
    const known = level.get(id);
    if (known !== undefined) return known;
    if (visiting.has(id)) return 0; // ciclo: lo señala la validación; aquí solo se evita el bucle infinito
    visiting.add(id);
    const parents = incoming.get(id) ?? [];
    const value = parents.length === 0 ? 0 : Math.max(...parents.map(visit)) + 1;
    visiting.delete(id);
    level.set(id, value);
    return value;
  };
  for (const id of enabled) visit(id);
  return level;
}

/** Conserva las posiciones que ya existen y coloca el resto por niveles (en columnas o en filas, según la orientación). */
export function autoLayout(workflow: AutomationWorkflow, existing: Record<string, Pos>, orientation: Orientation = 'h'): Record<string, Pos> {
  const levels = levelsOf(workflow);
  const columns = new Map<number, string[]>();
  for (const node of workflow.nodes) {
    const lvl = levels.get(node.id) ?? 0;
    (columns.get(lvl) ?? columns.set(lvl, []).get(lvl)!).push(node.id);
  }
  const layout: Record<string, Pos> = {};
  for (const [lvl, ids] of [...columns.entries()].sort((a, b) => a[0] - b[0])) {
    ids.forEach((id, row) => {
      layout[id] = existing[id] ?? (orientation === 'v'
        ? { x: MARGIN + row * (NODE_W + V_GAP_X), y: MARGIN + lvl * (NODE_H + V_GAP_Y) }
        : { x: MARGIN + lvl * (NODE_W + GAP_X), y: MARGIN + row * (NODE_H + GAP_Y) });
    });
  }
  return layout;
}

export interface ExecutionPlan {
  /** Nodos por oleada: los de una misma oleada pueden ir a la vez. */
  levels: string[][];
  pauses: Array<{ nodeId: string; reason: 'aprobacion' | 'espera' }>;
  disabled: string[];
}

/** Orden previsto a partir del grafo. NO ejecuta nada: las ramas se deciden al ejecutar. */
export function executionPlan(workflow: AutomationWorkflow): ExecutionPlan {
  const levels = levelsOf(workflow);
  const byLevel: string[][] = [];
  for (const node of workflow.nodes) {
    const lvl = levels.get(node.id);
    if (lvl === undefined) continue;
    (byLevel[lvl] ??= []).push(node.id);
  }
  const pauses: ExecutionPlan['pauses'] = [];
  for (const node of workflow.nodes) {
    if (node.disabled) continue;
    if (node.kind === 'approval' || node.requiresApproval) pauses.push({ nodeId: node.id, reason: 'aprobacion' });
    else if (node.kind === 'wait') pauses.push({ nodeId: node.id, reason: 'espera' });
  }
  return { levels: byLevel.filter(Boolean), pauses, disabled: workflow.nodes.filter((n) => n.disabled).map((n) => n.id) };
}

/* ───────────────────────────── Problemas ───────────────────────────── */

export type ProblemLevel = 'error' | 'warn' | 'info';
export type ProblemKind = 'estructura' | 'entorno' | 'seguridad' | 'parametros' | 'conexion';
export interface Problem { level: ProblemLevel; kind: ProblemKind; nodeId?: string; text: string }

const ENGINE_ES: ReadonlyArray<[RegExp, string]> = [
  [/requires at least one enabled trigger node/i, 'Falta un disparador activo (inicio manual, programado, webhook…).'],
  [/requires toolOperation/i, 'Este nodo necesita conector y acción.'],
  [/requires approval because it is high-risk or irreversible/i, 'Es de alto riesgo o irreversible: debe pedir aprobación.'],
  [/contains a cycle/i, 'El flujo tiene un ciclo; el motor no admite ciclos entre nodos.'],
  [/cannot connect to itself/i, 'Un nodo no puede conectarse consigo mismo.'],
  [/Duplicate workflow node id/i, 'Hay dos nodos con el mismo ID.'],
  [/unknown (source|target) node/i, 'Hay una conexión hacia un nodo que no existe.'],
  [/requires agentOperation\.objective/i, 'El agente necesita un objetivo.'],
  [/credentialRefs must contain references/i, 'Una credencial parece un secreto: usa una referencia, nunca el valor.'],
  [/cannot declare agentOperation/i, 'Un nodo determinista no puede llevar operación de agente.'],
  [/requires at least one node/i, 'El flujo no tiene nodos.'],
  [/retry\.maxAttempts/i, 'Los reintentos deben ser al menos 1.'],
  [/timeoutMs must be > 0/i, 'El tiempo límite debe ser mayor que 0.'],
];

function nodeIdIn(text: string, ids: ReadonlySet<string>): string | undefined {
  for (const match of text.matchAll(/node(?: id)?:? ([^\s;,]+)/gi)) {
    const candidate = match[1];
    if (candidate && ids.has(candidate)) return candidate;
  }
  return undefined;
}

function textParam(node: WorkflowNode, key: string): string {
  const value = node.parameters[key];
  return typeof value === 'string' ? value.trim() : '';
}

/** Comprobaciones de parámetros que el motor haría al ejecutar (y que fallarían). */
function parameterProblems(node: WorkflowNode): string[] {
  const out: string[] = [];
  const p = node.parameters;
  switch (node.type) {
    case 'action.tool':
      if (!node.toolOperation?.tool.trim() || !node.toolOperation.action.trim()) out.push('Falta elegir el conector y la acción.');
      break;
    case 'http.request':
      if (!textParam(node, 'endpoint')) out.push('Falta el nombre del endpoint autorizado.');
      break;
    case 'subflow.run':
      if (!textParam(node, 'workflowId')) out.push('Falta el ID del flujo que se ejecutará.');
      break;
    case 'ai.research':
      if (!textParam(node, 'question')) out.push('Falta la pregunta.');
      break;
    case 'ai.complete':
      if (!textParam(node, 'prompt')) out.push('Falta la instrucción (prompt).');
      break;
    case 'ai.classify':
      if (!Array.isArray(p.labels) || p.labels.filter((l) => String(l).trim()).length < 2) out.push('Se necesitan al menos dos etiquetas.');
      break;
    case 'ai.extract':
      if (!Array.isArray(p.fields) || p.fields.length === 0) out.push('Falta indicar qué campos extraer.');
      break;
    case 'code.js':
    case 'code.python':
      if (!textParam(node, 'source')) out.push('El código está vacío.');
      break;
    case 'logic.switch':
      if (!p.cases || typeof p.cases !== 'object' || Object.keys(p.cases as object).length === 0) out.push('Faltan los casos del selector.');
      break;
    case 'trigger.schedule':
      if (!textParam(node, 'cron')) out.push('Falta la expresión cron.');
      break;
    case 'trigger.event':
      if (!textParam(node, 'topic')) out.push('Falta el tema del evento.');
      break;
    case 'trigger.webhook':
      if (!textParam(node, 'path').startsWith('/')) out.push('La ruta del webhook debe empezar por «/».');
      break;
    default:
      break;
  }
  if (node.executionMode === 'agentic' && !node.agentOperation?.objective.trim()) out.push('Falta el objetivo del agente.');
  return out;
}

export function analyzeDraft(draft: FlowDraft, registry: AutomationNodeRegistry): Problem[] {
  const { workflow } = draft;
  const problems: Problem[] = [];
  const ids = new Set(workflow.nodes.map((n) => n.id));
  const byId = new Map(workflow.nodes.map((n) => [n.id, n] as const));

  for (const error of validateAutomationWorkflow(workflow).errors) {
    const known = ENGINE_ES.find(([re]) => re.test(error));
    const nodeId = nodeIdIn(error, ids);
    problems.push({ level: 'error', kind: 'estructura', ...(nodeId ? { nodeId } : {}), text: known ? known[1] : `Motor: ${error}` });
  }

  for (const node of workflow.nodes) {
    if (node.disabled) continue;
    const check = registry.checkNode(node);
    if (!check.ok) for (const error of check.errors) problems.push({ level: 'error', kind: 'entorno', nodeId: node.id, text: `En reposo en este entorno: ${error}` });
    for (const text of parameterProblems(node)) problems.push({ level: 'error', kind: 'parametros', nodeId: node.id, text });
    for (const finding of findSecretLikeValues(node.parameters, 'parametros')) {
      problems.push({ level: 'error', kind: 'seguridad', nodeId: node.id, text: `Posible secreto en «${finding.path}»: ${finding.why}. Usa una referencia (ref:, vault:, env:), nunca el valor.` });
    }
  }

  // Alcanzabilidad desde los disparadores activos.
  const triggers = workflow.nodes.filter((n) => n.kind === 'trigger' && !n.disabled).map((n) => n.id);
  const reachable = new Set<string>();
  const stack = [...triggers];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    for (const c of workflow.connections) if (c.from === id) stack.push(c.to);
  }
  for (const node of workflow.nodes) {
    if (node.disabled || reachable.has(node.id)) continue;
    problems.push({ level: 'warn', kind: 'conexion', nodeId: node.id, text: 'No está conectado a ningún disparador: el motor lo ejecutaría al inicio, junto con el disparador.' });
  }
  for (const c of workflow.connections) {
    const from = byId.get(c.from);
    if (!from || !c.branch || c.branch === 'success') continue;
    if (c.branch === 'error') {
      if (from.onError !== 'error_branch') problems.push({ level: 'warn', kind: 'conexion', nodeId: c.from, text: `La rama de error hacia «${c.to}» solo se usa si el nodo tiene «Al fallar: rama de error».` });
      continue;
    }
    const offered = branchOutputs(from);
    if (offered.length > 0 && !offered.includes(c.branch)) problems.push({ level: 'warn', kind: 'conexion', nodeId: c.from, text: `La rama «${c.branch}» hacia «${c.to}» no existe en este nodo (ramas: ${offered.join(', ')}); esa conexión nunca se activaría.` });
    if (offered.length === 0) problems.push({ level: 'warn', kind: 'conexion', nodeId: c.from, text: `Este nodo no tiene ramas; la conexión con rama «${c.branch}» hacia «${c.to}» nunca se activaría.` });
  }
  return problems;
}

export function isPublishReady(problems: readonly Problem[]): boolean {
  return !problems.some((p) => p.level === 'error');
}

/* ───────────────────────────── Importar y exportar ───────────────────────────── */

export const DRAFT_FORMAT = 'janus-flow-draft' as const;

export function serializeDraft(draft: FlowDraft): string {
  return JSON.stringify({ format: DRAFT_FORMAT, version: 1, workflow: draft.workflow, layout: draft.layout }, null, 2);
}

/** Antes de exportar: un borrador con valores que parecen secretos no sale del editor. */
export function exportBlockers(draft: FlowDraft): string[] {
  return draft.workflow.nodes.flatMap((node) => findSecretLikeValues(node.parameters, `${node.id}.parametros`).map((f) => `${f.path}: ${f.why}`));
}

export type ParseResult = { ok: true; draft: FlowDraft } | { ok: false; error: string };

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function hasForbiddenKey(value: unknown, depth = 0): boolean {
  if (depth > 60) return true;
  if (Array.isArray(value)) return value.some((item) => hasForbiddenKey(item, depth + 1));
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).some(([key, item]) => FORBIDDEN_KEYS.has(key) || hasForbiddenKey(item, depth + 1));
  }
  return false;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function nodeShapeError(raw: unknown, index: number): string | null {
  if (!isObject(raw)) return `El nodo ${index + 1} no es un objeto.`;
  const label = typeof raw.id === 'string' ? raw.id : `#${index + 1}`;
  if (typeof raw.id !== 'string' || typeof raw.type !== 'string' || typeof raw.label !== 'string') return `El nodo ${label} necesita id, type y label de texto.`;
  if (!Number.isInteger(raw.version)) return `El nodo ${label} necesita una versión entera.`;
  if (typeof raw.kind !== 'string' || !KINDS.has(raw.kind)) return `El nodo ${label} tiene un tipo de nodo (kind) desconocido.`;
  if (typeof raw.executionMode !== 'string' || !MODES.has(raw.executionMode)) return `El nodo ${label} tiene un modo de ejecución desconocido.`;
  if (!isObject(raw.parameters)) return `El nodo ${label} necesita parameters como objeto.`;
  if (typeof raw.risk !== 'string' || !(RISKS as readonly string[]).includes(raw.risk)) return `El nodo ${label} tiene un riesgo desconocido.`;
  if (typeof raw.reversible !== 'boolean' || typeof raw.requiresApproval !== 'boolean') return `El nodo ${label} necesita reversible y requiresApproval (verdadero/falso).`;
  if (raw.onError !== undefined && (typeof raw.onError !== 'string' || !ON_ERROR.has(raw.onError))) return `El nodo ${label} tiene un valor onError desconocido.`;
  if (raw.toolOperation !== undefined && (!isObject(raw.toolOperation) || typeof raw.toolOperation.tool !== 'string' || typeof raw.toolOperation.action !== 'string')) return `El nodo ${label} tiene una toolOperation mal formada.`;
  if (raw.agentOperation !== undefined && (!isObject(raw.agentOperation) || typeof raw.agentOperation.objective !== 'string' || !Array.isArray(raw.agentOperation.requiredCapabilities))) return `El nodo ${label} tiene una agentOperation mal formada.`;
  return null;
}

/** Lee un borrador exportado. Rechaza lo que no tiene forma de borrador; lo que tiene forma pero no valida se carga para poder arreglarlo. */
export function parseDraft(text: string, orientation: Orientation = 'h'): ParseResult {
  if (text.length > MAX_DRAFT_BYTES) return { ok: false, error: 'El archivo es demasiado grande (máximo 512 KB).' };
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, error: 'No es un JSON válido.' }; }
  if (hasForbiddenKey(raw)) return { ok: false, error: 'El contenido tiene claves no permitidas (__proto__, constructor, prototype).' };
  if (!isObject(raw)) return { ok: false, error: 'No tiene forma de borrador de flujo.' };
  const workflow = raw.format === DRAFT_FORMAT ? raw.workflow : raw; // se admite también un AutomationWorkflow suelto
  if (!isObject(workflow)) return { ok: false, error: 'Falta el flujo (workflow).' };
  if (workflow.schemaVersion !== AUTOMATION_WORKFLOW_SCHEMA_VERSION) return { ok: false, error: `Versión de esquema no admitida: ${String(workflow.schemaVersion)}.` };
  for (const field of ['id', 'name', 'createdAt'] as const) if (typeof workflow[field] !== 'string') return { ok: false, error: `El flujo necesita ${field} de texto.` };
  for (const field of ['revision', 'maxConcurrency'] as const) if (!Number.isInteger(workflow[field])) return { ok: false, error: `El flujo necesita ${field} entero.` };
  if (workflow.status !== 'draft' && workflow.status !== 'published' && workflow.status !== 'historical') return { ok: false, error: 'El estado del flujo no es válido.' };
  if (!Array.isArray(workflow.nodes) || !Array.isArray(workflow.connections)) return { ok: false, error: 'El flujo necesita listas de nodos y conexiones.' };
  if (workflow.nodes.length > MAX_NODES) return { ok: false, error: `Máximo ${MAX_NODES} nodos por flujo.` };
  for (let i = 0; i < workflow.nodes.length; i += 1) {
    const error = nodeShapeError(workflow.nodes[i], i);
    if (error) return { ok: false, error };
  }
  for (const [i, c] of (workflow.connections as unknown[]).entries()) {
    if (!isObject(c) || typeof c.from !== 'string' || typeof c.to !== 'string' || (c.branch !== undefined && typeof c.branch !== 'string')) return { ok: false, error: `La conexión ${i + 1} está mal formada.` };
  }
  const clean = clone(workflow) as unknown as AutomationWorkflow;
  // Un borrador importado siempre entra como borrador: publicar es una decisión posterior y del Founder.
  clean.status = 'draft';
  const layoutRaw = isObject(raw) && isObject(raw.layout) ? raw.layout : {};
  const existing: Record<string, Pos> = {};
  for (const [id, value] of Object.entries(layoutRaw)) {
    if (clean.nodes.some((n) => n.id === id) && isObject(value) && typeof value.x === 'number' && typeof value.y === 'number') existing[id] = clampPos({ x: value.x, y: value.y });
  }
  return { ok: true, draft: { workflow: clean, layout: autoLayout(clean, existing, orientation) } };
}
