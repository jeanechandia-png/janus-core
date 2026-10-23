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
- No reintenta por su cuenta (el reintento es política del nodo, `retry`); no reparte tareas en paralelo entre varios productores; no puntúa calidad más allá del veredicto del verificador.
- El verificador es tan fiable como el agente que se le ponga: la garantía es **independencia y falla cerrado**, no corrección del contenido.
