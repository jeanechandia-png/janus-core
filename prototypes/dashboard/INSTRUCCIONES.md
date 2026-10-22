# Instrucciones de Jean → estado (auditoría 22-10-2026, 20:30)

Fuentes revisadas:
- Este chat.
- Chats anteriores «proyecto_janus» (14-10) y «Janus integration with Supabase» (18 al 21-10).
- Memoria del proyecto.
- PRs abiertos #13 y #35 a #45.

Leyenda: ✅ hecho y verificado · 🟡 parcial · ⏳ pendiente · 🔒 bloqueado (motivo).

## Dashboard (tablet/escritorio y teléfono)
| Instrucción | Estado | Dónde / prueba |
|---|---|---|
| Una sola vista con todo el día, personal y empresa separados; Kendra con su bloque | ✅ | `src/dash.js`, `tests/layout.cjs` (7 tamaños) |
| Premium 4K, oro que parezca oro, JANUS en mayúsculas 3D | ✅ | Renders three.js en `lego/janus-gold/assets/pulido` |
| **Iconos de objeto 3D hiperrealista** que se iluminan al tocar y se animan | ✅ | `lego/janus-gold/assets/obj` (24); `iconize` usa la clase `ji3` |
| Botones de acción en oro que se iluminan | ✅ | `janus-gold.css` (`jg-cta`) |
| Líneas divisorias marcadas | ✅ | `premium.css` |
| Tablet: una pantalla sin scroll | ✅ | `tests/layout.cjs` |
| Teléfono A2 (cristal + oro pulido); clima de hoy y mañana; 15 días al tocar | ✅ | `src/phonea2.js`, `src/weather.js` |
| Teléfono: lo importante arriba (micrófono + chat, luego Proyectos) | ✅ | `renderPhoneA2` |
| **Micrófono tipo Melanie protagonista con chat en el dashboard** | ✅ | Teléfono: tarjeta Sala; tablet: tarjeta Proyectos |
| Sala de trabajo: voz, texto, proyectos, medallón y Mini-Jano articulado | ✅ | `src/sala.js`, `lego/janus-activity` |
| Dos dashboards: A Obsidiana **y B Platino** | ⏳ | Solo existe la referencia estática de B |
| Las mejoras LEGO se propagan a landings y web | 🟡 | Las piezas son reutilizables; falta la sincronización con las landings |
| Preview siempre tras cada actividad; opciones antes de construir | ✅ | Norma aplicada en cada entrega |

## Asistente / secretario
| Instrucción | Estado | Dónde / prueba |
|---|---|---|
| Saludar al abrir ("Hola, Jean. ¿Qué tal tu día?" / "Buenos días") y resumir agenda, clima, Kendra, citas y pendientes | ✅ | Voz del navegador por ahora. `src/briefing.js` |
| Saludo al **llegar a casa** y encendido de luces | 🟡 | Lógica en `home-scenes`. Falta el equipo encendido en casa y el Atajo de iOS |
| Luces LSC Smart Connect (Action), Navidad, calefacción | 🟡 | Escenas y órdenes por voz hechas (`home-scenes`, `src/casa.js`). Falta conectar la cuenta Tuya/Smart Life |
| Reconocer voz y rostro (Jean y Kendra) | 🟡 | Módulos `speaker-id` y `face-id` (#38, #40). Faltan las muestras reales |
| Leer el chat anterior automáticamente | ✅ | `core/chat-continuity.ts` (#45). Falta conectarlo al runtime |
| Investigación con subagentes, fuentes prioritarias y auditoría | ✅ | `orchestrator/research-verification.ts` (#45). Falta conectarlo al runtime |
| Vocabulario rico y conversación fluida | 🟡 | Política `language-style` (#40) |

## Kendra
| Instrucción | Estado | Dónde / prueba |
|---|---|---|
| Criaturas originales para elegir y renombrar; graciosas y animadas | ✅ | 4 criaturas; 3 clips |
| Voz propia de cada criatura | 🔒 | Sin créditos en ElevenLabs. Alternativa: ChatGPT |
| Clip de Nimbo | 🔒 | Sin créditos en ElevenLabs. Alternativa: Gemini Veo |
| Ánimo sutil, dulzura, matemáticas, TDAH y amigos, nunca hablar de peso, avisar a papá | ✅ | `companion` (#45) + `janus-school` (#40) |

## Productividad
| Instrucción | Estado | Dónde / prueba |
|---|---|---|
| Radar de ofertas (cesta, marcas, plataformas, vacaciones escolares) | ✅ | #44. Fuentes reales POR CONFIRMAR |
| Correo con varias cuentas por proveedor | ✅ | La interfaz está hecha (#44). Falta la conexión IMAP real con tu contraseña de app |
| iPhone, iCloud y archivos de Apple | ⏳ | Endpoint de Atajos en el core |
| App instalable | 🔒 | La PWA está lista (rama `gh-pages`). Falta activar GitHub Pages; Vercel MCP da 403 |
| Meta: reels con gráficas | 🟡 | PR #36 (otro agente) |
| Control de Hostinger, Supabase, Vercel y n8n | 🟡 | PR #37, pendiente de tu autorización para fusionar |
| Séneca y Marco Aurelio | ✅ | PR #38 |

## Normas
- Normas operativas IS6 → `docs/operating-norms.md` (#45). El orden es filtros, preview, aprobación y ZIP.
- No empezar de cero → corregido hoy: las normas duplicadas quedaron dentro del documento existente y el compañero reutiliza janus-school, speaker-id y face-id.
