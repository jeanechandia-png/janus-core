import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateAutonomy,
  inferChangeTouches,
  runAutonomousPipeline,
  type AutonomousStep,
} from '../packages/core/src/autonomy-policy.js';
import { buildClosureReport, renderClosureReportMarkdown } from '../packages/core/src/closure-report.js';
import {
  buildObjectivePromptBlock,
  checkContentObjectives,
  packageSaasAsset,
  selectRotatingPartner,
} from '../packages/core/src/content-objectives.js';
import type { JanusEvent, RunSnapshot } from '../packages/core/src/events.js';

test('autonomy: only the three structural triggers interrupt the Founder', () => {
  assert.deepEqual(evaluateAutonomy({ id: 'a', summary: 'refactor interno', touches: [] }), { action: 'proceed' });
  const db = evaluateAutonomy({ id: 'b', summary: 'migrar esquema', touches: ['db_schema'] });
  assert.equal(db.action, 'interrupt_founder');
  const removal = evaluateAutonomy({ id: 'c', summary: 'quitar módulo', touches: ['module_removal'] });
  assert.ok(removal.action === 'interrupt_founder' && removal.triggers.includes('definitive_module_removal'));
  const brand = evaluateAutonomy({ id: 'd', summary: 'cambiar logo', touches: ['brand_identity'] });
  assert.ok(brand.action === 'interrupt_founder' && brand.triggers.includes('brand_identity_change'));
});

test('autonomy: external writes and spending stay behind the approval queue (not relaxed)', () => {
  const decision = evaluateAutonomy({ id: 'e', summary: 'crear tarea en Asana', touches: ['external_write'] });
  assert.equal(decision.action, 'queue_approval');
  assert.equal(evaluateAutonomy({ id: 'f', summary: 'vídeo Runway', touches: ['spend'] }).action, 'queue_approval');
});

test('autonomy: text heuristic only adds gates', () => {
  assert.ok(inferChangeTouches('Hay que cambiar el logo y la identidad de marca').includes('brand_identity'));
  assert.ok(inferChangeTouches('Eliminar el módulo de voz definitivamente').includes('module_removal'));
  assert.ok(inferChangeTouches('ALTER TABLE runs ADD COLUMN x').includes('db_schema'));
  assert.deepEqual(inferChangeTouches('Corregir un typo en el README'), []);
});

function step(id: string, run: () => Promise<string | void>, extra: Partial<AutonomousStep> = {}): AutonomousStep {
  return { id, title: `Paso ${id}`, run, ...extra };
}

test('pipeline: diagnosis -> conclusions -> plan -> direct execution without asking', async () => {
  const order: string[] = [];
  const report = await runAutonomousPipeline({
    goal: 'auditar y corregir',
    diagnose: async () => ({ findings: ['falta typecheck de server'] }),
    conclude: async () => ['incluir apps en tsconfig'],
    plan: async () => [
      step('s1', async () => { order.push('s1'); }),
      step('s2', async () => { order.push('s2'); return 'ok'; }, { dependsOn: ['s1'] }),
    ],
  });
  assert.deepEqual(order, ['s1', 's2']);
  assert.equal(report.status, 'completed');
  assert.equal(report.passiveDiagnosisViolation, false);
});

test('pipeline: a diagnosis with findings but no plan is a forbidden passive answer', async () => {
  const report = await runAutonomousPipeline({
    goal: 'x',
    diagnose: async () => ({ findings: ['problema real'] }),
    conclude: async () => ['hay que arreglarlo'],
    plan: async () => [],
  });
  assert.equal(report.passiveDiagnosisViolation, true);
  assert.equal(report.status, 'failed');
});

test('pipeline: sensitive step is parked, independent work continues, dependents wait', async () => {
  const ran: string[] = [];
  const requested: string[] = [];
  const report = await runAutonomousPipeline({
    goal: 'publicar',
    diagnose: async () => ({ findings: ['pendiente de publicar'] }),
    conclude: async () => ['publicar y seguir'],
    plan: async () => [
      step('publish', async () => { ran.push('publish'); }, {
        change: { id: 'publish', summary: 'publicar en GitHub', touches: ['external_write'] },
      }),
      step('independent', async () => { ran.push('independent'); }),
      step('after-publish', async () => { ran.push('after-publish'); }, { dependsOn: ['publish'] }),
    ],
    requestApproval: async (candidate) => {
      requested.push(candidate.id);
      return 'pending';
    },
  });
  assert.deepEqual(ran, ['independent']);
  assert.deepEqual(requested, ['publish']);
  assert.equal(report.status, 'completed_with_parked');
  assert.deepEqual(report.parked, ['publish']);
  assert.equal(report.steps.find((item) => item.stepId === 'after-publish')?.status, 'waiting_dependency');
});

test('pipeline: approved sensitive step runs; rejected one never runs', async () => {
  const ran: string[] = [];
  const mk = (id: string) => step(id, async () => { ran.push(id); }, {
    change: { id, summary: id, touches: ['brand_identity'] },
  });
  const report = await runAutonomousPipeline({
    goal: 'marca',
    diagnose: async () => ({ findings: ['f'] }),
    conclude: async () => ['c'],
    plan: async () => [mk('ok'), mk('no')],
    requestApproval: async (candidate) => (candidate.id === 'ok' ? 'approved' : 'rejected'),
  });
  assert.deepEqual(ran, ['ok']);
  assert.equal(report.steps.find((item) => item.stepId === 'no')?.status, 'rejected');
});

test('pipeline: failing step retries then fails without stopping independent steps', async () => {
  let attempts = 0;
  const ran: string[] = [];
  const report = await runAutonomousPipeline({
    goal: 'x',
    maxAttempts: 3,
    diagnose: async () => ({ findings: ['f'] }),
    conclude: async () => ['c'],
    plan: async () => [
      step('flaky', async () => { attempts += 1; throw new Error('boom'); }),
      step('other', async () => { ran.push('other'); }),
      step('dep', async () => { ran.push('dep'); }, { dependsOn: ['flaky'] }),
    ],
  });
  assert.equal(attempts, 3);
  assert.deepEqual(ran, ['other']);
  assert.equal(report.status, 'failed');
  assert.equal(report.steps.find((item) => item.stepId === 'flaky')?.detail, 'boom');
});

function event(seq: number, type: JanusEvent['type'], summary: string, payload: Record<string, unknown> = {}): JanusEvent {
  return { id: `e${seq}`, runId: 'run_1', seq, type, at: '2026-10-21T10:00:00.000Z', source: 'core', summary, payload };
}

const snapshot = (status: RunSnapshot['status']): RunSnapshot => ({
  runId: 'run_1', goal: 'auditar Janus', status, lastEventSeq: 5,
  startedAt: '2026-10-21T10:00:00.000Z', updatedAt: '2026-10-21T10:05:00.000Z',
});

test('closure report: three mandatory sections, deterministic, nothing invented', () => {
  const events = [
    event(1, 'run.step.completed', 'Leer estado'),
    event(2, 'run.step.completed', 'Aplicar corrección'),
    event(3, 'quality.passed', 'ok'),
    event(4, 'artifact.updated', 'artefacto', { preview: 'Informe final' }),
  ];
  const a = buildClosureReport({ snapshot: snapshot('completed'), events });
  const b = buildClosureReport({ snapshot: snapshot('completed'), events: [...events].reverse() });
  assert.equal(a.checksum, b.checksum);
  assert.deepEqual(a.executiveSummary.achievements, ['Leer estado', 'Aplicar corrección']);
  const md = renderClosureReportMarkdown(a);
  const first = md.indexOf('## RESUMEN EJECUTIVO');
  const second = md.indexOf('## CONCLUSIONES TÉCNICAS Y OPERATIVAS');
  const third = md.indexOf('## PRÓXIMOS PASOS');
  assert.ok(first >= 0 && first < second && second < third);
  assert.ok(a.technicalConclusions.some((line) => line.includes('Informe final')));
});

test('closure report: blocked run hands the next agent a concrete next step', () => {
  const report = buildClosureReport({
    snapshot: snapshot('blocked'),
    events: [event(1, 'run.step.completed', 'Paso A'), event(2, 'run.blocked', 'Falta la llave de Vercel')],
    blockerNextAction: 'Añadir VERCEL_TOKEN en .env.local y reintentar.',
  });
  assert.equal(report.nextSteps[0], 'Añadir VERCEL_TOKEN en .env.local y reintentar.');
  assert.ok(report.technicalConclusions.some((line) => line.includes('Falta la llave de Vercel')));
  assert.ok(report.nextSteps.some((line) => line.includes('último paso completado')));
});

const objectiveContext = {
  clientValueMarkers: ['ahorra', 'reserva en 30 segundos'],
  mainProductMarkers: ['infinity chatbox'],
  partners: [
    { id: 'potensic', name: 'Potensic', markers: ['potensic'], active: true },
    { id: 'acme', name: 'Acme', markers: ['acme'], active: true },
    { id: 'old', name: 'Old', markers: ['old'], active: false },
  ],
  rotationIndex: 0,
} as const;

test('content objectives: rotation is deterministic and skips inactive partners', () => {
  assert.equal(selectRotatingPartner(objectiveContext.partners, 0)?.id, 'acme');
  assert.equal(selectRotatingPartner(objectiveContext.partners, 1)?.id, 'potensic');
  assert.equal(selectRotatingPartner(objectiveContext.partners, -1)?.id, 'potensic');
  assert.equal(selectRotatingPartner([], 3), undefined);
});

test('content objectives: all four objectives must be evidenced in the piece', () => {
  const full = 'Ahorra horas con Infinity ChatBox, de InfinitySeed Group, junto a Acme.';
  assert.equal(checkContentObjectives(full, objectiveContext).ok, true);
  const partial = checkContentObjectives('Ahorra horas con Infinity ChatBox.', objectiveContext);
  assert.equal(partial.ok, false);
  assert.deepEqual(partial.missing.sort(), ['infinityseed_promotion', 'partner_visibility']);
  assert.match(buildObjectivePromptBlock(objectiveContext), /Socio en rotación: Acme/);
});

test('asset package: deterministic checksum, safe paths, semver', () => {
  const input = {
    id: 'reels-template', name: 'Plantilla Reel', version: '1.0.0', kind: 'template' as const,
    files: [{ path: 'b.md', content: 'B' }, { path: 'a.md', content: 'A' }],
    parameters: ['tenant'],
  };
  const one = packageSaasAsset(input);
  const two = packageSaasAsset({ ...input, files: [...input.files].reverse() });
  assert.equal(one.checksum, two.checksum);
  assert.deepEqual(one.files.map((file) => file.path), ['a.md', 'b.md']);
  assert.throws(() => packageSaasAsset({ ...input, files: [{ path: '../x', content: '' }] }), /unsafe/);
  assert.throws(() => packageSaasAsset({ ...input, version: 'v1' }), /semver/);
});
