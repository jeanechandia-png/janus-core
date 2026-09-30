import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

const port = await freePort();
const base = `http://127.0.0.1:${port}`;
const child = spawn(
  process.execPath,
  ['--import', 'tsx', 'apps/runtime/server.ts'],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      JANUS_DB: ':memory:',
      JANUS_TIME_ZONE: 'Europe/Amsterdam',
      GOOGLE_ACCESS_TOKEN: '',
      JANUS_MODEL_BASE_URL: '',
      JANUS_MODEL_NAME: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);

let stdout = '';
let stderr = '';
child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

try {
  const health = await waitForJson(`${base}/health`, 8_000);
  assert.equal(health.ok, true);
  assert.equal(health.service, 'janus-runtime');
  assert.equal(health.durable, true);
  assert.equal(health.db, 'memory');
  assert.equal(health.timeZone, 'Europe/Amsterdam');
  assert.equal(health.decisionTrace?.blueprint?.id, 'janus-runtime-execution');
  assert.equal(health.decisionTrace?.blueprint?.revision, 1);
  assert.equal(health.decisionTrace?.receipts, 'sha256-chained-sqlite');
  assert.equal(health.outcomeLearning?.observations, 0);
  assert.equal(health.outcomeLearning?.calibration?.count, 0);
  assert.equal(health.outcomeLearning?.nextExecutionPrediction?.basis, 'neutral-prior');
  assert.equal(health.outcomeLearning?.nextExecutionPrediction?.confidence, 0.5);
  assert.equal(health.outcomeLearning?.nextExecutionPrediction?.minimumSamples, 12);
  assert.equal(health.outcomeLearning?.endpoint, '/api/learning');

  const capabilities = Array.isArray(health.capabilities) ? health.capabilities : [];
  const github = capabilities.find((item) => item?.tool === 'github' && item?.action === 'repo.get');
  const google = capabilities.find(
    (item) => item?.tool === 'google-workspace' && item?.action === 'calendar.events.list',
  );
  assert.equal(github?.state, 'available');
  assert.equal(google?.state, 'needs_auth');

  const localRunId = await startCommand(base, 'haz una tarea local sin herramienta');
  const localRun = await waitForRun(base, localRunId, new Set(['completed', 'failed', 'blocked']), 5_000);
  assert.equal(localRun.status, 'completed');

  const decisionResponse = await fetch(
    `${base}/api/runs/${encodeURIComponent(localRunId)}/decisions`,
  );
  assert.equal(decisionResponse.status, 200);
  const decisionBody = await decisionResponse.json();
  assert.equal(decisionBody.ok, true);
  assert.equal(decisionBody.blueprint?.id, 'janus-runtime-execution');
  assert.equal(decisionBody.chain?.ok, true);
  assert.ok(Array.isArray(decisionBody.receipts));
  assert.ok(decisionBody.receipts.length >= 3);
  assert.equal(decisionBody.receipts[0]?.decisionKind, 'blueprint_selection');
  assert.ok(decisionBody.receipts.some((receipt) => receipt?.decisionKind === 'planning_fallback'));
  assert.ok(decisionBody.receipts.some((receipt) => receipt?.decisionKind === 'delivery_verification'));
  assert.equal(
    decisionBody.receipts.some((receipt) => receipt?.decisionKind === 'execution_prediction'),
    false,
  );
  const fallbackOutcome = decisionBody.receipts.find(
    (receipt) => receipt?.decisionKind === 'run_outcome',
  );
  assert.equal(fallbackOutcome?.metadata?.outcome, 'unknown');
  assert.equal(fallbackOutcome?.metadata?.learningEligible, false);

  const learningResponse = await fetch(`${base}/api/learning`);
  assert.equal(learningResponse.status, 200);
  const learningBody = await learningResponse.json();
  assert.equal(learningBody.ok, true);
  assert.equal(learningBody.calibration?.count, 0);
  assert.deepEqual(learningBody.observations, []);
  assert.equal(learningBody.nextExecutionPrediction?.basis, 'neutral-prior');
  assert.equal(learningBody.nextExecutionPrediction?.confidence, 0.5);
  assert.equal(learningBody.blueprint?.revision, 1);
  assert.equal(learningBody.blueprintHistory?.length, 1);
  assert.equal(learningBody.blueprintHistory?.[0]?.status, 'active');

  const unauthenticatedGovernance = await fetch(
    `${base}/api/learning/proposals/not-real/reject`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    },
  );
  assert.equal(unauthenticatedGovernance.status, 401);

  const unauthenticatedRollback = await fetch(
    `${base}/api/learning/blueprints/rollback`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        targetRevision: 1,
        confirmAction: 'rollback_blueprint_revision',
      }),
    },
  );
  assert.equal(unauthenticatedRollback.status, 401);

  const googleRunId = await startCommand(base, 'mira mi calendario');
  const googleRun = await waitForRun(base, googleRunId, new Set(['completed', 'failed', 'blocked']), 5_000);
  assert.equal(googleRun.status, 'blocked');

  const eventsResponse = await fetch(`${base}/api/events?runId=${encodeURIComponent(googleRunId)}`, {
    headers: { accept: 'text/event-stream' },
    signal: AbortSignal.timeout(500),
  }).catch((error) => {
    if (error?.name === 'TimeoutError') return null;
    throw error;
  });
  if (eventsResponse) eventsResponse.body?.cancel();

  console.log('runtime smoke ok');
} catch (error) {
  console.error('JANUS runtime smoke failed');
  if (stdout) console.error('--- runtime stdout ---\n' + stdout);
  if (stderr) console.error('--- runtime stderr ---\n' + stderr);
  throw error;
} finally {
  child.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 1_000)),
  ]);
  if (!child.killed) child.kill('SIGKILL');
}

async function startCommand(baseUrl, text) {
  const response = await fetch(`${baseUrl}/api/command`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text, inputMode: 'text' }),
  });
  assert.equal(response.status, 202);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(typeof body.runId, 'string');
  return body.runId;
}

async function waitForRun(baseUrl, runId, terminalStates, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    const response = await fetch(`${baseUrl}/api/runs/${encodeURIComponent(runId)}`);
    if (response.ok) {
      const body = await response.json();
      last = body.snapshot;
      if (terminalStates.has(last?.status)) return last;
    }
    await delay(50);
  }
  throw new Error(`run ${runId} did not reach terminal state; last=${JSON.stringify(last)}`);
}

async function waitForJson(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(75);
  }
  throw lastError ?? new Error(`timeout waiting for ${url}`);
}

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const selected = address.port;
  await new Promise((resolve) => server.close(resolve));
  return selected;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
