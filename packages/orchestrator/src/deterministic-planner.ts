import { createHash } from 'node:crypto';
import { userTextOutsideAttachmentBlock } from './attachment-block.js';
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
  rawCommand: string,
  context: DeterministicPlannerContext = {},
): JanusPlan | null {
  // Lo adjunto (archivos, códigos QR) son datos: nunca deciden la ruta. Solo cuentan las palabras del usuario.
  const command = userTextOutsideAttachmentBlock(rawCommand);
  if (!command) return null;
  const voiceStudio = voiceStudioPlan(command);
  if (voiceStudio) return voiceStudio;
  const specialization = professionalSpecializationPlan(command);
  if (specialization) return specialization;
  const media = localMediaPlan(command);
  if (media) return media;
  // Cambios al conocimiento del negocio (precios, IVA, productos, equipo, instrucciones…): detección ESTRICTA;
  // la interpretación fina vive en la herramienta `knowledge`, que valida y lee de vuelta antes de pedir aprobación.
  if (isKnowledgeChangeRequest(command)) return knowledgeChangePlan(command);

  const github = parseGitHubTarget(command);
  if (github) return githubPlan(command, github);

  const driveQuery = parseDriveQuery(command);
  if (driveQuery !== null) return drivePlan(command, driveQuery);

  const gmailQuery = parseGmailQuery(command);
  if (gmailQuery !== null) return gmailPlan(command, gmailQuery);

  if (mentionsCalendar(command)) return calendarPlan(command, context.timeZone);

  const school = parseSchoolRequest(command);
  if (school) return schoolPlan(command, school);

  const seneca = parseSenecaRequest(command);
  if (seneca) return senecaPlan(command, seneca);
  return null;
}

/**
 * Órdenes habladas para crear voces en el estudio LOCAL de Janus.
 * La detección sólo encamina la solicitud: no clona voces, no salta permisos.
 * Cambios en el registro local quedan sujetos a aprobación Founder + Face ID.
 */
function voiceStudioPlan(command: string): JanusPlan | null {
  const text = foldVoiceText(command);
  if (/\b(que es|como funciona|explicame|cuentame|puedes|capacidad|tutorial|investiga)\b/.test(text)
      && !/\b(crea|disena|genera|clona|prepara)\b/.test(text)) return null;
  const isClone = /\b(clona|clonar|clonacion|copia mi voz|replica mi voz)\b/.test(text)
    && /\b(voz|mi voz|voz de jean)\b/.test(text);
  const isDesign = /\b(crea|crear|disena|disenar|genera|generar|prepara)\b/.test(text)
    && /\b(una voz|un timbre de voz|voz nueva|nueva voz|voz caricaturesca|voz sintetica)\b/.test(text);
  if (!isClone && !isDesign) return null;

  const mode = isClone ? 'clone' : 'design';
  const id = isClone ? 'janus-founder-local' : 'janus-designed';
  const input = mode === 'clone'
    ? {subjectId:'jean',voiceId:id}
    : {voiceId:id,instruct:command.trim().slice(0,800)};
  const preview = mode === 'clone' ? 'clone.readiness' : 'design.preview';
  const apply = mode === 'clone' ? 'clone.apply' : 'design.apply';
  const idempotencyKey = createHash('sha256').update('voice-studio:' + mode + ':' + text).digest('hex');
  const steps: PlannedToolStep[] = [
    {
      id:'voice-studio-review',kind:'tool',label:mode === 'clone' ? 'Comprobar consentimiento y audio original local' : 'Revisar el diseño vocal y su modelo local',
      tool:'voice-studio',action:preview,input,
      risk:'none',reversible:true,requiresApproval:false,resultMode:'full',
    },
    {
      id:'voice-studio-install',kind:'tool',label:mode === 'clone' ? 'Instalar clon propio tras revisión y Face ID' : 'Instalar diseño de voz local tras revisión y Face ID',
      tool:'voice-studio',action:apply,input,
      idempotencyKey,risk:'high',reversible:false,requiresApproval:true,resultMode:'full',
    },
  ];
  return createPlan(command,steps,'deterministic');
}

function localMediaPlan(command:string):JanusPlan|null {
  // Los archivos adjuntos son datos, nunca órdenes. Solo se usan nombres
  // existentes del inbox local; no se inventa contenido ni se publica una web.
  const clean=command.normalize('NFC').trim();
  const hasIntent=/\b(agrega|agregar|incorpora|incorporar|añade|anade|anadir)\b/i.test(clean)
    && /\b(imagen|foto|fotografia|fotografía)\b/i.test(clean);
  if(!hasIntent)return null;
  const matched=clean.match(/(?:imagen|foto|fotografia|fotografía)\s+([a-z0-9][a-z0-9_.-]{0,100}\.(?:png|jpg|jpeg|webp))\s+(?:al|en el|en)\s+proyecto\s+([a-z][a-z0-9_-]{2,79})/i);
  if(!matched) return createPlan(clean,[{
    id:'media-inbox-list',kind:'tool',label:'Mostrar imágenes locales disponibles para elegir',
    tool:'media',action:'images.list',input:{},risk:'none',reversible:true,requiresApproval:false,resultMode:'full',
  }],'deterministic');
  const [,fileName,projectId]=matched;
  const idempotencyKey=createHash('sha256').update('media:stage:'+projectId+':'+fileName).digest('hex');
  return createPlan(clean,[
    {id:'media-inspect',kind:'tool',label:'Verificar imagen '+fileName,tool:'media',action:'image.inspect',
      input:{fileName},risk:'none',reversible:true,requiresApproval:false,resultMode:'full'},
    {id:'media-stage',kind:'tool',label:'Agregar '+fileName+' al proyecto local '+projectId+' tras aprobación',
      tool:'media',action:'image.stage.apply',input:{fileName,projectId},
      idempotencyKey,risk:'high',reversible:false,requiresApproval:true,resultMode:'full'},
  ],'deterministic');
}

function professionalSpecializationPlan(command:string):JanusPlan|null {
  // El comando solo inicia una investigación con fuentes; no se reentrena
  // automáticamente el modelo ni se aceptan como normas los documentos web.
  const text=foldVoiceText(command);
  const match=text.match(/(?:^|\s)(?:actua|actues|actuar|conviertete|especializate|aprende|aprendas)\s+(?:(?:como|a ser)\s+)?(?:(?:un|una)\s+)?(?:especialista|experto|experta|profesional)\s+en\s+(.+)$/)
    || text.match(/(?:^|\s)(?:conviertete|especializate)\s+en\s+(?:especialista|experto|experta)\s+en\s+(.+)$/);
  if (!match) return null;
  const domain=match[1]!.replace(/\s+(?:correcto|por favor|de acuerdo)$/,'').trim().slice(0,100);
  if(domain.length<4) return null;
  const key=createHash('sha256').update('specialization:research:'+text).digest('hex');
  return createPlan(command,[
    {
      id:'specialization-plan',kind:'tool',label:'Plan de estudio y actualización de '+domain,
      tool:'specialization',action:'research.plan',input:{domain},
      risk:'none',reversible:true,requiresApproval:false,resultMode:'full',
    },
    {
      id:'specialization-research',kind:'tool',label:'Investigar fuentes y conservar dossier revisable de '+domain,
      tool:'specialization',action:'research.apply',input:{domain},
      idempotencyKey:key,risk:'high',reversible:false,requiresApproval:true,resultMode:'full',
    },
  ],'deterministic');
}

function foldVoiceText(value:string):string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9ñ\s]/g,' ').replace(/\s+/g,' ').trim();
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


// ── Conocimiento del negocio (voz/chat → propuesta → aprobación → aplicar) ─────────────────────────────────────
function foldForRouting(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

const KNOWLEDGE_CHANGE_VERBS = /\b(cambia|cambiar|actualiza|actualizar|pon|ponle|sube|baja|ajusta|fija|modifica|modificar|corrige)\w*/;
const KNOWLEDGE_AMOUNT = /\d[\d.,]*\s*(?:euros?|eur|€)/;

/** Frases que piden cambiar lo que Melanie y los chats saben del negocio. Estricto: ante la duda, no se activa. */
export function isKnowledgeChangeRequest(command: string): boolean {
  const text = foldForRouting(command);
  if (!text || text.length > 600 || text.includes('?')) return false;

  // Instrucción explícita
  if (/\b(?:guarda|registra|anota|memoriza|apunta|anade|toma nota de)\b[^.]{0,30}\binstruccion/.test(text)) return true;
  // A partir de ahora … SOLO si va dirigido a Melanie/asistentes/clientes
  if (/\b(?:a partir de ahora|desde ahora)\b/.test(text) && /\b(?:melanie|asistentes?|clientes?|chat de la web)\b/.test(text)) return true;
  // Pregunta frecuente
  if (/\bsi\b[^.]{0,60}\b(?:pregunta|preguntan|pide|piden)\b[^.]*\b(?:responde|contesta|dile|diles)\b/.test(text)) return true;
  // IVA por defecto
  if (/\b(?:cambia|actualiza|pon|fija|ajusta|sube|baja)\w*\s+(?:el\s+|los\s+)?(?:tipo de\s+)?iva\b[^.]*\d\s*(?:%|por ?ciento)/.test(text)) return true;
  // Producto nuevo o retirado
  if (/\b(?:anade|agrega|crea|incluye|lanzamos|hemos lanzado|tenemos)\s+(?:un|una|el|la)?\s*(?:nuevo\s+|nueva\s+)?(?:producto|modulo|servicio|plan|paquete)\b/.test(text)) return true;
  if (/\b(?:quita|retira|elimina|da de baja|descataloga)\s+(?:el|la)?\s*(?:producto|modulo|servicio|plan|paquete)\b/.test(text)) return true;
  // Equipo
  if (/\b(?:nuev[oa]\s+(?:integrante|miembro|companer[oa]|colaborador)|se (?:ha )?(?:incorporado|unido|sumado)\s+(?:al equipo)|incorporamos a|fichamos a|damos la bienvenida a)\b/.test(text)) return true;
  // Precio con importe y verbo de cambio (o «ahora cuesta»)
  if (KNOWLEDGE_AMOUNT.test(text)) {
    if (/\b(?:precio|tarifa|cuota|coste)\s+(?:del?|de la|de los|de las|para)\b/.test(text) && (KNOWLEDGE_CHANGE_VERBS.test(text) || /\b(?:pasa|pase|sera|es)\b/.test(text))) return true;
    if (/\bahora\s+(?:cuesta|vale|cuestan|valen)\b/.test(text)) return true;
    if (/\bmelanie\b/.test(text) && /\b(?:cuesta|vale)\b/.test(text)) return true;
  }
  return false;
}

function knowledgeChangePlan(command: string): JanusPlan {
  const proposalKey = createHash('sha256').update(foldForRouting(command)).digest('hex').slice(0, 24);
  const steps: PlannedToolStep[] = [
    {
      id: 'knowledge-propose',
      kind: 'tool',
      label: 'Entender el cambio y leértelo antes de tocar nada',
      tool: 'knowledge',
      action: 'change.propose',
      input: { utterance: command.trim().slice(0, 600), proposalKey, source: 'voice' },
      risk: 'none',
      reversible: true,
      requiresApproval: false,
      resultMode: 'full',
    },
    {
      id: 'knowledge-apply',
      kind: 'tool',
      label: 'Aplicar el cambio leído al conocimiento del negocio (requiere tu aprobación con Face ID)',
      tool: 'knowledge',
      action: 'change.apply',
      input: { proposalKey },
      risk: 'high',
      reversible: false,
      requiresApproval: true,
      idempotencyKey: `knowledge:apply:${proposalKey}`,
      resultMode: 'full',
    },
  ];
  return createPlan(command, steps, 'deterministic');
}
