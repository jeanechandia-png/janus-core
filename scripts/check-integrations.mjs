#!/usr/bin/env node
/**
 * Janus integrations checker: tells which integrations are ready and which
 * variable NAMES are missing. It never prints, logs or sends any secret value.
 * Usage: npm run integrations:check   (reads .env.local if present)
 */
import { loadEnvFile } from './lib/env-file.mjs';

const envFile = process.env.JANUS_ENV_FILE?.trim() || '.env.local';
const loaded = loadEnvFile(envFile);
const has = (name) => Boolean(process.env[name]?.trim());

const groups = [
  ['Modelo local / compatible OpenAI', ['JANUS_MODEL_BASE_URL', 'JANUS_MODEL_NAME'], ['JANUS_MODEL_API_KEY']],
  ['ChatGPT (OpenAI)', ['JANUS_OPENAI_API_KEY', 'JANUS_OPENAI_MODEL'], []],
  ['Claude (Anthropic)', ['JANUS_ANTHROPIC_API_KEY', 'JANUS_ANTHROPIC_MODEL'], []],
  ['Gemini (Google)', ['JANUS_GEMINI_API_KEY', 'JANUS_GEMINI_MODEL'], []],
  ['Perplexity (investigación)', ['PERPLEXITY_API_KEY'], ['JANUS_PERPLEXITY_MODEL']],
  ['GitHub', ['GITHUB_TOKEN'], []],
  ['Google Workspace (lectura)', ['GOOGLE_ACCESS_TOKEN'], []],
  ['Google Workspace (borradores y eventos)', ['GOOGLE_WRITE_ACCESS_TOKEN'], []],
  ['Asana', ['ASANA_ACCESS_TOKEN'], []],
  ['Vercel (lectura)', ['VERCEL_TOKEN'], ['VERCEL_TEAM_ID']],
  ['Netlify (lectura)', ['NETLIFY_AUTH_TOKEN'], []],
  ['Netlify (volver a versión anterior)', ['NETLIFY_RELEASE_TOKEN', 'JANUS_NETLIFY_RELEASE_SITES'], []],
  ['Supabase (solo lectura)', ['SUPABASE_ACCESS_TOKEN'], []],
  ['Runway', ['RUNWAYML_API_SECRET'], ['RUNWAY_API_VERSION']],
  ['Kling AI', ['KLING_API_KEY'], ['KLING_DEFAULT_MODEL']],
  ['n8n (lectura)', ['N8N_BASE_URL', 'N8N_API_KEY'], []],
  ['n8n (disparar flujos autorizados)', ['JANUS_N8N_WEBHOOKS'], []],
  ['Founder (inicio de sesión)', ['JANUS_FOUNDER_PUBLIC_KEY_PEM'], []],
];

const problems = [];
if (has('N8N_BASE_URL') && !process.env.N8N_BASE_URL.trim().startsWith('https://')) problems.push('N8N_BASE_URL debe empezar por https://');
if (has('JANUS_N8N_WEBHOOKS')) {
  try {
    const parsed = JSON.parse(process.env.JANUS_N8N_WEBHOOKS);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !Object.values(parsed).every((url) => typeof url === 'string' && url.startsWith('https://'))) problems.push('JANUS_N8N_WEBHOOKS debe ser {"nombre":"https://…"}');
  } catch { problems.push('JANUS_N8N_WEBHOOKS no es JSON válido'); }
}
if (has('JANUS_FOUNDER_PUBLIC_KEY_PEM') && !/-----BEGIN PUBLIC KEY-----[\s\S]+-----END PUBLIC KEY-----/.test(process.env.JANUS_FOUNDER_PUBLIC_KEY_PEM)) problems.push('JANUS_FOUNDER_PUBLIC_KEY_PEM no parece una llave pública PEM');
if (/PRIVATE KEY/.test(process.env.JANUS_FOUNDER_PUBLIC_KEY_PEM ?? '')) problems.push('¡JANUS_FOUNDER_PUBLIC_KEY_PEM contiene una llave PRIVADA! Bórrala: solo va la pública.');

console.log(`Janus — comprobación de integraciones (${loaded.loaded ? envFile : 'sin ' + envFile + '; solo variables del sistema'})`);
console.log('Nunca se muestran valores, solo si cada variable existe.\n');
let ready = 0;
for (const [label, required, optional] of groups) {
  const missing = required.filter((name) => !has(name));
  if (missing.length === 0) ready += 1;
  const extra = optional.filter((name) => has(name));
  console.log(`${missing.length === 0 ? '✅' : '⬜'} ${label}${missing.length ? ' — falta: ' + missing.join(', ') : ''}${extra.length ? ' (opcional: ' + extra.join(', ') + ')' : ''}`);
}
console.log(`\n${ready}/${groups.length} integraciones listas.`);
if (problems.length) {
  console.log('\nRevisa:');
  for (const problem of problems) console.log('⚠️  ' + problem);
  process.exitCode = 1;
}
