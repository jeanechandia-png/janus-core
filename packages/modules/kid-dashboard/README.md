# kid-dashboard · Dashboard de Kendra (menor)

Pieza LEGO: acceso independiente y seguro para una niña, con su propio chat, agenda, tareas, intereses y control del hogar, y visibilidad para su tutor mientras sea menor. **Lógica pura**; el anfitrión (`apps/runtime`) guarda, empareja dispositivos, ejecuta y llama al modelo.

Ver la guía completa y los límites honestos en [`docs/kid-dashboard.md`](../../../docs/kid-dashboard.md).

| Archivo | Qué hace |
|---|---|
| `pin.ts` | PIN parental (4–8 dígitos) con scrypt y bloqueo progresivo |
| `profile.ts` | Lo que ella personaliza: nombre, icono, tema, criatura |
| `safety.ts` | Filtro de entrada/salida (es/en/nl), avisos al tutor, instrucciones de sistema infantiles |
| `limits.ts` | Horario, tope diario y por actividad, aviso previo, resumen de actividad |
| `media.ts` | YouTube solo aprobado, Netflix perfil infantil, tele; peticiones al tutor |
| `home.ts` | «apaga la luz de la sala»: interpretación y planificación con política del tutor |
| `agenda.ts` | Citas, turnos, cumpleaños; recordatorios; fechas dichas en voz |
| `school.ts` | Tareas y proyectos del cole |
| `feed.ts` | Intereses y novedades/ofertas/planes **solo si el tutor aprueba** |
| `outfit.ts` | Qué ponerse y cuándo salir según la previsión por horas |
| `state.ts` | Estado serializable con topes |
