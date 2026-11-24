/* janus-oraciones · Oraciones católicas en su lengua original y en español (pieza LEGO v1.0.0).
 * Orden del Founder (24-nov-2026): Padre Nuestro en latín y en su lengua original, Ángel de la Guarda y San Miguel
 * Arcángel para Jean; oraciones para niños para Kendra, con la opción de aprender el latín si ella quiere.
 * Fuente única: este archivo. apps/pwa/approved-3d/janus-oraciones.js es su espejo idéntico (lo comprueba la prueba).
 * Sin dependencias, sin red, sin datos personales. Voz: la del propio aparato (speechSynthesis), sin nube de pago.
 * Orden del Founder (24-nov-2026, 13:20): sin griego; Janus recita el Padre Nuestro en hebreo y en latín.
 * 14:07: y en arameo, la lengua de Jesús (Peshitta), con subtítulos en español línea a línea.
 * Verdad: el Evangelio se escribió en griego (Mateo 6, 9-13) y Jesús hablaba arameo; el hebreo era la lengua de las
 * Escrituras y de la oración en la sinagoga. El texto hebreo es la versión de Delitzsch (1901, dominio público).
 * El Ángel de la Guarda y San Miguel se compusieron en latín.
 */
(function (root) {
  'use strict';
  const LANGS = {
    la: { name: 'Latín', speak: 'it-IT', dir: 'ltr', note: 'Pronunciación eclesiástica (romana). El aparato no tiene voz latina: se lee con voz italiana, que es la más cercana.' },
    arc: { name: 'Arameo', tag: 'lengua de Jesús', speak: null, dir: 'rtl', font: "'Noto Sans Syriac','Noto Sans Syriac Eastern','Estrangelo Edessa','Serto Jerusalem',serif",
      note: 'El arameo era la lengua de Jesús. El Padre Nuestro se conserva en arameo en la Peshitta, la Biblia siríaca (un dialecto del arameo) de los primeros siglos. No es una grabación de sus palabras exactas: es lo más cercano que existe. Ningún teléfono trae voz aramea: lo recita la voz de Janus (ElevenLabs) o, si no está configurada, la voz del aparato con pronunciación aproximada.' },
    he: { name: 'Hebreo', speak: 'he-IL', alt: ['iw'], dir: 'rtl', note: 'Hebreo bíblico, la lengua de las Escrituras y de la oración en la sinagoga. Jesús hablaba arameo, lengua hermana del hebreo; el Evangelio se escribió después en griego. Versión hebrea de Franz Delitzsch (1901, dominio público).' },
    es: { name: 'Español', speak: 'es-ES', dir: 'ltr', note: '' }
  };

  const PRAYERS = [
    {
      id: 'pater', title: 'Padre Nuestro', latinTitle: 'Pater Noster', audience: ['founder', 'kendra'], original: null, first: 'arc',
      texts: {
        // Arameo (orden del Founder, 24-nov-2026 14:07): Peshitta, Mt 6, 9-13, con transliteración, pronunciación y subtítulo
        // línea a línea. Contrastado en dos fuentes: edición estándar de la Peshitta (artículo «Lord's Prayer») y
        // Syriac Orthodox Resources («Abun d-bashmayo», pronunciación occidental). Se omite la doxología («porque tuyo es
        // el reino…»), que la Peshitta sí trae pero la Misa reza aparte.
        arc: {
          lines: ['ܐܒ݂ܘܢ ܕ̇ܒ݂ܫܡܝܐ', 'ܢܬ݂ܩܕ݁ܫ ܫܡܟ݂', 'ܬ݁ܐܬ݂ܐ ܡܠܟ݁ܘܬ݂ܟ݂', 'ܢܗܘܐ ܨܒ݂ܝܢܟ݂ ܐܝܟ݁ܢܐ ܕ݂ܒ݂ܫܡܝܐ ܐܦ݂ ܒ݁ܐܪܥܐ', 'ܗܒ݂ ܠܢ ܠܚܡܐ ܕ݂ܣܘܢܩܢܢ ܝܘܡܢܐ', 'ܘܫܒ݂ܘܩ ܠܢ ܚܘ̈ܒ݁ܝܢ ܐܝܟܢܐ ܕ݂ܐܦ݂ ܚܢܢ ܫܒ݂ܩܢ ܠܚܝ̈ܒ݂ܝܢ', 'ܘܠܐ ܬ݂ܥܠܢ ܠܢܣܝܘܢܐ ܐܠܐ ܦ݂ܨܢ ܡܢ ܒ݁ܝܫܐ', 'ܐܡܝܢ'],
          translit: ['ʾăḇūn d-ḇa-šmayyā', 'neṯqaddaš šmāḵ', 'têṯē malkūṯāḵ', 'nēhwē ṣeḇyānāḵ ʾaykannā ḏ-ḇa-šmayyā ʾāp̄ b-ʾarʿā', 'haḇ lan laḥmā ḏ-sūnqānan yawmānā', 'wa-šḇoq lan ḥawbayn ʾaykannā ḏ-ʾāp̄ ḥnan šḇaqn l-ḥayyāḇayn', 'w-lā ṯaʿlan l-nesyōnā ʾellā p̄aṣṣān men bīšā', 'ʾāmīn'],
          say: ['Abún dbashmayá.', 'Netqadásh shmaj.', 'Teté malkutáj.', 'Nehwé sebyanáj, aykaná dbashmayá, af bar’á.', 'Hab lan lajmá dsunqanán yaumaná.', 'Washboq lan jaubáin, aykaná daf jnan shbaqán lejayabáin.', 'Wlá talán lenesyoná, elá patsán men bishá.', 'Amín.'],
          sub: ['Padre nuestro, que estás en el cielo,', 'santificado sea tu nombre;', 'venga tu reino;', 'hágase tu voluntad, como en el cielo, también en la tierra.', 'Danos hoy el pan que necesitamos.', 'Perdónanos nuestras deudas, como también nosotros perdonamos a los que nos deben.', 'Y no nos hagas entrar en la tentación, sino líbranos del mal.', 'Amén.'],
          notes: ['En arameo, «deuda» (ḥawbā) es la misma palabra que «pecado»: por eso en español decimos «perdona nuestras ofensas».'],
          source: 'Peshitta (Biblia siríaca), Mateo 6, 9-13, edición estándar; transliteración clásica. Contrastado con Syriac Orthodox Resources, «Abun d-bashmayo». Subtítulo: traducción literal del arameo.' },
        la: { lines: ['Pater noster, qui es in caelis,', 'sanctificetur nomen tuum.', 'Adveniat regnum tuum.', 'Fiat voluntas tua, sicut in caelo et in terra.', 'Panem nostrum quotidianum da nobis hodie,', 'et dimitte nobis debita nostra,', 'sicut et nos dimittimus debitoribus nostris.', 'Et ne nos inducas in tentationem,', 'sed libera nos a malo.', 'Amen.'],
          say: ['Páter nóster, kuí es in chélis,', 'santifichétur nómen túum.', 'Advéniat régnum túum.', 'Fíat volúntas túa, sícut in chélo et in térra.', 'Pánem nóstrum kuotidiánum da nóbis ódie,', 'et dimítte nóbis débita nóstra,', 'sícut et nos dimíttimus debitóribus nóstris.', 'Et ne nos indúkas in tentatsiónem,', 'sed líbera nos a málo.', 'Ámen.'],
          source: 'Misal Romano (texto litúrgico latino); Vulgata, Mt 6, 9-13.' },
        he: { lines: ['אָבִינוּ שֶׁבַּשָׁמַיִם יִתְקַדַּשׁ שְׁמֶךָ׃', 'תָּבֹּא מַלְכוּתֶךָ יֵעָשֶׂה רְצוֹנְךָ כַּאֲשֶׁר בַּשָׁמַיִם גַּם בָּאָרֶץ׃', 'אֶת־לֶחֶם חֻקֵּנוּ תֵּן־לָנוּ הַיּוֹם׃', 'וּמְחַל־לָנוּ עַל־חֹבוֹתֵינוּ כַּאֲשֶׁר מָחַלְנוּ גַּם־אֲנַחְנוּ לְחַיָּבֵינוּ׃', 'וְאַל־תְּבִיאֵנוּ לִידֵי נִסָּיוֹן כִּי אִם־תְּחַלְּצֵנוּ מִן־הָרָע׃'],
          say: ['Avínu shebashamáyim, yitkadásh shemécha.', 'Tavó malchutécha, ye’asé retsonchá, ka’ashér bashamáyim gam ba’árets.', 'Et léchem chukénu ten lánu hayóm.', 'Umechál lánu al chovoténu, ka’ashér machálnu gam anáchnu lechayavénu.', 'Ve’ál tevi’énu lidéi nisayón, ki im techaltsénu min hará.'],
          source: 'Franz Delitzsch, Nuevo Testamento hebreo, 12.ª ed. (1901), Mt 6, 9-13. Dominio público.' },
        es: { lines: ['Padre nuestro, que estás en el cielo,', 'santificado sea tu Nombre;', 'venga a nosotros tu reino;', 'hágase tu voluntad en la tierra como en el cielo.', 'Danos hoy nuestro pan de cada día;', 'perdona nuestras ofensas,', 'como también nosotros perdonamos a los que nos ofenden;', 'no nos dejes caer en la tentación,', 'y líbranos del mal.', 'Amén.'],
          source: 'Texto litúrgico en español.' }
      }
    },
    {
      id: 'angele', title: 'Ángel de la Guarda', latinTitle: 'Angele Dei', audience: ['founder'], original: 'la',
      texts: {
        la: { lines: ['Angele Dei, qui custos es mei,', 'me tibi commissum pietate superna,', 'hodie illumina, custodi, rege et guberna.', 'Amen.'],
          say: ['Ándjele Déi, kuí kústos es méi,', 'me tíbi commíssum pietáte supérna,', 'ódie illúmina, kustódi, rége et gubérna.', 'Ámen.'],
          source: 'Oración tradicional latina (tradición de Reginaldo de Canterbury, s. XI-XII). Por la noche se dice «hac nocte» en lugar de «hodie».' },
        es: { lines: ['Ángel de Dios, que eres mi custodio,', 'pues la bondad divina me ha encomendado a ti,', 'ilumíname, guárdame, rígeme y gobiérname.', 'Amén.'], source: 'Traducción literal del latín.' }
      }
    },
    {
      id: 'miguel', title: 'San Miguel Arcángel', latinTitle: 'Sancte Michael Archangele', audience: ['founder'], original: 'la',
      texts: {
        la: { lines: ['Sancte Michael Archangele, defende nos in proelio;', 'contra nequitiam et insidias diaboli esto praesidium.', 'Imperet illi Deus, supplices deprecamur:', 'tuque, Princeps militiae caelestis,', 'Satanam aliosque spiritus malignos,', 'qui ad perditionem animarum pervagantur in mundo,', 'divina virtute in infernum detrude.', 'Amen.'],
          say: ['Sánkte Míkael Arkánjele, defénde nos in prélio;', 'kóntra nekuítsiam et insídias diábuli ésto presídium.', 'Impéret ílli Déus, súpplices deprekámur:', 'túkue, Prínchips milítsie chelestis,', 'Sátanam aliósque spíritus malígnos,', 'kui ad perditsiónem animárum pervagántur in múndo,', 'divína virtúte in inférnum detrúde.', 'Ámen.'],
          source: 'Papa León XIII (1886), oración tras la Misa rezada.' },
        es: { lines: ['San Miguel Arcángel, defiéndenos en la batalla;', 'sé nuestro amparo contra la perversidad y asechanzas del demonio.', 'Reprímale Dios, pedimos suplicantes,', 'y tú, Príncipe de la milicia celestial,', 'arroja al infierno con el divino poder a Satanás', 'y a los otros espíritus malignos', 'que andan dispersos por el mundo para la perdición de las almas.', 'Amén.'],
          source: 'Traducción tradicional en español.' }
      }
    },
    {
      id: 'angel-nino', title: 'Ángel de mi guarda', audience: ['kendra'], original: 'es', kids: true,
      texts: { es: { lines: ['Ángel de mi guarda, dulce compañía,', 'no me desampares ni de noche ni de día;', 'no me dejes sola, que me perdería.', 'Amén.'], source: 'Oración tradicional para niños.' } }
    },
    {
      id: 'jesusito', title: 'Jesusito de mi vida', audience: ['kendra'], original: 'es', kids: true,
      texts: { es: { lines: ['Jesusito de mi vida,', 'eres niño como yo;', 'por eso te quiero tanto', 'y te doy mi corazón.', 'Tómalo, tómalo, tuyo es, mío no.'], source: 'Oración tradicional para niños.' } }
    },
    {
      id: 'acostarse', title: 'Al acostarme', audience: ['kendra'], original: 'es', kids: true,
      texts: { es: { lines: ['Con Dios me acuesto,', 'con Dios me levanto,', 'con la Virgen María', 'y el Espíritu Santo.'], source: 'Oración tradicional para niños.' } }
    },
    {
      id: 'mesa', title: 'Bendición de la mesa', audience: ['kendra'], original: 'es', kids: true,
      texts: { es: { lines: ['Bendice, Señor, estos alimentos', 'que vamos a tomar,', 'y da pan a quien no lo tiene.', 'Amén.'], source: 'Oración tradicional.' } }
    },
    {
      id: 'ave', title: 'Ave María', audience: ['kendra', 'founder'], original: 'es', kids: true,
      texts: { es: { lines: ['Dios te salve, María, llena eres de gracia,', 'el Señor es contigo.', 'Bendita tú eres entre todas las mujeres,', 'y bendito es el fruto de tu vientre, Jesús.', 'Santa María, Madre de Dios,', 'ruega por nosotros, pecadores,', 'ahora y en la hora de nuestra muerte.', 'Amén.'], source: 'Texto tradicional en español.' } }
    }
  ];

  // Para Kendra, «Ángel de mi guarda» lleva como opción el latín del Angele Dei (es la oración latina al mismo ángel, no su traducción).
  (function linkAngelLatin() {
    const kid = PRAYERS.find((p) => p.id === 'angel-nino'), la = PRAYERS.find((p) => p.id === 'angele').texts.la;
    kid.texts.la = Object.assign({}, la, { source: la.source + ' En latín se reza el «Angele Dei»: es la oración latina al ángel de la guarda, no una traducción palabra por palabra de la española.' });
  })();

  const byId = (id) => PRAYERS.find((p) => p.id === id) || null;
  /** Oraciones para un público ('founder' | 'kendra'). */
  const forAudience = (who) => PRAYERS.filter((p) => p.audience.includes(who));
  /** Idiomas disponibles de una oración: primero el de recitar (hebreo en el Padre Nuestro) o el original. */
  function langsOf(id) {
    const p = byId(id); if (!p) return [];
    const order = [p.first || p.original, 'arc', 'he', 'la', 'es'];
    return [...new Set(order)].filter((l) => p.texts[l]);
  }
  /** Para Kendra: el latín solo si ella lo ha pedido (optIn). Arameo y hebreo, nunca por defecto. */
  function langsFor(id, who, optIn) {
    const all = langsOf(id);
    if (who !== 'kendra') return all;
    return all.filter((l) => l === 'es' || (l === 'la' && optIn));
  }

  let speaking = null;
  function voiceFor(lang) {
    try {
      const L = LANGS[lang] || LANGS.es, want = L.speak.toLowerCase(), bases = [want.slice(0, 2)].concat(L.alt || []);
      const vs = root.speechSynthesis ? root.speechSynthesis.getVoices() : [];
      // Android antiguo anuncia el hebreo como «iw»; se acepta también.
      return vs.find((v) => v.lang.toLowerCase().replace('_', '-') === want) ||
        vs.find((v) => bases.some((b) => v.lang.toLowerCase().startsWith(b))) || null;
    } catch (e) { return null; }
  }
  /** Lee la oración en voz alta con la voz del aparato. Devuelve false si el aparato no puede (sin voz en ese idioma). */
  function speak(id, lang, opts) {
    const p = byId(id), t = p && p.texts[lang];
    if (!t || !root.speechSynthesis || typeof root.SpeechSynthesisUtterance !== 'function') return false;
    // Sin voz hebrea, la voz por defecto no sabe leer ese alfabeto: mejor no sonar que sonar mal.
    if (lang === 'he' && !voiceFor('he')) return false;
    // Sin voz propia (arameo): la voz española lee la pronunciación aproximada.
    const approx = !LANGS[lang].speak;
    if (approx && !t.say) return false;
    stop();
    const u = new root.SpeechSynthesisUtterance((approx ? t.say : t.lines).join(' '));
    u.lang = approx ? LANGS.es.speak : LANGS[lang].speak; u.rate = (opts && opts.rate) || 0.78; u.pitch = 1;
    const v = voiceFor(approx ? 'es' : lang); if (v) u.voice = v;
    u.onend = () => { speaking = null; if (opts && opts.onEnd) opts.onEnd(); };
    u.onerror = () => { speaking = null; if (opts && opts.onEnd) opts.onEnd(); };
    speaking = { id, lang };
    root.speechSynthesis.speak(u);
    return true;
  }
  /**
   * Recita línea a línea con subtítulos (texto con `sub`). Por cada línea: primero la voz premium que dé `fetchAudio(texto)`
   * (una URL de audio, p. ej. la voz de Janus en ElevenLabs), si no la voz del aparato, y si tampoco hay, solo el subtítulo
   * durante unos segundos. `onLine(i, modo)` marca la línea activa; `onEnd()` al terminar o al pararla.
   */
  let reciting = null;
  function recite(id, lang, opts) {
    const p = byId(id), t = p && p.texts[lang];
    if (!t || !t.sub) return null;
    stop();
    const o = opts || {}, words = t.say || t.lines, run = { stopped: false, audio: null, timer: null };
    reciting = run;
    const finish = () => { if (reciting === run) reciting = null; if (o.onEnd) o.onEnd(); };
    const viaDevice = (text) => new Promise((done) => {
      if (!root.speechSynthesis || typeof root.SpeechSynthesisUtterance !== 'function') return done(false);
      const approx = !LANGS[lang].speak, u = new root.SpeechSynthesisUtterance(text);
      u.lang = approx ? LANGS.es.speak : LANGS[lang].speak; u.rate = o.rate || 0.72;
      const v = voiceFor(approx ? 'es' : lang); if (v) u.voice = v;
      u.onend = () => done(true); u.onerror = () => done(false);
      root.speechSynthesis.speak(u);
    });
    const viaAudio = async (text) => {
      if (!o.fetchAudio || typeof root.Audio !== 'function') return false;
      let url = null; try { url = await o.fetchAudio(text); } catch (e) { url = null; }
      if (!url || run.stopped) return false;
      return new Promise((done) => {
        const a = new root.Audio(url); run.audio = a;
        a.onended = () => done(true); a.onerror = () => done(false);
        const pr = a.play(); if (pr && pr.catch) pr.catch(() => done(false));
      });
    };
    const pause = (ms) => new Promise((done) => { run.timer = setTimeout(done, ms); });
    (async () => {
      for (let i = 0; i < t.lines.length && !run.stopped; i++) {
        if (o.onLine) o.onLine(i, 'start');
        const ok = (await viaAudio(words[i])) || (!run.stopped && await viaDevice(words[i]));
        if (run.stopped) break;
        await pause(ok ? 700 : 3500);   // respiro entre líneas; sin voz, tiempo para leer el subtítulo
      }
      finish();
    })();
    return run;
  }
  function stop() {
    try { if (root.speechSynthesis) root.speechSynthesis.cancel(); } catch (e) { /* nada */ }
    if (reciting) { const r = reciting; reciting = null; r.stopped = true; clearTimeout(r.timer); try { if (r.audio) r.audio.pause(); } catch (e) { /* nada */ } }
    speaking = null;
  }
  const isSpeaking = () => speaking;
  const hasVoice = (lang) => !!voiceFor(lang);

  const api = { version: '1.2.0', LANGS, PRAYERS, byId, forAudience, langsOf, langsFor, speak, recite, stop, isSpeaking, hasVoice };
  root.JanusOraciones = api;
  if (typeof module === 'object' && module && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
