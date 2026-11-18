# Reconciliación de instrucciones de Janus — 18 noviembre 2026

## Corrección vigente — 18 noviembre 2026 · reconciliación documental y código

La revisión anterior conservó IDs, pero no completó su vinculación semántica. La falta de chats íntegros limita la certificación exhaustiva; **no impide implementar lo documentado y accesible**.

Se releen Manifest v0.21, Child Companion v0.3, Daily Life v0.4 y Sensitive Filter v1.0. Los ocho B registrados eran **B25–B32**, no B01–B08. Faltaban B01–B24 y SF01–SF20 individualizados. N01–N32 siguen expresamente vigentes y no están sustituidos por HC. Total conocido: **454 declarados + 32 N + 32 B + 20 SF = 538**. No se modifica retroactivamente la suma histórica de 454.

`config/historical-contracts.json` conserva cada definición, fuente, índice de párrafo, alcance y candidatos de reutilización; fuentes con SHA-256. Los originales privados quedan fuera de Git, en `data/instruction-sources/`. Los candidatos de una familia no prueban el cumplimiento del ID específico.

Se implementan **B26/B27** sobre el radar existente: referencia comparable/vigente, ausencia de ahorro ficticio, neto tras costes conocidos, coste desconocido explícito, condiciones conservadas y nueva verificación al cambiar importes. Persistencia y payload del runtime reutilizados y probados; no acredita discovery de tiendas, comparación de cesta ni aceptación visual.

La auditoría separa inventario documental de implementación. **536 entradas requieren todavía correspondencia individual con código/prueba y/o implementación**; no son 536 funciones demostradas ausentes. Copiar IDs a `reconciledIds` ya no permite cerrar cobertura.

Búsqueda en ambas cuentas Drive, archivos con Janus en el título y recuperación conversacional: sin exportación íntegra identificada de ambos proyectos; hay documentos y extractos. No reconstruir ni declarar completo un historial a partir de resúmenes del asistente. Esta limitación no bloquea completar código.

Validación local: TypeScript PASS; 854 pruebas / 853 PASS / 1 SKIP previo / 0 FAIL; 25/25 dirigidas. El objetivo de dejar únicamente personajes y aceptación física **todavía no se ha alcanzado**. Continuar en el mismo checkout, rama y PR #83, desde el nuevo HEAD; priorizar SF/menores y conectar las capacidades de dominio. Las cifras anteriores de 494 y B01–B08 son historia corregida por este bloque.

## Resultado

**No está acreditado que todas las instrucciones estén implementadas.** Se revisaron las fuentes privadas autorizadas del control central y los documentos de contratos, además del código actual, las políticas y los handoffs del repositorio único. Se leyeron 25 documentos maestros/especificaciones. No se obtuvo una exportación íntegra identificada de todos los chats de `proyecto_Janus` y `proyecto_Janus 2`. No convertir una búsqueda de contexto en garantía de cobertura total.

## Fallos concretos corregidos

1. El lector `latestHandoff` solo reconocía títulos `Handoff YYYY-MM-DD`; ignoraba los bloques recientes `AHORA — día-mes-año`. Podía conducir al siguiente agente a un estado antiguo. Ahora comprende ambos formatos, prioriza el bloque AHORA vigente y conserva historia; hay regresión específica.
2. Los documentos históricos pedían dos voces, pero el runtime solo mapeaba una a ElevenLabs. Se extiende el mismo adaptador para Janus masculino y Melanie femenina con los IDs de cuenta verificados, configuración privada, selección y permisos. La instrucción nueva del Founder sustituye la prioridad femenina/diseño C anteriores, sin borrar sus originales ni reabrir audiciones.
3. El presupuesto de voz estaba solo en memoria. Ahora el runtime reserva consumo compartido de ambas voces en SQLite, atómicamente, sin frases/audio/credenciales. Reiniciar o cambiar perfil no restablece el cupo.
4. El kit de tablet contenía checkout forzado y referencias antiguas. Se conserva la instalación única, se rechazan cambios locales/retrocesos y se compilan las dashboards reales.

## Deuda documental detectada

El manifiesto de contratos declara **454** y su suma publicada usa 15 familias. El cuerpo también contiene `N01–N32` y `B01–B08`. Al conservar todos los identificadores y expandir sus rangos se obtienen **494 IDs distintos**. Eso no autoriza a cambiar el total histórico ni a eliminar los 40 adicionales: hay que determinar si siguen vigentes, fueron sustituidos o son alcance separado. Todos quedan registrados, sin presentarlos como tests ejecutados.

Los contratos se describen como post-gate/PRE-CONTRACT y se refieren al Core Swift histórico. Los tests actuales de TypeScript no constituyen por sí solos una migración de aquellos contratos. Estado documental «cerrado» o un número de tests antiguo tampoco acredita el runtime actual.

## Registro que debe mantener cada agente

`config/instruction-audit.json` conserva 30 grupos conocidos, fuentes lógicas, evidencias, decisiones sustituidas y los 494 identificadores pendientes de reconciliar. Es un inventario inicial trazable, **no una extracción exhaustiva de todos los chats**. La trazabilidad privada de los documentos se mantiene fuera del repositorio público.

```sh
npm run instructions:audit
npm run instructions:audit -- --require-complete
```

El primer comando valida el registro y muestra pendientes. El segundo falla mientras falten fuentes/implementaciones. El validador rechaza políticas sin registro, evidencias inexistentes, desaparición de requisitos/contratos respecto de la revisión anterior y sustituciones sin sucesor. `npm run continuity` muestra este estado para el siguiente agente. Una auditoría válida no significa producto terminado.

## Pendientes que no deben desaparecer

| Área | Estado observado | Evidencia pendiente |
|---|---|---|
| Tablet | Kit, servidor y Chromium real: vinculación, cifrado/reinicio y apertura offline PASS | Android/Termux, arranque, permisos y piloto físico |
| Janus/Melanie | Identidades de cuenta y código preparados | Credencial del host y aceptación acústica real |
| Robots/criaturas | Integradores y referencias presentes | GLB finales y aprobación visual |
| Kendra | Módulos y permisos de servidor | Reconciliar mejoras históricas, dispositivo y voz infantil |
| Trabajo | Proyectos, tareas y accesos; CSS privado aprobado verificado localmente, builds core/team y 26/26 pruebas PASS | Provisionar el activo privado en el host, conexiones reales y equipo |
| Correo/iCloud/calendario | Adaptadores y controles parciales | OAuth/cuentas reales y ramas pendientes |
| Hogar | Planificación y políticas parciales | Inventario, SmartThings/Tuya/Google Home y dispositivos |
| Salud | Especificaciones históricas recuperadas | Trazabilidad, sensores/permisos y funciones reales |
| Actividades/ahorro | Radar del núcleo, conector y políticas | Fuentes/monitor real; no confundir tareas de ChatGPT con Janus local |
| Funciones históricas | Catálogo conservado | Mapeo contrato→implementación→prueba→aceptación |
| Auditoría de ambos proyectos | Fuentes maestras leídas | Historial completo y reconciliación de cada instrucción |

Continuar el mismo producto y la misma PR. No importar una rama visual histórica entera ni restaurar versiones antiguas para recuperar una función aislada. Portar solo la mejora vigente, con pruebas y registro de qué sustituye.
