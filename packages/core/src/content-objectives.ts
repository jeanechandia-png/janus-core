/**
 * Multi-objective content rule + reusable SaaS packaging (Requisito 4).
 *
 * Every generated content/marketing piece must serve FOUR objectives at once:
 *   1. client value, 2. InfinitySeed Group promotion, 3. the main product,
 *   4. visibility for a rotating partner/promotion.
 * `checkContentObjectives` is deterministic and checks for declared evidence in
 * the piece (it is a structural gate, not a judgement of quality).
 */
import { createHash } from 'node:crypto';

export type ContentObjective = 'client_value' | 'infinityseed_promotion' | 'main_product' | 'partner_visibility';

export interface RotatingPartner {
  id: string;
  name: string;
  /** Terms that evidence the partner is visibly present in the piece. */
  markers: readonly string[];
  active: boolean;
}

export interface ContentObjectiveContext {
  /** Terms evidencing concrete value for the client (offer, how-to, result, savings...). */
  clientValueMarkers: readonly string[];
  mainProductMarkers: readonly string[];
  brandMarkers?: readonly string[];
  partners: readonly RotatingPartner[];
  /** Deterministic rotation index (e.g. ISO week number). */
  rotationIndex: number;
}

export interface ContentObjectiveReport {
  satisfied: ContentObjective[];
  missing: ContentObjective[];
  partnerInRotation?: string;
  ok: boolean;
}

const DEFAULT_BRAND_MARKERS = ['infinityseed', 'infinity seed'] as const;

export function selectRotatingPartner(
  partners: readonly RotatingPartner[],
  rotationIndex: number,
): RotatingPartner | undefined {
  const active = partners.filter((partner) => partner.active).sort((a, b) => a.id.localeCompare(b.id));
  if (active.length === 0) return undefined;
  const index = ((Math.trunc(rotationIndex) % active.length) + active.length) % active.length;
  return active[index];
}

export function checkContentObjectives(content: string, context: ContentObjectiveContext): ContentObjectiveReport {
  const text = content.toLowerCase();
  const has = (markers: readonly string[]) => markers.some((marker) => marker.trim() && text.includes(marker.toLowerCase()));
  const partner = selectRotatingPartner(context.partners, context.rotationIndex);

  const checks: Array<[ContentObjective, boolean]> = [
    ['client_value', has(context.clientValueMarkers)],
    ['infinityseed_promotion', has(context.brandMarkers ?? DEFAULT_BRAND_MARKERS)],
    ['main_product', has(context.mainProductMarkers)],
    // No active partner in rotation => nothing to promote; objective is vacuously met.
    ['partner_visibility', partner ? has(partner.markers) : true],
  ];
  const satisfied = checks.filter(([, ok]) => ok).map(([objective]) => objective);
  const missing = checks.filter(([, ok]) => !ok).map(([objective]) => objective);
  return {
    satisfied,
    missing,
    ...(partner ? { partnerInRotation: partner.id } : {}),
    ok: missing.length === 0,
  };
}

export const CONTENT_OBJECTIVE_GUIDANCE: Readonly<Record<ContentObjective, string>> = Object.freeze({
  client_value: 'Aporta valor concreto al cliente (qué gana, cómo, en cuánto tiempo).',
  infinityseed_promotion: 'Menciona a InfinitySeed Group de forma natural y verificable.',
  main_product: 'Impulsa el producto principal vigente con una llamada a la acción clara.',
  partner_visibility: 'Da visibilidad al socio o promoción en rotación sin desplazar al cliente.',
});

export function buildObjectivePromptBlock(context: ContentObjectiveContext): string {
  const partner = selectRotatingPartner(context.partners, context.rotationIndex);
  const lines = (Object.keys(CONTENT_OBJECTIVE_GUIDANCE) as ContentObjective[])
    .filter((objective) => objective !== 'partner_visibility' || partner)
    .map((objective, index) => `${index + 1}. ${CONTENT_OBJECTIVE_GUIDANCE[objective]}${objective === 'partner_visibility' && partner ? ` Socio en rotación: ${partner.name}.` : ''}`);
  return ['Esta pieza debe cumplir a la vez estos objetivos:', ...lines].join('\n');
}

/** Reusable, packageable asset manifest for future SaaS products. */
export interface SaasAssetPackageInput {
  id: string;
  name: string;
  version: string;
  kind: 'template' | 'module' | 'workflow' | 'prompt' | 'component';
  files: ReadonlyArray<{ path: string; content: string }>;
  dependencies?: readonly string[];
  /** Placeholders the consuming product must fill (tenant name, colors, ...). */
  parameters?: readonly string[];
  license?: string;
}

export interface SaasAssetPackage {
  schema: 'janus.asset-package/v1';
  id: string;
  name: string;
  version: string;
  kind: SaasAssetPackageInput['kind'];
  files: Array<{ path: string; sha256: string; bytes: number }>;
  dependencies: string[];
  parameters: string[];
  license: string;
  checksum: string;
}

export function packageSaasAsset(input: SaasAssetPackageInput): SaasAssetPackage {
  if (!input.id.trim() || !input.name.trim()) throw new Error('asset id and name are required');
  if (!/^\d+\.\d+\.\d+$/.test(input.version)) throw new Error('asset version must be semver (x.y.z)');
  if (input.files.length === 0) throw new Error('asset package needs at least one file');
  const paths = new Set<string>();
  const files = input.files.map((file) => {
    if (!file.path.trim() || file.path.startsWith('/') || file.path.split('/').includes('..')) {
      throw new Error(`unsafe asset path: ${file.path}`);
    }
    if (paths.has(file.path)) throw new Error(`duplicate asset path: ${file.path}`);
    paths.add(file.path);
    return {
      path: file.path,
      sha256: createHash('sha256').update(file.content).digest('hex'),
      bytes: Buffer.byteLength(file.content),
    };
  }).sort((a, b) => a.path.localeCompare(b.path));
  const body = {
    schema: 'janus.asset-package/v1' as const,
    id: input.id.trim(),
    name: input.name.trim(),
    version: input.version,
    kind: input.kind,
    files,
    dependencies: [...(input.dependencies ?? [])].sort(),
    parameters: [...(input.parameters ?? [])].sort(),
    license: input.license ?? 'proprietary-infinityseed-group',
  };
  return { ...body, checksum: createHash('sha256').update(JSON.stringify(body)).digest('hex') };
}
