import { normalizeText } from './time.js';

/**
 * Vídeo y tele para una menor: NUNCA «YouTube abierto». Solo lo que el tutor aprobó (canales y vídeos concretos).
 * Si la niña pide algo que no está aprobado, se crea una petición para el tutor; no se reproduce nada hasta que él decida.
 */

export interface ApprovedChannel { id: string; label: string }
export interface ApprovedVideo { id: string; label: string; channelId?: string }

export interface MediaPolicy {
  youtube: { mode: 'allowlist' | 'off'; channels: ApprovedChannel[]; videos: ApprovedVideo[] };
  netflix: { mode: 'kids-profile-only' | 'off'; kidsProfileName?: string };
  tv: { allowPower: boolean };
}

export const DEFAULT_MEDIA_POLICY: MediaPolicy = {
  youtube: { mode: 'allowlist', channels: [], videos: [] },
  netflix: { mode: 'off' },
  tv: { allowPower: false },
};

export type MediaIntent =
  | { kind: 'youtube.open'; query?: string }
  | { kind: 'netflix.open' }
  | { kind: 'tv.power'; on: boolean };

const YT_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const YT_CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;

export function isYoutubeVideoId(value: unknown): value is string { return typeof value === 'string' && YT_VIDEO_ID.test(value); }
export function isYoutubeChannelId(value: unknown): value is string { return typeof value === 'string' && YT_CHANNEL_ID.test(value); }

/** Acepta un ID de vídeo o una URL de youtube.com/youtu.be y devuelve solo el ID (el tutor pega enlaces, la app guarda IDs). */
export function extractYoutubeVideoId(input: string): string | null {
  const text = input.trim();
  if (isYoutubeVideoId(text)) return text;
  try {
    const url = new URL(text);
    const host = url.hostname.replace(/^www\.|^m\./, '');
    if (host === 'youtu.be') return isYoutubeVideoId(url.pathname.slice(1, 12)) ? url.pathname.slice(1, 12) : null;
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      const v = url.searchParams.get('v');
      if (isYoutubeVideoId(v)) return v;
      const embed = url.pathname.match(/^\/(?:embed|shorts)\/([A-Za-z0-9_-]{11})/);
      if (embed) return embed[1]!;
    }
  } catch { /* no es una URL */ }
  return null;
}

/** URL del reproductor incrustado: dominio sin cookies, sin vídeos relacionados de otros canales, sin anotaciones. */
export function youtubeEmbedUrl(videoId: string): string {
  if (!isYoutubeVideoId(videoId)) throw new Error('ID de vídeo no válido');
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&iv_load_policy=3&playsinline=1`;
}

export function parseMediaRequest(text: string): MediaIntent | null {
  const norm = normalizeText(text);
  const tv = norm.match(/\b(enciende|enciendeme|prende|prendeme|pon|ponme|apaga|apagame)\s+(?:la\s+)?(tele|television|tv)\b/);
  if (tv) return { kind: 'tv.power', on: !/apaga/.test(tv[1]!) };
  if (/\b(pon|ponme|abre|abreme|quiero ver|quiero abrir|enciende)\s+(?:el\s+)?netflix\b/.test(norm) || norm === 'netflix') return { kind: 'netflix.open' };
  const yt = norm.match(/\b(?:pon|ponme|abre|abreme|quiero ver|busca|buscame|enciende)\s+(.*?)\s*(?:en\s+)?youtube\b/);
  if (yt) {
    const query = (yt[1] ?? '').replace(/^(?:unos|unas|los|las|el|la|un|una)\s+/, '').replace(/^(?:videos?|canal)\s+(?:de\s+)?/, '').trim();
    return query ? { kind: 'youtube.open', query } : { kind: 'youtube.open' };
  }
  const videos = norm.match(/\b(?:pon|ponme|quiero ver|busca|buscame)\s+(?:unos\s+|los\s+)?videos?\s+de\s+(.+)$/);
  if (videos) return { kind: 'youtube.open', query: videos[1]!.trim() };
  if (norm === 'youtube') return { kind: 'youtube.open' };
  return null;
}

export type MediaDecision =
  | { decision: 'allow'; message: string; videos?: ApprovedVideo[]; channels?: ApprovedChannel[] }
  | { decision: 'needs-parent'; message: string; requestText: string }
  | { decision: 'deny'; message: string };

const STOP = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'en', 'y', 'videos', 'video', 'canal']);
const tokens = (text: string) => normalizeText(text).split(' ').filter((word) => word && !STOP.has(word));

export function evaluateMedia(intent: MediaIntent, policy: MediaPolicy): MediaDecision {
  if (intent.kind === 'tv.power') {
    return policy.tv.allowPower
      ? { decision: 'allow', message: intent.on ? 'Voy a encender la tele.' : 'Voy a apagar la tele.' }
      : { decision: 'deny', message: 'La tele la controlan papá o mamá por ahora.' };
  }
  if (intent.kind === 'netflix.open') {
    return policy.netflix.mode === 'kids-profile-only'
      ? { decision: 'allow', message: `Abro Netflix con el perfil infantil${policy.netflix.kidsProfileName ? ` «${policy.netflix.kidsProfileName}»` : ''}.` }
      : { decision: 'deny', message: 'Netflix lo abre papá o mamá por ahora.' };
  }
  // YouTube
  if (policy.youtube.mode === 'off') return { decision: 'deny', message: 'Los vídeos están apagados por ahora.' };
  const { channels, videos } = policy.youtube;
  if (!intent.query) {
    return channels.length + videos.length > 0
      ? { decision: 'allow', message: 'Estos son tus vídeos aprobados. ¡Elige uno!', videos, channels }
      : { decision: 'needs-parent', message: 'Todavía no hay vídeos aprobados. Le aviso a papá para que te prepare algunos. 💌', requestText: 'Quiere ver vídeos (aún no hay ninguno aprobado).' };
  }
  const wanted = tokens(intent.query);
  const matches = wanted.length === 0 ? [] : videos.filter((video) => {
    const haystack = tokens(video.label);
    return wanted.every((word) => haystack.some((candidate) => candidate.includes(word) || word.includes(candidate)));
  });
  const matchedChannels = wanted.length === 0 ? [] : channels.filter((channel) => {
    const haystack = tokens(channel.label);
    return wanted.every((word) => haystack.some((candidate) => candidate.includes(word) || word.includes(candidate)));
  });
  if (matches.length + matchedChannels.length > 0) {
    return { decision: 'allow', message: 'Mira lo que encontré aprobado para ti.', videos: matches, channels: matchedChannels };
  }
  return { decision: 'needs-parent', message: 'Eso todavía no está aprobado. Le pregunto a papá y te aviso. 💌', requestText: `Quiere ver: ${intent.query.slice(0, 120)}` };
}

export function validateMediaPolicy(input: unknown): { ok: true; policy: MediaPolicy } | { ok: false; message: string } {
  if (!input || typeof input !== 'object') return { ok: false, message: 'Política de vídeo no válida.' };
  const raw = input as Record<string, any>;
  const yt = raw.youtube ?? DEFAULT_MEDIA_POLICY.youtube;
  if (yt.mode !== 'allowlist' && yt.mode !== 'off') return { ok: false, message: 'Modo de YouTube no válido.' };
  const channels: ApprovedChannel[] = [];
  for (const item of Array.isArray(yt.channels) ? yt.channels.slice(0, 100) : []) {
    if (!isYoutubeChannelId(item?.id) || typeof item?.label !== 'string' || item.label.trim().length === 0) return { ok: false, message: 'Canal no válido (se necesita el ID que empieza por UC y un nombre).' };
    channels.push({ id: item.id, label: item.label.trim().slice(0, 80) });
  }
  const videos: ApprovedVideo[] = [];
  for (const item of Array.isArray(yt.videos) ? yt.videos.slice(0, 300) : []) {
    const id = typeof item?.id === 'string' ? extractYoutubeVideoId(item.id) : null;
    if (!id || typeof item?.label !== 'string' || item.label.trim().length === 0) return { ok: false, message: 'Vídeo no válido (pega el enlace o el ID de 11 caracteres y ponle un nombre).' };
    videos.push({ id, label: item.label.trim().slice(0, 80), ...(isYoutubeChannelId(item.channelId) ? { channelId: item.channelId } : {}) });
  }
  const netflix = raw.netflix ?? DEFAULT_MEDIA_POLICY.netflix;
  if (netflix.mode !== 'kids-profile-only' && netflix.mode !== 'off') return { ok: false, message: 'Modo de Netflix no válido.' };
  const tv = raw.tv ?? DEFAULT_MEDIA_POLICY.tv;
  return {
    ok: true,
    policy: {
      youtube: { mode: yt.mode, channels, videos },
      netflix: { mode: netflix.mode, ...(typeof netflix.kidsProfileName === 'string' && netflix.kidsProfileName.trim() ? { kidsProfileName: netflix.kidsProfileName.trim().slice(0, 40) } : {}) },
      tv: { allowPower: tv.allowPower === true },
    },
  };
}
