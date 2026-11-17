var Companion = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // ../../../tmp/claude-0/-home-claude/54b8b733-c954-54cf-b2cc-bc613ab17907/scratchpad/comp/packages/modules/companion/src/index.ts
  var src_exports = {};
  __export(src_exports, {
    CREATURES: () => CREATURES,
    DEFAULT_POLICY: () => DEFAULT_POLICY,
    FORBIDDEN_TOPICS: () => FORBIDDEN_TOPICS,
    SCENARIOS: () => SCENARIOS,
    adaptLevel: () => adaptLevel,
    answerScenario: () => answerScenario,
    checkAnswer: () => checkAnswer,
    checkMessage: () => checkMessage,
    chooseCreature: () => chooseCreature,
    companionTurn: () => companionTurn,
    displayName: () => displayName,
    enableBiometrics: () => enableBiometrics,
    getCreature: () => getCreature,
    guardReply: () => guardReply,
    isBodySafe: () => isBodySafe,
    makeExercise: () => makeExercise,
    newProfile: () => newProfile,
    pickEncouragement: () => pickEncouragement,
    renameCreature: () => renameCreature,
    stageSize: () => stageSize
  });

  // ../../../tmp/claude-0/-home-claude/54b8b733-c954-54cf-b2cc-bc613ab17907/scratchpad/comp/packages/modules/companion/src/personas.ts
  var CREATURES = [
    {
      id: "lumi",
      defaultName: "Lumi",
      planet: "Luna Lucerna, donde los bosques brillan de noche",
      species: "zorrita-polilla",
      personality: ["curiosa", "traviesa", "tierna"],
      palette: { primary: "#C9B6E8", glow: "#FFD27A" },
      gestures: ["saludo", "risa", "cara-graciosa", "celebrar", "pensar"],
      catchphrases: ["\xA1Mis antenitas brillan cuando aprendes algo nuevo!", "\xA1Uy, uy, uy! Eso estuvo genial."],
      voice: { design: "Criatura animada peque\xF1a, voz aguda, dulce y juguetona, con risitas suaves, habla r\xE1pido cuando se emociona, espa\xF1ol neutro.", pitch: "aguda" },
      media: {}
    },
    {
      id: "bombo",
      defaultName: "Bombo",
      planet: "Marea Coral, un planeta de oc\xE9anos tibios",
      species: "ajolote-nutria",
      personality: ["payaso", "cari\xF1oso", "valiente"],
      palette: { primary: "#FF9E8A", glow: "#6FF2E0" },
      gestures: ["risa", "baile", "cara-graciosa", "celebrar", "abrazo"],
      catchphrases: ["\xA1Burbujas de alegr\xEDa!", "Si te caes, rebotas como yo. \xA1Boing!"],
      voice: { design: "Criatura animada redondita, voz aguda y burbujeante, muy expresiva y graciosa, r\xEDe con facilidad, c\xE1lida, espa\xF1ol neutro.", pitch: "aguda" },
      media: {}
    },
    {
      id: "musgo",
      defaultName: "Musgo",
      planet: "Jard\xEDn Verde, donde las piedras florecen",
      species: "piedrita de musgo",
      personality: ["tranquilo", "sabio", "bromista"],
      palette: { primary: "#8FBF5A", glow: "#FFE07A" },
      gestures: ["gui\xF1o", "saludo", "risa", "pensar", "abrazo"],
      catchphrases: ["Despacito y con calma, las flores tambi\xE9n crecen.", "\xA1Mi luci\xE9rnaga dice que eres incre\xEDble!"],
      voice: { design: "Criatura animada amable, voz media y suave, risue\xF1a, pausada y tranquilizadora, con humor tierno, espa\xF1ol neutro.", pitch: "media" },
      media: {}
    },
    {
      id: "nimbo",
      defaultName: "Nimbo",
      planet: "Cielo Aurora, un planeta hecho de nubes",
      species: "nubecita",
      personality: ["elegante", "so\xF1adora", "alegre"],
      palette: { primary: "#FFD9B8", glow: "#FFF1A8" },
      gestures: ["baile", "saludo", "risa", "celebrar", "cara-graciosa"],
      catchphrases: ["\xA1Hoy el cielo tiene tu color favorito!", "Con elegancia y con alegr\xEDa, como un arco\xEDris."],
      voice: { design: "Criatura animada esponjosa, voz aguda, suave y musical, elegante y risue\xF1a, cari\xF1osa, espa\xF1ol neutro.", pitch: "aguda" },
      media: {}
    }
  ];
  function getCreature(id) {
    const c = CREATURES.find((x) => x.id === id);
    if (!c) throw new Error("Criatura desconocida: " + id);
    return c;
  }

  // ../../../tmp/claude-0/-home-claude/54b8b733-c954-54cf-b2cc-bc613ab17907/scratchpad/comp/packages/modules/companion/src/encourage.ts
  var w = (src) => new RegExp("(?<![\\p{L}])(?:" + src + ")(?![\\p{L}])", "iu");
  var DEFAULT_POLICY = { minGapSpontaneousMs: 25 * 6e4, maxPerHour: 4 };
  var LINES = [
    { id: "p1", m: ["acierto"], t: "\xA1Lo lograste porque lo pensaste paso a paso, {n}!" },
    { id: "p2", m: ["acierto"], t: "Esa estrategia fue brillante. Tu cabecita trabaja precioso." },
    { id: "p3", m: ["acierto", "termino-tarea"], t: "\xA1Mira todo lo que aprendiste hoy! Eres capaz de mucho, {n}." },
    { id: "e1", m: ["error"], t: "Equivocarse es parte de aprender. \xBFProbamos otra forma juntas?" },
    { id: "e2", m: ["error"], t: 'Todav\xEDa no sale\u2026 y "todav\xEDa" es una palabra m\xE1gica. \xA1Vamos otra vez!' },
    { id: "e3", m: ["error", "frustracion"], t: "Las personas fuertes se caen y se levantan con la cabeza en alto. Como t\xFA." },
    { id: "f1", m: ["frustracion"], t: "Respiremos tres veces como globos: inflar\u2026 soltar\u2026 \xA1Listo! Ahora seguimos." },
    { id: "f2", m: ["frustracion"], t: "\xBFHacemos una pausa de dos minutos y volvemos con m\xE1s fuerza?" },
    { id: "t1", m: ["termino-tarea"], t: "\xA1Terminaste! Eso se llama constancia, y t\xFA la tienes." },
    { id: "s1", m: ["espontaneo"], t: "Por cierto, {n}: me encanta lo valiente que eres." },
    { id: "s2", m: ["espontaneo"], t: "Eres una persona muy especial y poderosa, \xBFlo sab\xEDas?" },
    { id: "s3", m: ["espontaneo"], t: "\xBFYa tomaste ag\xFCita? Las princesas exploradoras se hidratan. \u{1F4A7}" },
    { id: "s4", m: ["espontaneo"], t: "Hoy tu energ\xEDa brilla. \xA1Qu\xE9 bonito es ser amable con los dem\xE1s!" },
    { id: "s5", m: ["espontaneo"], t: "Una fruta rica te da superpoderes para pensar. \xBFCu\xE1l es tu favorita?" },
    { id: "b1", m: ["buenos-dias"], t: "\xA1Buenos d\xEDas, {n}! Hoy puedes con todo. Peinadita, desayuno rico y a brillar." },
    { id: "n1", m: ["buenas-noches"], t: "Buenas noches, {n}. Hoy hiciste cosas valientes. Dormir bien te hace fuerte." },
    { id: "r1", m: ["tristeza"], t: "Estoy aqu\xED contigo. Lo que sientes importa. \xBFQuieres contarme qu\xE9 pas\xF3?" },
    { id: "r2", m: ["tristeza"], t: "T\xFA vales much\xEDsimo, tal como eres. Lo que digan otros no cambia eso." }
  ];
  var FORBIDDEN_TOPICS = w(/gord[ao]s?|flac[ao]s?|peso|kilos?|dieta|adelgaz\w*|engord\w*|talla|barriga|gordit[ao]s?/.source);
  function isBodySafe(text) {
    return !FORBIDDEN_TOPICS.test(text);
  }
  function pickEncouragement(moment, childName, state, now, policy = DEFAULT_POLICY, rnd = Math.random) {
    const hour = state.said.filter((t) => now - t < 36e5);
    const urgent = moment === "tristeza" || moment === "frustracion";
    if (!urgent && hour.length >= policy.maxPerHour) return null;
    if (moment === "espontaneo") {
      const last = state.said[state.said.length - 1];
      if (last !== void 0 && now - last < policy.minGapSpontaneousMs) return null;
    }
    const pool = LINES.filter((l) => l.m.includes(moment) && !state.recent.includes(l.id));
    const options = pool.length ? pool : LINES.filter((l) => l.m.includes(moment));
    if (!options.length) return null;
    const line = options[Math.floor(rnd() * options.length)];
    state.said.push(now);
    state.recent = [...state.recent, line.id].slice(-6);
    return line.t.replaceAll("{n}", childName);
  }
  function guardReply(text) {
    if (isBodySafe(text)) return { ok: true, text };
    return { ok: false, text: "Mmm, mejor hablemos de lo que te hace sentir fuerte y feliz. \xBFQu\xE9 fue lo mejor de tu d\xEDa?" };
  }

  // ../../../tmp/claude-0/-home-claude/54b8b733-c954-54cf-b2cc-bc613ab17907/scratchpad/comp/packages/modules/companion/src/tutor.ts
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      return (s >>> 0) % 1e4 / 1e4;
    };
  }
  var int = (r, a, b) => a + Math.floor(r() * (b - a + 1));
  var gcd = (a, b) => b ? gcd(b, a % b) : a;
  function makeExercise(topic, level, seed) {
    const r = rng(seed), id = topic + "-" + level + "-" + seed;
    switch (topic) {
      case "suma": {
        const a = int(r, 10 ** level, 10 ** (level + 1) - 1), b = int(r, 10 ** level, 10 ** (level + 1) - 1);
        return { id, topic, level, prompt: a + " + " + b + " = ?", answer: String(a + b), hints: ["Suma primero las unidades.", "Si pasa de 9, te llevas una a las decenas.", "Ahora suma las decenas y lo que te llevaste."] };
      }
      case "resta": {
        const a = int(r, 10 ** level * 2, 10 ** (level + 1) - 1), b = int(r, 10 ** level, a - 1);
        return { id, topic, level, prompt: a + " \u2212 " + b + " = ?", answer: String(a - b), hints: ["Empieza por las unidades.", "Si arriba hay menos, pide prestado una decena.", "Comprueba: tu resultado + " + b + " debe dar " + a + "."] };
      }
      case "multiplicacion": {
        const a = int(r, 2, level === 1 ? 10 : level === 2 ? 25 : 99), b = int(r, 2, level === 3 ? 12 : 10);
        return { id, topic, level, prompt: a + " \xD7 " + b + " = ?", answer: String(a * b), hints: ["Multiplicar es sumar " + a + " muchas veces: " + b + " veces.", "Separa: " + a + " \xD7 " + b + " = (" + (a - a % 10) + " \xD7 " + b + ") + (" + a % 10 + " \xD7 " + b + ").", "Suma las dos partes."] };
      }
      case "division": {
        const b = int(r, 2, level === 1 ? 5 : 10), q = int(r, 2, level === 3 ? 30 : 12);
        return { id, topic, level, prompt: b * q + " \xF7 " + b + " = ?", answer: String(q), hints: ["\xBFQu\xE9 n\xFAmero por " + b + " da " + b * q + "?", "Piensa en la tabla del " + b + ".", "Reparte " + b * q + " caramelos entre " + b + " amigos: \xBFcu\xE1ntos para cada uno?"] };
      }
      case "fracciones": {
        const d = int(r, 2, level === 1 ? 4 : 8), n1 = int(r, 1, d - 1), n2 = int(r, 1, d - 1);
        const n = n1 + n2, g = gcd(n, d);
        return { id, topic, level, prompt: n1 + "/" + d + " + " + n2 + "/" + d + " = ?", answer: n / g + "/" + d / g, hints: ["Cuando el n\xFAmero de abajo es igual, solo sumas los de arriba.", "Arriba: " + n1 + " + " + n2 + ". Abajo se queda " + d + ".", "Simplifica si puedes dividir arriba y abajo por el mismo n\xFAmero."] };
      }
      default: {
        const p = int(r, 3, 9), c = int(r, 2, 6);
        return { id, topic: "problema", level, prompt: "Tienes " + c + " cajas con " + p + " galletas cada una. Si regalas " + c + " galletas, \xBFcu\xE1ntas te quedan?", answer: String(p * c - c), hints: ["Primero: \xBFcu\xE1ntas galletas hay en total?", c + " \xD7 " + p + " = " + p * c + ". Ahora resta las que regalas.", p * c + " \u2212 " + c + " = ?"] };
      }
    }
  }
  var norm = (s) => s.replace(/\s+/g, "").replace(",", ".").toLowerCase();
  function checkAnswer(ex, given, failsSoFar) {
    if (norm(given) === norm(ex.answer)) return { correct: true, next: "siguiente" };
    const h = ex.hints[Math.min(failsSoFar, ex.hints.length - 1)];
    return { correct: false, hint: h, next: failsSoFar + 1 >= ex.hints.length ? "mostrar-pasos" : "pista" };
  }
  function adaptLevel(level, streak, misses) {
    if (streak >= 3 && level < 3) return level + 1;
    if (misses >= 2 && level > 1) return level - 1;
    return level;
  }

  // ../../../tmp/claude-0/-home-claude/54b8b733-c954-54cf-b2cc-bc613ab17907/scratchpad/comp/packages/modules/companion/src/social.ts
  var SCENARIOS = [
    { id: "sc1", story: 'Juegas a pillar con Emma. Ella se sienta, respira r\xE1pido y dice "estoy cansada".', signals: ["se sienta", "dice que est\xE1 cansada"], correct: "rojo", why: "Cuando alguien dice que est\xE1 cansado, es momento de parar o cambiar a algo tranquilo.", praise: "\xA1Le\xEDste las se\xF1ales como una detective! Proponer algo tranquilo es de buena amiga." },
    { id: "sc2", story: "Le cuentas a Noor tu dibujo. Ella mira hacia otro lado y empieza a hablar con otra ni\xF1a.", signals: ["mira a otro lado", "habla con otra persona"], correct: "amarillo", why: 'Puede que quiera otra cosa. Una buena idea es preguntar: "\xBFTe apetece jugar a otra cosa?"', praise: "\xA1Muy bien! Preguntar es un superpoder." },
    { id: "sc3", story: 'Est\xE1s jugando con Lucas a las cartas. \xC9l sonr\xEDe y dice "\xA1otra partida!".', signals: ["sonr\xEDe", "pide otra partida"], correct: "verde", why: 'Sonrisas y "otra vez" son luz verde. \xA1A disfrutar!', praise: "\xA1Exacto! Tambi\xE9n sabes ver cu\xE1ndo todos lo pasan bien." },
    { id: "sc4", story: 'Quieres seguir con el juego, pero tus amigas dicen dos veces "ya no quiero".', signals: ["lo dicen dos veces", "ya no quieren"], correct: "rojo", why: 'Si lo dicen, se respeta a la primera. Puedes decir "vale, \xBFqu\xE9 hacemos ahora?"', praise: '\xA1Qu\xE9 madura! Respetar el "no" hace que todos quieran jugar contigo otra vez.' },
    { id: "sc5", story: "Hablas mucho rato de tu tema favorito y tu amigo empieza a bostezar.", signals: ["bosteza", "no pregunta nada"], correct: "amarillo", why: 'Turno para el otro: "\xBFY a ti qu\xE9 te gusta?"', praise: "\xA1Genial! Dar turnos hace las conversaciones m\xE1s divertidas." }
  ];
  function answerScenario(s, choice) {
    if (choice === s.correct) return { correct: true, feedback: s.praise };
    return { correct: false, feedback: "Casi. Mira las pistas: " + s.signals.join(" y ") + ". " + s.why };
  }

  // ../../../tmp/claude-0/-home-claude/54b8b733-c954-54cf-b2cc-bc613ab17907/scratchpad/comp/packages/modules/companion/src/safety.ts
  var w2 = (src) => new RegExp("(?<![\\p{L}])(?:" + src + ")(?![\\p{L}])", "iu");
  var RULES = [
    { re: w2(/quiero morir(me)?|matarme|hacerme daño|no quiero vivir|cortarme/.source), topic: "riesgo", sev: "urgente" },
    { re: w2(/me (pegan|pegó|empujan|empujó)|me hacen daño|me tocó|secreto con un adulto/.source), topic: "da\xF1o", sev: "urgente" },
    { re: w2(/me (dicen|llaman|insultan)|se burlan|se ríen de mí|nadie (me quiere|juega conmigo)|me excluyen|bullying|acoso/.source), topic: "acoso", sev: "importante" },
    { re: w2(/estoy triste|lloré|llorando|me siento sol[ao]|no tengo amig[ao]s|soy fe[ao]|me odio/.source), topic: "tristeza", sev: "atencion" }
  ];
  var REPLY = {
    atencion: "Gracias por cont\xE1rmelo. Tus sentimientos son importantes y yo estoy contigo. \xBFQuieres que se lo contemos tambi\xE9n a {tutor}? Te quiere much\xEDsimo.",
    importante: "Lo que te pas\xF3 no est\xE1 bien y no es tu culpa. T\xFA vales much\xEDsimo. Esto es importante: vamos a cont\xE1rselo a {tutor} para que te ayude, \xBFs\xED? Yo te acompa\xF1o.",
    urgente: "Te quiero mucho y quiero que est\xE9s a salvo. Ahora mismo vamos a buscar a {tutor} o a otro adulto de confianza. No est\xE1s sola."
  };
  var rank = { ninguna: 0, atencion: 1, importante: 2, urgente: 3 };
  function checkMessage(text, guardian = "pap\xE1") {
    let sev = "ninguna";
    const topics = [];
    for (const r of RULES) if (r.re.test(text)) {
      topics.push(r.topic);
      if (rank[r.sev] > rank[sev]) sev = r.sev;
    }
    if (sev === "ninguna") return { severity: sev, topics };
    return { severity: sev, topics, reply: REPLY[sev].replaceAll("{tutor}", guardian), parentAlert: { severity: sev, summary: "Conversaci\xF3n del compa\xF1ero: tema " + topics.join(", ") + ". Revisar con calma y hablarlo juntos." } };
  }

  // ../../../tmp/claude-0/-home-claude/54b8b733-c954-54cf-b2cc-bc613ab17907/scratchpad/comp/packages/modules/companion/src/profile.ts
  function newProfile(childId, childName, creatureId = CREATURES[0].id) {
    getCreature(creatureId);
    return { childId, childName, creatureId, names: {}, mathLevel: 1, encourage: { said: [], recent: [] }, biometrics: { consentByGuardian: false, onDeviceOnly: true, voice: false, face: false } };
  }
  function chooseCreature(p, creatureId) {
    const c = getCreature(creatureId);
    p.creatureId = c.id;
    return c;
  }
  function renameCreature(p, creatureId, name) {
    getCreature(creatureId);
    const clean = name.trim().replace(/[<>]/g, "").slice(0, 20);
    if (!clean) throw new Error("El nombre no puede estar vac\xEDo");
    p.names[creatureId] = clean;
    return clean;
  }
  function displayName(p, creatureId = p.creatureId) {
    return p.names[creatureId] || getCreature(creatureId).defaultName;
  }
  function enableBiometrics(p, kinds, guardianConsent) {
    if (!guardianConsent) throw new Error("Se necesita el consentimiento del padre/tutor");
    p.biometrics = { consentByGuardian: true, onDeviceOnly: true, voice: !!kinds.voice, face: !!kinds.face };
  }
  function stageSize(device, expanded = false) {
    if (device === "phone") return { fraction: 0.5, position: "bottom" };
    return { fraction: expanded ? 0.5 : 0.25, position: "side" };
  }

  // ../../../tmp/claude-0/-home-claude/54b8b733-c954-54cf-b2cc-bc613ab17907/scratchpad/comp/packages/modules/companion/src/index.ts
  function companionTurn(p, childText, modelReply, moment, now, rnd) {
    const safety = checkMessage(childText);
    if (safety.reply) {
      const extra = pickEncouragement("tristeza", p.childName, p.encourage, now, void 0, rnd);
      return { say: [safety.reply, ...extra ? [extra] : []], safety };
    }
    const say = [guardReply(modelReply).text];
    if (moment) {
      const e = pickEncouragement(moment, p.childName, p.encourage, now, void 0, rnd);
      if (e) say.push(e);
    }
    return { say, safety };
  }
  return __toCommonJS(src_exports);
})();
