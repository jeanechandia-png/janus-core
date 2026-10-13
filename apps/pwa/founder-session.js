/**
 * Founder session on this device (reusable LEGO piece).
 *
 * - The device holds an ECDSA P-256 key pair created with WebCrypto; the
 *   PRIVATE key is non-extractable and never leaves the browser (IndexedDB).
 * - Login = Janus' existing challenge/response (`/api/auth/challenge` →
 *   sign → `/api/auth/verify`). Janus stores only the PUBLIC key.
 * - The session token lives in sessionStorage (cleared when the app closes).
 * - Requires a secure context (HTTPS or localhost), as WebCrypto does.
 *
 * Importing has no side effects; pure helpers are testable in Node.
 */

const DB_NAME = 'janus-founder';
const STORE = 'keys';
const KEY_ID = 'device-p256';
const TOKEN_KEY = 'janus.founder.session';

export function base64url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function spkiToPem(spkiBytes) {
  let binary = '';
  for (const byte of spkiBytes) binary += String.fromCharCode(byte);
  const body = btoa(binary).match(/.{1,64}/g).join('\n');
  return `-----BEGIN PUBLIC KEY-----\n${body}\n-----END PUBLIC KEY-----\n`;
}

/** Pure: human message for a failed login, in Spanish. */
export function explainAuthError(status, message = '') {
  if (status === 426) return 'Por seguridad, el inicio de sesión solo funciona por HTTPS de confianza o en el mismo equipo de Janus.';
  if (/credential_unavailable|unavailable/i.test(message)) return 'Esta llave aún no está registrada en Janus. Configura la llave pública de este dispositivo y reinicia Janus.';
  if (/signature/i.test(message)) return 'La firma de este dispositivo no coincide con la llave registrada del Founder.';
  return message || `No se pudo iniciar sesión (HTTP ${status}).`;
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idb(mode, run) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = run(tx.objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function loadDeviceKey() {
  try { return (await idb('readonly', (store) => store.get(KEY_ID))) ?? null; } catch { return null; }
}

export async function createDeviceKey() {
  if (!globalThis.isSecureContext || !crypto?.subtle) throw new Error('Este navegador necesita HTTPS para crear la llave segura del dispositivo.');
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  await idb('readwrite', (store) => store.put(pair, KEY_ID));
  return pair;
}

export async function devicePublicKeyPem(pair) {
  return spkiToPem(new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey)));
}

export function sessionToken() {
  try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function authHeaders() {
  const token = sessionToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

export async function signIn(pair, principalId = 'founder') {
  const challengeResponse = await fetch('/api/auth/challenge', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ principalId }),
  });
  const challengeBody = await challengeResponse.json().catch(() => ({}));
  if (!challengeResponse.ok) throw new Error(explainAuthError(challengeResponse.status, challengeBody.error ?? challengeBody.code));
  const { challenge } = challengeBody;
  const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, new TextEncoder().encode(challenge.signingPayload)));
  const verifyResponse = await fetch('/api/auth/verify', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ challengeId: challenge.id, principalId, signature: base64url(signature) }),
  });
  const verifyBody = await verifyResponse.json().catch(() => ({}));
  if (!verifyResponse.ok) throw new Error(explainAuthError(verifyResponse.status, verifyBody.error ?? verifyBody.code));
  try { sessionStorage.setItem(TOKEN_KEY, verifyBody.session.token); } catch { /* memory-only fallback below */ }
  return verifyBody.session;
}

export async function signOut() {
  const headers = authHeaders();
  try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
  if (headers.authorization) await fetch('/api/auth/logout', { method: 'POST', headers }).catch(() => {});
}
