/**
 * Seguridad: el compañero escucha y acompaña, pero NO hace de psicólogo.
 * Ante tristeza, acoso o riesgo, responde con calidez, anima a hablar con un adulto de confianza
 * y emite una alerta para el padre/tutor (el host la entrega). Ante riesgo grave, alerta urgente.
 */
/** Límite de palabra compatible con acentos (\b de JS no reconoce á, ñ…). */
const w = (src: string) => new RegExp('(?<![\\p{L}])(?:' + src + ')(?![\\p{L}])', 'iu');
export type Severity = 'ninguna' | 'atencion' | 'importante' | 'urgente';

export interface SafetyCheck {
  severity: Severity;
  topics: string[];
  reply?: string;
  parentAlert?: { severity: Exclude<Severity, 'ninguna'>; summary: string };
}

const RULES: Array<{ re: RegExp; topic: string; sev: Exclude<Severity, 'ninguna'> }> = [
  { re: w(/quiero morir(me)?|matarme|hacerme daño|no quiero vivir|cortarme/.source), topic: 'riesgo', sev: 'urgente' },
  { re: w(/me (pegan|pegó|empujan|empujó)|me hacen daño|me tocó|secreto con un adulto/.source), topic: 'daño', sev: 'urgente' },
  { re: w(/me (dicen|llaman|insultan)|se burlan|se ríen de mí|nadie (me quiere|juega conmigo)|me excluyen|bullying|acoso/.source), topic: 'acoso', sev: 'importante' },
  { re: w(/estoy triste|lloré|llorando|me siento sol[ao]|no tengo amig[ao]s|soy fe[ao]|me odio/.source), topic: 'tristeza', sev: 'atencion' }
];

const REPLY: Record<Exclude<Severity, 'ninguna'>, string> = {
  atencion: 'Gracias por contármelo. Tus sentimientos son importantes y yo estoy contigo. ¿Quieres que se lo contemos también a {tutor}? Te quiere muchísimo.',
  importante: 'Lo que te pasó no está bien y no es tu culpa. Tú vales muchísimo. Esto es importante: vamos a contárselo a {tutor} para que te ayude, ¿sí? Yo te acompaño.',
  urgente: 'Te quiero mucho y quiero que estés a salvo. Ahora mismo vamos a buscar a {tutor} o a otro adulto de confianza. No estás sola.'
};

const rank: Record<Severity, number> = { ninguna: 0, atencion: 1, importante: 2, urgente: 3 };

export function checkMessage(text: string, guardian = 'papá'): SafetyCheck {
  let sev: Severity = 'ninguna'; const topics: string[] = [];
  for (const r of RULES) if (r.re.test(text)) { topics.push(r.topic); if (rank[r.sev] > rank[sev]) sev = r.sev; }
  if (sev === 'ninguna') return { severity: sev, topics };
  return { severity: sev, topics, reply: REPLY[sev].replaceAll('{tutor}', guardian), parentAlert: { severity: sev, summary: 'Conversación del compañero: tema ' + topics.join(', ') + '. Revisar con calma y hablarlo juntos.' } };
}
