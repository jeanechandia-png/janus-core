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