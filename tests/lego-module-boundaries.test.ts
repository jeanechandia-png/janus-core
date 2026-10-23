import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import test from 'node:test';

const MODULES_DIR = resolve('packages/modules');
const JANUS_CORE_DIRS = ['core', 'gateways', 'orchestrator', 'voice', 'security', 'automation'].map((name) => resolve('packages', name));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

function specifiers(source: string): string[] {
  const found: string[] = [];
  const pattern = /(?:from\s+|import\s*\(\s*|import\s+|require\s*\(\s*)['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(pattern)) found.push(match[1]!);
  return found;
}

const moduleDirs = readdirSync(MODULES_DIR).map((name) => join(MODULES_DIR, name)).filter((dir) => statSync(dir).isDirectory());

test('there are LEGO modules and each has a valid manifest, README and entry point', () => {
  assert.ok(moduleDirs.length >= 2);
  for (const dir of moduleDirs) {
    const manifest = JSON.parse(readFileSync(join(dir, 'module.json'), 'utf8')) as Record<string, unknown>;
    for (const field of ['id', 'version', 'kind', 'summary', 'entry', 'dependencies', 'dataClassification', 'invariants', 'reuseNotes']) {
      assert.ok(field in manifest, `${dir}: manifest missing ${field}`);
    }
    assert.deepEqual(manifest.dependencies, [], `${dir}: modules must not depend on other packages`);
    assert.ok(Array.isArray(manifest.invariants) && manifest.invariants.length > 0);
    assert.ok(existsSync(join(dir, String(manifest.entry))), `${dir}: entry missing`);
    assert.ok(existsSync(join(dir, 'README.md')), `${dir}: README missing`);
  }
});

test('a LEGO module imports nothing from outside its own folder (only node: built-ins)', () => {
  for (const dir of moduleDirs) {
    for (const file of walk(dir).filter((path) => path.endsWith('.ts'))) {
      for (const specifier of specifiers(readFileSync(file, 'utf8'))) {
        if (specifier.startsWith('node:')) continue;
        assert.ok(specifier.startsWith('.'), `${file} imports external package "${specifier}"`);
        const target = resolve(dirname(file), specifier);
        assert.ok(target === dir || target.startsWith(dir + sep), `${file} reaches outside its module via "${specifier}"`);
      }
    }
  }
});

test('Janus core never depends on a LEGO module: removing a module cannot break Janus (adapters/apps are the only consumers)', () => {
  for (const dir of JANUS_CORE_DIRS) {
    for (const file of walk(dir).filter((path) => path.endsWith('.ts'))) {
      for (const specifier of specifiers(readFileSync(file, 'utf8'))) {
        assert.ok(!/modules\//.test(specifier), `${file} imports a LEGO module ("${specifier}"); use an adapter instead`);
      }
    }
  }
});
