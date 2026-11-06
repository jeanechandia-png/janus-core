'use strict';
/*
 * JANUS child-safety evidence gate.
 * Applies to Kendra's sensitive conversational input, including when offline.
 * This is a deterministic minimum safeguard, not a medical/psychological
 * diagnosis or a substitute for a trusted adult.
 */
const JanusChildSafety = (() => {
  const sources = Object.freeze({
    bullying: 'https://www.stopbullying.gov/kids/what-you-can-do',
    adultResponse: 'https://www.stopbullying.gov/prevention/on-the-spot',
    communication: 'https://www.healthychildren.org/Spanish/family-life/family-dynamics/communication-discipline/Paginas/Communication-Dos-and-Donts.aspx',
    attention: 'https://www.cdc.gov/adhd/hcp/clinical-care/index.html',
    mathematics: 'https://ies.ed.gov/ncee/wwc/PracticeGuide/26',
    movement: 'https://www.who.int/europe/news-room/fact-sheets/item/physical-activity'
  });
  const cases = Object.freeze({
    urgent: Object.freeze({
      level: 'urgent',
      reply: 'Gracias por contármelo. Tu seguridad es lo primero. Busca ahora a Jean, a tu profesora o a otro adulto de confianza. Si alguien está en peligro inmediato, el adulto debe pedir ayuda a emergencias. No hace falta resolverlo sola.',
      reference: sources.adultResponse
    }),
    bullying: Object.freeze({
      level: 'important',
      reply: 'Gracias por confiar en mí. Nadie tiene derecho a intimidarte. Si es seguro, puedes decir con firmeza: «Para. Déjame en paz». Después aléjate y cuéntaselo hoy a un profesor y a Jean. Si el primer adulto no te escucha, díselo a otro. No tienes que enfrentarte ni pelear.',
      reference: sources.bullying
    }),
    distress: Object.freeze({
      level: 'attention',
      reply: 'Gracias por contar cómo te sientes. Puedes estar triste, nerviosa o enfadada. ¿Qué ocurrió y qué te ayudaría ahora? Si quieres, podemos hablarlo con Jean o con un adulto de confianza.',
      reference: sources.communication
    }),
    diagnosis: Object.freeze({
      level: 'refer-to-professional',
      reply: 'No puedo decir si alguien tiene TDAH u otra condición a partir de una conversación. Podemos estudiar con descansos y ejemplos si te ayudan. Habla con Jean y, si hace falta, con un profesional sanitario para aclarar esas preguntas.',
      reference: sources.attention
    }),
    body: Object.freeze({
      level: 'support',
      reply: 'Todos los cuerpos merecen respeto. No vamos a juzgarte por tu tamaño ni por el de otra persona. Comer variado y moverse puede ser algo agradable, no un castigo. Si alguien te hace comentarios hirientes, puedes contárselo a Jean y a tu profesora.',
      reference: sources.communication
    })
  });
  const medical = /\b(?:tdah|adhd|hiperactividad|autismo|autista|diagn[oó]stic[oa]|medicamento|pastillas|trastorno)\b/i;
  const body = /\b(?:gord[ao]|flac[ao]|obes[ao]|pes[ao] mucho|adelgazar|dieta|soy fe[ao])\b/i;
  const bullying = /\b(?:bullying|acoso|me insultan|me molestan|se burlan|me amenazan|me excluyen|me pegan|me intimidan)\b/i;
  const urgent = /\b(?:quiero morir|matarme|hacerme da[nñ]o|me hacen da[nñ]o|me toc[oó]|me amenaza con un arma|tengo miedo de volver a casa)\b/i;
  const distress = /\b(?:me siento sola|no tengo amigos|estoy triste|llorando|me siento asustada)\b/i;
  function assess(text, previous) {
    const message = String(text || '').slice(0, 2000);
    const existing = previous && previous.severity;
    let id = null;
    if (existing === 'urgente' || urgent.test(message)) id = 'urgent';
    else if (existing === 'importante' || bullying.test(message)) id = 'bullying';
    else if (medical.test(message)) id = 'diagnosis';
    else if (body.test(message)) id = 'body';
    else if (existing === 'atencion' || distress.test(message)) id = 'distress';
    if (!id) return null;
    const selected = cases[id];
    return Object.freeze({
      topic: id,
      level: selected.level,
      reply: selected.reply,
      reference: selected.reference,
      notifyAdult: id === 'urgent' || id === 'bullying',
      requiresProfessional: id === 'diagnosis',
      storeRawDisclosure: false,
      promisesSecrecy: false
    });
  }
  // Sources are curated and linked to their proper scope. URL alone does
  // not turn an opinion, religious tradition or family preference into science.
  const scopedTopics = Object.freeze({
    bullying: sources.bullying,
    emotionalSupport: sources.communication,
    medical: sources.attention,
    math: sources.mathematics,
    physicalActivity: sources.movement
  });
  function reviewLesson(topic, evidenceUrl, claimsMedicalBenefit) {
    const expected = scopedTopics[topic];
    if (!expected) return { status: 'family-preference-or-unreviewed', allowedForClinicalClaims: false };
    return { status: expected === evidenceUrl ? 'reviewed-source' : 'unverified',
      allowedForClinicalClaims: false,
      requiresAdultOrProfessional: topic === 'medical' || claimsMedicalBenefit === true };
  }
  return Object.freeze({
    version: '2026-11-06',
    sources, assess, reviewLesson,
    limits: Object.freeze({
      noDiagnosis: true,
      noSecrecyWithRisk: true,
      noRawDisclosureInAnalytics: true,
      noAutomaticContactOrPurchase: true,
      noPressureToPrayOrExercise: true,
      noShamingOfAppearanceOrDisability: true,
      noVoiceOrFaceAsSoleAuthentication: true
    })
  });
})();
window.JanusChildSafety = JanusChildSafety;
