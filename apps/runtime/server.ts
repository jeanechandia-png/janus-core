import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync, mkdtempSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ChatCompletionsModelAdapter } from '../../packages/adapters/src/chat-completions-model-adapter.js';
import { GitHubAdapter } from '../../packages/adapters/src/github-adapter.js';
import { NetlifyDeployAdapter } from '../../packages/adapters/src/netlify-deploy-adapter.js';
import { AsanaAdapter } from '../../packages/adapters/src/asana-adapter.js';
import { VercelAdapter } from '../../packages/adapters/src/vercel-adapter.js';
import { RunwayAdapter } from '../../packages/adapters/src/runway-adapter.js';
import { PerplexityAdapter } from '../../packages/adapters/src/perplexity-adapter.js';
import { KlingAdapter } from '../../packages/adapters/src/kling-adapter.js';
import { N8nAdapter, parseN8nWebhooks } from '../../packages/adapters/src/n8n-adapter.js';
import { HttpRequestAdapter, parseHttpEndpoints } from '../../packages/adapters/src/http-request-adapter.js';
import { GoogleWorkspaceWriteAdapter } from '../../packages/adapters/src/google-workspace-write-adapter.js';
import { NetlifyReleaseAdapter } from '../../packages/adapters/src/netlify-release-adapter.js';
import { SupabaseManagementAdapter } from '../../packages/adapters/src/supabase-management-adapter.js';
import { SupabaseWriteAdapter } from '../../packages/adapters/src/supabase-write-adapter.js';
import { HostingerAdapter } from '../../packages/adapters/src/hostinger-adapter.js';
import { HostingerReleaseAdapter, parseHostingerSites } from '../../packages/adapters/src/hostinger-release-adapter.js';
import { VercelReleaseAdapter } from '../../packages/adapters/src/vercel-release-adapter.js';
import {
  interpretTranscript,
  transcriptionVocabularyPrompt,
  type TranscriptInterpretation,
} from '../../packages/core/src/transcript-interpretation.js';
import { decideEffort, effortPlanningGuidance, type EffortDecision } from '../../packages/core/src/effort-policy.js';
import { enforceSensitiveActionPolicy, SENSITIVE_TOOL_ACTIONS } from '../../packages/orchestrator/src/sensitive-action-policy.js';
import { ApprovalDecisionError, ApprovalQueue } from '../../packages/core/src/approval-queue.js';
import { applyToolCatalogSync, diffToolCatalog } from '../../packages/core/src/blueprint-tool-sync.js';
import { BudgetedModelGateway } from '../../packages/gateways/src/budgeted-model-gateway.js';
import { FallbackModelRouter } from '../../packages/gateways/src/model-router.js';
import { AnthropicMessagesModelAdapter } from '../../packages/adapters/src/anthropic-messages-model-adapter.js';
import { describeModelProviders, resolveModelProviders } from '../../packages/core/src/model-provider-config.js';
import { AssistantConsumerStatusAdapter } from '../../packages/adapters/src/assistant-consumer-status-adapter.js';
import {
  evaluateConsumerAcknowledgement,
  resolveConsumerStatusUrls,
} from '../../packages/core/src/assistant-consumer-ack.js';
import {
  assessPublishedRelease,
  publishedDeploymentObservationFromOutput,
} from '../../packages/core/src/published-release.js';
import { GoogleWorkspaceAdapter } from '../../packages/adapters/src/google-workspace-adapter.js';
import { MetaInsightsAdapter } from '../../packages/adapters/src/meta-insights-adapter.js';
import { ThreadsInsightsAdapter } from '../../packages/adapters/src/threads-insights-adapter.js';
import { YouTubeInsightsAdapter } from '../../packages/adapters/src/youtube-insights-adapter.js';
import { Qwen3TtsHttpAdapter } from '../../packages/adapters/src/qwen3-tts-http-adapter.js';
import { ElevenLabsTtsAdapter } from '../../packages/adapters/src/elevenlabs-tts-adapter.js';
import { WhisperCppSttAdapter } from '../../packages/adapters/src/whisper-cpp-stt-adapter.js';
import { CapabilityRegistry } from '../../packages/core/src/capability-registry.js';
import {
  buildProductOperationsSnapshot,
  createMonetizationRequirementSnapshot,
  createProductHealthSnapshot,
  createProductLedgerEntry,
  createProductOperationalRecord,
  createSocialChannelSnapshot,
  type MonetizationRequirementSnapshot,
  type ProductHealthSnapshot,
  type ProductLedgerEntry,
  type ProductOperationalRecord,
  type SocialChannelSnapshot,
} from '../../packages/core/src/business-operations.js';
import { ErrorLedger, reconstructContinuity } from '../../packages/core/src/continuity.js';
import { EVOLUTION_CHECKS, premortem, postmortem, type EvolutionObservation, type EvolutionCheckId } from '../../packages/modules/janus-evolution-guard/src/index.js';
import { classifyExplicitContinuity } from '../../packages/core/src/continuity-classifier.js';
import {
  founderReferenceChronologyRecord,
  founderReferenceNeedsUpdate,
  mergeFounderReferenceLibraries,
  parseFounderReferenceLibrary,
} from '../../packages/core/src/founder-reference-library.js';
import { buildFounderSocialSourceRegistry, groupFounderSocialAccounts } from '../../packages/core/src/founder-social-sources.js';
import { planSocialWatch, runSocialWatch, type SocialWatchReport } from '../../packages/core/src/social-watch.js';
import { SocialWatchScheduler, parseWatchIntervalMinutes } from '../../packages/core/src/social-watch-scheduler.js';
import { buildFounderMailAccountRegistry, planMailAccess } from '../../packages/core/src/founder-mail-accounts.js';
import { buildFounderPhoneChannelRegistry, planPhoneAccess } from '../../packages/core/src/founder-phone-channels.js';
import {
  founderSocialIdentityBindingChronologyRecord,
  founderSocialIdentityBindingFromChronology,
  validateFounderSocialIdentityBinding,
} from '../../packages/core/src/founder-social-identity-binding.js';
import { DeliveryGate, FOUNDER_REQUIRED_DIMENSIONS } from '../../packages/core/src/delivery-gate.js';
import {
  DEFAULT_AUTHORITY_POLICY,
  evaluateAuthority,
  type AuthorityPrincipal,
} from '../../packages/core/src/authority.js';
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
  buildReusableWorkDashboard,
  sanitizeWorkProfilePatch,
} from '../../packages/core/src/work-dashboard-template.js';
import { WorkPresenceTracker, resolveWorkPresence } from '../../packages/core/src/work-presence.js';
import {
  OPPORTUNITY_STAGES, advanceStage, buildRadarView, createOpportunity, dueOpportunityAlerts, lateDetection, markNotified,
  mergeOpportunity, parseRadarSources, runRadar, validateQuotaWindow, verifyOpportunity,
  type OpportunityStage, type RadarRunReport,
} from '../../packages/core/src/opportunity-radar.js';
import {
  WORK_SESSION_EVENT_KINDS,
  nextWorkSessionEvent,
  summarizeWorkSessions,
  type WorkSessionEventKind,
} from '../../packages/core/src/work-session.js';
import {
  WORK_AGENDA_MAX_ITEMS,
  agendaForFounder,
  agendaForOwner,
  validateWorkAgendaItem,
  type WorkAgendaItem,
} from '../../packages/core/src/work-agenda.js';
import { WORK_VIEWABLE_MIME } from '../../packages/core/src/work-dashboard-template.js';
import {
  derivePrivateTextKey,
  composeFounderMessage,
  evaluateWorkMessage,
  isMessageForFounder,
  openPrivateText,
  parseInternalRecipients,
  sealPrivateText,
} from '../../packages/core/src/work-message.js';
import {
  FounderPasskeyError,
  FounderPasskeyService,
  parsePasskeyOrigins,
  type FounderPasskeyRecord,
} from '../../packages/security/src/founder-passkey.js';
import {
  OperatorInviteError,
  assertInviteUsable,
  createOperatorInvite,
  hashInviteCode,
  isInviteCodeShape,
  publicOperatorInvite,
} from '../../packages/core/src/operator-invite.js';
import { buildPushRequest, loadVapidKeys, localDateTime, validatePushSubscription } from '../../packages/core/src/web-push.js';
import {
  operatorDailyUsage,
  parseOperatorDailyRuns,
} from '../../packages/core/src/operator-usage-limit.js';
import { COORDINATION_PREFERRED_PROVIDERS, type CoordinationPreferredProvider } from '../../packages/core/src/operator-coordination.js';
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
import {
  assertAssistantProfileRevisionAppendOnly,
  createAssistantProfileRevision,
  createAssistantSurface,
  upgradeInfinitySeedGroupSurface,
  defaultLandingAssistantProfile,
  defaultLandingAssistantSurfaces,
  resolveAssistantSurfaceConfig,
  upgradeLandingAssistantProfileFor24x7Support,
} from '../../packages/core/src/assistant-control-plane.js';
import {
  acknowledgeAssistantDelivery,
  createAssistantConfigBundle,
  createAssistantConfigDelivery,
  defaultAssistantBundlePath,
  markAssistantDeliveryFailed,
  markAssistantDeliveryPublished,
  parseAssistantConfigBundle,
  serializeAssistantConfigBundle,
} from '../../packages/core/src/assistant-config-publisher.js';
import {
  ASSISTANT_RELEASE_TARGET_METADATA_REF,
  defaultAssistantReleaseTargetPath,
  parseAssistantReleaseTargetManifest,
  resolveAssistantReleaseTarget,
  verifyReleaseHeadCustody,
  type AssistantReleaseTargetManifest,
} from '../../packages/core/src/assistant-release-target.js';
import {
  CONTINUE_BY_ALTERNATIVES_POLICY,
  buildOperationalBlockerResolution,
  defaultProviderAlternatives,
  type OperationalBlockerResolution,
} from '../../packages/core/src/progress-policy.js';
import type { DecisionBlueprint } from '../../packages/core/src/decision-blueprint.js';
import { verifyReceiptChain } from '../../packages/core/src/decision-receipt.js';
import { createFounderQualityReviewers } from '../../packages/core/src/quality-reviewers.js';
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
  CredentialVault,
  FileVaultStorage,
  MemoryVaultStorage,
  parseCredentialVaultKey,
  type VaultCredentialDescription,
} from '../../packages/security/src/credential-vault.js';
import {
  GoogleOAuthClient,
  GoogleOAuthError,
  VaultCredentialProvider,
  googleCredentialService,
  type GoogleConsentMode,
} from '../../packages/security/src/google-oauth.js';
import { THREADS_SERVICE, exchangeThreadsToken, storeThreadsToken, threadsRefresher } from '../../packages/security/src/threads-token.js';
import {
  AuthorityAuthenticationError,
  LocalAuthorityAuthService,
  type AuthorityCredentialStore,
} from '../../packages/security/src/authority-auth.js';
import {
  bearerTokenFromAuthorization,
  biometricProofIdsFromBody,
  confirmedActionsFromBody,
  isSecureAuthorityTransport,
} from '../../packages/security/src/http-auth.js';
import {
  FounderBiometricError,
  FounderBiometricService,
  type BiometricKeyRegistration,
  type BiometricKeyStore,
} from '../../packages/security/src/founder-biometric.js';
import { CompositeVoiceGateway } from '../../packages/voice/src/composite-gateway.js';
import { FallbackTextToSpeechGateway } from '../../packages/voice/src/fallback-tts-gateway.js';
import { VoiceSessionRegistry } from '../../packages/voice/src/registry.js';
import type { VoiceSpeakerHint } from '../../packages/voice/src/speaker-hint.js';
import { SenecaToolAdapter } from '../../packages/adapters/src/seneca-tool-adapter.js';
import { BusinessKnowledgeToolAdapter } from '../../packages/adapters/src/business-knowledge-tool-adapter.js';
import { buildReadback, type KnowledgeProposal } from '../../packages/modules/business-knowledge/src/index.js';
import {
  ATTACHMENT_PROFILES,
  FileAttachmentStore,
  classifyScan,
  describeAttachmentsForMessage,
  isAttachmentId,
  stripAttachmentMarkers,
  type AttachmentSource,
} from '../../packages/modules/chat-attachments/src/index.js';
import { JanusSchoolToolAdapter, JsonFileSchoolProgressStore } from '../../packages/adapters/src/janus-school-tool-adapter.js';
import { fetchHourlyForecast } from '../../packages/adapters/src/open-meteo-adapter.js';
import { CREATURES } from '../../packages/modules/companion/src/index.js';
import type { HomeDevice, HomeDeviceKind } from '../../packages/modules/kid-dashboard/src/index.js';
import { createKidRoutes } from './kid-routes.js';
import { MarcusAureliusToolAdapter } from '../../packages/adapters/src/marcus-aurelius-tool-adapter.js';
import { createSpeakerRecognition, type SpeakerRecognitionRuntime } from '../../packages/adapters/src/speaker-recognition-adapter.js';
import { policyForSpeaker, restrictBlueprintTools } from '../../packages/core/src/speaker-policy.js';
import { fuseIdentityHints } from '../../packages/core/src/identity-fusion.js';
import { createFaceRecognition, type FaceHint, type FaceRecognitionRuntime } from '../../packages/adapters/src/face-recognition-adapter.js';
import { safeSpokenRunSummary } from '../../packages/voice/src/run-response.js';
import { VoiceStreamServer } from '../../packages/voice/src/websocket-transport.js';
import { VoiceAuthority, VoiceAuthorityError } from '../../packages/security/src/voice-authority.js';

const port = Number(process.env.PORT ?? 8787);
// Política local-first: el servicio contiene datos y trazas privados; escuchando
// en 0.0.0.0 expondría endpoints de lectura antiguos sin autenticación.
// Acceso desde otros dispositivos: SOLO mediante un proxy HTTPS autenticado hacia loopback.
const bindHost = process.env.JANUS_BIND_HOST?.trim() || '127.0.0.1';
if (!['127.0.0.1', '::1', 'localhost'].includes(bindHost)) {
  throw new Error('JANUS_BIND_HOST remoto rechazado: use loopback y un proxy HTTPS autenticado; no exponga SQLite/Janus directamente.');
}
const root = fileURLToPath(new URL('../pwa/', import.meta.url));
const dashboardRoot = fileURLToPath(new URL('../../prototypes/dashboard/', import.meta.url));
const dashboardBuild = join(dashboardRoot, 'build.cjs');
const founderReferenceLibraryPath = fileURLToPath(
  new URL('../../config/founder-reference-library.json', import.meta.url),
);
// Capa LOCAL (ignorada por git) con referencias personales del Founder; nunca se publica.
const founderReferenceLocalOverlayPath = fileURLToPath(
  new URL('../../config/founder-reference-library.local.json', import.meta.url),
);
const dbPath = process.env.JANUS_DB ?? join(process.cwd(), 'data', 'janus.db');
// Adjuntos del chat («+»): junto a la base de datos (en la tablet: ~/janus-data/attachments). Tope total de espacio configurable.
const attachmentsDir = process.env.JANUS_ATTACHMENTS_DIR?.trim()
  || (dbPath === ':memory:' || dbPath === ''
    ? mkdtempSync(join(tmpdir(), 'janus-attachments-')) // base en memoria (pruebas): adjuntos efímeros, nunca en el repositorio
    : join(dirname(dbPath), 'attachments'));
const attachmentsMaxMb = Number(process.env.JANUS_ATTACHMENTS_MAX_MB);
const attachmentStore = new FileAttachmentStore({
  dir: attachmentsDir,
  ...(Number.isFinite(attachmentsMaxMb) && attachmentsMaxMb > 0 ? { maxTotalBytes: Math.floor(attachmentsMaxMb * 1024 * 1024) } : {}),
});
const timeZone = process.env.JANUS_TIME_ZONE?.trim() || undefined;
const sttBaseUrl = process.env.JANUS_STT_BASE_URL?.trim() || undefined;
const ttsBaseUrl = process.env.JANUS_TTS_BASE_URL?.trim() || undefined;
const defaultVoiceId = process.env.JANUS_VOICE_ID?.trim() || 'janus-default';
// Proveedor de voz: 'local' (por defecto) o 'elevenlabs' (temporal y opcional; ver docs/voice-elevenlabs-provider.md).
const ttsProviderSetting = process.env.JANUS_TTS_PROVIDER?.trim().toLowerCase() === 'elevenlabs' ? 'elevenlabs' : 'local';
// Solo este identificador de Janus puede salir a la nube; el resto se atiende siempre en local.
const elevenLabsVoiceId = process.env.JANUS_ELEVENLABS_VOICE_ID?.trim() || undefined;
let voiceTtsRouting: {
  provider: 'qwen3-tts-adapter' | 'elevenlabs-with-fallback' | 'elevenlabs-only';
  router?: FallbackTextToSpeechGateway;
  elevenlabs?: ElevenLabsTtsAdapter;
} = { provider: 'qwen3-tts-adapter' };
const trustSecureAuthProxy = process.env.JANUS_AUTH_TRUST_SECURE_PROXY === 'true';
const allowBiometricBootstrap = process.env.JANUS_ALLOW_BIOMETRIC_BOOTSTRAP === 'true';
const founderBiometricKeyId =
  process.env.JANUS_FOUNDER_BIOMETRIC_KEY_ID?.trim() || 'founder-face-key';
const metaGraphApiVersion = process.env.META_GRAPH_API_VERSION?.trim() || undefined;

// Buzones del Founder (capa LOCAL de la biblioteca de referencias). Un fallo al leerla no debe tumbar el runtime.
const founderMailRegistry = (() => {
  try {
    if (!existsSync(founderReferenceLibraryPath)) return null;
    return buildFounderMailAccountRegistry(loadFounderReferenceLibrary());
  } catch (error) {
    console.warn(`Founder mail accounts unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
})();
const mailAccounts = founderMailRegistry?.accounts ?? [];
// Teléfono del Founder (misma capa local). Describe y planifica; no llama ni envía nada.
const founderPhoneRegistry = (() => {
  try {
    if (!existsSync(founderReferenceLibraryPath)) return null;
    return buildFounderPhoneChannelRegistry(loadFounderReferenceLibrary());
  } catch (error) {
    console.warn(`Founder phone channels unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
})();
const envSuffix = (accountId: string) => accountId.toUpperCase().replace(/[^A-Z0-9]/g, '_');
// Una credencial por buzón: GOOGLE_ACCESS_TOKEN__<ID> (lectura) y GOOGLE_WRITE_ACCESS_TOKEN__<ID> (borradores).
const mailServiceVariables: Record<string, string> = Object.fromEntries(
  mailAccounts.flatMap((account) => [
    [`google-workspace:${account.accountId}`, `GOOGLE_ACCESS_TOKEN__${envSuffix(account.accountId)}`],
    [`google-workspace-write:${account.accountId}`, `GOOGLE_WRITE_ACCESS_TOKEN__${envSuffix(account.accountId)}`],
  ]),
);

// Endpoints HTTP que el Founder autoriza por nombre (JANUS_HTTP_ENDPOINTS). Cada credencial viaja en
// JANUS_HTTP_TOKEN_<SERVICIO>; nunca en el JSON de endpoints ni en SQLite.
const httpEndpoints = parseHttpEndpoints(process.env.JANUS_HTTP_ENDPOINTS);
const httpServiceVariables: Record<string, string> = Object.fromEntries(
  Object.values(httpEndpoints)
    .filter((endpoint) => endpoint.credentialService)
    .map((endpoint) => [endpoint.credentialService!, `JANUS_HTTP_TOKEN_${endpoint.credentialService!.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`]),
);
const environmentCredentials = new EnvironmentCredentialProvider({
  serviceVariables: {
    github: 'GITHUB_TOKEN',
    netlify: 'NETLIFY_AUTH_TOKEN',
    'google-workspace': 'GOOGLE_ACCESS_TOKEN',
    meta: 'META_ACCESS_TOKEN',
    youtube: 'YOUTUBE_ACCESS_TOKEN',
    model: 'JANUS_MODEL_API_KEY',
    openai: 'JANUS_OPENAI_API_KEY',
    anthropic: 'JANUS_ANTHROPIC_API_KEY',
    gemini: 'JANUS_GEMINI_API_KEY',
    asana: 'ASANA_ACCESS_TOKEN',
    vercel: 'VERCEL_TOKEN',
    runway: 'RUNWAYML_API_SECRET',
    perplexity: 'PERPLEXITY_API_KEY',
    kling: 'KLING_API_KEY',
    n8n: 'N8N_API_KEY',
    threads: 'THREADS_ACCESS_TOKEN',
    'google-workspace-write': 'GOOGLE_WRITE_ACCESS_TOKEN',
    'netlify-release': 'NETLIFY_RELEASE_TOKEN',
    supabase: 'SUPABASE_ACCESS_TOKEN',
    'supabase-write': 'SUPABASE_WRITE_ACCESS_TOKEN',
    'vercel-release': 'VERCEL_RELEASE_TOKEN',
    hostinger: 'HOSTINGER_API_TOKEN',
    'hostinger-release': 'HOSTINGER_RELEASE_TOKEN',
    elevenlabs: 'ELEVENLABS_API_KEY',
    'knowledge-publish': 'JANUS_KNOWLEDGE_PUBLISH_TOKEN',
    ...httpServiceVariables,
    ...mailServiceVariables,
  },
});

// Almacén cifrado de credenciales (AES-256-GCM). Sin llave no hay almacén: Janus sigue con el puente de entorno de desarrollo.
const credentialVault = (() => {
  const keyText = process.env.JANUS_CREDENTIAL_VAULT_KEY;
  if (!keyText?.trim()) return null;
  try {
    // Con base de datos en memoria (pruebas) el almacén también vive solo en memoria, salvo que se indique una ruta.
    const explicitPath = process.env.JANUS_CREDENTIAL_VAULT_PATH?.trim();
    const storage = explicitPath
      ? new FileVaultStorage(explicitPath)
      : dbPath === ':memory:'
        ? new MemoryVaultStorage()
        : new FileVaultStorage(join(dirname(dbPath), 'credentials.vault'));
    return new CredentialVault(storage, parseCredentialVaultKey(keyText));
  } catch (error) {
    console.warn(`Credential vault unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
})();
// Consentimiento de Google por buzón. La URL de retorno debe estar registrada en el cliente OAuth de Google Cloud.
const oauthRedirectBase = (process.env.JANUS_OAUTH_REDIRECT_BASE?.trim() || `http://127.0.0.1:${port}`).replace(/\/+$/, '');
const googleOAuth = (() => {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  if (!clientId || !credentialVault) return null;
  try {
    return new GoogleOAuthClient({
      clientId,
      ...(process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() ? { clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET.trim() } : {}),
      redirectUri: `${oauthRedirectBase}/api/oauth/google/callback`,
    });
  } catch (error) {
    console.warn(`Google OAuth unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
})();
const vaultCredentialProvider = credentialVault
  ? new VaultCredentialProvider({
      vault: credentialVault,
      refreshers: {
        ...(googleOAuth ? { 'oauth-google': async (entry) => googleOAuth.refresh(entry.refreshToken!) } : {}),
        'long-lived-token': threadsRefresher(),
      },
    })
  : null;
// El token del almacén va primero: gana sobre una variable de entorno de desarrollo.
const credentialBroker = new CredentialBroker([...(vaultCredentialProvider ? [vaultCredentialProvider] : []), environmentCredentials]);

// Metadatos del almacén (sin secretos), refrescados tras cada cambio. Sirven para los planes y las instantáneas, que son síncronos.
const vaultCache = new Map<string, VaultCredentialDescription>();
async function refreshVaultCache(): Promise<void> {
  if (!credentialVault) return;
  try {
    const all = await credentialVault.describeAll();
    vaultCache.clear();
    for (const item of all) vaultCache.set(item.service, item);
  } catch (error) {
    vaultCache.clear();
    console.warn(`Credential vault unreadable: ${error instanceof Error ? error.message : String(error)}`);
  }
}
function credentialConfigured(service: string): boolean {
  if (environmentCredentials.configured(service)) return true;
  const entry = vaultCache.get(service);
  return Boolean(entry && !entry.needsReconsent && (entry.hasAccessToken || entry.hasRefreshToken));
}

const hub = new EventHub();
const store = new SqliteStore(dbPath);
const authorityCredentialStore: AuthorityCredentialStore = {
  get: (principalId) => store.getAuthorityCredential(principalId),
  list: (activeOnly) => store.listAuthorityCredentials(activeOnly),
  upsert: (credential) => store.upsertAuthorityCredential(credential),
  revoke: (principalId, revokedAt) => store.revokeAuthorityCredential(principalId, revokedAt),
};
const authorityAuth = new LocalAuthorityAuthService(authorityCredentialStore);
const founderBiometricKeyStore: BiometricKeyStore = {
  get: (keyId) => store.getBiometricPublicKey(keyId) as BiometricKeyRegistration | null,
  list: (principalId, activeOnly) => (
    store.listBiometricPublicKeys(principalId, activeOnly) as BiometricKeyRegistration[]
  ),
  upsert: (registration) => store.upsertBiometricPublicKey(registration),
  revoke: (keyId, revokedAt) => store.revokeBiometricPublicKey(keyId, revokedAt),
};
const founderBiometric = new FounderBiometricService(founderBiometricKeyStore);
// Llave de acceso del navegador (Face ID de Safari) como segunda vía de confirmación del CEO, SOLO para las acciones
// de `passkeyActions` (dar acceso a colaboradores). Decisión del CEO del 10-nov-2026; `JANUS_FOUNDER_PASSKEY=off` la apaga.
const founderPasskeyEnabled = process.env.JANUS_FOUNDER_PASSKEY?.trim().toLowerCase() !== 'off';
const allowPasskeyBootstrap = process.env.JANUS_ALLOW_PASSKEY_BOOTSTRAP === 'true';
const founderPasskey = founderPasskeyEnabled
  ? new FounderPasskeyService({
      get: (credentialId) => store.getFounderPasskey<FounderPasskeyRecord>(credentialId),
      list: (activeOnly) => store.listFounderPasskeys<FounderPasskeyRecord>(activeOnly),
      upsert: (record) => store.upsertFounderPasskey(record),
    }, {
      origins: parsePasskeyOrigins(process.env.JANUS_PASSKEY_ORIGINS, port),
      allowedActions: DEFAULT_AUTHORITY_POLICY.passkeyActions ?? [],
    })
  : null;
const configuredFounderPublicKey = environmentPem('JANUS_FOUNDER_PUBLIC_KEY_PEM');
if (configuredFounderPublicKey) {
  authorityAuth.ensureFounderCredential(
    configuredFounderPublicKey,
    process.env.JANUS_FOUNDER_DISPLAY_NAME?.trim() || undefined,
  );
}
const configuredFounderBiometricPublicKey =
  environmentPem('JANUS_FOUNDER_BIOMETRIC_PUBLIC_KEY_PEM');
if (configuredFounderBiometricPublicKey) {
  founderBiometric.registerFaceKey({
    keyId: founderBiometricKeyId,
    publicKeyPem: configuredFounderBiometricPublicKey,
    biometry: 'face',
    binding: 'biometry-current-set',
  });
}
const runners = new Map<string, TaskRunner>();
const runBlueprints = new Map<string, DecisionBlueprint>();
const runLearners = new Map<string, string>();
const runAssignments = new Map<string, { assignmentId: string; principalId: string }>();
const runProjects = new Map<string, { projectId: string; threadId: string }>();
const runBlockerResolutions = new Map<string, OperationalBlockerResolution>();
const runInterpretations = new Map<string, TranscriptInterpretation>();
const runEfforts = new Map<string, EffortDecision>();
const runModelBudgets = new Map<string, BudgetedModelGateway>();
const approvalTimeoutMs = Math.min(24 * 60 * 60 * 1000, Math.max(30_000, Number(process.env.JANUS_APPROVAL_TIMEOUT_MS) || 15 * 60 * 1000));
const approvalQueue = new ApprovalQueue({
  timeoutMs: approvalTimeoutMs,
  onTransition: (record) => {
    recordDecision({
      runId: record.runId,
      decisionKind: 'founder_approval',
      selectedWorker: 'janus-core/founder-approval-queue-v1',
      confidence: 1,
      outputSummary: record.status === 'pending'
        ? 'Sensitive action is waiting for an explicit Founder decision.'
        : 'Founder approval request ' + record.status + '.',
      metadata: { ...record },
    });
  },
});
const toolGateway = new DefaultToolGateway();
const capabilities = new CapabilityRegistry();
// Founder norm (2026-10-21): structural, orthographic, synthesis, coherence, visual, architectural, i18n filters + style review.
const deliveryGate = new DeliveryGate(createFounderQualityReviewers(), { required: FOUNDER_REQUIRED_DIMENSIONS });

toolGateway.register(new GitHubAdapter({
  tokenProvider: () => credentialBroker.accessToken('github'),
}));
const assistantConsumerStatusUrls = resolveConsumerStatusUrls(process.env.JANUS_ASSISTANT_STATUS_URLS);
toolGateway.register(new AssistantConsumerStatusAdapter({
  allowedUrls: Object.values(assistantConsumerStatusUrls),
}));
toolGateway.register(new NetlifyDeployAdapter({
  tokenProvider: () => credentialBroker.accessToken('netlify'),
}));
toolGateway.register(new AsanaAdapter({
  tokenProvider: () => credentialBroker.accessToken('asana'),
}));
toolGateway.register(new VercelAdapter({
  tokenProvider: () => credentialBroker.accessToken('vercel'),
  ...(process.env.VERCEL_TEAM_ID?.trim() ? { defaultTeamId: process.env.VERCEL_TEAM_ID.trim() } : {}),
}));
toolGateway.register(new RunwayAdapter({
  tokenProvider: () => credentialBroker.accessToken('runway'),
  ...(process.env.RUNWAY_API_VERSION?.trim() ? { runwayVersion: process.env.RUNWAY_API_VERSION.trim() } : {}),
}));
const netlifyReleaseSites = (process.env.JANUS_NETLIFY_RELEASE_SITES ?? '').split(',').map((item) => item.trim()).filter(Boolean);
toolGateway.register(new NetlifyReleaseAdapter({
  tokenProvider: () => credentialBroker.accessToken('netlify-release'),
  allowedSiteIds: netlifyReleaseSites,
}));
toolGateway.register(new SupabaseManagementAdapter({
  tokenProvider: () => credentialBroker.accessToken('supabase'),
}));
const supabaseWriteProjects = (process.env.JANUS_SUPABASE_WRITE_PROJECTS ?? '').split(',').map((item) => item.trim()).filter(Boolean);
toolGateway.register(new SupabaseWriteAdapter({
  tokenProvider: () => credentialBroker.accessToken('supabase-write'),
  allowedProjectRefs: supabaseWriteProjects,
}));
const vercelReleaseProjects = (process.env.JANUS_VERCEL_RELEASE_PROJECTS ?? '').split(',').map((item) => item.trim()).filter(Boolean);
toolGateway.register(new VercelReleaseAdapter({
  tokenProvider: () => credentialBroker.accessToken('vercel-release'),
  allowedProjects: vercelReleaseProjects,
  ...(process.env.VERCEL_TEAM_ID?.trim() ? { defaultTeamId: process.env.VERCEL_TEAM_ID.trim() } : {}),
}));
toolGateway.register(new HostingerAdapter({
  tokenProvider: () => credentialBroker.accessToken('hostinger'),
}));
const hostingerSites = parseHostingerSites(process.env.JANUS_HOSTINGER_SITES);
toolGateway.register(new HostingerReleaseAdapter({
  tokenProvider: () => credentialBroker.accessToken('hostinger-release'),
  sites: hostingerSites,
}));
toolGateway.register(new PerplexityAdapter({
  tokenProvider: () => credentialBroker.accessToken('perplexity'),
}));
toolGateway.register(new KlingAdapter({
  tokenProvider: () => credentialBroker.accessToken('kling'),
  ...(process.env.KLING_DEFAULT_MODEL?.trim() ? { defaultModel: process.env.KLING_DEFAULT_MODEL.trim() } : {}),
}));
const n8nWebhooks = parseN8nWebhooks(process.env.JANUS_N8N_WEBHOOKS);
toolGateway.register(new N8nAdapter({
  ...(process.env.N8N_BASE_URL?.trim() ? { baseUrl: process.env.N8N_BASE_URL.trim() } : {}),
  tokenProvider: () => credentialBroker.accessToken('n8n'),
  webhooks: n8nWebhooks,
}));
toolGateway.register(new HttpRequestAdapter({
  endpoints: httpEndpoints,
  tokenProvider: (service) => credentialBroker.accessToken(service),
}));
toolGateway.register(new GoogleWorkspaceWriteAdapter({
  tokenProvider: () => credentialBroker.accessToken('google-workspace-write', ['gmail.compose', 'calendar.events']),
  accountTokenProvider: (accountId) => credentialBroker.accessToken(`google-workspace-write:${accountId}`, ['gmail.compose', 'calendar.events']),
  allowedAccounts: new Set(mailAccounts.filter((account) => account.permittedWriteActions.length > 0).map((account) => account.accountId)),
}));
toolGateway.register(new GoogleWorkspaceAdapter({
  accountTokenProvider: (accountId) => credentialBroker.accessToken(`google-workspace:${accountId}`, [
    'drive.metadata.readonly',
    'gmail.readonly',
    'calendar.events.readonly',
  ]),
  allowedAccounts: new Set(mailAccounts.map((account) => account.accountId)),
  tokenProvider: async () => (
    await credentialBroker.accessToken('google-workspace', [
      'drive.metadata.readonly',
      'gmail.readonly',
      'calendar.events.readonly',
    ])
  ) ?? '',
}));

if (metaGraphApiVersion) {
  toolGateway.register(new MetaInsightsAdapter({
    apiVersion: metaGraphApiVersion,
    tokenProvider: () => credentialBroker.accessToken('meta'),
  }));
}
toolGateway.register(new ThreadsInsightsAdapter({
  tokenProvider: () => credentialBroker.accessToken('threads'),
  ...(process.env.THREADS_API_VERSION?.trim() ? { apiVersion: process.env.THREADS_API_VERSION.trim() } : {}),
}));
toolGateway.register(new YouTubeInsightsAdapter({
  tokenProvider: () => credentialBroker.accessToken('youtube'),
}));

// LEGO modules consumed through thin adapters: read-only, local, no secrets, no network.
toolGateway.register(new SenecaToolAdapter());
capabilities.register({
  tool: 'seneca',
  actions: ['guidance.get', 'profile.get', 'quote.get', 'reflection.daily'],
  state: 'available',
});
toolGateway.register(new JanusSchoolToolAdapter(
  new JsonFileSchoolProgressStore(process.env.JANUS_SCHOOL_PROGRESS_PATH ?? 'data/school-progress.json'),
  undefined,
  { kidBirthDate: process.env.JANUS_SCHOOL_KID_BIRTHDATE?.trim() || undefined },
));
capabilities.register({
  tool: 'janus-school',
  actions: ['lesson.next', 'lesson.get', 'lesson.complete', 'glossary.lookup', 'review.next', 'review.grade', 'quiz.get', 'quiz.answer', 'kids.session', 'kids.technique', 'kids.guide', 'progress.get'],
  state: 'available',
});
toolGateway.register(new MarcusAureliusToolAdapter());
capabilities.register({
  tool: 'marcus-aurelius',
  actions: ['guidance.get', 'profile.get', 'quote.get', 'reflection.daily'],
  state: 'available',
});

// Conocimiento del negocio (precios, IVA, productos, equipo, instrucciones): se propone por voz/chat, se lee de vuelta
// y SOLO se aplica con aprobación del Founder (autoridad + Face ID). Publicar fuera de Janus es opt-in por entorno.
const knowledgePublishUrl = process.env.JANUS_KNOWLEDGE_PUBLISH_URL?.trim() || undefined;
const knowledgeAdapter = new BusinessKnowledgeToolAdapter({
  store: {
    appendRevision: (record) => store.appendBusinessKnowledgeRevision(record),
    listRevisions: () => store.listBusinessKnowledgeRevisions(),
    putProposal: (record) => store.putBusinessKnowledgeProposal(record),
    findPendingProposal: (key, nowIso) => store.findPendingBusinessKnowledgeProposal(key, nowIso),
    setProposalStatus: (id, status) => store.setBusinessKnowledgeProposalStatus(id, status),
    upsertConsumerReport: (report) => store.upsertBusinessKnowledgeConsumerReport(report),
    listConsumerReports: () => store.listBusinessKnowledgeConsumerReports(),
  },
  ...(knowledgePublishUrl
    ? { publish: { url: knowledgePublishUrl, tokenProvider: () => credentialBroker.accessToken('knowledge-publish') } }
    : {}),
  statusUrls: parseKnowledgeStatusUrls(process.env.JANUS_KNOWLEDGE_STATUS_URLS),
});
toolGateway.register(knowledgeAdapter);
capabilities.register({
  tool: 'knowledge',
  actions: ['entries.list', 'snapshot.get', 'change.propose', 'change.apply', 'sync.check'],
  state: 'available',
});
capabilities.register({
  tool: 'knowledge',
  actions: ['snapshot.publish'],
  state: knowledgePublishUrl ? 'available' : 'disabled',
  ...(knowledgePublishUrl ? {} : { reason: 'Sin destino de publicación (JANUS_KNOWLEDGE_PUBLISH_URL): el conocimiento queda solo en Janus.' }),
});

// Optional speaker recognition (convenience only; never an authority). Needs explicit configuration.
let speakerRecognition: SpeakerRecognitionRuntime | undefined;
const speakerRecognitionState: { state: 'disabled' | 'available' | 'misconfigured'; reason?: string } = { state: 'disabled' };
if (process.env.JANUS_SPEAKER_ID_ENABLED === 'true') {
  try {
    const vaultKey = process.env.JANUS_SPEAKER_VAULT_KEY;
    const embedUrl = process.env.JANUS_SPEAKER_EMBED_URL ?? 'http://127.0.0.1:8765';
    if (!vaultKey) throw new Error('JANUS_SPEAKER_VAULT_KEY is required');
    speakerRecognition = createSpeakerRecognition({
      embedUrl,
      vaultPath: process.env.JANUS_SPEAKER_VAULT_PATH ?? 'data/speaker-vault.enc.json',
      vaultKey,
    });
    speakerRecognitionState.state = 'available';
  } catch (error) {
    speakerRecognitionState.state = 'misconfigured';
    speakerRecognitionState.reason = error instanceof Error ? error.message : String(error);
    console.warn('Speaker recognition disabled:', speakerRecognitionState.reason);
  }
}

// Optional face identification of household members (convenience only; ADR-007/008 own authentication).
let faceRecognition: FaceRecognitionRuntime | undefined;
const faceRecognitionState: { state: 'disabled' | 'available' | 'misconfigured'; reason?: string } = { state: 'disabled' };
if (process.env.JANUS_FACE_ID_ENABLED === 'true') {
  try {
    const vaultKey = process.env.JANUS_FACE_VAULT_KEY;
    if (!vaultKey) throw new Error('JANUS_FACE_VAULT_KEY is required');
    faceRecognition = createFaceRecognition({
      embedUrl: process.env.JANUS_FACE_EMBED_URL ?? 'http://127.0.0.1:8792',
      vaultPath: process.env.JANUS_FACE_VAULT_PATH ?? 'data/face-vault.enc.json',
      vaultKey,
    });
    faceRecognitionState.state = 'available';
  } catch (error) {
    faceRecognitionState.state = 'misconfigured';
    faceRecognitionState.reason = error instanceof Error ? error.message : String(error);
    console.warn('Face recognition disabled:', faceRecognitionState.reason);
  }
}
const householdStrict = process.env.JANUS_HOUSEHOLD_STRICT === 'true';
const FACE_PRESENCE_TTL_MS = 5 * 60 * 1000;
const faceHints = new Map<string, { hint: FaceHint; at: number }>();
function freshFaceHint(sessionId: string): FaceHint | undefined {
  const entry = faceHints.get(sessionId);
  if (!entry) return undefined;
  if (Date.now() - entry.at > FACE_PRESENCE_TTL_MS) { faceHints.delete(sessionId); return undefined; }
  return entry.hint;
}

const githubConfigured = environmentCredentials.configured('github');
const googleConfigured = environmentCredentials.configured('google-workspace');
const netlifyConfigured = environmentCredentials.configured('netlify');
capabilities.register({
  tool: 'assistant-consumer',
  actions: ['status.read'],
  state: 'available',
});
capabilities.register({
  tool: 'netlify',
  actions: ['site.published_deploy'],
  state: netlifyConfigured ? 'available' : 'needs_auth',
  ...(!netlifyConfigured
    ? { reason: 'Netlify necesita una llave de solo lectura para comprobar qué versión está publicada.' }
    : {}),
});
const asanaConfigured = environmentCredentials.configured('asana');
const vercelConfigured = environmentCredentials.configured('vercel');
const runwayConfigured = environmentCredentials.configured('runway');
capabilities.register({
  tool: 'asana',
  actions: ['workspaces.list', 'projects.list', 'tasks.list'],
  state: asanaConfigured ? 'available' : 'needs_auth',
  ...(!asanaConfigured ? { reason: 'Asana necesita un token personal (ASANA_ACCESS_TOKEN) para leer proyectos y tareas.' } : {}),
});
capabilities.register({
  tool: 'asana',
  actions: ['task.create'],
  state: asanaConfigured ? 'available' : 'needs_auth',
  ...(!asanaConfigured ? { reason: 'Asana necesita un token personal antes de crear tareas (siempre con confirmación).' } : {}),
});
capabilities.register({
  tool: 'vercel',
  actions: ['deployments.list', 'deployment.get'],
  state: vercelConfigured ? 'available' : 'needs_auth',
  ...(!vercelConfigured ? { reason: 'Vercel necesita un token de solo lectura (VERCEL_TOKEN) para consultar despliegues.' } : {}),
});
capabilities.register({
  tool: 'runway',
  actions: ['organization.read', 'task.get'],
  state: runwayConfigured ? 'available' : 'needs_auth',
  ...(!runwayConfigured ? { reason: 'Runway necesita su API secret (RUNWAYML_API_SECRET) para consultar créditos y tareas.' } : {}),
});
capabilities.register({
  tool: 'runway',
  actions: ['image.create', 'video.create'],
  state: runwayConfigured ? 'available' : 'needs_auth',
  ...(!runwayConfigured ? { reason: 'Runway necesita su API secret; cada generación gasta créditos y pide confirmación.' } : {}),
});
capabilities.register({
  tool: 'netlify',
  actions: ['sites.list', 'deploys.list', 'deploy.get'],
  state: netlifyConfigured ? 'available' : 'needs_auth',
  ...(!netlifyConfigured ? { reason: 'Netlify necesita una llave de solo lectura (NETLIFY_AUTH_TOKEN) para listar sitios y despliegues.' } : {}),
});
const netlifyReleaseConfigured = environmentCredentials.configured('netlify-release') && netlifyReleaseSites.length > 0;
capabilities.register({
  tool: 'netlify-release',
  actions: ['deploy.restore'],
  state: netlifyReleaseConfigured ? 'available' : 'needs_auth',
  ...(!netlifyReleaseConfigured ? { reason: 'Volver a un despliegue anterior necesita NETLIFY_RELEASE_TOKEN y los sitios autorizados en JANUS_NETLIFY_RELEASE_SITES; siempre con aprobación.' } : {}),
});
const supabaseConfigured = environmentCredentials.configured('supabase');
capabilities.register({
  tool: 'supabase',
  actions: ['projects.list', 'project.health', 'advisors.security', 'advisors.performance', 'migrations.list'],
  state: supabaseConfigured ? 'available' : 'needs_auth',
  ...(!supabaseConfigured ? { reason: 'Supabase necesita un token de acceso (SUPABASE_ACCESS_TOKEN); Janus solo consulta salud, asesores y migraciones, nunca datos de clientes.' } : {}),
});
const supabaseWriteConfigured = environmentCredentials.configured('supabase-write') && supabaseWriteProjects.length > 0;
capabilities.register({
  tool: 'supabase-write',
  actions: ['migration.apply', 'sql.execute'],
  state: supabaseWriteConfigured ? 'available' : 'needs_auth',
  ...(!supabaseWriteConfigured ? { reason: 'Aplicar migraciones o SQL necesita SUPABASE_WRITE_ACCESS_TOKEN y los proyectos autorizados en JANUS_SUPABASE_WRITE_PROJECTS; siempre con aprobación y sin devolver datos de clientes.' } : {}),
});
const vercelReleaseConfigured = environmentCredentials.configured('vercel-release') && vercelReleaseProjects.length > 0;
capabilities.register({
  tool: 'vercel-release',
  actions: ['deployment.redeploy'],
  state: vercelReleaseConfigured ? 'available' : 'needs_auth',
  ...(!vercelReleaseConfigured ? { reason: 'Redesplegar necesita VERCEL_RELEASE_TOKEN y los proyectos autorizados en JANUS_VERCEL_RELEASE_PROJECTS; siempre con aprobación.' } : {}),
});
const hostingerConfigured = environmentCredentials.configured('hostinger');
capabilities.register({
  tool: 'hostinger',
  actions: ['websites.list'],
  state: hostingerConfigured ? 'available' : 'needs_auth',
  ...(!hostingerConfigured ? { reason: 'Hostinger necesita un token de API (HOSTINGER_API_TOKEN, se crea en hPanel) para listar las webs.' } : {}),
});
const hostingerReleaseConfigured = environmentCredentials.configured('hostinger-release') && Object.keys(hostingerSites).length > 0;
capabilities.register({
  tool: 'hostinger-release',
  actions: ['site.deploy'],
  state: hostingerReleaseConfigured ? 'available' : 'needs_auth',
  ...(!hostingerReleaseConfigured ? { reason: 'Publicar o reemplazar una web en Hostinger necesita HOSTINGER_RELEASE_TOKEN y los dominios autorizados en JANUS_HOSTINGER_SITES; siempre con aprobación.' } : {}),
});
const perplexityConfigured = environmentCredentials.configured('perplexity');
const klingConfigured = environmentCredentials.configured('kling');
const n8nApiConfigured = environmentCredentials.configured('n8n') && Boolean(process.env.N8N_BASE_URL?.trim());
const googleWriteConfigured = environmentCredentials.configured('google-workspace-write');
capabilities.register({
  tool: 'perplexity',
  actions: ['research.ask'],
  state: perplexityConfigured ? 'available' : 'needs_auth',
  ...(!perplexityConfigured ? { reason: 'Perplexity necesita su API key (PERPLEXITY_API_KEY) para investigar con fuentes.' } : {}),
});
capabilities.register({
  tool: 'kling',
  actions: ['task.get', 'video.create'],
  state: klingConfigured ? 'available' : 'needs_auth',
  ...(!klingConfigured ? { reason: 'Kling AI necesita su API key (KLING_API_KEY); cada vídeo gasta créditos y pide confirmación.' } : {}),
});
capabilities.register({
  tool: 'n8n',
  actions: ['workflows.list', 'executions.list', 'execution.get'],
  state: n8nApiConfigured ? 'available' : 'needs_auth',
  ...(!n8nApiConfigured ? { reason: 'n8n necesita N8N_BASE_URL (https) y N8N_API_KEY (no disponible en la prueba gratuita de n8n).' } : {}),
});
capabilities.register({
  tool: 'n8n',
  actions: ['workflow.trigger'],
  state: Object.keys(n8nWebhooks).length > 0 ? 'available' : 'needs_auth',
  ...(Object.keys(n8nWebhooks).length === 0 ? { reason: 'Para disparar flujos, el Founder debe autorizar sus webhooks por nombre en JANUS_N8N_WEBHOOKS.' } : {}),
});
const httpEndpointNames = Object.keys(httpEndpoints);
capabilities.register({
  tool: 'http',
  actions: ['request.read'],
  state: httpEndpointNames.length > 0 ? 'available' : 'needs_auth',
  ...(httpEndpointNames.length === 0 ? { reason: 'Peticiones HTTP/REST: el Founder debe autorizar endpoints por nombre en JANUS_HTTP_ENDPOINTS (solo https; los flujos nunca escriben URLs libres).' } : {}),
});
capabilities.register({
  tool: 'http',
  actions: ['request.send'],
  state: httpEndpointNames.length > 0 ? 'available' : 'needs_auth',
  ...(httpEndpointNames.length === 0 ? { reason: 'Enviar datos por HTTP escribe en un sistema externo: necesita endpoints autorizados y siempre pide aprobación.' } : {}),
});
capabilities.register({
  tool: 'google-workspace-write',
  actions: ['gmail.draft.create', 'gmail.draft.update', 'gmail.draft.send', 'calendar.event.create'],
  state: googleWriteConfigured ? 'available' : 'needs_auth',
  ...(!googleWriteConfigured ? { reason: 'Escribir en Google (borradores de Gmail, eventos de Calendar) necesita un token aparte con permisos gmail.compose y calendar.events.' } : {}),
});
const metaTokenConfigured = environmentCredentials.configured('meta');
const threadsTokenConfigured = environmentCredentials.configured('threads');
const youtubeConfigured = environmentCredentials.configured('youtube');
capabilities.register({
  tool: 'github',
  actions: ['repo.get', 'contents.list', 'branch.get', 'file.read'],
  state: 'available',
});
capabilities.register({
  tool: 'github',
  actions: ['file.publish'],
  state: githubConfigured ? 'available' : 'needs_auth',
  ...(!githubConfigured
    ? { reason: 'GitHub necesita autorización de escritura antes de publicar la configuración del asistente.' }
    : {}),
});
capabilities.register({
  tool: 'google-workspace',
  actions: ['drive.files.search', 'gmail.messages.search', 'calendar.events.list'],
  state: googleConfigured ? 'available' : 'needs_auth',
  ...(!googleConfigured ? { reason: 'Google Workspace necesita autorización antes de ejecutar.' } : {}),
});
capabilities.register({
  tool: 'meta-insights',
  actions: ['facebook.page.insights', 'instagram.account.insights'],
  state: !metaGraphApiVersion
    ? 'unavailable'
    : metaTokenConfigured
      ? 'available'
      : 'needs_auth',
  ...(!metaGraphApiVersion
    ? { reason: 'META_GRAPH_API_VERSION debe configurarse y revalidarse antes de usar Meta.' }
    : !metaTokenConfigured
      ? { reason: 'Meta necesita autorización antes de consultar insights.' }
      : {}),
});
capabilities.register({
  tool: 'threads-insights',
  actions: ['threads.account.profile', 'threads.account.insights'],
  state: threadsTokenConfigured ? 'available' : 'needs_auth',
  ...(!threadsTokenConfigured ? { reason: 'Threads necesita un token (THREADS_ACCESS_TOKEN) con permisos threads_basic y threads_manage_insights; solo lectura.' } : {}),
});
capabilities.register({
  tool: 'youtube-insights',
  actions: ['channel.statistics', 'analytics.query'],
  state: youtubeConfigured ? 'available' : 'needs_auth',
  ...(!youtubeConfigured
    ? { reason: 'YouTube necesita autorización OAuth antes de consultar estadísticas.' }
    : {}),
});

function ensureLandingAssistantControlPlane(): void {
  const seedProfile = defaultLandingAssistantProfile();
  let currentProfile = store.getAssistantProfileRevision(seedProfile.profileId);
  if (!currentProfile) {
    store.upsertAssistantProfileRevision(seedProfile);
    currentProfile = seedProfile;
  }

  const supportProfile = upgradeLandingAssistantProfileFor24x7Support(
    currentProfile,
    new Date().toISOString(),
    'janus-core',
  );
  if (supportProfile.revision !== currentProfile.revision) {
    assertAssistantProfileRevisionAppendOnly({
      previous: currentProfile,
      next: supportProfile,
    });
    store.upsertAssistantProfileRevision({ ...currentProfile, status: 'historical' });
    store.upsertAssistantProfileRevision(supportProfile);
  }

  for (const surface of defaultLandingAssistantSurfaces()) {
    if (!store.getAssistantSurface(surface.id)) store.upsertAssistantSurface(surface);
  }
  const groupSurface = store.getAssistantSurface('landing.infinity-group');
  const upgradedGroupSurface = groupSurface
    ? upgradeInfinitySeedGroupSurface(groupSurface, new Date().toISOString())
    : null;
  if (upgradedGroupSurface) store.upsertAssistantSurface(upgradedGroupSurface);
}

function productOperationsSnapshot(productId: string) {
  const product = store.getProductOperationalRecord(productId);
  if (!product) throw new HttpRequestError(404, 'product operations record not found');
  return buildProductOperationsSnapshot({
    product,
    ledgerEntries: store.listProductLedgerEntries(productId),
    healthSnapshots: store.listProductHealthSnapshots(productId),
    channelSnapshots: store.listSocialChannelSnapshots(productId),
    monetizationRequirements: store.listMonetizationRequirementSnapshots(),
    generatedAt: new Date().toISOString(),
  });
}

function productOperationsPortfolioSnapshot() {
  return store.listProductOperationalRecords().map((product) => (
    productOperationsSnapshot(product.id)
  ));
}

function assistantControlSnapshot() {
  const profiles = store.listAssistantProfileRevisions();
  const surfaces = store.listAssistantSurfaces();
  return {
    profiles,
    surfaces,
    resolved: surfaces.map((surface) => resolveAssistantSurfaceConfig({
      surface,
      profiles,
    })),
  };
}

ensureFounderReferenceLibrary();
ensureLandingAssistantControlPlane();

let runtimeBlueprint = resolveActiveRuntimeBlueprint(
  store,
  createRuntimeDecisionBlueprint({
    createdAt: '2026-09-30T18:30:00.000Z',
    toolCatalog: capabilityPolicyCatalog(),
  }),
);

const modelGateway = createConfiguredModelGateway();
const voiceGateway = createConfiguredVoiceGateway();

const voiceAuthority = new VoiceAuthority((token) => authorityAuth.authenticateSession(token) ?? undefined);
const voiceSessions = new VoiceSessionRegistry((sessionId) => ({
  start: async (text, context) => {
    const principal = voiceAuthority.principal(sessionId);
    return startRun(text, 'voice', sessionId, {
      principal,
      instruction: { id: `voice_instruction_${randomUUID()}`, principalId: principal.id,
        source: 'authenticated_human', authenticated: true, instruction: text, requestedAt: new Date().toISOString() },
    }, undefined, undefined, undefined, context?.speaker);
  },
  pause: async (runId) => { voiceAuthority.principal(sessionId); await controlActiveRun(runId, 'pause'); },
  resume: async (runId) => { voiceAuthority.principal(sessionId); await controlActiveRun(runId, 'resume'); },
  cancel: async (runId) => { voiceAuthority.principal(sessionId); await controlActiveRun(runId, 'cancel'); },
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

function loadFounderReferenceLibrary() {
  const base = parseFounderReferenceLibrary(JSON.parse(readFileSync(founderReferenceLibraryPath, 'utf8')) as unknown);
  if (!existsSync(founderReferenceLocalOverlayPath)) return base;
  const overlay = parseFounderReferenceLibrary(JSON.parse(readFileSync(founderReferenceLocalOverlayPath, 'utf8')) as unknown);
  return mergeFounderReferenceLibraries(base, overlay);
}

function ensureFounderReferenceLibrary(): void {
  if (!existsSync(founderReferenceLibraryPath)) return;
  const library = loadFounderReferenceLibrary();
  const current = continuitySnapshot().currentBySubject;

  for (const seed of library.records) {
    const previous = current[seed.subject];
    if (!founderReferenceNeedsUpdate(seed, previous)) continue;
    const record = founderReferenceChronologyRecord({
      seed,
      ownerPrincipalId: library.ownerPrincipalId,
      at: library.updatedAt,
      ...(previous ? { previous } : {}),
    });
    store.appendChronologyRecord(record);
    current[seed.subject] = record;
  }
}

function founderReferenceSnapshot() {
  const current = continuitySnapshot().currentBySubject;
  return Object.values(current)
    .filter((record) => (
      record.subject.startsWith('founder-reference:')
      || record.subject.startsWith('founder-policy:')
    ))
    .map((record) => ({
      id: record.metadata?.referenceId ?? record.id,
      subject: record.subject,
      classification: record.status,
      label: record.metadata?.label ?? record.subject,
      kind: record.metadata?.referenceKind ?? 'reference',
      value: record.metadata?.value ?? null,
      retention: record.metadata?.retention ?? null,
      tags: record.metadata?.tags ?? [],
      updatedAt: record.at,
    }));
}

function founderSocialSourceSnapshot() {
  if (!existsSync(founderReferenceLibraryPath)) {
    throw new HttpRequestError(503, 'Founder reference library is unavailable');
  }
  const library = loadFounderReferenceLibrary();
  const registry = buildFounderSocialSourceRegistry(library);
  const current = continuitySnapshot().currentBySubject;
  const bindings = Object.values(current).flatMap((record) => {
    const binding = founderSocialIdentityBindingFromChronology(record);
    return binding ? [binding] : [];
  });
  const bindingByReferenceId = new Map(
    bindings.map((binding) => [binding.referenceId, binding] as const),
  );
  const sources = registry.sources.map((source) => {
    const currentBinding = bindingByReferenceId.get(source.referenceId) ?? null;
    return {
      ...source,
      currentBinding,
      effectiveBindingState: currentBinding?.state ?? source.bindingState,
    };
  });

  const watchPlan = planSocialWatch(sources, {
    adapters: new Set([...(metaGraphApiVersion ? ['meta-insights'] : []), 'threads-insights']),
    credentials: { meta: metaTokenConfigured, threads: credentialConfigured(THREADS_SERVICE) },
  });

  return {
    ...registry,
    sources,
    bindings,
    // Plan de seguimiento: puro, sin llamadas externas. Dice qué se puede leer ya y qué falta por cuenta.
    watchPlan,
    // Enlaces sumados por cuenta (etiqueta `account:`): varios enlaces de una misma cuenta no se cuentan por separado.
    accountGroups: groupFounderSocialAccounts(registry.sources),
    metaRuntime: {
      mode: 'read_only' as const,
      graphApiVersion: metaGraphApiVersion ?? null,
      credentialConfigured: metaTokenConfigured,
      adapterRegistered: Boolean(metaGraphApiVersion),
      connectionState: !metaGraphApiVersion
        ? 'standby'
        : metaTokenConfigured
          ? 'credential_configured_unverified'
          : 'needs_auth',
      automaticExternalCalls: false,
      canonicalResolutionRequired: sources.some(
        (source) => source.platform === 'facebook'
          && !source.currentBinding?.canonicalTargetUrl,
      ),
      graphEntityBindingRequired: sources.some(
        (source) => !source.currentBinding?.graphEntityId,
      ),
    },
  };
}

/**
 * Seguimiento de redes: lee cada cuenta lista a través del Tool Gateway (solo lectura), compara con la lectura anterior guardada
 * en SQLite (`social_channel_snapshots`, origen `social-watch`) y devuelve el informe con alertas.
 */
const SOCIAL_WATCH_SOURCE = 'social-watch';
let lastSocialWatchReport: SocialWatchReport | null = null;

async function runFounderSocialWatch(): Promise<SocialWatchReport> {
  await refreshVaultCache();
  const snapshot = founderSocialSourceSnapshot();
  const platformOf = new Map(snapshot.sources.map((source) => [source.referenceId, source.platform] as const));
  const report = await runSocialWatch(snapshot.watchPlan, {
    tools: toolGateway,
    loadPrevious: (referenceId) => {
      const platform = platformOf.get(referenceId);
      const previous = platform ? store.latestSocialChannelSnapshot(platform, referenceId, SOCIAL_WATCH_SOURCE) : undefined;
      if (!previous) return undefined;
      const metrics = Object.fromEntries(Object.entries(previous.metrics).filter((entry): entry is [string, number] => typeof entry[1] === 'number'));
      return { referenceId, at: previous.verifiedAt, metrics };
    },
    save: (item) => {
      const platform = platformOf.get(item.referenceId);
      if (!platform) return;
      store.upsertSocialChannelSnapshot(createSocialChannelSnapshot({
        id: `${SOCIAL_WATCH_SOURCE}:${item.referenceId}:${item.at.replace(/[^0-9]/g, '').slice(0, 17)}`,
        platform,
        channelId: item.referenceId,
        verifiedAt: item.at,
        source: SOCIAL_WATCH_SOURCE,
        metrics: item.metrics,
        // El seguimiento mide audiencia, no elegibilidad de monetización: no se afirma nada que no se haya comprobado.
        monetizationState: 'unknown',
      }));
    },
  });
  lastSocialWatchReport = report;
  return report;
}

const socialWatchIntervalMs = parseWatchIntervalMinutes(process.env.JANUS_SOCIAL_WATCH_INTERVAL_MIN);
const socialWatchScheduler = socialWatchIntervalMs
  ? new SocialWatchScheduler({
      intervalMs: socialWatchIntervalMs,
      run: runFounderSocialWatch,
      onError: (error) => console.warn(`Social watch failed: ${error instanceof Error ? error.message.slice(0, 200) : 'error'}`),
    })
  : null;

/** Estado de la credencial de cada permiso del buzón (lectura / escritura), sin ningún secreto. */
function mailCredentialStatus(accountId: string) {
  const describe = (service: string) => {
    const fromVault = vaultCache.get(service);
    const fromEnvironment = environmentCredentials.configured(service);
    return {
      configured: credentialConfigured(service),
      source: fromVault && !fromVault.needsReconsent ? 'credential-vault' : fromEnvironment ? 'environment-development-bridge' : null,
      needsReconsent: fromVault?.needsReconsent === true,
      ...(fromVault?.accountEmail ? { authorizedAs: fromVault.accountEmail } : {}),
      ...(fromVault?.expiresAt ? { accessExpiresAt: fromVault.expiresAt } : {}),
      missingScopes: fromVault?.missingScopes ?? [],
    };
  };
  return { read: describe(googleCredentialService('read', accountId)), write: describe(googleCredentialService('write', accountId)) };
}

function syncCredentialCapabilities(): void {
  const readOk = googleConfigured || mailAccounts.some((account) => credentialConfigured(googleCredentialService('read', account.accountId)));
  capabilities.setState('google-workspace', readOk ? 'available' : 'needs_auth', readOk ? undefined : 'Google Workspace necesita autorización antes de ejecutar.');
  const writeOk = googleWriteConfigured || mailAccounts.some((account) => account.permittedWriteActions.length > 0 && credentialConfigured(googleCredentialService('write', account.accountId)));
  capabilities.setState('google-workspace-write', writeOk ? 'available' : 'needs_auth', writeOk ? undefined : 'Escribir en Google (borradores de Gmail, eventos de Calendar) necesita un token aparte con permisos gmail.compose y calendar.events.');
  const threadsOk = credentialConfigured(THREADS_SERVICE);
  capabilities.setState('threads-insights', threadsOk ? 'available' : 'needs_auth', threadsOk ? undefined : 'Threads necesita un token (THREADS_ACCESS_TOKEN o el almacén) con permisos threads_basic y threads_manage_insights; solo lectura.');
}

function oauthResultPage(response: ServerResponse, status: number, title: string, message: string): void {
  // Solo texto fijo: nada de lo que llega en la URL se refleja en la página.
  response.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'",
  });
  response.end(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Janus</title><style>body{font:17px/1.5 system-ui,sans-serif;margin:3rem auto;max-width:34rem;padding:0 1rem;color:#1b1b1f}h1{font-size:1.4rem}</style><h1>${title}</h1><p>${message}</p><p>Ya puedes cerrar esta pestaña y volver a Janus.</p></html>`);
}

function founderMailAccountSnapshot() {
  const registry = founderMailRegistry ?? { schemaVersion: 1 as const, ownerPrincipalId: 'founder', sourceUpdatedAt: new Date(0).toISOString(), policy: buildFounderMailAccountRegistry({ schemaVersion: 1, ownerPrincipalId: 'founder', updatedAt: new Date(0).toISOString(), records: [] }).policy, accounts: [] };
  return {
    ...registry,
    // Plan puro: sin llamadas externas. Dice qué buzón puede leerse ya y qué falta en cada uno.
    plan: planMailAccess(registry.accounts, {
      adapters: new Set(['google-workspace']),
      hasCredential: (accountId) => credentialConfigured(googleCredentialService('read', accountId)),
    }),
    // Estado de cada consentimiento (lectura / escritura) por buzón: sin secretos.
    credentials: Object.fromEntries(registry.accounts.map((account) => [account.accountId, mailCredentialStatus(account.accountId)])),
    credentialRuntime: {
      vaultConfigured: Boolean(credentialVault),
      googleOAuthConfigured: Boolean(googleOAuth),
      // Esta dirección exacta debe figurar como URI de redirección autorizada en el cliente OAuth de Google Cloud.
      redirectUri: googleOAuth?.redirectUri ?? `${oauthRedirectBase}/api/oauth/google/callback`,
      threadsTokenStored: credentialConfigured(THREADS_SERVICE),
    },
    automaticExternalCalls: false,
  };
}

function founderPhoneChannelSnapshot() {
  const registry = founderPhoneRegistry ?? buildFounderPhoneChannelRegistry({ schemaVersion: 1, ownerPrincipalId: 'founder', updatedAt: new Date(0).toISOString(), records: [] });
  return {
    ...registry,
    // Plan puro: sin llamadas externas. Aún no hay adaptadores de teléfono registrados en el Tool Gateway.
    plan: planPhoneAccess(registry.channels, { adapters: new Set<string>() }),
    automaticExternalCalls: false,
  };
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

// Autorizado por el CEO el 10-nov-2026: los colaboradores adjuntan archivos a SUS proyectos. `off` lo apaga.
const workOperatorUploadsEnabled = process.env.JANUS_WORK_OPERATOR_UPLOADS?.trim().toLowerCase() !== 'off';

const operatorDailyRunLimit = parseOperatorDailyRuns(process.env.JANUS_OPERATOR_DAILY_RUNS);

// Agenda privada cifrada en reposo cuando existe la clave del almacén de credenciales (sin clave: texto plano).
const privateTextKey = derivePrivateTextKey(process.env.JANUS_CREDENTIAL_VAULT_KEY);
const agendaSeal = (item: WorkAgendaItem): WorkAgendaItem =>
  (item.visibility === 'private' ? { ...item, text: sealPrivateText(item.text, privateTextKey) } : item);
const agendaOpen = (item: WorkAgendaItem): WorkAgendaItem => ({ ...item, text: openPrivateText(item.text, privateTextKey) });
// Destinatarios internos de los mensajes del equipo (solo etiquetas; por defecto, el CEO).
const internalRecipients = parseInternalRecipients(process.env.JANUS_INTERNAL_RECIPIENTS);
const configuredModelProviderIds = resolveModelProviders(process.env).map((provider) => provider.id);

// Avisos al teléfono (Web Push). Sin clave VAPID quedan «pendientes de activación»: el panel sigue avisando en pantalla.
const pushKeys = loadVapidKeys(process.env.JANUS_PUSH_VAPID_PRIVATE_KEY, process.env.JANUS_PUSH_SUBJECT);
let pushSweepRunning = false;
async function sweepDueReminders(): Promise<{ due: number; sent: number }> {
  if (!pushKeys || pushSweepRunning) return { due: 0, sent: 0 };
  pushSweepRunning = true;
  let due = 0, sent = 0;
  try {
    const nowIso = new Date().toISOString();
    for (const stored of store.listWorkAgendaItems()) {
      if (stored.kind !== 'reminder' || stored.done || !stored.time) continue;
      const local = localDateTime(nowIso, stored.timeZone ?? timeZone);
      // Solo el día del recordatorio y a partir de su hora; lo atrasado de días anteriores no se dispara.
      if (stored.date !== local.date || stored.time > local.time) continue;
      const subscriptions = store.listPushSubscriptions(stored.principalId);
      if (!subscriptions.length || !store.markReminderPushed(stored.id, nowIso)) continue;
      due += 1;
      const item = agendaOpen(stored);
      for (const subscription of subscriptions) {
        try {
          const request = buildPushRequest(subscription, { title: 'JANUS Work', body: `${item.time} · ${item.text}`, tag: item.id }, pushKeys);
          const result = await fetch(request.url, { method: 'POST', headers: request.headers, body: new Uint8Array(request.body), signal: AbortSignal.timeout(10_000) });
          if (result.status === 404 || result.status === 410) store.deletePushSubscription(subscription.endpoint); // dispositivo dado de baja
          else if (result.ok) sent += 1;
        } catch { /* sin red: el aviso en pantalla del panel sigue funcionando */ }
      }
    }
  } finally { pushSweepRunning = false; }
  return { due, sent };
}
if (pushKeys) setInterval(() => { void sweepDueReminders(); }, 30_000).unref();

/** Consultas de hoy de un colaborador frente al límite diario del CEO (registro durable en SQLite). */
function operatorUsageFor(principalId: string) {
  const now = new Date();
  const since = new Date(now.getTime() - 36 * 3_600_000).toISOString();
  return operatorDailyUsage({
    runTimestamps: store.listOperatorRunTimes(principalId, since),
    now: now.toISOString(),
    timeZone: timeZone ?? 'UTC',
    limit: operatorDailyRunLimit,
  });
}

function preferredProviderFrom(value: unknown): CoordinationPreferredProvider | undefined | null {
  if (value === undefined || value === null || value === '') return undefined;
  return typeof value === 'string' && (COORDINATION_PREFERRED_PROVIDERS as readonly string[]).includes(value)
    ? value as CoordinationPreferredProvider
    : null;
}

/* ── Opportunity Radar (incidencia JANUS-OPPORTUNITY-20261110) ─────────────────────────────────────────────
 * Vigila fuentes OFICIALES (solo lectura, solo https de la lista), guarda oportunidades sin duplicar y avisa.
 * El monitor es opt-in: sin JANUS_RADAR_INTERVAL_MIN no arranca y el estado lo dice («desactivado»). */
let radarSources: ReturnType<typeof parseRadarSources>;
let radarSourcesError: string | null = null;
try { radarSources = parseRadarSources(process.env.JANUS_RADAR_SOURCES); } catch (error) { radarSources = []; radarSourcesError = error instanceof Error ? error.message : 'invalid JANUS_RADAR_SOURCES'; }
let lastRadarReport: RadarRunReport | null = null;

async function fetchRadarSource(url: string): Promise<string> {
  if (!radarSources.some((source) => source.url === url)) throw new Error('source not allowed');
  const result = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15_000), headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': 'JANUS-OpportunityRadar/1 (+solo lectura)' } });
  if (!result.url.startsWith('https://')) throw new Error('redirected outside https');
  if (!result.ok) throw new Error(`HTTP ${result.status}`);
  const bytes = new Uint8Array(await result.arrayBuffer());
  return new TextDecoder().decode(bytes.subarray(0, 1_500_000));
}

async function runOpportunityRadar(): Promise<RadarRunReport> {
  const report = await runRadar({
    sources: radarSources,
    fetchText: fetchRadarSource,
    list: () => store.listRadarOpportunities(),
    save: (opportunity) => store.upsertRadarOpportunity(opportunity),
    previousState: (sourceId) => store.listRadarSourceStates().find((state) => state.sourceId === sourceId),
    saveState: (state) => store.upsertRadarSourceState(state),
    newId: () => `opp_${randomUUID()}`,
    now: () => new Date().toISOString(),
  });
  lastRadarReport = report;
  void sweepOpportunityAlerts();
  return report;
}

const radarIntervalMs = parseWatchIntervalMinutes(process.env.JANUS_RADAR_INTERVAL_MIN);
const radarScheduler = radarIntervalMs && radarSources.length
  ? new SocialWatchScheduler<RadarRunReport>({
      intervalMs: radarIntervalMs,
      run: runOpportunityRadar,
      onError: (error) => console.warn(`Opportunity radar failed: ${error instanceof Error ? error.message.slice(0, 200) : 'error'}`),
    })
  : null;

/** Avisos al teléfono del CEO por oportunidades críticas o a punto de vencer. Solo se da por enviado si salió. */
async function sweepOpportunityAlerts(): Promise<number> {
  if (!pushKeys) return 0;
  const now = new Date().toISOString();
  const opportunities = store.listRadarOpportunities();
  let sent = 0;
  for (const alert of dueOpportunityAlerts(opportunities, now)) {
    const founders = store.listAuthorityCredentials().filter((credential) => credential.principal.role === 'founder_director' && credential.principal.active && !credential.revokedAt);
    let delivered = false;
    for (const founder of founders) {
      for (const subscription of store.listPushSubscriptions(founder.principal.id)) {
        try {
          const request = buildPushRequest(subscription, { title: `Radar · ${alert.title}`.slice(0, 80), body: alert.body, tag: `${alert.opportunityId}:${alert.key}` }, pushKeys);
          const result = await fetch(request.url, { method: 'POST', headers: request.headers, body: new Uint8Array(request.body), signal: AbortSignal.timeout(10_000) });
          if (result.status === 404 || result.status === 410) store.deletePushSubscription(subscription.endpoint);
          else if (result.ok) delivered = true;
        } catch { /* sin red: el aviso sigue visible en el dashboard */ }
      }
    }
    if (delivered) {
      const current = store.getRadarOpportunity(alert.opportunityId);
      if (current) store.upsertRadarOpportunity(markNotified(current, alert.key, now));
      sent += 1;
    }
  }
  return sent;
}
if (pushKeys) setInterval(() => { void sweepOpportunityAlerts(); }, 10 * 60_000).unref();

/**
 * Registro inicial, idempotente: la incidencia que motivó el radar, la oportunidad de referencia y el cupo que indicó
 * el propietario. No sobrescribe nada que ya exista. No afirma un fallo técnico concreto: la causa queda por confirmar.
 */
function seedOpportunityRadar(): void {
  const incidentFingerprint = 'JANUS-OPPORTUNITY-20261110';
  if (!store.listErrorLessons().some((lesson) => lesson.id === incidentFingerprint)) {
    const lesson = new ErrorLedger(store.listErrorLessons()).record({
      id: incidentFingerprint, fingerprint: incidentFingerprint, at: '2026-11-10T12:00:00.000Z',
      error: 'Oportunidad temporal (Claude Fable 5.2 incluido en Pro hasta el 16-nov) comunicada por el propietario; JANUS no había generado una alerta temprana verificable.',
      cause: 'POR CONFIRMAR. No se ha identificado un fallo técnico específico: no existía un monitor de oportunidades en ejecución.',
      impact: 'Parte de la ventana de la promoción transcurrió sin planificación del cupo ni de las tareas a adelantar.',
      lesson: 'Las oportunidades tecnológicas temporales deben detectarse al publicarse, evaluarse y planificarse contra el cupo real, no cuando están por terminar.',
      preventiveRule: 'Vigilar fuentes oficiales de proveedores con el Opportunity Radar; toda oportunidad se registra con fuente, fechas, condiciones, cupo y seguimiento de aprovechamiento.',
      solutions: ['Módulo Opportunity Radar (registro, prioridad, avisos, cupos y fases)', 'Monitor de fuentes oficiales, activable con JANUS_RADAR_INTERVAL_MIN'],
      change: 'packages/core/src/opportunity-radar.ts, /api/radar y pestaña «Radar» del dashboard',
      verification: 'tests/opportunity-radar.test.ts y tests/runtime-smoke; monitor real pendiente de activar y verificar en el equipo donde corra JANUS',
      verified: false,
    });
    store.upsertErrorLesson(lesson);
  }
  const reference = createOpportunity({
    provider: 'Anthropic', title: 'Claude Fable 5.2 incluido en el plan Pro (semana de lanzamiento)', kind: 'promotion', verification: 'pending',
    sourceUrl: 'https://support.claude.com/en/articles/17506494', sourceLabel: 'Ayuda de Claude (citada por prensa; JANUS no ha leído la página oficial)',
    publishedAt: '2026-11-09T18:00:00Z', startsAt: '2026-11-09T18:00:00Z', expiresAt: '2026-11-17T07:59:00Z',
    conditions: 'Según prensa que cita la ayuda oficial: incluido en Pro hasta el 16-nov 23:59 PT (17-nov 08:59 en Países Bajos); hasta el 50 % del límite semanal en Fable; un restablecimiento gratuito («Reset for free» en Ajustes → Uso) que caduca al terminar la semana de lanzamiento; después, Fable vuelve a consumir créditos de uso.',
    eligibility: 'Plan Pro. El restablecimiento gratuito exige facturación de pago anterior al 9-nov 10:00 PT.',
    projects: ['JANUS', 'IBA', 'ChatBox', 'Melanie'], benefit: 5, cost: 'none', risk: 1, compatible: true, detectedBy: 'owner',
    notes: 'Comunicada por el propietario el 10-nov (hora aproximada). Ya en uso en la cuenta Claude Pro.',
  }, { id: 'opp_fable52_pro_launch', now: '2026-11-10T12:00:00.000Z' });
  if (!store.listRadarOpportunities().some((item) => item.fingerprint === reference.fingerprint)) {
    store.upsertRadarOpportunity(advanceStage(advanceStage(reference, 'activated', '2026-11-10T12:00:00.000Z', 'En uso en la cuenta Claude Pro'), 'used', '2026-11-10T12:00:00.000Z'));
  }
  if (store.listRadarQuotaWindows().length === 0) {
    store.upsertRadarQuotaWindow(validateQuotaWindow({
      id: 'quota_claude_pro_weekly', account: 'Claude Pro (propietario)', kind: 'weekly', label: 'Cupo semanal de Claude',
      resetsAt: '2026-11-14T14:00:00Z', verified: false,
      note: 'Indicado por el propietario: restablecimiento el sábado 14-nov hacia las 15:00 (Países Bajos). Hora exacta y límites por verificar en la cuenta; JANUS no tiene acceso a esos contadores.',
    }, '2026-11-10T12:00:00.000Z'));
    store.upsertRadarQuotaWindow(validateQuotaWindow({
      id: 'quota_claude_pro_5h', account: 'Claude Pro (propietario)', kind: 'short', label: 'Ventana corta (5 horas)', verified: false,
      note: 'Los límites por ventanas cortas siguen aplicando: no hay disponibilidad continua garantizada.',
    }, '2026-11-10T12:00:00.000Z'));
  }
}
try { seedOpportunityRadar(); } catch (error) { console.warn(`Opportunity radar seed skipped: ${error instanceof Error ? error.message.slice(0, 160) : 'error'}`); }

function radarPayload() {
  const now = new Date().toISOString();
  const states = store.listRadarSourceStates();
  return {
    ok: true,
    ...buildRadarView(store.listRadarOpportunities(), store.listRadarQuotaWindows(), now),
    monitor: {
      enabled: Boolean(radarScheduler),
      reason: radarScheduler ? null : radarSourcesError ?? 'Monitor automático desactivado: defina JANUS_RADAR_INTERVAL_MIN (minutos, mínimo 15). Mientras tanto solo se registra lo que se anota a mano o con «Revisar ahora».',
      scheduler: radarScheduler?.status() ?? null,
      lastRun: lastRadarReport ? { at: lastRadarReport.at, summary: lastRadarReport.summary } : null,
      pushConfigured: Boolean(pushKeys),
      sources: radarSources.map((source) => ({ ...source, state: states.find((state) => state.sourceId === source.id) ?? null })),
    },
    incidents: store.listErrorLessons().filter((lesson) => /^JANUS-OPPORTUNITY-/.test(lesson.id)).map((lesson) => ({ id: lesson.id, at: lesson.at, error: lesson.error, cause: lesson.cause, lesson: lesson.lesson, preventiveRule: lesson.preventiveRule, verified: lesson.verified ?? false })),
  };
}

/** Presencia («lucecitas» del CEO): última señal por colaborador, solo en memoria. Ver work-presence.ts. */
const workPresence = new WorkPresenceTracker();

function requireActiveOperatorProfile(principal: AuthorityPrincipal) {
  if (principal.role !== 'operator') throw new HttpRequestError(403, 'work dashboard is for delegated operators');
  const profile = store.getCoordinationOperator(principal.id);
  if (!profile || profile.status !== 'active') throw new HttpRequestError(403, 'active operator profile required');
  // Cualquier petición válida de un colaborador activo cuenta como señal de que está conectado.
  workPresence.touch(principal.id);
  return profile;
}

/** Proyectos activos en los que una persona puede trabajar (para que el CEO elija dónde le deja tarea o archivo). */
function memberProjects(principalId: string, projects: ReturnType<SqliteStore['listProjectWorkspaces']>) {
  const credential = store.getAuthorityCredential(principalId);
  if (!credential || !credential.principal.active || credential.revokedAt) return [];
  return projects
    .filter((project) => project.status === 'active' && canAccessProject(credential.principal, project, 'write_work'))
    .map((project) => ({ id: project.id, name: project.name }));
}

/** Colaborador activo y con llave vigente, o error claro para el CEO. */
function requireActiveMember(principalId: string) {
  const profile = store.getCoordinationOperator(principalId);
  const credential = store.getAuthorityCredential(principalId);
  if (!profile || profile.status !== 'active' || !credential || !credential.principal.active || credential.revokedAt || credential.principal.role !== 'operator') {
    throw new HttpRequestError(404, 'active collaborator not found');
  }
  return { profile, principal: credential.principal };
}

/**
 * El CEO pone a una persona a trabajar en un proyecto: si el proyecto no tiene ámbito se le crea uno propio y,
 * si la persona no tenía permiso de trabajo en él, se le concede (leer, trabajar y entregar; nunca coordinar).
 * Solo se llama desde rutas del Founder: es SU decisión de permisos, tomada al asignar.
 */
function ensureMemberCanWork(founderId: string, memberPrincipal: AuthorityPrincipal, projectId: string) {
  const project = store.getProjectWorkspace(projectId);
  if (!project || project.status !== 'active') throw new HttpRequestError(404, 'project not found');
  const now = new Date().toISOString();
  let scopeId = project.coordinationScopeId;
  let grantedNow = false;
  if (!scopeId || !store.listCoordinationScopes().some((scope) => scope.id === scopeId)) {
    const scope = validateCoordinationScope({ id: `scope_${randomUUID()}`, label: project.name.slice(0, 80), classification: 'project', ownerPrincipalId: founderId, createdAt: now });
    store.upsertCoordinationScope(scope);
    scopeId = scope.id;
    store.upsertProjectWorkspace(validateProjectWorkspace({ ...project, coordinationScopeId: scopeId, updatedAt: now }));
  }
  const updated = store.getProjectWorkspace(projectId)!;
  if (!canAccessProject(memberPrincipal, updated, 'write_work')) {
    store.upsertCoordinationGrant(validateCoordinationGrant({
      id: `grant_${randomUUID()}`, principalId: memberPrincipal.id, scopeId,
      permissions: ['read_context', 'write_work', 'handoff'], grantedBy: founderId, createdAt: now,
    }));
    grantedNow = true;
  }
  return { project: updated, scopeId, grantedNow };
}

/** Aviso al teléfono de una persona (si lo tiene activado). Nunca bloquea ni falla la petición. */
function pushToMember(principalId: string, title: string, body: string, tag: string): void {
  if (!pushKeys) return;
  for (const subscription of store.listPushSubscriptions(principalId)) {
    try {
      const request = buildPushRequest(subscription, { title, body: body.slice(0, 140), tag }, pushKeys);
      void fetch(request.url, { method: 'POST', headers: request.headers, body: new Uint8Array(request.body), signal: AbortSignal.timeout(10_000) })
        .then((result) => { if (result.status === 404 || result.status === 410) store.deletePushSubscription(subscription.endpoint); })
        .catch(() => { /* sin red: lo verá al abrir su panel */ });
    } catch { /* suscripción inválida: se ignora */ }
  }
}

/** Estado de presencia de cada colaborador activo, para la vista y las lucecitas del CEO. */
function teamPresenceFor(now: string) {
  const nowMs = Date.parse(now);
  const events = store.listWorkSessionEvents();
  return store.listCoordinationOperators()
    .filter((profile) => profile.status === 'active')
    .map((profile) => {
      const open = summarizeWorkSessions(events, profile.principalId, now).filter((session) => session.state !== 'ended').at(-1) ?? null;
      const presence = resolveWorkPresence({ session: open, lastSeenMs: workPresence.lastSeen(profile.principalId), nowMs });
      return {
        principalId: profile.principalId,
        displayName: profile.displayName ?? profile.principalId,
        roleTitle: profile.roleTitle ?? null,
        state: presence.state,
        seenSecondsAgo: presence.seenSecondsAgo,
        sessionSince: presence.sessionSince,
      };
    });
}

/** Plantilla laboral única: mismos datos para cualquier colaborador, acotados a SUS permisos. */
function workDashboardFor(principal: AuthorityPrincipal) {
  const profile = requireActiveOperatorProfile(principal);
  const now = new Date().toISOString();
  const projects = store.listProjectWorkspaces()
    .filter((project) => project.status === 'active' && canAccessProject(principal, project, 'read_context'))
    .map((project) => ({
      project,
      canWrite: canAccessProject(principal, project, 'write_work'),
      threads: store.listProjectThreads(project.id).filter((thread) => thread.createdBy === principal.id),
      resources: store.listProjectResources(project.id),
      latestCheckpoint: store.latestProjectCheckpoint(project.id),
    }));
  return buildReusableWorkDashboard({
    principal,
    profile,
    coordination: coordinationBriefFor(principal),
    projects,
    handoffs: store.listCoordinationHandoffs(),
    sessions: summarizeWorkSessions(store.listWorkSessionEvents(principal.id), principal.id, now),
    agenda: store.listWorkAgendaItems(principal.id).map(agendaOpen),
    recipients: internalRecipients,
    messages: [...store.listWorkMessages(principal.id, 20), ...store.listWorkMessagesTo(principal.id, 30)],
    uploadAttachments: workOperatorUploadsEnabled,
    skinSource: 'iba-command-center',
    usage: (({ used, limit, remaining }) => ({ used, limit, remaining }))(operatorUsageFor(principal.id)),
    now,
  });
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

function assistantBundleForSurface(surfaceId: string) {
  const surface = store.getAssistantSurface(surfaceId);
  if (!surface) throw new HttpRequestError(404, 'assistant surface not found');
  const resolved = resolveAssistantSurfaceConfig({
    surface,
    profiles: store.listAssistantProfileRevisions(surface.profileId),
  });
  const modules = resolved.moduleRefs.flatMap((moduleRef) => {
    try {
      const selection = resolveReusableSelection({
        itemId: moduleRef.itemId,
        items: store.listReusableLibraryItems(),
        ...(moduleRef.revision == null ? {} : { revision: moduleRef.revision }),
      });
      return [{
        itemId: selection.item.id,
        revision: selection.item.revision,
        checksum: selection.item.checksum,
        kind: selection.item.kind,
      }];
    } catch (error) {
      if (moduleRef.optional) return [];
      throw error;
    }
  });
  return createAssistantConfigBundle({ resolved, modules });
}

function repositoryTarget(value: string): { owner: string; repo: string } {
  const parts = value.trim().split('/');
  if (
    parts.length !== 2
    || !parts[0]
    || !parts[1]
    || !/^[A-Za-z0-9_.-]+$/.test(parts[0])
    || !/^[A-Za-z0-9_.-]+$/.test(parts[1])
  ) {
    throw new HttpRequestError(409, 'assistant repository delivery target is invalid');
  }
  return { owner: parts[0], repo: parts[1] };
}

function assistantModuleRefs(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    const itemId = typeof record.itemId === 'string' ? record.itemId.trim() : '';
    if (!itemId) return [];
    const revision = Number(record.revision);
    return [{
      itemId,
      ...(Number.isInteger(revision) && revision > 0 ? { revision } : {}),
      ...(record.optional === true ? { optional: true } : {}),
    }];
  });
}

function validateAssistantModules(profile: ReturnType<typeof createAssistantProfileRevision>): void {
  const items = store.listReusableLibraryItems();
  for (const moduleRef of profile.moduleRefs) {
    try {
      resolveReusableSelection({
        itemId: moduleRef.itemId,
        items,
        ...(moduleRef.revision == null ? {} : { revision: moduleRef.revision }),
      });
    } catch (error) {
      if (moduleRef.optional) continue;
      throw new HttpRequestError(
        409,
        'required assistant module unavailable: '
        + moduleRef.itemId
        + ' — '
        + (error instanceof Error ? error.message : String(error)),
      );
    }
  }
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
  // Provider-independent: every configured provider is a replaceable adapter;
  // Janus Core routes between them (local/custom first unless JANUS_MODEL_ORDER says otherwise).
  const providers = resolveModelProviders(process.env).map((config) => {
    const service = config.id === 'custom' ? 'model' : config.id;
    const gateway: ModelGateway = config.protocol === 'anthropic-messages'
      ? new AnthropicMessagesModelAdapter({
          model: config.model,
          baseUrl: config.baseUrl,
          tokenProvider: () => credentialBroker.accessToken(service),
        })
      : new ChatCompletionsModelAdapter({
          baseUrl: config.baseUrl,
          model: config.model,
          providerName: config.id === 'custom' ? (process.env.JANUS_MODEL_PROVIDER?.trim() || undefined) : config.id,
          tokenProvider: () => credentialBroker.accessToken(service),
          supportsJsonMode: config.jsonMode,
          ...(config.chatPath ? { chatPath: config.chatPath } : {}),
        });
    return { id: config.id, gateway };
  });
  if (providers.length === 0) return undefined;
  if (providers.length === 1) return providers[0]!.gateway;
  return new FallbackModelRouter(providers);
}

function createConfiguredVoiceGateway(): VoiceGateway | undefined {
  const wantsElevenLabs = ttsProviderSetting === 'elevenlabs';
  if (!sttBaseUrl) return undefined;
  if (wantsElevenLabs ? !elevenLabsVoiceId : !ttsBaseUrl) return undefined;

  const stt = new WhisperCppSttAdapter({
    baseUrl: sttBaseUrl,
    language: process.env.JANUS_STT_LANGUAGE?.trim() || 'auto',
    allowRemote: process.env.JANUS_STT_ALLOW_REMOTE === 'true',
    vocabularyPrompt: transcriptionVocabularyPrompt(),
  });
  const local = ttsBaseUrl
    ? new Qwen3TtsHttpAdapter({
        baseUrl: ttsBaseUrl,
        language: process.env.JANUS_TTS_LANGUAGE?.trim() || 'Auto',
        instruct: process.env.JANUS_TTS_INSTRUCT?.trim() || undefined,
        chunkMs: numericEnv('JANUS_TTS_CHUNK_MS'),
        allowRemote: process.env.JANUS_TTS_ALLOW_REMOTE === 'true',
      })
    : undefined;

  if (!wantsElevenLabs) {
    voiceTtsRouting = { provider: 'qwen3-tts-adapter' };
    return new CompositeVoiceGateway(stt, local!);
  }

  const elevenlabs = new ElevenLabsTtsAdapter({
    apiKeyProvider: () => credentialBroker.accessToken('elevenlabs'),
    voiceMap: { [defaultVoiceId]: elevenLabsVoiceId! },
    modelId: process.env.JANUS_ELEVENLABS_MODEL?.trim() || undefined,
    languageCode: process.env.JANUS_ELEVENLABS_LANGUAGE?.trim() || undefined,
    chunkMs: numericEnv('JANUS_TTS_CHUNK_MS'),
    maxCharsPerRequest: numericEnv('JANUS_ELEVENLABS_MAX_CHARS'),
    dailyCharBudget: numericEnv('JANUS_ELEVENLABS_DAILY_CHARS'),
  });
  const router = new FallbackTextToSpeechGateway({
    primary: elevenlabs,
    fallback: local,
    cooldownMs: numericEnv('JANUS_TTS_FALLBACK_COOLDOWN_MS'),
    // Solo el motivo técnico; nunca el texto hablado ni la credencial.
    onEvent: (event) => console.warn(`Voice provider ${event.type}: ${event.reason}`),
  });
  voiceTtsRouting = {
    provider: local ? 'elevenlabs-with-fallback' : 'elevenlabs-only',
    router,
    elevenlabs,
  };
  if (!local) {
    console.warn('Voice: ElevenLabs sin respaldo local (JANUS_TTS_BASE_URL ausente); si el proveedor falla, no habrá voz.');
  }
  return new CompositeVoiceGateway(stt, router);
}

function parseKnowledgeStatusUrls(raw: string | undefined): Record<string, string> {
  if (!raw?.trim()) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('JANUS_KNOWLEDGE_STATUS_URLS must be a JSON object {"consumidor":"https://…"}');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)
    || !Object.values(parsed as Record<string, unknown>).every((url) => typeof url === 'string' && url.startsWith('https://'))) {
    throw new Error('JANUS_KNOWLEDGE_STATUS_URLS entries must be https URLs');
  }
  return parsed as Record<string, string>;
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

/** Fecha de modificación más reciente entre archivos y carpetas (un nivel). Lo que no existe cuenta como 0. */
function newestMtimeMs(paths: readonly string[]): number {
  let newest = 0;
  for (const path of paths) {
    try {
      const info = statSync(path);
      newest = Math.max(newest, info.mtimeMs);
      if (info.isDirectory()) for (const name of readdirSync(path)) { try { newest = Math.max(newest, statSync(join(path, name)).mtimeMs); } catch { /* se ignora */ } }
    } catch { /* no existe */ }
  }
  return newest;
}

/** Freno de intentos de canje por origen: 10 cada 10 minutos (el código ya es de 256 bits; esto solo corta el ruido). */
const inviteRedeemAttempts = new Map<string, number[]>();
function inviteRedeemLimiter(source: string, nowMs = Date.now()): boolean {
  const recent = (inviteRedeemAttempts.get(source) ?? []).filter((at) => nowMs - at < 600_000);
  if (recent.length >= 10) { inviteRedeemAttempts.set(source, recent); return false; }
  recent.push(nowMs);
  inviteRedeemAttempts.set(source, recent);
  if (inviteRedeemAttempts.size > 2000) inviteRedeemAttempts.clear();
  return true;
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

function biometricKeyView(key: BiometricKeyRegistration) {
  return {
    keyId: key.keyId,
    principalId: key.principalId,
    method: key.method,
    biometry: key.biometry,
    binding: key.binding,
    createdAt: key.createdAt,
    active: key.active,
    revokedAt: key.revokedAt ?? null,
    publicKeyFingerprint: createHash('sha256')
      .update(key.publicKeyPem, 'utf8')
      .digest('hex'),
  };
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
      'Authenticated Founder/Director authority is required',
    );
  }
  return session;
}

function founderBiometricProofId(request: IncomingMessage): string | undefined {
  const value = request.headers['x-janus-biometric-proof'];
  if (Array.isArray(value)) return value[0]?.trim() || undefined;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function requireFounderBiometricAuthority(
  request: IncomingMessage,
  action: string,
): {
  token: string;
  principal: NonNullable<ReturnType<typeof authorityAuth.authenticateSession>>;
  authorityDecisionHash: string;
} {
  const session = requireFounderAuthority(request);
  const requestedAt = new Date().toISOString();
  const proofId = founderBiometricProofId(request);
  const proofInput = proofId ? { proofId, principalId: session.principal.id, action, requestedAt } : undefined;
  // Primero el puente nativo; si la prueba no es suya, la llave de acceso (que la política solo admite en `passkeyActions`).
  const biometricAttestation = proofInput
    ? founderBiometric.consumeProof(proofInput) ?? founderPasskey?.consumeProof(proofInput)
    : undefined;
  const decision = evaluateAuthority(
    session.principal,
    {
      id: `authority_instruction_${randomUUID()}`,
      principalId: session.principal.id,
      source: 'authenticated_human',
      authenticated: true,
      instruction: action,
      requestedAt,
      ...(biometricAttestation ? { biometricAttestation } : {}),
    },
    action,
  );
  if (!decision.allowed) throw new HttpRequestError(403, decision.reason);
  return { ...session, authorityDecisionHash: decision.auditHash };
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

  const biometricProofIds = biometricProofIdsFromBody(body.biometricProofIds);
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
    ...(biometricProofIds.length > 0 ? { biometricProofIds } : {}),
  };
}

function authErrorStatus(error: unknown): number {
  if (error instanceof VoiceAuthorityError) return error.status;
  if (error instanceof HttpRequestError) return error.status;
  if (error instanceof FounderPasskeyError) {
    switch (error.code) {
      case 'passkey_unavailable': return 409;
      case 'invalid_origin':
      case 'invalid_action': return 403;
      case 'invalid_signature':
      case 'user_verification_required': return 401;
      default: return 400;
    }
  }
  if (error instanceof FounderBiometricError) {
    switch (error.code) {
      case 'invalid_key':
      case 'invalid_action':
        return 400;
      case 'invalid_challenge':
      case 'challenge_expired':
      case 'invalid_signature':
        return 401;
      case 'key_unavailable':
      case 'face_required':
        return 409;
    }
  }
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
  if (error instanceof AuthorityAuthenticationError || error instanceof FounderBiometricError || error instanceof FounderPasskeyError) {
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

/** Lee el cuerpo con tope duro: corta en cuanto se supera `limit` (sin acumular en memoria sin límite). */
async function readBodyBytes(request: IncomingMessage, limit: number): Promise<Buffer> {
  const declared = Number(request.headers['content-length']);
  if (Number.isFinite(declared) && declared > limit) throw new HttpRequestError(413, 'El archivo supera el tamaño permitido.');
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const piece = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += piece.length;
    if (total > limit) throw new HttpRequestError(413, 'El archivo supera el tamaño permitido.');
    chunks.push(piece);
  }
  return Buffer.concat(chunks);
}

function headerValue(request: IncomingMessage, name: string): string {
  const value = request.headers[name];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
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

  const runEffort = runEfforts.get(runId);
  if (!plan && modelGateway) {
    // Effort budget: the provider adapter stays replaceable; Janus Core caps calls per run.
    // Delegación por tarea: si el CEO fijó un agente para la tarea, va primero; el resto queda de respaldo.
    const runAssignment = runAssignments.get(runId);
    const preferredProvider = runAssignment
      ? store.getCoordinationAssignment(runAssignment.assignmentId)?.preferredProvider
      : undefined;
    let routedGateway: ModelGateway = preferredProvider && modelGateway instanceof FallbackModelRouter
      ? modelGateway.withPreference(preferredProvider)
      : modelGateway;
    // «Solo modelo propio»: el contenido de un proyecto marcado así nunca viaja a un proveedor externo.
    const runProject = projectLink ? store.getProjectWorkspace(projectLink.projectId) : null;
    if (runProject?.modelPolicy === 'local_only') {
      const local = modelGateway instanceof FallbackModelRouter
        ? modelGateway.only(['custom'])
        : configuredModelProviderIds.length === 1 && configuredModelProviderIds[0] === 'custom' ? modelGateway : null;
      routedGateway = local ?? { complete: async () => { throw new Error('Proyecto «solo modelo propio»: no hay modelo local configurado.'); } };
    }
    const runModelGateway = new BudgetedModelGateway(routedGateway, runEffort?.budget.maxModelCalls ?? 3);
    runModelBudgets.set(runId, runModelGateway);
    const maxPlanSteps = runEffort?.budget.maxPlanSteps ?? 20;
    const modelResult = await planWithModel(command, {
      modelGateway: runModelGateway,
      toolCatalog: executionPolicy.toolCatalog,
      context: {
        ...(timeZone ? { timeZone } : {}),
        executionPolicy: 'Janus Core validates every proposed step before execution',
        ...(runEffort ? { effort: effortPlanningGuidance(runEffort) } : {}),
        ...(runInterpretations.get(runId)?.corrections.length ? {
          transcriptInterpretation: {
            note: 'The request may contain speech-to-text or dictation errors. Original text is authoritative for what was said; apply only corrections marked applied, and ask before acting on unconfirmed ones.',
            originalText: runInterpretations.get(runId)!.originalText,
            interpretedText: runInterpretations.get(runId)!.interpretedText,
            corrections: runInterpretations.get(runId)!.corrections,
            confirmationPrompt: runInterpretations.get(runId)!.confirmationPrompt,
          },
        } : {}),
        progressPolicy: {
          id: CONTINUE_BY_ALTERNATIVES_POLICY.id,
          rule: CONTINUE_BY_ALTERNATIVES_POLICY.rule,
          mandatoryStops: CONTINUE_BY_ALTERNATIVES_POLICY.mandatoryStops,
          requiredResponseShape:
            'PROBLEM -> RISK -> CAUSE -> 2-4 REAL OPTIONS -> EVIDENCE -> RECOMMENDATION -> NEXT ACTION',
        },
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
              name: store.getProjectWorkspace(projectLink.projectId)?.name ?? '',
              description: store.getProjectWorkspace(projectLink.projectId)?.description ?? '',
              instructions: store.getProjectWorkspace(projectLink.projectId)?.instructions ?? '',
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
      maxSteps: maxPlanSteps,
      allowedTools: executionPolicy.allowedTools,
      allowedActions: executionPolicy.allowedActions,
    });

    const effortLimited = runEffort && runEffort.level !== 'maximo'
      && /exceeds \d+ steps|budget exhausted/i.test(modelResult.error ?? '');
    if (modelResult.error && effortLimited) {
      const higher = runEffort.level === 'eco' ? 'NORMAL' : runEffort.level === 'normal' ? 'PROFUNDO' : 'MÁXIMO';
      const resolution = buildOperationalBlockerResolution({
        problem: 'The task needs more work than the selected effort level allows.',
        risk: 'Truncating the plan silently could deliver an incomplete or unverified result.',
        cause: modelResult.error ?? 'effort budget reached',
        kind: 'capability',
        alternatives: [
          {
            id: 'raise-effort', title: 'Subir el esfuerzo a ' + higher,
            description: 'Repetir la misma orden con más pasos, verificación y presupuesto de modelo.',
            preservesGoal: true, availableNow: true, risk: 'low',
            nextAction: 'Elige ' + higher + ' (o AUTO) en el selector de esfuerzo y vuelve a enviar la orden.',
          },
          {
            id: 'split-task', title: 'Dividir la tarea',
            description: 'Enviar la orden en partes más pequeñas que quepan en el nivel actual.',
            preservesGoal: true, availableNow: true, risk: 'low',
            nextAction: 'Envía primero la parte más urgente.',
          },
        ],
        parkedIssue: 'Re-run with a higher effort level or a smaller task.',
      });
      runBlockerResolutions.set(runId, resolution);
      recordDecision({
        runId,
        decisionKind: 'blocker_resolution',
        selectedWorker: 'janus-core/continue-by-alternatives-v1',
        confidence: 1,
        outputSummary: 'Effort budget reached; offered to raise effort or split the task instead of truncating.',
        metadata: { resolution, effort: runEffort.level, modelBudget: runModelGateway.usage() },
      });
      throw new Error(modelResult.error);
    }

    if (modelResult.error) {
      const resolution = buildOperationalBlockerResolution({
        problem: 'Configured model planner is unavailable for the current task.',
        risk: 'Stopping the entire project would create unnecessary provider dependency.',
        cause: modelResult.error,
        kind: 'provider',
        alternatives: defaultProviderAlternatives({
          providerName: modelResult.provider ?? 'configured model provider',
          task: command,
          localAvailable: false,
          otherModelAvailable: false,
        }),
        parkedIssue: 'Restore or replace the unavailable model-planning path.',
      });
      runBlockerResolutions.set(runId, resolution);
      recordDecision({
        runId,
        decisionKind: 'planning_worker_selection',
        selectedWorker: 'janus-core/model-planner',
        confidence: 0.5,
        outputSummary: 'Configured model planner failed before an executable plan was accepted.',
        metadata: { ok: false, error: modelResult.error },
      });
      recordDecision({
        runId,
        decisionKind: 'blocker_resolution',
        selectedWorker: 'janus-core/continue-by-alternatives-v1',
        confidence: 1,
        outputSummary:
          'Provider obstacle diagnosed with multiple alternatives instead of a single dead end.',
        metadata: { resolution },
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
      effort: runEffort?.level ?? null,
      modelBudget: runModelGateway.usage(),
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
    const cause = error instanceof Error ? error.message : String(error);
    const resolution = buildOperationalBlockerResolution({
      problem: 'A capability required by the accepted plan is not currently ready.',
      risk: 'The current execution cannot honestly complete that step without a compatible capability.',
      cause,
      kind: 'capability',
      alternatives: [
        {
          id: 'compatible-capability',
          title: 'compatible registered capability',
          description: 'Use another registered tool/model that satisfies the same plan requirement.',
          preservesGoal: true,
          availableNow: false,
          risk: 'low',
          nextAction: 'Check the Capability Registry and Model Router for a compatible substitute.',
        },
        {
          id: 'park-dependent-step',
          title: 'park the dependent step',
          description: 'Keep the unavailable dependency pending and continue independent project work.',
          preservesGoal: true,
          availableNow: true,
          risk: 'low',
          nextAction: 'Record the dependency in the project handoff and advance unrelated tasks.',
        },
        {
          id: 'prepare-offline',
          title: 'prepare offline inputs',
          description: 'Complete local analysis, assets, code or documentation that does not require the missing capability.',
          preservesGoal: true,
          availableNow: true,
          risk: 'low',
          nextAction: 'Complete all dependency-free preparation and revalidate the missing capability later.',
        },
      ],
      parkedIssue: cause,
    });
    runBlockerResolutions.set(runId, resolution);
    recordDecision({
      runId,
      decisionKind: 'capability_verification',
      selectedWorker: 'janus-core/capability-registry',
      confidence: 1,
      outputSummary: 'Execution was blocked because a required capability is not ready.',
      metadata: { ok: false, error: cause },
    });
    recordDecision({
      runId,
      decisionKind: 'blocker_resolution',
      selectedWorker: 'janus-core/continue-by-alternatives-v1',
      confidence: 1,
      outputSummary:
        'Capability obstacle diagnosed and converted into alternatives plus a parked dependency.',
      metadata: { resolution },
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

  const guarded = enforceSensitiveActionPolicy(plan);
  if (guarded.enforced.length > 0) {
    recordDecision({
      runId,
      decisionKind: 'sensitive_action_policy',
      selectedWorker: 'janus-core/sensitive-action-policy-v1',
      confidence: 1,
      outputSummary: 'External writes / paid generations forced to explicit approval regardless of the planner.',
      metadata: { enforced: guarded.enforced },
    });
  }
  const learnerId = runLearners.get(runId);
  const scopedPlan = learnerId
    ? { ...guarded.plan, steps: guarded.plan.steps.map((step) => (step.tool === 'janus-school' ? { ...step, input: { ...step.input, learnerId } } : step)) }
    : guarded.plan;
  return compilePlan(scopedPlan, { toolGateway });
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
  requestedEffort?: string,
  speaker?: VoiceSpeakerHint,
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
    biometricVerifier: ({ proofId, principal, action, requestedAt }) => (
      founderBiometric.consumeProof({
        proofId,
        principalId: principal.id,
        action,
        requestedAt,
      })
    ),
    approvalHandler: async (action) => {
      if (action.risk !== 'none' && action.risk !== 'low' && decisionRunId) {
        // Sensitive/medium/high-risk action: wait for an explicit, authenticated Founder decision.
        const operation = action.tool && action.operation
          ? (action.operation.startsWith(action.tool + '.') ? action.operation : `${action.tool}.${action.operation}`) : undefined;
        const { outcome } = approvalQueue.request({
          runId: decisionRunId,
          actionId: action.id,
          label: action.label,
          ...(action.tool ? { tool: action.tool } : {}),
          ...(action.operation ? { operation: action.operation } : {}),
          risk: action.risk,
          reversible: action.reversible,
          ...(action.target ? { target: action.target } : {}),
          ...(operation && SENSITIVE_TOOL_ACTIONS[operation] ? { reason: SENSITIVE_TOOL_ACTIONS[operation] } : {}),
        });
        const result = await outcome;
        return { approved: result.approved, ...(result.reason ? { reason: result.reason } : {}) };
      }
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
  const faceHint = freshFaceHint(sessionId);
  const fused = fuseIdentityHints([speaker, faceHint]);
  const speakerPolicy = policyForSpeaker(fused, { strict: householdStrict });
  const minorHint = [speaker, faceHint].find((hint) => hint?.decision === 'match' && hint.profile === 'minor');
  if (minorHint?.subjectId) runLearners.set(runId, minorHint.subjectId);
  else if (speakerPolicy.restricted) runLearners.set(runId, 'guest');
  runBlueprints.set(
    runId,
    speakerPolicy.restricted ? restrictBlueprintTools(runtimeBlueprint, speakerPolicy.allowedTools) : runtimeBlueprint,
  );
  if (fused) {
    recordDecision({
      runId,
      decisionKind: 'speaker_recognition_hint',
      selectedWorker: 'janus-core/speaker-policy-v1',
      confidence: 1,
      outputSummary: speakerPolicy.reason,
      // Data minimisation: no embeddings, no audio; only decision, profile and score.
      metadata: {
        decision: fused.decision,
        profile: fused.profile ?? null,
        modalities: [speaker ? 'voice' : null, faceHint ? 'face' : null].filter(Boolean),
        strict: householdStrict,
        restricted: speakerPolicy.restricted,
      },
    });
  }
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
  // Transcription/dictation tolerance: keep what was said, resolve what was meant.
  const interpretation = interpretTranscript({
    text: command,
    context: store.listConversationMessages(sessionId)
      .slice(-8)
      .map((message) => message.content),
  });
  runInterpretations.set(runId, interpretation);
  // Adaptive effort: how much work/verification this command deserves (risk, complexity, cost).
  const effort = decideEffort({
    text: interpretation.interpretedText,
    requested: requestedEffort,
    sensitiveCommand: interpretation.sensitiveCommand,
  });
  runEfforts.set(runId, effort);
  recordDecision({
    runId,
    decisionKind: 'effort_selection',
    selectedWorker: 'janus-core/' + effort.policyVersion,
    confidence: 1,
    outputSummary: 'Effort ' + effort.level.toUpperCase() + ' (' + effort.source + '); risk ' + effort.risk
      + ', complexity ' + effort.complexity + (effort.raisedByRisk ? '; raised by risk floor' : '') + '.',
    metadata: {
      requested: effort.requested,
      level: effort.level,
      source: effort.source,
      risk: effort.risk,
      complexity: effort.complexity,
      raisedByRisk: effort.raisedByRisk,
      requiresConfirmation: effort.requiresConfirmation,
      budget: effort.budget,
      reasons: effort.reasons,
    },
  });
  if (interpretation.corrections.length > 0) {
    recordDecision({
      runId,
      decisionKind: 'transcript_interpretation',
      selectedWorker: 'janus-core/' + interpretation.policyVersion,
      confidence: Math.min(...interpretation.corrections.map((correction) => correction.confidence)),
      outputSummary: interpretation.needsConfirmation
        ? 'Possible transcription error detected; confirmation requested before using the corrected meaning.'
        : 'Known transcription error resolved from context; original text preserved.',
      metadata: {
        inputMode,
        originalText: interpretation.originalText,
        interpretedText: interpretation.interpretedText,
        sensitiveCommand: interpretation.sensitiveCommand,
        corrections: interpretation.corrections,
        confirmationPrompt: interpretation.confirmationPrompt,
      },
    });
  }
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
      ...(interpretation.corrections.length > 0 ? {
        interpretation: {
          interpretedText: interpretation.interpretedText,
          corrections: interpretation.corrections,
          needsConfirmation: interpretation.needsConfirmation,
        },
      } : {}),
      effort: { level: effort.level, source: effort.source, risk: effort.risk },
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
        // Only high-confidence, non-sensitive corrections are applied; the rest wait for the human.
        const planningText = interpretation.interpretedText;
        steps = (await prepareSteps(planningText, runId)) ?? demoSteps(planningText);
      } catch (error) {
        const resolution = runBlockerResolutions.get(runId);
        await activeRunner.block('Janus Core no puede completar esta ruta todavía', {
          error: error instanceof Error ? error.message : String(error),
          ...(resolution ? { resolution } : {}),
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

function ensureBlockedRunResolution(snapshot: RunSnapshot): void {
  if (snapshot.status !== 'blocked') return;
  const existing = store.listDecisionReceipts(snapshot.runId)
    .find((receipt) => receipt.decisionKind === 'blocker_resolution');
  if (existing) return;

  const events = store.listEvents(snapshot.runId);
  const latestBlocked = [...events]
    .reverse()
    .find((event) => event.type === 'run.blocked');
  const approvalRequired = events.some((event) => event.type === 'approval.required');
  const summary = latestBlocked?.summary ?? 'The current execution path is blocked.';
  const normalized = summary.toLowerCase();
  const authorityStop = /autoridad|authority|confirmaci[oó]n|confirmation/.test(normalized);
  const approvalStop = approvalRequired || /aprobaci[oó]n|approval/.test(normalized);
  const mandatoryStop = authorityStop || approvalStop;

  const resolution = buildOperationalBlockerResolution({
    problem: summary,
    risk: mandatoryStop
      ? 'Bypassing this blocker could violate authority, approval or safety boundaries.'
      : 'Treating this path as the only path would unnecessarily stop project progress.',
    cause: latestBlocked
      ? JSON.stringify(latestBlocked.payload ?? {})
      : 'No more specific blocker payload was recorded.',
    kind: approvalStop
      ? 'approval'
      : authorityStop
        ? 'authentication'
        : /tool|adapter|capabil|credencial|credential|configur/.test(normalized)
          ? 'capability'
          : 'dependency',
    alternatives: mandatoryStop
      ? [
          {
            id: 'prepare-safe-work',
            title: 'prepare safe work without executing the blocked action',
            description:
              'Complete analysis, dry-run, documentation or reversible preparation while preserving the protected boundary.',
            preservesGoal: true,
            availableNow: true,
            risk: 'low',
            nextAction: 'Prepare the safe dependency-free work and keep the protected action pending.',
          },
          {
            id: 'obtain-required-authority',
            title: 'obtain the required approval or authority',
            description:
              'Request the exact missing approval, confirmation or authenticated authority instead of bypassing it.',
            preservesGoal: true,
            availableNow: true,
            risk: 'low',
            nextAction: 'Request the required approval/authority and preserve the exact resume point.',
          },
          {
            id: 'continue-independent-work',
            title: 'continue independent project work',
            description:
              'Advance unrelated tasks that do not require the protected action.',
            preservesGoal: true,
            availableNow: true,
            risk: 'low',
            nextAction: 'Move to the next independent task and keep this action blocked until authorized.',
          },
        ]
      : [
          {
            id: 'compatible-path',
            title: 'compatible registered path',
            description:
              'Use another registered model, tool or workflow that can satisfy the same requirement.',
            preservesGoal: true,
            availableNow: false,
            risk: 'low',
            nextAction: 'Check registered capabilities and the Model Router for a compatible substitute.',
          },
          {
            id: 'park-blocked-step',
            title: 'park only the blocked step',
            description:
              'Keep this dependency pending while the rest of the project continues.',
            preservesGoal: true,
            availableNow: true,
            risk: 'low',
            nextAction: 'Record the blocker and continue the next independent task.',
          },
          {
            id: 'prepare-independent-inputs',
            title: 'prepare dependency-free inputs',
            description:
              'Advance local analysis, code, assets, documentation or validation that does not require the blocked path.',
            preservesGoal: true,
            availableNow: true,
            risk: 'low',
            nextAction: 'Complete dependency-free preparation and revalidate this blocker later.',
          },
        ],
    mandatoryStop,
    parkedIssue: mandatoryStop ? undefined : summary,
  });

  runBlockerResolutions.set(snapshot.runId, resolution);
  recordDecision({
    runId: snapshot.runId,
    decisionKind: 'blocker_resolution',
    selectedWorker: 'janus-core/continue-by-alternatives-v1',
    confidence: 1,
    inputRefs: latestBlocked ? ['event:' + latestBlocked.id] : ['run:' + snapshot.runId],
    outputSummary:
      'Blocked run converted into explicit alternatives, recommendation and next action.',
    metadata: { resolution },
  });
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
      || receipt.decisionKind === 'blocker_resolution'
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
  ensureBlockedRunResolution(snapshot);
  finalizeCoordinationHandoff(snapshot);
  finalizeProjectCheckpoint(snapshot);

  if (snapshot.status === 'blocked' || snapshot.status === 'failed') {
    voiceSessions.runBlocked(snapshot.runId);
    runners.delete(snapshot.runId);
    runBlueprints.delete(snapshot.runId);
    runBlockerResolutions.delete(snapshot.runId);
    return;
  }
  if (snapshot.status === 'completed' || snapshot.status === 'cancelled') {
    voiceSessions.runCompleted(snapshot.runId);
    runners.delete(snapshot.runId);
    runBlueprints.delete(snapshot.runId);
    runBlockerResolutions.delete(snapshot.runId);
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
  if (action === 'cancel') {
    approvalQueue.cancelRun(runId);
    await runner.cancel();
  }
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
    case '.png': return 'image/png';
    case '.webp': return 'image/webp';
    case '.ico': return 'image/x-icon';
    default: return 'application/octet-stream';
  }
}

function serveStatic(pathname: string, response: ServerResponse): void {
  const requested = pathname === '/' ? 'index.html' : pathname === '/kendra' ? 'kendra.html' : pathname.replace(/^\/+/, '');
  const path = join(root, requested);
  if (!path.startsWith(root) || !existsSync(path)) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }
  response.writeHead(200, { 'content-type': contentType(path) });
  createReadStream(path).pipe(response);
}

// ── Dashboard de la niña (módulo kid-dashboard) ───────────────────────────────────────────────────────────────────
// Inventario doméstico: archivo local fuera de Git (config/home-devices.local.json). Sin archivo → sin dispositivos.
const HOME_KINDS: readonly HomeDeviceKind[] = ['light', 'plug', 'fan', 'heater', 'thermostat'];
function loadHomeInventory(): HomeDevice[] {
  const path = process.env.JANUS_HOME_DEVICES_PATH?.trim() || join(process.cwd(), 'config', 'home-devices.local.json');
  try {
    if (!existsSync(path)) return [];
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    const list = Array.isArray(parsed) ? parsed : (parsed as { devices?: unknown })?.devices;
    if (!Array.isArray(list)) return [];
    return list.flatMap((item): HomeDevice[] => {
      const raw = item as Partial<HomeDevice> | null;
      if (!raw || typeof raw.id !== 'string' || typeof raw.name !== 'string' || typeof raw.room !== 'string') return [];
      if (!HOME_KINDS.includes(raw.kind as HomeDeviceKind)) return [];
      return [{ id: raw.id, name: raw.name, room: raw.room, kind: raw.kind as HomeDeviceKind, ...(Array.isArray(raw.tags) ? { tags: raw.tags.filter((tag): tag is string => typeof tag === 'string') } : {}) }];
    });
  } catch {
    return [];
  }
}
const kidChatModelOff = process.env.JANUS_KID_CHAT_MODEL?.trim().toLowerCase() === 'off';
const kidWeatherOff = process.env.JANUS_KID_WEATHER?.trim().toLowerCase() === 'off';
const kidDailyModelCalls = Number(process.env.JANUS_KID_MAX_MODEL_CALLS_PER_DAY);
const handleKidRoute = createKidRoutes({
  store,
  json,
  readJson,
  readBodyBytes,
  headerValue,
  requireFounder: requireFounderAuthority,
  errorStatus: authErrorStatus,
  errorBody: authErrorBody,
  attachmentStore,
  ...(modelGateway && !kidChatModelOff ? { model: modelGateway } : {}),
  homeInventory: loadHomeInventory,
  // homeExecutor: pendiente (necesita credenciales Tuya y el inventario real) → las órdenes de la casa quedan en modo latente.
  ...(kidWeatherOff ? {} : { weather: (input) => fetchHourlyForecast(input) }),
  companions: CREATURES.map((creature) => ({ id: creature.id, name: creature.defaultName, primary: creature.palette.primary, glow: creature.palette.glow, catchphrase: creature.catchphrases[0] ?? '', catchphrases: creature.catchphrases })),
  ...(timeZone ? { defaultTimeZone: timeZone } : {}),
  ...(Number.isFinite(kidDailyModelCalls) && kidDailyModelCalls > 0 ? { maxModelCallsPerDay: Math.floor(kidDailyModelCalls) } : {}),
});

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

  // ÚNICO ORIGEN: PWA oficial y dashboards A/B comparten autenticación
  // de Founder, /api/command, SSE, aprobaciones y memoria SQLite.
  // No se envían tokens a una landing ni a un Artifact ajenos al Núcleo.
  if (url.pathname === '/dashboard' || url.pathname === '/dashboard/a' || url.pathname === '/dashboard/b') {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { allow: 'GET, HEAD' }); response.end(); return;
    }
    const skin = url.pathname === '/dashboard/b' ? 'b' : 'a';
    // Nombre distinto al HTML personal local: nunca reutilizar por accidente
    // un archivo previamente compilado con local/names.json o local/real.js.
    const dashboardFile = join(dashboardRoot, 'dist',
      skin === 'a' ? 'Janus-Core-A-public-safe.html' : 'Janus-Core-B-public-safe.html');
    try {
      if (!existsSync(dashboardFile)) {
        if (!existsSync(dashboardBuild)) throw new Error('Módulo de dashboard no instalado');
        execFileSync(process.execPath, [dashboardBuild, '--skin', skin, '--out', dashboardFile], {
          cwd: dashboardRoot, timeout: 60_000, stdio: 'pipe',
          env: { ...process.env, JANUS_DASH_PUBLIC_SAFE: '1' },
        });
      }
      if (!existsSync(dashboardFile)) throw new Error('No se generó la vista ' + skin);
      response.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
      });
      if (request.method === 'HEAD') response.end();
      else {
        const html = readFileSync(dashboardFile, 'utf8')
          .replace('</head>', '<meta name="janus-runtime" content="core"><link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/icons/janus-icon-180.png"><link rel="stylesheet" href="/dashboard-access.css"></head>')
          .replace('</body>', '<script type="module" src="/dashboard-access.js"></script></body>');
        response.end(html);
      }
    } catch (error) {
      json(response, 503, { ok: false, error: 'Dashboard local no disponible',
        detail: error instanceof Error ? error.message : String(error) });
    }
    return;
  }



  // Plantilla laboral única (JANUS Work): misma página para cualquier colaborador; los datos y
  // permisos salen de su sesión. Piel = dashboard de IBA, verificada por huella. Si la piel no está
  // instalada se responde 503: nunca se sirve otro diseño en su lugar.
  const workPage = url.pathname === '/work' || url.pathname === '/work/' ? 'core'
    : url.pathname === '/work/team' || url.pathname === '/work/team/' ? 'team' : '';
  if (workPage) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { allow: 'GET, HEAD' }); response.end(); return;
    }
    const workBuild = join(dashboardRoot, 'work', 'build-work.cjs');
    const workFile = join(dashboardRoot, 'dist', `Janus-Work-${workPage}.html`);
    try {
      // Se reconstruye si falta o si alguna pieza de origen es más reciente (tras una actualización no se sirve lo viejo).
      const workSources = [join(dashboardRoot, 'work'), join(dashboardRoot, 'local'), join(root, 'founder-session.js'), join(root, 'language-art'), join(dashboardRoot, 'lego', 'janus-model-gateway')];
      if (!existsSync(workFile) || newestMtimeMs(workSources) > statSync(workFile).mtimeMs) {
        if (!existsSync(workBuild)) throw new Error('Módulo de plantilla laboral no instalado');
        execFileSync(process.execPath, [workBuild, '--mode', workPage, '--out', workFile], {
          cwd: dashboardRoot, timeout: 60_000, stdio: 'pipe',
        });
      }
      response.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
        'x-frame-options': 'DENY',
      });
      if (request.method === 'HEAD') response.end();
      else {
        response.end(readFileSync(workFile, 'utf8').replace('</head>',
          '<meta name="janus-runtime" content="core"><link rel="manifest" href="/work.webmanifest"><link rel="icon" href="/icons/janus-icon-192.png"><link rel="apple-touch-icon" href="/icons/janus-icon-180.png"></head>'));
      }
    } catch (error) {
      const stderr = (error as { stderr?: unknown })?.stderr;
      json(response, 503, { ok: false, error: 'Plantilla laboral no disponible',
        detail: (stderr ? String(stderr) : error instanceof Error ? error.message : String(error)).trim().slice(0, 400) });
    }
    return;
  }

  if (request.method === 'GET' && url.pathname === '/health') {
    json(response, 200, {
      ok: true,
      service: 'janus-runtime',
      evolutionGuard: { state: 'available', endpoint: '/api/evolution', riskChecks: EVOLUTION_CHECKS.length, policy: 'never-auto-deploy' },
      durable: true,
      db: dbPath === ':memory:' ? 'memory' : 'sqlite',
      timeZone: timeZone ?? 'runtime-default',
      voiceSessionAuthority: 'core',
      speakerRecognition: speakerRecognitionState,
      faceRecognition: { ...faceRecognitionState, householdStrict },
      voice: {
        streaming: voiceGateway
          ? {
              state: 'available',
              transport: 'websocket',
              input: 'audio/pcm;rate=16000;channels=1;format=s16le',
              stt: 'whisper.cpp-adapter',
              tts: voiceTtsRouting.provider,
              ...(voiceTtsRouting.router
                ? {
                    ttsRouting: voiceTtsRouting.router.status(),
                    ttsCloudUsage: voiceTtsRouting.elevenlabs?.usage(),
                  }
                : {}),
            }
          : {
              state: 'unavailable',
              reason: !sttBaseUrl && !ttsBaseUrl
                ? 'STT y TTS locales no están configurados.'
                : !sttBaseUrl
                  ? 'STT local no está configurado.'
                  : ttsProviderSetting === 'elevenlabs' && !elevenLabsVoiceId
                    ? 'JANUS_TTS_PROVIDER=elevenlabs requiere JANUS_ELEVENLABS_VOICE_ID.'
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
        voicePrivilegedActions: 'authenticated-session-with-per-action-authority-and-biometric-guards',
        audit: 'event-log+sha256-decision-hash',
        ...authorityAuth.status(),
      },
      tools: capabilities.availableCatalog(),
      capabilities: capabilities.snapshot(),
      assistantControl: (() => {
        const snapshot = assistantControlSnapshot();
        return {
          profiles: snapshot.profiles.length,
          surfaces: snapshot.surfaces.length,
          activeSurfaces: snapshot.surfaces.filter((surface) => surface.status === 'active').length,
          inheritedCurrent: snapshot.surfaces.filter((surface) => surface.tracking === 'current').length,
          deliveries: store.listAssistantConfigDeliveries().length,
          appliedDeliveries: store.listAssistantConfigDeliveries()
            .filter((delivery) => delivery.status === 'applied').length,
          publisher: githubConfigured ? 'github-revalidated-idempotent' : 'needs-auth',
          endpoint: '/api/assistant-control',
        };
      })(),
      progressPolicy: {
        id: CONTINUE_BY_ALTERNATIVES_POLICY.id,
        rule: CONTINUE_BY_ALTERNATIVES_POLICY.rule,
        mandatoryStops: CONTINUE_BY_ALTERNATIVES_POLICY.mandatoryStops,
      },
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
        githubConfigured,
        googleConfigured,
        modelConfigured: Boolean(modelGateway),
        modelProviders: describeModelProviders(process.env),
        modelRoute: resolveModelProviders(process.env).map((provider) => provider.id),
        provider: 'replaceable-broker',
      },
    });
    return;
  }

  // Janus Evolution Guard: observaciones locales y postmortems auditables.
  // Lectura y escritura requieren siempre sesión del Founder. Evidencias aportadas
  // desde la UI NO quedan verificadas automáticamente (fail closed).
  if (request.method === 'GET' && url.pathname === '/api/evolution') {
    try {
      requireFounderAuthority(request);
      const observations: EvolutionObservation[] = store.listChronologyRecords()
        .filter(record => record.sessionId === 'janus-evolution'
          && record.kind === 'verification' && record.subject.startsWith('evolution-check:'))
        .map(record => ({
          id: record.metadata?.checkId as EvolutionCheckId,
          at: record.at,
          result: record.metadata?.result as EvolutionObservation['result'],
          verified: record.metadata?.verified === true,
          evidenceRef: String(record.metadata?.evidenceRef || ''),
          notes: String(record.metadata?.notes || ''),
        }))
        .filter(item => EVOLUTION_CHECKS.some(check => check.id === item.id) && item.evidenceRef);
      const report = premortem(observations, new Date().toISOString());
      json(response, 200, {
        ok: true, report,
        recurrence: store.listErrorLessons()
          .filter(lesson => lesson.fingerprint.startsWith('janus-evolution:'))
          .map(lesson => ({ fingerprint: lesson.fingerprint, count: lesson.recurrenceCount,
            priority: lesson.priority, protectionReview: lesson.requiresProtectionReview })),
        execution: 'read-only', autoUpgrade: false,
      });
    } catch (error) { json(response, authErrorStatus(error), authErrorBody(error)); }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/evolution/evidence') {
    try {
      const session = requireFounderAuthority(request);
      const body = await readJson(request);
      const id = String(body.id || '').trim() as EvolutionCheckId;
      const result = String(body.result || '');
      const evidenceRef = String(body.evidenceRef || '').trim();
      if (!EVOLUTION_CHECKS.some(check => check.id === id)
        || !['pass', 'warn', 'fail'].includes(result)
        || evidenceRef.length < 3 || evidenceRef.length > 300)
        throw new HttpRequestError(400, 'La evidencia requiere chequeo conocido, estado válido y referencia verificable');
      const at = new Date().toISOString();
      const previous = continuitySnapshot().currentBySubject['evolution-check:' + id];
      const recordId = 'evolution-observation:' + randomUUID();
      store.appendChronologyRecord({
        id: recordId, sessionId: 'janus-evolution', at, kind: 'verification',
        subject: 'evolution-check:' + id,
        content: 'Observación recibida; pendiente de verificación independiente',
        status: 'current',
        ...(previous ? { supersedesId: previous.id } : {}),
        metadata: {
          checkId: id, result, evidenceRef, verified: false,
          principalId: session.principal.id,
          notes: String(body.notes || '').slice(0, 250),
          source: 'founder-reported-unverified',
        },
      });
      json(response, 201, { ok: true, recordId, verified: false, requiresIndependentReview: true });
    } catch (error) {
      json(response, error instanceof HttpRequestError ? authErrorStatus(error) : 400, authErrorBody(error));
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/evolution/postmortem') {
    try {
      const session = requireFounderAuthority(request);
      const body = await readJson(request);
      const id = String(body.id || '').trim();
      const fingerprint = String(body.fingerprint || '').trim().toLowerCase();
      if (!/^[a-zA-Z0-9_-]{3,80}$/.test(id) || !/^[a-z0-9:_-]{3,120}$/.test(fingerprint))
        throw new HttpRequestError(400, 'Identificador o huella del incidente inválidos');
      const recordId = 'evolution-incident:' + id;
      // Idempotencia: misma incidencia nunca incrementa reincidencia dos veces.
      const duplicate = store.listChronologyRecords().find(record => record.id === recordId);
      if (duplicate) {
        json(response, 200, { ok: true, alreadyRecorded: true, incidentId: id, recordId });
        return;
      }
      const previous = store.listErrorLessons().find(lesson => lesson.fingerprint === 'janus-evolution:' + fingerprint);
      const occurredAt = String(body.occurredAt || '');
      const incident = postmortem({
        id, fingerprint: 'janus-evolution:' + fingerprint, occurredAt,
        recordedAt: new Date().toISOString(),
        error: String(body.error || '').slice(0, 1200),
        cause: String(body.cause || '').slice(0, 1200),
        impact: String(body.impact || '').slice(0, 1200),
        lesson: String(body.lesson || '').slice(0, 1200),
        preventiveRule: String(body.preventiveRule || '').slice(0, 1200),
        solutions: Array.isArray(body.solutions) ? body.solutions.slice(0, 5).map(x => String(x).slice(0, 1200)) : [],
        change: String(body.change || '').slice(0, 1200),
        verification: String(body.verification || '').slice(0, 1200),
        evidenceRefs: Array.isArray(body.evidenceRefs) ? body.evidenceRefs.slice(0, 10).map(x => String(x).slice(0, 300)) : [],
        previousOccurrences: previous?.recurrenceCount || 0,
        verified: false,
      });
      const ledger = new ErrorLedger(store.listErrorLessons());
      const lesson = ledger.record({
        id: incident.incident.id, fingerprint: incident.incident.fingerprint,
        at: incident.incident.recordedAt, error: incident.incident.error,
        cause: incident.incident.cause, impact: incident.incident.impact,
        lesson: incident.incident.lesson, preventiveRule: incident.incident.preventiveRule,
        solutions: incident.incident.solutions, change: incident.incident.change,
        verification: incident.incident.verification, verified: false,
      });
      store.upsertErrorLesson(lesson);
      store.appendChronologyRecord({
        id: recordId, sessionId: 'janus-evolution', at: incident.incident.recordedAt,
        kind: 'error', subject: 'evolution-incident:' + id, status: 'current',
        content: incident.incident.error,
        metadata: { fingerprint: incident.incident.fingerprint, evidenceRefs: incident.incident.evidenceRefs,
          principalId: session.principal.id, recurrenceCount: lesson.recurrenceCount,
          requiresProtectionReview: lesson.requiresProtectionReview },
      });
      json(response, 201, { ok: true, postmortem: { status: 'open',
        incidentId: id, recurrenceCount: lesson.recurrenceCount,
        requiresProtectionReview: lesson.requiresProtectionReview, priority: lesson.priority,
        requiresHumanApproval: true } });
    } catch (error) {
      json(response, error instanceof HttpRequestError ? authErrorStatus(error) : 400, authErrorBody(error));
    }
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/approvals') {
    try {
      requireFounderAuthority(request);
      json(response, 200, { ok: true, pending: approvalQueue.pending(), recent: approvalQueue.recent(10), timeoutMs: approvalTimeoutMs });
    } catch (error) {
      json(response, authErrorStatus(error), authErrorBody(error));
    }
    return;
  }

  const approvalDecisionMatch = url.pathname.match(/^\/api\/approvals\/(approval_[0-9a-f-]{36})\/decision$/);
  if (request.method === 'POST' && approvalDecisionMatch) {
    try {
      const session = requireFounderAuthority(request);
      const body = await readJson(request);
      if (typeof body.approved !== 'boolean') throw new HttpRequestError(400, 'approved (boolean) is required');
      const record = approvalQueue.decide(approvalDecisionMatch[1]!, {
        approved: body.approved,
        decidedBy: session.principal.id,
        ...(typeof body.note === 'string' ? { note: body.note } : {}),
      });
      json(response, 200, { ok: true, approval: record });
    } catch (error) {
      if (error instanceof ApprovalDecisionError) {
        json(response, error.code === 'not_found' ? 404 : 409, { ok: false, error: error.message });
      } else {
        json(response, authErrorStatus(error), authErrorBody(error));
      }
    }
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
      biometric: {
        protocol: 'platform-face-p256-action-proof',
        rawBiometricData: 'never-received-or-stored',
        privateKeyStorage: 'platform-secure-hardware-required',
        publicKeyStorage: 'sqlite-public-metadata-only',
        nativeSigner: 'ios-secure-enclave-bridge-required',
        bootstrapEnrollmentAllowed: allowBiometricBootstrap,
        ...founderBiometric.status(),
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

  if (request.method === 'POST' && url.pathname === '/api/auth/biometric/challenge') {
    try {
      requireFounderAuthority(request);
      const body = await readJson(request);
      const action = typeof body.action === 'string' ? body.action.trim() : '';
      if (!action) throw new HttpRequestError(400, 'action is required');
      const challenge = founderBiometric.issueChallenge(action);
      json(response, 200, { ok: true, challenge });
    } catch (error) {
      json(response, authErrorStatus(error), authErrorBody(error));
    }
    return;
  }

  if (
    request.method === 'POST'
    && url.pathname === '/api/auth/biometric/enrollment/challenge'
  ) {
    try {
      requireFounderAuthority(request);
      const body = await readJson(request);
      const keyId = typeof body.keyId === 'string' ? body.keyId.trim() : '';
      const publicKeyPem = typeof body.publicKeyPem === 'string' ? body.publicKeyPem : '';
      if (!keyId || !publicKeyPem.trim()) {
        throw new HttpRequestError(400, 'keyId and publicKeyPem are required');
      }
      const status = founderBiometric.status();
      if (status.activeFaceKeys === 0 && !allowBiometricBootstrap) {
        throw new HttpRequestError(
          409,
          'Initial Founder Face ID enrollment is disabled; temporarily set JANUS_ALLOW_BIOMETRIC_BOOTSTRAP=true or provision a public key out of band',
        );
      }
      const challenge = founderBiometric.issueEnrollmentChallenge({
        keyId,
        publicKeyPem,
      });
      json(response, 200, {
        ok: true,
        challenge,
        requiresExistingProof: status.activeFaceKeys > 0,
        existingProofAction: status.activeFaceKeys > 0
          ? 'security.biometric.enroll'
          : null,
      });
    } catch (error) {
      json(response, authErrorStatus(error), authErrorBody(error));
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/biometric/enroll') {
    try {
      const activeBefore = founderBiometric.status().activeFaceKeys;
      if (activeBefore === 0 && !allowBiometricBootstrap) {
        throw new HttpRequestError(
          409,
          'Initial Founder Face ID enrollment is disabled',
        );
      }
      const session = activeBefore > 0
        ? requireFounderBiometricAuthority(request, 'security.biometric.enroll')
        : requireFounderAuthority(request);
      const body = await readJson(request);
      if (body.confirmAction !== 'enroll_founder_face_key') {
        throw new HttpRequestError(
          409,
          'confirmAction="enroll_founder_face_key" is required',
        );
      }
      const challengeId = typeof body.challengeId === 'string'
        ? body.challengeId.trim()
        : '';
      const keyId = typeof body.keyId === 'string' ? body.keyId.trim() : '';
      const publicKeyPem = typeof body.publicKeyPem === 'string' ? body.publicKeyPem : '';
      const signature = typeof body.signature === 'string' ? body.signature.trim() : '';
      if (!challengeId || !keyId || !publicKeyPem.trim() || !signature) {
        throw new HttpRequestError(
          400,
          'challengeId, keyId, publicKeyPem and signature are required',
        );
      }

      const registration = founderBiometric.verifyEnrollmentAndRegisterFaceKey({
        challengeId,
        keyId,
        publicKeyPem,
        signature,
      });
      appendGovernanceDecision({
        subject: 'founder-biometric-key:' + registration.keyId,
        content:
          'Founder Face ID public key enrolled after action-bound proof of possession; '
          + 'private key remains outside Janus in platform secure hardware.',
        principalId: session.principal.id,
        metadata: {
          action: 'enroll',
          key: biometricKeyView(registration),
          bootstrap: activeBefore === 0,
        },
      });
      json(response, 201, {
        ok: true,
        key: biometricKeyView(registration),
        bootstrap: activeBefore === 0,
      });
    } catch (error) {
      json(response, authErrorStatus(error), authErrorBody(error));
    }
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/auth/biometric/keys') {
    try {
      const activeKeys = founderBiometric.status().activeFaceKeys;
      if (activeKeys > 0) {
        requireFounderBiometricAuthority(request, 'founder.private.biometric_keys.read');
      } else {
        requireFounderAuthority(request);
      }
      json(response, 200, {
        ok: true,
        keys: founderBiometricKeyStore
          .list('founder', false)
          .map(biometricKeyView),
      });
    } catch (error) {
      json(response, authErrorStatus(error), authErrorBody(error));
    }
    return;
  }

  const biometricRevokeMatch = url.pathname.match(
    /^\/api\/auth\/biometric\/keys\/([^/]+)\/revoke$/,
  );
  const biometricRevokeKeyId = biometricRevokeMatch?.[1];
  if (request.method === 'POST' && biometricRevokeKeyId) {
    try {
      const { principal } = requireFounderBiometricAuthority(
        request,
        'security.biometric.revoke',
      );
      const body = await readJson(request);
      if (body.confirmAction !== 'revoke_founder_face_key') {
        throw new HttpRequestError(
          409,
          'confirmAction="revoke_founder_face_key" is required',
        );
      }
      const keyId = decodeURIComponent(biometricRevokeKeyId);
      const target = founderBiometricKeyStore.get(keyId);
      if (!target || !target.active || target.revokedAt) {
        throw new HttpRequestError(404, 'active Founder face key not found');
      }
      const activeKeys = founderBiometricKeyStore.list('founder', true);
      if (activeKeys.length <= 1) {
        throw new HttpRequestError(
          409,
          'Janus refuses to revoke the last active Founder face key through the API',
        );
      }
      if (!founderBiometric.revokeKey(keyId)) {
        throw new HttpRequestError(409, 'Founder face key revocation failed');
      }
      const revoked = founderBiometricKeyStore.get(keyId);
      appendGovernanceDecision({
        subject: 'founder-biometric-key:' + keyId,
        content:
          'Founder Face ID public key revoked after a fresh biometric proof; '
          + 'at least one active replacement key remains.',
        principalId: principal.id,
        metadata: {
          action: 'revoke',
          key: revoked ? biometricKeyView(revoked) : { keyId },
        },
      });
      json(response, 200, {
        ok: true,
        key: revoked ? biometricKeyView(revoked) : { keyId, active: false },
      });
    } catch (error) {
      json(response, authErrorStatus(error), authErrorBody(error));
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/biometric/verify') {
    try {
      requireFounderAuthority(request);
      const body = await readJson(request);
      const challengeId = typeof body.challengeId === 'string' ? body.challengeId.trim() : '';
      const keyId = typeof body.keyId === 'string' ? body.keyId.trim() : '';
      const signature = typeof body.signature === 'string' ? body.signature.trim() : '';
      if (!challengeId || !keyId || !signature) {
        throw new HttpRequestError(400, 'challengeId, keyId and signature are required');
      }
      const proof = founderBiometric.verifyAssertion({ challengeId, keyId, signature });
      json(response, 200, { ok: true, proof });
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
      const { token } = requireFounderBiometricAuthority(
        request,
        'security.authority.delegate_admin',
      );
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
      const { token } = requireFounderBiometricAuthority(
        request,
        'security.authority.revoke_admin',
      );
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
      const { token } = requireFounderBiometricAuthority(
        request,
        'security.authority.delegate_operator',
      );
      const body = await readJson(request);
      const principalId = typeof body.principalId === 'string' ? body.principalId.trim() : '';
      const publicKeyPem = typeof body.publicKeyPem === 'string' ? body.publicKeyPem : '';
      const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : undefined;
      const notes = typeof body.notes === 'string' ? body.notes.trim() : undefined;
      const locale = body.locale === 'nl' || body.locale === 'en' ? body.locale : 'es';
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
        locale,
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

  // ── Llave de acceso del CEO (passkey con Face ID del navegador) ──
  if (url.pathname.startsWith('/api/auth/passkey/')) {
    try {
      const session = requireFounderAuthority(request);
      if (request.method === 'GET' && url.pathname === '/api/auth/passkey/status') {
        const status = founderPasskey?.status();
        json(response, 200, {
          ok: true,
          enabled: Boolean(founderPasskey),
          activePasskeys: status?.activePasskeys ?? 0,
          allowedActions: status?.allowedActions ?? [],
          // La primera llave solo se puede crear con el interruptor temporal encendido; las siguientes, con Face ID nativo.
          canEnrollNow: Boolean(founderPasskey) && (status?.activePasskeys ?? 0) === 0 && allowPasskeyBootstrap,
        });
        return;
      }
      if (request.method !== 'POST') { response.writeHead(405, { allow: 'GET, POST' }); response.end(); return; }
      if (!founderPasskey) throw new HttpRequestError(409, 'La llave de acceso del CEO está desactivada en este JANUS.');
      const originHeader = request.headers.origin;
      const origin = typeof originHeader === 'string' ? originHeader : '';
      const body = await readJson(request);
      const requireEnrollGate = () => {
        if (founderPasskey.status().activePasskeys === 0) {
          if (!allowPasskeyBootstrap) {
            throw new HttpRequestError(409, 'El alta de la primera llave de acceso está cerrada. Enciéndala temporalmente con JANUS_ALLOW_PASSKEY_BOOTSTRAP=true.');
          }
        } else {
          requireFounderBiometricAuthority(request, 'security.biometric.enroll');
        }
      };
      if (url.pathname === '/api/auth/passkey/register/options') {
        requireEnrollGate();
        json(response, 200, { ok: true, options: founderPasskey.registrationOptions(origin, session.principal.displayName ?? 'CEO') });
        return;
      }
      if (url.pathname === '/api/auth/passkey/register/verify') {
        if (founderPasskey.status().activePasskeys === 0 && !allowPasskeyBootstrap) {
          throw new HttpRequestError(409, 'El alta de la primera llave de acceso está cerrada.');
        }
        const record = founderPasskey.verifyRegistration({ challengeId: body.challengeId, clientDataJSON: body.clientDataJSON, attestationObject: body.attestationObject });
        json(response, 201, { ok: true, passkey: { createdAt: record.createdAt, rpId: record.rpId } });
        return;
      }
      if (url.pathname === '/api/auth/passkey/assert/options') {
        json(response, 200, { ok: true, options: founderPasskey.assertionOptions(origin, typeof body.action === 'string' ? body.action : '') });
        return;
      }
      if (url.pathname === '/api/auth/passkey/assert/verify') {
        const proof = founderPasskey.verifyAssertion({
          challengeId: body.challengeId, credentialId: body.credentialId, clientDataJSON: body.clientDataJSON,
          authenticatorData: body.authenticatorData, signature: body.signature,
        });
        json(response, 200, { ok: true, proof });
        return;
      }
      throw new HttpRequestError(404, 'Not found');
    } catch (error) {
      json(response, authErrorStatus(error), authErrorBody(error));
    }
    return;
  }

  // ── Invitaciones de acceso (JANUS Work) ──
  // El CEO crea el enlace con la MISMA autoridad biométrica que la delegación directa. El colaborador lo abre en su
  // teléfono y canjea el código una sola vez; el código solo viaja en el fragmento (#) del enlace y nunca se guarda.
  if (url.pathname === '/api/auth/operator/invites' && (request.method === 'POST' || request.method === 'GET')) {
    try {
      if (request.method === 'GET') {
        requireFounderAuthority(request);
        const now = new Date();
        json(response, 200, { ok: true, invites: store.listOperatorInvites().map((invite) => publicOperatorInvite(invite, now)) });
        return;
      }
      const { principal } = requireFounderBiometricAuthority(request, 'security.authority.delegate_operator');
      const body = await readJson(request);
      const now = new Date();
      const { invite, code } = createOperatorInvite({
        principalId: typeof body.principalId === 'string' ? body.principalId : '',
        displayName: typeof body.displayName === 'string' ? body.displayName : '',
        locale: typeof body.locale === 'string' ? body.locale : 'es',
        createdBy: principal.id,
        now,
        ...(typeof body.ttlHours === 'number' && Number.isFinite(body.ttlHours) ? { ttlMs: body.ttlHours * 3_600_000 } : {}),
        reservedPrincipalIds: [principal.id, 'founder', 'kendra'],
      });
      const existing = authorityCredentialStore.get(invite.principalId);
      if (existing && existing.principal.role !== 'operator') throw new OperatorInviteError('invalid_input', 'Ese identificador pertenece a otra función.');
      store.revokePendingOperatorInvites(invite.principalId, now.toISOString());
      store.insertOperatorInvite(invite);
      json(response, 201, {
        ok: true,
        invite: publicOperatorInvite(invite, now),
        // Se muestra UNA vez. Quien tenga este enlace antes de que caduque puede vincular un dispositivo como esa persona.
        code,
        path: `/work#invite=${code}`,
      });
    } catch (error) {
      if (error instanceof OperatorInviteError) json(response, 400, { ok: false, code: error.code, error: error.message });
      else json(response, authErrorStatus(error), authErrorBody(error));
    }
    return;
  }

  const inviteRevokeMatch = /^\/api\/auth\/operator\/invites\/(invite_[A-Za-z0-9-]{8,64})$/.exec(url.pathname);
  if (inviteRevokeMatch && request.method === 'DELETE') {
    try {
      requireFounderAuthority(request);
      const invite = store.getOperatorInvite(inviteRevokeMatch[1]!);
      if (!invite) throw new HttpRequestError(404, 'Invitación no encontrada');
      const nowIso = new Date().toISOString();
      const revoked = invite.status === 'pending'
        && store.transitionOperatorInvite({ ...invite, status: 'revoked', revokedAt: nowIso }, 'pending', '');
      json(response, 200, { ok: true, revoked });
    } catch (error) {
      json(response, authErrorStatus(error), authErrorBody(error));
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/operator/invites/redeem') {
    try {
      requireSecureAuthorityTransport(request);
      const source = request.socket.remoteAddress ?? 'unknown';
      if (!inviteRedeemLimiter(source)) throw new HttpRequestError(429, 'Demasiados intentos. Espera unos minutos.');
      const body = await readJson(request);
      const code = body.code;
      const publicKeyPem = typeof body.publicKeyPem === 'string' ? body.publicKeyPem : '';
      if (!isInviteCodeShape(code) || !publicKeyPem.trim()) throw new OperatorInviteError('invalid_code', 'Invitación no válida.');
      const now = new Date();
      const nowIso = now.toISOString();
      const invite = store.getOperatorInviteByHash(hashInviteCode(code));
      assertInviteUsable(invite, now);
      // Primero se consume (atómico: solo un canje gana); si la llave resulta inválida se devuelve a pendiente.
      const redeemed = { ...invite, status: 'redeemed' as const, redeemedAt: nowIso };
      if (!store.transitionOperatorInvite(redeemed, 'pending', nowIso)) throw new OperatorInviteError('already_used', 'Esta invitación ya se usó. Pide una nueva.');
      let credential;
      try {
        credential = authorityAuth.enrollOperatorFromInvitation({
          principalId: invite.principalId,
          publicKeyPem,
          displayName: invite.displayName,
          authorizedBy: invite.createdBy,
        });
      } catch (error) {
        store.transitionOperatorInvite(invite, 'redeemed', nowIso);
        throw error;
      }
      const previous = store.getCoordinationOperator(invite.principalId);
      store.upsertCoordinationOperator({
        ...(previous ?? {}),
        principalId: invite.principalId,
        status: 'active',
        createdAt: previous?.createdAt ?? credential.createdAt,
        updatedAt: credential.createdAt,
        displayName: invite.displayName,
        locale: invite.locale,
      });
      json(response, 201, { ok: true, principalId: invite.principalId, displayName: invite.displayName, locale: invite.locale });
    } catch (error) {
      if (error instanceof OperatorInviteError) json(response, error.code === 'invalid_code' ? 404 : 410, { ok: false, code: error.code, error: error.message });
      else json(response, authErrorStatus(error), authErrorBody(error));
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/operator/revoke') {
    try {
      const { token } = requireFounderBiometricAuthority(
        request,
        'security.authority.revoke_operator',
      );
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

  if (request.method === 'GET' && url.pathname === '/api/learning/blueprints/tool-sync') {
    json(response, 200, { ok: true, blueprintId: runtimeBlueprint.id, ...diffToolCatalog(runtimeBlueprint, capabilityPolicyCatalog()) });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/learning/blueprints/tool-sync') {
    try {
      const { principal } = requireFounderAuthority(request);
      const body = await readJson(request);
      if (body.confirmAction !== 'apply_tool_catalog_revision') {
        throw new HttpRequestError(409, 'Explicit confirmAction=apply_tool_catalog_revision is required');
      }
      const expectedRevision = Number(body.expectedRevision);
      if (!Number.isInteger(expectedRevision) || expectedRevision < 1) {
        throw new HttpRequestError(400, 'expectedRevision must be a positive integer');
      }
      const result = applyToolCatalogSync({
        store,
        current: runtimeBlueprint,
        registeredTools: capabilityPolicyCatalog(),
        expectedRevision,
      });
      runtimeBlueprint = result.active;
      appendGovernanceDecision({
        subject: 'blueprint-governance:' + result.proposal.id,
        content: 'Tool catalog sync applied by Founder/Director: new integrations allowed; guardrails and approvals unchanged.',
        principalId: principal.id,
        metadata: {
          proposalId: result.proposal.id,
          action: 'tool_catalog_sync',
          previousRevision: result.previous.revision,
          activeRevision: result.active.revision,
          additions: result.diff.additions,
        },
      });
      json(response, 200, { ok: true, previousRevision: result.previous.revision, activeRevision: result.active.revision, additions: result.diff.additions });
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
        progressPolicy: CONTINUE_BY_ALTERNATIVES_POLICY,
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
      const requestedProvider = preferredProviderFrom(body.preferredProvider);
      if (requestedProvider === null) throw new HttpRequestError(400, 'preferredProvider is invalid');
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
        ...(requestedProvider ? { preferredProvider: requestedProvider } : {}),
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

  const assistantBundleMatch = url.pathname.match(
    /^\/api\/assistant-control\/surfaces\/([^/]+)\/bundle$/,
  );
  const assistantBundleSurfaceId = assistantBundleMatch?.[1];
  if (request.method === 'GET' && assistantBundleSurfaceId) {
    try {
      requireAuthoritySession(request);
      const bundle = assistantBundleForSurface(
        decodeURIComponent(assistantBundleSurfaceId),
      );
      json(response, 200, {
        ok: true,
        bundle,
        content: serializeAssistantConfigBundle(bundle),
      });
    } catch (error) {
      const status = error instanceof AuthorityAuthenticationError || error instanceof HttpRequestError
        ? authErrorStatus(error)
        : 409;
      json(response, status, authErrorBody(error));
    }
    return;
  }

  const assistantPublishMatch = url.pathname.match(
    /^\/api\/assistant-control\/surfaces\/([^/]+)\/publish$/,
  );
  const assistantPublishSurfaceId = assistantPublishMatch?.[1];
  if (request.method === 'POST' && assistantPublishSurfaceId) {
    let delivery: ReturnType<typeof createAssistantConfigDelivery> | undefined;
    try {
      const { principal } = requireFounderAuthority(request);
      const body = await readJson(request);
      if (body.confirmAction !== 'publish_assistant_surface') {
        throw new HttpRequestError(
          400,
          'confirmAction="publish_assistant_surface" is required',
        );
      }
      const surfaceId = decodeURIComponent(assistantPublishSurfaceId);
      const surface = store.getAssistantSurface(surfaceId);
      if (!surface) throw new HttpRequestError(404, 'assistant surface not found');
      if (surface.status !== 'active') {
        throw new HttpRequestError(409, 'paused assistant surface cannot be published');
      }
      const targetIndex = Number(body.targetIndex ?? 0);
      if (!Number.isInteger(targetIndex) || targetIndex < 0) {
        throw new HttpRequestError(400, 'targetIndex must be a non-negative integer');
      }
      const target = surface.deliveryTargets[targetIndex];
      if (!target) throw new HttpRequestError(404, 'assistant delivery target not found');
      if (target.kind !== 'repository') {
        throw new HttpRequestError(409, 'only repository assistant publishing is wired productively');
      }
      const requestedTargetRef = typeof body.targetRef === 'string'
        ? body.targetRef.trim()
        : '';
      const capability = capabilities.check('github', 'file.publish');
      if (!capability.ok) {
        throw new HttpRequestError(
          409,
          capability.reason ?? 'GitHub publishing capability is unavailable',
        );
      }

      const bundle = assistantBundleForSurface(surfaceId);
      const content = serializeAssistantConfigBundle(bundle);
      const { owner, repo } = repositoryTarget(target.target);
      const targetPath = defaultAssistantBundlePath(target.productKey);
      let targetRef = requestedTargetRef;
      let targetResolution: {
        mode: 'explicit' | 'release_manifest';
        source?: string;
        manifestChecksum?: string;
        releaseHeadSha?: string;
        custody?: 'manifest_head' | 'janus_delivery_lineage' | 'production_deploy';
        publishedDeployId?: string;
        publishedCommitSha?: string;
        custodyChain?: string[];
      } = { mode: 'explicit' };
      let resolvedManifest: AssistantReleaseTargetManifest | null = null;

      if (!targetRef) {
        const metadataRef = ASSISTANT_RELEASE_TARGET_METADATA_REF;
        const releaseManifestPath = defaultAssistantReleaseTargetPath(target.productKey);
        const manifestResult = await toolGateway.execute({
          tool: 'github',
          action: 'file.read',
          input: {
            owner,
            repo,
            path: releaseManifestPath,
            ref: metadataRef,
          },
        }, async () => {});
        if (!manifestResult.ok || typeof manifestResult.output?.content !== 'string') {
          throw new HttpRequestError(
            409,
            manifestResult.error
              ?? 'assistant release target manifest is unavailable; provide a verified targetRef or publish the product pointer',
          );
        }
        const manifest = resolveAssistantReleaseTarget({
          manifest: parseAssistantReleaseTargetManifest(manifestResult.output.content),
          surfaceId,
          product: surface.product,
          repository: target.target,
        });
        targetRef = manifest.releaseRef;
        resolvedManifest = manifest;
        targetResolution = {
          mode: 'release_manifest',
          source: target.target + '@' + metadataRef + ':' + releaseManifestPath,
          manifestChecksum: manifest.checksum,
          releaseHeadSha: manifest.releaseHeadSha,
        };
      }

      const branchResult = await toolGateway.execute({
        tool: 'github',
        action: 'branch.get',
        input: { owner, repo, ref: targetRef },
      }, async () => {});
      if (!branchResult.ok) {
        throw new HttpRequestError(409, branchResult.error ?? 'target branch revalidation failed');
      }
      const expectedHeadSha = typeof branchResult.output?.sha === 'string'
        ? branchResult.output.sha
        : '';
      if (!expectedHeadSha) {
        throw new HttpRequestError(409, 'target branch head SHA is unavailable');
      }
      if (resolvedManifest?.deployment) {
        // Chronology is not publication: anchor to the LIVE production deploy, never
        // to the newest branch commit, which may be a candidate awaiting approval.
        const deployCapability = capabilities.check('netlify', 'site.published_deploy');
        if (!deployCapability.ok) {
          throw new HttpRequestError(
            409,
            'release manifest binds a production deployment but Janus cannot read it: '
            + (deployCapability.reason ?? 'netlify capability unavailable'),
          );
        }
        const deployResult = await toolGateway.execute({
          tool: 'netlify',
          action: 'site.published_deploy',
          input: { siteId: resolvedManifest.deployment.siteId },
        }, async () => {});
        if (!deployResult.ok) {
          throw new HttpRequestError(409, deployResult.error ?? 'published deploy could not be read');
        }
        const assessment = assessPublishedRelease({
          manifest: resolvedManifest,
          observation: publishedDeploymentObservationFromOutput(deployResult.output),
          observedHeadSha: expectedHeadSha,
          deliveries: store.listAssistantConfigDeliveries(),
        });
        if (!assessment.ok) {
          throw new HttpRequestError(409, assessment.reason);
        }
        targetResolution.custody = 'production_deploy';
        targetResolution.custodyChain = assessment.custodyChain;
        targetResolution.publishedDeployId = assessment.deployId;
        targetResolution.publishedCommitSha = assessment.publishedCommitSha;
      } else if (resolvedManifest) {
        // The publisher's own verified commits advance the release branch; accept
        // them only as an unbroken chain of Janus deliveries from the manifest HEAD.
        const custody = verifyReleaseHeadCustody({
          manifest: resolvedManifest,
          observedHeadSha: expectedHeadSha,
          deliveries: store.listAssistantConfigDeliveries(),
        });
        if (!custody.ok) {
          throw new HttpRequestError(409, custody.reason);
        }
        targetResolution.custody = custody.mode;
        targetResolution.custodyChain = custody.chain;
      }

      delivery = createAssistantConfigDelivery({
        surfaceId,
        profileId: bundle.profileId,
        profileRevision: bundle.profileRevision,
        bundleChecksum: bundle.bundleChecksum,
        targetKind: target.kind,
        target: target.target,
        targetRef,
        targetPath,
        createdBy: principal.id,
        expectedHeadSha,
      });
      store.upsertAssistantConfigDelivery(delivery);

      const authorityDecision = evaluateAuthority(
        principal,
        {
          id: 'authority_instruction_' + randomUUID(),
          principalId: principal.id,
          source: 'authenticated_human',
          authenticated: true,
          instruction:
            'Publish assistant config '
            + surfaceId
            + ' to '
            + target.target
            + '@'
            + targetRef,
          requestedAt: new Date().toISOString(),
        },
        'publish_assistant_surface',
      );
      if (!authorityDecision.allowed) {
        throw new HttpRequestError(403, authorityDecision.reason);
      }

      const publishResult = await toolGateway.execute({
        tool: 'github',
        action: 'file.publish',
        input: {
          owner,
          repo,
          path: targetPath,
          ref: targetRef,
          content,
          expectedHeadSha,
          message:
            'Update '
            + surfaceId
            + ' assistant config to '
            + bundle.profileId
            + '@'
            + bundle.profileRevision,
        },
        idempotencyKey:
          surfaceId
          + ':'
          + bundle.bundleChecksum
          + ':'
          + target.target
          + ':'
          + targetRef,
        authorization: {
          privileged: true,
          authorityDecisionHash: authorityDecision.auditHash,
          principalId: principal.id,
        },
      }, async () => {});
      if (!publishResult.ok) {
        delivery = markAssistantDeliveryFailed({
          delivery,
          error: publishResult.error ?? 'assistant config publish failed',
        });
        store.upsertAssistantConfigDelivery(delivery);
        throw new HttpRequestError(409, delivery.error ?? 'assistant config publish failed');
      }

      const commitSha = typeof publishResult.output?.commitSha === 'string'
        ? publishResult.output.commitSha
        : expectedHeadSha;
      const verifyResult = await toolGateway.execute({
        tool: 'github',
        action: 'file.read',
        input: {
          owner,
          repo,
          path: targetPath,
          ref: commitSha,
        },
      }, async () => {});
      if (!verifyResult.ok || typeof verifyResult.output?.content !== 'string') {
        delivery = markAssistantDeliveryFailed({
          delivery,
          error: verifyResult.error ?? 'published assistant config could not be read back',
        });
        store.upsertAssistantConfigDelivery(delivery);
        throw new HttpRequestError(409, delivery.error ?? 'publish verification failed');
      }
      const observed = parseAssistantConfigBundle(verifyResult.output.content);
      if (observed.bundleChecksum !== bundle.bundleChecksum) {
        delivery = markAssistantDeliveryFailed({
          delivery,
          error: 'published assistant config checksum does not match desired bundle',
        });
        store.upsertAssistantConfigDelivery(delivery);
        throw new HttpRequestError(409, delivery.error ?? 'published assistant config checksum does not match desired bundle');
      }

      delivery = markAssistantDeliveryPublished({
        delivery,
        commitSha,
        externalReference: publishResult.externalReference,
        verified: true,
      });
      store.upsertAssistantConfigDelivery(delivery);
      appendGovernanceDecision({
        subject: 'assistant-delivery:' + surfaceId,
        content:
          'Assistant config published and read-back verified at '
          + target.target
          + '@'
          + targetRef
          + '; live application acknowledgement is still pending.',
        principalId: principal.id,
        metadata: {
          deliveryId: delivery.id,
          bundleChecksum: bundle.bundleChecksum,
          profileRevision: bundle.profileRevision,
          target: target.target,
          targetRef,
          targetPath,
          targetResolutionMode: targetResolution.mode,
          targetResolutionSource: targetResolution.source ?? null,
          releaseManifestChecksum: targetResolution.manifestChecksum ?? null,
          validatedReleaseHeadSha: targetResolution.releaseHeadSha ?? expectedHeadSha,
          observedReleaseHeadSha: expectedHeadSha,
          releaseCustody: targetResolution.custody ?? null,
          releaseCustodyChain: targetResolution.custodyChain ?? [],
          publishedDeployId: targetResolution.publishedDeployId ?? null,
          publishedCommitSha: targetResolution.publishedCommitSha ?? null,
          commitSha,
          status: delivery.status,
        },
      });
      json(response, 201, {
        ok: true,
        delivery,
        bundle,
        targetResolution,
        applied: false,
        note:
          'Published content is verified in the target repository; live runtime application requires a separate acknowledgement.',
      });
    } catch (error) {
      if (delivery && delivery.status === 'desired') {
        const failed = markAssistantDeliveryFailed({
          delivery,
          error: error instanceof Error ? error.message : String(error),
        });
        store.upsertAssistantConfigDelivery(failed);
      }
      const status = error instanceof AuthorityAuthenticationError || error instanceof HttpRequestError
        ? authErrorStatus(error)
        : 409;
      json(response, status, authErrorBody(error));
    }
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/assistant-control/deliveries') {
    try {
      requireAuthoritySession(request);
      const surfaceId = url.searchParams.get('surfaceId')?.trim() || undefined;
      json(response, 200, {
        ok: true,
        deliveries: store.listAssistantConfigDeliveries(surfaceId),
      });
    } catch (error) {
      json(response, authErrorStatus(error), authErrorBody(error));
    }
    return;
  }

  const assistantDeliveryVerifyMatch = url.pathname.match(
    /^\/api\/assistant-control\/deliveries\/([^/]+)\/verify-applied$/,
  );
  const assistantDeliveryVerifyId = assistantDeliveryVerifyMatch?.[1];
  if (request.method === 'POST' && assistantDeliveryVerifyId) {
    try {
      const { principal } = requireFounderAuthority(request);
      const id = decodeURIComponent(assistantDeliveryVerifyId);
      const delivery = store.getAssistantConfigDelivery(id);
      if (!delivery) throw new HttpRequestError(404, 'assistant config delivery not found');
      const statusUrl = assistantConsumerStatusUrls[delivery.surfaceId];
      if (!statusUrl) {
        throw new HttpRequestError(
          409,
          'no consumer status endpoint is registered for ' + delivery.surfaceId
          + '; Janus will not mark it applied without observing the live consumer',
        );
      }
      const probe = await toolGateway.execute({
        tool: 'assistant-consumer',
        action: 'status.read',
        input: { url: statusUrl },
      }, async () => {});
      if (!probe.ok || !probe.output || typeof probe.output.body !== 'object') {
        throw new HttpRequestError(409, probe.error ?? 'consumer status could not be read');
      }
      const observedAt = typeof probe.output.observedAt === 'string'
        ? probe.output.observedAt
        : new Date().toISOString();
      const evaluation = evaluateConsumerAcknowledgement({
        delivery,
        statusBody: probe.output.body as Record<string, unknown>,
        sourceUrl: statusUrl,
        observedAt,
      });
      if (!evaluation.ok) {
        json(response, 409, {
          ok: false,
          applied: false,
          code: evaluation.code,
          error: evaluation.reason,
          observed: evaluation.observed ?? null,
          source: statusUrl,
          observedAt,
        });
        return;
      }
      const applied = acknowledgeAssistantDelivery({
        delivery,
        observedBundleChecksum: evaluation.observedBundleChecksum,
        acknowledgementSource: evaluation.acknowledgementSource,
        appliedAt: observedAt,
      });
      store.upsertAssistantConfigDelivery(applied);
      appendGovernanceDecision({
        subject: 'assistant-delivery:' + applied.surfaceId,
        content:
          'Assistant config application OBSERVED by Janus probe for delivery '
          + applied.id
          + ' (consumer reported loaded with matching surface, revision and checksum).',
        principalId: principal.id,
        metadata: {
          deliveryId: applied.id,
          surfaceId: applied.surfaceId,
          profileRevision: applied.profileRevision,
          observedBundleChecksum: applied.observedBundleChecksum,
          acknowledgementSource: applied.acknowledgementSource,
          evidence: 'janus-probe',
          status: applied.status,
        },
      });
      json(response, 200, { ok: true, applied: true, delivery: applied });
    } catch (error) {
      const status = error instanceof AuthorityAuthenticationError || error instanceof HttpRequestError
        ? authErrorStatus(error)
        : 409;
      json(response, status, authErrorBody(error));
    }
    return;
  }

  const assistantDeliveryAckMatch = url.pathname.match(
    /^\/api\/assistant-control\/deliveries\/([^/]+)\/ack$/,
  );
  const assistantDeliveryAckId = assistantDeliveryAckMatch?.[1];
  if (request.method === 'POST' && assistantDeliveryAckId) {
    try {
      const { principal } = requireFounderAuthority(request);
      const body = await readJson(request);
      if (body.confirmAction !== 'ack_assistant_surface_applied') {
        throw new HttpRequestError(
          400,
          'confirmAction="ack_assistant_surface_applied" is required',
        );
      }
      const id = decodeURIComponent(assistantDeliveryAckId);
      const delivery = store.getAssistantConfigDelivery(id);
      if (!delivery) throw new HttpRequestError(404, 'assistant config delivery not found');
      const observedBundleChecksum = typeof body.observedBundleChecksum === 'string'
        ? body.observedBundleChecksum.trim()
        : '';
      const acknowledgementSource = typeof body.acknowledgementSource === 'string'
        ? body.acknowledgementSource.trim()
        : '';
      const applied = acknowledgeAssistantDelivery({
        delivery,
        observedBundleChecksum,
        acknowledgementSource,
      });
      store.upsertAssistantConfigDelivery(applied);
      appendGovernanceDecision({
        subject: 'assistant-delivery:' + applied.surfaceId,
        content:
          'Assistant config application acknowledged for delivery '
          + applied.id
          + ' with matching checksum.',
        principalId: principal.id,
        metadata: {
          deliveryId: applied.id,
          surfaceId: applied.surfaceId,
          profileRevision: applied.profileRevision,
          observedBundleChecksum: applied.observedBundleChecksum,
          acknowledgementSource: applied.acknowledgementSource,
          status: applied.status,
        },
      });
      json(response, 200, { ok: true, delivery: applied });
    } catch (error) {
      const status = error instanceof AuthorityAuthenticationError || error instanceof HttpRequestError
        ? authErrorStatus(error)
        : 409;
      json(response, status, authErrorBody(error));
    }
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/founder/reference-library') {
    try {
      requireFounderBiometricAuthority(request, 'founder.private.references.read');
      json(response, 200, {
        ok: true,
        references: founderReferenceSnapshot(),
      });
    } catch (error) {
      const status = error instanceof HttpRequestError
        || error instanceof AuthorityAuthenticationError
        || error instanceof FounderBiometricError
        ? authErrorStatus(error)
        : 409;
      json(response, status, authErrorBody(error));
    }
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/founder/mail-accounts') {
    try {
      requireFounderBiometricAuthority(request, 'founder.private.mail_accounts.read');
      await refreshVaultCache();
      json(response, 200, { ok: true, registry: founderMailAccountSnapshot() });
    } catch (error) {
      const status = error instanceof HttpRequestError
        || error instanceof AuthorityAuthenticationError
        || error instanceof FounderBiometricError
        ? authErrorStatus(error)
        : 409;
      json(response, status, authErrorBody(error));
    }
    return;
  }

  // Retorno de Google tras el consentimiento. No lleva sesión (es una redirección del navegador), pero solo funciona con un `state`
  // secreto, de un solo uso y que caduca, creado antes por el Founder con prueba biométrica.
  if (request.method === 'GET' && url.pathname === '/api/oauth/google/callback') {
    if (!googleOAuth || !credentialVault) {
      oauthResultPage(response, 503, 'Conexión no disponible', 'El consentimiento de Google no está configurado en este Janus.');
      return;
    }
    const state = url.searchParams.get('state') ?? '';
    if (url.searchParams.get('error')) {
      googleOAuth.cancel(state);
      oauthResultPage(response, 200, 'Consentimiento cancelado', 'No se guardó ningún permiso.');
      return;
    }
    try {
      const { result, credential } = await googleOAuth.completeAuthorization({ state, code: url.searchParams.get('code') ?? '' });
      await credentialVault.put(credential, 'stored');
      await refreshVaultCache();
      syncCredentialCapabilities();
      oauthResultPage(
        response,
        200,
        result.missingScopes.length > 0 ? 'Conectado con permisos parciales' : 'Buzón conectado',
        result.missingScopes.length > 0
          ? 'Janus guardó los permisos concedidos; algunos que pidió no se otorgaron y esas funciones no estarán disponibles.'
          : result.mode === 'read'
            ? 'Janus ya puede leer este buzón bajo tu supervisión.'
            : 'Janus ya puede preparar borradores en este buzón; cada envío seguirá pidiendo tu confirmación.',
      );
    } catch (error) {
      const code = error instanceof GoogleOAuthError ? error.code : 'error';
      oauthResultPage(
        response,
        400,
        'No se pudo conectar',
        code === 'account_mismatch'
          ? 'La cuenta de Google que diste no es la del buzón registrado. No se guardó nada; vuelve a empezar eligiendo la cuenta correcta.'
          : code === 'expired_state' || code === 'unknown_state'
            ? 'La solicitud caducó o ya se usó. Empieza de nuevo desde Janus.'
            : 'Google no completó la conexión. No se guardó nada.',
      );
    }
    return;
  }

  const mailOAuthMatch = url.pathname.match(/^\/api\/founder\/mail-accounts\/([^/]+)\/oauth\/(start|revoke)$/);
  if (request.method === 'POST' && mailOAuthMatch) {
    const [, rawAccountId, operation] = mailOAuthMatch;
    try {
      requireFounderBiometricAuthority(request, operation === 'start' ? 'founder.private.mail_oauth.start' : 'founder.private.mail_oauth.revoke');
      if (!credentialVault) throw new HttpRequestError(503, 'credential_vault_unconfigured: define JANUS_CREDENTIAL_VAULT_KEY (32 bytes, base64 o hex) para guardar credenciales cifradas');
      const body = await readJson(request);
      const accountId = decodeURIComponent(rawAccountId!);
      const account = mailAccounts.find((item) => item.accountId === accountId);
      if (!account) throw new HttpRequestError(404, 'Mail account not found');
      const mode: GoogleConsentMode | null = body.mode === 'read' || body.mode === 'write' ? body.mode : null;
      if (!mode) throw new HttpRequestError(400, 'mode must be "read" or "write"');
      if (account.provider !== 'google') throw new HttpRequestError(409, 'needs_provider_confirmation: el consentimiento de Google solo aplica a cuentas de Google');
      if (mode === 'write' && account.permittedWriteActions.length === 0) {
        throw new HttpRequestError(409, 'Esta cuenta es de solo lectura (cuenta de menor sin la marca guardian-managed)');
      }
      if (operation === 'start') {
        if (body.confirmAction !== 'start_google_consent') throw new HttpRequestError(409, 'confirmAction="start_google_consent" is required');
        if (!googleOAuth) throw new HttpRequestError(503, 'google_oauth_unconfigured: define GOOGLE_OAUTH_CLIENT_ID (cliente OAuth de Google Cloud) y registra la URI de redirección');
        const authorization = googleOAuth.createAuthorizationRequest({ accountId, mode, expectedEmail: account.address });
        json(response, 200, {
          ok: true,
          accountId,
          mode,
          authorizationUrl: authorization.url,
          expiresAt: authorization.expiresAt,
          scopes: authorization.scopes,
          redirectUri: googleOAuth.redirectUri,
          note: 'Abre authorizationUrl, elige la cuenta del buzón y acepta. El permiso queda guardado cifrado; no se envía nada sin tu confirmación.',
        });
      } else {
        if (body.confirmAction !== 'revoke_google_consent') throw new HttpRequestError(409, 'confirmAction="revoke_google_consent" is required');
        const service = googleCredentialService(mode, accountId);
        const entry = await credentialVault.get(service);
        let revokedAtGoogle = false;
        if (entry && googleOAuth) {
          const token = entry.refreshToken ?? entry.accessToken;
          if (token) revokedAtGoogle = await googleOAuth.revoke(token).catch(() => false);
        }
        const removed = await credentialVault.remove(service);
        await refreshVaultCache();
        syncCredentialCapabilities();
        json(response, 200, { ok: true, accountId, mode, removedLocally: removed, revokedAtGoogle });
      }
    } catch (error) {
      const status = error instanceof HttpRequestError
        || error instanceof AuthorityAuthenticationError
        || error instanceof FounderBiometricError
        ? authErrorStatus(error)
        : 409;
      json(response, status, authErrorBody(error));
    }
    return;
  }

  // Token de Threads: se guarda cifrado y se renueva solo. Nunca se devuelve ni se registra.
  if (request.method === 'POST' && (url.pathname === '/api/founder/social-credentials/threads' || url.pathname === '/api/founder/social-credentials/threads/remove')) {
    try {
      requireFounderBiometricAuthority(request, 'founder.private.social_credentials.write');
      if (!credentialVault) throw new HttpRequestError(503, 'credential_vault_unconfigured: define JANUS_CREDENTIAL_VAULT_KEY (32 bytes, base64 o hex) para guardar credenciales cifradas');
      const body = await readJson(request);
      if (url.pathname.endsWith('/remove')) {
        if (body.confirmAction !== 'remove_threads_token') throw new HttpRequestError(409, 'confirmAction="remove_threads_token" is required');
        const removed = await credentialVault.remove(THREADS_SERVICE);
        await refreshVaultCache();
        syncCredentialCapabilities();
        json(response, 200, { ok: true, removed });
      } else {
        if (body.confirmAction !== 'store_threads_token') throw new HttpRequestError(409, 'confirmAction="store_threads_token" is required');
        const accessToken = typeof body.accessToken === 'string' ? body.accessToken : '';
        if (body.tokenKind === 'short-lived') {
          const secret = process.env.THREADS_APP_SECRET?.trim();
          if (!secret) throw new HttpRequestError(503, 'threads_app_secret_unconfigured: un token de corta duración necesita THREADS_APP_SECRET para canjearse');
          const exchanged = await exchangeThreadsToken({ shortLivedToken: accessToken, clientSecret: secret });
          await storeThreadsToken(credentialVault, exchanged);
        } else {
          await storeThreadsToken(credentialVault, { accessToken });
        }
        await refreshVaultCache();
        syncCredentialCapabilities();
        json(response, 200, { ok: true, stored: true, status: vaultCache.get(THREADS_SERVICE) ?? null });
      }
    } catch (error) {
      const status = error instanceof HttpRequestError
        || error instanceof AuthorityAuthenticationError
        || error instanceof FounderBiometricError
        ? authErrorStatus(error)
        : 409;
      json(response, status, authErrorBody(error));
    }
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/founder/social-watch') {
    try {
      requireFounderBiometricAuthority(request, 'founder.private.social_watch.read');
      json(response, 200, {
        ok: true,
        scheduler: socialWatchScheduler?.status() ?? { enabled: false, reason: 'Define JANUS_SOCIAL_WATCH_INTERVAL_MIN (minutos, mínimo 15) para activar el seguimiento periódico.' },
        lastReport: lastSocialWatchReport,
      });
    } catch (error) {
      const status = error instanceof HttpRequestError
        || error instanceof AuthorityAuthenticationError
        || error instanceof FounderBiometricError
        ? authErrorStatus(error)
        : 409;
      json(response, status, authErrorBody(error));
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/founder/social-watch/run') {
    try {
      requireFounderBiometricAuthority(request, 'founder.private.social_watch.run');
      const body = await readJson(request);
      if (body.confirmAction !== 'run_social_watch') throw new HttpRequestError(409, 'confirmAction="run_social_watch" is required');
      // Con planificador activo se comparte la ejecución en curso; sin él, una lectura puntual. Nunca dos a la vez.
      const report = socialWatchScheduler ? await socialWatchScheduler.runNow() : await runFounderSocialWatch();
      json(response, 200, { ok: true, report });
    } catch (error) {
      const status = error instanceof HttpRequestError
        || error instanceof AuthorityAuthenticationError
        || error instanceof FounderBiometricError
        ? authErrorStatus(error)
        : 409;
      json(response, status, authErrorBody(error));
    }
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/founder/phone-channels') {
    try {
      requireFounderBiometricAuthority(request, 'founder.private.phone_channels.read');
      json(response, 200, { ok: true, registry: founderPhoneChannelSnapshot() });
    } catch (error) {
      const status = error instanceof HttpRequestError
        || error instanceof AuthorityAuthenticationError
        || error instanceof FounderBiometricError
        ? authErrorStatus(error)
        : 409;
      json(response, status, authErrorBody(error));
    }
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/founder/social-sources') {
    try {
      requireFounderBiometricAuthority(request, 'founder.private.social_sources.read');
      json(response, 200, {
        ok: true,
        registry: founderSocialSourceSnapshot(),
      });
    } catch (error) {
      const status = error instanceof HttpRequestError
        || error instanceof AuthorityAuthenticationError
        || error instanceof FounderBiometricError
        ? authErrorStatus(error)
        : 409;
      json(response, status, authErrorBody(error));
    }
    return;
  }

  const founderSocialBindMatch = url.pathname.match(
    /^\/api\/founder\/social-sources\/([^/]+)\/bind$/,
  );
  const founderSocialBindReferenceId = founderSocialBindMatch?.[1];
  if (request.method === 'POST' && founderSocialBindReferenceId) {
    try {
      const { principal } = requireFounderBiometricAuthority(
        request,
        'founder.private.social_sources.bind',
      );
      const body = await readJson(request);
      if (body.confirmAction !== 'bind_founder_social_identity') {
        throw new HttpRequestError(
          409,
          'confirmAction="bind_founder_social_identity" is required',
        );
      }

      const referenceId = decodeURIComponent(founderSocialBindReferenceId);
      const snapshot = founderSocialSourceSnapshot();
      const source = snapshot.sources.find((item) => item.referenceId === referenceId);
      if (!source) throw new HttpRequestError(404, 'Founder social source not found');

      const binding = validateFounderSocialIdentityBinding({
        referenceId,
        platform: source.platform,
        sourceUrl: source.sourceUrl,
        canonicalTargetUrl: typeof body.canonicalTargetUrl === 'string'
          ? body.canonicalTargetUrl
          : undefined,
        graphEntityId: typeof body.graphEntityId === 'string'
          ? body.graphEntityId
          : undefined,
        evidenceRefs: Array.isArray(body.evidenceRefs) ? body.evidenceRefs as string[] : [],
        verifiedAt: new Date().toISOString(),
        verifiedBy: principal.id,
      });
      const previous = continuitySnapshot().currentBySubject[
        'founder-social-binding:' + referenceId
      ];
      const record = founderSocialIdentityBindingChronologyRecord({
        binding,
        ...(previous ? { previous } : {}),
      });
      store.appendChronologyRecord(record);

      json(response, 201, {
        ok: true,
        binding,
        supersedesId: record.supersedesId ?? null,
        registry: founderSocialSourceSnapshot(),
      });
    } catch (error) {
      const status = error instanceof HttpRequestError
        || error instanceof AuthorityAuthenticationError
        || error instanceof FounderBiometricError
        ? authErrorStatus(error)
        : 400;
      json(response, status, authErrorBody(error));
    }
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/operations') {
    try {
      requireAuthoritySession(request);
      json(response, 200, {
        ok: true,
        products: productOperationsPortfolioSnapshot(),
      });
    } catch (error) {
      const status = error instanceof HttpRequestError || error instanceof AuthorityAuthenticationError
        ? authErrorStatus(error)
        : 409;
      json(response, status, authErrorBody(error));
    }
    return;
  }

  const productOperationsMatch = url.pathname.match(/^\/api\/operations\/products\/([^/]+)$/);
  const productOperationsId = productOperationsMatch?.[1];
  if (request.method === 'GET' && productOperationsId) {
    try {
      requireAuthoritySession(request);
      json(response, 200, {
        ok: true,
        snapshot: productOperationsSnapshot(decodeURIComponent(productOperationsId)),
      });
    } catch (error) {
      const status = error instanceof HttpRequestError || error instanceof AuthorityAuthenticationError
        ? authErrorStatus(error)
        : 409;
      json(response, status, authErrorBody(error));
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/operations/products') {
    try {
      requireFounderAuthority(request);
      const body = await readJson(request);
      const product = createProductOperationalRecord(body as unknown as ProductOperationalRecord);
      store.upsertProductOperationalRecord(product);
      json(response, 201, { ok: true, product });
    } catch (error) {
      const status = error instanceof HttpRequestError || error instanceof AuthorityAuthenticationError
        ? authErrorStatus(error)
        : 400;
      json(response, status, authErrorBody(error));
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/operations/ledger') {
    try {
      requireFounderAuthority(request);
      const body = await readJson(request);
      const entry = createProductLedgerEntry(body as unknown as ProductLedgerEntry);
      if (!store.getProductOperationalRecord(entry.productId)) {
        throw new HttpRequestError(404, 'product operations record not found');
      }
      store.appendProductLedgerEntry(entry);
      json(response, 201, { ok: true, entry });
    } catch (error) {
      const status = error instanceof HttpRequestError || error instanceof AuthorityAuthenticationError
        ? authErrorStatus(error)
        : 400;
      json(response, status, authErrorBody(error));
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/operations/health') {
    try {
      requireFounderAuthority(request);
      const body = await readJson(request);
      const snapshot = createProductHealthSnapshot(body as unknown as ProductHealthSnapshot);
      if (!store.getProductOperationalRecord(snapshot.productId)) {
        throw new HttpRequestError(404, 'product operations record not found');
      }
      store.appendProductHealthSnapshot(snapshot);
      json(response, 201, { ok: true, snapshot });
    } catch (error) {
      const status = error instanceof HttpRequestError || error instanceof AuthorityAuthenticationError
        ? authErrorStatus(error)
        : 400;
      json(response, status, authErrorBody(error));
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/operations/social') {
    try {
      requireFounderAuthority(request);
      const body = await readJson(request);
      const snapshot = createSocialChannelSnapshot(body as unknown as SocialChannelSnapshot);
      if (snapshot.productId && !store.getProductOperationalRecord(snapshot.productId)) {
        throw new HttpRequestError(404, 'product operations record not found');
      }
      store.upsertSocialChannelSnapshot(snapshot);
      json(response, 201, { ok: true, snapshot });
    } catch (error) {
      const status = error instanceof HttpRequestError || error instanceof AuthorityAuthenticationError
        ? authErrorStatus(error)
        : 400;
      json(response, status, authErrorBody(error));
    }
    return;
  }

  if (
    request.method === 'POST'
    && url.pathname === '/api/operations/monetization-requirements'
  ) {
    try {
      requireFounderAuthority(request);
      const body = await readJson(request);
      const snapshot = createMonetizationRequirementSnapshot(
        body as unknown as MonetizationRequirementSnapshot,
      );
      store.upsertMonetizationRequirementSnapshot(snapshot);
      json(response, 201, { ok: true, snapshot });
    } catch (error) {
      const status = error instanceof HttpRequestError || error instanceof AuthorityAuthenticationError
        ? authErrorStatus(error)
        : 400;
      json(response, status, authErrorBody(error));
    }
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/assistant-control') {
    try {
      requireAuthoritySession(request);
      const snapshot = assistantControlSnapshot();
      json(response, 200, { ok: true, ...snapshot });
    } catch (error) {
      json(response, authErrorStatus(error), authErrorBody(error));
    }
    return;
  }

  const assistantSurfaceConfigMatch = url.pathname.match(
    /^\/api\/assistant-control\/surfaces\/([^/]+)\/config$/,
  );
  const assistantSurfaceConfigId = assistantSurfaceConfigMatch?.[1];
  if (request.method === 'GET' && assistantSurfaceConfigId) {
    try {
      requireAuthoritySession(request);
      const surface = store.getAssistantSurface(
        decodeURIComponent(assistantSurfaceConfigId),
      );
      if (!surface) throw new HttpRequestError(404, 'assistant surface not found');
      const resolved = resolveAssistantSurfaceConfig({
        surface,
        profiles: store.listAssistantProfileRevisions(surface.profileId),
      });
      json(response, 200, { ok: true, config: resolved });
    } catch (error) {
      const status = error instanceof AuthorityAuthenticationError || error instanceof HttpRequestError
        ? authErrorStatus(error)
        : 409;
      json(response, status, authErrorBody(error));
    }
    return;
  }

  const assistantProfileRevisionMatch = url.pathname.match(
    /^\/api\/assistant-control\/profiles\/([^/]+)\/revisions$/,
  );
  const assistantProfileRevisionId = assistantProfileRevisionMatch?.[1];
  if (request.method === 'POST' && assistantProfileRevisionId) {
    try {
      const { principal } = requireFounderAuthority(request);
      const profileId = decodeURIComponent(assistantProfileRevisionId);
      const current = store.getAssistantProfileRevision(profileId);
      if (!current) throw new HttpRequestError(404, 'assistant profile not found');
      const body = await readJson(request);
      const next = createAssistantProfileRevision({
        profileId,
        revision: current.revision + 1,
        status: 'current',
        name: typeof body.name === 'string' && body.name.trim()
          ? body.name.trim()
          : current.name,
        objective: typeof body.objective === 'string' && body.objective.trim()
          ? body.objective.trim()
          : current.objective,
        sharedInstructions: Array.isArray(body.sharedInstructions)
          ? coordinationStringList(body.sharedInstructions)
          : current.sharedInstructions,
        guardrails: Array.isArray(body.guardrails)
          ? coordinationStringList(body.guardrails)
          : current.guardrails,
        capabilities: Array.isArray(body.capabilities)
          ? coordinationStringList(body.capabilities)
          : current.capabilities,
        moduleRefs: Array.isArray(body.moduleRefs)
          ? assistantModuleRefs(body.moduleRefs)
          : current.moduleRefs,
        createdAt: new Date().toISOString(),
        createdBy: principal.id,
        supersedesRevision: current.revision,
      });
      assertAssistantProfileRevisionAppendOnly({ previous: current, next });
      validateAssistantModules(next);
      store.upsertAssistantProfileRevision({ ...current, status: 'historical' });
      store.upsertAssistantProfileRevision(next);

      const affectedSurfaces = store.listAssistantSurfaces()
        .filter((surface) => (
          surface.profileId === profileId
          && surface.tracking === 'current'
        ))
        .map((surface) => resolveAssistantSurfaceConfig({
          surface,
          profiles: store.listAssistantProfileRevisions(profileId),
        }));

      appendGovernanceDecision({
        subject: 'assistant-control:' + profileId,
        content:
          'Assistant profile advanced from revision '
          + current.revision
          + ' to '
          + next.revision
          + '; current-tracking surfaces inherit automatically.',
        principalId: principal.id,
        metadata: {
          profileId,
          fromRevision: current.revision,
          toRevision: next.revision,
          affectedSurfaceIds: affectedSurfaces.map((item) => item.surface.id),
        },
      });
      json(response, 201, {
        ok: true,
        profile: next,
        affectedSurfaces,
      });
    } catch (error) {
      const status = error instanceof AuthorityAuthenticationError || error instanceof HttpRequestError
        ? authErrorStatus(error)
        : 409;
      json(response, status, authErrorBody(error));
    }
    return;
  }

  const assistantSurfaceUpdateMatch = url.pathname.match(
    /^\/api\/assistant-control\/surfaces\/([^/]+)$/,
  );
  const assistantSurfaceUpdateId = assistantSurfaceUpdateMatch?.[1];
  if (request.method === 'POST' && assistantSurfaceUpdateId) {
    try {
      const { principal } = requireFounderAuthority(request);
      const id = decodeURIComponent(assistantSurfaceUpdateId);
      const current = store.getAssistantSurface(id);
      if (!current) throw new HttpRequestError(404, 'assistant surface not found');
      const body = await readJson(request);
      const tracking = body.tracking === 'pinned'
        ? 'pinned'
        : body.tracking === 'current'
          ? 'current'
          : current.tracking;
      const pinnedRevisionRaw = Number(body.pinnedRevision);
      const pinnedRevision = tracking === 'pinned'
        ? Number.isInteger(pinnedRevisionRaw) && pinnedRevisionRaw > 0
          ? pinnedRevisionRaw
          : current.tracking === 'pinned'
            ? current.pinnedRevision
            : undefined
        : undefined;
      if (tracking === 'pinned' && !pinnedRevision) {
        throw new HttpRequestError(400, 'pinnedRevision is required for pinned tracking');
      }
      if (
        tracking === 'pinned'
        && !store.getAssistantProfileRevision(current.profileId, pinnedRevision)
      ) {
        throw new HttpRequestError(404, 'pinned assistant profile revision not found');
      }

      const presentationInput = body.presentation
        && typeof body.presentation === 'object'
        && !Array.isArray(body.presentation)
        ? body.presentation as Record<string, unknown>
        : {};
      const surface = createAssistantSurface({
        id: current.id,
        name: typeof body.name === 'string' && body.name.trim()
          ? body.name.trim()
          : current.name,
        product: current.product,
        profileId: current.profileId,
        status: body.status === 'paused'
          ? 'paused'
          : body.status === 'active'
            ? 'active'
            : current.status,
        tracking,
        ...(pinnedRevision ? { pinnedRevision } : {}),
        presentation: {
          ...current.presentation,
          ...(typeof presentationInput.brandName === 'string'
            ? { brandName: presentationInput.brandName }
            : {}),
          ...(typeof presentationInput.defaultLanguage === 'string'
            ? { defaultLanguage: presentationInput.defaultLanguage }
            : {}),
          ...(typeof presentationInput.greeting === 'string'
            ? { greeting: presentationInput.greeting }
            : {}),
          ...(typeof presentationInput.disclosure === 'string'
            ? { disclosure: presentationInput.disclosure }
            : {}),
          ...(typeof presentationInput.accentTokenRef === 'string'
            ? { accentTokenRef: presentationInput.accentTokenRef }
            : {}),
        },
        disabledCapabilities: Array.isArray(body.disabledCapabilities)
          ? coordinationStringList(body.disabledCapabilities)
          : current.disabledCapabilities,
        deliveryTargets: current.deliveryTargets,
        createdAt: current.createdAt,
        updatedAt: new Date().toISOString(),
        createdBy: current.createdBy,
      });
      store.upsertAssistantSurface(surface);
      const resolved = resolveAssistantSurfaceConfig({
        surface,
        profiles: store.listAssistantProfileRevisions(surface.profileId),
      });

      appendGovernanceDecision({
        subject: 'assistant-surface:' + surface.id,
        content:
          'Assistant surface configuration updated; shared behavior remains inherited from profile '
          + surface.profileId
          + '.',
        principalId: principal.id,
        metadata: {
          surfaceId: surface.id,
          tracking: surface.tracking,
          inheritedRevision: resolved.inheritedRevision,
        },
      });
      json(response, 200, { ok: true, surface, resolved });
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

  // Reusable staff dashboard data contract: authenticated, permission-scoped and text-only.
  // The existing Founder dashboard and Kendra's private experience remain untouched.
  if (request.method === 'GET' && url.pathname === '/api/dashboard/work') {
    try {
      const { principal } = requireAuthoritySession(request);
      json(response, 200, { ok: true, dashboard: workDashboardFor(principal) });
    } catch (error) {
      json(response, authErrorStatus(error), authErrorBody(error));
    }
    return;
  }

  // El idioma de presentación es configuración propia de cada persona (no es un permiso).
  if (request.method === 'PUT' && url.pathname === '/api/dashboard/work/locale') {
    try {
      const { principal } = requireAuthoritySession(request);
      const profile = requireActiveOperatorProfile(principal);
      const body = await readJson(request);
      if (body.locale !== 'es' && body.locale !== 'nl' && body.locale !== 'en') {
        throw new HttpRequestError(400, 'locale must be es, nl or en');
      }
      store.upsertCoordinationOperator({ ...profile, locale: body.locale, updatedAt: new Date().toISOString() });
      json(response, 200, { ok: true, locale: body.locale });
    } catch (error) {
      json(response, authErrorStatus(error), authErrorBody(error));
    }
    return;
  }

  // Identidad laboral, funciones e instrucciones individuales: solo las fija el Founder.
  const workProfileMatch = url.pathname.match(/^\/api\/coordination\/operators\/([^/]+)\/profile$/);
  if (request.method === 'PUT' && workProfileMatch) {
    try {
      const { principal } = requireFounderAuthority(request);
      const operatorId = decodeURIComponent(workProfileMatch[1]!);
      const profile = store.getCoordinationOperator(operatorId);
      if (!profile) throw new HttpRequestError(404, 'operator profile not found');
      let patch: ReturnType<typeof sanitizeWorkProfilePatch>;
      try { patch = sanitizeWorkProfilePatch(await readJson(request)); } catch (error) {
        if (error instanceof HttpRequestError) throw error;
        throw new HttpRequestError(400, error instanceof Error ? error.message : 'invalid profile');
      }
      const updated = { ...profile, ...patch, updatedAt: new Date().toISOString() };
      store.upsertCoordinationOperator(updated);
      json(response, 200, { ok: true, profile: updated, updatedBy: principal.id });
    } catch (error) {
      json(response, authErrorStatus(error), authErrorBody(error));
    }
    return;
  }

  // Agente de una tarea (Claude, ChatGPT, Gemini, local…): lo decide el Founder; null lo quita.
  const assignmentProviderMatch = url.pathname.match(/^\/api\/coordination\/assignments\/([^/]+)\/provider$/);
  if (request.method === 'PUT' && assignmentProviderMatch) {
    try {
      requireFounderAuthority(request);
      const assignment = store.getCoordinationAssignment(decodeURIComponent(assignmentProviderMatch[1]!));
      if (!assignment) throw new HttpRequestError(404, 'coordination assignment not found');
      const body = await readJson(request);
      const provider = preferredProviderFrom(body.preferredProvider);
      if (provider === null) throw new HttpRequestError(400, 'preferredProvider is invalid');
      const { preferredProvider: _previous, ...rest } = assignment;
      const updated = { ...rest, ...(provider ? { preferredProvider: provider } : {}), updatedAt: new Date().toISOString() };
      store.upsertCoordinationAssignment(updated);
      json(response, 200, {
        ok: true,
        assignment: updated,
        // Verdad operativa: una preferencia sin proveedor configurado no hace nada hasta que exista su credencial.
        configured: provider ? resolveModelProviders(process.env).some((item) => item.id === provider) : null,
      });
    } catch (error) {
      json(response, authErrorStatus(error), authErrorBody(error));
    }
    return;
  }

  // Registro de sesiones de trabajo: eventos declarados por la persona (sin vigilancia del equipo).
  if (request.method === 'GET' && url.pathname === '/api/work/sessions') {
    try {
      const { principal } = requireAuthoritySession(request);
      const now = new Date().toISOString();
      if (principal.role === 'founder_director') {
        const filter = url.searchParams.get('principalId')?.trim();
        const events = store.listWorkSessionEvents(filter || undefined);
        const ids = [...new Set(events.map((event) => event.principalId))];
        json(response, 200, {
          ok: true,
          selfReported: true,
          sessions: ids.flatMap((id) => summarizeWorkSessions(events, id, now)),
        });
      } else {
        requireActiveOperatorProfile(principal);
        json(response, 200, {
          ok: true,
          selfReported: true,
          sessions: summarizeWorkSessions(store.listWorkSessionEvents(principal.id), principal.id, now),
        });
      }
    } catch (error) {
      json(response, authErrorStatus(error), authErrorBody(error));
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/work/sessions/events') {
    try {
      const { principal } = requireAuthoritySession(request);
      requireActiveOperatorProfile(principal);
      const body = await readJson(request);
      const kind = typeof body.kind === 'string' ? body.kind as WorkSessionEventKind : undefined;
      if (!kind || !WORK_SESSION_EVENT_KINDS.includes(kind)) throw new HttpRequestError(400, 'kind is invalid');
      const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
      const assignmentId = typeof body.assignmentId === 'string' ? body.assignmentId.trim() : '';
      if (projectId) {
        const project = store.getProjectWorkspace(projectId);
        if (!project) throw new HttpRequestError(404, 'project not found');
        requireProjectAccess(principal, project, 'read_context');
      }
      if (assignmentId) {
        const assignment = store.getCoordinationAssignment(assignmentId);
        if (!assignment || assignment.assigneePrincipalId !== principal.id) {
          throw new HttpRequestError(403, 'assignment is not yours');
        }
      }
      let event;
      try {
        event = nextWorkSessionEvent({
          events: store.listWorkSessionEvents(principal.id),
          principalId: principal.id,
          kind,
          // La hora la pone el servidor: el cliente no puede antedatar su registro.
          at: new Date().toISOString(),
          ...(typeof body.note === 'string' ? { note: body.note } : {}),
          ...(projectId ? { projectId } : {}),
          ...(assignmentId ? { assignmentId } : {}),
          ...(Array.isArray(body.evidenceRefs) ? { evidenceRefs: coordinationStringList(body.evidenceRefs) } : {}),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'invalid work session event';
        throw new HttpRequestError(/^work_session_(already_open|not_open|not_running|not_paused|time_regression)$/.test(message) ? 409 : 400, message);
      }
      store.appendWorkSessionEvent(event);
      const sessions = summarizeWorkSessions(store.listWorkSessionEvents(principal.id), principal.id, event.at);
      json(response, 201, {
        ok: true,
        event,
        session: sessions.find((session) => session.sessionId === event.sessionId) ?? null,
      });
    } catch (error) {
      json(response, authErrorStatus(error), authErrorBody(error));
    }
    return;
  }

  // Archivos de proyecto. Decisión del CEO (10-nov-2026): los colaboradores NO descargan; abren el archivo
  // dentro del panel (/view) y cada apertura queda registrada. La descarga es exclusiva del CEO.
  // Se entra siempre por el recurso del proyecto: nadie alcanza archivos de un proyecto ajeno.
  const workFileMatch = url.pathname.match(/^\/api\/work\/files\/([^/]+)(\/view)?$/);
  if (request.method === 'GET' && workFileMatch) {
    try {
      const { principal } = requireAuthoritySession(request);
      const viewing = Boolean(workFileMatch[2]);
      if (principal.role === 'operator') {
        requireActiveOperatorProfile(principal);
        if (!viewing) throw new HttpRequestError(403, 'download is reserved to the CEO');
      }
      const resourceId = decodeURIComponent(workFileMatch[1]!);
      const found = store.listProjectWorkspaces()
        .filter((project) => canAccessProject(principal, project, 'read_context'))
        .flatMap((project) => store.listProjectResources(project.id))
        .find((resource) => resource.id === resourceId);
      // Misma respuesta si no existe o si pertenece a un proyecto ajeno: no se revela su existencia.
      if (!found || found.source !== 'upload') throw new HttpRequestError(404, 'file not found');
      const attachment = attachmentStore.get(found.sourceRef, found.addedBy);
      const bytes = attachment ? attachmentStore.readBytes(attachment) : undefined;
      if (!attachment || !bytes) throw new HttpRequestError(404, 'file not found');
      if (viewing && !WORK_VIEWABLE_MIME.includes(attachment.type)) {
        json(response, 415, { ok: false, code: 'preview_unavailable', error: 'Este tipo de archivo no se puede mostrar en el panel.' });
        return;
      }
      if (viewing && principal.role === 'operator') {
        store.appendFileAccess({
          id: `fa_${randomUUID()}`, principalId: principal.id, resourceId: found.id, projectId: found.projectId,
          name: attachment.name, action: 'view', at: new Date().toISOString(),
        });
      }
      response.writeHead(200, {
        'content-type': attachment.type || 'application/octet-stream',
        'content-length': String(bytes.byteLength),
        'content-disposition': `${viewing ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(attachment.name)}`,
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'none'; sandbox",
      });
      response.end(bytes);
    } catch (error) {
      json(response, authErrorStatus(error), authErrorBody(error));
    }
    return;
  }

  // «Solo modelo propio» por proyecto: lo decide el Founder. null lo quita.
  const projectPolicyMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/model-policy$/);
  if (request.method === 'PUT' && projectPolicyMatch) {
    try {
      requireFounderAuthority(request);
      const project = store.getProjectWorkspace(decodeURIComponent(projectPolicyMatch[1]!));
      if (!project) throw new HttpRequestError(404, 'project not found');
      const body = await readJson(request);
      if (body.modelPolicy !== 'local_only' && body.modelPolicy !== null) throw new HttpRequestError(400, 'modelPolicy must be local_only or null');
      const { modelPolicy: _previous, ...rest } = project;
      const updated = validateProjectWorkspace({ ...rest, ...(body.modelPolicy ? { modelPolicy: 'local_only' as const } : {}), updatedAt: new Date().toISOString() });
      store.upsertProjectWorkspace(updated);
      json(response, 200, { ok: true, project: updated, localModelConfigured: configuredModelProviderIds.includes('custom') });
    } catch (error) {
      json(response, authErrorStatus(error), authErrorBody(error));
    }
    return;
  }

  // Mensajes internos: el colaborador escribe a un destinatario INTERNO; JANUS decide con reglas fijas.
  // Fuera de la lista interna → rechazado automáticamente (queda rastro, no se molesta al CEO).
  if (url.pathname === '/api/work/messages' && (request.method === 'GET' || request.method === 'POST')) {
    try {
      const { principal } = requireAuthoritySession(request);
      if (request.method === 'GET') {
        if (principal.role === 'founder_director') {
          json(response, 200, { ok: true, recipients: internalRecipients, messages: store.listWorkMessages() });
        } else {
          requireActiveOperatorProfile(principal);
          json(response, 200, { ok: true, recipients: internalRecipients, messages: store.listWorkMessages(principal.id), inbox: store.listWorkMessagesTo(principal.id) });
        }
        return;
      }
      requireActiveOperatorProfile(principal);
      const body = await readJson(request);
      const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
      if (projectId) {
        const project = store.getProjectWorkspace(projectId);
        if (!project) throw new HttpRequestError(404, 'project not found');
        requireProjectAccess(principal, project, 'read_context');
      }
      const today = new Date(Date.now() - 24 * 3_600_000).toISOString();
      if (store.listWorkMessages(principal.id, 200).filter((message) => message.createdAt >= today).length >= 30) {
        throw new HttpRequestError(429, 'daily message limit reached');
      }
      let message;
      try {
        message = evaluateWorkMessage({
          id: `msg_${randomUUID()}`,
          fromPrincipalId: principal.id,
          recipient: typeof body.recipient === 'string' ? body.recipient : '',
          subject: typeof body.subject === 'string' ? body.subject : '',
          body: typeof body.body === 'string' ? body.body : '',
          ...(projectId ? { projectId } : {}),
          allowed: internalRecipients,
          now: new Date().toISOString(),
        });
      } catch (error) {
        throw new HttpRequestError(400, error instanceof Error ? error.message : 'invalid message');
      }
      store.upsertWorkMessage(message);
      json(response, message.status === 'delivered' ? 201 : 422, { ok: message.status === 'delivered', message, ...(message.status === 'rejected' ? { code: message.decision, error: 'Solo se puede escribir a destinatarios internos de la empresa.' } : {}) });
    } catch (error) {
      json(response, authErrorStatus(error), authErrorBody(error));
    }
    return;
  }

  const workMessageReadMatch = url.pathname.match(/^\/api\/work\/messages\/([^/]+)\/read$/);
  if (request.method === 'PUT' && workMessageReadMatch) {
    try {
      const { principal } = requireAuthoritySession(request);
      const message = store.getWorkMessage(decodeURIComponent(workMessageReadMatch[1]!));
      // Lee quien lo recibe: el CEO lo que va hacia él; el colaborador solo lo que el CEO le envió a él (404 si no).
      if (principal.role === 'founder_director') {
        if (!message || !isMessageForFounder(message)) throw new HttpRequestError(404, 'message not found');
      } else {
        requireActiveOperatorProfile(principal);
        if (!message || message.toPrincipalId !== principal.id) throw new HttpRequestError(404, 'message not found');
      }
      const updated = { ...message, readAt: message.readAt ?? new Date().toISOString() };
      store.upsertWorkMessage(updated);
      json(response, 200, { ok: true, message: updated });
    } catch (error) {
      json(response, authErrorStatus(error), authErrorBody(error));
    }
    return;
  }

  // Vista de equipo del CEO: un solo resumen con lo de EMPRESA de todo el equipo. Nunca incluye agenda privada.
  // ── Opportunity Radar (solo CEO) ─────────────────────────────────────────────────────────────────────────
  if (url.pathname === '/api/radar' && request.method === 'GET') {
    try { requireFounderAuthority(request); json(response, 200, radarPayload()); }
    catch (error) { json(response, authErrorStatus(error), authErrorBody(error)); }
    return;
  }
  if (url.pathname === '/api/radar/opportunities' && request.method === 'POST') {
    try {
      requireFounderAuthority(request);
      const body = await readJson(request);
      const now = new Date().toISOString();
      let incoming;
      try { incoming = createOpportunity({ ...(body as Record<string, unknown>), detectedBy: body.detectedBy === 'agent' ? 'agent' : 'owner' } as never, { id: `opp_${randomUUID()}`, now }); }
      catch (error) { throw new HttpRequestError(400, error instanceof Error ? error.message : 'invalid opportunity'); }
      const existing = store.listRadarOpportunities().find((item) => item.fingerprint === incoming.fingerprint);
      if (existing) {
        const merged = mergeOpportunity(existing, incoming, now);
        store.upsertRadarOpportunity(merged.opportunity);
        json(response, 200, { ok: true, duplicate: true, changed: merged.changed, opportunity: merged.opportunity });
      } else {
        store.upsertRadarOpportunity(incoming);
        void sweepOpportunityAlerts();
        json(response, 201, { ok: true, duplicate: false, opportunity: incoming, late: lateDetection(incoming) });
      }
    } catch (error) { json(response, authErrorStatus(error), authErrorBody(error)); }
    return;
  }
  const radarOpportunityMatch = url.pathname.match(/^\/api\/radar\/opportunities\/([^/]+)\/(stage|verify)$/);
  if (radarOpportunityMatch && request.method === 'PUT') {
    try {
      requireFounderAuthority(request);
      const current = store.getRadarOpportunity(decodeURIComponent(radarOpportunityMatch[1]!));
      if (!current) throw new HttpRequestError(404, 'opportunity not found');
      const body = await readJson(request);
      const now = new Date().toISOString();
      let next;
      try {
        next = radarOpportunityMatch[2] === 'verify'
          ? verifyOpportunity(current, typeof body.sourceUrl === 'string' ? body.sourceUrl : current.sourceUrl ?? '', now)
          : advanceStage(current, (OPPORTUNITY_STAGES.includes(body.stage as OpportunityStage) ? body.stage : '') as OpportunityStage, now, typeof body.note === 'string' ? body.note : undefined);
      } catch (error) { throw new HttpRequestError(400, error instanceof Error ? error.message : 'invalid change'); }
      store.upsertRadarOpportunity(next);
      json(response, 200, { ok: true, opportunity: next });
    } catch (error) { json(response, authErrorStatus(error), authErrorBody(error)); }
    return;
  }
  if (url.pathname === '/api/radar/quotas' && request.method === 'POST') {
    try {
      requireFounderAuthority(request);
      const body = await readJson(request);
      let quota;
      try { quota = validateQuotaWindow({ ...(body as Record<string, unknown>), id: typeof body.id === 'string' && /^[A-Za-z0-9_.-]{1,80}$/.test(body.id) ? body.id : `quota_${randomUUID()}` } as never, new Date().toISOString()); }
      catch (error) { throw new HttpRequestError(400, error instanceof Error ? error.message : 'invalid quota'); }
      store.upsertRadarQuotaWindow(quota);
      json(response, 200, { ok: true, quota });
    } catch (error) { json(response, authErrorStatus(error), authErrorBody(error)); }
    return;
  }
  const radarQuotaMatch = url.pathname.match(/^\/api\/radar\/quotas\/([^/]+)$/);
  if (radarQuotaMatch && request.method === 'DELETE') {
    try {
      requireFounderAuthority(request);
      if (!store.deleteRadarQuotaWindow(decodeURIComponent(radarQuotaMatch[1]!))) throw new HttpRequestError(404, 'quota not found');
      json(response, 200, { ok: true });
    } catch (error) { json(response, authErrorStatus(error), authErrorBody(error)); }
    return;
  }
  // Leer ahora las fuentes oficiales (solo lectura). Devuelve qué fuentes respondieron y cuáles no.
  if (url.pathname === '/api/radar/run' && request.method === 'POST') {
    try {
      requireFounderAuthority(request);
      if (!radarSources.length) throw new HttpRequestError(409, radarSourcesError ?? 'no radar sources configured');
      const report = radarScheduler ? await radarScheduler.runNow() : await runOpportunityRadar();
      json(response, 200, { ok: true, report });
    } catch (error) { json(response, authErrorStatus(error), authErrorBody(error)); }
    return;
  }

  // Señal de presencia: el panel abierto la envía cada 30 s. Solo marca «conectado ahora»; no guarda nada.
  if (request.method === 'POST' && url.pathname === '/api/work/presence') {
    try {
      const { principal } = requireAuthoritySession(request);
      requireActiveOperatorProfile(principal);
      json(response, 200, { ok: true, intervalSeconds: 30 });
    } catch (error) {
      json(response, authErrorStatus(error), authErrorBody(error));
    }
    return;
  }

  // ── El CEO se comunica con su equipo desde «¿Cómo va el equipo?» (todo queda dentro de JANUS) ──────────────
  // Escribir o responder a una persona.
  if (request.method === 'POST' && url.pathname === '/api/work/team/messages') {
    try {
      const { principal } = requireFounderAuthority(request);
      const body = await readJson(request);
      const toPrincipalId = typeof body.toPrincipalId === 'string' ? body.toPrincipalId.trim() : '';
      const member = requireActiveMember(toPrincipalId);
      const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
      const replyToId = typeof body.replyToId === 'string' ? body.replyToId.trim() : '';
      if (replyToId) {
        const original = store.getWorkMessage(replyToId);
        if (!original || original.fromPrincipalId !== toPrincipalId) throw new HttpRequestError(404, 'message to reply not found');
      }
      const resourceIds = coordinationStringList(body.resourceIds);
      let attachments: Array<{ resourceId: string; name: string }> = [];
      if (projectId) {
        const project = store.getProjectWorkspace(projectId);
        if (!project || !canAccessProject(member.principal, project, 'read_context')) throw new HttpRequestError(409, 'collaborator has no access to that project');
        const resources = store.listProjectResources(projectId);
        attachments = resourceIds.map((id) => resources.find((resource) => resource.id === id)).map((resource) => {
          if (!resource) throw new HttpRequestError(404, 'attachment not found in that project');
          return { resourceId: resource.id, name: resource.name };
        });
      } else if (resourceIds.length) throw new HttpRequestError(400, 'attachments need a project');
      let message;
      try {
        message = composeFounderMessage({
          id: `msg_${randomUUID()}`, fromPrincipalId: principal.id, toPrincipalId,
          subject: typeof body.subject === 'string' ? body.subject : '',
          body: typeof body.body === 'string' ? body.body : '',
          ...(projectId ? { projectId } : {}), ...(replyToId ? { replyToId } : {}),
          attachments, now: new Date().toISOString(),
        });
      } catch (error) {
        throw new HttpRequestError(400, error instanceof Error ? error.message : 'invalid message');
      }
      store.upsertWorkMessage(message);
      if (replyToId) { const original = store.getWorkMessage(replyToId); if (original && !original.readAt) store.upsertWorkMessage({ ...original, readAt: message.createdAt }); }
      pushToMember(toPrincipalId, 'Mensaje del CEO', message.subject, message.id);
      json(response, 201, { ok: true, message });
    } catch (error) {
      json(response, authErrorStatus(error), authErrorBody(error));
    }
    return;
  }

  // Dar una tarea con instrucciones a una persona, dentro de un proyecto (le da acceso a ese proyecto si no lo tenía).
  if (request.method === 'POST' && url.pathname === '/api/work/team/tasks') {
    try {
      const { principal } = requireFounderAuthority(request);
      const body = await readJson(request);
      const assigneePrincipalId = typeof body.assigneePrincipalId === 'string' ? body.assigneePrincipalId.trim() : '';
      const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      const goal = typeof body.goal === 'string' ? body.goal.trim() : '';
      if (!assigneePrincipalId || !projectId || !title || !goal) throw new HttpRequestError(400, 'assigneePrincipalId, projectId, title and goal are required');
      if (title.length > 160 || goal.length > 4000) throw new HttpRequestError(400, 'title or goal is too long');
      const member = requireActiveMember(assigneePrincipalId);
      const access = ensureMemberCanWork(principal.id, member.principal, projectId);
      const now = new Date().toISOString();
      const priority = body.priority === 'low' || body.priority === 'high' || body.priority === 'critical' ? body.priority : 'normal';
      const requestedProvider = preferredProviderFrom(body.preferredProvider);
      if (requestedProvider === null) throw new HttpRequestError(400, 'preferredProvider is invalid');
      let assignment;
      try {
        assignment = validateCoordinationAssignment({
          id: `assignment_${randomUUID()}`, title, goal, assigneePrincipalId, scopeIds: [access.scopeId],
          status: 'queued', priority, createdBy: principal.id, createdAt: now, updatedAt: now,
          nextActions: coordinationStringList(body.nextActions),
          ...(requestedProvider ? { preferredProvider: requestedProvider } : {}),
        });
      } catch (error) {
        throw new HttpRequestError(400, error instanceof Error ? error.message : 'invalid task');
      }
      store.upsertCoordinationAssignment(assignment);
      pushToMember(assigneePrincipalId, 'Nueva tarea del CEO', title, assignment.id);
      json(response, 201, { ok: true, assignment, projectId: access.project.id, accessGranted: access.grantedNow });
    } catch (error) {
      json(response, authErrorStatus(error), authErrorBody(error));
    }
    return;
  }

  // Subir un archivo o foto del CEO a un proyecto (después se adjunta a un mensaje o queda en los documentos del proyecto).
  if (request.method === 'POST' && url.pathname === '/api/work/team/attachments') {
    try {
      const { principal } = requireFounderAuthority(request);
      const uploadProjectId = headerValue(request, 'x-attachment-project-id').trim();
      const project = uploadProjectId ? store.getProjectWorkspace(uploadProjectId) : null;
      if (!project || project.status !== 'active') throw new HttpRequestError(404, 'project not found');
      const profile = ATTACHMENT_PROFILES['business-dashboard'];
      const source = (headerValue(request, 'x-attachment-source') || 'device-file') as AttachmentSource;
      if (!profile.sources.includes(source)) throw new HttpRequestError(400, 'Fuente de adjunto no válida.');
      let claimedName = '';
      try { claimedName = decodeURIComponent(headerValue(request, 'x-attachment-name')); } catch { claimedName = ''; }
      const bytes = await readBodyBytes(request, profile.maxFileBytes);
      const result = attachmentStore.put({ bytes, claimedName, claimedType: headerValue(request, 'content-type'), source, profile: 'business-dashboard', principalId: principal.id });
      if (!result.ok) { json(response, result.status, { ok: false, code: result.code, error: result.message }); return; }
      const { attachment } = result;
      const resource = validateProjectResource({
        id: `resource_${randomUUID()}`, projectId: project.id, name: attachment.name, source: 'upload', sourceRef: attachment.id,
        createdAt: new Date().toISOString(), addedBy: principal.id, mimeType: attachment.type, checksum: attachment.sha256,
      });
      store.upsertProjectResource(resource);
      json(response, 201, { ok: true, projectResourceId: resource.id, name: attachment.name, type: attachment.type, size: attachment.size });
    } catch (error) {
      json(response, authErrorStatus(error), authErrorBody(error));
    }
    return;
  }

  // Lucecitas del CEO («Mi equipo»): ligero, solo nombres, estado y dos contadores de atención. Solo Founder.
  if (request.method === 'GET' && url.pathname === '/api/work/team/presence') {
    try {
      requireFounderAuthority(request);
      const now = new Date().toISOString();
      json(response, 200, {
        ok: true,
        generatedAt: now,
        members: teamPresenceFor(now),
        attention: {
          blocked: store.listCoordinationAssignments().filter((assignment) => assignment.status === 'blocked').length,
          unread: store.listWorkMessages(undefined, 200).filter((message) => isMessageForFounder(message) && message.status === 'delivered' && !message.readAt).length,
        },
      });
    } catch (error) {
      json(response, authErrorStatus(error), authErrorBody(error));
    }
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/work/team') {
    try {
      requireFounderAuthority(request);
      const now = new Date().toISOString();
      const handoffs = store.listCoordinationHandoffs();
      const sessionEvents = store.listWorkSessionEvents();
      const projects = store.listProjectWorkspaces();
      json(response, 200, {
        ok: true,
        generatedAt: now,
        members: store.listCoordinationOperators().map((profile) => {
          const sessions = summarizeWorkSessions(sessionEvents, profile.principalId, now);
          const usage = operatorUsageFor(profile.principalId);
          return {
            principalId: profile.principalId,
            displayName: profile.displayName ?? profile.principalId,
            roleTitle: profile.roleTitle ?? null,
            locale: profile.locale ?? 'es',
            status: profile.status,
            projects: memberProjects(profile.principalId, projects),
            presence: resolveWorkPresence({
              session: sessions.filter((session) => session.state !== 'ended').at(-1) ?? null,
              lastSeenMs: workPresence.lastSeen(profile.principalId),
              nowMs: Date.parse(now),
            }).state,
            openSession: sessions.filter((session) => session.state !== 'ended').at(-1) ?? null,
            todayActiveSeconds: sessions.filter((session) => session.startedAt.slice(0, 10) === now.slice(0, 10)).reduce((total, session) => total + session.activeSeconds, 0),
            usage: { used: usage.used, limit: usage.limit },
          };
        }),
        assignments: store.listCoordinationAssignments().map((assignment) => ({
          assignment,
          latestHandoff: handoffs.filter((handoff) => handoff.assignmentId === assignment.id).at(-1) ?? null,
        })),
        deliveries: [...handoffs].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 40),
        agenda: agendaForFounder(store.listWorkAgendaItems()).filter((item) => item.date >= now.slice(0, 10)).slice(0, 80),
        fileAccess: store.listFileAccess(60),
        invites: store.listOperatorInvites(20).map((invite) => publicOperatorInvite(invite, new Date(now))),
        messages: store.listWorkMessages(undefined, 120),
        recipients: internalRecipients,
        projects: projects.map((project) => ({
          id: project.id, name: project.name, status: project.status, createdBy: project.createdBy,
          localOnly: project.modelPolicy === 'local_only',
        })),
        providers: { configured: configuredModelProviderIds, dailyLimit: operatorDailyRunLimit },
      });
    } catch (error) {
      json(response, authErrorStatus(error), authErrorBody(error));
    }
    return;
  }

  // Registro de aperturas de archivos por el equipo: solo el CEO.
  if (request.method === 'GET' && url.pathname === '/api/work/file-access') {
    try {
      requireFounderAuthority(request);
      json(response, 200, { ok: true, entries: store.listFileAccess(Number(url.searchParams.get('limit')) || 200) });
    } catch (error) {
      json(response, authErrorStatus(error), authErrorBody(error));
    }
    return;
  }

  // Avisos al teléfono: clave pública para suscribirse y alta/baja del dispositivo de la propia persona.
  if (request.method === 'GET' && url.pathname === '/api/work/push') {
    try {
      const { principal } = requireAuthoritySession(request);
      requireActiveOperatorProfile(principal);
      json(response, 200, { ok: true, enabled: Boolean(pushKeys), publicKey: pushKeys?.publicKey ?? null, devices: store.listPushSubscriptions(principal.id).length });
    } catch (error) {
      json(response, authErrorStatus(error), authErrorBody(error));
    }
    return;
  }
  if (url.pathname === '/api/work/push/subscription' && (request.method === 'POST' || request.method === 'DELETE')) {
    try {
      const { principal } = requireAuthoritySession(request);
      requireActiveOperatorProfile(principal);
      const body = await readJson(request);
      if (request.method === 'DELETE') {
        if (typeof body.endpoint === 'string') store.deletePushSubscription(body.endpoint, principal.id);
        json(response, 200, { ok: true });
        return;
      }
      if (!pushKeys) throw new HttpRequestError(409, 'push is not activated');
      let subscription;
      try { subscription = validatePushSubscription(body); } catch (error) {
        throw new HttpRequestError(400, error instanceof Error ? error.message : 'invalid subscription');
      }
      if (store.listPushSubscriptions(principal.id).length >= 8) throw new HttpRequestError(409, 'too many devices');
      store.upsertPushSubscription({ ...subscription, principalId: principal.id, createdAt: new Date().toISOString() });
      json(response, 201, { ok: true, devices: store.listPushSubscriptions(principal.id).length });
    } catch (error) {
      json(response, authErrorStatus(error), authErrorBody(error));
    }
    return;
  }

  // Agenda del colaborador. Lo 'private' solo lo ve su dueño; el CEO recibe únicamente lo 'work'.
  if (request.method === 'GET' && url.pathname === '/api/work/agenda') {
    try {
      const { principal } = requireAuthoritySession(request);
      if (principal.role === 'founder_director') {
        const filter = url.searchParams.get('principalId')?.trim() || undefined;
        json(response, 200, { ok: true, scope: 'work-only', items: agendaForFounder(store.listWorkAgendaItems(filter), filter) });
      } else {
        requireActiveOperatorProfile(principal);
        json(response, 200, { ok: true, scope: 'own', items: agendaForOwner(store.listWorkAgendaItems(principal.id).map(agendaOpen), principal.id) });
      }
    } catch (error) {
      json(response, authErrorStatus(error), authErrorBody(error));
    }
    return;
  }

  const agendaItemMatch = url.pathname.match(/^\/api\/work\/agenda\/([^/]+)$/);
  if ((request.method === 'POST' && url.pathname === '/api/work/agenda')
    || ((request.method === 'PUT' || request.method === 'DELETE') && agendaItemMatch)) {
    try {
      const { principal } = requireAuthoritySession(request);
      requireActiveOperatorProfile(principal);
      const storedItem = agendaItemMatch ? store.getWorkAgendaItem(decodeURIComponent(agendaItemMatch[1]!)) : null;
      const existing = storedItem && storedItem.principalId === principal.id ? agendaOpen(storedItem) : storedItem;
      // Un elemento ajeno se trata como inexistente: ni se lee, ni se cambia, ni se confirma que existe.
      if (agendaItemMatch && (!existing || existing.principalId !== principal.id)) throw new HttpRequestError(404, 'agenda item not found');
      if (request.method === 'DELETE') {
        store.deleteWorkAgendaItem(existing!.id, principal.id);
        json(response, 200, { ok: true, deleted: existing!.id });
        return;
      }
      const body = await readJson(request);
      const now = new Date().toISOString();
      const text = (key: string) => (typeof body[key] === 'string' ? (body[key] as string).trim() : undefined);
      const projectId = body.projectId === null ? '' : text('projectId') ?? existing?.projectId ?? '';
      if (projectId) {
        const project = store.getProjectWorkspace(projectId);
        if (!project) throw new HttpRequestError(404, 'project not found');
        requireProjectAccess(principal, project, 'read_context');
      }
      if (!existing && store.listWorkAgendaItems(principal.id).length >= WORK_AGENDA_MAX_ITEMS) {
        throw new HttpRequestError(409, 'agenda is full');
      }
      const time = body.time === null ? '' : text('time') ?? existing?.time ?? '';
      const endTime = body.endTime === null ? '' : text('endTime') ?? existing?.endTime ?? '';
      let item: WorkAgendaItem;
      try {
        item = validateWorkAgendaItem({
          id: existing?.id ?? `ag_${randomUUID()}`,
          principalId: principal.id,
          kind: (text('kind') ?? existing?.kind ?? 'reminder') as WorkAgendaItem['kind'],
          visibility: (text('visibility') ?? existing?.visibility ?? 'private') as WorkAgendaItem['visibility'],
          date: text('date') ?? existing?.date ?? '',
          ...(time ? { time } : {}),
          ...(endTime ? { endTime } : {}),
          text: text('text') ?? existing?.text ?? '',
          ...(projectId ? { projectId } : {}),
          ...((text('timeZone') ?? existing?.timeZone) ? { timeZone: text('timeZone') ?? existing?.timeZone } : {}),
          done: typeof body.done === 'boolean' ? body.done : existing?.done ?? false,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        });
      } catch (error) {
        throw new HttpRequestError(400, error instanceof Error ? error.message : 'invalid agenda item');
      }
      store.upsertWorkAgendaItem(agendaSeal(item));
      json(response, existing ? 200 : 201, { ok: true, item });
    } catch (error) {
      json(response, authErrorStatus(error), authErrorBody(error));
    }
    return;
  }

  // Adjuntos de colaboradores: puerta propia (autorizada por el CEO el 10-nov-2026; `off` la apaga).
  // Exige proyecto con permiso de escritura; el archivo queda vinculado a ESE proyecto.
  if (request.method === 'POST' && url.pathname === '/api/work/attachments') {
    try {
      const { principal } = requireAuthoritySession(request);
      requireActiveOperatorProfile(principal);
      if (!workOperatorUploadsEnabled) {
        json(response, 403, { ok: false, code: 'operator_uploads_disabled', error: 'Los adjuntos de colaboradores esperan la autorización del CEO.' });
        return;
      }
      const uploadProjectId = headerValue(request, 'x-attachment-project-id').trim();
      if (!uploadProjectId) throw new HttpRequestError(400, 'project id is required');
      const project = store.getProjectWorkspace(uploadProjectId);
      if (!project) throw new HttpRequestError(404, 'project not found');
      requireProjectAccess(principal, project, 'write_work');
      const source = headerValue(request, 'x-attachment-source') as AttachmentSource;
      const profile = ATTACHMENT_PROFILES['business-dashboard'];
      if (!profile.sources.includes(source)) throw new HttpRequestError(400, 'Fuente de adjunto no válida.');
      let claimedName = '';
      try { claimedName = decodeURIComponent(headerValue(request, 'x-attachment-name')); } catch { claimedName = ''; }
      const bytes = await readBodyBytes(request, profile.maxFileBytes);
      const result = attachmentStore.put({
        bytes, claimedName, claimedType: headerValue(request, 'content-type'),
        source, profile: 'business-dashboard', principalId: principal.id,
      });
      if (!result.ok) {
        json(response, result.status, { ok: false, code: result.code, error: result.message });
        return;
      }
      const { attachment } = result;
      const resource = validateProjectResource({
        id: `resource_${randomUUID()}`,
        projectId: uploadProjectId,
        name: attachment.name,
        source: 'upload',
        sourceRef: attachment.id,
        createdAt: new Date().toISOString(),
        addedBy: principal.id,
        mimeType: attachment.type,
        checksum: attachment.sha256,
      });
      store.upsertProjectResource(resource);
      json(response, 201, {
        ok: true, projectResourceId: resource.id, id: attachment.id,
        sha256: attachment.sha256, name: attachment.name, type: attachment.type, size: attachment.size,
      });
    } catch (error) {
      json(response, authErrorStatus(error), authErrorBody(error));
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
        instructions: principal.role === 'founder_director' && typeof body.instructions === 'string'
          ? body.instructions : undefined,
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

  // Project instructions are editable only by the Founder and persist across threads.
  const projectInstructionsMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/instructions$/);
  if (request.method === 'PUT' && projectInstructionsMatch) {
    try {
      const { principal } = requireFounderAuthority(request);
      const projectId = decodeURIComponent(projectInstructionsMatch[1]!);
      const project = store.getProjectWorkspace(projectId);
      if (!project) throw new HttpRequestError(404, 'project not found');
      const body = await readJson(request);
      if (typeof body.instructions !== 'string' || body.instructions.length > 12000) {
        throw new HttpRequestError(400, 'instructions must be a string of at most 12000 characters');
      }
      const updated = validateProjectWorkspace({
        ...project,
        instructions: body.instructions,
        updatedAt: new Date().toISOString(),
      });
      store.upsertProjectWorkspace(updated);
      json(response, 200, { ok: true, project: updated, updatedBy: principal.id });
    } catch (error) {
      const status = error instanceof HttpRequestError || error instanceof AuthorityAuthenticationError
        ? authErrorStatus(error) : 400;
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
      // Uploads must belong to the requesting principal; a metadata ref is not a file upload.
      if (source === 'upload' && (!isAttachmentId(sourceRef) || !attachmentStore.get(sourceRef, principal.id))) {
        throw new HttpRequestError(403, 'upload resource not owned by authenticated principal');
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

  if (request.method === 'POST' && url.pathname === '/api/identity/face') {
    try {
      requireAuthoritySession(request);
      if (!faceRecognition) throw new HttpRequestError(503, 'Face recognition is not enabled on this runtime');
      const sessionId = (url.searchParams.get('sessionId') ?? '').trim();
      if (!sessionId || sessionId.length > 120) throw new HttpRequestError(400, 'sessionId is required');
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of request) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.byteLength;
        if (size > 4 * 1024 * 1024) throw new HttpRequestError(413, 'Image is too large');
        chunks.push(buffer);
      }
      const hint = await faceRecognition.identify(new Uint8Array(Buffer.concat(chunks)));
      if (hint.decision === 'match') faceHints.set(sessionId, { hint, at: Date.now() });
      else faceHints.delete(sessionId);
      // Only decision, profile and score are returned: never embeddings, never the image.
      json(response, 200, { ok: true, hint, authorizes: false, ttlSeconds: FACE_PRESENCE_TTL_MS / 1000 });
    } catch (error) {
      json(response, authErrorStatus(error), authErrorBody(error));
    }
    return;
  }

  if (await handleKidRoute(request, response, url)) return;

  if (request.method === 'POST' && url.pathname === '/api/attachments') {
    try {
      const { principal } = requireFounderAuthority(request);
      const profileId = headerValue(request, 'x-attachment-profile') || 'founder-admin';
      const uploadProjectId = headerValue(request, 'x-attachment-project-id').trim();
      const uploadThreadId = headerValue(request, 'x-attachment-thread-id').trim();
      if (uploadThreadId && !uploadProjectId) throw new HttpRequestError(400, 'project id required with thread id');
      if (uploadProjectId) {
        const project = store.getProjectWorkspace(uploadProjectId);
        if (!project) throw new HttpRequestError(404, 'project not found');
        requireProjectAccess(principal, project, 'write_work');
        if (uploadThreadId) {
          const thread = store.getProjectThread(uploadThreadId);
          if (!thread || thread.projectId !== uploadProjectId) {
            throw new HttpRequestError(409, 'thread does not belong to project');
          }
        }
      }
      // Este endpoint solo atiende al Founder. Otros perfiles (niña, panel de negocio) tendrán su propia puerta y su propia credencial.
      if (profileId !== 'founder-admin') throw new HttpRequestError(403, 'Perfil de adjuntos no permitido en esta puerta.');
      const source = headerValue(request, 'x-attachment-source') as AttachmentSource;
      if (!ATTACHMENT_PROFILES['founder-admin'].sources.includes(source)) throw new HttpRequestError(400, 'Fuente de adjunto no válida.');
      let claimedName = '';
      try { claimedName = decodeURIComponent(headerValue(request, 'x-attachment-name')); } catch { claimedName = ''; }
      const bytes = await readBodyBytes(request, ATTACHMENT_PROFILES['founder-admin'].maxFileBytes);
      const result = attachmentStore.put({
        bytes,
        claimedName,
        claimedType: headerValue(request, 'content-type'),
        source,
        profile: 'founder-admin',
        principalId: principal.id,
      });
      if (!result.ok) {
        json(response, result.status, { ok: false, code: result.code, error: result.message });
        return;
      }
      const { attachment } = result;
      // A project upload is stored once in the existing secure attachment vault,
      // and linked to the durable project record; no binary is copied to GitHub.
      let projectResourceId: string | undefined;
      if (uploadProjectId) {
        const resource = validateProjectResource({
          id: `resource_${randomUUID()}`,
          projectId: uploadProjectId,
          ...(uploadThreadId ? { threadId: uploadThreadId } : {}),
          name: attachment.name,
          source: 'upload',
          sourceRef: attachment.id,
          createdAt: new Date().toISOString(),
          addedBy: principal.id,
          mimeType: attachment.type,
          checksum: attachment.sha256,
        });
        store.upsertProjectResource(resource);
        projectResourceId = resource.id;
      }
      json(response, 201, {
        ok: true,
        ...(projectResourceId ? { projectResourceId } : {}),
        id: attachment.id,
        sha256: attachment.sha256,
        name: attachment.name,
        type: attachment.type,
        size: attachment.size,
        deduplicated: result.deduplicated,
        ...(attachment.width ? { width: attachment.width, height: attachment.height } : {}),
      });
    } catch (error) {
      json(response, authErrorStatus(error), authErrorBody(error));
    }
    return;
  }

  const attachmentMatch = url.pathname.match(/^\/api\/attachments\/(att_[0-9a-f-]{36})$/);
  if (request.method === 'GET' && attachmentMatch) {
    try {
      const { principal } = requireFounderAuthority(request);
      const id = attachmentMatch[1]!;
      const meta = isAttachmentId(id) ? attachmentStore.get(id, principal.id) : undefined;
      const bytes = meta ? attachmentStore.readBytes(meta) : undefined;
      if (!meta || !bytes) throw new HttpRequestError(404, 'Adjunto no encontrado.');
      response.writeHead(200, {
        'content-type': meta.type,
        'content-length': String(bytes.byteLength),
        'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(meta.name)}`,
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'none'; sandbox",
      });
      response.end(Buffer.from(bytes));
    } catch (error) {
      json(response, authErrorStatus(error), authErrorBody(error));
    }
    return;
  }

  const knowledgeProposalMatch = url.pathname.match(/^\/api\/knowledge\/proposals\/(kp_[A-Za-z0-9_-]{1,100})$/);
  if (knowledgeProposalMatch && (request.method === 'GET' || request.method === 'POST')) {
    try {
      requireFounderAuthority(request);
      const id = knowledgeProposalMatch[1]!;
      const record = store.getBusinessKnowledgeProposal(id);
      if (!record) throw new HttpRequestError(404, 'Propuesta no encontrada');
      if (record.status !== 'pending' || Date.parse(record.expiresAt) <= Date.now()) {
        throw new HttpRequestError(409, 'La propuesta ya no está pendiente o ha caducado; vuelve a pedir el cambio.');
      }
      const proposal = record.payload as KnowledgeProposal;
      const state = knowledgeAdapter.currentState();
      if (state.revision !== proposal.baseRevision) throw new HttpRequestError(409, 'El estado cambió; pide una nueva propuesta antes de aprobar.');
      if (request.method === 'GET') {
        json(response, 200, { ok: true, proposalId: id, baseRevision: proposal.baseRevision,
          expiresAt: proposal.expiresAt, readback: buildReadback(state, proposal.changes),
          biometricAction: 'knowledge.change.apply' });
      } else {
        const body = await readJson(request);
        if (body.confirmProposalId !== id || body.expectedRevision !== proposal.baseRevision) {
          throw new HttpRequestError(409, 'Confirma exactamente la propuesta y la revisión que acabas de leer.');
        }
        const permit = requireFounderBiometricAuthority(request, 'knowledge.change.apply');
        const result = await toolGateway.execute({ tool: 'knowledge', action: 'change.apply',
          input: { proposalKey: record.key, expectedProposalId: id }, idempotencyKey: `knowledge:approved:${id}`,
          authorization: { privileged: true, principalId: permit.principal.id, authorityDecisionHash: permit.authorityDecisionHash },
        }, () => {});
        if (!result.ok) throw new HttpRequestError(409, result.error ?? 'No se pudo aplicar la propuesta');
        appendGovernanceDecision({ subject: 'knowledge-change-approved', principalId: permit.principal.id,
          content: 'Founder approved the exact reviewed knowledge proposal with a fresh biometric proof.',
          metadata: { proposalId: id, baseRevision: proposal.baseRevision, revision: result.output?.revision,
            authorityDecisionHash: permit.authorityDecisionHash } });
        json(response, 200, { ok: true, ...result.output });
      }
    } catch (error) { json(response, authErrorStatus(error), authErrorBody(error)); }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/command') {
    try {
      const body = await readJson(request);
      const typedText = typeof body.text === 'string' ? stripAttachmentMarkers(body.text).trim() : '';
      if (!typedText) {
        json(response, 400, { ok: false, error: 'text is required' });
        return;
      }
      // Adjuntos y códigos escaneados (botón «+»): se describen con datos del SERVIDOR, solo si hay sesión de Founder,
      // y viajan tras un marcador: el planificador decide únicamente con las palabras del usuario.
      let text = typedText;
      const attachmentIds = Array.isArray(body.attachments) ? body.attachments.filter(isAttachmentId).slice(0, ATTACHMENT_PROFILES['founder-admin'].maxFiles) : [];
      const scanInputs = Array.isArray(body.scans) ? body.scans.slice(0, 4) : [];
      if (attachmentIds.length > 0 || scanInputs.length > 0) {
        const { principal } = requireFounderAuthority(request);
        const { refs, missing } = attachmentStore.refsFor(attachmentIds, principal.id);
        if (missing.length > 0) throw new HttpRequestError(400, 'Algún adjunto ya no existe o no es tuyo.');
        const scans = scanInputs
          .filter((item): item is { raw: string; format?: string } => !!item && typeof (item as { raw?: unknown }).raw === 'string')
          .map((item) => classifyScan(item.raw.slice(0, 2000), typeof item.format === 'string' ? item.format : undefined));
        const block = describeAttachmentsForMessage(refs, scans);
        if (block) text = `${typedText}\n\n${block}`;
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
      const commandPrincipal = authorityContext?.principal;
      if (commandPrincipal?.role === 'operator') {
        const usage = operatorUsageFor(commandPrincipal.id);
        if (!usage.allowed) {
          json(response, 429, { ok: false, code: 'operator_daily_limit', error: 'Límite diario de consultas alcanzado.', usage });
          return;
        }
      }
      const runId = startRun(
        text,
        body.inputMode === 'voice' ? 'voice' : 'text',
        sessionId,
        authorityContext,
        coordinationLink,
        projectLink,
        typeof body.effort === 'string' ? body.effort : undefined,
      );
      if (commandPrincipal?.role === 'operator') {
        store.appendOperatorRun({ runId, principalId: commandPrincipal.id, at: new Date().toISOString() });
      }
      const commandInterpretation = runInterpretations.get(runId);
      json(response, 202, {
        ok: true,
        ...(commandInterpretation?.corrections.length ? { interpretation: commandInterpretation } : {}),
        effort: runEfforts.get(runId) ?? null,
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

  if (request.method === 'POST' && url.pathname === '/api/voice/ticket') {
    try {
      const { token } = requireFounderAuthority(request);
      const body = await readJson(request);
      const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
      const ticket = voiceAuthority.ticket(sessionId, token);
      json(response, 200, { ok: true, ticket, expiresInSeconds: 30 });
    } catch (error) { json(response, authErrorStatus(error), authErrorBody(error)); }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/voice/utterance') {
    try {
      const { token } = requireFounderAuthority(request);
      const body = await readJson(request);
      const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
      const text = typeof body.text === 'string' ? body.text.trim() : '';
      if (!sessionId || !text) {
        json(response, 400, { ok: false, error: 'sessionId and text are required' });
        return;
      }

      voiceAuthority.bind(sessionId, token);
      const session = voiceSessions.get(sessionId);
      const result = await session.transcript({
        text,
        final: body.final !== false,
        language: typeof body.language === 'string' ? body.language : undefined,
      });
      json(response, 200, { ok: true, result, session: session.snapshot() });
    } catch (error) {
      json(response, authErrorStatus(error), authErrorBody(error));
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/voice/microphone') {
    try {
      const { token } = requireFounderAuthority(request);
      const body = await readJson(request);
      const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
      const state = body.state === 'connected' ? 'connected' : body.state === 'disconnected' ? 'disconnected' : null;
      if (!sessionId || !state) {
        json(response, 400, { ok: false, error: 'sessionId and valid state are required' });
        return;
      }
      voiceAuthority.bind(sessionId, token);
      const session = voiceSessions.get(sessionId);
      json(response, 200, { ok: true, session: session.microphone(state) });
    } catch (error) { json(response, authErrorStatus(error), authErrorBody(error)); }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/voice/tts') {
    try {
      const { token } = requireFounderAuthority(request);
      const body = await readJson(request);
      const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
      const state = body.state === 'started' ? 'started' : body.state === 'completed' ? 'completed' : null;
      if (!sessionId || !state) {
        json(response, 400, { ok: false, error: 'sessionId and valid state are required' });
        return;
      }
      voiceAuthority.bind(sessionId, token);
      const session = voiceSessions.get(sessionId);
      json(response, 200, { ok: true, session: session.tts(state) });
    } catch (error) { json(response, authErrorStatus(error), authErrorBody(error)); }
    return;
  }

  const voiceSessionMatch = url.pathname.match(/^\/api\/voice\/sessions\/([^/]+)$/);
  const voiceSessionId = voiceSessionMatch?.[1];
  if (request.method === 'GET' && voiceSessionId) {
    try {
      const { token } = requireFounderAuthority(request);
      voiceAuthority.bind(decodeURIComponent(voiceSessionId), token);
      json(response, 200, {
        ok: true,
        session: voiceSessions.get(decodeURIComponent(voiceSessionId)).snapshot(),
      });
    } catch (error) {
      json(response, authErrorStatus(error), authErrorBody(error));
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
      authorize: (sessionId, ticket, request) => {
        requireSecureAuthorityTransport(request);
        const origin = request.headers.origin;
        if (origin && new URL(origin).host !== request.headers.host) throw new Error('Voice origin is not allowed');
        return voiceAuthority.consume(ticket, sessionId);
      },
      revalidate: (sessionId) => { voiceAuthority.principal(sessionId); },
      ...(speakerRecognition ? { speakerResolverFactory: speakerRecognition.resolverFactory } : {}),
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

void refreshVaultCache().then(syncCredentialCapabilities).then(() => socialWatchScheduler?.start());
radarScheduler?.start();

server.listen(port, bindHost, () => {
  console.log(`JANUS CORE local en http://${bindHost}:${port} (sin exposición directa a LAN/Internet)`);
});
