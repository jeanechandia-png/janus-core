/**
 * Face enrolment CLI (runs on the host; no image leaves the machine). Face identification is convenience only.
 *
 *   JANUS_FACE_VAULT_KEY=<32-byte base64|hex> JANUS_FACE_EMBED_URL=http://127.0.0.1:8792 \
 *   node --import tsx scripts/face-enroll.ts --subject jean --name "Jean" --role primary_owner \
 *     --grantor jean --grantor-name "Jean" --relation self \
 *     --statement "Autorizo el reconocimiento y almacenamiento de mi plantilla facial para personalizar a Janus." \
 *     --files foto1.jpg,foto2.jpg,foto3.jpg
 *
 *   # Kendra (menor): el consentimiento lo otorga su padre. Fotos frontales, buena luz, una sola cara.
 *   ... --subject kendra --name "Kendra" --role household_minor --grantor jean --grantor-name "Jean" --relation parent ...
 *
 * Other commands: --list | --revoke <subject> | --forget <subject>
 */
import { readFileSync } from 'node:fs';
import {
  EncryptedVault, FileVaultStorage, FaceIdentifier, HttpFaceEmbedder, parseVaultKey,
  type ConsentRelation, type SubjectRole,
} from '../packages/modules/face-id/src/index.js';

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

const a = args();
const key = process.env.JANUS_FACE_VAULT_KEY;
if (!key) { console.error('JANUS_FACE_VAULT_KEY is required (never store it in the repo or SQLite).'); process.exit(2); }
const identifier = new FaceIdentifier({
  embedder: new HttpFaceEmbedder({ baseUrl: process.env.JANUS_FACE_EMBED_URL ?? 'http://127.0.0.1:8792' }),
  vault: new EncryptedVault(new FileVaultStorage(process.env.JANUS_FACE_VAULT_PATH ?? 'data/face-vault.enc.json'), parseVaultKey(key)),
});

if (a.list) {
  console.log(JSON.stringify(await identifier.listSubjects(), null, 2));
} else if (a.revoke) {
  await identifier.revokeConsent(a.revoke);
  console.log(`Consent revoked for ${a.revoke}.`);
} else if (a.forget) {
  await identifier.forget(a.forget);
  console.log(`Face template and consent erased for ${a.forget}.`);
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
  const report = await identifier.enroll(a.subject!, a.files!.split(',').map((file) => new Uint8Array(readFileSync(file.trim()))));
  console.log(JSON.stringify(report, null, 2));
}
