import { normalizeText } from './time.js';

/**
 * Domótica pedida por la niña (luces, ventilador, calefacción). La política la define el tutor: qué habitaciones, qué
 * tipos de aparato y qué rango de temperatura. Nada de cerraduras, cámaras, alarmas, enchufes de cocina ni fuego.
 * Este módulo solo PLANIFICA; el anfitrión ejecuta (home-scenes → Tuya/LSC) y registra cada acción para el tutor.
 */

export type HomeDeviceKind = 'light' | 'plug' | 'fan' | 'heater' | 'thermostat';

export interface HomeDevice {
  id: string;
  name: string;
  room: string;
  kind: HomeDeviceKind;
  tags?: string[];
}

export interface HomeAction { deviceId: string; cmd: 'on' | 'off' | 'setTemp'; value?: number }

export interface HomePolicy {
  /** Interruptor general (p. ej. apagado mientras ella está en otra casa). */
  enabled: boolean;
  allowedRooms: string[];
  allowedKinds: HomeDeviceKind[];
  /** Habitación por defecto si dice «apaga la luz» sin decir dónde. */
  defaultRoom?: string;
  heating: { allowOff: boolean; allowOn: boolean; minTemp: number; maxTemp: number };
}

export const DEFAULT_HOME_POLICY: HomePolicy = {
  enabled: false,
  allowedRooms: [],
  allowedKinds: ['light', 'fan', 'heater', 'thermostat'],
  heating: { allowOff: true, allowOn: false, minTemp: 16, maxTemp: 20 },
};

export interface HomeCommand {
  verb: 'on' | 'off' | 'setTemp';
  target: 'light' | 'fan' | 'heater';
  qualifier?: string;
  all?: boolean;
  temp?: number;
}

const ROOM_SYNONYMS: string[][] = [
  ['sala', 'salon', 'living', 'comedor', 'estar'],
  ['cuarto', 'habitacion', 'dormitorio', 'alcoba'],
  ['bano', 'aseo', 'wc'],
  ['cocina'],
  ['pasillo', 'recibidor', 'entrada', 'hall'],
];
const FILLER = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'mi', 'mis', 'en', 'al', 'a', 'por', 'favor', 'luz', 'luces', 'lampara']);

function canonicalRoom(word: string): string {
  const group = ROOM_SYNONYMS.find((list) => list.includes(word));
  return group ? group[0]! : word;
}
const roomTokens = (text: string) => normalizeText(text).split(' ').filter((word) => word && !FILLER.has(word)).map(canonicalRoom);

export function parseHomeCommand(text: string): HomeCommand | null {
  const norm = normalizeText(text);
  const target: HomeCommand['target'] | null = /\b(luz|luces|lampara|lamparas)\b/.test(norm) ? 'light'
    : /\bventilador\b/.test(norm) ? 'fan'
      : /\b(calefaccion|calefactor|radiador|estufa)\b/.test(norm) ? 'heater' : null;
  if (!target) return null;

  const temp = norm.match(/\b(?:a|en)\s+(\d{2})(?:\s*grados)?\b/);
  let verb: HomeCommand['verb'] | null = null;
  if (/\b(apaga|apagame|apaguen|quita|desactiva|apagar)\b/.test(norm)) verb = 'off';
  else if (/\b(enciende|enciendeme|prende|prendeme|activa|pon|ponme|encender|prender)\b/.test(norm)) verb = 'on';
  else if (/\b(sube|baja)\b/.test(norm) && target === 'heater') verb = temp ? 'setTemp' : 'on';
  if (!verb) return null;
  if (verb === 'on' && target === 'heater' && temp) verb = 'setTemp';

  const qualifierMatch = norm.match(/\b(?:de|del|en|al)\s+(?:la\s+|el\s+|mi\s+)?([a-z0-9ñ ]{2,30}?)(?:\s+(?:por favor|ya|ahora)|$)/);
  let qualifier = qualifierMatch?.[1]?.trim();
  if (qualifier && /^(?:luz|luces|lampara)/.test(qualifier)) qualifier = undefined;
  const all = /\b(todas|todo|todos)\b/.test(norm);
  return { verb, target, ...(qualifier ? { qualifier } : {}), ...(all ? { all: true } : {}), ...(temp ? { temp: Number(temp[1]) } : {}) };
}

export type HomeResolution =
  | { status: 'ok'; actions: HomeAction[]; summary: string }
  | { status: 'disabled' | 'denied' | 'no-device' | 'needs-clarification'; message: string; options?: string[] };

const KIND_FOR_TARGET: Record<HomeCommand['target'], HomeDeviceKind[]> = {
  light: ['light'],
  fan: ['fan'],
  heater: ['heater', 'thermostat'],
};

/** Un enchufe cuenta como ventilador solo si se llama así o lleva la etiqueta «ventilador»; cualquier otro enchufe nunca se controla. */
function effectiveKind(device: HomeDevice): HomeDeviceKind {
  if (device.kind === 'plug' && (/ventilador/.test(normalizeText(device.name)) || (device.tags ?? []).map(normalizeText).includes('ventilador'))) return 'fan';
  return device.kind;
}

function deviceTokens(device: HomeDevice): string[] {
  return [...roomTokens(device.room), ...roomTokens(device.name), ...(device.tags ?? []).flatMap((tag) => roomTokens(tag))];
}

export function resolveHomeCommand(command: HomeCommand, inventory: readonly HomeDevice[], policy: HomePolicy): HomeResolution {
  if (!policy.enabled) return { status: 'disabled', message: 'El control de la casa está apagado ahora mismo. Pídeselo a papá o a mamá.' };
  const kinds = KIND_FOR_TARGET[command.target];
  if (!kinds.some((kind) => policy.allowedKinds.includes(kind)) ) return { status: 'denied', message: 'Eso lo controlan papá o mamá.' };

  const ofKind = inventory.filter((device) => {
    const kind = effectiveKind(device);
    return kinds.includes(kind) && policy.allowedKinds.includes(kind);
  });
  const allowedRooms = new Set(policy.allowedRooms.flatMap((room) => roomTokens(room)));
  const isPermitted = (device: HomeDevice) => roomTokens(device.room).some((token) => allowedRooms.has(token)) || (device.tags ?? []).some((tag) => normalizeText(tag) === 'kendra');
  const matchesQualifier = (device: HomeDevice, wanted: string[]) => {
    const have = deviceTokens(device);
    return wanted.every((word) => have.some((token) => token === word || token.startsWith(word) || word.startsWith(token)));
  };
  const wanted = command.qualifier ? roomTokens(command.qualifier) : [];

  // Primero se busca entre TODOS los aparatos de ese tipo, para distinguir «no existe» de «existe pero no puedes».
  const named = wanted.length > 0 ? ofKind.filter((device) => matchesQualifier(device, wanted)) : ofKind;
  if (ofKind.length === 0) return { status: 'no-device', message: 'Todavía no tengo ese aparato en la lista de la casa. Se lo digo a papá.' };
  if (named.length === 0) return { status: 'no-device', message: `No encuentro «${command.qualifier}» entre los aparatos de la casa.` };
  const permitted = named.filter(isPermitted);
  if (permitted.length === 0) return { status: 'denied', message: 'Esa habitación no está en tu lista. Pídeselo a papá o a mamá.' };

  let candidates = permitted;
  if (wanted.length === 0 && !command.all) {
    const fallbackRoom = policy.defaultRoom ? roomTokens(policy.defaultRoom) : [];
    const inDefault = fallbackRoom.length > 0
      ? permitted.filter((device) => deviceTokens(device).some((token) => fallbackRoom.includes(token)) || (device.tags ?? []).some((tag) => normalizeText(tag) === 'kendra'))
      : [];
    candidates = inDefault.length > 0 ? inDefault : permitted;
  }
  if (candidates.length > 1 && !command.all) {
    return { status: 'needs-clarification', message: '¿Cuál de estas?', options: candidates.map((device) => device.name) };
  }

  const actions: HomeAction[] = [];
  for (const device of candidates) {
    const isHeating = device.kind === 'heater' || device.kind === 'thermostat';
    if (isHeating) {
      if (command.verb === 'off') {
        if (!policy.heating.allowOff) return { status: 'denied', message: 'La calefacción la controlan papá o mamá.' };
        actions.push({ deviceId: device.id, cmd: 'off' });
      } else if (command.verb === 'setTemp') {
        if (command.temp === undefined || command.temp < policy.heating.minTemp || command.temp > policy.heating.maxTemp) {
          return { status: 'denied', message: `Puedes poner la calefacción entre ${policy.heating.minTemp} y ${policy.heating.maxTemp} grados.` };
        }
        actions.push({ deviceId: device.id, cmd: 'setTemp', value: command.temp });
      } else {
        if (!policy.heating.allowOn) return { status: 'denied', message: 'Encender la calefacción lo hacen papá o mamá. Si tienes frío, dímelo y se lo aviso.' };
        actions.push({ deviceId: device.id, cmd: 'on' });
      }
    } else {
      if (command.verb === 'setTemp') return { status: 'denied', message: 'Eso no se puede regular así.' };
      actions.push({ deviceId: device.id, cmd: command.verb });
    }
  }
  const names = candidates.map((device) => device.name).join(', ');
  const verbText = command.verb === 'off' ? 'Apago' : command.verb === 'on' ? 'Enciendo' : `Pongo a ${command.temp}°`;
  return { status: 'ok', actions, summary: `${verbText}: ${names}.` };
}

export function validateHomePolicy(input: unknown): { ok: true; policy: HomePolicy } | { ok: false; message: string } {
  if (!input || typeof input !== 'object') return { ok: false, message: 'Política de casa no válida.' };
  const raw = input as Record<string, any>;
  const kinds: HomeDeviceKind[] = [];
  const allowed = ['light', 'plug', 'fan', 'heater', 'thermostat'];
  for (const kind of Array.isArray(raw.allowedKinds) ? raw.allowedKinds : DEFAULT_HOME_POLICY.allowedKinds) {
    if (!allowed.includes(kind)) return { ok: false, message: `Tipo de aparato no permitido: ${String(kind).slice(0, 20)}.` };
    kinds.push(kind);
  }
  const rooms = (Array.isArray(raw.allowedRooms) ? raw.allowedRooms : []).filter((room: unknown): room is string => typeof room === 'string' && room.trim().length > 0).map((room: string) => room.trim().slice(0, 40)).slice(0, 20);
  const heating = raw.heating ?? DEFAULT_HOME_POLICY.heating;
  const minTemp = Number(heating.minTemp);
  const maxTemp = Number(heating.maxTemp);
  if (!Number.isFinite(minTemp) || !Number.isFinite(maxTemp) || minTemp < 10 || maxTemp > 24 || minTemp > maxTemp) return { ok: false, message: 'El rango de calefacción debe estar entre 10 y 24 grados.' };
  return {
    ok: true,
    policy: {
      enabled: raw.enabled === true,
      allowedRooms: rooms,
      allowedKinds: kinds,
      ...(typeof raw.defaultRoom === 'string' && raw.defaultRoom.trim() ? { defaultRoom: raw.defaultRoom.trim().slice(0, 40) } : {}),
      heating: { allowOff: heating.allowOff !== false, allowOn: heating.allowOn === true, minTemp, maxTemp },
    },
  };
}
