/**
 * Adaptive Effort Policy — ECO / NORMAL / PROFUNDO / MÁXIMO / AUTO.
 *
 * Decides how much work Janus invests in a command, balancing risk,
 * complexity and cost. Deterministic and local (no model call), so the same
 * input always yields the same, explainable decision.
 *
 * Founder-aligned rules:
 * - The Founder may pick a level explicitly; Janus respects it, except that a
 *   risky command is never run below NORMAL (risk floor, reported as such).
 * - AUTO chooses from risk + complexity + cost signals and NEVER selects
 *   MÁXIMO by itself: MÁXIMO spends the most and requires an explicit choice.
 * - Critical risk (irreversible / money / production) always requires an
 *   explicit human confirmation before any external action, at every level.
 * - Effort changes how much verification and research Janus does; it never
 *   relaxes authority, approval or audit.
 */

export type EffortLevel = 'eco' | 'normal' | 'profundo' | 'maximo';
export type EffortRequest = EffortLevel | 'auto';
export type RiskLevel = 'low' | 'high' | 'critical';
export type ComplexityLevel = 'low' | 'medium' | 'high';

export const EFFORT_POLICY_VERSION = 'effort-policy/1';
export const EFFORT_LEVELS: readonly EffortLevel[] = ['eco', 'normal', 'profundo', 'maximo'];
export const EFFORT_REQUESTS: readonly EffortRequest[] = ['auto', ...EFFORT_LEVELS];

export interface EffortBudget {
  maxModelCalls: number;
  verificationPasses: number;
  parallelAgents: number;
  reviewers: number;
  freshResearch: boolean;
}

export interface EffortInput {
  text: string;
  requested?: string;
  /** Offline or metered: keep spending low unless the command is risky. */
  costSensitive?: boolean;
  /** Command already flagged as sensitive by transcript interpretation. */
  sensitiveCommand?: boolean;
}

export interface EffortDecision {
  policyVersion: string;
  requested: EffortRequest;
  level: EffortLevel;
  source: 'founder' | 'auto';
  risk: RiskLevel;
  complexity: ComplexityLevel;
  raisedByRisk: boolean;
  requiresConfirmation: boolean;
  budget: EffortBudget;
  reasons: string[];
}

const BUDGETS: Readonly<Record<EffortLevel, EffortBudget>> = Object.freeze({
  eco: { maxModelCalls: 1, verificationPasses: 0, parallelAgents: 0, reviewers: 0, freshResearch: false },
  normal: { maxModelCalls: 3, verificationPasses: 1, parallelAgents: 1, reviewers: 1, freshResearch: false },
  profundo: { maxModelCalls: 8, verificationPasses: 2, parallelAgents: 3, reviewers: 3, freshResearch: true },
  maximo: { maxModelCalls: 20, verificationPasses: 3, parallelAgents: 6, reviewers: 6, freshResearch: true },
});

const CRITICAL_TERMS = [
  'transferir', 'transferencia', 'pagar', 'pago', 'borrar todo', 'eliminar todo', 'formatear', 'irreversible',
  'wire', 'drop table', 'rm -rf', 'force push', 'publicar en produccion', 'publica en produccion', 'a produccion', 'to production',
  'enviar dinero', 'vaciar', 'revocar acceso', 'eliminar cuenta', 'delete account',
];
const HIGH_TERMS = [
  'borrar', 'borra ', 'borrad', 'eliminar', 'elimina ', 'delete', 'publicar', 'publica ', 'publish', 'deploy', 'despliega', 'desplegar', 'produccion',
  'enviar correo', 'enviar email', 'enviar mensaje', 'envia un correo', 'envia el correo', 'envia correo', 'envia un mensaje', 'envia email', 'send email', 'firmar', 'contrato', 'legal', 'impuesto',
  'factura', 'contrasena', 'password', 'secreto', 'secret', 'token', 'permiso', 'migracion', 'merge',
  'fusionar', 'cancelar suscripcion', 'comprar', 'reservar',
];
const COMPLEX_TERMS = [
  'arquitectura', 'refactor', 'auditoria', 'audita', 'investiga', 'compara', 'diseña', 'disena', 'plan',
  'estrategia', 'integra', 'integracion', 'migra', 'analiza', 'implementa', 'depura', 'debug', 'seguridad',
  'multi', 'varios', 'cada uno', 'paso a paso', 'end to end', 'de principio a fin', 'workflow', 'pipeline',
];
const FRESH_TERMS = [
  'hoy', 'actual', 'ultima version', 'ultimas', 'noticias', 'precio', 'cotizacion', 'novedades', 'vigente',
  'latest', 'current', 'today', 'news', 'price',
];

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').trim();
}

function countHits(haystack: string, terms: readonly string[]): number {
  return terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
}

export function assessRisk(text: string, sensitiveCommand = false): RiskLevel {
  const norm = normalize(text);
  if (countHits(norm, CRITICAL_TERMS) > 0) return 'critical';
  if (sensitiveCommand || countHits(norm, HIGH_TERMS) > 0) return 'high';
  return 'low';
}

export function assessComplexity(text: string): ComplexityLevel {
  const norm = normalize(text);
  const words = norm.split(' ').filter(Boolean).length;
  const hits = countHits(norm, COMPLEX_TERMS);
  const steps = (text.match(/[.;\n]|\b(y luego|despues|luego|and then|then)\b/gi) ?? []).length;
  const score = (words >= 60 ? 2 : words >= 25 ? 1 : 0) + Math.min(hits, 3) + (steps >= 3 ? 1 : 0);
  if (score >= 3) return 'high';
  if (score >= 1) return 'medium';
  return 'low';
}

export function parseEffortRequest(value: unknown): EffortRequest {
  const norm = typeof value === 'string' ? normalize(value).replace(/\s+/g, '') : '';
  if (norm === 'max' || norm === 'maximo' || norm === 'maxima') return 'maximo';
  return (EFFORT_REQUESTS as readonly string[]).includes(norm) ? (norm as EffortRequest) : 'auto';
}

const ORDER: Record<EffortLevel, number> = { eco: 0, normal: 1, profundo: 2, maximo: 3 };

export function decideEffort(input: EffortInput): EffortDecision {
  const requested = parseEffortRequest(input.requested);
  const risk = assessRisk(input.text, input.sensitiveCommand);
  const complexity = assessComplexity(input.text);
  const reasons: string[] = [];
  const norm = normalize(input.text);

  let level: EffortLevel;
  let source: 'founder' | 'auto';
  let raisedByRisk = false;

  if (requested === 'auto') {
    source = 'auto';
    level = complexity === 'high' ? 'profundo' : complexity === 'medium' ? 'normal' : 'eco';
    reasons.push(`AUTO: complejidad ${complexity}.`);
    if (risk !== 'low' && ORDER[level] < ORDER.normal) {
      level = 'normal';
      raisedByRisk = true;
      reasons.push(`AUTO: riesgo ${risk}; nunca por debajo de NORMAL.`);
    }
    if (risk === 'critical' && ORDER[level] < ORDER.profundo) {
      level = 'profundo';
      raisedByRisk = true;
      reasons.push('AUTO: riesgo crítico; se verifica en profundidad antes de proponer nada.');
    }
    if (input.costSensitive && risk === 'low' && ORDER[level] > ORDER.normal) {
      level = 'normal';
      reasons.push('AUTO: modo ahorro/sin conexión; se limita a NORMAL porque el riesgo es bajo.');
    }
    reasons.push('AUTO nunca elige MÁXIMO: es un gasto que solo se activa por decisión explícita.');
  } else {
    source = 'founder';
    level = requested;
    reasons.push(`Nivel ${requested.toUpperCase()} elegido por el Founder.`);
    if (risk !== 'low' && ORDER[level] < ORDER.normal) {
      level = 'normal';
      raisedByRisk = true;
      reasons.push(`Suelo de riesgo: comando de riesgo ${risk}; se ejecuta como mínimo en NORMAL.`);
    }
  }

  const requiresConfirmation = risk === 'critical';
  if (requiresConfirmation) reasons.push('Riesgo crítico: requiere confirmación humana explícita antes de cualquier acción externa.');
  else if (risk === 'high') reasons.push('Riesgo alto: las acciones externas siguen requiriendo aprobación según autoridad.');

  const budget: EffortBudget = { ...BUDGETS[level] };
  const wantsFresh = countHits(norm, FRESH_TERMS) > 0;
  if (wantsFresh && !budget.freshResearch && level !== 'eco') {
    budget.freshResearch = true;
    reasons.push('El comando depende de información vigente: se añade investigación fresca.');
  }
  return {
    policyVersion: EFFORT_POLICY_VERSION,
    requested,
    level,
    source,
    risk,
    complexity,
    raisedByRisk,
    requiresConfirmation,
    budget,
    reasons,
  };
}
