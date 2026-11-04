/**
 * JANUS Voice Provider Management · solo metadatos y clonación IVC con autorización
 * explícita, NUNCA autorun. ElevenLabs es un adaptador sustituible.
 *
 * Endpoints oficiales: GET /v2/voices, GET /v1/voices/:voice_id,
 * POST /v1/voices/add. La lectura no consume texto de chats ni envía voz.
 * Las muestras se suben SOLO con aprobación auditada, pertenencia confirmada
 * y grabaciones originales del propio titular. No usar voces de menores.
 */
import { createHash } from 'node:crypto';
import { isSafeProviderVoiceId } from './elevenlabs-tts-adapter.js';

export interface ProviderVoiceInfo {
  voiceId: string;
  name: string;
  category: string;
  ownedByAccount: boolean | null;
  fineTuningState: string | null;
  /** La existencia en el catálogo NO verifica que sea el clon del Founder. */
  verifiedFounderClone: false;
}

export interface OriginalVoiceUpload {
  filename: string;
  data: Blob;
  provenance: 'original-recording';
  sha256: string;
}
export interface VoiceCloneUploadAuthorization {
  approvedByFounder: true;
  ownershipConfirmed: true;
  allowedRecipient: 'elevenlabs';
  scope: 'voice-clone-janus-only';
  approvalReceiptId: string;
  approvalAt: string;
  sampleHashes: string[];
}
export interface ElevenLabsVoiceManagementOptions {
  apiKeyProvider: () => Promise<string | undefined>;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

/** El adaptador solo es callable por rutas protegidas del Core o jobs aprobados. */
export class ElevenLabsVoiceManagementAdapter {
  private readonly apiKeyProvider: () => Promise<string | undefined>;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;

  constructor(options: ElevenLabsVoiceManagementOptions) {
    this.apiKeyProvider = options.apiKeyProvider;
    this.fetchImpl = options.fetchImpl ?? fetch;
    const url = new URL(options.baseUrl || 'https://api.elevenlabs.io');
    if (url.protocol !== 'https:' || !(url.hostname === 'elevenlabs.io' || url.hostname.endsWith('.elevenlabs.io'))
      || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('Proveedor de voces debe ser un origen HTTPS de ElevenLabs sin credenciales.');
    }
    this.baseUrl = url.origin;
  }

  private async headers(): Promise<Record<string, string>> {
    const apiKey = (await this.apiKeyProvider())?.trim();
    if (!apiKey) throw new Error('No hay credenciales autorizadas de ElevenLabs en el CredentialBroker.');
    return { 'xi-api-key': apiKey, accept: 'application/json' };
  }

  async listPersonalVoices(): Promise<ProviderVoiceInfo[]> {
    const headers = await this.headers();
    const out: ProviderVoiceInfo[] = [];
    let nextPageToken: string | null = null;
    // Límite estricto de páginas/entradas; no se registra el token en logs.
    for (let i = 0; i < 5; i += 1) {
      const url = new URL(this.baseUrl + '/v2/voices');
      url.searchParams.set('voice_type', 'personal');
      url.searchParams.set('page_size', '100');
      if (nextPageToken) url.searchParams.set('next_page_token', nextPageToken);
      const response = await this.fetchImpl(url.toString(), { headers, signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('Inventario de voces ElevenLabs no disponible (HTTP ' + response.status + ').');
      const body = await response.json() as {
        voices?: unknown[];
        has_more?: boolean;
        next_page_token?: string | null;
      };
      for (const item of body.voices || []) {
        if (!item || typeof item !== 'object') continue;
        const voice = item as Record<string, unknown>;
        if (typeof voice.voice_id !== 'string' || !isSafeProviderVoiceId(voice.voice_id)) continue;
        const ft = voice.fine_tuning;
        out.push({
          voiceId: voice.voice_id,
          name: String(voice.name ?? '').slice(0, 120),
          category: String(voice.category ?? 'unknown').slice(0, 40),
          ownedByAccount: typeof voice.is_owner === 'boolean' ? voice.is_owner : null,
          fineTuningState: ft && typeof ft === 'object'
            ? String((ft as Record<string, unknown>).state ?? 'unknown').slice(0, 50) : null,
          verifiedFounderClone: false,
        });
      }
      if (!body.has_more || !body.next_page_token) break;
      nextPageToken = body.next_page_token;
    }
    return out;
  }

  async getVoice(voiceId: string): Promise<ProviderVoiceInfo> {
    if (!isSafeProviderVoiceId(voiceId)) throw new Error('Identificador de voz inválido.');
    const headers = await this.headers();
    const response = await this.fetchImpl(this.baseUrl + '/v1/voices/' + encodeURIComponent(voiceId), {
      headers, signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error('No fue posible consultar el estado de la voz (HTTP ' + response.status + ').');
    const body = await response.json() as Record<string, unknown>;
    const fine = body.fine_tuning;
    return {
      voiceId,
      name: String(body.name ?? '').slice(0, 120),
      category: String(body.category ?? 'unknown').slice(0, 40),
      ownedByAccount: typeof body.is_owner === 'boolean' ? body.is_owner : null,
      fineTuningState: fine && typeof fine === 'object'
        ? String((fine as Record<string, unknown>).state ?? 'unknown').slice(0, 50) : null,
      verifiedFounderClone: false,
    };
  }

  /**
   * Preparado para un JOB explícitamente aprobado; NO se expone a público ni se
   * ejecuta cuando el usuario simplemente pide información o "revisa voces".
   * La llamada POST puede cobrar créditos y no se reintenta automáticamente.
   */
  async createInstantClone(
    samples: readonly OriginalVoiceUpload[],
    authorization: VoiceCloneUploadAuthorization,
  ): Promise<{ voiceId: string; stage: 'needs-verification'; requiresProviderVerification: boolean }> {
    if (authorization?.approvedByFounder !== true || authorization.ownershipConfirmed !== true
      || authorization.allowedRecipient !== 'elevenlabs' || authorization.scope !== 'voice-clone-janus-only'
      || !authorization.approvalReceiptId?.trim() || !Number.isFinite(Date.parse(authorization.approvalAt))) {
      throw new Error('Falta autorización explícita, prueba de titularidad o recibo de aprobación.');
    }
    if (samples.length < 1 || samples.length > 10
      || samples.some(s => s.provenance !== 'original-recording'
        || !/^[0-9a-f]{64}$/i.test(s.sha256)
        || !/^[A-Za-z0-9_.-]{1,120}$/.test(s.filename)
        || !s.data || s.data.size < 1000 || s.data.size > 20 * 1024 * 1024
        || !['audio/wav','audio/x-wav','audio/mpeg','audio/mp3','audio/mp4','audio/ogg','audio/webm'].includes(s.data.type))) {
      throw new Error('Muestras inválidas: solo grabaciones originales de audio con huella, tipo y tamaño permitidos.');
    }
    const knownHashes = authorization.sampleHashes.map(hash => hash.toLowerCase());
    if (new Set(knownHashes).size !== samples.length
      || samples.some(s => !knownHashes.includes(s.sha256.toLowerCase()))) {
      throw new Error('Las muestras no coinciden con el recibo de consentimiento/aprobación.');
    }
    // Verificar bytes reales; no confiar solamente en el hash autodeclarado del
    // manifiesto ni en la coincidencia de texto con el recibo.
    for (const sample of samples) {
      const buffer = new Uint8Array(await sample.data.arrayBuffer());
      const actual = createHash('sha256').update(buffer).digest('hex');
      if (actual !== sample.sha256.toLowerCase())
        throw new Error('La huella del audio no coincide: muestra alterada o recibo incorrecto.');
    }
    const form = new FormData();
    form.set('name', 'JANUS - voz del Founder');
    form.set('description', 'Voz personal autorizada, uso interno para asistente JANUS');
    for (const sample of samples) form.append('files', sample.data, sample.filename);
    const headers = await this.headers();
    const response = await this.fetchImpl(this.baseUrl + '/v1/voices/add', {
      method: 'POST', headers, body: form, signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) throw new Error('ElevenLabs no creó el clon (HTTP ' + response.status + '). No se reintenta automáticamente.');
    const result = await response.json() as Record<string, unknown>;
    if (typeof result.voice_id !== 'string' || !isSafeProviderVoiceId(result.voice_id))
      throw new Error('Respuesta sin identificador válido; verificar manualmente antes de reintentar.');
    return {
      voiceId: result.voice_id,
      stage: 'needs-verification',
      requiresProviderVerification: result.requires_verification === true,
    };
  }
}
