/**
 * OPPORTUNITY RADAR — vigilancia y aprovechamiento de oportunidades tecnológicas (incidencia JANUS-OPPORTUNITY-20261110).
 *
 * Qué resuelve: promociones, créditos, pruebas gratuitas, accesos anticipados y ampliaciones de límites deben
 * detectarse pronto, evaluarse y aprovecharse antes de que caduquen, sin duplicados y con historial.
 *
 * Protocolo de la Verdad:
 *   - `verified`  : JANUS o el CEO leyeron la fuente OFICIAL (sourceUrl oficial + verifiedAt).
 *   - `pending`   : comunicada por una persona o por una fuente secundaria; falta leer la fuente oficial.
 *   - `expired`   : derivado de `expiresAt`, nunca escrito a mano.
 *   - Los cupos (`QuotaWindow`) son SIEMPRE datos declarados: JANUS no tiene acceso a los contadores de las cuentas.
 *
 * Módulo puro (sin red ni base de datos): el runtime aporta almacenamiento, lectura de fuentes y avisos.
 */

export const OPPORTUNITY_KINDS = ['launch', 'free_trial', 'credits', 'discount', 'early_access', 'limit_increase', 'promotion', 'tool'] as const;
export type OpportunityKind = (typeof OPPORTUNITY_KINDS)[number];
export const OPPORTUNITY_STAGES = ['detected', 'activated', 'used', 'finished', 'dismissed'] as const;
export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];
export type OpportunityVerification = 'verified' | 'pending';
export type OpportunityStatus = 'verified' | 'pending' | 'expired';
export type OpportunityDetectedBy = 'monitor' | 'owner' | 'agent';
export type Level = 1 | 2 | 3 | 4 | 5;
export type OpportunityCost = 'none' | 'low' | 'medium' | 'high';

export interface OpportunityHistoryEntry {
  at: string;
  event: 'detected' | 'updated' | 'conditions_changed' | 'verified' | 'stage' | 'notified' | 'late_detection';
  detail: string;
}

export interface Opportunity {
  id: string;
  /** Huella estable para no duplicar: proveedor + título normalizado. */
  fingerprint: string;
  provider: string;
  title: string;
  kind: OpportunityKind;
  verification: OpportunityVerification;
  sourceUrl?: string;
  sourceLabel?: string;
  verifiedAt?: string;
  publishedAt?: string;
  startsAt?: string;
  expiresAt?: string;
  conditions?: string;
  eligibility?: string;
  /** Productos de InfinitySeed que se benefician (JANUS, IBA, ChatBox, Melanie…). */
  projects: string[];
  benefit: Level;
  cost: OpportunityCost;
  risk: Level;
  /** ¿Encaja con la arquitectura actual sin rehacer nada? */
  compatible: boolean;
  notes?: string;
  stage: OpportunityStage;
  detectedAt: string;
  detectedBy: OpportunityDetectedBy;
  updatedAt: string;
  history: OpportunityHistoryEntry[];
  /** Claves de avisos ya enviados (p. ej. `new`, `expires-72h`, `expires-24h`): evita repetirlos. */
  notified: string[];
}

export interface OpportunityInput {
  provider: string;
  title: string;
  kind?: OpportunityKind;
  verification?: OpportunityVerification;
  sourceUrl?: string;
  sourceLabel?: string;
  publishedAt?: string;
  startsAt?: string;
  expiresAt?: string;
  conditions?: string;
  eligibility?: string;
  projects?: readonly string[];
  benefit?: number;
  cost?: OpportunityCost;
  risk?: number;
  compatible?: boolean;
  notes?: string;
  detectedBy?: OpportunityDetectedBy;
}

const HISTORY_MAX = 60;
const text = (value: unknown, max: number): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean ? clean.slice(0, max) : undefined;
};
const iso = (value: unknown, field: string): string | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const ms = Date.parse(String(value));
  if (!Number.isFinite(ms)) throw new Error(`${field} is not a valid date`);
  return new Date(ms).toISOString();
};
const level = (value: unknown, fallback: Level): Level => {
  const n = Math.round(Number(value));
  return (n >= 1 && n <= 5 ? n : fallback) as Level;
};
const httpsUrl = (value: unknown): string | undefined => {
  const raw = text(value, 500);
  if (!raw) return undefined;
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('sourceUrl is not a valid URL'); }
  if (url.protocol !== 'https:') throw new Error('sourceUrl must be https');
  return url.toString();
};

/** Proveedor + título sin mayúsculas, acentos, signos ni palabras vacías: la misma oferta contada de dos formas coincide. */
export function opportunityFingerprint(provider: string, title: string): string {
  const norm = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const stop = new Set(['the', 'a', 'an', 'de', 'la', 'el', 'los', 'las', 'del', 'para', 'for', 'of', 'to', 'en', 'on', 'in', 'y', 'and', 'with', 'con']);
  const words = norm(title).split(' ').filter((word) => word && !stop.has(word)).sort();
  return `${norm(provider).replace(/ /g, '-') || 'unknown'}:${words.join('-')}`;
}

function entry(at: string, event: OpportunityHistoryEntry['event'], detail: string): OpportunityHistoryEntry {
  return { at, event, detail: detail.slice(0, 300) };
}

export function createOpportunity(input: OpportunityInput, context: { id: string; now: string }): Opportunity {
  const provider = text(input.provider, 60);
  const title = text(input.title, 200);
  if (!provider) throw new Error('provider is required');
  if (!title) throw new Error('title is required');
  const now = new Date(context.now).toISOString();
  const sourceUrl = httpsUrl(input.sourceUrl);
  const verification: OpportunityVerification = input.verification === 'verified' ? 'verified' : 'pending';
  if (verification === 'verified' && !sourceUrl) throw new Error('a verified opportunity needs its official source URL');
  const startsAt = iso(input.startsAt, 'startsAt');
  const expiresAt = iso(input.expiresAt, 'expiresAt');
  if (startsAt && expiresAt && Date.parse(expiresAt) < Date.parse(startsAt)) throw new Error('expiresAt is before startsAt');
  const detectedBy = input.detectedBy ?? 'agent';
  const sourceLabel = text(input.sourceLabel, 120);
  const publishedAt = iso(input.publishedAt, 'publishedAt');
  const conditions = text(input.conditions, 1200);
  const eligibility = text(input.eligibility, 600);
  const notes = text(input.notes, 1200);
  return {
    id: context.id,
    fingerprint: opportunityFingerprint(provider, title),
    provider,
    title,
    kind: OPPORTUNITY_KINDS.includes(input.kind as OpportunityKind) ? (input.kind as OpportunityKind) : 'promotion',
    verification,
    ...(sourceUrl ? { sourceUrl } : {}),
    ...(sourceLabel ? { sourceLabel } : {}),
    ...(verification === 'verified' ? { verifiedAt: now } : {}),
    ...(publishedAt ? { publishedAt } : {}),
    ...(startsAt ? { startsAt } : {}),
    ...(expiresAt ? { expiresAt } : {}),
    ...(conditions ? { conditions } : {}),
    ...(eligibility ? { eligibility } : {}),
    projects: [...new Set((input.projects ?? []).map((p) => String(p).trim().slice(0, 40)).filter(Boolean))].slice(0, 12),
    benefit: level(input.benefit, 3),
    cost: input.cost === 'low' || input.cost === 'medium' || input.cost === 'high' ? input.cost : 'none',
    risk: level(input.risk, 2),
    compatible: input.compatible !== false,
    ...(notes ? { notes } : {}),
    stage: 'detected',
    detectedAt: now,
    detectedBy,
    updatedAt: now,
    history: [entry(now, 'detected', `Detectada por ${detectedBy === 'monitor' ? 'el monitor' : detectedBy === 'owner' ? 'el propietario' : 'un agente'}`)],
    notified: [],
  };
}

const TERM_FIELDS = ['expiresAt', 'startsAt', 'conditions', 'eligibility', 'cost'] as const;

/**
 * Misma oportunidad vista otra vez: no se duplica. Se conserva lo ya sabido (etapa, avisos, historial) y se anota
 * si cambiaron las condiciones (fecha de fin, requisitos, coste…); un cambio de fecha vuelve a habilitar los avisos
 * de vencimiento. Una oferta verificada nunca se degrada a pendiente por una segunda detección.
 */
export function mergeOpportunity(existing: Opportunity, incoming: Opportunity, now: string): { opportunity: Opportunity; changed: string[] } {
  const at = new Date(now).toISOString();
  const changed: string[] = [];
  const next: Opportunity = { ...existing, history: [...existing.history], notified: [...existing.notified] };
  for (const field of TERM_FIELDS) {
    const value = incoming[field];
    if (value !== undefined && value !== existing[field]) { (next as unknown as Record<string, unknown>)[field] = value; changed.push(field); }
  }
  for (const field of ['sourceUrl', 'sourceLabel', 'publishedAt', 'notes', 'kind'] as const) {
    const value = incoming[field];
    if (value !== undefined && existing[field] === undefined) (next as unknown as Record<string, unknown>)[field] = value;
  }
  next.projects = [...new Set([...existing.projects, ...incoming.projects])].slice(0, 12);
  if (incoming.verification === 'verified' && existing.verification !== 'verified' && (incoming.sourceUrl ?? existing.sourceUrl)) {
    next.verification = 'verified'; next.verifiedAt = at; next.sourceUrl = incoming.sourceUrl ?? existing.sourceUrl!;
    next.history.push(entry(at, 'verified', 'Fuente oficial leída'));
  }
  if (changed.length) {
    next.history.push(entry(at, 'conditions_changed', `Cambió: ${changed.join(', ')}`));
    if (changed.includes('expiresAt')) next.notified = next.notified.filter((key) => !key.startsWith('expires-'));
  }
  if (changed.length || next.verification !== existing.verification) next.updatedAt = at;
  next.history = next.history.slice(-HISTORY_MAX);
  return { opportunity: next, changed };
}

export function opportunityStatus(opportunity: Pick<Opportunity, 'expiresAt' | 'verification'>, now: string): OpportunityStatus {
  if (opportunity.expiresAt && Date.parse(opportunity.expiresAt) <= Date.parse(now)) return 'expired';
  return opportunity.verification;
}

export function hoursLeft(opportunity: Pick<Opportunity, 'expiresAt'>, now: string): number | null {
  if (!opportunity.expiresAt) return null;
  return Math.round(((Date.parse(opportunity.expiresAt) - Date.parse(now)) / 3_600_000) * 10) / 10;
}

const STAGE_ORDER: Record<OpportunityStage, number> = { detected: 0, activated: 1, used: 2, finished: 3, dismissed: 3 };

/** Seguimiento del aprovechamiento real: detectada → activada → utilizada → finalizada (o descartada, con motivo). */
export function advanceStage(opportunity: Opportunity, stage: OpportunityStage, now: string, note?: string): Opportunity {
  if (!OPPORTUNITY_STAGES.includes(stage)) throw new Error('unknown stage');
  if (stage === opportunity.stage) return opportunity;
  if (STAGE_ORDER[opportunity.stage] === 3) throw new Error('opportunity is already closed');
  if (STAGE_ORDER[stage] < STAGE_ORDER[opportunity.stage]) throw new Error('stage cannot go backwards');
  if (stage === 'dismissed' && !text(note, 300)) throw new Error('dismissing needs a reason');
  const at = new Date(now).toISOString();
  return { ...opportunity, stage, updatedAt: at, history: [...opportunity.history, entry(at, 'stage', `${opportunity.stage} → ${stage}${note ? `: ${text(note, 200)}` : ''}`)].slice(-HISTORY_MAX) };
}

/** El CEO o un agente confirma que leyó la fuente oficial. */
export function verifyOpportunity(opportunity: Opportunity, sourceUrl: string, now: string): Opportunity {
  const url = httpsUrl(sourceUrl);
  if (!url) throw new Error('official source URL is required');
  const at = new Date(now).toISOString();
  return { ...opportunity, verification: 'verified', sourceUrl: url, verifiedAt: at, updatedAt: at, history: [...opportunity.history, entry(at, 'verified', 'Fuente oficial leída')].slice(-HISTORY_MAX) };
}

export interface OpportunityScore {
  score: number;
  priority: 'critical' | 'high' | 'normal' | 'low';
  urgency: Level;
  reasons: string[];
}

/**
 * Prioridad empresarial: beneficio concreto × urgencia, ajustado por coste, riesgo, compatibilidad y verificación.
 * Una promoción sin coste adicional puede ser prioritaria aunque no ahorre dinero, si adelanta trabajo importante.
 * Nota: seguridad, continuidad y fallos financieros críticos van SIEMPRE por delante; esto ordena solo oportunidades.
 */
export function scoreOpportunity(opportunity: Opportunity, now: string): OpportunityScore {
  const status = opportunityStatus(opportunity, now);
  const left = hoursLeft(opportunity, now);
  const reasons: string[] = [];
  if (status === 'expired' || STAGE_ORDER[opportunity.stage] === 3) return { score: 0, priority: 'low', urgency: 1, reasons: [status === 'expired' ? 'caducada' : 'cerrada'] };
  const urgency: Level = left === null ? 2 : left <= 48 ? 5 : left <= 24 * 4 ? 4 : left <= 24 * 10 ? 3 : 2;
  if (left !== null) reasons.push(left <= 48 ? `vence en ${Math.max(0, Math.round(left))} h` : `vence en ${Math.round(left / 24)} días`); else reasons.push('sin fecha de fin conocida');
  let score = opportunity.benefit * 12 + urgency * 8;
  reasons.push(`beneficio ${opportunity.benefit}/5`);
  const costPenalty = { none: 0, low: 4, medium: 10, high: 18 }[opportunity.cost];
  score -= costPenalty; reasons.push(opportunity.cost === 'none' ? 'sin coste adicional' : `coste ${opportunity.cost}`);
  score -= (opportunity.risk - 1) * 3; if (opportunity.risk >= 4) reasons.push('riesgo técnico alto');
  if (!opportunity.compatible) { score -= 10; reasons.push('no encaja directamente con la arquitectura'); }
  if (opportunity.verification !== 'verified') { score -= 6; reasons.push('pendiente de verificar en la fuente oficial'); }
  if (opportunity.stage === 'detected') { score += 4; reasons.push('aún sin activar'); }
  if (opportunity.projects.length >= 2) score += 3;
  score = Math.max(0, Math.min(100, Math.round(score)));
  const priority = score >= 80 ? 'critical' : score >= 62 ? 'high' : score >= 40 ? 'normal' : 'low';
  return { score, priority, urgency, reasons };
}

export interface OpportunityAlert {
  opportunityId: string;
  key: string;
  severity: 'critical' | 'warning';
  title: string;
  body: string;
}

/**
 * Avisos que tocan AHORA (sin esperar al resumen semanal) y que aún no se enviaron:
 *   - `new`         oportunidad crítica o alta recién detectada y sin activar;
 *   - `expires-72h` / `expires-24h`  vencimiento próximo de una oportunidad que no está cerrada.
 */
export function dueOpportunityAlerts(opportunities: readonly Opportunity[], now: string): OpportunityAlert[] {
  const alerts: OpportunityAlert[] = [];
  for (const opportunity of opportunities) {
    if (opportunityStatus(opportunity, now) === 'expired' || STAGE_ORDER[opportunity.stage] === 3) continue;
    const score = scoreOpportunity(opportunity, now);
    const left = hoursLeft(opportunity, now);
    const add = (key: string, severity: OpportunityAlert['severity'], body: string) => {
      if (!opportunity.notified.includes(key)) alerts.push({ opportunityId: opportunity.id, key, severity, title: `${opportunity.provider}: ${opportunity.title}`.slice(0, 120), body });
    };
    if (opportunity.stage === 'detected' && (score.priority === 'critical' || score.priority === 'high')) add('new', score.priority === 'critical' ? 'critical' : 'warning', `Oportunidad ${score.priority === 'critical' ? 'crítica' : 'importante'} sin activar · ${score.reasons[0]}`);
    if (left !== null && left <= 24) add('expires-24h', 'critical', `Vence en ${Math.max(0, Math.round(left))} h`);
    else if (left !== null && left <= 72) add('expires-72h', 'warning', `Vence en ${Math.round(left / 24)} días`);
  }
  return alerts;
}

export function markNotified(opportunity: Opportunity, key: string, now: string): Opportunity {
  if (opportunity.notified.includes(key)) return opportunity;
  const at = new Date(now).toISOString();
  return { ...opportunity, notified: [...opportunity.notified, key], history: [...opportunity.history, entry(at, 'notified', `Aviso ${key}`)].slice(-HISTORY_MAX) };
}

/** Detección tardía: se supo de la oferta mucho después de publicarse, o con poco margen antes de caducar. */
export function lateDetection(opportunity: Opportunity): { late: boolean; reason: string } {
  const detected = Date.parse(opportunity.detectedAt);
  if (opportunity.publishedAt && detected - Date.parse(opportunity.publishedAt) > 24 * 3_600_000 && opportunity.detectedBy !== 'monitor') {
    return { late: true, reason: `La comunicó ${opportunity.detectedBy === 'owner' ? 'el propietario' : 'un agente'} ${Math.round((detected - Date.parse(opportunity.publishedAt)) / 3_600_000)} h después de publicarse; el monitor no la había detectado.` };
  }
  if (opportunity.startsAt && opportunity.expiresAt) {
    const total = Date.parse(opportunity.expiresAt) - Date.parse(opportunity.startsAt);
    const used = detected - Date.parse(opportunity.startsAt);
    if (total > 0 && used / total > 0.5) return { late: true, reason: `Detectada con más de la mitad de la ventana ya consumida (${Math.round((used / total) * 100)} %).` };
  }
  if (opportunity.detectedBy === 'owner') return { late: true, reason: 'La comunicó el propietario; JANUS no había generado una alerta propia.' };
  return { late: false, reason: '' };
}

/* ───────────────────────────── Cupos y ventanas de aprovechamiento ───────────────────────────── */

export type QuotaWindowKind = 'short' | 'weekly' | 'promo' | 'monthly';

/** Cupo DECLARADO de una cuenta. `verified:false` = lo indicó una persona y falta comprobarlo en la cuenta. */
export interface QuotaWindow {
  id: string;
  account: string;
  kind: QuotaWindowKind;
  label: string;
  limitNote?: string;
  /** Porcentaje consumido declarado (0–100). Ausente = desconocido. */
  usedPercent?: number;
  resetsAt?: string;
  verified: boolean;
  note?: string;
  updatedAt: string;
}

export function validateQuotaWindow(input: Partial<QuotaWindow> & { id: string }, now: string): QuotaWindow {
  const account = text(input.account, 80);
  const label = text(input.label, 120);
  if (!account || !label) throw new Error('account and label are required');
  const kind: QuotaWindowKind = input.kind === 'short' || input.kind === 'promo' || input.kind === 'monthly' ? input.kind : 'weekly';
  const used = input.usedPercent === undefined || input.usedPercent === null ? undefined : Number(input.usedPercent);
  if (used !== undefined && (!Number.isFinite(used) || used < 0 || used > 100)) throw new Error('usedPercent must be between 0 and 100');
  const resetsAt = iso(input.resetsAt, 'resetsAt');
  const limitNote = text(input.limitNote, 300);
  const note = text(input.note, 600);
  return {
    id: input.id, account, kind, label,
    ...(limitNote ? { limitNote } : {}),
    ...(used !== undefined ? { usedPercent: Math.round(used) } : {}),
    ...(resetsAt ? { resetsAt } : {}),
    verified: input.verified === true,
    ...(note ? { note } : {}),
    updatedAt: new Date(now).toISOString(),
  };
}

export interface UtilizationPhase {
  id: 'A' | 'B';
  from: string;
  to: string;
  hours: number;
  focus: string;
  capacity: string;
}

export interface UtilizationPlan {
  opportunityId: string;
  /** La fecha de fin de la promoción NO es el tiempo efectivo de trabajo: depende del cupo. */
  promotionEndsAt: string | null;
  nextResetAt: string | null;
  resetVerified: boolean;
  phases: UtilizationPhase[];
  warnings: string[];
}

/**
 * Parte la ventana que queda en dos fases alrededor del siguiente restablecimiento de cupo:
 *   Fase A (hasta el restablecimiento): gastar el cupo que queda en lo de más valor y PREPARAR material.
 *   Fase B (del restablecimiento al fin de la promoción): ejecutar de inmediato con el cupo renovado.
 * No promete disponibilidad continua: los límites por ventanas cortas y las pausas siguen aplicando.
 */
export function planUtilization(opportunity: Opportunity, quotas: readonly QuotaWindow[], now: string): UtilizationPlan {
  const nowMs = Date.parse(now);
  const end = opportunity.expiresAt ? Date.parse(opportunity.expiresAt) : null;
  const warnings: string[] = [];
  const upcoming = quotas
    .filter((q) => q.kind !== 'short' && q.resetsAt && Date.parse(q.resetsAt) > nowMs && (end === null || Date.parse(q.resetsAt) < end))
    .sort((a, b) => Date.parse(a.resetsAt!) - Date.parse(b.resetsAt!))[0];
  const hours = (from: number, to: number) => Math.max(0, Math.round(((to - from) / 3_600_000) * 10) / 10);
  const isoOf = (ms: number) => new Date(ms).toISOString();
  const weekly = quotas.find((q) => q.kind === 'weekly');
  const capacityNow = weekly?.usedPercent !== undefined ? `Queda aprox. ${100 - weekly.usedPercent} % del cupo semanal (${weekly.verified ? 'verificado en la cuenta' : 'dato declarado, sin verificar'}).` : 'Cupo restante desconocido: anótelo desde Ajustes → Uso de la cuenta.';
  if (!quotas.length) warnings.push('No hay cupos registrados: el plan solo usa la fecha de la promoción.');
  if (quotas.some((q) => !q.verified)) warnings.push('Hay cupos sin verificar en la cuenta: las horas y fechas son las indicadas por el propietario.');
  if (quotas.some((q) => q.kind === 'short')) warnings.push('Existen límites por ventanas cortas: no hay disponibilidad continua garantizada.');
  if (end !== null && end <= nowMs) return { opportunityId: opportunity.id, promotionEndsAt: opportunity.expiresAt!, nextResetAt: null, resetVerified: false, phases: [], warnings: ['La promoción ya caducó.'] };
  const phases: UtilizationPhase[] = [];
  if (upcoming) {
    const reset = Date.parse(upcoming.resetsAt!);
    phases.push({ id: 'A', from: isoOf(nowMs), to: isoOf(reset), hours: hours(nowMs, reset), capacity: capacityNow, focus: 'Usar el cupo disponible en las tareas de mayor valor y dejar preparados documentos, archivos y pruebas para no gastar cupo nuevo en preparación.' });
    if (end !== null) phases.push({ id: 'B', from: isoOf(reset), to: isoOf(end), hours: hours(reset, end), capacity: `Cupo renovado en el restablecimiento (${upcoming.verified ? 'verificado' : 'fecha indicada, sin verificar'}).`, focus: 'Ejecutar de inmediato: implementación, auditorías, correcciones y pruebas de los productos activos.' });
  } else if (end !== null) {
    phases.push({ id: 'A', from: isoOf(nowMs), to: isoOf(end), hours: hours(nowMs, end), capacity: capacityNow, focus: 'Sin restablecimiento conocido antes del fin: priorizar lo de mayor valor mientras quede cupo.' });
  } else warnings.push('La oportunidad no tiene fecha de fin registrada.');
  return { opportunityId: opportunity.id, promotionEndsAt: opportunity.expiresAt ?? null, nextResetAt: upcoming?.resetsAt ?? null, resetVerified: upcoming?.verified ?? false, phases, warnings };
}

/* ───────────────────────────── Fuentes oficiales y detección ───────────────────────────── */

export interface RadarSource {
  id: string;
  provider: string;
  label: string;
  url: string;
}

/** Páginas oficiales de novedades. Se pueden sustituir con JANUS_RADAR_SOURCES (JSON). Solo https. */
export const DEFAULT_RADAR_SOURCES: readonly RadarSource[] = Object.freeze([
  { id: 'anthropic-news', provider: 'Anthropic', label: 'Anthropic · Newsroom', url: 'https://www.anthropic.com/news' },
  { id: 'openai-news', provider: 'OpenAI', label: 'OpenAI · News', url: 'https://openai.com/news/' },
  { id: 'google-ai-blog', provider: 'Google', label: 'Google · The Keyword (AI)', url: 'https://blog.google/technology/ai/' },
]);

export function parseRadarSources(value: string | undefined): RadarSource[] {
  if (!value?.trim()) return DEFAULT_RADAR_SOURCES.map((s) => ({ ...s }));
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error('JANUS_RADAR_SOURCES must be JSON'); }
  if (!Array.isArray(parsed)) throw new Error('JANUS_RADAR_SOURCES must be a JSON array');
  return parsed.slice(0, 30).map((raw, index) => {
    const item = raw as Record<string, unknown>;
    const url = httpsUrl(item.url);
    const provider = text(item.provider, 60);
    if (!url || !provider) throw new Error(`radar source ${index} needs provider and https url`);
    return { id: text(item.id, 60) ?? `source-${index}`, provider, label: text(item.label, 120) ?? provider, url };
  });
}

const SIGNALS: Array<[RegExp, OpportunityKind]> = [
  [/\b(free trial|prueba gratuita|gratis hasta|free (?:for|until|through)|included (?:with|in) .{0,30}(?:until|through))\b/i, 'free_trial'],
  [/\b(credits?|cr[eé]ditos?)\b/i, 'credits'],
  [/\b(discount|descuento|% off|rebaja|promo(?:tion|ci[oó]n)?|limited[- ]time|por tiempo limitado|launch week|launch offer)\b/i, 'promotion'],
  [/\b(early access|acceso anticipado|waitlist|lista de espera|research preview|public preview|beta)\b/i, 'early_access'],
  [/\b(higher (?:rate )?limits?|increased limits?|rate limits?|m[aá]s l[ií]mites?|doubl\w+ .{0,20}limits?|limit reset)\b/i, 'limit_increase'],
  [/\b(introducing|announcing|presentamos|now available|ya disponible|launch(?:es|ing)?|lanzamiento|release[ds]?)\b/i, 'launch'],
];

export interface DetectedCandidate {
  title: string;
  kind: OpportunityKind;
  url: string;
}

/**
 * Lee el HTML de una página oficial y propone candidatas: titulares/enlaces con señales de oferta o lanzamiento.
 * Es una criba por palabras clave, NO una comprensión del texto: todo lo detectado nace como `pending`
 * (fechas, condiciones y elegibilidad quedan por confirmar leyendo la fuente).
 */
export function detectCandidates(html: string, source: RadarSource, limit = 12): DetectedCandidate[] {
  const out: DetectedCandidate[] = [];
  const seen = new Set<string>();
  const decode = (value: string) => value.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
  const anchors = /<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]{0,600}?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchors.exec(html)) && out.length < limit) {
    const title = decode(match[2]!).slice(0, 200);
    if (title.length < 12 || title.length > 180) continue;
    const signal = SIGNALS.find(([pattern]) => pattern.test(title));
    if (!signal) continue;
    let url: URL;
    try { url = new URL(match[1]!, source.url); } catch { continue; }
    if (url.protocol !== 'https:') continue;
    const key = opportunityFingerprint(source.provider, title);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ title, kind: signal[1], url: url.toString() });
  }
  return out;
}

export interface RadarSourceState {
  sourceId: string;
  checkedAt: string;
  ok: boolean;
  /** Código HTTP o motivo breve del fallo; nunca el contenido. */
  detail: string;
  candidates: number;
  consecutiveFailures: number;
}

export interface RadarRunReport {
  at: string;
  sources: RadarSourceState[];
  created: string[];
  updated: string[];
  /** `read`/`failed` siguen el contrato del planificador compartido: si todas las fuentes fallan, la pasada cuenta como fallo. */
  summary: { sources: number; reachable: number; created: number; updated: number; read: number; failed: number };
}

export interface RadarRunDeps {
  sources: readonly RadarSource[];
  /** Devuelve el HTML o lanza. El runtime limita tamaño, tiempo y destino (solo https de la lista). */
  fetchText(url: string): Promise<string>;
  list(): Opportunity[];
  save(opportunity: Opportunity): void;
  previousState(sourceId: string): RadarSourceState | undefined;
  saveState(state: RadarSourceState): void;
  newId(): string;
  now(): string;
}

/** Una pasada del monitor: cada fuente es independiente; una caída no impide leer las demás ni borra nada. */
export async function runRadar(deps: RadarRunDeps): Promise<RadarRunReport> {
  const at = deps.now();
  const created: string[] = [];
  const updated: string[] = [];
  const states: RadarSourceState[] = [];
  for (const source of deps.sources) {
    const previous = deps.previousState(source.id);
    let state: RadarSourceState;
    try {
      const html = await deps.fetchText(source.url);
      const candidates = detectCandidates(html, source);
      for (const candidate of candidates) {
        const incoming = createOpportunity({ provider: source.provider, title: candidate.title, kind: candidate.kind, sourceUrl: candidate.url, sourceLabel: source.label, detectedBy: 'monitor', verification: 'pending', benefit: 3, notes: 'Detectada por palabras clave en la fuente oficial: confirmar fechas, condiciones y elegibilidad.' }, { id: deps.newId(), now: at });
        const existing = deps.list().find((item) => item.fingerprint === incoming.fingerprint);
        if (!existing) { deps.save(incoming); created.push(incoming.id); }
        else { const merged = mergeOpportunity(existing, incoming, at); if (merged.changed.length) { deps.save(merged.opportunity); updated.push(existing.id); } }
      }
      state = { sourceId: source.id, checkedAt: at, ok: true, detail: 'ok', candidates: candidates.length, consecutiveFailures: 0 };
    } catch (error) {
      state = { sourceId: source.id, checkedAt: at, ok: false, detail: (error instanceof Error ? error.message : 'error').slice(0, 160), candidates: 0, consecutiveFailures: (previous?.consecutiveFailures ?? 0) + 1 };
    }
    deps.saveState(state);
    states.push(state);
  }
  return { at, sources: states, created, updated, summary: { sources: states.length, reachable: states.filter((s) => s.ok).length, created: created.length, updated: updated.length, read: states.filter((s) => s.ok).length, failed: states.filter((s) => !s.ok).length } };
}

/* ───────────────────────────── Vista para el dashboard ───────────────────────────── */

export interface RadarView {
  generatedAt: string;
  opportunities: Array<Opportunity & { status: OpportunityStatus; hoursLeft: number | null; score: OpportunityScore; late: { late: boolean; reason: string } }>;
  alerts: OpportunityAlert[];
  quotas: QuotaWindow[];
  plan: UtilizationPlan | null;
  counts: { open: number; verified: number; pending: number; expired: number; critical: number };
}

export function buildRadarView(opportunities: readonly Opportunity[], quotas: readonly QuotaWindow[], now: string): RadarView {
  const rows = opportunities.map((opportunity) => ({ ...opportunity, status: opportunityStatus(opportunity, now), hoursLeft: hoursLeft(opportunity, now), score: scoreOpportunity(opportunity, now), late: lateDetection(opportunity) }))
    .sort((a, b) => b.score.score - a.score.score || (a.hoursLeft ?? Infinity) - (b.hoursLeft ?? Infinity) || a.title.localeCompare(b.title));
  const open = rows.filter((row) => row.status !== 'expired' && STAGE_ORDER[row.stage] !== 3);
  const top = open.find((row) => row.expiresAt) ?? null;
  return {
    generatedAt: new Date(now).toISOString(),
    opportunities: rows,
    alerts: dueOpportunityAlerts(opportunities, now),
    quotas: [...quotas],
    plan: top ? planUtilization(top, quotas, now) : null,
    counts: { open: open.length, verified: open.filter((row) => row.status === 'verified').length, pending: open.filter((row) => row.status === 'pending').length, expired: rows.filter((row) => row.status === 'expired').length, critical: open.filter((row) => row.score.priority === 'critical').length },
  };
}
