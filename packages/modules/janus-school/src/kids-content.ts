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
