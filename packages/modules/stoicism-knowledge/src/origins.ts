import type { OriginsEpisode } from './types.js';

/**
 * Origins of Greco-Roman philosophy up to the Stoa and its Roman reception.
 * Almost all dates and attributions here are standard scholarly consensus and were NOT re-checked against a source in this work.
 * Each episode carries the WEAKEST basis of its claims (consensus-unverified); the sentences that were checked say so inline
 * («verificado en la SEP», or a paragraph of Long’s Meditations) and `sourceIds` lists the sources used for those parts.
 * Ancient biographical anecdotes (mostly Diogenes Laertius) are tradition, not established fact.
 */
export const ORIGINS: readonly OriginsEpisode[] = [
  {
    id: 'ionia',
    title: 'Jonia: la pregunta por el principio de todo',
    period: 'hacia 600 a. C.',
    text:
      'La filosofía occidental suele situar su comienzo en Mileto (costa jónica): Tales, Anaximandro y Anaximeno buscan explicar el mundo por causas naturales, preguntándose cuál es el principio (arkhê) de las cosas. ' +
      'Es un paso del relato mítico a la explicación razonada. En esta etapa se habla de «presocráticos» porque son anteriores a Sócrates (aunque algunos son contemporáneos suyos).',
    keywords: ['jonia', 'mileto', 'tales', 'anaximandro', 'anaximenes', 'presocraticos', 'arche', 'principio', 'ionia', 'miletus'],
    basis: 'consensus-unverified',
  },
  {
    id: 'heraclitus-pythagoras',
    title: 'Heráclito, Pitágoras y los eleatas',
    period: 'siglos VI–V a. C.',
    text:
      'Heráclito de Éfeso hace del cambio y del logos —la razón que ordena el flujo— el núcleo de su pensamiento; los estoicos lo recogerán en su física (relación de consenso). ' +
      'Pitágoras fundó una comunidad en el sur de Italia con prácticas de vida (consenso); Parménides y los eleatas discuten qué es ser. ' +
      'Empédocles, cuya «esfera» aparece citada por Marco Aurelio (Meditaciones, libro 12, párrafo 3 de la edición), y los atomistas Leucipo y Demócrito completan el cuadro de la naturaleza.',
    keywords: ['heraclito', 'pitagoras', 'parmenides', 'eleatas', 'empedocles', 'democrito', 'atomistas', 'logos', 'cambio', 'flujo', 'heraclitus', 'pythagoras'],
    basis: 'consensus-unverified',
    sourceIds: ['long-meditations'],
  },
  {
    id: 'sophists-socrates',
    title: 'Los sofistas y Sócrates: el giro hacia la ética',
    period: 'siglo V a. C.',
    text:
      'En la Atenas democrática, los sofistas enseñan retórica y se preguntan por la ley y la naturaleza. Sócrates (470/469–399 a. C.) cambia la pregunta: cómo se debe vivir. No escribió; su método de preguntar y refutar (élenchos) y la idea de que la virtud es conocimiento pasan a Platón, a los cínicos y a los estoicos. ' +
      'Su condena a muerte en el 399 a. C. se convierte en símbolo del filósofo que mantiene sus principios. Marco Aurelio lo cita varias veces (por ejemplo, libro 11, párrafos 41, 43, 46 y 55 de la edición).',
    keywords: ['socrates', 'sofistas', 'etica', 'giro', 'elenchos', 'virtud', 'atenas', 'sophists', 'virtue', 'conocimiento'],
    basis: 'consensus-unverified',
    sourceIds: ['long-meditations'],
  },
  {
    id: 'plato-aristotle',
    title: 'Platón y Aristóteles: la Academia y el Liceo',
    period: 'siglo IV a. C.',
    text:
      'Platón (c. 428–348 a. C.) funda la Academia hacia el 387 a. C.; Aristóteles (384–322 a. C.) funda el Liceo hacia el 335 a. C. Sistematizan metafísica, ética, lógica y política. ' +
      'Los estoicos discuten con ellos y heredan términos como virtud, alma y fin último (relación de consenso).',
    keywords: ['platon', 'aristoteles', 'academia', 'liceo', 'lyceum', 'plato', 'aristotle', 'metafisica'],
    basis: 'consensus-unverified',
  },
  {
    id: 'hellenistic',
    title: 'La era helenística: cuatro respuestas a «cómo vivir»',
    period: 'desde 323 a. C.',
    text:
      'Tras Alejandro Magno (m. 323 a. C.) nacen escuelas que buscan una vida tranquila en un mundo inestable: el cinismo (Diógenes), el epicureísmo (Epicuro, 341–270 a. C., que funda el Jardín en Atenas hacia el 306 a. C.), ' +
      'el escepticismo (Pirrón y, en la Academia, Arcesilao y Carneades) y el estoicismo (Zenón, hacia el 300 a. C., con la Stoa Poikilê; verificado en la SEP). ' +
      'Comparten la idea de la filosofía como terapia del alma (también en la lectura moderna de Nussbaum, «The Therapy of Desire», 1994, citada en la bibliografía de la SEP), pero discrepan en el fin: el placer sereno (epicúreos), la suspensión del juicio (escépticos) o la virtud (estoicos).',
    keywords: ['helenistica', 'helenismo', 'epicuro', 'epicureismo', 'jardin', 'escepticismo', 'pirron', 'cinismo', 'terapia', 'hellenistic', 'epicurus', 'skeptic', 'cynic', 'escuelas'],
    basis: 'consensus-unverified',
    sourceIds: ['sep-stoicism'],
  },
  {
    id: 'rome-reception',
    title: 'Roma: la filosofía griega pasa al latín',
    period: 'siglos II a. C.–I d. C.',
    text:
      'Roma conquista Grecia (146 a. C.) y se llena de maestros griegos. Una embajada de filósofos atenienses en 155 a. C., con Diógenes de Babilonia entre ellos según la tradición, es un hito de consenso. ' +
      'Panecio vinculado a los Escipiones y Posidonio conectan Roma y la Estoa media (SEP). Cicerón no se decía estoico, pero discutió ampliamente su doctrina y la trasladó al latín; De officiis sigue a Panecio (verificado en la SEP). ' +
      'En el Imperio, la Estoa se vuelve cada vez más práctica: Séneca, Musonio Rufo, Epicteto y Marco Aurelio.',
    keywords: ['roma', 'romano', 'republica', 'imperio', 'ciceron', 'escipiones', 'embajada', 'latin', 'rome', 'cicero', 'imperial'],
    basis: 'consensus-unverified',
    sourceIds: ['sep-stoicism'],
  },
  {
    id: 'late-antiquity',
    title: 'Antigüedad tardía: neoplatonismo y cristianismo',
    period: 'siglos II–VI d. C.',
    text:
      'La SEP indica que autores cristianos fueron receptivos a elementos estoicos; que la tradición de la ley natural «parece derivar directamente» del estoicismo; y que existe una correspondencia apócrifa entre san Pablo y Séneca, falsificada pero citada por Jerónimo y Agustín. ' +
      'Evagrio habría adaptado la libertad de las pasiones a la lista de los vicios capitales (tesis de Sorabji citada por la SEP). El neoplatonismo (Plotino, siglo III) domina la filosofía pagana tardía (consenso). ' +
      'Sobre el cierre de las escuelas atenienses por Justiniano en el 529 d. C.: es fecha tradicional de consenso, aunque los historiadores discuten su alcance real.',
    keywords: ['cristianismo', 'cristianos', 'neoplatonismo', 'plotino', 'agustin', 'jeronimo', 'ley natural', 'justiniano', 'christian', 'christianity', 'natural law', 'tardia'],
    basis: 'consensus-unverified',
    sourceIds: ['sep-stoicism'],
  },
  {
    id: 'modern-reception',
    title: 'Del neoestoicismo a hoy',
    period: 'siglos XVI–XXI',
    text:
      'La SEP nombra a Justo Lipsio como la figura más importante del neoestoicismo, que buscó la síntesis entre cristianismo y estoicismo a finales del XVI e inicios del XVII. En el siglo XIX la lógica estoica reaparece en las historias de la lógica. ' +
      'En el siglo XX, Pierre Hadot recuperó la filosofía antigua como forma de vida (consenso). Desde alrededor de 2012 existe el movimiento del «estoicismo moderno» (Stoic Week y cursos como SMRT, según Robertson); su evidencia empírica es preliminar (véase el tema de psicología).',
    keywords: ['neoestoicismo', 'lipsio', 'moderno', 'hoy', 'actual', 'renacimiento', 'hadot', 'modern stoicism', 'stoic week', 'revival', 'siglo xx'],
    basis: 'consensus-unverified',
    sourceIds: ['sep-stoicism', 'robertson-smrt'],
  },
];

export function findOriginsEpisode(text: string): OriginsEpisode | undefined {
  const needle = fold(text);
  let best: { episode: OriginsEpisode; score: number } | undefined;
  for (const episode of ORIGINS) {
    const score = episode.keywords.filter((keyword) => hasWord(needle, keyword)).reduce((sum, keyword) => sum + keyword.length, 0);
    if (score > 0 && (!best || score > best.score)) best = { episode, score };
  }
  return best?.episode;
}

function hasWord(needle: string, keyword: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(needle);
}

function fold(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}
