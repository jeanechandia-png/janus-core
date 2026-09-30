import { randomUUID } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ChatCompletionsModelAdapter } from '../../packages/adapters/src/chat-completions-model-adapter.js';
import { GitHubAdapter } from '../../packages/adapters/src/github-adapter.js';
import { GoogleWorkspaceAdapter } from '../../packages/adapters/src/google-workspace-adapter.js';
import { Qwen3TtsHttpAdapter } from '../../packages/adapters/src/qwen3-tts-http-adapter.js';
import { WhisperCppSttAdapter } from '../../packages/adapters/src/whisper-cpp-stt-adapter.js';
import { CapabilityRegistry } from '../../packages/core/src/capability-registry.js';
import { ErrorLedger, reconstructContinuity } from '../../packages/core/src/continuity.js';
import { classifyExplicitContinuity } from '../../packages/core/src/continuity-classifier.js';
import { DeliveryGate } from '../../packages/core/src/delivery-gate.js';
import type { AuthorityPrincipal } from '../../packages/core/src/authority.js';
import {
  assertAssignmentAccess,
  buildCoordinationBrief,
  canAccessCoordinationScope,
  createCoordinationHandoff,
  validateCoordinationAssignment,
  validateCoordinationGrant,
  validateCoordinationScope,
} from '../../packages/core/src/operator-coordination.js';
import {
  buildProjectCheckpoint,
  projectRecords,
  validateProjectResource,
  validateProjectThread,
  validateProjectWorkspace,
} from '../../packages/core/src/project-context.js';
import {
  assertReusableRevisionAppendOnly,
  createReusableLibraryItem,
  resolveReusableSelection,
  type ReusableLibraryKind,
} from '../../packages/core/src/reusable-library.js';
import type { DecisionBlueprint } from '../../packages/core/src/decision-blueprint.js';
import { verifyReceiptChain } from '../../packages/core/src/decision-receipt.js';
import { createOfflineQualityReviewers } from '../../packages/core/src/quality-reviewers.js';
import {
  appendChainedDecisionReceipt,
  createRuntimeDecisionBlueprint,
} from '../../packages/core/src/runtime-decision-trace.js';
import {
  applyApprovedRuntimeBlueprint,
  approveRuntimeImprovementProposal,
  buildRuntimeBlueprintCandidate,
  rejectRuntimeImprovementProposal,
  resolveActiveRuntimeBlueprint,
  rollbackRuntimeBlueprint,
} from '../../packages/core/src/runtime-blueprint-governance.js';
import {
  assessVerifiedRunOutcome,
  createRuntimeLearningObservation,
  deriveRuntimeExecutionPrediction,
  maybeProposeRuntimeImprovement,
  runtimeLearningReport,
} from '../../packages/core/src/runtime-outcome-learning.js';
import { EventHub } from '../../packages/core/src/event-hub.js';
import type { EventSink, RunSnapshot } from '../../packages/core/src/events.js';
import { SqliteStore } from '../../packages/core/src/sqlite-store.js';
import {
  TaskRunner,
  type JanusStep,
  type TaskAuthorityContext,
} from '../../packages/core/src/task-runner.js';
import type { ModelGateway, VoiceGateway } from '../../packages/gateways/src/contracts.js';
import { DefaultToolGateway } from '../../packages/gateways/src/tool-gateway.js';
import { compilePlan } from '../../packages/orchestrator/src/compile-plan.js';
import { deterministicPlan } from '../../packages/orchestrator/src/deterministic-planner.js';
import { planWithModel } from '../../packages/orchestrator/src/model-planner.js';
import { validatePlan, type JanusPlan } from '../../packages/orchestrator/src/plan.js';
import {
  CredentialBroker,
  EnvironmentCredentialProvider,
} from '../../packages/security/src/credential-provider.js';
import {
  AuthorityAuthenticationError,
  LocalAuthorityAuthService,
  type AuthorityCredentialStore,
} from '../../packages/security/src/authority-auth.js';
import {
  bearerTokenFromAuthorization,
  confirmedActionsFromBody,
  isSecureAuthorityTransport,
} from '../../packages/security/src/http-auth.js';
import { CompositeVoiceGateway } from '../../packages/voice/src/composite-gateway.js';
import { VoiceSessionRegistry } from '../../packages/voice/src/registry.js';
import { safeSpokenRunSummary } from '../../packages/voice/src/run-response.js';
import { VoiceStreamServer } from '../../packages/voice/src/websocket-transport.js';

const port = Number(process.env.PORT ?? 8787);
const root = fileURLToPath(new URL('../pwa/', import.meta.url));
const dbPath = process.env.JANUS_DB ?? join(process.cwd(), 'data', 'janus.db');
const timeZone = process.env.JANUS_TIME_ZONE?.trim() || undefined;
const sttBaseUrl = process.env.JANUS_STT_BASE_URL?.trim() || undefined;
const ttsBaseUrl = process.env.JANUS_TTS_BASE_URL?.trim() || undefined;
const defaultVoiceId = process.env.JANUS_VOICE_ID?.trim() || 'janus-default';
const trustSecureAuthProxy = process.env.JANUS_AUTH_TRUST_SECURE_PROXY === 'true';

const environmentCredentials = new EnvironmentCredentialProvider({
  serviceVariables: {
    github: 'GITHUB_TOKEN',
    'google-workspace': 'GOOGLE_ACCESS_TOKEN',
    model: 'JANUS_MODEL_API_KEY',
  },
});
const credentialBroker = new CredentialBroker([environmentCredentials]);

const hub = new EventHub();
const store = new SqliteStore(dbPath);
const authorityCredentialStore: AuthorityCredentialStore = {
  get: (principalId) => store.getAuthorityCredential(principalId),
  list: (activeOnly) => store.listAuthorityCredentials(activeOnly),
  upsert: (credential) => store.upsertAuthorityCredential(credential),
  revoke: (principalId, revokedAt) => store.revokeAuthorityCredential(principalId, revokedAt),
};
const authorityAuth = new LocalAuthorityAuthService(authorityCredentialStore);
const configuredFounderPublicKey = environmentPem('JANUS_FOUNDER_PUBLIC_KEY_PEM');
if (configuredFounderPublicKey) {
  authorityAuth.ensureFounderCredential(
    configuredFounderPublicKey,
    process.env.JANUS_FOUNDER_DISPLAY_NAME?.trim() || undefined,
  );
}
const runners = new Map<string, TaskRunner>();
const runBlueprints = new Map<string, DecisionBlueprint>();
const runAssignments = new Map<string, { assignmentId: string; principalId: string }>();
const runProjects = new Map<string, { projectId: string; threadId: string }>();
const toolGateway = new DefaultToolGateway();
const capabilities = new CapabilityRegistry();
const deliveryGate = new DeliveryGate(createOfflineQualityReviewers());

toolGateway.register(new GitHubAdapter({
  tokenProvider: () => credentialBroker.accessToken('github'),
}));
toolGateway.register(new GoogleWorkspaceAdapter({
  tokenProvider: async () => (
    await credentialBroker.accessToken('google-workspace', [
      'drive.metadata.readonly',
      'gmail.readonly',
      'calendar.events.readonly',
    ])
  ) ?? '',
}));

const googleConfigured = environmentCredentials.configured('google-workspace');
capabilities.register({
  tool: 'github',
  actions: ['repo.get', 'contents.list', 'file.read'],
  state: 'available',
});
capabilities.register({
  tool: 'google-workspace',
  actions: ['drive.files.search', 'gmail.messages.search', 'calendar.events.list'],
  state: googleConfigured ? 'available' : 'needs_auth',
  ...(!googleConfigured ? { reason: 'Google Workspace necesita autorización antes de ejecutar.' } : {}),
});

let runtimeBlueprint = resolveActiveRuntimeBlueprint(
  store,
  createRuntimeDecisionBlueprint({
    createdAt: '2026-09-30T18:30:00.000Z',
    toolCatalog: capabilityPolicyCatalog(),
  }),
);

const modelGateway = createConfiguredModelGateway();
const voiceGateway = createConfiguredVoiceGateway();

const voiceSessions = new VoiceSessionRegistry((sessionId) => ({
  start: async (text) => startRun(text, 'voice', sessionId),
  pause: async (runId) => controlActiveRun(runId, 'pause'),
  resume: async (runId) => controlActiveRun(runId, 'resume'),
  cancel: async (runId) => controlActiveRun(runId, 'cancel'),
}));

const interruptedRuns = store.markInterruptedRuns();
hub.hydrate(store.listEvents(undefined, 500));
if (interruptedRuns > 0) {
  console.warn(`Recovered ${interruptedRuns} interrupted Janus run(s) as blocked.`);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function continuitySnapshot(projectId?: string) {
  const records = store.listChronologyRecords();
  return reconstructContinuity(
    projectId ? projectRecords(records, projectId) : records,
    new ErrorLedger(store.listErrorLessons()),
  );
}

function coordinationBriefFor(principal: AuthorityPrincipal) {
  return buildCoordinationBrief({
    principal,
    operators: store.listCoordinationOperators(),
    scopes: store.listCoordinationScopes(),
    grants: store.listCoordinationGrants(),
    assignments: store.listCoordinationAssignments(),
    handoffs: store.listCoordinationHandoffs(),
  });
}

function canAccessProject(
  principal: AuthorityPrincipal,
  project: NonNullable<ReturnType<SqliteStore['getProjectWorkspace']>>,
  permission: 'read_context' | 'write_work' = 'read_context',
): boolean {
  if (principal.role === 'founder_director') return true;
  if (project.createdBy === principal.id) return true;
  const scopeId = project.coordinationScopeId;
  if (!scopeId) return false;
  const scope = store.listCoordinationScopes().find((item) => item.id === scopeId);
  if (!scope) return false;
  return canAccessCoordinationScope({
    principal,
    scope,
    grants: store.listCoordinationGrants(),
    permission,
  });
}

function requireProjectAccess(
  principal: AuthorityPrincipal,
  project: NonNullable<ReturnType<SqliteStore['getProjectWorkspace']>>,
  permission: 'read_context' | 'write_work' = 'read_context',
): void {
  if (!canAccessProject(principal, project, permission)) {
    throw new HttpRequestError(403, 'project access denied');
  }
}

function projectContextFor(projectId: string, principal: AuthorityPrincipal) {
  const project = store.getProjectWorkspace(projectId);
  if (!project) throw new HttpRequestError(404, 'project not found');
  requireProjectAccess(principal, project, 'read_context');
  const continuity = continuitySnapshot(projectId);
  return {
    project,
    threads: store.listProjectThreads(projectId),
    resources: store.listProjectResources(projectId),
    latestCheckpoint: store.latestProjectCheckpoint(projectId),
    continuity,
  };
}

function reusableKind(value: unknown): ReusableLibraryKind | null {
  const allowed = new Set<ReusableLibraryKind>([
    'symbol', 'photo', 'logo', 'icon', 'button', 'font', 'design_token',
    'theme', 'component', 'module', 'template', 'workflow', 'prompt', 'other',
  ]);
  return typeof value === 'string' && allowed.has(value as ReusableLibraryKind)
    ? value as ReusableLibraryKind
    : null;
}

function coordinationStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean))]
    : [];
}

function capabilityPolicyCatalog(): Record<string, string[]> {
  const catalog: Record<string, string[]> = {};
  for (const capability of capabilities.snapshot()) {
    (catalog[capability.tool] ??= []).push(capability.action);
  }
  for (const actions of Object.values(catalog)) actions.sort();
  return catalog;
}

function blueprintForRun(runId: string): DecisionBlueprint {
  return runBlueprints.get(runId) ?? runtimeBlueprint;
}

function blueprintExecutionPolicy(blueprint: DecisionBlueprint): {
  allowedTools: Set<string>;
  allowedActions: Map<string, Set<string>>;
  toolCatalog: Record<string, string[]>;
} {
  const allowedTools = new Set<string>();
  const allowedActions = new Map<string, Set<string>>();
  const available = capabilities.availableCatalog();
  const toolCatalog: Record<string, string[]> = {};

  for (const policy of blueprint.tools) {
    const availableActions = new Set(available[policy.tool] ?? []);
    const actions = policy.actions.filter((action) => availableActions.has(action));
    if (actions.length === 0) continue;
    allowedTools.add(policy.tool);
    allowedActions.set(policy.tool, new Set(actions));
    toolCatalog[policy.tool] = [...actions].sort();
  }

  return { allowedTools, allowedActions, toolCatalog };
}

function recordDecision(input: {
  runId: string;
  decisionKind: string;
  selectedWorker: string;
  confidence: number;
  inputRefs?: string[];
  outputSummary: string;
  metadata?: Record<string, unknown>;
}) {
  const blueprint = blueprintForRun(input.runId);
  return appendChainedDecisionReceipt(store, {
    blueprint,
    runId: input.runId,
    decisionKind: input.decisionKind,
    selectedWorker: input.selectedWorker,
    confidence: input.confidence,
    inputRefs: input.inputRefs ?? [
      'run:' + input.runId,
      'blueprint:' + blueprint.id + '@' + blueprint.revision,
    ],
    outputSummary: input.outputSummary,
    ...(input.metadata ? { metadata: input.metadata } : {}),
  });
}

function outcomeLearningSnapshot() {
  const observations = store
    .listLearningObservations(runtimeBlueprint.id)
    .filter(
      (observation) =>
        observation.blueprintRevision === runtimeBlueprint.revision,
    );
  const report = runtimeLearningReport(observations);
  const executionPrediction = deriveRuntimeExecutionPrediction(observations);
  const proposals = store.listImprovementProposals().filter(
    (proposal) =>
      proposal.blueprintId === runtimeBlueprint.id
      && proposal.fromRevision === runtimeBlueprint.revision,
  );
  return {
    observations,
    calibration: report.calibration,
    drift: report.drift,
    executionPrediction,
    proposals,
  };
}

function recordRunOutcome(snapshot: RunSnapshot): void {
  const existingReceipts = store.listDecisionReceipts(snapshot.runId);
  if (existingReceipts.some((receipt) => receipt.decisionKind === 'run_outcome')) return;

  const prediction = existingReceipts
    .filter((receipt) => receipt.decisionKind === 'execution_prediction')
    .at(-1);
  const learningBlueprint = prediction
    ? store.getDecisionBlueprint(prediction.blueprintId, prediction.blueprintRevision)
    : blueprintForRun(snapshot.runId);
  if (!learningBlueprint) {
    throw new Error('Run Blueprint is unavailable for outcome learning');
  }
  const assessment = assessVerifiedRunOutcome(
    snapshot,
    store.listEvents(snapshot.runId),
    { hasExecutionPrediction: Boolean(prediction) },
  );

  const outcomeReceipt = recordDecision({
    runId: snapshot.runId,
    decisionKind: 'run_outcome',
    selectedWorker: 'janus-core/runtime-outcome-learning-v1',
    confidence: 1,
    inputRefs: assessment.evidenceRefs.length > 0
      ? assessment.evidenceRefs
      : ['run:' + snapshot.runId],
    outputSummary:
      'Observed runtime outcome: '
      + assessment.outcome
      + ' (score '
      + assessment.outcomeScore.toFixed(2)
      + ').',
    metadata: {
      runStatus: snapshot.status,
      outcome: assessment.outcome,
      outcomeScore: assessment.outcomeScore,
      learningEligible: assessment.learningEligible && Boolean(prediction),
      reasons: assessment.reasons,
      metrics: assessment.metrics,
      predictionReceiptHash: prediction?.hash ?? null,
    },
  });

  if (!prediction || !assessment.learningEligible) return;

  const observation = createRuntimeLearningObservation({
    snapshot,
    blueprint: learningBlueprint,
    prediction,
    assessment,
  });
  store.appendLearningObservation(observation);

  const observations = store
    .listLearningObservations(learningBlueprint.id)
    .filter(
      (item) => item.blueprintRevision === learningBlueprint.revision,
    );
  const proposal = learningBlueprint.status === 'active'
    ? maybeProposeRuntimeImprovement({
        blueprint: learningBlueprint,
        observations,
        existingProposals: store.listImprovementProposals(),
        createdAt: snapshot.updatedAt,
      })
    : null;
  if (proposal) {
    store.upsertImprovementProposal(proposal);
    recordDecision({
      runId: snapshot.runId,
      decisionKind: 'improvement_proposal',
      selectedWorker: 'janus-core/outcome-drift-detector',
      confidence: 1,
      inputRefs: ['receipt:' + outcomeReceipt.hash, ...proposal.evidenceRefs],
      outputSummary:
        'Negative outcome drift produced a human-approval-required improvement proposal.',
      metadata: {
        proposalId: proposal.id,
        fromRevision: proposal.fromRevision,
        status: proposal.status,
        requiresHumanApproval: proposal.requiresHumanApproval,
      },
    });
  }
}

function createConfiguredModelGateway(): ModelGateway | undefined {
  const baseUrl = process.env.JANUS_MODEL_BASE_URL?.trim();
  const model = process.env.JANUS_MODEL_NAME?.trim();
  if (!baseUrl || !model) return undefined;

  return new ChatCompletionsModelAdapter({
    baseUrl,
    model,
    providerName: process.env.JANUS_MODEL_PROVIDER?.trim() || undefined,
    tokenProvider: () => credentialBroker.accessToken('model'),
    supportsJsonMode: process.env.JANUS_MODEL_JSON_MODE === 'true',
  });
}

function createConfiguredVoiceGateway(): VoiceGateway | undefined {
  if (!sttBaseUrl || !ttsBaseUrl) return undefined;

  const stt = new WhisperCppSttAdapter({
    baseUrl: sttBaseUrl,
    language: process.env.JANUS_STT_LANGUAGE?.trim() || 'auto',
    allowRemote: process.env.JANUS_STT_ALLOW_REMOTE === 'true',
  });
  const tts = new Qwen3TtsHttpAdapter({
    baseUrl: ttsBaseUrl,
    language: process.env.JANUS_TTS_LANGUAGE?.trim() || 'Auto',
    instruct: process.env.JANUS_TTS_INSTRUCT?.trim() || undefined,
    chunkMs: numericEnv('JANUS_TTS_CHUNK_MS'),
    allowRemote: process.env.JANUS_TTS_ALLOW_REMOTE === 'true',
  });
  return new CompositeVoiceGateway(stt, tts);
}

function numericEnv(name: string): number | undefined {
  const raw = process.env[name]?.trim();
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function environmentPem(name: string): string | undefined {
  const raw = process.env[name]?.trim();
  if (!raw) return undefined;
  return raw.replace(/\\n/g, '\n').trim();
}

class HttpRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpRequestError';
    this.status = status;
  }
}

function requireSecureAuthorityTransport(request: IncomingMessage): void {
  const forwardedProto = request.headers['x-forwarded-proto'];
  if (isSecureAuthorityTransport({
    remoteAddress: request.socket.remoteAddress,
    forwardedProto,
    trustSecureProxy: trustSecureAuthProxy,
  })) return;

  throw new HttpRequestError(
    426,
    'Authority authentication requires loopback or an explicitly trusted HTTPS proxy.',
  );
}

function bearerToken(request: IncomingMessage): string | undefined {
  return bearerTokenFromAuthorization(request.headers.authorization);
}

function requireAuthoritySession(request: IncomingMessage): {
  token: string;
  principal: NonNullable<ReturnType<typeof authorityAuth.authenticateSession>>;
} {
  requireSecureAuthorityTransport(request);
  const token = bearerToken(request);
  if (!token) throw new HttpRequestError(401, 'Authority session is required');
  const principal = authorityAuth.authenticateSession(token);
  if (!principal) throw new HttpRequestError(401, 'Authority session is invalid or expired');
  return { token, principal };
}

function requireFounderAuthority(request: IncomingMessage): {
  token: string;
  principal: NonNullable<ReturnType<typeof authorityAuth.authenticateSession>>;
} {
  const session = requireAuthoritySession(request);
  if (session.principal.role !== 'founder_director') {
    throw new HttpRequestError(
      403,
      'Authenticated Founder/Director authority is required for Blueprint governance',
    );
  }
  return session;
}

function authorityContextForCommand(
  request: IncomingMessage,
  command: string,
  body: Record<string, unknown>,
): TaskAuthorityContext | undefined {
  const token = bearerToken(request);
  if (!token) return undefined;

  requireSecureAuthorityTransport(request);
  const principal = authorityAuth.authenticateSession(token);
  if (!principal) throw new HttpRequestError(401, 'Authority session is invalid or expired');

  return {
    principal,
    instruction: {
      id: `authority_instruction_${randomUUID()}`,
      principalId: principal.id,
      source: 'authenticated_human',
      authenticated: true,
      instruction: command,
      requestedAt: new Date().toISOString(),
    },
    confirmedActions: confirmedActionsFromBody(body.confirmActions),
  };
}

function authErrorStatus(error: unknown): number {
  if (error instanceof HttpRequestError) return error.status;
  if (!(error instanceof AuthorityAuthenticationError)) return 500;

  switch (error.code) {
    case 'invalid_principal':
    case 'invalid_public_key':
      return 400;
    case 'invalid_challenge':
    case 'challenge_expired':
    case 'invalid_signature':
    case 'invalid_session':
    case 'credential_unavailable':
      return 401;
    case 'founder_required':
      return 403;
    case 'administrator_required':
    case 'operator_required':
    case 'founder_credential_mismatch':
      return 409;
  }
}

function authErrorBody(error: unknown): { ok: false; error: string; code?: string } {
  if (error instanceof AuthorityAuthenticationError) {
    return { ok: false, error: error.message, code: error.code };
  }
  if (error instanceof HttpRequestError) {
    return { ok: false, error: error.message };
  }
  return {
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  };
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

function blueprintCandidateFromBody(
  body: Record<string, unknown>,
  current: DecisionBlueprint,
): DecisionBlueprint {
  const raw = body.candidate;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new HttpRequestError(400, 'candidate Blueprint content is required');
  }
  const candidate = raw as Record<string, unknown>;
  if (
    typeof candidate.objective !== 'string'
    || !candidate.modelPolicy
    || typeof candidate.modelPolicy !== 'object'
    || Array.isArray(candidate.modelPolicy)
    || !Array.isArray(candidate.agents)
    || !Array.isArray(candidate.tools)
    || !Array.isArray(candidate.guardrails)
    || !Array.isArray(candidate.successMetrics)
  ) {
    throw new HttpRequestError(400, 'candidate Blueprint content is malformed');
  }

  try {
    return buildRuntimeBlueprintCandidate({
      store,
      current,
      content: {
        objective: candidate.objective,
        modelPolicy: candidate.modelPolicy as DecisionBlueprint['modelPolicy'],
        agents: candidate.agents as DecisionBlueprint['agents'],
        tools: candidate.tools as DecisionBlueprint['tools'],
        guardrails: candidate.guardrails as DecisionBlueprint['guardrails'],
        successMetrics: candidate.successMetrics as DecisionBlueprint['successMetrics'],
      },
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    throw new HttpRequestError(
      400,
      'Invalid candidate Blueprint: '
      + (error instanceof Error ? error.message : String(error)),
    );
  }
}

function appendGovernanceDecision(input: {
  subject: string;
  content: string;
  principalId: string;
  metadata?: Record<string, unknown>;
}): void {
  const at = new Date().toISOString();
  const previous = continuitySnapshot().currentBySubject[input.subject];
  store.appendChronologyRecord({
    id: 'governance:' + randomUUID(),
    sessionId: 'janus-governance',
    at,
    kind: 'decision',
    subject: input.subject,
    content: input.content,
    status: 'current',
    ...(previous ? { supersedesId: previous.id } : {}),
    metadata: {
      principalId: input.principalId,
      ...(input.metadata ?? {}),
    },
  });
}

function demoSteps(command: string): JanusStep[] {
  return [
    {
      id: 'understand',
      label: 'Entender el objetivo',
      run: async ({ emit, checkpoint }) => {
        await checkpoint();
        await emit('tool.started', 'Analizando la solicitud', { command }, 'model');
        await sleep(250);
        await checkpoint();
        await emit('tool.progress', 'Objetivo identificado; aún no hay adaptador real para esta acción', {
          percent: 100,
        }, 'model');
        await emit('tool.completed', 'Solicitud clasificada', {}, 'model');
      },
    },
    {
      id: 'deliver',
      label: 'Mostrar estado',
      run: async ({ emit, checkpoint }) => {
        await checkpoint();
        await emit('artifact.updated', 'Janus necesita un adaptador para ejecutar esta tarea', {
          preview: 'El Core entendió la orden, pero todavía no existe una herramienta real autorizada para ejecutarla.',
        });
      },
    },
  ];
}

async function prepareSteps(command: string, runId: string): Promise<JanusStep[] | null> {
  const projectLink = runProjects.get(runId);
  const continuity = continuitySnapshot(projectLink?.projectId);
  const blueprint = blueprintForRun(runId);
  const executionPolicy = blueprintExecutionPolicy(blueprint);
  let plan: JanusPlan | null = deterministicPlan(command, { timeZone });
  let planningWorker = 'janus-core/deterministic-planner';
  let planningConfidence = 1;
  let planningMetadata: Record<string, unknown> = { source: 'deterministic' };

  if (!plan && modelGateway) {
    const modelResult = await planWithModel(command, {
      modelGateway,
      toolCatalog: executionPolicy.toolCatalog,
      context: {
        ...(timeZone ? { timeZone } : {}),
        executionPolicy: 'Janus Core validates every proposed step before execution',
        decisionBlueprint: {
          id: blueprint.id,
          revision: blueprint.revision,
          objective: blueprint.objective,
          modelPolicy: blueprint.modelPolicy,
          guardrails: blueprint.guardrails,
        },
        project: projectLink
          ? {
              id: projectLink.projectId,
              threadId: projectLink.threadId,
              latestCheckpoint: store.latestProjectCheckpoint(projectLink.projectId),
              resources: store.listProjectResources(projectLink.projectId).slice(-100).map((resource) => ({
                id: resource.id,
                name: resource.name,
                source: resource.source,
                sourceRef: resource.sourceRef,
                mimeType: resource.mimeType ?? null,
              })),
            }
          : null,
        continuity: {
          activeInstructions: continuity.activeInstructions.slice(-50).map((record) => ({
            subject: record.subject,
            content: record.content,
            status: record.status,
            at: record.at,
          })),
          unresolvedErrors: continuity.unresolvedErrors.slice(-20).map((record) => ({
            subject: record.subject,
            content: record.content,
            at: record.at,
          })),
          preventiveRules: continuity.preventiveRules.slice(-50),
          resumeFrom: continuity.resumeFrom
            ? {
                subject: continuity.resumeFrom.subject,
                content: continuity.resumeFrom.content,
                at: continuity.resumeFrom.at,
              }
            : null,
        },
      },
      maxSteps: 20,
      allowedTools: executionPolicy.allowedTools,
      allowedActions: executionPolicy.allowedActions,
    });

    if (modelResult.error) {
      recordDecision({
        runId,
        decisionKind: 'planning_worker_selection',
        selectedWorker: 'janus-core/model-planner',
        confidence: 0.5,
        outputSummary: 'Configured model planner failed before an executable plan was accepted.',
        metadata: { ok: false, error: modelResult.error },
      });
      throw new Error(modelResult.error);
    }

    plan = modelResult.plan;
    planningWorker = 'model-planner:' + (modelResult.provider ?? 'configured-provider')
      + '/' + (modelResult.model ?? 'configured-model');
    planningConfidence = 0.5;
    planningMetadata = {
      source: 'model',
      provider: modelResult.provider ?? null,
      model: modelResult.model ?? null,
      confidenceBasis: 'neutral prior until calibrated multi-model routing is integrated',
    };
  }

  if (!plan) {
    recordDecision({
      runId,
      decisionKind: 'planning_fallback',
      selectedWorker: 'janus-core/demo-fallback',
      confidence: 0.25,
      outputSummary: 'No executable tool plan matched; runtime will use the observable local fallback.',
      metadata: { source: 'fallback' },
    });
    return null;
  }

  recordDecision({
    runId,
    decisionKind: 'planning_worker_selection',
    selectedWorker: planningWorker,
    confidence: planningConfidence,
    outputSummary: 'Planner selected an executable candidate with ' + plan.steps.length + ' step(s).',
    metadata: {
      ...planningMetadata,
      planSource: plan.source,
      stepIds: plan.steps.map((step) => step.id),
    },
  });

  const validation = validatePlan(plan, {
    maxSteps: 20,
    allowedTools: executionPolicy.allowedTools,
    allowedActions: executionPolicy.allowedActions,
  });

  recordDecision({
    runId,
    decisionKind: 'plan_verification',
    selectedWorker: 'janus-core/plan-validator',
    confidence: 1,
    outputSummary: validation.ok
      ? 'Janus Core accepted the plan after allowlist and safety validation.'
      : 'Janus Core rejected the plan before tool execution.',
    metadata: {
      ok: validation.ok,
      errors: validation.errors,
      stepCount: plan.steps.length,
    },
  });

  if (!validation.ok) {
    throw new Error(`Plan rejected by Janus Core: ${validation.errors.join('; ')}`);
  }

  try {
    assertCapabilitiesReady(plan);
    recordDecision({
      runId,
      decisionKind: 'capability_verification',
      selectedWorker: 'janus-core/capability-registry',
      confidence: 1,
      outputSummary: 'All planned capabilities are currently available.',
      metadata: { ok: true },
    });
  } catch (error) {
    recordDecision({
      runId,
      decisionKind: 'capability_verification',
      selectedWorker: 'janus-core/capability-registry',
      confidence: 1,
      outputSummary: 'Execution was blocked because a required capability is not ready.',
      metadata: {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }

  for (const step of plan.steps) {
    recordDecision({
      runId,
      decisionKind: 'tool_selection',
      selectedWorker: step.tool + '.' + step.action,
      confidence: 1,
      outputSummary: 'Validated tool action selected for plan step ' + step.id + '.',
      metadata: {
        stepId: step.id,
        risk: step.risk,
        reversible: step.reversible,
        requiresApproval: step.requiresApproval,
      },
    });
  }

  const observations = store
    .listLearningObservations(blueprint.id)
    .filter((item) => item.blueprintRevision === blueprint.revision);
  const prediction = deriveRuntimeExecutionPrediction(observations);
  recordDecision({
    runId,
    decisionKind: 'execution_prediction',
    selectedWorker: prediction.basis === 'verified-outcomes'
      ? 'janus-core/runtime-calibration-v1'
      : 'janus-core/runtime-neutral-prior-v1',
    confidence: prediction.confidence,
    outputSummary: prediction.basis === 'verified-outcomes'
      ? 'Execution-success prediction derived from verified outcomes for this Blueprint revision.'
      : 'Neutral execution-success prior retained until minimum verified evidence is available.',
    metadata: {
      basis: prediction.basis,
      sampleCount: prediction.sampleCount,
      meanOutcome: prediction.meanOutcome,
      shrinkagePrior: prediction.shrinkagePrior,
      minimumSamples: prediction.minimumSamples,
      planSource: plan.source,
      stepCount: plan.steps.length,
    },
  });

  return compilePlan(plan, { toolGateway });
}

function assertCapabilitiesReady(plan: JanusPlan): void {
  for (const step of plan.steps) {
    const check = capabilities.check(step.tool, step.action);
    if (!check.ok) {
      throw new Error(
        `Capability ${step.tool}.${step.action} is not ready (${check.state ?? 'unavailable'}): ${check.reason ?? 'sin detalle'}`,
      );
    }
  }
}

function startRun(
  command: string,
  inputMode: 'voice' | 'text',
  sessionId = `${inputMode}-runtime`,
  authorityContext?: TaskAuthorityContext,
  coordinationLink?: { assignmentId: string; principalId: string },
  projectLink?: { projectId: string; threadId: string },
): string {
  let runner: TaskRunner | undefined;
  const durableSink: EventSink = async (event) => {
    store.appendEvent(event);

    if (event.type === 'authority.evaluated') {
      recordDecision({
        runId: event.runId,
        decisionKind: 'authority_verification',
        selectedWorker: 'janus-core/authority-control-plane',
        confidence: 1,
        inputRefs: ['event:' + event.id],
        outputSummary: event.payload.allowed === true
          ? 'Administrative authority allowed the privileged action.'
          : 'Administrative authority denied or constrained the privileged action.',
        metadata: {
          allowed: event.payload.allowed ?? null,
          requiresConfirmation: event.payload.requiresConfirmation ?? null,
          operation: event.payload.operation ?? null,
          authorityDecisionHash: event.payload.auditHash ?? null,
        },
      });
    }

    if (event.type === 'quality.passed' || event.type === 'quality.failed') {
      recordDecision({
        runId: event.runId,
        decisionKind: 'delivery_verification',
        selectedWorker: 'janus-core/delivery-gate:offline-reviewers-v1',
        confidence: 1,
        inputRefs: ['event:' + event.id],
        outputSummary: event.type === 'quality.passed'
          ? 'Delivery Gate approved the artifact for delivery.'
          : 'Delivery Gate rejected the artifact before delivery.',
        metadata: {
          passed: event.type === 'quality.passed',
          artifactId: event.payload.artifactId ?? null,
        },
      });
    }
    if (event.type === 'artifact.updated') {
      const preview = typeof event.payload.preview === 'string' ? event.payload.preview.trim() : '';
      if (preview) {
        store.appendConversationMessage({
          id: `msg:${event.id}`,
          sessionId,
          at: event.at,
          role: 'assistant',
          content: preview,
          source: 'janus',
          metadata: { runId: event.runId, eventType: event.type },
        });
      }
    }
    await hub.sink(event);
    if (runner) store.upsertRun(runner.snapshot());
  };

  let decisionRunId = '';
  runner = new TaskRunner(command, {
    sink: durableSink,
    deliveryGate,
    authorityContext,
    approvalHandler: async (action) => {
      const decision = {
        approved: action.risk === 'none' || action.risk === 'low',
        reason: action.risk === 'high'
          ? 'La acción de alto riesgo requiere aprobación explícita.'
          : undefined,
      };
      if (decisionRunId) {
        recordDecision({
          runId: decisionRunId,
          decisionKind: 'approval',
          selectedWorker: 'janus-runtime/approval-policy',
          confidence: 1,
          outputSummary: decision.approved
            ? 'Runtime approval policy approved the requested action.'
            : 'Runtime approval policy blocked the requested action pending explicit approval.',
          metadata: {
            actionId: action.id,
            risk: action.risk,
            requiresApproval: action.requiresApproval,
            approved: decision.approved,
          },
        });
      }
      return decision;
    },
  });

  const runId = runner.snapshot().runId;
  decisionRunId = runId;
  runBlueprints.set(runId, runtimeBlueprint);
  recordDecision({
    runId,
    decisionKind: 'blueprint_selection',
    selectedWorker: runtimeBlueprint.id + '@' + runtimeBlueprint.revision,
    confidence: 1,
    outputSummary: 'Active runtime Decision Blueprint selected for this execution.',
  });
  const startedAt = new Date().toISOString();
  store.upsertConversationSession({
    id: sessionId,
    source: 'janus',
    startedAt,
    metadata: {
      lastInputMode: inputMode,
      ...(projectLink ? {
        projectId: projectLink.projectId,
        threadId: projectLink.threadId,
      } : {}),
    },
  });
  const userMessage = {
    id: `msg:user:${runId}`,
    sessionId,
    at: startedAt,
    role: 'user' as const,
    content: command,
    source: 'janus' as const,
    metadata: {
      runId,
      inputMode,
      ...(authorityContext?.principal?.id
        ? { principalId: authorityContext.principal.id }
        : {}),
      ...(coordinationLink ? { assignmentId: coordinationLink.assignmentId } : {}),
      ...(projectLink ? {
        projectId: projectLink.projectId,
        threadId: projectLink.threadId,
      } : {}),
    },
  };
  store.appendConversationMessage(userMessage);
  for (const record of classifyExplicitContinuity(userMessage)) {
    store.appendChronologyRecord(record);
  }

  const previousActive = continuitySnapshot(projectLink?.projectId).currentBySubject['active-work'];
  store.appendChronologyRecord({
    id: `task:${runId}`,
    sessionId,
    at: startedAt,
    kind: 'task',
    subject: 'active-work',
    content: command,
    status: 'current',
    ...(previousActive ? { supersedesId: previousActive.id } : {}),
    metadata: {
      runId,
      inputMode,
      ...(authorityContext?.principal?.id
        ? { principalId: authorityContext.principal.id }
        : {}),
      ...(coordinationLink ? { assignmentId: coordinationLink.assignmentId } : {}),
      ...(projectLink ? {
        projectId: projectLink.projectId,
        threadId: projectLink.threadId,
      } : {}),
    },
  });
  if (projectLink) {
    runProjects.set(runId, projectLink);
    const thread = store.getProjectThread(projectLink.threadId);
    const project = store.getProjectWorkspace(projectLink.projectId);
    if (!thread || !project || thread.projectId !== project.id) {
      throw new Error('project/thread disappeared before run start');
    }
    const updatedAt = startedAt;
    store.upsertProjectThread({ ...thread, updatedAt });
    store.upsertProjectWorkspace({ ...project, updatedAt });
  }
  if (coordinationLink) {
    const assignment = store.getCoordinationAssignment(coordinationLink.assignmentId);
    if (!assignment) throw new Error('coordination assignment disappeared before run start');
    runAssignments.set(runId, coordinationLink);
    store.upsertCoordinationAssignment({
      ...assignment,
      status: 'active',
      updatedAt: startedAt,
      lastRunId: runId,
    });
  }
  runners.set(runId, runner);
  store.upsertRun(runner.snapshot());
  const activeRunner = runner;

  setTimeout(() => {
    void (async () => {
      await activeRunner.heard(inputMode);

      let steps: JanusStep[];
      try {
        steps = (await prepareSteps(command, runId)) ?? demoSteps(command);
      } catch (error) {
        await activeRunner.block('Janus Core rechazó el plan antes de ejecutar herramientas', {
          error: error instanceof Error ? error.message : String(error),
        });
        finishRun(activeRunner.snapshot());
        return;
      }

      const snapshot = await activeRunner.execute(steps);
      finishRun(snapshot);
    })().catch((error) => {
      console.error('run failed', error instanceof Error ? error.message : String(error));
      finishRun(activeRunner.snapshot());
    });
  }, 25);

  return runId;
}

function finalizeProjectCheckpoint(snapshot: RunSnapshot): void {
  const link = runProjects.get(snapshot.runId);
  if (!link) return;
  const project = store.getProjectWorkspace(link.projectId);
  const thread = store.getProjectThread(link.threadId);
  if (!project || !thread) {
    runProjects.delete(snapshot.runId);
    return;
  }

  const existing = store.listProjectCheckpoints(project.id)
    .find((checkpoint) => checkpoint.evidenceRefs.includes(`run:${snapshot.runId}`));
  if (existing) {
    runProjects.delete(snapshot.runId);
    return;
  }

  const latestHandoff = store.listCoordinationHandoffs()
    .filter((handoff) => handoff.runId === snapshot.runId)
    .at(-1);
  const assignment = latestHandoff
    ? store.getCoordinationAssignment(latestHandoff.assignmentId)
    : null;
  const checkpoint = buildProjectCheckpoint({
    project,
    thread,
    continuity: continuitySnapshot(project.id),
    nextActions: latestHandoff?.nextActions ?? assignment?.nextActions ?? [],
    evidenceRefs: [
      `run:${snapshot.runId}`,
      ...store.listEvents(snapshot.runId).slice(-20).map((event) => `event:${event.id}`),
      ...store.listDecisionReceipts(snapshot.runId).slice(-12).map((receipt) => `receipt:${receipt.hash}`),
    ],
    createdAt: snapshot.updatedAt,
  });
  store.appendProjectCheckpoint(checkpoint);
  store.upsertProjectThread({ ...thread, updatedAt: snapshot.updatedAt });
  store.upsertProjectWorkspace({ ...project, updatedAt: snapshot.updatedAt });
  recordDecision({
    runId: snapshot.runId,
    decisionKind: 'project_context_checkpoint',
    selectedWorker: 'janus-core/project-continuity-v1',
    confidence: 1,
    inputRefs: checkpoint.evidenceRefs,
    outputSummary: 'Project context checkpoint persisted for automatic thread continuity.',
    metadata: {
      projectId: project.id,
      threadId: thread.id,
      checkpointId: checkpoint.id,
      checksum: checkpoint.checksum,
    },
  });
  runProjects.delete(snapshot.runId);
}

function finalizeCoordinationHandoff(snapshot: RunSnapshot): void {
  const link = runAssignments.get(snapshot.runId);
  if (!link) return;

  const assignment = store.getCoordinationAssignment(link.assignmentId);
  if (!assignment) {
    runAssignments.delete(snapshot.runId);
    return;
  }
  const existing = store.listCoordinationHandoffs(assignment.id)
    .find((handoff) => handoff.runId === snapshot.runId);
  if (existing) {
    runAssignments.delete(snapshot.runId);
    return;
  }

  const events = store.listEvents(snapshot.runId);
  const artifactPreviews = events
    .filter((event) => event.type === 'artifact.updated')
    .map((event) => typeof event.payload.preview === 'string' ? event.payload.preview.trim() : '')
    .filter(Boolean);
  const completed = events
    .filter((event) => event.type === 'run.step.completed')
    .map((event) => event.summary);
  const blockers = events
    .filter((event) => event.type === 'run.blocked' || event.type === 'run.failed')
    .map((event) => event.summary);
  const receipts = store.listDecisionReceipts(snapshot.runId);
  const decisions = receipts
    .filter((receipt) => (
      receipt.decisionKind === 'planning_worker_selection'
      || receipt.decisionKind === 'tool_selection'
      || receipt.decisionKind === 'approval'
      || receipt.decisionKind === 'delivery_verification'
      || receipt.decisionKind === 'run_outcome'
    ))
    .slice(-12)
    .map((receipt) => receipt.outputSummary);
  const executiveSummary = artifactPreviews.at(-1)
    ?? `Run ${snapshot.runId} ended with status ${snapshot.status} for: ${snapshot.goal}`;
  const nextActions = assignment.nextActions;
  const handoff = createCoordinationHandoff({
    assignmentId: assignment.id,
    fromPrincipalId: link.principalId,
    runId: snapshot.runId,
    createdAt: snapshot.updatedAt,
    executiveSummary,
    conclusions: artifactPreviews.length > 0
      ? [artifactPreviews.at(-1)!]
      : [`Execution finished with status ${snapshot.status}.`],
    completed,
    pending: nextActions,
    blockers,
    nextActions,
    decisions,
    evidenceRefs: [
      ...events.slice(-20).map((event) => `event:${event.id}`),
      ...receipts.slice(-12).map((receipt) => `receipt:${receipt.hash}`),
    ],
  });
  store.appendCoordinationHandoff(handoff);

  const status = snapshot.status === 'blocked' || snapshot.status === 'failed'
    ? 'blocked'
    : snapshot.status === 'cancelled'
      ? 'cancelled'
      : nextActions.length > 0
        ? 'active'
        : 'completed';
  store.upsertCoordinationAssignment({
    ...assignment,
    status,
    updatedAt: snapshot.updatedAt,
    lastRunId: snapshot.runId,
  });

  recordDecision({
    runId: snapshot.runId,
    decisionKind: 'coordination_handoff',
    selectedWorker: 'janus-core/multi-operator-coordinator-v1',
    confidence: 1,
    inputRefs: handoff.evidenceRefs,
    outputSummary: 'Coordination handoff persisted for the next authorized operator.',
    metadata: {
      assignmentId: assignment.id,
      fromPrincipalId: link.principalId,
      handoffId: handoff.id,
      checksum: handoff.checksum,
      nextActionCount: handoff.nextActions.length,
      blockerCount: handoff.blockers.length,
    },
  });
  runAssignments.delete(snapshot.runId);
}

function finishRun(snapshot: RunSnapshot): void {
  store.upsertRun(snapshot);
  recordRunOutcome(snapshot);
  finalizeCoordinationHandoff(snapshot);
  finalizeProjectCheckpoint(snapshot);

  if (snapshot.status === 'blocked' || snapshot.status === 'failed') {
    voiceSessions.runBlocked(snapshot.runId);
    runners.delete(snapshot.runId);
    runBlueprints.delete(snapshot.runId);
    return;
  }
  if (snapshot.status === 'completed' || snapshot.status === 'cancelled') {
    voiceSessions.runCompleted(snapshot.runId);
    runners.delete(snapshot.runId);
    runBlueprints.delete(snapshot.runId);
  }
}

async function controlActiveRun(
  runId: string,
  action: 'pause' | 'resume' | 'cancel',
): Promise<void> {
  const runner = runners.get(runId);
  if (!runner) throw new Error('run is not active in this runtime');
  if (action === 'pause') await runner.pause();
  if (action === 'resume') await runner.resume();
  if (action === 'cancel') await runner.cancel();
  store.upsertRun(runner.snapshot());
}

function handleEvents(request: IncomingMessage, response: ServerResponse): void {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  const runId = url.searchParams.get('runId') ?? undefined;

  response.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  });

  const send = (event: unknown) => response.write(`data: ${JSON.stringify(event)}\n\n`);
  const replay = runId ? store.listEvents(runId) : hub.replay();
  for (const event of replay) send(event);

  const unsubscribe = hub.subscribe((event) => {
    if (!runId || event.runId === runId) send(event);
  });
  const heartbeat = setInterval(() => response.write(': heartbeat\n\n'), 15_000);

  request.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
}

function contentType(path: string): string {
  switch (extname(path)) {
    case '.html': return 'text/html; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.js': return 'text/javascript; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.webmanifest': return 'application/manifest+json; charset=utf-8';
    case '.svg': return 'image/svg+xml';
    default: return 'application/octet-stream';
  }
}

function serveStatic(pathname: string, response: ServerResponse): void {
  const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const path = join(root, requested);
  if (!path.startsWith(root) || !existsSync(path)) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }
  response.writeHead(200, { 'content-type': contentType(path) });
  createReadStream(path).pipe(response);
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

  if (request.method === 'GET' && url.pathname === '/health') {
    json(response, 200, {
      ok: true,
      service: 'janus-runtime',
      durable: true,
      db: dbPath === ':memory:' ? 'memory' : 'sqlite',
      timeZone: timeZone ?? 'runtime-default',
      voiceSessionAuthority: 'core',
      voice: {
        streaming: voiceGateway
          ? {
              state: 'available',
              transport: 'websocket',
              input: 'audio/pcm;rate=16000;channels=1;format=s16le',
              stt: 'whisper.cpp-adapter',
              tts: 'qwen3-tts-adapter',
            }
          : {
              state: 'unavailable',
              reason: !sttBaseUrl && !ttsBaseUrl
                ? 'STT y TTS locales no están configurados.'
                : !sttBaseUrl
                  ? 'STT local no está configurado.'
                  : 'TTS local no está configurado.',
            },
      },
      planner: modelGateway ? 'deterministic+model-core-validated' : 'deterministic-core-validated',
      decisionTrace: {
        blueprint: {
          id: runtimeBlueprint.id,
          revision: runtimeBlueprint.revision,
          status: runtimeBlueprint.status,
        },
        receipts: 'sha256-chained-sqlite',
        endpoint: '/api/runs/:runId/decisions',
      },
      outcomeLearning: (() => {
        const learning = outcomeLearningSnapshot();
        return {
          observations: learning.observations.length,
          calibration: learning.calibration,
          drift: learning.drift,
          nextExecutionPrediction: learning.executionPrediction,
          openImprovementProposals: learning.proposals.filter(
            (proposal) => proposal.status === 'proposed' || proposal.status === 'approved',
          ).length,
          endpoint: '/api/learning',
        };
      })(),
      deliveryGate: {
        state: 'enforced',
        dimensions: ['coherence', 'structural', 'visual', 'architectural', 'orthographic', 'synthesis'],
        baseline: 'offline-reviewers-v1',
      },
      authority: {
        privilegedActionGuard: 'enforced',
        authentication: 'ecdsa-p256-challenge-response',
        privateKeyStorage: 'external-to-janus',
        sessionStorage: 'memory-only-hashed-token',
        unauthenticatedMutations: 'blocked',
        voicePrivilegedActions: 'blocked-until-authenticated-voice-transport',
        audit: 'event-log+sha256-decision-hash',
        ...authorityAuth.status(),
      },
      tools: capabilities.availableCatalog(),
      capabilities: capabilities.snapshot(),
      reusableLibrary: {
        currentItems: store.listReusableLibraryItems({ status: 'current' }).length,
        revisions: store.listReusableLibraryItems().length,
        endpoint: '/api/library',
      },
      projects: {
        active: store.listProjectWorkspaces('active').length,
        threads: store.listProjectWorkspaces().reduce(
          (total, project) => total + store.listProjectThreads(project.id).length,
          0,
        ),
        endpoint: '/api/projects',
      },
      coordination: {
        operators: store.listCoordinationOperators().filter((operator) => operator.status === 'active').length,
        assignments: store.listCoordinationAssignments().length,
        handoffs: store.listCoordinationHandoffs().length,
        accessModel: 'explicit-scopes-and-grants',
        handoffPolicy: 'automatic-on-linked-run-terminal-state',
        endpoint: '/api/coordination',
      },
      continuity: {
        records: store.listChronologyRecords().length,
        errorLessons: store.listErrorLessons().length,
        conversationSessions: store.listConversationSessions().length,
        conversationMessages: store.listConversationMessages().length,
        resumeFrom: continuitySnapshot().resumeFrom?.subject ?? null,
      },
      credentials: {
        githubConfigured: environmentCredentials.configured('github'),
        googleConfigured,
        modelConfigured: Boolean(modelGateway),
        provider: 'replaceable-broker',
      },
    });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/auth/status') {
    json(response, 200, {
      ok: true,
      authority: {
        protocol: 'ecdsa-p256-challenge-response',
        privateKeyStorage: 'external-to-janus',
        sessionStorage: 'memory-only-hashed-token',
        secureTransport: 'loopback-or-explicit-trusted-https-proxy',
        ...authorityAuth.status(),
      },
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/challenge') {
    try {
      requireSecureAuthorityTransport(request);
      const body = await readJson(request);
      const principalId = typeof body.principalId === 'string' ? body.principalId.trim() : '';
      if (!principalId) throw new HttpRequestError(400, 'principalId is required');
      const challenge = authorityAuth.issueChallenge(principalId);
      json(response, 200, { ok: true, challenge });
    } catch (error) {
      json(response, authErrorStatus(error), authErrorBody(error));
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/verify') {
    try {
      requireSecureAuthorityTransport(request);
      const body = await readJson(request);
      const challengeId = typeof body.challengeId === 'string' ? body.challengeId.trim() : '';
      const principalId = typeof body.principalId === 'string' ? body.principalId.trim() : '';
      const signature = typeof body.signature === 'string' ? body.signature.trim() : '';
      if (!challengeId || !principalId || !signature) {
        throw new HttpRequestError(400, 'challengeId, principalId and signature are required');
      }
      const session = authorityAuth.verifyChallenge({ challengeId, principalId, signature });
      json(response, 200, { ok: true, session });
    } catch (error) {
      json(response, authErrorStatus(error), authErrorBody(error));
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
    try {
      const { token } = requireAuthoritySession(request);
      authorityAuth.revokeSession(token);
      json(response, 200, { ok: true });
    } catch (error) {
      json(response, authErrorStatus(error), authErrorBody(error));
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/admin/delegate') {
    try {
      const { token } = requireAuthoritySession(request);
      const body = await readJson(request);
      const principalId = typeof body.principalId === 'string' ? body.principalId.trim() : '';
      const publicKeyPem = typeof body.publicKeyPem === 'string' ? body.publicKeyPem : '';
      const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : undefined;
      if (!principalId || !publicKeyPem.trim()) {
        throw new HttpRequestError(400, 'principalId and publicKeyPem are required');
      }
      const credential = authorityAuth.delegateAdministrator(token, {
        principalId,
        publicKeyPem,
        ...(displayName ? { displayName } : {}),
      });
      json(response, 201, {
        ok: true,
        administrator: {
          principal: credential.principal,
          createdAt: credential.createdAt,
          delegatedBy: credential.delegatedBy,
        },
      });
    } catch (error) {
      json(response, authErrorStatus(error), authErrorBody(error));
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/admin/revoke') {
    try {
      const { token } = requireAuthoritySession(request);
      const body = await readJson(request);
      const principalId = typeof body.principalId === 'string' ? body.principalId.trim() : '';
      if (!principalId) throw new HttpRequestError(400, 'principalId is required');
      const credential = authorityAuth.revokeAdministrator(token, principalId);
      json(response, 200, {
        ok: true,
        administrator: {
          principal: credential.principal,
          revokedAt: credential.revokedAt,
        },
      });
    } catch (error) {
      json(response, authErrorStatus(error), authErrorBody(error));
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/operator/delegate') {
    try {
      const { token } = requireFounderAuthority(request);
      const body = await readJson(request);
      const principalId = typeof body.principalId === 'string' ? body.principalId.trim() : '';
      const publicKeyPem = typeof body.publicKeyPem === 'string' ? body.publicKeyPem : '';
      const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : undefined;
      const notes = typeof body.notes === 'string' ? body.notes.trim() : undefined;
      if (!principalId || !publicKeyPem.trim()) {
        throw new HttpRequestError(400, 'principalId and publicKeyPem are required');
      }
      const credential = authorityAuth.delegateOperator(token, {
        principalId,
        publicKeyPem,
        ...(displayName ? { displayName } : {}),
      });
      store.upsertCoordinationOperator({
        principalId,
        status: 'active',
        createdAt: credential.createdAt,
        updatedAt: credential.createdAt,
        ...(displayName ? { displayName } : {}),
        ...(notes ? { notes } : {}),
      });
      json(response, 201, {
        ok: true,
        operator: {
          principal: credential.principal,
          createdAt: credential.createdAt,
          delegatedBy: credential.delegatedBy,
        },
      });
    } catch (error) {
      json(response, authErrorStatus(error), authErrorBody(error));
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/operator/revoke') {
    try {
      const { token } = requireFounderAuthority(request);
      const body = await readJson(request);
      const principalId = typeof body.principalId === 'string' ? body.principalId.trim() : '';
      if (!principalId) throw new HttpRequestError(400, 'principalId is required');
      const credential = authorityAuth.revokeOperator(token, principalId);
      const revokedAt = credential.revokedAt ?? new Date().toISOString();
      for (const grant of store.listCoordinationGrants()) {
        if (grant.principalId === principalId && !grant.revokedAt) {
          store.upsertCoordinationGrant({ ...grant, revokedAt });
        }
      }
      const profile = store.getCoordinationOperator(principalId);
      if (profile) {
        store.upsertCoordinationOperator({
          ...profile,
          status: 'inactive',
          updatedAt: revokedAt,
        });
      }
      json(response, 200, {
        ok: true,
        operator: {
          principal: credential.principal,
          revokedAt: credential.revokedAt,
        },
      });
    } catch (error) {
      json(response, authErrorStatus(error), authErrorBody(error));
    }
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/continuity') {
    const continuity = continuitySnapshot();
    json(response, 200, {
      ok: true,
      continuity: {
        latestSessionId: continuity.latestSessionId ?? null,
        activeInstructions: continuity.activeInstructions,
        unresolvedErrors: continuity.unresolvedErrors,
        preventiveRules: continuity.preventiveRules,
        resumeFrom: continuity.resumeFrom ?? null,
        historicalCount: continuity.historical.length,
        recordCount: continuity.orderedRecords.length,
        errorLessons: continuity.errorLessons,
      },
    });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/events') {
    handleEvents(request, response);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/learning') {
    const learning = outcomeLearningSnapshot();
    json(response, 200, {
      ok: true,
      blueprint: {
        id: runtimeBlueprint.id,
        revision: runtimeBlueprint.revision,
      },
      blueprintHistory: store.listDecisionBlueprints(runtimeBlueprint.id),
      observations: learning.observations,
      calibration: learning.calibration,
      drift: learning.drift,
      nextExecutionPrediction: learning.executionPrediction,
      improvementProposals: learning.proposals,
    });
    return;
  }

  const proposalGovernance = url.pathname.match(
    /^\/api\/learning\/proposals\/([^/]+)\/(approve|reject|apply)$/,
  );
  const proposalId = proposalGovernance?.[1]
    ? decodeURIComponent(proposalGovernance[1])
    : undefined;
  const governanceAction = proposalGovernance?.[2] as
    | 'approve'
    | 'reject'
    | 'apply'
    | undefined;
  if (request.method === 'POST' && proposalId && governanceAction) {
    try {
      const { principal } = requireFounderAuthority(request);
      const body = await readJson(request);

      if (governanceAction === 'reject') {
        const proposal = rejectRuntimeImprovementProposal({
          store,
          proposalId,
        });
        appendGovernanceDecision({
          subject: 'blueprint-governance:' + proposalId,
          content: 'Improvement proposal rejected by Founder/Director.',
          principalId: principal.id,
          metadata: {
            proposalId,
            action: 'reject',
            fromRevision: proposal.fromRevision,
          },
        });
        json(response, 200, { ok: true, proposal });
        return;
      }

      if (governanceAction === 'approve') {
        const candidate = blueprintCandidateFromBody(body, runtimeBlueprint);
        const result = approveRuntimeImprovementProposal({
          store,
          proposalId,
          current: runtimeBlueprint,
          candidate,
          registeredTools: capabilityPolicyCatalog(),
        });
        appendGovernanceDecision({
          subject: 'blueprint-governance:' + proposalId,
          content: 'Improvement proposal approved with verified draft Blueprint revision.',
          principalId: principal.id,
          metadata: {
            proposalId,
            action: 'approve',
            fromRevision: result.proposal.fromRevision,
            candidateRevision: result.candidate.revision,
            changedFields: result.verification.diff.changedFields,
          },
        });
        json(response, 200, { ok: true, ...result });
        return;
      }

      if (body.confirmAction !== 'apply_blueprint_revision') {
        throw new HttpRequestError(
          409,
          'Explicit confirmAction=apply_blueprint_revision is required',
        );
      }
      const result = applyApprovedRuntimeBlueprint({
        store,
        proposalId,
        current: runtimeBlueprint,
        registeredTools: capabilityPolicyCatalog(),
      });
      runtimeBlueprint = result.active;
      appendGovernanceDecision({
        subject: 'blueprint-governance:' + proposalId,
        content: 'Verified Blueprint revision applied; previous revision is historical.',
        principalId: principal.id,
        metadata: {
          proposalId,
          action: 'apply',
          previousRevision: result.previous.revision,
          activeRevision: result.active.revision,
          changedFields: result.verification.diff.changedFields,
        },
      });
      json(response, 200, { ok: true, ...result });
    } catch (error) {
      const status = error instanceof HttpRequestError || error instanceof AuthorityAuthenticationError
        ? authErrorStatus(error)
        : 409;
      json(response, status, authErrorBody(error));
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/learning/blueprints/rollback') {
    try {
      const { principal } = requireFounderAuthority(request);
      const body = await readJson(request);
      if (body.confirmAction !== 'rollback_blueprint_revision') {
        throw new HttpRequestError(
          409,
          'Explicit confirmAction=rollback_blueprint_revision is required',
        );
      }
      const targetRevision = Number(body.targetRevision);
      if (!Number.isInteger(targetRevision) || targetRevision < 1) {
        throw new HttpRequestError(400, 'targetRevision must be a positive integer');
      }

      const result = rollbackRuntimeBlueprint({
        store,
        current: runtimeBlueprint,
        targetRevision,
        registeredTools: capabilityPolicyCatalog(),
        createdAt: new Date().toISOString(),
      });
      runtimeBlueprint = result.active;
      appendGovernanceDecision({
        subject: 'blueprint-rollback',
        content:
          'Historical Blueprint revision '
          + result.sourceRevision
          + ' restored as new active revision '
          + result.active.revision
          + '.',
        principalId: principal.id,
        metadata: {
          action: 'rollback',
          sourceRevision: result.sourceRevision,
          previousRevision: result.previous.revision,
          activeRevision: result.active.revision,
        },
      });
      json(response, 200, { ok: true, ...result });
    } catch (error) {
      const status = error instanceof HttpRequestError || error instanceof AuthorityAuthenticationError
        ? authErrorStatus(error)
        : 409;
      json(response, status, authErrorBody(error));
    }
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/coordination') {
    try {
      const { principal } = requireAuthoritySession(request);
      json(response, 200, {
        ok: true,
        brief: coordinationBriefFor(principal),
      });
    } catch (error) {
      json(response, authErrorStatus(error), authErrorBody(error));
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/coordination/scopes') {
    try {
      const { principal } = requireFounderAuthority(request);
      const body = await readJson(request);
      const label = typeof body.label === 'string' ? body.label.trim() : '';
      const description = typeof body.description === 'string' ? body.description.trim() : undefined;
      const classification = body.classification === 'private'
        || body.classification === 'shared'
        || body.classification === 'project'
        || body.classification === 'system'
        ? body.classification
        : null;
      if (!label || !classification) {
        throw new HttpRequestError(400, 'label and valid classification are required');
      }
      const ownerPrincipalId = typeof body.ownerPrincipalId === 'string' && body.ownerPrincipalId.trim()
        ? body.ownerPrincipalId.trim()
        : principal.id;
      const scope = validateCoordinationScope({
        id: typeof body.id === 'string' && body.id.trim()
          ? body.id.trim()
          : `scope_${randomUUID()}`,
        label,
        classification,
        ownerPrincipalId,
        createdAt: new Date().toISOString(),
        ...(description ? { description } : {}),
      });
      store.upsertCoordinationScope(scope);
      json(response, 201, { ok: true, scope });
    } catch (error) {
      const status = error instanceof AuthorityAuthenticationError || error instanceof HttpRequestError
        ? authErrorStatus(error)
        : 400;
      json(response, status, authErrorBody(error));
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/coordination/grants') {
    try {
      const { principal } = requireFounderAuthority(request);
      const body = await readJson(request);
      const principalId = typeof body.principalId === 'string' ? body.principalId.trim() : '';
      const scopeId = typeof body.scopeId === 'string' ? body.scopeId.trim() : '';
      const allowedPermissions = new Set(['read_context', 'write_work', 'coordinate', 'handoff']);
      const permissions = coordinationStringList(body.permissions)
        .filter((permission) => allowedPermissions.has(permission));
      if (!principalId || !scopeId || permissions.length === 0) {
        throw new HttpRequestError(400, 'principalId, scopeId and valid permissions are required');
      }
      if (!store.listCoordinationScopes().some((scope) => scope.id === scopeId)) {
        throw new HttpRequestError(404, 'coordination scope not found');
      }
      const target = store.getAuthorityCredential(principalId);
      if (!target || !target.principal.active || target.revokedAt) {
        throw new HttpRequestError(409, 'active authenticated principal is required');
      }
      const grant = validateCoordinationGrant({
        id: typeof body.id === 'string' && body.id.trim()
          ? body.id.trim()
          : `grant_${randomUUID()}`,
        principalId,
        scopeId,
        permissions: permissions as Array<'read_context' | 'write_work' | 'coordinate' | 'handoff'>,
        grantedBy: principal.id,
        createdAt: new Date().toISOString(),
      });
      store.upsertCoordinationGrant(grant);
      json(response, 201, { ok: true, grant });
    } catch (error) {
      const status = error instanceof AuthorityAuthenticationError || error instanceof HttpRequestError
        ? authErrorStatus(error)
        : 400;
      json(response, status, authErrorBody(error));
    }
    return;
  }

  const coordinationGrantRevokeMatch = url.pathname.match(
    /^\/api\/coordination\/grants\/([^/]+)\/revoke$/,
  );
  const coordinationGrantId = coordinationGrantRevokeMatch?.[1];
  if (request.method === 'POST' && coordinationGrantId) {
    try {
      requireFounderAuthority(request);
      const grantId = decodeURIComponent(coordinationGrantId);
      const grant = store.listCoordinationGrants().find((item) => item.id === grantId);
      if (!grant) throw new HttpRequestError(404, 'coordination grant not found');
      const revoked = grant.revokedAt
        ? grant
        : { ...grant, revokedAt: new Date().toISOString() };
      store.upsertCoordinationGrant(revoked);
      json(response, 200, { ok: true, grant: revoked });
    } catch (error) {
      const status = error instanceof AuthorityAuthenticationError || error instanceof HttpRequestError
        ? authErrorStatus(error)
        : 409;
      json(response, status, authErrorBody(error));
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/coordination/assignments') {
    try {
      const { principal } = requireFounderAuthority(request);
      const body = await readJson(request);
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      const goal = typeof body.goal === 'string' ? body.goal.trim() : '';
      const assigneePrincipalId = typeof body.assigneePrincipalId === 'string'
        ? body.assigneePrincipalId.trim()
        : '';
      const scopeIds = coordinationStringList(body.scopeIds);
      if (!title || !goal || !assigneePrincipalId || scopeIds.length === 0) {
        throw new HttpRequestError(400, 'title, goal, assigneePrincipalId and scopeIds are required');
      }
      const assigneeCredential = store.getAuthorityCredential(assigneePrincipalId);
      if (
        !assigneeCredential
        || !assigneeCredential.principal.active
        || assigneeCredential.revokedAt
      ) {
        throw new HttpRequestError(409, 'active authenticated assignee is required');
      }
      const scopes = store.listCoordinationScopes();
      if (!scopeIds.every((scopeId) => scopes.some((scope) => scope.id === scopeId))) {
        throw new HttpRequestError(404, 'one or more coordination scopes were not found');
      }
      const now = new Date().toISOString();
      const priority = body.priority === 'low'
        || body.priority === 'high'
        || body.priority === 'critical'
        ? body.priority
        : 'normal';
      const assignment = validateCoordinationAssignment({
        id: typeof body.id === 'string' && body.id.trim()
          ? body.id.trim()
          : `assignment_${randomUUID()}`,
        title,
        goal,
        assigneePrincipalId,
        scopeIds,
        status: 'queued',
        priority,
        createdBy: principal.id,
        createdAt: now,
        updatedAt: now,
        nextActions: coordinationStringList(body.nextActions),
      });
      assertAssignmentAccess({
        principal: assigneeCredential.principal,
        assignment,
        scopes,
        grants: store.listCoordinationGrants(),
        permission: 'write_work',
      });
      store.upsertCoordinationAssignment(assignment);
      json(response, 201, { ok: true, assignment });
    } catch (error) {
      const status = error instanceof AuthorityAuthenticationError || error instanceof HttpRequestError
        ? authErrorStatus(error)
        : 409;
      json(response, status, authErrorBody(error));
    }
    return;
  }

  const coordinationHandoffMatch = url.pathname.match(
    /^\/api\/coordination\/assignments\/([^/]+)\/handoffs$/,
  );
  const coordinationAssignmentId = coordinationHandoffMatch?.[1];
  if (request.method === 'POST' && coordinationAssignmentId) {
    try {
      const { principal } = requireAuthoritySession(request);
      const assignment = store.getCoordinationAssignment(
        decodeURIComponent(coordinationAssignmentId),
      );
      if (!assignment) throw new HttpRequestError(404, 'coordination assignment not found');
      assertAssignmentAccess({
        principal,
        assignment,
        scopes: store.listCoordinationScopes(),
        grants: store.listCoordinationGrants(),
        permission: 'handoff',
      });
      const body = await readJson(request);
      const executiveSummary = typeof body.executiveSummary === 'string'
        ? body.executiveSummary.trim()
        : '';
      if (!executiveSummary) {
        throw new HttpRequestError(400, 'executiveSummary is required');
      }
      const handoff = createCoordinationHandoff({
        assignmentId: assignment.id,
        fromPrincipalId: principal.id,
        createdAt: new Date().toISOString(),
        executiveSummary,
        conclusions: coordinationStringList(body.conclusions),
        completed: coordinationStringList(body.completed),
        pending: coordinationStringList(body.pending),
        blockers: coordinationStringList(body.blockers),
        nextActions: coordinationStringList(body.nextActions),
        decisions: coordinationStringList(body.decisions),
        evidenceRefs: coordinationStringList(body.evidenceRefs),
        ...(typeof body.toPrincipalId === 'string' && body.toPrincipalId.trim()
          ? { toPrincipalId: body.toPrincipalId.trim() }
          : {}),
        ...(typeof body.runId === 'string' && body.runId.trim()
          ? { runId: body.runId.trim() }
          : {}),
      });
      store.appendCoordinationHandoff(handoff);
      store.upsertCoordinationAssignment({
        ...assignment,
        status: body.completeAssignment === true ? 'completed' : 'active',
        updatedAt: handoff.createdAt,
      });
      json(response, 201, { ok: true, handoff });
    } catch (error) {
      const status = error instanceof AuthorityAuthenticationError || error instanceof HttpRequestError
        ? authErrorStatus(error)
        : 409;
      json(response, status, authErrorBody(error));
    }
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/library') {
    try {
      if (authorityAuth.status().founderConfigured) requireAuthoritySession(request);
      const kind = reusableKind(url.searchParams.get('kind'));
      const tag = url.searchParams.get('tag')?.trim() || undefined;
      const items = store.listReusableLibraryItems({
        status: 'current',
        ...(kind ? { kind } : {}),
        ...(tag ? { tag } : {}),
      });
      json(response, 200, { ok: true, items });
    } catch (error) {
      json(response, authErrorStatus(error), authErrorBody(error));
    }
    return;
  }

  const libraryItemMatch = url.pathname.match(/^\/api\/library\/([^/]+)$/);
  const libraryItemId = libraryItemMatch?.[1];
  if (request.method === 'GET' && libraryItemId) {
    try {
      if (authorityAuth.status().founderConfigured) requireAuthoritySession(request);
      const itemId = decodeURIComponent(libraryItemId);
      const revisionRaw = url.searchParams.get('revision');
      const revision = revisionRaw == null ? undefined : Number(revisionRaw);
      if (revision != null && (!Number.isInteger(revision) || revision < 1)) {
        throw new HttpRequestError(400, 'revision must be a positive integer');
      }
      const selection = resolveReusableSelection({
        itemId,
        items: store.listReusableLibraryItems(),
        ...(revision == null ? {} : { revision }),
      });
      json(response, 200, { ok: true, selection });
    } catch (error) {
      const status = error instanceof HttpRequestError || error instanceof AuthorityAuthenticationError
        ? authErrorStatus(error)
        : 404;
      json(response, status, authErrorBody(error));
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/library/items') {
    try {
      const { principal } = requireFounderAuthority(request);
      const body = await readJson(request);
      const id = typeof body.id === 'string' ? body.id.trim() : '';
      const kind = reusableKind(body.kind);
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!id || !kind || !name) {
        throw new HttpRequestError(400, 'id, valid kind and name are required');
      }
      const current = store.getReusableLibraryItem(id);
      const revision = current ? current.revision + 1 : 1;
      const item = createReusableLibraryItem({
        id,
        revision,
        status: 'current',
        kind,
        name,
        description: typeof body.description === 'string' ? body.description : undefined,
        createdAt: new Date().toISOString(),
        createdBy: principal.id,
        ...(current ? { supersedesRevision: current.revision } : {}),
        tags: coordinationStringList(body.tags),
        compatibility: coordinationStringList(body.compatibility),
        dependencies: Array.isArray(body.dependencies)
          ? body.dependencies.flatMap((value) => {
              if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
              const dep = value as Record<string, unknown>;
              const itemId = typeof dep.itemId === 'string' ? dep.itemId.trim() : '';
              if (!itemId) return [];
              const depRevision = Number(dep.revision);
              return [{
                itemId,
                ...(Number.isInteger(depRevision) && depRevision > 0
                  ? { revision: depRevision }
                  : {}),
                ...(dep.optional === true ? { optional: true } : {}),
              }];
            })
          : [],
        contentRef: typeof body.contentRef === 'string' ? body.contentRef : undefined,
        previewRef: typeof body.previewRef === 'string' ? body.previewRef : undefined,
        spec: body.spec && typeof body.spec === 'object' && !Array.isArray(body.spec)
          ? body.spec as Record<string, unknown>
          : undefined,
      });
      assertReusableRevisionAppendOnly({ previous: current ?? undefined, next: item });
      resolveReusableSelection({
        itemId: item.id,
        revision: item.revision,
        items: [...store.listReusableLibraryItems(), item],
      });
      if (current) store.upsertReusableLibraryItem({ ...current, status: 'historical' });
      store.upsertReusableLibraryItem(item);
      json(response, 201, { ok: true, item });
    } catch (error) {
      const status = error instanceof AuthorityAuthenticationError || error instanceof HttpRequestError
        ? authErrorStatus(error)
        : 409;
      json(response, status, authErrorBody(error));
    }
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/projects') {
    try {
      const { principal } = requireAuthoritySession(request);
      json(response, 200, {
        ok: true,
        projects: store.listProjectWorkspaces().filter(
          (project) => canAccessProject(principal, project, 'read_context'),
        ),
      });
    } catch (error) {
      json(response, authErrorStatus(error), authErrorBody(error));
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/projects') {
    try {
      const { principal } = requireAuthoritySession(request);
      if (!['founder_director', 'administrator', 'operator'].includes(principal.role)) {
        throw new HttpRequestError(403, 'authenticated human principal is required');
      }
      const body = await readJson(request);
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name) throw new HttpRequestError(400, 'name is required');
      const coordinationScopeId = typeof body.coordinationScopeId === 'string'
        && body.coordinationScopeId.trim()
        ? body.coordinationScopeId.trim()
        : undefined;
      if (coordinationScopeId) {
        const scope = store.listCoordinationScopes().find((item) => item.id === coordinationScopeId);
        if (!scope) throw new HttpRequestError(404, 'coordination scope not found');
        if (principal.role !== 'founder_director' && !canAccessCoordinationScope({
          principal,
          scope,
          grants: store.listCoordinationGrants(),
          permission: 'write_work',
        })) {
          throw new HttpRequestError(403, 'coordination scope write access denied');
        }
      }
      const now = new Date().toISOString();
      const project = validateProjectWorkspace({
        id: typeof body.id === 'string' && body.id.trim()
          ? body.id.trim()
          : `project_${randomUUID()}`,
        name,
        status: 'active',
        createdAt: now,
        updatedAt: now,
        createdBy: principal.id,
        ...(coordinationScopeId ? { coordinationScopeId } : {}),
        description: typeof body.description === 'string' ? body.description : undefined,
      });
      if (store.getProjectWorkspace(project.id)) {
        throw new HttpRequestError(409, 'project id already exists');
      }
      store.upsertProjectWorkspace(project);
      json(response, 201, { ok: true, project });
    } catch (error) {
      const status = error instanceof AuthorityAuthenticationError || error instanceof HttpRequestError
        ? authErrorStatus(error)
        : 400;
      json(response, status, authErrorBody(error));
    }
    return;
  }

  const projectContextMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/context$/);
  const projectContextId = projectContextMatch?.[1];
  if (request.method === 'GET' && projectContextId) {
    try {
      const { principal } = requireAuthoritySession(request);
      const context = projectContextFor(decodeURIComponent(projectContextId), principal);
      json(response, 200, {
        ok: true,
        project: context.project,
        threads: context.threads,
        resources: context.resources,
        latestCheckpoint: context.latestCheckpoint,
        continuity: {
          activeInstructions: context.continuity.activeInstructions,
          unresolvedErrors: context.continuity.unresolvedErrors,
          preventiveRules: context.continuity.preventiveRules,
          resumeFrom: context.continuity.resumeFrom ?? null,
        },
      });
    } catch (error) {
      const status = error instanceof AuthorityAuthenticationError || error instanceof HttpRequestError
        ? authErrorStatus(error)
        : 409;
      json(response, status, authErrorBody(error));
    }
    return;
  }

  const projectThreadsMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/threads$/);
  const projectThreadsId = projectThreadsMatch?.[1];
  if (request.method === 'POST' && projectThreadsId) {
    try {
      const { principal } = requireAuthoritySession(request);
      const projectId = decodeURIComponent(projectThreadsId);
      const project = store.getProjectWorkspace(projectId);
      if (!project) throw new HttpRequestError(404, 'project not found');
      requireProjectAccess(principal, project, 'write_work');
      const body = await readJson(request);
      const title = typeof body.title === 'string' && body.title.trim()
        ? body.title.trim()
        : 'New thread';
      const now = new Date().toISOString();
      const thread = validateProjectThread({
        id: typeof body.id === 'string' && body.id.trim()
          ? body.id.trim()
          : `thread_${randomUUID()}`,
        projectId,
        title,
        status: 'active',
        createdAt: now,
        updatedAt: now,
        createdBy: principal.id,
      });
      if (store.getProjectThread(thread.id)) {
        throw new HttpRequestError(409, 'thread id already exists');
      }
      store.upsertProjectThread(thread);
      store.upsertProjectWorkspace({ ...project, updatedAt: now });
      const checkpoint = buildProjectCheckpoint({
        project,
        thread,
        continuity: continuitySnapshot(projectId),
        evidenceRefs: [
          ...store.listProjectCheckpoints(projectId).slice(-5).map((item) => `checkpoint:${item.id}`),
        ],
        createdAt: now,
      });
      store.appendProjectCheckpoint(checkpoint);
      json(response, 201, {
        ok: true,
        thread,
        bootstrapCheckpoint: checkpoint,
      });
    } catch (error) {
      const status = error instanceof AuthorityAuthenticationError || error instanceof HttpRequestError
        ? authErrorStatus(error)
        : 409;
      json(response, status, authErrorBody(error));
    }
    return;
  }

  const projectResourcesMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/resources$/);
  const projectResourcesId = projectResourcesMatch?.[1];
  if (request.method === 'POST' && projectResourcesId) {
    try {
      const { principal } = requireAuthoritySession(request);
      const projectId = decodeURIComponent(projectResourcesId);
      const project = store.getProjectWorkspace(projectId);
      if (!project) throw new HttpRequestError(404, 'project not found');
      requireProjectAccess(principal, project, 'write_work');
      const body = await readJson(request);
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const sourceRef = typeof body.sourceRef === 'string' ? body.sourceRef.trim() : '';
      const source = body.source === 'local'
        || body.source === 'google_drive'
        || body.source === 'apple_icloud'
        || body.source === 'upload'
        || body.source === 'import'
        || body.source === 'other'
        ? body.source
        : null;
      if (!name || !sourceRef || !source) {
        throw new HttpRequestError(400, 'name, sourceRef and valid source are required');
      }
      const threadId = typeof body.threadId === 'string' && body.threadId.trim()
        ? body.threadId.trim()
        : undefined;
      if (threadId) {
        const thread = store.getProjectThread(threadId);
        if (!thread || thread.projectId !== projectId) {
          throw new HttpRequestError(409, 'thread does not belong to project');
        }
      }
      const resource = validateProjectResource({
        id: typeof body.id === 'string' && body.id.trim()
          ? body.id.trim()
          : `resource_${randomUUID()}`,
        projectId,
        ...(threadId ? { threadId } : {}),
        name,
        source,
        sourceRef,
        createdAt: new Date().toISOString(),
        addedBy: principal.id,
        mimeType: typeof body.mimeType === 'string' ? body.mimeType : undefined,
        checksum: typeof body.checksum === 'string' ? body.checksum : undefined,
      });
      store.upsertProjectResource(resource);
      json(response, 201, { ok: true, resource });
    } catch (error) {
      const status = error instanceof AuthorityAuthenticationError || error instanceof HttpRequestError
        ? authErrorStatus(error)
        : 409;
      json(response, status, authErrorBody(error));
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/command') {
    try {
      const body = await readJson(request);
      const text = typeof body.text === 'string' ? body.text.trim() : '';
      if (!text) {
        json(response, 400, { ok: false, error: 'text is required' });
        return;
      }
      const authorityContext = authorityContextForCommand(request, text, body);
      const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
      const threadId = typeof body.threadId === 'string' ? body.threadId.trim() : '';
      let projectLink: { projectId: string; threadId: string } | undefined;
      if (projectId || threadId) {
        if (!projectId || !threadId) {
          throw new HttpRequestError(400, 'projectId and threadId must be provided together');
        }
        const principal = authorityContext?.principal;
        if (!principal) {
          throw new HttpRequestError(401, 'authenticated principal is required for project commands');
        }
        const project = store.getProjectWorkspace(projectId);
        const thread = store.getProjectThread(threadId);
        if (!project || !thread || thread.projectId !== project.id) {
          throw new HttpRequestError(404, 'project/thread not found');
        }
        requireProjectAccess(principal, project, 'write_work');
        projectLink = { projectId, threadId };
      }
      const sessionId = projectLink
        ? projectLink.threadId
        : typeof body.sessionId === 'string' && body.sessionId.trim()
          ? body.sessionId.trim()
          : 'text-runtime';
      const assignmentId = typeof body.assignmentId === 'string'
        ? body.assignmentId.trim()
        : '';
      let coordinationLink: { assignmentId: string; principalId: string } | undefined;
      if (assignmentId) {
        const principal = authorityContext?.principal;
        if (!principal) throw new HttpRequestError(401, 'authenticated operator is required');
        const assignment = store.getCoordinationAssignment(assignmentId);
        if (!assignment) throw new HttpRequestError(404, 'coordination assignment not found');
        assertAssignmentAccess({
          principal,
          assignment,
          scopes: store.listCoordinationScopes(),
          grants: store.listCoordinationGrants(),
          permission: 'write_work',
        });
        coordinationLink = { assignmentId, principalId: principal.id };
      }
      const runId = startRun(
        text,
        body.inputMode === 'voice' ? 'voice' : 'text',
        sessionId,
        authorityContext,
        coordinationLink,
        projectLink,
      );
      json(response, 202, {
        ok: true,
        runId,
        authenticatedPrincipal: authorityContext?.principal?.id ?? null,
        assignmentId: coordinationLink?.assignmentId ?? null,
        projectId: projectLink?.projectId ?? null,
        threadId: projectLink?.threadId ?? null,
      });
    } catch (error) {
      json(response, authErrorStatus(error), authErrorBody(error));
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/voice/utterance') {
    const body = await readJson(request);
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!sessionId || !text) {
      json(response, 400, { ok: false, error: 'sessionId and text are required' });
      return;
    }

    try {
      const session = voiceSessions.get(sessionId);
      const result = await session.transcript({
        text,
        final: body.final !== false,
        language: typeof body.language === 'string' ? body.language : undefined,
      });
      json(response, 200, { ok: true, result, session: session.snapshot() });
    } catch (error) {
      json(response, 409, { ok: false, error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/voice/microphone') {
    const body = await readJson(request);
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
    const state = body.state === 'connected' ? 'connected' : body.state === 'disconnected' ? 'disconnected' : null;
    if (!sessionId || !state) {
      json(response, 400, { ok: false, error: 'sessionId and valid state are required' });
      return;
    }
    const session = voiceSessions.get(sessionId);
    json(response, 200, { ok: true, session: session.microphone(state) });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/voice/tts') {
    const body = await readJson(request);
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
    const state = body.state === 'started' ? 'started' : body.state === 'completed' ? 'completed' : null;
    if (!sessionId || !state) {
      json(response, 400, { ok: false, error: 'sessionId and valid state are required' });
      return;
    }
    const session = voiceSessions.get(sessionId);
    json(response, 200, { ok: true, session: session.tts(state) });
    return;
  }

  const voiceSessionMatch = url.pathname.match(/^\/api\/voice\/sessions\/([^/]+)$/);
  const voiceSessionId = voiceSessionMatch?.[1];
  if (request.method === 'GET' && voiceSessionId) {
    try {
      json(response, 200, {
        ok: true,
        session: voiceSessions.get(decodeURIComponent(voiceSessionId)).snapshot(),
      });
    } catch (error) {
      json(response, 400, { ok: false, error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }

  const getRunDecisions = url.pathname.match(/^\/api\/runs\/([^/]+)\/decisions$/);
  const decisionRunId = getRunDecisions?.[1];
  if (request.method === 'GET' && decisionRunId) {
    const live = runners.get(decisionRunId)?.snapshot();
    const persisted = store.getRun(decisionRunId);
    if (!live && !persisted) {
      json(response, 404, { ok: false, error: 'run not found' });
      return;
    }
    const receipts = store.listDecisionReceipts(decisionRunId);
    const receiptBlueprint = receipts[0]
      ? store.getDecisionBlueprint(
          receipts[0].blueprintId,
          receipts[0].blueprintRevision,
        )
      : null;
    json(response, 200, {
      ok: true,
      blueprint: receiptBlueprint ?? blueprintForRun(decisionRunId),
      receipts,
      chain: verifyReceiptChain(receipts),
    });
    return;
  }

  const getRun = url.pathname.match(/^\/api\/runs\/([^/]+)$/);
  const requestedRunId = getRun?.[1];
  if (request.method === 'GET' && requestedRunId) {
    const live = runners.get(requestedRunId)?.snapshot();
    const persisted = store.getRun(requestedRunId);
    if (!live && !persisted) {
      json(response, 404, { ok: false, error: 'run not found' });
      return;
    }
    json(response, 200, { ok: true, snapshot: live ?? persisted });
    return;
  }

  const control = url.pathname.match(/^\/api\/runs\/([^/]+)\/(pause|resume|cancel)$/);
  const controlRunId = control?.[1];
  const controlAction = control?.[2] as 'pause' | 'resume' | 'cancel' | undefined;
  if (request.method === 'POST' && controlRunId && controlAction) {
    try {
      if (authorityAuth.status().founderConfigured) requireAuthoritySession(request);
      await controlActiveRun(controlRunId, controlAction);
      json(response, 200, {
        ok: true,
        snapshot: runners.get(controlRunId)?.snapshot() ?? store.getRun(controlRunId),
      });
    } catch (error) {
      const status = error instanceof AuthorityAuthenticationError || error instanceof HttpRequestError
        ? authErrorStatus(error)
        : 409;
      json(response, status, authErrorBody(error));
    }
    return;
  }

  serveStatic(url.pathname, response);
});

const voiceStream = voiceGateway
  ? new VoiceStreamServer({
      server,
      sessions: voiceSessions,
      gatewayFactory: async () => voiceGateway,
      defaultVoiceId,
    })
  : undefined;

const voiceResponseUnsubscribe = voiceStream
  ? hub.subscribe((event) => {
      if (event.type !== 'run.completed' && event.type !== 'run.blocked' && event.type !== 'run.failed') return;
      const sessionId = voiceSessions.sessionIdForRun(event.runId);
      const snapshot = runners.get(event.runId)?.snapshot();
      if (!sessionId || !snapshot) return;

      const spoken = safeSpokenRunSummary(snapshot, store.listEvents(event.runId));
      if (!spoken) return;
      void voiceStream.speak(sessionId, spoken).catch((error) => {
        console.error('voice response failed', error instanceof Error ? error.message : String(error));
      });
    })
  : undefined;

let shuttingDown = false;
function shutdown(): void {
  if (shuttingDown) return;
  shuttingDown = true;
  voiceResponseUnsubscribe?.();
  void (async () => {
    await voiceStream?.close().catch((error) => console.error('voice shutdown failed', error instanceof Error ? error.message : String(error)));
    server.close(() => {
      store.close();
      process.exit(0);
    });
  })();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

server.listen(port, '0.0.0.0', () => {
  console.log(`JANUS runtime listening on http://0.0.0.0:${port}`);
});
