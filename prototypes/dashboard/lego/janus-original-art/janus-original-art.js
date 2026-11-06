'use strict';
/* JanusOriginalArt · privado, offline-first, sin proveedor ni CDN.
 * Instala el paquete original de 26 WebP entregado por Jean vía archivo JSON.
 * IndexedDB contiene sólo arte infantil no biométrico; no toca sesiones,
 * credenciales, memorias ni autorizaciones del Founder.
 * La URL de imagen se deriva de los bytes verificados, nunca de un proveedor.
 */
const JanusOriginalArt = (() => {
  const FORMAT = 'janus-kendra-approved-originals-v1';
  const SHA = typeof APPROVED_ART_HASHES !== 'undefined' ? APPROVED_ART_HASHES : {};
  const IDS = Object.freeze(['lumi', 'bombo', 'musgo', 'nimbo']);
  const ACCESSORIES = Object.freeze({
    'out:capa-galaxia':'capa-galaxia',
    'out:sudadera-estrella':'sudadera-estrella',
    'out:chaqueta-lujo':'chaqueta-lujo',
    'acc:cabeza:corona':'corona-estelar',
    'acc:cara:gafas-redondas':'gafas-glam',
    'acc:espalda:mochila':'mochila',
    'acc:espalda:alas-hada':'alas',
    'acc:cuello:bufanda':'bufanda',
  });
  let approved = Object.create(null), persisted = false;
  const expected = Object.keys(SHA).filter((key) => key.endsWith('.webp')).sort();
  function rotr(x,k) { return (x >>> k) | (x << (32-k)); }
  // Portable SHA-256. WebCrypto isn't guaranteed for Safari file:// offline.
  function sha256(bytes) {
    const K = [
      0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
      0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
      0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
      0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
      0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
      0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
      0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
      0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
    ];
    const h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    const size=Math.ceil((bytes.length+9)/64)*64, m=new Uint8Array(size);
    m.set(bytes);m[bytes.length]=0x80;
    const data=new DataView(m.buffer);
    const hi=Math.floor(bytes.length/0x20000000), lo=(bytes.length*8)>>>0;
    data.setUint32(size-8,hi);data.setUint32(size-4,lo);
    const w=new Uint32Array(64);
    for(let off=0;off<size;off+=64){
      for(let i=0;i<16;i++) w[i]=data.getUint32(off+i*4);
      for(let i=16;i<64;i++){
        const x=w[i-15],y=w[i-2];
        const s0=rotr(x,7)^rotr(x,18)^(x>>>3),s1=rotr(y,17)^rotr(y,19)^(y>>>10);
        w[i]=(w[i-16]+s0+w[i-7]+s1)>>>0;
      }
      let [a,b,c,d,e,f,g,j]=h;
      for(let i=0;i<64;i++){
        const S1=rotr(e,6)^rotr(e,11)^rotr(e,25);
        const ch=(e&f)^(~e&g);
        const t1=(j+S1+ch+K[i]+w[i])>>>0;
        const S0=rotr(a,2)^rotr(a,13)^rotr(a,22);
        const maj=(a&b)^(a&c)^(b&c);
        const t2=(S0+maj)>>>0;
        j=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
      }
      for(let i=0;i<8;i++) h[i]=(h[i]+[a,b,c,d,e,f,g,j][i])>>>0;
    }
    return h.map((n)=>n.toString(16).padStart(8,'0')).join('');
  }
  function decode64(text) {
    if(typeof text!=='string' || text.length>2_100_000 || text.length%4 ||
       !/^[A-Za-z0-9+/]*={0,2}$/.test(text)) throw Error('Base64 inválido');
    const raw=atob(text), bytes=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
    return bytes;
  }
  function hasWebP(bytes) {
    return bytes.length>=16 &&
      bytes[0]===82 && bytes[1]===73 && bytes[2]===70 && bytes[3]===70 &&
      bytes[8]===87 && bytes[9]===69 && bytes[10]===66 && bytes[11]===80;
  }
  function validate(payload) {
    if(!payload || payload.format!==FORMAT || !payload.assets ||
       typeof payload.assets!=='object' || Array.isArray(payload.assets)) throw Error('Paquete no autorizado');
    const keys=Object.keys(payload.assets).sort();
    if(keys.length!==26 || keys.join('|')!==expected.join('|')) throw Error('Deben estar las 26 ilustraciones originales');
    const result=Object.create(null);
    for(const name of keys){
      const bytes=decode64(payload.assets[name]);
      if(bytes.length>1024*1024 || !hasWebP(bytes) || sha256(bytes)!==SHA[name])
        throw Error('Archivo diferente al arte aprobado: '+name);
      result[name]='data:image/webp;base64,'+payload.assets[name];
    }
    return result;
  }
  function dbOpen(){
    return new Promise((resolve,reject)=>{
      if(typeof indexedDB==='undefined') return reject(Error('IndexedDB no disponible'));
      const r=indexedDB.open('janus-kendra-approved-private-art',1);
      r.onupgradeneeded=()=>r.result.createObjectStore('assets');
      r.onsuccess=()=>resolve(r.result);
      r.onerror=()=>reject(r.error||Error('IndexedDB no disponible'));
    });
  }
  async function store(pack){
    const db=await dbOpen();
    try{
      await new Promise((resolve,reject)=>{
        const tx=db.transaction('assets','readwrite');
        tx.objectStore('assets').put(pack,'originals-2026-11-06');
        tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
        tx.onabort=()=>reject(tx.error||Error('Guardado abortado'));
      });
    }finally{db.close();}
  }
  async function importJSON(raw){
    if(typeof raw!=='string' || raw.length>5*1024*1024) throw Error('Paquete demasiado grande');
    const candidate=JSON.parse(raw),verified=validate(candidate); // all-or-nothing first
    approved=verified;
    try{await store(candidate);persisted=true;}catch(_){persisted=false;}
    return {verified:expected.length,persisted,offline:true};
  }
  async function restore(){
    try {
      const db=await dbOpen();
      let pack;
      try{pack=await new Promise((resolve,reject)=>{
        const tx=db.transaction('assets','readonly'),q=tx.objectStore('assets').get('originals-2026-11-06');
        q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);
      });}finally{db.close();}
      if(!pack)return false;
      approved=validate(pack);persisted=true;return true;
    }catch(_){persisted=false;return false;}
  }
  const source=(name)=>approved[name+'.webp']||null;
  return {
    format:FORMAT, importJSON, restore, hasComplete:()=>Object.keys(approved).length===26,
    count:()=>Object.keys(approved).length, persisted:()=>persisted,
    source, creature:(id)=>IDS.includes(id)?source(id):null,
    accessory:(key)=>source(ACCESSORIES[key]||''),
    expression:(id,index)=>IDS.includes(id)&&Number.isInteger(index)&&index>=0&&index<3?
      source('expression-'+id+'-'+(index+1)):null,
    sha256
  };
})();
window.JanusOriginalArt=JanusOriginalArt;
