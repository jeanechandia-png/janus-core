import type { PsychologyLink } from './types.js';

/**
 * Stoicism and modern psychology. Same discipline as the voice advisor Melanie and the written chat (owner instruction 2026-10-28):
 * open with «sí, hay un vínculo de inspiración»; never call the link «directo» or «profundo»; never say Stoicism is the same as,
 * or the origin of, cognitive behavioural therapy. In the SAME answer always say: (a) it is a philosophy of life, not a therapy;
 * (b) Janus is not a therapist and gives no clinical advice; (c) for real difficulties, talk to a professional.
 *
 * Bases:
 *  - verified-source: what the named source says (see provenance.ts). Where the source is second-hand, the line says so.
 *  - consensus-unverified: widely stated in the literature but not re-checked here.
 *  - inference: a parallel drawn by the author of this module. It is NOT a claim that anyone derived one from the other.
 *  - unverified: NO VERIFICADO.
 */
export const PSYCHOLOGY: readonly PsychologyLink[] = [
  {
    id: 'ellis',
    kind: 'influence',
    title: 'Albert Ellis y la terapia racional emotiva conductual (REBT)',
    text:
      'Ellis desarrolló lo que hoy se llama REBT a partir de los años 1950; su primer artículo, entonces sobre la «terapia racional», se habría escrito en 1953 y publicado en 1955 (dato de segunda mano: su viuda, Debbie Joffe Ellis, en una entrevista de Modern Stoicism). ' +
      'Ella afirma que la REBT fue influida por los filósofos estoicos y que Ellis lo reconoció al hablar y escribir; no se localizó una cita directa de Ellis en esa página. ' +
      'La literatura suele situar el vínculo con Ellis como el más explícito: el artículo de Corrêa (2023) señala que los paralelos son más marcados en Ellis que en Beck.',
    keywords: ['ellis', 'rebt', 'terapia racional', 'racional emotiva', 'albert ellis', 'rational emotive'],
    basis: 'verified-source',
    sourceIds: ['joffe-ellis-interview', 'correa-2023'],
  },
  {
    id: 'beck',
    kind: 'influence',
    title: 'Aaron Beck y la terapia cognitiva',
    text:
      'Beck desarrolló la terapia cognitiva en los años 1960 (fecha de consenso). El resumen del artículo de Corrêa (2023) dice que tanto Ellis como Beck señalan al estoicismo, que los paralelos son más marcados en Ellis y que ambos difieren en cuánto subrayan el contenido teórico-filosófico. ' +
      'En la entrevista citada, el entrevistador observa que el linaje hacia el estoicismo está más claro en Ellis que en Beck y que un libro de Beck apenas menciona una vez a Epicteto (dato de segunda mano). ' +
      'Resumen prudente: sí, hay un vínculo de inspiración, más tenue en Beck.',
    keywords: ['beck', 'aaron beck', 'terapia cognitiva', 'cognitive therapy', 'tcc', 'cbt'],
    basis: 'verified-source',
    sourceIds: ['correa-2023', 'joffe-ellis-interview'],
  },
  {
    id: 'inspiration-not-origin',
    kind: 'caution',
    title: 'Inspiración, no origen ni equivalencia',
    text:
      'Es un vínculo de inspiración, no una equivalencia ni un origen demostrado: el estoicismo no es lo mismo que la terapia cognitivo-conductual (TCC) ni su fuente única. ' +
      'El propio artículo de Corrêa (2023) se pregunta si la relación fue de simple inspiración o de adaptación deliberada, y su resumen no lo resuelve; ' +
      'la afinidad con la «impresión cataléptica» es una propuesta del autor, no un hallazgo establecido.',
    keywords: ['origen', 'igual', 'mismo', 'equivalente', 'inspiracion', 'vinculo', 'relacion', 'relationship', 'link'],
    basis: 'verified-source',
    sourceIds: ['correa-2023'],
  },
  {
    id: 'abc-judgment',
    kind: 'parallel',
    title: 'Lo que perturba es el juicio sobre el hecho',
    text:
      'Epicteto lo dice así (versión libre del Manual 5): no nos perturban las cosas, sino los juicios que hacemos sobre ellas. En la REBT, el modelo A-B-C (acontecimiento, creencia, consecuencia) y, en la terapia cognitiva, el modelo según el cual la interpretación media entre el hecho y la emoción, comparten esa estructura. ' +
      'Marco Aurelio lo formula como «no son los actos de los hombres los que nos perturban, sino nuestras propias opiniones» (Meditaciones, libro 11, párrafo 32 de la edición). Es un paralelo de contenido, no una derivación demostrada.',
    keywords: ['juicio', 'interpretacion', 'abc', 'creencia', 'pensamiento', 'emocion', 'judgment', 'belief', 'distorsion', 'cognitiva', 'cognitivo'],
    basis: 'consensus-unverified',
    sourceIds: ['long-meditations'],
  },
  {
    id: 'control-parallel',
    kind: 'parallel',
    title: 'Dicotomía del control y afrontamiento',
    text:
      'INFERENCIA: separar lo que depende de uno de lo que no se parece a la distinción psicológica entre afrontamiento centrado en el problema y centrado en la emoción, y al concepto de «locus de control». ' +
      'No son lo mismo: el locus de control mide una creencia sobre la causalidad, mientras que la dicotomía estoica es una guía ética sobre dónde poner el esfuerzo.',
    keywords: ['control', 'locus', 'afrontamiento', 'coping', 'dicotomia', 'depende', 'aceptacion'],
    basis: 'inference',
  },
  {
    id: 'premeditatio-parallel',
    kind: 'parallel',
    title: 'Anticipar males y planificación de contingencias',
    text:
      'INFERENCIA: la «premeditación de males» estoica se parece a la planificación de contingencias y al ensayo cognitivo. Cuidado: imaginar lo peor sin fin es rumiación, no estoicismo; su objetivo es preparar la acción y la serenidad, no alimentar la ansiedad.',
    keywords: ['premeditatio', 'anticipar', 'ansiedad', 'rumiar', 'rumiacion', 'preocupacion', 'miedo'],
    basis: 'inference',
  },
  {
    id: 'first-movements-parallel',
    kind: 'parallel',
    title: 'Primeros movimientos y pensamientos automáticos',
    text:
      'INFERENCIA: la distinción estoica entre la reacción involuntaria (propatheia) y el asentimiento consciente recuerda a la idea cognitiva de pensamiento automático frente a evaluación deliberada. El paralelo es de estructura; no hay evidencia aquí de que uno se derive del otro.',
    keywords: ['primeros movimientos', 'propatheia', 'pensamientos automaticos', 'automatico', 'reaccion'],
    basis: 'inference',
  },
  {
    id: 'distancing-parallel',
    kind: 'parallel',
    title: 'Vista desde arriba y autodistanciamiento',
    text:
      'INFERENCIA: mirar la propia situación desde lejos (Meditaciones, libro 9, párrafo 31 de la edición) se parece a las técnicas de autodistanciamiento que usa la psicología. No se citan estudios en este módulo; es una analogía.',
    keywords: ['vista desde arriba', 'distancia', 'autodistanciamiento', 'perspectiva', 'self-distancing'],
    basis: 'inference',
    sourceIds: ['long-meditations'],
  },
  {
    id: 'mindfulness-act-parallel',
    kind: 'parallel',
    title: 'Atención, aceptación y las terapias de «tercera ola»',
    text:
      'INFERENCIA: la vigilancia sobre los propios juicios (prosochê, en la lectura de Hadot) y la aceptación de lo que no depende de uno guardan semejanza con el mindfulness y con la terapia de aceptación y compromiso (ACT). ' +
      'Diferencia: la atención estoica es evaluativa (juzga si una impresión es apta para asentir), mientras que el mindfulness clínico insiste en observar sin juzgar.',
    keywords: ['mindfulness', 'atencion', 'aceptacion', 'act', 'tercera ola', 'prosoche', 'meditacion'],
    basis: 'inference',
  },
  {
    id: 'aims-differ',
    kind: 'contrast',
    title: 'Objetivos distintos: forma de vida frente a terapia',
    text:
      'El estoicismo es una filosofía de vida que incluye una física, una teología y una ética centrada en la virtud como único bien (SEP); la TCC es un tratamiento clínico con técnicas definidas y objetivos de síntomas. ' +
      'La TCC no exige creer en un cosmos providente ni que salud o pérdida sean «indiferentes». Usar ideas estoicas puede ser útil en la vida diaria, pero no sustituye a un tratamiento cuando hace falta.',
    keywords: ['diferencia', 'diferencias', 'distinto', 'contraste', 'terapia', 'filosofia', 'tratamiento', 'clinico', 'psicologia', 'psicologico', 'psychology'],
    basis: 'verified-source',
    sourceIds: ['sep-stoicism'],
  },
  {
    id: 'suppression-risk',
    kind: 'contrast',
    title: 'El riesgo de leer el estoicismo como «no sentir»',
    text:
      'El estoicismo antiguo no pide eliminar el sentir (la SEP habla de «buenas emociones» y de reacciones involuntarias previas al juicio). Leerlo como supresión emocional contradice la doctrina y la investigación general sobre regulación emocional sugiere que suprimir lo que se siente suele salir caro (afirmación de consenso, no recomprobada aquí). ' +
      'Por eso Janus, Melanie y el chat no usan una cita para quitar importancia a lo que alguien siente.',
    keywords: ['suprimir', 'supresion', 'reprimir', 'frialdad', 'insensible', 'duro', 'emociones', 'no sentir', 'apatia', 'suppression'],
    basis: 'consensus-unverified',
    sourceIds: ['sep-stoicism'],
  },
  {
    id: 'evidence',
    kind: 'evidence',
    title: 'Qué evidencia hay sobre programas basados en estoicismo',
    text:
      'NO VERIFICADO como eficacia clínica. Lo localizado es preliminar: Robertson, uno de los promotores del estoicismo moderno, describe cursos en línea (SMRT, de cuatro semanas; unos 500 participantes en 2014 y más de 900 en un seguimiento de 2017; la Semana Estoica con «muchos miles» desde ~2012) ' +
      'con mejoras en bienestar según cuestionarios, pero sin grupo de control descrito, con una escala propia y con el autor vinculado a los programas que evalúa. Él mismo pide estudios con grupos de control. ' +
      'No hay aquí un metaanálisis ni un ensayo controlado que citar.',
    keywords: ['evidencia', 'estudios', 'funciona', 'eficacia', 'investigacion', 'smrt', 'stoic week', 'semana estoica', 'ciencia', 'resultados', 'evidence', 'study', 'research'],
    basis: 'verified-source',
    sourceIds: ['robertson-smrt'],
  },
  {
    id: 'clinical-limits',
    kind: 'caution',
    title: 'Límites: no es terapia ni consejo clínico',
    text:
      'Janus no es terapeuta y no da consejo clínico. Ante dificultades reales —ansiedad persistente, depresión, duelo complicado, trauma, pensamientos de hacerse daño— lo mejor es hablar con un profesional de salud o con una persona de confianza. ' +
      'Si alguien está en peligro, contactar de inmediato con los servicios de emergencia de su país.',
    keywords: ['terapeuta', 'consejo clinico', 'profesional', 'ayuda', 'limites', 'diagnostico', 'tratamiento', 'depresion', 'ansiedad', 'duelo', 'trauma'],
    basis: 'consensus-unverified',
  },
];

/** User-facing reminder that every psychology answer must carry (a, b and c of the rules below). */
export const PSYCHOLOGY_REMINDER =
  'Recuerda: es una filosofía de vida, no una terapia, y sus efectos propios están menos investigados que los de la TCC; no es lo mismo que la TCC ni su origen. ' +
  'Janus no es terapeuta ni da consejo clínico; ante dificultades reales, habla con un profesional.';

export const PSYCHOLOGY_RULES: readonly string[] = [
  'Abre con «sí, hay un vínculo de inspiración»; nunca con «un sí rotundo».',
  'No llames al vínculo «directo» ni «profundo», y no digas que el estoicismo es lo mismo que la TCC ni su origen.',
  'En la MISMA respuesta di siempre: (a) es una filosofía de vida, no una terapia, y sus efectos propios están menos investigados que los de la TCC; (b) Janus no es terapeuta ni da consejo clínico; (c) ante dificultades reales, hablar con un profesional.',
  'Distingue siempre: hecho verificado (qué dice una fuente), consenso no recomprobado, inferencia (paralelo propuesto aquí) y NO VERIFICADO.',
];

export function findPsychologyLink(text: string): PsychologyLink | undefined {
  const needle = fold(text);
  let best: { link: PsychologyLink; score: number } | undefined;
  for (const link of PSYCHOLOGY) {
    const score = link.keywords.filter((keyword) => hasWord(needle, fold(keyword))).reduce((sum, keyword) => sum + keyword.length, 0);
    if (score > 0 && (!best || score > best.score)) best = { link, score };
  }
  return best?.link;
}

function hasWord(needle: string, keyword: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(needle);
}

function fold(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}
