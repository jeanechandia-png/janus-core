'use strict';
/* ===== Oraciones del Founder (orden de Jean, 24-nov-2026) =====
 * Padre Nuestro recitado en arameo (Peshitta, con subtítulos línea a línea, 24-nov 14:07), hebreo y latín (sin griego,
 * orden del Founder 24-nov 13:20); Ángel de la Guarda y
 * San Miguel Arcángel en latín. Texto, pronunciación, traducción y fuente; voz del propio aparato, sin nube.
 * Datos: lego/janus-oraciones (fuente única). Aquí solo se pinta.
 */
const ORA = { id: 'pater', lang: 'arc', playing: false, line: -1, premium: null };
// Voz de Janus (ElevenLabs, configurada en la tablet) para el arameo. keep: la tablet genera cada línea UNA sola vez y la
// guarda en disco; las siguientes veces suena gratis desde ahí (orden del Founder: no pagar cada reproducción).
const ORA_AUDIO = new Map();
async function oraPremiumAudio(text) {
  if (ORA.premium === false) return null;
  if (ORA_AUDIO.has(text)) return ORA_AUDIO.get(text);
  const headers = { 'content-type': 'application/json' };
  try { const tk = sessionStorage.getItem('janus.founder.session'); if (tk) headers.authorization = 'Bearer ' + tk; } catch (e) { /* sin sesión */ }
  try {
    const res = await fetch('/api/voice/speak', { method: 'POST', headers, body: JSON.stringify({ profile: 'janus', text, keep: true }), cache: 'no-store' });
    if (!res.ok) { ORA.premium = false; return null; }
    const url = URL.createObjectURL(await res.blob());
    ORA.premium = true; ORA_AUDIO.set(text, url); return url;
  } catch (e) { ORA.premium = false; return null; }
}
const oraLangs = (id) => JanusOraciones.langsFor(id, 'founder');
function vOraciones(M, X, sub) {
  const list = JanusOraciones.forAudience('founder');
  const p = JanusOraciones.byId(ORA.id) || list[0];
  const langs = oraLangs(p.id);
  if (!langs.includes(ORA.lang)) ORA.lang = langs[0];
  const L = JanusOraciones.LANGS[ORA.lang], t = p.texts[ORA.lang];
  const left = panel('', '✝', ft('Oraciones'), list.length + '',
    '<div class="rdl">' + list.map((q) => '<div class="rdo' + (q.id === p.id ? ' on' : '') + '"' + act('oraSel', q.id, q.title) + '><div class="rdo2"><b>' + esc(q.title) + '</b></div><div class="rdo3 mono">' + (q.latinTitle ? esc(q.latinTitle) + ' · ' : '') + oraLangs(q.id).map((l) => JanusOraciones.LANGS[l].name).join(' · ') + '</div></div>').join('') + '</div>');
  const tabs = '<div class="rdb">' + langs.map((l) => '<span class="btn" aria-pressed="' + (l === ORA.lang) + '" style="' + (l === ORA.lang ? 'background:var(--gold,#c9a227);color:#fff;font-weight:700' : '') + '"' + act('oraLang', l, JanusOraciones.LANGS[l].name) + '>' + esc(JanusOraciones.LANGS[l].name) + (JanusOraciones.LANGS[l].tag ? ' · ' + esc(JanusOraciones.LANGS[l].tag) : l === p.original ? ' · original' : '') + '</span>').join('') + '</div>';
  const text = t.sub
    // Recitado con subtítulos: original, cómo suena y qué significa, línea a línea; la línea que suena se ilumina.
    ? '<div class="ora-text">' + t.lines.map((x, i) => '<div style="padding:10px 12px;margin:6px 0;border-radius:12px;' + (i === ORA.line ? 'background:rgba(201,162,39,.16);box-shadow:inset 3px 0 0 var(--gold,#c9a227);' : '') + '">' +
        '<div lang="syr" dir="rtl" style="text-align:right;font-size:1.7em;line-height:1.5;font-family:' + esc(L.font || 'serif') + '">' + esc(x) + '</div>' +
        '<div style="font-weight:700;font-size:1.1em">' + esc(t.say[i]) + '</div>' +
        (t.translit ? '<div class="mono" style="opacity:.7">' + esc(t.translit[i]) + '</div>' : '') +
        '<div style="font-style:italic;margin-top:2px">' + esc(t.sub[i]) + '</div></div>').join('') + '</div>'
    : '<div class="ora-text" lang="' + ORA.lang + '" dir="' + L.dir + '" style="font-size:1.35em;line-height:1.55;font-weight:600;' + (L.dir === 'rtl' ? 'text-align:right;font-size:1.6em;' : '') + '">' + t.lines.map((x) => '<div>' + esc(x) + '</div>').join('') + '</div>';
  const say = t.say && !t.sub ? '<div class="note" style="margin-top:12px"><b>' + esc(ft("Cómo se pronuncia")) + '</b>' + t.say.map((x) => '<div>' + esc(x) + '</div>').join('') + '</div>' : '';
  const es = ORA.lang !== 'es' && !t.sub && p.texts.es ? '<div class="note" style="margin-top:12px"><b>' + esc(ft("En español")) + '</b>' + p.texts.es.lines.map((x) => '<div>' + esc(x) + '</div>').join('') + '</div>' : '';
  const voice = JanusOraciones.hasVoice(ORA.lang);
  const play = '<div class="rdb"><span class="btn"' + act(ORA.playing ? 'oraStop' : (t.sub ? 'oraRecite' : 'oraSpeak'), ORA.lang, ORA.playing ? 'Parar' : 'Escuchar') + '>' + (ORA.playing ? '■ Parar' : (t.sub ? '▶ Recitar con subtítulos' : '▶ Escuchar')) + '</span></div>' +
    (t.sub ? '<div class="note mono">' + (ORA.premium === true ? 'Voz: Janus (ElevenLabs).' : ORA.premium === false ? 'La voz de Janus aún no está configurada en este equipo: recita la voz del aparato con pronunciación aproximada.' : 'Recita la voz de Janus si está configurada; si no, la del aparato con pronunciación aproximada.') + '</div>' + (t.notes || []).map((n) => '<div class="note">' + esc(n) + '</div>').join('')
    : voice ? '' : ORA.lang === 'he'
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
  oraSel: (id) => { JanusOraciones.stop(); ORA.playing = false; ORA.line = -1; ORA.id = id; },
  oraLang: (l) => { JanusOraciones.stop(); ORA.playing = false; ORA.line = -1; ORA.lang = l; },
  oraRecite: () => {
    const run = JanusOraciones.recite(ORA.id, ORA.lang, { fetchAudio: oraPremiumAudio,
      onLine: (i) => { ORA.line = i; rerender(); }, onEnd: () => { ORA.playing = false; ORA.line = -1; rerender(); } });
    ORA.playing = Boolean(run);
  },
  oraSpeak: () => { ORA.playing = JanusOraciones.speak(ORA.id, ORA.lang, { onEnd: () => { ORA.playing = false; rerender(); } }); },
  oraStop: () => { JanusOraciones.stop(); ORA.playing = false; ORA.line = -1; },
};
