/**
 * JANUS / InfinitySeed Group — evidence-aware pilot readiness contract.
 * Pure and local-first. This module validates a record; it cannot prove that
 * referenced URLs, production deployments or device tests truly happened.
 */
export const QUALITY_FILTERS = Object.freeze([
  'veracidad', 'ortografia_i18n', 'sintesis', 'estructura',
  'coherencia_visual', 'composicion_arquitectonica',
  'arquitectura_software', 'funcionalidad', 'seguridad_privacidad',
  'responsive_compatibilidad', 'rendimiento_costes',
  'integridad_historica', 'e2e', 'entrega_final',
]);
export const PILOT_CRITERIA = Object.freeze([
  'acceso_jean', 'acceso_kendra', 'aislamiento_perfiles',
  'controles_funcionales', 'voz_criaturas_compartida',
  'camara_y_permisos', 'iphone_safari', 'persistencia_datos',
]);
export const GATE_STATES = Object.freeze(['PASS', 'FAIL', 'NOT_RUN', 'BLOCKED', 'NOT_APPLICABLE']);
const NON_WAIVABLE = new Set([
  'veracidad', 'arquitectura_software', 'funcionalidad',
  'seguridad_privacidad', 'integridad_historica', 'e2e', 'entrega_final',
]);
const SHA = /^[a-f0-9]{40}$/i;
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const hasEvidence = item => Array.isArray(item?.evidence) &&
  item.evidence.length > 0 &&
  item.evidence.every(ref => typeof ref === 'string' && ref.trim().length >= 5);

function checkItems(container, expected, errors, prefix) {
  if (!isObject(container)) {
    errors.push(prefix + ': falta el registro de dimensiones.');
    return expected.map(id => ({ id, state: 'NOT_RUN', evidence: [] }));
  }
  for (const unknown of Object.keys(container).filter(k => !expected.includes(k))) {
    errors.push(prefix + ': dimensión desconocida ' + unknown);
  }
  return expected.map(id => {
    const item = container[id];
    if (!isObject(item) || !GATE_STATES.includes(item.state)) {
      errors.push(prefix + '.' + id + ': estado ausente o inválido.');
      return { id, state: 'NOT_RUN', evidence: [] };
    }
    if (item.state === 'PASS' && !hasEvidence(item)) {
      errors.push(prefix + '.' + id + ': PASS sin referencias de evidencia.');
    }
    if (item.state === 'NOT_APPLICABLE') {
      if (prefix === 'filters' && NON_WAIVABLE.has(id)) {
        errors.push(prefix + '.' + id + ': este filtro no admite exclusión.');
      }
      if (typeof item.reason !== 'string' || item.reason.trim().length < 12) {
        errors.push(prefix + '.' + id + ': exclusión sin justificación concreta.');
      }
    }
    return { id, state: item.state, evidence: item.evidence ?? [] };
  });
}

export function assessPilotReadiness(record) {
  const errors = [];
  if (!isObject(record) || record.project !== 'JANUS') {
    return { status: 'INVALID_RECORD', errors: ['Se exige un registro de proyecto JANUS.'], pending: [], failed: [], reviewRequired: true };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(record.updatedAt ?? '')) {
    errors.push('updatedAt: debe tener formato AAAA-MM-DD.');
  }
  if (!isObject(record.baseline) || !SHA.test(record.baseline.commit ?? '') ||
      typeof record.baseline.ref !== 'string' || !record.baseline.ref.trim()) {
    errors.push('baseline: se exige rama y SHA de 40 caracteres verificados.');
  }
  const filters = checkItems(record.filters, QUALITY_FILTERS, errors, 'filters');
  const criteria = checkItems(record.acceptance, PILOT_CRITERIA, errors, 'acceptance');
  const items = [...filters, ...criteria];
  const failed = items.filter(item => item.state === 'FAIL' || item.state === 'BLOCKED').map(item => item.id);
  const pending = items.filter(item => item.state === 'NOT_RUN').map(item => item.id);

  const deployed = record.deployment?.state === 'PUBLISHED';
  if (!isObject(record.deployment) || !['NOT_DEPLOYED', 'PUBLISHED', 'UNKNOWN'].includes(record.deployment.state)) {
    errors.push('deployment.state: NOT_DEPLOYED, PUBLISHED o UNKNOWN.');
  }
  if (deployed && !SHA.test(record.deployment.commit ?? '')) {
    errors.push('deployment.commit: un despliegue publicado debe tener SHA verificable.');
  }
  if (deployed && SHA.test(record.deployment.commit ?? '') &&
      record.deployment.commit !== record.baseline.commit) {
    errors.push('El despliegue y la línea base registrada no corresponden al mismo commit.');
  }
  if (deployed && (typeof record.deployment.url !== 'string' ||
      !/^https:\/\//.test(record.deployment.url))) {
    errors.push('deployment.url: se exige URL HTTPS de comprobación.');
  }
  if (errors.length) return { status: 'INVALID_RECORD', errors, pending, failed, reviewRequired: true };
  if (failed.length) return { status: 'BLOCKED', errors, pending, failed, reviewRequired: true };
  if (pending.length || !deployed || items.some(item => item.state === 'NOT_APPLICABLE')) {
    return { status: 'IN_PROGRESS', errors, pending, failed, reviewRequired: true };
  }
  // Even exhaustive self-reported PASS results are NOT independent E2E or deployment verification.
  return { status: 'REVIEW_REQUIRED', errors, pending, failed, reviewRequired: true };
}
