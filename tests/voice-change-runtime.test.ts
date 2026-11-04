import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn, type ChildProcess } from 'node:child_process';
import { generateKeyPairSync, sign } from 'node:crypto';
import { createServer } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

test('authenticated dictation → exact proposal → biometric approval → SQLite → restart; child and replay rejected', { timeout: 30_000 }, async () => {
  const keys = () => generateKeyPairSync('ec', { namedCurve: 'prime256v1', publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
  const founder = keys(), biometric = keys();
  const scratch = mkdtempSync(join(tmpdir(), 'janus-voice-change-'));
  const database = join(scratch, 'test.db');
  const listener = createServer();
  await new Promise<void>((resolve) => listener.listen(0, '127.0.0.1', resolve));
  const port = (listener.address() as { port: number }).port;
  await new Promise<void>((resolve) => listener.close(() => resolve()));
  const base = `http://127.0.0.1:${port}`;
  let child: ChildProcess | undefined;
  const start = async () => {
    child = spawn(process.execPath, ['--import', 'tsx', 'apps/runtime/server.ts'], { env: { ...process.env,
      PORT: String(port), JANUS_DB: database, JANUS_FOUNDER_PUBLIC_KEY_PEM: founder.publicKey,
      JANUS_FOUNDER_BIOMETRIC_PUBLIC_KEY_PEM: biometric.publicKey, JANUS_FOUNDER_BIOMETRIC_KEY_ID: 'test-face',
      JANUS_MODEL_BASE_URL: '', JANUS_MODEL_NAME: '', JANUS_STT_BASE_URL: '', JANUS_TTS_BASE_URL: '',
      JANUS_TTS_PROVIDER: 'local', JANUS_KID_CHAT_MODEL: 'off', JANUS_KID_WEATHER: 'off',
      GITHUB_TOKEN: '', GOOGLE_ACCESS_TOKEN: '', NETLIFY_AUTH_TOKEN: '', ELEVENLABS_API_KEY: '',
    }, stdio: 'ignore' });
    for (let attempt = 0; attempt < 100; attempt++) {
      try { if ((await fetch(base + '/health')).ok) return; } catch { /* startup */ }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error('runtime did not start');
  };
  const stop = async () => {
    if (!child || child.exitCode !== null) return;
    const exited = new Promise<void>((resolve) => child!.once('exit', () => resolve()));
    child.kill('SIGTERM'); await exited;
  };
  const call = async (path: string, token = '', body?: unknown) => {
    const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST',
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() as any };
  };
  const login = async () => {
    const { body } = await call('/api/auth/challenge', '', { principalId: 'founder' });
    const signature = sign('sha256', Buffer.from(body.challenge.signingPayload), founder.privateKey).toString('base64url');
    return (await call('/api/auth/verify', '', { principalId: 'founder', challengeId: body.challenge.id, signature })).body.session.token as string;
  };
  let sql: DatabaseSync | undefined;
  try {
    await start();
    const token = await login();
    const utterance = { sessionId: 'voice-workflow-test', text: 'Guarda esta instrucción: ofrece la demostración de prueba', final: true };
    assert.equal((await call('/api/voice/utterance', '', utterance)).status, 401);
    const pairing = await call('/api/parent/kid/pairing', token, { kidId: 'kendra' });
    const kid = await call('/api/kid/redeem', '', { code: pairing.body.code, label: 'Test device' });
    assert.equal(kid.status, 201);
    assert.equal((await call('/api/voice/utterance', kid.body.token, utterance)).status, 401);
    const spoken = await call('/api/voice/utterance', token, utterance);
    assert.equal(spoken.status, 200, JSON.stringify(spoken.body));
    const runId = spoken.body.result.runId;
    let snapshot: any;
    for (let attempt = 0; attempt < 100; attempt++) {
      snapshot = (await call('/api/runs/' + runId)).body.snapshot;
      if (['blocked', 'failed', 'completed'].includes(snapshot?.status)) break;
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    assert.equal(snapshot.status, 'blocked', 'a spoken change must wait for biometric approval');
    sql = new DatabaseSync(database);
    const proposal = sql.prepare("SELECT id FROM business_knowledge_proposals WHERE status = 'pending'").get() as { id: string };
    assert.ok(proposal?.id);
    const path = '/api/knowledge/proposals/' + proposal.id;
    assert.equal((await call(path, kid.body.token)).status, 401);
    const review = await call(path, token);
    assert.equal(review.status, 200);
    assert.match(review.body.readback.lines.join(' '), /demostración de prueba/);
    const approvedBody = { confirmProposalId: proposal.id, expectedRevision: review.body.baseRevision };
    assert.equal((await call(path, token, approvedBody)).status, 403, 'session alone cannot approve');
    assert.equal(sql.prepare('SELECT COUNT(*) n FROM business_knowledge_revisions').get()!.n, 0);
    const challenge = (await call('/api/auth/biometric/challenge', token, { action: 'knowledge.change.apply' })).body.challenge;
    // Cryptographic test fixture, not a physical Face ID assertion.
    const signature = sign('sha256', Buffer.from(challenge.signingPayload), biometric.privateKey).toString('base64url');
    const proof = (await call('/api/auth/biometric/verify', token, { challengeId: challenge.id, keyId: 'test-face', signature })).body.proof.proofId;
    const apply = () => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, 'x-janus-biometric-proof': proof }, body: JSON.stringify(approvedBody) });
    const applied = await apply();
    assert.equal(applied.status, 200, await applied.clone().text());
    assert.equal((await applied.json() as any).revision, 1);
    assert.equal((await apply()).status, 409, 'same proposal never applies twice');
    assert.equal(sql.prepare('SELECT COUNT(*) n FROM business_knowledge_revisions').get()!.n, 1);
    const founderManifest = await (await fetch(base + '/manifest.webmanifest')).json() as any;
    const kidManifest = await (await fetch(base + '/kendra.webmanifest')).json() as any;
    assert.equal(founderManifest.start_url, '/dashboard/a');
    assert.equal(kidManifest.start_url, '/kendra');
    for (const skin of ['a', 'b']) {
      const html = await (await fetch(base + '/dashboard/' + skin)).text();
      assert.match(html, /\/dashboard-access\.js/);
      assert.match(html, /href="\/manifest.webmanifest"/);
    }
    sql.close(); sql = undefined;
    await stop(); await start();
    const freshToken = await login();
    assert.equal((await call('/api/voice/ticket', token, { sessionId: 'voice-workflow-test' })).status, 401);
    assert.equal((await call(path, freshToken)).status, 409, 'applied status survives restart');
    sql = new DatabaseSync(database);
    assert.equal(sql.prepare('SELECT COUNT(*) n FROM business_knowledge_revisions').get()!.n, 1);
  } finally { sql?.close(); await stop(); rmSync(scratch, { recursive: true, force: true }); }
});
