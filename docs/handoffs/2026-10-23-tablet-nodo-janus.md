# Handoff — nodo de Janus en la tablet Samsung (2026-10-23)

Rama: `claude/tablet-nodo-janus` (sobre `claude/social-accounts-watch` @ 80bcb82). Guía completa: `docs/tablet-node.md`.

- **AHORA:** paquete de instalación en reposo (`scripts/tablet/`) listo; no se ejecutó en la tablet real.
- **HECHO VERIFICADO:** Node 24.22.1 → `npm test` 573/574 (1 omitida, 0 fallos), `tests/runtime-smoke.mjs` ok, `tests/tablet-kit.test.ts` 5/5 también en Node 22.22. Termux trae Node 24 LTS con `--shared-sqlite`.
- **PENDIENTE (Jean, en la tablet):** instalar Termux/Termux:Boot desde F-Droid, ejecutar el instalador, arrancar y pasar el piloto de 7 días.
- **POR CONFIRMAR:** modelo y Android de la tablet; que tsx/esbuild arranque ahí; autonomía de batería; opción de «Proteger batería».
- **BLOQUEADO (no urgente):** acceso desde el iPhone exige HTTPS para el inicio de sesión; decidir entre HTTPS de Tailscale o Cloudflare Tunnel (esto último requiere aprobación). Mientras, la tablet funciona por `localhost`.
- **PRÓXIMO:** Jean confirma modelo/Android → ajustar el instalador a lo que falle en el piloto.
- Alcance acordado: **solo Janus**; ChatBox e IBA siguen en su plan original. Temporal hasta tener equipo propio con SAI (gasto al final, Norma 7).
