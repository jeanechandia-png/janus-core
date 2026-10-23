# face-id

Pieza LEGO: identificar **qué miembro del hogar** aparece en una foto (conjunto cerrado), con consentimiento registrado y bóveda cifrada.

- **Comodidad, no autenticación.** `authorizes: false`. Una foto o una pantalla pueden engañarlo; no hay prueba de vida. La autenticación del Founder sigue siendo ADR-007/008 (Face ID de la plataforma, 1:1, con liveness).
- **Menores:** el consentimiento lo otorga un padre/tutor distinto del menor.
- **Datos:** solo la plantilla (centroide) cifrada con AES-256-GCM; nunca fotos ni vectores individuales.
- **Modelo:** reemplazable detrás de `FaceEmbedder`. El sidecar de ejemplo (InsightFace) NO se ha ejecutado aquí; umbrales sin calibrar; licencia de pesos POR CONFIRMAR.
- **Cámara:** el módulo solo analiza fotos que el host le entrega; no activa cámaras ni vigila.
