import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { generateKeyPairSync, sign } from 'node:crypto';

const port = await freePort();
const base = `http://127.0.0.1:${port}`;
const founderKeys = generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
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
      JANUS_FOUNDER_PUBLIC_KEY_PEM: founderKeys.publicKey,
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
  assert.equal(health.coordination?.operators, 0);
  assert.equal(health.coordination?.assignments, 0);
  assert.equal(health.coordination?.handoffs, 0);
  assert.equal(health.coordination?.accessModel, 'explicit-scopes-and-grants');
  assert.equal(health.reusableLibrary?.currentItems, 0);
  assert.equal(health.projects?.active, 0);
  assert.equal(health.projects?.threads, 0);

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

  const unauthenticatedCoordination = await fetch(`${base}/api/coordination`);
  assert.equal(unauthenticatedCoordination.status, 401);

  const founderToken = await authenticate(base, 'founder', founderKeys.privateKey);

  const iconItem = await postJson(base, '/api/library/items', {
    id: 'icon.translator.medallion',
    kind: 'icon',
    name: 'Translator medallion',
    tags: ['translator', 'approved'],
    compatibility: ['web', 'pwa'],
    spec: { shape: 'medallion', approved: true },
  }, founderToken, 201);
  assert.equal(iconItem.item?.revision, 1);

  const buttonItem = await postJson(base, '/api/library/items', {
    id: 'button.hyperreal.glow',
    kind: 'button',
    name: 'Hyperreal illuminated button',
    tags: ['button', 'approved'],
    dependencies: [{ itemId: 'icon.translator.medallion', revision: 1 }],
    spec: { illuminated: true, depth: 'high' },
  }, founderToken, 201);
  assert.equal(buttonItem.item?.revision, 1);

  const librarySelection = await getJson(
    base,
    '/api/library/button.hyperreal.glow',
    founderToken,
    200,
  );
  assert.equal(librarySelection.selection?.item?.id, 'button.hyperreal.glow');
  assert.equal(librarySelection.selection?.dependencyItems?.[0]?.id, 'icon.translator.medallion');

  const projectBody = await postJson(base, '/api/projects', {
    id: 'project-smoke',
    name: 'Smoke Project',
    description: 'Project continuity smoke',
  }, founderToken, 201);
  assert.equal(projectBody.project?.id, 'project-smoke');

  const threadOneBody = await postJson(base, '/api/projects/project-smoke/threads', {
    id: 'thread-smoke-1',
    title: 'Initial chat',
  }, founderToken, 201);
  assert.equal(threadOneBody.thread?.projectId, 'project-smoke');

  await postJson(base, '/api/projects/project-smoke/resources', {
    id: 'resource-smoke-logo',
    threadId: 'thread-smoke-1',
    name: 'Approved logo',
    source: 'local',
    sourceRef: 'local://library/logo.svg',
    mimeType: 'image/svg+xml',
    checksum: 'smoke-checksum',
  }, founderToken, 201);

  const projectRunResponse = await fetch(`${base}/api/command`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${founderToken}`,
    },
    body: JSON.stringify({
      text: 'Siempre reutiliza los componentes aprobados del catálogo y nunca empieces desde cero.',
      inputMode: 'text',
      projectId: 'project-smoke',
      threadId: 'thread-smoke-1',
    }),
  });
  assert.equal(projectRunResponse.status, 202);
  const projectRunBody = await projectRunResponse.json();
  assert.equal(projectRunBody.projectId, 'project-smoke');
  assert.equal(projectRunBody.threadId, 'thread-smoke-1');
  const projectRun = await waitForRun(
    base,
    projectRunBody.runId,
    new Set(['completed', 'failed', 'blocked']),
    5_000,
  );
  assert.equal(projectRun.status, 'completed');

  const projectDecisionResponse = await fetch(
    `${base}/api/runs/${encodeURIComponent(projectRunBody.runId)}/decisions`,
  );
  assert.equal(projectDecisionResponse.status, 200);
  const projectDecisions = await projectDecisionResponse.json();
  assert.equal(
    projectDecisions.receipts?.some(
      (receipt) => receipt?.decisionKind === 'project_context_checkpoint',
    ),
    true,
  );

  const threadTwoBody = await postJson(base, '/api/projects/project-smoke/threads', {
    id: 'thread-smoke-2',
    title: 'Fresh chat after rollover',
  }, founderToken, 201);
  assert.equal(threadTwoBody.bootstrapCheckpoint?.threadId, 'thread-smoke-2');
  assert.equal(
    threadTwoBody.bootstrapCheckpoint?.activeInstructions?.some(
      (instruction) => instruction?.content?.includes('nunca empieces desde cero'),
    ),
    true,
  );
  assert.equal(
    threadTwoBody.bootstrapCheckpoint?.resumeFrom?.content?.includes(
      'Siempre reutiliza los componentes aprobados',
    ),
    true,
  );

  const projectContext = await getJson(
    base,
    '/api/projects/project-smoke/context',
    founderToken,
    200,
  );
  assert.equal(projectContext.project?.id, 'project-smoke');
  assert.equal(projectContext.threads?.length, 2);
  assert.equal(projectContext.resources?.length, 1);
  assert.equal(projectContext.latestCheckpoint?.threadId, 'thread-smoke-2');

  const operatorKeys = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const delegated = await postJson(base, '/api/auth/operator/delegate', {
    principalId: 'operator-smoke',
    displayName: 'Operator Smoke',
    publicKeyPem: operatorKeys.publicKey,
  }, founderToken, 201);
  assert.equal(delegated.operator?.principal?.role, 'operator');

  const scopeBody = await postJson(base, '/api/coordination/scopes', {
    id: 'scope-smoke-shared',
    label: 'Smoke shared workspace',
    classification: 'shared',
  }, founderToken, 201);
  assert.equal(scopeBody.scope?.classification, 'shared');

  await postJson(base, '/api/coordination/grants', {
    id: 'grant-smoke-operator',
    principalId: 'operator-smoke',
    scopeId: 'scope-smoke-shared',
    permissions: ['read_context', 'write_work', 'coordinate', 'handoff'],
  }, founderToken, 201);

  const assignmentBody = await postJson(base, '/api/coordination/assignments', {
    id: 'assignment-smoke',
    title: 'Continue smoke task',
    goal: 'Complete a local run and leave a reproducible handoff',
    assigneePrincipalId: 'operator-smoke',
    scopeIds: ['scope-smoke-shared'],
    nextActions: ['Review the generated handoff'],
  }, founderToken, 201);
  assert.equal(assignmentBody.assignment?.assigneePrincipalId, 'operator-smoke');

  const operatorToken = await authenticate(base, 'operator-smoke', operatorKeys.privateKey);
  const operatorBriefBefore = await getJson(base, '/api/coordination', operatorToken, 200);
  assert.deepEqual(
    operatorBriefBefore.brief?.scopes?.map((scope) => scope.id),
    ['scope-smoke-shared'],
  );

  const linkedResponse = await fetch(`${base}/api/command`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${operatorToken}`,
    },
    body: JSON.stringify({
      text: 'haz una tarea local sin herramienta',
      inputMode: 'text',
      assignmentId: 'assignment-smoke',
      sessionId: 'operator-smoke-session',
    }),
  });
  assert.equal(linkedResponse.status, 202);
  const linkedBody = await linkedResponse.json();
  assert.equal(linkedBody.assignmentId, 'assignment-smoke');
  assert.equal(linkedBody.authenticatedPrincipal, 'operator-smoke');
  const linkedRun = await waitForRun(
    base,
    linkedBody.runId,
    new Set(['completed', 'failed', 'blocked']),
    5_000,
  );
  assert.equal(linkedRun.status, 'completed');

  const operatorBriefAfter = await getJson(base, '/api/coordination', operatorToken, 200);
  const linkedAssignment = operatorBriefAfter.brief?.assignments?.find(
    (item) => item?.assignment?.id === 'assignment-smoke',
  );
  assert.equal(linkedAssignment?.latestHandoff?.runId, linkedBody.runId);
  assert.equal(linkedAssignment?.latestHandoff?.fromPrincipalId, 'operator-smoke');
  assert.equal(
    linkedAssignment?.latestHandoff?.nextActions?.includes('Review the generated handoff'),
    true,
  );

  const linkedDecisionResponse = await fetch(
    `${base}/api/runs/${encodeURIComponent(linkedBody.runId)}/decisions`,
  );
  assert.equal(linkedDecisionResponse.status, 200);
  const linkedDecisions = await linkedDecisionResponse.json();
  assert.equal(
    linkedDecisions.receipts?.some((receipt) => receipt?.decisionKind === 'coordination_handoff'),
    true,
  );

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

async function authenticate(baseUrl, principalId, privateKey) {
  const challengeResponse = await fetch(`${baseUrl}/api/auth/challenge`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ principalId }),
  });
  assert.equal(challengeResponse.status, 200);
  const challengeBody = await challengeResponse.json();
  const payload = challengeBody.challenge?.signingPayload;
  assert.equal(typeof payload, 'string');
  const signature = sign('sha256', Buffer.from(payload, 'utf8'), privateKey).toString('base64url');
  const verifyResponse = await fetch(`${baseUrl}/api/auth/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      challengeId: challengeBody.challenge.id,
      principalId,
      signature,
    }),
  });
  assert.equal(verifyResponse.status, 200);
  const verifyBody = await verifyResponse.json();
  assert.equal(typeof verifyBody.session?.token, 'string');
  return verifyBody.session.token;
}

async function postJson(baseUrl, path, body, token, expectedStatus) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  assert.equal(response.status, expectedStatus);
  return await response.json();
}

async function getJson(baseUrl, path, token, expectedStatus) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  assert.equal(response.status, expectedStatus);
  return await response.json();
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
