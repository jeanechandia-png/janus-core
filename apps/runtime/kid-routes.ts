import { createHash, randomBytes, randomInt } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ModelGateway, ModelMessage } from '../../packages/gateways/src/contracts.js';
import type { SqliteStore } from '../../packages/core/src/sqlite-store.js';
import { OPEN_METEO_ATTRIBUTION } from '../../packages/adapters/src/open-meteo-adapter.js';
import {
  FileAttachmentStore,
  describeAttachmentsForMessage,
  classifyScan,
  isAttachmentId,
  stripAttachmentMarkers,
  type AttachmentSource,
} from '../../packages/modules/chat-attachments/src/index.js';
import {
  ACTIVITY_CATEGORIES,
  CAPS,
  CATEGORY_LABELS_ES,
  applyProfileUpdate,
  createPinRecord,
  decideFeedItem,
  dueReminders,
  dueSoonTasks,
  emptyKidState,
  evaluateAccess,
  evaluateMedia,
  kidSystemPrompt,
  localTime,
  newId,
  normalizeAgendaInput,
  normalizeFeedInput,
  normalizeInterestInput,
  normalizeProjectInput,
  normalizeTaskInput,
  outfitAdvice,
  overdueTasks,
  parseAgendaUtterance,
  parseHomeCommand,
  parseMediaRequest,
  projectProgress,
  reminderText,
  resolveHomeCommand,
  sanitizeKidState,
  screenKidText,
  setTaskStatus,
  summarizeActivity,
  toggleStep,
  upcomingAgenda,
  validateHomePolicy,
  validateLimits,
  validateMediaPolicy,
  validatePinFormat,
  verifyPin,
  visibleFeed,
  youtubeEmbedUrl,
  type ActivityEvent,
  type HomeAction,
  type HomeDevice,
  type HourForecast,
  type KidActivityCategory,
  type KidState,
  type PinRecord,
} from '../../packages/modules/kid-dashboard/src/index.js';

/**
 * Rutas del dashboard de la niña. Dos puertas distintas:
 *  · /api/kid/*     → dispositivo emparejado de la niña (token `kdv_…`, solo hash en SQLite; nunca autoridad de Founder).
 *  · /api/parent/kid/* → el tutor: sesión de Founder, o bien el dispositivo de la niña desbloqueado con el PIN parental.
 */

export interface HomeExecutor {
  execute(actions: HomeAction[]): Promise<{ ok: boolean; detail?: string }>;
}

export interface KidRoutesDeps {
  store: SqliteStore;
  now?: () => Date;
  json(response: ServerResponse, status: number, body: unknown): void;
  readJson(request: IncomingMessage): Promise<Record<string, unknown>>;
  readBodyBytes(request: IncomingMessage, limit: number): Promise<Buffer>;
  headerValue(request: IncomingMessage, name: string): string;
  requireFounder(request: IncomingMessage): unknown;
  errorStatus(error: unknown): number;
  errorBody(error: unknown): unknown;
  attachmentStore: FileAttachmentStore;
  model?: ModelGateway;
  homeInventory?: () => HomeDevice[];
  homeExecutor?: HomeExecutor;
  weather?: (input: { lat: number; lon: number; timeZone: string }) => Promise<Record<string, HourForecast[]>>;
  /** Criaturas disponibles (módulo companion): el anfitrión las inyecta; este archivo no importa el módulo. */
  companions?: Array<{ id: string; name: string; primary: string; glow: string; catchphrase: string; catchphrases?: string[] }>;
  defaultTimeZone?: string;
  maxModelCallsPerDay?: number;
}

class KidHttpError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

const sha = (value: string) => createHash('sha256').update(value).digest('hex');
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const KID_ID = /^[a-z][a-z0-9-]{1,23}$/;
const MAX_CHAT_CHARS = 500;

export function createKidRoutes(deps: KidRoutesDeps) {
  const { store, json } = deps;
  const now = deps.now ?? (() => new Date());
  const defaultTz = deps.defaultTimeZone ?? 'Europe/Amsterdam';
  const unlocks = new Map<string, { kidId: string; expires: number }>();
  const redeemFailures: number[] = [];
  const history = new Map<string, ModelMessage[]>();
  const modelCalls = new Map<string, number>();
  const weatherCache = new Map<string, { at: number; data: Record<string, HourForecast[]> }>();
  const lastHeartbeat = new Map<string, number>();
  const companionNames: Record<string, string> | undefined = deps.companions ? Object.fromEntries(deps.companions.map((item) => [item.id, item.name])) : undefined;

  // ── Estado ───────────────────────────────────────────────────────────────────────────────────────────────

  function loadState(kidId: string): { state: KidState; exists: boolean } {
    const row = store.kidGetState(kidId);
    if (!row) return { state: emptyKidState(kidId, defaultTz), exists: false };
    let parsed: unknown;
    try { parsed = JSON.parse(row.stateJson); } catch { parsed = undefined; }
    const state = sanitizeKidState(parsed, kidId);
    return { state: { ...state, revision: row.revision }, exists: true };
  }

  /** Aplica un cambio con compare-and-set (reintenta una vez si otro cambio se adelantó). */
  function mutate(kidId: string, change: (state: KidState) => Partial<KidState>): KidState {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const { state, exists } = loadState(kidId);
      const patch = change(state);
      const next: KidState = { ...state, ...patch, revision: state.revision + 1 };
      if (store.kidPutState(kidId, exists ? state.revision : -1, next.revision, JSON.stringify(next), now().toISOString())) return next;
    }
    throw new KidHttpError(409, 'Se cambió a la vez desde otro sitio. Inténtalo otra vez.');
  }

  // ── Autenticación ────────────────────────────────────────────────────────────────────────────────────────

  function bearer(request: IncomingMessage): string {
    const header = deps.headerValue(request, 'authorization');
    return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  }

  function kidSession(request: IncomingMessage): { deviceId: string; kidId: string } {
    const token = bearer(request);
    if (!token.startsWith('kdv_')) throw new KidHttpError(401, 'Este dispositivo no está emparejado.');
    const device = store.kidFindDeviceByTokenHash(sha(token));
    if (!device) throw new KidHttpError(401, 'Este dispositivo no está emparejado o fue desactivado.');
    store.kidTouchDevice(device.id, now().toISOString());
    return { deviceId: device.id, kidId: device.kidId };
  }

  function validKidId(value: unknown): string {
    const id = typeof value === 'string' && value ? value : 'kendra';
    if (!KID_ID.test(id)) throw new KidHttpError(400, 'Identificador de niña no válido.');
    return id;
  }

  /** Tutor: sesión de Founder, o dispositivo de la niña con PIN parental vigente. */
  function parentAuth(request: IncomingMessage, kidIdHint?: unknown): { kidId: string; via: 'founder' | 'pin' } {
    const unlock = deps.headerValue(request, 'x-janus-parent-unlock');
    if (unlock) {
      const kid = kidSession(request);
      const entry = unlocks.get(sha(unlock));
      if (!entry || entry.kidId !== kid.kidId || entry.expires < now().getTime()) throw new KidHttpError(403, 'El área de padres está bloqueada. Introduce el PIN.');
      return { kidId: kid.kidId, via: 'pin' };
    }
    deps.requireFounder(request);
    return { kidId: validKidId(kidIdHint), via: 'founder' };
  }

  function founderOnly(request: IncomingMessage, kidIdHint?: unknown): string {
    deps.requireFounder(request);
    return validKidId(kidIdHint);
  }

  // ── Utilidades de día/uso ────────────────────────────────────────────────────────────────────────────────

  function dayWindow(state: KidState, at: Date, daysAgo = 0) {
    const local = localTime(at, state.settings.timeZone);
    const start = new Date(at.getTime() - (local.minutesOfDay * 60 + at.getSeconds()) * 1000 - daysAgo * 86_400_000);
    return { ymd: local.ymd, startIso: start.toISOString(), endIso: new Date(start.getTime() + 86_400_000).toISOString() };
  }

  function usageToday(state: KidState, at: Date) {
    const { startIso, endIso } = dayWindow(state, at);
    const events = store.kidListActivity(state.kidId, startIso, endIso) as ActivityEvent[];
    return summarizeActivity(events, startIso, endIso);
  }

  function accessFor(state: KidState, category: KidActivityCategory, at: Date) {
    const today = localTime(at, state.settings.timeZone).ymd;
    return evaluateAccess({
      now: at,
      timeZone: state.settings.timeZone,
      category,
      usedTodayMinutes: usageToday(state, at).byCategory,
      limits: state.settings.limits,
      ...(state.bonus?.date === today ? { bonusMinutes: state.bonus.minutes } : {}),
    });
  }

  function flag(kidId: string, severity: string, categories: string[], summary: string): void {
    store.kidAddFlag({ kidId, at: now().toISOString(), severity, categories, summary });
  }

  async function outfitFor(state: KidState, at: Date) {
    const locality = state.settings.locality;
    if (!locality) return { configured: false as const };
    if (!deps.weather) return { configured: true as const, available: false as const, message: 'El servicio del tiempo no está activo.' };
    const key = `${locality.lat.toFixed(2)},${locality.lon.toFixed(2)}`;
    let entry = weatherCache.get(key);
    if (!entry || at.getTime() - entry.at > 30 * 60_000) {
      try {
        entry = { at: at.getTime(), data: await deps.weather({ lat: locality.lat, lon: locality.lon, timeZone: state.settings.timeZone }) };
        weatherCache.set(key, entry);
      } catch {
        return { configured: true as const, available: false as const, message: 'Ahora no pude mirar el tiempo.' };
      }
    }
    const today = localTime(at, state.settings.timeZone).ymd;
    const tomorrow = new Date(`${today}T00:00:00Z`); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const tomorrowYmd = tomorrow.toISOString().slice(0, 10);
    return {
      configured: true as const,
      available: true as const,
      place: locality.label,
      today: entry.data[today] ? outfitAdvice(entry.data[today]!) : null,
      tomorrow: entry.data[tomorrowYmd] ? outfitAdvice(entry.data[tomorrowYmd]!) : null,
      attribution: OPEN_METEO_ATTRIBUTION,
    };
  }

  // ── Vistas ───────────────────────────────────────────────────────────────────────────────────────────────

  async function kidView(state: KidState, at: Date) {
    const tz = state.settings.timeZone;
    const today = localTime(at, tz).ymd;
    const delivered = store.kidDeliveredReminderKeys(state.kidId);
    const inventory = deps.homeInventory?.() ?? [];
    const rooms = new Set(state.settings.home.allowedRooms.map((room) => room.toLowerCase()));
    return {
      profile: state.profile,
      today,
      access: accessFor(state, 'chat', at),
      limits: { allowedFrom: state.settings.limits.allowedFrom, allowedUntil: state.settings.limits.allowedUntil },
      usage: usageToday(state, at),
      agenda: upcomingAgenda(state.agenda, at, tz, 21),
      reminders: dueReminders(state.agenda, at, tz, delivered).map((due) => ({ key: due.key, text: reminderText(due) })),
      tasks: { overdue: overdueTasks(state.tasks, today), soon: dueSoonTasks(state.tasks, today, 7), all: state.tasks.filter((task) => task.status !== 'hecha').slice(0, 50) },
      projects: state.projects.map((project) => ({ ...project, progress: projectProgress(project.id, state.tasks) })),
      interests: state.interests,
      feed: visibleFeed(state.feed, today).map(({ url: _hidden, ...item }) => item),
      videos: state.settings.media.youtube.mode === 'allowlist' ? state.settings.media.youtube.videos.map((video) => ({ id: video.id, label: video.label, embedUrl: youtubeEmbedUrl(video.id) })) : [],
      home: { enabled: state.settings.home.enabled, devices: state.settings.home.enabled ? inventory.filter((device) => rooms.has(device.room.toLowerCase()) || (device.tags ?? []).includes('kendra')).map((device) => device.name) : [] },
      outfit: await outfitFor(state, at),
      categories: CATEGORY_LABELS_ES,
      creatures: deps.companions ?? [],
    };
  }

  function parentView(state: KidState, at: Date) {
    const tz = state.settings.timeZone;
    const days = Array.from({ length: 7 }, (_, index) => {
      const window = dayWindow(state, at, index);
      const events = store.kidListActivity(state.kidId, window.startIso, window.endIso) as ActivityEvent[];
      return { date: localTime(new Date(window.startIso), tz).ymd, ...summarizeActivity(events, window.startIso, window.endIso) };
    });
    return {
      kidId: state.kidId,
      profile: state.profile,
      settings: state.settings,
      pinSet: Boolean(store.kidGetPin(state.kidId)),
      today: days[0],
      week: days,
      flags: store.kidListFlags(state.kidId, 30),
      devices: store.kidListDevices(state.kidId),
      pendingFeed: state.feed.filter((item) => item.status === 'pending'),
      mediaRequests: state.mediaRequests.filter((request) => request.status === 'pending'),
      transcripts: state.settings.transcriptVisibility === 'full' ? store.kidListTranscripts(state.kidId, 60) : undefined,
      categories: CATEGORY_LABELS_ES,
      bonus: state.bonus,
    };
  }

  // ── Chat ─────────────────────────────────────────────────────────────────────────────────────────────────

  async function chat(kid: { kidId: string }, body: Record<string, unknown>) {
    const at = now();
    const { state } = loadState(kid.kidId);
    const typed = typeof body.text === 'string' ? stripAttachmentMarkers(body.text).trim().slice(0, MAX_CHAT_CHARS) : '';
    if (!typed) throw new KidHttpError(400, 'Escribe o dicta algo.');

    const access = accessFor(state, 'chat', at);
    if (!access.allowed) return { reply: access.message, blocked: 'access' as const, access };

    const input = screenKidText(typed, 'input');
    if (input.parentFlag) flag(kid.kidId, input.severity, input.categories, input.parentFlag.summary);
    if (!input.allowed || (input.severity === 'note' && input.kidMessage)) {
      return { reply: input.kidMessage ?? 'Mejor hablamos de otra cosa. 😊', blocked: 'safety' as const, severity: input.severity };
    }

    // Adjuntos (perfil «kid»): solo identificadores; la descripción la construye el servidor.
    const ids = Array.isArray(body.attachments) ? body.attachments.filter(isAttachmentId).slice(0, 3) : [];
    const scanInputs = Array.isArray(body.scans) ? body.scans.slice(0, 2) : [];
    let block = '';
    if (ids.length > 0 || scanInputs.length > 0) {
      const { refs, missing } = deps.attachmentStore.refsFor(ids, `kid:${kid.kidId}`);
      if (missing.length > 0) throw new KidHttpError(400, 'Un adjunto ya no existe.');
      const scans = scanInputs.filter((item): item is { raw: string; format?: string } => !!item && typeof (item as { raw?: unknown }).raw === 'string').map((item) => classifyScan(item.raw.slice(0, 1000), typeof item.format === 'string' ? item.format : undefined));
      block = describeAttachmentsForMessage(refs, scans);
      const screened = screenKidText(block, 'input');
      if (!screened.allowed) {
        if (screened.parentFlag) flag(kid.kidId, screened.severity, screened.categories, `Un adjunto: ${screened.parentFlag.summary}`);
        return { reply: screened.kidMessage ?? 'Ese archivo no lo puedo usar.', blocked: 'safety' as const, severity: screened.severity };
      }
    }

    if (state.settings.transcriptVisibility === 'full') store.kidAppendTranscript({ kidId: kid.kidId, at: at.toISOString(), role: 'kid', text: typed });

    let reply = 'Hoy no puedo pensar muy lejos, pero puedo ayudarte con tu agenda, tus tareas o la casa. 😊';
    const cap = deps.maxModelCallsPerDay ?? 80;
    const key = `${kid.kidId}:${localTime(at, state.settings.timeZone).ymd}`;
    if (deps.model && (modelCalls.get(key) ?? 0) < cap) {
      modelCalls.set(key, (modelCalls.get(key) ?? 0) + 1);
      const past = history.get(kid.kidId) ?? [];
      const messages: ModelMessage[] = [
        { role: 'system', content: kidSystemPrompt({ displayName: state.profile.displayName, ...(companionNames?.[state.profile.companionId] ? { companionName: companionNames[state.profile.companionId]! } : {}) }) },
        ...past.slice(-6),
        { role: 'user', content: block ? `${typed}\n\n${block}` : typed },
      ];
      try {
        const response = await deps.model.complete({ messages, temperature: 0.7 });
        reply = response.text.trim().slice(0, 1200) || reply;
        const turn: ModelMessage[] = [{ role: 'user', content: typed }, { role: 'assistant', content: reply }];
        history.set(kid.kidId, [...past, ...turn].slice(-12));
      } catch {
        reply = 'Uy, ahora mismo no me sale la respuesta. ¿Probamos otra vez en un ratito?';
      }
    } else if (deps.model) {
      reply = 'Hoy ya hablamos mucho. ¡Mañana seguimos! 🌙';
    }

    const output = screenKidText(reply, 'output');
    if (output.parentFlag) flag(kid.kidId, output.severity, output.categories, `Respuesta filtrada: ${output.parentFlag.summary}`);
    reply = output.allowed ? output.text : (output.kidMessage ?? reply);
    if (state.settings.transcriptVisibility === 'full') store.kidAppendTranscript({ kidId: kid.kidId, at: now().toISOString(), role: 'companion', text: reply });
    return { reply, blocked: null, access };
  }

  // ── Router ───────────────────────────────────────────────────────────────────────────────────────────────

  return async function handle(request: IncomingMessage, response: ServerResponse, url: URL): Promise<boolean> {
    const path = url.pathname;
    if (!path.startsWith('/api/kid/') && !path.startsWith('/api/parent/kid/')) return false;
    const method = request.method ?? 'GET';
    const at = now();

    try {
      // ── Emparejamiento ─────────────────────────────────────────────────────────────────────────────────
      if (method === 'POST' && path === '/api/parent/kid/pairing') {
        const body = await deps.readJson(request);
        const kidId = founderOnly(request, body.kidId);
        let code = '';
        for (let index = 0; index < 8; index += 1) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
        const expiresAt = new Date(at.getTime() + 10 * 60_000).toISOString();
        store.kidInsertPairingCode({ codeHash: sha(code), kidId, createdAt: at.toISOString(), expiresAt });
        json(response, 201, { ok: true, code: `${code.slice(0, 4)}-${code.slice(4)}`, expiresAt, note: 'Un solo uso. Introdúcelo en el dispositivo de la niña.' });
        return true;
      }

      if (method === 'POST' && path === '/api/kid/redeem') {
        const recent = redeemFailures.filter((time) => at.getTime() - time < 10 * 60_000);
        redeemFailures.length = 0; redeemFailures.push(...recent);
        if (recent.length >= 10) throw new KidHttpError(429, 'Demasiados intentos. Espera unos minutos.');
        const body = await deps.readJson(request);
        const code = typeof body.code === 'string' ? body.code.toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
        const kidId = code.length === 8 ? store.kidConsumePairingCode(sha(code), at.toISOString()) : undefined;
        if (!kidId) { redeemFailures.push(at.getTime()); throw new KidHttpError(400, 'Ese código no sirve o ya caducó. Pídele a papá uno nuevo.'); }
        const token = `kdv_${randomBytes(32).toString('base64url')}`;
        const label = (typeof body.label === 'string' ? body.label.replace(/[^\p{L}\p{N} ._-]/gu, '').trim().slice(0, 40) : '') || 'Dispositivo de la niña';
        store.kidInsertDevice({ id: newId('dev'), kidId, tokenHash: sha(token), label, createdAt: at.toISOString() });
        json(response, 201, { ok: true, token, kidId });
        return true;
      }

      // ── Parte de la niña ───────────────────────────────────────────────────────────────────────────────
      if (path.startsWith('/api/kid/')) {
        const kid = kidSession(request);

        if (method === 'GET' && path === '/api/kid/state') {
          const { state } = loadState(kid.kidId);
          json(response, 200, { ok: true, ...(await kidView(state, at)) });
          return true;
        }
        if (method === 'PUT' && path === '/api/kid/profile') {
          const body = await deps.readJson(request);
          const { state } = loadState(kid.kidId);
          const result = applyProfileUpdate(state.profile, body);
          if (!result.ok) throw new KidHttpError(400, result.message);
          if (!(companionNames ? result.profile.companionId in companionNames : true)) throw new KidHttpError(400, 'Esa criatura no existe.');
          const next = mutate(kid.kidId, () => ({ profile: result.profile }));
          json(response, 200, { ok: true, profile: next.profile });
          return true;
        }
        if (method === 'POST' && path === '/api/kid/chat') {
          json(response, 200, { ok: true, ...(await chat(kid, await deps.readJson(request))) });
          return true;
        }
        if (method === 'POST' && path === '/api/kid/activity') {
          const body = await deps.readJson(request);
          const category = String(body.category ?? '') as KidActivityCategory;
          if (!(ACTIVITY_CATEGORIES as readonly string[]).includes(category)) throw new KidHttpError(400, 'Actividad no válida.');
          const last = lastHeartbeat.get(kid.deviceId) ?? 0;
          const seconds = Math.min(60, Math.max(0, Math.round(Number(body.seconds) || 0)));
          if (seconds > 0 && at.getTime() - last >= 8_000) {
            lastHeartbeat.set(kid.deviceId, at.getTime());
            store.kidAppendActivity({ kidId: kid.kidId, at: at.toISOString(), category, seconds });
          }
          const { state } = loadState(kid.kidId);
          json(response, 200, { ok: true, access: accessFor(state, category, at) });
          return true;
        }
        if (method === 'POST' && path === '/api/kid/reminders/ack') {
          const body = await deps.readJson(request);
          for (const key of (Array.isArray(body.keys) ? body.keys : []).slice(0, 20)) if (typeof key === 'string' && /^[\w-]{3,60}:\d{1,4}$/.test(key)) store.kidMarkReminderDelivered(kid.kidId, key, at.toISOString());
          json(response, 200, { ok: true });
          return true;
        }
        if (method === 'POST' && path === '/api/kid/agenda') {
          const body = await deps.readJson(request);
          const { state } = loadState(kid.kidId);
          const draft = typeof body.text === 'string' ? parseAgendaUtterance(body.text, at, state.settings.timeZone) : null;
          if (typeof body.text === 'string' && !draft) throw new KidHttpError(400, 'No entendí la fecha. Prueba: «el sábado tengo el cumple de mi prima».');
          const checked = normalizeAgendaInput(draft ?? body, 'kid');
          if (!checked.ok) throw new KidHttpError(400, checked.message);
          if (state.agenda.length >= CAPS.agenda) throw new KidHttpError(409, 'La agenda está llena.');
          const item = { id: newId('ag'), ...checked.item };
          mutate(kid.kidId, (current) => ({ agenda: [...current.agenda, item] }));
          json(response, 201, { ok: true, item });
          return true;
        }
        const agendaDone = path.match(/^\/api\/kid\/agenda\/(ag_[a-z0-9-]{6,40})\/done$/);
        if (method === 'POST' && agendaDone) {
          mutate(kid.kidId, (current) => ({ agenda: current.agenda.map((item) => (item.id === agendaDone[1] ? { ...item, done: true } : item)) }));
          json(response, 200, { ok: true });
          return true;
        }
        if (method === 'POST' && path === '/api/kid/tasks') {
          const body = await deps.readJson(request);
          const { state } = loadState(kid.kidId);
          const checked = normalizeTaskInput(body, 'kid', state.projects.map((project) => project.id));
          if (!checked.ok) throw new KidHttpError(400, checked.message);
          if (state.tasks.length >= CAPS.tasks) throw new KidHttpError(409, 'Hay demasiadas tareas. Termina algunas primero.');
          const task = { id: newId('task'), ...checked.task };
          mutate(kid.kidId, (current) => ({ tasks: [...current.tasks, task] }));
          json(response, 201, { ok: true, task });
          return true;
        }
        const taskStatus = path.match(/^\/api\/kid\/tasks\/(task_[a-z0-9-]{6,40})\/(status|step)$/);
        if (method === 'POST' && taskStatus) {
          const body = await deps.readJson(request);
          if (taskStatus[2] === 'status') {
            if (!['pendiente', 'en-curso', 'hecha'].includes(String(body.status))) throw new KidHttpError(400, 'Estado no válido.');
            mutate(kid.kidId, (current) => ({ tasks: setTaskStatus(current.tasks, taskStatus[1]!, body.status as 'pendiente' | 'en-curso' | 'hecha', at.toISOString()) }));
          } else {
            const index = Number(body.index);
            if (!Number.isInteger(index) || index < 0 || index > 11) throw new KidHttpError(400, 'Paso no válido.');
            mutate(kid.kidId, (current) => ({ tasks: toggleStep(current.tasks, taskStatus[1]!, index) }));
          }
          json(response, 200, { ok: true });
          return true;
        }
        if (method === 'POST' && path === '/api/kid/projects') {
          const checked = normalizeProjectInput(await deps.readJson(request));
          if (!checked.ok) throw new KidHttpError(400, checked.message);
          const { state } = loadState(kid.kidId);
          if (state.projects.length >= CAPS.projects) throw new KidHttpError(409, 'Hay demasiados proyectos.');
          const project = { id: newId('proj'), ...checked.project };
          mutate(kid.kidId, (current) => ({ projects: [...current.projects, project] }));
          json(response, 201, { ok: true, project });
          return true;
        }
        if (method === 'POST' && path === '/api/kid/interests') {
          const checked = normalizeInterestInput(await deps.readJson(request));
          if (!checked.ok) throw new KidHttpError(400, checked.message);
          const { state } = loadState(kid.kidId);
          if (state.interests.length >= CAPS.interests) throw new KidHttpError(409, 'Ya tienes muchos intereses.');
          const interest = { id: newId('int'), ...checked.interest };
          mutate(kid.kidId, (current) => ({ interests: [...current.interests, interest] }));
          json(response, 201, { ok: true, interest });
          return true;
        }

        if (method === 'POST' && path === '/api/kid/home') {
          const body = await deps.readJson(request);
          const text = typeof body.text === 'string' ? body.text.trim().slice(0, 200) : '';
          const { state } = loadState(kid.kidId);
          const access = accessFor(state, 'home', at);
          if (!access.allowed) { json(response, 200, { ok: true, status: 'blocked', message: access.message }); return true; }
          const command = parseHomeCommand(text);
          if (!command) { json(response, 200, { ok: true, status: 'unknown', message: 'No entendí qué quieres hacer en la casa. Prueba: «apaga la luz de la cama».' }); return true; }
          const resolution = resolveHomeCommand(command, deps.homeInventory?.() ?? [], state.settings.home);
          if (resolution.status !== 'ok') { json(response, 200, { ok: true, ...resolution }); return true; }
          if (!deps.homeExecutor) {
            store.kidAppendActivity({ kidId: kid.kidId, at: at.toISOString(), category: 'home', seconds: 0, detail: `[sin ejecutar: la casa aún no está conectada] ${resolution.summary}` });
            json(response, 200, { ok: true, status: 'dormant', message: 'Todavía no estoy conectado a las luces de la casa. Se lo digo a papá. 💡', planned: resolution.summary });
            return true;
          }
          const result = await deps.homeExecutor.execute(resolution.actions);
          store.kidAppendActivity({ kidId: kid.kidId, at: at.toISOString(), category: 'home', seconds: 0, detail: `${result.ok ? '' : '[falló] '}${resolution.summary}` });
          json(response, 200, { ok: true, status: result.ok ? 'done' : 'failed', message: result.ok ? resolution.summary : 'No pude hacerlo ahora. Se lo digo a papá.' });
          return true;
        }

        if (method === 'POST' && path === '/api/kid/media') {
          const body = await deps.readJson(request);
          const text = typeof body.text === 'string' ? body.text.trim().slice(0, 200) : '';
          const { state } = loadState(kid.kidId);
          const intent = parseMediaRequest(text);
          if (!intent) { json(response, 200, { ok: true, status: 'unknown', message: 'No entendí. Prueba: «ponme vídeos de baile».' }); return true; }
          const category: KidActivityCategory = intent.kind === 'youtube.open' ? 'youtube' : 'tv';
          const access = accessFor(state, category, at);
          if (!access.allowed) { json(response, 200, { ok: true, status: 'blocked', message: access.message }); return true; }
          const decision = evaluateMedia(intent, state.settings.media);
          if (decision.decision === 'needs-parent') {
            const duplicate = state.mediaRequests.some((request) => request.status === 'pending' && request.text === decision.requestText);
            if (!duplicate) mutate(kid.kidId, (current) => ({ mediaRequests: [...current.mediaRequests, { id: newId('mreq'), text: decision.requestText, at: at.toISOString(), status: 'pending' as const }].slice(-CAPS.mediaRequests) }));
            json(response, 200, { ok: true, status: 'needs-parent', message: decision.message });
            return true;
          }
          if (decision.decision === 'deny') { json(response, 200, { ok: true, status: 'denied', message: decision.message }); return true; }
          if (intent.kind !== 'youtube.open') {
            // Tele y Netflix: aún sin conexión al equipo (POR CONFIRMAR: modelo de tele y método de control).
            store.kidAppendActivity({ kidId: kid.kidId, at: at.toISOString(), category: 'tv', seconds: 0, detail: `[sin ejecutar: la tele aún no está conectada] ${intent.kind}` });
            json(response, 200, { ok: true, status: 'dormant', message: 'Todavía no estoy conectado a la tele. Se lo digo a papá. 📺' });
            return true;
          }
          json(response, 200, { ok: true, status: 'allow', message: decision.message, videos: (decision.videos ?? []).map((video) => ({ id: video.id, label: video.label, embedUrl: youtubeEmbedUrl(video.id) })) });
          return true;
        }

        if (method === 'POST' && path === '/api/kid/attachments') {
          const source = deps.headerValue(request, 'x-attachment-source') as AttachmentSource;
          if (!['device-file', 'photo', 'scan', 'document'].includes(source)) throw new KidHttpError(400, 'Fuente no válida.');
          let name = '';
          try { name = decodeURIComponent(deps.headerValue(request, 'x-attachment-name')); } catch { name = ''; }
          const bytes = await deps.readBodyBytes(request, 8 * 1024 * 1024);
          const result = deps.attachmentStore.put({ bytes, claimedName: name, claimedType: deps.headerValue(request, 'content-type'), source, profile: 'kid', principalId: `kid:${kid.kidId}` });
          if (!result.ok) { json(response, result.status, { ok: false, code: result.code, error: result.message }); return true; }
          store.kidAppendActivity({ kidId: kid.kidId, at: at.toISOString(), category: 'camera', seconds: 0, detail: `adjunto ${result.attachment.type}` });
          json(response, 201, { ok: true, id: result.attachment.id, sha256: result.attachment.sha256, name: result.attachment.name, type: result.attachment.type, size: result.attachment.size });
          return true;
        }

        if (method === 'POST' && path === '/api/kid/parent/unlock') {
          const body = await deps.readJson(request);
          const record = store.kidGetPin(kid.kidId) as PinRecord | undefined;
          const check = verifyPin(record, body.pin, at);
          if (check.result === 'no-pin') throw new KidHttpError(409, 'Todavía no hay PIN de padres. Créalo desde el panel de Janus.');
          if (check.record) store.kidPutPin(kid.kidId, check.record, at.toISOString());
          if (check.result === 'locked') throw new KidHttpError(429, `Bloqueado por seguridad. Prueba de nuevo en ${Math.ceil(check.retryAfterSeconds / 60)} min.`);
          if (check.result === 'wrong') throw new KidHttpError(403, `PIN incorrecto. Te quedan ${check.attemptsLeft} intentos.`);
          const token = `ulk_${randomBytes(24).toString('base64url')}`;
          const expires = at.getTime() + 10 * 60_000;
          for (const [hash, entry] of unlocks) if (entry.expires < at.getTime()) unlocks.delete(hash);
          unlocks.set(sha(token), { kidId: kid.kidId, expires });
          json(response, 200, { ok: true, unlockToken: token, expiresAt: new Date(expires).toISOString() });
          return true;
        }
        throw new KidHttpError(404, 'No encontrado.');
      }

      // ── Parte del tutor ────────────────────────────────────────────────────────────────────────────────
      if (method === 'GET' && path === '/api/parent/kid/overview') {
        const { kidId } = parentAuth(request, url.searchParams.get('kidId'));
        const { state } = loadState(kidId);
        json(response, 200, { ok: true, ...parentView(state, at) });
        return true;
      }
      if (method === 'PUT' && path === '/api/parent/kid/settings') {
        const body = await deps.readJson(request);
        const { kidId } = parentAuth(request, body.kidId);
        const { state } = loadState(kidId);
        const patch: Partial<KidState['settings']> = {};
        if (body.limits !== undefined) { const r = validateLimits(body.limits); if (!r.ok) throw new KidHttpError(400, r.message); patch.limits = r.limits; }
        if (body.media !== undefined) { const r = validateMediaPolicy(body.media); if (!r.ok) throw new KidHttpError(400, r.message); patch.media = r.policy; }
        if (body.home !== undefined) { const r = validateHomePolicy(body.home); if (!r.ok) throw new KidHttpError(400, r.message); patch.home = r.policy; }
        if (body.transcriptVisibility !== undefined) {
          if (body.transcriptVisibility !== 'flags' && body.transcriptVisibility !== 'full') throw new KidHttpError(400, 'Visibilidad no válida.');
          patch.transcriptVisibility = body.transcriptVisibility;
        }
        if (body.timeZone !== undefined) {
          if (typeof body.timeZone !== 'string' || !/^[A-Za-z_]+(?:\/[A-Za-z_+-]+){0,2}$/.test(body.timeZone)) throw new KidHttpError(400, 'Zona horaria no válida.');
          try { new Intl.DateTimeFormat('en', { timeZone: body.timeZone }); } catch { throw new KidHttpError(400, 'Zona horaria desconocida.'); }
          patch.timeZone = body.timeZone;
        }
        if (body.locality !== undefined) {
          const place = body.locality as { label?: unknown; lat?: unknown; lon?: unknown } | null;
          if (place === null) patch.locality = undefined;
          else {
            const lat = Number(place?.lat); const lon = Number(place?.lon);
            if (typeof place?.label !== 'string' || !place.label.trim() || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new KidHttpError(400, 'La zona necesita nombre, latitud y longitud válidos.');
            patch.locality = { label: place.label.trim().slice(0, 60), lat, lon };
          }
        }
        const next = mutate(kidId, (current) => ({ settings: { ...current.settings, ...patch } }));
        json(response, 200, { ok: true, settings: next.settings, revision: next.revision, was: state.revision });
        return true;
      }
      if (method === 'POST' && path === '/api/parent/kid/pin') {
        const body = await deps.readJson(request);
        const kidId = founderOnly(request, body.kidId);
        const format = validatePinFormat(body.pin);
        if (!format.ok) throw new KidHttpError(400, format.message);
        store.kidPutPin(kidId, createPinRecord(String(body.pin), at), at.toISOString());
        json(response, 200, { ok: true });
        return true;
      }
      if (method === 'POST' && path === '/api/parent/kid/bonus') {
        const body = await deps.readJson(request);
        const { kidId } = parentAuth(request, body.kidId);
        const minutes = Math.round(Number(body.minutes));
        if (!Number.isFinite(minutes) || minutes < 0 || minutes > 120) throw new KidHttpError(400, 'Los minutos extra deben estar entre 0 y 120.');
        const { state } = loadState(kidId);
        const today = localTime(at, state.settings.timeZone).ymd;
        mutate(kidId, () => ({ bonus: { date: today, minutes } }));
        json(response, 200, { ok: true });
        return true;
      }
      if (method === 'POST' && path === '/api/parent/kid/feed') {
        const body = await deps.readJson(request);
        const { kidId } = parentAuth(request, body.kidId);
        const { state } = loadState(kidId);
        const checked = normalizeFeedInput(body.item, typeof body.source === 'string' ? body.source : 'tutor', state.interests);
        if (!checked.ok) throw new KidHttpError(400, checked.message);
        if (state.feed.length >= CAPS.feed) throw new KidHttpError(409, 'La lista está llena; retira cosas antiguas.');
        // El tutor la crea → queda aprobada; lo que proponga Janus entra como «pending».
        const approved = body.approve !== false;
        const item = { id: newId('feed'), ...checked.item, status: approved ? ('approved' as const) : ('pending' as const), proposedAt: at.toISOString(), ...(approved ? { decidedAt: at.toISOString() } : {}) };
        mutate(kidId, (current) => ({ feed: [...current.feed, item] }));
        json(response, 201, { ok: true, item });
        return true;
      }
      const feedDecision = path.match(/^\/api\/parent\/kid\/feed\/(feed_[a-z0-9-]{6,40})\/decision$/);
      if (method === 'POST' && feedDecision) {
        const body = await deps.readJson(request);
        const { kidId } = parentAuth(request, body.kidId);
        if (body.decision !== 'approved' && body.decision !== 'rejected') throw new KidHttpError(400, 'Decisión no válida.');
        mutate(kidId, (current) => ({ feed: decideFeedItem(current.feed, feedDecision[1]!, body.decision as 'approved' | 'rejected', at.toISOString()) }));
        json(response, 200, { ok: true });
        return true;
      }
      const mediaDismiss = path.match(/^\/api\/parent\/kid\/media-requests\/(mreq_[a-z0-9-]{6,40})\/dismiss$/);
      if (method === 'POST' && mediaDismiss) {
        const body = await deps.readJson(request);
        const { kidId } = parentAuth(request, body.kidId);
        mutate(kidId, (current) => ({ mediaRequests: current.mediaRequests.map((item) => (item.id === mediaDismiss[1] ? { ...item, status: 'dismissed' as const } : item)) }));
        json(response, 200, { ok: true });
        return true;
      }
      if (method === 'POST' && path === '/api/parent/kid/agenda') {
        const body = await deps.readJson(request);
        const { kidId } = parentAuth(request, body.kidId);
        const checked = normalizeAgendaInput(body.item ?? body, 'parent');
        if (!checked.ok) throw new KidHttpError(400, checked.message);
        const item = { id: newId('ag'), ...checked.item };
        mutate(kidId, (current) => ({ agenda: [...current.agenda, item].slice(-CAPS.agenda) }));
        json(response, 201, { ok: true, item });
        return true;
      }
      if (method === 'POST' && path === '/api/parent/kid/tasks') {
        const body = await deps.readJson(request);
        const { kidId } = parentAuth(request, body.kidId);
        const { state } = loadState(kidId);
        const checked = normalizeTaskInput(body.task ?? body, 'parent', state.projects.map((project) => project.id));
        if (!checked.ok) throw new KidHttpError(400, checked.message);
        const task = { id: newId('task'), ...checked.task };
        mutate(kidId, (current) => ({ tasks: [...current.tasks, task].slice(-CAPS.tasks) }));
        json(response, 201, { ok: true, task });
        return true;
      }
      if (method === 'POST' && path === '/api/parent/kid/flags/seen') {
        const body = await deps.readJson(request);
        const { kidId } = parentAuth(request, body.kidId);
        store.kidMarkFlagsSeen(kidId, at.toISOString());
        json(response, 200, { ok: true });
        return true;
      }
      const deviceRevoke = path.match(/^\/api\/parent\/kid\/devices\/(dev_[a-z0-9-]{6,40})$/);
      if (method === 'DELETE' && deviceRevoke) {
        const kidId = founderOnly(request, url.searchParams.get('kidId'));
        if (!store.kidRevokeDevice(kidId, deviceRevoke[1]!, at.toISOString())) throw new KidHttpError(404, 'Dispositivo no encontrado.');
        json(response, 200, { ok: true });
        return true;
      }
      throw new KidHttpError(404, 'No encontrado.');
    } catch (error) {
      if (error instanceof KidHttpError) json(response, error.status, { ok: false, error: error.message });
      else json(response, deps.errorStatus(error), deps.errorBody(error));
      return true;
    }
  };
}

