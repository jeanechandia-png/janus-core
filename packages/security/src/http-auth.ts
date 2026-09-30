export function bearerTokenFromAuthorization(
  value: string | readonly string[] | undefined,
): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return undefined;
  const match = raw.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1]?.trim() || undefined;
}

export function isSecureAuthorityTransport(input: {
  remoteAddress?: string;
  forwardedProto?: string | readonly string[];
  trustSecureProxy?: boolean;
}): boolean {
  if (isLoopbackAddress(input.remoteAddress)) return true;
  if (!input.trustSecureProxy) return false;

  const forwarded = Array.isArray(input.forwardedProto)
    ? input.forwardedProto[0]
    : input.forwardedProto;
  const proto = forwarded?.split(',')[0]?.trim().toLowerCase();
  return proto === 'https';
}

export function confirmedActionsFromBody(value: unknown, maxItems = 20): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of value) {
    if (typeof item !== 'string') continue;
    const action = item.trim();
    if (!action || action.length > 120 || !/^[A-Za-z0-9._:-]+$/.test(action)) continue;
    if (seen.has(action)) continue;
    seen.add(action);
    result.push(action);
    if (result.length >= maxItems) break;
  }

  return result;
}

function isLoopbackAddress(value: string | undefined): boolean {
  if (!value) return false;
  const address = value.trim().toLowerCase();
  return (
    address === '127.0.0.1'
    || address === '::1'
    || address === '::ffff:127.0.0.1'
    || address.startsWith('127.')
  );
}
