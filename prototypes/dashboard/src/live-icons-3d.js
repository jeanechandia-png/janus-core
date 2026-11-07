'use strict';
/* JANUS CORE — Live Objects 3D.
 * Actual THREE.Mesh icon geometry, not a CSS-rotated JPEG or a generic emoji.
 * Reuses ONE WebGL context for all icons, copies rendered frames into 2D canvas.
 * Gold WebP original is retained underneath as safe fallback when 3D is unavailable.
 * No external network, API, credits, fingerprinting, camera or telemetry.
 */
const JanusLiveObjects3D = (() => {
  const T = window.THREE;
  const root = document.getElementById('app');
  if (!T || !root || !T.WebGLRenderer) return Object.freeze({available:false,refresh(){}});
  const palettes = {
    gold:0xf3be64,cobalt:0x5eacf8,amethyst:0xb989fa,emerald:0x54d19b,
    rose:0xf8a0d1,teal:0x61d9db,copper:0xef9f70,indigo:0x929afa,coral:0xff8383
  };
  const ICON_NAMES = new Set([
    'mail','mic','lock','school','shopping-cart','sun','sparkles','folder',
    'calendar-days','target','bike','heart','settings','handshake','clapperboard',
    'euro','eye','umbrella','plane','tag','dumbbell','stethoscope','inbox','camera',
    'gift','star','phone','bot'
  ]);
  const cache = new Map();
  const targets = new Map();
  let renderer,scene,camera,animation=0,observer=null,pending=false,initFailed=false,last=0;
  const reduce = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const metal = (color,roughness=.23) => new T.MeshPhysicalMaterial({
    color, metalness:.77, roughness, clearcoat:1, clearcoatRoughness:.09,
    emissive:0x08040c, emissiveIntensity:.12
  });
  const bright = metal(0xffe3a3,.17), dark = metal(0x1b2437,.34);
  const silver = metal(0xf7fbff,.18), shade = metal(0x344052,.28);
  function mesh(geometry, material, parent, x=0,y=0,z=.28) {
    const o=new T.Mesh(geometry,material);o.position.set(x,y,z);parent.add(o);return o;
  }
  function box(parent,w,h,d,x=0,y=0,z=.38,material=bright){
    return mesh(new T.BoxGeometry(w,h,d,1,1,1),material,parent,x,y,z);
  }
  function sphere(parent,r,x=0,y=0,z=.42,material=bright){
    return mesh(new T.SphereGeometry(r,20,14),material,parent,x,y,z);
  }
  function pipe(parent,points,r=.055,material=bright){
    const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(p[0],p[1],p[2]??.43)));
    return mesh(new T.TubeGeometry(curve,Math.max(12,points.length*7),r,8,false),material,parent,0,0,0);
  }
  function torus(parent,r,tube,x=0,y=0,z=.43,material=bright){
    return mesh(new T.TorusGeometry(r,tube,10,36),material,parent,x,y,z);
  }
  function cylinder(parent,r1,r2,h,x=0,y=0,z=.42,material=bright){
    return mesh(new T.CylinderGeometry(r1,r2,h,24),material,parent,x,y,z);
  }
  function extrusion(parent,points,material=bright,x=0,y=0,z=.28,depth=.20) {
    const shape=new T.Shape();shape.moveTo(...points[0]);for(const p of points.slice(1))shape.lineTo(...p);shape.closePath();
    const g=new T.ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:true,bevelThickness:.055,bevelSize:.04,bevelSegments:2,curveSegments:8});
    g.computeVertexNormals();return mesh(g,material,parent,x,y,z);
  }
  function star(parent,r=.66,material=bright,y=0){
    const pts=[];for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2;const rr=i%2?r*.46:r;pts.push([Math.cos(a)*rr,Math.sin(a)*rr+y]);}
    return extrusion(parent,pts,material);
  }
  function construct(name,tone) {
    const parent=new T.Group(),accent=metal(palettes[tone]||palettes.gold,.18);
    // Physical, beveled disc; front artwork is REAL geometry, not a flat texture.
    const back=mesh(new T.CylinderGeometry(.91,.93,.22,48),dark,parent,0,0,-.08);
    back.rotation.x=Math.PI/2;
    torus(parent,.85,.064,0,0,.13,accent);
    mesh(new T.CircleGeometry(.80,40),shade,parent,0,0,.057);
    const ring=torus(parent,.76,.015,0,0,.08,silver);
    ring.material.transparent=true;ring.material.opacity=.52;
    switch (name) {
    case 'mail':
      box(parent,1.17,.77,.23,0,0,.40,silver);
      pipe(parent,[[-.55,.29,.58],[0,-.10,.67],[.55,.29,.58]],.045,accent);
      pipe(parent,[[-.55,-.35,.58],[-.10,0,.66]],.038,accent);
      pipe(parent,[[.55,-.35,.58],[.10,0,.66]],.038,accent);break;
    case 'mic': case 'bot':
      cylinder(parent,.24,.24,.66,0,.17,.45,silver);sphere(parent,.235,0,.49,.45,silver);
      pipe(parent,[[-.38,.16,.53],[-.32,-.20,.53],[0,-.34,.52],[.32,-.20,.53],[.38,.16,.53]],.049,accent);
      box(parent,.09,.28,.13,0,-.46,.52,accent);box(parent,.55,.075,.15,0,-.60,.52,silver);break;
    case 'lock':
      box(parent,.93,.73,.34,0,-.20,.42,accent);torus(parent,.37,.115,0,.35,.43,silver);
      sphere(parent,.105,0,-.16,.68,dark);box(parent,.07,.17,.07,0,-.33,.72,dark);break;
    case 'school':
      for(let i=0;i<3;i++){const b=box(parent,1.08-i*.13,.21,.29,-.04,i*.25-.3,.42,i%2?accent:silver);b.rotation.z=i%2?.06:-.045;}
      box(parent,.12,.88,.27,-.56,-.03,.44,accent);break;
    case 'shopping-cart': case 'gift':
      box(parent,.95,.76,.43,0,-.15,.39,accent);
      pipe(parent,[[-.40,.22,.61],[-.40,.49,.62],[.40,.49,.62],[.40,.22,.61]],.058,silver);
      if(name==='gift'){box(parent,.13,.81,.09,0,-.10,.69,silver);box(parent,.94,.10,.09,0,-.07,.71,silver);}break;
    case 'sun':
      sphere(parent,.36,0,0,.52,accent);
      for(let i=0;i<12;i++){const a=i*Math.PI/6;const x=Math.cos(a),y=Math.sin(a);pipe(parent,[[x*.52,y*.52,.45],[x*.73,y*.73,.45]],.055,silver);}break;
    case 'sparkles': case 'star': star(parent,.60,accent);sphere(parent,.11,.49,.47,.47,silver);break;
    case 'folder':
      extrusion(parent,[[-.60,-.44],[.61,-.44],[.61,.29],[-.08,.29],[-.23,.45],[-.60,.45]],accent);
      box(parent,1.11,.52,.10,0,-.11,.57,silver);break;
    case 'calendar-days':
      box(parent,1.07,1.02,.24,0,-.05,.37,silver);
      box(parent,1.07,.27,.10,0,.33,.56,accent);
      for(let i=0;i<6;i++)box(parent,.17,.13,.05,-.35+(i%3)*.35,.00-Math.floor(i/3)*.25,.63,dark);
      break;
    case 'target':
      for(let i=0;i<3;i++)torus(parent,.61-i*.20,.062,0,0,.43+i*.045,i%2?accent:silver);
      sphere(parent,.13,0,0,.66,accent);break;
    case 'bike':
      torus(parent,.31,.055,-.43,-.28,.45,silver);torus(parent,.31,.055,.43,-.28,.45,silver);
      pipe(parent,[[-.43,-.28,.51],[-.14,.25,.51],[.43,-.28,.51],[-.08,-.28,.51],[-.43,-.28,.51]],.055,accent);
      pipe(parent,[[-.14,.25,.52],[.05,.47,.52],[.29,.47,.52]],.052,silver);break;
    case 'heart':
      extrusion(parent,[[-.64,.26],[-.54,.48],[-.28,.60],[0,.37],[.28,.60],[.54,.48],[.64,.26],[.58,-.04],[0,-.65],[-.58,-.04]],accent);break;
    case 'settings':
      torus(parent,.40,.17,0,0,.48,silver);
      for(let i=0;i<10;i++){const a=i*Math.PI/5;const tooth=box(parent,.19,.18,.19,Math.sin(a)*.59,Math.cos(a)*.59,.43,accent);tooth.rotation.z=-a;}
      sphere(parent,.20,0,0,.61,dark);break;
    case 'handshake':
      {const left=box(parent,.59,.23,.3,-.37,-.02,.43,silver);left.rotation.z=-.46;
      const right=box(parent,.59,.23,.3,.37,-.02,.45,accent);right.rotation.z=.46;
      sphere(parent,.24,0,.04,.55,silver);}break;
    case 'clapperboard':
      box(parent,1.12,.68,.26,0,-.22,.4,silver);
      const top=box(parent,1.14,.21,.18,0,.30,.41,accent);top.rotation.z=-.12;
      for(let i=0;i<3;i++){let b=box(parent,.13,.19,.05,-.35+i*.35,.30,.59,dark);b.rotation.z=-.65;}break;
    case 'euro':
      pipe(parent,[[.44,.45,.48],[0,.56,.51],[-.40,.35,.52],[-.5,0,.52],[-.40,-.35,.52],[0,-.54,.51],[.44,-.46,.48]],.105,accent);
      box(parent,.92,.075,.12,-.09,.16,.63,silver);box(parent,.92,.075,.12,-.09,-.15,.63,silver);break;
    case 'eye':
      sphere(parent,.50,0,0,.41,silver);sphere(parent,.33,0,0,.74,accent);sphere(parent,.19,0,0,.94,dark);
      sphere(parent,.065,-.10,.11,1.12,silver);break;
    case 'umbrella':
      {const dome=mesh(new T.SphereGeometry(.64,24,16,0,Math.PI*2,0,Math.PI/2),accent,parent,0,.17,.39);
      dome.rotation.x=-.08;pipe(parent,[[0,.10,.58],[0,-.56,.58],[.15,-.64,.58],[.23,-.54,.58]],.058,silver);}break;
    case 'plane':
      extrusion(parent,[[0,.70],[.16,.06],[.67,-.16],[.67,-.34],[.13,-.25],[.09,-.58],[-.09,-.58],[-.13,-.25],[-.67,-.34],[-.67,-.16],[-.16,.06]],silver);break;
    case 'tag':
      extrusion(parent,[[-.55,-.10],[.04,-.60],[.67,-.10],[.67,.54],[-.12,.54]],accent);
      sphere(parent,.105,.35,.25,.67,dark);break;
    case 'dumbbell':
      box(parent,1.11,.11,.19,0,0,.51,silver);
      for(let side of [-1,1]){box(parent,.17,.72,.27,side*.43,0,.49,accent);box(parent,.12,.46,.31,side*.62,0,.49,silver);}break;
    case 'stethoscope':
      pipe(parent,[[-.40,.51,.49],[-.45,.12,.49],[-.26,-.27,.49],[0,-.38,.49],[.28,-.23,.49],[.28,.16,.49]],.07,silver);
      sphere(parent,.18,.28,.21,.54,accent);break;
    case 'inbox':
      extrusion(parent,[[-.60,-.48],[.60,-.48],[.53,.25],[.24,.25],[.12,-.08],[-.12,-.08],[-.24,.25],[-.53,.25]],accent);
      box(parent,.65,.12,.12,0,.36,.48,silver);break;
    case 'camera': case 'phone':
      box(parent,.99,.71,.33,0,0,.37,accent);
      torus(parent,.28,.095,0,-.04,.60,silver);sphere(parent,.13,0,-.04,.72,dark);
      box(parent,.35,.16,.15,-.28,.40,.39,silver);break;
    default:star(parent,.54,accent);
    }
    parent.rotation.x=-.18;parent.rotation.y=-.26;
    return parent;
  }
  function init() {
    if (renderer || initFailed) return !!renderer;
    try {
      renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'low-power'});
      renderer.setPixelRatio(1);renderer.setSize(152,152,false);
      renderer.outputColorSpace=T.SRGBColorSpace;
      renderer.toneMapping=T.ACESFilmicToneMapping;
      renderer.toneMappingExposure=1.5;
      scene=new T.Scene();
      camera=new T.PerspectiveCamera(36,1,.1,20);camera.position.set(0,.2,4.0);
      scene.add(new T.HemisphereLight(0xffffff,0x243252,2.1));
      const key=new T.DirectionalLight(0xfff0ce,4.2);key.position.set(-3,4,6);scene.add(key);
      const rim=new T.DirectionalLight(0x91caff,2.9);rim.position.set(4,-2,5);scene.add(rim);
      renderer.domElement.addEventListener('webglcontextlost',ev=>{
        ev.preventDefault();initFailed=true;for(const item of targets.values()){item.img.style.display='';item.canvas.remove();}
        targets.clear();cancelAnimationFrame(animation);
      });
      return true;
    }catch {initFailed=true;return false;}
  }
  function scan() {
    pending=false;
    if (!init()) return;
    root.querySelectorAll('img.a2i.o[data-gold-object]').forEach(img=>{
      if(targets.has(img))return;
      const name=img.dataset.goldObject;
      if(!ICON_NAMES.has(name))return; // preserve any unspecified custom approved asset
      const canvas=document.createElement('canvas');
      canvas.className='a2i o janus-live-icon3d';
      canvas.width=152;canvas.height=152;
      canvas.setAttribute('aria-hidden','true');
      canvas.dataset.icon3d=name;
      const selectedTone=img.closest('[data-janus-tone]')?.dataset.janusTone || 'gold';
      img.insertAdjacentElement('afterend',canvas);
      const item={img,canvas,name,tone:selectedTone,visible:true,phase:Math.random()*6.28,drawn:false};
      targets.set(img,item);
      observer?.observe(canvas);
    });
    if (!animation && targets.size) animation=requestAnimationFrame(tick);
  }
  function schedule(){
    if(pending)return;pending=true;queueMicrotask(scan);
  }
  let lastRender=0, cursor=0;
  function tick(time){
    animation=0;
    if(document.visibilityState!=='visible'){animation=requestAnimationFrame(tick);return;}
    if(time-lastRender<90){animation=requestAnimationFrame(tick);return;}
    lastRender=time;
    if(!init())return;
    let drawn=0;
    const all=Array.from(targets);
    // Reparto circular: TODOS los iconos tienen oportunidad de actualizarse;
    // limita renders por fotograma en lugar de dejar invisibles los últimos.
    for (let k=0;k<all.length && drawn<10;k++) {
      const [img,item]=all[(cursor+k)%all.length];
      if (!img.isConnected || !item.canvas.isConnected){targets.delete(img);continue;}
      if(!item.visible)continue;
      drawn++;
      const control=img.closest('.j3d-touch,.j3d-card');
      const lit=!!control?.classList.contains('j3d-lit');
      const shouldAnimate=!reduce(); // visible 3D meshes move subtly; touch boosts their rotation
      if(item.drawn && !shouldAnimate)continue;
      const tone=control?.dataset.janusTone || item.tone;
      const key=item.name+':'+tone;
      let group=cache.get(key);
      if(!group){group=construct(item.name,tone);cache.set(key,group);}
      group.rotation.y=-.26+(reduce()?0:Math.sin(time*.0016+item.phase)*.22)+(lit?.19:0);
      group.rotation.x=-.16+(reduce()?0:Math.cos(time*.0014+item.phase)*.095);
      group.rotation.z=lit?.08:0;
      const speaking=(item.name==='mic'||item.name==='bot') && !!window.Janus3D?.state?.talking;
      group.scale.setScalar(speaking && !reduce()?1+.085*Math.sin(time*.014):1);
      scene.add(group);
      renderer.render(scene,camera);
      scene.remove(group);
      const ctx=item.canvas.getContext('2d');
      if(!ctx)continue;
      ctx.clearRect(0,0,152,152);
      ctx.drawImage(renderer.domElement,0,0,152,152);
      if(!item.drawn){img.style.display='none';item.drawn=true;}
    }
    cursor=all.length ? (cursor+Math.max(1,drawn))%all.length : 0;
    last=time;
    if(targets.size)animation=requestAnimationFrame(tick);
  }
  if ('IntersectionObserver' in window) {
    observer=new IntersectionObserver(entries=>{
      for(const e of entries)for(const item of targets.values())if(e.target===item.canvas)item.visible=e.isIntersecting;
    },{rootMargin:'60px'});
  }
  new MutationObserver(schedule).observe(root,{subtree:true,childList:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});
  else schedule();
  return Object.freeze({available:true,refresh:schedule,geometry:true});
})();
