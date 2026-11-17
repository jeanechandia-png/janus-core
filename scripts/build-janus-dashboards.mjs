import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../prototypes/dashboard/', import.meta.url));
const build = join(root, 'build.cjs');
const targets = [
  ['a', 'dist/Janus-A-Obsidiana-interactivo.html', false],
  ['b', 'dist/Janus-B-Platino-interactivo.html', false],
  ['a', 'dist/Janus-Core-A-public-safe.html', true],
  ['b', 'dist/Janus-Core-B-public-safe.html', true],
];
for (const [skin, output, safe] of targets) {
  execFileSync(process.execPath, [build, '--skin', skin, '--out', join(root, output)], {
    cwd: root,
    env: { ...process.env, JANUS_DASH_PUBLIC_SAFE: safe ? '1' : '0' },
    stdio: 'inherit',
    timeout: 60000,
  });
}
console.log('JANUS: Obsidiana, Platino y ambas versiones Core sin datos privados: compilados.');
