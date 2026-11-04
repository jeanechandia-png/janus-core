'use strict';
/* ===== Proyectos (sala de trabajo y tarjeta del dashboard) =====
 * Estado «declarado»: lo dijo Jean el 13-oct-2026 (catálogo del Centro de mando, PR #36 de janus-core).
 * Agrupación activo/pendiente/próximo y siguiente paso: PROPUESTA de Janus, POR CONFIRMAR con Jean.
 * Fuente canónica de proyectos: infinity-chatbox-platform/INFINITYSEED_PROJECT_REGISTRY.md.
 */
const PROJECTS = [
  { id: 'janus', e: '⚙', n: 'Janus', s: 'Janus', amb: 'p', grp: 'activo', decl: 'En desarrollo', repo: 'janus-core', next: 'Revisar los PR #41 y #42 (borradores) y aprobar el dashboard A', real: 'prs' },
  { id: 'chatbox', e: '🤖', n: 'Infinity ChatBox', s: 'ChatBox', amb: 'e', grp: 'activo', decl: 'Terminado', repo: 'infinity-chatbox-platform', next: 'Piloto 3 Kings: ajustes del chatbot y seguimiento' },
  { id: 'web', e: '🌐', n: 'Web InfinitySeed Group', s: 'Web', amb: 'e', grp: 'activo', decl: null, repo: 'infinityseed-group-website', next: 'Revisar la versión V9 en producción' },
  { id: 'iba', e: '🧠', n: 'Infinity Business Assistant', amb: 'e', grp: 'pendiente', decl: 'Terminado', repo: 'infinity_business_assistant', next: 'Aprobar 2 actualizaciones pendientes' },
  { id: 'tribuna', e: '🏆', n: 'La Tribuna Virtual', amb: 'e', grp: 'pendiente', decl: 'Parcial', repo: 'la_tribuna_virtual', next: 'F1, MotoGP y vóley en desarrollo' },
  { id: 'api', e: '🔌', n: 'API Infinity', amb: 'e', grp: 'pendiente', decl: 'En desarrollo', repo: null, next: 'Por definir' },
  { id: 'potensic', e: '🚁', n: 'Patrocinio Potensic', amb: 'e', grp: 'proximo', decl: null, repo: null, next: 'Propuesta de patrocinio (Atom 2): enviar y hacer seguimiento' },
  { id: 'gumroad', e: '🛍', n: 'Productos Gumroad', amb: 'e', grp: 'proximo', decl: null, repo: null, next: 'Línea de productos digitales: priorizar el primero' }
];
const PGRP = [['todos', 'Todos'], ['activo', 'Activos'], ['pendiente', 'Pendientes'], ['proximo', 'Próximos']];
const PGRP_TXT = { activo: 'Activo', pendiente: 'Pendiente', proximo: 'Próximo' };
const projById = (id) => PROJECTS.find((p) => p.id === id) || PROJECTS[0];

const miniJano = (cls) => JanusActivity.robotSvg(cls);
const medallion = (cls) => JanusActivity.medallionHtml(IMG.medal, cls);
const JSTATE = { listo: ['Listo', 'Esperando tu próxima orden'], escuchando: ['Escuchando', 'Habla: Janus transcribe'], pensando: ['Pensando', 'Entiende y planifica'], ejecutando: ['Ejecutando', 'Trabajando en el proyecto'], aprobacion: ['Espera tu visto bueno', 'Necesita tu aprobación para seguir'] };
