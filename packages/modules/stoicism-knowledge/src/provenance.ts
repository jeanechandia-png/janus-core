import type { SourceRef } from './types.js';

/** Where the full text of the Meditations in this module comes from. */
export const TEXT_PROVENANCE = Object.freeze({
  work: 'Meditations (Greek: Ta eis heauton, «A sí mismo»)',
  author: 'Marcus Aurelius Antoninus (121–180), emperor 161–180',
  translator: 'George Long (translated 1862)',
  translatorLicense: 'Public domain (translator died 1879). The Standard Ebooks edition is dedicated to the public domain through CC0 1.0.',
  edition: 'Standard Ebooks, «Meditations», George Long',
  editionUrl: 'https://standardebooks.org/ebooks/marcus-aurelius/meditations/george-long',
  repository: 'https://github.com/standardebooks/marcus-aurelius_meditations_george-long',
  repositoryCommit: '3a47d37d9f1df94de235d53839f4b254ce2953d5',
  repositoryCommitDate: '2026-09-07',
  readOn: '2026-10-28',
  basedOn: 'Transcription by The Internet Classics Archive (classics.mit.edu) and scans from Google Books',
  books: 12,
  language: 'English (British spelling). The Greek was NOT consulted.',
  numberingNote:
    'Paragraph numbers in this module are positions inside the edition. The edition keeps quoted verse and colophon lines as paragraphs of their own, ' +
    'so they may differ from the standard book.section numbers used in other editions. Always say «párrafo de la edición» unless the standard number has been checked.',
  casaubonNote:
    'The earlier modules and the written chat translate from Casaubon (1634, Project Gutenberg #2680). Long (1862) is the reference for this module and for the book numbers.',
});

/** Public sources actually consulted while writing the knowledge below (2026-10-28). */
export const SOURCES: readonly SourceRef[] = [
  {
    id: 'sep-stoicism',
    title: 'Stanford Encyclopedia of Philosophy — «Stoicism»',
    url: 'https://plato.stanford.edu/entries/stoicism/',
    accessed: '2026-10-28',
    note:
      'Used for: founder and date (Zeno of Citium, around 300 BCE, studied under the Cynic Crates), the Stoa Poikile, Old Stoa / Middle Stoicism / Imperial era, ' +
      'the three parts (logic, physics, ethics) and their images, virtue as the only good, indifferents and preferred indifferents, passions and good feelings, assent, ' +
      'oikeiosis, cosmopolitanism, determinism and providence, periodic conflagrations, what survives (only fragments of the early Stoics; Seneca, Epictetus and Marcus survive in full), ' +
      'Cicero and Panaetius, Christian reception, Lipsius as the leading Neo-Stoic, Prantl (1855) and Bobzien (2021) on Stoic logic and Frege. ' +
      'NOT stated there: Ellis, Beck, cognitive therapy, modern Stoicism.',
  },
  {
    id: 'correa-2023',
    title: 'Corrêa, M. A. (2023), «From Ancient Greece to the Modern Clinic: an analysis of Stoic influences on Ellis and Beck’s cognitive therapies», Límite 18',
    url: 'https://revistaschilenas.uchile.cl/handle/2250/242710?show=full',
    accessed: '2026-10-28',
    note:
      'Only the abstract was read. It says both Ellis and Beck point to Stoicism, that parallels are more pronounced in Ellis, and that the paper asks whether the link was inspiration or deliberate adaptation. ' +
      'The suggestion that the main affinity is the Stoic «cataleptic impression» is the paper’s own proposal, not an established finding.',
  },
  {
    id: 'joffe-ellis-interview',
    title: 'Modern Stoicism — «Rational Emotive Behavior Therapy and Stoicism: an interview with Debbie Joffe Ellis»',
    url: 'https://modernstoicism.com/?p=6348',
    accessed: '2026-10-28',
    note:
      'Second-hand: Ellis’s widow says REBT was influenced by the Stoic philosophers, that Ellis acknowledged it when speaking and writing, ' +
      'and dates his first paper on «rational therapy» to 1953 (published 1955). The interviewer remarks that the lineage to Stoicism is clearer for Ellis than for Beck. ' +
      'No direct quotation from Ellis was found on the page.',
  },
  {
    id: 'robertson-smrt',
    title: 'Donald Robertson — «Research on Stoic Mindfulness and Resilience Training (SMRT)»',
    url: 'https://donaldrobertson.name/2020/04/12/stoicism-and-psychological-resilience-2/',
    accessed: '2026-10-28',
    note:
      'The author calls the evidence preliminary: pilot studies without control groups (an online four-week course; about 500 participants in 2014, over 900 in a 2017 follow-up), ' +
      'with the author’s own scale; Stoic Week data are from «many thousands» of participants since about 2012 with no controlled design described. ' +
      'The author is a founding member of Modern Stoicism, so the source is connected to the programmes it evaluates.',
  },
  {
    id: 'long-meditations',
    title: 'Marcus Aurelius, Meditations, translated by George Long (Standard Ebooks edition)',
    url: 'https://standardebooks.org/ebooks/marcus-aurelius/meditations/george-long',
    accessed: '2026-10-28',
    note: 'Primary text of the whole work; read in full. Every digest excerpt is checked as an exact substring of its paragraph.',
  },
];

export function getSource(id: string): SourceRef | undefined {
  return SOURCES.find((source) => source.id === id);
}
