/* Bundles IIFE de las piezas LEGO de janus-core (rama claude/deal-radar-mail-hub @ 5d16411).
* companion: rama claude/companion-research @ 9facbdf (global Companion).
* home-scenes: packages/modules/home-scenes (global HomeScenes).
 * drone-weather: packages/modules/drone-weather (rama claude/companion-research @ 8cee902, global DroneWx).
 * three-r160.min.js: three.js r160 (MIT) + RoomEnvironment en IIFE (global THREE); lo usa lego/janus-3d.
 * Regenerar: esbuild packages/modules/<id>/src/index.ts --bundle --format=iife --global-name=<Nombre> */
