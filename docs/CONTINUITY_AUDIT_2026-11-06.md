# Auditoría de continuidad multiagente — JANUS — 2026-11-06

**Alcance:** inspección no destructiva del repositorio y metadatos de PR de GitHub. **No constituye auditoría exhaustiva del contenido de las 33 ramas** ni prueba de producción. Actualizar este informe antes de usarlo para decidir una fusión.

## Línea base verificable
- Repositorio canónico: `jeanechandia-png/janus-core` (**público; nunca secretos ni datos infantiles**).
- Rama por defecto: `main`; commit observado: `7ddfe245f15ec53438c2db98dbb7b137420ebcf9` (2026-11-05 18:33 UTC, integración de Infinity Interpreter #62).
- Árbol de `main` observado: **448 entradas**, **nueve archivos `module.json`** y **cero rutas bajo `prototypes/dashboard/`**.
- Auditoría inicial: **32 PR abiertas antes de añadir el cambio de voz #75**; pasan a **33 abiertas** mientras todas permanezcan pendientes. Los recuentos son instantáneas y deben reconsultarse.
- Verificado: el código visual de Kendra y las criaturas está en ramas del **mismo repositorio**; no está incorporado en el árbol principal en el commit observado. Por tanto, no deben tomarse una página HTML o un render de otra rama como prueba de producción.
- Documentos `START_HERE.md` y `docs/PROJECT_MAP.md` tienen antecedentes de octubre: el estado principal puede ser anterior al trabajo reciente en PR. No inferir que su último handoff cubre todas las ramas abiertas.
- **Divergencia documental constatada:** `config/founder-reference-library.json` de la rama base de Kendra #71/#75 tiene **7 registros** (`updatedAt` 2026-10-01), mientras `main` observado tenía **17** (`updatedAt` 2026-10-22). El PR de continuidad añade una política de voz compartida sobre la versión de 17, sin copiar el archivo antiguo. **No sustituir el registro canónico por el de la rama visual.** Antes de fusionar PR de ramas antiguas, comparar el diff real y hacer merge de tres vías verificando que los 17 registros anteriores siguen presentes.


## Ramas que **no** deben fusionarse a ciegas
### Pila visual/infantil
`#43 → #53 → #63 → #67 → #69 → #70 → #71 → #75`
(Obsidiana → compañero 3D → criaturas → arte aprobado → GLB validación → originales privados → safety → **voz compartida**). No necesariamente son todas independientes; las bases de GitHub deben revalidarse antes de fusionar. `#56` depende de `#53` en una rama paralela; `#52` construye módulo complementario desde main. PR `#65` propone selección idioma/accesos desde main, y `#66` cambios relacionados desde otra pila. **Alto riesgo visual/de duplicación si se mezcla todo sin contrastar**.

### Pila de voz y autonomía
`#57 → #58 → #59`; `#60` depende de `#57`. `#61`, `#64` y `#66` parten de la rama de revisión integrada `#59`. `#68` adapta ElevenLabs desde `main` por separado. No confundir una clonación preparada con audio clonado registrado y verificado.

### Ramas paralelas sobre main, revisión separada
`#13`, `#35` (confianza calibrada); `#36` (mando); `#39`, `#50`, `#54` (identidad/consentimiento); `#41` (icono), `#42` (autonomía), `#44` (deal radar), `#51` (estoicismo), `#55` (roles), `#72` (iCloud), `#73` (SmartThings), `#74` (salud familiar). Esta lista documenta pendientes, **no aprobaciones ni funcionalidades live**.

## Error → causa → riesgo → prevención
- **Error observado:** instrucciones y funcionalidades de un mismo producto repartidas entre ramas/PR, con handoffs escritos antes que los últimos cambios; la configuración inicial de las criaturas trataba cuatro voces como requisito, aunque la decisión posterior requiere una sola.
- **Causa operativa probable (inferencia):** el registro cronológico principal no obliga a contrastar ramas abiertas antes de empezar trabajo. Los agentes trabajan en `main` o ramas diferentes sin recuperar toda la pila relevante.
- **Riesgo:** duplicación, falsas afirmaciones de implementación en producción, regresiones visuales y pérdida aparente de trabajo no fusionado.
- **Control implementado en esta rama:** `npm run continuity:guard`; valida remoto canónico, HEAD, rama distinta a main, archivos esenciales, actualización de la rama base elegida y su relación ancestral. Ante falta de red, requiere `--offline` y permite **solo** edición local con bloqueo de publicación. No modifica ni fusiona trabajo ajeno.
- **Límite:** el preflight prueba integridad de la línea base elegida, **no el contenido funcional ni cuál PR debe aceptarse**. Un revisor debe identificar la pila pertinente y ejecutar pruebas de regresión. Para seguridad real, proteger `main` con revisiones/checks obligatorios y autorizaciones; esto no se modifica automáticamente desde este PR.

## Procedimiento cronológico para todos los agentes
1. Confirmar objetivo, instrucciones más recientes, rama base y PR abiertos del área. Leer `START_HERE.md`, `docs/STATE.md`, `docs/handoffs/`, decisiones y evidencias.
2. Ejecutar `npm run continuity` y `npm run continuity:guard -- --base=<rama-padre-verificada>` en rama separada **del repositorio canónico**, no un repositorio/copia aparte. Si no hay red: `--offline`, solo trabajo local hasta revalidación.
3. Analizar diffs y dependencias, preservar interfaces/activos aprobados, realizar pruebas unitarias, CI, E2E y dispositivos cuando aplique; respetar el control de aprobaciones.
4. Documentar cambio, commit, resultados reales, pendientes y próxima acción en handoff; crear PR apilado apuntando a la rama padre, sin merge/despliegue automático. La instrucción más reciente aprobada gobierna; la anterior queda en histórico.

## Decisión de voz pendiente de aceptación auditiva
2026-11-06: **una sola voz caricaturesca para todas las criaturas**. Implementación propuesta en PR #75 sobre #71; conserva frases, gestos y perfiles visuales por criatura. El Web Speech actual es aproximación expresiva de voces de dispositivo, **no demuestra timbre genuinamente no humano**. Requiere validación de muestra de voz específica y Safari/iPhone, sin cambiar la voz de JANUS/Nexo.

## Estado de esta auditoría
- Confirmado: repositorio único identificado; ramas y cadena de PR localizadas; línea base de main contrastada.
- Implementado en rama de control: guard para no editar una copia o HEAD desfasado, tests y punto de entrada para agentes.
- **Pendiente:** verificar CI del guard, revisar PR dependientes, reconciliar el estado de decisiones en main, comprobar versiones publicadas, ejecutar E2E sobre la pila visual completa, obtener aprobación de merge. **Ninguna rama queda automáticamente publicada.**
