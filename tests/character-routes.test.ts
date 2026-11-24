import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { createServer } from 'node:net';
import test from 'node:test';
import { doc, glb, sha } from './helpers/glb-fixture.js';

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => resolve()); });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const port = address.port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitHealthy(base: string): Promise<void> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${base}/health`)).ok) return; } catch { /* arrancando */ }
    await delay(100);
  }
  throw new Error('el servidor no arrancó');
}

test('biblioteca de personajes: el Founder sube y aprueba; Kendra solo recibe lo aprobado', async (t) => {
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const keys = generateKeyPairSync('ec', { namedCurve: 'prime256v1', publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
  const child = spawn(process.execPath, ['--import', 'tsx', 'apps/runtime/server.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env, PORT: String(port), JANUS_DB: ':memory:', JANUS_TIME_ZONE: 'Europe/Amsterdam',
      JANUS_CREDENTIAL_VAULT_KEY: randomBytes(32).toString('base64'), JANUS_CREDENTIAL_VAULT_PATH: '',
      JANUS_FOUNDER_PUBLIC_KEY_PEM: keys.publicKey, JANUS_KID_WEATHER: 'off', JANUS_MODEL_BASE_URL: '', JANUS_MODEL_NAME: '',
      JANUS_CHARACTERS_DIR: '', GITHUB_TOKEN: '', NETLIFY_AUTH_TOKEN: '', GOOGLE_ACCESS_TOKEN: '',
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '';
  child.stderr!.on('data', (chunk) => { stderr += chunk.toString(); });
  t.after(() => { child.kill('SIGKILL'); });

  try {
    await waitHealthy(base);
    const challenge = await (await fetch(`${base}/api/auth/challenge`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ principalId: 'founder' }) })).json() as { challenge: { id: string; signingPayload: string } };
    const signature = sign('sha256', Buffer.from(challenge.challenge.signingPayload, 'utf8'), keys.privateKey).toString('base64url');
    const verified = await (await fetch(`${base}/api/auth/verify`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ challengeId: challenge.challenge.id, principalId: 'founder', signature }) })).json() as { session: { token: string } };
    const founder = { authorization: `Bearer ${verified.session.token}` };

    const call = async (method: string, path: string, headers: Record<string, string> = {}, body?: unknown, raw?: Uint8Array) => {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers },
        ...(body !== undefined ? { body: JSON.stringify(body) } : raw ? { body: raw as unknown as BodyInit } : {}),
      });
      const type = response.headers.get('content-type') ?? '';
      return { status: response.status, type, body: (type.includes('json') ? await response.json() : Buffer.from(await response.arrayBuffer())) as any };
    };

    // Sin sesión de Founder: nada de lista, subida ni lectura.
    assert.ok([401, 403].includes((await call('GET', '/api/characters')).status));
    assert.ok([401, 403].includes((await call('PUT', '/api/characters/lumi', {}, undefined, glb(doc('sin-sesion')))).status));

    // Emparejar el dispositivo de Kendra.
    const pairing = await call('POST', '/api/parent/kid/pairing', founder, { kidId: 'kendra' });
    const redeemed = await call('POST', '/api/kid/redeem', {}, { code: pairing.body.code, label: 'Tablet de Kendra' });
    const kid = { authorization: `Bearer ${redeemed.body.token}` };
    assert.equal((await call('GET', '/api/kid/characters')).status, 401);
    assert.ok([401, 403].includes((await call('PUT', '/api/characters/lumi', kid, undefined, glb(doc('kid')))).status), 'el token de la niña no es autoridad');

    // Subida: slot ajeno, GLB roto y GLB real.
    assert.equal((await call('PUT', '/api/characters/robot', founder, undefined, glb(doc('x')))).status, 404);
    const broken = await call('PUT', '/api/characters/nexo-masculino', founder, undefined, Buffer.from('esto no es un modelo 3D, es texto'));
    assert.equal(broken.status, 422);
    const bytes = glb(doc('janus-rodin'));
    const hash = sha(bytes);
    const uploaded = await call('PUT', '/api/characters/nexo-masculino', { ...founder, 'x-character-origin': 'hyper3d-rodin', 'content-type': 'model/gltf-binary' }, undefined, bytes);
    assert.equal(uploaded.status, 201, JSON.stringify(uploaded.body));
    assert.equal(uploaded.body.character.sha256, hash);
    assert.equal(uploaded.body.character.tier, 'partial');
    assert.equal(uploaded.body.character.review, 'pending_visual_review');
    const again = await call('PUT', '/api/characters/nexo-masculino', { ...founder, 'x-character-origin': 'hyper3d-rodin' }, undefined, bytes);
    assert.equal(again.status, 200);
    assert.equal(again.body.duplicate, true);

    // El Founder ve su versión pendiente y puede descargarla; Kendra todavía no ve nada.
    const listing = await call('GET', '/api/characters', founder);
    assert.equal(listing.status, 200);
    const janus = (listing.body.characters as Array<Record<string, any>>).find((item) => item.slot === 'nexo-masculino')!;
    assert.equal(janus.active.sha256, hash);
    assert.equal(janus.servable, undefined);
    const download = await call('GET', `/api/characters/nexo-masculino/${hash}.glb`, founder);
    assert.equal(download.status, 200);
    assert.equal(download.type, 'model/gltf-binary');
    assert.deepEqual(download.body, Buffer.from(bytes));
    assert.deepEqual((await call('GET', '/api/kid/characters', kid)).body.characters, []);
    assert.equal((await call('GET', `/api/kid/characters/nexo-masculino/${hash}.glb`, kid)).status, 404, 'pendiente: no se entrega a la niña');

    // Aprobación visual del Founder → ya llega a Kendra (y solo por huella exacta).
    assert.equal((await call('POST', '/api/characters/nexo-masculino/review', founder, { sha256: hash, decision: 'quizá' })).status, 400);
    assert.equal((await call('POST', '/api/characters/nexo-masculino/review', founder, { sha256: 'a'.repeat(64), decision: 'approved' })).status, 404);
    assert.ok([401, 403].includes((await call('POST', '/api/characters/nexo-masculino/review', kid, { sha256: hash, decision: 'approved' })).status), 'la niña no aprueba');
    const approved = await call('POST', '/api/characters/nexo-masculino/review', founder, { sha256: hash, decision: 'approved' });
    assert.equal(approved.status, 200);
    assert.equal(approved.body.character.review, 'approved');
    const kidList = await call('GET', '/api/kid/characters', kid);
    assert.deepEqual(kidList.body.characters.map((item: Record<string, unknown>) => [item.slot, item.sha256, item.tier]), [['nexo-masculino', hash, 'partial']]);
    const kidModel = await call('GET', `/api/kid/characters/nexo-masculino/${hash}.glb`, kid);
    assert.equal(kidModel.status, 200);
    assert.deepEqual(kidModel.body, Buffer.from(bytes));
    assert.equal((await call('GET', `/api/kid/characters/lumi/${hash}.glb`, kid)).status, 404, 'otra ranura no sirve con esa huella');
    assert.equal((await call('GET', `/api/kid/characters/nexo-masculino/${'b'.repeat(64)}.glb`, kid)).status, 404);
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n--- stderr del servidor ---\n${stderr.slice(-1500)}`);
  }
});
