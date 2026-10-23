/* ===== Pieza LEGO: janus-activity v0.1.0 =====
 * Señal de actividad de Janus: medallón del logo (gira y se ilumina) + Mini-Jano (robot de dos caras).
 * Sin dependencias. Cualquier landing o producto la monta igual:
 *   const sig = JanusActivity.mount(el, { kind: 'robot' | 'medallion', medalSrc });
 *   sig.set('listo' | 'escuchando' | 'pensando' | 'ejecutando' | 'aprobacion');
 * También sirve como marcado estático: pon data-js="<estado>" en cualquier contenedor.
 */
(function (root) {
  'use strict';
  const STATES = ['listo', 'escuchando', 'pensando', 'ejecutando', 'aprobacion'];
  /* Robot Mini-Jano (dos caras). Diseño original de Janus. */
  function robotSvg(cls) {
    return '<svg class="mj ' + (cls || '') + '" viewBox="0 0 120 150" aria-hidden="true">' +
      '<defs><linearGradient id="mjb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF3D1"/><stop offset=".45" stop-color="#E8C37A"/><stop offset="1" stop-color="#7A4F12"/></linearGradient>' +
      '<linearGradient id="mjd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2620"/><stop offset="1" stop-color="#0a0a0c"/></linearGradient></defs>' +
      '<g class="mj-dots" fill="#E8C37A"><circle cx="80" cy="12" r="3"/><circle cx="89" cy="7" r="3"/><circle cx="98" cy="3" r="3"/></g>' +
      '<g class="mj-bub"><rect x="82" y="0" width="28" height="22" rx="9" fill="#FFB454"/><text x="96" y="16" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-weight="700" font-size="14" fill="#1b1206">!</text></g>' +
      '<g class="mj-spk" stroke="#5FD39A" stroke-width="2.4" stroke-linecap="round"><path d="M14 40l-6-4M106 40l6-4M10 70H2M110 70h8M20 100l-6 4M100 100l6 4"/></g>' +
      '<ellipse class="mj-sh" cx="60" cy="140" rx="26" ry="4" fill="#000" opacity=".55"/>' +
      '<g class="mj-all"><g class="mj-ant"><line x1="60" y1="22" x2="60" y2="30" stroke="url(#mjb)" stroke-width="2.5"/><circle class="mj-glow" cx="60" cy="18" r="4.5"/></g>' +
      '<g class="mj-head"><rect x="34" y="30" width="52" height="42" rx="16" fill="url(#mjb)"/><rect x="40" y="37" width="40" height="27" rx="11" fill="url(#mjd)"/><path d="M34 46h-4M86 46h4" stroke="#A8752A" stroke-width="5" stroke-linecap="round"/>' +
      '<g class="mj-f1"><circle class="mj-glow" cx="52" cy="50" r="3.6"/><circle class="mj-glow" cx="68" cy="50" r="3.6"/><path d="M53 57q7 4 14 0" stroke="#E8C37A" stroke-width="2" fill="none" stroke-linecap="round"/></g>' +
      '<g class="mj-f2"><rect class="mj-glow" x="48" y="48" width="8" height="3" rx="1.5"/><rect class="mj-glow" x="64" y="48" width="8" height="3" rx="1.5"/><path d="M53 58h14" stroke="#E8C37A" stroke-width="2" stroke-linecap="round"/></g>' +
      '<path d="M38 33q22-9 44 0" stroke="#FFF6DA" stroke-width="1.5" fill="none" opacity=".7"/></g>' +
      // Cuerpo articulado: hombros/codos y caderas/rodillas son grupos con su propio pivote.
      '<g class="mj-legL"><path d="M53 103L52 113" stroke="url(#mjb)" stroke-width="6.5" stroke-linecap="round"/><circle cx="53" cy="103" r="3.4" fill="#A8752A"/><g class="mj-legL-2"><path d="M52 113L51 121" stroke="url(#mjb)" stroke-width="5.5" stroke-linecap="round"/><circle cx="52" cy="113" r="2.8" fill="#8a5a1c"/><rect x="43" y="120" width="12" height="5" rx="2.5" fill="#A8752A"/></g></g>' +
      '<g class="mj-legR"><path d="M67 103L68 113" stroke="url(#mjb)" stroke-width="6.5" stroke-linecap="round"/><circle cx="67" cy="103" r="3.4" fill="#A8752A"/><g class="mj-legR-2"><path d="M68 113L69 121" stroke="url(#mjb)" stroke-width="5.5" stroke-linecap="round"/><circle cx="68" cy="113" r="2.8" fill="#8a5a1c"/><rect x="65" y="120" width="12" height="5" rx="2.5" fill="#A8752A"/></g></g>' +
      '<rect x="42" y="74" width="36" height="30" rx="10" fill="url(#mjb)"/><rect x="46" y="78" width="28" height="7" rx="3.5" fill="#fff6da" opacity=".25"/><circle class="mj-glow" cx="60" cy="90" r="4"/>' +
      '<g class="mj-armL"><path d="M44 81L35 91" stroke="url(#mjb)" stroke-width="6.5" stroke-linecap="round"/><circle cx="44" cy="81" r="3.4" fill="#A8752A"/><g class="mj-armL-2"><path d="M35 91L33 101" stroke="url(#mjb)" stroke-width="5.5" stroke-linecap="round"/><circle cx="35" cy="91" r="2.8" fill="#8a5a1c"/><circle cx="33" cy="102" r="4" fill="url(#mjb)"/></g></g>' +
      '<g class="mj-armR"><path d="M76 81L85 91" stroke="url(#mjb)" stroke-width="6.5" stroke-linecap="round"/><circle cx="76" cy="81" r="3.4" fill="#A8752A"/><g class="mj-armR-2"><path d="M85 91L87 101" stroke="url(#mjb)" stroke-width="5.5" stroke-linecap="round"/><circle cx="85" cy="91" r="2.8" fill="#8a5a1c"/><circle cx="87" cy="102" r="4" fill="url(#mjb)"/></g></g>' +
      '</g>' +
      '<g class="mj-ok"><circle cx="100" cy="22" r="11" fill="#5FD39A"/><path d="M95 22l4 4 7-8" stroke="#0b1a12" stroke-width="2.6" fill="none" stroke-linecap="round"/></g></svg>';
  }
  /* Medallón bifronte (moneda de Jano) con aro de actividad. */
  function medallionHtml(src, cls) { return '<div class="mdl ' + (cls || '') + '"><div class="mdl-c"><img src="' + src + '" alt=""><img src="' + src + '" alt=""></div></div>'; }
  function mount(el, opt) {
    const o = opt || {};
    el.setAttribute('data-js', 'listo');
    el.innerHTML = o.kind === 'medallion' ? medallionHtml(o.medalSrc || '', o.cls) : robotSvg(o.cls);
    return { set: (s) => { if (STATES.indexOf(s) >= 0) el.setAttribute('data-js', s); }, get: () => el.getAttribute('data-js'), destroy: () => { el.innerHTML = ''; el.removeAttribute('data-js'); } };
  }
  root.JanusActivity = { version: '0.1.0', STATES, robotSvg, medallionHtml, mount };
})(typeof window !== 'undefined' ? window : globalThis);
