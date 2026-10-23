import { AutomationNodeRegistry, type AutomationNodeAvailability, type AutomationNodeManifest } from './node-registry.js';

/**
 * Built-in node catalog of the Janus flow engine (n8n-inspired, Janus-owned).
 *
 * HONESTY RULE: a node is only `available` when the runtime really has what it needs. Otherwise it is registered with a
 * precise `reason`, so validation (`AutomationNodeRegistry.checkNode`) refuses to publish a workflow that could never run.
 * Nothing here claims a connector works: connector state comes from `connectorCatalog`, built from the adapters
 * actually registered in the Tool Gateway.
 */
export interface NodeCatalogEnv {
  /** A Tool Gateway is wired (action.tool / http.request can run). */
  tools?: boolean;
  /** A Model Gateway is wired (ai.summarize/classify/extract/complete). */
  models?: boolean;
  /** An Agent Swarm executor is wired (ai.agent). */
  agent?: boolean;
  /** Cited research is wired (ai.research): a search provider AND a model. */
  research?: boolean;
  /** Sandboxed JavaScript runner available. */
  javascript?: boolean;
  /** Sandboxed Python runner available (needs WASM/container isolation). */
  python?: boolean;
  /** The runtime has a scheduler loop for cron / poll triggers. */
  scheduler?: boolean;
  /** The runtime exposes an authenticated webhook receiver. */
  webhookServer?: boolean;
  /** The runtime publishes events on an internal bus that flows can subscribe to. */
  eventBus?: boolean;
  /** Names of HTTP endpoints the Founder authorised (never URLs). */
  httpEndpoints?: readonly string[];
}

type Spec = Pick<AutomationNodeManifest, 'type' | 'displayName' | 'kind' | 'capabilities'> & {
  executionModes?: AutomationNodeManifest['executionModes'];
  credentialKinds?: string[];
  needs?: (env: NodeCatalogEnv) => { ok: true } | { ok: false; availability: Exclude<AutomationNodeAvailability, 'available'>; reason: string };
};

const yes = { ok: true } as const;
const unavailable = (reason: string) => ({ ok: false, availability: 'unavailable', reason }) as const;
const needsAuth = (reason: string) => ({ ok: false, availability: 'needs_auth', reason }) as const;

const SPECS: Spec[] = [
  // Disparadores
  { type: 'trigger.manual', displayName: 'Inicio manual', kind: 'trigger', capabilities: ['trigger.manual'] },
  { type: 'trigger.schedule', displayName: 'Programado (cron)', kind: 'trigger', capabilities: ['trigger.schedule'], needs: (e) => (e.scheduler ? yes : unavailable('El despachador de disparadores ya existe y está probado (`FlowTriggerDispatcher`), pero el runtime todavía no lo arranca; en reposo hasta entonces.')) },
  { type: 'trigger.poll', displayName: 'Consulta periódica', kind: 'trigger', capabilities: ['trigger.poll'], needs: () => unavailable('Aún no soportado por el despachador (no hay cursor de consulta); usa un disparador programado.') },
  { type: 'trigger.webhook', displayName: 'Webhook entrante', kind: 'trigger', capabilities: ['trigger.webhook'], needs: (e) => (e.webhookServer ? yes : unavailable('El receptor firmado (HMAC) ya existe en el despachador, pero el runtime todavía no expone la ruta HTTP; en reposo hasta entonces.')) },
  { type: 'trigger.event', displayName: 'Evento de Janus', kind: 'trigger', capabilities: ['trigger.event'], needs: (e) => (e.eventBus ? yes : unavailable('El despachador ya sabe recibir eventos, pero el bus de eventos del runtime aún no está conectado a los flujos; en reposo hasta entonces.')) },
  // Lógica y control
  { type: 'logic.if', displayName: 'Condición (si / si no)', kind: 'logic', capabilities: ['logic.branch'] },
  { type: 'logic.switch', displayName: 'Selector de ramas', kind: 'logic', capabilities: ['logic.branch'] },
  { type: 'wait.delay', displayName: 'Esperar', kind: 'wait', capabilities: ['flow.wait'] },
  { type: 'approval.request', displayName: 'Pedir aprobación', kind: 'approval', capabilities: ['flow.approval'] },
  { type: 'verification.assert', displayName: 'Verificar condición', kind: 'verification', capabilities: ['flow.verify'] },
  { type: 'subflow.run', displayName: 'Ejecutar subflujo', kind: 'subflow', capabilities: ['flow.subflow'] },
  // Datos
  { type: 'transform.set', displayName: 'Definir valores', kind: 'transform', capabilities: ['data.transform'] },
  { type: 'transform.pick', displayName: 'Elegir campos', kind: 'transform', capabilities: ['data.transform'] },
  { type: 'transform.template', displayName: 'Plantilla de texto', kind: 'transform', capabilities: ['data.transform'] },
  // Código
  { type: 'code.js', displayName: 'Código JavaScript', kind: 'code', capabilities: ['code.javascript'], needs: (e) => (e.javascript ? yes : unavailable('Falta el ejecutor aislado de JavaScript.')) },
  { type: 'code.python', displayName: 'Código Python', kind: 'code', capabilities: ['code.python'], needs: (e) => (e.python ? yes : unavailable('Python necesita aislamiento real (Pyodide/WASM o contenedor); aún no está instalado, por eso no se simula.')) },
  // IA
  { type: 'ai.summarize', displayName: 'IA: resumir', kind: 'ai', capabilities: ['ai.text'], needs: (e) => (e.models ? yes : unavailable('Falta el Model Gateway.')) },
  { type: 'ai.classify', displayName: 'IA: clasificar y enrutar', kind: 'ai', capabilities: ['ai.text'], needs: (e) => (e.models ? yes : unavailable('Falta el Model Gateway.')) },
  { type: 'ai.extract', displayName: 'IA: extraer campos', kind: 'ai', capabilities: ['ai.text'], needs: (e) => (e.models ? yes : unavailable('Falta el Model Gateway.')) },
  { type: 'ai.complete', displayName: 'IA: instrucción libre', kind: 'ai', capabilities: ['ai.text'], needs: (e) => (e.models ? yes : unavailable('Falta el Model Gateway.')) },
  { type: 'ai.research', displayName: 'IA: investigar con fuentes citadas', kind: 'ai', capabilities: ['ai.research', 'web.search'], needs: (e) => (e.research ? yes : needsAuth('Necesita un buscador (p. ej. Perplexity con su API key) y un modelo para sintetizar con citas.')) },
  { type: 'ai.agent', displayName: 'Agente (Agent Swarm)', kind: 'ai', capabilities: ['ai.agent'], executionModes: ['agentic'], needs: (e) => (e.agent ? yes : unavailable('Agent Swarm no está conectado al motor de flujos.')) },
  // Conectividad
  { type: 'action.tool', displayName: 'Acción de conector', kind: 'action', capabilities: ['tool.call'], needs: (e) => (e.tools ? yes : unavailable('Falta el Tool Gateway.')) },
  {
    type: 'http.request', displayName: 'Petición HTTP / REST', kind: 'action', capabilities: ['http.read', 'http.send'], credentialKinds: ['http-endpoint'],
    needs: (e) => (!e.tools ? unavailable('Falta el Tool Gateway.') : (e.httpEndpoints?.length ?? 0) > 0 ? yes : needsAuth('Autoriza al menos un endpoint por nombre en JANUS_HTTP_ENDPOINTS; los flujos nunca escriben URLs libres.')),
  },
];

export function builtinNodeManifests(env: NodeCatalogEnv = {}): AutomationNodeManifest[] {
  return SPECS.map((spec) => {
    const check = spec.needs ? spec.needs(env) : yes;
    return {
      type: spec.type,
      version: 1,
      displayName: spec.displayName,
      kind: spec.kind,
      executionModes: spec.executionModes ?? ['deterministic'],
      capabilities: [...spec.capabilities],
      availability: check.ok ? 'available' : check.availability,
      ...(spec.credentialKinds ? { credentialKinds: [...spec.credentialKinds] } : {}),
      ...(check.ok ? {} : { reason: check.reason }),
    } satisfies AutomationNodeManifest;
  });
}

export function registerBuiltinNodes(registry: AutomationNodeRegistry, env: NodeCatalogEnv = {}): AutomationNodeManifest[] {
  const manifests = builtinNodeManifests(env);
  for (const manifest of manifests) registry.register(manifest);
  return manifests;
}

/* ---------------------------------------------------------------------------------------------------------------- */

export interface ConnectorLike {
  readonly name: string;
  readonly capabilities: readonly string[];
}

export interface ConnectorState {
  state: 'available' | 'needs_auth' | 'unavailable';
  reason?: string;
}

export interface ConnectorCatalogEntry {
  tool: string;
  actions: string[];
  /** Acciones que escriben o gastan (el Tool Gateway exige permiso de autoridad). */
  privilegedActions: string[];
  state: ConnectorState['state'];
  reason?: string;
}

export interface ConnectorCatalog {
  /** Conectores (ToolAdapter) realmente registrados — no incluye adaptadores de modelo ni de voz. */
  total: number;
  available: number;
  needsAuth: number;
  unavailable: number;
  entries: ConnectorCatalogEntry[];
}

const PRIVILEGED = /(create|update|delete|send|publish|deploy|pay|purchase|rotate|disable|transfer|grant|revoke|trigger|redeploy|restore|apply|execute)/i;

/**
 * Builds the connector catalog from the adapters registered in the Tool Gateway. `states` (optional) carries what the
 * runtime knows about credentials; a connector without a declared state is reported `needs_auth`, never `available`,
 * because registration alone does not prove a credential exists.
 */
export function connectorCatalog(adapters: readonly ConnectorLike[], states: Readonly<Record<string, ConnectorState>> = {}): ConnectorCatalog {
  const entries = adapters
    .map((adapter): ConnectorCatalogEntry => {
      const declared = states[adapter.name];
      const state = declared?.state ?? 'needs_auth';
      return {
        tool: adapter.name,
        actions: [...adapter.capabilities].sort(),
        privilegedActions: adapter.capabilities.filter((a) => PRIVILEGED.test(a)).sort(),
        state,
        ...(declared?.reason ? { reason: declared.reason } : declared ? {} : { reason: 'Estado de credenciales no verificado.' }),
      };
    })
    .sort((a, b) => a.tool.localeCompare(b.tool));
  return {
    total: entries.length,
    available: entries.filter((e) => e.state === 'available').length,
    needsAuth: entries.filter((e) => e.state === 'needs_auth').length,
    unavailable: entries.filter((e) => e.state === 'unavailable').length,
    entries,
  };
}
