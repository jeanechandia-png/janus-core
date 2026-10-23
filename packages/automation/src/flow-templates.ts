import type { AutomationNodeRegistry } from './node-registry.js';
import type { ConnectorLike } from './node-catalog.js';
import { createAutomationWorkflow, type AutomationWorkflow, type WorkflowConnection, type WorkflowNode } from './workflow.js';

/**
 * Starter flows for the Janus flow engine. They are DRAFTS built only from nodes and connectors that exist.
 * `requires` is explicit and `templateReadiness` checks it against the real runtime, so a template never pretends to
 * work: if a connector or endpoint is missing, the reason is returned instead of a green light.
 *
 * Contain NO personal data: city, coordinates, mailbox or names are parameters supplied locally at install time.
 */
export interface FlowTemplateRequirements {
  /** `tool.action` pairs that must exist in the Tool Gateway. */
  tools: string[];
  /** Named HTTP endpoints the Founder must authorise (JANUS_HTTP_ENDPOINTS). */
  endpoints: string[];
}

export interface FlowTemplateParams {
  /** Europe/Amsterdam by default (Founder's timezone); override locally. */
  timezone?: string;
  latitude?: number;
  longitude?: number;
  /** Cron expression for scheduled templates. */
  cron?: string;
}

export interface FlowTemplate {
  id: string;
  name: string;
  description: string;
  category: 'agenda' | 'dron' | 'correo' | 'investigacion' | 'casa';
  requires: FlowTemplateRequirements;
  build(params?: FlowTemplateParams): AutomationWorkflow;
}

type Extra = Partial<WorkflowNode>;
const n = (id: string, kind: WorkflowNode['kind'], type: string, label: string, parameters: Record<string, unknown> = {}, extra: Extra = {}): WorkflowNode => ({
  id, type, version: 1, label, kind, executionMode: 'deterministic', parameters, risk: 'none', reversible: true, requiresApproval: false, ...extra,
});
const trigger = (type: 'manual' | 'schedule', label: string, parameters: Record<string, unknown> = {}): WorkflowNode =>
  n('inicio', 'trigger', `trigger.${type}`, label, parameters, { toolOperation: type === 'manual' ? { tool: 'manual', action: 'receive' } : { tool: 'scheduler', action: 'tick' } });
const tool = (id: string, label: string, t: string, action: string, parameters: Record<string, unknown> = {}, extra: Extra = {}): WorkflowNode =>
  n(id, 'action', 'action.tool', label, parameters, { toolOperation: { tool: t, action }, ...extra });
const http = (id: string, label: string, parameters: Record<string, unknown>, extra: Extra = {}): WorkflowNode =>
  n(id, 'action', 'http.request', label, { method: 'GET', ...parameters }, { toolOperation: { tool: 'http', action: 'request.read' }, retry: { maxAttempts: 3, backoffMs: 500, maxBackoffMs: 4000 }, timeoutMs: 20_000, ...extra });
const chain = (...ids: string[]): WorkflowConnection[] => ids.slice(1).map((to, i) => ({ from: ids[i]!, to }));

const wf = (id: string, name: string, tags: string[], nodes: WorkflowNode[], connections: WorkflowConnection[]): AutomationWorkflow =>
  createAutomationWorkflow({ id, name, revision: 1, status: 'draft', maxConcurrency: 1, executionTimeoutMs: 120_000, tags, nodes, connections });

const WIND_JS = [
  '// Umbrales de RECOMENDACIÓN para un dron <249 g (Atom 2): viento 25/32 km/h, rachas 30/38 km/h. Ajústalos tú.',
  'const h = (input && input.hourly) || {};',
  'const w = (h.wind_speed_10m || []).filter(Number.isFinite);',
  'const g = (h.wind_gusts_10m || []).filter(Number.isFinite);',
  'const maxWind = w.length ? Math.max.apply(null, w) : null;',
  'const maxGust = g.length ? Math.max.apply(null, g) : null;',
  'if (maxWind === null && maxGust === null) return { verdict: "sin_datos", maxWind, maxGust };',
  'let verdict = "apto";',
  'if ((maxWind || 0) > 32 || (maxGust || 0) > 38) verdict = "no_volar";',
  'else if ((maxWind || 0) > 25 || (maxGust || 0) > 30) verdict = "precaucion";',
  'return { verdict, maxWind, maxGust };',
].join('\n');

const INBOX_JS = [
  'const msgs = (input && input.messages) || [];',
  'return { count: msgs.length, text: msgs.slice(0, 15).map((m, i) => (i + 1) + ". " + [m.from, m.subject, m.snippet].filter(Boolean).join(" | ")).join("\\n") };',
].join('\n');

export const FLOW_TEMPLATES: readonly FlowTemplate[] = [
  {
    id: 'briefing-matinal',
    name: 'Briefing matinal',
    description: 'Cada mañana: tiempo del día + agenda de hoy → resumen breve. Entrega el resultado como salida del flujo (aún sin canal de aviso).',
    category: 'agenda',
    requires: { tools: ['google-workspace.calendar.events.list'], endpoints: ['clima'] },
    build: (p = {}) => wf('tpl-briefing-matinal', 'Briefing matinal', ['plantilla', 'agenda'], [
      trigger('schedule', 'Cada mañana laborable', { cron: p.cron ?? '0 7 * * 1-5', timezone: p.timezone ?? 'Europe/Amsterdam' }),
      http('clima', 'Tiempo de hoy', { endpoint: 'clima', path: '/forecast', query: { latitude: p.latitude ?? '{{ $vars.latitude }}', longitude: p.longitude ?? '{{ $vars.longitude }}', hourly: 'temperature_2m,precipitation_probability', forecast_days: 1, timezone: p.timezone ?? 'Europe/Amsterdam' } }),
      tool('agenda', 'Agenda de hoy', 'google-workspace', 'calendar.events.list', { maxResults: 15 }),
      n('resumen', 'ai', 'ai.summarize', 'Resumir el día', { text: { tiempo: '{{ $nodes.clima.output.body }}', agenda: '{{ $nodes.agenda.output }}' }, maxWords: 90, system: 'Eres Janus. Redacta un briefing matinal en español para el Founder: primero lo que requiere su atención, luego el tiempo. Sin inventar datos.' }),
      n('salida', 'transform', 'transform.pick', 'Entregar briefing', { from: { briefing: '{{ $nodes.resumen.output.text }}' }, keys: ['briefing'] }),
    ], [...chain('inicio', 'clima', 'resumen', 'salida'), { from: 'inicio', to: 'agenda' }, { from: 'agenda', to: 'resumen' }]),
  },
  {
    id: 'alerta-dron',
    name: 'Alerta de viento para el dron',
    description: 'Mira el viento y las rachas de las próximas horas y avisa si no conviene volar (umbrales de recomendación del Atom 2).',
    category: 'dron',
    requires: { tools: [], endpoints: ['clima'] },
    build: (p = {}) => wf('tpl-alerta-dron', 'Alerta de viento para el dron', ['plantilla', 'dron'], [
      trigger('schedule', 'Cada día a primera hora', { cron: p.cron ?? '30 7 * * *', timezone: p.timezone ?? 'Europe/Amsterdam' }),
      http('clima', 'Viento por hora', { endpoint: 'clima', path: '/forecast', query: { latitude: p.latitude ?? '{{ $vars.latitude }}', longitude: p.longitude ?? '{{ $vars.longitude }}', hourly: 'wind_speed_10m,wind_gusts_10m', forecast_days: 1, timezone: p.timezone ?? 'Europe/Amsterdam' } }),
      n('veredicto', 'code', 'code.js', 'Calcular veredicto', { source: WIND_JS, input: '{{ $nodes.clima.output.body }}' }),
      n('hay_riesgo', 'logic', 'logic.if', '¿Conviene avisar?', { left: '{{ $nodes.veredicto.output.verdict }}', op: 'neq', right: 'apto' }),
      n('aviso', 'transform', 'transform.template', 'Redactar aviso', { template: 'Dron: {{ $nodes.veredicto.output.verdict }} · viento máx {{ $nodes.veredicto.output.maxWind }} km/h, rachas {{ $nodes.veredicto.output.maxGust }} km/h (recomendación; decide el piloto).' }),
    ], [...chain('inicio', 'clima', 'veredicto', 'hay_riesgo'), { from: 'hay_riesgo', to: 'aviso', branch: 'true' }]),
  },
  {
    id: 'correo-triaje',
    name: 'Triaje de correo',
    description: 'Revisa el correo no leído del último día y decide si algo requiere atención hoy, con un resumen. No envía ni borra nada.',
    category: 'correo',
    requires: { tools: ['google-workspace.gmail.messages.search'], endpoints: [] },
    build: (p = {}) => wf('tpl-correo-triaje', 'Triaje de correo', ['plantilla', 'correo'], [
      trigger('schedule', 'Dos veces al día', { cron: p.cron ?? '0 8,16 * * 1-5', timezone: p.timezone ?? 'Europe/Amsterdam' }),
      tool('correo', 'Correo no leído', 'google-workspace', 'gmail.messages.search', { query: 'is:unread newer_than:1d', maxResults: 15 }),
      n('plano', 'code', 'code.js', 'Preparar lista', { source: INBOX_JS, input: '{{ $nodes.correo.output }}' }),
      n('decidir', 'ai', 'ai.classify', 'Clasificar el lote', { text: '{{ $nodes.plano.output.text }}', labels: ['requiere_atencion', 'puede_esperar'] }),
      n('resumen', 'ai', 'ai.summarize', 'Resumir lo importante', { text: '{{ $nodes.plano.output.text }}', maxWords: 80 }),
    ], [...chain('inicio', 'correo', 'plano', 'decidir'), { from: 'decidir', to: 'resumen', branch: 'requiere_atencion' }]),
  },
  {
    id: 'investigacion-fuentes',
    name: 'Investigación con fuentes citadas',
    description: 'Pregunta → búsqueda → respuesta con citas numeradas, nivel de fuente y veredicto verificable. Rechaza lo que no se sostiene.',
    category: 'investigacion',
    requires: { tools: [], endpoints: [] },
    build: () => wf('tpl-investigacion-fuentes', 'Investigación con fuentes citadas', ['plantilla', 'investigacion'], [
      trigger('manual', 'Pregunta'),
      n('investigar', 'ai', 'ai.research', 'Investigar con citas', { question: '{{ $input.question }}', maxSources: 8 }, { timeoutMs: 120_000 }),
      n('comprobar', 'verification', 'verification.assert', 'Rechazar si no se sostiene', { left: '{{ $nodes.investigar.output.verdict }}', op: 'neq', right: 'RECHAZADO', message: 'La respuesta no superó la verificación de fuentes.' }),
      n('salida', 'transform', 'transform.pick', 'Entregar respuesta', { from: '{{ $nodes.investigar.output }}', keys: ['answer', 'verdict', 'coverage', 'sources', 'warnings'] }),
    ], chain('inicio', 'investigar', 'comprobar', 'salida')),
  },
  {
    id: 'llegada-a-casa',
    name: 'Llegada a casa',
    description: 'Al llegar: activa la escena de luces y avisa. Requiere conectar domótica (Tuya/LSC), que todavía no está disponible.',
    category: 'casa',
    requires: { tools: ['home-scenes.scene.activate'], endpoints: [] },
    build: () => wf('tpl-llegada-a-casa', 'Llegada a casa', ['plantilla', 'casa'], [
      trigger('manual', 'Llegada (manual por ahora)'),
      tool('escena', 'Activar escena', 'home-scenes', 'scene.activate', { scene: 'llegada' }, { risk: 'low', reversible: true }),
    ], chain('inicio', 'escena')),
  },
];

export function getFlowTemplate(id: string): FlowTemplate | undefined {
  return FLOW_TEMPLATES.find((t) => t.id === id);
}

export interface TemplateReadiness {
  id: string;
  ready: boolean;
  missing: string[];
}

/** Checks a template against what the runtime really has (node registry, connectors, authorised endpoints). */
export function templateReadiness(
  template: FlowTemplate,
  env: { registry: AutomationNodeRegistry; connectors: readonly ConnectorLike[]; endpoints?: readonly string[] },
): TemplateReadiness {
  const missing = new Set<string>();
  const workflow = template.build();
  for (const node of workflow.nodes) {
    const check = env.registry.checkNode(node);
    if (!check.ok) for (const e of check.errors) missing.add(`${node.id}: ${e}`);
  }
  for (const requirement of template.requires.tools) {
    const dot = requirement.indexOf('.');
    const name = requirement.slice(0, dot);
    const action = requirement.slice(dot + 1);
    const connector = env.connectors.find((c) => c.name === name);
    if (!connector) missing.add(`Conector no registrado: ${name}`);
    else if (!connector.capabilities.includes(action)) missing.add(`El conector ${name} no ofrece la acción ${action}`);
  }
  for (const endpoint of template.requires.endpoints) {
    if (!(env.endpoints ?? []).includes(endpoint)) missing.add(`Endpoint HTTP sin autorizar: ${endpoint} (JANUS_HTTP_ENDPOINTS)`);
  }
  return { id: template.id, ready: missing.size === 0, missing: [...missing] };
}
