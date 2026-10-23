# companion · Compañeros de Janus

Pieza LEGO comercial: criaturas originales que acompañan a un niño o niña. Cada niño puede **cambiar de criatura cuando quiera** y **ponerle nombre**.

| Criatura | Planeta | Carácter |
|---|---|---|
| Lumi (zorrita-polilla) | Luna Lucerna | curiosa, traviesa, tierna |
| Bombo (ajolote-nutria) | Marea Coral | payaso, cariñoso, valiente |
| Musgo (piedrita de musgo) | Jardín Verde | tranquilo, sabio, bromista |
| Nimbo (nubecita) | Cielo Aurora | elegante, soñadora, alegre |

Imágenes y clips generados con ElevenLabs (gpt-image-2.5, kling-3-pro). Son diseños originales de InfinitySeed.

## Qué hace
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

## Límites (Protocolo de la Verdad)
- No es terapia ni diagnóstico. Ante señales serias, avisa al adulto.
- Los filtros por palabras clave son una primera capa. **POR CONFIRMAR:** añadir un clasificador del modelo como segunda capa.
- Los textos v0.1 están en español y algunos en femenino; la localización por género e idioma queda pendiente.

## Relación con piezas existentes (norma: no duplicar)
- **janus-school** (PR #40): técnicas de atención, guía para padres y aviso de no diagnóstico. El compañero es la **cara y la voz** que habla con el niño. Las sesiones y la guía para padres salen de janus-school. El tutor de cálculo de este módulo solo genera ejercicios aritméticos rápidos, que janus-school no incluye.
- **speaker-id / face-id** (PR #38 y #40): el reconocimiento real de voz y cara. `enableBiometrics()` solo registra el consentimiento y el modo local. La identificación la hacen esos módulos, siempre como comodidad y nunca como autorización.
- **home-scenes**: el saludo (`greeting`) y las escenas de casa.
