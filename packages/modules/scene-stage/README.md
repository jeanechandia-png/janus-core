# scene-stage · Escena manipulable y lecciones guiadas

Pieza LEGO reutilizable. La escena son **datos**; el guía la manipula con comandos y quien aprende, con las manos.

## Base pedagógica (HECHO VERIFICADO)
IES/WWC 2021006 (Fuchs et al., 2021), *Assisting Students Struggling with Mathematics: Intervention in the Elementary Grades*: Rec. 1 instrucción sistemática y explícita; Rec. 2 lenguaje matemático; Rec. 3 representaciones concretas conectadas con la notación (evidencia sólida). https://ies.ed.gov/ncee/WWC/Docs/PracticeGuide/WWC2021006-Math-PG.pdf
Pendiente: Rec. 4 (rectas numéricas).

## API
- Escena: `newScene`, `applyCommand(s)`, `validateCommands(raw, {textGuard})`, `userMove`, `userAdjust`, `userExchange`, `builtValue`, `cookieCount`, `checkBuild`.
- Lecciones: `buildLesson(ejercicio, voz, {textGuard})`, `stepsFor(lección, incluirSolución)`.
- `LessonInput = { id, topic, params }` (suma/resta/multiplicación/división/fracciones/problema). Cualquier tutor que dé los números sirve.

## Límites
- No sustituye a un profesional. La revisión de las lecciones por un profesional es **POR CONFIRMAR**.
- Sin Rec. 4 aún (rectas numéricas).
