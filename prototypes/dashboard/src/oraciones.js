'use strict';
/* ===== Oraciones del Founder (orden de Jean, 24-nov-2026) =====
 * Padre Nuestro recitado en hebreo y en latín (sin griego, orden del Founder 24-nov 13:20); Ángel de la Guarda y
 * San Miguel Arcángel en latín. Texto, pronunciación, traducción y fuente; voz del propio aparato, sin nube.
 * Datos: lego/janus-oraciones (fuente única). Aquí solo se pinta.
 */
const ORA = { id: 'pater', lang: 'he', playing: false };
const oraLangs = (id) => JanusOraciones.langsFor(id, 'founder');
function vOraciones(M, X, sub) {
  const list = JanusOraciones.forAudience('founder');
  const p = JanusOraciones.byId(ORA.id) || list[0];
  const langs = oraLangs(p.id);
  if (!langs.includes(ORA.lang)) ORA.lang = langs[0];
  const L = JanusOraciones.LANGS[ORA.lang], t = p.texts[ORA.lang];
  const left = panel('', '✝', 'Oraciones', list.length + '',
    '<div class="rdl">' + list.map((q) => '<div class="rdo' + (q.id === p.id ? ' on' : '') + '"' + act('oraSel', q.id, q.title) + '><div class="rdo2"><b>' + esc(q.title) + '</b></div><div class="rdo3 mono">' + (q.latinTitle ? esc(q.latinTitle) + ' · ' : '') + oraLangs(q.id).map((l) => JanusOraciones.LANGS[l].name).join(' · ') + '</div></div>').join('') + '</div>');
  const tabs = '<div class="rdb">' + langs.map((l) => '<span class="btn" aria-pressed="' + (l === ORA.lang) + '" style="' + (l === ORA.lang ? 'background:var(--gold,#c9a227);color:#fff;font-weight:700' : '') + '"' + act('oraLang', l, JanusOraciones.LANGS[l].name) + '>' + esc(JanusOraciones.LANGS[l].name) + (l === p.original ? ' · original' : '') + '</span>').join('') + '</div>';
  const text = '<div class="ora-text" lang="' + ORA.lang + '" dir="' + L.dir + '" style="font-size:1.35em;line-height:1.55;font-weight:600;' + (L.dir === 'rtl' ? 'text-align:right;font-size:1.6em;' : '') + '">' + t.lines.map((x) => '<div>' + esc(x) + '</div>').join('') + '</div>';
  const say = t.say ? '<div class="note" style="margin-top:12px"><b>Cómo se pronuncia</b>' + t.say.map((x) => '<div>' + esc(x) + '</div>').join('') + '</div>' : '';
  const es = ORA.lang !== 'es' && p.texts.es ? '<div class="note" style="margin-top:12px"><b>En español</b>' + p.texts.es.lines.map((x) => '<div>' + esc(x) + '</div>').join('') + '</div>' : '';
  const voice = JanusOraciones.hasVoice(ORA.lang);
  const play = '<div class="rdb"><span class="btn"' + act(ORA.playing ? 'oraStop' : 'oraSpeak', ORA.lang, ORA.playing ? 'Parar' : 'Escuchar') + '>' + (ORA.playing ? '■ Parar' : '▶ Escuchar') + '</span></div>' +
    (voice ? '' : ORA.lang === 'he'
      ? '<div class="note mono">Este aparato aún no tiene la voz hebrea. iPhone: Ajustes › Accesibilidad › Contenido leído › Voces › Hebreo (descárgala). Android: Ajustes › Accesibilidad › Salida de texto a voz › motor de Google › Instalar datos de voz › Hebreo. Luego vuelve a pulsar Escuchar.</div>'
      : '<div class="note mono">Este aparato no tiene voz en ' + esc(L.name.toLowerCase()) + ': se intentará con la voz por defecto.</div>');
  const center = panel('', '✝', esc(p.title), esc(p.latinTitle || ''), tabs + text + play + say + es +
    '<div class="note mono">' + esc(t.source) + (L.note ? ' ' + esc(L.note) : '') + '</div>');
  return frame('oraciones', sub, M, '<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr);gap:14px;align-items:start"><div>' + left + '</div><div>' + center + '</div></div>');
}
VIEWS.oraciones = vOraciones;
// No ocupa sitio en la barra de pestañas (orden del Founder: sin desplazamiento lateral). Se abre desde el menú ☰ y solo
// aparece en la barra mientras se está en ella.
TABS.push(['oraciones', '✝', 'Oraciones', 'menu']);
const ORA_ACTS = {
  oraSel: (id) => { JanusOraciones.stop(); ORA.playing = false; ORA.id = id; },
  oraLang: (l) => { JanusOraciones.stop(); ORA.playing = false; ORA.lang = l; },
  oraSpeak: () => { ORA.playing = JanusOraciones.speak(ORA.id, ORA.lang, { onEnd: () => { ORA.playing = false; rerender(); } }); },
  oraStop: () => { JanusOraciones.stop(); ORA.playing = false; },
};
