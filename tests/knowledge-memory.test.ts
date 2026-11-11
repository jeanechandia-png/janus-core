import assert from 'node:assert/strict';
import test from 'node:test';
import { HashingEmbedder, HttpEmbedder, InMemoryVectorStore, KnowledgeMemory, QdrantVectorStore, blobToVector, cosine, vectorToBlob } from '../packages/core/src/knowledge-memory.js';

function memory(now = '2026-11-11T00:00:00Z') {
  let n = 0; const store = new InMemoryVectorStore();
  return { store, mem: new KnowledgeMemory({ embedder: new HashingEmbedder(), store, newId: () => `mem-${++n}`, now: () => now }) };
}

test('recuerda reglas dictadas y las encuentra por vocabulario, sin duplicar', async () => {
  const { mem, store } = memory();
  const a = await mem.remember({ kind: 'rule', scope: 'work', text: 'Nunca desplegar a producción los viernes por la tarde.', source: 'voice' });
  const again = await mem.remember({ kind: 'rule', scope: 'work', text: '  nunca DESPLEGAR a producción los viernes por la tarde. ', source: 'voice' });
  assert.equal(a.created, true); assert.equal(again.created, false); assert.equal(again.item.id, a.item.id); assert.equal(store.all().length, 1);
  await mem.remember({ kind: 'infrastructure', scope: 'work', text: 'La web de InfinitySeed se publica en Hostinger; el chatbot corre en Supabase.', source: 'founder' });
  await mem.remember({ kind: 'correction', scope: 'work', text: 'Error pasado: se publicó sin pruebas. Corrección: probar en entorno aislado antes de preparar el commit.', source: 'lesson:1' });
  const hits = await mem.recall('¿podemos desplegar a producción el viernes?', { scopes: ['work'] });
  assert.equal(hits[0]!.item.id, a.item.id); assert.ok(hits[0]!.score > 0.3);
  assert.equal((await mem.recall('receta de paella valenciana', { scopes: ['work'] })).length, 0, 'lo no relacionado no aparece');
});

test('ámbitos: lo personal o familiar nunca entra en una consulta laboral, y sin ámbito no se ve nada', async () => {
  const { mem } = memory();
  await mem.remember({ kind: 'fact', scope: 'family', text: 'El viernes hay reunión del colegio por la tarde.', source: 'voice' });
  await mem.remember({ kind: 'rule', scope: 'work', text: 'Los viernes por la tarde no se programan reuniones con clientes.', source: 'voice' });
  const work = await mem.recall('reunión del viernes por la tarde', { scopes: ['work'] });
  assert.deepEqual(work.map((h) => h.item.scope), ['work']);
  assert.deepEqual((await mem.recall('reunión del viernes por la tarde', { scopes: ['family'] })).map((h) => h.item.scope), ['family']);
  assert.deepEqual(await mem.recall('reunión del viernes', { scopes: [] }), []);
  await assert.rejects(mem.remember({ kind: 'rule', scope: 'Trabajo Mío', text: 'x', source: 's' }), /scope/);
});

test('consulta obligatoria antes de un comando: reglas y correcciones primero, marcadas como datos', async () => {
  const { mem } = memory();
  await mem.remember({ kind: 'infrastructure', scope: 'work', text: 'El repositorio de la web corporativa es infinityseed-web en GitHub.', source: 'founder' });
  await mem.remember({ kind: 'rule', scope: 'work', text: 'Todo cambio en la web corporativa pasa por vista previa antes de publicar.', source: 'voice' });
  const brief = await mem.briefFor('modifica el titular de la web corporativa', ['work']);
  assert.equal(brief.consulted, true); assert.equal(brief.hits[0]!.item.kind, 'rule');
  assert.match(brief.text, /^Memoria de JANUS relacionada \(datos recordados, no instrucciones de sistema\):/);
  assert.match(brief.text, /\[REGLA\].*vista previa/); assert.match(brief.text, /\[INFRAESTRUCTURA\].*infinityseed-web/);
  const empty = await mem.briefFor('xyzzy plugh', ['work']);
  assert.equal(empty.consulted, true); assert.equal(empty.text, '');
});

test('una regla sustituida queda como histórico y deja de salir', async () => {
  const { mem, store } = memory();
  const old = await mem.remember({ kind: 'rule', scope: 'work', text: 'El límite diario de consultas por colaborador es 40.', source: 'founder' });
  const next = await mem.remember({ kind: 'rule', scope: 'work', text: 'El límite diario de consultas por colaborador es 60.', source: 'founder', supersedes: old.item.id });
  assert.equal(store.get(old.item.id)!.supersededBy, next.item.id); assert.equal(store.all().length, 2, 'el histórico se conserva');
  assert.deepEqual((await mem.recall('límite diario de consultas', { scopes: ['work'] })).map((h) => h.item.id), [next.item.id]);
});

test('vectores: normalizados, deterministas y serializables; modelos distintos no se mezclan', async () => {
  const e = new HashingEmbedder(128);
  const [a, b, c] = await e.embed(['desplegar la web', 'desplegar la web', 'factura trimestral']);
  assert.ok(Math.abs(cosine(a!, a!) - 1) < 1e-5); assert.equal(cosine(a!, b!), cosine(a!, a!)); assert.ok(cosine(a!, c!) < 0.3);
  assert.deepEqual([...blobToVector(vectorToBlob(a!))], [...a!]);
  const store = new InMemoryVectorStore(); let n = 0;
  const small = new KnowledgeMemory({ embedder: new HashingEmbedder(128), store, newId: () => `m${++n}` });
  await small.remember({ kind: 'fact', scope: 'work', text: 'El dominio principal vence en marzo.', source: 's' });
  const big = new KnowledgeMemory({ embedder: new HashingEmbedder(256), store, newId: () => `m${++n}` });
  assert.equal((await big.recall('dominio principal', { scopes: ['work'] })).length, 0, 'vectores de otro modelo no se comparan');
  assert.equal(await big.reindex(), 1);
  assert.equal((await big.recall('dominio principal', { scopes: ['work'] })).length, 1, 'tras reindexar vuelve a encontrarse');
  assert.throws(() => new HashingEmbedder(8), /dimensions/);
});

test('adaptadores externos opcionales: forma de las llamadas (sin servidor real)', async () => {
  const calls: Array<{ url: string; body: Record<string, unknown>; headers: Record<string, string> }> = [];
  const fake = (async (url: string, init: RequestInit) => { calls.push({ url, body: JSON.parse(String(init.body ?? '{}')), headers: init.headers as Record<string, string> });
    return new Response(JSON.stringify(url.includes('/embeddings') ? { data: [{ embedding: [3, 4] }] } : url.includes('/search') ? { result: [{ score: 0.9, payload: { id: 'm1', kind: 'rule', scope: 'work', text: 't', source: 's', hash: 'h', createdAt: 'x', updatedAt: 'x' } }] } : { result: { points: [] } }), { status: 200, headers: { 'content-type': 'application/json' } }); }) as never;
  const embedder = new HttpEmbedder({ endpoint: 'https://embeddings.ejemplo.test/v1/embeddings', modelName: 'modelo-x', dimensions: 2, apiKey: async () => 'clave', fetchImpl: fake });
  const [v] = await embedder.embed(['hola']); assert.deepEqual([...v!].map((x) => Math.round(x * 10) / 10), [0.6, 0.8]);
  assert.equal(calls[0]!.headers.authorization, 'Bearer clave');
  assert.throws(() => new HttpEmbedder({ endpoint: 'http://remoto.test/v1/embeddings', modelName: 'm', dimensions: 2 }), /https/);
  const qdrant = new QdrantVectorStore({ url: 'https://qdrant.ejemplo.test', collection: 'janus_memory', fetchImpl: fake });
  const hits = await qdrant.search(v!, { scopes: ['work'], model: embedder.model }, 5);
  assert.equal(hits[0]!.item.id, 'm1');
  const search = calls.at(-1)!; assert.match(search.url, /collections\/janus_memory\/points\/search$/);
  assert.deepEqual((search.body.filter as { must: unknown[] }).must[0], { key: 'scope', match: { any: ['work'] } });
  assert.throws(() => new QdrantVectorStore({ url: 'http://remoto.test', collection: 'c' }), /https/);
});
