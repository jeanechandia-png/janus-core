/**
 * Editor visual de flujos — pantalla (DOM).
 *
 * Una sola función pública, `mountFlowEditor(root, opciones)`. No usa red, no guarda claves y no ejecuta nada:
 * trabaja con BORRADORES sobre el catálogo, la validación y las plantillas reales del motor (ver model.ts).
 * Pensado para el tacto (iPhone/tablet): tocar para seleccionar, arrastrar para mover, y conectar en dos toques
 * (salida del nodo → nodo de destino). Todo texto que viene de un borrador se escapa antes de pintarse.
 */
import type { AutomationNodeManifest } from '../../../packages/automation/src/node-registry.js';
import type { NodeCatalogEnv } from '../../../packages/automation/src/node-catalog.js';
import { FLOW_TEMPLATES } from '../../../packages/automation/src/flow-templates.js';
import type { WorkflowConnection, WorkflowNode, WorkflowRisk } from '../../../packages/automation/src/workflow.js';
import { builtinNodeManifests } from '../../../packages/automation/src/node-catalog.js';
import { icon, iconForNode } from './icons.js';
import {
  ENV_PRESETS, EXPRESSION_HELP, NODE_H, NODE_W, addNode, analyzeDraft, autoLayout, branchOutputs, catalogView, connect, createNode, disconnect,
  draftFromTemplate, duplicateNode, executionPlan, exportBlockers, guideFor, isPublishReady, knownToolActions, moveNode, newDraft, parseDraft,
  registryFor, removeNode, renameFlow, serializeDraft, suggestedParams, templatesView, updateFlowSettings, updateNode,
  type EditResult, type FlowDraft, type Orientation, type Pos, type Problem,
} from './model.js';

/* ───────────────────────────── Opciones y tipos ───────────────────────────── */

export interface FlowEditorOptions {
  /** Entorno simulado inicial: «hoy» | «conectado» | «todo». */
  env?: keyof typeof ENV_PRESETS;
  /** Plantilla con la que arrancar si no hay borrador guardado (se rotula como EJEMPLO hasta la primera edición). */
  initialTemplate?: string;
  /** Almacenamiento local del borrador. `null` lo desactiva. Por defecto, localStorage si existe. */
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
  /** Reloj (para fechas del borrador nuevo). */
  now?: () => Date;
  /** Descarga de un archivo de texto. */
  download?: (filename: string, text: string) => void;
  /** Copia al portapapeles. */
  copy?: (text: string) => Promise<void>;
}

export interface FlowEditorHandle {
  getDraft(): FlowDraft;
  setEnv(key: string): void;
  destroy(): void;
}

type Sel = { kind: 'node'; id: string } | { kind: 'edge'; from: string; to: string; branch?: string } | null;
type LeftTab = 'nodos' | 'plantillas' | 'entorno';
type RightTab = 'detalle' | 'problemas' | 'orden' | 'archivo';

interface State {
  draft: FlowDraft;
  past: FlowDraft[];
  future: FlowDraft[];
  sel: Sel;
  left: LeftTab;
  right: RightTab;
  envKey: string;
  query: string;
  linking: { from: string; branch?: string; choosing: boolean } | null;
  zoom: number;
  leftOpen: boolean;
  vertical: boolean;
  example: string | null;
  importText: string;
  importError: string;
  paramErrors: Record<string, string>;
}

const STORE_KEY = 'janus.flow-editor.draft.v1';
const VIEW_KEY = 'janus.flow-editor.view.v1';
const MAX_HISTORY = 100;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 1.6;
const RISK_LABEL: Record<WorkflowRisk, string> = { none: 'Sin riesgo', low: 'Bajo', medium: 'Medio', high: 'Alto' };
const ONERR_LABEL: Record<string, string> = { fail: 'Detener el flujo', continue: 'Continuar con el siguiente', error_branch: 'Seguir por la rama de error' };
const FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype']);

const esc = (value: unknown): string => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const nodeIcon = (type: string, kind: string, cls = 'ic'): string => icon(iconForNode(type, kind), cls);
const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/* ───────────────────────────── Montaje ───────────────────────────── */

export function mountFlowEditor(root: HTMLElement, options: FlowEditorOptions = {}): FlowEditorHandle {
  const clock = options.now ?? (() => new Date());
  const storage = options.storage === undefined ? safeStorage() : options.storage;
  const doDownload = options.download ?? defaultDownload;
  const doCopy = options.copy ?? defaultCopy;
  const abort = new AbortController();
  const on = abort.signal;

  let envKey = options.env && ENV_PRESETS[options.env] ? String(options.env) : 'hoy';
  const manifestsAll = builtinNodeManifests(ENV_PRESETS.todo!.env);

  const state: State = {
    draft: newDraft(clock().toISOString(), manifestsAll), past: [], future: [], sel: null, left: 'nodos', right: 'detalle', envKey,
    query: '', linking: null, zoom: 1, leftOpen: true, vertical: false, example: null, importText: '', importError: '', paramErrors: {},
  };
  let toastTimer: ReturnType<typeof setTimeout> | undefined;

  // Orientación del lienzo: vertical por defecto en pantallas estrechas (móvil y tablet), horizontal en pantallas anchas.
  state.vertical = readView() ?? (typeof window !== 'undefined' && window.innerWidth < 1400);
  const orientation = (): Orientation => (state.vertical ? 'v' : 'h');

  /* Carga inicial: borrador guardado → plantilla de arranque → borrador vacío. */
  let startMessage = '';
  const saved = readSaved();
  if (saved) { state.draft = saved; startMessage = 'Borrador recuperado de este dispositivo.'; }
  else if (options.initialTemplate) {
    const template = FLOW_TEMPLATES.find((t) => t.id === options.initialTemplate);
    if (template) { state.draft = draftFromTemplate(template, orientation()); state.example = template.id; }
  }

  root.innerHTML = `
    <div class="fe" id="fe">
      <header class="hd" id="fe-hd"></header>
      <div class="mn">
        <section class="cd pnc lft" id="fe-left" aria-label="Paleta de nodos y plantillas"></section>
        <section class="cd cvc" id="fe-cv" aria-label="Lienzo del flujo">
          <div class="cvh" id="fe-tb"></div>
          <div class="cv" id="fe-scroll"><div id="fe-banner"></div><div class="sw" id="fe-sw"></div></div>
        </section>
        <section class="cd pnc rgt" id="fe-right" aria-label="Detalle del flujo"></section>
      </div>
      <footer class="ft" id="fe-ft"></footer>
      <div class="toast" id="fe-toast" role="status" aria-live="polite"></div>
    </div>`;
  const $ = <T extends HTMLElement>(id: string): T => root.querySelector<T>(`#${id}`)!;
  const elFe = $('fe'), elHd = $('fe-hd'), elLeft = $('fe-left'), elTb = $('fe-tb'), elScroll = $('fe-scroll'), elBanner = $('fe-banner'), elSw = $('fe-sw'), elRight = $('fe-right'), elFt = $('fe-ft'), elToast = $('fe-toast');

  /* ───────────── Análisis memoizado ───────────── */

  interface Analysis { problems: Problem[]; errors: number; warns: number; rest: number; byNode: Map<string, { errors: number; warns: number; rest: boolean }>; plan: ReturnType<typeof executionPlan>; step: Map<string, number> }
  let memo: { draft: FlowDraft; env: string; value: Analysis } | null = null;
  const manifestByType = new Map<string, AutomationNodeManifest>(manifestsAll.map((m) => [m.type, m]));

  function analysis(): Analysis {
    if (memo && memo.draft === state.draft && memo.env === envKey) return memo.value;
    const registry = registryFor(ENV_PRESETS[envKey]!.env);
    const problems = analyzeDraft(state.draft, registry);
    const byNode = new Map<string, { errors: number; warns: number; rest: boolean }>();
    // «En reposo» (falta algo que aún no existe) no es un fallo del flujo: se cuenta aparte (norma 7).
    for (const p of problems) {
      if (!p.nodeId) continue;
      const entry = byNode.get(p.nodeId) ?? byNode.set(p.nodeId, { errors: 0, warns: 0, rest: false }).get(p.nodeId)!;
      if (p.kind === 'entorno') { entry.rest = true; entry.warns += 1; }
      else if (p.level === 'error') entry.errors += 1;
      else if (p.level === 'warn') entry.warns += 1;
    }
    const plan = executionPlan(state.draft.workflow);
    const step = new Map<string, number>();
    plan.levels.forEach((ids, index) => ids.forEach((id) => step.set(id, index + 1)));
    const value: Analysis = {
      problems, errors: problems.filter((p) => p.level === 'error' && p.kind !== 'entorno').length, warns: problems.filter((p) => p.level === 'warn').length,
      rest: new Set(problems.filter((p) => p.kind === 'entorno' && p.nodeId).map((p) => p.nodeId)).size, byNode, plan, step,
    };
    memo = { draft: state.draft, env: envKey, value };
    return value;
  }

  const nodeOf = (id: string): WorkflowNode | undefined => state.draft.workflow.nodes.find((n) => n.id === id);
  const selectedNode = (): WorkflowNode | undefined => (state.sel?.kind === 'node' ? nodeOf(state.sel.id) : undefined);

  /* ───────────── Historial ───────────── */

  function commit(next: FlowDraft, keepExample = false): void {
    state.past.push(state.draft);
    if (state.past.length > MAX_HISTORY) state.past.shift();
    state.future = [];
    state.draft = next;
    if (!keepExample) state.example = null;
    persist();
  }
  function applyEdit(result: EditResult, okMessage?: string): boolean {
    if (!result.ok) { toast(result.error, 'bad'); return false; }
    commit(result.draft);
    if (okMessage) toast(okMessage);
    return true;
  }
  function undo(): void {
    const previous = state.past.pop();
    if (!previous) return;
    state.future.push(state.draft);
    state.draft = previous;
    fixSelection(); persist(); renderAll();
  }
  function redo(): void {
    const next = state.future.pop();
    if (!next) return;
    state.past.push(state.draft);
    state.draft = next;
    fixSelection(); persist(); renderAll();
  }
  function fixSelection(): void {
    if (state.sel?.kind === 'node' && !nodeOf(state.sel.id)) state.sel = null;
    if (state.sel?.kind === 'edge') {
      const s = state.sel;
      if (!state.draft.workflow.connections.some((c) => c.from === s.from && c.to === s.to && (c.branch ?? '') === (s.branch ?? ''))) state.sel = null;
    }
    if (state.linking && !nodeOf(state.linking.from)) state.linking = null;
  }

  /* ───────────── Persistencia local (solo comodidad de este dispositivo) ───────────── */

  function readSaved(): FlowDraft | null {
    try {
      const text = storage?.getItem(STORE_KEY);
      if (!text) return null;
      const parsed = parseDraft(text, orientation());
      return parsed.ok ? parsed.draft : null;
    } catch { return null; }
  }
  function readView(): boolean | null {
    try { const v = storage?.getItem(VIEW_KEY); return v === 'v' ? true : v === 'h' ? false : null; } catch { return null; }
  }
  function persistView(): void { try { storage?.setItem(VIEW_KEY, state.vertical ? 'v' : 'h'); } catch { /* sin almacenamiento */ } }
  function persist(): void {
    try {
      if (!storage) return;
      // Un borrador con algo que parece una clave no se guarda en ningún sitio, ni siquiera en este dispositivo.
      if (exportBlockers(state.draft).length > 0) { storage.removeItem(STORE_KEY); return; }
      storage.setItem(STORE_KEY, serializeDraft(state.draft));
    } catch { /* sin almacenamiento: el editor sigue funcionando */ }
  }

  /* ───────────── Avisos ───────────── */

  function toast(message: string, tone: 'ok' | 'bad' = 'ok'): void {
    elToast.textContent = message;
    elToast.className = `toast show ${tone}`;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { elToast.className = 'toast'; }, 4200);
  }

  /* ───────────── Geometría del lienzo ───────────── */

  let drag: { id: string; startX: number; startY: number; origin: Pos; moved: boolean; cur: Pos } | null = null;

  const posOf = (id: string): Pos => (drag?.moved && drag.id === id ? drag.cur : state.draft.layout[id] ?? { x: 40, y: 40 });

  function bounds(): { w: number; h: number; sx: number; sy: number } {
    const ids = state.draft.workflow.nodes.map((n) => n.id);
    let minX = 40, minY = 40, maxX = 0, maxY = 0;
    for (const id of ids) {
      const p = posOf(id);
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + NODE_W); maxY = Math.max(maxY, p.y + NODE_H);
    }
    const sx = minX < 40 ? 40 - minX : 0;
    const sy = minY < 40 ? 40 - minY : 0;
    return { w: Math.max(520, maxX + sx + 80), h: Math.max(360, maxY + sy + 80), sx, sy };
  }

  function edgeGeometry(c: WorkflowConnection, b: { sx: number; sy: number }): { d: string; lx: number; ly: number } | null {
    if (!nodeOf(c.from) || !nodeOf(c.to)) return null;
    const a = posOf(c.from), t = posOf(c.to);
    const ax = a.x + b.sx, ay = a.y + b.sy, tx = t.x + b.sx, ty = t.y + b.sy;
    const cubic = (x1: number, y1: number, c1x: number, c1y: number, c2x: number, c2y: number, x2: number, y2: number) => ({
      d: `M${x1} ${y1} C${c1x} ${c1y} ${c2x} ${c2y} ${x2} ${y2}`,
      lx: (x1 + 3 * c1x + 3 * c2x + x2) / 8, ly: (y1 + 3 * c1y + 3 * c2y + y2) / 8,
    });
    if (state.vertical) {
      const x2 = tx + NODE_W / 2, y2 = ty;
      if (c.branch === 'error') { const x1 = ax + NODE_W, y1 = ay + NODE_H / 2; return cubic(x1, y1, x1 + 70, y1, x2, y2 - 60, x2, y2); }
      const x1 = ax + NODE_W / 2, y1 = ay + NODE_H;
      const dy = Math.max(40, Math.abs(y2 - y1) / 2);
      return cubic(x1, y1, x1, y1 + dy, x2, y2 - dy, x2, y2);
    }
    const x2 = tx, y2 = ty + NODE_H / 2;
    if (c.branch === 'error') { const x1 = ax + NODE_W / 2, y1 = ay + NODE_H; return cubic(x1, y1, x1, y1 + 70, x2 - 60, y2, x2, y2); }
    const x1 = ax + NODE_W, y1 = ay + NODE_H / 2;
    const dx = Math.max(48, Math.abs(x2 - x1) / 2);
    return cubic(x1, y1, x1 + dx, y1, x2 - dx, y2, x2, y2);
  }

  /* ───────────── Pintado: cabecera, barra, pie ───────────── */

  function renderHd(): void {
    const a = analysis();
    const wf = state.draft.workflow;
    const chips: string[] = [];
    if (state.example) {
      const t = FLOW_TEMPLATES.find((x) => x.id === state.example);
      chips.push(`<span class="chip demo" title="Plantilla real del motor, sin tocar todavía">Ejemplo · ${esc(t?.name ?? state.example)}</span>`);
    }
    chips.push(`<span class="chip" title="Estado del flujo">${icon('doc')} ${wf.status === 'draft' ? 'Borrador' : esc(wf.status)}</span>`);
    chips.push(a.errors > 0 ? `<span class="chip bad">${icon('warn')} ${plural(a.errors, 'error', 'errores')}</span>` : `<span class="chip good">${icon('verify')} Sin errores</span>`);
    if (a.rest > 0) chips.push(`<span class="chip warn" title="Construido y listo para activar cuando exista lo que necesita; no obliga a comprar nada.">${icon('lock')} ${a.rest} en reposo</span>`);
    if (a.warns - a.rest > 0) chips.push(`<span class="chip warn">${plural(a.warns - a.rest, 'aviso', 'avisos')}</span>`);
    chips.push(`<span class="chip" title="El editor todavía no lee el estado real del runtime; usa un entorno de prueba.">${icon('settings')} Entorno simulado: ${esc(ENV_PRESETS[envKey]!.label)}</span>`);
    elHd.innerHTML = `
      <span class="wm serif gld">JANUS</span><span class="sub">Flujos</span>
      <input class="name" data-f="flowname" value="${esc(wf.name)}" maxlength="80" aria-label="Nombre del flujo" />
      <div class="chips">${chips.join('')}</div>`;
  }

  function renderToolbar(): void {
    elTb.innerHTML = `
      <button class="btn sq desk-hide-lft" data-act="toggle-left" title="Mostrar u ocultar la paleta" aria-pressed="${state.leftOpen}">${icon('folder')}</button>
      <button class="btn mob-only" data-act="goto-palette">${icon('add')} Nodo</button>
      <button class="btn sq" data-act="undo" ${state.past.length ? '' : 'disabled'} title="Deshacer" aria-label="Deshacer">${icon('undo')}</button>
      <button class="btn sq" data-act="redo" ${state.future.length ? '' : 'disabled'} title="Rehacer" aria-label="Rehacer">${icon('redo')}</button>
      <button class="btn" data-act="relayout" title="Recolocar todos los nodos por pasos">${icon('logic')} Ordenar</button>
      <button class="btn" data-act="orient" aria-pressed="${state.vertical}" title="Cambiar entre pasos de arriba abajo y de izquierda a derecha">${state.vertical ? '↓ Vertical' : '→ Horizontal'}</button>
      <span class="sp"></span>
      <button class="btn sq" data-act="zoom-out" title="Alejar" aria-label="Alejar">−</button>
      <span class="mono sm mute" style="min-width:42px;text-align:center">${Math.round(state.zoom * 100)}%</span>
      <button class="btn sq" data-act="zoom-in" title="Acercar" aria-label="Acercar">+</button>
      <button class="btn" data-act="zoom-fit" title="Ajustar a la pantalla">${icon('target')} Ajustar</button>
      <button class="btn mob-only" data-act="goto-detail" title="Ir al detalle">Detalle ↓</button>`;
    elFe.classList.toggle('nolf', !state.leftOpen);
    elFe.classList.toggle('vert', state.vertical);
  }

  function renderFt(): void {
    const wf = state.draft.workflow;
    const a = analysis();
    elFt.innerHTML = `
      <span><b>${wf.nodes.length}</b> nodos</span><span><b>${wf.connections.length}</b> conexiones</span>
      <span><b>${a.plan.levels.length}</b> pasos previstos</span><span><b>${a.plan.pauses.length}</b> pausas (aprobación o espera)</span>
      <span style="margin-left:auto">Solo borradores: aquí no se publica ni se ejecuta nada · sin gastos</span>`;
  }

  /* ───────────── Pintado: lienzo ───────────── */

  function renderBanner(): void {
    const l = state.linking;
    if (!l) { elBanner.innerHTML = ''; return; }
    const from = nodeOf(l.from);
    const name = esc(from?.label ?? l.from);
    if (l.choosing && from) {
      const branches = branchOutputs(from);
      elBanner.innerHTML = `<div class="banner" role="group" aria-label="Elegir rama"><span>«${name}» tiene ramas. ¿Por cuál sigue?</span>${branches.map((b) => `<button class="btn" data-act="branch" data-v="${esc(b)}">${esc(b)}</button>`).join('')}<button class="btn bad" data-act="cancel-link">Cancelar</button></div>`;
      return;
    }
    const via = l.branch ? ` · rama «${esc(l.branch)}»` : '';
    elBanner.innerHTML = `<div class="banner" role="status">Conectando «${name}»${via}. Toca el nodo de destino. <button class="btn bad" data-act="cancel-link">Cancelar</button></div>`;
  }

  function renderEdges(): string {
    const b = bounds();
    const wf = state.draft.workflow;
    const sel = state.sel?.kind === 'edge' ? state.sel : null;
    const paths = wf.connections.map((c) => {
      const g = edgeGeometry(c, b);
      if (!g) return '';
      const isSel = !!sel && sel.from === c.from && sel.to === c.to && (sel.branch ?? '') === (c.branch ?? '');
      const cls = `ln${c.branch === 'error' ? ' er' : ''}${isSel ? ' sel' : ''}`;
      const label = c.branch && c.branch !== 'success' ? `<text class="tg" x="${g.lx}" y="${g.ly - 6}" text-anchor="middle">${esc(c.branch)}</text>` : '';
      return `<path class="${cls}" d="${g.d}" marker-end="url(#fe-arr)" /><path class="hit" d="${g.d}" data-act="edge" data-from="${esc(c.from)}" data-to="${esc(c.to)}" data-branch="${esc(c.branch ?? '')}"><title>${esc(c.from)} → ${esc(c.to)}</title></path>${label}`;
    });
    return `<svg class="edges" width="${b.w}" height="${b.h}" aria-hidden="false"><defs><marker id="fe-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1 L10 5 L0 9 z" fill="#E8C37A" /></marker></defs>${paths.join('')}</svg>`;
  }

  function nodeHtml(node: WorkflowNode, b: { sx: number; sy: number }, a: Analysis): string {
    const p = posOf(node.id);
    const info = a.byNode.get(node.id);
    const manifest = manifestByType.get(node.type);
    const sel = state.sel?.kind === 'node' && state.sel.id === node.id;
    const tgt = !!state.linking && !state.linking.choosing && state.linking.from !== node.id && node.kind !== 'trigger';
    const cls = ['nd', sel ? 'sel' : '', info?.rest ? 'rest' : '', node.disabled ? 'off' : '', info?.errors ? 'pe' : info?.warns ? 'pw' : '', tgt ? 'tgt' : ''].filter(Boolean).join(' ');
    const step = a.step.get(node.id);
    const branches = branchOutputs(node);
    const sub = branches.length ? `ramas: ${branches.join(' · ')}` : `${manifest?.displayName ?? node.type}${node.risk !== 'none' ? ` · riesgo ${RISK_LABEL[node.risk].toLowerCase()}` : ''}`;
    const problems = (info?.errors ?? 0) + (info?.warns ?? 0);
    return `<div class="${cls}" data-node="${esc(node.id)}" tabindex="0" role="button" aria-label="${esc(node.label)}. ${esc(manifest?.displayName ?? node.type)}${info?.rest ? '. En reposo en este entorno' : ''}" style="left:${p.x + b.sx}px;top:${p.y + b.sy}px">
      ${step ? `<span class="bd" title="Paso previsto ${step}">${step}</span>` : ''}${problems ? `<span class="bd p" title="${problems} ${problems === 1 ? 'problema' : 'problemas'}">${problems}</span>` : ''}
      <div class="t">${nodeIcon(node.type, node.kind)}<span>${esc(node.label)}</span></div>
      <div class="s"><i class="dot ${info?.rest ? 'rest' : ''}"></i><span>${esc(sub)}</span></div>
      ${node.kind === 'trigger' ? '' : '<span class="pt in" aria-hidden="true"></span>'}
      <button class="pt out ${state.linking?.from === node.id ? 'on' : ''}" data-act="out" data-node="${esc(node.id)}" aria-label="Conectar la salida de ${esc(node.label)}" title="Conectar la salida"></button>
      ${node.onError === 'error_branch' ? `<button class="pt er ${state.linking?.from === node.id && state.linking.branch === 'error' ? 'on' : ''}" data-act="err" data-node="${esc(node.id)}" aria-label="Conectar la rama de error de ${esc(node.label)}" title="Rama de error"></button>` : ''}
    </div>`;
  }

  function renderStage(): void {
    const b = bounds();
    const a = analysis();
    const z = state.zoom;
    elSw.style.width = `${b.w * z}px`;
    elSw.style.height = `${b.h * z}px`;
    elSw.innerHTML = `<div class="stage" id="fe-stage" style="width:${b.w}px;height:${b.h}px;transform:scale(${z})">${renderEdges()}${state.draft.workflow.nodes.map((n) => nodeHtml(n, b, a)).join('')}</div>`;
  }
  function renderEdgesOnly(): void {
    const stage = elSw.querySelector('#fe-stage');
    const svg = stage?.querySelector('svg.edges');
    if (!svg) return;
    const tmp = document.createElement('div');
    tmp.innerHTML = renderEdges();
    svg.replaceWith(tmp.firstElementChild!);
  }

  /* ───────────── Pintado: paneles laterales ───────────── */

  function renderLeft(): void {
    const tabs: Array<[LeftTab, string]> = [['nodos', 'Nodos'], ['plantillas', 'Plantillas'], ['entorno', 'Entorno']];
    const head = `<div class="tabs" role="tablist">${tabs.map(([id, label]) => `<button class="tab" role="tab" data-act="lt" data-v="${id}" aria-selected="${state.left === id}">${label}</button>`).join('')}</div>`;
    let body = '';
    if (state.left === 'nodos') {
      const env = ENV_PRESETS[envKey]!.env;
      const q = state.query.trim().toLowerCase();
      const groups = catalogView(env).map((g) => ({ ...g, entries: g.entries.filter((e) => !q || `${e.manifest.displayName} ${e.manifest.type} ${e.hint}`.toLowerCase().includes(q)) })).filter((g) => g.entries.length);
      body = `<input class="srch" data-f="query" type="search" placeholder="Buscar nodo…" value="${esc(state.query)}" aria-label="Buscar nodo" />
        <p class="hint">Toca un nodo para añadirlo${state.sel?.kind === 'node' ? ' junto al seleccionado' : ''}. Los «en reposo» ya están construidos; se activan cuando exista lo que necesitan.</p>
        ${groups.map((g) => `<div class="lb">${esc(g.label)}</div>${g.entries.map((e) => `
          <button class="it ${e.status === 'reposo' ? 'rest' : ''}" data-act="add" data-type="${esc(e.manifest.type)}" title="${esc(e.reason ?? e.hint)}">
            ${nodeIcon(e.manifest.type, e.manifest.kind)}<b>${esc(e.manifest.displayName)}</b><i class="dot ${e.status === 'reposo' ? 'rest' : ''}" aria-label="${e.status === 'reposo' ? 'en reposo' : 'listo'}"></i>
            <small>${esc(e.hint)}${e.status === 'reposo' && e.reason ? ` <span style="color:var(--warn)">· En reposo: ${esc(e.reason)}</span>` : ''}</small>
          </button>`).join('')}`).join('') || '<p class="hint">Ningún nodo coincide.</p>'}`;
    } else if (state.left === 'plantillas') {
      const views = templatesView(ENV_PRESETS[envKey]!.env);
      body = `<p class="hint">Plantillas reales del motor. Al usarlas se carga un borrador nuevo (se puede deshacer).</p>${views.map((v) => `
        <div class="tpl"><h4>${esc(v.template.name)}</h4><div class="sm mute">${esc(v.template.description)}</div>
          <ul>${v.tools.length ? `<li>Conectores: ${v.tools.map((t) => `<code>${esc(t)}</code>`).join(' ')}</li>` : ''}${v.endpoints.length ? `<li>Endpoints: ${v.endpoints.map((t) => `<code>${esc(t)}</code>`).join(' ')}</li>` : ''}
          ${v.nodeIssues.length ? `<li style="color:var(--warn)">En este entorno quedarían en reposo ${plural(v.nodeIssues.length, 'nodo', 'nodos')}</li>` : '<li style="color:var(--good)">Todos sus nodos están listos en este entorno</li>'}</ul>
          <div class="row" style="margin-top:8px"><button class="btn gold" data-act="tpl" data-id="${esc(v.template.id)}">${icon('play')} Usar plantilla</button></div></div>`).join('')}`;
    } else {
      body = `<p class="hint">El editor no conoce todavía el estado real del runtime (no está desplegado y no se ha comprado nada). Aquí eliges qué entorno <b>simular</b> para ver qué nodos estarían listos y cuáles en reposo.</p>
        ${Object.entries(ENV_PRESETS).map(([key, p]) => `<button class="it ${key === envKey ? '' : ''}" data-act="env" data-v="${esc(key)}" aria-pressed="${key === envKey}" style="${key === envKey ? 'border-color:rgba(232,195,122,.7)' : ''}">${icon(key === envKey ? 'verify' : 'settings')}<b>${esc(p.label)}</b><i></i><small>${esc(envDescription(key))}</small></button>`).join('')}
        <p class="hint" style="margin-top:12px">Norma 7: nada de lo que está «en reposo» obliga a comprar. Es capacidad preparada para activar al final.</p>`;
    }
    elLeft.innerHTML = `${head}<div class="pn">${body}</div>`;
  }

  function envDescription(key: string): string {
    if (key === 'hoy') return 'Lo que funciona hoy sin comprar nada: conectores locales y JavaScript aislado.';
    if (key === 'conectado') return 'Añade modelo de lenguaje, planificador y un endpoint de ejemplo («clima»).';
    return 'Todo encendido (agente, investigación, webhooks, eventos, Python): para ver el flujo completo.';
  }

  function renderRight(): void {
    const a = analysis();
    const tabs: Array<[RightTab, string, string]> = [['detalle', 'Detalle', ''], ['problemas', 'Problemas', a.errors + a.warns > 0 ? String(a.errors + a.warns) : ''], ['orden', 'Orden', ''], ['archivo', 'Archivo', '']];
    const head = `<div class="tabs" role="tablist">${tabs.map(([id, label, n]) => `<button class="tab" role="tab" data-act="rt" data-v="${id}" aria-selected="${state.right === id}">${label}${n ? ` <span class="n">${n}</span>` : ''}</button>`).join('')}</div>`;
    let body = '';
    if (state.right === 'detalle') body = detailHtml();
    else if (state.right === 'problemas') body = problemsHtml(a);
    else if (state.right === 'orden') body = planHtml(a);
    else body = fileHtml();
    elRight.innerHTML = `${head}<div class="pn">${body}</div>`;
  }

  function problemsHtml(a: Analysis): string {
    if (a.problems.length === 0) {
      return `<div class="pb" style="border-color:rgba(95,211,154,.4)">${icon('verify')}<div><b>Sin problemas.</b><small>El borrador pasa la validación del motor en este entorno simulado. Publicarlo no se hace desde aquí.</small></div></div>`;
    }
    const wf = state.draft.workflow;
    const label = (id?: string) => (id ? wf.nodes.find((n) => n.id === id)?.label ?? id : 'Flujo');
    return `<p class="hint">Toca un problema para ir al nodo.</p>${a.problems.map((p) => `
      <button class="pb ${p.kind === 'entorno' ? 'warn' : p.level}" ${p.nodeId ? `data-act="goto" data-node="${esc(p.nodeId)}"` : ''}>${icon(p.kind === 'entorno' ? 'lock' : 'warn')}<div>${esc(p.text)}<small>${esc(label(p.nodeId))} · ${p.kind === 'entorno' ? 'en reposo' : esc(p.kind)}</small></div></button>`).join('')}`;
  }

  function planHtml(a: Analysis): string {
    const wf = state.draft.workflow;
    const label = (id: string) => wf.nodes.find((n) => n.id === id)?.label ?? id;
    const chip = (id: string) => `<button class="tg2" data-act="goto" data-node="${esc(id)}">${esc(label(id))}</button>`;
    return `<p class="hint">Orden previsto a partir de las conexiones. Los nodos de un mismo paso pueden ir a la vez. Las ramas se deciden al ejecutar; esto no ejecuta nada.</p>
      ${a.plan.levels.map((ids, i) => `<div class="wv"><b>${i + 1}</b><div class="l">${ids.map(chip).join('')}</div></div>`).join('') || '<p class="hint">Aún no hay pasos.</p>'}
      <div class="lb">Pausas previstas</div>
      ${a.plan.pauses.length ? a.plan.pauses.map((p) => `<div class="sm" style="margin:4px 0">${icon(p.reason === 'aprobacion' ? 'approval' : 'wait')} ${p.reason === 'aprobacion' ? 'Espera tu aprobación' : 'Espera programada'}: ${chip(p.nodeId)}</div>`).join('') : '<p class="hint">Ninguna.</p>'}
      ${a.plan.disabled.length ? `<div class="lb">Desactivados</div><div class="l" style="display:flex;gap:6px;flex-wrap:wrap">${a.plan.disabled.map(chip).join('')}</div>` : ''}`;
  }

  function fileHtml(): string {
    const blockers = exportBlockers(state.draft);
    return `<div class="lb">Exportar</div>
      <p class="hint">Un borrador exportado es un archivo JSON sin claves. Importarlo siempre lo deja como borrador.</p>
      ${blockers.length ? `<div class="pb error">${icon('lock')}<div>No se puede exportar: hay valores que parecen secretos.${blockers.map((b) => `<small>${esc(b)}</small>`).join('')}<small>Sustitúyelos por una referencia (ref:, vault:, env:).</small></div></div>` : ''}
      <div class="row"><button class="btn gold" data-act="download" ${blockers.length ? 'disabled' : ''}>Descargar .json</button><button class="btn" data-act="copy" ${blockers.length ? 'disabled' : ''}>Copiar</button></div>
      <div class="lb">Importar</div>
      <label class="fld"><span>Archivo de borrador (.json)</span><input type="file" accept="application/json,.json" data-f="importfile" /></label>
      <label class="fld"><span>…o pega el contenido</span><textarea class="json" data-f="importtext" spellcheck="false" placeholder='{"format":"janus-flow-draft", …}'>${esc(state.importText)}</textarea></label>
      ${state.importError ? `<div class="err" role="alert">${esc(state.importError)}</div>` : ''}
      <div class="row" style="margin-top:6px"><button class="btn" data-act="import">Cargar borrador</button></div>
      <div class="lb">Flujo nuevo</div>
      <div class="row"><button class="btn bad" data-act="reset">Empezar de cero</button></div>
      <p class="hint">Se puede deshacer. Publicar y ejecutar siguen siendo del motor, con aprobación del Founder.</p>`;
  }

  /* ───────────── Detalle: flujo, nodo y conexión ───────────── */

  function detailHtml(): string {
    if (state.sel?.kind === 'edge') return edgeHtml(state.sel);
    const node = selectedNode();
    return node ? nodeFormHtml(node) : flowFormHtml();
  }

  function flowFormHtml(): string {
    const wf = state.draft.workflow;
    return `<div class="lb">Ajustes del flujo</div>
      <label class="fld"><span>Nombre</span><input data-ff="name" value="${esc(wf.name)}" maxlength="80" /></label>
      <label class="fld"><span>ID (sin espacios)</span><input data-ff="id" value="${esc(wf.id)}" maxlength="64" spellcheck="false" /></label>
      <label class="fld"><span>Ejecuciones a la vez</span><input data-ff="maxConcurrency" type="number" min="1" max="20" step="1" value="${wf.maxConcurrency}" /></label>
      <label class="fld"><span>Tiempo límite del flujo (ms; vacío = sin límite propio)</span><input data-ff="executionTimeoutMs" type="number" min="1000" step="1000" value="${wf.executionTimeoutMs ?? ''}" /></label>
      <label class="fld"><span>Etiquetas (separadas por comas)</span><input data-ff="tags" value="${esc((wf.tags ?? []).join(', '))}" /></label>
      <div class="err" data-err-for="flow" role="alert"></div>
      <div class="lb">Cómo se pasan los datos</div>
      ${EXPRESSION_HELP.map((h) => `<div class="sm" style="margin:5px 0"><code>${esc(h.code)}</code> <span class="mute">${esc(h.text)}</span></div>`).join('')}
      <p class="hint">Toca un nodo del lienzo para editarlo. Toca una línea para quitarla.</p>`;
  }

  function edgeHtml(s: { from: string; to: string; branch?: string }): string {
    const from = nodeOf(s.from), to = nodeOf(s.to);
    return `<div class="lb">Conexión</div>
      <div class="sm"><b>${esc(from?.label ?? s.from)}</b> → <b>${esc(to?.label ?? s.to)}</b>${s.branch ? `<br>Rama: <code>${esc(s.branch)}</code>` : ''}</div>
      <div class="row" style="margin-top:10px"><button class="btn bad" data-act="unlink" data-from="${esc(s.from)}" data-to="${esc(s.to)}" data-branch="${esc(s.branch ?? '')}">${icon('trash')} Quitar conexión</button><button class="btn" data-act="deselect">Cerrar</button></div>`;
  }

  function isLong(key: string, value: string): boolean {
    return /source|template|prompt|message|text|objective|question|input/i.test(key) || value.includes('\n') || value.length > 70;
  }

  function paramHtml(node: WorkflowNode, key: string): string {
    const value = node.parameters[key];
    const help = guideFor(node.type).help[key];
    const err = state.paramErrors[`${node.id}.${key}`];
    const remove = `<button class="btn sq" data-act="prm-del" data-k="${esc(key)}" title="Quitar parámetro" aria-label="Quitar el parámetro ${esc(key)}">${icon('trash')}</button>`;
    let field: string;
    if (typeof value === 'boolean') field = `<label class="chk"><input type="checkbox" data-p="${esc(key)}" data-pt="boolean" ${value ? 'checked' : ''} /> ${esc(key)}</label>`;
    else if (typeof value === 'number') field = `<label class="fld"><span>${esc(key)}</span><input type="number" step="any" data-p="${esc(key)}" data-pt="number" value="${value}" /></label>`;
    else if (typeof value === 'string') field = isLong(key, value)
      ? `<label class="fld"><span>${esc(key)}</span><textarea data-p="${esc(key)}" data-pt="string" spellcheck="false">${esc(value)}</textarea></label>`
      : `<label class="fld"><span>${esc(key)}</span><input data-p="${esc(key)}" data-pt="string" value="${esc(value)}" spellcheck="false" /></label>`;
    else field = `<label class="fld"><span>${esc(key)} <i class="mute">(JSON)</i></span><textarea data-p="${esc(key)}" data-pt="json" spellcheck="false">${esc(JSON.stringify(value, null, 2) ?? 'null')}</textarea></label>`;
    return `<div class="row" style="align-items:flex-end;flex-wrap:nowrap"><div style="flex:1;min-width:0">${field}${help ? `<div class="hint">${esc(help)}</div>` : ''}<div class="err" data-err-for="${esc(key)}" role="alert">${err ? esc(err) : ''}</div></div>${remove}</div>`;
  }

  function nodeFormHtml(node: WorkflowNode): string {
    const a = analysis();
    const manifest = manifestByType.get(node.type);
    const info = a.byNode.get(node.id);
    const guide = guideFor(node.type);
    const wf = state.draft.workflow;
    const keys = Object.keys(node.parameters);
    const missing = suggestedParams(node);
    const incoming = wf.connections.filter((c) => c.to === node.id);
    const outgoing = wf.connections.filter((c) => c.from === node.id);
    const branches = branchOutputs(node);
    const forcedApproval = node.kind === 'approval' || node.risk === 'high' || !node.reversible;
    const tools = knownToolActions();
    const conn = (c: WorkflowConnection, dir: 'in' | 'out') => {
      const otherId = dir === 'in' ? c.from : c.to;
      return `<div class="row" style="justify-content:space-between;flex-wrap:nowrap;margin:3px 0"><span class="sm" style="min-width:0;overflow:hidden;text-overflow:ellipsis">${dir === 'in' ? '←' : '→'} ${esc(nodeOf(otherId)?.label ?? otherId)}${c.branch ? ` <code>${esc(c.branch)}</code>` : ''}</span><button class="btn sq" data-act="unlink" data-from="${esc(c.from)}" data-to="${esc(c.to)}" data-branch="${esc(c.branch ?? '')}" aria-label="Quitar esta conexión" title="Quitar">${icon('trash')}</button></div>`;
    };
    return `<div data-node-form="${esc(node.id)}">
      <div class="row" style="gap:10px;flex-wrap:nowrap">${nodeIcon(node.type, node.kind, 'ic big')}<div style="min-width:0"><b>${esc(manifest?.displayName ?? node.type)}</b><div class="hint">${esc(guide.hint)}</div></div></div>
      ${info?.rest ? `<div class="pb warn" style="margin-top:8px">${icon('lock')}<div>En reposo en este entorno${manifest?.reason ? `: ${esc(manifest.reason)}` : ''}<small>Está construido; se activa cuando exista lo que necesita. No obliga a comprar nada.</small></div></div>` : ''}
      ${(info?.errors ?? 0) + (info?.warns ?? 0) > 0 && !(info?.rest && (info?.errors ?? 0) + (info?.warns ?? 0) === 1) ? `<button class="btn" style="margin-top:8px" data-act="rt" data-v="problemas">${plural((info?.errors ?? 0) + (info?.warns ?? 0), 'problema', 'problemas')} en este nodo</button>` : ''}
      <label class="fld"><span>Nombre visible</span><input data-f="label" value="${esc(node.label)}" maxlength="80" /></label>
      <div class="sm mute">ID: <code>${esc(node.id)}</code> · tipo <code>${esc(node.type)}</code></div>

      <div class="lb">Parámetros</div>
      ${keys.length ? keys.map((k) => paramHtml(node, k)).join('') : '<p class="hint">Este nodo no necesita parámetros.</p>'}
      ${missing.length ? `<div class="row" style="margin:6px 0">${missing.map((k) => `<button class="btn" data-act="prm-add" data-k="${esc(k)}">+ ${esc(k)}</button>`).join('')}</div>` : ''}
      <div class="row" style="flex-wrap:nowrap"><input class="srch" data-f="newparam" placeholder="Parámetro propio" maxlength="40" aria-label="Nombre del parámetro nuevo" spellcheck="false" /><button class="btn sq" data-act="prm-new" aria-label="Añadir parámetro">${icon('add')}</button></div>
      <div class="hint">Puedes usar datos del flujo: <code>{{ $input }}</code>, <code>{{ $nodes.id.output }}</code>. Nunca pegues claves: usa una referencia (ref:, vault:, env:).</div>

      ${node.type === 'action.tool' ? `
        <div class="lb">Conector y acción</div>
        <label class="fld"><span>Conector</span><input list="fe-tools" data-f="tool" value="${esc(node.toolOperation?.tool ?? '')}" spellcheck="false" /></label>
        <label class="fld"><span>Acción</span><input list="fe-actions" data-f="action" value="${esc(node.toolOperation?.action ?? '')}" spellcheck="false" /></label>
        <datalist id="fe-tools">${[...new Set(tools.map((t) => t.tool))].map((t) => `<option value="${esc(t)}"></option>`).join('')}</datalist>
        <datalist id="fe-actions">${tools.map((t) => `<option value="${esc(t.action)}">${esc(t.tool)}</option>`).join('')}</datalist>` : node.toolOperation ? `<div class="sm mute" style="margin-top:8px">Operación: <code>${esc(node.toolOperation.tool)}.${esc(node.toolOperation.action)}</code></div>` : ''}

      ${node.executionMode === 'agentic' ? `
        <div class="lb">Agente</div>
        <label class="fld"><span>Objetivo</span><textarea data-f="objective" spellcheck="false">${esc(node.agentOperation?.objective ?? '')}</textarea></label>
        <div class="hint">Capacidades: ${(node.agentOperation?.requiredCapabilities ?? []).map((c) => `<code>${esc(c)}</code>`).join(' ') || 'ninguna'}</div>` : ''}

      <div class="lb">Seguridad y ejecución</div>
      <label class="fld"><span>Riesgo</span><select data-f="risk">${(Object.keys(RISK_LABEL) as WorkflowRisk[]).map((r) => `<option value="${r}" ${node.risk === r ? 'selected' : ''}>${RISK_LABEL[r]}</option>`).join('')}</select></label>
      <label class="chk"><input type="checkbox" data-f="reversible" ${node.reversible ? 'checked' : ''} /> Se puede deshacer</label>
      <label class="chk"><input type="checkbox" data-f="approval" ${node.requiresApproval ? 'checked' : ''} ${forcedApproval ? 'disabled' : ''} /> Pide tu aprobación antes de ejecutarse</label>
      <div class="hint" data-sync="approval-hint" ${forcedApproval ? '' : 'hidden'}>Obligatorio: el nodo es de aprobación, de riesgo alto o irreversible.</div>
      <label class="fld"><span>Tiempo límite del nodo (ms)</span><input type="number" min="1" step="100" data-f="timeout" value="${node.timeoutMs ?? ''}" /></label>
      <div class="row" style="flex-wrap:nowrap"><label class="fld" style="flex:1"><span>Reintentos (intentos totales)</span><input type="number" min="1" max="10" step="1" data-f="retryMax" value="${node.retry?.maxAttempts ?? ''}" /></label><label class="fld" style="flex:1"><span>Espera entre intentos (ms)</span><input type="number" min="0" step="100" data-f="retryBackoff" value="${node.retry?.backoffMs ?? ''}" /></label></div>
      <label class="fld"><span>Si falla</span><select data-f="onerror">${Object.entries(ONERR_LABEL).map(([k, v]) => `<option value="${k}" ${(node.onError ?? 'fail') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="fld"><span>Credenciales (solo referencias, separadas por comas)</span><input data-f="creds" value="${esc((node.credentialRefs ?? []).join(', '))}" placeholder="ref:google-workspace" spellcheck="false" /></label>
      <label class="chk"><input type="checkbox" data-f="disabled" ${node.disabled ? 'checked' : ''} /> Desactivado (el flujo lo salta)</label>
      <div class="err" data-err-for="node" role="alert"></div>

      <div class="lb">Conexiones</div>
      ${incoming.map((c) => conn(c, 'in')).join('')}${outgoing.map((c) => conn(c, 'out')).join('')}
      ${incoming.length + outgoing.length === 0 ? '<p class="hint">Sin conexiones todavía.</p>' : ''}
      <div class="row" style="margin-top:8px"><button class="btn gold" data-act="link" data-node="${esc(node.id)}">${icon('link')} Conectar salida${branches.length ? ' (con rama)' : ''}</button></div>
      <div class="row" style="margin-top:12px"><button class="btn" data-act="dup">Duplicar</button><button class="btn bad" data-act="del">${icon('trash')} Eliminar nodo</button></div>
    </div>`;
  }

  /* ───────────── Pintado conjunto ───────────── */

  function renderAll(): void {
    renderHd(); renderToolbar(); renderBanner(); renderStage(); renderLeft(); renderRight(); renderFt();
  }
  /** Tras editar un campo del panel derecho: se repinta todo MENOS ese panel (sustituirlo en pleno cambio de foco perdería el toque). */
  function renderAfterFieldEdit(): void {
    renderHd(); renderToolbar(); renderStage(); renderFt();
    const a = analysis();
    const badge = elRight.querySelector('[data-v="problemas"]');
    if (badge) badge.innerHTML = `Problemas${a.errors + a.warns > 0 ? ` <span class="n">${a.errors + a.warns}</span>` : ''}`;
    syncForm();
  }
  function syncForm(): void {
    const node = selectedNode();
    const form = elRight.querySelector<HTMLElement>('[data-node-form]');
    if (!node || !form) return;
    const set = (selector: string, fn: (el: HTMLInputElement | HTMLSelectElement) => void) => { const el = form.querySelector<HTMLInputElement | HTMLSelectElement>(selector); if (el) fn(el); };
    set('[data-f=risk]', (el) => { el.value = node.risk; });
    set('[data-f=reversible]', (el) => { (el as HTMLInputElement).checked = node.reversible; });
    const forced = node.kind === 'approval' || node.risk === 'high' || !node.reversible;
    set('[data-f=approval]', (el) => { (el as HTMLInputElement).checked = node.requiresApproval; (el as HTMLInputElement).disabled = forced; });
    const hint = form.querySelector<HTMLElement>('[data-sync=approval-hint]');
    if (hint) hint.hidden = !forced;
  }

  /* ───────────── Acciones ───────────── */

  function select(sel: Sel, tab?: RightTab): void {
    state.sel = sel;
    if (tab) state.right = tab;
    renderStage(); renderRight(); renderToolbar();
  }

  function addFromPalette(type: string): void {
    const manifest = manifestByType.get(type);
    if (!manifest) return;
    const near = state.sel?.kind === 'node' ? state.sel.id : undefined;
    const result = addNode(state.draft, manifest, near, orientation());
    if (!applyEdit(result)) return;
    const id = (result as { id?: string }).id;
    // Si hay un nodo seleccionado que aún no tiene salida, el nuevo se conecta a continuación (lo habitual al construir un flujo).
    const nearNode = near ? nodeOf(near) : undefined;
    let auto = false;
    if (id && nearNode && manifest.kind !== 'trigger' && branchOutputs(nearNode).length === 0 && !state.draft.workflow.connections.some((c) => c.from === near)) {
      const linked = connect(state.draft, near!, id);
      if (linked.ok) { commitMerge(linked.draft); auto = true; }
    }
    state.sel = id ? { kind: 'node', id } : state.sel;
    state.right = 'detalle';
    renderAll();
    toast(`«${manifest.displayName}» añadido${auto ? ' y conectado' : ''}.`);
    scrollToNode(id);
    if (isMobile()) elFe.querySelector('#fe-cv')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  /** Fusiona un cambio con el paso de historial anterior (añadir + conectar se deshacen juntos). */
  function commitMerge(next: FlowDraft): void { state.draft = next; persist(); }

  function tryLink(toId: string): void {
    const l = state.linking;
    if (!l || l.choosing) return;
    const result = connect(state.draft, l.from, toId, l.branch);
    if (!result.ok) { toast(result.error, 'bad'); return; }
    commit(result.draft);
    state.linking = null;
    state.sel = { kind: 'edge', from: l.from, to: toId, ...(l.branch ? { branch: l.branch } : {}) };
    state.right = 'detalle';
    renderAll();
    toast('Conexión creada.');
  }

  function startLink(nodeId: string, branch?: string): void {
    const node = nodeOf(nodeId);
    if (!node) return;
    if (state.linking?.from === nodeId && !state.linking.choosing) { state.linking = null; renderAll(); return; }
    if (branch === 'error') state.linking = { from: nodeId, branch, choosing: false };
    else if (branchOutputs(node).length > 0) state.linking = { from: nodeId, choosing: true };
    else state.linking = { from: nodeId, choosing: false };
    state.sel = { kind: 'node', id: nodeId };
    renderAll();
  }

  function removeSelection(): void {
    if (state.sel?.kind === 'node') {
      const id = state.sel.id;
      if (!applyEdit(removeNode(state.draft, id), 'Nodo eliminado (se puede deshacer).')) return;
    } else if (state.sel?.kind === 'edge') {
      const s = state.sel;
      commit(disconnect(state.draft, s.from, s.to, s.branch));
      toast('Conexión quitada.');
    } else return;
    state.sel = null;
    renderAll();
  }

  function loadDraft(next: FlowDraft, example: string | null, message: string): void {
    commit(next, true);
    state.example = example;
    state.sel = null; state.linking = null; state.paramErrors = {}; state.importError = ''; state.importText = '';
    state.right = 'detalle';
    renderAll();
    fitZoom();
    toast(message);
  }

  function fitZoom(): void {
    const b = bounds();
    const vw = elScroll.clientWidth || 600, vh = elScroll.clientHeight || 400;
    state.zoom = Math.round(Math.min(1, Math.max(0.7, Math.min(vw / b.w, vh / b.h))) * 100) / 100;
    renderToolbar(); renderStage();
    elScroll.scrollTo({ left: 0, top: 0 });
  }
  function setZoom(z: number): void {
    state.zoom = Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z)) * 100) / 100;
    renderToolbar(); renderStage();
  }
  function scrollToNode(id?: string): void {
    if (!id) return;
    const b = bounds();
    const p = posOf(id);
    const z = state.zoom;
    const left = (p.x + b.sx + NODE_W / 2) * z - elScroll.clientWidth / 2;
    const top = (p.y + b.sy + NODE_H / 2) * z - elScroll.clientHeight / 2;
    elScroll.scrollTo({ left: Math.max(0, left), top: Math.max(0, top) });
  }
  function isMobile(): boolean { return typeof matchMedia === 'function' && matchMedia('(max-width:760px)').matches; }

  /* ───────────── Eventos: clics ───────────── */

  root.addEventListener('click', (event) => {
    const target = event.target as Element;
    const el = target.closest<HTMLElement>('[data-act]');
    if (!el || !root.contains(el)) return;
    const act = el.dataset.act!;
    switch (act) {
      case 'lt': state.left = el.dataset.v as LeftTab; renderLeft(); break;
      case 'rt': state.right = el.dataset.v as RightTab; renderRight(); break;
      case 'toggle-left': state.leftOpen = !state.leftOpen; renderToolbar(); break;
      case 'goto-palette': state.leftOpen = true; state.left = 'nodos'; renderToolbar(); renderLeft(); elLeft.scrollIntoView({ block: 'start', behavior: 'smooth' }); break;
      case 'goto-detail': elRight.scrollIntoView({ block: 'start', behavior: 'smooth' }); break;
      case 'add': addFromPalette(el.dataset.type!); break;
      case 'tpl': {
        const template = FLOW_TEMPLATES.find((t) => t.id === el.dataset.id);
        if (template) loadDraft(draftFromTemplate(template, orientation()), template.id, `Plantilla «${template.name}» cargada.`);
        break;
      }
      case 'env': setEnv(el.dataset.v!); break;
      case 'undo': undo(); break;
      case 'redo': redo(); break;
      case 'relayout': commit({ ...state.draft, layout: autoLayout(state.draft.workflow, {}, orientation()) }); renderAll(); fitZoom(); toast('Nodos recolocados por pasos.'); break;
      case 'orient': state.vertical = !state.vertical; persistView(); commit({ ...state.draft, layout: autoLayout(state.draft.workflow, {}, orientation()) }, true); renderAll(); fitZoom(); toast(state.vertical ? 'Pasos de arriba abajo.' : 'Pasos de izquierda a derecha.'); break;
      case 'zoom-in': setZoom(state.zoom + 0.1); break;
      case 'zoom-out': setZoom(state.zoom - 0.1); break;
      case 'zoom-fit': fitZoom(); break;
      case 'out': startLink(el.dataset.node!); break;
      case 'err': startLink(el.dataset.node!, 'error'); break;
      case 'link': startLink(el.dataset.node!); break;
      case 'branch': if (state.linking) { state.linking = { ...state.linking, branch: el.dataset.v!, choosing: false }; renderBanner(); renderStage(); } break;
      case 'cancel-link': state.linking = null; renderBanner(); renderStage(); renderToolbar(); break;
      case 'edge': select({ kind: 'edge', from: el.dataset.from!, to: el.dataset.to!, ...(el.dataset.branch ? { branch: el.dataset.branch } : {}) }, 'detalle'); break;
      case 'unlink': {
        commit(disconnect(state.draft, el.dataset.from!, el.dataset.to!, el.dataset.branch || undefined));
        if (state.sel?.kind === 'edge') state.sel = null;
        renderAll(); toast('Conexión quitada.'); break;
      }
      case 'deselect': select(null); break;
      case 'goto': {
        const id = el.dataset.node!;
        if (nodeOf(id)) { state.sel = { kind: 'node', id }; state.right = 'detalle'; renderStage(); renderRight(); scrollToNode(id); }
        break;
      }
      case 'dup': { const s = selectedNode(); if (s && applyEdit(duplicateNode(state.draft, s.id, orientation()), 'Nodo duplicado.')) { state.sel = { kind: 'node', id: lastId() }; renderAll(); } break; }
      case 'del': removeSelection(); break;
      case 'prm-del': editNode({ parameters: withoutKey(selectedNode()?.parameters ?? {}, el.dataset.k!) }, true); break;
      case 'prm-add': addParam(el.dataset.k!); break;
      case 'prm-new': addCustomParam(); break;
      case 'download': {
        if (exportBlockers(state.draft).length) break;
        doDownload(`${state.draft.workflow.id}.janus-flow.json`, serializeDraft(state.draft)); toast('Borrador descargado.'); break;
      }
      case 'copy': {
        if (exportBlockers(state.draft).length) break;
        void doCopy(serializeDraft(state.draft)).then(() => toast('Borrador copiado.'), () => toast('No se pudo copiar; usa «Descargar».', 'bad')); break;
      }
      case 'import': importFromText(state.importText); break;
      case 'reset': loadDraft(newDraft(clock().toISOString(), manifestsAll), null, 'Flujo nuevo. Si te equivocas, usa «Deshacer».'); break;
      default: break;
    }
  }, { signal: on });

  function lastId(): string { const nodes = state.draft.workflow.nodes; return nodes[nodes.length - 1]!.id; }
  function withoutKey(obj: Record<string, unknown>, key: string): Record<string, unknown> { const copy = { ...obj }; delete copy[key]; return copy; }

  function setEnv(key: string): void {
    if (!ENV_PRESETS[key]) return;
    envKey = key; state.envKey = key; memo = null;
    renderAll();
    toast(`Entorno simulado: ${ENV_PRESETS[key]!.label}.`);
  }

  /* ───────────── Edición de nodos desde el panel ───────────── */

  /** Aplica un cambio al nodo seleccionado. `rerender`: repintar también el panel (solo tras un clic en botón, nunca tras un `change`). */
  function editNode(patch: Partial<WorkflowNode>, rerender = false): boolean {
    const node = selectedNode();
    if (!node) return false;
    const result = updateNode(state.draft, node.id, patch);
    if (!result.ok) { toast(result.error, 'bad'); return false; }
    commit(result.draft);
    if (rerender) renderAll(); else renderAfterFieldEdit();
    return true;
  }
  function addParam(key: string): void {
    const node = selectedNode();
    const manifest = node ? manifestByType.get(node.type) : undefined;
    if (!node || !manifest) return;
    const value = createNode(manifest, 'tmp').parameters[key];
    editNode({ parameters: { ...node.parameters, [key]: value ?? '' } }, true);
  }
  function addCustomParam(): void {
    const node = selectedNode();
    const input = elRight.querySelector<HTMLInputElement>('[data-f=newparam]');
    if (!node || !input) return;
    const name = input.value.trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,39}$/.test(name) || FORBIDDEN.has(name)) { toast('El nombre admite letras, números y «_», sin empezar por número.', 'bad'); return; }
    if (name in node.parameters) { toast('Ese parámetro ya existe.', 'bad'); return; }
    editNode({ parameters: { ...node.parameters, [name]: '' } }, true);
  }
  function setErr(key: string, text: string): void {
    const node = selectedNode();
    if (node) { if (text) state.paramErrors[`${node.id}.${key}`] = text; else delete state.paramErrors[`${node.id}.${key}`]; }
    const holder = elRight.querySelector<HTMLElement>(`[data-err-for="${CSS.escape(key)}"]`);
    if (holder) holder.textContent = text;
  }

  /* ───────────── Eventos: cambios y escritura ───────────── */

  root.addEventListener('change', (event) => {
    const el = event.target as HTMLInputElement;
    const f = el.dataset?.f;
    if (!f && !el.dataset?.p && !el.dataset?.ff) return;

    if (f === 'flowname') {
      const next = renameFlow(state.draft, el.value);
      if (next.workflow.name !== state.draft.workflow.name) { commit(next); }
      el.value = state.draft.workflow.name;
      return;
    }
    if (f === 'importfile') {
      const file = el.files?.[0];
      if (!file) return;
      if (file.size > 512 * 1024) { state.importError = 'El archivo es demasiado grande (máximo 512 KB).'; renderRight(); return; }
      void file.text().then((text) => importFromText(text), () => { state.importError = 'No se pudo leer el archivo.'; renderRight(); });
      return;
    }
    if (f === 'importtext') { state.importText = el.value; return; }

    if (el.dataset.ff) { flowSetting(el.dataset.ff, el.value); return; }

    const node = selectedNode();
    if (!node) return;
    if (el.dataset.p) { paramChange(node, el.dataset.p, el.dataset.pt ?? 'string', el); return; }
    switch (f) {
      case 'label': editNode({ label: el.value.replace(/\s+/g, ' ').trim().slice(0, 80) || node.label }); break;
      case 'risk': editNode({ risk: el.value as WorkflowRisk }); break;
      case 'reversible': editNode({ reversible: el.checked }); break;
      case 'approval': editNode({ requiresApproval: el.checked }); break;
      case 'disabled': editNode({ disabled: el.checked ? true : undefined }); break;
      case 'onerror': editNode({ onError: el.value === 'fail' ? undefined : (el.value as WorkflowNode['onError']) }); break;
      case 'timeout': editNode({ timeoutMs: el.value === '' ? undefined : Number(el.value) }); break;
      case 'retryMax':
      case 'retryBackoff': {
        const max = Number((elRight.querySelector<HTMLInputElement>('[data-f=retryMax]')?.value) || 0);
        const back = Number((elRight.querySelector<HTMLInputElement>('[data-f=retryBackoff]')?.value) || 0);
        editNode({ retry: max >= 1 ? { maxAttempts: Math.min(10, Math.floor(max)), backoffMs: Math.max(0, Math.floor(back)) } : undefined });
        break;
      }
      case 'creds': {
        const refs = el.value.split(',').map((s) => s.trim()).filter(Boolean);
        editNode({ credentialRefs: refs.length ? refs : undefined }); break;
      }
      case 'tool': editNode({ toolOperation: { tool: el.value.trim(), action: node.toolOperation?.action ?? '' } }); break;
      case 'action': editNode({ toolOperation: { tool: node.toolOperation?.tool ?? '', action: el.value.trim() } }); break;
      case 'objective': editNode({ agentOperation: { requiredCapabilities: node.agentOperation?.requiredCapabilities ?? [], objective: el.value.trim() } }); break;
      default: break;
    }
  }, { signal: on });

  function paramChange(node: WorkflowNode, key: string, type: string, el: HTMLInputElement): void {
    if (FORBIDDEN.has(key)) return;
    let value: unknown;
    if (type === 'boolean') value = el.checked;
    else if (type === 'number') {
      if (el.value.trim() === '' || !Number.isFinite(Number(el.value))) { setErr(key, 'Escribe un número.'); return; }
      value = Number(el.value);
    } else if (type === 'json') {
      try { value = JSON.parse(el.value); } catch { setErr(key, 'No es un JSON válido; no se ha guardado.'); return; }
      if (JSON.stringify(value) === undefined) { setErr(key, 'Valor no admitido.'); return; }
    } else value = el.value;
    setErr(key, '');
    editNode({ parameters: { ...node.parameters, [key]: value } });
  }

  function flowSetting(field: string, raw: string): void {
    const errHolder = elRight.querySelector<HTMLElement>('[data-err-for="flow"]');
    const fail = (text: string) => { if (errHolder) errHolder.textContent = text; };
    let result: EditResult;
    if (field === 'name') result = { ok: true, draft: renameFlow(state.draft, raw) };
    else if (field === 'id') result = updateFlowSettings(state.draft, { id: raw.trim() });
    else if (field === 'maxConcurrency') result = updateFlowSettings(state.draft, { maxConcurrency: Number(raw) });
    else if (field === 'executionTimeoutMs') result = updateFlowSettings(state.draft, { executionTimeoutMs: raw.trim() === '' ? null : Number(raw) });
    else if (field === 'tags') result = updateFlowSettings(state.draft, { tags: raw.split(',') });
    else return;
    if (!result.ok) { fail(result.error); return; }
    fail('');
    commit(result.draft);
    renderHd(); renderFt();
  }

  root.addEventListener('input', (event) => {
    const el = event.target as HTMLInputElement;
    if (el.dataset?.f === 'query') {
      state.query = el.value;
      const caret = el.selectionStart;
      renderLeft();
      const again = elLeft.querySelector<HTMLInputElement>('[data-f=query]');
      if (again) { again.focus(); if (caret !== null) again.setSelectionRange(caret, caret); }
    } else if (el.dataset?.f === 'importtext') state.importText = el.value;
  }, { signal: on });

  /* ───────────── Importar ───────────── */

  function importFromText(text: string): void {
    const parsed = parseDraft(text, orientation());
    if (!parsed.ok) { state.importError = parsed.error; state.right = 'archivo'; renderRight(); return; }
    loadDraft(parsed.draft, null, 'Borrador importado (siempre entra como borrador).');
  }

  /* ───────────── Eventos: lienzo (tocar y arrastrar) ───────────── */

  elScroll.addEventListener('pointerdown', (event) => {
    const target = event.target as Element;
    if (event.button > 0 || target.closest('.pt') || target.closest('[data-act]')) return;
    const nd = target.closest<HTMLElement>('.nd');
    if (!nd) { if (!state.linking && state.sel) { /* tocar el fondo deselecciona al soltar */ } return; }
    const id = nd.dataset.node!;
    const origin = { ...(state.draft.layout[id] ?? { x: 40, y: 40 }) };
    drag = { id, startX: event.clientX, startY: event.clientY, origin, moved: false, cur: origin };
    try { nd.setPointerCapture(event.pointerId); } catch { /* captura no disponible */ }
  }, { signal: on });

  elScroll.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const dx = (event.clientX - drag.startX) / state.zoom, dy = (event.clientY - drag.startY) / state.zoom;
    if (!drag.moved && Math.hypot(dx, dy) * state.zoom < 6) return;
    drag.moved = true;
    drag.cur = { x: Math.round(drag.origin.x + dx), y: Math.round(drag.origin.y + dy) };
    const b = bounds();
    const nd = elSw.querySelector<HTMLElement>(`[data-node="${CSS.escape(drag.id)}"]`);
    if (nd) { nd.style.left = `${drag.cur.x + b.sx}px`; nd.style.top = `${drag.cur.y + b.sy}px`; }
    renderEdgesOnly();
  }, { signal: on });

  const endDrag = (event: PointerEvent, cancelled: boolean): void => {
    const d = drag;
    drag = null;
    if (!d) return;
    if (d.moved && !cancelled) { commit(moveNode(state.draft, d.id, d.cur)); renderStage(); renderToolbar(); return; }
    if (d.moved) { renderStage(); return; }
    // Un toque sin arrastre: conectar (si hay una conexión en curso) o seleccionar.
    void event;
    if (state.linking && !state.linking.choosing) {
      if (state.linking.from === d.id) { state.linking = null; renderAll(); return; }
      tryLink(d.id);
      return;
    }
    state.sel = { kind: 'node', id: d.id };
    state.right = 'detalle';
    renderStage(); renderRight(); renderToolbar();
  };
  elScroll.addEventListener('pointerup', (event) => endDrag(event, false), { signal: on });
  elScroll.addEventListener('pointercancel', (event) => endDrag(event, true), { signal: on });

  // Tocar el fondo vacío del lienzo quita la selección.
  elScroll.addEventListener('click', (event) => {
    const target = event.target as Element;
    if (target.closest('.nd') || target.closest('[data-act]') || target.closest('.banner')) return;
    if (state.sel) select(null);
  }, { signal: on });

  // Teclado: Supr elimina lo seleccionado, Esc cancela la conexión, Ctrl/⌘+Z/Y deshace y rehace.
  root.addEventListener('keydown', (event) => {
    const target = event.target as HTMLElement;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
    if (event.key === 'Escape' && state.linking) { state.linking = null; renderBanner(); renderStage(); renderToolbar(); return; }
    if (typing) return;
    if ((event.key === 'Delete' || event.key === 'Backspace') && state.sel) { event.preventDefault(); removeSelection(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); return; }
    if ((event.key === 'Enter' || event.key === ' ') && target.classList.contains('nd')) {
      event.preventDefault();
      const id = target.dataset.node!;
      if (state.linking && !state.linking.choosing) tryLink(id); else { state.sel = { kind: 'node', id }; state.right = 'detalle'; renderStage(); renderRight(); }
    }
  }, { signal: on });

  /* ───────────── Arranque ───────────── */

  renderAll();
  requestAnimationFrame(() => { fitZoom(); });
  if (startMessage) toast(startMessage);

  return {
    getDraft: () => state.draft,
    setEnv,
    destroy: () => { abort.abort(); if (toastTimer) clearTimeout(toastTimer); root.innerHTML = ''; },
  };
}

/* ───────────────────────────── Utilidades del navegador ───────────────────────────── */

function safeStorage(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}
function defaultDownload(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
async function defaultCopy(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return; }
  const area = document.createElement('textarea');
  area.value = text; area.style.position = 'fixed'; area.style.opacity = '0'; document.body.appendChild(area); area.select();
  const ok = document.execCommand('copy'); area.remove();
  if (!ok) throw new Error('copy failed');
}

export { isPublishReady };
export type { NodeCatalogEnv };
