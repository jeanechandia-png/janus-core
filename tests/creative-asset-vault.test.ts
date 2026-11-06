import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { CreativeAssetVault } from '../packages/core/src/creative-asset-vault.js';

function video(): Buffer {
  // Valid minimal MP4 file signature for safe archival checks; NOT a video decoder test.
  const bytes=Buffer.alloc(128);
  bytes.writeUInt32BE(24,0); bytes.write('ftyp',4,'ascii'); bytes.write('isom',8,'ascii');
  return bytes;
}
const rights = {
  commercialUse: true,
  offlineUseAfterCancellation: true,
  permissionToModify: true,
};
test('Runway output archived locally survives provider URLs, subscriptions and duplicates', async () => {
  const root=await mkdtemp(path.join(os.tmpdir(),'janus-creative-'));
  try {
    const vault=new CreativeAssetVault(root), bytes=video();
    const input={
      workspace:'infinityseed',kind:'video' as const,mime:'video/mp4',
      provider:'runway',model:'gen4',sourceUrl:'https://example.invalid/expires-in-24-hours',
      rights,
    };
    const a=await vault.importBuffer(input,bytes);
    assert.equal(a.state,'pending','a downloaded asset is not automatically approved for public campaign');
    assert.equal(a.sha256,createHash('sha256').update(bytes).digest('hex'));
    assert.equal(a.rights.offlineUseAfterCancellation,true);
    assert.ok((await vault.localPath('infinityseed',a.id)).endsWith('.mp4'));
    assert.equal(await vault.canPublish('infinityseed',a.id),false);
    const b=await vault.importBuffer({...input,provider:'kling'},bytes);
    assert.equal(b.id,a.id,'duplicate content is idempotent across providers');
    assert.equal(b.provider,'runway','never overwrite provenance on duplicate import');
    const approved=await vault.approve('infinityseed',a.id,'Responsible reviewer',
      'https://help.runwayml.com/hc/en-us/articles/18927776141715-Usage-rights');
    assert.equal(approved.state,'approved');
    assert.equal(await vault.canPublish('infinityseed',a.id),true);
    assert.deepEqual(await readFile(await vault.localPath('infinityseed',a.id)),bytes);
    assert.doesNotMatch(await readFile(await vault.localPath('infinityseed',a.id),'utf8'),/sk-proj/);
    await writeFile(await vault.localPath('infinityseed',a.id),Buffer.from('damaged'));
    await assert.rejects(vault.verify('infinityseed',a.id),/size mismatch|SHA-256/);
  } finally {await rm(root,{recursive:true,force:true});}
});
test('refuses vendor-lock-in licences, missing evidence, tricks, unsupported media and unsafe directories',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'janus-creative-'));
  try{
    const vault=new CreativeAssetVault(root);
    const base={workspace:'team',kind:'video' as const,mime:'video/mp4',provider:'runway'};
    const noRights=await vault.importBuffer(base,video());
    assert.equal(await vault.canPublish('team',noRights.id),false);
    await assert.rejects(vault.approve('team',noRights.id,'Reviewer','https://runway.com'),/rights not confirmed/);
    await assert.rejects(vault.importBuffer({...base,workspace:'../secret'},video()),/Invalid workspace/);
    await assert.rejects(vault.importBuffer({...base,provider:'../bad'},video()),/Invalid provider/);
    await assert.rejects(vault.importBuffer({...base,mime:'application/x-msdownload'},video()),/Unsupported/);
    await assert.rejects(vault.importBuffer({...base,mime:'video/webm'},video()),/Invalid, unsupported/);
    await assert.rejects(vault.importBuffer({...base,kind:'model-3d',mime:'model/gltf-binary'},video()),/Invalid, unsupported/);
  }finally{await rm(root,{recursive:true,force:true});}
});
test('audio can be archived as locally controlled output without asserting cloned-voice model ownership',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'janus-creative-'));
  try{
    const bytes=Buffer.alloc(48);
    bytes.write('RIFF',0);bytes.write('WAVE',8);
    const vault=new CreativeAssetVault(root);
    const out=await vault.importBuffer({workspace:'personal',kind:'audio',mime:'audio/wav',provider:'elevenlabs'},bytes);
    assert.equal(out.kind,'audio');
    assert.equal(out.state,'pending');
    assert.ok((await vault.localPath('personal',out.id)).endsWith('.wav'));
    assert.equal(await vault.canPublish('personal',out.id),false);
  }finally{await rm(root,{recursive:true,force:true});}
});
