/**
 * Ángel Guardián (guardian-angel) v1.0.0 · Botón de auxilio para menores: llamar al padre, la madre o el tutor legal,
 * avisarles por WhatsApp o SMS con la ubicación exacta, y llamar al número de emergencias del país.
 * Módulo reutilizable (orden del Founder, 24-nov-2026). JavaScript puro, sin dependencias ni red: lo usan el servidor
 * (TypeScript, vía guardian-angel.d.ts) y las apps (espejo idéntico en apps/pwa/guardian-angel.js, comprobado por prueba).
 *
 * Verdad (límites del navegador):
 *  · Una web no puede llamar ni enviar SMS sola: prepara la llamada o el mensaje y la persona pulsa «llamar» o «enviar».
 *  · Tampoco puede conectarse a un satélite. Si el teléfono tiene SOS por satélite (iPhone 14 o posterior en Países Bajos)
 *    o cobertura satelital de su operador, eso lo hace el propio teléfono al llamar al número de emergencias.
 *  · La ubicación precisa exige permiso de ubicación, GPS del aparato y una página segura (https o localhost).
 */

export const MODULE = Object.freeze({ id: 'guardian-angel', name: 'Ángel Guardián', version: '1.0.0' });

/** Números de emergencia por país. En la UE, 112 (policía, ambulancia, bomberos). */
export const EMERGENCY = Object.freeze({
  NL: '112', BE: '112', DE: '112', FR: '112', ES: '112', IT: '112', PT: '112', LU: '112', AT: '112', IE: '112',
  GB: '999', US: '911', CA: '911', MX: '911', CO: '123',
});

export const ROLES = Object.freeze(['padre', 'madre', 'tutor_legal', 'familiar', 'otro']);
export const ROLE_LABEL = Object.freeze({ padre: 'Papá', madre: 'Mamá', tutor_legal: 'Tutor legal', familiar: 'Familiar', otro: 'Contacto' });
export const KINDS = Object.freeze(['ayuda', 'peligro', 'herida', 'perdida']);
export const KIND_TEXT = Object.freeze({
  es: { ayuda: 'necesita ayuda', peligro: 'se siente en peligro', herida: 'está herida o enferma', perdida: 'se ha perdido' },
  nl: { ayuda: 'heeft hulp nodig', peligro: 'voelt zich in gevaar', herida: 'is gewond of ziek', perdida: 'is verdwaald' },
});
/** Hay que mantener pulsado el botón este tiempo: evita avisos por accidente. */
export const HOLD_MS = 2000;
export const MAX_GUARDIANS = 5;

/** Teléfono a formato internacional (+ y dígitos). Acepta 06… holandés si el país es NL. Devuelve null si no vale. */
export function normalizePhone(raw, country) {
  if (typeof raw !== 'string') return null;
  let digits = raw.replace(/[\s().-]/g, '');
  if (digits.startsWith('00')) digits = '+' + digits.slice(2);
  if (!digits.startsWith('+') && country === 'NL' && /^0[1-9]\d{8}$/.test(digits)) digits = '+31' + digits.slice(1);
  if (!/^\+[1-9]\d{7,14}$/.test(digits)) return null;
  return digits;
}

/** Valida la plantilla de contactos. Devuelve { ok, config } o { ok: false, message }. */
export function normalizeConfig(input) {
  if (!input || typeof input !== 'object') return { ok: false, message: 'Datos no válidos.' };
  const country = typeof input.country === 'string' && Object.prototype.hasOwnProperty.call(EMERGENCY, input.country) ? input.country : 'NL';
  const childName = typeof input.childName === 'string' ? input.childName.replace(/\s+/g, ' ').trim().slice(0, 40) : '';
  const list = Array.isArray(input.guardians) ? input.guardians : [];
  if (list.length === 0) return { ok: false, message: 'Añade al menos un contacto (padre, madre o tutor legal).' };
  if (list.length > MAX_GUARDIANS) return { ok: false, message: `Como máximo ${MAX_GUARDIANS} contactos.` };
  const guardians = [];
  for (const [index, raw] of list.entries()) {
    if (!raw || typeof raw !== 'object') return { ok: false, message: 'Contacto no válido.' };
    const role = ROLES.includes(raw.role) ? raw.role : null;
    if (!role) return { ok: false, message: 'Elige si es padre, madre, tutor legal, familiar u otro.' };
    const name = typeof raw.name === 'string' ? raw.name.replace(/\s+/g, ' ').trim().slice(0, 60) : '';
    if (name.length < 2) return { ok: false, message: 'Escribe el nombre de cada contacto.' };
    const phone = normalizePhone(raw.phone, country);
    if (!phone) return { ok: false, message: `El teléfono de ${name} no es válido (usa el formato internacional, p. ej. +31 6…).` };
    guardians.push({ id: typeof raw.id === 'string' && /^g[0-9]{1,2}$/.test(raw.id) ? raw.id : `g${index + 1}`, role, name, phone, whatsapp: raw.whatsapp !== false, primary: raw.primary === true });
  }
  if (!guardians.some((g) => g.primary)) guardians[0].primary = true;
  let seenPrimary = false;
  for (const g of guardians) { if (g.primary && seenPrimary) g.primary = false; if (g.primary) seenPrimary = true; }
  const messages = (Array.isArray(input.messages) ? input.messages : [])
    .filter((m) => typeof m === 'string').map((m) => m.replace(/\s+/g, ' ').trim().slice(0, 400)).filter((m) => m.length > 0).slice(0, MAX_MESSAGES);
  return { ok: true, config: { country, emergencyNumber: EMERGENCY[country], childName, guardians, messages } };
}

/** Ubicación válida o null. accuracy en metros. */
export function validLocation(loc) {
  if (!loc || typeof loc !== 'object') return null;
  const lat = Number(loc.lat), lon = Number(loc.lon), accuracy = Number(loc.accuracy);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const out = { lat: Math.round(lat * 1e6) / 1e6, lon: Math.round(lon * 1e6) / 1e6 };
  if (Number.isFinite(accuracy) && accuracy >= 0 && accuracy < 100000) out.accuracy = Math.round(accuracy);
  if (typeof loc.at === 'string' && !Number.isNaN(Date.parse(loc.at))) out.at = new Date(loc.at).toISOString();
  return out;
}

export const mapsUrl = (loc) => `https://maps.google.com/?q=${loc.lat},${loc.lon}`;

/** Texto del aviso. lang: 'es' | 'nl'. */
export function alertText({ childName, kind, location, lang }) {
  const L = lang === 'nl' ? 'nl' : 'es';
  const who = childName || (L === 'nl' ? 'Je kind' : 'Tu hija/o');
  const what = (KIND_TEXT[L] || KIND_TEXT.es)[KINDS.includes(kind) ? kind : 'ayuda'];
  const loc = validLocation(location);
  const where = loc
    ? (L === 'nl' ? ` Locatie: ${mapsUrl(loc)}` : ` Ubicación: ${mapsUrl(loc)}`) + (loc.accuracy !== undefined ? ` (±${loc.accuracy} m)` : '')
    : (L === 'nl' ? ' Locatie nog onbekend.' : ' Ubicación todavía desconocida.');
  return `SOS · ${who} ${what}.${where}`;
}

/** Enlaces listos para pulsar: llamada, SMS y WhatsApp (si el contacto lo usa). */
export function contactLinks(guardian, text) {
  const phone = guardian && guardian.phone;
  if (!phone) return {};
  const body = encodeURIComponent(text || '');
  return {
    call: `tel:${phone}`,
    // «?&body=» funciona en iPhone y en Android.
    sms: `sms:${phone}?&body=${body}`,
    ...(guardian.whatsapp ? { whatsapp: `https://wa.me/${phone.replace(/^\+/, '')}?text=${body}` } : {}),
  };
}

export const emergencyCall = (config) => `tel:${(config && config.emergencyNumber) || EMERGENCY[(config && config.country) || 'NL'] || '112'}`;

/** Registro de un aviso en el servidor. */
export function newSosEvent({ id, at, kind, location }) {
  const loc = validLocation(location);
  return { id, startedAt: at, kind: KINDS.includes(kind) ? kind : 'ayuda', status: 'activo', locations: loc ? [{ ...loc, at: loc.at || at }] : [] };
}
export const MAX_LOCATIONS = 120;
export function addLocation(event, location, at) {
  const loc = validLocation(location);
  if (!loc || event.status !== 'activo') return event;
  return { ...event, locations: [...event.locations, { ...loc, at: loc.at || at }].slice(-MAX_LOCATIONS) };
}
export const resolveSos = (event, at) => ({ ...event, status: 'resuelto', resolvedAt: at });

/* ── Primeros auxilios guiados para una niña o un niño (≈10 años) ─────────────────────────────────────────────────
 * Pasos cortos, en calma, con una segunda forma más fácil de decir cada cosa («o sea»). Se apoyan en varias fuentes
 * que coinciden (ver FIRST_AID_SOURCES). Nunca sustituyen a la persona del 112: el primer paso útil es llamar y
 * poner el altavoz; quien atiende el 112 guía la reanimación y en Países Bajos avisa a voluntarios con desfibrilador.
 */
export const FIRST_AID_SOURCES = Object.freeze([
  'European Resuscitation Council, Guidelines 2025: Adult Basic Life Support (Resuscitation 2025;215:110771) — llamar ya si no responde; 100–120 compresiones por minuto, 5–6 cm.',
  'Resuscitation Council UK, 2025 — sin formación, solo compresiones; llamar antes de comprobar la respiración y seguir al operador.',
  'Nederlandse Reanimatie Raad, Richtlijnen Reanimatie in Nederland 2025/2021 — (laat) 112 bellen, AED; si duda si respira normal, actuar como si no; de lado si respira.',
  'ILCOR «Kids Save Lives» (2023) — algoritmo COMPROBAR–LLAMAR–COMPRIMIR para escolares; a los 10–12 años se logran compresiones eficaces en maniquí.',
  'Epilepsiefonds (epilepsie.nl) y Jeroen Bosch Ziekenhuis — en una convulsión: no sujetar, nada entre los dientes, proteger la cabeza; más de 5 minutos, 112.',
  'Rode Kruis / Gezondheid en Wetenschap — bewusteloos y respira normal: de lado (zijligging) y vigilar la respiración.',
  'Policía de Luxemburgo, «Personnes inconnues» — no pararse, seguir caminando y gritar; ir a una tienda y contárselo al personal, o a un sitio con mucha gente.',
  'nidirect (Gobierno de Irlanda del Norte) — si te siguen, cruza la calle o ve a un sitio con gente, como una parada de bus o una tienda; nunca irse con desconocidos y contarlo siempre.',
  'Policía de Halifax y KidsHealth — no acercarse a coches de desconocidos; si te agarran, grita, patalea y corre; recordar la matrícula.',
  'Kidpower, «Run to Safety» — gritar y correr hacia la seguridad, y practicarlo: sin práctica, el miedo puede paralizar.',
  'Técnicas de suelta de agarre (Black Belt, Instructables y similares) — girar la muñeca hacia el pulgar de quien agarra; con agarre por detrás, bajar el peso y salir hacia la gente.',
]);

export const COMPRESSIONS_PER_MINUTE = 110;

export const FIRST_AID = Object.freeze({
  calma: {
    title: 'Primero, calma',
    say: 'Estoy contigo. Respira conmigo: toma aire por la nariz… y suéltalo despacio. Tú puedes hacerlo.',
    simple: 'O sea: respira despacito. No estás sola.',
    next: [['Ya estoy un poco más tranquila', 'seguro']],
  },
  seguro: {
    title: '¿Es seguro acercarte?',
    say: 'Mira alrededor. Si hay fuego, humo, cables o agua con electricidad, no te acerques: sal y llama al 112.',
    simple: 'O sea: si hay peligro, tú primero te cuidas.',
    next: [['Es seguro', 'responde'], ['Hay peligro', 'llamar_fuera']],
  },
  llamar_fuera: {
    title: 'Sal y pide ayuda',
    say: 'Sal a un sitio seguro. Llama al 112 y di qué pasa y dónde estás. Yo aviso a tu familia.',
    simple: 'O sea: vete a un sitio seguro y llama.',
    call112: true, alertGuardians: true,
    next: [],
  },
  responde: {
    title: '¿Responde?',
    say: 'Arrodíllate a su lado. Toca sus hombros y llámalo fuerte por su nombre: «¡Papá! ¿Me oyes?».',
    simple: 'O sea: muévelo un poco de los hombros y háblale fuerte.',
    next: [['Me contesta o se mueve', 'despierto'], ['No contesta', 'llamar']],
  },
  despierto: {
    title: 'Está despierto',
    say: 'Muy bien. Quédate con él y pregúntale qué le pasa. Si le duele el pecho, le cuesta respirar o está muy raro, llama al 112.',
    simple: 'O sea: acompáñalo y, si está mal, llama.',
    call112: true, alertGuardians: true,
    next: [['Ya está mejor', 'fin'], ['Se ha desmayado otra vez', 'llamar']],
  },
  llamar: {
    title: 'Llama al 112 y pon el altavoz',
    say: 'Pulsa el botón rojo del 112. Cuando contesten, pon el altavoz y di: «Mi papá no despierta». Di tu dirección. La persona del 112 te va a ayudar paso a paso. Yo aviso a tu familia.',
    simple: 'O sea: llama, pon el altavoz y haz lo que te digan.',
    call112: true, alertGuardians: true,
    next: [['Ya he llamado', 'respira']],
  },
  respira: {
    title: '¿Respira normal?',
    say: 'Mira su pecho durante diez segundos. ¿Sube y baja tranquilo? Si solo da bocanadas raras, como hipos, eso no es respirar normal.',
    simple: 'O sea: mira si su pecho se mueve como cuando duerme.',
    next: [['Sí, respira normal', 'de_lado'], ['No respira o respira raro', 'rcp'], ['No estoy segura', 'rcp']],
  },
  de_lado: {
    title: 'Ponlo de lado',
    say: 'Ponlo de lado, sobre un costado, con la cabeza un poco hacia atrás para que el aire pase bien. Quédate a su lado y mira que sigue respirando.',
    simple: 'O sea: de lado, como cuando duermes de lado.',
    next: [['Deja de respirar', 'rcp'], ['Ya llegó la ambulancia', 'fin']],
  },
  rcp: {
    title: 'Ayuda a su corazón',
    say: 'Ponlo boca arriba en el suelo. Pon tus manos una encima de la otra en el centro del pecho. Con los brazos rectos, aprieta fuerte hacia abajo y suelta, al ritmo del sonido. No pares hasta que llegue la ambulancia. Si la persona del 112 te dice otra cosa, haz lo que te diga.',
    simple: 'O sea: aprieta en el medio del pecho, fuerte y rápido, con el ritmo. Aunque no te salga perfecto, estás ayudando muchísimo.',
    metronome: true,
    next: [['Ya llegó la ambulancia', 'fin'], ['Abre los ojos o respira', 'de_lado']],
  },
  convulsion: {
    title: 'Tiembla o se sacude',
    say: 'No le sujetes los brazos ni las piernas. No le metas nada en la boca: ni los dedos, ni una cuchara. Aparta las cosas duras y pon algo blando bajo su cabeza. Mira la hora.',
    simple: 'O sea: déjalo moverse, protege su cabeza y no toques su boca.',
    next: [['Ya paró', 'de_lado'], ['Lleva más de 5 minutos', 'llamar'], ['Es la primera vez', 'llamar']],
  },
  calle: {
    title: 'Sigue caminando',
    say: 'No te pares. No hables con esa persona ni discutas. Camina rápido hacia donde haya gente y luz. Yo ya aviso a papá con tu ubicación.',
    simple: 'O sea: no te quedes quieta, vete hacia la gente.',
    alertGuardians: true,
    next: [['Ya veo una tienda o mucha gente', 'calle_dentro'], ['Me están agarrando', 'calle_grita'], ['Es peligro ya', 'llamar_calle']],
  },
  calle_dentro: {
    title: 'Entra y pide ayuda',
    say: 'Entra en la tienda, la farmacia o el súper. Dile a la primera persona que trabaja allí: «Me está siguiendo alguien, ¿me ayuda? Me llamo…». Quédate donde te vean todos y las cámaras.',
    simple: 'O sea: entra, habla con alguien que trabaje ahí y quédate a la vista.',
    next: [['Ya estoy con alguien que me ayuda', 'calle_recuerda']],
  },
  calle_grita: {
    title: '¡Grita y corre!',
    say: 'Grita muy fuerte: «¡No te conozco! ¡Ayuda!». Patalea, suéltate y corre hacia la gente. Nunca te subas a un coche.',
    simple: 'O sea: grita fuerte, suéltate y corre hacia donde hay gente.',
    call112: true, alertGuardians: true,
    next: [['Ya estoy a salvo con gente', 'calle_recuerda']],
  },
  llamar_calle: {
    title: 'Llama al 112',
    say: 'Pulsa el botón rojo del 112 y di: «Me están siguiendo» y dónde estás. Sigue caminando hacia la gente mientras hablas.',
    simple: 'O sea: llama y no te pares.',
    call112: true, alertGuardians: true,
    next: [['Ya estoy a salvo con gente', 'calle_recuerda']],
  },
  calle_recuerda: {
    title: 'Fíjate y cuéntalo',
    say: 'Si puedes, recuerda cómo era: ropa, pelo, altura, o la matrícula del coche. Cuéntaselo a papá o a la policía, aunque esa persona te diga que es un secreto.',
    simple: 'O sea: acuérdate de cómo era y cuéntalo siempre.',
    next: [['Ya estoy bien', 'fin']],
  },
  fin: {
    title: 'Lo has hecho muy bien',
    say: 'Has sido muy valiente. Ahora los mayores se encargan. Respira despacio. Tu familia ya está avisada.',
    simple: 'O sea: ya está, lo hiciste genial.',
    next: [],
  },
});
/** Puertas de entrada al guía según lo que diga la niña. */
export const FIRST_AID_ENTRIES = Object.freeze([
  ['Alguien de casa se ha caído o no despierta', 'calma'],
  ['Alguien tiembla o se sacude', 'convulsion'],
  ['Me siguen o me siento en peligro en la calle', 'calle'],
]);
/** Palabras difíciles y su forma fácil (se practican con calma fuera de la emergencia). */
export const FIRST_AID_WORDS = Object.freeze([
  ['inconsciente', 'no despierta'], ['reanimación', 'ayudar al corazón apretando el pecho'], ['desfibrilador (AED)', 'aparato que da una pequeña descarga al corazón'],
  ['convulsión', 'cuando el cuerpo tiembla y se sacude solo'], ['ambulancia', 'el coche de los médicos'], ['operador del 112', 'la persona que contesta y te ayuda'],
]);
/** Consejos para estar segura en la calle (se repasan con calma, fuera de la emergencia). */
export const STREET_SAFETY = Object.freeze([
  'Nunca te vayas con nadie, aunque diga que te conoce o que papá lo manda, si no sabe la palabra secreta de la familia.',
  'No te acerques a un coche aunque te llamen: si alguien quiere preguntar algo, que pregunte a un adulto.',
  'Ve por calles con gente y luz; evita sitios oscuros, solitarios o atajos.',
  'Si alguien te sigue: no te pares ni discutas; cruza, camina hacia la gente y entra en una tienda.',
  'Las personas que trabajan en tiendas, la policía y las mamás o papás con niños son buenas personas a las que pedir ayuda.',
  'Sabe de memoria tu dirección y el teléfono de papá.',
  'Lo que te dé miedo o te parezca raro, cuéntalo siempre: nunca es un secreto.',
]);

/** Defensa personal básica para niñas y niños: escapar, no pelear. Se practica en casa, con papá, como un juego. */
export const SELF_DEFENSE = Object.freeze([
  ['Tu voz es tu primera arma', 'Grita muy fuerte, como loca: «¡NO! ¡No te conozco! ¡AYUDA!». Que todo el mundo mire.'],
  ['Suéltate de la muñeca', 'Si te agarran de la muñeca, no tires hacia atrás: gira la mano hacia el dedo gordo de quien te agarra y sácala de un tirón.'],
  ['Si te agarran por detrás', 'Déjate caer como un saco (pesas más), patalea, pisa fuerte su pie y suéltate.'],
  ['Golpea donde duele', 'Una patada fuerte en la entrepierna o en la espinilla, y en cuanto te suelte… ¡a correr!'],
  ['Corre como si no hubiera mañana', 'Corre hacia la gente y la luz, nunca hacia un sitio vacío. Entra en una tienda y pide ayuda.'],
  ['Si te caes, te levantas', 'No esperes a que te levanten: levántate, sacúdete y sigue corriendo. Aunque te hayas raspado, sigue adelante.'],
  ['El objetivo es escapar', 'No hace falta ganar ninguna pelea: solo soltarte y llegar a un sitio seguro.'],
]);

/** Mensajes por defecto. Cada familia escribe los suyos en la configuración (messages): son privados y no van en el código. */
export const FAMILY_VALUES = Object.freeze([
  'Si un día te caes, no importa dónde ni cómo: te levantas, te sacudes y sigues adelante con la frente en alto.',
  'Aunque te duela o te hayas raspado, sigues caminando, siempre hacia delante y con la cabeza en alto.',
  'Tu familia te quiere muchísimo y siempre puedes contar con ella.',
  'Nunca tengas miedo de contar lo que te pasa: sea lo que sea, puedes confiar en tu familia.',
]);
export const MAX_MESSAGES = 30;

