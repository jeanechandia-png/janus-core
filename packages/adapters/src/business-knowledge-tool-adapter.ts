import { randomUUID } from 'node:crypto';
import type { ToolAdapter, ToolProgress, ToolRequest, ToolResult } from '../../gateways/src/contracts.js';
import {
  PROPOSAL_TTL_MS,
  applyProposal,
  buildReadback,
  buildSnapshot,
  createProposal,
  emptyState,
  evaluateConsumerSync,
  formatEuros,
  parseSpanishUtterance,
  renderKnowledgeText,
  replayRevisions,
  resolveIntent,
  type Audience,
  type KnowledgeChange,
  type KnowledgeProposal,
  type KnowledgeRevision,
  type KnowledgeState,
  type SyncState,
} from '../../modules/business-knowledge/src/index.js';
import { requestJson } from './http-json.js';

/**
 * Herramienta `knowledge` de Janus sobre el módulo LEGO `business-knowledge`.
 *
 *  change.propose   (lectura, sin efectos)  frase dictada → cambios concretos → lectura de confirmación
 *  change.apply     (PRIVILEGIADA)          aplica la propuesta pendiente; exige permiso de autoridad
 *                                           (aprobación del Founder + Face ID, ver DEFAULT_AUTHORITY_POLICY)
 *  snapshot.publish (PRIVILEGIADA)          envía la instantánea PÚBLICA a un destino HTTPS configurado
 *  sync.check       (lectura)               pregunta a cada consumidor qué revisión/checksum cargó
 *  entries.list / snapshot.get (lectura)    consulta local
 *
 * «Aplicado» en los consumidores solo se declara cuando ELLOS informan la misma revisión y checksum.
 * No hay secretos aquí: el token de publicación llega por `tokenProvider` (CredentialBroker).
 */

export interface BusinessKnowledgeStorePort {
  appendRevision(record: { revision: number; at: string; approvalRef: string; stateChecksum: string; payload: unknown }): void;
  listRevisions(): unknown[];
  putProposal(record: { id: string; key: string; createdAt: string; expiresAt: string; payload: unknown }): void;
  findPendingProposal(key: string, nowIso: string): { id: string; payload: unknown } | undefined;
  setProposalStatus(id: string, status: 'applied' | 'superseded' | 'rejected'): void;
  upsertConsumerReport(report: { consumer: string; revision: number; checksum: string; reportedAt: string }): void;
  listConsumerReports(): Array<{ consumer: string; revision: number; checksum: string; reportedAt: string }>;
}

export interface BusinessKnowledgeToolOptions {
  store: BusinessKnowledgeStorePort;
  now?: () => Date;
  idFactory?: () => string;
  fetchImpl?: typeof fetch;
  publish?: { url: string; tokenProvider: () => Promise<string | undefined> };
  /** consumidor → URL https que devuelve `{ businessKnowledge: { revision, checksum } }`. */
  statusUrls?: Readonly<Record<string, string>>;
}

const KEY_PATTERN = /^[a-f0-9]{8,64}$/;

export class BusinessKnowledgeToolAdapter implements ToolAdapter {
  readonly name = 'knowledge';
  readonly capabilities: string[] = ['entries.list', 'snapshot.get', 'change.propose', 'change.apply', 'snapshot.publish', 'sync.check'];

  private readonly store: BusinessKnowledgeStorePort;
  private readonly now: () => Date;
  private readonly idFactory: () => string;
  private readonly fetchImpl: typeof fetch;
  private readonly publishTarget?: { url: string; tokenProvider: () => Promise<string | undefined> };
  private readonly statusUrls: Record<string, string>;

  constructor(options: BusinessKnowledgeToolOptions) {
    this.store = options.store;
    this.now = options.now ?? (() => new Date());
    this.idFactory = options.idFactory ?? (() => `kp_${randomUUID()}`);
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.publishTarget = options.publish ? { ...options.publish, url: assertHttps(options.publish.url, 'publish URL') } : undefined;
    this.statusUrls = Object.fromEntries(
      Object.entries(options.statusUrls ?? {}).map(([consumer, url]) => [consumer, assertHttps(url, `status URL (${consumer})`)]),
    );
  }

  /** Estado vigente reconstruido desde el historial, con verificación de la cadena de checksums. */
  currentState(): KnowledgeState {
    const revisions = this.store.listRevisions() as KnowledgeRevision[];
    if (revisions.length === 0) return emptyState();
    const replay = replayRevisions(revisions);
    if (!replay.ok) throw new Error(`El historial del conocimiento no supera la verificación de integridad: ${replay.message}`);
    return replay.value;
  }

  async execute(request: ToolRequest, onProgress: (progress: ToolProgress) => void | Promise<void>): Promise<ToolResult> {
    if (!this.capabilities.includes(request.action)) return { ok: false, error: `Unsupported knowledge action: ${request.action}` };
    try {
      await onProgress({ phase: 'progress', message: `Conocimiento: ${request.action}`, percent: 40 });
      switch (request.action) {
        case 'entries.list': return this.listEntries(request);
        case 'snapshot.get': return this.getSnapshot(request);
        case 'change.propose': return this.propose(request);
        case 'change.apply': return this.apply(request);
        case 'snapshot.publish': return await this.publish(request);
        default: return await this.checkSync();
      }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private listEntries(request: ToolRequest): ToolResult {
    const state = this.currentState();
    const kind = typeof request.input.kind === 'string' ? request.input.kind : undefined;
    const entries = Object.values(state.entries).filter((entry) => entry.active && (!kind || entry.kind === kind));
    const lines = entries.map((entry) =>
      entry.kind === 'product'
        ? `- ${entry.title}: ${entry.priceCents !== undefined ? `${formatEuros(entry.priceCents)} (${entry.priceIncludesVat ? 'IVA incluido' : 'IVA no incluido'})` : 'sin precio'}`
        : `- [${entry.kind}] ${entry.title}`);
    return {
      ok: true,
      output: {
        revision: state.revision,
        count: entries.length,
        reply: entries.length
          ? `Conocimiento del negocio (revisión ${state.revision}):\n${lines.join('\n')}`
          : 'Todavía no hay conocimiento del negocio registrado.',
      },
    };
  }

  private getSnapshot(request: ToolRequest): ToolResult {
    const audience: Audience = request.input.audience === 'internal' ? 'internal' : 'public';
    const snapshot = buildSnapshot(this.currentState(), audience);
    return {
      ok: true,
      output: {
        revision: snapshot.revision,
        checksum: snapshot.checksum,
        audience,
        snapshot: snapshot as unknown as Record<string, unknown>,
        reply: `Instantánea ${audience === 'public' ? 'pública' : 'interna'} de la revisión ${snapshot.revision} (checksum ${snapshot.checksum.slice(0, 12)}).`,
      },
    };
  }

  private propose(request: ToolRequest): ToolResult {
    const key = proposalKey(request.input.proposalKey);
    if (!key) return { ok: false, error: 'Falta la clave de la propuesta.' };
    const state = this.currentState();
    const utterance = typeof request.input.utterance === 'string' ? request.input.utterance : '';

    let changes: KnowledgeChange[];
    if (Array.isArray(request.input.changes) && request.input.changes.length > 0) {
      // Camino de planificador con modelo: la salida estructurada pasa por la MISMA validación.
      changes = request.input.changes as KnowledgeChange[];
    } else {
      const intent = parseSpanishUtterance(utterance);
      if (!intent) {
        return {
          ok: false,
          error: 'No pude interpretar el cambio con seguridad. Dímelo con una frase como «el precio del módulo X pasa a 135 euros», «cambia el IVA al 21 %» o «guarda esta instrucción: …».',
        };
      }
      const resolved = resolveIntent(state, intent);
      if (!resolved.ok) return { ok: false, error: resolved.message };
      changes = resolved.changes;
    }

    const id = this.idFactory();
    const proposal = createProposal({
      id,
      state,
      changes,
      source: request.input.source === 'chat' ? 'chat' : 'voice',
      utterance,
      now: this.now(),
    });
    if (!proposal.ok) return { ok: false, error: proposal.message };

    this.store.putProposal({
      id,
      key,
      createdAt: proposal.value.createdAt,
      expiresAt: proposal.value.expiresAt,
      payload: proposal.value,
    });

    const readback = buildReadback(state, proposal.value.changes);
    const minutes = Math.round(PROPOSAL_TTL_MS / 60_000);
    const reply = [
      readback.lines.length === 1 ? 'Esto es lo que voy a cambiar:' : 'Esto es lo que voy a cambiar (varios cambios):',
      ...readback.lines.map((line) => `• ${line}`),
      ...readback.warnings.map((warning) => `⚠ ${warning}`),
      `Todavía NO he cambiado nada. Necesito tu aprobación con Face ID (válida ${minutes} min).`,
    ].join('\n');

    return {
      ok: true,
      output: {
        reply,
        spoken: `${readback.spoken} Todavía no he cambiado nada: necesito tu aprobación con Face ID.`,
        proposalId: id,
        baseRevision: proposal.value.baseRevision,
        expiresAt: proposal.value.expiresAt,
        warnings: readback.warnings,
        awaitingApproval: true,
      },
    };
  }

  private apply(request: ToolRequest): ToolResult {
    const permit = request.authorization;
    if (!permit?.privileged || !permit.authorityDecisionHash || !/^[a-f0-9]{64}$/i.test(permit.authorityDecisionHash)) {
      return { ok: false, error: 'Cambiar el conocimiento del negocio exige una decisión de autoridad verificada; no se aplicó nada.' };
    }
    const key = proposalKey(request.input.proposalKey);
    if (!key) return { ok: false, error: 'Falta la clave de la propuesta.' };

    const now = this.now();
    const pending = this.store.findPendingProposal(key, now.toISOString());
    if (!pending) {
      return { ok: false, error: 'No hay un cambio pendiente de aplicar (puede haber caducado). Pídemelo de nuevo y te lo vuelvo a leer.' };
    }

    const state = this.currentState();
    const applied = applyProposal({
      state,
      proposal: pending.payload as KnowledgeProposal,
      approvalRef: permit.authorityDecisionHash,
      approvedBy: permit.principalId ?? 'founder',
      now,
    });
    if (!applied.ok) {
      return { ok: false, error: applied.message };
    }

    try {
      this.store.appendRevision({
        revision: applied.value.revision.revision,
        at: applied.value.revision.at,
        approvalRef: applied.value.revision.approvalRef,
        stateChecksum: applied.value.revision.stateChecksum,
        payload: applied.value.revision,
      });
    } catch {
      return { ok: false, error: 'Otro cambio se aplicó al mismo tiempo; no se guardó este. Pídemelo de nuevo.' };
    }
    this.store.setProposalStatus(pending.id, 'applied');

    const snapshot = buildSnapshot(applied.value.state, 'public');
    return {
      ok: true,
      externalReference: `knowledge:r${applied.value.revision.revision}`,
      output: {
        revision: applied.value.revision.revision,
        stateChecksum: applied.value.revision.stateChecksum,
        snapshotChecksum: snapshot.checksum,
        reply:
          `Hecho: conocimiento actualizado a la revisión ${applied.value.revision.revision} (guardado en Janus). `
          + 'Todavía NO está en Melanie ni en el chat: falta publicarlo y comprobar que lo cargaron.',
        syncState: 'local_only',
      },
    };
  }

  private async publish(request: ToolRequest): Promise<ToolResult> {
    const permit = request.authorization;
    if (!permit?.privileged || !permit.authorityDecisionHash) {
      return { ok: false, error: 'Publicar el conocimiento fuera de Janus exige una decisión de autoridad verificada.' };
    }
    if (!this.publishTarget) {
      return { ok: false, error: 'No hay destino de publicación configurado (JANUS_KNOWLEDGE_PUBLISH_URL). El conocimiento sigue solo en Janus.' };
    }
    const state = this.currentState();
    if (state.revision === 0) return { ok: false, error: 'Todavía no hay conocimiento que publicar.' };

    const token = (await this.publishTarget.tokenProvider())?.trim();
    if (!token) return { ok: false, error: 'Falta la credencial del servicio knowledge-publish.' };

    // Solo la instantánea PÚBLICA sale de Janus; las entradas internas nunca.
    const snapshot = buildSnapshot(state, 'public');
    const result = await requestJson({
      fetchImpl: this.fetchImpl,
      url: this.publishTarget.url,
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'idempotency-key': snapshot.checksum },
      body: { snapshot, contextText: renderKnowledgeText(snapshot) },
      service: 'knowledge-publish',
    });
    if (!result.ok) {
      return { ok: false, error: `El destino rechazó la publicación (HTTP ${result.status})${result.error ? `: ${result.error}` : ''}.` };
    }

    return {
      ok: true,
      externalReference: `knowledge:r${snapshot.revision}:${snapshot.checksum.slice(0, 12)}`,
      output: {
        revision: snapshot.revision,
        checksum: snapshot.checksum,
        publishedTo: new URL(this.publishTarget.url).host,
        reply: `Publicada la revisión ${snapshot.revision} en ${new URL(this.publishTarget.url).host}. Ahora compruebo si Melanie y el chat la cargaron; hasta entonces figura como «publicada», no como «aplicada».`,
        syncState: 'published',
      },
    };
  }

  private async checkSync(): Promise<ToolResult> {
    const state = this.currentState();
    const snapshot = buildSnapshot(state, 'public');
    const rows: Array<{ consumer: string; state: SyncState; revision: number | null }> = [];

    for (const [consumer, url] of Object.entries(this.statusUrls)) {
      const result = await requestJson({ fetchImpl: this.fetchImpl, url, headers: {}, service: `knowledge-status:${consumer}`, maxBytes: 64 * 1024, timeoutMs: 10_000 });
      const body = result.ok && result.body && typeof result.body === 'object' ? (result.body as Record<string, unknown>) : undefined;
      const reported = body?.businessKnowledge && typeof body.businessKnowledge === 'object' ? (body.businessKnowledge as Record<string, unknown>) : undefined;
      const revision = typeof reported?.revision === 'number' ? reported.revision : null;
      const checksum = typeof reported?.checksum === 'string' ? reported.checksum : null;

      if (revision !== null && checksum) {
        this.store.upsertConsumerReport({ consumer, revision, checksum, reportedAt: this.now().toISOString() });
      }
      rows.push({ consumer, state: evaluateConsumerSync(snapshot, { consumer, revision, checksum }), revision });
    }

    if (rows.length === 0) {
      return { ok: true, output: { revision: snapshot.revision, consumers: [], reply: 'No hay consumidores configurados para comprobar (JANUS_KNOWLEDGE_STATUS_URLS).' } };
    }
    const label: Record<SyncState, string> = {
      applied: 'cargado ✓',
      stale: 'desactualizado (revisión anterior)',
      mismatch: 'no coincide con lo publicado',
      not_reported: 'sin respuesta o sin informar',
    };
    return {
      ok: true,
      output: {
        revision: snapshot.revision,
        checksum: snapshot.checksum,
        consumers: rows,
        allApplied: rows.every((row) => row.state === 'applied'),
        reply: `Sincronización de la revisión ${snapshot.revision}:\n${rows.map((row) => `• ${row.consumer}: ${label[row.state]}`).join('\n')}`,
      },
    };
  }
}

function proposalKey(value: unknown): string | undefined {
  return typeof value === 'string' && KEY_PATTERN.test(value) ? value : undefined;
}

function assertHttps(value: string, label: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error(`${label} must use https`);
  if (url.username || url.password) throw new Error(`${label} must not embed credentials`);
  return url.toString();
}
