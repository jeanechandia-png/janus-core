/**
 * JANUS EVOLUTION GUARD · Premortem / Postmortem
 * No IO, no model calls, no external vendor, no changes to production.
 * Designed as a reusable LEGO module across Infinity Seed Group.
 * Measured evidence (not marketing claims) determines the assessment.
 */
export const EVOLUTION_CHECKS = Object.freeze([
  { id: 'gateway.alternative-model', domain: 'provider', windowDays: 30, failure: 'Un proveedor de IA desaparece o cambia precios/API', preventiveAction: 'Probar sustitución de modelo sin modificar Janus Core' },
  { id: 'gateway.alternative-voice', domain: 'provider', windowDays: 30, failure: 'El proveedor de voz revoca un plan o se retira', preventiveAction: 'Probar voz local y respaldo de grabaciones originales autorizadas' },
  { id: 'offline.core-workflows', domain: 'offline', windowDays: 30, failure: 'Janus deja de ejecutar funciones esenciales sin internet', preventiveAction: 'Ejecutar la suite offline con red bloqueada' },
  { id: 'data.backup-restore', domain: 'portability', windowDays: 90, failure: 'Se pierde memoria, configuración o historial al migrar', preventiveAction: 'Restaurar snapshot SQLite en un dispositivo limpio y verificar checksums' },
  { id: 'data.export-portability', domain: 'portability', windowDays: 90, failure: 'La información queda encerrada en un producto', preventiveAction: 'Probar exportación/importación de datos versionados, sin claves' },
  { id: 'security.dependencies', domain: 'security', windowDays: 14, failure: 'Dependencias vulnerables u obsoletas no detectadas', preventiveAction: 'Revisar avisos oficiales, licencias y parches; nunca instalar a ciegas' },
  { id: 'security.authority', domain: 'security', windowDays: 30, failure: 'Una actualización elude aprobaciones o aislamiento de datos', preventiveAction: 'Repetir pruebas de denegación, identidad, permisos, idempotencia y trazabilidad' },
  { id: 'connectors.contracts', domain: 'integrations', windowDays: 30, failure: 'Las APIs externas dejan de ser compatibles', preventiveAction: 'Probar contratos de los adaptadores contra esquemas oficiales y staging' },
  { id: 'cost.budget', domain: 'cost', windowDays: 30, failure: 'Uso de herramientas/modelos excede el presupuesto autorizado', preventiveAction: 'Comparar consumo real y opciones locales; requerir autorización para nuevos gastos' },
  { id: 'quality.regression', domain: 'quality', windowDays: 14, failure: 'Una mejora rompe tareas existentes o empeora resultados', preventiveAction: 'Comparar evaluación antigua/nueva con pruebas de regresión y rollback' },
  { id: 'hardware.compatibility', domain: 'hardware', windowDays: 90, failure: 'Janus deja de funcionar en dispositivos del propietario', preventiveAction: 'Probar hardware real, navegadores móviles y capacidad local disponible' },
  { id: 'value.user-outcomes', domain: 'value', windowDays: 90, failure: 'Janus acumula funciones sin resolver necesidades reales', preventiveAction: 'Medir tareas terminadas, errores repetidos y valor observado por el usuario' },
] as const);
export type EvolutionCheckId = typeof EVOLUTION_CHECKS[number]['id'];
export type EvolutionState = 'pass' | 'warn' | 'fail' | 'unknown';
export type EvolutionLevel = 'stable' | 'watch' | 'critical' | 'unverified';
export interface EvolutionObservation {
  id: EvolutionCheckId;
  at: string;
  result: Exclude<EvolutionState, 'unknown'>;
  evidenceRef: string; // fixture, test output, local receipt ID, official source
  verified: boolean;
  notes?: string;
}
export interface EvolutionFinding {
  id: EvolutionCheckId;
  domain: string;
  result: EvolutionState;
  level: EvolutionLevel;
  ageDays: number | null;
  evidenceRef: string | null;
  failureMode: string;
  preventiveAction: string;
}
export interface EvolutionAssessment {
  at: string;
  horizonMonths: number;
  findings: EvolutionFinding[];
  counts: Record<EvolutionLevel, number>;
  priority: EvolutionFinding[];
  status: 'verified' | 'attention-required' | 'insufficient-evidence';
  requiresApprovalForChanges: true;
}
const ageDays = (then: string, now: string) => (Date.parse(now) - Date.parse(then)) / 86_400_000;
const ensureAt = (date: string) => {
  if (!Number.isFinite(Date.parse(date))) throw new Error('Fecha inválida');
};
const worstFirst: Record<EvolutionLevel, number> = { critical: 0, unverified: 1, watch: 2, stable: 3 };

export function premortem(
  observations: readonly EvolutionObservation[], at: string,
  options: { horizonMonths?: number; maxAgeDaysByCheck?: Partial<Record<EvolutionCheckId, number>> } = {},
): EvolutionAssessment {
  ensureAt(at);
  const horizonMonths = options.horizonMonths ?? 24;
  if (!Number.isInteger(horizonMonths) || horizonMonths < 1 || horizonMonths > 120) throw new Error('Horizonte inválido');
  for (const ob of observations) {
    if (!EVOLUTION_CHECKS.some(check => check.id === ob.id)) throw new Error('Chequeo desconocido: ' + ob.id);
    ensureAt(ob.at);
    if (!['pass', 'warn', 'fail'].includes(ob.result)) throw new Error('Resultado inválido');
    if (!ob.evidenceRef || !ob.evidenceRef.trim()) throw new Error('Evidencia obligatoria');
    if (ageDays(ob.at, at) < 0) throw new Error('Evidencia posterior a la evaluación');
  }
  const findings = EVOLUTION_CHECKS.map(check => {
    const candidates = observations.filter(o => o.id === check.id).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
    const latest = candidates[0];
    const age = latest ? ageDays(latest.at, at) : null;
    const maxAge = options.maxAgeDaysByCheck?.[check.id] ?? check.windowDays;
    if (!(maxAge > 0) || !Number.isFinite(maxAge)) throw new Error('Ventana de evidencia inválida');
    // Una anotación no verificada no puede certificar el sistema como "pass".
    const recent = !!latest && !!latest.verified && age !== null && age <= maxAge;
    const result: EvolutionState = !recent ? 'unknown' : latest.result;
    const level: EvolutionLevel = result === 'fail' ? 'critical'
      : result === 'warn' ? 'watch' : result === 'pass' ? 'stable' : 'unverified';
    return {
      id: check.id, domain: check.domain, result, level,
      ageDays: age === null ? null : Math.round(age * 100) / 100,
      evidenceRef: latest?.evidenceRef ?? null,
      failureMode: check.failure, preventiveAction: check.preventiveAction,
    };
  });
  const counts: Record<EvolutionLevel, number> = { stable: 0, watch: 0, critical: 0, unverified: 0 };
  for (const finding of findings) counts[finding.level] += 1;
  const priority = [...findings].sort((a, b) => worstFirst[a.level] - worstFirst[b.level] || a.id.localeCompare(b.id));
  const status = counts.critical > 0 || counts.watch > 0 ? 'attention-required'
    : counts.unverified > 0 ? 'insufficient-evidence' : 'verified';
  return { at, horizonMonths, findings, counts, priority, status, requiresApprovalForChanges: true };
}
export interface PostmortemIncident {
  id: string;
  occurredAt: string;
  recordedAt: string;
  fingerprint: string;
  error: string;
  cause: string; // "por confirmar" is permitted and NOT treated as verified
  impact: string;
  lesson: string;
  preventiveRule: string;
  solutions: string[];
  change: string;
  verification: string;
  evidenceRefs: string[];
  previousOccurrences?: number;
  verified?: boolean;
}
export interface EvolutionPostmortem {
  incident: PostmortemIncident;
  recurrenceCount: number;
  severity: 'high' | 'critical';
  requiresProtectionReview: boolean;
  resolved: boolean;
  status: 'open' | 'verified';
  action: 'review-and-propose' | 'escalate-protection-failure';
  requiresHumanApproval: true;
}
export function postmortem(incident: PostmortemIncident): EvolutionPostmortem {
  ensureAt(incident.occurredAt); ensureAt(incident.recordedAt);
  if (ageDays(incident.occurredAt, incident.recordedAt) < 0) throw new Error('El registro es anterior al incidente');
  const required = [incident.id, incident.fingerprint, incident.error, incident.cause, incident.impact,
    incident.lesson, incident.preventiveRule, incident.change, incident.verification];
  if (required.some(s => !s || !s.trim())) throw new Error('Postmortem incompleto');
  if (!incident.evidenceRefs?.length || !incident.evidenceRefs.every(s => !!s.trim())) throw new Error('Falta evidencia');
  if (!incident.solutions?.length || !incident.solutions.every(s => !!s.trim())) throw new Error('Faltan soluciones');
  const previous = incident.previousOccurrences ?? 0;
  if (!Number.isSafeInteger(previous) || previous < 0) throw new Error('Reincidencias inválidas');
  const recurrenceCount = previous + 1;
  // Solución sin prueba comprobada o causa desconocida => no cerrar incidente.
  const resolved = incident.verified === true && !/por confirmar|unknown|no determinada/i.test(incident.cause)
    && !/pendiente|por confirmar|no probado/i.test(incident.verification);
  return {
    incident: { ...incident, solutions: [...incident.solutions], evidenceRefs: [...incident.evidenceRefs] },
    recurrenceCount, severity: recurrenceCount >= 2 ? 'critical' : 'high',
    requiresProtectionReview: recurrenceCount > 1, resolved,
    status: resolved ? 'verified' : 'open',
    action: recurrenceCount > 1 ? 'escalate-protection-failure' : 'review-and-propose',
    requiresHumanApproval: true,
  };
}
export interface EvolutionProposal {
  id: string;
  at: string;
  currentRef: string;
  candidateRef: string;
  evidenceRefs: string[];
  riskIds: EvolutionCheckId[];
  expectedBenefit: string;
  fallbackRef: string;
  status: 'proposed';
  requiresHumanApproval: true;
  autoDeploy: false;
}
export function proposeUpgrade(input: Omit<EvolutionProposal, 'status' | 'requiresHumanApproval' | 'autoDeploy'>): EvolutionProposal {
  ensureAt(input.at);
  if (!input.id.trim() || !input.currentRef.trim() || !input.candidateRef.trim()
      || !input.expectedBenefit.trim() || !input.fallbackRef.trim() || !input.evidenceRefs.length
      || !input.riskIds.length || input.currentRef === input.candidateRef) throw new Error('Propuesta incompleta');
  if (input.riskIds.some(id => !EVOLUTION_CHECKS.some(check => check.id === id))) throw new Error('Riesgo no registrado');
  return { ...input, evidenceRefs: [...input.evidenceRefs], riskIds: [...input.riskIds], status: 'proposed', autoDeploy: false, requiresHumanApproval: true };
}
export function assessReleaseGate(input: {
  regressionPass: boolean; securityPass: boolean; offlinePass: boolean;
  independentReviewPass: boolean; rollbackReady: boolean; founderApproved: boolean;
}): { canPromote: boolean; blockers: string[] } {
  const requirements = [
    ['regressionPass', 'Pruebas de regresión'],
    ['securityPass', 'Seguridad y autoridad'],
    ['offlinePass', 'Trabajo útil sin red'],
    ['independentReviewPass', 'Verificación independiente'],
    ['rollbackReady', 'Restauración anterior comprobada'],
    ['founderApproved', 'Aprobación explícita del Founder'],
  ] as const;
  const blockers = requirements.filter(([key]) => input[key] !== true).map(([,label]) => label);
  return { canPromote: blockers.length === 0, blockers };
}
