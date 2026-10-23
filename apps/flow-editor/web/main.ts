/** Punto de entrada del archivo autónomo (un solo HTML, sin red). */
import { mountFlowEditor, type FlowEditorHandle } from '../src/browser.js';

declare global { interface Window { __flowEditor?: FlowEditorHandle } }

const root = document.getElementById('app');
if (root) {
  // El borrador de arranque es una plantilla REAL del motor, rotulada como ejemplo hasta la primera edición.
  window.__flowEditor = mountFlowEditor(root, { env: 'hoy', initialTemplate: 'briefing-matinal' });
}
