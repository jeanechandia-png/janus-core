# companion · Compañeros de Janus

Pieza LEGO comercial: criaturas originales que acompañan a un niño o niña. Cada niño puede **cambiar de criatura cuando quiera** y **ponerle nombre**.

| Criatura | Planeta | Carácter |
|---|---|---|
| Lumi (zorrita-polilla) | Luna Lucerna | curiosa, traviesa, tierna |
| Bombo (ajolote-nutria) | Marea Coral | payaso, cariñoso, valiente |
| Musgo (piedrita de musgo) | Jardín Verde | tranquilo, sabio, bromista |
| Nimbo (nubecita) | Cielo Aurora | elegante, soñadora, alegre |

Imágenes y clips generados con ElevenLabs (gpt-image-2.5, kling-3-pro). Son diseños originales de InfinitySeed.

## Qué hace (v0.2)
- **Aspecto propio** (`look.ts`): la niña elige color de pelo y detalles, ojos, ropa y accesorios de un catálogo cerrado. Cada criatura guarda su aspecto. **Vestirla no cambia su carácter**: cada una conserva su movimiento propio, su voz y su forma de enseñar (`Creature.style`).
- **Mundo y tienda** (`world.ts`): estrellas ganadas por esfuerzo (tope diario, sin castigos, sin dinero real), tienda de ropa, accesorios, casa, vehículos y decoración, compra idempotente.
- **Escena compartida** (`scene.ts`): la escena son datos (`SceneState`); la criatura la manipula con comandos y la niña con `userMove`, `userAdjust` y `userExchange`. Los comandos externos pasan por `validateCommands` (lista blanca).
- **Lecciones** (`lesson.ts`): `buildLesson()` convierte un ejercicio en pasos que la criatura muestra con galletas, platos, tartas y fichas de valor posicional, y termina con "tu turno" para que la niña lo construya con sus manos.
- `companionTurn()`: primero la seguridad, después la respuesta del modelo filtrada y, como mucho, una frase de ánimo.
- `pickEncouragement()`: ánimo **sutil y con límite de frecuencia** (por defecto ≤4 por hora y ≥25 min entre frases espontáneas).
- `makeExercise()` / `checkAnswer()` / `adaptLevel()`: matemáticas con pistas graduales.
- `SCENARIOS` / `answerScenario()`: juego del semáforo para leer las señales de otros niños y respetar el "no".
- `checkMessage()`: detecta tristeza, acoso y riesgo, responde con calidez y genera `parentAlert`.
- `stageSize()`: teléfono, mitad de pantalla; tablet, un cuarto ampliable a la mitad.

## Base de evidencia
- Mueller, C. M. & Dweck, C. S. (1998). *Praise for intelligence can undermine children's motivation and performance*. J. Personality and Social Psychology 75(1). Elogiar la inteligencia reduce la persistencia; elogiar el esfuerzo la aumenta. https://www.columbia.edu/cu/psychology/courses/3615/Readings/Mueller_Dweck.pdf
- Golden, N. H., Schneider, M., Wood, C. & AAP Committee on Nutrition (2016). *Preventing Obesity and Eating Disorders in Adolescents*. Pediatrics 138(3). Recomienda no hablar de peso ni de dietas y centrarse en hábitos y en un ambiente de apoyo. https://med.stanford.edu/news/all-news/2016/08/new-guidelines-offer-one-approach-to-prevent-teen-obesity-eating-disorders.html
- Revisión: *Peer functioning in children with AD/HD: current understanding and intervention options*. https://cie.asu.edu/ojs/index.php/cieatasu/article/view/16
- RGPD: la biometría es categoría especial (art. 9). El uso puramente doméstico queda fuera del RGPD (art. 2.2.c), pero un uso comercial exige consentimiento explícito del tutor. Por eso: procesamiento en el dispositivo y `enableBiometrics()` solo con consentimiento.

### Base de las lecciones y de la economía (verificada en esta versión)
- **HECHO VERIFICADO** · Fuchs, L. S. et al. (2021). *Assisting Students Struggling with Mathematics: Intervention in the Elementary Grades* (WWC 2021006, IES). Rec. 1 instrucción sistemática y explícita; Rec. 2 lenguaje matemático; **Rec. 3 representaciones** (evidencia sólida, 28 estudios): objetos concretos y semiconcretos conectados con la notación, y retirada gradual; Rec. 4 rectas numéricas (evidencia sólida). https://ies.ed.gov/ncee/WWC/Docs/PracticeGuide/WWC2021006-Math-PG.pdf
- **HECHO VERIFICADO** · AAP (2019). *Clinical Practice Guideline for the Diagnosis, Evaluation, and Treatment of ADHD in Children and Adolescents*. Pediatrics 144(4):e20192528 (resumen: Wetterer, Am Fam Physician 2020;102(1):58-60, https://www.aafp.org/pubs/afp/issues/2020/0701/p58.html). Recomienda entrenamiento de los padres en manejo de conducta, apoyos escolares (sistemas de puntos, informes diarios) y refuerzo positivo.
- **INFERENCIA** · Que un sistema de estrellas por esfuerzo dentro de una app funcione como los sistemas de puntos de la guía AAP no está demostrado. No se verificó evidencia primaria sobre economías de fichas en apps. **POR CONFIRMAR.**
- **RECOMENDACIÓN** (pendiente de revisión profesional) · Las estrellas premian esfuerzo y aprendizaje, no velocidad ni perfección; tope diario; sin castigos, sin temporizadores y sin dinero real (coherente con Mueller & Dweck 1998: elogiar proceso, no resultado).
- Pendiente de aplicar la Rec. 4 (rectas numéricas) en la escena.
- **POR CONFIRMAR:** revisión de las lecciones y de la economía por un profesional de la educación o de la psicología infantil antes de usarlas con Kendra de forma continuada. Este módulo **no sustituye a un profesional**.

## Límites (Protocolo de la Verdad)
- El render 3D es procedural y estilizado (no fotorrealista); su rendimiento en iPhone/Safari no está medido (ver el handoff).
- No es terapia ni diagnóstico. Ante señales serias, avisa al adulto.
- Los filtros por palabras clave son una primera capa. **POR CONFIRMAR:** añadir un clasificador del modelo como segunda capa.
- Los textos v0.1 están en español y algunos en femenino; la localización por género e idioma queda pendiente.

## Relación con piezas existentes (norma: no duplicar)
- **janus-school** (PR #40): técnicas de atención, guía para padres y aviso de no diagnóstico. El compañero es la **cara y la voz** que habla con el niño. Las sesiones y la guía para padres salen de janus-school. El tutor de cálculo de este módulo solo genera ejercicios aritméticos rápidos, que janus-school no incluye.
- **speaker-id / face-id** (PR #38 y #40): el reconocimiento real de voz y cara. `enableBiometrics()` solo registra el consentimiento y el modo local. La identificación la hacen esos módulos, siempre como comodidad y nunca como autorización.
- **home-scenes**: el saludo (`greeting`) y las escenas de casa.
