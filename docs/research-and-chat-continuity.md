# Investigación por capas y continuidad entre chats (2026-10-22)

## Continuidad automática entre chats
`packages/core/src/chat-continuity.ts` amplía el ADR-002. Al abrir un chat nuevo, `autoBootstrapNewChat()`:
1. Toma el chat anterior (o los N anteriores) y ordena sus mensajes cronológicamente.
2. Extrae encargos, decisiones, correcciones vigentes, pendientes, preguntas sin responder y el último mensaje.
3. Los convierte en `ChronologyRecord` y llama a `bootstrapContinuity()` **antes** de planificar.
No hace falta pedirlo; ocurre en cada chat nuevo.

## Investigación avanzada verificada
`packages/orchestrator/src/research-verification.ts` define un trabajo por capas:

| Capa | Rol | Qué hace |
|---|---|---|
| L0 | analyst | Descompone la pregunta en ángulos |
| L1 | researcher (en paralelo) | Busca fuentes y extrae una cita textual por afirmación |
| L2 | verifier | Verificación cruzada: ≥2 dominios independientes, al menos uno de nivel A |
| L3 | verifier aislado de L1 | Auditoría: existencia, cita literal, retractaciones, enlaces caídos |
| L4 | synthesizer | Informe con veredictos VERIFICADO / PROBABLE / POR CONFIRMAR / DESCARTADO |

Niveles de fuente:
- **A:** universidades de prestigio (Stanford, Harvard, MIT, Oxford…), que van primero, y revistas arbitradas o con DOI.
- **A-:** instituciones académicas y organismos oficiales.
- **B:** medios de referencia.
- **C:** blogs, foros y redes sociales.

**Herramientas (norma 6):** para la búsqueda profunda pueden participar Gemini Deep Research y ChatGPT Deep Research como exploradores L1 adicionales. Sus resultados pasan por la misma auditoría L2/L3.
