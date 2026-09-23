export interface WorkflowExpressionContext {
  input?: unknown;
  trigger?: unknown;
  nodes?: Record<string, { output?: unknown; error?: unknown }>;
  vars?: Record<string, unknown>;
  workflow?: Record<string, unknown>;
}

const EXACT_EXPRESSION = /^\s*\{\{\s*([$.A-Za-z0-9_\-]+)\s*\}\}\s*$/;
const INLINE_EXPRESSION = /\{\{\s*([$.A-Za-z0-9_\-]+)\s*\}\}/g;

export function resolveWorkflowValue(value: unknown, context: WorkflowExpressionContext): unknown {
  if (typeof value === 'string') return resolveWorkflowString(value, context);
  if (Array.isArray(value)) return value.map((item) => resolveWorkflowValue(item, context));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        resolveWorkflowValue(item, context),
      ]),
    );
  }
  return value;
}

export function resolveWorkflowString(
  template: string,
  context: WorkflowExpressionContext,
): unknown {
  const exact = template.match(EXACT_EXPRESSION);
  if (exact?.[1]) return resolvePath(exact[1], context);

  return template.replace(INLINE_EXPRESSION, (_match, path: string) =>
    stringifyInline(resolvePath(path, context)),
  );
}

export function resolvePath(path: string, context: WorkflowExpressionContext): unknown {
  if (!path.startsWith('$')) throw new Error('Workflow expression paths must start with $');
  const parts = path.split('.');
  const root = parts.shift();
  let current: unknown;

  switch (root) {
    case '$input':
      current = context.input;
      break;
    case '$trigger':
      current = context.trigger;
      break;
    case '$nodes':
      current = context.nodes;
      break;
    case '$vars':
      current = context.vars;
      break;
    case '$workflow':
      current = context.workflow;
      break;
    default:
      throw new Error(`Unsupported workflow expression root: ${root}`);
  }

  for (const part of parts) {
    if (!part) throw new Error(`Invalid workflow expression path: ${path}`);
    if (current == null) return undefined;
    if (Array.isArray(current)) {
      if (!/^\d+$/.test(part)) throw new Error(`Array path segment must be numeric: ${part}`);
      current = current[Number(part)];
      continue;
    }
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function stringifyInline(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}
