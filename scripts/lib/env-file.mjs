import { existsSync, readFileSync } from 'node:fs';

/** Loads KEY=VALUE lines into process.env without overriding values already set. Never prints values. */
export function loadEnvFile(path, target = process.env) {
  if (!existsSync(path)) return { loaded: false, keys: [] };
  const keys = [];
  const text = readFileSync(path, 'utf8');
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    // Multi-line quoted values (PEM keys): KEY="-----BEGIN ...\n...\n-----END ...-----"
    if (value.startsWith('"') && !value.endsWith('"')) {
      const parts = [value.slice(1)];
      while (index + 1 < lines.length) {
        index += 1;
        const next = lines[index];
        if (next.trimEnd().endsWith('"')) { parts.push(next.trimEnd().slice(0, -1)); break; }
        parts.push(next);
      }
      value = parts.join('\n');
    } else if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1).replace(/\\n/g, '\n');
    }
    if (!(key in target)) target[key] = value;
    keys.push(key);
  }
  return { loaded: true, keys };
}
