'use strict';
/* JANUS · Tacto 3D — único motor compartido en A/B/Kendra.
 * Sin librerías, sin red, sin telemetría, sin consumo de créditos.
 * Conserva acciones y clases originales, solo añade atributos cosméticos.
 * El material y el brillo responden a puntero, toque y teclado.
 */
const JanusTactile = (() => {
  // Política de coherencia aprobada: únicamente navegación y acciones principales.
  // Un artículo de tienda NO pasa a ser botón decorativo por tener data-act.
  const BUTTONS = '.btn,.btn2,.tb2,.cptab,.pill2,.avchip,.sg,.jg-cta,.jpc-launch,.cp-pilot-camera button,.a2hl';
  const CARDS = '.a2c,.cd,.cptabs';
  const EXCLUDE = '.cpchips,.cpc,.cp-approved-grid,.cp-approved-card,.cp-approved-faces,.cp-approved-expression,.a2pj,.cpgr .cp-approved-card';
  // CORRECCIÓN VISUAL APROBADA: dos materiales, no un arcoíris.
  // Cada tarjeta comparte un borde neutro; las acciones destacan en bronce
  // respecto al fondo. Los indicadores de estado originales no se alteran.
  const TOUCH_LIMIT = 780;
  let active = null, flash = null, observer = null, scheduled = false;
  const reduce = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const tone = (kind) => kind === 'card' ? 'frame' : 'bronze';
  function id(node) {
    return (node.getAttribute('data-act') || node.getAttribute('data-go') || '') + ':' +
      (node.getAttribute('data-arg') || '') + ':' + (node.getAttribute('aria-label') || node.textContent?.trim().slice(0, 32) || '');
  }
  // Transformar iconos planos heredados de acciones en objetos Gold/3D reales.
  // Mantiene intactos el texto, las acciones y los datos personalizados.
  const iconGlyphs = Object.freeze({
    '📚':'school','🎓':'school','🏫':'school','👗':'shopping-cart',
    '🛒':'shopping-cart','🛍':'shopping-cart','🛍️':'shopping-cart',
    '⭐':'sparkles','🌟':'sparkles','✨':'sparkles','🎁':'gift','🏆':'target',
    '🎯':'target','📷':'eye','📸':'eye','📹':'eye','💬':'mic','💭':'mic',
    '🎤':'mic','🎙':'mic','🔊':'mic','🏠':'sun','🏡':'sun',
    '🔒':'lock','🔐':'lock','🔑':'lock','👨':'lock','👨‍👧':'lock',
    '⚙':'settings','⚙️':'settings','📦':'folder','📁':'folder',
    '⏱':'calendar-days','📅':'calendar-days','🔍':'eye',
    '🎨':'sparkles','👑':'sparkles','🧥':'shopping-cart',
    '🚗':'bike','🚲':'bike','✈':'plane','❤️':'heart','❤':'heart',
    '📧':'mail','✉':'mail','📨':'mail','📥':'inbox','💶':'euro',
    '🔔':'sparkles','💡':'sun','🧠':'mic','🤖':'mic','🚀':'plane',
    '🏷':'tag','🎬':'clapperboard','✂':'settings','✏':'tag',
    '💎':'sparkles','🎒':'shopping-cart','🎮':'settings'
  });
  function hydrateActionIcons(root) {
    if (typeof gIco !== 'function') return;
    root.querySelectorAll(BUTTONS).forEach(el=>{
      if(el.closest(EXCLUDE)) return;
      if(el.hasAttribute('data-janus-action-3d') || el.querySelector('img.a2i,canvas.janus-live-icon3d')) return;
      const first=el.firstChild;
      if(!first || first.nodeType!==3)return;
      const text=first.textContent;
      const m=/^\s*([\p{Extended_Pictographic}\uFE0F\u200D]+)\s*/u.exec(text);
      if(!m)return;
      const key=iconGlyphs[m[1]];
      if(!key || !GOLD?.o?.[key]) return;
      first.textContent=text.slice(m[0].length);
      const span=document.createElement('span');
      span.className='janus-action-icon-3d';
      span.setAttribute('aria-hidden','true');
      span.innerHTML=gIco(key,'janus-action-object');
      el.insertBefore(span,first);
      el.setAttribute('data-janus-action-3d',key);
    });
  }
  function scan() {
    scheduled = false;
    const root = document.getElementById('app');
    if (!root) return;
    document.documentElement.classList.add('janus-tactile-ui');
    hydrateActionIcons(root);
    // Proteger el catálogo y restaurar clases erróneas del mismo DOM.
    root.querySelectorAll('.cpchips .j3d-touch,.cp-approved-grid .j3d-touch,.a2pj.j3d-touch,.cpc.j3d-touch')
      .forEach(el=>{el.classList.remove('j3d-touch','j3d-pressed','j3d-lit');el.removeAttribute('data-janus-tone');});
    root.querySelectorAll(BUTTONS).forEach((el, i) => {
      if (el.closest(EXCLUDE) || el.matches('input,select,textarea,label,[disabled],[aria-hidden="true"]')) return;
      el.classList.add('j3d-touch');
      el.dataset.janusTone = tone('button');
      if (flash && flash.id === id(el) && Date.now() - flash.at < TOUCH_LIMIT) {
        el.classList.add('j3d-lit');
        window.setTimeout(() => el.classList.remove('j3d-lit'), TOUCH_LIMIT);
      }
    });
    root.querySelectorAll(CARDS).forEach((el,i) => {
      el.classList.add('j3d-card');
      el.dataset.janusTone = tone('card');
    });
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    // MutationObserver ve la actualización de la dashboard tras cada acción,
    // sin modificar render() ni reconstruir el producto.
    queueMicrotask(scan);
  }
  function point(el, ev) {
    const r = el.getBoundingClientRect();
    if (!(r.width > 1 && r.height > 1)) return;
    const x = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
    const y = Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height));
    el.style.setProperty('--j3d-shine-x', (100 * x).toFixed(1) + '%');
    el.style.setProperty('--j3d-shine-y', (100 * y).toFixed(1) + '%');
    if (!reduce() && el.classList.contains('j3d-touch')) {
      el.style.setProperty('--j3d-tilt-x', ((.5 - y) * 6).toFixed(2) + 'deg');
      el.style.setProperty('--j3d-tilt-y', ((x - .5) * 8).toFixed(2) + 'deg');
    }
  }
  function target(ev) {
    const el = ev.target;
    return el instanceof Element ? el.closest('.j3d-touch,.j3d-card') : null;
  }
  function light(el) {
    if (!el) return;
    const card = el.closest('.j3d-card');
    for (const item of [el,card]) {
      if (!item) continue;
      item.classList.add('j3d-lit');
      window.setTimeout(() => item.classList.remove('j3d-lit'), TOUCH_LIMIT);
    }
  }
  function start(ev) {
    const el=target(ev);
    if (!el || !document.getElementById('app')?.contains(el)) return;
    active = el; point(el,ev);
    if (el.classList.contains('j3d-touch')) el.classList.add('j3d-pressed');
    light(el);
    if (el.classList.contains('j3d-touch')) flash = { id: id(el), at: Date.now() };
  }
  function finish() {
    if (!active) return;
    active.classList.remove('j3d-pressed');
    active.style.removeProperty('--j3d-tilt-x');
    active.style.removeProperty('--j3d-tilt-y');
    active = null;
  }
  function keyboard(ev) {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    const el=target(ev);
    if (!el || !document.getElementById('app')?.contains(el)) return;
    light(el);
  }
  function attach() {
    const app = document.getElementById('app');
    if (!app) return;
    scan();
    observer = new MutationObserver(schedule);
    observer.observe(app,{subtree:true,childList:true});
    document.addEventListener('pointerdown',start,{passive:true});
    document.addEventListener('pointerup',finish,{passive:true});
    document.addEventListener('pointercancel',finish,{passive:true});
    document.addEventListener('pointermove',ev=>{
      const el=target(ev);
      if(!el || !app.contains(el) || (ev.pointerType==='touch' && active!==el)) return;
      point(el,ev);
    },{passive:true});
    document.addEventListener('keydown',keyboard);
    window.addEventListener('blur',finish);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',attach,{once:true});
  else attach();
  return Object.freeze({ refresh: schedule });
})();
