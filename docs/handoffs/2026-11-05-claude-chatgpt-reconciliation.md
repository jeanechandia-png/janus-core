# JANUS · Reconciliación de agentes y ramas · 5 noviembre 2026

## VIGENTE: autoridad única / prueba de integridad de fuente

**Repositorio autorizado:** `jeanechandia-png/janus-core`, GitHub. NO se creó otro repositorio, proyecto independiente ni copia sin trazabilidad. `main` es la línea de integración; los PRs con código no fusionado son propuestas, no el producto desplegado.

Al iniciar la auditoría, `main` estaba en `7ddfe245f15ec53438c2db98dbb7b137420ebcf9`, commit **#62 Infinity Interpreter** (5-nov). La rama de voz autónoma (PR #64) partía de `chatgpt/janus-integrated-review-20261104` (PR #59), apilada sobre el código de voz/negocio de Claude y evolución. Faltaba el último commit de `main` y **el Core no pasaba CI**: `tests/voice-studio.test.ts` exigía tipo UUID demasiado restringido y usaba un permiso falso no válido.

## HECHO — reconciliación sin reconstruir

1. Copiados **idénticos, con blob SHA verificado** los 5 archivos nuevos del intérprete desde `main` (adaptador, módulo, README, manifiesto y pruebas); restaurada la entrada de `docs/lego-modules.md`.
2. Insertado en el runtime autenticado `InfinityInterpreterToolAdapter` y `capabilities.register`, preservando `VoiceAuthority`, aprobación biométrica, `BusinessKnowledgeToolAdapter`, `VoiceStudioToolAdapter`, Qwen3 local, ElevenLabs como adaptador y toda la pila de Claude.
3. Corregida CI de `tests/voice-studio.test.ts`: clave de idempotencia declarada como `string`, y mock de autorización con hash SHA-256 de 64 caracteres para atravesar el **mismo Tool Gateway de producción** (no se debilitó la política).
4. Creado commit de reconciliación con **dos padres** `19d91d19445d37d734379b959f3c45ebd9c966f6`, con el tree exacto de la rama revisada y el último `main` como segundo padre. De ese modo, `main` pasa a estar en la ascendencia Git verdadera de PR #64, sin borrar commits de Claude ni volver a aplicar un cherry-pick erróneo.
5. Añadidos `scripts/janus-continuity-gate.mjs` y `tests/janus-continuity-gate.test.mjs`. La CI descarga el `origin/main` **actual** y exige `git merge-base --is-ancestor origin/main HEAD` además de los marcadores de capacidades, que fallan cerrado cuando algo desaparece. Comandos: `npm run continuity:test` y `npm run continuity:gate -- --require-main-ancestor`.

**Verificado:** GitHub Compare `main...chatgpt/janus-voice-autonomy-20261105` pasó a `ahead` (sin commits pendientes de `main`); los cinco blobs importados son idénticos a `main`, sin reescritura. CI actual exige TypeScript, continuidad, pruebas completas y smoke. La suite verde **no** implica voz clonada/biometría probadas en hardware.

## PRs aisladas / no confundir con código de producción

| Superficie | PR / rama | Integración | Estado |
|---|---|---|---|
| **Core, órdenes vocales, Studio de voces + intérprete contextual** | #64 `chatgpt/janus-voice-autonomy-20261105` | base apilada sobre #59; `main` incorporado como ancestro | **En revisión, NO fusionada** |
| **Nexo masculino/femenino, Kendra 3D, moda y voces caricaturescas** | #63 `chatgpt/janus-presencia-criaturas-cinematica-20261105` | base `claude/companion-escena-3d` (#53), divergencia grande frente a `main` | **En revisión, NO fusionada** |
| **Claude: voz ElevenLabs, negocio por voz, adjuntos, dashboard Kendra** | #57 `claude/elevenlabs-voice-provider` | apilada sobre `main` antiguo | **En revisión, NO fusionada** |
| **Evolución antiobsolescencia** | #58 sobre #57 | base de #59 | **En revisión** |
| **A/B integrados con Core y voz autenticada** | #59 sobre #58 | base de #64 | **En revisión** |
| **Clonación independiente/pendiente** | #60 sobre #57 | línea paralela, evitar duplicación | **En revisión** |
| **FINOPS del proveedor** | #61 sobre #59 | línea paralela | **En revisión** |
| **Infinity Interpreter, utilizable también desde Connect** | #62 en `main` | **YA FUSIONADA**; portada a #64 de manera idempotente | **VIGENTE** |

**Advertencia operativa:** la existencia de código en #63 no significa que esos GLB hiperrealistas estén producidos, ni que Kendra esté integrada en la rama de Core #64. Tampoco se debe desplazar `main` para forzar un merge masivo de 152 commits de una rama de dashboard que comparte mucha historia antigua. La compatibilidad de rama, contratos y pruebas debe revisarse antes de integrar.

## ERRORES → reglas preventivas

- **Error:** desarrollo simultáneo genera ramas divergentes e instrucciones recientes ausentes en una rama de función. **Causa:** PRs apiladas con bases de distinta fecha. **Riesgo:** código reciente de Claude o la traducción reutilizable desaparecen por overwrite o merge ciego. **Regla:** antes de editar, `git fetch origin`, capturar SHA de `main`/PRs, revisar `merge-base`, portear SOLO diferencias faltantes y dejar informe reproducible.
- **Error:** la CI de Voice Studio fallaba aunque el adapter estuviera implementado. **Causa:** pruebas no respetaban el tipo inferido y el requisito criptográfico del Tool Gateway. **Regla:** la autenticación de los tests siempre atraviesa las políticas reales; nunca se relaja la seguridad para aprobar pruebas.
- **Error:** se confunde éxito de test con producto terminado. **Regla:** distinguir `Core continuity OK` de `productReleaseVerified`. El release sigue bloqueado por los PRs visuales y pruebas físicas.

## AHORA / HECHO / PENDIENTE / BLOQUEADO / PRÓXIMO

- **AHORA:** proteger la continuidad de la rama de voz frente a `main` y al trabajo concurrente.
- **HECHO:** último intérprete de `main` recuperado; modificaciones de Claude y capas de identidad protegidas; CI y prueba de continuidad añadidas; no se modificó `main`.
- **PENDIENTE:** reconciliar el PR #63 visual con los nuevos contratos del Core por archivo; adaptar las operaciones de imágenes del dashboard al Tool Gateway con aprobación explícita; especialización dinámica con fuentes verificables y memoria vigente.
- **BLOQUEADO:** clon real o modelo VFX sin hardware/audio/archivos autorizados; no declarar activación por tener una configuración Qwen o ElevenLabs.
- **PRÓXIMO:** CI de integración completa sobre candidato de release, revisión manual de diffs sensibles, merge aprobado, smoke en equipo local/iPhone, checksum final y nuevo handoff con rutas reales.

**Principio:** Janus puede perder proveedores o ramas temporales, pero no el conocimiento ni las reglas operativas acumuladas.
