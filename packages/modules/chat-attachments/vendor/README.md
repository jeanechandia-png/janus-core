# Vendored: jsQR 1.4.0 (Apache-2.0)

Decodificador de códigos QR en JavaScript puro, usado como alternativa cuando el navegador no trae `BarcodeDetector` (p. ej. Safari en iPhone).

- Origen: paquete npm `jsqr@1.4.0` (repositorio https://github.com/cozmo/jsQR), `npm pack`, archivo `dist/jsQR.js (renombrado a .cjs para que los empaquetadores lo traten como CommonJS)`.
- SHA-256 de `jsQR.cjs`: `bc40c8a15196236b2314db0856f72ca0b49980cd5413b8c852a7349f5fee0859` (comprobado por `tests/chat-attachments.test.ts`).
- Licencia: Apache-2.0 (`LICENSE-jsQR.txt`). Sin red, sin telemetría: solo recibe píxeles y devuelve texto.
- No se modifica. Para actualizar: sustituir el archivo, actualizar el hash aquí y en la prueba, y revisar la licencia.
- Los códigos de barras 1D (EAN/UPC…) solo se leen con `BarcodeDetector` nativo; en navegadores sin él, no hay lectura de barras 1D (**PENDIENTE**: añadir un decodificador 1D con licencia compatible).
