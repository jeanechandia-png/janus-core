/**
 * Controls ES/NL from the original founder-approved artwork (#65).
 * Shared visual component only: does not replace dashboard or authorization flows.
 * UI chrome translations are deliberately partial until content localization is reviewed.
 */
export const LANGUAGES = Object.freeze([
  { code: 'nl', name: 'Nederlands', image: '/language-art/nederland.webp.b64' },
  { code: 'es', name: 'Español', image: '/language-art/espana.webp.b64' },
]);
const UI = Object.freeze({
  founder: {
    es: { signIn: 'Identificarme', controls: 'Controles y familia', kidApp: 'App de Kendra', prayers: 'Oraciones', install: 'Instalar app', heading: 'Trabajo en vivo', approvals: 'Tu visto bueno', capabilities: 'Disponibilidad real', run: 'Ejecutar', pause: 'Pausar', stop: 'Detener', team: 'Mi equipo', teamOpen: 'Toca para ver ¿Cómo va el equipo?', teamEmpty: 'Aún no hay colaboradores' },
    nl: { signIn: 'Inloggen', controls: 'Bediening en gezin', kidApp: "Kendra's app", prayers: 'Gebeden', install: 'App installeren', heading: 'Live aan het werk', approvals: 'Jouw goedkeuring', capabilities: 'Werkelijke beschikbaarheid', run: 'Uitvoeren', pause: 'Pauzeren', stop: 'Stoppen', team: 'Mijn team', teamOpen: 'Tik voor: Hoe gaat het met het team?', teamEmpty: 'Nog geen medewerkers' },
  },
  kendra: {
    es: { home: 'Inicio', chat: 'Charla', day: 'Mi día', watch: 'Ver', house: 'Casa', things: 'Mis cosas', pray: 'Oraciones', school: 'School', dance: 'Baile', parent: 'Zona de padres', voice: 'Leer en voz alta las respuestas' },
    nl: { home: 'Start', chat: 'Praten', day: 'Mijn dag', watch: 'Kijken', house: 'Thuis', things: 'Mijn spullen', pray: 'Gebeden', school: 'School', dance: 'Dansen', parent: 'Ouderzone', voice: 'Antwoorden voorlezen' },
  },
});
export function currentLanguage(scope, storage = globalThis.localStorage) {
  try { return storage?.getItem('janus.language.' + scope) === 'nl' ? 'nl' : 'es'; }
  catch { return 'es'; }
}
export function uiLabel(scope, key, fallback = '', storage = globalThis.localStorage) {
  return UI[scope]?.[currentLanguage(scope, storage)]?.[key] ?? fallback;
}
const artCache = new Map();
function imageData(image) {
  if (!artCache.has(image)) {
    artCache.set(image, fetch(image, { credentials: 'same-origin' }).then(async (response) => {
      if (!response.ok) throw new Error('Approved medallion asset missing');
      const encoded = (await response.text()).trim();
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length > 40000) {
        throw new Error('Invalid bundled medallion');
      }
      return 'data:image/webp;base64,' + encoded;
    }).catch(() => null));
  }
  return artCache.get(image);
}
export function mountLanguageButtons(container, scope, { storage = globalThis.localStorage, onChange } = {}) {
  if (!container || !UI[scope]) return () => {};
  const doc = container.ownerDocument;
  const buttons = [];
  container.replaceChildren();
  container.setAttribute('role', 'group');
  container.setAttribute('aria-label', 'Idioma / Taal');
  for (const lang of LANGUAGES) {
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'janus-language-button';
    button.dataset.language = lang.code;
    button.setAttribute('aria-label', lang.name);
    button.title = lang.name;
    const flag = doc.createElement('img');
    flag.width = 32;
    flag.height = 32;
    flag.alt = '';
    flag.loading = 'eager';
    flag.decoding = 'async';
    imageData(lang.image).then((url) => {
      if (url && button.isConnected) flag.src = url;
      else if (!url) button.setAttribute('data-asset-missing', 'true');
    });
    button.append(flag);
    button.addEventListener('click', () => select(lang.code, true));
    container.append(button);
    buttons.push(button);
  }
  function select(language, persist) {
    const active = language === 'nl' ? 'nl' : 'es';
    doc.documentElement.lang = active;
    for (const button of buttons) {
      const selected = button.dataset.language === active;
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('is-lit', selected);
    }
    if (persist) {
      try { storage?.setItem('janus.language.' + scope, active); } catch { /* localStorage optional */ }
      if (typeof onChange === 'function') onChange(active);
      doc.dispatchEvent(new CustomEvent('janus:language-changed', { detail: { scope, language: active } }));
    }
  }
  select(currentLanguage(scope, storage), false);
  return () => { container.replaceChildren(); };
}

const KENDRA_NL=Object.freeze({
  "Activar": "Activeren",
  "¡Hola! Vamos a conocernos": "Hallo! Laten we kennismaken",
  "Pídele a papá el código para activar Kendra en este aparato.": "Vraag papa om de code om Kendra op dit apparaat te activeren.",
  "Código de papá": "Papa's code",
  "No pude activarlo. Inténtalo otra vez.": "Activeren is niet gelukt. Probeer het opnieuw.",
  "Reintentar": "Opnieuw proberen",
  "Cambiar mi nombre, mi icono o mi criatura": "Mijn naam, icoon of vriendje wijzigen",
  "Secciones": "Onderdelen",
  "Hablar en vez de escribir": "Spreken in plaats van typen",
  "Vale": "Oké",
  "Las oraciones no se han podido cargar.": "De gebeden konden niet worden geladen.",
  "Oraciones": "Gebeden",
  "🔊 Escuchar": "🔊 Luisteren",
  "Cómo se dice": "Uitspraak",
  "Esta tablet no puede leerla en voz alta.": "Deze tablet kan dit niet voorlezen.",
  "Tu criatura aún no está disponible.": "Je vriendje is nog niet beschikbaar.",
  "Mi día": "Mijn dag",
  "Hora local": "Lokale tijd",
  "Ahora": "Nu",
  "Luego": "Straks",
  "Sin actividad apuntada": "Geen activiteit genoteerd",
  "Ver mi día": "Mijn dag bekijken",
  "Ver": "Kijken",
  "Solo vídeos aprobados por papá.": "Alleen video's die papa heeft goedgekeurd.",
  "Todavía no hay vídeos aprobados.": "Er zijn nog geen goedgekeurde video's.",
  "Ver mis vídeos": "Mijn video's bekijken",
  "Baile": "Dansen",
  "No olvides": "Niet vergeten",
  "Sin recordatorios pendientes.": "Geen openstaande herinneringen.",
  "Vale, ya lo sé": "Oké, ik weet het",
  "Hablar conmigo": "Met mij praten",
  "Mi pantalla": "Mijn scherm",
  "Fechas especiales": "Bijzondere dagen",
  "Fecha pendiente de sincronizar.": "Datum nog niet gesynchroniseerd.",
  "días para Navidad": "dagen tot Kerstmis",
  "🌤️ El tiempo": "🌤️ Het weer",
  "Pídele a papá que ponga dónde vives y te digo qué ropa llevar.": "Vraag papa om je woonplaats in te stellen, dan vertel ik je wat je kunt aantrekken.",
  "No tengo el tiempo de hoy.": "Ik heb geen weergegevens voor vandaag.",
  "Ponte: ": "Trek aan: ",
  "Enviar": "Versturen",
  "Escribe o dicta…": "Schrijf of spreek…",
  "Mensaje": "Bericht",
  "Apuntar": "Noteren",
  "📅 Mi agenda": "📅 Mijn agenda",
  "Todavía no hay nada. ¡Apunta algo!": "Er staat nog niets. Noteer iets!",
  "Añadir": "Toevoegen",
  "✏️ Mis tareas": "✏️ Mijn taken",
  "¡Nada pendiente! 🎉": "Niets meer te doen! 🎉",
  "Crear": "Maken",
  "🧩 Mis proyectos": "🧩 Mijn projecten",
  "Aquí van tus proyectos del cole o los tuyos.": "Hier komen je schoolprojecten en eigen projecten.",
  "Cerrar el vídeo": "Video sluiten",
  "Vídeos para ti": "Video's voor jou",
  "Aún no hay vídeos de baile aprobados.": "Er zijn nog geen goedgekeurde dansvideo's.",
  "Papá todavía no ha elegido vídeos.": "Papa heeft nog geen video's gekozen.",
  "Solo puedes abrir los vídeos que papá ha aprobado.": "Je kunt alleen video's openen die papa heeft goedgekeurd.",
  "Tiempo de vídeo pendiente de comprobar.": "De videotijd moet nog worden gecontroleerd.",
  "Elegir otro ejercicio": "Een andere oefening kiezen",
  "Cargando ejercicios…": "Oefeningen laden…",
  "Ejercicios no disponibles.": "Oefeningen niet beschikbaar.",
  "No hay ejercicios disponibles todavía.": "Er zijn nog geen oefeningen beschikbaar.",
  "Elige una materia y practica a tu ritmo.": "Kies een vak en oefen in je eigen tempo.",
  "Mis ejercicios de casa": "Mijn huiswerk",
  " · Practicado": " · Geoefend",
  "Salir de concentración": "Concentratiemodus verlaten",
  "Concentrarme": "Concentreren",
  "Comprueba lo aprendido": "Test wat je hebt geleerd",
  "Ejercicio terminado": "Oefening klaar",
  "Has llegado al final. Gracias por practicar.": "Je bent klaar. Bedankt voor het oefenen.",
  "Paso ": "Stap ",
  "Materiales: ": "Benodigdheden: ",
  "Escuchar la palabra": "Het woord beluisteren",
  "Repasar": "Herhalen",
  "Fuente: ": "Bron: ",
  "Oír otra vez": "Nog eens luisteren",
  "Más despacio": "Langzamer",
  "Anterior": "Vorige",
  "Terminar": "Afronden",
  "Siguiente": "Volgende",
  "Hacer": "Doen",
  "🏠 La casa": "🏠 Thuis",
  "Papá todavía no ha activado la casa para ti.": "Papa heeft de huisbediening nog niet voor je ingesteld.",
  "Las puertas, las alarmas y la cocina nunca las toco: eso es de papá.": "De deuren, alarmen en keuken bedien ik nooit: dat is voor papa.",
  "👼 Ángel Guardián": "👼 Beschermengel",
  "Practicar": "Oefenen",
  "⭐ Lo que me gusta": "⭐ Wat ik leuk vind",
  "🎈 Planes y ofertas para ti": "🎈 Uitjes en aanbiedingen voor jou",
  "Cuando papá apruebe planes, ofertas o pelis, aparecerán aquí.": "Als papa uitjes, aanbiedingen of films goedkeurt, verschijnen ze hier.",
  "Papá mira todo esto antes de que lo veas. 💜": "Papa bekijkt dit allemaal voordat jij het ziet. 💜",
  "Elige tu escena.": "Kies je scène.",
  " Cambiar de escena según la actividad": " Scène wisselen op basis van je activiteit",
  "Tu elección se guarda. El decorado 3D definitivo estará disponible cuando se incorpore el modelo aprobado.": "Je keuze wordt bewaard. Het definitieve 3D-decor komt beschikbaar zodra het goedgekeurde model is toegevoegd.",
  "Guardar": "Opslaan",
  "Cambiar color y criatura": "Kleur en vriendje wijzigen",
  "Cancelar": "Annuleren",
  "Hazlo tuyo": "Maak het van jou",
  "Mi nombre": "Mijn naam",
  "Mi icono": "Mijn icoon",
  "Mi color": "Mijn kleur",
  "Elige tu criatura": "Kies je vriendje",
  "🔒 Zona de padres": "🔒 Ouderzone",
  "Escribe el PIN.": "Voer de pincode in.",
  "Entrar": "Inloggen",
  "Volver": "Terug",
  "Paseo": "Wandeling",
  "Mi cuarto": "Mijn kamer",
  "Escenario": "Podium",
  "Hoy": "Vandaag",
  "Mañana": "Morgen",
  "No pude comprobar la respuesta. Inténtalo otra vez.": "Ik kon het antwoord niet controleren. Probeer het opnieuw.",
  "No pude cargar los ejercicios. Inténtalo otra vez.": "Ik kon de oefeningen niet laden. Probeer het opnieuw.",
  "No hay una voz local instalada para este idioma. Puedes leerlo en pantalla.": "Er is geen lokale stem voor deze taal geïnstalleerd. Je kunt het op het scherm lezen.",
  "Este dispositivo ya no está emparejado. Pídele a papá un código nuevo.": "Dit apparaat is niet meer gekoppeld. Vraag papa om een nieuwe code.",
  "Parece que no hay internet. Inténtalo en un ratito.": "Het lijkt erop dat er geen internet is. Probeer het zo nog eens.",
  "No pude guardarlo.": "Opslaan is niet gelukt.",
  "No pude apuntarlo.": "Noteren is niet gelukt.",
  "¡Bien hecho!": "Goed gedaan!",
  "No pude guardar la tarea.": "Ik kon de taak niet opslaan.",
  "Personalizar": "Personaliseren",
  "No pude cargar. Inténtalo en un ratito.": "Laden is niet gelukt. Probeer het zo nog eens."
});
export function kidText(value,language=currentLanguage('kendra')){return language==='nl'&&Object.hasOwn(KENDRA_NL,value)?KENDRA_NL[value]:value;}
