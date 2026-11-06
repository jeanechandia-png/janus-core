#!/usr/bin/env node
/**
 * Offline archival of a fully downloaded Runway/Kling/CapCut/ElevenLabs output.
 * Usage (after export, no provider API tokens required):
 *   JANUS_MEDIA_VAULT_DIR=/private/janus/media node --import tsx scripts/archive-creative-asset.ts \
 *     --file /private/exports/promo.mp4 --kind video --mime video/mp4 \
 *     --workspace infinityseed --provider runway
 *
 * IMPORT IS NOT PUBLICATION: operator must separately review rights and quality.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { CreativeAssetVault, type CreativeImport, type CreativeKind } from '../packages/core/src/creative-asset-vault.js';

function argumentsMap(args: string[]): Record<string, string> {
  const output: Record<string, string> = {};
  for (let i=0;i<args.length;i+=2) {
    const key=args[i], value=args[i+1];
    if (!key?.startsWith('--') || !value || value.startsWith('--'))
      throw new Error('Use --file, --kind, --mime, --workspace and --provider');
    output[key.slice(2)]=value;
  }
  return output;
}
async function main(): Promise<void> {
  const args=argumentsMap(process.argv.slice(2));
  for (const key of ['file','kind','mime','workspace','provider'])
    if (!args[key]) throw new Error('Missing --'+key);
  const validKinds: CreativeKind[]=['video','audio','image','model-3d'];
  if (!validKinds.includes(args.kind as CreativeKind)) throw new Error('Invalid --kind');
  const localRoot=process.env.JANUS_MEDIA_VAULT_DIR;
  if (!localRoot || !path.isAbsolute(localRoot))
    throw new Error('JANUS_MEDIA_VAULT_DIR must be an absolute LOCAL directory');
  const input: CreativeImport={
    kind:args.kind as CreativeKind, mime:args.mime!,
    workspace:args.workspace!, provider:args.provider!,
    ...(args.model ? {model:args.model} : {}),
    ...(args['task-id'] ? {providerTaskId:args['task-id']} : {}),
    ...(args['source-url'] ? {sourceUrl:args['source-url']} : {}),
  };
  const media=await readFile(path.resolve(args.file!));
  const vault=new CreativeAssetVault(localRoot);
  const saved=await vault.importBuffer(input,media);
  console.log(JSON.stringify({
    status:'archived-local-not-published',
    workspace:saved.workspace, kind:saved.kind, id:saved.id,
    localFile:await vault.localPath(saved.workspace,saved.id),
    bytes:saved.bytes, provider:saved.provider,
    rightsStatus:'pending-explicit-legal-review', dependsOnCreditsForPlayback:false,
  },null,2));
}
main().catch(e=>{console.error(String(e?.message??e)); process.exitCode=1;});
