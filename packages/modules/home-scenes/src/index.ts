/**
 * home-scenes · Casa inteligente para Janus (pieza LEGO, sin red: el host ejecuta).
 * Luces LSC Smart Connect (Action) → plataforma Tuya (app Tuya/Smart Life; Tuya IoT Platform o Local Tuya).
 * Fuentes: community.homey.app/t/action-lsc-smart-connect/16814 · forum.hacf.fr/t/local-tuya-et-les-devices-lsc-smart-connect-action/5260
 * Seguridad: sin secretos (solo secretRef); acciones idempotentes; todo queda en un log auditable.
 */
export type DeviceKind = 'light' | 'plug' | 'heater' | 'thermostat';
export interface Device { id: string; name: string; room: string; kind: DeviceKind; adapter: 'tuya' | 'demo'; externalId?: string; tags: string[] }
export interface DeviceState { on: boolean; brightness?: number; temp?: number; current?: number }
export type SceneId = 'llegada' | 'salida' | 'despertar' | 'buenas-noches' | 'navidad' | 'navidad-off' | 'todo-off' | 'ambiente';
export interface Action { deviceId: string; cmd: 'on' | 'off' | 'brightness' | 'setTemp'; value?: number }
export interface HomeContext { now: Date; outsideTemp?: number; comfortTemp?: number; nightLightHour?: number }

export const SCENES: Record<SceneId, { label: string; desc: string }> = {
  llegada: { label: 'Llegada', desc: 'Luces de ambiente encendidas y calefacción a temperatura de confort' },
  salida: { label: 'Salida', desc: 'Todo apagado y calefacción en modo ahorro' },
  despertar: { label: 'Despertar', desc: 'Luces cálidas suaves en dormitorio y cocina' },
  'buenas-noches': { label: 'Buenas noches', desc: 'Todo apagado salvo la luz de noche' },
  navidad: { label: 'Navidad', desc: 'Encender las luces de Navidad' },
  'navidad-off': { label: 'Navidad off', desc: 'Apagar las luces de Navidad' },
  'todo-off': { label: 'Apagar todo', desc: 'Apagar todas las luces y enchufes' },
  ambiente: { label: 'Ambiente', desc: 'Solo luces de ambiente' }
};

const lightsOf = (d: Device[], tag?: string) => d.filter((x) => (x.kind === 'light' || x.kind === 'plug') && (!tag || x.tags.includes(tag)));
const heatOf = (d: Device[]) => d.filter((x) => x.kind === 'heater' || x.kind === 'thermostat');

/** Plan idempotente: solo devuelve acciones que cambian algo. */
export function planScene(scene: SceneId, devices: Device[], state: Record<string, DeviceState>, ctx: HomeContext): Action[] {
  const want: Action[] = [];
  const comfort = ctx.comfortTemp ?? 20.5, eco = 17;
  const dark = ctx.now.getHours() >= 17 || ctx.now.getHours() < 8;
  switch (scene) {
    case 'llegada':
      if (dark) lightsOf(devices, 'ambiente').forEach((d) => want.push({ deviceId: d.id, cmd: 'on' }));
      heatOf(devices).forEach((d) => want.push({ deviceId: d.id, cmd: 'setTemp', value: comfort }));
      break;
    case 'salida': lightsOf(devices).forEach((d) => want.push({ deviceId: d.id, cmd: 'off' })); heatOf(devices).forEach((d) => want.push({ deviceId: d.id, cmd: 'setTemp', value: eco })); break;
    case 'despertar': lightsOf(devices, 'despertar').forEach((d) => { want.push({ deviceId: d.id, cmd: 'on' }); want.push({ deviceId: d.id, cmd: 'brightness', value: 40 }); }); heatOf(devices).forEach((d) => want.push({ deviceId: d.id, cmd: 'setTemp', value: comfort })); break;
    case 'buenas-noches': lightsOf(devices).forEach((d) => want.push({ deviceId: d.id, cmd: d.tags.includes('noche') ? 'on' : 'off' })); heatOf(devices).forEach((d) => want.push({ deviceId: d.id, cmd: 'setTemp', value: 18 })); break;
    case 'navidad': lightsOf(devices, 'navidad').forEach((d) => want.push({ deviceId: d.id, cmd: 'on' })); break;
    case 'navidad-off': lightsOf(devices, 'navidad').forEach((d) => want.push({ deviceId: d.id, cmd: 'off' })); break;
    case 'todo-off': lightsOf(devices).forEach((d) => want.push({ deviceId: d.id, cmd: 'off' })); break;
    case 'ambiente': lightsOf(devices, 'ambiente').forEach((d) => want.push({ deviceId: d.id, cmd: 'on' })); break;
  }
  return want.filter((a) => {
    const s = state[a.deviceId];
    if (!s) return true;
    if (a.cmd === 'on') return !s.on;
    if (a.cmd === 'off') return s.on;
    if (a.cmd === 'brightness') return s.brightness !== a.value;
    if (a.cmd === 'setTemp') return s.temp !== a.value;
    return true;
  });
}

export function applyActions(state: Record<string, DeviceState>, actions: Action[]): Record<string, DeviceState> {
  const next: Record<string, DeviceState> = JSON.parse(JSON.stringify(state));
  for (const a of actions) {
    const s = next[a.deviceId] ?? (next[a.deviceId] = { on: false });
    if (a.cmd === 'on') s.on = true; else if (a.cmd === 'off') s.on = false;
    else if (a.cmd === 'brightness') { s.on = true; s.brightness = a.value; } else if (a.cmd === 'setTemp') { s.on = true; s.temp = a.value; }
  }
  return next;
}

const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
/** Órdenes en lenguaje natural (voz o texto). */
export function parseIntent(text: string): { scene?: SceneId; temp?: number } | null {
  const t = norm(text);
  const m = t.match(/(calefaccion|temperatura).*?(\d{2}(?:[.,]\d)?)/);
  if (m) return { temp: parseFloat(m[2]!.replace(',', '.')) };
  if (/(enciende|prende|pon|activa).*(navidad|navidenas|arbol)/.test(t)) return { scene: 'navidad' };
  if (/(apaga|quita).*(navidad|navidenas|arbol)/.test(t)) return { scene: 'navidad-off' };
  if (/(apaga|apagar) (todo|todas|las luces)/.test(t)) return { scene: 'todo-off' };
  if (/(enciende|prende).*(luces|luz)/.test(t)) return { scene: 'ambiente' };
  if (/buenas noches|me voy a dormir/.test(t)) return { scene: 'buenas-noches' };
  if (/(ya )?llegue|estoy en casa/.test(t)) return { scene: 'llegada' };
  if (/(me voy|salgo de casa)/.test(t)) return { scene: 'salida' };
  return null;
}

/** Saludo: "Hola, Jean. ¿Qué tal tu día?" al llegar; "Buenos días, Jean" al despertar. */
export function greeting(name: string, now: Date, event: 'llegada' | 'despertar' | 'abrir'): string {
  if (event === 'despertar' || (event === 'abrir' && now.getHours() >= 5 && now.getHours() < 11)) return 'Buenos días, ' + name + '.';
  return 'Hola, ' + name + '. ¿Qué tal tu día?';
}

/** Comando Tuya OpenAPI (POST /v1.0/iot-03/devices/{id}/commands). La firma HMAC la hace el host con secretRef. */
export function tuyaCommand(device: Device, a: Action): { path: string; body: { commands: Array<{ code: string; value: unknown }> } } {
  if (!device.externalId) throw new Error('Dispositivo sin id de Tuya: ' + device.id);
  const code = a.cmd === 'on' || a.cmd === 'off' ? (device.kind === 'light' ? 'switch_led' : 'switch_1') : a.cmd === 'brightness' ? 'bright_value_v2' : 'temp_set';
  const value = a.cmd === 'on' ? true : a.cmd === 'off' ? false : a.cmd === 'brightness' ? Math.round((a.value ?? 100) * 10) : a.value;
  return { path: '/v1.0/iot-03/devices/' + device.externalId + '/commands', body: { commands: [{ code, value }] } };
}

export interface HomeEventLog { at: string; source: 'presencia' | 'voz' | 'texto' | 'boton' | 'horario'; scene?: SceneId; actions: Action[] }
