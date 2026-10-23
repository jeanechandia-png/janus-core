/**
 * Ánimo con base en evidencia. Fuentes en README.md:
 * - Mueller & Dweck (1998): elogiar la inteligencia ("eres listo") reduce la persistencia tras fallos;
 *   elogiar el esfuerzo y la estrategia la aumenta. → por defecto, elogio de proceso.
 * - AAP (Golden et al., 2016): evitar hablar de peso/dietas con niños y adolescentes; centrarse en hábitos
 *   y en un ambiente de apoyo. → el compañero NUNCA comenta peso, tallas ni apariencia corporal.
 * Regla de Jean: sutil, nunca agobiante; espontáneo de vez en cuando o cuando haga falta.
 */
/** Límite de palabra compatible con acentos (\b de JS no reconoce á, ñ…). */
const w = (src: string) => new RegExp('(?<![\\p{L}])(?:' + src + ')(?![\\p{L}])', 'iu');
export type Moment = 'acierto' | 'error' | 'frustracion' | 'termino-tarea' | 'espontaneo' | 'tristeza' | 'buenos-dias' | 'buenas-noches';

export interface EncourageState {
  /** Marcas de tiempo (ms) de los mensajes de ánimo ya dichos. */
  said: number[];
  /** Últimos ids usados para no repetir. */
  recent: string[];
}

export interface EncouragePolicy {
  /** Mínimo entre mensajes espontáneos (ms). Por defecto 25 min. */
  minGapSpontaneousMs: number;
  /** Máximo de mensajes de ánimo por hora (de cualquier tipo). */
  maxPerHour: number;
}

export const DEFAULT_POLICY: EncouragePolicy = { minGapSpontaneousMs: 25 * 60_000, maxPerHour: 4 };

interface Line { id: string; m: Moment[]; t: string }

/** {n} = nombre del niño/a. Mensajes de proceso, valía, resiliencia, amabilidad y autocuidado sin cuerpo. */
const LINES: Line[] = [
  { id: 'p1', m: ['acierto'], t: '¡Lo lograste porque lo pensaste paso a paso, {n}!' },
  { id: 'p2', m: ['acierto'], t: 'Esa estrategia fue brillante. Tu cabecita trabaja precioso.' },
  { id: 'p3', m: ['acierto', 'termino-tarea'], t: '¡Mira todo lo que aprendiste hoy! Eres capaz de mucho, {n}.' },
  { id: 'e1', m: ['error'], t: 'Equivocarse es parte de aprender. ¿Probamos otra forma juntas?' },
  { id: 'e2', m: ['error'], t: 'Todavía no sale… y "todavía" es una palabra mágica. ¡Vamos otra vez!' },
  { id: 'e3', m: ['error', 'frustracion'], t: 'Las personas fuertes se caen y se levantan con la cabeza en alto. Como tú.' },
  { id: 'f1', m: ['frustracion'], t: 'Respiremos tres veces como globos: inflar… soltar… ¡Listo! Ahora seguimos.' },
  { id: 'f2', m: ['frustracion'], t: '¿Hacemos una pausa de dos minutos y volvemos con más fuerza?' },
  { id: 't1', m: ['termino-tarea'], t: '¡Terminaste! Eso se llama constancia, y tú la tienes.' },
  { id: 's1', m: ['espontaneo'], t: 'Por cierto, {n}: me encanta lo valiente que eres.' },
  { id: 's2', m: ['espontaneo'], t: 'Eres una persona muy especial y poderosa, ¿lo sabías?' },
  { id: 's3', m: ['espontaneo'], t: '¿Ya tomaste agüita? Las princesas exploradoras se hidratan. 💧' },
  { id: 's4', m: ['espontaneo'], t: 'Hoy tu energía brilla. ¡Qué bonito es ser amable con los demás!' },
  { id: 's5', m: ['espontaneo'], t: 'Una fruta rica te da superpoderes para pensar. ¿Cuál es tu favorita?' },
  { id: 'b1', m: ['buenos-dias'], t: '¡Buenos días, {n}! Hoy puedes con todo. Peinadita, desayuno rico y a brillar.' },
  { id: 'n1', m: ['buenas-noches'], t: 'Buenas noches, {n}. Hoy hiciste cosas valientes. Dormir bien te hace fuerte.' },
  { id: 'r1', m: ['tristeza'], t: 'Estoy aquí contigo. Lo que sientes importa. ¿Quieres contarme qué pasó?' },
  { id: 'r2', m: ['tristeza'], t: 'Tú vales muchísimo, tal como eres. Lo que digan otros no cambia eso.' }
];

/** Palabras que el compañero nunca usa al hablar con el niño/a (sesgo de peso y apariencia corporal). */
export const FORBIDDEN_TOPICS = w(/gord[ao]s?|flac[ao]s?|peso|kilos?|dieta|adelgaz\w*|engord\w*|talla|barriga|gordit[ao]s?/.source);

export function isBodySafe(text: string): boolean {
  return !FORBIDDEN_TOPICS.test(text);
}

/** Devuelve una frase o null si la política dice "ahora no" (para no agobiar). */
export function pickEncouragement(moment: Moment, childName: string, state: EncourageState, now: number, policy: EncouragePolicy = DEFAULT_POLICY, rnd: () => number = Math.random): string | null {
  const hour = state.said.filter((t) => now - t < 3_600_000);
  const urgent = moment === 'tristeza' || moment === 'frustracion';
  if (!urgent && hour.length >= policy.maxPerHour) return null;
  if (moment === 'espontaneo') {
    const last = state.said[state.said.length - 1];
    if (last !== undefined && now - last < policy.minGapSpontaneousMs) return null;
  }
  const pool = LINES.filter((l) => l.m.includes(moment) && !state.recent.includes(l.id));
  const options = pool.length ? pool : LINES.filter((l) => l.m.includes(moment));
  if (!options.length) return null;
  const line = options[Math.floor(rnd() * options.length)]!;
  state.said.push(now);
  state.recent = [...state.recent, line.id].slice(-6);
  return line.t.replaceAll('{n}', childName);
}

/** Toda respuesta del modelo pasa por aquí antes de hablar con el niño/a. */
export function guardReply(text: string): { ok: boolean; text: string } {
  if (isBodySafe(text)) return { ok: true, text };
  return { ok: false, text: 'Mmm, mejor hablemos de lo que te hace sentir fuerte y feliz. ¿Qué fue lo mejor de tu día?' };
}
