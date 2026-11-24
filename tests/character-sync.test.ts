import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const source = (p: string) => readFileSync(p, 'utf8');
const hex = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');

type Entry = { slot: string; sha256: string; tier: string; review: string };
function setup(opts: { headers?: Record<string, string>; kidList?: Entry[]; founderList?: Array<{ slot: string; active?: Entry; servable?: Entry }>; files?: Map<string, Uint8Array>; offline?: boolean }) {
  const store = new Map<string, string>();
  const loaded = new Map<string, { size: number; name: string; sha256: string }>();
  const removed: string[] = [];
  const events: string[] = [];
  const calls: string[] = [];
  const g = globalThis as any;
  g.window = Object.assign(new EventTarget(), {
    JanusCreatureSlot: {
      supported: () => true,
      has: (id: string) => loaded.has(id),
      info: (id: string) => loaded.get(id),
      load: async (id: string, buf: ArrayBuffer, o: { name: string }) => { loaded.set(id, { size: buf.byteLength, name: o.name, sha256: hex(new Uint8Array(buf)) }); return { level: 'avisos', summary: 'ok' }; },
      remove: (id: string) => { removed.push(id); return loaded.delete(id); },
    },
  });
  g.window.dispatchEvent = (e: Event) => { events.push(e.type); return true; };
  g.document = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } };
  g.CustomEvent = class { type: string; constructor(type: string) { this.type = type; } };
  g.fetch = async (url: string, init: { headers?: Record<string, string> } = {}) => {
    calls.push(url);
    if (opts.offline) throw new TypeError('offline');
    assert.ok(init.headers?.authorization, 'toda petición lleva autenticación');
    if (url === '/api/kid/characters') return Response.json({ ok: true, characters: opts.kidList ?? [] });
    if (url === '/api/characters') return Response.json({ ok: true, characters: opts.founderList ?? [] });
    const file = /\/([a-z-]+)\/([a-f0-9]{64})\.glb$/.exec(url);
    const bytes = file ? opts.files?.get(file[2]!) : undefined;
    return bytes ? new Response(bytes as unknown as BodyInit) : new Response('no', { status: 404 });
  };
  return { store, loaded, removed, events, calls };
}
async function loadModule() {
  return await import('../apps/pwa/character-sync.js?' + Math.random());
}
const model = (tag: string) => new TextEncoder().encode('GLB-de-prueba-' + tag + '-'.repeat(40));

test('Founder: recibe la versión activa pendiente y la marca como pendiente de revisión', async () => {
  const bytes = model('janus'); const sha = hex(bytes);
  const env = setup({ files: new Map([[sha, bytes]]), founderList: [{ slot: 'nexo-masculino', active: { slot: 'nexo-masculino', sha256: sha, tier: 'partial', review: 'pending_visual_review' } }] });
  const { configureCharacterSync, syncCharacters, characterMeta } = await loadModule();
  configureCharacterSync({ audience: 'founder', headers: () => ({ authorization: 'Bearer f' }) });
  const result = await syncCharacters();
  assert.equal(result.loaded, 1);
  assert.deepEqual(env.loaded.get('nexo-masculino')?.name, 'nexo-masculino-' + sha.slice(0, 8) + '.glb');
  assert.equal(characterMeta('nexo-masculino').review, 'pending_visual_review');
  assert.ok(env.events.includes('janus:characters-changed'));
  // Segunda pasada: misma huella → no vuelve a descargar.
  const before = env.calls.length;
  await syncCharacters();
  assert.equal(env.calls.filter((c) => c.endsWith('.glb')).length, 1);
  assert.equal(env.calls.length, before + 1, 'solo consulta la lista');
});

test('Kendra: solo lo aprobado; verifica la huella; retira lo que deja de estar aprobado; offline conserva', async () => {
  const good = model('lumi'); const goodSha = hex(good);
  const tampered = model('bombo'); const claimed = hex(model('otro-bombo'));
  const files = new Map<string, Uint8Array>([[goodSha, good], [claimed, tampered]]);
  const env = setup({ files, kidList: [
    { slot: 'lumi', sha256: goodSha, tier: 'partial', review: 'approved' },
    { slot: 'bombo', sha256: claimed, tier: 'partial', review: 'approved' },
  ] });
  const { configureCharacterSync, syncCharacters, characterMeta } = await loadModule();
  configureCharacterSync({ audience: 'kid', headers: () => ({ authorization: 'Bearer kdv_x' }) });
  const first = await syncCharacters();
  assert.equal(first.loaded, 1);
  assert.ok(first.errors.some((e: string) => /bombo: la huella no coincide/.test(e)), 'bytes alterados nunca se cargan');
  assert.ok(env.loaded.has('lumi') && !env.loaded.has('bombo'));
  assert.equal(characterMeta('lumi').review, 'approved');
  assert.equal(characterMeta('bombo'), null);

  // Sin conexión: se conserva lo instalado.
  (globalThis as any).fetch = async () => { throw new TypeError('offline'); };
  const cached = await syncCharacters();
  assert.equal(cached.skipped, 'sin-conexion');
  assert.ok(env.loaded.has('lumi'), 'offline no borra nada');
});

test('Kendra: si el Founder retira la aprobación, el modelo se quita de la tablet', async () => {
  const bytes = model('musgo'); const sha = hex(bytes);
  const env = setup({ files: new Map([[sha, bytes]]), kidList: [{ slot: 'musgo', sha256: sha, tier: 'partial', review: 'approved' }] });
  const { configureCharacterSync, syncCharacters, characterMeta } = await loadModule();
  configureCharacterSync({ audience: 'kid', headers: () => ({ authorization: 'Bearer kdv_x' }) });
  await syncCharacters();
  assert.ok(env.loaded.has('musgo'));
  (globalThis as any).fetch = async (url: string) => Response.json({ ok: true, characters: [] });
  const result = await syncCharacters();
  assert.equal(result.removed, 1);
  assert.deepEqual(env.removed, ['musgo']);
  assert.equal(characterMeta('musgo'), null);
});

test('sin sesión no se hace ninguna petición', async () => {
  const env = setup({});
  const { configureCharacterSync, syncCharacters } = await loadModule();
  configureCharacterSync({ audience: 'founder', headers: () => ({}) });
  const result = await syncCharacters();
  assert.equal(result.skipped, 'sin-acceso');
  assert.equal(env.calls.length, 0);
});

test('cableado PWA: Founder y Kendra sincronizan; el aviso solo se quita con modelo aprobado; el cache se renueva', () => {
  assert.match(source('apps/pwa/app.js'), /configureCharacterSync\(\{ audience: 'founder', headers: authHeaders \}\)/);
  assert.match(source('apps/pwa/app.js'), /createCharacterLibraryPanel\(\{ openStage: openApprovedStageDialog \}\)/);
  assert.match(source('apps/pwa/dashboard-access.js'), /configureCharacterSync\(\{ audience: 'founder'/);
  assert.match(source('apps/pwa/kendra.js'), /configureCharacterSync\(\{ audience: 'kid'/);
  const presence = source('apps/pwa/approved-presence.js');
  assert.doesNotMatch(presence, /fetch\(/, 'la red vive solo en character-sync.js');
  assert.match(presence, /JanusCharacterSync\?\.meta\?\.\(id\)\?\.review === 'approved'/);
  assert.match(presence, /3D · revisión visual pendiente/);
  const sw = source('apps/pwa/sw.js');
  assert.match(sw, /'\/character-sync\.js'/);
  assert.match(sw, /janus-shell-v32/);
  assert.doesNotMatch(source('apps/pwa/character-sync.js'), /innerHTML|eval\(|new Function/);
});


test('Kendra: una importación local no hereda la aprobación del slot', async () => {
  const bytes = model('original'); const sha = hex(bytes);
  const env = setup({ files: new Map([[sha, bytes]]), kidList: [{ slot: 'lumi', sha256: sha, tier: 'partial', review: 'approved' }] });
  const { configureCharacterSync, syncCharacters, canDisplayApproved } = await loadModule();
  configureCharacterSync({ audience: 'kid', headers: () => ({ authorization: 'Bearer kdv_x' }) });
  await syncCharacters();
  assert.equal(canDisplayApproved('lumi'), true);
  env.loaded.set('lumi', { size: 10, name: 'otro.glb', sha256: hex(model('otro')) });
  assert.equal(canDisplayApproved('lumi'), false);
  await syncCharacters();
  assert.equal(canDisplayApproved('lumi'), true);
  (globalThis as any).fetch = async () => Response.json({ok:false}, {status:403});
  await syncCharacters();
  assert.equal(canDisplayApproved('lumi'), false);
});
