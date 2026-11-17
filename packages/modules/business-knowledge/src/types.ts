export type KnowledgeKind = 'product' | 'team-member' | 'faq' | 'instruction' | 'policy';
export type Visibility = 'public' | 'internal';
export type Billing = 'one-off' | 'monthly' | 'yearly' | 'per-unit';
export type Audience = 'public' | 'internal';

export interface KnowledgeEntry {
  /** `${kind}:${slug}`; estable, único. */
  key: string;
  kind: KnowledgeKind;
  /** Nombre del producto/persona, pregunta de la FAQ, título de la instrucción o política. */
  title: string;
  /** Descripción, biografía, respuesta, texto de la instrucción o política. */
  body?: string;
  /** Solo equipo. */
  role?: string;
  /** Solo productos: céntimos de euro. */
  priceCents?: number;
  /** Solo productos: el precio ya incluye IVA (por defecto no). */
  priceIncludesVat?: boolean;
  billing?: Billing;
  visibility: Visibility;
  active: boolean;
  createdAtRevision: number;
  updatedAtRevision: number;
}

export interface KnowledgeState {
  schema: 'infinity.business-knowledge.state/v1';
  revision: number;
  currency: 'EUR';
  defaultVatPercent: number | null;
  entries: Record<string, KnowledgeEntry>;
}

export interface EntryInput {
  kind: KnowledgeKind;
  title: string;
  body?: string;
  role?: string;
  priceCents?: number;
  priceIncludesVat?: boolean;
  billing?: Billing;
  visibility?: Visibility;
}

export type KnowledgeChange =
  | { op: 'upsert'; entry: EntryInput }
  | { op: 'set-price'; key: string; priceCents: number; priceIncludesVat?: boolean }
  | { op: 'retire'; key: string }
  | { op: 'set-default-vat'; percent: number };

export interface KnowledgeProposal {
  id: string;
  changes: KnowledgeChange[];
  source: 'voice' | 'chat' | 'api';
  /** Frase original (ya sin secretos) para auditoría. */
  utterance?: string;
  createdAt: string;
  expiresAt: string;
  /** Revisión del estado sobre el que se calculó la lectura de confirmación. */
  baseRevision: number;
}

export interface KnowledgeRevision {
  revision: number;
  parentRevision: number;
  at: string;
  changes: KnowledgeChange[];
  proposalId?: string;
  /** Referencia de la aprobación (hash de decisión de autoridad, id de aprobación…). Obligatoria. */
  approvalRef: string;
  approvedBy: string;
  /** SHA-256 del estado resultante. */
  stateChecksum: string;
  parentStateChecksum: string;
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; code: ValidationCode; message: string };
export type ValidationCode =
  | 'invalid_title'
  | 'invalid_text'
  | 'risky_text'
  | 'invalid_price'
  | 'invalid_vat'
  | 'unknown_key'
  | 'not_a_product'
  | 'too_many_entries'
  | 'empty_change_set'
  | 'stale_base'
  | 'missing_approval';

export interface SnapshotProduct {
  key: string;
  name: string;
  description?: string;
  priceCents?: number;
  priceFormatted?: string;
  priceIncludesVat: boolean;
  billing?: Billing;
}

export interface KnowledgeSnapshot {
  schema: 'infinity.business-knowledge.snapshot/v1';
  audience: Audience;
  revision: number;
  currency: 'EUR';
  defaultVatPercent: number | null;
  products: SnapshotProduct[];
  team: Array<{ key: string; name: string; role?: string; bio?: string }>;
  faqs: Array<{ key: string; question: string; answer: string }>;
  instructions: Array<{ key: string; title: string; text: string }>;
  policies: Array<{ key: string; title: string; text: string }>;
  /** SHA-256 hexadecimal del contenido canónico (todo lo anterior). */
  checksum: string;
}

export type UnresolvedIntent =
  | { type: 'set-price'; productQuery: string; priceCents: number; priceIncludesVat?: boolean }
  | { type: 'set-vat'; percent: number }
  | { type: 'add-product'; title: string; priceCents?: number; priceIncludesVat?: boolean; billing?: Billing; description?: string }
  | { type: 'add-team-member'; name: string; role?: string }
  | { type: 'add-instruction'; text: string }
  | { type: 'add-faq'; question: string; answer: string }
  | { type: 'retire-product'; productQuery: string };

export type IntentResolution =
  | { ok: true; changes: KnowledgeChange[] }
  | { ok: false; reason: 'not_found' | 'ambiguous' | 'invalid'; message: string; candidates?: Array<{ key: string; title: string }> };
