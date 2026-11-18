# Nodo `ai.agent` ↔ Agent Swarm

Pieza: `packages/orchestrator/src/flow-agent-adapter.ts` (`FlowAgentAdapter`, `routeExecutor`). Estado: **construida y probada con agentes simulados; no hay agentes reales conectados** (un modelo de lenguaje con API es gasto → en reposo, norma 7). Se pasa al motor como `FlowDeps.agent` (`adapter.run`).

## Qué hace
- **Enrutado por capacidades:** elige el agente cuyo rol (capacidades del Agent Swarm: `capabilitiesForRole`) cubre **todas** las `requiredCapabilities`. Si ninguno las cubre, falla indicando cuáles faltan al más cercano; no adivina. Desempate: local primero si `preferLocal`, más `preferredCapabilities` cubiertas, ajuste más estrecho, id (estable; no depende del orden de registro).
- **Local-first:** `requireLocal` excluye todo agente no local, también para el verificador; `preferLocal` solo ordena.
- **Verificación independiente (`auto`):** se exige con riesgo `medium`/`high` o acción irreversible (el motor ya pasa `risk` y `reversible`). La hace un agente de rol `verifier` **distinto** del productor, y solo aprueba un veredicto exactamente `{ ok: true }`; cualquier otro (texto, `"true"`, vacío, error del verificador) es rechazo. Sin verificador independiente, **falla cerrado**: el resultado del productor no se devuelve y lo siguiente del flujo no se ejecuta. Políticas: `never` (opt-out explícito del operador) y `always`.
- **Orden con riesgo alto:** primero la aprobación humana del nodo (el agente ni arranca sin ella), después la verificación independiente.
- **Datos, no instrucciones:** el objetivo lo escribe quien diseña el flujo; la entrada viaja en su propio campo (`input`) y nunca se mezcla con el objetivo ni influye en el enrutado.
- **Traspaso auditable (`onHandoff`):** quién produjo y quién verificó, riesgo, veredicto y motivos, tamaños, duración y huellas SHA-256 de entrada y salida. **Nunca el contenido** de la entrada ni de la salida.
- **Límites:** tiempo máximo por agente (120 s por defecto, con señal de cancelación) y tamaño máximo de salida (1 MB).

## Lo que NO hace todavía (honesto)
- No hay `FlowAgentExecutor` reales (modelo de lenguaje, herramientas locales); el contrato (`AgentTask`) está listo para enchufarlos detrás del Model Gateway.
- Por defecto **no** reintenta ni gasta llamadas extra. Con `maxRefinementRounds` opcional (0–3), puede pedir una corrección al productor tras el rechazo del verificador y volver a verificar con otro agente independiente. No reparte tareas en paralelo entre varios productores; la calidad sigue dependiendo de la verificación real.
- El verificador es tan fiable como el agente que se le ponga: la garantía es **independencia y falla cerrado**, no corrección del contenido.

## Evolución iterativa de comportamiento (17-11-2026)

Patrón propio de JANUS, inspirado solo en capacidades observables publicadas de agentes de larga duración (incluido Claude Fable 5.2); **no** copia pesos, entrenamiento, secretos, instrucciones internas ni implementaciones propietarias.

- `maxRefinementRounds: 0` es el valor predeterminado; sin activación explícita, no hay gastos ni modelos adicionales.
- Al activar `1`–`3`, el productor ejecuta `produce → verify → revise → verify`, limitado a un máximo de 3 correcciones. `revise` recibe `candidate` y `feedback` solo como datos no confiables; nunca permisos.
- El verificador mantiene identidad distinta al productor y se exige para tareas medias, altas o irreversibles.
- Si no hay verificador, falla. Si agota presupuesto de correcciones o falla el último veredicto, no entrega resultado aceptado ni ejecuta los pasos siguientes.
- `AgentHandoff` audita número de rondas, verificaciones y huella de la salida final; nunca almacena el contenido original como auditoría.
- La aprobación humana del motor de flujos sigue precediendo a una tarea de riesgo alto. Las operaciones externas siguen sujetas a sus propios permisos.

**Alcance real:** módulo probado con ejecutores simulados; falta conectar ejecutores de modelos reales, medir latencia/calidad/coste y comprobar tareas prolongadas en runtime físico. No se ha clonado Claude Fable 5.2 a nivel de modelo.
