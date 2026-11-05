/**
 * JANUS companion — the approved-only selection, local-first.
 * Render actual user-approved assets only, never temporary replacement creatures.
 */
import { mountLanguageButtons } from './language-buttons.js';
import {
  restoreCompanionState, renameLocally, addStarsForChallenge,
  unlockAccessory, equipAccessory, activeName,
} from './companion-state.js';

const STORE_KEY = 'janus.companion.v1';
const q = (selector) => document.querySelector(selector);
const ui = {
  options: q('#characterOptions'), stage: q('#characterStage'), art: q('#stageArt'),
  status: q('#stageStatus'), stageNote: q('#stageNote'), stars: q('#starBalance'),
  owner: q('#ownerName'), pet: q('#petName'), nameNotice: q('#nameNotice'),
  wardrobe: q('#accessories'), categories: q('#accessoryCategories'),
  accessoryNotice: q('#accessoryNotice'), question: q('#challengeQuestion'),
  answer: q('#challengeAnswer'), result: q('#challengeResult'),
};
let catalog;
let state;
let category = 'Todos';
let exercise = null;
let answered = false;
function create(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}
function persist() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  catch { /* Storage is optional; interactive controls remain usable. */ }
}
function restore() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); }
  catch { /* Malformed local data falls back to a clean profile. */ }
  return restoreCompanionState(raw, catalog);
}
function selected() { return catalog.characters.find((item) => item.id === state.selectedId); }
function ownAsset(path, kind) {
  // Offline assets must be bundled in Janus, never loaded from third-party domains.
  if (typeof path !== 'string' || !path.startsWith('/companion-assets/')
    || path.includes('..') || path.includes('?') || path.includes('#')) return false;
  return kind === 'model' ? /\.glb$/i.test(path) : /\.(png|jpe?g|webp)$/i.test(path);
}
function report(text) { ui.status.textContent = text; }
function renderOptions() {
  ui.options.replaceChildren();
  for (const character of catalog.characters) {
    const button = create('button', 'character-tile');
    button.type = 'button';
    button.style.setProperty('--character-color', character.palette);
    button.dataset.character = character.id;
    button.setAttribute('aria-pressed', String(character.id === state.selectedId));
    button.append(
      create('span', 'tile-ordinal', 'OPCIÓN 0' + character.position),
      create('strong', null, activeName(state, character)),
      create('small', null, character.role === 'evolution-archive'
        ? 'El primer robot · Historia de Janus'
        : 'Diseño aprobado · Personalizable'),
    );
    button.addEventListener('click', () => {
      state.selectedId = character.id;
      persist(); renderAll();
      ui.stage.focus({ preventScroll: true });
    });
    ui.options.append(button);
  }
}
function renderStage() {
  const character = selected();
  ui.art.replaceChildren();
  ui.stage.style.setProperty('--character-color', character.palette);
  const preview = character.assets?.previewImage;
  const model = character.assets?.model3d;
  const hasPreview = ownAsset(preview, 'preview');
  const hasModel = ownAsset(model, 'model');
  const hasViewer = Boolean(window.customElements?.get('model-viewer'));
  if (hasModel && hasPreview && hasViewer) {
    const viewer = create('model-viewer');
    viewer.setAttribute('src', model);
    viewer.setAttribute('poster', preview);
    viewer.setAttribute('alt', activeName(state, character) + ' en tres dimensiones');
    viewer.setAttribute('camera-controls', '');
    viewer.setAttribute('interaction-prompt', 'none');
    viewer.setAttribute('shadow-intensity', '1');
    viewer.addEventListener('error', () => {
      ui.art.replaceChildren(create('div', 'asset-pending', 'No se pudo cargar el modelo local.'));
      report('El archivo 3D no está disponible en este dispositivo.');
    });
    ui.art.append(viewer);
    report('Modelo 3D · Arrastra para girar.');
  } else if (hasPreview) {
    const image = create('img');
    image.src = preview;
    image.alt = 'Vista aprobada de ' + activeName(state, character);
    image.draggable = false;
    image.addEventListener('error', () => {
      ui.art.replaceChildren(create('div', 'asset-pending', 'Imagen aprobada no disponible.'));
      report('Falta el archivo original.');
    });
    ui.art.append(image);
    report(hasModel ? 'Vista estática · Visor 3D local pendiente.' : 'Vista estática · Modelo 3D pendiente.');
  } else {
    const pending = create('div', 'asset-pending');
    pending.append(
      create('strong', null, character.kind === 'robot'
        ? 'El primer robot de Janus se conserva'
        : 'Criatura aprobada · Arte pendiente de vincular'),
      create('p', null, character.kind === 'robot'
        ? 'Tercera opción: recuerdo de la evolución.'
        : 'No se mostrará ninguna criatura rechazada en su lugar.'),
    );
    ui.art.append(pending);
    report('Modelos 3D definitivos aún no vinculados.');
  }
  ui.stageNote.textContent = character.role === 'evolution-archive'
    ? 'El robot original permanece disponible como símbolo de evolución.'
    : 'Solo los diseños aprobados pueden aparecer aquí.';
}
function renderNames() {
  ui.owner.value = state.ownerName;
  ui.pet.value = activeName(state, selected());
}
function renderWardrobe() {
  ui.stars.textContent = String(state.stars);
  const categories = ['Todos', ...new Set(catalog.accessories.map((item) => item.category))];
  ui.categories.replaceChildren();
  for (const name of categories) {
    const button = create('button', null, name);
    button.type = 'button';
    button.setAttribute('aria-pressed', String(name === category));
    button.addEventListener('click', () => { category = name; renderWardrobe(); });
    ui.categories.append(button);
  }
  ui.wardrobe.replaceChildren();
  for (const item of catalog.accessories.filter((x) => category === 'Todos' || x.category === category)) {
    const owned = state.unlocked.includes(item.id);
    const equipped = state.equipped[item.category] === item.id;
    const button = create('button', 'accessory-card');
    button.type = 'button';
    button.setAttribute('aria-pressed', String(equipped));
    button.append(
      create('strong', null, item.title),
      create('small', null, item.category),
      create('span', 'cost', equipped ? 'Elegido ✓'
        : owned ? 'Elegir' : String(item.cost) + ' ✦ para desbloquear'),
    );
    button.addEventListener('click', () => {
      if (owned) {
        state = equipAccessory(state, item, catalog);
        ui.accessoryNotice.textContent = item.title + ' seleccionado. Arte 3D del accesorio pendiente.';
      } else {
        const result = unlockAccessory(state, item, catalog);
        if (!result.ok) {
          ui.accessoryNotice.textContent = 'Faltan ' + result.missing + ' estrellas para ' + item.title + '.';
          return;
        }
        state = result.state;
        ui.accessoryNotice.textContent = item.title + ' desbloqueado. Ya puedes elegirlo.';
      }
      persist(); renderWardrobe();
    });
    ui.wardrobe.append(button);
  }
}
function challenge() {
  const a = 2 + Math.floor(Math.random() * 14);
  const b = 2 + Math.floor(Math.random() * 12);
  exercise = { id: crypto.randomUUID(), solution: a + b };
  answered = false;
  ui.question.textContent = String(a) + ' + ' + String(b) + ' =';
  ui.answer.value = '';
  ui.result.textContent = '';
}
function bind() {
  q('#saveNames').addEventListener('click', () => {
    const character = selected();
    state = renameLocally(state, character.id, ui.owner.value, ui.pet.value, character.label);
    persist(); renderAll();
    ui.nameNotice.textContent = 'Guardado. Te llamaré ' + state.ownerName + '.';
  });
  q('#challengeForm').addEventListener('submit', (event) => {
    event.preventDefault();
    if (answered || !exercise) return;
    if (ui.answer.value.trim() === '') return;
    const attempt = Number(ui.answer.value);
    if (attempt !== exercise.solution) {
      ui.result.textContent = 'Aún no. Prueba otra vez, sin perder estrellas.';
      return;
    }
    answered = true;
    const result = addStarsForChallenge(state, exercise.id, new Date());
    state = result.state;
    persist(); renderWardrobe();
    ui.result.textContent = result.earned
      ? '¡Muy bien, ' + state.ownerName + '! +' + result.earned + ' estrellas.'
      : '¡Correcto, ' + state.ownerName + '! Por hoy completaste las estrellas de práctica.';
  });
  q('#nextChallenge').addEventListener('click', challenge);
  const gestures = [
    ['#waveButton', 'saludar'], ['#danceButton', 'bailar'], ['#laughButton', 'reír'],
  ];
  for (const [selector, name] of gestures) {
    q(selector).addEventListener('click', () => {
      const viewer = ui.art.querySelector('model-viewer');
      const animations = viewer?.availableAnimations;
      if (Array.isArray(animations)) {
        const match = animations.find((item) => item.toLowerCase().includes(name));
        if (match) {
          viewer.animationName = match;
          viewer.play?.();
          report('Animación: ' + name);
          return;
        }
      }
      report('Gesto ' + name + ' pendiente del modelo 3D.');
    });
  }
  let start = null;
  ui.stage.addEventListener('pointerdown', (event) => {
    if (event.target.closest('model-viewer')) return;
    start = { x: event.clientX, position: Number(state.stageOffset) || 0 };
    ui.stage.setPointerCapture?.(event.pointerId);
  });
  ui.stage.addEventListener('pointermove', (event) => {
    if (!start) return;
    const limit = Math.min(110, ui.stage.clientWidth * .18);
    state.stageOffset = Math.round(Math.max(-limit, Math.min(limit, start.position + event.clientX - start.x)));
    ui.art.style.setProperty('--stage-offset', String(state.stageOffset) + 'px');
  });
  for (const action of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    ui.stage.addEventListener(action, () => { if (start) { start = null; persist(); } });
  }
}
function renderAll() {
  ui.art.style.setProperty('--stage-offset', String(state.stageOffset || 0) + 'px');
  renderOptions(); renderNames(); renderStage(); renderWardrobe();
}
async function init() {
  try {
    const response = await fetch('/companion-catalog.json');
    if (!response.ok) throw new Error('No se encontró el catálogo aprobado');
    catalog = await response.json();
    if (!Array.isArray(catalog.characters) || catalog.characters.length !== 3
      || catalog.characters[2].id !== 'janus-original-robot'
      || catalog.characters.some((c, i) => c.position !== i + 1
        || (i < 2 && c.origin !== 'chatgpt-approved-design'))) {
      throw new Error('El catálogo no coincide con la selección aprobada');
    }
    state = restore(); bind(); challenge(); renderAll();
    mountLanguageButtons(q('#companionLanguageSwitch'), 'companion');
  } catch (error) {
    ui.options.replaceChildren(create('p', 'asset-pending', 'Selección no disponible: ' + error.message));
    report('Sin el catálogo aprobado no se muestran sustitutos.');
    for (const button of document.querySelectorAll('.companion-app button')) button.disabled = true;
  }
}
void init();
