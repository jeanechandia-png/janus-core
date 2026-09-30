import { createHash } from 'node:crypto';

export type ReusableLibraryKind =
  | 'symbol'
  | 'photo'
  | 'logo'
  | 'icon'
  | 'button'
  | 'font'
  | 'design_token'
  | 'theme'
  | 'component'
  | 'module'
  | 'template'
  | 'workflow'
  | 'prompt'
  | 'other';

export type ReusableLibraryStatus = 'draft' | 'current' | 'historical' | 'deprecated';

export interface ReusableDependencyRef {
  itemId: string;
  revision?: number;
  optional?: boolean;
}

export interface ReusableLibraryItem {
  id: string;
  revision: number;
  status: ReusableLibraryStatus;
  kind: ReusableLibraryKind;
  name: string;
  description?: string;
  createdAt: string;
  createdBy: string;
  supersedesRevision?: number;
  tags: string[];
  compatibility: string[];
  dependencies: ReusableDependencyRef[];
  contentRef?: string;
  previewRef?: string;
  spec?: Record<string, unknown>;
  checksum: string;
}

export interface ReusableLibrarySelection {
  item: ReusableLibraryItem;
  dependencyItems: ReusableLibraryItem[];
}

export function createReusableLibraryItem(
  input: Omit<ReusableLibraryItem, 'checksum' | 'tags' | 'compatibility' | 'dependencies'> & {
    tags?: readonly string[];
    compatibility?: readonly string[];
    dependencies?: readonly ReusableDependencyRef[];
  },
): ReusableLibraryItem {
  validateBase(input);
  const normalized = {
    ...input,
    id: input.id.trim(),
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    createdBy: input.createdBy.trim(),
    tags: cleanStrings(input.tags ?? []),
    compatibility: cleanStrings(input.compatibility ?? []),
    dependencies: normalizeDependencies(input.dependencies ?? []),
    contentRef: input.contentRef?.trim() || undefined,
    previewRef: input.previewRef?.trim() || undefined,
    spec: input.spec ? structuredClone(input.spec) : undefined,
  };
  const checksum = createHash('sha256').update(stableJson({
    id: normalized.id,
    revision: normalized.revision,
    kind: normalized.kind,
    name: normalized.name,
    description: normalized.description ?? null,
    createdAt: normalized.createdAt,
    createdBy: normalized.createdBy,
    supersedesRevision: normalized.supersedesRevision ?? null,
    tags: normalized.tags,
    compatibility: normalized.compatibility,
    dependencies: normalized.dependencies,
    contentRef: normalized.contentRef ?? null,
    previewRef: normalized.previewRef ?? null,
    spec: normalized.spec ?? null,
  })).digest('hex');
  return { ...normalized, checksum };
}

export function verifyReusableLibraryItem(item: ReusableLibraryItem): boolean {
  const recreated = createReusableLibraryItem({
    id: item.id,
    revision: item.revision,
    status: item.status,
    kind: item.kind,
    name: item.name,
    description: item.description,
    createdAt: item.createdAt,
    createdBy: item.createdBy,
    supersedesRevision: item.supersedesRevision,
    tags: item.tags,
    compatibility: item.compatibility,
    dependencies: item.dependencies,
    contentRef: item.contentRef,
    previewRef: item.previewRef,
    spec: item.spec,
  });
  return recreated.checksum === item.checksum;
}

export function resolveReusableSelection(input: {
  itemId: string;
  items: readonly ReusableLibraryItem[];
  revision?: number;
}): ReusableLibrarySelection {
  const byKey = new Map<string, ReusableLibraryItem>();
  for (const item of input.items) {
    if (!verifyReusableLibraryItem(item)) {
      throw new Error(`reusable library checksum mismatch: ${item.id}@${item.revision}`);
    }
    byKey.set(key(item.id, item.revision), item);
  }

  const root = input.revision == null
    ? latestCurrent(input.items.filter((item) => item.id === input.itemId))
    : byKey.get(key(input.itemId, input.revision));
  if (!root) throw new Error(`reusable library item not found: ${input.itemId}`);

  const dependencyItems: ReusableLibraryItem[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (item: ReusableLibraryItem) => {
    const itemKey = key(item.id, item.revision);
    if (visiting.has(itemKey)) throw new Error(`reusable dependency cycle: ${itemKey}`);
    if (visited.has(itemKey)) return;
    visiting.add(itemKey);

    for (const dependency of item.dependencies) {
      const resolved = dependency.revision == null
        ? latestCurrent(input.items.filter((candidate) => candidate.id === dependency.itemId))
        : byKey.get(key(dependency.itemId, dependency.revision));
      if (!resolved) {
        if (dependency.optional) continue;
        throw new Error(
          `missing reusable dependency: ${dependency.itemId}`
          + (dependency.revision == null ? '' : `@${dependency.revision}`),
        );
      }
      visit(resolved);
      if (resolved.id !== root.id || resolved.revision !== root.revision) {
        dependencyItems.push(resolved);
      }
    }

    visiting.delete(itemKey);
    visited.add(itemKey);
  };

  visit(root);
  return {
    item: structuredClone(root),
    dependencyItems: dedupeItems(dependencyItems),
  };
}

export function assertReusableRevisionAppendOnly(input: {
  previous?: ReusableLibraryItem;
  next: ReusableLibraryItem;
}): void {
  if (!input.previous) {
    if (input.next.revision !== 1) throw new Error('first reusable revision must be 1');
    return;
  }
  if (input.next.id !== input.previous.id) throw new Error('reusable item id cannot change');
  if (input.next.revision !== input.previous.revision + 1) {
    throw new Error('reusable revision must increment by exactly one');
  }
  if (input.next.supersedesRevision !== input.previous.revision) {
    throw new Error('reusable revision must supersede the previous revision');
  }
  if (input.previous.status === 'historical' || input.previous.status === 'deprecated') {
    throw new Error('cannot supersede an already historical/deprecated revision');
  }
}

function latestCurrent(items: readonly ReusableLibraryItem[]): ReusableLibraryItem | undefined {
  return [...items]
    .filter((item) => item.status === 'current')
    .sort((a, b) => b.revision - a.revision)[0];
}

function validateBase(input: {
  id: string;
  revision: number;
  status: ReusableLibraryStatus;
  kind: ReusableLibraryKind;
  name: string;
  createdAt: string;
  createdBy: string;
}): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(input.id.trim())) {
    throw new Error('reusable item id is invalid');
  }
  if (!Number.isInteger(input.revision) || input.revision < 1) {
    throw new Error('reusable item revision must be a positive integer');
  }
  if (!input.name.trim()) throw new Error('reusable item name is required');
  if (!input.createdBy.trim()) throw new Error('reusable item createdBy is required');
  if (!Number.isFinite(Date.parse(input.createdAt))) throw new Error('reusable item createdAt is invalid');
}

function normalizeDependencies(values: readonly ReusableDependencyRef[]): ReusableDependencyRef[] {
  const result: ReusableDependencyRef[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const itemId = value.itemId.trim();
    if (!itemId) throw new Error('dependency itemId is required');
    if (value.revision != null && (!Number.isInteger(value.revision) || value.revision < 1)) {
      throw new Error('dependency revision must be a positive integer');
    }
    const marker = `${itemId}@${value.revision ?? 'current'}`;
    if (seen.has(marker)) continue;
    seen.add(marker);
    result.push({
      itemId,
      ...(value.revision == null ? {} : { revision: value.revision }),
      ...(value.optional ? { optional: true } : {}),
    });
  }
  return result;
}

function cleanStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

function dedupeItems(items: readonly ReusableLibraryItem[]): ReusableLibraryItem[] {
  const result = new Map<string, ReusableLibraryItem>();
  for (const item of items) result.set(key(item.id, item.revision), item);
  return [...result.values()];
}

function key(id: string, revision: number): string {
  return `${id}@${revision}`;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((keyName) => (
      `${JSON.stringify(keyName)}:${stableJson(record[keyName])}`
    )).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
