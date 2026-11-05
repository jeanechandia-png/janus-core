'use strict';
/* ===== Avatar de Janus · el MISMO robot de la Sala se transforma =====
 * No hay sección aparte: el robot que está junto al chat (dashboard del teléfono y Sala) cambia de FORMA y de ÁNIMO.
 *   formas: robot · cabeza (cabeza del robot con ojos y boca expresivos) · cara (ojos y sonrisa flotantes) · Lumi · Bombo · Musgo · Nimbo
 *   Si hay un GLB importado (robot hiperrealista o criaturas) en JanusCreatureSlot, se usa en lugar del procedural.
 * Persistencia: ST.settings.form / ST.settings.eyes. Lo dibuja lego/janus-3d; aquí solo está el estado, los controles y las reacciones.
 */
const AV_FORMS = [['robot', 'Robot'], ['cabeza', 'Cabeza'], ['cara', 'Cara'], ['lumi', 'Lumi'], ['bombo', 'Bombo'], ['musgo', 'Musgo'], ['nimbo', 'Nimbo']];
const AV_MOODS = [['alegre', 'Alegre'], ['contento', 'Contento'], ['triste', 'Triste'], ['enojado', 'Enojado'], ['sorprendido', 'Sorprendido'], ['pensativo', 'Pensativo']];
const AV_EYES = [['#FFD36A', 'Dorado'], ['#59E4D4', 'Turquesa'], ['#8EC8FF', 'Cielo'], ['#FF8FB6', 'Rosa'], ['#B79CFF', 'Lila'], ['#9BE564', 'Lima']];
const AV_CREAT = ['lumi', 'bombo', 'musgo', 'nimbo'];
const avForm = () => (window.Janus3D && Janus3D.FORMS && Janus3D.FORMS.includes(ST.settings.form) ? ST.settings.form : 'robot');
const avFormName = (f) => (AV_FORMS.find((x) => x[0] === f) || [0, 'Robot'])[1];

/** Aspecto (pelo, ropa, accesorios) de la criatura elegida: el mismo que se configura en el Vestidor. */
function avLookFor(f) {
  if (!AV_CREAT.includes(f) || typeof Companion === 'undefined' || typeof compState !== 'function') return null;
  try { const C = compState(), p = Companion.newKitProfile('hija', CHILD, f); p.names = C.names; p.looks = C.looks; Companion.worldOf(p); return hexLook(Companion.lookOf(p)); } catch (e) { return null; }
}
/** Lleva el estado guardado al robot 3D (se llama en cada render; solo reconstruye si algo cambió de verdad). */
function avatarSync() {
  const J = window.Janus3D; if (!J || !J.setForm) return;
  const f = avForm(); J.setEyes(ST.settings.eyes || '#FFD36A'); J.setLook(avLookFor(f)); J.setForm(f);
}
/** Dos botones sobre el propio robot de la Sala (como el ✦ del teléfono): transformar y abrir/plegar los controles. No ocupan altura. */
function avatarGear() {
  const open = avOpen();
  return '<span class="avgear"><span class="avg"' + act('avNext', '', 'Transformar a Janus (robot, cabeza, cara o criatura)') + '>' + gIco('sparkles') + '</span><span class="avg"' + act('avToggle', '', open ? 'Plegar los controles del robot' : 'Personalizar el robot') + ' aria-expanded="' + open + '">' + gIco('settings') + '</span></span>';
}
/** Controles: forma, ánimo, color de ojos y hueco para el modelo 3D del robot. Se pinta en la Sala, junto al robot. */
function avatarPanel() {
  const cur = avForm(), eyes = ST.settings.eyes || '#FFD36A', S = window.JanusCreatureSlot, sl = S && S.supported && S.supported() ? S : null, inf = sl && sl.info ? sl.info('robot') : null;
  const chip = (a, arg, label, on, extra) => '<span class="avchip' + (on ? ' on' : '') + '"' + act(a, arg, label) + (extra || '') + '>' + esc(label) + '</span>';
  const live = window.Janus3D && Janus3D.mood ? Janus3D.mood() : 'contento';
  const open = avOpen(), bar = '<div class="avbar mono"' + act('avToggle', '', open ? 'Plegar el panel del robot' : 'Personalizar el robot') + ' aria-expanded="' + open + '"><span>Robot · ' + esc(avFormName(cur)) + ' · ' + esc(live) + '</span><b>' + (open ? 'Plegar ▴' : 'Personalizar ▾') + '</b></div>';
  if (!open) return '';
  return '<div class="avc">' + bar + '<div class="avbody">' +
    '<div class="avh mono">Forma · es el mismo robot, que se transforma</div><div class="avr">' + AV_FORMS.map((f) => chip('avForm', f[0], f[1], f[0] === cur)).join('') + '</div>' +
    '<div class="avh mono">Ánimo</div><div class="avr">' + AV_MOODS.map((m) => chip('avMood', m[0], m[1], m[0] === live)).join('') + '</div>' +
    '<div class="avh mono">Color de ojos y boca</div><div class="avr">' + AV_EYES.map((c) => '<span class="avsw' + (c[0].toLowerCase() === String(eyes).toLowerCase() ? ' on' : '') + '" style="--c:' + c[0] + '"' + act('avEyes', c[0], 'Ojos ' + c[1]) + '></span>').join('') + '</div>' +
    (sl ? '<div class="avh mono">Modelo 3D del robot (GLB hiperrealista)</div><div class="avr"><label class="avchip cpfile">⬆ Importar GLB<input type="file" accept=".glb,model/gltf-binary" data-slotfile="robot" aria-label="Importar el modelo GLB del robot"></label>' + (inf ? '<span class="avchip"' + act('cpSlotDel', 'robot', 'Quitar el modelo del robot') + '>✕ Quitar</span>' : '') + '</div>' +
      '<div class="avn mono dim">' + (typeof COMP_UI !== 'undefined' && COMP_UI.slotMsg && /Robot/.test(COMP_UI.slotMsg) ? esc(COMP_UI.slotMsg) : inf ? 'GLB · ' + esc(inf.name) + ' · ' + esc(inf.summary) : 'Sin modelo: se usa el robot procedural de ahora. Se guarda solo en este dispositivo.') + '</div>' : '') +
    '</div></div>';
}
/** El panel llega plegado en tablet (la Sala cabe en una pantalla) y desplegado en teléfono (columna con scroll). */
const AV_UI = { open: null };
const avOpen = () => (AV_UI.open === null ? (typeof isPhone === 'function' ? isPhone() : window.innerWidth < 700) : AV_UI.open);
const AV_ACTS = {
  avToggle: () => { AV_UI.open = !avOpen(); if (typeof rerender === 'function') rerender(); },
  avForm: (f) => { const J = window.Janus3D; if (!J || !J.FORMS.includes(f)) return; ST.settings.form = f; saveState(); avatarSync(); J.react(2.4, 'alegre'); },
  avNext: () => { const ids = AV_FORMS.map((x) => x[0]), i = ids.indexOf(avForm()); AV_ACTS.avForm(ids[(i + 1) % ids.length]); },
  avMood: (m) => { const J = window.Janus3D; if (J) { J.setMood(m, 10); J.react(1.6); } },
  avEyes: (hex) => { ST.settings.eyes = hex; saveState(); avatarSync(); }
};
