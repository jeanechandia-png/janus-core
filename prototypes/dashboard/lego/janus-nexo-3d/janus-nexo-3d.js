'use strict';
/* LEGO JANUS NEXO · 02 — cuerpo robótico procedural local, reemplazable por GLB final.
 * IDENTIDAD VISUAL de referencia aprobada: Nexo plateado, ojos azules expresivos,
 * casco por placas, brazos articulados y manos con dedos. Dos variantes seleccionables
 * sin cambiar las funciones, voz, memoria ni autoridad de JANUS CORE.
 * Importante: geometría procedural ≠ modelo cinematográfico GLB VFX definitivo.
 */
const JanusNexo3D = (() => {
  const T = window.THREE;
  const VARIANTS = ['masculino', 'femenino'];
  if (!T) return { supported: () => false, VARIANTS, build: () => null };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const damp = (x, y, k, dt) => x + (y - x) * (1 - Math.exp(-k * dt));
  const MAT = {
    plate: () => new T.MeshPhysicalMaterial({ color: 0xc4c9d1, metalness: 0.82, roughness: 0.21, clearcoat: 0.9, clearcoatRoughness: 0.12, envMapIntensity: 1.65 }),
    highlight: () => new T.MeshPhysicalMaterial({ color: 0xe5e7eb, metalness: 0.78, roughness: 0.18, clearcoat: 1, envMapIntensity: 1.85 }),
    dark: () => new T.MeshPhysicalMaterial({ color: 0x1a1b22, metalness: 0.62, roughness: 0.3, clearcoat: 0.37 }),
    joint: () => new T.MeshPhysicalMaterial({ color: 0x5a5e68, metalness: 0.88, roughness: 0.25 }),
    glow: () => new T.MeshBasicMaterial({ color: 0x84bafc, toneMapped: false }),
    eye: () => new T.MeshPhysicalMaterial({ color: 0xf0eff0, metalness: 0.12, roughness: 0.16, clearcoat: 1 }),
    iris: () => new T.MeshPhysicalMaterial({ color: 0x347db8, metalness: 0.3, roughness: 0.19, clearcoat: 0.85 }),
    black: () => new T.MeshPhysicalMaterial({ color: 0x080b17, metalness: 0.02, roughness: 0.15, clearcoat: 1 })
  };
  const mesh = (g,m,n) => { const o=new T.Mesh(g,m); o.name=n || ''; o.castShadow=true; o.receiveShadow=true; return o; };
  const group = (n) => { const g=new T.Group();g.name=n;return g; };
  const ell = (m,x,y,z,n,seg=28) => {
    const o=mesh(new T.SphereGeometry(1,seg,Math.max(14,Math.floor(seg*0.7))),m,n);
    o.scale.set(x,y,z);return o;
  };
  const cylinder = (m,rt,rb,h,n,seg=28) => mesh(new T.CylinderGeometry(rt,rb,h,seg),m,n);
  const ring = (m,r,t,arc=Math.PI*2,n='') => mesh(new T.TorusGeometry(r,t,10,36,arc),m,n);
  const move = (parent,obj,x,y,z) => { obj.position.set(x,y,z); parent.add(obj);return obj; };
  const join = (parent, color, x,y,z,r) => move(parent,ell(color,r,r,r,'Joint',20),x,y,z);
  const plate = (parent,color,x,y,z,sx,sy,sz,name) => move(parent,ell(color,sx,sy,sz,name),x,y,z);
  const torusLine=(parent,mat,x,y,z,r=0.1,t=0.008)=>move(parent,ring(mat,r,t),x,y,z);

  function build(variant) {
    const v=VARIANTS.includes(variant)?variant:'masculino';
    const female=v==='femenino';
    const skin=MAT.plate(),silver=MAT.highlight(),dark=MAT.dark(),joint=MAT.joint(),neon=MAT.glow();
    const white=MAT.eye(),iris=MAT.iris(),pupil=MAT.black();
    const root=group('JANUS-NEXO-02-'+v), pelvis=group('Pelvis'), torso=group('Chest'), neck=group('Neck'),head=group('Head');
    const shoulders=[], arms=[], legs=[], eyes=[], brows=[], eyeCenters=[], lids=[], fingers=[];
    const R={ root,variant:v,glb:false,slots:{},mood:'contento',speak:0,blink:0,gazeX:0,gazeY:0,smile:0 };
    root.add(pelvis);
    // El robot aprobado es plateado y atlético, con placas segmentadas. La variante
    // femenina es otro ajuste de proporciones y diseño, no cambia la identidad.
    const waist=female?0.33:0.38, chest=female?0.49:0.56, hip=female?0.47:0.42;
    pelvis.add(plate(pelvis,dark,0,1.78,0,hip,0.27,0.29,'Pelvis mechanical'));
    pelvis.add(plate(pelvis,skin,0,1.8,0.18,hip*0.91,0.22,0.23,'Pelvis plate'));
    const body=move(pelvis,torso,0,2.23,0);
    plate(body,dark,0,0,0,waist*1.05,0.55,0.33,'Rib cage graphite');
    plate(body,skin,0,0.12,0.12,chest,0.52,0.34,'Chest shell');
    plate(body,silver,0,0.3,0.28,chest*0.7,0.27,0.17,'Sternum plate');
    // Dos placas pectorales independientes, ranura central y ribetes laterales.
    [-1,1].forEach(side=>{
      const p=plate(body,skin,side*chest*0.49,0.2,0.26,chest*0.44,0.29,0.15,'Pectoral segment '+side);
      p.rotation.z=side*0.13;
      const c=plate(body,joint,side*waist*0.86,-0.26,0.19,0.10,0.22,0.09,'Rib joint '+side);c.rotation.z=side*0.2;
    });
    move(body,plate(body,neon,0,0.07,0.43,0.087,0.087,0.014,'Status crystal'),0,0.07,0.43);
    for(let i=0;i<4;i++){
      const rib=ring(joint,waist*(0.88+i*0.027),0.016,Math.PI*1.05,'Abdomen titanium ring');
      rib.rotation.x=Math.PI*0.5; rib.rotation.z=0.35; move(body,rib,0,-0.24+i*0.11,0.03);
    }
    move(body,neck,0,0.56,0);
    move(neck,cylinder(dark,0.17,0.18,0.35,'Neck gimbal'),0,0.04,0);
    for(let i=0;i<4;i++) {const r=ring(joint,0.154,0.013);r.rotation.x=Math.PI/2;move(neck,r,0,-0.1+i*0.072,0);}
    move(neck,head,0,0.29,0);
    const faceW=female?0.44:0.47, faceH=female?0.53:0.50;
    plate(head,dark,0,0,0,faceW+0.06,faceH+0.06,0.38,'Cranial frame');
    plate(head,skin,0,0.0,0.13,faceW,faceH,0.32,'Face silver');
    // Corona superior dividida y orejeras mecánicas del Nexo aprobado.
    plate(head,silver,0,faceH*0.73,0.12,faceW*0.89,faceH*0.34,0.34,'Forehead cap');
    const center=plate(head,dark,0,faceH*0.92,0.39,0.065,0.09,0.025,'Crown seam');
    [-1,1].forEach(side=>{
      plate(head,skin,side*(faceW+0.04),-0.03,0.07,0.13,0.26,0.15,'Jaw side plate');
      const ear=group('Audio pod '+side);move(head,ear,side*(faceW+0.07),0.06,-0.04);
      const e=ell(joint,0.115,0.155,0.105,'Speaker',26);ear.add(e);
      plate(ear,silver,side*0.025,0,0.06,0.09,0.115,0.036,'Audio surround');
      const ec=ring(neon,0.064,0.008);move(ear,ec,side*0.045,0,0.085);
    });
    // Cejas articuladas, ojos esféricos con iris/pupilas reales y párpados animados.
    for(const side of [-1,1]){
      const cx=side*faceW*0.46,cy=0.055,cz=0.39;
      const orb=group('Eye socket '+side);move(head,orb,cx,cy,cz);
      plate(orb,dark,0,0,-0.014,0.206,0.156,0.078,'Eye gasket');
      plate(orb,white,0,0,0.015,0.184,0.135,0.08,'Sclera');
      const tracking=group('Tracking eye '+side);move(orb,tracking,0,0,0.09);
      plate(tracking,iris,0,0,0,0.079,0.085,0.019,'Iris sapphire');
      plate(tracking,pupil,0,0,0.018,0.034,0.045,0.012,'Pupil');
      plate(tracking,silver,-0.025,0.037,0.036,0.015,0.018,0.008,'Eye catchlight');
      eyes.push(tracking);eyeCenters.push({x:cx,y:cy});
      const lid=group('Upper eyelid '+side);move(orb,lid,0,0.139,0.04);
      const upper=plate(lid,skin,0,0,0,0.197,0.034,0.068,'Upper lid');
      lids.push(lid);
      const brow=group('Expressive eyebrow '+side);
      move(head,brow,cx,0.251,0.49);
      const arch=plate(brow,joint,0,0,0,0.212,female?0.031:0.039,0.025,'Eyebrow');
      arch.rotation.z=-side*(female?0.08:0.16);
      brows.push(brow);
    }
    // Nariz discreta integrada, mandíbula articulada y arco de sonrisa.
    plate(head,skin,0,-0.14,0.48,0.064,0.118,0.075,'Nose fairing');
    const mouth=group('Mouth expressive');
    move(head,mouth,0,-0.265,0.448);
    const smile=ring(joint,0.108,0.017,Math.PI*0.83,'Smiling lips');
    smile.rotation.z=Math.PI*1.1;smile.scale.y=0.48;mouth.add(smile);
    const lip=plate(mouth,dark,0,-0.014,-0.015,0.065,0.016,0.016,'Lip articulation');
    R.mouth=mouth;R.smileMesh=smile;R.lip=lip;
    plate(head,silver,0,-0.375,0.262,faceW*0.62,0.12,0.22,'Chin segment');
    R.head=head;R.eyeMaterials={iris};R.eyes=eyes;R.brows=brows;R.lids=lids;

    function buildArm(side){
      const upper=group('Shoulder '+side);move(body,upper,side*(chest+0.13),0.35,0);
      const ball=join(upper,joint,0,0,0,0.18);
      plate(upper,silver,side*0.055,0.09,0.035,0.245,0.17,0.275,'Shoulder armor');
      const arm=plate(upper,dark,0,-0.32,0,0.145,0.31,0.14,'Biceps mechanics');
      plate(upper,skin,0,-0.30,0.065,0.16,0.285,0.125,'Upper arm shell');
      const elbow=group('Elbow '+side);move(upper,elbow,0,-0.63,0);
      join(elbow,joint,0,0,0,0.13);
      plate(elbow,dark,0,-0.27,0,0.124,0.27,0.12,'Forearm mechanics');
      plate(elbow,silver,0,-0.25,0.065,0.143,0.255,0.11,'Forearm shield');
      const wrist=group('Wrist '+side);move(elbow,wrist,0,-0.54,0);
      join(wrist,joint,0,0,0,0.10);
      const hand=group('Articulated hand '+side);move(wrist,hand,0,-0.11,0.015);
      plate(hand,skin,0,-0.055,0.02,0.165,0.16,0.06,'Palm plate');
      for(let f=0;f<5;f++){
        const digit=group('Finger '+f+' side '+side);
        const fx=(f-2)*0.069,fy=f===0?-0.04:-0.195+(f===4?0.036:f===1?0.016:0);
        move(hand,digit,fx,fy,0.012);
        if(f===0){digit.position.x=side*-0.16;digit.rotation.z=side*0.75;}
        for(let seg=0;seg<2;seg++){
          const len=f===0?0.075:(f===4?0.067:0.095);
          const cap=ell(seg===0?skin:silver,0.025,len*0.56,0.027,'Finger segment '+seg,16);
          move(digit,cap,0,-seg*(len*1.05)-len*0.45,0);
          if(seg===1) cap.rotation.z=0.12;
        }
        fingers.push(digit);
      }
      return {upper,elbow,wrist,hand};
    }
    const armL=buildArm(-1),armR=buildArm(1);arms.push(armL,armR);
    function buildLeg(side){
      const hipJ=group('Hip '+side);move(pelvis,hipJ,side*(hip*0.58),1.64,0);
      join(hipJ,joint,0,0,0,0.175);
      const thigh=group('Thigh '+side);hipJ.add(thigh);
      plate(thigh,dark,0,-0.36,0,0.202,0.39,0.175,'Upper leg mechanics');
      plate(thigh,silver,0,-0.32,0.105,0.21,0.36,0.13,'Thigh plate');
      const knee=group('Knee '+side);move(thigh,knee,0,-0.77,0);
      join(knee,joint,0,0,0,0.145);
      plate(knee,skin,0,-0.025,0.09,0.173,0.15,0.095,'Knee shield');
      const shin=group('Shin '+side);move(knee,shin,0,-0.06,0);
      plate(shin,dark,0,-0.32,0,0.165,0.35,0.15,'Lower leg mechanics');
      plate(shin,silver,0,-0.31,0.11,0.176,0.31,0.105,'Shin armor');
      const ankle=group('Ankle '+side);move(shin,ankle,0,-0.72,0);
      join(ankle,joint,0,0,0,0.105);
      plate(ankle,skin,0,-0.12,0.19,0.20,0.15,0.34,'Boot');
      plate(ankle,dark,0,-0.23,0.24,0.22,0.065,0.37,'Boot sole');
      return {hip:hipJ,thigh,knee,shin,ankle};
    }
    legs.push(buildLeg(-1),buildLeg(1));
    // Mantener la escala real del escenario de manera idéntica en masculino y femenino.
    root.position.y=-0.07;
    R.sockets={Head:head,Chest:body,Hand_L:armL.hand,Hand_R:armR.hand,Foot_L:legs[0].ankle,Foot_R:legs[1].ankle};
    R.setLook=(look)=>{
      if(look && typeof look.eyes==='string' && /^#[0-9a-f]{6}$/i.test(look.eyes)) {
        iris.color.set(look.eyes);
      }
    };
    R.update=(t,dt,ctl)=>{
      ctl=ctl||{};dt=clamp(dt||0.016,0.001,0.07);
      const mood=ctl.mood||'contento',talk=!!(ctl.talk||ctl.pose==='habla'),happy=mood==='alegre'||mood==='contento'||ctl.pose==='celebra';
      const sad=mood==='triste',surprised=mood==='sorprendido',thinking=mood==='pensativo'||ctl.pose==='piensa';
      const blink=(((t+1.3)%4.7)<0.13)?0.1:1;
      R.blink=damp(R.blink||1,blink,32,dt);
      lids.forEach((lid)=>{lid.position.y=0.14-(1-R.blink)*0.12;lid.scale.y=1+(1-R.blink)*1.7;});
      const gx=ctl.gaze&&Number.isFinite(ctl.gaze.x)?ctl.gaze.x:Math.sin(t*0.4)*0.25;
      const gy=ctl.gaze&&Number.isFinite(ctl.gaze.y)?ctl.gaze.y:Math.sin(t*0.3)*0.16;
      R.gazeX=damp(R.gazeX,gx,6,dt);R.gazeY=damp(R.gazeY,gy,6,dt);
      eyes.forEach(o=>{o.position.x=R.gazeX*0.031;o.position.y=R.gazeY*0.023;});
      brows.forEach((b,i)=>{
        const side=i===0?-1:1;
        b.position.y=damp(b.position.y,thinking?0.195:sad?0.21:surprised?0.31:0.251,12,dt);
        b.rotation.z=damp(b.rotation.z,sad?side*0.24:thinking?side*0.19:happy?-side*0.09:0,10,dt);
      });
      R.smile=damp(R.smile,happy?1:sad?-0.6:surprised?-0.15:0.4,10,dt);
      smile.rotation.z=R.smile>=0?Math.PI*1.1:Math.PI*0.12;
      smile.scale.x=damp(smile.scale.x,surprised?0.46:happy?1.18:0.94,10,dt);
      smile.scale.y=damp(smile.scale.y,talk?(0.5+Math.abs(Math.sin(t*13))*1.5):surprised?1.65:sad?0.48:0.69,12,dt);
      mouth.position.y=damp(mouth.position.y,talk?-0.27:surprised?-0.30:-0.265,12,dt);
      head.rotation.z=damp(head.rotation.z,(thinking?-0.12:sad?0.08:0)+Math.sin(t*0.9)*0.025,6,dt);
      head.rotation.y=damp(head.rotation.y,R.gazeX*0.14+Math.sin(t*0.4)*0.04,6,dt);
      body.rotation.z=Math.sin(t*0.77)*0.012;body.rotation.x=Math.sin(t*1.2)*0.018;
      const wave=ctl.pose==='saluda'||ctl.pose==='celebra',open=ctl.pose==='habla'||talk;
      arms[0].upper.rotation.z=damp(arms[0].upper.rotation.z,-0.27+(open?0.18:0),6,dt);
      arms[1].upper.rotation.z=damp(arms[1].upper.rotation.z,wave?-1.7:open?-0.7:0.27,6,dt);
      arms[1].elbow.rotation.z=damp(arms[1].elbow.rotation.z,wave?-0.35:open?-0.7:0.12,7,dt);
      arms[0].elbow.rotation.z=damp(arms[0].elbow.rotation.z,open?-0.25:0.08,7,dt);
      arms[1].wrist.rotation.z=wave?Math.sin(t*8)*0.30:0;
      for(let i=0;i<fingers.length;i++) fingers[i].rotation.z=Math.sin(t*1.6+i)*0.025;
      legs.forEach((l,i)=>{l.thigh.rotation.x=damp(l.thigh.rotation.x,ctl.walk?Math.sin(t*5+i*Math.PI)*Math.min(0.45,ctl.walk*0.3):0,6,dt);});
      root.position.y=-0.07+Math.sin(t*1.15)*0.013;
    };
    R.dispose=()=>{
      const used=new Set();
      root.traverse(o=>{
        if(o.geometry&&!used.has(o.geometry)){used.add(o.geometry);o.geometry.dispose();}
        const mats=Array.isArray(o.material)?o.material:[o.material];
        mats.forEach(m=>{if(m&&!used.has(m)){used.add(m);if(m.dispose)m.dispose();}});
      });
    };
    return R;
  }
  return { VARIANTS, build, supported: () => true };
})();
window.JanusNexo3D = JanusNexo3D;
