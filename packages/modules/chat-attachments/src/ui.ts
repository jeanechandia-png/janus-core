import jsQR from '../vendor/jsQR.cjs';
import {
  ATTACHMENT_PROFILES,
  MAX_INLINE_TEXT_CHARS,
  checkFile,
  classifyScan,
  describeAttachmentsForMessage,
  formatBytes,
  type AttachmentProfile,
  type AttachmentProfileId,
  type AttachmentRef,
  type AttachmentSource,
  type ScanClassification,
} from './core.js';

/**
 * Botón «+» para compositores de chat: archivos, foto, escáner (QR / código de barras) y captura de documentos.
 * Sin dependencias de red; solo DOM. Todo texto de usuario entra con textContent (nunca innerHTML).
 */

export interface AttachMenuOptions {
  /** Contenedor donde se insertan el botón «+» y las fichas de adjuntos. */
  host: HTMLElement;
  profile: AttachmentProfileId;
  /** Si existe, cada archivo se sube con POST (cuerpo = bytes) y la respuesta debe traer `{ id, sha256? }`. */
  uploadUrl?: string;
  headers?: () => Record<string, string>;
  onScan?: (scan: ScanClassification) => void;
  onChange?: (state: { attachments: AttachmentRef[]; scans: ScanClassification[] }) => void;
}

export interface AttachMenuHandle {
  getAttachments(): AttachmentRef[];
  getScans(): ScanClassification[];
  /** Texto con los adjuntos y códigos para anexar al mensaje (con la nota «datos, no órdenes»). */
  buildMessageSuffix(): string;
  clear(): void;
  destroy(): void;
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string; format: string }>>;
}
interface BarcodeDetectorCtor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
}

const STYLE_ID = 'jx-attach-style';
const CSS = `
.jx-att-bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 8px}
.jx-att-plus{inline-size:44px;block-size:44px;border-radius:50%;border:1px solid var(--jx-att-border,rgba(255,255,255,.25));background:var(--jx-att-bg,rgba(255,255,255,.08));color:var(--jx-att-fg,inherit);font:600 24px/1 system-ui,sans-serif;cursor:pointer;display:grid;place-items:center}
.jx-att-plus[aria-expanded="true"]{transform:rotate(45deg)}
.jx-att-menu{position:absolute;z-index:50;min-inline-size:220px;padding:6px;border-radius:14px;border:1px solid var(--jx-att-border,rgba(255,255,255,.2));background:var(--jx-att-menu-bg,#12161f);color:var(--jx-att-fg,#f2f5fa);box-shadow:0 12px 32px rgba(0,0,0,.45)}
.jx-att-menu button{display:flex;gap:10px;align-items:center;inline-size:100%;min-block-size:44px;padding:8px 12px;border:0;border-radius:10px;background:transparent;color:inherit;font:inherit;text-align:start;cursor:pointer}
.jx-att-menu button:hover,.jx-att-menu button:focus-visible{background:rgba(255,255,255,.1);outline:none}
.jx-att-chip{display:inline-flex;gap:6px;align-items:center;max-inline-size:100%;padding:6px 10px;border-radius:999px;border:1px solid var(--jx-att-border,rgba(255,255,255,.2));background:var(--jx-att-chip-bg,rgba(255,255,255,.07));font:13px system-ui,sans-serif}
.jx-att-chip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-inline-size:34ch}
.jx-att-chip[data-state="error"]{border-color:#ff7a7a}
.jx-att-chip[data-state="uploading"]{opacity:.7}
.jx-att-chip button{border:0;background:transparent;color:inherit;font-size:16px;cursor:pointer;min-inline-size:28px;min-block-size:28px}
.jx-att-note{inline-size:100%;font:12px system-ui,sans-serif;opacity:.8}
.jx-att-scan{position:fixed;inset:0;z-index:100;background:#000;display:flex;flex-direction:column;color:#fff;font:15px system-ui,sans-serif}
.jx-att-scan video{flex:1;min-block-size:0;object-fit:cover;inline-size:100%}
.jx-att-scan-hud{padding:12px 16px calc(12px + env(safe-area-inset-bottom));display:flex;gap:10px;align-items:center;justify-content:space-between;background:rgba(0,0,0,.75)}
.jx-att-scan-hud button{min-block-size:44px;padding:0 18px;border-radius:999px;border:1px solid rgba(255,255,255,.5);background:rgba(255,255,255,.12);color:#fff;font:inherit;cursor:pointer}
.jx-att-scan-msg{flex:1;text-align:center}
`;

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.append(style);
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

const TEXT_PREVIEW_TYPES = new Set(['text/plain', 'text/csv', 'text/markdown', 'application/json']);

export function mountAttachMenu(options: AttachMenuOptions): AttachMenuHandle {
  ensureStyle();
  const profile: AttachmentProfile = ATTACHMENT_PROFILES[options.profile];
  const attachments: AttachmentRef[] = [];
  const scans: ScanClassification[] = [];
  const pending = new Map<string, { name: string; state: 'uploading' | 'error'; message?: string }>();

  const bar = el('div', { class: 'jx-att-bar', role: 'group', 'aria-label': 'Adjuntos' });
  const plus = el('button', { type: 'button', class: 'jx-att-plus', 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'aria-label': 'Adjuntar: archivos, foto o escáner' }, '+');
  const chips = el('div', { class: 'jx-att-bar', 'aria-live': 'polite' });
  bar.append(plus, chips);
  options.host.prepend(bar);

  const fileInput = el('input', { type: 'file', multiple: '', hidden: '', accept: profile.allowedMime.join(',') });
  const photoInput = el('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: '' });
  bar.append(fileInput, photoInput);

  let menu: HTMLElement | null = null;
  let scanOverlay: { close: () => void } | null = null;

  const emit = () => {
    renderChips();
    options.onChange?.({ attachments: [...attachments], scans: [...scans] });
  };

  function renderChips(): void {
    chips.replaceChildren();
    for (const ref of attachments) {
      const chip = el('div', { class: 'jx-att-chip', 'data-state': 'ok' });
      chip.append(el('span', { title: ref.name }, `${ref.name} · ${formatBytes(ref.size)}`));
      const remove = el('button', { type: 'button', 'aria-label': `Quitar ${ref.name}` }, '×');
      remove.addEventListener('click', () => {
        const index = attachments.findIndex((item) => item.id === ref.id);
        if (index >= 0) attachments.splice(index, 1);
        emit();
      });
      chip.append(remove);
      chips.append(chip);
    }
    for (const [id, item] of pending) {
      const chip = el('div', { class: 'jx-att-chip', 'data-state': item.state });
      chip.append(el('span', {}, item.state === 'uploading' ? `Subiendo ${item.name}…` : `${item.name}: ${item.message ?? 'error'}`));
      if (item.state === 'error') {
        const dismiss = el('button', { type: 'button', 'aria-label': 'Descartar' }, '×');
        dismiss.addEventListener('click', () => { pending.delete(id); renderChips(); });
        chip.append(dismiss);
      }
      chips.append(chip);
    }
    for (const scan of scans) {
      const chip = el('div', { class: 'jx-att-chip', 'data-state': scan.risk === 'blocked' ? 'error' : 'ok' });
      chip.append(el('span', { title: scan.raw }, `Código: ${scan.display}`));
      const remove = el('button', { type: 'button', 'aria-label': 'Quitar código' }, '×');
      remove.addEventListener('click', () => {
        const index = scans.indexOf(scan);
        if (index >= 0) scans.splice(index, 1);
        emit();
      });
      chip.append(remove);
      chips.append(chip);
    }
    if (options.profile === 'kid' && scans.some((scan) => scan.kind === 'url')) {
      chips.append(el('div', { class: 'jx-att-note' }, 'Este código lleva a un enlace. No lo abras solo: enséñaselo a tu papá o a tu mamá.'));
    }
  }

  function closeMenu(): void {
    menu?.remove();
    menu = null;
    plus.setAttribute('aria-expanded', 'false');
  }

  function openMenu(): void {
    closeMenu();
    menu = el('div', { class: 'jx-att-menu', role: 'menu' });
    const add = (label: string, handler: () => void) => {
      const button = el('button', { type: 'button', role: 'menuitem' }, label);
      button.addEventListener('click', () => { closeMenu(); handler(); });
      menu!.append(button);
    };
    add('📁  Archivos o Drive', () => fileInput.click());
    add('📷  Tomar foto', () => photoInput.click());
    add('🔳  Escanear código QR / de barras', () => void openScanner('code'));
    add('📄  Escanear documento (foto)', () => void openScanner('document'));
    options.host.style.position ||= 'relative';
    options.host.append(menu);
    const rect = plus.getBoundingClientRect();
    const hostRect = options.host.getBoundingClientRect();
    menu.style.insetInlineStart = `${Math.max(0, rect.left - hostRect.left)}px`;
    menu.style.insetBlockStart = `${rect.bottom - hostRect.top + 6}px`;
    plus.setAttribute('aria-expanded', 'true');
    (menu.querySelector('button') as HTMLButtonElement | null)?.focus();
  }

  plus.addEventListener('click', () => (menu ? closeMenu() : openMenu()));
  const outside = (event: Event) => { if (menu && !menu.contains(event.target as Node) && event.target !== plus) closeMenu(); };
  const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') closeMenu(); };
  document.addEventListener('pointerdown', outside);
  document.addEventListener('keydown', escape);

  async function addFiles(files: File[], source: AttachmentSource): Promise<void> {
    for (const file of files) {
      const check = checkFile({ name: file.name, type: file.type, size: file.size }, profile, { alreadyAttached: attachments.length + pending.size, source });
      const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      if (!check.ok) {
        pending.set(key, { name: file.name || 'archivo', state: 'error', message: check.message });
        renderChips();
        continue;
      }
      pending.set(key, { name: check.name, state: 'uploading' });
      renderChips();
      try {
        let id = `local-${crypto.randomUUID()}`;
        let sha256: string | undefined;
        if (options.uploadUrl) {
          const response = await fetch(options.uploadUrl, {
            method: 'POST',
            headers: {
              'content-type': check.type,
              'x-attachment-name': encodeURIComponent(check.name),
              'x-attachment-source': source,
              'x-attachment-profile': profile.id,
              ...(options.headers?.() ?? {}),
            },
            body: file,
          });
          const body = (await response.json().catch(() => ({}))) as { id?: string; sha256?: string; error?: string };
          if (response.status === 401 || response.status === 403) throw new Error('entra como Founder para adjuntar');
          if (!response.ok || !body.id) throw new Error(body.error ?? `HTTP ${response.status}`);
          id = body.id;
          sha256 = body.sha256;
        }
        let textPreview: string | undefined;
        if (TEXT_PREVIEW_TYPES.has(check.type) && file.size <= MAX_INLINE_TEXT_CHARS * 4) {
          textPreview = (await file.text()).slice(0, MAX_INLINE_TEXT_CHARS);
        }
        attachments.push({ id, name: check.name, type: check.type, size: file.size, source, ...(sha256 ? { sha256 } : {}), ...(textPreview ? { textPreview } : {}) });
        pending.delete(key);
      } catch (error) {
        pending.set(key, { name: check.name, state: 'error', message: error instanceof Error ? error.message : 'no se pudo subir' });
      }
      emit();
    }
  }

  fileInput.addEventListener('change', () => { const files = [...(fileInput.files ?? [])]; fileInput.value = ''; void addFiles(files, 'device-file'); });
  photoInput.addEventListener('change', () => { const files = [...(photoInput.files ?? [])]; photoInput.value = ''; void addFiles(files, 'photo'); });

  async function openScanner(mode: 'code' | 'document'): Promise<void> {
    if (scanOverlay) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
      pending.set(`cam-${Date.now()}`, { name: 'Cámara', state: 'error', message: 'necesita una conexión segura (https) y permiso de cámara' });
      renderChips();
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    } catch {
      pending.set(`cam-${Date.now()}`, { name: 'Cámara', state: 'error', message: 'permiso denegado o sin cámara' });
      renderChips();
      return;
    }

    const overlay = el('div', { class: 'jx-att-scan', role: 'dialog', 'aria-modal': 'true', 'aria-label': mode === 'code' ? 'Escáner de códigos' : 'Escáner de documentos' });
    const video = el('video', { playsinline: '', muted: '', autoplay: '' });
    video.srcObject = stream;
    const hud = el('div', { class: 'jx-att-scan-hud' });
    const message = el('div', { class: 'jx-att-scan-msg', role: 'status' }, mode === 'code' ? 'Apunta al código QR o de barras' : 'Encuadra el documento y pulsa Capturar');
    const cancel = el('button', { type: 'button' }, 'Cerrar');
    hud.append(cancel, message);
    let capture: HTMLButtonElement | null = null;
    if (mode === 'document') {
      capture = el('button', { type: 'button' }, 'Capturar');
      hud.append(capture);
    }
    overlay.append(video, hud);
    document.body.append(overlay);

    let stopped = false;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
    let detector: BarcodeDetectorLike | null = null;
    if (mode === 'code' && Detector) {
      try {
        const supported = (await Detector.getSupportedFormats?.()) ?? [];
        const wanted = ['qr_code', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'itf', 'code_39'].filter((format) => supported.includes(format));
        if (wanted.length) detector = new Detector({ formats: wanted });
      } catch { detector = null; }
    }

    const close = () => {
      stopped = true;
      for (const track of stream.getTracks()) track.stop();
      overlay.remove();
      scanOverlay = null;
    };
    scanOverlay = { close };
    cancel.addEventListener('click', close);

    const finishWith = (text: string, format?: string) => {
      const scan: ScanClassification = { ...classifyScan(text, format), ...(format ? { format } : {}) };
      scans.push(scan);
      options.onScan?.(scan);
      close();
      emit();
    };

    if (capture) {
      capture.addEventListener('click', () => {
        if (!context || !video.videoWidth) return;
        const scale = Math.min(1, 1800 / Math.max(video.videoWidth, video.videoHeight));
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (!blob) return;
          close();
          void addFiles([new File([blob], `documento-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.jpg`, { type: 'image/jpeg' })], 'document');
        }, 'image/jpeg', 0.88);
      });
      return;
    }

    const tick = async () => {
      if (stopped) return;
      try {
        if (video.readyState >= 2 && context) {
          if (detector) {
            const found = await detector.detect(video);
            const first = found[0];
            if (first?.rawValue) return finishWith(first.rawValue, first.format);
          } else {
            const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
            canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
            canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const image = context.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' });
            if (code?.data) return finishWith(code.data, 'qr_code');
          }
        }
      } catch { /* un fotograma fallido no detiene el escáner */ }
      setTimeout(() => { void tick(); }, 160);
    };
    if (!detector) message.textContent = 'Apunta al código QR (los códigos de barras no están disponibles en este navegador)';
    void video.play().catch(() => {});
    void tick();
  }

  emit();

  return {
    getAttachments: () => [...attachments],
    getScans: () => [...scans],
    buildMessageSuffix: () => describeAttachmentsForMessage(attachments, scans),
    clear: () => { attachments.length = 0; scans.length = 0; pending.clear(); emit(); },
    destroy: () => {
      scanOverlay?.close();
      closeMenu();
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
      bar.remove();
    },
  };
}
