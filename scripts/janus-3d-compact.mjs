import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const sha = b => createHash('sha256').update(b).digest('hex');
const require = (condition, message) => { if (!condition) throw new Error(message); };
const pad = n => (4 - n % 4) % 4;
function parse(bytes) {
  require(bytes.length >= 28 && bytes.readUInt32LE(0) === 0x46546c67 && bytes.readUInt32LE(4) === 2 && bytes.readUInt32LE(8) === bytes.length, 'Invalid GLB');
  const n = bytes.readUInt32LE(12), off = 20 + n;
  require(n % 4 === 0 && off + 8 <= bytes.length && bytes.readUInt32LE(16) === 0x4e4f534a && bytes.readUInt32LE(off+4) === 0x004e4942 && off+8+bytes.readUInt32LE(off) === bytes.length, 'Invalid chunks');
  const doc = JSON.parse(bytes.subarray(20,off).toString('utf8'));
  const bin = bytes.subarray(off+8);
  require(doc.asset?.version === '2.0' && doc.buffers?.length === 1 && !doc.buffers[0].uri && doc.buffers[0].byteLength <= bin.length, 'Embedded buffer required');
  return {doc,bin};
}
function viewBytes(doc,bin,i) {
  const v=doc.bufferViews[i], start=v?.byteOffset??0;
  require(v?.buffer===0 && Number.isSafeInteger(start) && start>=0 && Number.isSafeInteger(v.byteLength) && v.byteLength>=0 && start+v.byteLength<=doc.buffers[0].byteLength,'Invalid buffer view');
  return bin.subarray(start,start+v.byteLength);
}
function accessor(doc,bin,i) {
  const a=doc.accessors[i], width=({5123:2,5125:4,5126:4}[a?.componentType]??0)*({SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a?.type]??0);
  require(a && width>0 && !a.sparse && Number.isSafeInteger(a.count)&&a.count>0&&!doc.bufferViews[a.bufferView]?.byteStride,'Unsupported accessor');
  const v=viewBytes(doc,bin,a.bufferView), offset=a.byteOffset??0;
  require(Number.isSafeInteger(offset)&&offset>=0&&offset+a.count*width<=v.length,'Accessor outside buffer');
  return {a,width,bytes:v.subarray(offset,offset+a.count*width)};
}
function pack(doc,bin) {
  const json=Buffer.from(JSON.stringify(doc)); const j=Buffer.concat([json,Buffer.alloc(pad(json.length),0x20)]), b=Buffer.concat([bin,Buffer.alloc(pad(bin.length))]);
  const header=Buffer.alloc(20), tail=Buffer.alloc(8); header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+j.length+b.length,8);header.writeUInt32LE(j.length,12);header.writeUInt32LE(0x4e4f534a,16);tail.writeUInt32LE(b.length,0);tail.writeUInt32LE(0x004e4942,4);return Buffer.concat([header,j,tail,b]);
}
function streamHash(doc,bin) {
  const h=createHash('sha256');let triangles=0;
  for(const p of doc.meshes[0].primitives){
    const ids=accessor(doc,bin,p.indices), attrs=Object.keys(p.attributes).sort().map(k=>accessor(doc,bin,p.attributes[k]));
    require(ids.a.type==='SCALAR' && [5123,5125].includes(ids.a.componentType)&&ids.a.count%3===0,'Invalid triangle index accessor');
    for(let j=0;j<ids.a.count;j++){const i=ids.width===2?ids.bytes.readUInt16LE(j*2):ids.bytes.readUInt32LE(j*4);for(const at of attrs){require(i<at.a.count,'Index out of range');h.update(at.bytes.subarray(i*at.width,(i+1)*at.width));}}
    triangles+=ids.a.count/3;
  }
  return {hash:h.digest('hex'),triangles};
}
// Lossless 32-bit to 16-bit index partition. Never auto-rig, approve or alter the source.
export function compactOriginal(bytes,expected) {
  require(/^[a-f0-9]{64}$/.test(expected)&&sha(bytes)===expected,'Original SHA-256 mismatch');
  const {doc,bin}=parse(bytes);
  require(doc.meshes?.length===1&&doc.meshes[0].primitives?.length===1&&!doc.skins?.length&&!doc.extensionsRequired?.length,'Only single unskinned uncompressed originals supported');
  const p=doc.meshes[0].primitives[0];require((p.mode??4)===4&&!p.targets&&!p.extensions&&Number.isInteger(p.indices)&&Object.keys(p.attributes).sort().join(',')==='NORMAL,POSITION,TEXCOORD_0','Unsupported primitive');
  const before=streamHash(doc,bin), ids=accessor(doc,bin,p.indices), names=Object.keys(p.attributes), attrs=names.map(k=>accessor(doc,bin,p.attributes[k]));
  require(ids.a.componentType===5125&&attrs.every(at=>at.a.componentType===5126&&at.a.count===attrs[0].a.count),'Expected 32-bit indices and float attributes');
  const geom=new Set([...attrs.map(at=>at.a.bufferView),ids.a.bufferView]);
  const used=new Set([...Object.values(p.attributes),p.indices]);
  require(geom.size===4&&used.size===4&&doc.accessors.every((a,i)=>!geom.has(a.bufferView)||used.has(i))&&!(doc.images??[]).some(i=>geom.has(i.bufferView))&&!(doc.animations??[]).some(a=>a.samplers.some(s=>used.has(s.input)||used.has(s.output))),'Shared geometry references not supported');
  const out=structuredClone(doc), parts=[], views=[];let length=0;
  function append(data,info={}){const padding=pad(length);if(padding){parts.push(Buffer.alloc(padding));length+=padding;}const idx=views.length;views.push({...info,buffer:0,byteOffset:length,byteLength:data.length});parts.push(data);length+=data.length;return idx;}
  const remap=new Map();for(let i=0;i<doc.bufferViews.length;i++)if(!geom.has(i))remap.set(i,append(viewBytes(doc,bin,i),doc.bufferViews[i]));
  const aMap=new Map();out.accessors=[];for(let i=0;i<doc.accessors.length;i++)if(!used.has(i)){const a=doc.accessors[i];aMap.set(i,out.accessors.length);out.accessors.push({...a,bufferView:remap.get(a.bufferView)});}
  for(const i of out.images??[])if(i.bufferView!==undefined)i.bufferView=remap.get(i.bufferView);
  for(const a of out.animations??[])for(const s of a.samplers){s.input=aMap.get(s.input);s.output=aMap.get(s.output);}
  out.meshes[0].primitives=[];let map=new Map(), indices=[];
  function flush(){if(!indices.length)return;const primitive={...p,attributes:{}};const vertices=[...map.keys()];
    for(let k=0;k<attrs.length;k++){const at=attrs[k], data=Buffer.alloc(vertices.length*at.width);vertices.forEach((v,i)=>at.bytes.copy(data,i*at.width,v*at.width,(v+1)*at.width));const ai=out.accessors.length;const a={...at.a,bufferView:append(data,{target:34962}),byteOffset:0,count:vertices.length};if(a.min||a.max){const c=at.width/4, min=Array(c).fill(Infinity),max=Array(c).fill(-Infinity);for(let i=0;i<vertices.length;i++)for(let j=0;j<c;j++){const v=data.readFloatLE(i*at.width+j*4);require(Number.isFinite(v),'Nonfinite position');min[j]=Math.min(min[j],v);max[j]=Math.max(max[j],v);}a.min=min;a.max=max;}out.accessors.push(a);primitive.attributes[names[k]]=ai;}
    const data=Buffer.alloc(indices.length*2);indices.forEach((v,i)=>data.writeUInt16LE(v,i*2));primitive.indices=out.accessors.length;out.accessors.push({bufferView:append(data,{target:34963}),componentType:5123,count:indices.length,type:'SCALAR'});out.meshes[0].primitives.push(primitive);map=new Map();indices=[];}
  for(let j=0;j<ids.a.count;j+=3){const t=[0,1,2].map(k=>ids.bytes.readUInt32LE((j+k)*4));const extra=new Set(t.filter(i=>!map.has(i))).size;if(map.size+extra>65535)flush();for(const i of t){require(i<attrs[0].a.count,'Invalid vertex index');if(!map.has(i))map.set(i,map.size);indices.push(map.get(i));}}flush();
  out.bufferViews=views;out.buffers=[{byteLength:length}];const next=pack(out,Buffer.concat(parts));const parsed=parse(next),after=streamHash(parsed.doc,parsed.bin);
  require(before.hash===after.hash&&before.triangles===after.triangles,'Geometry fidelity check failed');
  for(const [old,now] of remap)require(viewBytes(doc,bin,old).equals(viewBytes(parsed.doc,parsed.bin,now)),'Original texture/animation bytes changed');
  require(next.length<bytes.length,'No size saving; keep original');
  return {bytes:next,receipt:{sourceSha256:expected,derivedSha256:sha(next),beforeBytes:bytes.length,afterBytes:next.length,triangles:before.triangles,geometryStreamSha256:before.hash,primitives:out.meshes[0].primitives.length,status:'preview_only',rights:'pending_review',rig:'unchanged',visualApproval:false}};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [input,output,expected]=process.argv.slice(2);require(input&&output&&expected,'Usage: input.glb output.glb expected-sha256');
 const dest=resolve(output), repo=realpathSync(resolve(dirname(fileURLToPath(import.meta.url)),'..')), parent=realpathSync(dirname(dest));
 require(dest!==resolve(input)&&!(parent===repo||parent.startsWith(repo+sep)),'Use private output, never overwrite or stage in Git');
 const result=compactOriginal(readFileSync(input),expected);writeFileSync(dest,result.bytes,{flag:'wx',mode:0o600});writeFileSync(dest+'.receipt.json',JSON.stringify(result.receipt,null,2)+'\n',{flag:'wx',mode:0o600});console.log(JSON.stringify(result.receipt,null,2));
}
