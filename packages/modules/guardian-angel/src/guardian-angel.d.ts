export declare const MODULE: Readonly<{ id: 'guardian-angel'; name: string; version: string }>;
export declare const EMERGENCY: Readonly<Record<string, string>>;
export type GuardianRole = 'padre' | 'madre' | 'tutor_legal' | 'familiar' | 'otro';
export type SosKind = 'ayuda' | 'peligro' | 'herida' | 'perdida';
export declare const ROLES: readonly GuardianRole[];
export declare const ROLE_LABEL: Readonly<Record<GuardianRole, string>>;
export declare const KINDS: readonly SosKind[];
export declare const KIND_TEXT: Readonly<Record<'es' | 'nl', Record<SosKind, string>>>;
export declare const HOLD_MS: number;
export declare const MAX_GUARDIANS: number;
export declare const MAX_LOCATIONS: number;

export interface Guardian { id: string; role: GuardianRole; name: string; phone: string; whatsapp: boolean; primary: boolean; address?: string }
export interface GuardianConfig { country: string; emergencyNumber: string; childName: string; guardians: Guardian[]; messages: string[] }
export interface SosLocation { lat: number; lon: number; accuracy?: number; at?: string }
export interface SosEvent { id: string; startedAt: string; kind: SosKind; status: 'activo' | 'resuelto'; locations: SosLocation[]; resolvedAt?: string }

export declare function normalizePhone(raw: unknown, country?: string): string | null;
export declare function normalizeConfig(input: unknown): { ok: true; config: GuardianConfig } | { ok: false; message: string };
export declare function validLocation(loc: unknown): SosLocation | null;
export declare function mapsUrl(loc: { lat: number; lon: number }): string;
export declare function alertText(input: { childName?: string; kind?: string; location?: unknown; lang?: string }): string;
export declare function contactLinks(guardian: Partial<Guardian> | undefined, text: string): { call?: string; sms?: string; whatsapp?: string };
export declare function emergencyCall(config?: Partial<GuardianConfig>): string;
export declare function newSosEvent(input: { id: string; at: string; kind?: string; location?: unknown }): SosEvent;
export declare function addLocation(event: SosEvent, location: unknown, at: string): SosEvent;
export declare function resolveSos(event: SosEvent, at: string): SosEvent;
export interface FirstAidStep { title: string; say: string; simple: string; next: readonly (readonly [string, string])[]; call112?: boolean; alertGuardians?: boolean; metronome?: boolean }
export declare const FIRST_AID: Readonly<Record<string, FirstAidStep>>;
export declare const FIRST_AID_ENTRIES: readonly (readonly [string, string])[];
export declare const FIRST_AID_SOURCES: readonly string[];
export declare const FIRST_AID_WORDS: readonly (readonly [string, string])[];
export declare const COMPRESSIONS_PER_MINUTE: number;
export declare const STREET_SAFETY: readonly string[];
export declare const SELF_DEFENSE: readonly (readonly [string, string])[];
export declare const FAMILY_VALUES: readonly string[];
export declare const MAX_MESSAGES: number;
