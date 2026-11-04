import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
  const deadline = Date.now() + 20_000;
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

test('dashboard de la niña: emparejamiento, PIN parental, filtros, casa latente y panel del tutor', async (t) => {
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const keys = generateKeyPairSync('ec', { namedCurve: 'prime256v1', publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
  const dir = mkdtempSync(join(tmpdir(), 'janus-kid-test-'));
  const devicesPath = join(dir, 'home-devices.json');
  writeFileSync(devicesPath, JSON.stringify([
    { id: 'dev-cama', name: 'Luz de la cama', room: 'cama', kind: 'light' },
    { id: 'dev-cerradura', name: 'Cerradura', room: 'cama', kind: 'plug', tags: ['lock'] },
  ]));
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
      JANUS_HOME_DEVICES_PATH: devicesPath,
      JANUS_KID_WEATHER: 'off',
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
    const founder = { authorization: `Bearer ${verified.session.token}` };

    const call = async (method: string, path: string, headers: Record<string, string> = {}, body?: unknown) => {
      const response = await fetch(`${base}${path}`, { method, headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, body: await response.json() as Record<string, any> };
    };

    // 1) Sin sesión de Founder no se crea ningún código de emparejamiento.
    assert.ok([401, 403].includes((await call('POST', '/api/parent/kid/pairing', {}, {})).status));

    // 2) Emparejamiento: un código de un solo uso canjeable sin sesión de Founder → token propio de la niña.
    const pairing = await call('POST', '/api/parent/kid/pairing', founder, { kidId: 'kendra' });
    assert.equal(pairing.status, 201);
    assert.match(pairing.body.code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    assert.equal((await call('POST', '/api/kid/redeem', {}, { code: 'AAAA-AAAA' })).status, 400);
    const redeemed = await call('POST', '/api/kid/redeem', {}, { code: pairing.body.code, label: 'Tablet de Kendra' });
    assert.equal(redeemed.status, 201);
    assert.match(redeemed.body.token, /^kdv_/);
    assert.equal((await call('POST', '/api/kid/redeem', {}, { code: pairing.body.code })).status, 400, 'el código ya se usó');
    const kid = { authorization: `Bearer ${redeemed.body.token}` };

    // 3) El token de la niña NO es autoridad de Founder.
    assert.ok([401, 403].includes((await call('POST', '/api/attachments', { ...kid, 'x-attachment-source': 'photo' }, {})).status));
    assert.ok([401, 403].includes((await call('POST', '/api/parent/kid/pairing', kid, {})).status));
    assert.equal((await call('GET', '/api/kid/state')).status, 401);

    // 4) El tutor abre la franja horaria para que la prueba no dependa de la hora del reloj.
    const open = await call('PUT', '/api/parent/kid/settings', founder, {
      kidId: 'kendra',
      limits: { allowedFrom: '00:00', allowedUntil: '23:59', totalDailyMinutes: 600, perCategoryMinutes: {}, warnMinutesBefore: 5 },
    });
    assert.equal(open.status, 200);

    // 5) Personalización por la propia niña (listas cerradas).
    const state = await call('GET', '/api/kid/state', kid);
    assert.equal(state.status, 200);
    assert.equal(state.body.profile.displayName, 'Peque');
    assert.equal((await call('PUT', '/api/kid/profile', kid, { displayName: 'Kendra', icon: '🦋', theme: 'menta', companionId: 'bombo' })).status, 200);
    assert.equal((await call('PUT', '/api/kid/profile', kid, { displayName: 'Mira https://malo.example' })).status, 400);
    assert.equal((await call('PUT', '/api/kid/profile', kid, { companionId: 'no-existe' })).status, 400);
    assert.equal((await call('GET', '/api/kid/state', kid)).body.profile.displayName, 'Kendra');

    // 6) Chat: contenido adulto bloqueado y avisado al tutor; texto normal responde (sin modelo → respuesta de reserva).
    const blocked = await call('POST', '/api/kid/chat', kid, { text: 'quiero ver porno' });
    assert.equal(blocked.status, 200);
    assert.equal(blocked.body.blocked, 'safety');
    const fine = await call('POST', '/api/kid/chat', kid, { text: 'hola, cuéntame de los zorros' });
    assert.equal(fine.body.blocked, null);
    assert.ok(typeof fine.body.reply === 'string' && fine.body.reply.length > 0);
    assert.equal((await call('POST', '/api/kid/chat', kid, { text: '   ' })).status, 400);

    // 7) Casa: apagada por defecto; con política del tutor y sin ejecutor, queda en modo latente (no actúa); la cerradura nunca.
    assert.equal((await call('POST', '/api/kid/home', kid, { text: 'apaga la luz de la cama' })).body.status, 'disabled');
    await call('PUT', '/api/parent/kid/settings', founder, { kidId: 'kendra', home: { enabled: true, allowedRooms: ['cama'], allowedKinds: ['light'] } });
    const dormant = await call('POST', '/api/kid/home', kid, { text: 'apaga la luz de la cama' });
    assert.equal(dormant.body.status, 'dormant');
    assert.match(String(dormant.body.planned), /cama/i);

    // 8) Vídeo: YouTube sin lista aprobada → petición al tutor (nunca búsqueda libre).
    const media = await call('POST', '/api/kid/media', kid, { text: 'ponme videos de baile coreano en youtube' });
    assert.equal(media.body.status, 'needs-parent');

    // 9) Agenda y tareas.
    const agenda = await call('POST', '/api/kid/agenda', kid, { text: 'mañana a las 5 tengo dentista' });
    assert.equal(agenda.status, 201);
    assert.equal(agenda.body.item.title, 'Dentista');
    const task = await call('POST', '/api/kid/tasks', kid, { title: 'Terminar el dibujo de Stitch' });
    assert.equal(task.status, 201);
    assert.equal((await call('POST', `/api/kid/tasks/${task.body.task.id}/status`, kid, { status: 'hecha' })).status, 200);
    assert.equal((await call('POST', `/api/kid/tasks/${task.body.task.id}/status`, kid, { status: 'borrar-todo' })).status, 400);

    // 10) Latido de actividad: queda registrado para el tutor.
    const beat = await call('POST', '/api/kid/activity', kid, { category: 'chat', seconds: 30 });
    assert.equal(beat.status, 200);
    assert.equal((await call('POST', '/api/kid/activity', kid, { category: 'hackeo', seconds: 30 })).status, 400);

    // 11) Adjuntos de la niña: foto verificada por bytes, con su propio perfil.
    const upload = await fetch(`${base}/api/kid/attachments`, { method: 'POST', headers: { ...kid, 'content-type': 'image/png', 'x-attachment-source': 'photo', 'x-attachment-name': encodeURIComponent('mi dibujo.png') }, body: new Uint8Array(PNG) });
    assert.equal(upload.status, 201);
    const exe = await fetch(`${base}/api/kid/attachments`, { method: 'POST', headers: { ...kid, 'content-type': 'application/octet-stream', 'x-attachment-source': 'device-file', 'x-attachment-name': 'juego.exe' }, body: new Uint8Array(Buffer.from('MZ....')) });
    assert.ok(exe.status >= 400 && exe.status < 500);

    // 12) PIN parental: sin PIN no hay área de padres; con PIN se abre 10 min, y solo para el tutor-por-PIN, no para ajustes de Founder.
    assert.equal((await call('POST', '/api/kid/parent/unlock', kid, { pin: '1234' })).status, 409);
    assert.equal((await call('POST', '/api/parent/kid/pin', founder, { kidId: 'kendra', pin: '12' })).status, 400);
    assert.equal((await call('POST', '/api/parent/kid/pin', founder, { kidId: 'kendra', pin: '4826' })).status, 200);
    const wrong = await call('POST', '/api/kid/parent/unlock', kid, { pin: '1111' });
    assert.equal(wrong.status, 403);
    assert.equal((await call('GET', '/api/parent/kid/overview', { ...kid, 'x-janus-parent-unlock': 'ulk_falso' })).status, 403);
    const unlocked = await call('POST', '/api/kid/parent/unlock', kid, { pin: '4826' });
    assert.equal(unlocked.status, 200);
    const viaPin = { ...kid, 'x-janus-parent-unlock': unlocked.body.unlockToken };
    assert.ok([401, 403].includes((await call('POST', '/api/parent/kid/pin', viaPin, { kidId: 'kendra', pin: '9999' })).status), 'cambiar el PIN exige sesión de Founder');
    assert.ok([401, 403].includes((await call('POST', '/api/parent/kid/pairing', viaPin, {})).status));

    // 13) Panel del tutor: actividad, avisos del filtro, peticiones de vídeo y dispositivos.
    const overview = await call('GET', '/api/parent/kid/overview?kidId=kendra', founder);
    assert.equal(overview.status, 200);
    assert.equal(overview.body.pinSet, true);
    assert.ok(overview.body.flags.some((item: { severity: string }) => item.severity === 'block'), 'el intento adulto quedó avisado');
    assert.ok(overview.body.mediaRequests.length >= 1);
    assert.equal(overview.body.devices.length, 1);
    assert.ok(overview.body.today.byCategory.chat >= 0);
    assert.equal(overview.body.transcripts, undefined, 'sin transcripciones por defecto: solo avisos');
    assert.equal((await call('GET', '/api/parent/kid/overview', viaPin)).status, 200, 'el área de padres de la tablet de ella también lo ve');

    // 14) Aprobar un canal/vídeo y minutos extra; después YouTube funciona solo con lo aprobado.
    const approve = await call('PUT', '/api/parent/kid/settings', founder, {
      kidId: 'kendra',
      media: { youtube: { mode: 'allowlist', channels: [], videos: [{ id: 'dQw4w9WgXcQ', label: 'Baile de prueba' }] }, netflix: { mode: 'off' } },
    });
    assert.equal(approve.status, 200);
    const allowed = await call('POST', '/api/kid/media', kid, { text: 'ponme youtube' });
    assert.equal(allowed.body.status, 'allow');
    assert.match(allowed.body.videos[0].embedUrl, /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?/);
    assert.equal((await call('POST', '/api/parent/kid/bonus', founder, { kidId: 'kendra', minutes: 500 })).status, 400);
    assert.equal((await call('POST', '/api/parent/kid/bonus', founder, { kidId: 'kendra', minutes: 15 })).status, 200);

    // 15) Contenido sugerido por Janus entra «pending» y no se ve hasta que el tutor lo aprueba.
    const suggested = await call('POST', '/api/parent/kid/feed', founder, { kidId: 'kendra', approve: false, source: 'janus', item: { title: 'Taller de dibujo en la biblioteca', kind: 'plan', until: new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10) } });
    assert.equal(suggested.status, 201);
    assert.equal(suggested.body.item.status, 'pending');
    assert.equal((await call('GET', '/api/kid/state', kid)).body.feed.length, 0);
    assert.equal((await call('POST', `/api/parent/kid/feed/${suggested.body.item.id}/decision`, founder, { kidId: 'kendra', decision: 'approved' })).status, 200);
    assert.equal((await call('GET', '/api/kid/state', kid)).body.feed.length, 1);

    // 16) Revocar el dispositivo corta el acceso de inmediato.
    const deviceId = overview.body.devices[0].id as string;
    assert.equal((await call('DELETE', `/api/parent/kid/devices/${deviceId}?kidId=kendra`, founder)).status, 200);
    assert.equal((await call('GET', '/api/kid/state', kid)).status, 401);
  } catch (error) {
    if (error instanceof Error) error.message += `\n--- stderr ---\n${stderr.slice(-1500)}`;
    throw error;
  }
});
