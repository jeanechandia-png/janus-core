import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  BOOK_COUNT, DOCTRINE, FIGURES, GLOSSARY, MEDITATIONS_DIGESTS, MEDITATIONS_SOURCE_XHTML_SHA256, MEDITATIONS_TEXT, MEDITATIONS_TEXT_SHA256,
  ORIGINS, PHASES, PRACTICES, PSYCHOLOGY, REPLY_LIMIT, SOURCES, TEXT_PROVENANCE, TIMELINE,
  askStoicism, bookAnswer, doctrineAnswer, figureAnswer, getPassage, glossaryAnswer, historyAnswer, limitsAnswer, listKeyPassages,
  originsAnswer, overviewAnswer, parseBookReference, passageAnswer, practiceAnswer, psychologyAnswer, searchAnswer, searchMeditations,
  timelineAnswer, totalParagraphs,
} from '../packages/modules/stoicism-knowledge/src/index.js';
import { StoicismToolAdapter } from '../packages/adapters/src/stoicism-tool-adapter.js';
import { HOUSEHOLD_SAFE_TOOLS } from '../packages/core/src/speaker-policy.js';
import { deterministicPlan } from '../packages/orchestrator/src/deterministic-planner.js';

const noop = async () => {};

function normalize(value: string): string {
  return value.replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/⁠/g, '').replace(/ /g, ' ');
}

const EXPECTED_PARAGRAPHS = [18, 18, 16, 54, 41, 58, 76, 64, 43, 43, 55, 39];

test('the full text of the twelve books is intact (paragraph counts and SHA-256 per book)', () => {
  assert.equal(BOOK_COUNT, 12);
  for (let book = 1; book <= 12; book += 1) {
    const paragraphs = MEDITATIONS_TEXT[book]!;
    assert.equal(paragraphs.length, EXPECTED_PARAGRAPHS[book - 1], `book ${book} paragraph count`);
    assert.equal(createHash('sha256').update(paragraphs.join('\n'), 'utf8').digest('hex'), MEDITATIONS_TEXT_SHA256[book], `book ${book} text hash`);
    assert.match(MEDITATIONS_SOURCE_XHTML_SHA256[book]!, /^[0-9a-f]{64}$/);
  }
  assert.equal(totalParagraphs(), 525);
  assert.match(TEXT_PROVENANCE.repositoryCommit, /^[0-9a-f]{40}$/);
  assert.equal(TEXT_PROVENANCE.books, 12);
  assert.match(TEXT_PROVENANCE.translatorLicense, /Public domain/);
});

test('digests cover all twelve books and every excerpt is an exact substring of its paragraph', () => {
  assert.equal(MEDITATIONS_DIGESTS.length, 12);
  let passages = 0;
  MEDITATIONS_DIGESTS.forEach((digest, index) => {
    assert.equal(digest.book, index + 1);
    assert.ok(digest.summary.split(/\s+/).length >= 100, `book ${digest.book} summary is substantial`);
    assert.ok(digest.themes.length >= 5, `book ${digest.book} themes`);
    assert.ok(digest.keyPassages.length >= 6, `book ${digest.book} key passages`);
    assert.doesNotMatch(`${digest.title} ${digest.summary}`, /(^|[^\p{L}])tomos?($|[^\p{L}])/iu);
    for (const passage of digest.keyPassages) {
      passages += 1;
      const text = MEDITATIONS_TEXT[digest.book]![passage.paragraph - 1];
      assert.ok(text, `book ${digest.book} paragraph ${passage.paragraph} exists`);
      assert.ok(normalize(text).includes(normalize(passage.excerpt)), `book ${digest.book} p.${passage.paragraph}: excerpt must be verbatim`);
      assert.ok(passage.gloss.length > 20);
    }
  });
  assert.equal(passages, 142);
  assert.equal(listKeyPassages().length, 142);
});

test('verified book numbers of the voice wordings match Long’s text', () => {
  // [book, distinctive wording] for each of the 15 wordings used by Melanie and the written chat.
  const checks: Array<[number, RegExp]> = [
    [4, /promontory/], [6, /not to become like/], [7, /Look within/], [10, /No longer talk at all/], [7, /every day as the last/],
    [4, /Death hangs over thee/], [2, /three thousand years/], [5, /rising to the work of a human being/], [5, /converts and changes every hindrance/],
    [8, /first appearances/], [9, /ample space/], [12, /every man loves himself more/], [2, /cooperation/], [5, /dyed/], [12, /If it is not right, do not do it/],
  ];
  for (const [book, pattern] of checks) {
    assert.ok(MEDITATIONS_TEXT[book]!.some((paragraph) => pattern.test(normalize(paragraph))), `${pattern} should be in book ${book}`);
  }
});

test('getPassage respects bounds and attaches the Spanish gloss to key passages', () => {
  assert.equal(getPassage(0, 1), undefined);
  assert.equal(getPassage(13, 1), undefined);
  assert.equal(getPassage(9, 0), undefined);
  assert.equal(getPassage(9, 44), undefined);
  const passage = getPassage(9, 31)!;
  assert.match(passage.text, /Look down from above/);
  assert.ok(passage.keyPassage);
  assert.equal(getPassage(9, 2)?.keyPassage, undefined);
});

test('search works in Spanish and English, ranks relevant paragraphs and returns nothing for gibberish', () => {
  const death = searchMeditations('muerte');
  assert.ok(death.length >= 3);
  for (const hit of death) assert.match(MEDITATIONS_TEXT[hit.book]![hit.paragraph - 1]!, /\b(death|die|dies|died|dying|dead|mortal)/i);
  const anger = searchMeditations('ira');
  assert.ok(anger.length > 0);
  for (const hit of anger) assert.match(MEDITATIONS_TEXT[hit.book]![hit.paragraph - 1]!, /anger|angry|wrath/i);
  const fame = searchMeditations('la fama');
  assert.ok(fame.some((hit) => /fame|reputation|glory|praise|renown/i.test(MEDITATIONS_TEXT[hit.book]![hit.paragraph - 1]!)));
  assert.ok(searchMeditations('obstacle').length === 0 || searchMeditations('obstacle').every((hit) => hit.snippet.length > 0));
  assert.ok(searchMeditations('hindrance').some((hit) => hit.book === 5 && hit.paragraph === 20));
  assert.deepEqual(searchMeditations('xyzzyplugh'), []);
  assert.deepEqual(searchMeditations('   '), []);
  assert.equal(searchMeditations('muerte', { limit: 2 }).length, 2);
  assert.ok(searchMeditations('muerte', { book: 12 }).every((hit) => hit.book === 12));
  assert.equal(JSON.stringify(searchMeditations('muerte')), JSON.stringify(searchMeditations('muerte')), 'deterministic');
});

test('book references are parsed in Spanish, English and Roman numerals', () => {
  assert.deepEqual(parseBookReference('Resumen del libro 4 de las Meditaciones'), { book: 4 });
  assert.deepEqual(parseBookReference('pasaje libro 9 párrafo 31'), { book: 9, paragraph: 31 });
  assert.deepEqual(parseBookReference('Book IX passage 3'), { book: 9, paragraph: 3 });
  assert.deepEqual(parseBookReference('párrafo 20 del libro 5'), { book: 5, paragraph: 20 });
  assert.deepEqual(parseBookReference('Meditaciones 12.25'), { book: 12, paragraph: 25 });
  assert.deepEqual(parseBookReference('cuéntame del estoicismo'), {});
});

test('book answers: twelve books, summary and passages pages, invalid books get a correction', () => {
  for (let book = 1; book <= 12; book += 1) {
    const summary = bookAnswer(book, 'summary');
    assert.equal(summary.topic, 'book');
    assert.ok(summary.reply.includes(`Libro ${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][book - 1]}`), `book ${book} title`);
    assert.ok(summary.reply.length <= REPLY_LIMIT);
    assert.doesNotMatch(summary.reply, /recortado/);
    const passages = bookAnswer(book, 'passages');
    assert.ok(passages.reply.length <= REPLY_LIMIT);
    assert.doesNotMatch(passages.reply, /recortado/);
  }
  const invalid = bookAnswer(13);
  assert.match(invalid.reply, /doce libros/);
  assert.match(invalid.reply, /no «tomos»/);
});

test('passage answers quote the edition text, page long paragraphs and explain the numbering', () => {
  const answer = passageAnswer(9, 31);
  assert.match(answer.reply, /Look down from above/);
  assert.match(answer.reply, /En español \(glosa mía, no traducción literal\)/);
  assert.match(answer.reply, /numeración es la de la edición/);
  assert.match(passageAnswer(99, 1).reply, /doce libros/);
  assert.match(passageAnswer(9, 99).reply, /tiene 43 párrafos/);
  // The longest paragraph is delivered in pages that together reproduce the whole text.
  let longest = { book: 1, paragraph: 1, length: 0 };
  for (let book = 1; book <= 12; book += 1) MEDITATIONS_TEXT[book]!.forEach((text, i) => { if (text.length > longest.length) longest = { book, paragraph: i + 1, length: text.length }; });
  const first = passageAnswer(longest.book, longest.paragraph);
  assert.ok(first.reply.length <= REPLY_LIMIT);
  if (longest.length > REPLY_LIMIT - 560) {
    assert.match(first.reply, /El párrafo continúa/);
    assert.match(passageAnswer(longest.book, longest.paragraph, REPLY_LIMIT - 560).reply, /…/);
  }
});

test('every answer fits the display limit, is never truncated and carries its basis line', () => {
  const answers = [
    overviewAnswer(), historyAnswer(), timelineAnswer(), originsAnswer(''), doctrineAnswer(''), psychologyAnswer(''), practiceAnswer(''),
    glossaryAnswer(''), limitsAnswer(),
    ...FIGURES.map((figure) => figureAnswer(figure.name)),
    ...DOCTRINE.map((topic) => doctrineAnswer(topic.keywords[0]!)),
    ...ORIGINS.map((episode) => originsAnswer(episode.keywords[0]!)),
    ...PSYCHOLOGY.map((link) => psychologyAnswer(link.keywords[0]!)),
    ...PRACTICES.map((practice) => practiceAnswer(practice.keywords[0]!)),
    searchAnswer('muerte'), searchAnswer('xyzzyplugh'),
  ];
  for (const item of answers) {
    assert.ok(item.reply.length <= REPLY_LIMIT, `${item.topic} reply is ${item.reply.length} chars`);
    assert.doesNotMatch(item.reply, /recortado/, `${item.topic} reply must not be truncated: ${item.reply.slice(0, 60)}`);
    assert.match(item.reply, /Base: /);
  }
});

test('history: phases, figures and timeline are coherent and carry bases', () => {
  const ids = new Set(FIGURES.map((figure) => figure.id));
  assert.equal(ids.size, FIGURES.length, 'unique figure ids');
  for (const phase of PHASES) for (const id of phase.figureIds) assert.ok(ids.has(id), `${phase.id} references ${id}`);
  for (const figure of FIGURES) {
    assert.ok(figure.basis && figure.dates && figure.role.length > 20, figure.id);
    for (const source of figure.sourceIds ?? []) assert.ok(SOURCES.some((candidate) => candidate.id === source), `${figure.id} source ${source}`);
  }
  const years = TIMELINE.map((entry) => entry.year);
  assert.deepEqual(years, [...years].sort((a, b) => a - b), 'timeline is chronological');
  const zeno = figureAnswer('¿Quién fue Zenón de Citio?').reply;
  assert.match(zeno, /Stoa Poikil/);
  assert.match(zeno, /Crates/);
  assert.match(zeno, /fechas de consenso, no recomprobadas/);
  assert.match(historyAnswer().reply, /Estoa antigua/);
  assert.match(historyAnswer().reply, /solo fragmentos/);
  // «Crates» must not be confused with «Sócrates».
  assert.match(figureAnswer('Sócrates').reply, /Sócrates/);
  assert.doesNotMatch(figureAnswer('Sócrates').reply, /Crates de Tebas/);
});

test('origins of Greco-Roman philosophy: overview and episodes', () => {
  const overview = originsAnswer('orígenes de la filosofía grecorromana');
  assert.match(overview.reply, /Jonia/);
  assert.match(overview.reply, /helenística/);
  assert.match(originsAnswer('Sócrates').reply, /470\/469–399/);
  assert.match(originsAnswer('época helenística').reply, /Epicuro/);
  assert.match(originsAnswer('Roma y Cicerón').reply, /Panecio/);
  assert.equal(ORIGINS.every((episode) => episode.basis === 'consensus-unverified'), true, 'episodes carry the weakest basis of their claims');
});

test('doctrine, practices and glossary answer by topic', () => {
  assert.match(doctrineAnswer('dicotomía del control').reply, /Epicteto/);
  assert.match(doctrineAnswer('asentimiento').reply, /cilindro/);
  assert.match(doctrineAnswer('tres partes lógica física ética').reply, /huevo/);
  assert.match(doctrineAnswer('').reply, /temas disponibles/);
  assert.match(practiceAnswer('ejercicio de la mañana').reply, /No es un tratamiento clínico/);
  assert.match(practiceAnswer('vista desde arriba').reply, /autodistanciamiento/);
  assert.match(glossaryAnswer('eudaimonia').reply, /εὐδαιμονία/);
  assert.ok(GLOSSARY.length >= 15);
  // The popular misquotation must not be presented as Marcus’s own wording.
  const obstacle = PRACTICES.find((practice) => practice.id === 'obstacle-as-task')!;
  assert.match(obstacle.origin, /NO es textual/);
});

test('psychology answers always keep the three honesty statements and the Melanie wording rules', () => {
  const generic = psychologyAnswer('estoicismo y psicología').reply;
  assert.ok(generic.startsWith('Estoicismo y psicología actual'));
  assert.match(generic, /Sí, hay un vínculo de inspiración/);
  for (const reply of [generic, ...PSYCHOLOGY.map((link) => psychologyAnswer(link.keywords[0]!).reply)]) {
    assert.match(reply, /filosofía de vida, no una terapia/);
    assert.match(reply, /no es lo mismo que la TCC ni su origen/);
    assert.match(reply, /no es terapeuta ni da consejo clínico/);
    assert.match(reply, /profesional/);
    assert.doesNotMatch(reply, /vínculo (directo|profundo)|sí rotundo|un rotundo sí/i);
    assert.doesNotMatch(reply, /el estoicismo es (lo mismo que|el origen de) la (TCC|terapia)/i);
  }
  assert.match(generic, /NO VERIFICADO como eficacia clínica/);
  assert.match(psychologyAnswer('Ellis').reply, /1953/);
  assert.match(psychologyAnswer('Beck').reply, /más tenue/);
  assert.match(psychologyAnswer('qué evidencia hay').reply, /sin grupo de control/);
  assert.match(psychologyAnswer('diferencias con la TCC').reply, /Objetivos distintos/);
  // Parallels are labelled as inference, never as proven derivation.
  const parallels = PSYCHOLOGY.filter((link) => link.kind === 'parallel' && link.basis === 'inference');
  assert.ok(parallels.length >= 5);
  for (const link of parallels) assert.match(link.text, /INFERENCIA/);
  // The evidence link is not upgraded: preliminary, author-affiliated, no control group.
  const evidence = PSYCHOLOGY.find((link) => link.id === 'evidence')!;
  assert.match(evidence.text, /preliminar/);
  assert.match(evidence.text, /vinculado/);
});

test('sources are listed with what was and was not taken from them', () => {
  for (const id of ['sep-stoicism', 'correa-2023', 'joffe-ellis-interview', 'robertson-smrt', 'long-meditations']) {
    const source = SOURCES.find((candidate) => candidate.id === id);
    assert.ok(source, id);
    assert.ok(source.note.length > 80);
  }
  assert.match(SOURCES.find((source) => source.id === 'sep-stoicism')!.note, /NOT stated there/);
  assert.match(SOURCES.find((source) => source.id === 'joffe-ellis-interview')!.note, /Second-hand/);
  assert.match(limitsAnswer().reply, /griego no se consultó/);
});

test('crisis language yields support-first with no philosophy, in the router and in the adapter', async () => {
  const router = askStoicism('quiero morir, háblame de Marco Aurelio libro 4');
  assert.equal(router.mode, 'support_first');
  assert.doesNotMatch(router.reply, /Meditaciones|Libro IV|«/);
  const adapter = new StoicismToolAdapter();
  const viaSearch = await adapter.execute({ tool: 'stoicism', action: 'search.run', input: { query: 'ya no quiero vivir' } }, noop);
  assert.equal(viaSearch.ok, true);
  assert.equal(viaSearch.output?.mode, 'support_first');
  assert.match(String(viaSearch.output?.reply), /servicios de emergencia/);
});

test('the router sends free text to the right answer', () => {
  assert.equal(askStoicism('Resumen del libro 4 de las Meditaciones').topic, 'book');
  assert.equal(askStoicism('pasajes clave del libro 9').topic, 'book');
  assert.match(askStoicism('pasajes clave del libro 9').reply, /pasajes clave/);
  assert.equal(askStoicism('pasaje libro 9 párrafo 31').topic, 'passage');
  assert.equal(askStoicism('busca la muerte en las Meditaciones').topic, 'search');
  assert.equal(askStoicism('Historia del estoicismo').topic, 'history');
  assert.equal(askStoicism('cronología del estoicismo').topic, 'history');
  assert.equal(askStoicism('orígenes de la filosofía grecorromana').topic, 'origins');
  assert.equal(askStoicism('estoicismo y psicología actual').topic, 'psychology');
  assert.equal(askStoicism('¿Qué relación hay entre Ellis y el estoicismo?').topic, 'psychology');
  assert.equal(askStoicism('quién fue Epicteto').topic, 'figure');
  assert.equal(askStoicism('dicotomía del control').topic, 'doctrine');
  assert.equal(askStoicism('ejercicio de la mañana').topic, 'practice');
  assert.equal(askStoicism('glosario estoico').topic, 'glossary');
  assert.equal(askStoicism('fuentes de este conocimiento').topic, 'limits');
  assert.equal(askStoicism('estoicismo').topic, 'overview');
  assert.equal(askStoicism('').topic, 'overview');
});

test('adapter serves the knowledge locally, validates input and rejects unknown actions', async () => {
  const adapter = new StoicismToolAdapter();
  assert.ok(adapter.capabilities.includes('ask') && adapter.capabilities.includes('passage.get'));
  assert.equal(adapter.name, 'stoicism');
  const book = await adapter.execute({ tool: 'stoicism', action: 'book.get', input: { book: 7 } }, noop);
  assert.equal(book.ok, true);
  assert.match(String(book.output?.reply), /Libro VII/);
  assert.equal((await adapter.execute({ tool: 'stoicism', action: 'book.get', input: {} }, noop)).ok, false);
  assert.equal((await adapter.execute({ tool: 'stoicism', action: 'passage.get', input: { book: 9 } }, noop)).ok, false);
  const passage = await adapter.execute({ tool: 'stoicism', action: 'passage.get', input: { book: '9', paragraph: '31' } }, noop);
  assert.match(String(passage.output?.reply), /Look down from above/);
  assert.equal((await adapter.execute({ tool: 'stoicism', action: 'search.run', input: { query: '  ' } }, noop)).ok, false);
  const search = await adapter.execute({ tool: 'stoicism', action: 'search.run', input: { query: 'justicia' } }, noop);
  assert.equal(search.ok, true);
  assert.ok(Array.isArray(search.output?.bases));
  assert.equal((await adapter.execute({ tool: 'stoicism', action: 'figure.get', input: { name: 'Séneca' } }, noop)).ok, true);
  assert.equal((await adapter.execute({ tool: 'stoicism', action: 'mail.send', input: {} }, noop)).ok, false);
  for (const action of ['overview.get', 'history.get', 'timeline.get', 'origins.get', 'doctrine.get', 'psychology.get', 'practice.get', 'glossary.get', 'limits.get']) {
    const result = await adapter.execute({ tool: 'stoicism', action, input: {} }, noop);
    assert.equal(result.ok, true, action);
    assert.ok(String(result.output?.reply).length > 80, action);
  }
});

test('planner routes deep Stoicism requests to the stoicism tool and leaves the existing routes untouched', () => {
  const routed = [
    'Resumen del libro 4 de las Meditaciones',
    'Pasaje libro 9 párrafo 31 de Marco Aurelio',
    'Busca la muerte en las Meditaciones',
    'Historia del estoicismo',
    'Orígenes de la filosofía grecorromana',
    'Estoicismo y psicología',
    '¿Qué relación hay entre Ellis y el estoicismo?',
    'Quién fue Epicteto',
    'Qué es el estoicismo',
    'Dame un ejercicio estoico de la mañana',
  ];
  for (const command of routed) {
    const plan = deterministicPlan(command);
    assert.equal(plan?.steps[0]?.tool, 'stoicism', command);
    assert.equal(plan?.steps[0]?.action, 'ask', command);
    assert.equal(plan?.steps[0]?.requiresApproval, false, command);
    assert.equal(plan?.steps[0]?.risk, 'none', command);
  }
  // Existing behaviour (see lego-marcus-aurelius-wisdom.test.ts) stays as it was.
  assert.equal(deterministicPlan('Cuéntame la vida de Marco Aurelio')?.steps[0]?.tool, 'marcus-aurelius');
  assert.equal(deterministicPlan('Dame una frase de Marco Aurelio')?.steps[0]?.action, 'quote.get');
  assert.equal(deterministicPlan('Estoy agobiado, ayúdame con Marco Aurelio')?.steps[0]?.tool, 'marcus-aurelius');
  assert.equal(deterministicPlan('Compara a Séneca y Marco Aurelio')?.steps[0]?.tool, 'seneca');
  assert.equal(deterministicPlan('Estoy muy estresado')?.steps[0]?.tool, 'seneca');
  assert.equal(deterministicPlan('Háblame del estoicismo')?.steps[0]?.tool, 'seneca');
  assert.equal(deterministicPlan('Dame un ejercicio estoico para el estrés')?.steps[0]?.tool, 'seneca');
  assert.equal(deterministicPlan('Hola, ¿qué tal?'), null);
});

test('the stoicism tool is personal-use only: it is not in the household-safe tool list', () => {
  assert.ok(!HOUSEHOLD_SAFE_TOOLS.includes('stoicism'));
  assert.ok(HOUSEHOLD_SAFE_TOOLS.includes('seneca') && HOUSEHOLD_SAFE_TOOLS.includes('marcus-aurelius'));
});
