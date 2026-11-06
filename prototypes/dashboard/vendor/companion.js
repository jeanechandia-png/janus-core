"use strict";
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

  // packages/adapters/src/companion-kit.ts
  var companion_kit_exports = {};
  __export(companion_kit_exports, {
    ACCESSORIES: () => ACCESSORIES,
    CREATURES: () => CREATURES,
    DAILY_CAP: () => DAILY_CAP,
    DECOR_KEYS: () => DECOR_KEYS,
    DEFAULT_HOME: () => DEFAULT_HOME,
    DEFAULT_POLICY: () => DEFAULT_POLICY,
    EARN: () => EARN,
    EYES: () => EYES,
    EYE_IDS: () => EYE_IDS,
    FORBIDDEN_TOPICS: () => FORBIDDEN_TOPICS,
    HOME_KEYS: () => HOME_KEYS,
    LESSON_BASIS: () => LESSON_BASIS,
    MAX_COMMANDS: () => MAX_COMMANDS,
    MAX_DECOR: () => MAX_DECOR,
    MAX_PLACE: () => MAX_PLACE,
    MAX_PROPS: () => MAX_PROPS,
    MAX_SAID: () => MAX_SAID,
    MAX_SEEN: () => MAX_SEEN,
    NEUTRAL_BASE: () => NEUTRAL_BASE,
    OUTFITS: () => OUTFITS,
    PLACE_LABEL: () => PLACE_LABEL,
    PLACE_NAME: () => PLACE_NAME,
    POSES: () => POSES,
    PROP_KINDS: () => PROP_KINDS,
    SCENARIOS: () => SCENARIOS,
    SLOTS: () => SLOTS,
    SLOT_LABEL: () => SLOT_LABEL,
    STAGE: () => STAGE,
    SWATCHES: () => SWATCHES,
    SWATCH_IDS: () => SWATCH_IDS,
    VEHICLE_KEYS: () => VEHICLE_KEYS,
    VIEWS: () => VIEWS,
    WORLD_ITEMS: () => WORLD_ITEMS,
    accessoryKey: () => accessoryKey,
    adaptLevel: () => adaptLevel,
    answerScenario: () => answerScenario,
    applyCommand: () => applyCommand,
    applyCommands: () => applyCommands,
    applyLookChange: () => applyLookChange,
    buildCreatureLesson: () => buildCreatureLesson,
    builtValue: () => builtValue,
    canWear: () => canWear,
    checkAnswer: () => checkAnswer,
    checkBuild: () => checkBuild,
    checkMessage: () => checkMessage,
    chooseCreature: () => chooseCreature,
    cleanText: () => cleanText,
    companionTurn: () => companionTurn,
    cookieCount: () => cookieCount,
    createShop: () => createShop,
    defaultLook: () => defaultLook,
    defaultLookFor: () => defaultLookFor,
    displayName: () => displayName,
    earn: () => earn,
    enableBiometrics: () => enableBiometrics,
    findItem: () => findItem,
    getCreature: () => getCreature,
    guardReply: () => guardReply,
    isAccessory: () => isAccessory,
    isBodySafe: () => isBodySafe,
    kitShop: () => kitShop,
    lookItems: () => lookItems,
    lookOf: () => lookOf,
    makeExercise: () => makeExercise,
    newKitProfile: () => newKitProfile,
    newProfile: () => newProfile,
    newScene: () => newScene,
    outfitKey: () => outfitKey,
    owns: () => owns,
    pickEncouragement: () => pickEncouragement,
    randomLook: () => randomLook,
    reactionTo: () => reactionTo,
    renameCreature: () => renameCreature,
    resetLook: () => resetLook,
    sanitizeLook: () => sanitizeLook,
    stageSize: () => stageSize,
    stepsFor: () => stepsFor,
    surpriseLook: () => surpriseLook,
    userAdjust: () => userAdjust,
    userExchange: () => userExchange,
    userMove: () => userMove,
    validateCreatureScene: () => validateCreatureScene,
    wear: () => wear,
    worldOf: () => worldOf
  });

  // packages/modules/companion/src/personas.ts
  var CREATURES = [
    {
      id: "lumi",
      look: { fur: "crema", accent: "lila", eyes: "ambar" },
      defaultName: "Lumi",
      planet: "Luna Lucerna, donde los bosques brillan de noche",
      species: "zorrita-polilla",
      personality: ["curiosa", "traviesa", "tierna"],
      palette: { primary: "#C9B6E8", glow: "#FFD27A" },
      gestures: ["saludo", "risa", "cara-graciosa", "celebrar", "pensar"],
      catchphrases: ["\xA1Mis antenitas brillan cuando aprendes algo nuevo!", "\xA1Uy, uy, uy! Eso estuvo genial."],
      style: {
        signature: "revolotea",
        energy: "media",
        teaching: "Explora con preguntas: \xBFqu\xE9 crees que va a pasar?",
        openers: ["\xA1Mis antenitas dicen que vamos a descubrir algo! Mira conmigo.", "\xA1Vamos a investigar esto en equipo! \xBFQu\xE9 crees que va a pasar?"],
        closers: ["\xA1Mis antenitas brillan! Mira todo lo que descubriste.", "\xA1Uy, uy, uy! Investigamos y lo logramos."]
      },
      voice: { design: "Criatura animada peque\xF1a, voz aguda, dulce y juguetona, con risitas suaves, habla r\xE1pido cuando se emociona, espa\xF1ol neutro.", pitch: "aguda" },
      media: {}
    },
    {
      id: "bombo",
      look: { fur: "coral", accent: "menta", eyes: "chocolate" },
      defaultName: "Bombo",
      planet: "Marea Coral, un planeta de oc\xE9anos tibios",
      species: "ajolote-nutria",
      personality: ["payaso", "cari\xF1oso", "valiente"],
      palette: { primary: "#FF9E8A", glow: "#6FF2E0" },
      gestures: ["risa", "baile", "cara-graciosa", "celebrar", "abrazo"],
      catchphrases: ["\xA1Burbujas de alegr\xEDa!", "Si te caes, rebotas como yo. \xA1Boing!"],
      style: {
        signature: "rebota",
        energy: "alta",
        teaching: "Con humor y ritmo: convierte cada paso en un juego.",
        openers: ["\xA1Burbujas de alegr\xEDa! Vamos a jugar con los n\xFAmeros.", "\xA1Boing! Aqu\xED viene una aventura de mates. \xBFLista o listo?"],
        closers: ["\xA1Boing, boing! Lo hicimos en equipo.", "\xA1Burbujas de alegr\xEDa! Qu\xE9 buen trabajo."]
      },
      voice: { design: "Criatura animada redondita, voz aguda y burbujeante, muy expresiva y graciosa, r\xEDe con facilidad, c\xE1lida, espa\xF1ol neutro.", pitch: "aguda" },
      media: {}
    },
    {
      id: "musgo",
      look: { fur: "verde", accent: "piedra", eyes: "ambar" },
      defaultName: "Musgo",
      planet: "Jard\xEDn Verde, donde las piedras florecen",
      species: "piedrita de musgo",
      personality: ["tranquilo", "sabio", "bromista"],
      palette: { primary: "#8FBF5A", glow: "#FFE07A" },
      gestures: ["gui\xF1o", "saludo", "risa", "pensar", "abrazo"],
      catchphrases: ["Despacito y con calma, las flores tambi\xE9n crecen.", "\xA1Mi luci\xE9rnaga dice que eres incre\xEDble!"],
      style: {
        signature: "gui\xF1a",
        energy: "baja",
        teaching: "Con calma y paciencia: un paso cada vez, sin prisa.",
        openers: ["Despacito y con calma. Mira esto conmigo.", "Sin prisa, que las flores tambi\xE9n crecen. Mira."],
        closers: ["Despacito se llega lejos. \xA1Bien hecho!", "Mi luci\xE9rnaga y yo estamos muy contentos contigo."]
      },
      voice: { design: "Criatura animada amable, voz media y suave, risue\xF1a, pausada y tranquilizadora, con humor tierno, espa\xF1ol neutro.", pitch: "media" },
      media: {}
    },
    {
      id: "nimbo",
      look: { fur: "crema", accent: "dorado", eyes: "azul" },
      defaultName: "Nimbo",
      planet: "Cielo Aurora, un planeta hecho de nubes",
      species: "nubecita",
      personality: ["elegante", "so\xF1adora", "alegre"],
      palette: { primary: "#FFD9B8", glow: "#FFF1A8" },
      gestures: ["baile", "saludo", "risa", "celebrar", "cara-graciosa"],
      catchphrases: ["\xA1Hoy el cielo tiene tu color favorito!", "Con elegancia y con alegr\xEDa, como un arco\xEDris."],
      style: {
        signature: "flota",
        energy: "media",
        teaching: "Con imaginaci\xF3n: usa im\xE1genes y cuentos para entender.",
        openers: ["Imagina que los n\xFAmeros son nubecitas. Mira.", "\xA1Hoy el cielo trae una aventura de n\xFAmeros!"],
        closers: ["Con elegancia y alegr\xEDa: \xA1lo lograste!", "Brillaste como un arco\xEDris. \xA1Qu\xE9 bien!"]
      },
      voice: { design: "Criatura animada esponjosa, voz aguda, suave y musical, elegante y risue\xF1a, cari\xF1osa, espa\xF1ol neutro.", pitch: "aguda" },
      media: {}
    }
  ];
  function getCreature(id) {
    const c = CREATURES.find((x) => x.id === id);
    if (!c) throw new Error("Criatura desconocida: " + id);
    return c;
  }

  // packages/modules/companion/src/encourage.ts
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
  var FORBIDDEN_TOPICS = w(/gord(?:[aeiouy]|it|uch)[a-záéíóúüñ]*|flac(?:[aeiouy]|uch)[a-záéíóúüñ]*|peso|kilos?|dieta|adelgaz\w*|engord\w*|talla|barriga/.source);
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

  // packages/modules/companion/src/tutor.ts
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
        return { id, topic, level, prompt: a + " + " + b + " = ?", answer: String(a + b), params: [a, b], hints: ["Suma primero las unidades.", "Si pasa de 9, te llevas una a las decenas.", "Ahora suma las decenas y lo que te llevaste."] };
      }
      case "resta": {
        const a = int(r, 10 ** level * 2, 10 ** (level + 1) - 1), b = int(r, 10 ** level, a - 1);
        return { id, topic, level, prompt: a + " \u2212 " + b + " = ?", answer: String(a - b), params: [a, b], hints: ["Empieza por las unidades.", "Si arriba hay menos, pide prestado una decena.", "Comprueba: tu resultado + " + b + " debe dar " + a + "."] };
      }
      case "multiplicacion": {
        const a = int(r, 2, level === 1 ? 10 : level === 2 ? 25 : 99), b = int(r, 2, level === 3 ? 12 : 10);
        return { id, topic, level, prompt: a + " \xD7 " + b + " = ?", answer: String(a * b), params: [a, b], hints: ["Multiplicar es sumar " + a + " muchas veces: " + b + " veces.", "Separa: " + a + " \xD7 " + b + " = (" + (a - a % 10) + " \xD7 " + b + ") + (" + a % 10 + " \xD7 " + b + ").", "Suma las dos partes."] };
      }
      case "division": {
        const b = int(r, 2, level === 1 ? 5 : 10), q = int(r, 2, level === 3 ? 30 : 12);
        return { id, topic, level, prompt: b * q + " \xF7 " + b + " = ?", answer: String(q), params: [b, q], hints: ["\xBFQu\xE9 n\xFAmero por " + b + " da " + b * q + "?", "Piensa en la tabla del " + b + ".", "Reparte " + b * q + " caramelos entre " + b + " amigos: \xBFcu\xE1ntos para cada uno?"] };
      }
      case "fracciones": {
        const d = int(r, 2, level === 1 ? 4 : 8), n1 = int(r, 1, d - 1), n2 = int(r, 1, d - 1);
        const n = n1 + n2, g = gcd(n, d);
        return { id, topic, level, prompt: n1 + "/" + d + " + " + n2 + "/" + d + " = ?", answer: n / g + "/" + d / g, params: [n1, n2, d], hints: ["Cuando el n\xFAmero de abajo es igual, solo sumas los de arriba.", "Arriba: " + n1 + " + " + n2 + ". Abajo se queda " + d + ".", "Simplifica si puedes dividir arriba y abajo por el mismo n\xFAmero."] };
      }
      default: {
        const p = int(r, 3, 9), c = int(r, 2, 6);
        return { id, topic: "problema", level, prompt: "Tienes " + c + " cajas con " + p + " galletas cada una. Si regalas " + c + " galletas, \xBFcu\xE1ntas te quedan?", answer: String(p * c - c), params: [c, p], hints: ["Primero: \xBFcu\xE1ntas galletas hay en total?", c + " \xD7 " + p + " = " + p * c + ". Ahora resta las que regalas.", p * c + " \u2212 " + c + " = ?"] };
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

  // packages/modules/companion/src/social.ts
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

  // packages/modules/companion/src/safety.ts
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

  // packages/modules/companion/src/profile.ts
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
    if (!isBodySafe(clean)) throw new Error("Ese nombre mejor no: elige otro que le guste a todos");
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

  // packages/modules/companion/src/index.ts
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

  // packages/modules/avatar-look/src/index.ts
  var SWATCHES = {
    nieve: { label: "Nieve", hex: "#FFF6EA" },
    crema: { label: "Crema", hex: "#FBE7C6" },
    dorado: { label: "Dorado", hex: "#F6C453" },
    melocoton: { label: "Melocot\xF3n", hex: "#FFB68A" },
    coral: { label: "Coral", hex: "#FF8E7A" },
    rosa: { label: "Rosa", hex: "#FF9CC8" },
    lila: { label: "Lila", hex: "#C9B6E8" },
    violeta: { label: "Violeta", hex: "#9B7BE0" },
    cielo: { label: "Cielo", hex: "#8EC8FF" },
    azul: { label: "Azul", hex: "#4F8DF0" },
    menta: { label: "Menta", hex: "#7FE3C4" },
    verde: { label: "Verde", hex: "#8FBF5A" },
    piedra: { label: "Piedra", hex: "#BDAE92" },
    chocolate: { label: "Chocolate", hex: "#8A5A3B" },
    carbon: { label: "Carb\xF3n", hex: "#4B4350" }
  };
  var SWATCH_IDS = Object.keys(SWATCHES);
  var EYES = {
    ambar: { label: "\xC1mbar", hex: "#F2A63B" },
    azul: { label: "Azul", hex: "#4FA3F7" },
    verde: { label: "Verde", hex: "#5DBB63" },
    violeta: { label: "Violeta", hex: "#9B6BE8" },
    chocolate: { label: "Chocolate", hex: "#5A3A22" }
  };
  var EYE_IDS = Object.keys(EYES);
  var OUTFITS = [
    { id: "ninguna", label: "Sin ropa extra", poss: "mi pelo", icon: "\u{1F9F8}", price: 0, tintable: false },
    { id: "camiseta", label: "Camiseta", poss: "mi camiseta", icon: "\u{1F455}", price: 0, tintable: true },
    { id: "jersey", label: "Jersey", poss: "mi jersey", icon: "\u{1F9F6}", price: 8, tintable: true },
    { id: "vestido", label: "Vestido", poss: "mi vestido", icon: "\u{1F457}", price: 10, tintable: true },
    { id: "peto", label: "Peto", poss: "mi peto", icon: "\u{1F456}", price: 10, tintable: true },
    { id: "capa", label: "Capa", poss: "mi capa", icon: "\u{1F9B8}", price: 14, tintable: true },
    { id: "vestido-gala", label: "Vestido de gala", poss: "mi vestido de gala", icon: "👑", price: 24, tintable: true },
    { id: "vestido-aurora", label: "Vestido aurora", poss: "mi vestido aurora", icon: "🦋", price: 30, tintable: true },
    { id: "chaqueta-bomber", label: "Chaqueta bomber", poss: "mi chaqueta bomber", icon: "🧥", price: 16, tintable: true },
    { id: "chaqueta-lujo", label: "Chaqueta de lujo", poss: "mi chaqueta de lujo", icon: "💎", price: 28, tintable: true },
    { id: "sudadera-estrella", label: "Sudadera estrella", poss: "mi sudadera estrella", icon: "⭐", price: 12, tintable: true },
    { id: "sudadera-neon", label: "Sudadera futurista", poss: "mi sudadera futurista", icon: "⚡", price: 20, tintable: true },
    { id: "capa-galaxia", label: "Capa galaxia", poss: "mi capa galaxia", icon: "🌌", price: 35, tintable: true },
    { id: "capa-real", label: "Capa real", poss: "mi capa real", icon: "✨", price: 42, tintable: true }
  ];
  var SLOTS = ["cabeza", "cara", "cuello", "espalda", "pies"];
  var SLOT_LABEL = { cabeza: "Cabeza", cara: "Cara", cuello: "Cuello", espalda: "Espalda", pies: "Zapatos / patines" };
  var ACCESSORIES = {
    cabeza: [
      { id: "gorro", label: "Gorro de lana", poss: "mi gorro de lana", icon: "\u{1F9E2}", price: 0, tintable: true },
      { id: "corona", label: "Corona", poss: "mi corona", icon: "\u{1F451}", price: 12, tintable: true },
      { id: "lazo", label: "Lazo", poss: "mi lazo", icon: "\u{1F380}", price: 5, tintable: true },
      { id: "copa", label: "Sombrero de copa", poss: "mi sombrero de copa", icon: "\u{1F3A9}", price: 10, tintable: true },
      { id: "flor", label: "Flor", poss: "mi flor", icon: "\u{1F338}", price: 5, tintable: true },
      { id: "diadema", label: "Diadema de estrella", poss: "mi diadema de estrella", icon: "\u2B50", price: 8, tintable: true }
    ],
    cara: [
      { id: "gafas-redondas", label: "Gafas redondas", poss: "mis gafas redondas", icon: "\u{1F453}", price: 0, tintable: true },
      { id: "gafas-estrella", label: "Gafas de estrella", poss: "mis gafas de estrella", icon: "\u{1F929}", price: 8, tintable: true },
      { id: "gafas-sol", label: "Gafas de sol", poss: "mis gafas de sol", icon: "\u{1F576}\uFE0F", price: 8, tintable: false },
      { id: "antifaz", label: "Antifaz", poss: "mi antifaz", icon: "\u{1F9B9}", price: 6, tintable: true }
    ],
    cuello: [
      { id: "bufanda", label: "Bufanda", poss: "mi bufanda", icon: "\u{1F9E3}", price: 0, tintable: true },
      { id: "pajarita", label: "Pajarita", poss: "mi pajarita", icon: "\u{1F454}", price: 5, tintable: true },
      { id: "perlas", label: "Collar de perlas", poss: "mi collar de perlas", icon: "\u{1F4FF}", price: 8, tintable: false },
      { id: "medalla", label: "Medalla", poss: "mi medalla", icon: "\u{1F3C5}", price: 10, tintable: true }
    ],
    espalda: [
      { id: "mochila", label: "Mochila", poss: "mi mochila", icon: "\u{1F392}", price: 0, tintable: true },
      { id: "alas-hada", label: "Alas de hada", poss: "mis alas de hada", icon: "\u{1F9DA}", price: 14, tintable: true },
      { id: "estrellas", label: "Estrellas flotantes", poss: "mis estrellas flotantes", icon: "\u2728", price: 12, tintable: false }
    ],
    pies: [
      { id: "zapatillas-estrella", label: "Zapatillas estrella", poss: "mis zapatillas estrella", icon: "👟", price: 12, tintable: true },
      { id: "botas-aventura", label: "Botas aventureras", poss: "mis botas de aventura", icon: "🥾", price: 18, tintable: true },
      { id: "botines-glam", label: "Botines glam", poss: "mis botines glam", icon: "👢", price: 28, tintable: true },
      { id: "patines-aurora", label: "Patines aurora", poss: "mis patines aurora", icon: "🛼", price: 38, tintable: true }
    ]
  };
  var NEUTRAL_BASE = { fur: "crema", accent: "lila", eyes: "ambar" };
  function defaultLook(base = {}) {
    const b = { ...NEUTRAL_BASE, ...base };
    return { fur: b.fur, accent: b.accent, eyes: b.eyes, outfit: "ninguna", outfitColor: "cielo", accessoryColor: "dorado", accessories: {} };
  }
  var isSwatch = (v) => typeof v === "string" && Object.prototype.hasOwnProperty.call(SWATCHES, v);
  var isEye = (v) => typeof v === "string" && Object.prototype.hasOwnProperty.call(EYES, v);
  var isOutfit = (v) => typeof v === "string" && OUTFITS.some((o) => o.id === v);
  var isAccessory = (slot, id) => typeof slot === "string" && SLOTS.includes(slot) && typeof id === "string" && ACCESSORIES[slot].some((a) => a.id === id);
  function sanitizeLook(raw, base = defaultLook()) {
    const r = raw && typeof raw === "object" ? raw : {};
    const acc = {};
    const ra = r.accessories && typeof r.accessories === "object" ? r.accessories : {};
    for (const s of SLOTS) if (isAccessory(s, ra[s])) acc[s] = ra[s];
    return {
      fur: isSwatch(r.fur) ? r.fur : base.fur,
      accent: isSwatch(r.accent) ? r.accent : base.accent,
      eyes: isEye(r.eyes) ? r.eyes : base.eyes,
      outfit: isOutfit(r.outfit) ? r.outfit : base.outfit,
      outfitColor: isSwatch(r.outfitColor) ? r.outfitColor : base.outfitColor,
      accessoryColor: isSwatch(r.accessoryColor) ? r.accessoryColor : base.accessoryColor,
      accessories: acc
    };
  }
  function applyLookChange(look, change) {
    const next = { ...look, accessories: { ...look.accessories } };
    switch (change.part) {
      case "fur":
      case "accent":
      case "outfitColor":
      case "accessoryColor":
        if (!isSwatch(change.value)) throw new Error("Color desconocido");
        next[change.part] = change.value;
        break;
      case "eyes":
        if (!isEye(change.value)) throw new Error("Color de ojos desconocido");
        next.eyes = change.value;
        break;
      case "outfit":
        if (!isOutfit(change.value)) throw new Error("Prenda desconocida");
        next.outfit = change.value;
        break;
      case "accessory":
        if (change.value === null) {
          delete next.accessories[change.slot];
          break;
        }
        if (!isAccessory(change.slot, change.value)) throw new Error("Accesorio desconocido");
        next.accessories[change.slot] = change.value;
        break;
      default:
        throw new Error("Cambio desconocido");
    }
    return next;
  }
  function findItem(change) {
    if (change.part === "outfit") return OUTFITS.find((o) => o.id === change.value);
    return change.value === null ? void 0 : ACCESSORIES[change.slot].find((a) => a.id === change.value);
  }
  function reactionTo(change, look) {
    switch (change.part) {
      case "fur":
        return "\xA1Pelo nuevo! Me siento como un arco\xEDris con patas.";
      case "accent":
        return "\xA1Mira mis detalles de color! Brillan mucho.";
      case "eyes":
        return "\xA1Ojos nuevos! Ahora lo veo todo todav\xEDa m\xE1s bonito.";
      case "outfitColor":
      case "accessoryColor":
        return "\xA1Qu\xE9 color tan divertido! Me encanta.";
      case "outfit": {
        const o = OUTFITS.find((x) => x.id === look.outfit);
        return look.outfit === "ninguna" ? "\xA1Listo! As\xED estoy c\xF3modo para jugar." : "\xA1Mira " + (o?.poss ?? "mi ropa") + "! Con eso me siento genial.";
      }
      case "accessory": {
        if (change.value === null) return "\xA1Listo! Me lo quito y sigo igual de contento.";
        const it = ACCESSORIES[change.slot].find((a) => a.id === change.value);
        return "\xA1Mira " + (it?.poss ?? "mi accesorio") + "! Con eso me siento genial.";
      }
    }
  }
  function randomLook(base = defaultLook(), rnd = Math.random, allow = () => true) {
    const pick2 = (xs) => xs[Math.min(xs.length - 1, Math.floor(rnd() * xs.length))];
    let look = base;
    look = applyLookChange(look, { part: "fur", value: pick2(SWATCH_IDS) });
    look = applyLookChange(look, { part: "accent", value: pick2(SWATCH_IDS) });
    look = applyLookChange(look, { part: "eyes", value: pick2(EYE_IDS) });
    look = applyLookChange(look, { part: "accessoryColor", value: pick2(SWATCH_IDS) });
    look = applyLookChange(look, { part: "outfitColor", value: pick2(SWATCH_IDS) });
    const outs = OUTFITS.filter((o) => allow("out:" + o.id));
    if (outs.length) look = applyLookChange(look, { part: "outfit", value: pick2(outs).id });
    for (const s of SLOTS) {
      const opts = ACCESSORIES[s].filter((a) => allow("acc:" + s + ":" + a.id));
      if (opts.length && rnd() < 0.55) look = applyLookChange(look, { part: "accessory", slot: s, value: pick2(opts).id });
    }
    return look;
  }
  var outfitKey = (id) => "out:" + id;
  var accessoryKey = (slot, id) => "acc:" + slot + ":" + id;
  function lookItems() {
    const out = OUTFITS.map((o) => ({ key: outfitKey(o.id), kind: "out", label: o.label, icon: o.icon, price: o.price }));
    for (const s of SLOTS) for (const a of ACCESSORIES[s]) out.push({ key: accessoryKey(s, a.id), kind: "acc", slot: s, label: a.label, icon: a.icon, price: a.price });
    return out;
  }

  // packages/modules/star-shop/src/index.ts
  var HOMES = [
    { key: "home:cabana", kind: "home", label: "Caba\xF1a de madera", icon: "\u{1F6D6}", price: 0 },
    { key: "home:hongo", kind: "home", label: "Casita-seta", icon: "\u{1F344}", price: 20 },
    { key: "home:arbol", kind: "home", label: "Casa del \xE1rbol", icon: "\u{1F333}", price: 30 },
    { key: "home:nube", kind: "home", label: "Casa en las nubes", icon: "\u2601\uFE0F", price: 45 }
  ];
  var VEHICLES = [
    { key: "veh:patinete", kind: "veh", label: "Patinete", icon: "\u{1F6F4}", price: 10 },
    { key: "veh:bici", kind: "veh", label: "Bici", icon: "\u{1F6B2}", price: 15 },
    { key: "veh:moto", kind: "veh", label: "Moto", icon: "\u{1F3CD}\uFE0F", price: 25 },
    { key: "veh:coche", kind: "veh", label: "Cochecito", icon: "\u{1F697}", price: 30 },
    { key: "veh:cohete", kind: "veh", label: "Cohete", icon: "\u{1F680}", price: 40 }
  ];
  var DECOR = [
    { key: "dec:planta", kind: "dec", label: "Planta", icon: "\u{1FAB4}", price: 5 },
    { key: "dec:alfombra", kind: "dec", label: "Alfombra", icon: "\u{1F7E3}", price: 6 },
    { key: "dec:lampara", kind: "dec", label: "L\xE1mpara", icon: "\u{1F4A1}", price: 8 },
    { key: "dec:cama", kind: "dec", label: "Cama", icon: "\u{1F6CF}\uFE0F", price: 10 },
    { key: "dec:estanteria", kind: "dec", label: "Estanter\xEDa", icon: "\u{1F4DA}", price: 10 }
  ];
  var WORLD_ITEMS = [...HOMES, ...VEHICLES, ...DECOR];
  var HOME_KEYS = HOMES.map((h) => h.key);
  var VEHICLE_KEYS = VEHICLES.map((v) => v.key);
  var DECOR_KEYS = DECOR.map((d) => d.key);
  var DEFAULT_HOME = "home:cabana";
  var DAILY_CAP = 12;
  var MAX_DECOR = 4;
  var MAX_SEEN = 60;
  var num = (v, lo, hi, d) => typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.floor(v))) : d;
  var strs = (v) => Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  var DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
  var copy = (w3) => ({ ...w3, owned: [...w3.owned], decor: [...w3.decor], seen: [...w3.seen] });
  var EARN = { acierto: 1, esfuerzo: 1, leccion: 2, social: 2, racha: 3 };
  function earn(w3, reason, today, eventId) {
    if (!DAY_RE.test(today)) throw new Error("Fecha inv\xE1lida (se espera AAAA-MM-DD)");
    const base = copy(w3);
    if (base.day !== today) {
      base.day = today;
      base.earnedToday = 0;
    }
    if (eventId && base.seen.includes(eventId)) return { world: base, gained: 0, capped: false, duplicate: true };
    const room = Math.max(0, DAILY_CAP - base.earnedToday);
    const gained = Math.min(EARN[reason], room);
    if (eventId) base.seen = [...base.seen, eventId].slice(-MAX_SEEN);
    base.stars += gained;
    base.lifetime += gained;
    base.earnedToday += gained;
    return { world: base, gained, capped: gained < EARN[reason], duplicate: false };
  }
  var owns = (w3, key) => w3.owned.includes(key);
  function createShop(extra = []) {
    const catalog = [];
    const index = /* @__PURE__ */ new Map();
    for (const it of [...extra, ...WORLD_ITEMS]) {
      if (!it || typeof it.key !== "string" || !it.key) throw new Error("Objeto de tienda sin clave");
      if (index.has(it.key)) throw new Error("Clave repetida en la tienda: " + it.key);
      if (!Number.isInteger(it.price) || it.price < 0) throw new Error("Precio inv\xE1lido (estrellas enteras \u2265 0): " + it.key);
      index.set(it.key, it);
      catalog.push(it);
    }
    const free = () => catalog.filter((i) => i.price === 0).map((i) => i.key);
    const shop = {
      catalog,
      item: (key) => index.get(key),
      newWorld: () => ({ stars: 0, lifetime: 0, day: "", earnedToday: 0, owned: free(), home: DEFAULT_HOME, vehicle: null, decor: [], seen: [] }),
      sanitize(raw) {
        const r = raw && typeof raw === "object" ? raw : {};
        const owned = Array.from(/* @__PURE__ */ new Set([...free(), ...strs(r.owned).filter((k) => index.has(k))]));
        const has = (k) => owned.includes(k);
        const home = typeof r.home === "string" && HOME_KEYS.includes(r.home) && has(r.home) ? r.home : DEFAULT_HOME;
        const vehicle = typeof r.vehicle === "string" && VEHICLE_KEYS.includes(r.vehicle) && has(r.vehicle) ? r.vehicle : null;
        const decor = Array.from(new Set(strs(r.decor).filter((k) => DECOR_KEYS.includes(k) && has(k)))).slice(0, MAX_DECOR);
        return {
          stars: num(r.stars, 0, 1e5, 0),
          lifetime: num(r.lifetime, 0, 1e7, 0),
          day: typeof r.day === "string" && DAY_RE.test(r.day) ? r.day : "",
          earnedToday: num(r.earnedToday, 0, DAILY_CAP, 0),
          owned,
          home,
          vehicle,
          decor,
          seen: strs(r.seen).slice(-MAX_SEEN)
        };
      },
      buy(w3, key) {
        const it = index.get(key);
        if (!it) return { world: w3, ok: false, why: "no-existe" };
        if (owns(w3, key)) return { world: w3, ok: false, why: "ya-lo-tienes" };
        if (w3.stars < it.price) return { world: w3, ok: false, why: "faltan-estrellas", missing: it.price - w3.stars };
        return { world: { ...copy(w3), stars: w3.stars - it.price, owned: [...w3.owned, key] }, ok: true };
      },
      setHome(w3, key) {
        if (!HOME_KEYS.includes(key) || !owns(w3, key)) throw new Error("Esa casa todav\xEDa no es tuya");
        return { ...copy(w3), home: key };
      },
      setVehicle(w3, key) {
        if (key !== null && (!VEHICLE_KEYS.includes(key) || !owns(w3, key))) throw new Error("Ese veh\xEDculo todav\xEDa no es tuyo");
        return { ...copy(w3), vehicle: key };
      },
      toggleDecor(w3, key) {
        if (!DECOR_KEYS.includes(key) || !owns(w3, key)) throw new Error("Ese objeto todav\xEDa no es tuyo");
        const on = w3.decor.includes(key);
        if (!on && w3.decor.length >= MAX_DECOR) throw new Error("Ya tienes " + MAX_DECOR + " objetos puestos; quita uno primero");
        return { ...copy(w3), decor: on ? w3.decor.filter((k) => k !== key) : [...w3.decor, key] };
      }
    };
    return shop;
  }

  // packages/modules/scene-stage/src/scene.ts
  var TINT_RE = /^[a-z][a-z-]{0,15}$/;
  var STAGE = { x: 6, z: 4 };
  var MAX_PROPS = 80;
  var MAX_COMMANDS = 200;
  var MAX_SAID = 6;
  var PROP_KINDS = ["columna", "plato", "caja", "tarta", "cartel", "semaforo"];
  var POSES = ["idle", "habla", "piensa", "celebra", "senala", "saluda"];
  var VIEWS = ["amplia", "mesa", "primer-plano"];
  var PLACE_LABEL = ["U", "D", "C", "UM", "DM"];
  var PLACE_NAME = ["unidades", "decenas", "centenas", "unidades de millar", "decenas de millar"];
  var MAX_PLACE = PLACE_LABEL.length - 1;
  function newScene() {
    return { props: [], creature: { at: [-4, 1.5], pose: "idle", point: null }, camera: "amplia", said: [], rev: 0 };
  }
  function limits(kind) {
    switch (kind) {
      case "columna":
        return { n: 120, of: [0, MAX_PLACE] };
      case "plato":
      case "caja":
        return { n: 60, of: [0, 0] };
      case "tarta":
        return { n: 12, of: [2, 12] };
      case "semaforo":
        return { n: 3, of: [0, 0] };
      case "cartel":
        return { n: 0, of: [0, 0] };
    }
  }
  var ID_RE = /^[a-z][a-z0-9_-]{0,23}$/;
  var clampStage = (p) => [Math.max(-STAGE.x, Math.min(STAGE.x, p[0])), Math.max(-STAGE.z, Math.min(STAGE.z, p[1]))];
  var r2 = (v) => Math.round(v * 100) / 100;
  function cleanText(raw, max, guard) {
    if (typeof raw !== "string") return null;
    const t = raw.replace(/[\u0000-\u001f\u007f<>]/g, "").trim().slice(0, max);
    if (!t || guard && !guard(t)) return null;
    return t;
  }
  var isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
  var isInt = (v, lo, hi) => typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi;
  function pos(v) {
    if (!Array.isArray(v) || v.length !== 2) return null;
    const [x, z] = v;
    if (typeof x !== "number" || typeof z !== "number" || !Number.isFinite(x) || !Number.isFinite(z)) return null;
    if (Math.abs(x) > STAGE.x || Math.abs(z) > STAGE.z) return null;
    return [r2(x), r2(z)];
  }
  function validateOne(c, guard) {
    if (!isObj(c) || typeof c.op !== "string") return "no es un comando";
    const idOf = (k) => typeof c[k] === "string" && ID_RE.test(c[k]) ? c[k] : null;
    switch (c.op) {
      case "reset":
        return { op: "reset" };
      case "spawn": {
        const id = idOf("id");
        if (!id) return "id inv\xE1lido";
        if (typeof c.kind !== "string" || !PROP_KINDS.includes(c.kind)) return "tipo de objeto desconocido";
        const kind = c.kind, lim = limits(kind), at = pos(c.at);
        if (!at) return "posici\xF3n fuera del escenario";
        const out = { op: "spawn", id, kind, at };
        if (c.n !== void 0) {
          if (!isInt(c.n, 0, lim.n)) return "cantidad fuera de rango";
          out.n = c.n;
        }
        if (c.of !== void 0) {
          if (!isInt(c.of, lim.of[0], lim.of[1])) return 'valor "of" fuera de rango';
          out.of = c.of;
        }
        if (c.label !== void 0) {
          const l = cleanText(c.label, 24, guard);
          if (l === null) return "etiqueta no aceptable";
          out.label = l;
        }
        if (c.tint !== void 0) {
          if (typeof c.tint !== "string" || !TINT_RE.test(c.tint)) return "color no v\xE1lido";
          out.tint = c.tint;
        }
        return out;
      }
      case "set": {
        const id = idOf("id");
        if (!id) return "id inv\xE1lido";
        const out = { op: "set", id };
        if (c.n !== void 0) {
          if (!isInt(c.n, 0, 120)) return "cantidad fuera de rango";
          out.n = c.n;
        }
        if (c.of !== void 0) {
          if (!isInt(c.of, 0, 12)) return 'valor "of" fuera de rango';
          out.of = c.of;
        }
        if (c.label !== void 0) {
          const l = cleanText(c.label, 24, guard);
          if (l === null) return "etiqueta no aceptable";
          out.label = l;
        }
        if (c.tint !== void 0) {
          if (typeof c.tint !== "string" || !TINT_RE.test(c.tint)) return "color no v\xE1lido";
          out.tint = c.tint;
        }
        return out;
      }
      case "move": {
        const id = idOf("id"), to = pos(c.to);
        if (!id) return "id inv\xE1lido";
        if (!to) return "destino fuera del escenario";
        return { op: "move", id, to };
      }
      case "remove": {
        const id = idOf("id");
        return id ? { op: "remove", id } : "id inv\xE1lido";
      }
      case "light": {
        const id = idOf("id");
        if (!id) return "id inv\xE1lido";
        if (typeof c.on !== "boolean") return '"on" debe ser booleano';
        return { op: "light", id, on: c.on };
      }
      case "canjear": {
        const from = idOf("from"), to = idOf("to");
        if (!from || !to) return "id inv\xE1lido";
        if (c.dir !== "subir" && c.dir !== "bajar") return "direcci\xF3n inv\xE1lida";
        const out = { op: "canjear", from, to, dir: c.dir };
        if (c.times !== void 0) {
          if (!isInt(c.times, 1, 12)) return "veces fuera de rango";
          out.times = c.times;
        }
        return out;
      }
      case "creature": {
        const out = { op: "creature" };
        if (c.go !== void 0) {
          const g = pos(c.go);
          if (!g) return "destino fuera del escenario";
          out.go = g;
        }
        if (c.pose !== void 0) {
          if (typeof c.pose !== "string" || !POSES.includes(c.pose)) return "pose desconocida";
          out.pose = c.pose;
        }
        if (c.point !== void 0) {
          if (c.point !== null && idOf("point") === null) return "id inv\xE1lido";
          out.point = c.point;
        }
        return out;
      }
      case "camera":
        return typeof c.view === "string" && VIEWS.includes(c.view) ? { op: "camera", view: c.view } : "vista desconocida";
      case "say": {
        const t = cleanText(c.text, 160, guard);
        return t === null ? "texto no aceptable" : { op: "say", text: t };
      }
      default:
        return "operaci\xF3n no permitida";
    }
  }
  function validateCommands(raw, opts = {}) {
    const commands = [], rejected = [];
    if (!Array.isArray(raw)) return { commands, rejected: [{ index: -1, reason: "se esperaba una lista de comandos" }] };
    raw.forEach((c, index) => {
      if (index >= MAX_COMMANDS) {
        rejected.push({ index, reason: "demasiados comandos" });
        return;
      }
      const v = validateOne(c, opts.textGuard);
      if (typeof v === "string") rejected.push({ index, reason: v });
      else commands.push(v);
    });
    return { commands, rejected };
  }
  var clone = (s) => ({ ...s, props: s.props.map((p) => ({ ...p, at: [...p.at] })), creature: { ...s.creature, at: [...s.creature.at] }, said: [...s.said] });
  var find = (s, id) => {
    const p = s.props.find((x) => x.id === id);
    if (!p) throw new Error('No existe el objeto "' + id + '"');
    return p;
  };
  var column = (s, place) => s.props.find((p) => p.kind === "columna" && p.of === place);
  function fit(p) {
    const lim = limits(p.kind);
    p.of = Math.max(lim.of[0], Math.min(lim.of[1], p.of));
    p.n = Math.max(0, Math.min(p.kind === "tarta" ? p.of : lim.n, p.n));
  }
  function applyCommand(state, cmd) {
    const s = clone(state), events = [];
    switch (cmd.op) {
      case "reset": {
        const n = newScene();
        n.rev = s.rev + 1;
        return { state: n, events };
      }
      case "spawn": {
        if (s.props.some((p2) => p2.id === cmd.id)) throw new Error('Ya existe "' + cmd.id + '"');
        if (s.props.length >= MAX_PROPS) throw new Error("Demasiados objetos en la escena");
        const p = { id: cmd.id, kind: cmd.kind, at: clampStage(cmd.at), n: cmd.n ?? 0, of: cmd.of ?? (cmd.kind === "tarta" ? 4 : 0), label: cmd.label ?? (cmd.kind === "columna" ? PLACE_LABEL[cmd.of ?? 0] ?? "" : ""), tint: cmd.tint ?? null, lit: false };
        fit(p);
        s.props.push(p);
        events.push({ type: "crea", id: p.id });
        break;
      }
      case "set": {
        const p = find(s, cmd.id);
        if (cmd.of !== void 0) p.of = cmd.of;
        if (cmd.n !== void 0) p.n = cmd.n;
        if (cmd.label !== void 0) p.label = cmd.label;
        if (cmd.tint !== void 0) p.tint = cmd.tint;
        fit(p);
        events.push({ type: "cambia", id: p.id });
        break;
      }
      case "move": {
        const p = find(s, cmd.id);
        p.at = clampStage(cmd.to);
        events.push({ type: "mueve", id: p.id });
        break;
      }
      case "remove": {
        find(s, cmd.id);
        s.props = s.props.filter((p) => p.id !== cmd.id);
        if (s.creature.point === cmd.id) s.creature.point = null;
        events.push({ type: "quita", id: cmd.id });
        break;
      }
      case "light":
        find(s, cmd.id).lit = cmd.on;
        break;
      case "canjear": {
        const a = find(s, cmd.from), b = find(s, cmd.to), times = cmd.times ?? 1;
        if (a.kind !== "columna" || b.kind !== "columna") throw new Error("Solo se pueden canjear columnas de valor posicional");
        const ok = cmd.dir === "subir" ? b.of === a.of + 1 : b.of === a.of - 1;
        if (!ok) throw new Error("Las columnas no son vecinas en esa direcci\xF3n");
        if (cmd.dir === "subir") {
          if (a.n < 10 * times) throw new Error("No hay fichas para canjear");
          a.n -= 10 * times;
          b.n += times;
        } else {
          if (a.n < times) throw new Error("No hay fichas para canjear");
          if (b.n + 10 * times > limits("columna").n) throw new Error("La columna se llenar\xEDa demasiado");
          a.n -= times;
          b.n += 10 * times;
        }
        events.push({ type: "canje", from: a.id, to: b.id, dir: cmd.dir, times });
        break;
      }
      case "creature": {
        if (cmd.go) s.creature.at = clampStage(cmd.go);
        if (cmd.pose) s.creature.pose = cmd.pose;
        if (cmd.point !== void 0) {
          if (cmd.point !== null) find(s, cmd.point);
          s.creature.point = cmd.point;
        }
        break;
      }
      case "camera":
        s.camera = cmd.view;
        break;
      case "say":
        s.said = [...s.said, cmd.text].slice(-MAX_SAID);
        events.push({ type: "dice", text: cmd.text });
        break;
    }
    s.rev += 1;
    return { state: s, events };
  }
  function applyCommands(state, cmds) {
    let cur = state;
    const events = [], errors = [];
    for (const c of cmds) {
      try {
        const r = applyCommand(cur, c);
        cur = r.state;
        events.push(...r.events);
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }
    return { state: cur, events, errors };
  }
  function userMove(state, id, to) {
    if (!Number.isFinite(to[0]) || !Number.isFinite(to[1])) throw new Error("Posici\xF3n inv\xE1lida");
    return applyCommand(state, { op: "move", id, to: [r2(Math.max(-STAGE.x, Math.min(STAGE.x, to[0]))), r2(Math.max(-STAGE.z, Math.min(STAGE.z, to[1])))] }).state;
  }
  function userAdjust(state, id, delta) {
    const p = find(state, id);
    if (p.kind === "cartel") return state;
    if (p.kind === "semaforo") return applyCommand(state, { op: "set", id, n: (p.n + (delta > 0 ? 1 : 3)) % 4 }).state;
    const next = Math.max(0, Math.min(p.kind === "tarta" ? p.of : limits(p.kind).n, p.n + delta));
    return next === p.n ? state : applyCommand(state, { op: "set", id, n: next }).state;
  }
  function userExchange(state, id, dir) {
    const a = find(state, id);
    if (a.kind !== "columna") return state;
    const b = column(state, dir === "subir" ? a.of + 1 : a.of - 1);
    if (!b) return state;
    try {
      return applyCommand(state, { op: "canjear", from: a.id, to: b.id, dir }).state;
    } catch {
      return state;
    }
  }
  function builtValue(state) {
    return state.props.reduce((t, p) => p.kind === "columna" ? t + p.n * 10 ** p.of : t, 0);
  }
  function cookieCount(state) {
    return state.props.reduce((t, p) => p.kind === "plato" || p.kind === "caja" ? t + p.n : t, 0);
  }
  function checkBuild(state, goal) {
    const now = goal.kind === "valor" ? builtValue(state) : goal.kind === "galletas" ? cookieCount(state) : state.props.find((p) => p.id === goal.id)?.n ?? 0;
    return { done: now === goal.target, now, target: goal.target };
  }

  // packages/modules/scene-stage/src/lesson.ts
  var LESSON_BASIS = [
    'IES/WWC 2021006 \xB7 Rec. 1 \xB7 instrucci\xF3n sistem\xE1tica y expl\xEDcita (pasos cortos y "tu turno")',
    "IES/WWC 2021006 \xB7 Rec. 2 \xB7 lenguaje matem\xE1tico (se nombran unidades, decenas, porciones\u2026)",
    "IES/WWC 2021006 \xB7 Rec. 3 \xB7 representaciones concretas conectadas con la notaci\xF3n (evidencia s\xF3lida)"
  ];
  function stepsFor(lesson, includeSolution) {
    if (includeSolution) return lesson.steps;
    const i = lesson.steps.findIndex((s) => s.reveals);
    return i < 0 ? lesson.steps : lesson.steps.slice(0, i);
  }
  var PLACE_ONE = ["unidad", "decena", "centena", "unidad de millar", "decena de millar"];
  var nd = (n) => String(Math.abs(Math.trunc(n))).length;
  function digits(n, places) {
    const out = [];
    let v = n;
    for (let i = 0; i < places; i++) {
      out.push(v % 10);
      v = Math.floor(v / 10);
    }
    return out;
  }
  var placeName = (p, n) => (n === 1 ? PLACE_ONE[p] : PLACE_NAME[p]) ?? "";
  function describe(ds) {
    const parts = [];
    for (let p = ds.length - 1; p >= 0; p--) {
      const n = ds[p] ?? 0;
      if (n > 0) parts.push(n + " " + placeName(p, n));
    }
    if (!parts.length) return "nada";
    if (parts.length === 1) return parts[0];
    return parts.slice(0, -1).join(", ") + " y " + parts[parts.length - 1];
  }
  var hash = (s) => {
    let h = 7;
    for (let i = 0; i < s.length; i++) h = h * 31 + s.charCodeAt(i) >>> 0;
    return h;
  };
  var pick = (xs, seed) => xs[hash(seed) % xs.length];
  var CX = 1.5;
  var colId = (p) => "c" + p;
  var r22 = (v) => Math.round(v * 100) / 100;
  var colX = (p, P) => r22(CX + (P - 1) / 2 * 1.5 - 1.5 * p);
  var sign = (label) => ({ op: "set", id: "cartel", label });
  var spawnSign = (label) => ({ op: "spawn", id: "cartel", kind: "cartel", at: [CX, -2.7], label, tint: "dorado" });
  var spawnColumns = (P) => Array.from({ length: P }, (_, p) => ({ op: "spawn", id: colId(p), kind: "columna", at: [colX(p, P), 0], of: p, n: 0 }));
  var setColumns = (ds) => ds.map((n, p) => ({ op: "set", id: colId(p), n }));
  var sideSpot = (P) => [r22(Math.max(-5, colX(P - 1, P) - 1.9)), 0.8];
  var lightAll = (P, on) => Array.from({ length: P }, (_, p) => ({ op: "light", id: colId(p), on }));
  var GUARD;
  function safe(text, max, where) {
    if (text.length > max) throw new Error("Texto demasiado largo (" + text.length + " > " + max + ") en " + where);
    const clean = cleanText(text, max, GUARD);
    if (clean === null) throw new Error("Texto de lecci\xF3n no aceptable en " + where);
    return clean;
  }
  var SAY_MAX = 240;
  function step(id, say, commands, reveals, build) {
    const clean = safe(say, SAY_MAX, "paso " + id);
    return build ? { id, say: clean, commands, reveals, build } : { id, say: clean, commands, reveals };
  }
  function normalizeUp(cur, P, idPrefix, intro) {
    const out = [];
    for (let p = 0; p < P - 1; p++) {
      const k = Math.floor((cur[p] ?? 0) / 10);
      if (k > 0) {
        out.push(step(idPrefix + p, intro(p, cur[p] ?? 0, k), [{ op: "light", id: colId(p), on: true }, { op: "canjear", from: colId(p), to: colId(p + 1), dir: "subir", times: k }, { op: "light", id: colId(p), on: false }, { op: "light", id: colId(p + 1), on: true }], true));
        cur[p] = (cur[p] ?? 0) - 10 * k;
        cur[p + 1] = (cur[p + 1] ?? 0) + k;
      }
    }
    return out;
  }
  function suma(ex) {
    const [a = 0, b = 0] = ex.params, sum = a + b, P = Math.min(5, nd(sum)), da = digits(a, P), db = digits(b, P);
    const here = sideSpot(P);
    const steps = [
      step("intro", "Vamos a ver " + a + " + " + b + " con fichas. Cada columna vale 10 veces m\xE1s que la de su derecha.", [{ op: "reset" }, { op: "camera", view: "mesa" }, ...spawnColumns(P), spawnSign(a + " + " + b), { op: "creature", go: here, pose: "habla" }], false),
      step("poner-a", "Primero ponemos " + a + ": " + describe(da) + ".", [...setColumns(da), ...lightAll(P, false), { op: "creature", point: colId(0), pose: "senala" }], false),
      step("poner-b", "Ahora sumamos " + b + ": " + describe(db) + ". Las fichas se juntan en cada columna.", [...setColumns(da.map((d, p) => d + (db[p] ?? 0))), { op: "creature", pose: "habla" }], false)
    ];
    const cur = da.map((d, p) => d + (db[p] ?? 0));
    const carries = normalizeUp(cur, P, "canje-", (p, have, k) => "En las " + PLACE_NAME[p] + " hay " + have + " fichas. Cada 10 se cambian por 1 de " + placeName(p + 1, 1) + ": cambiamos " + 10 * k + " por " + k + ".");
    if (carries.length) steps.push(...carries);
    else steps.push(step("sin-canje", "En ninguna columna hay 10 fichas o m\xE1s, as\xED que no hace falta cambiar nada.", [], true));
    steps.push(step("resultado", "Contamos lo que hay: " + describe(digits(sum, P)) + ". \xA1" + a + " + " + b + " = " + sum + "!", [...lightAll(P, false), sign(a + " + " + b + " = " + sum), { op: "creature", pose: "celebra", point: null }], true));
    steps.push(step("tu-turno", "Tu turno: construye " + sum + " t\xFA con las fichas. Toca + y \u2212 en cada columna, o cambia 10 por 1.", [...setColumns(Array(P).fill(0)), ...lightAll(P, false), { op: "creature", pose: "idle" }], true, { kind: "valor", target: sum }));
    return steps;
  }
  function resta(ex) {
    const [a = 0, b = 0] = ex.params, ans = a - b, P = Math.min(5, nd(a)), da = digits(a, P), db = digits(b, P);
    const here = sideSpot(P);
    const steps = [
      step("intro", "Vamos a ver " + a + " \u2212 " + b + " con fichas. Restar es quitar, y a veces hay que cambiar una ficha grande por diez peque\xF1as.", [{ op: "reset" }, { op: "camera", view: "mesa" }, ...spawnColumns(P), spawnSign(a + " \u2212 " + b), { op: "creature", go: here, pose: "habla" }], false),
      step("poner-a", "Primero ponemos " + a + ": " + describe(da) + ".", [...setColumns(da), { op: "creature", point: colId(0), pose: "senala" }], false),
      step("quitar-b", "Ahora hay que quitar " + b + ": " + describe(db) + ". Empezamos por las unidades.", [{ op: "creature", pose: "piensa" }], false)
    ];
    const cur = [...da];
    for (let p = 0; p < P; p++) {
      const need = db[p] ?? 0;
      if (need === 0) continue;
      if ((cur[p] ?? 0) < need) {
        let q = p + 1;
        while (q < P && (cur[q] ?? 0) === 0) q++;
        const cmds = [];
        for (let r = q; r > p; r--) {
          cmds.push({ op: "canjear", from: colId(r), to: colId(r - 1), dir: "bajar", times: 1 });
          cur[r] = (cur[r] ?? 0) - 1;
          cur[r - 1] = (cur[r - 1] ?? 0) + 10;
        }
        steps.push(step("prestamo-" + p, "En las " + PLACE_NAME[p] + " no alcanzan las fichas. Cambiamos 1 ficha de " + placeName(q, 1) + " por 10 de " + placeName(q - 1, 10) + (q - 1 > p ? " y seguimos hasta llegar a las " + PLACE_NAME[p] : "") + ".", [{ op: "light", id: colId(q), on: true }, ...cmds, { op: "light", id: colId(q), on: false }], true));
      }
      cur[p] = (cur[p] ?? 0) - need;
      steps.push(step("quitar-" + p, "Quitamos " + need + " " + placeName(p, need) + ".", [{ op: "light", id: colId(p), on: true }, { op: "set", id: colId(p), n: cur[p] ?? 0 }, { op: "light", id: colId(p), on: false }], true));
    }
    steps.push(step("resultado", "Lo que queda son " + describe(digits(ans, P)) + ". \xA1" + a + " \u2212 " + b + " = " + ans + "!", [sign(a + " \u2212 " + b + " = " + ans), { op: "creature", pose: "celebra", point: null }], true));
    steps.push(step("tu-turno", "Tu turno: empieza con " + a + " y quita " + b + " t\xFA. Si no alcanzan las fichas, cambia 1 por 10.", [...setColumns(da), { op: "creature", pose: "idle" }], true, { kind: "valor", target: ans }));
    return steps;
  }
  var grid = (i, total) => {
    const perRow = Math.min(6, total), row = Math.floor(i / perRow), inRow = Math.min(perRow, total - row * perRow), col = i % perRow;
    return [r22(CX + (col - (inRow - 1) / 2) * 1.7), r22(-0.6 + row * 1.7)];
  };
  function multiplicacion(ex) {
    const [a = 0, b = 0] = ex.params, prod = a * b;
    if (a <= 12 && b <= 12) {
      const plates = Array.from({ length: b }, (_, i) => "p" + i);
      const steps2 = [
        step("intro", a + " \xD7 " + b + " quiere decir " + b + " grupos de " + a + ". Aqu\xED est\xE1n los " + b + " platos.", [{ op: "reset" }, { op: "camera", view: "mesa" }, ...plates.map((id, i) => ({ op: "spawn", id, kind: "plato", at: grid(i, b), n: 0 })), spawnSign(a + " \xD7 " + b), { op: "creature", go: [-3.6, 0.8], pose: "habla" }], false),
        step("poner", "Ponemos " + a + " galletas en cada plato.", plates.map((id) => ({ op: "set", id, n: a })), false),
        step("contar", "Contamos de " + a + " en " + a + ".", [{ op: "creature", pose: "senala", point: "p0" }, ...plates.flatMap((id, i) => [{ op: "light", id, on: true }, sign(String(a * (i + 1)))])], true),
        step("resultado", "\xA1" + a + " \xD7 " + b + " = " + prod + "!", [...plates.map((id) => ({ op: "light", id, on: false })), sign(a + " \xD7 " + b + " = " + prod), { op: "creature", pose: "celebra", point: null }], true)
      ];
      return steps2;
    }
    const P = Math.min(5, nd(prod)), da = digits(a, P), here = sideSpot(P);
    const steps = [
      step("intro", a + " \xD7 " + b + ": multiplicar es repetir " + a + ", " + b + " veces. Lo hacemos por columnas.", [{ op: "reset" }, { op: "camera", view: "mesa" }, ...spawnColumns(P), spawnSign(a + " \xD7 " + b), { op: "creature", go: here, pose: "habla" }], false),
      step("poner-a", "Primero ponemos " + a + ": " + describe(da) + ".", [...setColumns(da), { op: "creature", point: colId(0), pose: "senala" }], false),
      step("repetir", "Repetimos cada columna " + b + " veces.", setColumns(da.map((d) => d * b)), false)
    ];
    const cur = da.map((d) => d * b);
    steps.push(...normalizeUp(cur, P, "canje-", (p, have, k) => "En las " + PLACE_NAME[p] + " hay " + have + " fichas. Cambiamos " + 10 * k + " por " + k + " de " + placeName(p + 1, k) + "."));
    steps.push(step("resultado", "Contamos lo que hay: " + describe(digits(prod, P)) + ". \xA1" + a + " \xD7 " + b + " = " + prod + "!", [...lightAll(P, false), sign(a + " \xD7 " + b + " = " + prod), { op: "creature", pose: "celebra", point: null }], true));
    if (prod <= 999) steps.push(step("tu-turno", "Tu turno: construye " + prod + " t\xFA con las fichas.", [...setColumns(Array(P).fill(0)), { op: "creature", pose: "idle" }], true, { kind: "valor", target: prod }));
    return steps;
  }
  function division(ex) {
    const [b = 1, q = 0] = ex.params, total = b * q;
    if (total <= 60) {
      const plates = Array.from({ length: b }, (_, i) => "p" + i);
      return [
        step("intro", "Tenemos " + total + " galletas para repartir entre " + b + " platos, igual en cada uno.", [{ op: "reset" }, { op: "camera", view: "mesa" }, { op: "spawn", id: "caja", kind: "caja", at: [CX, -1.9], n: total }, ...plates.map((id, i) => ({ op: "spawn", id, kind: "plato", at: grid(i, b).map((v, k) => k === 1 ? v + 1 : v), n: 0 })), spawnSign(total + " \xF7 " + b), { op: "creature", go: [-3.6, 0.8], pose: "habla" }], false),
        step("una-vuelta", "Repartimos de una en una: una galleta para cada plato.", [...plates.map((id) => ({ op: "set", id, n: 1 })), { op: "set", id: "caja", n: total - b }], false),
        step("seguir", "Seguimos repartiendo hasta que no quede ninguna. \xA1Cada plato tiene " + q + "!", [...plates.map((id) => ({ op: "set", id, n: q })), { op: "set", id: "caja", n: 0 }, { op: "creature", pose: "senala", point: "p0" }], true),
        step("resultado", "\xA1" + total + " \xF7 " + b + " = " + q + "!", [sign(total + " \xF7 " + b + " = " + q), { op: "creature", pose: "celebra", point: null }], true)
      ];
    }
    const P = Math.min(5, nd(total)), dt = digits(total, P), dq = digits(q, P), here = sideSpot(P);
    const steps = [
      step("intro", total + " \xF7 " + b + ": pensamos al rev\xE9s. \xBFQu\xE9 n\xFAmero multiplicado por " + b + " da " + total + "?", [{ op: "reset" }, { op: "camera", view: "mesa" }, ...spawnColumns(P), ...setColumns(dt), spawnSign("? \xD7 " + b + " = " + total), { op: "creature", go: here, pose: "piensa" }], false),
      step("tabla", "Mira la tabla del " + b + " y prueba n\xFAmeros hasta llegar a " + total + ".", [{ op: "creature", pose: "habla" }], false),
      step("probar", "Probamos con " + q + ": lo repetimos " + b + " veces.", [{ op: "creature", pose: "senala", point: colId(0) }, ...setColumns(dq.map((d) => d * b))], true)
    ];
    const cur = dq.map((d) => d * b);
    steps.push(...normalizeUp(cur, P, "canje-", (p, have, k) => "En las " + PLACE_NAME[p] + " hay " + have + " fichas. Cambiamos " + 10 * k + " por " + k + " de " + placeName(p + 1, k) + "."));
    steps.push(step("resultado", "Sale " + total + ". As\xED que " + q + " \xD7 " + b + " = " + total + " y " + total + " \xF7 " + b + " = " + q + ".", [sign(total + " \xF7 " + b + " = " + q), { op: "creature", pose: "celebra", point: null }], true));
    return steps;
  }
  function fracciones(ex) {
    const [n1 = 1, n2 = 1, d = 2] = ex.params, n = n1 + n2;
    const gcd2 = (x, y) => y ? gcd2(y, x % y) : x, g = gcd2(n, d);
    const steps = [
      step("intro", "Cada tarta est\xE1 partida en " + d + " porciones iguales. Cada porci\xF3n es 1/" + d + ". Aqu\xED hay " + n1 + "/" + d + " y aqu\xED " + n2 + "/" + d + ".", [{ op: "reset" }, { op: "camera", view: "mesa" }, { op: "spawn", id: "ta", kind: "tarta", at: [-0.4, 0], of: d, n: n1 }, { op: "spawn", id: "tb", kind: "tarta", at: [2.6, 0], of: d, n: n2 }, spawnSign(n1 + "/" + d + " + " + n2 + "/" + d), { op: "creature", go: [-3.6, 0.8], pose: "habla" }], false),
      step("mismo-tamano", "Las porciones son del mismo tama\xF1o, as\xED que se pueden juntar y contar.", [{ op: "light", id: "ta", on: true }, { op: "light", id: "tb", on: true }, { op: "creature", pose: "piensa" }], false)
    ];
    const join = [{ op: "light", id: "ta", on: false }, { op: "light", id: "tb", on: false }];
    if (n <= d) join.push({ op: "remove", id: "tb" }, { op: "set", id: "ta", n }, { op: "move", id: "ta", to: [1.1, 0] });
    else join.push({ op: "set", id: "ta", n: d }, { op: "set", id: "tb", n: n - d });
    join.push(sign(n + "/" + d), { op: "creature", pose: "senala", point: "ta" });
    steps.push(step("juntar", "Juntamos las porciones: " + n1 + " + " + n2 + " = " + n + " porciones de " + d + ".", join, true));
    if (g > 1) {
      const sd = d / g, sn = n / g;
      steps.push(step("simplificar", n + "/" + d + " es lo mismo que " + sn + "/" + sd + (sd === 1 ? ": \xA1una tarta entera!" : ": usamos trozos m\xE1s grandes."), sd === 1 ? [sign(n + "/" + d + " = " + sn + "/" + sd)] : [{ op: "spawn", id: "td", kind: "tarta", at: [4.6, 0], of: sd, n: sn, tint: "menta" }, sign(n + "/" + d + " = " + sn + "/" + sd)], true));
    }
    steps.push(step("resultado", "\xA1" + n1 + "/" + d + " + " + n2 + "/" + d + " = " + (g > 1 ? n / g + "/" + d / g : n + "/" + d) + "!", [{ op: "creature", pose: "celebra", point: null }], true));
    return steps;
  }
  function problema(ex) {
    const [c = 2, p = 3] = ex.params, total = c * p, ans = total - c;
    const boxes = Array.from({ length: c }, (_, i) => "b" + i);
    return [
      step("intro", "Hay " + c + " cajas con " + p + " galletas cada una. Vamos a contarlas.", [{ op: "reset" }, { op: "camera", view: "mesa" }, ...boxes.map((id, i) => ({ op: "spawn", id, kind: "caja", at: grid(i, c), n: p })), spawnSign(c + " \xD7 " + p), { op: "creature", go: [-3.6, 0.8], pose: "habla" }], false),
      step("total", "Primero juntamos todas en un plato: " + c + " \xD7 " + p + " = " + total + ".", [...boxes.map((id) => ({ op: "remove", id })), { op: "spawn", id: "plato", kind: "plato", at: [CX, 0], n: total }, sign(c + " \xD7 " + p + " = " + total), { op: "creature", pose: "senala", point: "plato" }], true),
      step("regalar", "Ahora regalas " + c + ": quitamos " + c + " galletas. " + total + " \u2212 " + c + " = " + ans + ".", [{ op: "light", id: "plato", on: true }, { op: "set", id: "plato", n: ans }, sign(total + " \u2212 " + c + " = " + ans), { op: "light", id: "plato", on: false }, { op: "creature", pose: "celebra", point: null }], true)
    ];
  }
  var BUILDERS = { suma, resta, multiplicacion, division, fracciones, problema };
  function buildLesson(ex, voice, opts = {}) {
    if (!Array.isArray(ex.params) || ex.params.length < 2) throw new Error("El ejercicio no trae par\xE1metros para la escena");
    const build = BUILDERS[ex.topic];
    if (!build) throw new Error("Tema sin lecci\xF3n: " + String(ex.topic));
    if (!voice.openers.length || !voice.closers.length) throw new Error("La voz del gu\xEDa necesita al menos una apertura y un cierre");
    GUARD = opts.textGuard;
    try {
      const steps = build(ex);
      const first = steps[0], last = steps[steps.length - 1];
      const opener = pick([...voice.openers], ex.id), closer = pick([...voice.closers], ex.id + "x");
      if (first) first.say = safe(opener + " " + first.say, 2 * SAY_MAX, "apertura de " + ex.id);
      if (last && last !== first) last.say = safe(last.say + " " + closer, 2 * SAY_MAX, "cierre de " + ex.id);
      return { exerciseId: ex.id, topic: ex.topic, voiceId: voice.id, steps, basis: [...LESSON_BASIS] };
    } finally {
      GUARD = void 0;
    }
  }

  // packages/adapters/src/companion-kit.ts
  var kitShop = createShop(lookItems());
  function newKitProfile(childId, childName, creatureId = CREATURES[0].id) {
    return { ...newProfile(childId, childName, creatureId), looks: {}, world: kitShop.newWorld() };
  }
  function defaultLookFor(creatureId) {
    const c = getCreature(creatureId);
    return sanitizeLook({ ...defaultLook(), fur: c.look.fur, accent: c.look.accent, eyes: c.look.eyes }, defaultLook());
  }
  function lookOf(p, creatureId = p.creatureId) {
    return sanitizeLook(p.looks?.[creatureId], defaultLookFor(creatureId));
  }
  function worldOf(p) {
    p.world = kitShop.sanitize(p.world);
    return p.world;
  }
  function canWear(w3, change) {
    if (change.part === "outfit") return w3.owned.includes(outfitKey(change.value));
    if (change.part === "accessory") return change.value === null || w3.owned.includes(accessoryKey(change.slot, change.value));
    return true;
  }
  function wear(p, change, creatureId = p.creatureId) {
    const cur = lookOf(p, creatureId), w3 = worldOf(p);
    if (!canWear(w3, change)) return { ok: false, look: cur, say: "Eso todav\xEDa no es m\xEDo. \xA1Con tus estrellas lo podemos conseguir en la tienda!", why: "no-es-tuyo" };
    const next = applyLookChange(cur, change);
    p.looks = { ...p.looks ?? {}, [creatureId]: next };
    return { ok: true, look: next, say: reactionTo(change, next) };
  }
  function resetLook(p, creatureId = p.creatureId) {
    const d = defaultLookFor(creatureId);
    p.looks = { ...p.looks ?? {}, [creatureId]: d };
    return d;
  }
  function surpriseLook(p, rnd = Math.random, creatureId = p.creatureId) {
    const w3 = worldOf(p), next = randomLook(defaultLookFor(creatureId), rnd, (k) => w3.owned.includes(k));
    p.looks = { ...p.looks ?? {}, [creatureId]: next };
    return next;
  }
  function buildCreatureLesson(ex, creatureId) {
    const c = getCreature(creatureId);
    return buildLesson(ex, { id: c.id, openers: c.style.openers, closers: c.style.closers }, { textGuard: isBodySafe });
  }
  function validateCreatureScene(raw) {
    return validateCommands(raw, { textGuard: isBodySafe });
  }
  return __toCommonJS(companion_kit_exports);
})();
