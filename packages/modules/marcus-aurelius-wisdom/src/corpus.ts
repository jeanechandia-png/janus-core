import type { BiographyFact, DoctrinePoint, MarcusExercise, MarcusQuote, WorkEntry } from './types.js';

const WORK = 'Meditaciones';

/**
 * English wording verified on 2026-10-18 against George Long's translation (public domain), as hosted at
 * classics.mit.edu/Antoninus/meditations.html. Where only a fragment was read, only that fragment is quoted.
 * Spanish renderings are free translations made for this module.
 */
export const QUOTES: readonly MarcusQuote[] = Object.freeze([
  {
    id: 'med8-47-judgement',
    en: 'If thou art pained by any external thing, it is not this thing that disturbs thee, but thy own judgement about it. And it is in thy power to wipe out this judgement now.',
    es: 'Si algo externo te causa dolor, no es eso lo que te perturba, sino el juicio que tú haces de ello. Y está en tu poder borrar ese juicio ahora mismo.',
    work: WORK, locus: '8.47', status: 'text-verified-long',
    themes: ['overwhelm', 'future_worry', 'control_acceptance', 'adversity', 'anger'],
  },
  {
    id: 'med4-7-complaint',
    en: 'Take away thy opinion, and then there is taken away the complaint',
    es: 'Quita tu opinión, y queda quitada la queja…',
    work: WORK, locus: '4.7', status: 'text-verified-long',
    themes: ['anger', 'adversity', 'control_acceptance', 'overwhelm'],
    note: 'Fragmento: solo se verificó la primera cláusula del pasaje.',
  },
  {
    id: 'med4-3-retreat',
    en: 'Men seek retreats for themselves, houses in the country, sea-shores, and mountains; and thou too art wont […]',
    es: 'Los hombres buscan retiros para sí: casas en el campo, costas, montañas; y tú también sueles desear lo mismo…',
    work: WORK, locus: '4.3', status: 'text-verified-long',
    themes: ['overwhelm', 'happiness', 'present_moment'],
    note: 'Fragmento. El pasaje sigue diciendo que puedes retirarte en ti mismo («retire into thyself»): la calma no depende de un lugar.',
  },
  {
    id: 'med4-49-promontory',
    en: 'Be like the promontory against which the waves continually break, but it stands firm and tames the fury of the water around it.',
    es: 'Sé como el promontorio contra el que rompen las olas sin cesar: él se mantiene firme y amansa la furia del agua que lo rodea.',
    work: WORK, locus: '4.49', status: 'text-verified-long',
    themes: ['adversity', 'anger', 'overwhelm', 'control_acceptance'],
  },
  {
    id: 'med5-1-human-work',
    en: 'In the morning when thou risest unwillingly, let this thought be present—I am rising to the work of a human being.',
    es: 'Por la mañana, cuando te levantes con desgana, ten presente este pensamiento: me levanto para el trabajo de un ser humano.',
    work: WORK, locus: '5.1', status: 'text-verified-long',
    themes: ['overwhelm', 'time_pressure', 'present_moment'],
  },
  {
    id: 'med5-16-dyed',
    en: 'Such as are thy habitual thoughts, such also will be the character of thy mind; for the soul is dyed by the thoughts.',
    es: 'Cuales sean tus pensamientos habituales, tal será el carácter de tu mente; pues el alma se tiñe con los pensamientos.',
    work: WORK, locus: '5.16', status: 'text-verified-long',
    themes: ['future_worry', 'past_rumination', 'self_review', 'happiness'],
  },
  {
    id: 'med5-20-hindrance',
    en: '[…] the mind converts and changes every hindrance to its activity into an aid.',
    es: '…la mente convierte y transforma todo obstáculo para su actividad en una ayuda.',
    work: WORK, locus: '5.20', status: 'text-verified-long',
    themes: ['adversity', 'overwhelm', 'control_acceptance'],
    note: 'Fragmento. La fórmula popular «el obstáculo es el camino» pertenece a otras traducciones/ediciones y no se verificó aquí.',
  },
  {
    id: 'med2-5-last-act',
    en: 'And thou wilt give thyself relief, if thou doest every act of thy life as if it were the last […]',
    es: 'Te darás alivio si haces cada acto de tu vida como si fuera el último…',
    work: WORK, locus: '2.5', status: 'text-verified-long',
    themes: ['time_pressure', 'present_moment', 'overwhelm'],
    note: 'Fragmento.',
  },
  {
    id: 'med2-11-depart',
    en: 'Since it is possible that thou mayest depart from life this very moment, regulate every act and thought accordingly.',
    es: 'Puesto que es posible que dejes la vida en este mismo instante, regula según ello cada acto y cada pensamiento.',
    work: WORK, locus: '2.11', status: 'text-verified-long',
    themes: ['time_pressure', 'present_moment', 'past_rumination'],
    note: 'Es una invitación a priorizar, no a angustiarse con la muerte.',
  },
  {
    id: 'med2-1-morning',
    en: 'Begin the morning by saying to thyself, I shall meet with the busy-body, the ungrateful, arrogant, deceitful, envious, […] All these things happen to them by reason of their ignorance of what is good and evil.',
    es: 'Empieza la mañana diciéndote: hoy me encontraré con el entrometido, el desagradecido, el arrogante, el engañoso, el envidioso… Todo eso les sucede por ignorar lo que es bueno y lo que es malo.',
    work: WORK, locus: '2.1', status: 'text-verified-long',
    themes: ['anger', 'adversity', 'future_worry'],
    note: 'Dos fragmentos unidos con puntos suspensivos; el tramo intermedio no se verificó.',
  },
  {
    id: 'med6-6-revenge',
    en: 'The best way of avenging thyself is not to become like the wrongdoer.',
    es: 'La mejor manera de vengarte es no parecerte a quien te ofendió.',
    work: WORK, locus: '6.6', status: 'text-verified-long',
    themes: ['anger', 'past_rumination'],
  },
  {
    id: 'med8-16-change-mind',
    en: 'Remember that to change thy opinion and to follow him who corrects thy error is as consistent with freedom as it is to persist in thy error.',
    es: 'Recuerda que cambiar de opinión y seguir a quien corrige tu error es tan propio de la libertad como persistir en el error.',
    work: WORK, locus: '8.16', status: 'text-verified-long',
    themes: ['self_review', 'past_rumination', 'anger'],
    note: 'La parte inicial se leyó literal; la continuación se obtuvo en la misma lectura de la fuente.',
  },
  {
    id: 'med6-30-caesar',
    en: 'Take care that thou art not made into a Caesar, that thou art not dyed with this dye […]',
    es: 'Cuida de no convertirte en un César, de no teñirte con ese tinte…',
    work: WORK, locus: '6.30', status: 'text-verified-long',
    themes: ['self_review', 'anger'],
    note: 'Fragmento. Útil como recordatorio de humildad para quien tiene poder o responsabilidad.',
  },
  {
    id: 'med10-16-be-good',
    en: 'No longer talk at all about the kind of man that a good man ought to be, but be such.',
    es: 'Deja de hablar de cómo debe ser un hombre bueno; sé uno.',
    work: WORK, locus: '10.16', status: 'text-verified-long',
    themes: ['self_review', 'overwhelm', 'time_pressure'],
  },
  {
    id: 'attributed-power-over-mind',
    es: 'Tienes poder sobre tu mente, no sobre los acontecimientos externos. Compréndelo y encontrarás fuerza.',
    work: WORK, status: 'attributed-unlocated',
    themes: ['control_acceptance', 'adversity', 'overwhelm'],
    note: 'Circula muy extendida como de Marco Aurelio, pero no la localicé en los libros 2, 4, 5, 6, 7, 8 y 10 de la traducción de Long (los demás libros no se revisaron). No la presentes como cita literal. La idea sí es coherente con 8.47.',
  },
]);

export const EXERCISES: readonly MarcusExercise[] = Object.freeze([
  {
    id: 'morning-premeditation', title: 'Anticipar el día', themes: ['future_worry', 'anger', 'adversity'], minutes: 3,
    steps: [
      'Antes de empezar, anota 2–3 fricciones previsibles del día (una persona difícil, un retraso, un correo tenso).',
      'Recuerda que quien actúa mal suele hacerlo por ignorancia de lo que le conviene, no por ti.',
      'Decide de antemano una respuesta serena y concreta para cada una.',
    ],
    source: 'Meditaciones 2.1', modernAnalogue: 'Ensayo mental anticipatorio y reestructuración cognitiva (inferencia).',
  },
  {
    id: 'judgement-reframe', title: 'Separar el hecho del juicio', themes: ['overwhelm', 'control_acceptance', 'anger', 'future_worry'], minutes: 5,
    steps: [
      'Escribe el hecho en una frase neutra, como lo vería una cámara.',
      'Escribe aparte el juicio que le añadiste («es un desastre», «me lo hacen a propósito»).',
      'Pregúntate si ese juicio es necesario y si puedes sustituirlo por uno más ajustado.',
      'Define la siguiente acción que sí depende de ti.',
    ],
    source: 'Meditaciones 8.47 y 4.7', modernAnalogue: 'Registro de pensamientos de la terapia cognitivo-conductual (inferencia).',
    caution: 'Si el malestar es intenso o persistente, no es un sustituto de ayuda profesional.',
  },
  {
    id: 'inner-retreat', title: 'Retiro interior de 10 minutos', themes: ['overwhelm', 'happiness', 'present_moment', 'time_pressure'], minutes: 10,
    steps: [
      'Aparta el teléfono y siéntate sin tarea alguna.',
      'Respira con calma y nombra lo que sientes sin discutirlo.',
      'Elige una sola intención para la próxima hora.',
    ],
    source: 'Meditaciones 4.3', modernAnalogue: 'Pausa de atención plena (inferencia).',
  },
  {
    id: 'obstacle-to-aid', title: 'Convertir el obstáculo en material', themes: ['adversity', 'overwhelm', 'control_acceptance'], minutes: 5,
    steps: [
      'Nombra el obstáculo con precisión.',
      'Escribe tres cosas que podrías aprender, practicar o mejorar gracias a él.',
      'Elige la menor acción útil y hazla hoy.',
    ],
    source: 'Meditaciones 5.20', modernAnalogue: 'Reencuadre y activación conductual (inferencia).',
  },
  {
    id: 'last-act', title: 'Hacer bien lo que tienes delante', themes: ['time_pressure', 'present_moment', 'overwhelm'], minutes: 2,
    steps: [
      'Elige la tarea que tienes entre manos ahora.',
      'Hazla como si fuera la única importante de la hora: sin multitarea.',
      'Al terminar, cierra y pasa a la siguiente.',
    ],
    source: 'Meditaciones 2.5 y 2.11', modernAnalogue: 'Monotarea y priorización (inferencia).',
  },
  {
    id: 'view-from-above', title: 'La vista desde arriba', themes: ['overwhelm', 'anger', 'adversity', 'past_rumination'], minutes: 5,
    steps: [
      'Imagina tu situación desde muy arriba: la ciudad, el país, los siglos.',
      'Pregúntate qué parte del problema seguirá importando dentro de un año.',
      'Vuelve a la tierra y decide qué merece hoy tu energía.',
    ],
    source: 'Meditaciones (pasajes sobre la mirada desde lo alto; locus y texto NO verificados en esta sesión)',
    modernAnalogue: 'Distanciamiento cognitivo (inferencia).',
  },
]);

export const BIOGRAPHY: readonly BiographyFact[] = Object.freeze([
  { id: 'birth', period: '121 d. C.', text: 'Nace en Roma, en una familia de la élite senatorial.', basis: 'consensus-unverified' },
  { id: 'education', period: 'Juventud', text: 'Recibe una educación esmerada; su maestro Quinto Junio Rústico lo acerca al estoicismo y a la obra de Epicteto. En el Libro 1 de las Meditaciones agradece a sus maestros y familiares lo que aprendió de cada uno.', basis: 'consensus-unverified' },
  { id: 'heir', period: '138–161', text: 'Es adoptado por Antonino Pío y preparado como sucesor.', basis: 'consensus-unverified' },
  { id: 'emperor', period: '161–180', text: 'Reina como emperador, al principio junto a Lucio Vero. Su mandato estuvo marcado por guerras en la frontera del Danubio (marcomanos) y por la peste antonina.', basis: 'consensus-unverified' },
  { id: 'writing', period: 'Campañas militares', text: 'Escribe en griego notas personales de ejercicio filosófico, tradicionalmente tituladas «Para sí mismo»; no se concibieron para publicarse.', basis: 'consensus-unverified' },
  { id: 'death', period: '180 d. C.', text: 'Muere durante la campaña del Danubio; las fuentes discrepan sobre el lugar exacto. Le sucede su hijo Cómodo.', basis: 'consensus-unverified' },
]);

export const WORKS: readonly WorkEntry[] = Object.freeze([
  {
    id: 'meditations', title: 'Meditaciones (Τὰ εἰς ἑαυτόν)', basis: 'consensus-unverified',
    summary: 'Doce libros de notas personales en griego: ejercicios para gobernar los juicios, aceptar lo que no depende de uno y actuar con justicia y serenidad.',
    stressRelevance: 'Reencuadre del juicio sobre los hechos, aceptación de lo que no controlamos, vida en el presente.',
  },
  {
    id: 'fronto', title: 'Correspondencia con Frontón', basis: 'consensus-unverified',
    summary: 'Cartas con su maestro de retórica, Marco Cornelio Frontón; muestran su vida cotidiana y afectos, y no son obra filosófica sistemática.',
  },
]);

export const DOCTRINE: readonly DoctrinePoint[] = Object.freeze([
  { id: 'judgement', title: 'Lo que nos perturba es el juicio', text: 'Los hechos externos no nos dañan por sí mismos; el daño viene del juicio que añadimos, y ese juicio sí podemos revisarlo.', quoteIds: ['med8-47-judgement', 'med4-7-complaint'] },
  { id: 'control', title: 'Distinguir lo que depende de ti', text: 'Se concentra en la propia conducta, los juicios y las decisiones, y acepta con calma el resto.', quoteIds: ['attributed-power-over-mind', 'med4-49-promontory'] },
  { id: 'obstacles', title: 'El obstáculo como material', text: 'Toda dificultad puede convertirse en ocasión para ejercitar una virtud.', quoteIds: ['med5-20-hindrance'] },
  { id: 'present', title: 'Finitud y presente', text: 'Recordar que la vida es breve ordena las prioridades y reduce la dispersión.', quoteIds: ['med2-5-last-act', 'med2-11-depart'] },
  { id: 'thoughts', title: 'El carácter se forma con pensamientos habituales', text: 'La mente adopta el color de aquello en lo que piensa a diario.', quoteIds: ['med5-16-dyed'] },
  { id: 'duty-humility', title: 'Deber y humildad en el poder', text: 'Cumplir la propia función con justicia, sin dejarse corromper por el cargo.', quoteIds: ['med5-1-human-work', 'med6-30-caesar', 'med10-16-be-good'] },
]);

export const MODERN_PSYCHOLOGY: readonly string[] = Object.freeze([
  'Sus ideas sobre el juicio y la emoción tienen paralelos con la terapia cognitivo-conductual y la terapia racional emotiva; sus fundadores han reconocido la influencia estoica (consenso; no verificado en esta sesión).',
  'La anticipación de dificultades se parece al ensayo mental; la pausa interior, a prácticas de atención plena (INFERENCIA, no afirmación histórica).',
  'No es un tratamiento clínico ni sustituye a un profesional de la salud.',
]);

export const LIMITS: readonly string[] = Object.freeze([
  'Esto es reflexión filosófica y de autocuidado, no un tratamiento ni un diagnóstico.',
  'Si hay riesgo para tu vida o tu seguridad, busca ayuda de emergencia o de una persona de confianza ahora.',
  'Las traducciones al español son libres, hechas a partir de la versión inglesa de George Long (1862); no del griego.',
]);
