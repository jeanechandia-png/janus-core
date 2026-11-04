import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { createServer } from 'node:net';
import test from 'node:test';

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
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${base}/health`)).ok) return; } catch { /* arrancando */ }
    await delay(100);
  }
  throw new Error('el servidor no arrancó');
}

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]),
  Buffer.from('IHDR'),
  Buffer.from([0, 0, 2, 0x80, 0, 0, 1, 0xe0, 8, 2, 0, 0, 0]),
  Buffer.alloc(16, 7),
]);

test('POST /api/attachments: only the Founder uploads, content is verified, and attachments reach commands as data', async (t) => {
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const keys = generateKeyPairSync('ec', { namedCurve: 'prime256v1', publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
  const child = spawn(process.execPath, ['--import', 'tsx', 'apps/runtime/server.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      JANUS_DB: ':memory:',
      JANUS_TIME_ZONE: 'Europe/Amsterdam',
      JANUS_CREDENTIAL_VAULT_KEY: randomBytes(32).toString('base64'),
      JANUS_CREDENTIAL_VAULT_PATH: '',
      JANUS_FOUNDER_PUBLIC_KEY_PEM: keys.publicKey,
      JANUS_ATTACHMENTS_MAX_MB: '1',
      JANUS_MODEL_BASE_URL: '',
      JANUS_MODEL_NAME: '',
      GITHUB_TOKEN: '',
      NETLIFY_AUTH_TOKEN: '',
      GOOGLE_ACCESS_TOKEN: '',
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
    const auth = { authorization: `Bearer ${verified.session.token}` };

    const upload = (body: Buffer, headers: Record<string, string>) => fetch(`${base}/api/attachments`, { method: 'POST', headers, body });
    const goodHeaders = { 'content-type': 'image/png', 'x-attachment-name': encodeURIComponent('Foto ¿Qué te parece?.png'), 'x-attachment-source': 'photo' };

    // Sin sesión de Founder no se sube nada.
    assert.ok([401, 403].includes((await upload(PNG, goodHeaders)).status));

    // Con sesión: se guarda, se devuelve la huella y el nombre ya saneado.
    const ok = await upload(PNG, { ...goodHeaders, ...auth });
    assert.equal(ok.status, 201);
    const stored = await ok.json() as { id: string; sha256: string; name: string; width: number; height: number; deduplicated: boolean };
    assert.match(stored.id, /^att_[0-9a-f-]{36}$/);
    assert.match(stored.sha256, /^[0-9a-f]{64}$/);
    assert.equal(stored.width, 640);
    assert.equal(stored.height, 480);
    assert.ok(!/[?]/.test(stored.name), 'el nombre se sanea');

    // Contenido que no coincide con su tipo, extensión peligrosa, perfil ajeno y fuente inválida.
    assert.equal((await upload(Buffer.from('<html><script>1</script></html>'), { ...goodHeaders, ...auth })).status, 415);
    assert.equal((await upload(PNG, { ...goodHeaders, ...auth, 'x-attachment-name': 'foto.png.exe' })).status, 415);
    assert.equal((await upload(PNG, { ...goodHeaders, ...auth, 'x-attachment-profile': 'kid' })).status, 403);
    assert.equal((await upload(PNG, { ...goodHeaders, ...auth, 'x-attachment-source': 'camera-roll' })).status, 400);

    // Descarga solo del dueño, forzada como adjunto y sin que el navegador adivine el tipo.
    const download = await fetch(`${base}/api/attachments/${stored.id}`, { headers: auth });
    assert.equal(download.status, 200);
    assert.equal(download.headers.get('x-content-type-options'), 'nosniff');
    assert.match(download.headers.get('content-disposition') ?? '', /^attachment/);
    assert.deepEqual(Buffer.from(await download.arrayBuffer()), PNG);
    assert.equal((await fetch(`${base}/api/attachments/${stored.id}`)).status >= 400, true);
    assert.equal((await fetch(`${base}/api/attachments/att_00000000-0000-0000-0000-000000000000`, { headers: auth })).status, 404);

    // Un orden con adjuntos exige sesión de Founder y adjuntos propios y existentes.
    const command = (body: unknown, headers: Record<string, string>) => fetch(`${base}/api/command`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
    const withAttachment = await command({ text: 'mira esta foto', inputMode: 'text', attachments: [stored.id], scans: [{ raw: 'https://ejemplo.nl', format: 'qr_code' }] }, auth);
    assert.equal(withAttachment.status, 202);
    assert.ok([401, 403].includes((await command({ text: 'mira esta foto', attachments: [stored.id] }, {})).status));
    assert.equal((await command({ text: 'mira esta foto', attachments: ['att_00000000-0000-0000-0000-000000000000'] }, auth)).status, 400);

    // Tope de almacenamiento (1 MB en esta prueba): la segunda imagen distinta no cabe.
    const big = Buffer.concat([PNG, Buffer.alloc(1_100_000, 9)]);
    assert.equal((await upload(big, { ...goodHeaders, ...auth })).status, 507);
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n--- stderr ---\n${stderr.slice(-1500)}`);
  }
});
