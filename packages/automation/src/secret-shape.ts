/**
 * Forma de los secretos: una sola definición para todo el motor de flujos (pieza LEGO sin E/S, apta para navegador).
 * - `redactSecrets`: copia con los valores de claves con aspecto de secreto sustituidos (persistencia de ejecuciones).
 * - `findSecretLikeValues`: localiza valores escritos a mano que parecen claves o tokens (editor de flujos, importaciones).
 *
 * Son HEURÍSTICAS: reducen el riesgo de pegar una clave en un flujo, no lo eliminan. Los secretos viven en la bóveda y los
 * flujos solo guardan referencias (`ref:`, `vault:`, `env:` o expresiones `{{ … }}`), nunca el valor.
 */
export const SECRET_KEY = /(token|secret|password|passwd|authorization|api[-_]?key|cookie|private[-_]?key|bearer|credential)/i;

/** Copia profunda con los valores de claves con aspecto de secreto sustituidos. Devuelve cuántos se ocultaron. */
export function redactSecrets(value: unknown): { value: unknown; redactions: number } {
  let redactions = 0;
  const walk = (input: unknown, depth: number): unknown => {
    if (depth > 40) return '[truncated]';
    if (Array.isArray(input)) return input.map((item) => walk(item, depth + 1));
    if (input && typeof input === 'object') {
      const out: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(input as Record<string, unknown>)) {
        if (SECRET_KEY.test(key) && item !== null && item !== undefined && item !== '') {
          out[key] = '[redacted]';
          redactions += 1;
        } else {
          out[key] = walk(item, depth + 1);
        }
      }
      return out;
    }
    return input;
  };
  return { value: walk(value, 0), redactions };
}

const SECRET_VALUE: ReadonlyArray<{ re: RegExp; why: string }> = [
  { re: /\b(?:sk|pk|rk)-[A-Za-z0-9_-]{16,}/, why: 'parece una clave de API (sk-…)' },
  { re: /\bgh[pousr]_[A-Za-z0-9]{20,}/, why: 'parece un token de GitHub' },
  { re: /\bAKIA[0-9A-Z]{16}\b/, why: 'parece una clave de acceso de AWS' },
  { re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/, why: 'parece un token de Slack' },
  { re: /\bAIza[0-9A-Za-z_-]{30,}/, why: 'parece una clave de API de Google' },
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, why: 'es una clave privada' },
  { re: /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/i, why: 'es una cabecera Bearer con token' },
  { re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/, why: 'parece un JWT' },
  { re: /^[A-Za-z0-9+/_-]{40,}={0,2}$/, why: 'es una cadena larga y opaca (¿una clave?)' },
];

/** Un valor que solo apunta a un secreto (no lo contiene) es seguro. */
export function isSecretReference(value: string): boolean {
  const v = value.trim();
  return v.includes('{{') || /^(ref|vault|env):/i.test(v) || v.startsWith('$');
}

export interface SecretFinding {
  /** Ruta dentro del valor inspeccionado, p. ej. `headers.authorization`. */
  path: string;
  why: string;
}

/** Localiza valores escritos a mano con aspecto de secreto. Nunca devuelve el valor, solo dónde está y por qué se sospecha. */
export function findSecretLikeValues(value: unknown, basePath = ''): SecretFinding[] {
  const findings: SecretFinding[] = [];
  const walk = (input: unknown, path: string, depth: number): void => {
    if (depth > 40) return;
    if (typeof input === 'string') {
      if (isSecretReference(input)) return;
      for (const { re, why } of SECRET_VALUE) {
        if (re.test(input)) {
          findings.push({ path, why });
          return;
        }
      }
      return;
    }
    if (Array.isArray(input)) {
      input.forEach((item, index) => walk(item, `${path}[${index}]`, depth + 1));
      return;
    }
    if (input && typeof input === 'object') {
      for (const [key, item] of Object.entries(input as Record<string, unknown>)) {
        const next = path ? `${path}.${key}` : key;
        if (SECRET_KEY.test(key) && typeof item === 'string' && item.trim() !== '' && !isSecretReference(item)) {
          findings.push({ path: next, why: 'el nombre del campo indica un secreto y el valor está escrito a mano' });
          continue;
        }
        walk(item, next, depth + 1);
      }
    }
  };
  walk(value, basePath, 0);
  return findings;
}
