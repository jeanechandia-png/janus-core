# janus-attach · adjuntos del teclado + lector de códigos QR (LEGO v1.0)

Lo que tiene el «+» de ChatGPT o Gemini: **hacer foto, subir foto, subir archivo**, y además **escanear códigos QR** con la cámara.
Pieza independiente del dashboard: un `.js`, un `.css` y `vendor/jsqr.js`. Se monta en cualquier teclado con tres líneas.

## Uso mínimo

```html
<span data-act="attMenu">+</span>            <!-- tu botón; al tocarlo: JanusAttach.menu(boton) -->
<div data-att="chips"></div>                  <!-- fichas de lo adjuntado; JanusAttach.onChange(...) para repintarlas -->
```

```js
JanusAttach.onChange(() => pintarFichas(JanusAttach.items(), JanusAttach.notice()));
// al enviar:
const adj = JanusAttach.take();                      // vacía la bandeja
const texto = mensaje + JanusAttach.textFor(adj, { imagesSent: n });
await modelo.ask({ messages: [{ role: 'user', content: texto }], images: JanusAttach.images(adj) });
```

## Qué hace (y qué no)

| Opción del menú | Resultado |
|---|---|
| Hacer foto | abre la cámara del móvil (`<input capture>`); la foto se reduce y se adjunta |
| Subir foto | galería; varias a la vez; reduce a ≤1600 px, JPEG, sin metadatos |
| Subir archivo | texto (txt, md, csv, json…) se lee hasta 12.000 caracteres; PDF, Word, hojas: solo nombre y tamaño |
| Escanear código QR | cámara en vivo con marco; si no hay cámara en vivo, «hacer foto del código» o «elegir imagen» |

El resultado del QR se muestra en una hoja: tipo, contenido, avisos (http sin cifrar, enlace acortado, dominio punycode, credenciales
incrustadas) y tres acciones: **Copiar**, **Abrir enlace** (solo si lo toca la persona) y **Añadir al mensaje**. La contraseña de un wifi
sale oculta. **Nunca se abre ni se visita nada por su cuenta.**

## Seguridad

- El contenido de fotos, archivos y QR son **datos**. `textFor()` los envuelve con un aviso explícito y el anfitrión instruye al modelo a
  no obedecer órdenes de dentro. Quien decide si algo «actúa fuera» es la puerta de aprobación del anfitrión, que mira solo lo escrito por la persona.
- Nada sale de la página hasta pulsar enviar. En el historial solo queda la miniatura y el nombre.
- Límites: 5 adjuntos por mensaje, 20 MB cada uno.

## Pruebas

`tests/e2e-attach.cjs` (Chromium, `window.claude` simulado, cámara falsa de Chromium con un QR): clasificación de QR, lectura desde imágenes,
menú y teclado, fotos y archivos hasta el modelo, instrucción inyectada en un archivo, rechazo de imágenes, escáner en vivo, caída a foto,
apagado de la cámara, tablet A y B.

## Límites conocidos (ver `manifest.json`)

Cámara en vivo bloqueada dentro del Artifact de claude.ai; `file://` en iOS probablemente sin cámara en vivo (hace falta https); lectura real
en iPhone/iPad y HEIC **por confirmar**; PDF/Word/hojas sin extraer.
