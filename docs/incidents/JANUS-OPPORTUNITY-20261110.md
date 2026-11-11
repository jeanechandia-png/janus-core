# Incidencia JANUS-OPPORTUNITY-20261110 — detección tardía de una oportunidad tecnológica

**Fecha:** 10 de noviembre de 2026 · **Registrada por:** Claude, por instrucción del propietario · **Estado:** medida implementada, monitor real sin activar.

## Hechos

- HECHO VERIFICADO (declaración del propietario): el 10-nov comunicó la promoción de Claude Fable 5.2 en el plan Pro, con fin anunciado el 16-nov, ya en uso en su cuenta Claude Pro. JANUS no había generado una alerta temprana.
- HECHO VERIFICADO (prensa, 10-nov, que cita la ayuda oficial de Claude): Fable incluido en Pro hasta el 16-nov 23:59 PT (17-nov 08:59 en Países Bajos); hasta el 50 % del límite semanal; un restablecimiento gratuito para cuentas con facturación anterior al 9-nov 10:00 PT; después vuelve a créditos de uso. Fuente: https://www.notebookcheck.net/Claude-Fable-5-2-is-included-with-Pro-until-November-16.1446780.0.html
- POR CONFIRMAR: la página oficial (https://support.claude.com/en/articles/17506494) no pudo leerse desde el entorno de trabajo; por eso la oportunidad queda «por verificar» hasta que el CEO o JANUS la lean.
- POR CONFIRMAR (indicado por el propietario): restablecimiento del cupo el sábado 14-nov hacia las 15:00, hora de Países Bajos. JANUS no tiene acceso a los contadores de la cuenta.

## Causa

POR CONFIRMAR. No se ha identificado un fallo técnico específico. HECHO: en JANUS no existía ningún monitor de oportunidades de proveedores (el único seguimiento periódico era el de redes sociales, `social-watch`).

## Medida correctiva (implementada)

Módulo reutilizable **Opportunity Radar** dentro del producto vigente (sin repositorio ni dashboard nuevos):
`packages/core/src/opportunity-radar.ts`, tablas `radar_*` en SQLite, rutas `/api/radar*` (solo CEO) y pestaña «Radar» en el dashboard.
La incidencia queda además en el registro de lecciones de JANUS (`error_lessons`, id `JANUS-OPPORTUNITY-20261110`).

## Qué funciona y qué no (Protocolo de la Verdad)

| Función | Estado |
|---|---|
| Registro sin duplicados, historial, cambios de condiciones, verificada / por verificar / caducada | Funciona (pruebas) |
| Prioridad por beneficio, urgencia, coste, riesgo y compatibilidad | Funciona (pruebas) |
| Seguimiento detectada → activada → en uso → finalizada | Funciona (pruebas) |
| Cupos declarados, restablecimiento y fases A/B | Funciona; los datos son declarados, no leídos de la cuenta |
| Avisos por oportunidad crítica y por vencimiento (72 h / 24 h) | Calculados y visibles; el envío al teléfono requiere clave de avisos y que el CEO active avisos en su dispositivo. NO verificado contra Apple/Google |
| Monitor automático de fuentes oficiales | **Implementado, APAGADO.** Se activa con `JANUS_RADAR_INTERVAL_MIN`. No verificado contra las páginas reales de Anthropic, OpenAI y Google (el entorno de trabajo no tiene salida a esas webs). Detecta por palabras clave: propone candidatas, no interpreta condiciones |

## Plan de aprovechamiento del caso de referencia

- **Fase A (10–13 nov, hasta el restablecimiento):** gastar el cupo disponible en lo de mayor valor y dejar preparados documentos, archivos y pruebas.
- **Fase B (14–16 nov, tras el restablecimiento):** ejecutar de inmediato implementación, auditorías, correcciones y pruebas de los productos activos.
- Los límites por ventanas cortas siguen aplicando: no hay disponibilidad continua garantizada.

## Para el siguiente agente

1. Encender JANUS en el equipo del CEO y fijar `JANUS_RADAR_INTERVAL_MIN=180`; pulsar «Revisar fuentes ahora» y comprobar qué fuentes responden (ajustar `JANUS_RADAR_SOURCES` si alguna bloquea la lectura).
2. Leer la página oficial y pulsar «He leído la fuente oficial» en la oportunidad de referencia.
3. Anotar el consumo real del cupo (Ajustes → Uso) con `POST /api/radar/quotas`; falta el formulario en pantalla para cupos y para añadir oportunidades a mano (hoy solo por API).
4. Pendiente de diseño: incluir el radar en un resumen semanal y evaluar extracción de fechas/condiciones con un modelo (hoy la criba es por palabras clave).
