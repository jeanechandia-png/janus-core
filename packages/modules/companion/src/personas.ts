/** Criaturas compañeras: catálogo original de InfinitySeed (no derivado de personajes de terceros). */
export interface CreatureMedia {
  /** Imagen fija principal (pose de saludo). El host decide la URL (asset local, CDN propio…). */
  still?: string;
  /** Clip en bucle: saludo, caras, risa. */
  idle?: string;
  /** Clip opcional mientras habla (lip-sync). */
  talk?: string;
}

export interface CreatureVoice {
  /** Referencia al proveedor de voz, p. ej. "elevenlabs:<voice_id>". Nunca una clave. */
  voiceRef?: string;
  /** Descripción para diseñar la voz si aún no existe. */
  design: string;
  pitch: 'aguda' | 'media';
}

/**
 * Identidad de la criatura: cómo se mueve y cómo enseña. NO cambia al personalizar el aspecto
 * (pelo, ojos, ropa, accesorios, casa, vehículos): vestirla es de la niña, su carácter es de la criatura.
 */
export interface CreatureStyle {
  /** Movimiento característico cuando está contenta o explica. */
  signature: 'revolotea' | 'rebota' | 'guiña' | 'flota';
  energy: 'baja' | 'media' | 'alta';
  /** Forma de enseñar (identidad pedagógica). */
  teaching: string;
  openers: string[];
  closers: string[];
}

/** Colores del diseño original de la criatura (ids de la paleta del módulo avatar-look; aquí son solo texto). */
export interface CreatureLookBase { fur: string; accent: string; eyes: string }

export interface Creature {
  id: string;
  /** Carácter propio y fijo. */
  style: CreatureStyle;
  /** Aspecto de fábrica: lo que ve la niña antes de personalizar. */
  look: CreatureLookBase;
  /** Nombre por defecto; el niño puede ponerle otro (ver CompanionProfile.names). */
  defaultName: string;
  planet: string;
  species: string;
  personality: string[];
  palette: { primary: string; glow: string };
  /** Gestos que la UI anima (clases CSS o clips). */
  gestures: Array<'saludo' | 'risa' | 'guiño' | 'baile' | 'cara-graciosa' | 'pensar' | 'celebrar' | 'abrazo'>;
  catchphrases: string[];
  voice: CreatureVoice;
  media: CreatureMedia;
}

export const CREATURES: Creature[] = [
  {
    id: 'lumi', look: { fur: 'crema', accent: 'lila', eyes: 'ambar' }, defaultName: 'Lumi', planet: 'Luna Lucerna, donde los bosques brillan de noche', species: 'zorrita-polilla',
    personality: ['curiosa', 'traviesa', 'tierna'], palette: { primary: '#C9B6E8', glow: '#FFD27A' },
    gestures: ['saludo', 'risa', 'cara-graciosa', 'celebrar', 'pensar'],
    catchphrases: ['¡Mis antenitas brillan cuando aprendes algo nuevo!', '¡Uy, uy, uy! Eso estuvo genial.'],
    style: { signature: 'revolotea', energy: 'media', teaching: 'Explora con preguntas: ¿qué crees que va a pasar?',
      openers: ['¡Mis antenitas dicen que vamos a descubrir algo! Mira conmigo.', '¡Vamos a investigar esto en equipo! ¿Qué crees que va a pasar?'],
      closers: ['¡Mis antenitas brillan! Mira todo lo que descubriste.', '¡Uy, uy, uy! Investigamos y lo logramos.'] },
    voice: { design: 'Criatura animada pequeña, voz aguda, dulce y juguetona, con risitas suaves, habla rápido cuando se emociona, español neutro.', pitch: 'aguda' },
    media: {}
  },
  {
    id: 'bombo', look: { fur: 'coral', accent: 'menta', eyes: 'chocolate' }, defaultName: 'Bombo', planet: 'Marea Coral, un planeta de océanos tibios', species: 'ajolote-nutria',
    personality: ['payaso', 'cariñoso', 'valiente'], palette: { primary: '#FF9E8A', glow: '#6FF2E0' },
    gestures: ['risa', 'baile', 'cara-graciosa', 'celebrar', 'abrazo'],
    catchphrases: ['¡Burbujas de alegría!', 'Si te caes, rebotas como yo. ¡Boing!'],
    style: { signature: 'rebota', energy: 'alta', teaching: 'Con humor y ritmo: convierte cada paso en un juego.',
      openers: ['¡Burbujas de alegría! Vamos a jugar con los números.', '¡Boing! Aquí viene una aventura de mates. ¿Lista o listo?'],
      closers: ['¡Boing, boing! Lo hicimos en equipo.', '¡Burbujas de alegría! Qué buen trabajo.'] },
    voice: { design: 'Criatura animada redondita, voz aguda y burbujeante, muy expresiva y graciosa, ríe con facilidad, cálida, español neutro.', pitch: 'aguda' },
    media: {}
  },
  {
    id: 'musgo', look: { fur: 'verde', accent: 'piedra', eyes: 'ambar' }, defaultName: 'Musgo', planet: 'Jardín Verde, donde las piedras florecen', species: 'piedrita de musgo',
    personality: ['tranquilo', 'sabio', 'bromista'], palette: { primary: '#8FBF5A', glow: '#FFE07A' },
    gestures: ['guiño', 'saludo', 'risa', 'pensar', 'abrazo'],
    catchphrases: ['Despacito y con calma, las flores también crecen.', '¡Mi luciérnaga dice que eres increíble!'],
    style: { signature: 'guiña', energy: 'baja', teaching: 'Con calma y paciencia: un paso cada vez, sin prisa.',
      openers: ['Despacito y con calma. Mira esto conmigo.', 'Sin prisa, que las flores también crecen. Mira.'],
      closers: ['Despacito se llega lejos. ¡Bien hecho!', 'Mi luciérnaga y yo estamos muy contentos contigo.'] },
    voice: { design: 'Criatura animada amable, voz media y suave, risueña, pausada y tranquilizadora, con humor tierno, español neutro.', pitch: 'media' },
    media: {}
  },
  {
    id: 'nimbo', look: { fur: 'crema', accent: 'dorado', eyes: 'azul' }, defaultName: 'Nimbo', planet: 'Cielo Aurora, un planeta hecho de nubes', species: 'nubecita',
    personality: ['elegante', 'soñadora', 'alegre'], palette: { primary: '#FFD9B8', glow: '#FFF1A8' },
    gestures: ['baile', 'saludo', 'risa', 'celebrar', 'cara-graciosa'],
    catchphrases: ['¡Hoy el cielo tiene tu color favorito!', 'Con elegancia y con alegría, como un arcoíris.'],
    style: { signature: 'flota', energy: 'media', teaching: 'Con imaginación: usa imágenes y cuentos para entender.',
      openers: ['Imagina que los números son nubecitas. Mira.', '¡Hoy el cielo trae una aventura de números!'],
      closers: ['Con elegancia y alegría: ¡lo lograste!', 'Brillaste como un arcoíris. ¡Qué bien!'] },
    voice: { design: 'Criatura animada esponjosa, voz aguda, suave y musical, elegante y risueña, cariñosa, español neutro.', pitch: 'aguda' },
    media: {}
  }
];

export function getCreature(id: string): Creature {
  const c = CREATURES.find((x) => x.id === id);
  if (!c) throw new Error('Criatura desconocida: ' + id);
  return c;
}
