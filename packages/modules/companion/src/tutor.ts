/** Tutor de matemáticas paso a paso (primaria, 8–12 años). Determinista con semilla para poder probarlo. */
export type Topic = 'suma' | 'resta' | 'multiplicacion' | 'division' | 'fracciones' | 'problema';

export interface Exercise {
  id: string;
  topic: Topic;
  level: 1 | 2 | 3;
  prompt: string;
  answer: string;
  hints: string[];
}

function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 10_000) / 10_000; };
}
const int = (r: () => number, a: number, b: number) => a + Math.floor(r() * (b - a + 1));
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

export function makeExercise(topic: Topic, level: 1 | 2 | 3, seed: number): Exercise {
  const r = rng(seed), id = topic + '-' + level + '-' + seed;
  switch (topic) {
    case 'suma': { const a = int(r, 10 ** level, 10 ** (level + 1) - 1), b = int(r, 10 ** level, 10 ** (level + 1) - 1); return { id, topic, level, prompt: a + ' + ' + b + ' = ?', answer: String(a + b), hints: ['Suma primero las unidades.', 'Si pasa de 9, te llevas una a las decenas.', 'Ahora suma las decenas y lo que te llevaste.'] }; }
    case 'resta': { const a = int(r, 10 ** level * 2, 10 ** (level + 1) - 1), b = int(r, 10 ** level, a - 1); return { id, topic, level, prompt: a + ' − ' + b + ' = ?', answer: String(a - b), hints: ['Empieza por las unidades.', 'Si arriba hay menos, pide prestado una decena.', 'Comprueba: tu resultado + ' + b + ' debe dar ' + a + '.'] }; }
    case 'multiplicacion': { const a = int(r, 2, level === 1 ? 10 : level === 2 ? 25 : 99), b = int(r, 2, level === 3 ? 12 : 10); return { id, topic, level, prompt: a + ' × ' + b + ' = ?', answer: String(a * b), hints: ['Multiplicar es sumar ' + a + ' muchas veces: ' + b + ' veces.', 'Separa: ' + a + ' × ' + b + ' = (' + (a - (a % 10)) + ' × ' + b + ') + (' + (a % 10) + ' × ' + b + ').', 'Suma las dos partes.'] }; }
    case 'division': { const b = int(r, 2, level === 1 ? 5 : 10), q = int(r, 2, level === 3 ? 30 : 12); return { id, topic, level, prompt: (b * q) + ' ÷ ' + b + ' = ?', answer: String(q), hints: ['¿Qué número por ' + b + ' da ' + (b * q) + '?', 'Piensa en la tabla del ' + b + '.', 'Reparte ' + (b * q) + ' caramelos entre ' + b + ' amigos: ¿cuántos para cada uno?'] }; }
    case 'fracciones': { const d = int(r, 2, level === 1 ? 4 : 8), n1 = int(r, 1, d - 1), n2 = int(r, 1, d - 1); const n = n1 + n2, g = gcd(n, d); return { id, topic, level, prompt: n1 + '/' + d + ' + ' + n2 + '/' + d + ' = ?', answer: (n / g) + '/' + (d / g), hints: ['Cuando el número de abajo es igual, solo sumas los de arriba.', 'Arriba: ' + n1 + ' + ' + n2 + '. Abajo se queda ' + d + '.', 'Simplifica si puedes dividir arriba y abajo por el mismo número.'] }; }
    default: { const p = int(r, 3, 9), c = int(r, 2, 6); return { id, topic: 'problema', level, prompt: 'Tienes ' + c + ' cajas con ' + p + ' galletas cada una. Si regalas ' + c + ' galletas, ¿cuántas te quedan?', answer: String(p * c - c), hints: ['Primero: ¿cuántas galletas hay en total?', c + ' × ' + p + ' = ' + p * c + '. Ahora resta las que regalas.', p * c + ' − ' + c + ' = ?'] }; }
  }
}

const norm = (s: string) => s.replace(/\s+/g, '').replace(',', '.').toLowerCase();

export interface Attempt { correct: boolean; hint?: string; next: 'siguiente' | 'pista' | 'mostrar-pasos' }

/** Corrige con pistas graduales: 1.er fallo → pista 1, 2.º → pista 2, 3.º → pasos completos. */
export function checkAnswer(ex: Exercise, given: string, failsSoFar: number): Attempt {
  if (norm(given) === norm(ex.answer)) return { correct: true, next: 'siguiente' };
  const h = ex.hints[Math.min(failsSoFar, ex.hints.length - 1)];
  return { correct: false, hint: h, next: failsSoFar + 1 >= ex.hints.length ? 'mostrar-pasos' : 'pista' };
}

/** Ajusta el nivel: 3 aciertos seguidos suben, 2 fallos completos bajan. */
export function adaptLevel(level: 1 | 2 | 3, streak: number, misses: number): 1 | 2 | 3 {
  if (streak >= 3 && level < 3) return (level + 1) as 2 | 3;
  if (misses >= 2 && level > 1) return (level - 1) as 1 | 2;
  return level;
}
