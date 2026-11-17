import { randomUUID } from 'node:crypto';
import { DEFAULT_PROFILE, type KidProfile } from './profile.js';
import { DEFAULT_LIMITS, type TimeLimits } from './limits.js';
import { DEFAULT_MEDIA_POLICY, type MediaPolicy } from './media.js';
import { DEFAULT_HOME_POLICY, type HomePolicy } from './home.js';
import { DEFAULT_INTERESTS, type FeedItem, type Interest } from './feed.js';
import type { AgendaItem } from './agenda.js';
import type { SchoolProject, SchoolTask } from './school.js';

export interface KidSettings {
  limits: TimeLimits;
  media: MediaPolicy;
  home: HomePolicy;
  /** `flags`: el tutor ve actividad, tiempos y avisos de seguridad. `full`: además ve las charlas (la niña lo sabe). */
  transcriptVisibility: 'flags' | 'full';
  timeZone: string;
  /** Zona para el tiempo y los planes cercanos. POR CONFIRMAR por el tutor. */
  locality?: { label: string; lat: number; lon: number };
}

export interface MediaRequest { id: string; text: string; at: string; status: 'pending' | 'approved' | 'dismissed' }

export interface KidState {
  revision: number;
  kidId: string;
  profile: KidProfile;
  settings: KidSettings;
  interests: Interest[];
  agenda: AgendaItem[];
  tasks: SchoolTask[];
  projects: SchoolProject[];
  feed: FeedItem[];
  mediaRequests: MediaRequest[];
  /** Minutos extra concedidos por el tutor para una fecha concreta. */
  bonus?: { date: string; minutes: number };
}

export const CAPS = { agenda: 300, tasks: 300, projects: 40, feed: 200, mediaRequests: 50, interests: 30 } as const;

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().slice(0, 12)}`;
}

export function emptyKidState(kidId: string, timeZone = 'Europe/Amsterdam'): KidState {
  return {
    revision: 0,
    kidId,
    profile: { ...DEFAULT_PROFILE },
    settings: {
      limits: { ...DEFAULT_LIMITS, perCategoryMinutes: { ...DEFAULT_LIMITS.perCategoryMinutes } },
      media: { ...DEFAULT_MEDIA_POLICY, youtube: { ...DEFAULT_MEDIA_POLICY.youtube, channels: [], videos: [] } },
      home: { ...DEFAULT_HOME_POLICY, allowedRooms: [], heating: { ...DEFAULT_HOME_POLICY.heating } },
      transcriptVisibility: 'flags',
      timeZone,
    },
    interests: DEFAULT_INTERESTS.map((interest) => ({ ...interest, keywords: [...interest.keywords] })),
    agenda: [],
    tasks: [],
    projects: [],
    feed: [],
    mediaRequests: [],
  };
}

/** Carga defensiva desde JSON guardado: completa lo que falte y recorta listas a sus topes. */
export function sanitizeKidState(value: unknown, kidId: string): KidState {
  const base = emptyKidState(kidId);
  if (!value || typeof value !== 'object') return base;
  const raw = value as Partial<KidState>;
  const arr = <T>(candidate: unknown, cap: number, fallback: T[]): T[] => (Array.isArray(candidate) ? (candidate.slice(-cap) as T[]) : fallback);
  return {
    ...base,
    revision: Number.isInteger(raw.revision) ? Number(raw.revision) : 0,
    profile: { ...base.profile, ...(raw.profile ?? {}) },
    settings: {
      ...base.settings,
      ...(raw.settings ?? {}),
      limits: { ...base.settings.limits, ...(raw.settings?.limits ?? {}) },
      media: { ...base.settings.media, ...(raw.settings?.media ?? {}) },
      home: { ...base.settings.home, ...(raw.settings?.home ?? {}) },
    },
    interests: arr(raw.interests, CAPS.interests, base.interests),
    agenda: arr(raw.agenda, CAPS.agenda, []),
    tasks: arr(raw.tasks, CAPS.tasks, []),
    projects: arr(raw.projects, CAPS.projects, []),
    feed: arr(raw.feed, CAPS.feed, []),
    mediaRequests: arr(raw.mediaRequests, CAPS.mediaRequests, []),
    ...(raw.bonus ? { bonus: raw.bonus } : {}),
  };
}

export function withRevision(state: KidState, update: Partial<KidState>): KidState {
  return { ...state, ...update, revision: state.revision + 1 };
}
