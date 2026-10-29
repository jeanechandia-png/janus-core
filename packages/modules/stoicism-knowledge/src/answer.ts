import { DOCTRINE, GLOSSARY, PRACTICES, findDoctrineTopic, findPractice } from './doctrine.js';
import { FIGURES, PHASES, TIMELINE, findFigure } from './history.js';
import {
  BOOK_COUNT, fold, getBookDigest, getPassage, isValidBook, paragraphCount, searchMeditations, totalParagraphs,
} from './meditations.js';
import { ORIGINS, findOriginsEpisode } from './origins.js';
import { PSYCHOLOGY, PSYCHOLOGY_REMINDER, findPsychologyLink } from './psychology.js';
import { SOURCES, TEXT_PROVENANCE } from './provenance.js';
import type { FactBasis, StoicismAnswer } from './types.js';

/** The tool pipeline clips knowledge replies at 3000 characters; stay under it. */
export const REPLY_LIMIT = 2900;

const CRISIS_PATTERN = /suicid|quitarme la vida|quiero morir|quiero morirme|no quiero vivir|acabar con todo|hacerme dano|autolesion|matarme|kill myself|end my life|self.?harm|zelfmoord|niet meer leven|mezelf iets aandoen/;

export function mentionsCrisis(text: string): boolean {
  return CRISIS_PATTERN.test(fold(text));
}

const BASIS_LABEL: Record<FactBasis, string> = {
  'verified-source': 'VERIFICADO en la fuente citada',
  'consensus-unverified': 'CONSENSO, no recomprobado',
  inference: 'INFERENCIA (paralelo propuesto aquí)',
  unverified: 'NO VERIFICADO',
};

function basisLine(bases: readonly FactBasis[]): string {
  const unique = [...new Set(bases)];
  return `Base: ${unique.map((basis) => BASIS_LABEL[basis]).join(' · ')}.`;
}

export function clipReply(text: string, limit: number = REPLY_LIMIT): string {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit - 40);
  const boundary = Math.max(cut.lastIndexOf('\n'), cut.lastIndexOf('. '));
  return `${cut.slice(0, boundary > limit * 0.5 ? boundary + 1 : cut.length).trimEnd()} … (recortado; pide el siguiente apartado)`;
}

function answer(topic: StoicismAnswer['topic'], parts: string[], bases: readonly FactBasis[]): StoicismAnswer {
  const reply = clipReply([...parts, basisLine(bases)].join('\n\n'));
  return { mode: 'knowledge', topic, reply, bases: [...new Set(bases)] };
}

// ---------------------------------------------------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------------------------------------------------

export function supportFirstAnswer(): StoicismAnswer {
  const reply = [
    'Lo que cuentas importa más que cualquier cita. No quiero responderte con filosofía ahora.',
    'Si estás en peligro o piensas hacerte daño, contacta ahora con los servicios de emergencia de tu país o con una persona de confianza que pueda estar contigo.',
    'Y cuando puedas, habla con un profesional de salud: no tienes que cargar con esto solo.',
  ].join('\n\n');
  return { mode: 'support_first', topic: 'limits', reply, bases: [] };
}

export function overviewAnswer(): StoicismAnswer {
  return answer('overview', [
    'Estoicismo en breve',
    'Fundado por Zenón de Citio en Atenas hacia el 300 a. C. (tras estudiar con el cínico Crates); el nombre viene de la Stoa Poikilê, el «pórtico pintado» del ágora. Tres fases: Estoa antigua, media e imperial (romana).',
    'Ideas centrales: la virtud es el único bien y basta para la felicidad; vivir de acuerdo con la razón y la naturaleza; distinguir lo que depende de nosotros (juicios, intenciones, actos) de lo que no; las pasiones son juicios erróneos, no hay que reprimir el sentir sino educar el juicio; todos formamos una sola comunidad.',
    'De los primeros estoicos solo quedan fragmentos; sí se conservan textos de Séneca, Epicteto y Marco Aurelio (verificado en la SEP).',
    `Lo que Janus tiene: los doce libros de las Meditaciones completos (${totalParagraphs()} párrafos, traducción inglesa de G. Long, 1862) con resumen y pasajes clave en español; ${FIGURES.length} figuras, ${DOCTRINE.length} temas de doctrina, ${ORIGINS.length} etapas de los orígenes grecorromanos, ${PSYCHOLOGY.length} apartados sobre psicología y ${PRACTICES.length} ejercicios.`,
    'Pídeme, por ejemplo: «libro 4 de las Meditaciones», «pasaje libro 9 párrafo 31», «busca la muerte en las Meditaciones», «historia del estoicismo», «orígenes de la filosofía grecorromana», «estoicismo y psicología», «quién fue Epicteto», «ejercicio de la mañana».',
  ], ['verified-source']);
}

export function bookAnswer(book: number, section: 'summary' | 'passages' = 'summary'): StoicismAnswer {
  const digest = isValidBook(book) ? getBookDigest(book) : undefined;
  if (!digest) {
    return answer('book', [`Las Meditaciones tienen doce libros (no «tomos»). Pide un número del 1 al ${BOOK_COUNT}.`], ['verified-source']);
  }
  if (section === 'passages') {
    const lines = digest.keyPassages.map((passage) => `• párr. ${passage.paragraph}: ${passage.gloss}`);
    return answer('book', [
      `Meditaciones · Libro ${digest.book} — pasajes clave (${digest.keyPassages.length}; «párrafo de la edición»)`,
      lines.join('\n'),
      `Para leer uno completo: «pasaje libro ${digest.book} párrafo N». El libro tiene ${paragraphCount(digest.book)} párrafos.`,
    ], ['verified-source', 'inference']);
  }
  return answer('book', [
    `Meditaciones · ${digest.title}`,
    digest.summary,
    `Temas: ${digest.themes.join('; ')}.`,
    digest.setting,
    `Para ver los pasajes clave: «pasajes del libro ${digest.book}». El resumen es interpretación mía de la lectura de Long (inglés); no es una traducción.`,
  ], ['verified-source', 'inference']);
}

export function passageAnswer(book: number, paragraph: number, offset = 0): StoicismAnswer {
  const passage = getPassage(book, paragraph);
  if (!passage) {
    const max = isValidBook(book) ? paragraphCount(book) : 0;
    return answer('passage', [isValidBook(book)
      ? `El libro ${book} tiene ${max} párrafos en esta edición; no existe el párrafo ${paragraph}.`
      : `Las Meditaciones tienen doce libros; el ${book} no existe.`], ['verified-source']);
  }
  const header = `Meditaciones · libro ${book}, párrafo ${paragraph} de la edición (Long, 1862; inglés)`;
  const budget = REPLY_LIMIT - 560;
  const slice = passage.text.slice(offset, offset + budget);
  const more = offset + budget < passage.text.length;
  const parts = [header, `«${offset > 0 ? '… ' : ''}${slice}${more ? ' …' : ''}»`];
  if (more) parts.push(`El párrafo continúa (${passage.text.length - offset - budget} caracteres más). Pide «continuar» con offset ${offset + budget}.`);
  if (passage.keyPassage && offset === 0) parts.push(`En español (glosa mía, no traducción literal): ${passage.keyPassage.gloss}`);
  parts.push('La numeración es la de la edición (puede no coincidir con la numeración libro.sección de otras ediciones). Texto original en griego: no consultado.');
  return answer('passage', parts, ['verified-source']);
}

export function searchAnswer(query: string): StoicismAnswer {
  const hits = searchMeditations(query, { limit: 5 });
  if (hits.length === 0) {
    return answer('search', [
      `No encontré párrafos de las Meditaciones para «${query.trim().slice(0, 80)}». Prueba con una o dos palabras clave (muerte, ira, razón, fama, tiempo, justicia, naturaleza…) en español o en inglés.`,
    ], ['verified-source']);
  }
  const lines = hits.map((hit) => `• libro ${hit.book}, párr. ${hit.paragraph}: «${hit.snippet}»`);
  return answer('search', [
    `Búsqueda en las Meditaciones (texto completo de Long, inglés) · ${hits.length} resultado${hits.length === 1 ? '' : 's'}`,
    lines.join('\n'),
    'Para leer uno entero: «pasaje libro N párrafo M». Coincidencia por palabras clave (búsqueda automática, no interpretación); los resultados pueden incluir pasajes sólo tangenciales.',
  ], ['verified-source']);
}

export function figureAnswer(query: string): StoicismAnswer {
  const figure = findFigure(query);
  if (!figure) {
    const names = FIGURES.map((candidate) => candidate.name).join('; ');
    return answer('figure', [`No tengo a esa figura. Tengo fichas de: ${names}.`], ['verified-source']);
  }
  const phase = PHASES.find((candidate) => candidate.id === figure.phase);
  const datesNote = (figure.datesBasis ?? 'consensus-unverified') === 'verified-source' ? '' : ' (fechas de consenso, no recomprobadas)';
  return answer('figure', [
    `${figure.name} · ${figure.dates}${datesNote}`,
    `Etapa: ${phase?.title ?? figure.phase}.`,
    figure.role,
    `Obras: ${figure.works}`,
    `Ideas: ${figure.ideas}`,
  ], [figure.basis, figure.datesBasis ?? 'consensus-unverified']);
}

export function historyAnswer(): StoicismAnswer {
  const lines = PHASES.map((phase) => `• ${phase.title} (${phase.period}): ${phase.summary}`);
  return answer('history', [
    'Historia del estoicismo (SEP: Estoa antigua, media e imperial)',
    lines.join('\n'),
    'Fechas de personas: consenso, no recomprobadas, salvo las que se señalan como verificadas. Pide «cronología» para una línea de tiempo o «quién fue X» para una ficha.',
  ], ['verified-source', 'consensus-unverified']);
}

export function timelineAnswer(): StoicismAnswer {
  const lines = TIMELINE.map((entry) => `• ${entry.year < 0 ? `${Math.abs(entry.year)} a. C.` : `${entry.year} d. C.`}${entry.approx ? ' (aprox.)' : ''}: ${entry.label}`);
  return answer('history', ['Cronología del estoicismo', lines.join('\n')], TIMELINE.map((entry) => entry.basis));
}

export function originsAnswer(query = ''): StoicismAnswer {
  const episode = query ? findOriginsEpisode(query) : undefined;
  if (episode) return answer('origins', [episode.title, `Época: ${episode.period}.`, episode.text], [episode.basis]);
  const lines = ORIGINS.map((item) => `• ${item.title} (${item.period})`);
  return answer('origins', [
    'Orígenes de la filosofía grecorromana (panorama)',
    lines.join('\n'),
    'La filosofía occidental suele arrancar en Jonia hacia el 600 a. C., con una pregunta por el principio natural de las cosas; el giro ético llega con Sócrates; tras Alejandro, cuatro escuelas ofrecen respuestas a «cómo vivir» (entre ellas la Estoa, hacia el 300 a. C.); Roma la hereda y la difunde en latín.',
    'Pide una etapa concreta, por ejemplo «Sócrates», «época helenística» o «Roma y Cicerón».',
  ], ['consensus-unverified']);
}

export function doctrineAnswer(query = ''): StoicismAnswer {
  const topic = query ? findDoctrineTopic(query) : undefined;
  if (!topic) {
    const lines = DOCTRINE.map((item) => `• ${item.title}`);
    return answer('doctrine', ['Doctrina estoica: temas disponibles', lines.join('\n'), 'Pide uno por su nombre, por ejemplo «dicotomía del control» o «asentimiento».'], ['verified-source']);
  }
  return answer('doctrine', [
    `${topic.title}${topic.greek ? ` (${topic.greek})` : ''}`,
    topic.summary,
    topic.detail,
  ], [topic.basis]);
}

export function psychologyAnswer(query = ''): StoicismAnswer {
  const specific = query ? findPsychologyLink(query) : undefined;
  const generic = /psicolog|terapia|tcc|cognitiv|relacion|vinculo|link|psychology/.test(fold(query)) && !/ellis|beck|rebt|evidencia|estudio|smrt|paralelo|control|premeditatio|mindfulness|diferenc|riesgo|reprim|suprim|limite|terapeuta/.test(fold(query));
  if (specific && !generic) {
    return answer('psychology', [specific.title, specific.text, PSYCHOLOGY_REMINDER], [specific.basis]);
  }
  return answer('psychology', [
    'Estoicismo y psicología actual',
    'Sí, hay un vínculo de inspiración. Albert Ellis (REBT, desde los años 1950) y Aaron Beck (terapia cognitiva, años 1960) señalan al estoicismo; el vínculo es más explícito en Ellis y más tenue en Beck. Idea común: lo que nos perturba depende en buena parte del juicio que hacemos sobre los hechos (Epicteto; Marco Aurelio, libro 11, párrafo 32 de la edición).',
    'Paralelos, como INFERENCIA mía y no como derivación demostrada: dicotomía del control y afrontamiento; anticipar males y planificación de contingencias; primeros movimientos y pensamientos automáticos; vista desde arriba y autodistanciamiento.',
    'Evidencia: NO VERIFICADO como eficacia clínica. Lo localizado son estudios piloto sin grupo de control descrito, con una escala propia del autor, que él mismo califica de preliminares.',
    PSYCHOLOGY_REMINDER,
    'Detalles: «Ellis», «Beck», «evidencia», «diferencias», «riesgos de reprimir», «paralelo del control».',
  ], ['verified-source', 'inference']);
}

export function practiceAnswer(query = ''): StoicismAnswer {
  const practice = query ? findPractice(query) : undefined;
  if (!practice) {
    const lines = PRACTICES.map((item) => `• ${item.title} (${item.minutes} min)`);
    return answer('practice', ['Ejercicios estoicos disponibles', lines.join('\n'), 'Pide uno por su nombre, por ejemplo «ejercicio de la mañana» o «vista desde arriba». No son un tratamiento clínico.'], ['consensus-unverified']);
  }
  return answer('practice', [
    `${practice.title} · ${practice.minutes} min`,
    practice.steps.map((step, index) => `${index + 1}. ${step}`).join('\n'),
    `Origen: ${practice.origin}`,
    ...(practice.modernAnalogue ? [practice.modernAnalogue] : []),
    'No es un tratamiento clínico; ante dificultades reales, habla con un profesional.',
  ], [practice.originBasis, ...(practice.modernAnalogue ? ['inference' as const] : [])]);
}

export function glossaryAnswer(query = ''): StoicismAnswer {
  const needle = fold(query);
  const matches = GLOSSARY.filter((term) => needle.includes(fold(term.term)) || needle.includes(fold(term.greek.replace(/[^\p{L}\s]/gu, ' '))));
  const entries = matches.length > 0 ? matches : GLOSSARY;
  return answer('glossary', [
    matches.length > 0 ? 'Glosario estoico' : 'Glosario estoico (términos principales)',
    entries.map((term) => `• ${term.term} — ${term.greek}: ${term.meaning}`).join('\n'),
  ], entries.map((term) => term.basis));
}

export function limitsAnswer(): StoicismAnswer {
  return answer('limits', [
    'Fuentes y límites de este conocimiento',
    `Texto: ${TEXT_PROVENANCE.work}, ${TEXT_PROVENANCE.translator}; edición ${TEXT_PROVENANCE.edition} (commit ${TEXT_PROVENANCE.repositoryCommit.slice(0, 10)}…), leída el ${TEXT_PROVENANCE.readOn}. Doce libros. El griego no se consultó.`,
    `Fuentes consultadas para la historia y la psicología: ${SOURCES.map((source) => source.title.split(' — ')[0]).join('; ')}.`,
    'Etiquetas: VERIFICADO (contrastado en la fuente citada), CONSENSO no recomprobado, INFERENCIA (paralelo propuesto aquí), NO VERIFICADO. Los resúmenes y glosas en español son interpretación mía de la lectura, no traducción.',
    'Las citas de la voz y del chat (Casaubon, 1634) y este texto (Long, 1862) son traducciones inglesas distintas del mismo original. No es una herramienta clínica.',
  ], ['verified-source']);
}

// ---------------------------------------------------------------------------------------------------------------------
// Free-text router
// ---------------------------------------------------------------------------------------------------------------------

const ROMAN: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12 };

function parseNumber(value: string): number {
  const lower = value.toLowerCase();
  return /^\d+$/.test(lower) ? Number(lower) : ROMAN[lower] ?? NaN;
}

export function parseBookReference(text: string): { book?: number; paragraph?: number } {
  const folded = fold(text);
  const both = folded.match(/\b(?:libro|book)\s*(\d{1,2}|[ivx]{1,4})\b\D{0,16}?(?:parrafo|parr|passage|pasaje|section|seccion|numero)\s*\.?\s*(\d{1,3})\b/);
  if (both) return { book: parseNumber(both[1]!), paragraph: Number(both[2]) };
  const dotted = folded.match(/\b(\d{1,2})\.(\d{1,3})\b/);
  if (dotted && /meditacion|marco|aurelio|libro|book|pasaje|parrafo/.test(folded)) return { book: Number(dotted[1]), paragraph: Number(dotted[2]) };
  const reversed = folded.match(/\b(?:parrafo|parr|passage|pasaje|section)\s*(\d{1,3})\b\D{0,16}?\b(?:libro|book)\s*(\d{1,2}|[ivx]{1,4})\b/);
  if (reversed) return { book: parseNumber(reversed[2]!), paragraph: Number(reversed[1]) };
  const bookOnly = folded.match(/\b(?:libro|book)\s*(\d{1,2}|[ivx]{1,4})\b/);
  if (bookOnly) return { book: parseNumber(bookOnly[1]!) };
  return {};
}

export interface AskOptions {
  /** Offset into a long passage, for «continuar». */
  offset?: number;
}

export function askStoicism(text: string, options: AskOptions = {}): StoicismAnswer {
  const raw = String(text ?? '').slice(0, 2000);
  if (mentionsCrisis(raw)) return supportFirstAnswer();
  const folded = fold(raw);

  const ref = parseBookReference(raw);
  if (ref.book !== undefined && ref.paragraph !== undefined) return passageAnswer(ref.book, ref.paragraph, options.offset ?? 0);
  if (ref.book !== undefined) {
    return bookAnswer(ref.book, /pasajes|clave|passages|key/.test(folded) ? 'passages' : 'summary');
  }

  if (/\bbusca|buscar|busco|donde dice|donde habla|encuentra|search|find\b/.test(folded) && /meditacion|marco|aurelio|libro|pasaje|texto|text/.test(folded)) {
    return searchAnswer(raw);
  }

  if (/psicolog|terapia|\btcc\b|cognitiv|\bellis\b|\bbeck\b|rebt|salud mental|psychology|therapy|evidencia|smrt|stoic week|semana estoica/.test(folded)) return psychologyAnswer(raw);

  if (/cronolog|linea de tiempo|timeline/.test(folded)) return timelineAnswer();

  const figure = findFigure(raw);
  const origins = /orige|origin|grecorroman|greco-roman|greco roman|presocrat|helenist|hellenist|filosofia griega|filosofia romana|inicios de la filosofia|comienzos de la filosofia/.test(folded);
  if (figure && /quien (fue|es|era)|biograf|vida de|who (was|is)|ficha|cuentame de|hablame de/.test(folded) && !origins) return figureAnswer(raw);
  if (origins) return originsAnswer(raw);

  if (/historia|fases|etapas|fundad|fundacion|estoa antigua|estoa media|estoa imperial|history|founder|escuela/.test(folded) && !figure) return historyAnswer();

  if (/ejercicio|practica|rutina|exercise|practice|examen de|premeditatio|incomodidad voluntaria/.test(folded)) return practiceAnswer(raw);
  if (/glosario|vocabulario|glossary|que significa|termino griego|palabra griega/.test(folded)) return glossaryAnswer(raw);
  if (/fuentes|limites|fiable|verifica|de donde sacas|sources|provenance|licencia|traduccion/.test(folded)) return limitsAnswer();

  const topic = findDoctrineTopic(raw);
  if (topic) return doctrineAnswer(raw);
  if (/doctrina|doctrine|ideas|principios|filosofia|que es el estoicismo|what is stoicism/.test(folded) && !figure) return doctrineAnswer('');
  if (figure) return figureAnswer(raw);
  return overviewAnswer();
}
