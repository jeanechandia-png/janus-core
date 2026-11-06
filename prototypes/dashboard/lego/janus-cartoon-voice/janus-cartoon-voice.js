'use strict';
/* LEGO JANUS Cartoon Voice v2 — una sola voz caricaturesca compartida por todas las criaturas.
 * No cambia la voz de Nexo ni la identidad de JANUS CORE.
 * Sin claves ni servicios externos: voz nativa del dispositivo/browser (Web Speech).
 * La calidad y la disponibilidad real dependen de las voces instaladas. "Caricatura"
 * significa prosodia (tono, velocidad, ritmo), NO una voz neuronal profesional.
 *
 * API:
 * JanusCartoonVoice.speak(text, id, {style, mood, enabled, force, onStart, onEnd});
 * .preview(id, opts), .profile(id, style), .stop(), .supported(), .setAdapter(adapter)
 *
 * Los adaptadores futuros deben ser reemplazables: speak({text,id,profile,...}) y stop().
 * NO se crean solicitudes de red ni se suben mensajes de Kendra.
 */
const JanusCartoonVoice = (() => {
  // Una identidad vocal, con un solo timbre/preset para todas las criaturas.
  // El texto de muestra cambia por personaje; la voz y los controles no.
  const SHARED_VOICE = Object.freeze({
    voiceId: 'cartoon-shared-v1',
    label: 'Voz caricaturesca compartida',
    pitch: 1.58, rate: 1.12, volume: 0.94, voiceOffset: 0, lang: 'es-ES'
  });
  const CARTOON = Object.freeze({
    lumi: Object.freeze({ sample: '¡Hola, Kendra! ¡Soy tu chispa de aventuras! ¡Tachán!' }),
    bombo: Object.freeze({ sample: '¡Bloop bloop! ¡Hola, Kendra! ¡A saltar entre estrellas!' }),
    musgo: Object.freeze({ sample: '¡Jummm! ¡Hola, Kendra! ¡En el bosque hay aventuras!' }),
    nimbo: Object.freeze({ sample: '¡Hola, Kendra! ¡Viajemos entre nubes brillantes!' })
  });
  const STYLES = Object.freeze({
    caricatura: Object.freeze({ label: 'Caricatura', pitch: 0, rate: 0, volume: 0 }),
    traviesa: Object.freeze({ label: 'Traviesa', pitch: 0.17, rate: 0.10, volume: 0 }),
    dulce: Object.freeze({ label: 'Dulce', pitch: -0.12, rate: -0.10, volume: -0.06 }),
    teatral: Object.freeze({ label: 'Teatral', pitch: 0.04, rate: -0.07, volume: 0 })
  });
  const LABELS = Object.freeze(Object.keys(STYLES).map((key) => Object.freeze({ id: key, label: STYLES[key].label })));
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const clean = (txt) => String(txt || '')
    .normalize('NFC').replace(/[<>]/g, '').replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, 420);
  function profile(id, style, mood) {
    const k = Object.prototype.hasOwnProperty.call(CARTOON,id) ? id : 'lumi';
    const s = Object.prototype.hasOwnProperty.call(STYLES,style) ? style : 'caricatura';
    const c = CARTOON[k], mode = STYLES[s];
    const expression = mood === 'alegre' ? { pitch: 0.07, rate: 0.04 } :
      mood === 'triste' ? { pitch: -0.11, rate: -0.12 } :
      mood === 'sorprendido' ? { pitch: 0.12, rate: 0.09 } :
      mood === 'pensativo' ? { pitch: -0.05, rate: -0.06 } : { pitch: 0, rate: 0 };
    return Object.freeze({
      id: k, style: s, voiceId: SHARED_VOICE.voiceId, label: SHARED_VOICE.label, sample: c.sample,
      pitch: +clamp(SHARED_VOICE.pitch + mode.pitch + expression.pitch, 0.6, 1.95).toFixed(2),
      rate: +clamp(SHARED_VOICE.rate + mode.rate + expression.rate, 0.7, 1.45).toFixed(2),
      volume: +clamp(SHARED_VOICE.volume + mode.volume, 0.55, 1).toFixed(2),
      voiceOffset: SHARED_VOICE.voiceOffset, lang: SHARED_VOICE.lang
    });
  }
  function engine() {
    if (typeof window === 'undefined') return null;
    return window.speechSynthesis || null;
  }
  function supported() { return !!(engine() && typeof window.SpeechSynthesisUtterance === 'function'); }
  let adapter = null;
  let active = 0;
  function stop() {
    active++;
    if (adapter && typeof adapter.stop === 'function') {
      try { adapter.stop(); } catch (_) {}
    }
    const e=engine();
    if (e && typeof e.cancel === 'function') {
      try { e.cancel(); } catch (_) {}
    }
  }
  function voiceFor(synthesis, p) {
    const voices = synthesis && typeof synthesis.getVoices === 'function' ? synthesis.getVoices() : [];
    const spanish = (Array.isArray(voices) ? voices : []).filter((v) => /^es(?:-|_)/i.test(v.lang || '') || /^es$/i.test(v.lang || ''));
    // Priorizar las voces que el SO declara locales. No garantiza independencia
    // si el navegador no informa de localService.
    const local = spanish.filter((v) => v.localService === true);
    const list = local.length ? local : spanish;
    if (!list.length) return null;
    list.sort((a,b) => String(a.name || '').localeCompare(String(b.name || '')));
    // Siempre el mismo timbre de voz del dispositivo, independientemente de la especie.
    return list[0];
  }
  function setAdapter(next) {
    if (next != null && (typeof next.speak !== 'function' || typeof next.stop !== 'function'))
      return false;
    stop(); adapter=next || null; return true;
  }
  function speak(text, id, opts) {
    const o=opts || {};
    const p=profile(id, o.style, o.mood);
    const phrase=clean(text);
    if (!phrase || (o.enabled === false && !o.force)) return { ok:false, reason:!phrase?'empty':'muted', profile:p };
    stop();
    const current=active;
    if (adapter) {
      try {
        // Adaptador local reemplazable; nunca se suministra aquí credencial alguna.
        const result=adapter.speak({ text:phrase, id:p.id, profile:p, onStart:o.onStart, onEnd:o.onEnd });
        return { ok:true, engine:'adapter', profile:p, result };
      } catch (e) { return { ok:false, reason:'adapter-error', profile:p }; }
    }
    const e=engine();
    if (!e || typeof window.SpeechSynthesisUtterance !== 'function') return { ok:false, reason:'unavailable', profile:p };
    try {
      const u=new window.SpeechSynthesisUtterance(phrase);
      u.lang=p.lang; u.pitch=p.pitch; u.rate=p.rate; u.volume=p.volume;
      const voice=voiceFor(e,p);
      if (voice) {u.voice=voice; u.lang=voice.lang || p.lang;}
      u.onstart=()=>{if (current===active && typeof o.onStart==='function')o.onStart(p);};
      const end=()=>{if (current===active && typeof o.onEnd==='function')o.onEnd(p);};
      u.onend=end; u.onerror=end;
      e.speak(u);
      return { ok:true, engine:'web-speech', profile:p, voice:voice?voice.name:null };
    } catch (_) {
      return { ok:false, reason:'speech-error', profile:p };
    }
  }
  function preview(id, opts) {
    const o=opts || {}, p=profile(id, o.style, 'alegre');
    return speak(p.sample,id,{...o, mood:'alegre', force:true});
  }
  return Object.freeze({
    profiles:CARTOON, sharedVoice:SHARED_VOICE, styles:LABELS, profile, supported, speak, preview, stop, setAdapter
  });
})();
window.JanusCartoonVoice=JanusCartoonVoice;
