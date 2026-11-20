import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { generateKeyPairSync, sign } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('real Core serves both authenticated voice profiles and PCM without STT; arbitrary voices rejected', { timeout: 20000 }, async () => {
  const calls: string[] = [];
  const tts = createServer(async (req, res) => {
    let data = ''; for await (const part of req) data += part;
    calls.push(JSON.parse(data).voiceId);
    res.writeHead(200, { 'content-type': 'audio/pcm;rate=24000;channels=1;format=s16le' });
    res.end(Buffer.alloc(1920));
  });
  await new Promise<void>(done => tts.listen(0, '127.0.0.1', done));
  const ttsAddress = tts.address(); assert.ok(ttsAddress && typeof ttsAddress === 'object');
  const probe = createServer(); await new Promise<void>(done => probe.listen(0, '127.0.0.1', done));
  const address = probe.address(); assert.ok(address && typeof address === 'object');
  await new Promise<void>(done => probe.close(() => done()));
  const root = `http://127.0.0.1:${address.port}`;
  const keys = generateKeyPairSync('ec', { namedCurve: 'prime256v1', publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
  const dir = mkdtempSync(join(tmpdir(), 'janus-voice-http-'));
  const child = spawn(process.execPath, ['--import', 'tsx', 'apps/runtime/server.ts'], {
    cwd: process.cwd(), stdio: 'ignore', env: { ...process.env, PORT: String(address.port), JANUS_BIND_HOST: '127.0.0.1', JANUS_DB: join(dir, 'voice.db'),
      JANUS_FOUNDER_PUBLIC_KEY_PEM: keys.publicKey, JANUS_TTS_PROVIDER: 'local', JANUS_TTS_BASE_URL: `http://127.0.0.1:${ttsAddress.port}`,
      JANUS_VOICE_ID: 'male-local', JANUS_MELANIE_VOICE_ID: 'female-local', JANUS_ASSISTANT_VOICES_FILE: join(dir, 'absent.json'), JANUS_STT_BASE_URL: '',
      GITHUB_TOKEN: '', GOOGLE_ACCESS_TOKEN: '', JANUS_MODEL_BASE_URL: '', JANUS_MODEL_NAME: '', JANUS_RADAR_INTERVAL_MIN: '0' },
  });
  try {
    let ready = false;
    for (let i = 0; i < 120; i++) { try { if ((await fetch(root + '/health')).ok) { ready = true; break; } } catch { /* wait */ } await new Promise(done => setTimeout(done, 50)); }
    assert.ok(ready);
    assert.equal((await fetch(root + '/api/voice/profiles')).status, 401);
    assert.equal((await fetch(root + '/api/voice/speak', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'hola' }) })).status, 401);
    const post = (path: string, body: unknown, token?: string) => fetch(root + path, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });
    const challenge = (await (await post('/api/auth/challenge', { principalId: 'founder' })).json()).challenge;
    const token = (await (await post('/api/auth/verify', { principalId: 'founder', challengeId: challenge.id, signature: sign('sha256', Buffer.from(challenge.signingPayload), keys.privateKey).toString('base64url') })).json()).session.token;
    const profiles = await (await fetch(root + '/api/voice/profiles', { headers: { authorization: 'Bearer ' + token } })).json();
    assert.deepEqual(profiles.profiles.map((p: { id: string }) => p.id), ['janus', 'melanie']);
    assert.doesNotMatch(JSON.stringify(profiles), /providerVoiceId|voiceSettings|male-local|female-local/);
    for (const profile of ['janus', 'melanie']) {
      const response = await post('/api/voice/speak', { profile, text: 'Hola, prueba.' }, token);
      assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal((await response.arrayBuffer()).byteLength, 1920);
    }
    assert.deepEqual(calls, ['male-local', 'female-local']);
    assert.equal((await post('/api/voice/speak', { profile: 'kendra', text: 'hola' }, token)).status, 400);
    assert.equal((await post('/api/voice/speak', { profile: 'melanie', text: 'x'.repeat(2001) }, token)).status, 400);
    assert.equal(calls.length, 2);
    const health = await (await fetch(root + '/health')).json();
    assert.equal(health.voice.streaming.state, 'unavailable', 'STT remains unconfigured, without blocking speech output');
  } finally {
    if (child.exitCode === null) { const done = once(child, 'exit'); child.kill('SIGTERM'); await done; }
    tts.closeAllConnections(); await new Promise<void>(done => tts.close(() => done()));
    rmSync(dir, { recursive: true, force: true });
  }
});
