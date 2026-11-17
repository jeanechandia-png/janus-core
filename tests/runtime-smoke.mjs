import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { generateKeyPairSync, randomBytes, sign } from 'node:crypto';

const port = await freePort();
const base = `http://127.0.0.1:${port}`;
const founderKeys = generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const founderBiometricKeys = generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
// Diagnóstico: guarda el motivo de cada 403 para que un fallo intermitente deje rastro (sin cuerpos de otros códigos).
const forbiddenLog = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (...args) => {
  const response = await realFetch(...args);
  if (response.status === 403) {
    const body = await response.clone().text().catch(() => '');
    forbiddenLog.push(`${new Date().toISOString()} ${String(args[1]?.method ?? 'GET')} ${String(args[0]).replace(/^https?:\/\/[^/]+/, '')} -> ${body.slice(0, 200)}`);
  }
  return response;
};

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
      THREADS_ACCESS_TOKEN: '',
      // Almacén cifrado en memoria y cliente OAuth de prueba: sin red, sin archivos.
      JANUS_CREDENTIAL_VAULT_KEY: randomBytes(32).toString('base64'),
      JANUS_CREDENTIAL_VAULT_PATH: '',
      GOOGLE_OAUTH_CLIENT_ID: 'smoke-client.apps.googleusercontent.com',
      GOOGLE_OAUTH_CLIENT_SECRET: '',
      THREADS_APP_SECRET: '',
      // Hermetic: never inherit a GitHub credential from the developer/CI shell.
      GITHUB_TOKEN: '',
      NETLIFY_AUTH_TOKEN: '',
      JANUS_MODEL_BASE_URL: '',
      JANUS_MODEL_NAME: '',
      JANUS_FOUNDER_PUBLIC_KEY_PEM: founderKeys.publicKey,
      JANUS_FOUNDER_BIOMETRIC_PUBLIC_KEY_PEM: founderBiometricKeys.publicKey,
      JANUS_FOUNDER_BIOMETRIC_KEY_ID: 'smoke-face-key',
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
  assert.equal(health.outcomeLearning?.nextExecutionConfidence?.mode, 'neutral_prior');
  assert.equal(health.outcomeLearning?.nextExecutionConfidence?.confidence, 0.5);
  assert.equal(health.outcomeLearning?.nextExecutionConfidence?.minimumSamples, 20);
  assert.equal(health.outcomeLearning?.endpoint, '/api/learning');
  assert.equal(health.coordination?.operators, 0);
  assert.equal(health.coordination?.assignments, 0);
  assert.equal(health.coordination?.handoffs, 0);
  assert.equal(health.coordination?.accessModel, 'explicit-scopes-and-grants');
  assert.equal(health.reusableLibrary?.currentItems, 0);
  assert.equal(health.projects?.active, 0);
  assert.equal(health.projects?.threads, 0);
  assert.equal(health.assistantControl?.profiles, 1);
  assert.equal(health.assistantControl?.surfaces, 3);
  assert.equal(health.assistantControl?.activeSurfaces, 3);
  assert.equal(health.assistantControl?.inheritedCurrent, 3);
  assert.equal(health.progressPolicy?.id, 'continue-by-alternatives-v1');
  assert.equal(health.assistantControl?.deliveries, 0);
  assert.equal(health.assistantControl?.appliedDeliveries, 0);
  assert.equal(health.assistantControl?.publisher, 'needs-auth');

  const capabilities = Array.isArray(health.capabilities) ? health.capabilities : [];
  const github = capabilities.find((item) => item?.tool === 'github' && item?.action === 'repo.get');
  const google = capabilities.find(
    (item) => item?.tool === 'google-workspace' && item?.action === 'calendar.events.list',
  );
  assert.equal(github?.state, 'available');
  assert.equal(google?.state, 'needs_auth');
  const threadsActions = capabilities.filter((item) => item?.tool === 'threads-insights').map((item) => item.action).sort();
  assert.deepEqual(threadsActions, ['threads.account.insights', 'threads.account.profile']);
  assert.ok(capabilities.filter((item) => item?.tool === 'threads-insights').every((item) => item.state === 'needs_auth'));

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
  assert.equal(learningBody.executionConfidence?.mode, 'neutral_prior');
  assert.equal(learningBody.executionConfidence?.confidence, 0.5);
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

  const unauthenticatedAssistantControl = await fetch(`${base}/api/assistant-control`);
  assert.equal(unauthenticatedAssistantControl.status, 401);

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

  const sharedAssistantModule = await postJson(base, '/api/library/items', {
    id: 'module.assistant.shared-core',
    kind: 'module',
    name: 'Shared landing assistant module',
    tags: ['assistant', 'shared', 'approved'],
    dependencies: [{ itemId: 'button.hyperreal.glow', revision: 1 }],
    spec: { purpose: 'shared landing assistant behavior and presentation dependency' },
  }, founderToken, 201);
  assert.equal(sharedAssistantModule.item?.revision, 1);

  const assistantBefore = await getJson(
    base,
    '/api/assistant-control',
    founderToken,
    200,
  );
  assert.equal(assistantBefore.surfaces?.length, 3);
  assert.deepEqual(
    assistantBefore.resolved?.map((item) => item.inheritedRevision),
    [1, 1, 1],
  );
  const surfaceChecksumsBefore = assistantBefore.surfaces.map((surface) => surface.checksum);

  const sharedProfileUpdate = await postJson(
    base,
    '/api/assistant-control/profiles/infinity-landing-assistant/revisions',
    {
      sharedInstructions: [
        ...(assistantBefore.profiles?.find(
          (profile) => profile.profileId === 'infinity-landing-assistant' && profile.status === 'current',
        )?.sharedInstructions ?? []),
        'Reuse the approved shared assistant module instead of rebuilding landing behavior per product.',
      ],
      moduleRefs: [{ itemId: 'module.assistant.shared-core', revision: 1 }],
    },
    founderToken,
    201,
  );
  assert.equal(sharedProfileUpdate.profile?.revision, 2);
  assert.equal(sharedProfileUpdate.affectedSurfaces?.length, 3);
  assert.deepEqual(
    sharedProfileUpdate.affectedSurfaces?.map((item) => item.inheritedRevision),
    [2, 2, 2],
  );

  const assistantAfter = await getJson(
    base,
    '/api/assistant-control',
    founderToken,
    200,
  );
  assert.deepEqual(
    assistantAfter.surfaces.map((surface) => surface.checksum),
    surfaceChecksumsBefore,
  );
  assert.deepEqual(
    assistantAfter.resolved.map((item) => item.inheritedRevision),
    [2, 2, 2],
  );
  assert.equal(
    assistantAfter.resolved.every(
      (item) => item.moduleRefs?.[0]?.itemId === 'module.assistant.shared-core',
    ),
    true,
  );

  const generatedBundle = await getJson(
    base,
    '/api/assistant-control/surfaces/landing.iba/bundle',
    founderToken,
    200,
  );
  assert.equal(generatedBundle.bundle?.surfaceId, 'landing.iba');
  assert.equal(generatedBundle.bundle?.profileRevision, 2);
  assert.equal(typeof generatedBundle.bundle?.bundleChecksum, 'string');
  assert.equal(
    JSON.parse(generatedBundle.content).bundleChecksum,
    generatedBundle.bundle.bundleChecksum,
  );

  const unauthenticatedPublishCapability = await postJson(
    base,
    '/api/assistant-control/surfaces/landing.iba/publish',
    {
      confirmAction: 'publish_assistant_surface',
      targetRef: 'feature/iba-live-ai-landing',
    },
    founderToken,
    409,
  );
  assert.match(
    unauthenticatedPublishCapability.error ?? '',
    /GitHub write authentication|required|autorización de escritura/i,
  );
  const deliveryState = await getJson(
    base,
    '/api/assistant-control/deliveries',
    founderToken,
    200,
  );
  assert.equal(deliveryState.deliveries?.length, 0);

  for (const surfaceId of [
    'landing.infinity-group',
    'landing.infinity-chatbox',
    'landing.iba',
  ]) {
    const surfaceConfig = await getJson(
      base,
      `/api/assistant-control/surfaces/${encodeURIComponent(surfaceId)}/config`,
      founderToken,
      200,
    );
    assert.equal(surfaceConfig.config?.inheritedRevision, 2);
  }

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
  // Adaptive effort: Founder ECO on a risky topic is raised to NORMAL and reported; AUTO is the default.
  const effortResponse = await fetch(`${base}/api/command`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: 'Explícame en términos simples qué es un contrato de arrendamiento.', inputMode: 'text', effort: 'eco' }),
  });
  assert.equal(effortResponse.status, 202);
  const effortBody = await effortResponse.json();
  assert.equal(effortBody.effort.requested, 'eco');
  assert.equal(effortBody.effort.level, 'normal');
  assert.equal(effortBody.effort.raisedByRisk, true);
  assert.equal(effortBody.effort.source, 'founder');
  const autoEffortBody = await (await fetch(`${base}/api/command`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: 'Hola Janus', inputMode: 'text' }),
  })).json();
  assert.equal(autoEffortBody.effort.requested, 'auto');
  assert.equal(autoEffortBody.effort.level, 'eco');
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
  const delegatedWithoutFace = await postJson(base, '/api/auth/operator/delegate', {
    principalId: 'operator-smoke',
    displayName: 'Operator Smoke',
    publicKeyPem: operatorKeys.publicKey,
  }, founderToken, 403);
  assert.equal(delegatedWithoutFace.error, 'founder_biometric_required');

  const delegationProof = await founderBiometricProof(
    base,
    founderToken,
    'security.authority.delegate_operator',
    'smoke-face-key',
    founderBiometricKeys.privateKey,
  );
  const delegated = await postJson(base, '/api/auth/operator/delegate', {
    principalId: 'operator-smoke',
    displayName: 'Operator Smoke',
    publicKeyPem: operatorKeys.publicKey,
  }, founderToken, 201, {
    'x-janus-biometric-proof': delegationProof,
  });
  assert.equal(delegated.operator?.principal?.role, 'operator');

  // Buzones del Founder: datos personales, solo con sesión de Founder + prueba biométrica, ; el envío exige su confirmación en cada mensaje.
  const mailAnonymous = await fetch(`${base}/api/founder/mail-accounts`);
  assert.ok(mailAnonymous.status === 401 || mailAnonymous.status === 403, `mail-accounts sin sesión: ${mailAnonymous.status}`);
  const mailWithoutFace = await fetch(`${base}/api/founder/mail-accounts`, { headers: { authorization: `Bearer ${founderToken}` } });
  assert.equal(mailWithoutFace.status, 403);
  assert.equal((await mailWithoutFace.json()).error, 'founder_biometric_required');
  const mailProof = await founderBiometricProof(base, founderToken, 'founder.private.mail_accounts.read', 'smoke-face-key', founderBiometricKeys.privateKey);
  const mailResponse = await fetch(`${base}/api/founder/mail-accounts`, {
    headers: { authorization: `Bearer ${founderToken}`, 'x-janus-biometric-proof': mailProof },
  });
  assert.equal(mailResponse.status, 200);
  const mailBody = await mailResponse.json();
  assert.equal(mailBody.registry?.policy?.supervision, 'founder');
  for (const key of ['autonomousSendAllowed', 'deleteAllowed', 'archiveOrLabelAllowed', 'forwardAllowed', 'autoReplyAllowed']) {
    assert.equal(mailBody.registry.policy[key], false, key);
  }
  assert.equal(mailBody.registry.policy.composeOnFounderInstruction, true);
  assert.equal(mailBody.registry.policy.sendRequiresPerMessageApproval, true);
  assert.equal(mailBody.registry.automaticExternalCalls, false);
  assert.ok(Array.isArray(mailBody.registry.accounts));
  assert.equal(mailBody.registry.plan.length, mailBody.registry.accounts.length);
  // Hermético: sin credenciales, ningún buzón puede estar "ready", y la respuesta no lleva secretos.
  assert.ok(mailBody.registry.plan.every((item) => item.readiness !== 'ready'));
  assert.doesNotMatch(JSON.stringify(mailBody), /Bearer |access_token|refresh_token/i);

  // Almacén cifrado y consentimiento de Google: se describen sin secretos; iniciar y revocar exigen Founder + biometría.
  assert.equal(mailBody.registry.credentialRuntime?.vaultConfigured, true);
  assert.equal(mailBody.registry.credentialRuntime?.googleOAuthConfigured, true);
  assert.equal(mailBody.registry.credentialRuntime?.redirectUri, `${base}/api/oauth/google/callback`);
  assert.equal(mailBody.registry.credentialRuntime?.threadsTokenStored, false);
  const googleMailbox = mailBody.registry.accounts.find((account) => account.provider === 'google' && account.permittedWriteActions.length > 0);
  if (googleMailbox) {
    const startPath = `/api/founder/mail-accounts/${encodeURIComponent(googleMailbox.accountId)}/oauth/start`;
    const anonymousStart = await fetch(`${base}${startPath}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'read', confirmAction: 'start_google_consent' }) });
    assert.ok(anonymousStart.status === 401 || anonymousStart.status === 403, `oauth/start sin sesión: ${anonymousStart.status}`);
    const startWithoutFace = await fetch(`${base}${startPath}`, { method: 'POST', headers: { authorization: `Bearer ${founderToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'read', confirmAction: 'start_google_consent' }) });
    assert.equal(startWithoutFace.status, 403);
    const startProof = await founderBiometricProof(base, founderToken, 'founder.private.mail_oauth.start', 'smoke-face-key', founderBiometricKeys.privateKey);
    const started = await fetch(`${base}${startPath}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${founderToken}`, 'content-type': 'application/json', 'x-janus-biometric-proof': startProof },
      body: JSON.stringify({ mode: 'read', confirmAction: 'start_google_consent' }),
    });
    assert.equal(started.status, 200);
    const startedBody = await started.json();
    const authUrl = new URL(startedBody.authorizationUrl);
    assert.equal(authUrl.origin + authUrl.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
    assert.equal(authUrl.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(authUrl.searchParams.get('redirect_uri'), `${base}/api/oauth/google/callback`);
    assert.equal(authUrl.searchParams.get('login_hint'), googleMailbox.address);
    assert.ok(!(authUrl.searchParams.get('scope') ?? '').includes('compose'), 'la lectura no pide permisos de escritura');
    assert.doesNotMatch(startedBody.authorizationUrl, /client_secret/);
    // Un modo inválido y una cuenta desconocida se rechazan (cada intento consume su propia prueba).
    const badModeProof = await founderBiometricProof(base, founderToken, 'founder.private.mail_oauth.start', 'smoke-face-key', founderBiometricKeys.privateKey);
    const badMode = await fetch(`${base}${startPath}`, { method: 'POST', headers: { authorization: `Bearer ${founderToken}`, 'content-type': 'application/json', 'x-janus-biometric-proof': badModeProof }, body: JSON.stringify({ mode: 'admin', confirmAction: 'start_google_consent' }) });
    assert.equal(badMode.status, 400);
  }
  const callbackBogus = await fetch(`${base}/api/oauth/google/callback?state=inventado&code=x%3Cscript%3E`);
  assert.equal(callbackBogus.status, 400);
  const callbackBody = await callbackBogus.text();
  assert.doesNotMatch(callbackBody, /inventado|<script>/, 'nada de la URL se refleja en la página');
  assert.match(callbackBogus.headers.get('content-security-policy') ?? '', /default-src 'none'/);
  const callbackDenied = await fetch(`${base}/api/oauth/google/callback?error=access_denied&state=inventado`);
  assert.equal(callbackDenied.status, 200);

  // Token de Threads: se guarda cifrado, no se devuelve nunca y se puede retirar.
  const threadsSecret = 'THREADS-TOKEN-DE-PRUEBA-HUMO';
  const threadsPath = '/api/founder/social-credentials/threads';
  const threadsNoFace = await fetch(`${base}${threadsPath}`, { method: 'POST', headers: { authorization: `Bearer ${founderToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ accessToken: threadsSecret, confirmAction: 'store_threads_token' }) });
  assert.equal(threadsNoFace.status, 403);
  const threadsProof = await founderBiometricProof(base, founderToken, 'founder.private.social_credentials.write', 'smoke-face-key', founderBiometricKeys.privateKey);
  const threadsStored = await fetch(`${base}${threadsPath}`, { method: 'POST', headers: { authorization: `Bearer ${founderToken}`, 'content-type': 'application/json', 'x-janus-biometric-proof': threadsProof }, body: JSON.stringify({ accessToken: threadsSecret, confirmAction: 'store_threads_token' }) });
  assert.equal(threadsStored.status, 200);
  const threadsStoredText = await threadsStored.text();
  assert.doesNotMatch(threadsStoredText, /THREADS-TOKEN-DE-PRUEBA/);
  assert.equal(JSON.parse(threadsStoredText).status?.hasAccessToken, true);
  const mailProof2 = await founderBiometricProof(base, founderToken, 'founder.private.mail_accounts.read', 'smoke-face-key', founderBiometricKeys.privateKey);
  const mailAfter = await (await fetch(`${base}/api/founder/mail-accounts`, { headers: { authorization: `Bearer ${founderToken}`, 'x-janus-biometric-proof': mailProof2 } })).json();
  assert.equal(mailAfter.registry.credentialRuntime.threadsTokenStored, true);
  assert.doesNotMatch(JSON.stringify(mailAfter), /THREADS-TOKEN-DE-PRUEBA/);
  const removeProof = await founderBiometricProof(base, founderToken, 'founder.private.social_credentials.write', 'smoke-face-key', founderBiometricKeys.privateKey);
  const threadsRemoved = await fetch(`${base}${threadsPath}/remove`, { method: 'POST', headers: { authorization: `Bearer ${founderToken}`, 'content-type': 'application/json', 'x-janus-biometric-proof': removeProof }, body: JSON.stringify({ confirmAction: 'remove_threads_token' }) });
  assert.equal(threadsRemoved.status, 200);
  assert.equal((await threadsRemoved.json()).removed, true);
  assert.doesNotMatch(stdout + stderr, /THREADS-TOKEN-DE-PRUEBA/, 'el token no aparece en los registros del runtime');

  // Seguimiento de redes: lectura bajo Founder + biometría; el planificador es opt-in (sin intervalo, desactivado).
  const watchNoFace = await fetch(`${base}/api/founder/social-watch`, { headers: { authorization: `Bearer ${founderToken}` } });
  assert.equal(watchNoFace.status, 403);
  const watchProof = await founderBiometricProof(base, founderToken, 'founder.private.social_watch.read', 'smoke-face-key', founderBiometricKeys.privateKey);
  const watchStatus = await (await fetch(`${base}/api/founder/social-watch`, { headers: { authorization: `Bearer ${founderToken}`, 'x-janus-biometric-proof': watchProof } })).json();
  assert.equal(watchStatus.scheduler.enabled, false);
  assert.equal(watchStatus.lastReport, null);
  const runNoConfirm = await founderBiometricProof(base, founderToken, 'founder.private.social_watch.run', 'smoke-face-key', founderBiometricKeys.privateKey);
  const runRejected = await fetch(`${base}/api/founder/social-watch/run`, { method: 'POST', headers: { authorization: `Bearer ${founderToken}`, 'content-type': 'application/json', 'x-janus-biometric-proof': runNoConfirm }, body: JSON.stringify({}) });
  assert.equal(runRejected.status, 409);
  const runProof = await founderBiometricProof(base, founderToken, 'founder.private.social_watch.run', 'smoke-face-key', founderBiometricKeys.privateKey);
  const watchRun = await fetch(`${base}/api/founder/social-watch/run`, { method: 'POST', headers: { authorization: `Bearer ${founderToken}`, 'content-type': 'application/json', 'x-janus-biometric-proof': runProof }, body: JSON.stringify({ confirmAction: 'run_social_watch' }) });
  assert.equal(watchRun.status, 200);
  const watchReport = (await watchRun.json()).report;
  // Hermético: sin tokens de Meta ni Threads nada puede leerse; todo queda «omitido» con su siguiente paso, sin llamadas externas.
  assert.equal(watchReport.summary.read, 0);
  assert.equal(watchReport.summary.failed, 0);
  assert.ok(watchReport.items.every((item) => item.status === 'skipped'));

  // Teléfono del Founder: mismo blindaje (Founder + biometría), solo descripción y plan, nada autónomo.
  const phoneAnonymous = await fetch(`${base}/api/founder/phone-channels`);
  assert.ok(phoneAnonymous.status === 401 || phoneAnonymous.status === 403, `phone-channels sin sesión: ${phoneAnonymous.status}`);
  const phoneWithoutFace = await fetch(`${base}/api/founder/phone-channels`, { headers: { authorization: `Bearer ${founderToken}` } });
  assert.equal(phoneWithoutFace.status, 403);
  assert.equal((await phoneWithoutFace.json()).error, 'founder_biometric_required');
  const phoneProof = await founderBiometricProof(base, founderToken, 'founder.private.phone_channels.read', 'smoke-face-key', founderBiometricKeys.privateKey);
  const phoneResponse = await fetch(`${base}/api/founder/phone-channels`, {
    headers: { authorization: `Bearer ${founderToken}`, 'x-janus-biometric-proof': phoneProof },
  });
  assert.equal(phoneResponse.status, 200, await phoneResponse.clone().text());
  const phoneBody = await phoneResponse.json();
  for (const key of ['autonomousSendAllowed', 'autonomousCallAllowed', 'voiceImpersonationAllowed', 'unofficialWhatsAppClientsAllowed']) {
    assert.equal(phoneBody.registry.policy[key], false, key);
  }
  assert.equal(phoneBody.registry.policy.sendRequiresPerMessageApproval, true);
  assert.equal(phoneBody.registry.policy.callPlacementRequiresPerCallApproval, true);
  assert.equal(phoneBody.registry.automaticExternalCalls, false);
  assert.equal(phoneBody.registry.plan.length, phoneBody.registry.channels.length);
  for (const channel of phoneBody.registry.plan) {
    assert.ok(channel.routes.every((route) => route.tier !== 'L3' || route.status === 'refused'), 'ninguna ruta autónoma disponible');
    // Sin adaptadores de teléfono registrados, ninguna ruta de API/voz puede estar disponible.
    assert.ok(channel.routes.every((route) => route.tier === 'L1' || route.status !== 'available_now'));
  }
  assert.doesNotMatch(JSON.stringify(phoneBody), /Bearer |access_token|refresh_token|as-provided/i);

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

  const privateProjectResponse = await fetch(`${base}/api/projects/project-smoke/context`, {
    headers: { authorization: `Bearer ${operatorToken}` },
  });
  assert.equal(privateProjectResponse.status, 403);

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

  const googleDecisionResponse = await fetch(
    `${base}/api/runs/${encodeURIComponent(googleRunId)}/decisions`,
  );
  assert.equal(googleDecisionResponse.status, 200);
  const googleDecisions = await googleDecisionResponse.json();
  const blockerResolution = googleDecisions.receipts?.find(
    (receipt) => receipt?.decisionKind === 'blocker_resolution',
  );
  assert.equal(blockerResolution?.metadata?.resolution?.alternatives?.length, 3);
  assert.equal(
    blockerResolution?.metadata?.resolution?.disposition,
    'park_and_continue',
  );

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
  if (forbiddenLog.length) console.error('--- respuestas 403 observadas ---\n' + forbiddenLog.join('\n'));
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

async function founderBiometricProof(
  baseUrl,
  founderToken,
  action,
  keyId,
  privateKey,
) {
  const challengeResponse = await fetch(`${baseUrl}/api/auth/biometric/challenge`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${founderToken}`,
    },
    body: JSON.stringify({ action }),
  });
  assert.equal(challengeResponse.status, 200);
  const challengeBody = await challengeResponse.json();
  const signingPayload = challengeBody.challenge?.signingPayload;
  assert.equal(typeof signingPayload, 'string');

  const signature = sign(
    'sha256',
    Buffer.from(signingPayload, 'utf8'),
    privateKey,
  ).toString('base64url');
  const verifyResponse = await fetch(`${baseUrl}/api/auth/biometric/verify`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${founderToken}`,
    },
    body: JSON.stringify({
      challengeId: challengeBody.challenge.id,
      keyId,
      signature,
    }),
  });
  assert.equal(verifyResponse.status, 200);
  const verifyBody = await verifyResponse.json();
  assert.equal(typeof verifyBody.proof?.proofId, 'string');
  return verifyBody.proof.proofId;
}

async function postJson(baseUrl, path, body, token, expectedStatus, extraHeaders = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...extraHeaders,
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
