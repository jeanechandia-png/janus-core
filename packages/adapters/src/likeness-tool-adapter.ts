import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import type { ToolAdapter, ToolProgress, ToolRequest, ToolResult } from '../../gateways/src/contracts.js';
import {
  MINOR_MAX_CONSENT_DAYS, createGuardianLikenessConsent, createLikenessConsent, revokeLikenessConsent, sha256,
  type LikenessConsent,
} from '../../core/src/likeness-consent.js';
import { checkVoiceReference, enrollVoiceClone, parseWav, type QwenVoiceCloneEntry } from '../../voice/src/voice-clone-enrollment.js';
import { cloneScript, transcriptMatch, type CloneSubject } from '../../voice/src/voice-clone-scripts.js';
import { convertToReferenceWav } from '../../voice/src/audio-convert.js';

/**
 * Janus `likeness` tool (ADR-012): runs the voice-clone process that ADR-009 only described.
 *
 *  - Founder: guided, ready to record. Enrolment writes a `voice_clone` entry for the local Qwen3-TTS sidecar.
 *  - Kendra (minor): STANDBY. Nothing starts until the Founder asks; enrolment needs the guardian's declaration,
 *    the child's assent and, like every enrolment, the Founder's explicit approval (sensitive-action policy).
 *
 * Voice or face likeness is never presence evidence and never authorises anything (ADR-008).
 * Reference audio stays on the host (git-ignored), is addressed by SHA-256 and is never returned in outputs.
 */

export interface LikenessStore {
  list(): LikenessConsent[];
  save(consent: LikenessConsent): void;
}

export class MemoryLikenessStore implements LikenessStore {
  private readonly items = new Map<string, LikenessConsent>();
  list() { return [...this.items.values()]; }
  save(consent: LikenessConsent) { this.items.set(consent.id, consent); }
}

function writeJsonAtomic(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2), { mode: 0o600 });
  renameSync(tmp, path);
}

/** Local JSON file, atomic replace, mode 0600. POR CONFIRMAR: migrate to SQLite (local-first memory) later. */
export class JsonFileLikenessStore implements LikenessStore {
  constructor(private readonly path: string) {}
  list(): LikenessConsent[] {
    if (!existsSync(this.path)) return [];
    try {
      const parsed = JSON.parse(readFileSync(this.path, 'utf8')) as { consents?: LikenessConsent[] };
      return Array.isArray(parsed.consents) ? parsed.consents : [];
    } catch { return []; }
  }
  save(consent: LikenessConsent) {
    const others = this.list().filter((item) => item.id !== consent.id);
    writeJsonAtomic(this.path, { consents: [...others, consent] });
  }
}

export interface VoiceConfigStore {
  has(voiceId: string): boolean;
  upsert(voiceId: string, entry: QwenVoiceCloneEntry & Record<string, unknown>): void;
  remove(voiceId: string): void;
}

export class MemoryVoiceConfigStore implements VoiceConfigStore {
  readonly voices = new Map<string, Record<string, unknown>>();
  has(voiceId: string) { return this.voices.has(voiceId); }
  upsert(voiceId: string, entry: Record<string, unknown>) { this.voices.set(voiceId, entry); }
  remove(voiceId: string) { this.voices.delete(voiceId); }
}

/** `config/voices.local.json` (git-ignored): the file the Qwen3-TTS sidecar reads. Other voices are preserved. */
export class JsonFileVoiceConfigStore implements VoiceConfigStore {
  constructor(private readonly path: string) {}
  private read(): { voices: Record<string, unknown> } & Record<string, unknown> {
    if (!existsSync(this.path)) return { voices: {} };
    const parsed = JSON.parse(readFileSync(this.path, 'utf8')) as { voices?: Record<string, unknown> };
    return { ...parsed, voices: parsed.voices && typeof parsed.voices === 'object' ? parsed.voices : {} };
  }
  has(voiceId: string) { return Object.prototype.hasOwnProperty.call(this.read().voices, voiceId); }
  upsert(voiceId: string, entry: Record<string, unknown>) {
    const config = this.read();
    config.voices[voiceId] = entry;
    writeJsonAtomic(this.path, config);
  }
  remove(voiceId: string) {
    if (!existsSync(this.path)) return;
    const config = this.read();
    delete config.voices[voiceId];
    writeJsonAtomic(this.path, config);
  }
}

export interface LikenessAdapterOptions {
  consents: LikenessStore;
  voices: VoiceConfigStore;
  /** Absolute. Where phone recordings arrive (Files/iCloud/Drive sync/AirDrop). Nothing outside it is read. */
  inboxDir: string;
  /** Absolute. Git-ignored home of the normalised reference copies. */
  privateDir: string;
  /** Qwen3-TTS «Base» model directory on the host. Absent = the host is not ready (stage `recorded_waiting_for_host`). */
  cloneModelPath?: string;
  language?: string;
  now?: () => Date;
  convert?: (input: string, output: string) => Promise<void>;
  /** Optional speech-to-text check (whisper.cpp adapter): what was said must match the script. */
  transcribe?: (wavPath: string) => Promise<string | undefined>;
  faceStatus?: () => { state: string; reason?: string };
}

type Stage = 'not_started' | 'standby' | 'recorded_waiting_for_host' | 'enrolled' | 'revoked';

const SUBJECTS: Record<CloneSubject, { principalId: string; voiceId: string; who: string }> = {
  founder: { principalId: 'founder', voiceId: 'jean-clone-es', who: 'tu voz' },
  kendra: { principalId: 'kendra', voiceId: 'kendra-clone-es', who: 'la voz de Kendra' },
};
const AUDIO_EXTENSIONS = new Set(['.wav', '.m4a', '.mp3', '.caf', '.aac', '.ogg', '.flac', '.mp4']);
const MAX_RECORDING_BYTES = 100 * 1024 * 1024;
const DAY_MS = 86_400_000;
const FOUNDER_USES = ['janus_private_assistant', 'internal_lab_test'] as const;
const KENDRA_USES = ['janus_private_assistant'] as const;
const CAPABILITIES = [
  'status', 'founder.voice.guide', 'founder.voice.enroll', 'kendra.voice.guide', 'kendra.voice.enroll', 'voice.revoke', 'founder.face.guide',
];

export class LikenessToolAdapter implements ToolAdapter {
  readonly name = 'likeness';
  readonly capabilities: string[] = [...CAPABILITIES];

  constructor(private readonly options: LikenessAdapterOptions) {}

  async execute(request: ToolRequest, onProgress: (progress: ToolProgress) => void | Promise<void>): Promise<ToolResult> {
    if (!this.capabilities.includes(request.action)) return { ok: false, error: `Unsupported likeness action: ${request.action}` };
    const input = request.input;
    try {
      switch (request.action) {
        case 'status': return this.status();
        case 'founder.voice.guide': return this.voiceGuide('founder');
        case 'kendra.voice.guide': return this.voiceGuide('kendra');
        case 'founder.face.guide': return this.faceGuide();
        case 'founder.voice.enroll': return await this.enroll('founder', input, onProgress);
        case 'kendra.voice.enroll': return await this.enroll('kendra', input, onProgress);
        case 'voice.revoke': return this.revoke(input.subject === 'kendra' ? 'kendra' : 'founder');
        default: return { ok: false, error: `Unsupported likeness action: ${request.action}` };
      }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  // ---------- state ----------
  private now(): Date { return (this.options.now ?? (() => new Date()))(); }

  private consentsOf(subject: CloneSubject): LikenessConsent[] {
    const { principalId } = SUBJECTS[subject];
    return this.options.consents.list().filter((consent) => consent.principalId === principalId).sort((a, b) => a.grantedAt.localeCompare(b.grantedAt));
  }

  private activeConsent(subject: CloneSubject): LikenessConsent | undefined {
    const now = this.now().toISOString();
    return this.consentsOf(subject).reverse().find((consent) => !consent.revokedAt && now < consent.expiresAt);
  }

  private referencePath(subject: CloneSubject): string { return join(this.options.privateDir, subject, 'reference.wav'); }

  /** Public, side-effect-free view of the stage (for /health). */
  stageOf(subject: CloneSubject): Stage { return this.stage(subject); }

  private stage(subject: CloneSubject): Stage {
    const consents = this.consentsOf(subject);
    if (consents.length === 0) return subject === 'kendra' ? 'standby' : 'not_started';
    const active = this.activeConsent(subject);
    if (!active) return 'revoked';
    return this.options.voices.has(SUBJECTS[subject].voiceId) ? 'enrolled' : 'recorded_waiting_for_host';
  }

  private missing(subject: CloneSubject): string[] {
    const stage = this.stage(subject);
    const gaps: string[] = [];
    if (stage === 'not_started' || stage === 'standby' || stage === 'revoked') gaps.push('una grabación de la persona leyendo el texto indicado');
    if (!this.options.cloneModelPath) gaps.push('el equipo con el modelo de voz (Qwen3-TTS «Base»): JANUS_TTS_CLONE_MODEL_PATH');
    return gaps;
  }

  private inboxFiles(): string[] {
    try { return readdirSync(this.options.inboxDir).filter((name) => AUDIO_EXTENSIONS.has(extname(name).toLowerCase())).sort(); } catch { return []; }
  }

  // ---------- read-only actions ----------
  private status(): ToolResult {
    const label: Record<Stage, string> = {
      not_started: 'sin empezar',
      standby: '⏸️ EN ESPERA (no se ha iniciado nada)',
      recorded_waiting_for_host: '🟡 grabada y autorizada; falta el equipo con el modelo de voz',
      enrolled: '✅ registrada para el motor de voz local',
      revoked: '⛔ revocada o caducada',
    };
    const founder = this.stage('founder');
    const kendra = this.stage('kendra');
    const face = this.options.faceStatus?.();
    const lines = [
      '📋 Estado de voz y rostro de Janus',
      `🎙️ Tu voz clonada: ${label[founder]}${this.missing('founder').length ? ` · falta: ${this.missing('founder').join('; ')}` : ''}`,
      `🧒 Voz de Kendra: ${label[kendra]}`,
      `🙂 Reconocimiento facial: ${face ? `${face.state}${face.reason ? ` (${face.reason})` : ''}` : 'no consultado'}`,
      `📥 Grabaciones en la carpeta de entrada: ${this.inboxFiles().length}`,
      'Una voz o una cara parecida nunca es una llave: no autoriza acciones sensibles.',
    ];
    return { ok: true, output: { reply: lines.join('\n'), founder, kendra, hostReady: Boolean(this.options.cloneModelPath), inboxFiles: this.inboxFiles().length } };
  }

  private voiceGuide(subject: CloneSubject): ToolResult {
    this.ensureInbox();
    const script = cloneScript(subject);
    const stage = this.stage(subject);
    const inbox = 'data/voice-inbox';
    const recording = [
      `2) Abre «Notas de voz», pulsa grabar y lee con calma y naturalidad este texto (unos ${script.approxSeconds} s; si te equivocas, repite la frase sin cortar la toma o graba otra):`,
      `«${script.text}»`,
      `3) Guarda el archivo en la carpeta de entrada de Janus (${inbox}): Compartir → Guardar en Archivos / iCloud o Drive sincronizado, o AirDrop al equipo de Janus. POR CONFIRMAR cómo llega hoy a tu equipo.`,
    ];
    if (subject === 'founder') {
      return { ok: true, output: { reply: [
        '🎙️ Clonar tu voz — guía (≈ 5 minutos)',
        'Qué hace: con una grabación tuya y tu autorización, el motor de voz local de Janus hablará con tu timbre. Es para tu asistente privado; cada audio sintético llevará el aviso «voz generada con IA», y una voz clonada nunca te identifica ni da acceso a nada.',
        '1) Busca un sitio silencioso, sin eco ni música, con el teléfono a un palmo de la boca.',
        ...recording,
        '4) Dime: «Janus, usa mi grabación». Te saldrá una tarjeta de aprobación: al aprobarla autorizas el uso de tu voz.',
        `Estado ahora: ${stage}. ${this.missing('founder').length ? `Falta: ${this.missing('founder').join('; ')}.` : ''}`,
        'Puedes revocarla cuando quieras: «Janus, revoca mi voz clonada» (borra la copia de referencia y la entrada del motor).',
      ].join('\n'), subject, stage, script: script.text, approxSeconds: script.approxSeconds } };
    }
    return { ok: true, output: { reply: [
      '🧒 Voz de Kendra — EN ESPERA (no se ha iniciado nada)',
      'La opción está preparada y solo avanza cuando tú lo pidas. Condiciones:',
      '• Que ella quiera: propónselo como un juego; puede decir que no en cualquier momento y se detiene.',
      '• Tú, como su padre y tutor legal, la autorizas; quedan registrados tu declaración y su conformidad.',
      '• Uso limitado: solo el asistente privado de Janus (por ejemplo, su compañero en casa). Nunca llamadas, redes, vídeos públicos, clientes ni hablar con terceros en su nombre.',
      `• Dura como máximo ${MINOR_MAX_CONSENT_DAYS / 30} meses y se renueva contigo; puedes borrarla cuando quieras. Solo voz: sin cara ni avatar.`,
      '1) Sitio silencioso y cercano, sin música.',
      ...recording,
      '4) Cuando estén de acuerdo, dime: «Janus, usa la grabación de Kendra; ella está de acuerdo y yo la autorizo como su padre». Verás la tarjeta de aprobación.',
      `Estado ahora: ${stage}.`,
    ].join('\n'), subject, stage, script: script.text, approxSeconds: script.approxSeconds } };
  }

  private faceGuide(): ToolResult {
    const face = this.options.faceStatus?.();
    return { ok: true, output: { reply: [
      '🙂 Tu reconocimiento facial — dos piezas distintas',
      `A) Reconocerte en casa (comodidad). Servicio de caras en el equipo: ${face ? face.state : 'no consultado'}${face?.reason ? ` (${face.reason})` : ''}.`,
      '   1. Activa el servicio local (JANUS_FACE_ID_ENABLED, JANUS_FACE_EMBED_URL y una clave nueva JANUS_FACE_VAULT_KEY) y arráncalo.',
      '   2. Hazte 3 a 5 fotos de frente, con buena luz, sin gafas de sol y con una sola cara. JPEG o PNG: en el iPhone, Ajustes → Cámara → Formatos → «Más compatible», o compártelas como JPEG.',
      '   3. En el equipo: node --import tsx scripts/face-enroll.ts --subject jean --name "Jean" --role primary_owner --grantor jean --grantor-name "Jean" --relation self --statement "Autorizo el reconocimiento y almacenamiento de mi plantilla facial para personalizar a Janus." --files foto1.jpg,foto2.jpg,foto3.jpg',
      'B) Face ID como llave de Founder (autenticación real, ADR-007/008): el código está; falta la prueba en un iPhone físico (compilar la app puente). POR CONFIRMAR.',
      'Un parecido no es una llave: el reconocimiento del hogar nunca autoriza acciones sensibles. Clonar tu cara (avatar) no está en esta fase.',
    ].join('\n'), face: face?.state ?? 'unknown' } };
  }

  // ---------- enrolment (sensitive: forced approval by the sensitive-action policy) ----------
  private ensureInbox(): void { mkdirSync(this.options.inboxDir, { recursive: true, mode: 0o700 }); }

  private resolveInbox(name: string): string {
    this.ensureInbox();
    const inbox = realpathSync(resolve(this.options.inboxDir));
    const candidate = resolve(isAbsolute(name) ? name : join(inbox, name));
    if (!existsSync(candidate)) throw new Error(`No encuentro «${name}» en la carpeta de entrada. Archivos disponibles: ${this.inboxFiles().join(', ') || 'ninguno'}.`);
    const real = realpathSync(candidate);
    const rel = relative(inbox, real);
    if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error('Solo se leen grabaciones de la carpeta de entrada de Janus.');
    if (!lstatSync(real).isFile()) throw new Error('La grabación debe ser un archivo.');
    if (!AUDIO_EXTENSIONS.has(extname(real).toLowerCase())) throw new Error('Formato no admitido; usa .m4a, .wav, .mp3 o .caf.');
    if (lstatSync(real).size > MAX_RECORDING_BYTES) throw new Error('La grabación pesa demasiado; recorta la toma.');
    return real;
  }

  private static fold(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  /**
   * Which recording to use: an explicit name wins; otherwise the inbox file whose name appears in the sentence.
   * Only for the Founder, if the inbox holds a single file that is not Kendra's, that one. Kendra's recording must always be
   * named: a lone file in the shared inbox could be someone else's voice, and a clone of the wrong person is not recoverable.
   */
  private pickFile(subject: CloneSubject, input: Record<string, unknown>): string | undefined {
    if (typeof input.file === 'string' && input.file.trim()) return input.file.trim();
    const files = this.inboxFiles();
    const hint = LikenessToolAdapter.fold(typeof input.hint === 'string' ? input.hint : '');
    const named = files.filter((name) => {
      const base = LikenessToolAdapter.fold(name.slice(0, name.length - extname(name).length));
      return base.length >= 3 && hint.includes(base);
    });
    if (named.length === 1) return named[0];
    if (named.length > 1) throw new Error(`Varias grabaciones encajan con lo que dices (${named.join(', ')}). Dime cuál: entre comillas, por ejemplo «${named[0]}».`);
    if (subject === 'founder' && files.length === 1 && !/kendra/.test(LikenessToolAdapter.fold(files[0]!))) return files[0];
    return undefined;
  }

  private async prepareReference(subject: CloneSubject, file: string): Promise<string> {
    const source = this.resolveInbox(file);
    const target = this.referencePath(subject);
    mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
    const convert = this.options.convert ?? ((input: string, output: string) => convertToReferenceWav(input, output));
    try {
      await convert(source, target);
    } catch (error) {
      // Without ffmpeg, a ready-made WAV can still be used as is.
      if (extname(source).toLowerCase() === '.wav' && /ffmpeg is not installed/.test(error instanceof Error ? error.message : '')) copyFileSync(source, target);
      else throw error;
    }
    return target;
  }

  private async enroll(subject: CloneSubject, input: Record<string, unknown>, onProgress: (progress: ToolProgress) => void | Promise<void>): Promise<ToolResult> {
    const { principalId, voiceId, who } = SUBJECTS[subject];
    const now = this.now();
    const nowIso = now.toISOString();
    const script = cloneScript(subject);

    if (subject === 'kendra' && (input.guardianConfirms !== true || input.childAssent !== true)) {
      return { ok: false, error: 'La voz de Kendra sigue EN ESPERA. Para avanzar necesito dos declaraciones tuyas: que la autorizas como su padre/tutor y que ella está de acuerdo. Di, por ejemplo: «usa la grabación de Kendra; ella está de acuerdo y yo la autorizo como su padre».' };
    }

    const stage = this.stage(subject);
    // A finished take that only waits for the host is completed from the stored copy, never re-read from the inbox by guesswork.
    const explicit = typeof input.file === 'string' && input.file.trim() !== '';
    const chosen = stage === 'recorded_waiting_for_host' && !explicit ? undefined : this.pickFile(subject, input);
    const hasNewFile = chosen !== undefined && !(stage === 'enrolled' && input.replace !== true && !explicit);
    if (stage === 'enrolled' && !hasNewFile && input.replace !== true) {
      return { ok: true, output: { reply: `✅ ${who[0]!.toUpperCase()}${who.slice(1)} ya está registrada. Para rehacerla, graba otra toma y dime «usa la grabación …».`, stage } };
    }

    let consent: LikenessConsent;
    let referencePath = this.referencePath(subject);
    let transcript = typeof input.transcript === 'string' && input.transcript.trim() ? input.transcript.trim() : script.text;
    let transcriptVerified: boolean | undefined;

    if (hasNewFile) {
      await onProgress({ phase: 'progress', message: 'Preparando la grabación', percent: 20 });
      referencePath = await this.prepareReference(subject, chosen!);
      const buffer = readFileSync(referencePath);
      const quality = checkVoiceReference(parseWav(buffer));
      if (!quality.ok) { rmSync(referencePath, { force: true }); throw new Error(`Grabación rechazada: ${quality.problems.join('; ')}. Graba de nuevo con calma y en un sitio silencioso.`); }
      if (this.options.transcribe) {
        await onProgress({ phase: 'progress', message: 'Comprobando que se lee el texto', percent: 45 });
        const heard = await this.options.transcribe(referencePath);
        if (typeof heard === 'string' && heard.trim()) {
          const match = transcriptMatch(transcript, heard);
          if (!match.ok) { rmSync(referencePath, { force: true }); throw new Error(`Lo que se oye no coincide con el texto (errores de palabras: ${Math.round(match.wordErrorRate * 100)} %). Vuelve a leerlo completo y con claridad.`); }
          transcriptVerified = true;
        }
      }
      const reference = { modality: 'voice' as const, localRef: referencePath, sha256: sha256(buffer), transcript, capturedAt: nowIso };
      consent = subject === 'founder'
        ? createLikenessConsent({
          id: `likeness-founder-voice-${now.getTime()}`, principalId, grantedBy: principalId, modalities: ['voice'], uses: [...FOUNDER_USES],
          products: ['janus'], grantedAt: nowIso, expiresAt: new Date(now.getTime() + 365 * DAY_MS).toISOString(), references: [reference],
        })
        : createGuardianLikenessConsent({
          id: `likeness-kendra-voice-${now.getTime()}`, principalId, guardianId: 'founder', guardianRelation: 'parent', childAssent: true,
          uses: [...KENDRA_USES], grantedAt: nowIso, expiresAt: new Date(now.getTime() + MINOR_MAX_CONSENT_DAYS * DAY_MS).toISOString(), references: [reference],
        });
      // One active consent per person: a new take supersedes the previous one.
      for (const previous of this.consentsOf(subject)) if (!previous.revokedAt) this.options.consents.save(revokeLikenessConsent(previous, nowIso));
      this.options.consents.save(consent);
      if (stage === 'enrolled') this.options.voices.remove(voiceId);
    } else {
      const active = this.activeConsent(subject);
      if (!active) {
        return { ok: false, error: `No hay una grabación autorizada de ${who}. Indica el archivo de la carpeta de entrada (disponibles: ${this.inboxFiles().join(', ') || 'ninguno'}).` };
      }
      const stored = active.references.find((reference) => reference.modality === 'voice');
      if (!stored || !existsSync(referencePath) || sha256(readFileSync(referencePath)) !== stored.sha256) {
        return { ok: false, error: 'La copia de referencia guardada no coincide con la aprobada; graba de nuevo.' };
      }
      consent = active;
      transcript = stored.transcript ?? transcript;
    }

    const modelPath = this.options.cloneModelPath;
    if (!modelPath) {
      return { ok: true, output: {
        reply: `🟡 Grabación de ${who} recibida y autorizada (consentimiento ${consent.id}). Queda guardada en el equipo, fuera de Git. Para generar la voz falta el equipo con el modelo Qwen3-TTS «Base» (JANUS_TTS_CLONE_MODEL_PATH). Cuando esté, repite «usa la grabación» y la registro sin grabar de nuevo.`,
        stage: 'recorded_waiting_for_host', consentId: consent.id, transcriptVerified: transcriptVerified ?? 'no_stt_check', missing: ['JANUS_TTS_CLONE_MODEL_PATH'],
      } };
    }

    await onProgress({ phase: 'progress', message: 'Registrando la voz para el motor local', percent: 80 });
    const enrolled = enrollVoiceClone({
      voiceId, referencePath, transcript, language: this.options.language ?? 'Spanish', modelPath, consent, product: 'janus', now: nowIso,
    });
    this.options.voices.upsert(voiceId, {
      ...enrolled.entry,
      // Hints for the voice gateway (ADR-012): where this voice may be used.
      allowed_uses: consent.uses,
      ...(subject === 'kendra' ? { restricted: true, subject_is_minor: true } : {}),
    });
    return { ok: true, output: {
      reply: `✅ ${who[0]!.toUpperCase()}${who.slice(1)} quedó registrada para el motor de voz local (${voiceId}). Cada audio sintético llevará el aviso «voz generada con IA». ${subject === 'kendra' ? 'Uso limitado al asistente privado de Janus; caduca en 6 meses. ' : ''}Esta voz no identifica ni autoriza a nadie. Calidad real y latencia: POR CONFIRMAR hasta oírla en el equipo.`,
      stage: 'enrolled', voiceId, consentId: consent.id, durationSeconds: Math.round(enrolled.quality.info.durationSeconds), transcriptVerified: transcriptVerified ?? 'no_stt_check',
    } };
  }

  private revoke(subject: CloneSubject): ToolResult {
    const { voiceId, who } = SUBJECTS[subject];
    const nowIso = this.now().toISOString();
    let revoked = 0;
    for (const consent of this.consentsOf(subject)) {
      if (!consent.revokedAt) { this.options.consents.save(revokeLikenessConsent(consent, nowIso)); revoked += 1; }
    }
    this.options.voices.remove(voiceId);
    rmSync(this.referencePath(subject), { force: true });
    return { ok: true, output: {
      reply: revoked
        ? `⛔ Revocada ${who}: la autorización queda anulada, la entrada del motor de voz se retira y la copia de referencia se borra. Tu archivo original sigue en la carpeta de entrada; bórralo tú si ya no lo quieres.`
        : `No había ninguna autorización activa de ${who}; me aseguré de que no quede entrada ni copia de referencia.`,
      stage: this.stage(subject), revoked,
    } };
  }
}
