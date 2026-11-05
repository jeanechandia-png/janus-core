'use strict';
/* NEXO — identidad del avatar de JANUS CORE / Founder.
 * Apariencia masculina y femenina del MISMO asistente: sin alterar memoria,
 * permisos, respuestas, voz ni preferencias de Kendra.
 * El diseño aprobado NEXO 02 plateado es la referencia masculina. La femenina
 * conserva el lenguaje visual; los GLB VFX finales son artefactos independientes.
 */
const AV_FORMS = [['robot', 'Robot completo'], ['cabeza', 'Cabeza'], ['cara', 'Rostro']];
const AV_MOODS = [['alegre','Alegre'],['contento','Contento'],['triste','Triste'],['enojado','Enojado'],['sorprendido','Sorprendido'],['pensativo','Pensativo']];
const AV_EYES = [['#347DB8','Azul Nexo'],['#8EC8FF','Azul claro'],['#59E4D4','Turquesa'],['#FFD36A','Dorado'],['#FF8FB6','Rosa'],['#B79CFF','Lila']];
const AV_VARIANTS = [['masculino', 'Masculino'], ['femenino', 'Femenino']];
const avVariant = () => ST.settings.nexoVariant === 'femenino' ? 'femenino' : 'masculino';
const avForm = () => AV_FORMS.some(x => x[0] === ST.settings.form) ? ST.settings.form : 'robot';
const avFormName = f => (AV_FORMS.find(x=>x[0]===f)||['robot','Robot completo'])[1];
function avatarSync() {
  const J=window.Janus3D; if (!J || !J.setForm) return;
  J.setVariant(avVariant());
  J.setEyes(ST.settings.eyes || '#347DB8');
  J.setLook(null); // no heredar colores, ropa ni personalidad de criaturas de Kendra
  J.setForm(avForm());
}
function avatarGear() {
  const open=avOpen();
  return '<span class="avgear">' +
    '<span class="avg"' + act('avVariantNext', '', 'Cambiar entre versión masculina y femenina de Nexo') + ' aria-label="Cambiar versión de Nexo">↔</span>' +
    '<span class="avg"' + act('avToggle', '', open ? 'Plegar personalización Nexo' : 'Personalizar Nexo') +
      ' aria-expanded="' + open + '">' + gIco('settings') + '</span></span>';
}
function avatarPanel() {
  const cur=avForm(),v=avVariant(),eyes=ST.settings.eyes||'#347DB8';
  const slot=window.JanusCreatureSlot;
  const sl=slot&&slot.supported&&slot.supported()?slot:null;
  const glbId=v==='femenino'?'robot-femenino':'robot';
  const inf=sl&&sl.info?sl.info(glbId):null;
  const chip=(a,arg,label,on)=>'<button type="button" class="avchip' + (on?' on':'') + '"' +
    act(a,arg,label) + ' aria-pressed="' + (on?'true':'false') + '">' + esc(label) + '</button>';
  const mood=window.Janus3D&&Janus3D.mood?Janus3D.mood():'contento';
  const open=avOpen();
  const bar='<div class="avbar mono"' + act('avToggle','','Personalizar Nexo') +
    ' aria-expanded="' + open + '"><span>Nexo 02 · ' + (v==='femenino'?'Femenino':'Masculino') +
    ' · ' + esc(mood) + '</span><b>' + (open?'Plegar ▴':'Personalizar ▾') + '</b></div>';
  if (!open) return bar;
  return '<div class="avc">' + bar + '<div class="avbody">' +
    '<div class="avh mono">Versión del robot</div><div class="avr">' +
    AV_VARIANTS.map(x=>chip('avVariant',x[0],x[1],v===x[0])).join('') + '</div>' +
    '<p class="avn mono dim">Ambas versiones son Janus: misma memoria, acceso, tareas y decisiones. Solo cambia la apariencia del cuerpo.</p>' +
    '<div class="avh mono">Vista del robot</div><div class="avr">' +
    AV_FORMS.map(x=>chip('avForm',x[0],x[1],cur===x[0])).join('') + '</div>' +
    '<div class="avh mono">Expresiones</div><div class="avr">' +
    AV_MOODS.map(x=>chip('avMood',x[0],x[1],mood===x[0])).join('') + '</div>' +
    '<div class="avh mono">Color de ojos</div><div class="avr">' +
    AV_EYES.map(x=>'<button type="button" class="avsw' +
      (x[0].toLowerCase()===String(eyes).toLowerCase()?' on':'') +
      '" style="--c:'+x[0]+'"' + act('avEyes',x[0],x[1]) +
      ' aria-label="Ojos '+x[1]+'" aria-pressed="'+(x[0]===eyes?'true':'false')+'"></button>').join('') + '</div>' +
    '<div class="avh mono">Modelo 3D de alta fidelidad · ' + (v==='femenino'?'femenino':'masculino') + '</div>' +
    (sl?'<div class="avr"><label class="avchip cpfile">Importar GLB de ' +
      (v==='femenino'?'Nexo femenino':'Nexo masculino') +
      '<input type="file" accept=".glb,model/gltf-binary" data-slotfile="'+glbId+'" aria-label="Importar GLB '+v+'"></label>' +
      (inf?chip('cpSlotDel',glbId,'Quitar modelo GLB',false):'')+'</div>':'')+
    '<p class="avn mono dim">' + (inf?'Modelo importado: '+esc(inf.name)+'. '+esc(inf.summary):
      'Se está mostrando el Nexo 3D plateado procedural. El modelo de cine con fidelidad exacta a la imagen aprobada aún requiere importar el GLB riggeado de esta versión.')+
    '</p></div></div>';
}
const AV_UI={open:null};
const avOpen=()=>AV_UI.open===null?(typeof isPhone==='function'?isPhone():window.innerWidth<700):AV_UI.open;
const AV_ACTS={
  avToggle:()=>{AV_UI.open=!avOpen();if(typeof rerender==='function')rerender();},
  avForm:(f)=>{
    if(!AV_FORMS.some(x=>x[0]===f))return;
    ST.settings.form=f;saveState();avatarSync();
    if(window.Janus3D)Janus3D.react(2.4,'alegre');
  },
  avVariant:(v)=>{
    if(!AV_VARIANTS.some(x=>x[0]===v))return;
    ST.settings.nexoVariant=v; ST.settings.form='robot';
    saveState();avatarSync();
    if(window.Janus3D)Janus3D.react(2.1,'alegre');
  },
  avVariantNext:()=>AV_ACTS.avVariant(avVariant()==='masculino'?'femenino':'masculino'),
  avNext:()=>{const ids=AV_FORMS.map(x=>x[0]),i=ids.indexOf(avForm());AV_ACTS.avForm(ids[(i+1)%ids.length]);},
  avMood:(m)=>{const J=window.Janus3D;if(J&&AV_MOODS.some(x=>x[0]===m)){J.setMood(m,10);J.react(1.6);}},
  avEyes:(hex)=>{if(!AV_EYES.some(x=>x[0]===hex))return;ST.settings.eyes=hex;saveState();avatarSync();}
};
