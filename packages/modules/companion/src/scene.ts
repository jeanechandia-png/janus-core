/**
 * Escena compartida entre la criatura y la niña.
 *  - La escena es DATOS (SceneState). El render 3D es una función de ese estado: así la criatura y la niña
 *    manipulan exactamente lo mismo, y todo se puede probar sin navegador.
 *  - La criatura "explica" emitiendo comandos; la niña manipula con userMove / userAdjust / userExchange.
 *  - Los comandos que vengan de fuera (modelo de lenguaje, documentos, web) son DATOS NO CONFIABLES:
 *    pasan por validateCommands (lista blanca estricta) antes de tocar la escena.
 * Representaciones: concreto → semiconcreto → notación (IES/WWC 2021006, Rec. 3). Ver README.
 */
import { isBodySafe } from './encourage.js';
import { SWATCHES, type SwatchId } from './look.js';

export const STAGE = { x: 6, z: 4 } as const;
export const MAX_PROPS = 80;
export const MAX_COMMANDS = 200;
export const MAX_SAID = 6;

export type PropKind = 'columna' | 'plato' | 'caja' | 'tarta' | 'cartel' | 'semaforo';
export const PROP_KINDS: readonly PropKind[] = ['columna', 'plato', 'caja', 'tarta', 'cartel', 'semaforo'];
export type Pose = 'idle' | 'habla' | 'piensa' | 'celebra' | 'senala' | 'saluda';
export const POSES: readonly Pose[] = ['idle', 'habla', 'piensa', 'celebra', 'senala', 'saluda'];
export type View = 'amplia' | 'mesa' | 'primer-plano';
export const VIEWS: readonly View[] = ['amplia', 'mesa', 'primer-plano'];

/** Valor posicional: 0 = unidades … 4 = decenas de millar. */
export const PLACE_LABEL = ['U', 'D', 'C', 'UM', 'DM'] as const;
export const PLACE_NAME = ['unidades', 'decenas', 'centenas', 'unidades de millar', 'decenas de millar'] as const;
export const MAX_PLACE = PLACE_LABEL.length - 1;

export interface Prop {
  id: string; kind: PropKind; at: [number, number];
  /** columna: fichas · plato/caja: galletas · tarta: porciones pintadas · semaforo: 0 apagado, 1 rojo, 2 amarillo, 3 verde. */
  n: number;
  /** columna: lugar (0 = U) · tarta: porciones totales. */
  of: number;
  label: string; tint: SwatchId | null; lit: boolean;
}

export interface CreatureState { at: [number, number]; pose: Pose; point: string | null }
export interface SceneState { props: Prop[]; creature: CreatureState; camera: View; said: string[]; rev: number }

export type SceneCommand =
  | { op: 'reset' }
  | { op: 'spawn'; id: string; kind: PropKind; at: [number, number]; n?: number; of?: number; label?: string; tint?: SwatchId }
  | { op: 'set'; id: string; n?: number; of?: number; label?: string; tint?: SwatchId }
  | { op: 'move'; id: string; to: [number, number] }
  | { op: 'remove'; id: string }
  | { op: 'light'; id: string; on: boolean }
  | { op: 'canjear'; from: string; to: string; dir: 'subir' | 'bajar'; times?: number }
  | { op: 'creature'; go?: [number, number]; pose?: Pose; point?: string | null }
  | { op: 'camera'; view: View }
  | { op: 'say'; text: string };

export type SceneEvent =
  | { type: 'crea' | 'quita' | 'cambia' | 'mueve'; id: string }
  | { type: 'canje'; from: string; to: string; dir: 'subir' | 'bajar'; times: number }
  | { type: 'dice'; text: string };

export function newScene(): SceneState {
  return { props: [], creature: { at: [-4, 1.5], pose: 'idle', point: null }, camera: 'amplia', said: [], rev: 0 };
}

/* ───────────── límites por tipo ───────────── */
function limits(kind: PropKind): { n: number; of: [number, number] } {
  switch (kind) {
    case 'columna': return { n: 120, of: [0, MAX_PLACE] };
    case 'plato': case 'caja': return { n: 60, of: [0, 0] };
    case 'tarta': return { n: 12, of: [2, 12] };
    case 'semaforo': return { n: 3, of: [0, 0] };
    case 'cartel': return { n: 0, of: [0, 0] };
  }
}

const ID_RE = /^[a-z][a-z0-9_-]{0,23}$/;
const clampStage = (p: [number, number]): [number, number] => [Math.max(-STAGE.x, Math.min(STAGE.x, p[0])), Math.max(-STAGE.z, Math.min(STAGE.z, p[1]))];
const r2 = (v: number) => Math.round(v * 100) / 100;

/** Texto seguro para mostrar: sin marcas HTML, sin controles, corto y sin hablar de cuerpos. Devuelve null si no es aceptable. */
export function cleanText(raw: unknown, max: number): string | null {
  if (typeof raw !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  const t = raw.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, max);
  if (!t || !isBodySafe(t)) return null;
  return t;
}

/* ───────────── validación de comandos externos (lista blanca) ───────────── */
export interface Rejected { index: number; reason: string }

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isInt = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
function pos(v: unknown): [number, number] | null {
  if (!Array.isArray(v) || v.length !== 2) return null;
  const [x, z] = v as unknown[];
  if (typeof x !== 'number' || typeof z !== 'number' || !Number.isFinite(x) || !Number.isFinite(z)) return null;
  if (Math.abs(x) > STAGE.x || Math.abs(z) > STAGE.z) return null;
  return [r2(x), r2(z)];
}

function validateOne(c: unknown): SceneCommand | string {
  if (!isObj(c) || typeof c.op !== 'string') return 'no es un comando';
  const idOf = (k: string): string | null => (typeof c[k] === 'string' && ID_RE.test(c[k] as string) ? (c[k] as string) : null);
  switch (c.op) {
    case 'reset': return { op: 'reset' };
    case 'spawn': {
      const id = idOf('id'); if (!id) return 'id inválido';
      if (typeof c.kind !== 'string' || !PROP_KINDS.includes(c.kind as PropKind)) return 'tipo de objeto desconocido';
      const kind = c.kind as PropKind, lim = limits(kind), at = pos(c.at); if (!at) return 'posición fuera del escenario';
      const out: SceneCommand = { op: 'spawn', id, kind, at };
      if (c.n !== undefined) { if (!isInt(c.n, 0, lim.n)) return 'cantidad fuera de rango'; out.n = c.n; }
      if (c.of !== undefined) { if (!isInt(c.of, lim.of[0], lim.of[1])) return 'valor "of" fuera de rango'; out.of = c.of; }
      if (c.label !== undefined) { const l = cleanText(c.label, 24); if (l === null) return 'etiqueta no aceptable'; out.label = l; }
      if (c.tint !== undefined) { if (typeof c.tint !== 'string' || !Object.prototype.hasOwnProperty.call(SWATCHES, c.tint)) return 'color desconocido'; out.tint = c.tint as SwatchId; }
      return out;
    }
    case 'set': {
      const id = idOf('id'); if (!id) return 'id inválido';
      const out: SceneCommand = { op: 'set', id };
      if (c.n !== undefined) { if (!isInt(c.n, 0, 120)) return 'cantidad fuera de rango'; out.n = c.n; }
      if (c.of !== undefined) { if (!isInt(c.of, 0, 12)) return 'valor "of" fuera de rango'; out.of = c.of; }
      if (c.label !== undefined) { const l = cleanText(c.label, 24); if (l === null) return 'etiqueta no aceptable'; out.label = l; }
      if (c.tint !== undefined) { if (typeof c.tint !== 'string' || !Object.prototype.hasOwnProperty.call(SWATCHES, c.tint)) return 'color desconocido'; out.tint = c.tint as SwatchId; }
      return out;
    }
    case 'move': { const id = idOf('id'), to = pos(c.to); if (!id) return 'id inválido'; if (!to) return 'destino fuera del escenario'; return { op: 'move', id, to }; }
    case 'remove': { const id = idOf('id'); return id ? { op: 'remove', id } : 'id inválido'; }
    case 'light': { const id = idOf('id'); if (!id) return 'id inválido'; if (typeof c.on !== 'boolean') return '"on" debe ser booleano'; return { op: 'light', id, on: c.on }; }
    case 'canjear': {
      const from = idOf('from'), to = idOf('to'); if (!from || !to) return 'id inválido';
      if (c.dir !== 'subir' && c.dir !== 'bajar') return 'dirección inválida';
      const out: SceneCommand = { op: 'canjear', from, to, dir: c.dir };
      if (c.times !== undefined) { if (!isInt(c.times, 1, 12)) return 'veces fuera de rango'; out.times = c.times; }
      return out;
    }
    case 'creature': {
      const out: SceneCommand = { op: 'creature' };
      if (c.go !== undefined) { const g = pos(c.go); if (!g) return 'destino fuera del escenario'; out.go = g; }
      if (c.pose !== undefined) { if (typeof c.pose !== 'string' || !POSES.includes(c.pose as Pose)) return 'pose desconocida'; out.pose = c.pose as Pose; }
      if (c.point !== undefined) { if (c.point !== null && idOf('point') === null) return 'id inválido'; out.point = c.point as string | null; }
      return out;
    }
    case 'camera': return typeof c.view === 'string' && VIEWS.includes(c.view as View) ? { op: 'camera', view: c.view as View } : 'vista desconocida';
    case 'say': { const t = cleanText(c.text, 160); return t === null ? 'texto no aceptable' : { op: 'say', text: t }; }
    default: return 'operación no permitida';
  }
}

/** Filtra una lista de comandos NO CONFIABLE: reconstruye cada uno con solo los campos permitidos y descarta el resto. */
export function validateCommands(raw: unknown): { commands: SceneCommand[]; rejected: Rejected[] } {
  const commands: SceneCommand[] = [], rejected: Rejected[] = [];
  if (!Array.isArray(raw)) return { commands, rejected: [{ index: -1, reason: 'se esperaba una lista de comandos' }] };
  raw.forEach((c, index) => {
    if (index >= MAX_COMMANDS) { rejected.push({ index, reason: 'demasiados comandos' }); return; }
    const v = validateOne(c);
    if (typeof v === 'string') rejected.push({ index, reason: v }); else commands.push(v);
  });
  return { commands, rejected };
}

/* ───────────── reductor puro ───────────── */
const clone = (s: SceneState): SceneState => ({ ...s, props: s.props.map((p) => ({ ...p, at: [...p.at] as [number, number] })), creature: { ...s.creature, at: [...s.creature.at] as [number, number] }, said: [...s.said] });
const find = (s: SceneState, id: string): Prop => { const p = s.props.find((x) => x.id === id); if (!p) throw new Error('No existe el objeto "' + id + '"'); return p; };
const column = (s: SceneState, place: number): Prop | undefined => s.props.find((p) => p.kind === 'columna' && p.of === place);

function fit(p: Prop): void {
  const lim = limits(p.kind);
  p.of = Math.max(lim.of[0], Math.min(lim.of[1], p.of));
  p.n = Math.max(0, Math.min(p.kind === 'tarta' ? p.of : lim.n, p.n));
}

/** Aplica UN comando válido. Lanza si hace referencia a algo que no existe o rompe un límite. */
export function applyCommand(state: SceneState, cmd: SceneCommand): { state: SceneState; events: SceneEvent[] } {
  const s = clone(state), events: SceneEvent[] = [];
  switch (cmd.op) {
    case 'reset': { const n = newScene(); n.rev = s.rev + 1; return { state: n, events }; }
    case 'spawn': {
      if (s.props.some((p) => p.id === cmd.id)) throw new Error('Ya existe "' + cmd.id + '"');
      if (s.props.length >= MAX_PROPS) throw new Error('Demasiados objetos en la escena');
      const p: Prop = { id: cmd.id, kind: cmd.kind, at: clampStage(cmd.at), n: cmd.n ?? 0, of: cmd.of ?? (cmd.kind === 'tarta' ? 4 : 0), label: cmd.label ?? (cmd.kind === 'columna' ? (PLACE_LABEL[cmd.of ?? 0] ?? '') : ''), tint: cmd.tint ?? null, lit: false };
      fit(p); s.props.push(p); events.push({ type: 'crea', id: p.id }); break;
    }
    case 'set': {
      const p = find(s, cmd.id);
      if (cmd.of !== undefined) p.of = cmd.of; if (cmd.n !== undefined) p.n = cmd.n;
      if (cmd.label !== undefined) p.label = cmd.label; if (cmd.tint !== undefined) p.tint = cmd.tint;
      fit(p); events.push({ type: 'cambia', id: p.id }); break;
    }
    case 'move': { const p = find(s, cmd.id); p.at = clampStage(cmd.to); events.push({ type: 'mueve', id: p.id }); break; }
    case 'remove': { find(s, cmd.id); s.props = s.props.filter((p) => p.id !== cmd.id); if (s.creature.point === cmd.id) s.creature.point = null; events.push({ type: 'quita', id: cmd.id }); break; }
    case 'light': find(s, cmd.id).lit = cmd.on; break;
    case 'canjear': {
      const a = find(s, cmd.from), b = find(s, cmd.to), times = cmd.times ?? 1;
      if (a.kind !== 'columna' || b.kind !== 'columna') throw new Error('Solo se pueden canjear columnas de valor posicional');
      const ok = cmd.dir === 'subir' ? b.of === a.of + 1 : b.of === a.of - 1;
      if (!ok) throw new Error('Las columnas no son vecinas en esa dirección');
      if (cmd.dir === 'subir') { if (a.n < 10 * times) throw new Error('No hay fichas para canjear'); a.n -= 10 * times; b.n += times; }
      else { if (a.n < times) throw new Error('No hay fichas para canjear'); if (b.n + 10 * times > limits('columna').n) throw new Error('La columna se llenaría demasiado'); a.n -= times; b.n += 10 * times; }
      events.push({ type: 'canje', from: a.id, to: b.id, dir: cmd.dir, times }); break;
    }
    case 'creature': {
      if (cmd.go) s.creature.at = clampStage(cmd.go);
      if (cmd.pose) s.creature.pose = cmd.pose;
      if (cmd.point !== undefined) { if (cmd.point !== null) find(s, cmd.point); s.creature.point = cmd.point; }
      break;
    }
    case 'camera': s.camera = cmd.view; break;
    case 'say': s.said = [...s.said, cmd.text].slice(-MAX_SAID); events.push({ type: 'dice', text: cmd.text }); break;
  }
  s.rev += 1;
  return { state: s, events };
}

/** Aplica una lista; un comando que falla se anota y se salta (la escena nunca queda a medias dentro de un comando). */
export function applyCommands(state: SceneState, cmds: SceneCommand[]): { state: SceneState; events: SceneEvent[]; errors: string[] } {
  let cur = state; const events: SceneEvent[] = [], errors: string[] = [];
  for (const c of cmds) {
    try { const r = applyCommand(cur, c); cur = r.state; events.push(...r.events); } catch (e) { errors.push(e instanceof Error ? e.message : String(e)); }
  }
  return { state: cur, events, errors };
}

/* ───────────── manipulación por la niña ───────────── */
/** Mueve un objeto (arrastrar). Queda siempre dentro del escenario. */
export function userMove(state: SceneState, id: string, to: [number, number]): SceneState {
  if (!Number.isFinite(to[0]) || !Number.isFinite(to[1])) throw new Error('Posición inválida');
  return applyCommand(state, { op: 'move', id, to: [r2(Math.max(-STAGE.x, Math.min(STAGE.x, to[0]))), r2(Math.max(-STAGE.z, Math.min(STAGE.z, to[1])))] }).state;
}

/** Añade o quita una unidad al objeto (ficha, galleta, porción pintada…). Respeta los límites del tipo. */
export function userAdjust(state: SceneState, id: string, delta: 1 | -1): SceneState {
  const p = find(state, id);
  if (p.kind === 'cartel') return state;
  if (p.kind === 'semaforo') return applyCommand(state, { op: 'set', id, n: (p.n + (delta > 0 ? 1 : 3)) % 4 }).state;
  const next = Math.max(0, Math.min(p.kind === 'tarta' ? p.of : limits(p.kind).n, p.n + delta));
  return next === p.n ? state : applyCommand(state, { op: 'set', id, n: next }).state;
}

/** Canje manual: 10 fichas → 1 de la columna de la izquierda ('subir'), o 1 ficha → 10 de la derecha ('bajar'). Devuelve el mismo estado si no se puede. */
export function userExchange(state: SceneState, id: string, dir: 'subir' | 'bajar'): SceneState {
  const a = find(state, id);
  if (a.kind !== 'columna') return state;
  const b = column(state, dir === 'subir' ? a.of + 1 : a.of - 1);
  if (!b) return state;
  try { return applyCommand(state, { op: 'canjear', from: a.id, to: b.id, dir }).state; } catch { return state; }
}

/* ───────────── objetivos de construcción ("ahora hazlo tú") ───────────── */
export type BuildGoal =
  | { kind: 'valor'; target: number }
  | { kind: 'galletas'; target: number }
  | { kind: 'tarta'; id: string; target: number };

/** Valor total de las columnas de valor posicional: Σ fichas × 10^lugar. Es invariante al canjear. */
export function builtValue(state: SceneState): number {
  return state.props.reduce((t, p) => (p.kind === 'columna' ? t + p.n * 10 ** p.of : t), 0);
}
export function cookieCount(state: SceneState): number {
  return state.props.reduce((t, p) => (p.kind === 'plato' || p.kind === 'caja' ? t + p.n : t), 0);
}

export function checkBuild(state: SceneState, goal: BuildGoal): { done: boolean; now: number; target: number } {
  const now = goal.kind === 'valor' ? builtValue(state) : goal.kind === 'galletas' ? cookieCount(state) : (state.props.find((p) => p.id === goal.id)?.n ?? 0);
  return { done: now === goal.target, now, target: goal.target };
}
