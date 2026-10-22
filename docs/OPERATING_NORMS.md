# Normas operativas · Infinity Seed 6

Fuente: hoja manuscrita de Jean Echandía, 22-10-2026. Vigentes para todo agente (humano o IA) que trabaje en Janus o en cualquier proyecto de InfinitySeed.

1. **Filtros → preview → aprobación → ZIP.** Antes de dar por terminada una tarea se aplican filtros: estructural, arquitectónico, ortográfico, de síntesis y de coherencia visual y estructural. Después se genera un **preview** para que Jean lo apruebe. Solo tras su aprobación, y como último paso, se genera el **ZIP**. *(Corrección de Jean, 22-10-2026.)*
2. **Evitar la saturación visual.**
3. **Prohibido empezar desde cero.** Siempre se aprovechan los recursos, activos y módulos propios. Solo ante la ausencia de uno de ellos se diseña y ejecuta un nuevo "elemento".
4. **Todo activo debe ser reutilizable y monetizable** (regla LEGO: `packages/modules/*`, `prototypes/dashboard/lego/*`).
5. **Desarrollo centralizado.** Sin crear repositorios nuevos. Todo agente nuevo debe poder acceder de forma sencilla y continuar desde el mismo punto donde lo dejó el anterior (`START_HERE.md`, `docs/STATE.md`, `HANDOFF.md`).
6. **Herramientas de pago disponibles.** Todo agente debe tener presentes ChatGPT, Gemini, Claude y Google Workspace (de pago) para el desarrollo y la ejecución. Si otra herramienta rinde mejor en una tarea, el agente **lo dice explícitamente** y propone usarla o combinarla, para que Jean elija.

## Complementos ya vigentes
- Protocolo de la Verdad: HECHO VERIFICADO / INFERENCIA / RECOMENDACIÓN / POR CONFIRMAR, con fuentes.
- Preview siempre al terminar cada actividad (capturas tablet y teléfono + HTML).
- Repositorio **público**: datos personales y secretos solo en `prototypes/dashboard/local/` (gitignored) o en el backend privado.
- Continuidad cronológica: ver `docs/ADR-002-chronological-continuity-quality-gates.md`.
