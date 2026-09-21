export type QualityDimension =
  | 'coherence'
  | 'structural'
  | 'visual'
  | 'architectural'
  | 'orthographic'
  | 'synthesis';

export type FindingSeverity = 'info' | 'warning' | 'error';

export interface DeliveryArtifact {
  id: string;
  kind: 'text' | 'document' | 'code' | 'ui' | 'plan' | 'other';
  content: string;
  metadata?: Record<string, unknown>;
}

export interface QualityFinding {
  code: string;
  message: string;
  severity: FindingSeverity;
}

export interface QualityReview {
  dimension: QualityDimension;
  passed: boolean;
  findings: QualityFinding[];
  reviewer: string;
  checkedAt: string;
}

export interface QualityReviewer {
  readonly dimension: QualityDimension;
  readonly name: string;
  review(artifact: DeliveryArtifact): Promise<QualityFinding[]>;
}

export interface DeliveryGateResult {
  passed: boolean;
  artifactId: string;
  reviews: QualityReview[];
  blockingFindings: QualityFinding[];
}

const DEFAULT_DIMENSIONS: QualityDimension[] = [
  'coherence',
  'structural',
  'visual',
  'architectural',
  'orthographic',
  'synthesis',
];

export class DeliveryGate {
  private readonly reviewers = new Map<QualityDimension, QualityReviewer>();
  private readonly required: QualityDimension[];
  private readonly now: () => Date;

  constructor(
    reviewers: QualityReviewer[],
    options: {
      required?: QualityDimension[];
      now?: () => Date;
    } = {},
  ) {
    for (const reviewer of reviewers) {
      if (this.reviewers.has(reviewer.dimension)) {
        throw new Error(`duplicate quality reviewer for ${reviewer.dimension}`);
      }
      this.reviewers.set(reviewer.dimension, reviewer);
    }
    this.required = options.required ?? DEFAULT_DIMENSIONS;
    this.now = options.now ?? (() => new Date());
  }

  async evaluate(artifact: DeliveryArtifact): Promise<DeliveryGateResult> {
    if (!artifact.id.trim()) throw new Error('artifact id is required');
    if (!artifact.content.trim()) throw new Error('artifact content is required');

    const reviews: QualityReview[] = [];
    for (const dimension of this.required) {
      const reviewer = this.reviewers.get(dimension);
      if (!reviewer) {
        reviews.push({
          dimension,
          passed: false,
          reviewer: 'missing',
          checkedAt: this.now().toISOString(),
          findings: [{
            code: 'reviewer.missing',
            message: `No reviewer is configured for required dimension: ${dimension}`,
            severity: 'error',
          }],
        });
        continue;
      }

      const findings = await reviewer.review(artifact);
      reviews.push({
        dimension,
        findings,
        reviewer: reviewer.name,
        checkedAt: this.now().toISOString(),
        passed: !findings.some((finding) => finding.severity === 'error'),
      });
    }

    const blockingFindings = reviews.flatMap((review) =>
      review.findings.filter((finding) => finding.severity === 'error'),
    );

    return {
      passed: reviews.every((review) => review.passed),
      artifactId: artifact.id,
      reviews,
      blockingFindings,
    };
  }

  async assertDeliverable(artifact: DeliveryArtifact): Promise<DeliveryGateResult> {
    const result = await this.evaluate(artifact);
    if (!result.passed) {
      throw new Error(
        `delivery gate rejected artifact ${artifact.id}: ${result.blockingFindings.map((item) => item.code).join(', ')}`,
      );
    }
    return result;
  }
}
