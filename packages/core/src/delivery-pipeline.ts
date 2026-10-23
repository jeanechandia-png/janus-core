import { createHash } from 'node:crypto';
import type { DeliveryArtifact, DeliveryGate, DeliveryGateResult } from './delivery-gate.js';

/**
 * Founder delivery norm (2026-10-21), enforced as a state machine:
 *
 *   draft -> filters pass 1 -> filters pass 2 (independent re-pass) -> NAVIGABLE preview
 *         -> Founder decision (the Founder qualifies, never Janus) -> package (zip/pdf/docx…)
 *
 * Packaging before an approved preview is impossible. Any change to the content resets the pipeline.
 * Preview must be navigable (not a static picture/PDF) and mobile-ready: the Founder works from an iPhone.
 */
export type PipelineStage =
  | 'drafted' | 'filters_failed' | 'filters_passed' | 'rechecked' | 'preview_ready' | 'approved' | 'changes_requested' | 'packaged';

export interface PipelineEvent { at: string; stage: PipelineStage; detail: string }

export interface PipelineState {
  artifactId: string;
  contentHash: string;
  stage: PipelineStage;
  pass1?: DeliveryGateResult;
  pass2?: DeliveryGateResult;
  previewHash?: string;
  decision?: { approved: boolean; by: string; note?: string; at: string };
  packaged?: { format: string; at: string };
  history: PipelineEvent[];
}

export interface PreviewInput { html: string }
export interface PreviewCheck { ok: boolean; problems: string[] }

export class PipelineError extends Error {
  constructor(message: string, readonly code: string) { super(message); this.name = 'PipelineError'; }
}

const sha = (text: string) => createHash('sha256').update(text).digest('hex');

/** A preview is navigable when it is an HTML document with real navigation/interaction, and mobile-ready. */
export function checkPreview(html: string): PreviewCheck {
  const problems: string[] = [];
  if (!/<html[\s>]/i.test(html) || !/<body[\s>]/i.test(html)) problems.push('preview.not-a-document: the preview must be a complete HTML document.');
  if (!/<meta[^>]+name=["']viewport["']/i.test(html)) problems.push('preview.not-mobile-ready: missing viewport meta; the Founder reviews from an iPhone.');
  const anchors = [...html.matchAll(/<a\s[^>]*href=["']#([^"']+)["']/gi)].map((m) => m[1]!);
  const targets = anchors.filter((id) => new RegExp(`id=["']${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`).test(html));
  const hasNav = /<nav[\s>]/i.test(html) && targets.length >= 2;
  const hasInteraction = /<button[\s>]/i.test(html) && /<script[\s>]/i.test(html);
  const hasTabs = /role=["']tab/i.test(html) || /<details[\s>]/i.test(html);
  if (!(hasNav || hasInteraction || hasTabs)) problems.push('preview.static: the preview is not navigable (needs a nav with working in-page links, tabs/details, or buttons with script).');
  if (/<(?:embed|object)[^>]+(?:pdf|application\/pdf)/i.test(html) && !(hasNav || hasInteraction || hasTabs)) problems.push('preview.pdf-only: a PDF embed is a static preview.');
  return { ok: problems.length === 0, problems };
}

export class DeliveryPipeline {
  private readonly now: () => Date;

  constructor(
    private readonly gate: DeliveryGate,
    private readonly options: { founderPrincipalId: string; now?: () => Date },
  ) {
    if (!options.founderPrincipalId.trim()) throw new Error('founderPrincipalId is required');
    this.now = options.now ?? (() => new Date());
  }

  private event(state: PipelineState, stage: PipelineStage, detail: string): PipelineState {
    return { ...state, stage, history: [...state.history, { at: this.now().toISOString(), stage, detail }] };
  }

  /** Filters, pass 1. */
  async submit(artifact: DeliveryArtifact): Promise<PipelineState> {
    const base: PipelineState = { artifactId: artifact.id, contentHash: sha(artifact.content), stage: 'drafted', history: [] };
    const pass1 = await this.gate.evaluate(artifact);
    const state = { ...base, pass1 };
    return pass1.passed
      ? this.event(state, 'filters_passed', 'Filters pass 1 OK')
      : this.event(state, 'filters_failed', `Filters pass 1 failed: ${pass1.blockingFindings.map((f) => f.code).join(', ')}`);
  }

  /** Independent re-pass on the exact same content. If the content changed, the pipeline restarts. */
  async recheck(state: PipelineState, artifact: DeliveryArtifact): Promise<PipelineState> {
    if (state.stage !== 'filters_passed') throw new PipelineError(`Cannot re-check from stage ${state.stage}`, 'pipeline.stage');
    if (sha(artifact.content) !== state.contentHash) throw new PipelineError('Content changed after pass 1; submit again from the start', 'pipeline.content-changed');
    const pass2 = await this.gate.evaluate(artifact);
    const next = { ...state, pass2 };
    return pass2.passed
      ? this.event(next, 'rechecked', 'Filters pass 2 OK')
      : this.event(next, 'filters_failed', `Filters pass 2 failed: ${pass2.blockingFindings.map((f) => f.code).join(', ')}`);
  }

  /** Navigable preview, only after both passes. */
  attachPreview(state: PipelineState, preview: PreviewInput): PipelineState {
    if (state.stage !== 'rechecked') throw new PipelineError(`A preview requires both filter passes (stage: ${state.stage})`, 'pipeline.stage');
    const check = checkPreview(preview.html);
    if (!check.ok) throw new PipelineError(check.problems.join(' '), 'pipeline.preview-invalid');
    return this.event({ ...state, previewHash: sha(preview.html) }, 'preview_ready', 'Navigable preview ready for the Founder');
  }

  /** Only the Founder decides. Janus cannot approve its own work. */
  decide(state: PipelineState, decision: { approved: boolean; by: string; note?: string }): PipelineState {
    if (state.stage !== 'preview_ready') throw new PipelineError(`A decision requires a ready preview (stage: ${state.stage})`, 'pipeline.stage');
    if (decision.by !== this.options.founderPrincipalId) throw new PipelineError('Only the Founder can approve or reject a delivery', 'pipeline.not-founder');
    const at = this.now().toISOString();
    const next: PipelineState = { ...state, decision: { approved: decision.approved, by: decision.by, at, ...(decision.note ? { note: decision.note } : {}) } };
    return decision.approved ? this.event(next, 'approved', 'Founder approved the preview') : this.event(next, 'changes_requested', `Founder requested changes${decision.note ? `: ${decision.note}` : ''}`);
  }

  /**
   * Zip/PDF/DOCX packaging is allowed only after approval, with the same content that was reviewed, and with
   * easy-download delivery: a direct file plus the same text inline, never links only.
   * POR CONFIRMAR: this is the reading of «no enlaces, fácil descarga, el mismo texto».
   */
  authorizePackage(state: PipelineState, request: { format: string; artifact: DeliveryArtifact; inlineText: string; directFile: boolean }): PipelineState {
    if (state.stage !== 'approved') throw new PipelineError(`Packaging requires Founder approval of a navigable preview (stage: ${state.stage})`, 'pipeline.stage');
    if (sha(request.artifact.content) !== state.contentHash) throw new PipelineError('The content differs from what the Founder approved', 'pipeline.content-changed');
    if (!request.directFile) throw new PipelineError('Deliver the file directly (not only a link)', 'pipeline.link-only');
    if (!request.inlineText.trim()) throw new PipelineError('Include the same text inline as an easy-copy option', 'pipeline.no-inline-text');
    return this.event({ ...state, packaged: { format: request.format, at: this.now().toISOString() } }, 'packaged', `Packaged as ${request.format}`);
  }
}
