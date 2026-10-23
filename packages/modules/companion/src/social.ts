/**
 * Habilidades sociales en formato juego (no es terapia). Enfoque basado en la literatura sobre
 * relaciones entre pares en niños con TDAH: practicar en situaciones concretas, con refuerzo positivo
 * inmediato y generalización a la vida real (ver README: fuentes).
 * Juego "Semáforo": ROJO = el otro quiere parar, AMARILLO = dudas, VERDE = seguimos jugando.
 */
export type Light = 'rojo' | 'amarillo' | 'verde';

export interface Scenario {
  id: string;
  story: string;
  signals: string[];
  correct: Light;
  why: string;
  praise: string;
}

export const SCENARIOS: Scenario[] = [
  { id: 'sc1', story: 'Juegas a pillar con Emma. Ella se sienta, respira rápido y dice "estoy cansada".', signals: ['se sienta', 'dice que está cansada'], correct: 'rojo', why: 'Cuando alguien dice que está cansado, es momento de parar o cambiar a algo tranquilo.', praise: '¡Leíste las señales como una detective! Proponer algo tranquilo es de buena amiga.' },
  { id: 'sc2', story: 'Le cuentas a Noor tu dibujo. Ella mira hacia otro lado y empieza a hablar con otra niña.', signals: ['mira a otro lado', 'habla con otra persona'], correct: 'amarillo', why: 'Puede que quiera otra cosa. Una buena idea es preguntar: "¿Te apetece jugar a otra cosa?"', praise: '¡Muy bien! Preguntar es un superpoder.' },
  { id: 'sc3', story: 'Estás jugando con Lucas a las cartas. Él sonríe y dice "¡otra partida!".', signals: ['sonríe', 'pide otra partida'], correct: 'verde', why: 'Sonrisas y "otra vez" son luz verde. ¡A disfrutar!', praise: '¡Exacto! También sabes ver cuándo todos lo pasan bien.' },
  { id: 'sc4', story: 'Quieres seguir con el juego, pero tus amigas dicen dos veces "ya no quiero".', signals: ['lo dicen dos veces', 'ya no quieren'], correct: 'rojo', why: 'Si lo dicen, se respeta a la primera. Puedes decir "vale, ¿qué hacemos ahora?"', praise: '¡Qué madura! Respetar el "no" hace que todos quieran jugar contigo otra vez.' },
  { id: 'sc5', story: 'Hablas mucho rato de tu tema favorito y tu amigo empieza a bostezar.', signals: ['bosteza', 'no pregunta nada'], correct: 'amarillo', why: 'Turno para el otro: "¿Y a ti qué te gusta?"', praise: '¡Genial! Dar turnos hace las conversaciones más divertidas.' }
];

export function answerScenario(s: Scenario, choice: Light): { correct: boolean; feedback: string } {
  if (choice === s.correct) return { correct: true, feedback: s.praise };
  return { correct: false, feedback: 'Casi. Mira las pistas: ' + s.signals.join(' y ') + '. ' + s.why };
}
