# JANUS — Reconciliación selectiva de la PR #83 · 20 noviembre 2026

## Única fuente de verdad

Repositorio **único** `jeanechandia-png/janus-core`; base `main` verificada al comenzar: `d4893e9a1a5c93588f95f4b282d68dadae24ca00`. Las PR #81/#82 de Claude, #84/#85 de control factual, #86 de estética aprobada y #87 de 21 vistas/106 acciones están fusionadas en `main`. No se creó otra dashboard, app, destino ni repositorio. La PR #83 permanecía abierta y **con conflictos** (62 commits adelantada y 43 detrás de main, 84 archivos) y **NO** debe fusionarse entera ni sustituir código nuevo de main con sus versiones antiguas.

## Trabajo selectivo sobre la misma base vigente

Rama Git de integración **dentro del repo original**: `chatgpt/janus-canonical-reconciliation-20261120` desde el último `main`. Se leyeron las fuentes originales de PR #83 y se comprobó con GitHub que los archivos compartidos de `apps/runtime/server.ts`, SQLite, adaptador ElevenLabs, PWA principal, `github-adapter` y `flow-agent-adapter` conservaban exactamente el mismo blob del SHA base histórico `9112ad5` en main, por lo cual su traslado NO borra cambios recientes. Se excluyeron deliberadamente las copias antiguas de Obsidiana, Platino, Kendra y Work en PR #83, ya incorporadas/corregidas en #86, y las normas antiguas que podrían eliminar la Norma 11 añadida por PR #84.

**Tramos trasladados desde el código original probado de PR #83:**
- **Continuidad y contratos históricos:** `config/historical-contracts.json` (538 contratos, 454 declarados + 32 N + 32 B + 20 SF), `config/instruction-audit.json`, validador y CLI `npm run instructions:audit`, regresiones de catálogo y continuidad de handoffs `AHORA`. Los documentos maestros privados y sus archivos físicos NO se copian al repositorio público; los SHA y candidatos sirven como trazabilidad documental, NO certificación de funcionalidades. **536 siguen pendientes de acreditación individual** al integrar este archivo.
- **Factualidad y acciones:** `flow-runner.ts` exige citas y fuentes en `ai.research`; una respuesta no acreditada no puede continuar por `onError:continue`, `error_branch` ni reintentos. `run-response.ts` no pronuncia como cierto un resultado marcado `RECHAZADO` o `POR CONFIRMAR`. `flow-agent-adapter.ts` y `github-adapter.ts` reutilizan verificación y política de autoridad existentes; pruebas correspondientes incluidas. Verificación semántica independiente y puerta transversal completa siguen pendientes.
- **Voces Janus/Melanie:** dos perfiles originales, alias públicos y provider voice IDs solo en configuración privada, transporte/cliente PWA y TTS opcional con límite común persistente por proveedor y día en SQLite. **No hay credenciales, audio privado ni activación automática del proveedor en Git**. La selección de voz por sí sola no acredita STT/TTS real en una tablet.
- **3D:** `janus-3d-forge` existente de PR #83, comprobador GLB offline de procedencia/rig/licencia/compatibilidad y staging idempotente de modelos en carpeta privada; pruebas de CLI y contrato. El generador TRELLIS.2 requiere GPU/permisos/activos originales y NO se ha ejecutado ni contratado proveedor. No se importaron ni crearon seis GLB definitivos, ni se cambiaron los robots o pantallas.
- **Tablet:** kit Termux, verificación local, llave privada y copia fuera de Git, bloqueo contra sobrescritura/retroceso y copia de la piel Work desde fuente privada aprobada. Tests de instalación/sintaxis. **Una instalación real no está demostrada**, y ningún agente debe decir que esta etapa está aceptada sin comprobar el hardware.
- **Ahorros B26/B27:** rutina `deal-value` para referencia comparable y vigente, coste neto conocido y rechazo de ahorro ficticio sobre el radar oficial; pruebas propias.

## Prueba, acceso y seguridad

`package.json` conserva los comandos históricos y suma `instructions:audit`, `forge:inspect`, `forge:prepare`, `forge:check`, `tablet:check`, `tablet:test`, `tablet:browser`. CI Core ahora ejecuta auditoría de contratos, TypeScript, sintaxis PWA/sidecar, pruebas y smoke; CI Dashboard A/B se dispara si cambian PWA, runtime, voz o automatizaciones. Ninguna prueba autoriza por sí misma gastar crédito, publicar un repo o acceder a voz infantil.

**Pendiente posterior a este traspaso (no falsear):** comprobar CI exacto de la rama, reparar sus fallos; fusionar solo si pasa y main no avanzó; conciliar el resto de PR #83 selectivamente sin duplicar. Revisar pendientes de seguridad infantil de #79, contratos SF, los 536 mappings, acciones reales con recibo+readback, 3D iconográfico restante, seis GLB de referencia y aceptación visual/acústica física de todas las dashboards. No afirmar producto terminado.

## Protocolo del siguiente agente

1. Consultar **último remoto** `origin/main`, `START_HERE.md`, `docs/STATE.md` y este archivo; no reutilizar SHAs como referencia permanente.
2. Verificar la PR de reconciliación y su último CI, resolver únicamente fallos demostrados en archivos canónicos; no realizar merge mientras falle una prueba obligatoria.
3. Tras integrar, registrar commit de merge y CI de `main`. Confrontar `main` con PR #83 para identificar lo no portado y descartar solo duplicados verificados; NO cerrar ni borrar la PR #83 antes de esa reconciliación.
4. Probar en dispositivos y servicios auténticos con permisos privados del propietario. Sin acceso a dispositivo, dejarlo explícitamente pendiente.
