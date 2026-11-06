'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),
  fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const src=(p)=>fs.readFileSync(path.join(ROOT,p),'utf8');
const code=src('lego/janus-original-art/janus-original-art.js');
const hashes=JSON.parse(src('assets/approved/INDEX.json')).required_assets;
const allNames=Object.keys(hashes).filter(n=>n.endsWith('.webp')).sort();
function makeWebp(name) {
  const b=Buffer.alloc(32);
  b.write('RIFF',0,'ascii');b.writeUInt32LE(24,4);b.write('WEBP',8,'ascii');b.write('VP8X',12,'ascii');
  b.write(name.slice(0,15),16,'ascii');
  return b;
}
function fixture() {
  const bytes=Object.fromEntries(allNames.map(name=>[name,makeWebp(name)]));
  const expected=Object.fromEntries(allNames.map(name=>[name,crypto.createHash('sha256').update(bytes[name]).digest('hex')]));
  const payload={format:'janus-kendra-approved-originals-v1',assets:Object.fromEntries(allNames.map(name=>[name,bytes[name].toString('base64')]))};
  const context={window:{},APPROVED_ART_HASHES:expected,atob:globalThis.atob};
  vm.runInNewContext(code,context,{filename:'janus-original-art.js'});
  return {art:context.window.JanusOriginalArt,bytes,payload,expected};
}
test('26 approved items are installed only after validating all exact SHA-256 hashes, without network',async()=>{
  const {art,bytes,payload}=fixture();
  assert.equal(allNames.length,26);
  assert.equal(art.sha256(new Uint8Array([97,98,99])),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(art.hasComplete(),false);
  const result=await art.importJSON(JSON.stringify(payload));
  assert.equal(result.verified,26);
  assert.equal(result.persisted,false,'no IndexedDB in test; not falsely claiming persistent installation');
  assert.equal(art.count(),26);
  for(const id of ['lumi','bombo','musgo','nimbo']){
    const b64=art.creature(id).split(',')[1];
    assert.equal(Buffer.from(b64,'base64').toString('hex'),bytes[id+'.webp'].toString('hex'));
    for(let index=0;index<3;index++)assert.ok(art.expression(id,index)?.startsWith('data:image/webp;base64,'));
  }
  for(const key of ['out:capa-galaxia','out:sudadera-estrella','out:chaqueta-lujo','acc:cabeza:corona',
    'acc:cara:gafas-redondas','acc:espalda:mochila','acc:espalda:alas-hada','acc:cuello:bufanda'])
    assert.ok(art.accessory(key)?.startsWith('data:image/webp;base64,'));
});
test('a modified or incomplete package is rejected without altering an already verified set',async()=>{
  const {art,payload}=fixture();
  await art.importJSON(JSON.stringify(payload));
  const prior=art.creature('lumi');
  const corrupt=JSON.parse(JSON.stringify(payload));corrupt.assets['lumi.webp']=corrupt.assets['bombo.webp'];
  await assert.rejects(art.importJSON(JSON.stringify(corrupt)),/diferente al arte aprobado/);
  assert.equal(art.creature('lumi'),prior);
  const incomplete=JSON.parse(JSON.stringify(payload));delete incomplete.assets['nimbo.webp'];
  await assert.rejects(art.importJSON(JSON.stringify(incomplete)),/26 ilustraciones/);
  assert.equal(art.creature('lumi'),prior);
  await assert.rejects(art.importJSON('{invalid'),/JSON/);
  assert.equal(art.creature('lumi'),prior);
});
test('both dashboard builds ship only authorizing SHA hashes, not the private original images',()=>{
  const build=src('build.cjs'),presence=src('lego/janus-presence/janus-presence.js');
  const companion=src('src/companero.js');
  assert.match(build,/const APPROVED_ART_HASHES=/);
  assert.match(build,/lego\/janus-original-art\/janus-original-art.js/);
  assert.match(presence,/window\.JanusOriginalArt\.creature/);
  assert.match(companion,/input\[data-original-art-file\]/);
  assert.match(companion,/JanusOriginalArt\.restore\(\)/);
  assert.match(companion,/JanusOriginalArt\.importJSON/);
  assert.match(companion,/JanusOriginalArt\.expression/);
  assert.match(companion,/JanusOriginalArt\.accessory/);
  assert.doesNotMatch(code,/fetch\s*\(|XMLHttpRequest|WebSocket|runway\.com|kling\.ai|elevenlabs/);
});
