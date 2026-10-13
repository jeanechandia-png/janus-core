import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assessComplexity, assessRisk, decideEffort, parseEffortRequest, EFFORT_POLICY_VERSION,
} from '../packages/core/src/effort-policy.js';

test('AUTO: simple question is ECO, mid task NORMAL, big engineering task PROFUNDO', () => {
  assert.equal(decideEffort({ text: '¿Qué hora es en Medellín?' }).level, 'eco');
  assert.equal(decideEffort({ text: 'Compara estas dos opciones de hosting' }).level, 'normal');
  const big = decideEffort({
    text: 'Audita la arquitectura del servidor, investiga novedades de seguridad, implementa el plan paso a paso y depura cada integración.',
  });
  assert.equal(big.level, 'profundo');
  assert.equal(big.source, 'auto');
  assert.equal(big.policyVersion, EFFORT_POLICY_VERSION);
});

test('AUTO never selects MAXIMO, even for critical, complex commands', () => {
  const decision = decideEffort({
    text: 'Audita y migra toda la arquitectura, investiga seguridad, integra y publica en producción y transferir el pago del proveedor paso a paso.',
  });
  assert.notEqual(decision.level, 'maximo');
  assert.equal(decision.risk, 'critical');
  assert.equal(decision.requiresConfirmation, true);
  assert.ok(decision.reasons.some((reason) => /nunca elige M[ÁA]XIMO/i.test(reason)));
});

test('risk floor: ECO chosen by the Founder is raised to NORMAL for risky commands, and reported', () => {
  const raised = decideEffort({ text: 'Borra los borradores de la carpeta', requested: 'eco' });
  assert.equal(raised.level, 'normal');
  assert.equal(raised.raisedByRisk, true);
  assert.equal(raised.source, 'founder');
  const kept = decideEffort({ text: 'Dime un chiste', requested: 'eco' });
  assert.equal(kept.level, 'eco');
  assert.equal(kept.raisedByRisk, false);
});

test('explicit MAXIMO is honoured with the largest budget; AUTO adds fresh research on time-sensitive asks', () => {
  const max = decideEffort({ text: 'Revisa el plan', requested: 'MÁXIMO' });
  assert.equal(max.level, 'maximo');
  assert.equal(max.budget.parallelAgents, 6);
  const fresh = decideEffort({ text: 'Compara el precio actual de dos planes de hosting' });
  assert.equal(fresh.budget.freshResearch, true);
  assert.equal(decideEffort({ text: 'Qué precio tiene hoy', requested: 'eco' }).budget.freshResearch, false);
});

test('cost-sensitive (offline) caps low-risk work at NORMAL but never lowers risky work', () => {
  const text = 'Audita la arquitectura, investiga y compara cada integración paso a paso y diseña el plan.';
  assert.equal(decideEffort({ text }).level, 'profundo');
  assert.equal(decideEffort({ text, costSensitive: true }).level, 'normal');
  const risky = decideEffort({ text: text + ' Luego publica en producción.', costSensitive: true });
  assert.equal(risky.level, 'profundo');
});

test('parsing is tolerant and unknown values fall back to AUTO', () => {
  assert.equal(parseEffortRequest('Máximo'), 'maximo');
  assert.equal(parseEffortRequest('MAX'), 'maximo');
  assert.equal(parseEffortRequest(' Profundo '), 'profundo');
  assert.equal(parseEffortRequest('turbo'), 'auto');
  assert.equal(parseEffortRequest(undefined), 'auto');
  assert.equal(parseEffortRequest(42), 'auto');
});

test('risk and complexity assessments are deterministic and accent-insensitive', () => {
  assert.equal(assessRisk('Envía un correo al cliente'), 'high');
  assert.equal(assessRisk('Envia un correo', true), 'high');
  assert.equal(assessRisk('Dime el clima'), 'low');
  assert.equal(assessRisk('Publica en PRODUCCIÓN'), 'critical');
  assert.equal(assessComplexity('hola'), 'low');
});
