/**
 * scene-stage · Lecciones con la escena: convierte un ejercicio del tutor en pasos que la criatura "enseña" manipulando la escena
 * y que la niña puede repetir con sus manos ("tu turno").
 *
 * Base pedagógica (HECHO VERIFICADO: IES/WWC 2021006, Fuchs et al., 2021):
 *  - Rec. 1  Instrucción sistemática y explícita → pasos cortos, siempre en el mismo orden, con "tu turno".
 *  - Rec. 2  Lenguaje matemático → se nombran unidades, decenas, centenas, porciones, grupos…
 *  - Rec. 3  Representaciones → objetos concretos (galletas, platos, fichas) conectados con la notación (cartel), y retirada gradual.
 * Las lecciones NO sustituyen a un profesional: apoyan el estudio y la práctica guiada.
 */
import { PLACE_NAME, cleanText, type BuildGoal, type SceneCommand, type TextGuard } from './scene.js';

export type LessonTopic = 'suma' | 'resta' | 'multiplicacion' | 'division' | 'fracciones' | 'problema';
/** Lo mínimo que necesita una lección de un ejercicio (cualquier tutor que lo cumpla sirve). */
export interface LessonInput {
  id: string; topic: LessonTopic;
  /** suma/resta/multiplicacion: [a, b] · division: [divisor, cociente] · fracciones: [n1, n2, d] · problema: [cajas, galletas por caja]. */
  params: readonly number[];
}
/** La "voz" con la que el guía abre y cierra la lección (cada personaje aporta la suya). */
export interface LessonVoice { id: string; openers: readonly string[]; closers: readonly string[] }

export interface LessonStep {
  id: string;
  /** Lo que dice la criatura (se muestra y se lee en voz alta). */
  say: string;
  commands: SceneCommand[];
  /** true = este paso ya muestra (total o parcialmente) la respuesta. Solo se reproduce si la niña pide ver la solución. */
  reveals: boolean;
  /** "Tu turno": lo que debe construir la niña con sus manos. */
  build?: BuildGoal;
}

export interface Lesson { exerciseId: string; topic: LessonTopic; voiceId: string; steps: LessonStep[]; basis: string[] }

export const LESSON_BASIS: readonly string[] = [
  'IES/WWC 2021006 · Rec. 1 · instrucción sistemática y explícita (pasos cortos y "tu turno")',
  'IES/WWC 2021006 · Rec. 2 · lenguaje matemático (se nombran unidades, decenas, porciones…)',
  'IES/WWC 2021006 · Rec. 3 · representaciones concretas conectadas con la notación (evidencia sólida)'
];

/** Pasos que se pueden reproducir: sin solución (primera ayuda) o todos (la niña pide ver los pasos). */
export function stepsFor(lesson: Lesson, includeSolution: boolean): LessonStep[] {
  if (includeSolution) return lesson.steps;
  const i = lesson.steps.findIndex((s) => s.reveals);
  return i < 0 ? lesson.steps : lesson.steps.slice(0, i);
}

/* ───────────── utilidades ───────────── */
const PLACE_ONE = ['unidad', 'decena', 'centena', 'unidad de millar', 'decena de millar'] as const;
const nd = (n: number) => String(Math.abs(Math.trunc(n))).length;
function digits(n: number, places: number): number[] { const out: number[] = []; let v = n; for (let i = 0; i < places; i++) { out.push(v % 10); v = Math.floor(v / 10); } return out; }
const placeName = (p: number, n: number) => (n === 1 ? PLACE_ONE[p] : PLACE_NAME[p]) ?? '';
function describe(ds: number[]): string {
  const parts: string[] = [];
  for (let p = ds.length - 1; p >= 0; p--) { const n = ds[p] ?? 0; if (n > 0) parts.push(n + ' ' + placeName(p, n)); }
  if (!parts.length) return 'nada';
  if (parts.length === 1) return parts[0]!;
  return parts.slice(0, -1).join(', ') + ' y ' + parts[parts.length - 1];
}
const hash = (s: string) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
const pick = <T>(xs: T[], seed: string): T => xs[hash(seed) % xs.length]!;

const CX = 1.5;
const colId = (p: number) => 'c' + p;
const r2 = (v: number) => Math.round(v * 100) / 100;
const colX = (p: number, P: number) => r2(CX + ((P - 1) / 2) * 1.5 - 1.5 * p);
const sign = (label: string): SceneCommand => ({ op: 'set', id: 'cartel', label });
const spawnSign = (label: string): SceneCommand => ({ op: 'spawn', id: 'cartel', kind: 'cartel', at: [CX, -2.7], label, tint: 'dorado' });
const spawnColumns = (P: number): SceneCommand[] => Array.from({ length: P }, (_, p) => ({ op: 'spawn', id: colId(p), kind: 'columna', at: [colX(p, P), 0], of: p, n: 0 }) as SceneCommand);
const setColumns = (ds: number[]): SceneCommand[] => ds.map((n, p) => ({ op: 'set', id: colId(p), n }) as SceneCommand);
const sideSpot = (P: number): [number, number] => [r2(Math.max(-5, colX(P - 1, P) - 1.9)), 0.8];
const lightAll = (P: number, on: boolean): SceneCommand[] => Array.from({ length: P }, (_, p) => ({ op: 'light', id: colId(p), on }) as SceneCommand);

/** Texto de lección: nunca se recorta en silencio (si es demasiado largo o no es aceptable, falla en las pruebas). */
let GUARD: TextGuard | undefined;
function safe(text: string, max: number, where: string): string {
  if (text.length > max) throw new Error('Texto demasiado largo (' + text.length + ' > ' + max + ') en ' + where);
  const clean = cleanText(text, max, GUARD);
  if (clean === null) throw new Error('Texto de lección no aceptable en ' + where);
  return clean;
}
const SAY_MAX = 240;

function step(id: string, say: string, commands: SceneCommand[], reveals: boolean, build?: BuildGoal): LessonStep {
  const clean = safe(say, SAY_MAX, 'paso ' + id);
  return build ? { id, say: clean, commands, reveals, build } : { id, say: clean, commands, reveals };
}

/* ───────────── por tema ───────────── */
function normalizeUp(cur: number[], P: number, idPrefix: string, intro: (p: number, have: number, k: number) => string): LessonStep[] {
  const out: LessonStep[] = [];
  for (let p = 0; p < P - 1; p++) {
    const k = Math.floor((cur[p] ?? 0) / 10);
    if (k > 0) {
      out.push(step(idPrefix + p, intro(p, cur[p] ?? 0, k), [{ op: 'light', id: colId(p), on: true }, { op: 'canjear', from: colId(p), to: colId(p + 1), dir: 'subir', times: k }, { op: 'light', id: colId(p), on: false }, { op: 'light', id: colId(p + 1), on: true }], true));
      cur[p] = (cur[p] ?? 0) - 10 * k; cur[p + 1] = (cur[p + 1] ?? 0) + k;
    }
  }
  return out;
}

function suma(ex: LessonInput): LessonStep[] {
  const [a = 0, b = 0] = ex.params, sum = a + b, P = Math.min(5, nd(sum)), da = digits(a, P), db = digits(b, P);
  const here = sideSpot(P);
  const steps: LessonStep[] = [
    step('intro', 'Vamos a ver ' + a + ' + ' + b + ' con fichas. Cada columna vale 10 veces más que la de su derecha.', [{ op: 'reset' }, { op: 'camera', view: 'mesa' }, ...spawnColumns(P), spawnSign(a + ' + ' + b), { op: 'creature', go: here, pose: 'habla' }], false),
    step('poner-a', 'Primero ponemos ' + a + ': ' + describe(da) + '.', [...setColumns(da), ...lightAll(P, false), { op: 'creature', point: colId(0), pose: 'senala' }], false),
    step('poner-b', 'Ahora sumamos ' + b + ': ' + describe(db) + '. Las fichas se juntan en cada columna.', [...setColumns(da.map((d, p) => d + (db[p] ?? 0))), { op: 'creature', pose: 'habla' }], false)
  ];
  const cur = da.map((d, p) => d + (db[p] ?? 0));
  const carries = normalizeUp(cur, P, 'canje-', (p, have, k) => 'En las ' + PLACE_NAME[p] + ' hay ' + have + ' fichas. Cada 10 se cambian por 1 de ' + placeName(p + 1, 1) + ': cambiamos ' + (10 * k) + ' por ' + k + '.');
  if (carries.length) steps.push(...carries); else steps.push(step('sin-canje', 'En ninguna columna hay 10 fichas o más, así que no hace falta cambiar nada.', [], true));
  steps.push(step('resultado', 'Contamos lo que hay: ' + describe(digits(sum, P)) + '. ¡' + a + ' + ' + b + ' = ' + sum + '!', [...lightAll(P, false), sign(a + ' + ' + b + ' = ' + sum), { op: 'creature', pose: 'celebra', point: null }], true));
  steps.push(step('tu-turno', 'Tu turno: construye ' + sum + ' tú con las fichas. Toca + y − en cada columna, o cambia 10 por 1.', [...setColumns(Array(P).fill(0) as number[]), ...lightAll(P, false), { op: 'creature', pose: 'idle' }], true, { kind: 'valor', target: sum }));
  return steps;
}

function resta(ex: LessonInput): LessonStep[] {
  const [a = 0, b = 0] = ex.params, ans = a - b, P = Math.min(5, nd(a)), da = digits(a, P), db = digits(b, P);
  const here = sideSpot(P);
  const steps: LessonStep[] = [
    step('intro', 'Vamos a ver ' + a + ' − ' + b + ' con fichas. Restar es quitar, y a veces hay que cambiar una ficha grande por diez pequeñas.', [{ op: 'reset' }, { op: 'camera', view: 'mesa' }, ...spawnColumns(P), spawnSign(a + ' − ' + b), { op: 'creature', go: here, pose: 'habla' }], false),
    step('poner-a', 'Primero ponemos ' + a + ': ' + describe(da) + '.', [...setColumns(da), { op: 'creature', point: colId(0), pose: 'senala' }], false),
    step('quitar-b', 'Ahora hay que quitar ' + b + ': ' + describe(db) + '. Empezamos por las unidades.', [{ op: 'creature', pose: 'piensa' }], false)
  ];
  const cur = [...da];
  for (let p = 0; p < P; p++) {
    const need = db[p] ?? 0;
    if (need === 0) continue;
    if ((cur[p] ?? 0) < need) {
      let q = p + 1; while (q < P && (cur[q] ?? 0) === 0) q++;
      const cmds: SceneCommand[] = [];
      for (let r = q; r > p; r--) { cmds.push({ op: 'canjear', from: colId(r), to: colId(r - 1), dir: 'bajar', times: 1 }); cur[r] = (cur[r] ?? 0) - 1; cur[r - 1] = (cur[r - 1] ?? 0) + 10; }
      steps.push(step('prestamo-' + p, 'En las ' + PLACE_NAME[p] + ' no alcanzan las fichas. Cambiamos 1 ficha de ' + placeName(q, 1) + ' por 10 de ' + placeName(q - 1, 10) + (q - 1 > p ? ' y seguimos hasta llegar a las ' + PLACE_NAME[p] : '') + '.', [{ op: 'light', id: colId(q), on: true }, ...cmds, { op: 'light', id: colId(q), on: false }], true));
    }
    cur[p] = (cur[p] ?? 0) - need;
    steps.push(step('quitar-' + p, 'Quitamos ' + need + ' ' + placeName(p, need) + '.', [{ op: 'light', id: colId(p), on: true }, { op: 'set', id: colId(p), n: cur[p] ?? 0 }, { op: 'light', id: colId(p), on: false }], true));
  }
  steps.push(step('resultado', 'Lo que queda son ' + describe(digits(ans, P)) + '. ¡' + a + ' − ' + b + ' = ' + ans + '!', [sign(a + ' − ' + b + ' = ' + ans), { op: 'creature', pose: 'celebra', point: null }], true));
  steps.push(step('tu-turno', 'Tu turno: empieza con ' + a + ' y quita ' + b + ' tú. Si no alcanzan las fichas, cambia 1 por 10.', [...setColumns(da), { op: 'creature', pose: 'idle' }], true, { kind: 'valor', target: ans }));
  return steps;
}

const grid = (i: number, total: number): [number, number] => { const perRow = Math.min(6, total), row = Math.floor(i / perRow), inRow = Math.min(perRow, total - row * perRow), col = i % perRow; return [r2(CX + (col - (inRow - 1) / 2) * 1.7), r2(-0.6 + row * 1.7)]; };

function multiplicacion(ex: LessonInput): LessonStep[] {
  const [a = 0, b = 0] = ex.params, prod = a * b;
  if (a <= 12 && b <= 12) {
    const plates = Array.from({ length: b }, (_, i) => 'p' + i);
    const steps: LessonStep[] = [
      step('intro', a + ' × ' + b + ' quiere decir ' + b + ' grupos de ' + a + '. Aquí están los ' + b + ' platos.', [{ op: 'reset' }, { op: 'camera', view: 'mesa' }, ...plates.map((id, i) => ({ op: 'spawn', id, kind: 'plato', at: grid(i, b), n: 0 }) as SceneCommand), spawnSign(a + ' × ' + b), { op: 'creature', go: [-3.6, 0.8], pose: 'habla' }], false),
      step('poner', 'Ponemos ' + a + ' galletas en cada plato.', plates.map((id) => ({ op: 'set', id, n: a }) as SceneCommand), false),
      step('contar', 'Contamos de ' + a + ' en ' + a + '.', [{ op: 'creature', pose: 'senala', point: 'p0' }, ...plates.flatMap((id, i) => [{ op: 'light', id, on: true }, sign(String(a * (i + 1)))] as SceneCommand[])], true),
      step('resultado', '¡' + a + ' × ' + b + ' = ' + prod + '!', [...plates.map((id) => ({ op: 'light', id, on: false }) as SceneCommand), sign(a + ' × ' + b + ' = ' + prod), { op: 'creature', pose: 'celebra', point: null }], true)
    ];
    return steps;
  }
  const P = Math.min(5, nd(prod)), da = digits(a, P), here = sideSpot(P);
  const steps: LessonStep[] = [
    step('intro', a + ' × ' + b + ': multiplicar es repetir ' + a + ', ' + b + ' veces. Lo hacemos por columnas.', [{ op: 'reset' }, { op: 'camera', view: 'mesa' }, ...spawnColumns(P), spawnSign(a + ' × ' + b), { op: 'creature', go: here, pose: 'habla' }], false),
    step('poner-a', 'Primero ponemos ' + a + ': ' + describe(da) + '.', [...setColumns(da), { op: 'creature', point: colId(0), pose: 'senala' }], false),
    step('repetir', 'Repetimos cada columna ' + b + ' veces.', setColumns(da.map((d) => d * b)), false)
  ];
  const cur = da.map((d) => d * b);
  steps.push(...normalizeUp(cur, P, 'canje-', (p, have, k) => 'En las ' + PLACE_NAME[p] + ' hay ' + have + ' fichas. Cambiamos ' + (10 * k) + ' por ' + k + ' de ' + placeName(p + 1, k) + '.'));
  steps.push(step('resultado', 'Contamos lo que hay: ' + describe(digits(prod, P)) + '. ¡' + a + ' × ' + b + ' = ' + prod + '!', [...lightAll(P, false), sign(a + ' × ' + b + ' = ' + prod), { op: 'creature', pose: 'celebra', point: null }], true));
  if (prod <= 999) steps.push(step('tu-turno', 'Tu turno: construye ' + prod + ' tú con las fichas.', [...setColumns(Array(P).fill(0) as number[]), { op: 'creature', pose: 'idle' }], true, { kind: 'valor', target: prod }));
  return steps;
}

function division(ex: LessonInput): LessonStep[] {
  const [b = 1, q = 0] = ex.params, total = b * q;
  if (total <= 60) {
    const plates = Array.from({ length: b }, (_, i) => 'p' + i);
    return [
      step('intro', 'Tenemos ' + total + ' galletas para repartir entre ' + b + ' platos, igual en cada uno.', [{ op: 'reset' }, { op: 'camera', view: 'mesa' }, { op: 'spawn', id: 'caja', kind: 'caja', at: [CX, -1.9], n: total }, ...plates.map((id, i) => ({ op: 'spawn', id, kind: 'plato', at: grid(i, b).map((v, k) => (k === 1 ? v + 1 : v)) as [number, number], n: 0 }) as SceneCommand), spawnSign(total + ' ÷ ' + b), { op: 'creature', go: [-3.6, 0.8], pose: 'habla' }], false),
      step('una-vuelta', 'Repartimos de una en una: una galleta para cada plato.', [...plates.map((id) => ({ op: 'set', id, n: 1 }) as SceneCommand), { op: 'set', id: 'caja', n: total - b }], false),
      step('seguir', 'Seguimos repartiendo hasta que no quede ninguna. ¡Cada plato tiene ' + q + '!', [...plates.map((id) => ({ op: 'set', id, n: q }) as SceneCommand), { op: 'set', id: 'caja', n: 0 }, { op: 'creature', pose: 'senala', point: 'p0' }], true),
      step('resultado', '¡' + total + ' ÷ ' + b + ' = ' + q + '!', [sign(total + ' ÷ ' + b + ' = ' + q), { op: 'creature', pose: 'celebra', point: null }], true)
    ];
  }
  const P = Math.min(5, nd(total)), dt = digits(total, P), dq = digits(q, P), here = sideSpot(P);
  const steps: LessonStep[] = [
    step('intro', total + ' ÷ ' + b + ': pensamos al revés. ¿Qué número multiplicado por ' + b + ' da ' + total + '?', [{ op: 'reset' }, { op: 'camera', view: 'mesa' }, ...spawnColumns(P), ...setColumns(dt), spawnSign('? × ' + b + ' = ' + total), { op: 'creature', go: here, pose: 'piensa' }], false),
    step('tabla', 'Mira la tabla del ' + b + ' y prueba números hasta llegar a ' + total + '.', [{ op: 'creature', pose: 'habla' }], false),
    step('probar', 'Probamos con ' + q + ': lo repetimos ' + b + ' veces.', [{ op: 'creature', pose: 'senala', point: colId(0) }, ...setColumns(dq.map((d) => d * b))], true)
  ];
  const cur = dq.map((d) => d * b);
  steps.push(...normalizeUp(cur, P, 'canje-', (p, have, k) => 'En las ' + PLACE_NAME[p] + ' hay ' + have + ' fichas. Cambiamos ' + (10 * k) + ' por ' + k + ' de ' + placeName(p + 1, k) + '.'));
  steps.push(step('resultado', 'Sale ' + total + '. Así que ' + q + ' × ' + b + ' = ' + total + ' y ' + total + ' ÷ ' + b + ' = ' + q + '.', [sign(total + ' ÷ ' + b + ' = ' + q), { op: 'creature', pose: 'celebra', point: null }], true));
  return steps;
}

function fracciones(ex: LessonInput): LessonStep[] {
  const [n1 = 1, n2 = 1, d = 2] = ex.params, n = n1 + n2;
  const gcd = (x: number, y: number): number => (y ? gcd(y, x % y) : x), g = gcd(n, d);
  const steps: LessonStep[] = [
    step('intro', 'Cada tarta está partida en ' + d + ' porciones iguales. Cada porción es 1/' + d + '. Aquí hay ' + n1 + '/' + d + ' y aquí ' + n2 + '/' + d + '.', [{ op: 'reset' }, { op: 'camera', view: 'mesa' }, { op: 'spawn', id: 'ta', kind: 'tarta', at: [-0.4, 0], of: d, n: n1 }, { op: 'spawn', id: 'tb', kind: 'tarta', at: [2.6, 0], of: d, n: n2 }, spawnSign(n1 + '/' + d + ' + ' + n2 + '/' + d), { op: 'creature', go: [-3.6, 0.8], pose: 'habla' }], false),
    step('mismo-tamano', 'Las porciones son del mismo tamaño, así que se pueden juntar y contar.', [{ op: 'light', id: 'ta', on: true }, { op: 'light', id: 'tb', on: true }, { op: 'creature', pose: 'piensa' }], false)
  ];
  const join: SceneCommand[] = [{ op: 'light', id: 'ta', on: false }, { op: 'light', id: 'tb', on: false }];
  if (n <= d) join.push({ op: 'remove', id: 'tb' }, { op: 'set', id: 'ta', n }, { op: 'move', id: 'ta', to: [1.1, 0] });
  else join.push({ op: 'set', id: 'ta', n: d }, { op: 'set', id: 'tb', n: n - d });
  join.push(sign(n + '/' + d), { op: 'creature', pose: 'senala', point: 'ta' });
  steps.push(step('juntar', 'Juntamos las porciones: ' + n1 + ' + ' + n2 + ' = ' + n + ' porciones de ' + d + '.', join, true));
  if (g > 1) {
    const sd = d / g, sn = n / g;
    steps.push(step('simplificar', n + '/' + d + ' es lo mismo que ' + sn + '/' + sd + (sd === 1 ? ': ¡una tarta entera!' : ': usamos trozos más grandes.'), sd === 1 ? [sign(n + '/' + d + ' = ' + sn + '/' + sd)] : [{ op: 'spawn', id: 'td', kind: 'tarta', at: [4.6, 0], of: sd, n: sn, tint: 'menta' }, sign(n + '/' + d + ' = ' + sn + '/' + sd)], true));
  }
  steps.push(step('resultado', '¡' + n1 + '/' + d + ' + ' + n2 + '/' + d + ' = ' + (g > 1 ? n / g + '/' + d / g : n + '/' + d) + '!', [{ op: 'creature', pose: 'celebra', point: null }], true));
  return steps;
}

function problema(ex: LessonInput): LessonStep[] {
  const [c = 2, p = 3] = ex.params, total = c * p, ans = total - c;
  const boxes = Array.from({ length: c }, (_, i) => 'b' + i);
  return [
    step('intro', 'Hay ' + c + ' cajas con ' + p + ' galletas cada una. Vamos a contarlas.', [{ op: 'reset' }, { op: 'camera', view: 'mesa' }, ...boxes.map((id, i) => ({ op: 'spawn', id, kind: 'caja', at: grid(i, c), n: p }) as SceneCommand), spawnSign(c + ' × ' + p), { op: 'creature', go: [-3.6, 0.8], pose: 'habla' }], false),
    step('total', 'Primero juntamos todas en un plato: ' + c + ' × ' + p + ' = ' + total + '.', [...boxes.map((id) => ({ op: 'remove', id }) as SceneCommand), { op: 'spawn', id: 'plato', kind: 'plato', at: [CX, 0], n: total }, sign(c + ' × ' + p + ' = ' + total), { op: 'creature', pose: 'senala', point: 'plato' }], true),
    step('regalar', 'Ahora regalas ' + c + ': quitamos ' + c + ' galletas. ' + total + ' − ' + c + ' = ' + ans + '.', [{ op: 'light', id: 'plato', on: true }, { op: 'set', id: 'plato', n: ans }, sign(total + ' − ' + c + ' = ' + ans), { op: 'light', id: 'plato', on: false }, { op: 'creature', pose: 'celebra', point: null }], true)
  ];
}

const BUILDERS: Record<LessonTopic, (e: LessonInput) => LessonStep[]> = { suma, resta, multiplicacion, division, fracciones, problema };

/** Construye la lección de un ejercicio con la voz del guía (su carácter no cambia aunque quien juega lo vista). */
export function buildLesson(ex: LessonInput, voice: LessonVoice, opts: { textGuard?: TextGuard } = {}): Lesson {
  if (!Array.isArray(ex.params) || ex.params.length < 2) throw new Error('El ejercicio no trae parámetros para la escena');
  const build = BUILDERS[ex.topic];
  if (!build) throw new Error('Tema sin lección: ' + String(ex.topic));
  if (!voice.openers.length || !voice.closers.length) throw new Error('La voz del guía necesita al menos una apertura y un cierre');
  GUARD = opts.textGuard;
  try {
    const steps = build(ex);
    const first = steps[0], last = steps[steps.length - 1];
    const opener = pick([...voice.openers], ex.id), closer = pick([...voice.closers], ex.id + 'x');
    if (first) first.say = safe(opener + ' ' + first.say, 2 * SAY_MAX, 'apertura de ' + ex.id);
    if (last && last !== first) last.say = safe(last.say + ' ' + closer, 2 * SAY_MAX, 'cierre de ' + ex.id);
    return { exerciseId: ex.id, topic: ex.topic, voiceId: voice.id, steps, basis: [...LESSON_BASIS] };
  } finally { GUARD = undefined; }
}
