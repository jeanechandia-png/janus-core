import type { DoctrineTopic, GlossaryTerm, Practice } from './types.js';

/**
 * Stoic doctrine. Bases: `verified-source` = stated on the Stanford Encyclopedia of Philosophy page «Stoicism» (read 2026-10-28);
 * `consensus-unverified` = standard in the literature, not re-checked here; `inference` = the author’s own reading.
 * Quotations of Epictetus’s Handbook are free renderings (the Handbook is not part of this module’s corpus).
 */
export const DOCTRINE: readonly DoctrineTopic[] = [
  {
    id: 'three-parts',
    title: 'Las tres partes de la filosofía: lógica, física y ética',
    summary: 'Para los estoicos la filosofía tiene tres partes que se sostienen entre sí: lógica, física y ética.',
    detail:
      'Según la SEP, que cita a Diógenes Laercio, usaron tres imágenes: un ser vivo (la lógica son los huesos y tendones, la ética las partes carnosas y la física el alma), ' +
      'un huevo (la lógica la cáscara, la ética la clara, la física la yema) y un campo fértil (la lógica el muro, la ética el fruto, la física la tierra y los árboles). ' +
      'La idea es que no se puede vivir bien sin entender cómo es el mundo (física) y cómo razonamos (lógica).',
    keywords: ['partes', 'logica', 'fisica', 'etica', 'tres partes', 'huevo', 'three parts', 'logic', 'physics', 'ethics', 'filosofia'],
    basis: 'verified-source',
    sourceIds: ['sep-stoicism'],
  },
  {
    id: 'virtue-only-good',
    title: 'La virtud es el único bien',
    summary: 'Solo la virtud es buena; es conocimiento y basta para la felicidad.',
    detail:
      'La SEP resume: solo la virtud beneficia a la persona, es una forma de conocimiento y es necesaria y suficiente para la felicidad. ' +
      'Las virtudes cardinales que suele nombrar la tradición son sabiduría, justicia, coraje y moderación (formulación de consenso, no recomprobada aquí). ' +
      'Lo que cae fuera de la virtud (salud, riqueza, reputación) no es ni bueno ni malo en sentido estricto.',
    keywords: ['virtud', 'bien', 'unico bien', 'felicidad', 'eudaimonia', 'virtue', 'good', 'happiness', 'cardinales', 'sabiduria', 'justicia', 'coraje', 'moderacion'],
    basis: 'verified-source',
    sourceIds: ['sep-stoicism'],
    greek: 'aretê, eudaimonía',
  },
  {
    id: 'indifferents',
    title: 'Indiferentes y «preferidos»',
    summary: 'Salud, riqueza y reputación no son ni buenos ni malos; algunos son «preferidos» y se eligen si las circunstancias lo permiten.',
    detail:
      'La SEP explica que son «indiferentes» (adiáphora) en cuanto al bien moral, pero algunos tienen valor y se deben seleccionar normalmente: son los «preferidos» (proêgména). ' +
      'Esta es la respuesta estoica a la acusación de frialdad: no es despreciar la salud o los afectos, sino no hacer depender de ellos la propia virtud.',
    keywords: ['indiferentes', 'preferidos', 'adiaphora', 'salud', 'riqueza', 'reputacion', 'indifferents', 'preferred', 'proegmena'],
    basis: 'verified-source',
    sourceIds: ['sep-stoicism'],
    greek: 'adiáphora, proêgména',
  },
  {
    id: 'dichotomy',
    title: 'Lo que depende de nosotros y lo que no',
    summary: 'Epicteto abre el Manual separando lo que está en nuestro poder (juicios, impulsos, deseos, aversiones) de lo que no (cuerpo, bienes, reputación, cargos).',
    detail:
      'Es la idea más popular del estoicismo moderno, conocida como «dicotomía del control». Su fuente directa es el comienzo del Manual (Enquiridión) de Epicteto, recogido por Arriano (verificado en cuanto a la existencia de la obra; la formulación exacta es de consenso). ' +
      'Matiz importante: no significa pasividad, sino dirigir el esfuerzo hacia lo propio —la intención y el juicio— y aceptar el resultado como no enteramente nuestro. ' +
      'Marco Aurelio la practica en formas como «decide quitar tu opinión y hallarás calma» (Meditaciones, libro 12, párrafo 25 de la edición).',
    keywords: ['control', 'depende de nosotros', 'dicotomia', 'epicteto', 'manual', 'enquiridion', 'dichotomy', 'in our power', 'prohairesis'],
    basis: 'consensus-unverified',
    greek: 'eph’ hêmin / ouk eph’ hêmin',
  },
  {
    id: 'assent',
    title: 'Impresiones y asentimiento',
    summary: 'Las impresiones nos llegan sin elegirlas; lo que depende de nosotros es darles o no nuestro asentimiento.',
    detail:
      'La SEP indica que el asentimiento es una facultad de la parte rectora del alma y que está «en nuestro poder», a diferencia de las impresiones. ' +
      'Crisipo usa la analogía del cilindro y del cono para explicar que, aunque algo nos empuje, la forma de rodar —nuestra respuesta— depende de la naturaleza de cada uno. ' +
      'Aquí se sostiene toda la práctica estoica de examinar la primera impresión antes de aceptarla.',
    keywords: ['asentimiento', 'impresion', 'impresiones', 'assent', 'impression', 'phantasia', 'cilindro', 'cono', 'juicio'],
    basis: 'verified-source',
    sourceIds: ['sep-stoicism'],
    greek: 'phantasía, synkatáthesis',
  },
  {
    id: 'passions',
    title: 'Pasiones, buenas emociones y primeros movimientos',
    summary: 'Las pasiones son juicios falsos sobre el valor de las cosas; el sabio tiene «buenas emociones», no ausencia de sentir.',
    detail:
      'Según la SEP, la pasión (páthos) es un impulso excesivo que desobedece a la razón y supone un juicio falso sobre el valor. ' +
      'Frente a ellas están las eupátheiai, las respuestas emocionales del sabio ante verdaderos bienes. La SEP también menciona los «primeros movimientos» (propatheiai), reacciones involuntarias previas al asentimiento. ' +
      'Estoico no significa insensible: la meta es la serenidad fundada en el juicio, no la supresión.',
    keywords: ['pasiones', 'emociones', 'ira', 'miedo', 'dolor', 'eupatheiai', 'propatheiai', 'primeros movimientos', 'passions', 'emotions', 'anger', 'fear', 'apatheia', 'sentir'],
    basis: 'verified-source',
    sourceIds: ['sep-stoicism'],
    greek: 'páthos, eupátheia, propátheia',
  },
  {
    id: 'oikeiosis-cosmopolis',
    title: 'Afinidad (oikeiosis) y ciudadanía universal',
    summary: 'Todo ser busca preservarse; en el humano la razón extiende esa afinidad hasta toda la humanidad, que forma una sola ciudad.',
    detail:
      'La SEP traduce oikeiôsis como «apropiación» o «afiliación»: desde el nacimiento cada criatura tiende a conservar su constitución y, después, la razón dirige el impulso. ' +
      'De ahí el cosmopolitismo: la justicia alcanza a todos los seres humanos, que junto con Zeus forman una sola ciudad (cosmópolis) regida por una ley universal. ' +
      'Hierocles ilustra la idea con círculos concéntricos (uno mismo, la familia, la comunidad, la humanidad), que el sabio procura contraer hacia el centro (consenso). ' +
      'Marco Aurelio: «hemos nacido para colaborar, como los pies, las manos y los párpados» (libro 2 de las Meditaciones).',
    keywords: ['oikeiosis', 'afinidad', 'cosmopolita', 'cosmopolis', 'comunidad', 'humanidad', 'sociedad', 'hierocles', 'cosmopolitanism', 'justicia', 'ciudad'],
    basis: 'verified-source',
    sourceIds: ['sep-stoicism'],
    greek: 'oikeíôsis, kosmópolis',
  },
  {
    id: 'providence-determinism',
    title: 'Providencia, destino y compatibilismo',
    summary: 'El cosmos está regido por una razón providente (logos); los estoicos son deterministas y a la vez defienden la responsabilidad.',
    detail:
      'La SEP indica que son deterministas respecto a la causalidad y defienden el compatibilismo, y que gobierna un dios racional y providente. ' +
      'Marco Aurelio resume el dilema en una fórmula de tres opciones —necesidad inevitable, providencia benévola o confusión sin rumbo— y concluye que en cualquiera de ellas la inteligencia propia no es arrastrada (Meditaciones, libro 12, párrafo 17 de la edición). ' +
      'Ese es uno de los pasajes que muestran que su práctica puede mantenerse aunque la metafísica quede en suspenso.',
    keywords: ['providencia', 'destino', 'determinismo', 'logos', 'dios', 'dioses', 'providence', 'fate', 'determinism', 'compatibilismo', 'necesidad', 'azar'],
    basis: 'verified-source',
    sourceIds: ['sep-stoicism', 'long-meditations'],
    greek: 'prónoia, heimarménê, lógos',
  },
  {
    id: 'physics-cosmos',
    title: 'Física: un cosmos vivo, el cambio y los ciclos',
    summary: 'El mundo es un todo racional y material en cambio constante, con períodos que acaban en «conflagraciones» y se renuevan.',
    detail:
      'La SEP menciona las conflagraciones periódicas dentro de un ciclo de eras. Detalles técnicos como el pneûma (soplo ígneo que tensa el cosmos) y el materialismo estoico son de consenso, no recomprobados aquí. ' +
      'En Marco Aurelio la física se vuelve ejercicio: todo ocurre por cambio (libro 4, párrafo 38 de la edición), la vista desde arriba (libro 9, párrafo 31) y la brevedad de cada vida frente al tiempo infinito (libro 12, párrafo 35).',
    keywords: ['fisica', 'cosmos', 'cambio', 'conflagracion', 'ekpyrosis', 'pneuma', 'naturaleza', 'universo', 'physics', 'nature', 'universe', 'change', 'ciclo'],
    basis: 'verified-source',
    sourceIds: ['sep-stoicism', 'long-meditations'],
    greek: 'phýsis, ekpýrôsis, pneûma',
  },
  {
    id: 'logic',
    title: 'Lógica y dialéctica',
    summary: 'La lógica estoica estudia el razonamiento y el lenguaje; en particular desarrolló una lógica de proposiciones.',
    detail:
      'La SEP señala que la lógica estoica reapareció en las historias de la lógica del siglo XIX (Prantl, 1855, con un capítulo extenso) y que Bobzien (2021) sostiene que esa obra pudo llegar a Frege, a quien muchos consideran fundador de la filosofía analítica, cuyo trabajo estaría en deuda con textos estoicos. ' +
      'Es una tesis de la autora citada por la SEP, no un hecho zanjado. La atribución de la lógica proposicional a Crisipo es de consenso.',
    keywords: ['logica', 'dialectica', 'proposicional', 'frege', 'prantl', 'lenguaje', 'logic', 'dialectic', 'razonamiento'],
    basis: 'verified-source',
    sourceIds: ['sep-stoicism'],
    greek: 'logikê',
  },
  {
    id: 'roles-duty',
    title: 'Deberes, papeles y acción en el mundo',
    summary: 'Cumplir con el papel que a uno le toca (ciudadano, hijo, magistrado, amigo) es una forma concreta de virtud.',
    detail:
      'Cicerón modeló De officiis sobre un tratado de Panecio sobre los deberes (SEP). La teoría de los «papeles» (personae) y de los actos «apropiados» (kathêkonta) es de consenso. ' +
      'En Marco Aurelio se oye como «me levanto para hacer el trabajo de un ser humano» (libro 5).',
    keywords: ['deber', 'deberes', 'papeles', 'roles', 'oficio', 'trabajo', 'duty', 'kathekon', 'officiis', 'panecio', 'accion'],
    basis: 'verified-source',
    sourceIds: ['sep-stoicism'],
    greek: 'kathêkon',
  },
  {
    id: 'death-time',
    title: 'La muerte y el tiempo',
    summary: 'Aceptar que la vida es breve y que la muerte es un proceso natural es una de las prácticas centrales de la escuela romana.',
    detail:
      'Marco Aurelio es explícito: «No desprecies la muerte, sino acéptala de buen grado, como una de las obras de la naturaleza» (Meditaciones, libro 9, párrafo 3 de la edición); «parte satisfecho, pues quien te libera también lo está» (libro 12, párrafo 39). ' +
      'Él mismo se pregunta si los hombres buenos pueden extinguirse del todo y razona que, si fuera justo y natural, ya existiría otra cosa (libro 12, párrafos 7 y 8 de la edición), sin dogmatizar sobre lo que hay después. ' +
      'Esto no debe usarse para minimizar el duelo de otra persona: el estoicismo trata de la actitud propia ante lo inevitable, no de dar sermones.',
    keywords: ['muerte', 'morir', 'tiempo', 'brevedad', 'finitud', 'memento', 'mori', 'death', 'die', 'time', 'mortalidad', 'duelo'],
    basis: 'verified-source',
    sourceIds: ['long-meditations'],
    greek: undefined,
  },
];

export const PRACTICES: readonly Practice[] = [
  {
    id: 'morning-premeditation',
    title: 'Preparación de la mañana',
    minutes: 5,
    steps: [
      'Piensa en lo que te espera hoy (reuniones, personas, imprevistos).',
      'Recuerda que tratarás con gente que puede ser desagradecida, brusca o torpe, y decide de antemano cómo quieres responder.',
      'Escribe en una línea la intención de hoy: qué clase de persona quieres ser al terminar el día.',
    ],
    origin: 'Marco Aurelio, Meditaciones, libro 2, párrafo 1 de la edición (empieza «Begin the morning by saying to thyself, I shall meet with the busybody, the ungrateful, arrogant…»).',
    originBasis: 'verified-source',
    modernAnalogue: 'INFERENCIA: planificación anticipatoria e intención de implementación.',
    keywords: ['manana', 'mañana', 'preparacion', 'planificar', 'morning', 'preparation', 'dia', 'intencion'],
  },
  {
    id: 'evening-review',
    title: 'Examen de la tarde',
    minutes: 5,
    steps: [
      'Repasa el día sin juzgarte con dureza: ¿qué hice bien?, ¿qué haría distinto?',
      'Fíjate en un error concreto y piensa cómo corregirlo, no en lo que dice de ti.',
      'Termina con una cosa por la que dar las gracias.',
    ],
    origin: 'La tradición lo atribuye a Séneca (De ira, libro 3) quien lo cuenta como hábito de Sextio; es de consenso, no recomprobado aquí.',
    originBasis: 'consensus-unverified',
    modernAnalogue: 'INFERENCIA: diario reflexivo y registro de pensamientos.',
    keywords: ['tarde', 'noche', 'examen', 'repaso', 'diario', 'evening', 'review', 'journal', 'reflexion', 'balance'],
  },
  {
    id: 'control-sort',
    title: 'Separar lo que controlas de lo que no',
    minutes: 5,
    steps: [
      'Escribe la situación que te inquieta en una línea.',
      'Haz dos columnas: lo que depende de ti (tu juicio, tu esfuerzo, tu siguiente acción) y lo que no (decisiones de otros, resultados, opiniones).',
      'Elige una sola acción de la primera columna y ponla en agenda; deja la otra columna sin pelear.',
    ],
    origin: 'Epicteto, Manual (inicio). Formulación de consenso; la práctica en columnas es una adaptación moderna.',
    originBasis: 'consensus-unverified',
    modernAnalogue: 'INFERENCIA: afrontamiento centrado en el problema frente a centrado en la emoción.',
    keywords: ['control', 'depende', 'columnas', 'prioridades', 'trabajo', 'problema', 'decision', 'in our power', 'preocupacion'],
  },
  {
    id: 'first-impression',
    title: 'Examinar la primera impresión',
    minutes: 3,
    steps: [
      'Describe el hecho sin adjetivos: qué ocurrió exactamente.',
      'Distingue la interpretación que añadiste («me faltó al respeto», «todo está perdido»).',
      'Pregúntate: ¿puedo mantener solo el hecho y decidir con calma qué hacer?',
    ],
    origin: 'Marco Aurelio, Meditaciones, libro 8, párrafo 51 de la edición (en Long: «Say nothing more to thyself than what the first appearances report»; es el pasaje de la fórmula 10 de la voz de Melanie).',
    originBasis: 'verified-source',
    modernAnalogue: 'INFERENCIA: separación entre hecho e interpretación, similar a la reestructuración cognitiva.',
    keywords: ['impresion', 'hecho', 'interpretacion', 'critica', 'ofensa', 'juicio', 'first impression', 'opinion'],
  },
  {
    id: 'view-from-above',
    title: 'Vista desde arriba',
    minutes: 3,
    steps: [
      'Imagina la situación desde muy alto: tu ciudad, tu país, el planeta.',
      'Piensa cuántas personas viven problemas parecidos y cuántos siglos ha durado la vida humana.',
      'Vuelve a tu situación y pregúntate qué parte merece de verdad tu atención hoy.',
    ],
    origin: 'Marco Aurelio, Meditaciones (libro 9, párrafo 31 de la edición y otros). Localizada en el texto.',
    originBasis: 'verified-source',
    modernAnalogue: 'INFERENCIA: autodistanciamiento.',
    keywords: ['vista desde arriba', 'perspectiva', 'distancia', 'agobio', 'estres', 'view from above', 'perspective', 'importancia'],
  },
  {
    id: 'negative-visualization',
    title: 'Anticipar males (premeditatio malorum)',
    minutes: 5,
    steps: [
      'Para un proyecto importante, imagina que algo sale mal (retraso, rechazo, error).',
      'Pregúntate qué harías: qué parte está en tu mano y qué recursos tienes.',
      'Anota un plan B mínimo y vuelve al presente; no se trata de rumiar sino de estar preparado.',
    ],
    origin: 'Séneca (Cartas a Lucilio) y la tradición estoica; es de consenso, no recomprobado aquí.',
    originBasis: 'consensus-unverified',
    modernAnalogue: 'INFERENCIA: planificación de contingencias; no confundir con rumiación ansiosa.',
    keywords: ['anticipar', 'males', 'riesgo', 'plan b', 'proyecto', 'premeditatio', 'negative visualization', 'fracaso', 'ansiedad'],
  },
  {
    id: 'voluntary-discomfort',
    title: 'Incomodidad voluntaria',
    minutes: 10,
    steps: [
      'Elige una incomodidad pequeña y segura (una comida sencilla, una ducha fría, un día sin una comodidad).',
      'Hazla sabiendo que es práctica, no castigo.',
      'Observa que lo que temías era tolerable; agradece lo que normalmente das por hecho.',
    ],
    origin: 'Musonio Rufo y Séneca (Cartas 18 y 20) según la tradición; es de consenso, no recomprobado aquí.',
    originBasis: 'consensus-unverified',
    modernAnalogue: 'INFERENCIA: exposición gradual; solo con seguridad física y sin forzar a nadie.',
    keywords: ['incomodidad', 'frio', 'ayuno', 'austeridad', 'discomfort', 'askesis', 'disciplina'],
  },
  {
    id: 'obstacle-as-task',
    title: 'Convertir el obstáculo en tarea',
    minutes: 3,
    steps: [
      'Nombra el obstáculo con precisión.',
      'Pregúntate qué virtud o habilidad te pide (paciencia, claridad, coraje).',
      'Define el primer paso concreto que puedes dar hoy.',
    ],
    origin: 'Marco Aurelio, Meditaciones, libro 5, párrafo 20 de la edición (fórmula 9 de la voz de Melanie). La versión popular «lo que se interpone en el camino se convierte en el camino» NO es textual de Marco.',
    originBasis: 'verified-source',
    modernAnalogue: 'INFERENCIA: replanteamiento del problema como reto.',
    keywords: ['obstaculo', 'obstacle', 'contratiempo', 'dificultad', 'adversidad', 'problema', 'impediment', 'reto'],
  },
];

export const GLOSSARY: readonly GlossaryTerm[] = [
  { term: 'Logos', greek: 'λόγος', meaning: 'Razón que ordena el cosmos y que, en parte, es la razón humana.', basis: 'consensus-unverified' },
  { term: 'Virtud', greek: 'ἀρετή (aretê)', meaning: 'Excelencia del carácter; para los estoicos, el único bien (SEP).', basis: 'verified-source' },
  { term: 'Felicidad', greek: 'εὐδαιμονία (eudaimonía)', meaning: 'Vida lograda; para los estoicos, resultado de la virtud (SEP).', basis: 'verified-source' },
  { term: 'Asentimiento', greek: 'συγκατάθεσις (synkatáthesis)', meaning: 'Aceptar una impresión como verdadera; está en nuestro poder (SEP).', basis: 'verified-source' },
  { term: 'Impresión', greek: 'φαντασία (phantasía)', meaning: 'Representación que se nos presenta; no depende de nosotros (SEP).', basis: 'verified-source' },
  { term: 'Pasión', greek: 'πάθος (páthos)', meaning: 'Impulso excesivo que desobedece a la razón; implica un juicio falso (SEP).', basis: 'verified-source' },
  { term: 'Buenas emociones', greek: 'εὐπάθειαι (eupátheiai)', meaning: 'Respuestas emocionales del sabio ante verdaderos bienes (SEP).', basis: 'verified-source' },
  { term: 'Primeros movimientos', greek: 'προπάθειαι (propátheiai)', meaning: 'Reacciones involuntarias previas al asentimiento (mencionadas en la SEP).', basis: 'verified-source' },
  { term: 'Indiferentes', greek: 'ἀδιάφορα (adiáphora)', meaning: 'Lo que no es ni bueno ni malo moralmente; algunos son «preferidos» (SEP).', basis: 'verified-source' },
  { term: 'Afinidad', greek: 'οἰκείωσις (oikeíôsis)', meaning: 'Apropiación o afiliación: tendencia a lo propio, que la razón extiende a la humanidad (SEP).', basis: 'verified-source' },
  { term: 'Parte rectora', greek: 'ἡγεμονικόν (hêgemonikón)', meaning: 'Facultad rectora del alma; en Long aparece como «ruling faculty» (por ejemplo, libros 7 a 12 de las Meditaciones).', basis: 'consensus-unverified' },
  { term: 'Facultad de elegir', greek: 'προαίρεσις (prohaíresis)', meaning: 'La capacidad de elegir y juzgar que, para Epicteto, es lo verdaderamente nuestro (consenso).', basis: 'consensus-unverified' },
  { term: 'Deber apropiado', greek: 'καθῆκον (kathêkon)', meaning: 'Acción conveniente según el papel y la naturaleza (consenso).', basis: 'consensus-unverified' },
  { term: 'Apatía estoica', greek: 'ἀπάθεια (apátheia)', meaning: 'Libertad respecto de las pasiones; no es insensibilidad (consenso).', basis: 'consensus-unverified' },
  { term: 'Simpatía cósmica', greek: 'συμπάθεια (sympátheia)', meaning: 'Interconexión de las partes del cosmos (consenso).', basis: 'consensus-unverified' },
  { term: 'Atención', greek: 'προσοχή (prosochê)', meaning: 'Vigilancia constante sobre los propios juicios; término frecuente en la lectura moderna de Hadot (consenso).', basis: 'consensus-unverified' },
];

export function findDoctrineTopic(text: string): DoctrineTopic | undefined {
  const needle = fold(text);
  let best: { topic: DoctrineTopic; score: number } | undefined;
  for (const topic of DOCTRINE) {
    const score = topic.keywords.filter((keyword) => hasWord(needle, keyword)).reduce((sum, keyword) => sum + keyword.length, 0);
    if (score > 0 && (!best || score > best.score)) best = { topic, score };
  }
  return best?.topic;
}

export function findPractice(text: string): Practice | undefined {
  const needle = fold(text);
  let best: { practice: Practice; score: number } | undefined;
  for (const practice of PRACTICES) {
    const score = practice.keywords.filter((keyword) => hasWord(needle, fold(keyword))).reduce((sum, keyword) => sum + keyword.length, 0);
    if (score > 0 && (!best || score > best.score)) best = { practice, score };
  }
  return best?.practice;
}

function hasWord(needle: string, keyword: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(needle);
}

function fold(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}
