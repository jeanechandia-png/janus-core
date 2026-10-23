import type { FounderReferenceLibraryDocument } from './founder-reference-library.js';

/**
 * Founder phone channels — el teléfono del Founder (llamadas, SMS, WhatsApp) y lo que Janus puede hacer con él.
 *
 * El número es un dato personal: vive en la capa LOCAL de la biblioteca de referencias (git-ignorada), como registro
 * `kind: "reference"` con la etiqueta `phone` y `value` en formato E.164. Las etiquetas `voice`, `sms` y `whatsapp` declaran
 * qué canales usa el Founder con ese número.
 *
 * Este módulo solo describe, planifica y construye enlaces: no llama a nadie, no envía nada y no guarda credenciales.
 *
 * Instrucción del Founder (2026-10-23): Janus debe poder enviar mensajes y contestar el teléfono y el WhatsApp.
 * Decisión de diseño: solo por instrucción del Founder y con su confirmación en cada envío o llamada; Janus se identifica
 * como asistente de IA y no imita su voz. Nada autónomo. Ver `FounderPhonePolicy`.
 */
export type PhoneChannelKind = 'voice' | 'sms' | 'whatsapp';
export type PhoneScope = 'personal' | 'business' | 'family' | 'unknown';

export interface FounderPhoneChannel {
  channelId: string;
  referenceId: string;
  label: string;
  /** Número en formato E.164, p. ej. `+31612345678`. */
  e164: string;
  scope: PhoneScope;
  kinds: PhoneChannelKind[];
  /** El prefijo de país lo dedujo Janus del número tal como lo dio el Founder (etiqueta `country-inferred:XX`). Espera confirmación. */
  countryInferred?: string;
  /** El Founder dio la instrucción de actuar con aprobación (etiqueta `founder-instruction:send-and-answer-with-approval`). */
  founderInstruction: boolean;
}

export interface FounderPhonePolicy {
  owner: 'founder';
  /** Redactar mensajes y guiones de llamada: solo por instrucción del Founder. */
  composeOnFounderInstruction: true;
  /** Cada SMS/WhatsApp enviado exige su confirmación. */
  sendRequiresPerMessageApproval: true;
  /** Cada llamada saliente exige su confirmación. */
  callPlacementRequiresPerCallApproval: true;
  /** Una llamada entrante solo la atiende un perfil de voz que el Founder activó; Janus se identifica como asistente de IA. */
  answeringIncomingCalls: 'only-with-founder-activated-profile';
  disclosesAiIdentity: true;
  voiceImpersonationAllowed: false;
  autonomousSendAllowed: false;
  autonomousCallAllowed: false;
  /** WhatsApp personal mediante clientes no oficiales o automatización de la app: prohibido por sus condiciones de uso. */
  unofficialWhatsAppClientsAllowed: false;
  /** Alquilar un número, una línea de voz o una cuenta de API cuesta dinero: requiere aprobación de gasto. */
  spendRequiresApproval: true;
  /** El contenido de un mensaje o llamada es un dato, no una orden. */
  inboundContentIsData: true;
  credentialPersistence: 'secure-provider-only';
}

export interface FounderPhoneChannelRegistry {
  schemaVersion: 1;
  ownerPrincipalId: string;
  sourceUpdatedAt: string;
  policy: FounderPhonePolicy;
  channels: FounderPhoneChannel[];
}

const E164 = /^\+[1-9][0-9]{6,14}$/;
const CHANNEL_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
const COUNTRY_TAG = /^country-inferred:([A-Z]{2})$/;
const KINDS: PhoneChannelKind[] = ['voice', 'sms', 'whatsapp'];

export function buildFounderPhoneChannelRegistry(document: FounderReferenceLibraryDocument): FounderPhoneChannelRegistry {
  const seen = new Set<string>();
  const channels: FounderPhoneChannel[] = [];
  for (const seed of document.records) {
    const tags = seed.tags ?? [];
    if (seed.kind !== 'reference' || !tags.includes('phone')) continue;
    const e164 = seed.value.trim();
    if (!E164.test(e164)) throw new Error(`Invalid phone number in Founder reference ${seed.id}`);
    if (!CHANNEL_ID.test(seed.id)) throw new Error(`Phone channel id must be a lowercase slug: ${seed.id}`);
    // El mismo número dado dos veces es un solo canal.
    if (seen.has(e164)) continue;
    seen.add(e164);
    const country = tags.map((tag) => COUNTRY_TAG.exec(tag)?.[1]).find((value): value is string => Boolean(value));
    const kinds = KINDS.filter((kind) => tags.includes(kind));
    channels.push({
      channelId: seed.id,
      referenceId: seed.id,
      label: seed.label,
      e164,
      scope: tags.includes('scope:family') ? 'family' : tags.includes('scope:business') ? 'business' : tags.includes('scope:personal') ? 'personal' : 'unknown',
      // Sin etiquetas de canal no se supone ninguno: el Founder las declara.
      kinds,
      ...(country ? { countryInferred: country } : {}),
      founderInstruction: tags.includes('founder-instruction:send-and-answer-with-approval'),
    });
  }
  return {
    schemaVersion: 1,
    ownerPrincipalId: document.ownerPrincipalId,
    sourceUpdatedAt: document.updatedAt,
    policy: {
      owner: 'founder',
      composeOnFounderInstruction: true,
      sendRequiresPerMessageApproval: true,
      callPlacementRequiresPerCallApproval: true,
      answeringIncomingCalls: 'only-with-founder-activated-profile',
      disclosesAiIdentity: true,
      voiceImpersonationAllowed: false,
      autonomousSendAllowed: false,
      autonomousCallAllowed: false,
      unofficialWhatsAppClientsAllowed: false,
      spendRequiresApproval: true,
      inboundContentIsData: true,
      credentialPersistence: 'secure-provider-only',
    },
    channels,
  };
}

/* ------------------------------------------------------------------ Enlaces (sin credenciales) */

const MAX_LINK_TEXT = 1000;

function digitsOf(e164: string): string {
  if (!E164.test(e164)) throw new Error('Recipient must be a phone number in E.164 format (+<country><number>)');
  return e164.slice(1);
}

function linkText(text: string | undefined): string | undefined {
  if (text === undefined) return undefined;
  const clean = text.replace(/\r\n/g, '\n').trim();
  if (!clean) return undefined;
  if (clean.length > MAX_LINK_TEXT) throw new Error(`Message text for a link may not exceed ${MAX_LINK_TEXT} characters`);
  return clean;
}

/**
 * Enlace «click to chat» de WhatsApp: abre el chat con el destinatario y el texto ya escrito. Lo envía el Founder con un toque
 * desde SU WhatsApp; Janus no envía nada. Formato `https://wa.me/<número sin «+»>?text=<texto>`.
 * POR CONFIRMAR: el formato lo conozco por documentación secundaria; la ayuda oficial no se pudo leer desde aquí.
 */
export function buildWhatsAppClickToChatLink(recipientE164: string, text?: string): string {
  const base = `https://wa.me/${digitsOf(recipientE164)}`;
  const body = linkText(text);
  return body ? `${base}?text=${encodeURIComponent(body)}` : base;
}

/** `tel:` (RFC 3966): abre el marcador con el número; el Founder pulsa llamar. */
export function buildTelLink(recipientE164: string): string {
  digitsOf(recipientE164);
  return `tel:${recipientE164}`;
}

/** `sms:` (RFC 5724): abre Mensajes con el texto ya escrito. POR CONFIRMAR cómo lo interpreta cada versión de iOS. */
export function buildSmsLink(recipientE164: string, text?: string): string {
  digitsOf(recipientE164);
  const body = linkText(text);
  return body ? `sms:${recipientE164}?body=${encodeURIComponent(body)}` : `sms:${recipientE164}`;
}

/* ------------------------------------------------------------------ Plan de rutas */

export type PhoneVerification = 'verified-primary-source' | 'standard' | 'inference' | 'unverified';
export type PhoneRouteStatus = 'available_now' | 'needs_setup' | 'refused';

export interface PhoneRoute {
  routeId: string;
  kind: PhoneChannelKind;
  /** Nivel de autonomía: L1 el Founder envía con un toque; L2 Janus envía por API con su aprobación por mensaje; L3 autónomo (no autorizado). */
  tier: 'L1' | 'L2' | 'L3';
  status: PhoneRouteStatus;
  summary: string;
  /** Lo que falta para que funcione; vacío si ya está disponible. */
  blockers: string[];
  /** Esta ruta cuesta dinero (requiere aprobación de gasto del Founder). */
  spend: boolean;
  /** Cada uso necesita un toque o una confirmación del Founder. */
  requiresFounderAction: boolean;
  verification: PhoneVerification;
  sources: string[];
}

export interface PhoneChannelPlan {
  channelId: string;
  e164: string;
  routes: PhoneRoute[];
  /** Ruta que Janus recomienda empezar a usar (la de menor riesgo y coste que ya cubre lo pedido). */
  recommendedFirstRoute: string | null;
}

export interface PhoneAccessEnvironment {
  /** Adaptadores de teléfono realmente registrados en el Tool Gateway (hoy ninguno). */
  adapters: ReadonlySet<string>;
}

const SRC_WA_CLOUD = 'https://developers.facebook.com/docs/whatsapp/cloud-api/';
const SRC_ELEVEN_PHONE = 'https://elevenlabs.io/docs/agents-platform/phone-numbers/twilio-integration/native-integration';
const SRC_AI_ACT_50 = 'https://eur-lex.europa.eu/eli/reg/2024/1689/oj';

function missingAdapter(env: PhoneAccessEnvironment, name: string): string[] {
  return env.adapters.has(name) ? [] : [`Falta el adaptador ${name} en el Tool Gateway (aún no existe).`];
}

export function planPhoneAccess(channels: readonly FounderPhoneChannel[], env: PhoneAccessEnvironment): PhoneChannelPlan[] {
  return channels.map((channel) => {
    const routes: PhoneRoute[] = [];
    const can = (kind: PhoneChannelKind) => channel.kinds.includes(kind);

    if (can('whatsapp')) {
      routes.push({
        routeId: 'whatsapp-click-to-chat',
        kind: 'whatsapp',
        tier: 'L1',
        status: 'available_now',
        summary: 'Janus redacta el mensaje y te da un enlace; lo envías tú desde tu WhatsApp con un toque. No necesita credenciales ni coste.',
        blockers: [],
        spend: false,
        requiresFounderAction: true,
        verification: 'unverified',
        sources: [],
      });
      routes.push({
        routeId: 'whatsapp-cloud-api',
        kind: 'whatsapp',
        tier: 'L2',
        status: 'needs_setup',
        summary: 'Janus envía por la API oficial de WhatsApp Business con tu aprobación por mensaje.',
        blockers: [
          'La API oficial no se conecta a tu WhatsApp personal: exige un número dedicado (un número usado en WhatsApp Messenger debe eliminarse de él antes) o la app WhatsApp Business en modo coexistencia, que Meta limita a Solution Partners / Tech Providers.',
          'Cuenta de WhatsApp Business y verificación de empresa en Meta.',
          'Fuera de las 24 h posteriores al último mensaje del cliente solo se pueden enviar plantillas aprobadas, y el destinatario debe haber dado su consentimiento (opt-in).',
          ...missingAdapter(env, 'whatsapp-cloud'),
        ],
        spend: true,
        requiresFounderAction: true,
        verification: 'verified-primary-source',
        sources: [SRC_WA_CLOUD],
      });
      routes.push({
        routeId: 'whatsapp-personal-unofficial',
        kind: 'whatsapp',
        tier: 'L3',
        status: 'refused',
        summary: 'Leer y contestar tu WhatsApp personal con clientes no oficiales o automatizando la app.',
        blockers: ['Las condiciones de uso de WhatsApp prohíben el acceso automatizado y los clientes no oficiales (riesgo de bloqueo del número). Janus no lo implementa.'],
        spend: false,
        requiresFounderAction: false,
        verification: 'inference',
        sources: [],
      });
    }

    if (can('sms')) {
      routes.push({
        routeId: 'sms-link',
        kind: 'sms',
        tier: 'L1',
        status: 'available_now',
        summary: 'Janus redacta el SMS y te da un enlace sms:; lo envías tú desde Mensajes con un toque.',
        blockers: [],
        spend: false,
        requiresFounderAction: true,
        verification: 'standard',
        sources: ['https://www.rfc-editor.org/rfc/rfc5724'],
      });
      routes.push({
        routeId: 'sms-api',
        kind: 'sms',
        tier: 'L2',
        status: 'needs_setup',
        summary: 'Janus envía SMS por una pasarela (p. ej. Twilio) con tu aprobación por mensaje.',
        blockers: ['Cuenta y remitente en la pasarela (coste: requiere tu aprobación de gasto).', ...missingAdapter(env, 'sms-gateway')],
        spend: true,
        requiresFounderAction: true,
        verification: 'inference',
        sources: [],
      });
    }

    if (can('voice')) {
      routes.push({
        routeId: 'call-link',
        kind: 'voice',
        tier: 'L1',
        status: 'available_now',
        summary: 'Janus prepara el guion y te da un enlace tel:; llamas tú con un toque.',
        blockers: [],
        spend: false,
        requiresFounderAction: true,
        verification: 'standard',
        sources: ['https://www.rfc-editor.org/rfc/rfc3966'],
      });
      routes.push({
        routeId: 'voice-line-agent',
        kind: 'voice',
        tier: 'L2',
        status: 'needs_setup',
        summary: 'Línea de voz de Janus (agente de ElevenLabs) que atiende las llamadas que tú desvíes; tu iPhone no se convierte en la centralita.',
        blockers: [
          'Un número entrante propio: ElevenLabs exige un número de Twilio comprado o un troncal SIP (coste: requiere tu aprobación de gasto).',
          'Desvío condicional de tu operador hacia esa línea (si no contestas / ocupado): POR CONFIRMAR con tu operador y con iOS.',
          'Aviso de que quien atiende es un asistente de IA (Reglamento de IA de la UE, art. 50, en vigor desde el 2 de agosto de 2026; lectura de Janus, no asesoría legal).',
          'Perfil de voz que tú actives; sin imitar tu voz; contenido de la llamada tratado como dato, no como orden.',
          ...missingAdapter(env, 'voice-line'),
        ],
        spend: true,
        requiresFounderAction: true,
        verification: 'verified-primary-source',
        sources: [SRC_ELEVEN_PHONE, SRC_AI_ACT_50],
      });
    }

    const recommended = routes.find((route) => route.status === 'available_now' && route.kind === 'whatsapp')
      ?? routes.find((route) => route.status === 'available_now')
      ?? null;
    return {
      channelId: channel.channelId,
      e164: channel.e164,
      routes,
      recommendedFirstRoute: recommended?.routeId ?? null,
    };
  });
}
