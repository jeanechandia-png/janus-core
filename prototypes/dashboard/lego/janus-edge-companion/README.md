# JanusEdgeCompanion · LEGO 3D (Kendra)

Módulo local/offline para que una criatura viva **en el margen visible de pantalla** y no sólo dentro de una tarjeta. Usa un único renderer WebGL transparente reutilizable. No lleva voz, memoria ni economía propia: consume las piezas existentes `JanusCreatures3D`, `JanusCreatureSlot`, `Companion`, el estado `ST.comp` y `JanusFurWind`.

## Contrato

```js
const E = window.JanusEdgeCompanion;
E.supported();                         // WebGL disponible en principio
E.sync({
  active: true, id: 'lumi', name: 'Estrellita',
  look: { fur: '#fbe7c6', accent: '#c9b6e8', eyes: '#f2a63b', outfit: 'ninguna', accessories: {} },
  style: 'esponjoso', wind: 0.3,
  side: 'left', roam: true,
  onTap: () => cpOnTapCreature(),
  onDock: (side) => {/* guardar lado */},
  onError: () => {/* arte aprobado como fallback */}
});
E.react('saluda', 2.2, 'alegre');
E.state(); E.hide();
```

El componente se monta al final de `document.body` para no quedar recortado por el `overflow` de las tarjetas. La criatura sólo captura eventos dentro de su canvas; puede desplazarse verticalmente por el lateral sin atravesar los formularios del centro. El usuario puede arrastrarla al otro margen, cambiar el margen mediante botón, pausar el paseo y tocar para activar gestos y voz del compañero. La voz existente llama **Kendra**, no «hija» ni «papá».

En el modo «Mi mundo» y durante las lecciones el componente se oculta y reaparece la escena `JanusStage3D`, con sus vehículos, casas, fichas, actividades y recompensas intactas. El arte original `JanusPresence` continúa como opción «Arte» y fallback si no hay GPU.

### Identidad y economía

- **Founder** → Nexo (robot vía `Janus3D` y `JanusCreatureSlot('robot')` cuando haya GLB final). Nunca reemplazar por una criatura de Kendra.
- **Kendra** → Lumi / Bombo / Musgo / Nimbo, cada uno con nombre editable, look y peinado propios.
- **Estrellas** → premios por esfuerzo, con tienda heredada `Companion.kitShop`; nuevos vestidos, chaquetas, sudaderas, capas y calzado no se desbloquean sin estrellas. No hay compras con dinero real.
- **Anatomía** → calzado procedural ajustado a patas, pero para Nimbo se convierte en aros de suspensión bajo la nube. Bombo mantiene piel húmeda y personaliza branquias.
- **Accesibilidad** → teclado Enter/Espacio para saludar, `aria-label`, `prefers-reduced-motion`, opción pausar recorrido; zonas táctiles limitadas para no bloquear el dashboard.

### Calidad verificada y límites

El render de `JanusCreatures3D` es geometría procedural y malla de fibras animadas en GPU; **no es todavía** el GLB esculpido/riggeado hiperrealista 4K de los renders aprobados. El módulo usa GLB aprobado cuando `JanusCreatureSlot` lo tenga; el efecto de viento en GLB requiere su contrato de vértices. Los vestidos y accesorios del catálogo adicional tienen equivalentes de geometría procedural, no modelos VFX definitivos.

Pruebas: `tests/edge-companion.test.cjs`, `tests/presence.test.cjs`, `tests/kendra-identity.test.cjs`, `tests/kendra-fashion.test.cjs`, `tests/fur-wind.test.cjs`. La CI monta, cambia, arrastra, saluda, verifica accesibilidad/persistencia, compra, control de estrellas, sintaxis y construcción offline A/B sin GPU real.

## Próximo trabajo

1. Importar y validar GLB Nexo y GLB finales de las cuatro criaturas con materiales, expresión/morphs, rig, pelo y LOD; ningún JPG sustituye una malla 3D.
2. Medir y revisar WebGL en dispositivos reales iPhone/iPad y escritorio (FPS, memoria GPU, contraste, oclusiones de controles y controles táctiles).
3. Reconciliar el catálogo del prototipo `vendor/companion.js` con el origen TypeScript de `packages/modules/avatar-look`/`star-shop` antes de publicar; esas fuentes no están presentes en la rama base actual.
4. Fusionar las ramas apiladas sólo tras revisar PR, compatibilidad y recursos. No desplegar por inferencia.
