import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import test from 'node:test';

/**
 * Guardián de privacidad (solo local): compara el archivo privado del Founder con TODO lo versionado o por versionar.
 * Si el archivo local no existe (CI, otra máquina) la prueba se omite; el resto de guardianes genéricos siguen activos.
 *
 * Referencias que YA eran públicas antes de este guardián y se declaran aquí de forma explícita (no se ocultan):
 *  - START_HERE.md: la identidad operativa canónica (dirección personal del Founder), publicada el 2026-10-21.
 *  - tests/external-integrations-2.test.ts: la dirección de contacto de la empresa, usada como destinatario de ejemplo.
 * Cualquier otro archivo que contenga un valor del archivo privado es un fallo.
 */
const OVERLAY = process.env.JANUS_FOUNDER_REFERENCE_LOCAL?.trim() || 'config/founder-reference-library.local.json';
const PRE_EXISTING_PUBLIC: Record<string, string[]> = {
  'START_HERE.md': ['mail-jean-personal'],
  'tests/external-integrations-2.test.ts': ['mail-infinityseed-contact'],
};

function trackedAndNewFiles(): string[] {
  const run = (args: string[]) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\n').filter(Boolean);
  return [...new Set([...run(['ls-files']), ...run(['ls-files', '-o', '--exclude-standard'])])]
    .filter((file) => !file.startsWith('node_modules/') && !file.endsWith('.local.json') && existsSync(file) && statSync(file).isFile() && statSync(file).size < 4 * 1024 * 1024);
}

test('escaneo de privacidad: ningún valor del archivo privado aparece en los archivos versionados (salvo lo ya público, declarado)', { skip: !existsSync(OVERLAY) }, () => {
  const document = JSON.parse(readFileSync(OVERLAY, 'utf8')) as { records?: Array<{ id: string; value: string; tags?: string[] }> };
  const needles: Array<{ recordId: string; text: string }> = [];
  for (const record of document.records ?? []) {
    const tags = record.tags ?? [];
    const add = (text: string | undefined) => { if (text && text.length >= 8) needles.push({ recordId: record.id, text }); };
    add(record.value);
    if (tags.includes('phone')) {
      add(record.value.slice(1));
      for (const tag of tags) if (tag.startsWith('as-provided:')) add(tag.slice('as-provided:'.length));
    }
    if (/^https:\/\//.test(record.value)) {
      const url = new URL(record.value);
      add(`${url.origin}${url.pathname}`);
      for (const segment of url.pathname.split('/')) if (/^[A-Za-z0-9]{8,}$/.test(segment)) add(segment);
    }
  }
  assert.ok(needles.length > 0, 'el archivo privado debería aportar valores que vigilar');

  const offenders: string[] = [];
  for (const file of trackedAndNewFiles()) {
    const text = readFileSync(file, 'utf8');
    for (const needle of needles) {
      if (!text.includes(needle.text)) continue;
      if (PRE_EXISTING_PUBLIC[file]?.includes(needle.recordId)) continue;
      // Nunca se imprime el valor: solo el archivo y el id del registro.
      offenders.push(`${file} (registro ${needle.recordId})`);
    }
  }
  assert.deepEqual([...new Set(offenders)], [], 'datos personales del archivo privado en archivos versionables');
});
