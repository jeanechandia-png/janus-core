import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { FLOW_TEMPLATES } from '../packages/automation/src/flow-templates.js';
import { builtinNodeManifests } from '../packages/automation/src/node-catalog.js';
import { validateAutomationWorkflow } from '../packages/automation/src/workflow.js';
import {
  ENV_PRESETS, NODE_H, NODE_W, addNode, analyzeDraft, autoLayout, branchOutputs, catalogView, connect, createNode, disconnect, draftFromTemplate,
  duplicateNode, executionPlan, exportBlockers, isPublishReady, knownToolActions, levelsOf, moveNode, newDraft, normalizeNode, parseDraft, registryFor,
  removeNode, renameFlow, serializeDraft, slug, templatesView, uniqueId, updateFlowSettings, updateNode, type FlowDraft,
} from '../apps/flow-editor/src/model.js';

const NOW = '2026-10-23T10:00:00.000Z';
const ALL = ENV_PRESETS.todo!.env;
const TODAY = ENV_PRESETS.hoy!.env;
const manifestsAll = builtinNodeManifests(ALL);
const manifest = (type: string) => manifestsAll.find((m) => m.type === type)!;

function ok<T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> {
  assert.equal(result.ok, true, JSON.stringify(result));
  return result as Extract<T, { ok: true }>;
}

test('cada tipo del catálogo se puede añadir y conectar sin que el motor encuentre defectos de estructura', () => {
  assert.ok(manifestsAll.length >= 24);
  const registry = registryFor(ALL);
  for (const m of manifestsAll) {
    if (m.kind === 'trigger') continue;
    let draft = newDraft(NOW, manifestsAll);
    const added = ok(addNode(draft, m, 'inicio'));
    draft = ok(connect(added.draft, 'inicio', added.id!)).draft;
    const structural = analyzeDraft(draft, registry).filter((p) => p.kind === 'estructura').map((p) => p.text);
    // Un agente sin objetivo no puede ser válido: es el único defecto esperable de un nodo recién añadido.
    assert.deepEqual(structural, m.type === 'ai.agent' ? ['El agente necesita un objetivo.'] : [], m.type);
  }
});

test('cada disparador nuevo es válido por sí solo para el motor', () => {
  for (const m of manifestsAll.filter((x) => x.kind === 'trigger')) {
    const node = createNode(m, 'inicio');
    const result = validateAutomationWorkflow({ ...newDraft(NOW, manifestsAll).workflow, nodes: [node] });
    assert.deepEqual(result.errors, [], m.type);
  }
});

test('las plantillas que entrega el motor no tienen ni errores ni avisos en el editor (editor y motor no se contradicen)', () => {
  const registry = registryFor(ALL);
  for (const template of FLOW_TEMPLATES) {
    const problems = analyzeDraft(draftFromTemplate(template), registry);
    assert.deepEqual(problems, [], `${template.id}: ${problems.map((p) => p.text).join(' | ')}`);
    assert.ok(isPublishReady(problems));
  }
});

test('en el entorno «hoy» lo que necesita modelo, planificador o endpoints queda «en reposo» y con el motivo del motor', () => {
  const registry = registryFor(TODAY);
  const briefing = draftFromTemplate(FLOW_TEMPLATES.find((t) => t.id === 'briefing-matinal')!);
  const problems = analyzeDraft(briefing, registry);
  const entorno = problems.filter((p) => p.kind === 'entorno');
  assert.ok(entorno.length >= 3, 'planificador, endpoint HTTP y resumen con IA');
  assert.ok(entorno.every((p) => p.level === 'error' && p.text.startsWith('En reposo en este entorno')));
  assert.equal(isPublishReady(problems), false);

  const groups = catalogView(TODAY);
  const flat = groups.flatMap((g) => g.entries);
  assert.equal(flat.find((e) => e.manifest.type === 'trigger.manual')!.status, 'listo');
  const ai = flat.find((e) => e.manifest.type === 'ai.summarize')!;
  assert.equal(ai.status, 'reposo');
  assert.match(ai.reason ?? '', /Model Gateway/);
  assert.equal(templatesView(TODAY).find((t) => t.template.id === 'alerta-dron')!.endpoints[0], 'clima');
});

test('http.request: el método fija la acción y los métodos que escriben exigen aprobación (invariante del motor)', () => {
  const m = manifest('http.request');
  const get = createNode(m, 'h');
  assert.equal(get.toolOperation?.action, 'request.read');
  assert.equal(get.requiresApproval, false);
  const post = normalizeNode({ ...get, parameters: { ...get.parameters, method: 'post' } });
  assert.equal(post.toolOperation?.action, 'request.send');
  assert.equal(post.reversible, false);
  assert.equal(post.requiresApproval, true);
  assert.equal(post.risk, 'medium');
  const back = normalizeNode({ ...post, parameters: { ...post.parameters, method: 'HEAD' } });
  assert.equal(back.toolOperation?.action, 'request.read');
  let draft = newDraft(NOW, manifestsAll);
  draft = ok(addNode(draft, m, 'inicio')).draft;
  const id = draft.workflow.nodes[1]!.id;
  draft = ok(updateNode(draft, id, { parameters: { endpoint: 'clima', method: 'POST', path: '/x' } })).draft;
  assert.equal(draft.workflow.nodes[1]!.requiresApproval, true);
  assert.deepEqual(validateAutomationWorkflow(draft.workflow).errors, []);
});

test('updateNode no cambia el id, el tipo ni el kind (otros nodos los referencian)', () => {
  let draft = newDraft(NOW, manifestsAll);
  draft = ok(addNode(draft, manifest('transform.set'))).draft;
  const id = draft.workflow.nodes[1]!.id;
  const edited = ok(updateNode(draft, id, { id: 'otro', type: 'code.js', kind: 'code', label: 'Nuevo nombre' } as never)).draft;
  const node = edited.workflow.nodes[1]!;
  assert.equal(node.id, id);
  assert.equal(node.type, 'transform.set');
  assert.equal(node.kind, 'transform');
  assert.equal(node.label, 'Nuevo nombre');
  assert.equal(updateNode(draft, 'no-existe', { label: 'x' }).ok, false);
});

test('conexiones: sin autoconexión, sin duplicados, sin ciclos y sin entradas a un disparador; la rama de error no cuenta como ciclo', () => {
  let draft = newDraft(NOW, manifestsAll);
  draft = ok(addNode(draft, manifest('transform.set'), 'inicio')).draft;
  draft = ok(addNode(draft, manifest('transform.template'), 'inicio')).draft;
  const [inicio, a, b] = draft.workflow.nodes.map((n) => n.id) as [string, string, string];
  draft = ok(connect(draft, inicio, a)).draft;
  draft = ok(connect(draft, a, b)).draft;
  assert.match((connect(draft, a, a) as { error: string }).error, /consigo mismo/);
  assert.match((connect(draft, a, b) as { error: string }).error, /ya existe/);
  assert.match((connect(draft, b, a) as { error: string }).error, /ciclo/);
  assert.match((connect(draft, a, inicio) as { error: string }).error, /disparador/);
  assert.match((connect(draft, 'x', a) as { error: string }).error, /ya no existe/);
  assert.equal(connect(draft, b, a, 'error').ok, true, 'una rama de error de vuelta no es un ciclo del grafo principal');
  const less = disconnect(draft, a, b);
  assert.equal(less.workflow.connections.length, 1);
  assert.equal(draft.workflow.connections.length, 2, 'no muta el borrador original');
});

test('quitar un nodo quita sus conexiones y su posición; duplicar da un ID nuevo y un hueco libre', () => {
  let draft = draftFromTemplate(FLOW_TEMPLATES.find((t) => t.id === 'alerta-dron')!);
  const before = draft.workflow.connections.length;
  draft = ok(removeNode(draft, 'veredicto')).draft;
  assert.ok(draft.workflow.connections.every((c) => c.from !== 'veredicto' && c.to !== 'veredicto'));
  assert.ok(draft.workflow.connections.length < before);
  assert.equal('veredicto' in draft.layout, false);
  const copy = ok(duplicateNode(draft, 'clima'));
  assert.notEqual(copy.id, 'clima');
  assert.match(copy.draft.workflow.nodes.find((n) => n.id === copy.id)!.label, /\(copia\)/);
  const a = copy.draft.layout.clima!;
  const b = copy.draft.layout[copy.id!]!;
  assert.ok(Math.abs(a.x - b.x) >= NODE_W || Math.abs(a.y - b.y) >= NODE_H);
});

test('niveles y disposición: la plantilla del briefing se ordena por oleadas y ningún nodo se solapa', () => {
  const template = FLOW_TEMPLATES.find((t) => t.id === 'briefing-matinal')!;
  const wf = template.build();
  const levels = levelsOf(wf);
  assert.equal(levels.get('inicio'), 0);
  assert.equal(levels.get('clima'), 1);
  assert.equal(levels.get('agenda'), 1);
  assert.equal(levels.get('resumen'), 2);
  assert.equal(levels.get('salida'), 3);
  const layout = autoLayout(wf, {});
  const spots = Object.values(layout);
  assert.equal(spots.length, wf.nodes.length);
  for (let i = 0; i < spots.length; i += 1) for (let j = i + 1; j < spots.length; j += 1) {
    const a = spots[i]!; const b = spots[j]!;
    assert.ok(Math.abs(a.x - b.x) >= NODE_W || Math.abs(a.y - b.y) >= NODE_H, 'nodos solapados');
  }
  const kept = autoLayout(wf, { clima: { x: 999, y: 777 } });
  assert.deepEqual(kept.clima, { x: 999, y: 777 }, 'respeta la posición que ya tenía el usuario');
  assert.deepEqual(moveNode(draftFromTemplate(template), 'clima', { x: 1e9, y: Number.NaN }).layout.clima, { x: 20000, y: 0 }, 'las posiciones se acotan');
});

test('orden previsto: oleadas, pausas por aprobación y espera, y nodos desactivados', () => {
  let draft = newDraft(NOW, manifestsAll);
  draft = ok(addNode(draft, manifest('approval.request'), 'inicio')).draft;
  draft = ok(addNode(draft, manifest('wait.delay'), 'inicio')).draft;
  draft = ok(addNode(draft, manifest('transform.set'), 'inicio')).draft;
  const [inicio, aprob, espera, datos] = draft.workflow.nodes.map((n) => n.id) as [string, string, string, string];
  draft = ok(connect(draft, inicio, aprob)).draft;
  draft = ok(connect(draft, aprob, espera)).draft;
  draft = ok(connect(draft, espera, datos)).draft;
  draft = ok(updateNode(draft, datos, { disabled: true })).draft;
  const plan = executionPlan(draft.workflow);
  assert.deepEqual(plan.levels, [[inicio], [aprob], [espera]]);
  assert.deepEqual(plan.pauses, [{ nodeId: aprob, reason: 'aprobacion' }, { nodeId: espera, reason: 'espera' }]);
  assert.deepEqual(plan.disabled, [datos]);
});

test('problemas: sin disparador, ramas inexistentes, error sin política y nodos sueltos se explican en español', () => {
  const registry = registryFor(ALL);
  let draft = draftFromTemplate(FLOW_TEMPLATES.find((t) => t.id === 'correo-triaje')!);
  draft = ok(removeNode(draft, 'inicio')).draft;
  const texts = analyzeDraft(draft, registry).map((p) => p.text);
  assert.ok(texts.some((t) => /Falta un disparador activo/.test(t)));
  assert.ok(texts.some((t) => /No está conectado a ningún disparador/.test(t)));

  let d2 = draftFromTemplate(FLOW_TEMPLATES.find((t) => t.id === 'correo-triaje')!);
  d2 = ok(connect(d2, 'decidir', 'resumen', 'rama_que_no_existe')).draft;
  assert.equal(connect(d2, 'decidir', 'resumen', 'rama_que_no_existe').ok, false, 'la conexión repetida se rechaza');
  d2 = ok(connect(d2, 'correo', 'resumen', 'error')).draft;
  d2 = ok(connect(d2, 'correo', 'resumen', 'rama_x')).draft;
  const t2 = analyzeDraft(d2, registry).map((p) => p.text);
  assert.ok(t2.some((t) => /solo se usa si el nodo tiene/.test(t)));
  assert.ok(t2.some((t) => /no tiene ramas|no existe en este nodo/.test(t)));
});

test('parámetros que harían fallar al motor se señalan antes de ejecutar', () => {
  const registry = registryFor(ALL);
  const cases: Array<[string, string]> = [
    ['action.tool', 'conector y la acción'], ['http.request', 'endpoint'], ['subflow.run', 'ID del flujo'], ['ai.complete', 'instrucción'],
    ['code.js', 'vacío'], ['ai.agent', 'objetivo del agente'],
  ];
  for (const [type, expected] of cases) {
    let draft = newDraft(NOW, manifestsAll);
    const added = ok(addNode(draft, manifest(type), 'inicio'));
    draft = ok(connect(added.draft, 'inicio', added.id!)).draft;
    if (type === 'code.js') draft = ok(updateNode(draft, added.id!, { parameters: { source: '  ' } })).draft;
    const problems = analyzeDraft(draft, registry).filter((p) => p.nodeId === added.id).map((p) => p.text).join(' | ');
    assert.match(problems, new RegExp(expected), type);
  }
  const sw = createNode(manifest('ai.classify'), 'c');
  assert.deepEqual(branchOutputs(sw), ['si', 'no']);
  assert.deepEqual(branchOutputs(createNode(manifest('logic.switch'), 's')), ['opcion_a', 'opcion_b', 'otro']);
  assert.deepEqual(branchOutputs(createNode(manifest('logic.if'), 'i')), ['true', 'false']);
  assert.deepEqual(branchOutputs(createNode(manifest('transform.set'), 't')), []);
});

test('seguridad: una clave pegada a mano bloquea el error y la exportación; las referencias y los números no', () => {
  const registry = registryFor(ALL);
  let draft = newDraft(NOW, manifestsAll);
  const added = ok(addNode(draft, manifest('http.request'), 'inicio'));
  draft = ok(connect(added.draft, 'inicio', added.id!)).draft;
  draft = ok(updateNode(draft, added.id!, { parameters: { endpoint: 'clima', method: 'GET', path: '/', headers: { authorization: 'Bearer abcdefghijklmnop1234567890' }, apiKey: 'abc12345' } })).draft;
  const sec = analyzeDraft(draft, registry).filter((p) => p.kind === 'seguridad');
  assert.equal(sec.length, 2);
  assert.ok(sec.every((p) => p.level === 'error' && !p.text.includes('abcdefghijklmnop') && !p.text.includes('abc12345')), 'el aviso nunca repite el valor');
  assert.equal(exportBlockers(draft).length, 2);

  draft = ok(updateNode(draft, added.id!, { parameters: { endpoint: 'clima', method: 'GET', path: '/', apiKey: 'vault:google/clave', token: '{{ $vars.token }}', maxTokens: 500 } })).draft;
  assert.deepEqual(exportBlockers(draft), []);
  assert.equal(analyzeDraft(draft, registry).filter((p) => p.kind === 'seguridad').length, 0);
});

test('exportar e importar: ida y vuelta exacta, entra siempre como borrador y lo defectuoso se rechaza o se acota', () => {
  const draft = draftFromTemplate(FLOW_TEMPLATES.find((t) => t.id === 'alerta-dron')!);
  const text = serializeDraft(renameFlow(draft, '  Mi   flujo  '));
  const back = ok(parseDraft(text)).draft;
  assert.equal(back.workflow.name, 'Mi flujo');
  assert.deepEqual(back.workflow.nodes, draft.workflow.nodes);
  assert.deepEqual(back.workflow.connections, draft.workflow.connections);
  assert.deepEqual(back.layout, draft.layout);

  const published = JSON.parse(text);
  published.workflow.status = 'published';
  assert.equal(ok(parseDraft(JSON.stringify(published))).draft.workflow.status, 'draft');

  const loose = ok(parseDraft(JSON.stringify(draft.workflow))).draft; // un AutomationWorkflow suelto
  assert.equal(loose.workflow.nodes.length, draft.workflow.nodes.length);

  const bad = (patch: (v: any) => void): string => { const v = JSON.parse(text); patch(v); return (parseDraft(JSON.stringify(v)) as { error: string }).error; };
  assert.match(bad((v) => { v.workflow.schemaVersion = 9; }), /esquema/);
  assert.match(bad((v) => { v.workflow.nodes[0].kind = 'raro'; }), /tipo de nodo/);
  assert.match(bad((v) => { v.workflow.nodes[0].parameters = 'x'; }), /parameters/);
  assert.match(bad((v) => { v.workflow.connections = [{ from: 1 }]; }), /mal formada/);
  assert.match(bad((v) => { v.workflow.nodes[0].toolOperation = { tool: 1 }; }), /toolOperation/);
  assert.match((parseDraft('{no es json') as { error: string }).error, /JSON/);
  assert.match((parseDraft('{"format":"janus-flow-draft","workflow":{"__proto__":{"x":1}}}') as { error: string }).error, /claves no permitidas/);
  assert.match((parseDraft('x'.repeat(600 * 1024)) as { error: string }).error, /demasiado grande/);
  assert.match((parseDraft('[]') as { error: string }).error, /forma de borrador/);

  const withLayout = JSON.parse(text);
  withLayout.layout = { ...withLayout.layout, fantasma: { x: 1, y: 1 }, clima: { x: 1e12, y: -1e12 } };
  const clamped = ok(parseDraft(JSON.stringify(withLayout))).draft;
  assert.equal('fantasma' in clamped.layout, false);
  assert.deepEqual(clamped.layout.clima, { x: 20000, y: -5000 });
});

test('identificadores: slug sin acentos, siempre único y válido', () => {
  assert.equal(slug('Clasificar el lote'), 'clasificar_el_lote');
  assert.equal(slug('Ñandú 3'), 'nandu_3');
  assert.match(slug('123 abc'), /^n_/);
  assert.equal(uniqueId('ai.summarize', ['ai.summarize']), 'ai_summarize');
  assert.equal(uniqueId('ai_summarize', ['ai_summarize', 'ai_summarize_2']), 'ai_summarize_3');
  assert.equal(slug('   '), 'nodo');
});

test('el modelo no usa DOM, reloj ni azar, y las plantillas no llevan datos personales', () => {
  const src = readFileSync('apps/flow-editor/src/model.ts', 'utf8');
  for (const forbidden of ['document.', 'window.', 'localStorage', 'Date.now', 'new Date(', 'Math.random', 'fetch(']) assert.equal(src.includes(forbidden), false, forbidden);
  assert.ok(knownToolActions().some((x) => x.tool === 'google-workspace' && x.action === 'calendar.events.list'));
  assert.equal(renameFlow(newDraft(NOW, manifestsAll), '').workflow.name, 'Flujo sin nombre');
});

test('los ajustes del flujo respetan límites y no tocan el borrador original', () => {
  const draft = newDraft(NOW, manifestsAll);
  const changed = ok(updateFlowSettings(draft, { id: 'mi-flujo_2', maxConcurrency: 3, executionTimeoutMs: 30_000, tags: [' casa ', 'casa', 'agenda'] }));
  assert.equal(changed.draft.workflow.id, 'mi-flujo_2');
  assert.equal(changed.draft.workflow.maxConcurrency, 3);
  assert.equal(changed.draft.workflow.executionTimeoutMs, 30_000);
  assert.deepEqual(changed.draft.workflow.tags, ['casa', 'agenda']);
  assert.equal(draft.workflow.id, 'flujo-nuevo', 'el original no cambia');
  assert.equal(ok(updateFlowSettings(changed.draft, { executionTimeoutMs: null })).draft.workflow.executionTimeoutMs, undefined);
  for (const bad of [{ id: 'Mayúsculas' }, { id: '-x' }, { id: 'x'.repeat(65) }, { maxConcurrency: 0 }, { maxConcurrency: 2.5 }, { maxConcurrency: 21 }, { executionTimeoutMs: 10 }, { executionTimeoutMs: 4_000_000 }, { tags: Array.from({ length: 13 }, (_, i) => `t${i}`) }, { tags: ['x'.repeat(33)] }]) {
    assert.equal(updateFlowSettings(draft, bad).ok, false, JSON.stringify(bad).slice(0, 40));
  }
});

test('la disposición vertical pone los pasos en filas, sin solapar nodos, y conserva las posiciones existentes', () => {
  const template = FLOW_TEMPLATES.find((tpl) => tpl.id === 'briefing-matinal')!;
  const v = draftFromTemplate(template, 'v');
  const h = draftFromTemplate(template, 'h');
  const levels = levelsOf(v.workflow);
  for (const node of v.workflow.nodes) {
    const lvl = levels.get(node.id)!;
    assert.equal(v.layout[node.id]!.y, 40 + lvl * (NODE_H + 56), node.id);
    assert.equal(h.layout[node.id]!.x, 40 + lvl * (NODE_W + 88), node.id);
  }
  const boxes = Object.values(v.layout);
  for (let i = 0; i < boxes.length; i += 1) for (let j = i + 1; j < boxes.length; j += 1) {
    assert.ok(Math.abs(boxes[i]!.x - boxes[j]!.x) >= NODE_W || Math.abs(boxes[i]!.y - boxes[j]!.y) >= NODE_H, 'sin solapes');
  }
  const first = v.workflow.nodes[0]!.id;
  assert.deepEqual(autoLayout(v.workflow, { [first]: { x: 900, y: 900 } }, 'v')[first], { x: 900, y: 900 });
  // Un nodo añadido junto a otro cae debajo en vertical y a su derecha en horizontal.
  const base = newDraft(NOW, manifestsAll);
  const below = ok(addNode(base, manifest('transform.set'), 'inicio', 'v')).draft;
  const nextTo = ok(addNode(base, manifest('transform.set'), 'inicio', 'h')).draft;
  const idBelow = below.workflow.nodes[1]!.id, idNext = nextTo.workflow.nodes[1]!.id;
  assert.ok(below.layout[idBelow]!.y > base.layout.inicio!.y);
  assert.ok(nextTo.layout[idNext]!.x > base.layout.inicio!.x);
});

test('vaciar un campo opcional quita la propiedad (no deja «undefined» en el borrador)', () => {
  const draft = newDraft(NOW, manifestsAll);
  const added = ok(addNode(draft, manifest('http.request'), 'inicio'));
  const id = added.id!;
  const withTimeout = ok(updateNode(added.draft, id, { timeoutMs: 1000, credentialRefs: ['ref:x'] }));
  const cleared = ok(updateNode(withTimeout.draft, id, { timeoutMs: undefined, credentialRefs: undefined })).draft.workflow.nodes.find((n) => n.id === id)!;
  assert.equal('timeoutMs' in cleared, false);
  assert.equal('credentialRefs' in cleared, false);
});
