/* catalog.js · catálogo de accesorios y ropa: id, hueco, nombre, precio en estrellas, rareza y colores por defecto. El precio es solo una propuesta (la economía la fija star-shop). */
import * as head from './items/head.js';
import * as head2 from './items/head2.js';
import * as neck from './items/neck.js';
import * as back from './items/back.js';
import * as feet from './items/feet.js';
import * as hands from './items/hands.js';
import * as fx from './items/fx.js';
import { GARMENTS } from './items/torso.js';

export const SLOTS = [
  { id: 'torso', name: 'Ropa', ico: '👕' }, { id: 'cabeza', name: 'Cabeza', ico: '🧢' }, { id: 'cara', name: 'Gafas', ico: '🕶' }, { id: 'oidos', name: 'Auriculares', ico: '🎧' }, { id: 'cuello', name: 'Cuello', ico: '📿' },
  { id: 'espalda', name: 'Espalda', ico: '🎒' }, { id: 'cintura', name: 'Cintura', ico: '👜' }, { id: 'pies', name: 'Calzado', ico: '👟' }, { id: 'mano', name: 'Mano', ico: '⌚' }, { id: 'aura', name: 'Aura', ico: '✨' }
];
export const TIERS = { basico: { name: 'Básico', c: '#B8B2A5' }, comun: { name: 'Común', c: '#7FD08A' }, raro: { name: 'Raro', c: '#6BB4FF' }, epico: { name: 'Épico', c: '#C58BFF' }, legendario: { name: 'Legendario', c: '#FFC94D' } };
const tier = (st) => (st <= 15 ? 'basico' : st <= 35 ? 'comun' : st <= 80 ? 'raro' : st <= 150 ? 'epico' : 'legendario');
const I = (id, slot, name, stars, col, build, extra) => Object.assign({ id, slot, name, stars, tier: tier(stars), col, build }, extra || {});
const G = (id, name, stars, col) => Object.assign(I(id, 'torso', name, stars, col, null), { garment: GARMENTS[id] });

export const CATALOG = [
  // ---- ropa (se ajusta al cuerpo de cada criatura) ----
  G('tiedye', 'Camiseta tie-dye', 20, ['#ff4fa3', '#33d6ff']), G('hoodie', 'Sudadera oversize', 30, ['#2b2f3a', '#f0c24a']), G('futbol', 'Camiseta de fútbol retro', 35, ['#e63946', '#ffffff']),
  G('chandal', 'Chándal de franjas', 40, ['#2457c5', '#ffd23f']), G('jersey', 'Jersey nórdico de punto', 40, ['#a32f3a', '#f3ead3']), G('peto', 'Peto vaquero', 45, ['#3b5f9a', '#d9a441']),
  G('bomber', 'Bomber satinada', 55, ['#1f6f5c', '#ff8a3d']), G('vestido', 'Vestido de volantes', 65, ['#e84a9a', '#ffd1ea']), G('varsity', 'Chaqueta varsity', 70, ['#1d3f8f', '#e8c15a']),
  G('techwear', 'Chaleco techwear', 90, ['#25272d', '#39e5ff']), G('puffer', 'Plumífero holográfico', 110, ['#7a6bff', '#ff7ad9']), G('cuero', 'Chaqueta de cuero motera', 120, ['#17161b', '#c0c4cc']),
  // ---- cabeza ----
  I('gorra', 'cabeza', 'Gorra snapback', 10, ['#e63946', '#ffffff'], head.gorra), I('lazo', 'cabeza', 'Lazo de seda XL', 15, ['#ff5fa8', '#ffe0f0'], head.lazo), I('clipsMariposa', 'cabeza', 'Clips de mariposa', 18, ['#ff7ac8', '#7ad7ff'], head2.clipsMariposa),
  I('gorro', 'cabeza', 'Beanie con pompón', 12, ['#7b5cd6', '#ffd36a'], head.gorro), I('bucket', 'cabeza', 'Bucket hat', 22, ['#35a39b', '#fff3d6'], head2.bucket), I('orejasGato', 'cabeza', 'Diadema orejas de gato', 28, ['#2a2230', '#ff9db8'], head.orejasGato),
  I('flores', 'cabeza', 'Corona de flores', 35, ['#ff7aa8', '#ffd34d'], head.flores), I('vaquero', 'cabeza', 'Sombrero vaquero', 45, ['#a8743a', '#2a1a10'], head.vaquero), I('copa', 'cabeza', 'Sombrero de copa', 60, ['#14121a', '#c8102e'], head.copa),
  I('corona', 'cabeza', 'Corona real', 150, ['#ffc94d', '#e0113a'], head.corona), I('halo', 'cabeza', 'Halo dorado', 220, ['#ffd36a', '#ffffff'], head.halo),
  // ---- gafas ----
  I('gafasPixel', 'cara', 'Gafas pixel', 20, ['#0a0a10', '#39ff9a'], head.gafasPixel), I('gafasRedondas', 'cara', 'Gafas redondas', 25, ['#ffd36a', '#cfe8ff'], head.gafasRedondas), I('gafasEstrella', 'cara', 'Gafas de estrella', 30, ['#ff5fa8', '#ff9ad0'], head.gafasEstrella),
  I('gafasDeporte', 'cara', 'Gafas deportivas', 35, ['#ff7a29', '#15151c'], head.gafasDeporte), I('gafasAviador', 'cara', 'Aviador espejo', 40, ['#6aa7ff', '#ffc94d'], head.gafasAviador), I('antifaz', 'cara', 'Antifaz de gala', 45, ['#2a1a4a', '#ffc94d'], head.antifaz), I('visorVR', 'cara', 'Visor de realidad virtual', 120, ['#39e5ff', '#f2f2f6'], head.visorVR),
  // ---- auriculares ----
  I('auricEstudio', 'oidos', 'Auriculares de estudio', 55, ['#e8d5b0', '#ffc94d'], head.auricEstudio), I('auricGamer', 'oidos', 'Auriculares gamer RGB', 90, ['#14141c', '#39e5ff'], head.auricGamer),
  // ---- cuello ----
  I('bandana', 'cuello', 'Bandana estampada', 12, ['#d6283a', '#ffffff'], neck.bandana), I('bufanda', 'cuello', 'Bufanda de rayas', 14, ['#e8453c', '#fbe8c8'], neck.bufanda), I('pajarita', 'cuello', 'Pajarita de seda', 18, ['#c8102e', '#ffc94d'], neck.pajarita),
  I('perlas', 'cuello', 'Collar de perlas', 60, ['#fff4e6', '#ffd6e8'], neck.perlas), I('medalla', 'cuello', 'Medalla de campeona', 70, ['#c8102e', '#ffc94d'], neck.medalla), I('cadenaOro', 'cuello', 'Cadena de oro', 85, ['#ffc94d', '#e0113a'], neck.cadenaOro), I('amuleto', 'cuello', 'Amuleto de cristal', 130, ['#7ad7ff', '#ffc94d'], neck.amuleto),
  // ---- cintura ----
  I('rinonera', 'cintura', 'Riñonera urbana', 25, ['#ff5d3a', '#1b1c21'], back.rinonera), I('cinturonOro', 'cintura', 'Cinturón de gala', 75, ['#15110e', '#e0113a'], back.cinturonOro),
  // ---- espalda ----
  I('mochilaTech', 'espalda', 'Mochila urbana', 30, ['#2b6cff', '#ff8a3d'], back.mochilaTech), I('skate', 'espalda', 'Monopatín', 50, ['#ff4fa3', '#39e5ff'], back.skate), I('guitarra', 'espalda', 'Guitarra eléctrica', 85, ['#c8102e', '#ffb86b'], back.guitarra),
  I('alasHada', 'espalda', 'Alas de hada', 130, ['#c9b6ff', '#ffe6a8'], back.alasHada, { hides: ['wings'] }), I('alasAngel', 'espalda', 'Alas de ángel', 160, ['#ffffff', '#ffe6a8'], back.alasAngel, { hides: ['wings'] }), I('alasDragon', 'espalda', 'Alas de dragón', 190, ['#d4263d', '#2a0a14'], back.alasDragon, { hides: ['wings'] }), I('mochilaCohete', 'espalda', 'Mochila cohete', 240, ['#ff3d3d', '#e9edf2'], back.mochilaCohete),
  // ---- calzado ----
  I('zapatillas', 'pies', 'Zapatillas chunky', 35, ['#ff4f6d', '#ffd23f'], feet.zapatillas), I('botas', 'pies', 'Botas militares', 50, ['#2b211c', '#ffc94d'], feet.botas), I('zapatillasLED', 'pies', 'Zapatillas LED', 80, ['#1c1e26', '#39e5ff'], feet.zapatillasLED),
  // ---- mano ----
  I('movil', 'mano', 'Móvil', 25, ['#1d1f26', '#39e5ff'], hands.movil), I('reloj', 'mano', 'Reloj inteligente', 40, ['#ff6ea8', '#7dffb0'], hands.reloj, { thumbYaw: -1.2 }), I('mando', 'mano', 'Mando de consola', 55, ['#3ddc84', '#ff5d73'], hands.mando), I('varita', 'mano', 'Varita mágica', 70, ['#c58bff', '#ffd36a'], hands.varita),
  // ---- auras ----
  I('auraBurbujas', 'aura', 'Aura de burbujas', 110, ['#9be7ff', '#ffffff'], fx.auraBurbujas), I('auraEstrellas', 'aura', 'Aura de estrellas', 140, ['#ffd36a', '#ffffff'], fx.auraEstrellas), I('auraLlamas', 'aura', 'Aura de llamas', 200, ['#ff7a29', '#ffd23f'], fx.auraLlamas)
];
export const BY_ID = Object.fromEntries(CATALOG.map((c) => [c.id, c]));
