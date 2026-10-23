import { createPlan, type JanusPlan, type PlannedToolStep } from './plan.js';

interface GitHubTarget {
  owner: string;
  repo: string;
  path?: string;
  ref?: string;
}

export interface DeterministicPlannerContext {
  timeZone?: string;
}

export function deterministicPlan(
  command: string,
  context: DeterministicPlannerContext = {},
): JanusPlan | null {
  const github = parseGitHubTarget(command);
  if (github) return githubPlan(command, github);

  const driveQuery = parseDriveQuery(command);
  if (driveQuery !== null) return drivePlan(command, driveQuery);

  const gmailQuery = parseGmailQuery(command);
  if (gmailQuery !== null) return gmailPlan(command, gmailQuery);

  if (mentionsCalendar(command)) return calendarPlan(command, context.timeZone);

  // Voice-clone / face-enrolment requests are matched BEFORE the school route: «la voz de Kendra» must never be read as a study request.
  const likeness = parseLikenessRequest(command);
  if (likeness) return likenessPlan(command, likeness);

  const school = parseSchoolRequest(command);
  if (school) return schoolPlan(command, school);

  const seneca = parseSenecaRequest(command);
  if (seneca) return senecaPlan(command, seneca);
  return null;
}

type SenecaRequest =
  | { tool?: 'seneca' | 'marcus-aurelius'; action: 'profile.get'; input: Record<string, unknown> }
  | { tool?: 'seneca' | 'marcus-aurelius'; action: 'reflection.daily'; input: Record<string, unknown> }
  | { tool?: 'seneca' | 'marcus-aurelius'; action: 'quote.get'; input: Record<string, unknown> }
  | { tool?: 'seneca' | 'marcus-aurelius'; action: 'guidance.get'; input: Record<string, unknown> };

function foldText(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

/** Routes Seneca / stress-management requests to the read-only `seneca` tool. Runs after every other tool route. */
function parseSenecaRequest(command: string): SenecaRequest | null {
  const request = parseStoicRequest(command);
  if (!request) return null;
  const text = foldText(command);
  const marcus = /marco aurelio|marcus aurelius|\bmeditaciones\b/.test(text);
  const seneca = /\bsenec[ao]\b/.test(text);
  // Marcus Aurelius only when named and Seneca is not; everything else keeps the Seneca route.
  return marcus && !seneca ? { ...request, tool: 'marcus-aurelius' } : request;
}

function parseStoicRequest(command: string): SenecaRequest | null {
  const text = foldText(command);
  const mentionsAuthor = /\bsenec[ao]\b|marco aurelio|marcus aurelius|\bmeditaciones\b|estoic|stoic/.test(text);
  const stress = /estres|estresad|ansied|angusti|agobi|abrum|burnout|quemad|preocupad|miedo al futuro|rumi|no puedo parar de pensar|stress|anxious|anxiety|overwhelm/.test(text);
  if (!mentionsAuthor && !stress) return null;
  if (mentionsAuthor) {
    if (/quien (fue|es)|biograf|vida de|su vida/.test(text)) return { action: 'profile.get', input: { section: 'life' } };
    if (/obras?|libros?|escribio|cartas a lucilio|meditaciones/.test(text) && !/frase|cita/.test(text)) return { action: 'profile.get', input: { section: 'works' } };
    if (/psicolog|terapia|tcc|cognitiv/.test(text)) return { action: 'profile.get', input: { section: 'modern_psychology' } };
    if (/pensamiento|filosofia|doctrina|ideolog/.test(text)) return { action: 'profile.get', input: { section: 'doctrine' } };
    if (/reflexion del dia|frase del dia|cada dia|diari/.test(text)) return { action: 'reflection.daily', input: {} };
    if (/frase|cita|dijo/.test(text) && !stress) return { action: 'quote.get', input: { includeLatin: /latin/.test(text), includeEnglish: /ingles|english/.test(text) } };
  }
  return { action: 'guidance.get', input: { text: command } };
}

function senecaPlan(command: string, request: SenecaRequest): JanusPlan {
  const steps: PlannedToolStep[] = [
    {
      id: request.tool === 'marcus-aurelius' ? 'marcus-aurelius-answer' : 'seneca-answer',
      kind: 'tool',
      label: request.tool === 'marcus-aurelius' ? 'Consultar a Marco Aurelio' : 'Consultar a Séneca',
      tool: request.tool ?? 'seneca',
      action: request.action,
      input: request.input,
      risk: 'none',
      reversible: true,
      requiresApproval: false,
      resultMode: 'full',
    },
  ];
  return createPlan(command, steps, 'deterministic');
}

function githubPlan(command: string, target: GitHubTarget): JanusPlan {
  const steps: PlannedToolStep[] = [
    {
      id: 'github-repository',
      kind: 'tool',
      label: `Revisar GitHub ${target.owner}/${target.repo}`,
      tool: 'github',
      action: 'repo.get',
      input: { owner: target.owner, repo: target.repo },
      risk: 'none',
      reversible: true,
      requiresApproval: false,
      resultMode: 'summary',
    },
  ];

  const input: Record<string, unknown> = {
    owner: target.owner,
    repo: target.repo,
  };
  if (target.path) input.path = target.path;
  if (target.ref) input.ref = target.ref;

  steps.push({
    id: 'github-content',
    kind: 'tool',
    label: target.path ? `Leer ${target.path}` : 'Listar contenido principal',
    tool: 'github',
    action: target.path ? 'file.read' : 'contents.list',
    input,
    risk: 'none',
    reversible: true,
    requiresApproval: false,
    resultMode: 'summary',
  });

  return createPlan(command, steps, 'deterministic');
}

function drivePlan(command: string, query: string): JanusPlan {
  return createPlan(
    command,
    [
      {
        id: 'google-drive-search',
        kind: 'tool',
        label: query ? `Buscar en Drive: ${query}` : 'Listar archivos recientes de Drive',
        tool: 'google-workspace',
        action: 'drive.files.search',
        input: query ? { query, pageSize: 20 } : { pageSize: 20 },
        risk: 'none',
        reversible: true,
        requiresApproval: false,
        resultMode: 'summary',
      },
    ],
    'deterministic',
  );
}

function gmailPlan(command: string, query: string): JanusPlan {
  return createPlan(
    command,
    [
      {
        id: 'google-gmail-search',
        kind: 'tool',
        label: query ? `Buscar en Gmail: ${query}` : 'Revisar mensajes recientes de Gmail',
        tool: 'google-workspace',
        action: 'gmail.messages.search',
        input: query ? { query, maxResults: 10 } : { maxResults: 10 },
        risk: 'none',
        reversible: true,
        requiresApproval: false,
        resultMode: 'summary',
      },
    ],
    'deterministic',
  );
}

function calendarPlan(command: string, timeZone?: string): JanusPlan {
  const input: Record<string, unknown> = {
    calendarId: 'primary',
    maxResults: 25,
  };
  if (timeZone) input.timeZone = timeZone;

  return createPlan(
    command,
    [
      {
        id: 'google-calendar-upcoming',
        kind: 'tool',
        label: 'Revisar próximos eventos del calendario',
        tool: 'google-workspace',
        action: 'calendar.events.list',
        input,
        risk: 'none',
        reversible: true,
        requiresApproval: false,
        resultMode: 'summary',
      },
    ],
    'deterministic',
  );
}

function parseGitHubTarget(command: string): GitHubTarget | null {
  const urlMatch = command.match(
    /https?:\/\/(?:www\.)?github\.com\/(?<owner>[A-Za-z0-9_.-]+)\/(?<repo>[A-Za-z0-9_.-]+)(?:\/blob\/(?<ref>[^/\s]+)\/(?<path>[^\s?#]+))?/i,
  );
  if (urlMatch?.groups?.owner && urlMatch.groups.repo) {
    return {
      owner: urlMatch.groups.owner,
      repo: urlMatch.groups.repo.replace(/\.git$/i, ''),
      ref: urlMatch.groups.ref,
      path: urlMatch.groups.path,
    };
  }

  const shortMatch = command.match(
    /\bgithub\s+(?<owner>[A-Za-z0-9_.-]+)\/(?<repo>[A-Za-z0-9_.-]+)(?:\s+(?<path>\S+))?/i,
  );
  if (shortMatch?.groups?.owner && shortMatch.groups.repo) {
    return {
      owner: shortMatch.groups.owner,
      repo: shortMatch.groups.repo.replace(/\.git$/i, ''),
      path: shortMatch.groups.path,
    };
  }

  return null;
}

function parseDriveQuery(command: string): string | null {
  const normalized = command.trim();
  const search = normalized.match(
    /\b(?:busca|buscar|encuentra|encontrar|revisa|revisar)\s+(?:en\s+)?(?:google\s+)?drive(?:\s+(?<query>.+))?$/i,
  );
  if (search) return cleanNaturalQuery(search.groups?.query ?? '');

  const direct = normalized.match(/^(?:google\s+)?drive(?:\s+(?<query>.+))?$/i);
  if (direct) return cleanNaturalQuery(direct.groups?.query ?? '');
  return null;
}

function parseGmailQuery(command: string): string | null {
  const normalized = command.trim();
  const search = normalized.match(
    /\b(?:busca|buscar|revisa|revisar|mira|mirar)\s+(?:en\s+)?(?:gmail|correo|correos|email|emails)(?:\s+(?<query>.+))?$/i,
  );
  if (search) return cleanNaturalQuery(search.groups?.query ?? '');

  const direct = normalized.match(/^(?:gmail|correo|correos|email|emails)(?:\s+(?<query>.+))?$/i);
  if (direct) return cleanNaturalQuery(direct.groups?.query ?? '');
  return null;
}

function mentionsCalendar(command: string): boolean {
  return /\b(calendario|calendar|agenda)\b/i.test(command);
}

function cleanNaturalQuery(value: string): string {
  return value
    .trim()
    .replace(/^(?:de|del|sobre|acerca\s+de)\s+/i, '')
    .replace(/[.!?]+$/g, '')
    .trim();
}

// ---------- Janus School (read-only, offline tool) ----------
interface SchoolRequest { action: string; input: Record<string, unknown>; label: string }

const LESSON_TOPICS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bgit\b|github|repositorio|pull request|commit/, 'f02-git-y-github'],
  [/\bapi\b|servidor|backend|frontend|base de datos|como funciona el software/, 'f01-como-funciona-el-software'],
  [/dominio|\bdns\b|hosting|deploy|despliegue|publicar|vercel|https/, 'f03-publicar-en-internet'],
  [/n8n|automatiz|webhook|workflow/, 'f04-automatizacion-n8n'],
  [/\bia\b|inteligencia artificial|agente|prompt|llm|token|alucinac/, 'f05-ia-y-agentes'],
  [/web 3d|\b3d\b|html|css|javascript|react|next\.?js|three\.?js|diseno web|inmersiv/, 'f06-web-moderna-y-3d'],
  [/seguridad|rgpd|secreto|oauth|2fa|datos personales/, 'f07-seguridad-y-datos'],
  [/contenido|monetiz|reels?|redes sociales|social media|embudo|marketing|utm/, 'f08-contenido-y-monetizacion'],
  [/ingenieria de sistemas|arquitectura|requisitos|escalab|mvp/, 'f09-pensar-como-ingeniero-de-sistemas'],
  [/hablar con (un )?(programador|ingeniero)|reunion tecnica|conversar con (un )?(programador|ingeniero)/, 'f10-hablar-con-un-programador'],
];

function parseSchoolRequest(command: string): SchoolRequest | null {
  const text = foldText(command);
  const kids = /\bkendra\b|\bmi hija\b|\bninos?\b|\bnina\b|tdah|\btda\b|hiperactiv|abaco|tecnicas? chinas?|matematicas|\bmates\b|tablas de multiplicar|amigos del 10/.test(text);
  if (kids && /como ayudar|guia para padres|guia para mi|como acompan|que hacer con|consejos para/.test(text)) {
    return { action: 'kids.guide', input: {}, label: 'Guía para acompañarla en casa' };
  }
  if (kids && /abaco|tecnicas? chinas?|amigos del 10|tablas de multiplicar|gestos/.test(text)) {
    const topic = /abaco/.test(text) ? 'abaco' : /chin/.test(text) ? 'chinas' : /amigos del 10/.test(text) ? 'amigos del 10' : 'tablas';
    return { action: 'kids.technique', input: { topic }, label: 'Técnica de matemáticas' };
  }
  if (kids && /sesion|plan|rutina|tarea|estudi|matematicas|clase|ayuda|jugar|practic/.test(text)) {
    const minutes = /(\d{1,2}) ?(min|minutos)/.exec(text);
    const age = /(\d{1,2}) ?(anos|ano)/.exec(text);
    const energy = /inquiet|hiperactiv|mucha energia|nervios|no para quieta?|no se (esta|queda) quiet/.test(text) ? 'high' : /cansad|poca energia|desanimad/.test(text) ? 'low' : 'normal';
    return {
      action: 'kids.session',
      input: { energy, ...(minutes ? { minutes: Number(minutes[1]) } : {}), ...(age ? { age: Number(age[1]) } : {}) },
      label: 'Preparar sesión de estudio',
    };
  }
  if (/\bjanus school\b|\bescuela de janus\b/.test(text) || /(quiero|necesito|vamos a|empecemos|ayudame a) (aprender|estudiar)|ensename|dame una (leccion|clase)|siguiente (leccion|unidad)|capacitar(me)?|formacion/.test(text)) {
    for (const [pattern, lessonId] of LESSON_TOPICS) if (pattern.test(text)) return { action: 'lesson.get', input: { lessonId }, label: 'Lección' };
    return { action: 'lesson.next', input: {}, label: 'Siguiente lección' };
  }
  if (/repasar|repaso|tarjetas|flashcards?/.test(text)) return { action: 'review.next', input: {}, label: 'Repaso con tarjetas' };
  if (/cuestionario|\bquiz\b|ponme a prueba|evaluame/.test(text)) return { action: 'quiz.get', input: {}, label: 'Cuestionario' };
  const term = /(?:que significa|que quiere decir|definicion de|define|glosario(?: de)?)\s+(.+)$/.exec(text);
  if (term?.[1]) return { action: 'glossary.lookup', input: { query: term[1].replace(/^(la |el |un |una |lo )/, '').trim() }, label: 'Buscar en el glosario' };
  return null;
}

type LikenessRequest = { action: string; input: Record<string, unknown>; label: string; sensitive: boolean };

/**
 * Routes voice-clone and face-enrolment requests to the `likeness` tool (ADR-012).
 * Enrolments are sensitive (forced approval); Kendra's cloning is STANDBY until the Founder asks, and her enrolment
 * only carries the guardian/assent declarations when the Founder actually said them.
 */
function parseLikenessRequest(command: string): LikenessRequest | null {
  const text = foldText(command);
  const aboutKendra = /\bkendra\b|\bmi hija\b|\bla nina\b/.test(text);
  const subject = aboutKendra ? 'kendra' : 'founder';
  const voiceContext = /\bvoz\b|clon/.test(text);
  const cloneWord = /\bclon(ar|a|e|emos|ado|ada|acion)\b|\bclon\b|\breplica(r)? (mi|la) voz\b/.test(text);

  if (/\b(revoca|revocar|borra|borrar|elimina|eliminar|quita|quitar|olvida|olvidar|anula|anular)\b/.test(text) && voiceContext && (cloneWord || /\bclonada\b|\bgrabacion\b/.test(text))) {
    return { action: 'voice.revoke', input: { subject }, label: 'Revocar voz clonada', sensitive: false };
  }

  const enrollPhrase = /\b(usa|utiliza|toma|registra|procesa|continua con|sigue con)\b.*\b(grabacion|audio|nota de voz|toma)\b/.test(text)
    || /\bya (grabe|grabamos|subi|deje|envie|guarde)\b.*\b(voz|grabacion|audio|nota)\b/.test(text);
  if (enrollPhrase && (voiceContext || /\bmi grabacion\b|\bgrabacion de kendra\b/.test(text))) {
    // Only a QUOTED name is taken as the file; otherwise the sentence travels as a hint and the tool matches it
    // against what is really in the inbox (iPhone names contain spaces, so guessing from free text would cut them).
    const file = /["“«']([^"”»']{1,120}\.(?:m4a|wav|mp3|caf|aac|ogg|flac|mp4))["”»']/i.exec(command)?.[1]?.trim();
    const input: Record<string, unknown> = { ...(file ? { file } : { hint: command.slice(0, 300) }) };
    if (subject === 'kendra') {
      const negated = /\bno (esta|estaba|quiere|acepta|acepto|lo quiere)\b/.test(text);
      input.guardianConfirms = /\b(autorizo|su padre|su tutor|soy su)\b/.test(text);
      input.childAssent = !negated && /(de acuerdo|\bquiere\b|acept|con su permiso|esta contenta|le gusta)/.test(text);
    }
    return { action: `${subject}.voice.enroll`, input, label: subject === 'kendra' ? 'Registrar la voz de Kendra' : 'Registrar tu voz', sensitive: true };
  }

  if (/\b(estado|como va|en que punto)\b.*\b(clon|voz clonada|mi voz|reconocimiento)\b/.test(text)) {
    return { action: 'status', input: {}, label: 'Estado de voz y rostro', sensitive: false };
  }
  if (cloneWord && voiceContext) {
    return { action: `${subject}.voice.guide`, input: {}, label: subject === 'kendra' ? 'Guía: voz de Kendra (en espera)' : 'Guía: clonar tu voz', sensitive: false };
  }
  if (/reconocimiento facial|reconozca(s)? (mi )?(cara|rostro)|reconocerme (por|con) (la |mi )?(cara|rostro)|registrar mi (cara|rostro)|enrolar mi (cara|rostro)/.test(text)) {
    return { action: 'founder.face.guide', input: {}, label: 'Guía: tu reconocimiento facial', sensitive: false };
  }
  return null;
}

function likenessPlan(command: string, request: LikenessRequest): JanusPlan {
  return createPlan(command, [
    {
      id: 'likeness-step',
      kind: 'tool',
      label: request.label,
      tool: 'likeness',
      action: request.action,
      input: request.input,
      risk: request.sensitive ? 'high' : 'none',
      reversible: !request.sensitive,
      requiresApproval: request.sensitive,
      resultMode: 'full',
    },
  ], 'deterministic');
}

function schoolPlan(command: string, request: SchoolRequest): JanusPlan {
  return createPlan(command, [
    {
      id: 'school-answer',
      kind: 'tool',
      label: request.label,
      tool: 'janus-school',
      action: request.action,
      input: request.input,
      risk: 'none',
      reversible: true,
      requiresApproval: false,
      resultMode: 'full',
    },
  ], 'deterministic');
}
