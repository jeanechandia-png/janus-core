'use strict';
/* ===== Instantánea de EJEMPLO (repo público). La real se genera en local/real.js ===== */
const REAL = (() => {
  const syncedAt = '2026-10-21T22:16';
  const ev = [];
  const days = ['2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28'];
  // EJEMPLO público: los eventos reales viven en local/real.js (gitignored).
  days.forEach((d) => {
    ev.push({ d, h: '11:00', dur: 90, e: '📚', t: 'Bloque de estudio', amb: 'p', note: 'Evento de ejemplo.' });
    ev.push({ d, h: '13:00', dur: 30, e: '🤖', t: 'Desarrollo producto', amb: 'e', note: 'Evento de ejemplo.' });
  });
  const prs = [[42, 'Autonomía continua, informe de cierre y objetivos múltiples', 1, '2026-10-21'], [41, 'Nuevo icono oficial de Janus (busto bifronte dorado)', 1, '2026-10-21'], [40, 'Janus School, reconocimiento del hogar y continuidad', 1, '2026-10-21'], [39, 'Lab: consentimiento de imagen, voz y restauración (ADR-009/010)', 1, '2026-10-20'], [38, 'Séneca + reconocimiento de voz como módulos LEGO', 0, '2026-10-18'], [37, 'Ejecución en Supabase y Vercel con aprobación', 0, '2026-10-16'], [36, 'Centro de mando del Founder (borrador)', 1, '2026-10-14'], [35, 'Port PR #13: confianza de ejecución con deriva', 1, '2026-10-14'], [13, 'Calibrar confianza de ejecución con resultados verificados', 0, '2026-09-30']];
  const ci = [['2026-10-21 20:35', 'autonomy-closure-objectives'], ['2026-10-21 20:35', 'app-icon-janus-two-faces'], ['2026-10-21 19:40', 'school-gates-continuity'], ['2026-10-21 19:40', 'school-gates-continuity'], ['2026-10-20 16:53', 'likeness-voice-docrestore'], ['2026-10-20 16:40', 'likeness-voice-docrestore'], ['2026-10-18 15:49', 'seneca-voice-lego'], ['2026-10-18 13:03', 'seneca-voice-lego'], ['2026-10-16 23:06', 'execution-supabase-vercel'], ['2026-10-16 23:01', 'execution-supabase-vercel']];
  return { syncedAt, ev, familyCount: 0, prs, ci, ciOk: ci.length, gmail: 'reconectar' };
})();
