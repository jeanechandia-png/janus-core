#!/usr/bin/env node
// Configura SOLO el nodo local. Las claves se generan en el dispositivo, nunca se imprimen.
import { createPublicKey, generateKeyPairSync, randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { loadEnvFile } from '../lib/env-file.mjs';

export function setEnvValue(text, key, value) {
  const lines = text.split('\n');
  const kept = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trimStart().startsWith(key + '=')) { kept.push(lines[i]); continue; }
    const old = lines[i].slice(lines[i].indexOf('=') + 1).trim();
    if (old.startsWith('"') && !old.endsWith('"')) {
      while (i + 1 < lines.length && !lines[++i].trimEnd().endsWith('"')) { /* multiline PEM */ }
    }
  }
  return kept.join('\n').trimEnd() + '\n' + key + '=' + JSON.stringify(value) + '\n';
}

const shellQuote = (value) => "'" + value.replaceAll("'", "'\\''") + "'";

export function configureLocal(env = process.env, founderKeyFile) {
  const home = env.HOME || homedir();
  const app = resolve(env.JANUS_APP_DIR || fileURLToPath(new URL('../../', import.meta.url)));
  const data = resolve(env.JANUS_DATA_DIR || join(home, 'janus-data'));
  const secrets = resolve(env.JANUS_SECRETS_DIR || join(home, 'janus-secrets'));
  const file = resolve(env.JANUS_ENV_FILE || join(secrets, 'janus.env'));
  const values = {};
  loadEnvFile(file, values);
  let text = existsSync(file) ? readFileSync(file, 'utf8') : readFileSync(join(app, '.env.example'), 'utf8');
  const initial = {};
  if (!existsSync(file)) loadEnvFile(join(app, '.env.example'), initial);
  // Una clave existente NUNCA se reemplaza: protege datos cifrados de instalaciones previas.
  const defaults = {
    JANUS_DB: join(data, 'janus.db'),
    JANUS_TIME_ZONE: 'Europe/Amsterdam',
    JANUS_BIND_HOST: '127.0.0.1',
    JANUS_PRIVATE_IMPORT_DIR: join(secrets, 'import'),
    JANUS_ASSISTANT_VOICES_FILE: join(secrets, 'assistant-voices.local.json'),
    JANUS_CREDENTIAL_VAULT_KEY: randomBytes(32).toString('base64'),
    JANUS_PUSH_VAPID_PRIVATE_KEY: generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({ format: 'jwk' }).d,
  };
  for (const [key, value] of Object.entries(defaults)) {
    const existing = values[key] || (key === 'JANUS_DB' ? undefined : initial[key]);
    if (!existing?.trim()) text = setEnvValue(text, key, value);
  }
  let founderConfigured = Boolean(values.JANUS_FOUNDER_PUBLIC_KEY_PEM?.trim());
  if (founderKeyFile) {
    const input = readFileSync(founderKeyFile, 'utf8').trim();
    if (!/^-----BEGIN PUBLIC KEY-----\s+[A-Za-z0-9+/=\s]+\s+-----END PUBLIC KEY-----$/.test(input)) {
      throw new Error('Se requiere una llave PÚBLICA PEM; no se aceptan llaves privadas.');
    }
    const publicKey = createPublicKey(input);
    if (publicKey.asymmetricKeyType !== 'ec' || publicKey.asymmetricKeyDetails?.namedCurve !== 'prime256v1') {
      throw new Error('La llave del dispositivo debe ser ECDSA P-256.');
    }
    const canonical = publicKey.export({ format: 'pem', type: 'spki' }).toString();
    if (founderConfigured && createPublicKey(values.JANUS_FOUNDER_PUBLIC_KEY_PEM).export({ format: 'pem', type: 'spki' }).toString() !== canonical) {
      throw new Error('Ya existe otra llave del propietario. No se sustituye ni se borra su acceso.');
    }
    text = setEnvValue(text, 'JANUS_FOUNDER_PUBLIC_KEY_PEM', canonical);
    founderConfigured = true;
  }
  for (const dir of [data, join(data, 'logs'), join(data, 'backups'), secrets, dirname(file), join(secrets, 'import')]) {
    mkdirSync(dir, { recursive: true, mode: 0o700 }); chmodSync(dir, 0o700);
  }
  const temp = file + '.tmp-' + process.pid;
  writeFileSync(temp, text, { mode: 0o600, flag: 'wx' });
  renameSync(temp, file); chmodSync(file, 0o600);
  const boot = join(home, '.termux', 'boot', 'janus-start.sh');
  mkdirSync(dirname(boot), { recursive: true, mode: 0o700 });
  const paths = { JANUS_APP_DIR: app, JANUS_DATA_DIR: data, JANUS_SECRETS_DIR: secrets, JANUS_ENV_FILE: file };
  writeFileSync(boot, '#!/data/data/com.termux/files/usr/bin/sh\n' +
    Object.entries(paths).map(([key, value]) => `export ${key}=${shellQuote(value)}\n`).join('') +
    `sh ${shellQuote(join(app, 'scripts/tablet/start-janus.sh'))} >/dev/null 2>&1 &\n`, { mode: 0o700 });
  chmodSync(boot, 0o700);
  return { founderConfigured };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const args = process.argv.slice(2);
    if (args.length && (args.length !== 2 || args[0] !== '--founder-key')) throw new Error('Uso: configure-local.mjs [--founder-key ARCHIVO_PUBLICO.pem]');
    const result = configureLocal(process.env, args[1]);
    console.log('Configuración local guardada. Cifrado y carpetas privadas preparados; valores ocultos.');
    console.log(result.founderConfigured ? 'Llave del propietario registrada. Reinicia Janus y pulsa «Entrar como Founder».' : 'Vinculación del propietario pendiente: descarga la llave pública desde Controles.');
  } catch (error) {
    // No propagar errores de parseadores con contenido de un archivo privado.
    console.error('No se pudo configurar el nodo local. ' + (/^(Se requiere|La llave|Ya existe|Uso:)/.test(error.message) ? error.message : 'Comprueba las rutas y los permisos de los archivos.'));
    process.exitCode = 1;
  }
}
