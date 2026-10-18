import type { BiographyFact, DoctrinePoint, SenecaExercise, SenecaQuote, WorkEntry } from './types.js';

/**
 * Curated corpus. Latin passages marked 'verified-primary' were read in a primary-source edition
 * (romanletters.org / thelatinlibrary.com / sententiaeantiquae.com) on 2026-10-18. Spanish renderings
 * are free translations made for this module, not a published translation.
 */
export const QUOTES: readonly SenecaQuote[] = Object.freeze([
  {
    id: 'ep13-4-imagination',
    latin: 'Plura sunt, Lucili, quae nos terrent quam quae premunt, et saepius opinione quam re laboramus.',
    es: 'Son más las cosas que nos asustan que las que nos oprimen, Lucilio, y sufrimos más a menudo por la opinión que por la realidad.',
    work: 'Epistulae morales ad Lucilium',
    locus: 'Ep. 13.4',
    status: 'verified-primary',
    themes: ['future_worry', 'overwhelm', 'adversity'],
  },
  {
    id: 'ep13-5-torment',
    latin: 'Quaedam ergo nos magis torquent quam debent, quaedam ante torquent quam debent, quaedam torquent cum omnino non debeant.',
    es: 'Algunas cosas nos atormentan más de lo debido; otras, antes de tiempo; y otras nos atormentan sin que debieran hacerlo en absoluto.',
    work: 'Epistulae morales ad Lucilium',
    locus: 'Ep. 13.5',
    status: 'verified-primary',
    themes: ['future_worry', 'overwhelm', 'past_rumination'],
  },
  {
    id: 'ep5-hope-fear',
    latin: 'Desines timere, si sperare desieris.',
    es: 'Dejarás de temer si dejas de esperar.',
    work: 'Epistulae morales ad Lucilium',
    locus: 'Ep. 5.7–9 (Séneca cita aquí una sentencia del estoico Hecatón)',
    status: 'verified-primary',
    themes: ['future_worry', 'control_acceptance', 'happiness'],
    note: 'La idea completa del pasaje: esperanza y miedo van encadenados, como el prisionero y su guardián.',
  },
  {
    id: 'ep5-present',
    latin: 'Nemo tantum praesentibus miser est.',
    es: 'Nadie es desdichado solo por lo presente.',
    work: 'Epistulae morales ad Lucilium',
    locus: 'Ep. 5.7–9',
    status: 'verified-primary',
    themes: ['present_moment', 'past_rumination', 'future_worry', 'happiness'],
    note: 'En el pasaje, la memoria y la previsión reviven el sufrimiento: por eso lo presente, por sí solo, rara vez nos hunde.',
  },
  {
    id: 'ep1-time',
    latin: 'Omnia, Lucili, aliena sunt, tempus tantum nostrum est.',
    es: 'Todo, Lucilio, es ajeno; solo el tiempo es nuestro.',
    work: 'Epistulae morales ad Lucilium',
    locus: 'Ep. 1.3',
    status: 'verified-primary',
    themes: ['time_pressure', 'overwhelm', 'control_acceptance'],
  },
  {
    id: 'ep1-claim-yourself',
    latin: 'Ita fac, mi Lucili: vindica te tibi.',
    es: 'Haz así, mi Lucilio: reclámate para ti mismo.',
    work: 'Epistulae morales ad Lucilium',
    locus: 'Ep. 1.1',
    status: 'verified-primary',
    themes: ['time_pressure', 'overwhelm'],
  },
  {
    id: 'ira3-36-review',
    latin: 'Quod hodie malum tuum sanasti? Cui vitio obstitisti? Qua parte melior es?',
    es: '¿Qué mal tuyo has curado hoy? ¿A qué vicio te has resistido? ¿En qué eres mejor?',
    work: 'De ira',
    locus: 'De ira 3.36.1 (Séneca atribuye el hábito al filósofo Sextio)',
    status: 'verified-primary',
    themes: ['self_review', 'anger', 'past_rumination'],
  },
  {
    id: 'ep91-unforeseen',
    latin: 'Ideo nihil nobis inprovisum esse debet.',
    es: 'Por eso nada debe sernos imprevisto.',
    work: 'Epistulae morales ad Lucilium',
    locus: 'Ep. 91.4',
    status: 'verified-primary',
    themes: ['adversity', 'future_worry', 'control_acceptance'],
    note: 'Contexto: la carta responde al incendio de Lyon. Es preparación acotada, no angustia anticipada (véase Ep. 13).',
  },
  {
    id: 'ep107-fate',
    latin: 'Ducunt volentem fata, nolentem trahunt.',
    es: 'Al que quiere, el destino lo guía; al que no, lo arrastra.',
    work: 'Epistulae morales ad Lucilium',
    locus: 'Ep. 107.11 (verso de Cleantes que Séneca traduce)',
    status: 'locus-unverified',
    themes: ['control_acceptance', 'adversity'],
    note: 'Sentencia clásicamente atribuida a este pasaje; el locus no se re-verificó al compilar este módulo.',
  },
  {
    id: 'brev1-time-lost',
    latin: 'Non exiguum temporis habemus, sed multum perdidimus.',
    es: 'No es poco el tiempo que tenemos, sino mucho el que perdemos.',
    work: 'De brevitate vitae',
    locus: 'De brev. vit. 1.3',
    status: 'locus-unverified',
    themes: ['time_pressure', 'overwhelm'],
    note: 'Sentencia clásicamente atribuida a este pasaje; el locus no se re-verificó al compilar este módulo.',
  },
  {
    id: 'attributed-two-burdens',
    es: 'Para ser feliz debes liberarte de dos cosas: el miedo a un mal futuro y el recuerdo de un mal pasado.',
    work: 'Atribuida a Séneca',
    status: 'attributed-unlocated',
    themes: ['happiness', 'future_worry', 'past_rumination', 'present_moment'],
    note: 'Circula ampliamente como de Séneca (prensa y redes), pero no se localizó el pasaje en sus obras: no la presentes como cita literal. Su contenido es coherente con Ep. 5.7–9 y Ep. 13.4–5.',
  },
]);

export const EXERCISES: readonly SenecaExercise[] = Object.freeze([
  {
    id: 'evening-review',
    title: 'Examen de la noche',
    themes: ['self_review', 'anger', 'past_rumination', 'overwhelm'],
    minutes: 5,
    steps: [
      'Al acabar el día, repasa lo ocurrido sin juzgarte como un fiscal: como quien revisa una cuenta.',
      'Responde por escrito o en voz alta: ¿qué mal mío he curado hoy?, ¿a qué impulso me he resistido?, ¿en qué soy mejor que ayer?',
      'Anota una sola corrección concreta para mañana.',
      'Cierra el repaso: lo hecho, hecho está; lo útil ya quedó anotado.',
    ],
    source: 'De ira 3.36 (práctica atribuida por Séneca a Sextio)',
    modernAnalogue: 'Diario de revisión del día / autorregistro breve.',
  },
  {
    id: 'fear-reality-check',
    title: 'Miedo frente a realidad',
    themes: ['future_worry', 'overwhelm', 'adversity'],
    minutes: 10,
    steps: [
      'Escribe en una frase lo que temes que ocurra.',
      'Separa dos columnas: «lo que ya está pasando» (hechos) y «lo que imagino que pasará» (opinión).',
      '¿Qué pruebas hay a favor y en contra de la segunda columna? ¿Cuántas veces un temor así se cumplió igual de grave?',
      'Identifica la única acción que depende de ti hoy, hazla o agéndala, y deja el resto fuera de la agenda de hoy.',
    ],
    source: 'Ep. 13.4–5 (sufrimos más por la opinión que por la realidad)',
    modernAnalogue: 'Reestructuración cognitiva (examinar evidencia a favor y en contra) y tiempo acotado para preocuparse.',
  },
  {
    id: 'bounded-premeditation',
    title: 'Anticipación acotada de lo adverso',
    themes: ['adversity', 'future_worry', 'control_acceptance'],
    minutes: 10,
    steps: [
      'Elige UN riesgo realista y relevante (no una lista de catástrofes).',
      'Imagina brevemente que ocurre y pregunta: ¿qué haría?, ¿a quién llamaría?, ¿qué recurso tengo?',
      'Anota un plan de respuesta de tres líneas y una medida preventiva si existe.',
      'Cierra el ejercicio: ya estás preparado; no vuelvas a ensayar el escenario.',
    ],
    source: 'Ep. 91.4 y 91.8 (premeditatio malorum), equilibrada con Ep. 13',
    modernAnalogue: 'Planificación de contingencias / análisis prospectivo de fallos (pre-mortem).',
    caution: 'Si el ejercicio dispara más angustia en lugar de calma, no lo repitas y consulta a un profesional.',
  },
  {
    id: 'time-audit',
    title: 'Auditoría de tiempo',
    themes: ['time_pressure', 'overwhelm'],
    minutes: 10,
    steps: [
      'Lista los compromisos de hoy y de esta semana.',
      'Marca cada uno: ¿lo elegí yo y aporta a lo que me importa, o me lo impuso el ruido de otros?',
      'Elimina, delega o aplaza al menos uno de los que no eligió tu criterio.',
      'Protege un bloque de tiempo para lo que sí es tuyo.',
    ],
    source: 'Ep. 1.1–3 y De brevitate vitae 1',
    modernAnalogue: 'Matriz de priorización y gestión de compromisos.',
  },
  {
    id: 'present-anchor',
    title: 'Ancla en el presente',
    themes: ['present_moment', 'past_rumination', 'future_worry', 'overwhelm'],
    minutes: 3,
    steps: [
      'Pregúntate: ¿qué tiene de malo ESTE instante, ahora mismo, si dejo fuera el pasado y el futuro?',
      'Nombra tres cosas que percibes (vista, oído, cuerpo).',
      'Si hay algo que arreglar ahora, hazlo; si no, vuelve a la tarea que tienes delante.',
    ],
    source: 'Ep. 5.7–9 (memoria y previsión reviven el sufrimiento)',
    modernAnalogue: 'Atención al momento presente (técnicas de anclaje).',
  },
  {
    id: 'control-sort',
    title: 'Separar lo que depende de ti',
    themes: ['control_acceptance', 'adversity', 'anger', 'overwhelm'],
    minutes: 5,
    steps: [
      'Divide una hoja en dos: «depende de mí» y «no depende de mí».',
      'Vuelca la preocupación en las dos columnas.',
      'Pon energía solo en la primera; para la segunda, decide cómo vas a responder si ocurre y suéltala.',
    ],
    source: 'Ep. 107.11 y la dicotomía del control (formulación explícita: Epicteto, Enchiridion 1, no Séneca)',
    modernAnalogue: 'Resolución de problemas vs. aceptación (círculo de control).',
  },
]);

export const BIOGRAPHY: readonly BiographyFact[] = Object.freeze([
  { id: 'birth', period: 'c. 4 a. C.', text: 'Nace en Corduba (Córdoba), en la Hispania Bética. El año exacto es incierto.', basis: 'secondary-verified' },
  { id: 'family', period: 'Juventud', text: 'Hijo de Séneca el Viejo, caballero romano nacido en Hispania y maestro de retórica. Sus hermanos fueron Novato (luego Junio Galión) y Mela, padre del poeta Lucano.', basis: 'secondary-verified' },
  { id: 'exile', period: '41 d. C.', text: 'Claudio conmuta una condena a muerte por el destierro en Córcega, donde pasa unos ocho años. Algunos historiadores dudan de la acusación de adulterio que lo motivó.', basis: 'secondary-verified' },
  { id: 'tutor', period: '49 d. C.', text: 'Regresa por mediación de Agripina, es nombrado pretor y tutor del joven Nerón.', basis: 'secondary-verified' },
  { id: 'adviser', period: '54–56 d. C.', text: 'Con la llegada de Nerón al poder es su consejero junto al prefecto Burro y ayuda a gobernar los primeros años del reinado; en 56 es cónsul sufecto.', basis: 'secondary-verified' },
  { id: 'withdrawal', period: '62–64 d. C.', text: 'Tras la muerte de Burro (62) su influencia decae. Intenta retirarse en 62 y 64; Nerón se lo niega. En ese retiro relativo escribe las Cartas a Lucilio y las Cuestiones naturales.', basis: 'secondary-verified' },
  { id: 'death', period: '65 d. C.', text: 'Nerón le ordena quitarse la vida tras la conjura de Pisón, en la que probablemente no participó. Muere por orden imperial.', basis: 'secondary-verified' },
  { id: 'tension', period: 'Valoración', text: 'Desde la Antigüedad se le ha reprochado la distancia entre su riqueza y su cercanía al poder, y el ideal estoico de moderación que predicaba. Conviene leerlo como un practicante imperfecto, no como un santo.', basis: 'consensus-unverified' },
]);

export const WORKS: readonly WorkEntry[] = Object.freeze([
  { id: 'epistulae', title: 'Cartas morales a Lucilio', latinTitle: 'Epistulae morales ad Lucilium', kind: 'letters', summary: '124 cartas con consejo práctico de vida, escritas en su etapa final. Es su obra más leída y la mejor puerta de entrada.', stressRelevance: 'Miedo, tiempo, duelo, muerte, amistad: las cartas 1, 5, 13 y 91 son especialmente útiles contra la ansiedad anticipatoria.', basis: 'secondary-verified' },
  { id: 'brevitate', title: 'Sobre la brevedad de la vida', latinTitle: 'De brevitate vitae', kind: 'dialogue', summary: 'La vida no es corta: la desperdiciamos. Invita a recuperar el tiempo propio.', stressRelevance: 'Prioridades y sobrecarga de compromisos.', basis: 'secondary-verified' },
  { id: 'tranquillitate', title: 'Sobre la tranquilidad del ánimo', latinTitle: 'De tranquillitate animi', kind: 'dialogue', summary: 'Diálogo sobre la inquietud interior y cómo alcanzar serenidad en la vida activa.', stressRelevance: 'Inquietud, agobio laboral, equilibrio entre acción y descanso.', basis: 'secondary-verified' },
  { id: 'ira', title: 'Sobre la ira', latinTitle: 'De ira', kind: 'dialogue', summary: 'Estudio en tres libros sobre cómo nace la ira y cómo prevenirla y tratarla. Incluye el examen nocturno (3.36).', stressRelevance: 'Enojo y frustración.', basis: 'secondary-verified' },
  { id: 'vita-beata', title: 'Sobre la vida feliz', latinTitle: 'De vita beata', kind: 'dialogue', summary: 'Qué es vivir bien según el estoicismo y cómo defender su propia coherencia.', basis: 'secondary-verified' },
  { id: 'providentia', title: 'Sobre la providencia', latinTitle: 'De providentia', kind: 'dialogue', summary: 'Por qué las adversidades alcanzan también a los buenos: la dificultad como entrenamiento.', stressRelevance: 'Adversidad y resiliencia.', basis: 'secondary-verified' },
  { id: 'constantia', title: 'Sobre la constancia del sabio', latinTitle: 'De constantia sapientis', kind: 'dialogue', summary: 'El sabio no puede ser realmente dañado en lo esencial: las ofensas ajenas no tocan su virtud.', basis: 'secondary-verified' },
  { id: 'consolationes', title: 'Consolaciones (a Marcia, a Helvia, a Polibio)', latinTitle: 'Consolationes', kind: 'consolation', summary: 'Tres textos de consuelo ante la pérdida y el destierro.', stressRelevance: 'Duelo y pérdidas.', basis: 'secondary-verified' },
  { id: 'beneficiis', title: 'Sobre los beneficios', latinTitle: 'De beneficiis', kind: 'treatise', summary: 'Siete libros sobre dar, recibir y agradecer favores.', basis: 'secondary-verified' },
  { id: 'clementia', title: 'Sobre la clemencia', latinTitle: 'De clementia', kind: 'treatise', summary: 'Tratado dirigido a Nerón sobre el buen gobierno y la moderación del poder.', basis: 'secondary-verified' },
  { id: 'naturales', title: 'Cuestiones naturales', latinTitle: 'Naturales quaestiones', kind: 'natural-science', summary: 'Siete libros sobre fenómenos naturales, con reflexión moral.', basis: 'secondary-verified' },
  { id: 'apocolocyntosis', title: 'Apocolocíntosis', latinTitle: 'Apocolocyntosis', kind: 'satire', summary: 'Sátira sobre la muerte y deificación del emperador Claudio.', basis: 'secondary-verified' },
  { id: 'tragedias', title: 'Tragedias', latinTitle: 'Medea, Thyestes, Phaedra y otras', kind: 'tragedy', summary: 'Obras dramáticas de tema pasional y trágico; se acepta con mayor seguridad su autoría para ocho de las diez atribuidas.', basis: 'secondary-verified' },
]);

export const DOCTRINE: readonly DoctrinePoint[] = Object.freeze([
  { id: 'opinion', title: 'Sufrimos por la opinión más que por la realidad', text: 'Gran parte del malestar proviene de cómo interpretamos las cosas y de adelantarnos a ellas. Hay males que duelen más de lo debido, antes de tiempo o sin motivo.', basis: 'primary-read', quoteIds: ['ep13-4-imagination', 'ep13-5-torment'] },
  { id: 'hope-fear', title: 'Esperanza y miedo van juntos', text: 'Quien vive proyectado en el futuro oscila entre esperar y temer. Reducir la dependencia de lo que no controlamos alivia ambos.', basis: 'primary-read', quoteIds: ['ep5-hope-fear', 'ep5-present'] },
  { id: 'time', title: 'El tiempo es lo único realmente propio', text: 'Todo lo demás puede quitarse; el tiempo se pierde si no se cuida. La serenidad empieza por elegir en qué se gasta.', basis: 'primary-read', quoteIds: ['ep1-time', 'ep1-claim-yourself', 'brev1-time-lost'] },
  { id: 'bounded-anticipation', title: 'Prepararse sin angustiarse', text: 'Conviene prever la adversidad lo justo para no ser sorprendido, y luego soltarla. Es preparación, no rumiación.', basis: 'primary-read', quoteIds: ['ep91-unforeseen'] },
  { id: 'self-examination', title: 'Examinar el día', text: 'Un repaso nocturno breve y sin dureza permite corregir y descansar con la conciencia ordenada.', basis: 'primary-read', quoteIds: ['ira3-36-review'] },
  { id: 'acceptance', title: 'Aceptar lo que no depende de nosotros', text: 'Cooperar con lo inevitable en lugar de resistirlo en vano; actuar con todo lo que sí depende de uno.', basis: 'consensus-unverified', quoteIds: ['ep107-fate'] },
  { id: 'virtue', title: 'La virtud como bien principal', text: 'En la doctrina estoica el carácter (sabiduría, justicia, coraje, moderación) es el verdadero bien; la riqueza o el prestigio son «indiferentes preferibles». Séneca, además, cita con libertad a otras escuelas, incluida la epicúrea.', basis: 'consensus-unverified', quoteIds: [] },
  { id: 'philosophy-as-practice', title: 'La filosofía como medicina del alma', text: 'Para Séneca la filosofía vale si se practica y cambia la conducta; de ahí el tono de consejo y ejercicios de sus cartas.', basis: 'consensus-unverified', quoteIds: [] },
]);

export const MODERN_PSYCHOLOGY: readonly string[] = Object.freeze([
  'HECHO (consenso académico): hay paralelos conceptuales entre el estoicismo y la terapia cognitivo-conductual, sobre todo la idea de que las emociones dependen de las interpretaciones y de que se pueden examinar y modificar.',
  'POR CONFIRMAR EN FUENTE PRIMARIA (no verificado al compilar este módulo): se cita con frecuencia que Albert Ellis y Aaron Beck reconocieron a los estoicos —sobre todo a Epicteto— como antecedentes. La formulación «no nos perturban las cosas, sino la opinión sobre ellas» es de Epicteto (Enchiridion 5), no de Séneca.',
  'INFERENCIA: los ejercicios de este módulo (examen nocturno, miedo frente a realidad, anticipación acotada) se parecen a técnicas modernas conocidas, pero no son un tratamiento clínico validado por sí mismos.',
]);

export const LIMITS: readonly string[] = Object.freeze([
  'Esto es apoyo reflexivo basado en una tradición filosófica; no sustituye a un profesional de la salud mental ni diagnostica.',
  'Si hay malestar intenso, persistente o pensamientos de hacerse daño, lo primero es hablar con un profesional o con alguien de confianza, o contactar con los servicios de emergencia.',
  'Séneca murió por orden imperial; su muerte no es un modelo a imitar ni un argumento a favor de ningún acto de autolesión.',
]);
