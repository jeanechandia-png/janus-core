'use strict';
/* A/B offline: mount ONLY four source-verified, visual-approved GLBs.
 * It never treats generated fixtures, 2D art or procedural stand-ins as 3D.
 * User-imported GLBs retain priority; profiles/permissions untouched.
 */
const JanusApproved3D = (() => {
  const ids=['lumi','bombo','musgo','nimbo'];
  const bundled=(typeof APPROVED_GLBS==='object' && APPROVED_GLBS) || {};
  const statuses=Object.create(null);
  let task;
  function binary(base64) {
    const chunks=[];
    let n=0;
    for(let i=0;i<base64.length;i+=32768){
      const s=atob(base64.slice(i,i+32768));
      const b=new Uint8Array(s.length);
      for(let j=0;j<s.length;j++) b[j]=s.charCodeAt(j);
      chunks.push(b);n+=b.length;
    }
    const out=new Uint8Array(n);let p=0;
    for(const chunk of chunks){out.set(chunk,p);p+=chunk.length;}
    return out.buffer;
  }
  async function digest(buf) {
    if (!window.crypto || !window.crypto.subtle || !window.crypto.subtle.digest)
      return null; // file:// Safari: integrity has already been enforced by build.cjs
    const hash=new Uint8Array(await window.crypto.subtle.digest('SHA-256',buf));
    return [...hash].map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  async function install() {
    const slot=window.JanusCreatureSlot;
    if(!slot?.supported?.()) return {status:'unavailable',installed:[]};
    const installed=[];
    for(const id of ids){
      const item=bundled[id];
      if(!item) {statuses[id]='missing';continue;}
      // Never replace an imported model or one restored from this device's IndexedDB.
      if(slot.has(id)) {statuses[id]='existing-user-model';continue;}
      try{
        if(item.quality!=='visual-approved-3d' || !/^[a-f0-9]{64}$/.test(item.sha256))
          throw new Error('no valid signoff');
        if(!Number.isInteger(item.bytes) || item.bytes>15*1024*1024 || item.bytes<100)
          throw new Error('size outside contract');
        const buf=binary(item.base64);
        if(buf.byteLength!==item.bytes)throw new Error('length mismatch');
        const actual=await digest(buf);
        if(actual && actual!==item.sha256)throw new Error('SHA-256 mismatch');
        const checked=await slot.inspect(buf);
        // An imported model with missing skeleton, expressions or clips is NOT approved.
        if(checked.level!=='ok')throw new Error(checked.summary);
        if(slot.has(id)) {statuses[id]='existing-user-model';continue;}
        const loaded=await slot.load(id,buf,{name:id+'-approved-3d.glb',volatile:true});
        if(loaded.level!=='ok')throw new Error(loaded.summary);
        statuses[id]='approved-3d-loaded';installed.push(id);
      }catch(e){statuses[id]='rejected: '+String(e?.message||e).slice(0,120);}
    }
    if(installed.length && typeof ST!=='undefined' && ST.comp && !ST.comp.userSelectedVisualMode &&
       installed.includes(ST.comp.creatureId)){
      ST.comp.visualMode='3d';
      if(typeof saveState==='function')saveState();
      if(typeof ROUTE!=='undefined' && ROUTE.v==='companero' && typeof rerender==='function')rerender();
    }
    return {status:installed.length?'installed':'no-approved-models',installed};
  }
  return {ids,statuses,install:()=>task||(task=install())};
})();
window.JanusApproved3D=JanusApproved3D;
