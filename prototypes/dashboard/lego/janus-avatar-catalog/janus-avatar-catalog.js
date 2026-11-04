'use strict';
/**
 * JANUS Avatar Catalog · pieza LEGO reusable para Infinity Seed Group.
 * Catálogo de IDENTIDADES VISUALES, no registro de personas, usuarios ni biometría.
 * Source-of-truth de IDs, casting inicial, capacidades, fallback y slots GLB.
 * Importable en cualquier interfaz: solo requiere JavaScript, sin servicios externos.
 * Los aliases son configurables por producto/instalación; ninguna autorización depende
 * del nombre, de la apariencia del robot o de la voz que representa.
 */
const JanusAvatarCatalog = (() => {
  const EXPRESSIONS = Object.freeze(['contento', 'alegre', 'sorprendido', 'triste', 'pensativo', 'enojado']);
  const POSES = Object.freeze(['idle', 'saluda', 'celebra', 'piensa', 'camina', 'habla']);
  const entries = [
    { id: 'nexo-masculino', label: 'NEXO masculino', casting: 'Jean', kind: 'robot', variant: 'masculino', status: 'visual-approved', rigSlot: 'nexo-masculino', fallback: 'janus-nexo-3d', immutableDesign: true },
    { id: 'nexo-femenino', label: 'NEXO femenino', casting: 'Melanie', kind: 'robot', variant: 'femenino', status: 'visual-approved', rigSlot: 'nexo-femenino', fallback: 'janus-nexo-3d', immutableDesign: true },
    { id: 'robot', label: 'Robot clásico', casting: null, kind: 'legacy', variant: null, status: 'existing', rigSlot: 'robot', fallback: 'janus-3d', immutableDesign: false },
    { id: 'cabeza', label: 'Cabeza', casting: null, kind: 'view', variant: null, status: 'existing', rigSlot: null, fallback: 'janus-face-3d', immutableDesign: false },
    { id: 'cara', label: 'Cara', casting: null, kind: 'view', variant: null, status: 'existing', rigSlot: null, fallback: 'janus-face-3d', immutableDesign: false },
    { id: 'lumi', label: 'Lumi', casting: null, kind: 'creature', variant: null, status: 'existing', rigSlot: 'lumi', fallback: 'janus-creatures-3d', immutableDesign: false },
    { id: 'bombo', label: 'Bombo', casting: null, kind: 'creature', variant: null, status: 'existing', rigSlot: 'bombo', fallback: 'janus-creatures-3d', immutableDesign: false },
    { id: 'musgo', label: 'Musgo', casting: null, kind: 'creature', variant: null, status: 'existing', rigSlot: 'musgo', fallback: 'janus-creatures-3d', immutableDesign: false },
    { id: 'nimbo', label: 'Nimbo', casting: null, kind: 'creature', variant: null, status: 'existing', rigSlot: 'nimbo', fallback: 'janus-creatures-3d', immutableDesign: false }
  ].map(e => Object.freeze({ ...e, expressions: EXPRESSIONS, poses: POSES, interface: 'janus-rig-v1' }));
  const byId = Object.freeze(Object.fromEntries(entries.map(e => [e.id, e])));
  const ids = Object.freeze(entries.map(e => e.id));
  const creatureIds = Object.freeze(entries.filter(e => e.kind === 'creature').map(e => e.id));
  const nexoIds = Object.freeze(entries.filter(e => e.kind === 'robot').map(e => e.id));
  const riggableIds = Object.freeze(entries.filter(e => e.rigSlot).map(e => e.rigSlot));
  const defaultId = 'nexo-masculino';

  function get(id) { return Object.prototype.hasOwnProperty.call(byId, id) ? byId[id] : null; }
  // Alias override is installation-local data; the source design and identity IDs never change.
  function label(id, aliases = {}) {
    const item = get(id);
    if (!item) return null;
    const override = aliases && Object.prototype.hasOwnProperty.call(aliases, id) ? aliases[id] : null;
    const alias = typeof override === 'string' && override.trim() && override.length <= 60
      ? override.trim().replace(/[<>]/g, '') : item.casting;
    return alias ? alias + ' · ' + item.label : item.label;
  }
  function options(aliases = {}) { return entries.map(e => [e.id, label(e.id, aliases)]); }
  function validateRig(id, rig) {
    const e = get(id);
    return !!(e && rig && rig.root && typeof rig.update === 'function' && typeof rig.setLook === 'function');
  }
  // Casting is a visual/UX role, NOT verification of who is speaking or a trust grant.
  function casting(id, aliases = {}) {
    const e = get(id);
    return e ? Object.freeze({ id: e.id, display: label(id, aliases), model: e.variant, role: 'presentation-only', authority: 'none' }) : null;
  }
  return Object.freeze({ version: '1.0.0', defaultId, ids, creatureIds, nexoIds, riggableIds, EXPRESSIONS, POSES, get, label, options, casting, validateRig });
})();
if (typeof window !== 'undefined') window.JanusAvatarCatalog = JanusAvatarCatalog;
