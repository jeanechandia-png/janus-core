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

export interface Creature {
  id: string;
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
    id: 'lumi', defaultName: 'Lumi', planet: 'Luna Lucerna, donde los bosques brillan de noche', species: 'zorrita-polilla',
    personality: ['curiosa', 'traviesa', 'tierna'], palette: { primary: '#C9B6E8', glow: '#FFD27A' },
    gestures: ['saludo', 'risa', 'cara-graciosa', 'celebrar', 'pensar'],
    catchphrases: ['¡Mis antenitas brillan cuando aprendes algo nuevo!', '¡Uy, uy, uy! Eso estuvo genial.'],
    voice: { design: 'Criatura animada pequeña, voz aguda, dulce y juguetona, con risitas suaves, habla rápido cuando se emociona, español neutro.', pitch: 'aguda' },
    media: {}
  },
  {
    id: 'bombo', defaultName: 'Bombo', planet: 'Marea Coral, un planeta de océanos tibios', species: 'ajolote-nutria',
    personality: ['payaso', 'cariñoso', 'valiente'], palette: { primary: '#FF9E8A', glow: '#6FF2E0' },
    gestures: ['risa', 'baile', 'cara-graciosa', 'celebrar', 'abrazo'],
    catchphrases: ['¡Burbujas de alegría!', 'Si te caes, rebotas como yo. ¡Boing!'],
    voice: { design: 'Criatura animada redondita, voz aguda y burbujeante, muy expresiva y graciosa, ríe con facilidad, cálida, español neutro.', pitch: 'aguda' },
    media: {}
  },
  {
    id: 'musgo', defaultName: 'Musgo', planet: 'Jardín Verde, donde las piedras florecen', species: 'piedrita de musgo',
    personality: ['tranquilo', 'sabio', 'bromista'], palette: { primary: '#8FBF5A', glow: '#FFE07A' },
    gestures: ['guiño', 'saludo', 'risa', 'pensar', 'abrazo'],
    catchphrases: ['Despacito y con calma, las flores también crecen.', '¡Mi luciérnaga dice que eres increíble!'],
    voice: { design: 'Criatura animada amable, voz media y suave, risueña, pausada y tranquilizadora, con humor tierno, español neutro.', pitch: 'media' },
    media: {}
  },
  {
    id: 'nimbo', defaultName: 'Nimbo', planet: 'Cielo Aurora, un planeta hecho de nubes', species: 'nubecita',
    personality: ['elegante', 'soñadora', 'alegre'], palette: { primary: '#FFD9B8', glow: '#FFF1A8' },
    gestures: ['baile', 'saludo', 'risa', 'celebrar', 'cara-graciosa'],
    catchphrases: ['¡Hoy el cielo tiene tu color favorito!', 'Con elegancia y con alegría, como un arcoíris.'],
    voice: { design: 'Criatura animada esponjosa, voz aguda, suave y musical, elegante y risueña, cariñosa, español neutro.', pitch: 'aguda' },
    media: {}
  }
];

export function getCreature(id: string): Creature {
  const c = CREATURES.find((x) => x.id === id);
  if (!c) throw new Error('Criatura desconocida: ' + id);
  return c;
}
