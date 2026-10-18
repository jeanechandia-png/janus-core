/**
 * Voice enrolment CLI (runs on the host; no audio leaves the machine).
 *
 *   JANUS_SPEAKER_VAULT_KEY=<32-byte base64|hex> JANUS_SPEAKER_EMBED_URL=http://127.0.0.1:8765 \
 *   node --import tsx scripts/voice-enroll.ts --subject jean --name "Jean" --role primary_owner \
 *     --grantor jean --grantor-name "Jean" --relation self \
 *     --statement "Autorizo el reconocimiento y almacenamiento de mi huella de voz para personalizar a Janus." \
 *     --files muestra1.wav,muestra2.wav,muestra3.wav
 *
 *   # Kendra (menor): el consentimiento lo otorga su padre
 *   ... --subject kendra --name "Kendra" --role household_minor --grantor jean --grantor-name "Jean" --relation parent ...
 *
 * Other commands: --list | --revoke <subject> | --forget <subject>
 * Inputs: WAV or raw PCM, 16 kHz mono 16-bit little-endian. Voice recognition is convenience only, never authentication.
 */
import { readFileSync } from 'node:fs';
import {
  EncryptedVault, FileVaultStorage, HttpSpeakerEmbedder, SpeakerIdentifier, parseVaultKey,
  type ConsentRelation, type SubjectRole,
} from '../packages/modules/speaker-id/src/index.js';

function args(): Record<string, string> {
  const out: Record<string, string> = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (!arg.startsWith('--')) continue;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[arg.slice(2)] = 'true';
    else { out[arg.slice(2)] = next; i += 1; }
  }
  return out;
}

function loadPcm(path: string): Uint8Array {
  const bytes = new Uint8Array(readFileSync(path));
  const isWav = bytes.length > 44 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WAVE';
  if (!isWav) return bytes;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  let rate = 0; let channels = 0; let bits = 0;
  while (offset + 8 <= bytes.length) {
    const id = String.fromCharCode(...bytes.slice(offset, offset + 4));
    const size = view.getUint32(offset + 4, true);
    if (id === 'fmt ') { channels = view.getUint16(offset + 10, true); rate = view.getUint32(offset + 12, true); bits = view.getUint16(offset + 22, true); }
    if (id === 'data') {
      if (rate !== 16000 || channels !== 1 || bits !== 16) throw new Error(`${path}: WAV must be 16 kHz mono 16-bit (got ${rate} Hz, ${channels} ch, ${bits} bit)`);
      return bytes.slice(offset + 8, offset + 8 + size);
    }
    offset += 8 + size + (size % 2);
  }
  throw new Error(`${path}: WAV has no data chunk`);
}

const a = args();
const key = process.env.JANUS_SPEAKER_VAULT_KEY;
if (!key) { console.error('JANUS_SPEAKER_VAULT_KEY is required (never store it in the repo or SQLite).'); process.exit(2); }
const identifier = new SpeakerIdentifier({
  embedder: new HttpSpeakerEmbedder({ baseUrl: process.env.JANUS_SPEAKER_EMBED_URL ?? 'http://127.0.0.1:8765' }),
  vault: new EncryptedVault(new FileVaultStorage(process.env.JANUS_SPEAKER_VAULT_PATH ?? 'data/speaker-vault.enc.json'), parseVaultKey(key)),
});

if (a.list) {
  console.log(JSON.stringify(await identifier.listSubjects(), null, 2));
} else if (a.revoke) {
  await identifier.revokeConsent(a.revoke);
  console.log(`Consent revoked for ${a.revoke}.`);
} else if (a.forget) {
  await identifier.forget(a.forget);
  console.log(`Voiceprint and consent erased for ${a.forget}.`);
} else {
  for (const required of ['subject', 'name', 'role', 'grantor', 'grantor-name', 'relation', 'statement', 'files']) {
    if (!a[required]) { console.error(`Missing --${required}`); process.exit(2); }
  }
  await identifier.grantConsent({
    subject: { id: a.subject!, displayName: a.name!, role: a.role as SubjectRole },
    grantedBy: { id: a.grantor!, displayName: a['grantor-name']!, relation: a.relation as ConsentRelation },
    purposes: ['personalization', 'context_routing'],
    statement: a.statement!,
  });
  const report = await identifier.enroll(a.subject!, a.files!.split(',').map((file) => loadPcm(file.trim())));
  console.log(JSON.stringify(report, null, 2));
}
