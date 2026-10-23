import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
// @ts-expect-error -- plain ES module without type declarations
import { loadEnvFile } from '../scripts/lib/env-file.mjs';

const SECRET_NAMES = ['JANUS_OPENAI_API_KEY', 'JANUS_ANTHROPIC_API_KEY', 'JANUS_GEMINI_API_KEY', 'PERPLEXITY_API_KEY', 'ASANA_ACCESS_TOKEN', 'VERCEL_TOKEN', 'NETLIFY_AUTH_TOKEN', 'NETLIFY_RELEASE_TOKEN', 'SUPABASE_ACCESS_TOKEN', 'RUNWAYML_API_SECRET', 'KLING_API_KEY', 'N8N_API_KEY', 'GOOGLE_WRITE_ACCESS_TOKEN', 'GITHUB_TOKEN'];

test('.env.example lists every integration variable with NO values for secrets', () => {
  const template = readFileSync('.env.example', 'utf8');
  for (const name of SECRET_NAMES) assert.match(template, new RegExp(`^${name}=$`, 'm'), name);
  assert.equal(/PRIVATE KEY|sk-|ghp_|github_pat_/.test(template), false);
  assert.match(readFileSync('.gitignore', 'utf8'), /^\.env\.\*$/m);
});

test('env loader: does not override existing values, supports multi-line PEM, ignores comments', () => {
  const dir = mkdtempSync(join(tmpdir(), 'janus-env-'));
  const file = join(dir, '.env.local');
  writeFileSync(file, '# comentario\nA=1\nB="dos"\nPEM="-----BEGIN PUBLIC KEY-----\nAAAA\n-----END PUBLIC KEY-----"\nKEEP=nuevo\n');
  const target: Record<string, string> = { KEEP: 'existente' };
  const result = loadEnvFile(file, target);
  assert.equal(target.A, '1');
  assert.equal(target.B, 'dos');
  assert.equal(target.PEM, '-----BEGIN PUBLIC KEY-----\nAAAA\n-----END PUBLIC KEY-----');
  assert.equal(target.KEEP, 'existente');
  assert.deepEqual(result.keys, ['A', 'B', 'PEM', 'KEEP']);
});

test('integrations checker reports readiness and problems but never prints secret values', () => {
  const dir = mkdtempSync(join(tmpdir(), 'janus-env-'));
  const file = join(dir, '.env.local');
  const secret = 'sk-super-secreto-123456';
  writeFileSync(file, `JANUS_OPENAI_API_KEY=${secret}\nJANUS_OPENAI_MODEL=modelo-x\nN8N_BASE_URL=http://inseguro\nN8N_API_KEY=${secret}\nJANUS_FOUNDER_PUBLIC_KEY_PEM="-----BEGIN PRIVATE KEY-----\nX\n-----END PRIVATE KEY-----"\n`);
  const run = spawnSync(process.execPath, ['scripts/check-integrations.mjs'], { env: { PATH: process.env.PATH, JANUS_ENV_FILE: file }, encoding: 'utf8' });
  assert.match(run.stdout, /✅ ChatGPT \(OpenAI\)/);
  // Norma 7: lo no activado se presenta como «en reposo» (preparado, pendiente de activación), no como un fallo.
  assert.match(run.stdout, /⬜ Claude \(Anthropic\) — en reposo; para activar falta: JANUS_ANTHROPIC_API_KEY, JANUS_ANTHROPIC_MODEL/);
  assert.match(run.stdout, /No es un fallo/);
  assert.match(run.stdout, /N8N_BASE_URL debe empezar por https/);
  assert.match(run.stdout, /contiene una llave PRIVADA/);
  assert.equal(run.stdout.includes(secret) || run.stderr.includes(secret), false);
  assert.equal(run.status, 1);
});
