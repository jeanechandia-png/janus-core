'use strict';
/* ===== janus-interpreter · pantalla del intérprete consecutivo (LEGO 1.0.0-pilot) =====
 * Pieza de interfaz reutilizable (JANUS hoy, Infinity Connect mañana). Pareja de la pieza de servidor
 * packages/modules/contextual-interpreter. No lleva datos de ningún caso ni guarda nada en el navegador:
 * el acta vive en memoria mientras la pantalla está abierta y solo se descarga si el usuario lo pide.
 *
 * Uso:  JanusInterpreter.open({ endpoint, noticeEndpoint, headers: () => ({...}), title, clientLang: 'es', otherLang: 'nl',
 *                               counterpartRole: 'police officer', clientName: 'Jean', labels: { client: 'Yo', other: 'Agente' } })
 * Voz: dictado y lectura del navegador (Web Speech). Si el navegador no tiene dictado, se escribe y JANUS lo lee igual.
 */
(function () {
  const LOCALE = { es: 'es-ES', nl: 'nl-NL', en: 'en-GB', de: 'de-DE', fr: 'fr-FR', pt: 'pt-PT', it: 'it-IT', pl: 'pl-PL', tr: 'tr-TR', ar: 'ar-SA', uk: 'uk-UA', ro: 'ro-RO' };
  const NAME = { es: 'Español', nl: 'Nederlands', en: 'English', de: 'Deutsch', fr: 'Français', pt: 'Português', it: 'Italiano', pl: 'Polski', tr: 'Türkçe', ar: 'العربية', uk: 'Українська', ro: 'Română' };
  const S = { cfg: null, root: null, turns: [], busy: false, rec: null, recLang: '', heard: '', notice: null, modelReady: null, err: '' };
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const SR = () => window.SpeechRecognition || window.webkitSpeechRecognition || null;
  const hhmm = (d) => { try { return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }); } catch (e) { return ''; } };

  function speak(text, lang) {
    return new Promise((resolve) => {
      try {
        if (!text || !('speechSynthesis' in window)) return resolve(false);
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text); u.lang = LOCALE[lang] || lang; u.rate = 0.95;
        const voice = speechSynthesis.getVoices().find((v) => v.lang && v.lang.toLowerCase().startsWith(lang));
        if (voice) u.voice = voice;
        u.onend = () => resolve(true); u.onerror = () => resolve(false);
        speechSynthesis.speak(u);
      } catch (e) { resolve(false); }
    });
  }

  function stopListening() { try { if (S.rec) S.rec.stop(); } catch (e) { } }
  function listen(lang) {
    const Rec = SR();
    if (!Rec) { S.err = 'Este navegador no permite dictado: escribe la frase abajo y pulsa «Traducir».'; paint(); return; }
    if (S.rec) { stopListening(); return; } // segundo toque = «terminé»
    try { speechSynthesis.cancel(); } catch (e) { }
    const rec = new Rec(); rec.lang = LOCALE[lang] || lang; rec.interimResults = true; rec.continuous = true;
    S.rec = rec; S.recLang = lang; S.heard = ''; S.err = '';
    rec.onresult = (ev) => { let t = ''; for (let i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript; S.heard = t.trim(); paintLive(); };
    rec.onerror = (ev) => { S.err = ev.error === 'not-allowed' ? 'El micrófono está bloqueado: permite el micrófono para esta página.' : 'El dictado se cortó (' + ev.error + ').'; };
    rec.onend = () => { const text = S.heard; const from = S.recLang; S.rec = null; S.recLang = ''; S.heard = ''; paint(); if (text) translate(from, text); };
    try { rec.start(); } catch (e) { S.rec = null; S.err = 'No se pudo abrir el micrófono.'; }
    paint();
  }

  async function translate(from, text) {
    const c = S.cfg; if (!c || S.busy || !text.trim()) return;
    const to = from === c.clientLang ? c.otherLang : c.clientLang;
    S.busy = true; S.err = ''; paint();
    try {
      const res = await fetch(c.endpoint, { method: 'POST', headers: c.headers(), cache: 'no-store', body: JSON.stringify({
        from, to, text, speaker: from === c.clientLang ? 'founder' : 'counterpart', counterpartRole: c.counterpartRole,
        history: S.turns.filter((t) => t.target).slice(-6).map((t) => ({ from: t.from, source: t.source, target: t.target })),
      }) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || ('HTTP ' + res.status));
      const r = out.result;
      const turn = { at: new Date(), from, to, source: text, target: r.translation, clarify: r.clarify, confirm: r.confirm || [], uncertain: r.uncertain || [] };
      S.turns.push(turn); S.busy = false; paint();
      if (r.clarify) await speak(r.clarify, from); else await speak(r.translation, to);
    } catch (e) { S.busy = false; S.err = 'Sin traducción: ' + e.message + '. No se ha dicho nada a la otra parte.'; paint(); }
  }

  function download() {
    const c = S.cfg; if (!S.turns.length) return;
    const lines = ['ACTA DE INTERPRETACIÓN · ' + (c.title || '') + ' · ' + new Date().toLocaleString('es-ES'), 'Interpretación asistida por IA (JANUS). No es una traducción jurada.', ''];
    S.turns.forEach((t) => { lines.push('[' + hhmm(t.at) + '] ' + (t.from === c.clientLang ? c.labels.client : c.labels.other) + ' (' + t.from + '): ' + t.source); lines.push('            → (' + t.to + '): ' + (t.target || '[pidió repetir] ' + (t.clarify || ''))); if (t.confirm.length) lines.push('            ⚠ confirmar: ' + t.confirm.join(', ')); lines.push(''); });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'acta-interpretacion-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.txt';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function paintLive() { const el = S.root && S.root.querySelector('[data-ji="live"]'); if (el) el.textContent = S.heard || '…'; }

  function turnHtml(t) {
    const c = S.cfg, mine = t.from === c.clientLang;
    return '<div class="ji-turn ' + (mine ? 'me' : 'them') + '"><div class="ji-who">' + esc(mine ? c.labels.client : c.labels.other) + ' · ' + hhmm(t.at) + '</div>' +
      '<div class="ji-src">' + esc(t.source) + '</div>' +
      (t.clarify ? '<div class="ji-tgt ji-ask">↺ ' + esc(t.clarify) + '</div>' : '<div class="ji-tgt">' + esc(t.target) + '</div>') +
      (t.confirm.length ? '<div class="ji-warn">⚠ Confirmad en voz alta: <b>' + esc(t.confirm.join(' · ')) + '</b></div>' : '') +
      (t.uncertain.length ? '<div class="ji-doubt">Duda del intérprete: ' + esc(t.uncertain.join(' · ')) + '</div>' : '') + '</div>';
  }

  function paint() {
    const c = S.cfg, r = S.root; if (!c || !r) return;
    const last = S.turns[S.turns.length - 1];
    const listeningClient = S.rec && S.recLang === c.clientLang, listeningOther = S.rec && S.recLang === c.otherLang;
    r.innerHTML = '<div class="ji-box" role="dialog" aria-modal="true" aria-label="Intérprete">' +
      '<div class="ji-head"><b>🎧 Intérprete · ' + esc(c.title || '') + '</b><span class="ji-st">' + (S.modelReady === false ? '⚠ sin modelo conectado' : S.busy ? 'traduciendo…' : S.rec ? '● escuchando' : 'listo') + '</span><span class="ji-x" data-ji="close" role="button" tabindex="0" aria-label="Cerrar">✕</span></div>' +
      '<div class="ji-note">Interpretación por IA. Primero preséntala a la otra parte. Para una declaración formal, la policía puede exigir un tolk oficial.</div>' +
      '<div class="ji-row"><span class="ji-btn sm" data-ji="notice">📢 Presentar a JANUS (' + esc(NAME[c.otherLang] || c.otherLang) + ')</span>' + (last && last.target ? '<span class="ji-btn sm" data-ji="repeat">🔁 Repetir última</span>' : '') + '<span class="ji-btn sm" data-ji="dl">⬇ Acta</span><span class="ji-btn sm" data-ji="clear">Borrar</span></div>' +
      '<div class="ji-big">' +
      '<span class="ji-btn mic me' + (listeningClient ? ' on' : '') + '" data-ji="mic-client">🎙 ' + (listeningClient ? 'Terminé' : esc(c.labels.client) + ' hablo') + '<small>' + esc(NAME[c.clientLang] || c.clientLang) + '</small></span>' +
      '<span class="ji-btn mic them' + (listeningOther ? ' on' : '') + '" data-ji="mic-other">🎙 ' + (listeningOther ? 'Klaar' : esc(c.labels.other)) + '<small>' + esc(NAME[c.otherLang] || c.otherLang) + '</small></span></div>' +
      (S.rec ? '<div class="ji-live" data-ji="live">' + esc(S.heard || '…') + '</div>' : '') +
      (S.err ? '<div class="ji-err">' + esc(S.err) + '</div>' : '') +
      (last ? '<div class="ji-now">' + turnHtml(last) + '</div>' : '<div class="ji-empty">Pulsa el botón de quien va a hablar. Al terminar, vuelve a pulsarlo: JANUS traduce y lo lee en voz alta.</div>') +
      '<div class="ji-type"><select data-ji="lang" aria-label="Idioma de la frase"><option value="' + esc(c.clientLang) + '">' + esc(NAME[c.clientLang]) + '</option><option value="' + esc(c.otherLang) + '">' + esc(NAME[c.otherLang]) + '</option></select><input data-ji="text" type="text" maxlength="2000" placeholder="O escribe la frase…" aria-label="Frase"><span class="ji-btn sm" data-ji="send">Traducir</span></div>' +
      (S.turns.length > 1 ? '<div class="ji-log">' + S.turns.slice(0, -1).reverse().map(turnHtml).join('') + '</div>' : '') + '</div>';
  }

  function onClick(ev) {
    const el = ev.target.closest('[data-ji]'); if (!el) return;
    const k = el.getAttribute('data-ji'), c = S.cfg;
    if (k === 'close') return close();
    if (k === 'mic-client') return listen(c.clientLang);
    if (k === 'mic-other') return listen(c.otherLang);
    if (k === 'notice') { if (S.notice) speak(S.notice[c.otherLang] || S.notice.nl, c.otherLang); return; }
    if (k === 'repeat') { const t = S.turns[S.turns.length - 1]; if (t && t.target) speak(t.target, t.to); return; }
    if (k === 'dl') return download();
    if (k === 'clear') { S.turns = []; S.err = ''; return paint(); }
    if (k === 'send') { const input = S.root.querySelector('[data-ji="text"]'), sel = S.root.querySelector('[data-ji="lang"]'); const text = input ? input.value.trim() : ''; if (text) translate(sel ? sel.value : c.clientLang, text); }
  }
  function onKey(ev) { if (!S.root) return; if (ev.key === 'Escape') return close(); if (ev.key === 'Enter' && ev.target.matches('[data-ji="text"]')) onClick({ target: S.root.querySelector('[data-ji="send"]') }); }

  async function open(cfg) {
    close();
    S.cfg = Object.assign({ clientLang: 'es', otherLang: 'nl', counterpartRole: 'official', headers: () => ({ 'content-type': 'application/json' }), labels: { client: 'Yo', other: 'Otra parte' } }, cfg || {});
    S.cfg.labels = Object.assign({ client: 'Yo', other: 'Otra parte' }, (cfg && cfg.labels) || {});
    S.turns = []; S.err = ''; S.notice = null; S.modelReady = null;
    const root = document.createElement('div'); root.className = 'ji-ov'; S.root = root;
    root.addEventListener('click', onClick); document.addEventListener('keydown', onKey);
    document.body.appendChild(root); paint();
    if (S.cfg.noticeEndpoint) {
      try { const res = await fetch(S.cfg.noticeEndpoint + '?name=' + encodeURIComponent(S.cfg.clientName || ''), { headers: S.cfg.headers(), cache: 'no-store' }); const out = await res.json(); if (res.ok) { S.notice = out.notice; S.modelReady = !!out.modelReady; } } catch (e) { }
      paint();
    }
  }
  function close() { document.removeEventListener('keydown', onKey); stopListening(); try { speechSynthesis.cancel(); } catch (e) { } if (S.root) S.root.remove(); S.root = null; S.cfg = null; S.turns = []; }

  window.JanusInterpreter = { open, close, isOpen: () => !!S.root, _state: S };
})();
