import type { AgeBand, EvidenceNote, KidTechnique } from './types.js';

export const EVIDENCE: readonly EvidenceNote[] = Object.freeze([
  {
    id: 'aap-parent-training', level: 'guideline-summary',
    claim: 'La guía de la AAP (2019), según el resumen de American Family Physician (2020), recomienda con fuerza el entrenamiento de padres en manejo de conducta para niños de preescolar a secundaria con problemas de conducta, incluido el TDAH; en 4–6 años es el tratamiento principal.',
    source: 'AAFP, «ADHD: AAP Updates Guideline for Diagnosis and Management», 2020', url: 'https://www.aafp.org/pubs/afp/issues/2020/0701/p58.html',
  },
  {
    id: 'aap-school', level: 'guideline-summary',
    claim: 'En la escuela se pueden usar tarjetas de informe diario, sistemas de puntos y adaptaciones (más tiempo, menos tareas, apuntes de apoyo) tras una evaluación escolar.',
    source: 'AAFP, resumen de la guía AAP 2019', url: 'https://www.aafp.org/pubs/afp/issues/2020/0701/p58.html',
  },
  {
    id: 'aap-diagnosis', level: 'guideline-summary',
    claim: 'El diagnóstico lo hace un profesional clínico: síntomas de 6 o más criterios durante al menos 6 meses, en más de un entorno, presentes antes de los 12 años y no explicados por otra condición. Entre los 4 y 6 años es difícil distinguirlo de la conducta normal. Janus no diagnostica.',
    source: 'AAFP, resumen de la guía AAP 2019 (criterios DSM-5)', url: 'https://www.aafp.org/pubs/afp/issues/2020/0701/p58.html',
  },
  {
    id: 'abacus-rct', level: 'research-mixed',
    claim: 'Un ensayo aleatorizado en aulas de EE. UU. de un año con ábaco mental (1.º y 2.º) no halló ventajas significativas en cálculo ni en capacidades cognitivas frente al currículo habitual; en 2.º hubo indicios, no concluyentes, en valor posicional. Los autores piden cautela con el ábaco como intervención corta.',
    source: 'Barner et al., Journal of Numerical Cognition 3(3), 2018', url: 'https://www.psycharchives.org/handle/20.500.12034/1271',
  },
  {
    id: 'mastery-cpa', level: 'research-mixed',
    claim: 'Un ensayo en 12 escuelas inglesas con un enfoque de maestría tipo Singapur (concreto–pictórico–abstracto y variación de ejemplos y representaciones) halló un efecto pequeño pero significativo en matemáticas de 1.º (ES 0,42) tras dos trimestres; no es una prueba general de «las técnicas de Asia» y no midió TDAH.',
    source: 'Lindorff, Hall y Sammons, Frontiers in Education, 2019', url: 'https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2019.00037/pdf',
  },
  {
    id: 'practice-attention', level: 'practice-consensus',
    claim: 'Bloques cortos, instrucciones breves, movimiento entre bloques, retroalimentación inmediata y elección dentro de límites son prácticas habituales de aula y de casa. Esto es consenso práctico, no una intervención con eficacia demostrada en este material.',
    source: 'Consenso práctico (no verificado con un estudio concreto en esta sesión)',
  },
]);

export const KID_TECHNIQUES: readonly KidTechnique[] = Object.freeze([
  {
    id: 'amigos-del-10', title: 'Los amigos del 10', skill: 'Suma y resta hasta 10 y 20', ageBands: ['5-7', '8-10'], minutes: 8,
    whyItHelps: 'Conocer las parejas que suman 10 (1+9, 2+8…) es la base del cálculo mental rápido.',
    steps: [
      'Pon 10 fichas (o dedos) y sepáralas en dos grupos: «¿cuántas hay en cada mano?».',
      'Di la pareja en voz alta: «7 y 3 son amigos del 10».',
      'Juega a «¡adivina mi amigo!»: dices 6 y ella responde 4.',
      'Aplica: 8 + 5 = 8 + 2 + 3 = 10 + 3 = 13.',
    ],
    materials: ['Fichas, botones o dedos'], evidenceIds: ['mastery-cpa'],
  },
  {
    id: 'cpa-concreto-dibujo-simbolo', title: 'Tocar, dibujar, escribir (concreto–pictórico–abstracto)', skill: 'Entender cualquier operación nueva', ageBands: ['5-7', '8-10', '11-13'], minutes: 10,
    whyItHelps: 'Primero se manipula con objetos, luego se dibuja (barras o dibujos) y al final se usa el símbolo; así el número tiene significado.',
    steps: [
      'Concreto: resuelve el problema con objetos (por ejemplo, 3 grupos de 4 galletas).',
      'Pictórico: dibuja cajas o barras que representen lo mismo.',
      'Abstracto: escribe 3 × 4 = 12 y explica con sus palabras qué significa cada número.',
      'Cambia solo un dato cada vez (de 3 × 4 a 3 × 5) para ver qué se mantiene y qué cambia.',
    ],
    materials: ['Objetos pequeños', 'Papel y lápices de colores'], evidenceIds: ['mastery-cpa'],
  },
  {
    id: 'contar-con-una-mano-china', title: 'Contar hasta 10 con una sola mano (gestos numéricos chinos)', skill: 'Numeración y cálculo con gestos', ageBands: ['5-7', '8-10'], minutes: 6,
    whyItHelps: 'En China se representan los números del 1 al 10 con una sola mano; liberar la otra mano permite sumar con gestos y moverse mientras se piensa.',
    steps: [
      'Aprende la forma de la mano para el 1 al 5 con dedos extendidos.',
      'Prueba los gestos del 6 al 10 (hay una forma estándar para cada uno) practicando frente a un espejo o con un vídeo fiable.',
      'Juego: tú muestras un número con una mano y ella responde con el amigo del 10 en la otra.',
    ],
    materials: ['Un espejo o un vídeo de referencia'], evidenceIds: ['practice-attention'],
    caution: 'Los gestos exactos pueden variar por región: no se han verificado aquí; confírmalos con una fuente fiable antes de enseñarlos.',
  },
  {
    id: 'abaco-suanpan-soroban', title: 'El ábaco (suanpan chino / soroban japonés) como juego', skill: 'Valor posicional y visualización', ageBands: ['8-10', '11-13'], minutes: 10,
    whyItHelps: 'Ver las unidades, decenas y centenas en varillas hace visible el valor posicional. La evidencia de que mejore el cálculo en un año de clase es débil: úsalo como juego, sin prometer resultados.',
    steps: [
      'Presenta el ábaco como un «mapa de casas»: cada varilla es una casa (unidades, decenas, centenas).',
      'Representa números pequeños y deja que ella los lea; cambia una cuenta y pregunta qué cambió.',
      'Suma 2 cifras sin llevadas moviendo cuentas; después, con llevadas, nombrando qué pasa «en la casa de al lado».',
      'Si le divierte, cierra los ojos e imagina el ábaco (ábaco mental) con números muy pequeños.',
    ],
    materials: ['Ábaco físico o simulador'], evidenceIds: ['abacus-rct'],
    caution: 'Un ensayo de un año en aulas no mostró mejoras significativas en cálculo: no presiones ni lo uses como sustituto de otras prácticas.',
  },
  {
    id: 'tablas-con-patrones', title: 'Tablas de multiplicar con patrones', skill: 'Multiplicación', ageBands: ['8-10'], minutes: 8,
    whyItHelps: 'Descubrir patrones (el 9, el 5, los dobles) reduce lo que hay que memorizar y da pequeñas victorias.',
    steps: [
      'Empieza por las fáciles: ×1, ×2 (dobles), ×5 y ×10.',
      'Descubre el patrón del 9: las cifras del resultado suman 9 (18, 27, 36…).',
      'Construye las demás desde las que ya sabe: 6×7 = 6×5 + 6×2.',
      'Cierra con una carrera amistosa contra su propio récord de ayer, no contra otros.',
    ],
    materials: ['Cuadrícula de multiplicar'], evidenceIds: ['practice-attention'],
  },
  {
    id: 'problema-con-historia', title: 'Problemas con historia y dibujo', skill: 'Resolución de problemas', ageBands: ['5-7', '8-10', '11-13'], minutes: 10,
    whyItHelps: 'Convertir el enunciado en una escena que se puede dibujar o actuar ayuda a entender qué se pregunta.',
    steps: [
      'Léelo en voz alta y pide que lo cuente con sus palabras.',
      'Dibuja la escena con monigotes, flechas y números.',
      'Pregunta: «¿qué sabemos? ¿qué nos piden?».',
      'Resuelve, comprueba con el dibujo y cambia un dato para inventar un problema nuevo.',
    ],
    materials: ['Papel y lápices'], evidenceIds: ['mastery-cpa'],
  },
]);

export const ATTENTION_PRINCIPLES: readonly string[] = Object.freeze([
  'Una sola meta por bloque, dicha en una frase corta («hoy practicamos amigos del 10»).',
  'Bloques breves de foco (5–10 minutos según edad y día) con una pausa de movimiento entre uno y otro.',
  'Empieza con una victoria fácil y sube la dificultad poco a poco.',
  'Retroalimentación inmediata y concreta («has descubierto el patrón del 9»), sin sarcasmo ni comparaciones.',
  'Da elección dentro de límites (¿empezamos con fichas o con dibujo?).',
  'Muestra el tiempo con un reloj de arena o temporizador visible; avisa del cambio de actividad.',
  'Reduce distracciones: una sola tarea sobre la mesa, sin pantallas que no se usen.',
  'Reconoce el esfuerzo y la estrategia, no solo el acierto; los errores son pistas, no fracasos.',
  'Cierra siempre con algo positivo y una pregunta: «¿qué fue lo más divertido?».',
]);

export const PARENT_GUIDE: readonly string[] = Object.freeze([
  'Rutinas visibles: horario con dibujos de tareas y descansos, siempre a la misma hora cuando sea posible.',
  'Instrucciones de una en una, a su altura, con contacto visual; pídele que las repita con sus palabras.',
  'Refuerzo positivo inmediato (elogio concreto, tiempo juntos, pegatinas); evita convertir la comida o el sueño en premio o castigo.',
  'Sueño suficiente, actividad física diaria y juego libre: ayudan a la atención de cualquier niño.',
  'Coordina con su colegio: qué le cuesta, qué funciona en clase y si hay adaptaciones disponibles.',
  'Si las dificultades de atención o de actividad son intensas, duran más de 6 meses y aparecen en casa y en el colegio, consulta con su pediatra o con un profesional clínico: solo ellos pueden valorar y diagnosticar. Los programas de entrenamiento para padres en manejo de conducta cuentan con respaldo en la guía de la AAP.',
  'Janus no diagnostica ni etiqueta a tu hija: ofrece estrategias útiles para cualquier niño con energía o atención variable.',
]);

export const AGE_BAND_NOTES: Record<AgeBand, { focusMinutes: number; moveMinutes: number }> = {
  '5-7': { focusMinutes: 5, moveMinutes: 2 },
  '8-10': { focusMinutes: 8, moveMinutes: 2 },
  '11-13': { focusMinutes: 12, moveMinutes: 2 },
};


/** Prácticas guiadas de la misma escuela offline; sin datos personales, diagnósticos ni proveedores externos. */
export interface KidGuidedPractice {
  id: string;
  subject: string;
  title: string;
  skill: string;
  minutes: number;
  steps: readonly string[];
  materials: readonly string[];
  reading?: { text: string; lang: string };
  check: { question: string; options: readonly string[]; answer: number; why: string };
  source?: { name: string; url: string };
}
export const KID_GUIDED_PRACTICE: readonly KidGuidedPractice[] = Object.freeze([
  { id:'mat-amigos',subject:'Matemáticas',title:'Completa el diez',skill:'Suma',minutes:3,
    steps:['Dibuja diez círculos. Colorea siete.','Cuenta los círculos sin color.'],materials:['Papel y lápiz'],
    check:{question:'¿Cuánto falta a 7 para llegar a 10?',options:['2','3','4'],answer:1,why:'7 + 3 = 10. Puedes comprobarlo con los círculos.'} },
  { id:'nl-fiets',subject:'Neerlandés',title:'La bicicleta',skill:'Vocabulario',minutes:3,
    steps:['Mira una bicicleta o dibújala.','Lee y repite la palabra neerlandesa.'],materials:['Papel opcional'],reading:{text:'de fiets',lang:'nl-NL'},
    check:{question:'¿Qué significa «de fiets»?',options:['La bicicleta','La mesa','El libro'],answer:0,why:'De fiets significa la bicicleta.'} },
  { id:'en-water',subject:'Inglés',title:'Un vaso de agua',skill:'Vocabulario',minutes:3,
    steps:['Mira un vaso de agua.','Escucha y repite la palabra en inglés.'],materials:['Un vaso de agua'],reading:{text:'water',lang:'en-GB'},
    check:{question:'¿Cómo se dice agua en inglés?',options:['Book','Water','Chair'],answer:1,why:'Water significa agua.'} },
  { id:'fr-bonjour',subject:'Francés',title:'Saludar en francés',skill:'Vocabulario',minutes:3,
    steps:['Imagina que saludas a una amiga.','Lee y repite el saludo.'],materials:[],reading:{text:'Bonjour',lang:'fr-FR'},
    check:{question:'¿Qué palabra sirve para saludar de día en francés?',options:['Merci','Bonsoir','Bonjour'],answer:2,why:'Bonjour es un saludo habitual durante el día.'} },
  { id:'zh-nihao',subject:'Chino mandarín',title:'Saludar en mandarín',skill:'Vocabulario',minutes:3,
    steps:['Mira los dos caracteres y su pronunciación escrita: nǐ hǎo.','Escucha la frase si el aparato tiene voz en mandarín.'],materials:[],reading:{text:'你好',lang:'zh-CN'},
    check:{question:'¿Qué significa «你好» (nǐ hǎo)?',options:['Hola','Adiós','Gracias'],answer:0,why:'你好 es una forma habitual de decir hola.'} },
  { id:'es-ortografia',subject:'Ortografía',title:'La biblioteca',skill:'Escribir palabras',minutes:3,
    steps:['Lee despacio: biblioteca.','Escribe la palabra y compara las letras.'],materials:['Papel y lápiz'],reading:{text:'biblioteca',lang:'es-ES'},
    check:{question:'¿Cuál está escrita correctamente?',options:['Bivlioteca','Biblioteca','Biblioteka'],answer:1,why:'Biblioteca se escribe con b y c.'} },
  { id:'es-lectura',subject:'Lectura y expresión',title:'Una historia corta',skill:'Comprender y contar',minutes:4,
    steps:['Lee: Ana llevó una botella de agua al parque. Allí jugó con su amiga.','Cuenta con tus palabras qué llevó Ana.'],materials:[],reading:{text:'Ana llevó una botella de agua al parque. Allí jugó con su amiga.',lang:'es-ES'},
    check:{question:'¿Qué llevó Ana al parque?',options:['Una pelota','Un libro','Una botella de agua'],answer:2,why:'La primera frase dice que llevó una botella de agua.'} },
  { id:'hist-nl-1581',subject:'Historia de Países Bajos',title:'Un documento de 1581',skill:'Reconocer una fecha histórica',minutes:4,
    steps:['El 26 de julio de 1581 se firmó el Plakkaat van Verlating.','Los territorios rebeldes dejaron de reconocer a Felipe II como su gobernante.'],materials:['Papel para una línea del tiempo'],
    source:{name:'Canon van Nederland',url:'https://www.canonvannederland.nl/nl/kalender/07/1581-07-26'},
    check:{question:'¿En qué año se firmó el documento?',options:['1581','1810','1945'],answer:0,why:'Se firmó el 26 de julio de 1581.'} },
  { id:'hist-co-1810',subject:'Historia de Colombia',title:'El 20 de julio',skill:'Reconocer una fecha histórica',minutes:4,
    steps:['El 20 de julio de 1810 hubo una revolución en Bogotá.','Se formó una junta de gobierno. Fue un paso del proceso de independencia.'],materials:['Papel para una línea del tiempo'],
    source:{name:'Banco de la República de Colombia',url:'https://www.banrepcultural.org/multimedia/ha-leido-el-acta-de-la-revolucion-del-20-de-julio-de-1810'},
    check:{question:'¿En qué ciudad ocurrió la revolución del 20 de julio de 1810?',options:['Medellín','Bogotá','Cartagena'],answer:1,why:'La revolución de esta lección ocurrió en Bogotá.'} },
  { id:'hist-mundo-onu',subject:'Historia del mundo',title:'La cooperación entre países',skill:'Reconocer una organización',minutes:4,
    steps:['Las Naciones Unidas nacieron en 1945.','Una de sus metas es ayudar a mantener la paz entre países.'],materials:[],
    source:{name:'Naciones Unidas',url:'https://www.un.org/en/about-us'},
    check:{question:'¿En qué año nacieron las Naciones Unidas?',options:['1581','1810','1945'],answer:2,why:'La ONU nació en 1945.'} }
]);


// Translation only; identity, answer index, reading language and evidence remain canonical.
export interface KidPracticeTranslation { subject:string; title:string; skill:string; steps:readonly string[]; materials:readonly string[]; question?:string; options?:readonly string[]; why?:string }
export const KID_PRACTICE_NL: Readonly<Record<string,KidPracticeTranslation>>=Object.freeze({
  "amigos-del-10": {
    "subject": "Rekenen",
    "title": "Vriendjes van 10",
    "skill": "Optellen en aftrekken tot 10 en 20",
    "steps": [
      "Leg 10 fiches neer (of gebruik je vingers) en verdeel ze in twee groepen. Hoeveel zitten er in elke hand?",
      "Zeg het paar hardop: 7 en 3 zijn vriendjes van 10.",
      "Speel Raad mijn vriendje: iemand zegt 6 en jij antwoordt 4.",
      "Pas toe: 8 + 5 = 8 + 2 + 3 = 10 + 3 = 13."
    ],
    "materials": [
      "Fiches, knopen of vingers"
    ]
  },
  "cpa-concreto-dibujo-simbolo": {
    "subject": "Rekenen",
    "title": "Aanraken, tekenen, schrijven",
    "skill": "Nieuwe rekenbewerkingen begrijpen",
    "steps": [
      "Los het probleem op met voorwerpen, bijvoorbeeld 3 groepen van 4 koekjes.",
      "Teken vakjes of balken die hetzelfde voorstellen.",
      "Schrijf 3 × 4 = 12 en leg in je eigen woorden uit wat elk getal betekent.",
      "Verander steeds één getal (van 3 × 4 naar 3 × 5). Wat blijft hetzelfde en wat verandert?"
    ],
    "materials": [
      "Kleine voorwerpen",
      "Papier en kleurpotloden"
    ]
  },
  "mat-amigos": {
    "subject": "Rekenen",
    "title": "Maak de tien vol",
    "skill": "Optellen",
    "steps": [
      "Teken tien cirkels. Kleur er zeven in.",
      "Tel de cirkels zonder kleur."
    ],
    "materials": [
      "Papier en potlood"
    ],
    "question": "Hoeveel moet er bij 7 om 10 te krijgen?",
    "options": [
      "2",
      "3",
      "4"
    ],
    "why": "7 + 3 = 10. Controleer het met je cirkels."
  },
  "nl-fiets": {
    "subject": "Nederlands",
    "title": "De fiets",
    "skill": "Woordenschat",
    "steps": [
      "Bekijk een fiets of teken er een.",
      "Lees en herhaal het Nederlandse woord."
    ],
    "materials": [
      "Eventueel papier"
    ],
    "question": "Wat betekent «de fiets» in het Spaans?",
    "options": [
      "La bicicleta",
      "La mesa",
      "El libro"
    ],
    "why": "De fiets betekent la bicicleta."
  },
  "en-water": {
    "subject": "Engels",
    "title": "Een glas water",
    "skill": "Woordenschat",
    "steps": [
      "Bekijk een glas water.",
      "Luister naar het Engelse woord en zeg het na."
    ],
    "materials": [
      "Een glas water"
    ],
    "question": "Hoe zeg je water in het Engels?",
    "options": [
      "Book",
      "Water",
      "Chair"
    ],
    "why": "Water betekent water."
  },
  "fr-bonjour": {
    "subject": "Frans",
    "title": "Groeten in het Frans",
    "skill": "Woordenschat",
    "steps": [
      "Stel je voor dat je een vriendin begroet.",
      "Lees de groet en zeg hem na."
    ],
    "materials": [],
    "question": "Met welk woord begroet je iemand overdag in het Frans?",
    "options": [
      "Merci",
      "Bonsoir",
      "Bonjour"
    ],
    "why": "Bonjour is een gebruikelijke groet overdag."
  },
  "zh-nihao": {
    "subject": "Mandarijn",
    "title": "Groeten in het Mandarijn",
    "skill": "Woordenschat",
    "steps": [
      "Bekijk de twee karakters en hun geschreven uitspraak: nǐ hǎo.",
      "Luister naar de zin als je apparaat een Mandarijnse stem heeft."
    ],
    "materials": [],
    "question": "Wat betekent «你好» (nǐ hǎo)?",
    "options": [
      "Hallo",
      "Tot ziens",
      "Dank je"
    ],
    "why": "你好 is een gebruikelijke manier om hallo te zeggen."
  },
  "es-ortografia": {
    "subject": "Spaanse spelling",
    "title": "De bibliotheek",
    "skill": "Woorden schrijven",
    "steps": [
      "Lees langzaam: biblioteca.",
      "Schrijf het woord op en vergelijk de letters."
    ],
    "materials": [
      "Papier en potlood"
    ],
    "question": "Welk Spaans woord is juist gespeld?",
    "options": [
      "Bivlioteca",
      "Biblioteca",
      "Biblioteka"
    ],
    "why": "Biblioteca schrijf je met een b en een c."
  },
  "es-lectura": {
    "subject": "Spaans lezen en spreken",
    "title": "Een kort verhaal",
    "skill": "Begrijpen en vertellen",
    "steps": [
      "Lees: Ana llevó una botella de agua al parque. Allí jugó con su amiga.",
      "Vertel in je eigen woorden wat Ana meenam."
    ],
    "materials": [],
    "question": "Wat nam Ana mee naar het park?",
    "options": [
      "Een bal",
      "Een boek",
      "Een fles water"
    ],
    "why": "In de eerste zin staat dat ze een fles water meenam."
  },
  "hist-nl-1581": {
    "subject": "Geschiedenis van Nederland",
    "title": "Een document uit 1581",
    "skill": "Een historische datum herkennen",
    "steps": [
      "Op 26 juli 1581 werd het Plakkaat van Verlating ondertekend.",
      "De opstandige gewesten erkenden Filips II niet langer als hun vorst."
    ],
    "materials": [
      "Papier voor een tijdlijn"
    ],
    "question": "In welk jaar werd het document ondertekend?",
    "options": [
      "1581",
      "1810",
      "1945"
    ],
    "why": "Het werd op 26 juli 1581 ondertekend."
  },
  "hist-co-1810": {
    "subject": "Geschiedenis van Colombia",
    "title": "20 juli",
    "skill": "Een historische datum herkennen",
    "steps": [
      "Op 20 juli 1810 vond in Bogotá een revolutie plaats.",
      "Er werd een bestuursjunta gevormd. Dat was een stap in het onafhankelijkheidsproces."
    ],
    "materials": [
      "Papier voor een tijdlijn"
    ],
    "question": "In welke stad vond de revolutie van 20 juli 1810 plaats?",
    "options": [
      "Medellín",
      "Bogotá",
      "Cartagena"
    ],
    "why": "De revolutie uit deze les vond plaats in Bogotá."
  },
  "hist-mundo-onu": {
    "subject": "Wereldgeschiedenis",
    "title": "Samenwerking tussen landen",
    "skill": "Een organisatie herkennen",
    "steps": [
      "De Verenigde Naties werden in 1945 opgericht.",
      "Een van hun doelen is helpen de vrede tussen landen te bewaren."
    ],
    "materials": [],
    "question": "In welk jaar werden de Verenigde Naties opgericht?",
    "options": [
      "1581",
      "1810",
      "1945"
    ],
    "why": "De VN werden in 1945 opgericht."
  }
});
