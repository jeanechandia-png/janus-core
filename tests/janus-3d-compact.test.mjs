import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compactOriginal } from '../scripts/janus-3d-compact.mjs';
function fixture() {
  const n=65538;
  const parts=[Buffer.alloc(n*12),Buffer.alloc(n*12),Buffer.alloc(n*8),Buffer.alloc(n*4)];
  for(let i=0;i<n;i++){parts[0].writeFloatLE(i,i*12);parts[1].writeFloatLE(1,i*12+4);parts[2].writeFloatLE(i/n,i*8);parts[3].writeUInt32LE(i,i*4);}
  const bin=Buffer.concat(parts);let off=0;
  const views=parts.map((b,i)=>{const v={buffer:0,byteOffset:off,byteLength:b.length,target:i===3?34963:34962};off+=b.length;return v;});
  const doc={asset:{version:'2.0'},buffers:[{byteLength:bin.length}],bufferViews:views,accessors:[{bufferView:0,componentType:5126,type:'VEC3',count:n,min:[0,0,0],max:[n-1,0,0]},{bufferView:1,componentType:5126,type:'VEC3',count:n},{bufferView:2,componentType:5126,type:'VEC2',count:n},{bufferView:3,componentType:5125,type:'SCALAR',count:n}],meshes:[{primitives:[{attributes:{POSITION:0,NORMAL:1,TEXCOORD_0:2},indices:3}]}],nodes:[{mesh:0}],scenes:[{nodes:[0]}],scene:0};
  const raw=Buffer.from(JSON.stringify(doc));const j=Buffer.concat([raw,Buffer.alloc((4-raw.length%4)%4,32)]);const h=Buffer.alloc(20),t=Buffer.alloc(8);h.writeUInt32LE(0x46546c67,0);h.writeUInt32LE(2,4);h.writeUInt32LE(28+j.length+bin.length,8);h.writeUInt32LE(j.length,12);h.writeUInt32LE(0x4e4f534a,16);t.writeUInt32LE(bin.length,0);t.writeUInt32LE(0x004e4942,4);return Buffer.concat([h,j,t,bin]);
}
test('lossless partition preserves geometry and never claims rig/approval',()=>{
  const input=fixture(),hash=createHash('sha256').update(input).digest('hex');
  const result=compactOriginal(input,hash);
  assert.ok(result.bytes.length<input.length);
  assert.equal(result.receipt.triangles,21846);
  assert.equal(result.receipt.primitives,2);
  assert.equal(result.receipt.rig,'unchanged');
  assert.equal(result.receipt.visualApproval,false);
  assert.equal(createHash('sha256').update(input).digest('hex'),hash);
  assert.throws(()=>compactOriginal(input,'0'.repeat(64)),/SHA-256 mismatch/);
});
