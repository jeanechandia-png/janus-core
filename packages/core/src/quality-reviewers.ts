import type {
  DeliveryArtifact,
  QualityDimension,
  QualityFinding,
  QualityReviewer,
} from './delivery-gate.js';

class OfflineQualityReviewer implements QualityReviewer {
  readonly name: string;

  constructor(readonly dimension: QualityDimension) {
    this.name = 'offline-' + dimension + '-v1';
  }

  async review(artifact: DeliveryArtifact): Promise<QualityFinding[]> {
    switch (this.dimension) {
      case 'coherence':
        return coherenceFindings(artifact.content);
      case 'structural':
        return structuralFindings(artifact.content);
      case 'visual':
        return visualFindings(artifact);
      case 'architectural':
        return architecturalFindings(artifact);
      case 'orthographic':
        return orthographicFindings(artifact.content);
      case 'synthesis':
        return synthesisFindings(artifact.content);
      case 'i18n':
        return i18nFindings(artifact);
      case 'style':
        return styleFindings(artifact);
    }
  }
}

export function createOfflineQualityReviewers(): QualityReviewer[] {
  const dimensions: QualityDimension[] = [
    'coherence',
    'structural',
    'visual',
    'architectural',
    'orthographic',
    'synthesis',
  ];
  return dimensions.map((dimension) => new OfflineQualityReviewer(dimension));
}

/** Offline reviewers plus the Founder's i18n and style filters. Use with FOUNDER_REQUIRED_DIMENSIONS. */
export function createFounderQualityReviewers(): QualityReviewer[] {
  return [...createOfflineQualityReviewers(), new OfflineQualityReviewer('i18n'), new OfflineQualityReviewer('style')];
}

const EN_STOP = new Set(['the', 'and', 'is', 'are', 'with', 'for', 'that', 'this', 'from', 'your', 'you', 'will', 'have', 'not', 'but']);
const ES_STOP = new Set(['el', 'la', 'los', 'las', 'de', 'que', 'y', 'en', 'un', 'una', 'con', 'para', 'por', 'es', 'del', 'se', 'su', 'no']);

function wordsOf(content: string): string[] {
  return content.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[a-z]+/g) ?? [];
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{\{?\s*([A-Za-z0-9_.]+)\s*\}?\}/g)].map((m) => m[1]!).sort();
}

function i18nFindings(artifact: DeliveryArtifact): QualityFinding[] {
  const findings: QualityFinding[] = [];
  const content = artifact.content;
  if (/Ã[\u0080-\u00BF]|â€[\u0080-\u00BF™œ\u201C\u201D\u2122]|Â[\u00A0-\u00BF]/.test(content)) {
    findings.push(error('i18n.mojibake', 'Broken character encoding (mojibake) detected; accents and symbols would display wrongly.'));
  }
  if (/\[\[\s*(?:TODO|TRANSLATE|MISSING)[^\]]*\]\]|__MISSING__|\bTODO:?\s*translat/i.test(content)) {
    findings.push(error('i18n.untranslated-marker', 'An untranslated or missing-translation marker remains in the output.'));
  }
  if (artifact.kind === 'ui' && /<html(?![^>]*\blang=)/i.test(content)) {
    findings.push(error('i18n.missing-lang', 'The HTML document does not declare its language (<html lang="…">).'));
  }
  const catalogs = artifact.metadata?.catalogs;
  if (catalogs && typeof catalogs === 'object') {
    const entries = Object.entries(catalogs as Record<string, Record<string, unknown>>);
    const source = (artifact.metadata?.sourceLocale as string | undefined) ?? entries[0]?.[0];
    const base = source ? (catalogs as Record<string, Record<string, unknown>>)[source] : undefined;
    if (base) {
      for (const [locale, catalog] of entries) {
        if (locale === source) continue;
        for (const [key, value] of Object.entries(base)) {
          const translated = catalog[key];
          if (typeof translated !== 'string' || !translated.trim()) {
            findings.push(error('i18n.missing-key', `Locale ${locale} is missing translation for "${key}".`));
            continue;
          }
          if (typeof value === 'string' && placeholders(value).join('|') !== placeholders(translated).join('|')) {
            findings.push(error('i18n.placeholder-mismatch', `Locale ${locale} changes the placeholders of "${key}".`));
          }
        }
        for (const key of Object.keys(catalog)) {
          if (!(key in base)) findings.push({ code: 'i18n.extra-key', message: `Locale ${locale} has a key not present in ${source}: "${key}".`, severity: 'warning' });
        }
      }
    }
  }
  const locale = typeof artifact.metadata?.locale === 'string' ? artifact.metadata.locale.slice(0, 2).toLowerCase() : undefined;
  if (locale && artifact.kind !== 'code') {
    const words = wordsOf(content);
    if (words.length >= 40) {
      const en = words.filter((w) => EN_STOP.has(w)).length / words.length;
      const es = words.filter((w) => ES_STOP.has(w)).length / words.length;
      if (locale === 'es' && en > 0.12 && en > es) findings.push({ code: 'i18n.language-mix', message: 'The text is declared Spanish but reads mostly English.', severity: 'warning' });
      if (locale === 'en' && es > 0.12 && es > en) findings.push({ code: 'i18n.language-mix', message: 'The text is declared English but reads mostly Spanish.', severity: 'warning' });
    }
  }
  return findings;
}

/** Style never blocks: it only warns, because fluency and vocabulary are judged by the Founder. */
function styleFindings(artifact: DeliveryArtifact): QualityFinding[] {
  if (artifact.kind === 'code') return [];
  const findings: QualityFinding[] = [];
  const content = artifact.content.replace(/```[\s\S]*?```/g, ' ');
  const words = wordsOf(content);
  if (words.length >= 150) {
    const ttr = new Set(words).size / words.length;
    if (ttr < 0.3) findings.push({ code: 'style.low-lexical-variety', message: 'Vocabulary is repetitive; vary word choice.', severity: 'warning' });
  }
  const sentences = content.split(/(?<=[.!?¡¿])\s+/).map((x) => x.trim()).filter((x) => x.length > 0);
  let run = 1;
  for (let i = 1; i < sentences.length; i += 1) {
    const a = wordsOf(sentences[i - 1]!)[0]; const b = wordsOf(sentences[i]!)[0];
    run = a && a === b ? run + 1 : 1;
    if (run === 3) { findings.push({ code: 'style.repeated-openers', message: 'Three consecutive sentences start with the same word.', severity: 'warning' }); break; }
  }
  const longSentence = sentences.find((sentence) => wordsOf(sentence).length > 45);
  if (longSentence) findings.push({ code: 'style.long-sentence', message: 'A sentence exceeds 45 words; split it for a smoother read.', severity: 'warning' });
  if (words.length > 120 && !/\p{Extended_Pictographic}/u.test(artifact.content) && artifact.kind !== 'ui') {
    findings.push({ code: 'style.no-visual-aid', message: 'Long deliverable without emojis, icons or visual structure; the Founder prefers visual aids.', severity: 'info' });
  }
  return findings;
}

function coherenceFindings(content: string): QualityFinding[] {
  const findings: QualityFinding[] = [];
  if (/^(<<<<<<<|=======|>>>>>>>)/m.test(content)) {
    findings.push(error('coherence.merge-conflict', 'Unresolved merge-conflict markers remain.'));
  }
  if (/\b(?:TBD|TO BE DECIDED)\b/i.test(content)) {
    findings.push(error('coherence.unresolved-decision', 'Unresolved decision marker remains in final output.'));
  }
  return findings;
}

function structuralFindings(content: string): QualityFinding[] {
  const fences = content.match(/```/g)?.length ?? 0;
  if (fences % 2 !== 0) {
    return [error('structural.unbalanced-code-fence', 'Markdown code fences are unbalanced.')];
  }
  return [];
}

function visualFindings(artifact: DeliveryArtifact): QualityFinding[] {
  if (artifact.kind === 'code') return [];
  const paragraphs = artifact.content.split(/\n\s*\n/);
  if (paragraphs.some((paragraph) => paragraph.length > 2200)) {
    return [error('visual.text-wall', 'A paragraph is too dense for a final user-facing artifact.')];
  }
  return [];
}

function architecturalFindings(artifact: DeliveryArtifact): QualityFinding[] {
  const findings: QualityFinding[] = [];
  if (/REPLACE_WITH|\/ABSOLUTE\/LOCAL\/PATH/.test(artifact.content)) {
    findings.push(error('architectural.placeholder', 'Unresolved implementation placeholder remains.'));
  }
  if (artifact.kind === 'code' && /(?:api[_-]?key|token|password)\s*[:=]\s*['\"][^'\"]+['\"]/i.test(artifact.content)) {
    findings.push(error('architectural.inline-secret', 'Possible inline secret detected in code output.'));
  }
  return findings;
}

function orthographicFindings(content: string): QualityFinding[] {
  const findings: QualityFinding[] = [];
  if (/[^\S\r\n]{3,}/.test(content)) {
    findings.push({
      code: 'orthographic.excess-spacing',
      message: 'Excessive repeated spaces detected.',
      severity: 'warning',
    });
  }
  if (/([!?.,])\1{3,}/.test(content)) {
    findings.push(error('orthographic.repeated-punctuation', 'Excessive repeated punctuation detected.'));
  }
  return findings;
}

function synthesisFindings(content: string): QualityFinding[] {
  const normalizedParagraphs = content
    .split(/\n\s*\n/)
    .map((value) => value.trim().toLowerCase().replace(/\s+/g, ' '))
    .filter((value) => value.length >= 40);
  const seen = new Set<string>();
  for (const paragraph of normalizedParagraphs) {
    if (seen.has(paragraph)) {
      return [error('synthesis.duplicate-paragraph', 'A substantial paragraph is duplicated verbatim.')];
    }
    seen.add(paragraph);
  }
  return [];
}

function error(code: string, message: string): QualityFinding {
  return { code, message, severity: 'error' };
}