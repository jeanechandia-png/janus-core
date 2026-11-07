'use strict';
/* JANUS · Tacto 3D — único motor compartido en A/B/Kendra.
 * Sin librerías, sin red, sin telemetría, sin consumo de créditos.
 * Conserva acciones y clases originales, solo añade atributos cosméticos.
 * El material y el brillo responden a puntero, toque y teclado.
 */
const JanusTactile = (() => {
  const BUTTONS = '[data-act],[data-go],.btn,.btn2,.tb2,.cptab,.pill2,.avchip,.sg,.jg-cta,.jg-row,.jpc-launch,button:not([disabled]),.go[role="button"]';
  const CARDS = '.a2c,.cd,.cptabs,.cpst3,.kpi,.hc,.dy,.ml,.fu,.ev,.tc,.kt,.jp,.rb,.a2stat,.a2sala';
  const TONES = ['gold','cobalt','amethyst','emerald','rose','teal','copper','indigo','coral'];
  const TOUCH_LIMIT = 780;
  let active = null, flash = null, observer = null, scheduled = false;
  const reduce = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const text = (node) => ((node.getAttribute('aria-label') || '') + ' ' +
    (node.getAttribute('data-go') || '') + ' ' + (node.getAttribute('data-act') || '') +
    ' ' + (node.textContent || '').slice(0, 110)).normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase();
  function tone(node, i) {
    const s = text(node);
    const matches = [
      [/aprend|escuela|matemat|estrell|premio/,'gold'],
      [/vestidor|moda|ropa|estilo|accesori/,'rose'],
      [/tienda|compra|oferta|bono/,'amethyst'],
      [/mundo|casa|jardin|bosque|plantas/,'emerald'],
      [/hablar|microfono|voz|escuchar|camar|foto/,'cobalt'],
      [/papa|familia|privado|segur/,'copper'],
      [/llegada|bienven|clima|nube/,'teal'],
      [/navidad|corazon|celebr/,'rose'],
      [/noche|descanso|luna/,'indigo'],
      [/apagar|borrar|salir|eliminar|alerta/,'coral'],
      [/resumen|agenda|dia|prioridad/,'teal'],
      [/sala|janus|robot|nexo/,'indigo'],
      [/cliente|seguimiento|contact/,'emerald'],
      [/correo|mensaje|email/,'cobalt'],
      [/dato|reporte|estadistic/,'amethyst'],
      [/pago|costes|factura|ingreso/,'copper'],
      [/camara/,'cobalt']
    ];
    for (const [pattern, name] of matches) if (pattern.test(s)) return name;
    // Distribución reproducible, no monocromática ni aleatoria cada render.
    const key = s.trim() || String(i);
    let hash = 0;
    for (let j = 0; j < key.length; j++) hash = (hash * 31 + key.charCodeAt(j)) | 0;
    return TONES[Math.abs(hash) % TONES.length];
  }
  function id(node) {
    return (node.getAttribute('data-act') || node.getAttribute('data-go') || '') + ':' +
      (node.getAttribute('data-arg') || '') + ':' + (node.getAttribute('aria-label') || node.textContent?.trim().slice(0, 32) || '');
  }
  function scan() {
    scheduled = false;
    const root = document.getElementById('app');
    if (!root) return;
    document.documentElement.classList.add('janus-tactile-ui');
    root.querySelectorAll(BUTTONS).forEach((el, i) => {
      if (el.matches('input,select,textarea,label,[disabled],[aria-hidden="true"]')) return;
      el.classList.add('j3d-touch');
      if (!el.dataset.janusTone) el.dataset.janusTone = tone(el,i);
      if (flash && flash.id === id(el) && Date.now() - flash.at < TOUCH_LIMIT) {
        el.classList.add('j3d-lit');
        window.setTimeout(() => el.classList.remove('j3d-lit'), TOUCH_LIMIT);
      }
    });
    root.querySelectorAll(CARDS).forEach((el,i) => {
      el.classList.add('j3d-card');
      if (!el.dataset.janusTone) el.dataset.janusTone = tone(el,i);
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
