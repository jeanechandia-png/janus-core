/**
 * HITL — clasificación determinista de operaciones (pilar 4 de la arquitectura anti-obsolescencia).
 *
 * Decide, SIN modelo, si una operación puede ejecutarse sola o debe esperar la aprobación del CEO en su dispositivo.
 * Complementa (no sustituye) a `sensitive-action-policy.ts`: aquella lista nombra acciones concretas de adaptadores;
 * esta regla cubre cualquier operación descubierta en tiempo real desde una especificación (OpenAPI, GraphQL, MCP).
 *
 *   auto        lecturas (GET/HEAD/OPTIONS, consultas GraphQL), borradores y pruebas en entorno aislado
 *   approval    escrituras: crean o cambian algo fuera de JANUS
 *   restricted  destructivas o sobre producción: borrar, vaciar, revocar, sobrescribir, desplegar, pagar
 *
 * Reglas de seguridad:
 *   - Ante la duda sube de nivel, nunca baja. Un planificador o un modelo no puede rebajar el resultado.
 *   - «Adiciones menores» solo son automáticas en servicios que el CEO marcó como de confianza para eso
 *     (`trustedForMinorWrites`) y nunca si la operación toca producción, dinero, permisos o personas.
 *   - `restricted` exige además autoridad biométrica cuando la política de autoridad ya lo pide para esa acción.
 */
export type OperationRiskLevel = 'auto' | 'approval' | 'restricted';

export interface OperationDescriptor {
  /** Servicio o adaptador (p. ej. `github`, `iba`, `chatbox`). */
  service: string;
  /** Identificador de la operación (operationId, nombre de mutación, herramienta MCP…). */
  operation: string;
  method?: string;
  path?: string;
  /** Texto descriptivo de la especificación (summary/description). */
  summary?: string;
  /** Tipo de operación GraphQL, si aplica. */
  graphql?: 'query' | 'mutation' | 'subscription';
  /** SQL que se va a ejecutar, si aplica. */
  sql?: string;
  /** Entorno de destino declarado. */
  environment?: 'sandbox' | 'draft' | 'staging' | 'production';
  /** Anotación MCP `readOnlyHint` / `destructiveHint`, si el servidor la da (es una pista, no una garantía). */
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
}

export interface OperationRiskPolicy {
  /** Servicios donde el CEO permite adiciones menores sin preguntar. Vacío por defecto. */
  trustedForMinorWrites?: readonly string[];
}

export interface OperationRisk {
  level: OperationRiskLevel;
  reasons: string[];
  /** Explicación de una línea para la notificación de aprobación. */
  headline: string;
}

const DESTRUCTIVE_WORDS = /(^|[^a-z])(delete|destroy|remove|drop|truncate|purge|wipe|erase|revoke|terminate|uninstall|deactivate|disable|ban|reset|overwrite|force[-_ ]?push|rollback|restore|transfer|archive|unpublish|borrar|eliminar|vaciar|revocar|sobrescribir|anular|desactivar)([^a-z]|$)/i;
const PRODUCTION_WORDS = /(^|[^a-z])(deploy|redeploy|publish|release|promote|merge|migrat\w*|production|prod|live|dns|domain|billing|payment|pay|charge|refund|invoice|subscription|purchase|order|payout|permission|role|grant|acl|secret|token|credential|password|user|member|account|webhook|desplegar|publicar|pagar|cobrar|permiso|usuario|contrase\w+)([^a-z]|$)/i;
const DRAFT_WORDS = /(^|[^a-z])(draft|preview|dry[-_ ]?run|validate|simulate|estimate|borrador|vista[-_ ]?previa|simular)([^a-z]|$)/i;
const SQL_DESTRUCTIVE = /\b(drop|truncate|delete|alter|grant|revoke|update)\b/i;
const SQL_READ_ONLY = /^\s*(select|with|explain|show|pragma\s+table_info)\b/i;

const words = (descriptor: OperationDescriptor): string =>
  [descriptor.operation, descriptor.path ?? '', descriptor.summary ?? ''].join(' ').replace(/([a-z])([A-Z])/g, '$1 $2');

export function classifyOperation(descriptor: OperationDescriptor, policy: OperationRiskPolicy = {}): OperationRisk {
  const method = (descriptor.method ?? '').toUpperCase();
  const haystack = words(descriptor);
  const reasons: string[] = [];
  const label = `${descriptor.service}.${descriptor.operation}`;
  const result = (level: OperationRiskLevel, headline: string): OperationRisk => ({ level, reasons, headline });

  // 1) Destructivo o producción: restringido siempre.
  let sqlReadOnly = false;
  if (descriptor.sql !== undefined) {
    const sql = descriptor.sql.replace(/--.*$/gm, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');
    const statements = sql.split(';').map((part) => part.trim()).filter(Boolean);
    if (SQL_DESTRUCTIVE.test(sql)) { reasons.push('SQL que borra o altera datos o permisos'); return result('restricted', `${label}: SQL destructivo`); }
    if (statements.length !== 1 || !SQL_READ_ONLY.test(statements[0]!)) { reasons.push('SQL que no es una única consulta de lectura'); return result('approval', `${label}: SQL de escritura`); }
    sqlReadOnly = true;
  }
  if (method === 'DELETE') reasons.push('método DELETE');
  if (descriptor.destructiveHint === true) reasons.push('el servicio la declara destructiva');
  if (DESTRUCTIVE_WORDS.test(haystack)) reasons.push('la operación borra, revoca o sobrescribe');
  if (reasons.length) return result('restricted', `${label}: acción destructiva`);
  const writes = !sqlReadOnly && !(method === 'GET' || method === 'HEAD' || method === 'OPTIONS' || descriptor.graphql === 'query');
  if (descriptor.environment === 'production' && writes) { reasons.push('escritura en producción'); return result('restricted', `${label}: cambia producción`); }
  if (writes && PRODUCTION_WORDS.test(haystack)) { reasons.push('toca producción, dinero, permisos o personas'); return result('restricted', `${label}: acción crítica`); }

  // 2) Lecturas: automáticas.
  if (!writes) {
    if (descriptor.sql !== undefined) reasons.push('consulta SQL de solo lectura');
    reasons.push(descriptor.graphql === 'query' ? 'consulta GraphQL' : `lectura (${method || 'consulta'})`);
    return result('auto', `${label}: lectura`);
  }
  if (descriptor.environment === 'sandbox') { reasons.push('se ejecuta en el entorno aislado de pruebas'); return result('auto', `${label}: prueba aislada`); }
  if (descriptor.environment === 'draft' || DRAFT_WORDS.test(haystack)) { reasons.push('genera un borrador o una simulación'); return result('auto', `${label}: borrador`); }

  // 3) Resto de escrituras: aprobación, salvo adición menor en servicio de confianza.
  const additive = method === 'POST' || (descriptor.graphql === 'mutation' && /^(create|add|append|comment|log|note)/i.test(descriptor.operation));
  if (additive && (policy.trustedForMinorWrites ?? []).includes(descriptor.service) && method !== 'PUT' && method !== 'PATCH') {
    reasons.push('adición menor en un servicio que el CEO marcó de confianza');
    return result('auto', `${label}: adición menor`);
  }
  if (descriptor.readOnlyHint === true) reasons.push('el servicio la declara de solo lectura, pero el método escribe: no se confía en la pista');
  reasons.push(method ? `escritura (${method})` : 'escritura');
  return result('approval', `${label}: escritura externa`);
}

/** El nivel más alto de dos clasificaciones (para combinar esta regla con la lista de acciones sensibles). */
export function strictest(a: OperationRiskLevel, b: OperationRiskLevel): OperationRiskLevel {
  const order: Record<OperationRiskLevel, number> = { auto: 0, approval: 1, restricted: 2 };
  return order[a] >= order[b] ? a : b;
}

export interface HitlApprovalRequest {
  runId: string;
  actionId: string;
  label: string;
  operation: string;
  risk: OperationRiskLevel;
  reversible: boolean;
  target?: string;
  reason: string;
}

export interface HitlGateDeps {
  policy?: OperationRiskPolicy;
  /** Cola de aprobaciones existente (`ApprovalQueue.request`): pausa hasta la decisión, la caducidad o la cancelación. */
  requestApproval(request: HitlApprovalRequest): Promise<{ approved: boolean; status: string; approvalId: string; decidedBy?: string }>;
  /** Aviso al dispositivo administrador (push, webhook…). Si falla, la aprobación sigue visible en el dashboard. */
  notify?(request: HitlApprovalRequest & { approvalId?: string }): void | Promise<void>;
  audit?(event: { at: string; operation: string; level: OperationRiskLevel; outcome: 'auto' | 'approved' | 'denied'; approvalId?: string; reasons: string[] }): void;
  now?: () => Date;
}

export class HitlDeniedError extends Error {
  constructor(readonly operation: string, readonly status: string) {
    super(`Operación no autorizada (${status}): ${operation}`);
    this.name = 'HitlDeniedError';
  }
}

/**
 * Middleware de autorización: toda operación descubierta dinámicamente pasa por aquí ANTES de ejecutarse.
 * Las automáticas siguen; las demás pausan el hilo hasta que el CEO decide desde su dispositivo.
 * Sin decisión a tiempo = no se ejecuta.
 */
export class HitlGate {
  constructor(private readonly deps: HitlGateDeps) {}

  classify(descriptor: OperationDescriptor): OperationRisk {
    return classifyOperation(descriptor, this.deps.policy);
  }

  async authorize(descriptor: OperationDescriptor, context: { runId: string; actionId: string; target?: string }): Promise<{ level: OperationRiskLevel; approvalId?: string; reasons: string[] }> {
    const risk = this.classify(descriptor);
    const at = (this.deps.now?.() ?? new Date()).toISOString();
    const operation = `${descriptor.service}.${descriptor.operation}`;
    if (risk.level === 'auto') {
      this.deps.audit?.({ at, operation, level: 'auto', outcome: 'auto', reasons: risk.reasons });
      return { level: 'auto', reasons: risk.reasons };
    }
    const request: HitlApprovalRequest = {
      runId: context.runId, actionId: context.actionId, label: risk.headline, operation, risk: risk.level,
      reversible: risk.level !== 'restricted', ...(context.target ? { target: context.target } : {}), reason: risk.reasons.join('; '),
    };
    const pending = this.deps.requestApproval(request);
    try { await this.deps.notify?.(request); } catch { /* el aviso es ayuda; la aprobación sigue en el dashboard */ }
    const decision = await pending;
    this.deps.audit?.({ at, operation, level: risk.level, outcome: decision.approved ? 'approved' : 'denied', approvalId: decision.approvalId, reasons: risk.reasons });
    if (!decision.approved) throw new HitlDeniedError(operation, decision.status);
    return { level: risk.level, approvalId: decision.approvalId, reasons: risk.reasons };
  }
}
