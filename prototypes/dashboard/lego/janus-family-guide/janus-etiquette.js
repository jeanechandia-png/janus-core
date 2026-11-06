'use strict';
/**
 * JANUS Etiquette Kit — aprendizaje familiar de autonomía, cuidado e interacción.
 * Las rutinas no miden el valor de una persona, ni su clase, dinero o cuerpo.
 * Son juegos cortos: mostrar → practicar → explicar → repetir con calma.
 * Fuentes: Emily Post (protocolo), CDC (higiene de manos), ADA (salud bucal).
 * No usa cámara para evaluar apariencia, ni califica ni avergüenza a Kendra.
 */
const JanusEtiquetteKit = (() => {
  const SOURCES = Object.freeze({
    table: 'https://emilypost.com/advice/top-table-manners-tips',
    formal: 'https://emilypost.com/advice/formal-place-setting',
    handwash: 'https://www.cdc.gov/clean-hands/faq/',
    dental: 'https://www.ada.org/resources/ada-library/oral-health-topics/toothbrushes',
  });
  const lessons = Object.freeze([
    {
      id:'presentacion', title:'Presentación personal', icon:'✧', group:'higiene', minutes:4,
      steps:[
        ['Antes de salir, revisamos nuestro aspecto por comodidad y cuidado, no para impresionar a todo el mundo. ¿Qué ropa limpia y apropiada para la actividad elegimos?', 'saluda'],
        ['El cabello peinado o recogido como te guste, manos y uñas limpias y ropa cuidada nos ayudan a sentirnos preparados.', 'piensa'],
        ['Miremos también los zapatos: si están embarrados, podemos limpiarlos con un paño y dejar que se sequen. ¡Cuidar nuestras cosas es útil!', 'habla'],
        ['Una sonrisa, decir buenos días y escuchar a los demás también forman parte de una buena presentación. Todas las personas merecen respeto, sea cual sea su ropa.', 'saluda']
      ]
    },
    {
      id:'zapatos', title:'Zapatos limpios y cuidados', icon:'◈', group:'higiene', minutes:3,
      steps:[
        ['¿Jugamos al cuidado de los zapatos? Miramos si hay barro, polvo o cordones desatados.', 'piensa'],
        ['Según el material, podemos usar un paño suave o cepillo con ayuda de un adulto. Los zapatos mojados se dejan secar de forma segura.', 'habla'],
        ['Los cordones se atan para caminar sin tropezar. Si no sabes hacerlo, practicamos despacio. El calzado nuevo o caro no es más importante que ir cómoda y segura.', 'saluda']
      ]
    },
    {
      id:'manos-unas', title:'Manos y uñas bien cuidadas', icon:'✋', group:'higiene', minutes:3,
      steps:[
        ['Antes de comer y después del baño nos lavamos las manos con agua y jabón.', 'saluda'],
        ['Frotamos palmas, dorsos, entre los dedos y alrededor de las uñas durante veinte segundos. Podemos contarlos juntos.', 'habla'],
        ['Las uñas se mantienen limpias y con longitud cómoda. Si necesitan cortarse, pedimos ayuda a un adulto.', 'piensa'],
        ['No criticamos a nadie por tener las manos sucias después de trabajar o jugar: ayudamos a lavarlas si es necesario.', 'saluda']
      ]
    },
    {
      id:'dientes-cabello', title:'Dientes y cabello', icon:'✿', group:'higiene', minutes:3,
      steps:[
        ['Cuidamos los dientes con cepillo suave y pasta adecuada, por la mañana y por la noche.', 'habla'],
        ['El cepillado suele durar dos minutos; un adulto puede ayudar según la edad y las recomendaciones de su dentista.', 'piensa'],
        ['Lavamos y peinamos el cabello cuando lo necesita, respetando su textura. Todos los tipos de pelo y peinados merecen respeto.', 'saluda']
      ]
    },
    {
      id:'comer-modales', title:'Comer con educación', icon:'♧', group:'mesa', minutes:4,
      steps:[
        ['Nos sentamos cómodos y erguidos, con los pies apoyados si es posible. Ponemos la servilleta sobre las piernas.', 'saluda'],
        ['Tomamos bocados pequeños, masticamos despacio y, cuando podemos, mantenemos la boca cerrada al masticar.', 'habla'],
        ['Esperamos a terminar de masticar antes de hablar y escuchamos cuando otra persona habla.', 'piensa'],
        ['Si necesitamos algo, pedimos: ¿me lo pasas, por favor? Y después: muchas gracias.', 'saluda']
      ]
    },
    {
      id:'cubiertos', title:'Cubiertos en una mesa formal', icon:'♢', group:'mesa', minutes:5,
      steps:[
        ['Imaginemos un restaurante elegante con varios cubiertos. No tenemos que saberlo todo: podemos aprender paso a paso.', 'saluda'],
        ['Normalmente los tenedores están a la izquierda; cuchillos y cucharas a la derecha. El filo del cuchillo mira hacia el plato.', 'habla'],
        ['En un menú formal empezamos por los cubiertos de fuera y avanzamos hacia el plato según cada plato que nos sirven.', 'piensa'],
        ['El plato de pan suele estar arriba a la izquierda y el vaso de agua arriba a la derecha. Si hay dudas, se puede preguntar educadamente.', 'habla'],
        ['La servilleta va sobre las piernas. Al terminar, damos las gracias al personal del restaurante y cuidamos cómo tratamos a todas las personas.', 'saluda']
      ]
    },
    {
      id:'restaurante', title:'Practiquemos en un restaurante', icon:'♙', group:'mesa', minutes:4,
      steps:[
        ['Jugamos a visitar un restaurante. Saludamos: buenas tardes, por favor, ¿podemos sentarnos aquí?', 'saluda'],
        ['Nos sentamos con calma, esperamos nuestro turno y tratamos al personal con respeto.', 'habla'],
        ['Pedimos comida diciendo por favor; cuando llega decimos gracias. Masticamos con tranquilidad.', 'piensa'],
        ['Si algo está equivocado, lo explicamos sin gritar: disculpe, creo que este no es mi plato. ¿Nos puede ayudar?', 'habla'],
        ['Al salir agradecemos el servicio. La cortesía es para todo el mundo, no depende de que el lugar sea lujoso.', 'saluda']
      ]
    },
    {
      id:'saludar-presentarse', title:'Saludar y presentarse', icon:'♡', group:'social', minutes:3,
      steps:[
        ['Cuando conocemos a alguien podemos decir: hola, me llamo Kendra, mucho gusto.', 'saluda'],
        ['Mirar a la persona puede ayudar, pero no es obligatorio mantener contacto visual si nos incomoda. Podemos saludar con una sonrisa o palabras.', 'habla'],
        ['Escuchamos su nombre, respetamos su espacio personal y preguntamos antes de tocar o abrazar.', 'piensa'],
        ['La verdadera educación también es ser amable con quienes son diferentes a nosotros.', 'saluda']
      ]
    },
    {
      id:'prepararse-salir', title:'Lista para salir de casa', icon:'☀', group:'higiene', minutes:3,
      steps:[
        ['Antes de salir: ¿estamos cómodos, preparados y tenemos lo necesario para hoy?', 'saluda'],
        ['Revisamos manos, dientes si corresponde, cabello, ropa y zapatos. Una lista pequeña ayuda a recordar sin prisas.', 'piensa'],
        ['Llevamos nuestras cosas y agradecemos a quien nos ayuda. No buscamos ser perfectos, aprendemos a cuidarnos.', 'saluda']
      ]
    }
  ].map(item=>Object.freeze({...item,steps:Object.freeze(item.steps.map(([say,pose])=>Object.freeze({say,pose})))})));
  const byId=Object.freeze(Object.fromEntries(lessons.map(l=>[l.id,l])));
  const get=(id)=>typeof id==='string' ? byId[id]||null : null;
  const step=(id,index)=> {
    const lesson=get(id);
    return lesson && Number.isInteger(index) && index>=0 && index<lesson.steps.length ?
      lesson.steps[index] : null;
  };
  return Object.freeze({lessons,get,step,citations:SOURCES,category:'family-etiquette',
    gradesOrScores:false,judgesAppearance:false,identifiesPeopleFromCamera:false});
})();
window.JanusEtiquetteKit=JanusEtiquetteKit;
