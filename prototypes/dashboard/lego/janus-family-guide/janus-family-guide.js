'use strict';
/**
 * JANUS Family Guide — configuración familiar local para Kendra.
 * Referencia católica expresamente solicitada por su padre. La fe se presenta
 * como tradición familiar; las explicaciones escolares distinguen entre
 * enseñanza religiosa y datos académicos. Nada se compra ni se publica.
 * Las actividades son voluntarias, sin juicio del cuerpo, sin diagnóstico
 * y sin premio o castigo por rezar, bailar o comer.
 */
const JanusFamilyGuide = (() => {
  const refs = Object.freeze({
    christmasEve: 'https://www.vatican.va/content/benedict-xvi/es/homilies/2005/documents/hf_ben-xvi_hom_20051224_christmas.html',
    christmasDay: 'https://www.usccb.org/prayer-and-worship/liturgical-year-and-calendar/christmas/christmas-proclamation',
    physicalActivity: 'https://www.who.int/news-room/fact-sheets/detail/physical-activity',
    mathematics: 'https://ies.ed.gov/ncee/WWC/Docs/practiceguide/wwc2021006.pdf'
  });
  const steps = (a) => a.map(([say,pose]) => Object.freeze({say,pose}));
  const activities = Object.freeze([
    { id:'nochebuena', group:'navidad', title:'Nochebuena en familia', icon:'✦', minutes:5, month:12, day:24, steps:steps([
      ['¡Feliz Nochebuena, Kendra! Hoy, 24 de diciembre, nos reunimos en familia para celebrar la llegada del Niño Jesús.','saluda'],
      ['¿Buscamos el belén? Podemos recordar a María, José, el Niño Jesús, los pastores y los ángeles. ¿Quién está junto al pesebre?','piensa'],
      ['¿Te gustaría colocar una estrella o un adorno en el árbol de Navidad con ayuda de un adulto? Miramos las luces, pero dejamos los enchufes y velas para los mayores.','habla'],
      ['Podemos cantar un villancico que conozca la familia, dar gracias a Dios y decir algo bonito a los demás.','celebra'],
      ['Si en casa se reparten regalos esta noche, los abrimos con ilusión y damos las gracias. El cariño y compartir importan más que la cantidad de regalos.','saluda']
    ])},
    { id:'navidad', group:'navidad', title:'Nacimiento de Jesús y regalos', icon:'★', minutes:4, month:12, day:25, steps:steps([
      ['¡Feliz Navidad, Kendra! Hoy, 25 de diciembre, celebramos el nacimiento de Jesús. Ayer fue nuestra celebración familiar de Nochebuena.','saluda'],
      ['En nuestra tradición católica, el Niño Jesús nos recuerda el amor, la esperanza y la generosidad. ¿Qué te gustaría agradecer hoy?','piensa'],
      ['El árbol, el belén, los villancicos y los regalos nos ayudan a celebrar juntos. Un regalo también puede ser una tarjeta hecha por ti o un abrazo.','habla'],
      ['Recordamos a María, José y los ángeles. Si te apetece, hacemos una pequeña oración y deseamos paz a nuestra familia.','saluda']
    ])},
    { id:'arbol', group:'navidad', title:'Árbol, belén y villancicos', icon:'❄', minutes:4, steps:steps([
      ['Vamos a preparar nuestro rincón navideño. Primero decidimos dónde irá el árbol, sin tapar puertas ni pasillos.','saluda'],
      ['Contemos los adornos: tres estrellas y dos bolas. ¿Cuántos objetos tenemos? Podemos separarlos y volverlos a juntar.','piensa'],
      ['En el belén buscamos a María, José y el Niño Jesús. Recuerda pedir ayuda a un adulto para las luces y objetos delicados.','habla'],
      ['Escoge un villancico familiar para cantar juntos. Yo puedo marcar el ritmo con palmas; la música real la elige vuestra familia.','celebra']
    ])},
    { id:'regalos', group:'navidad', title:'Dar y recibir regalos', icon:'♡', minutes:3, steps:steps([
      ['Hagamos un regalo con cariño. Podemos dibujar una tarjeta para alguien que queremos. No necesitamos comprar nada.','saluda'],
      ['Imagina que recibes un regalo. ¿Qué palabras de agradecimiento usarías? Podemos decir: muchísimas gracias por pensar en mí.','habla'],
      ['También podemos compartir nuestro tiempo, escuchar y ayudar. Eso es parte del espíritu de Navidad en nuestra familia.','piensa']
    ])},
    { id:'buenos-dias', group:'valores', title:'Buenos días y buenos modales', icon:'☀', minutes:2, steps:steps([
      ['¡Buenos días, Kendra! Saludamos con alegría: buenos días, por favor y gracias.','saluda'],
      ['Hoy podemos agradecer a Dios por nuestra familia y por una nueva oportunidad de aprender. ¿Por qué das gracias tú?','piensa'],
      ['Si alguien nos ayuda, decimos muchas gracias. Si nos equivocamos, podemos pedir perdón y reparar.','habla']
    ])},
    { id:'buenas-noches', group:'fe', title:'Oración antes de dormir', icon:'☾', minutes:3, steps:steps([
      ['Buenas noches, Kendra. Podemos recordar una cosa bonita que nos pasó hoy.','piensa'],
      ['Si te apetece, rezamos: Dios bueno, gracias por nuestra familia, por la vida y por lo que hemos aprendido hoy. Ayúdanos a ser amables mañana. Amén.','habla'],
      ['Virgen María, acompaña a nuestra familia. Ángeles de la guarda, que tengamos una noche tranquila y en paz.','saluda'],
      ['Descansamos con calma. Si necesitas algo, siempre puedes hablar con Jean u otro adulto de confianza.','habla']
    ])},
    { id:'bailar', group:'movimiento', title:'Baile por turnos', icon:'♫', minutes:4, steps:steps([
      ['¿Bailamos? Primero despejamos un espacio. Puedes seguir mis gestos o inventar los tuyos.','saluda'],
      ['Paso a la derecha y juntamos los pies. Paso a la izquierda y juntamos los pies. Vamos despacio.','celebra'],
      ['Dos palmas suaves, levantamos los brazos y giramos lentamente si estamos cómodos.','celebra'],
      ['Ahora eliges tú: me dices qué paso quieres enseñarme. Podemos descansar cuando quieras.','piensa']
    ])},
    { id:'aerobicos', group:'movimiento', title:'Ejercicio y movimiento suave', icon:'✧', minutes:4, steps:steps([
      ['¡Vamos a movernos con alegría! Busca un lugar seguro y avisa a un adulto si algo duele o te marea.','saluda'],
      ['Marchamos en el sitio suavemente. Uno, dos, tres, cuatro. También puedes mover los brazos desde una silla.','celebra'],
      ['Movemos los brazos lentamente y respiramos con naturalidad. Tú decides el ritmo.','habla'],
      ['Terminamos descansando y bebiendo agua si tienes sed. No hace falta competir ni hacerlo perfecto.','saluda']
    ])},
    { id:'comida-saludable', group:'bienestar', title:'Comer variado y dar gracias', icon:'❀', minutes:3, steps:steps([
      ['La comida nos da energía para jugar, aprender y crecer. ¿Qué fruta o verdura te gusta?','habla'],
      ['Podemos conocer distintos alimentos: manzana, zanahoria, lentejas, pan y agua. Ningún alimento es un castigo ni algo por lo que debas sentir vergüenza.','piensa'],
      ['Comemos escuchando el hambre y la saciedad, con las indicaciones de los adultos que te cuidan. Damos gracias a Dios por los alimentos.','saluda']
    ])},
    { id:'matematicas-concretas', group:'aprender', title:'Matemáticas con objetos', icon:'◉', minutes:3, steps:steps([
      ['Vamos a probar una multiplicación con objetos. Imaginamos cuatro platos y ponemos dos manzanas en cada uno.','saluda'],
      ['Dos, cuatro, seis, ocho. También podemos sumar dos más dos más dos más dos. ¿Cuántas manzanas son?','piensa'],
      ['¡Ocho! Si necesitas más tiempo, volvemos a contar. Probar varias formas ayuda a comprender.','celebra']
    ])},
    { id:'palabras', group:'aprender', title:'Palabras en español, neerlandés e inglés', icon:'✎', minutes:3, steps:steps([
      ['Probamos tres saludos: buenos días, goedemorgen y good morning.','saluda'],
      ['En neerlandés decimos dank je para dar las gracias; en inglés, thank you. ¿Quieres repetir uno?','habla'],
      ['Podemos usarlos en una frase: Dank je wel. Thank you very much. ¡Muy bien por intentarlo!','celebra']
    ])}
  ].map(x=>Object.freeze({...x,steps:Object.freeze(x.steps)})));
  const byId = Object.freeze(Object.fromEntries(activities.map(a=>[a.id,a])));
  function get(id) { return typeof id==='string' ? byId[id] || null : null; }
  function step(id,index) {
    const a=get(id);
    if(!a || !Number.isInteger(index) || index<0 || index>=a.steps.length)return null;
    return a.steps[index];
  }
  function calendar(date=new Date()) {
    const month=date.getMonth()+1, day=date.getDate();
    return {
      christmasEve:month===12&&day===24,
      christmasDay:month===12&&day===25,
      adventSeason:month===12&&day<24,
      seasonal:month===12||month===1&&day<=6
    };
  }
  function list(date=new Date()) {
    const today=calendar(date);
    const priority = today.christmasEve?'nochebuena':today.christmasDay?'navidad':
      today.adventSeason?'arbol':null;
    return priority ? [byId[priority], ...activities.filter(a=>a.id!==priority)] : activities.slice();
  }
  return Object.freeze({
    familyTradition:'catolica', citations:refs,
    get,step,list,calendar,
    size:activities.length,
    purchaseAutomation:false,
    religiousObligation:false,
    motionTrackingEnabled:false, // no claims of camera tracking
    voiceIdentityVerified:false // must be enforced separately by authenticated server
  });
})();
window.JanusFamilyGuide=JanusFamilyGuide;
