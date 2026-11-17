'use strict';
/* ===== Pieles: traductor de paleta A (Obsidiana: oscuro + oro) → B (Platino: claro + zafiro) =====
 * Un solo núcleo, dos pieles: A es la fuente de verdad. B no duplica vistas; traduce los COLORES de A.
 *  - En el build (Node) traduce el CSS de A a reglas con prefijo `.stage.b` (solo las declaraciones con color).
 *  - En el navegador traduce el HTML que generan las vistas (atributos style y colores SVG) cuando la piel es B.
 * Es el MISMO código en ambos sitios (se evalúa en Node y se incrusta en el HTML).
 *
 * Familias de color (por croma y tono, no por valor exacto):
 *   neutro  → blancos/negros/grises/marfil: se invierten (marfil→tinta, blanco translúcido→cristal blanco, negro→azul pálido).
 *   oro     → zafiro   (acento principal).     ámbar → ámbar B (aviso).     verde → verde B.
 *   rojo    → rojo B.  azul claro (lluvia) → violeta B (para no confundirlo con el zafiro).
 * El papel de cada color (texto, relleno, línea, sombra) lo decide la propiedad CSS donde aparece.
 */
const SkinMap = (function () {
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const INK = [14, 26, 51], MUTE = [70, 84, 112], NAVY = [30, 50, 110], WHITE = [255, 255, 255], PAGE = [231, 236, 245];

  function parseColor(tok) {
    tok = String(tok).trim();
    let m = /^#([0-9a-fA-F]{3,8})$/.exec(tok);
    if (m) {
      let h = m[1];
      if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
      if (h.length !== 6 && h.length !== 8) return null;
      return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 };
    }
    m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(tok);
    if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
    return null;
  }
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    let h = 0, s = 0;
    if (d) {
      s = d / (1 - Math.abs(2 * l - 1));
      h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h *= 60; if (h < 0) h += 360;
    }
    return { h, s, l };
  }
  function hslToRgb(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
  }
  const hex2 = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  function fmt(rgb, a) {
    a = Math.round(clamp01(a) * 1000) / 1000;
    return a >= 0.999 ? '#' + hex2(rgb[0]) + hex2(rgb[1]) + hex2(rgb[2]) : 'rgba(' + Math.round(rgb[0]) + ',' + Math.round(rgb[1]) + ',' + Math.round(rgb[2]) + ',' + a + ')';
  }

  /* Papeles: fg texto · bg relleno · ln línea/borde · sh sombra exterior · hi brillo interior (inset claro) · is sombra interior (inset oscura) */
  function mapColor(c, role) {
    if (c.a <= 0) return fmt([c.r, c.g, c.b], 0);
    const mx = Math.max(c.r, c.g, c.b), mn = Math.min(c.r, c.g, c.b), C = mx - mn, { h, l } = rgbToHsl(c.r, c.g, c.b), a = c.a;
    // Texto con degradado (background-clip:text): oro/neutros → zafiro oscuro (de brillante arriba a profundo abajo), contraste ≥ 4:1 sobre el fondo claro.
    if (role === 'fgi') return C < 44 && l < 0.5 ? fmt(INK, a) : mapColor(c, 'fg');   // texto oscuro sobre superficie clara: sigue siendo tinta
    if (role === 'bgs') return fmt([250, 252, 255], a);                              // superficie crema/blanca: sigue siendo clara
    if ((role === 'bgb' || role === 'cp') && C < 44) role = 'bg';
    if (role === 'gt') {
      if (C < 44 || (h > 14 && h <= 62)) return fmt(hslToRgb(224, 0.9, 0.30 + 0.24 * l), a);
      role = 'fg';
    }
    // ---- neutros (croma bajo): marfil, blancos, negros, grises cálidos
    if (C < 44) {
      if (role === 'fg') return l >= 0.8 ? fmt(INK, a) : l >= 0.5 ? fmt(MUTE, a) : fmt(WHITE, a);
      if (role === 'hi') return fmt(WHITE, Math.min(1, a * 3.5));
      if (role === 'is') return fmt(NAVY, Math.min(0.3, a * 0.35));
      if (role === 'sh') return fmt(NAVY, Math.min(0.4, a * 0.45));
      if (role === 'ln') return l >= 0.5 ? fmt(NAVY, Math.min(0.24, a * 1.25 + 0.02)) : fmt(NAVY, Math.min(0.3, a * 0.5));
      // bg · bgf (plano) · bgt (pista de anillo/barra)
      if (l >= 0.5 && a < 0.97 && (role === 'bgt' || (role === 'bgf' && a <= 0.14))) return fmt(NAVY, Math.min(0.12, a * (role === 'bgt' ? 1.5 : 1.1)));
      if (l >= 0.5) return a >= 0.97 ? fmt(c.r > 250 && c.g > 250 && c.b > 250 ? WHITE : [244, 247, 253], 1) : fmt(WHITE, Math.min(0.92, 0.46 + a * 3.2));
      return a >= 0.85 ? fmt([l < 0.08 ? 238 : 226, l < 0.08 ? 242 : 233, l < 0.08 ? 251 : 246], 1) : fmt(NAVY, Math.min(0.22, a * 0.3));
    }
    // ---- familias con color
    let fam = 'gold';
    if (h >= 100 && h <= 185) fam = 'green';
    else if (h >= 195 && h <= 260) fam = 'blue';
    else if (h >= 340 || h <= 14) fam = 'red';
    else if (h > 14 && h <= 36 && mx - mn >= 110 && rgbToHsl(c.r, c.g, c.b).s >= 0.9) fam = 'amber';
    else if (h > 14 && h <= 62) fam = 'gold';
    else return fmt([c.r, c.g, c.b], a); // otros tonos (violeta, rosa…): se dejan
    if (role === 'hi') return fmt(WHITE, Math.min(1, a * 3.5));
    if (role === 'is') return fmt(NAVY, Math.min(0.3, a * 0.35));
    const fg = role === 'fg' || role === 'cp', bb = role === 'bgb', xr = clamp01((l - 0.2) / 0.7);
    // bgb = relleno de botón/píldora con texto claro encima: luminosidad acotada para que el blanco tenga contraste ≥ 4,5:1
    const P = {
      gold: { h: 224, s: 0.9, f: (x) => (fg ? 0.4 : bb ? 0.4 + 0.17 * xr : 0.03 + 0.86 * x) },
      amber: { h: 38, s: 1, f: (x) => (fg ? 0.29 : bb ? 0.3 + 0.1 * xr : 0.03 + 0.78 * x) },
      green: { h: 160, s: 0.8, f: (x) => (fg ? 0.22 : bb ? 0.24 + 0.1 * xr : 0.03 + 0.68 * x) },
      red: { h: 358, s: 0.72, f: (x) => (fg ? 0.4 : bb ? 0.4 + 0.1 * xr : 0.03 + 0.8 * x) },
      blue: { h: 254, s: 0.7, f: (x) => (fg ? 0.45 : bb ? 0.42 + 0.12 * xr : 0.03 + 0.82 * x) },
    }[fam];
    return fmt(hslToRgb(P.h, P.s, clamp01(P.f(l))), a);
  }

  const COLOR_RE = /#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(?:,\s*[\d.]+\s*)?\)/g;
  const mapTokens = (text, role) => text.replace(COLOR_RE, (tok, off, whole) => {
    if (off > 0 && /[&\w]/.test(whole[off - 1])) return tok; // «&#39;», «a#fff»…
    const c = parseColor(tok); return c ? mapColor(c, role) : tok;
  });

  /* Divide por comas de primer nivel (fuera de paréntesis) */
  function splitTop(s, sep) {
    const out = []; let depth = 0, cur = '', q = '';
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (q) { cur += ch; if (ch === q && s[i - 1] !== '\\') q = ''; continue; }
      if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
      if (ch === '(') depth++; else if (ch === ')') depth--;
      if (ch === sep && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
    }
    out.push(cur);
    return out;
  }

  /* Texto oscuro neutro (p. ej. #1a1204 sobre un botón dorado): en B pasa a blanco, así que el relleno degradado debe ser lo bastante oscuro. */
  function isDarkText(value) {
    const m = String(value).match(COLOR_RE); if (!m) return false;
    const c = parseColor(m[0]); if (!c || c.a < 0.5) return false;
    return Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) < 44 && rgbToHsl(c.r, c.g, c.b).l < 0.5;
  }
  /* Modo de una regla/atributo style según su pareja texto/fondo:
   *  clip → texto con degradado · btn → texto oscuro sobre relleno de acento (botón/píldora dorada) · surf → texto oscuro sobre superficie crema/blanca. */
  function modeOf(pairs) {
    if (pairs.some((p) => /^(-webkit-)?background-clip$/i.test(p.prop) && /\btext\b/i.test(p.value))) return 'clip';
    if (!pairs.some((p) => /^color$/i.test(p.prop) && isDarkText(p.value))) return null;
    const bg = pairs.find((p) => /^background(-image|-color)?$/i.test(p.prop)); if (!bg) return null;
    const toks = String(bg.value).match(COLOR_RE) || []; if (!toks.length) return null;
    const light = toks.every((t) => { const c = parseColor(t); if (!c) return true; return Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) < 60 && rgbToHsl(c.r, c.g, c.b).l > 0.8; });
    return light ? 'surf' : 'btn';
  }
  const FG = /^(color|-webkit-text-fill-color|caret-color|text-decoration-color|-webkit-text-stroke-color)$/;
  const BG = /^(background|background-color|background-image|fill|stop-color|flood-color|lighting-color|mask-image|-webkit-mask-image)$/;
  /* Mapea el valor de UNA declaración según su propiedad. Devuelve el texto nuevo (igual si no hay color). */
  function mapDecl(prop, value, mode) {
    prop = prop.trim().toLowerCase();
    if (!COLOR_RE.test(value)) { COLOR_RE.lastIndex = 0; return value; }
    COLOR_RE.lastIndex = 0;
    if (FG.test(prop)) return mapTokens(value, mode === 'surf' && prop === 'color' ? 'fgi' : 'fg');
    if (BG.test(prop)) {
      if (mode === 'clip' && /^background(-image)?$/.test(prop)) return mapTokens(value, 'gt');
      if (mode === 'btn' && /^background(-image|-color)?$/.test(prop)) return mapTokens(value, 'bgb');
      if (mode === 'surf' && /^background(-image|-color)?$/.test(prop)) return mapTokens(value, 'bgs');
      return splitTop(value, ',').length > 1 && /gradient\(/.test(value) && !/^\s*(conic|linear|radial)/.test(value) ? mapTokens(value, 'bg') : splitTop(value, ',').map((layer, i, all) => {
        // una capa es un degradado si empieza por «xxx-gradient(»; un color plano (último de la lista o único) es relleno plano
        return mapTokens(layer, /^\s*conic-gradient/.test(layer) ? 'bgt' : /gradient\(/.test(layer) ? 'bg' : 'bgf');
      }).join(',');
    }
    if (prop === 'box-shadow') {
      return splitTop(value, ',').map((one) => {
        const inset = /(^|\s)inset(\s|$)/.test(one);
        // Brillo interior claro (inset con color claro) o sombra interior oscura; exterior = sombra.
        return one.replace(COLOR_RE, (tok, off, whole) => {
          const c = parseColor(tok); if (!c) return tok;
          const light = Math.max(c.r, c.g, c.b) > 170 && (Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) < 100 || c.r > 200);
          // Exterior claro (halo dorado/verde…) = brillo de color: línea con color; exterior oscuro = sombra.
          if (inset) return mapColor(c, light ? 'hi' : 'is');
          return mapColor(c, light && Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) < 44 ? 'ln' : (Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) >= 44 ? 'bg' : 'sh'));
        });
      }).join(',');
    }
    if (prop === 'text-shadow') return value.replace(COLOR_RE, (tok) => { const c = parseColor(tok); return c ? (Math.max(c.r, c.g, c.b) < 120 ? 'rgba(255,255,255,.8)' : mapColor(c, 'sh')) : tok; });
    if (prop === 'filter' || prop === '-webkit-filter' || prop === 'backdrop-filter') return value.replace(COLOR_RE, (tok) => { const c = parseColor(tok); return c ? mapColor(c, Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) >= 44 ? 'bg' : 'sh') : tok; });
    if (/^border|^outline|^stroke$|^column-rule|^border-image/.test(prop)) return mapTokens(value, 'ln');
    if (prop.indexOf('--') === 0) return mapTokens(value, 'cp'); // variables de color: acento oscuro (sirven como texto y como relleno)
    return value; // otras propiedades con color (raras): se dejan
  }

  /* ---- CSS ---- */
  /* Troceador: devuelve [{type:'rule',sel,body}|{type:'at',head,children}|{type:'raw',text}] */
  function parseBlocks(css) {
    const out = []; let i = 0; const n = css.length;
    const skipWs = () => { while (i < n && /\s/.test(css[i])) i++; };
    while (true) {
      skipWs(); if (i >= n) break;
      if (css.startsWith('/*', i)) { const e = css.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
      let j = i, depth = 0, q = '';
      while (j < n) { // buscar «{» o «;» de primer nivel
        const ch = css[j];
        if (q) { if (ch === q && css[j - 1] !== '\\') q = ''; j++; continue; }
        if (ch === '"' || ch === "'") { q = ch; j++; continue; }
        if (ch === '(') depth++; else if (ch === ')') depth--;
        if (depth === 0 && (ch === '{' || ch === ';')) break;
        j++;
      }
      const head = css.slice(i, j).trim();
      if (css[j] === ';' || j >= n) { out.push({ type: 'raw', text: head }); i = j + 1; continue; }
      // bloque
      let k = j + 1; depth = 0; q = '';
      for (; k < n; k++) {
        const ch = css[k];
        if (q) { if (ch === q && css[k - 1] !== '\\') q = ''; continue; }
        if (ch === '"' || ch === "'") { q = ch; continue; }
        if (ch === '(') depth++; else if (ch === ')') depth--;
        else if (depth === 0 && ch === '{') { /* anidado: se resuelve contando llaves abajo */ }
      }
      // contar llaves reales
      let d = 1; k = j + 1; q = '';
      for (; k < n && d > 0; k++) {
        const ch = css[k];
        if (q) { if (ch === q && css[k - 1] !== '\\') q = ''; continue; }
        if (ch === '"' || ch === "'") { q = ch; continue; }
        if (ch === '{') d++; else if (ch === '}') d--;
      }
      const inner = css.slice(j + 1, k - 1);
      if (head[0] === '@') out.push({ type: 'at', head, inner });
      else out.push({ type: 'rule', sel: head, body: inner });
      i = k;
    }
    return out;
  }
  function declsOf(body) {
    return splitTop(body, ';').map((d) => d.trim()).filter(Boolean).map((d) => {
      const idx = d.indexOf(':'); if (idx < 0) return null;
      let value = d.slice(idx + 1).trim(), important = false;
      if (/!\s*important\s*$/i.test(value)) { important = true; value = value.replace(/!\s*important\s*$/i, '').trim(); }
      return { prop: d.slice(0, idx).trim(), value, important };
    }).filter(Boolean);
  }
  const SKIP_SEL = /^(html|body|:root|\*)\b|^body:|^html:/;
  /* Convierte el CSS de A en reglas de B. Reglas `.a …` (propias de A) pasan enteras a `.stage.b …`; el resto solo con las declaraciones que cambian de color. */
  function mapCss(css, prefix) {
    prefix = prefix || '.stage.b';
    const out = [];
    for (const node of parseBlocks(css)) {
      if (node.type === 'at') {
        if (/^@(media|supports)/.test(node.head)) { const inner = mapCss(node.inner, prefix); if (inner) out.push(node.head + '{' + inner + '}'); }
        continue; // @font-face, @keyframes… no se tocan
      }
      if (node.type !== 'rule') continue;
      const sels = splitTop(node.sel, ',').map((s) => s.trim()).filter(Boolean);
      const ROOT_A = /^(\.stage\.a|\.a)(?![\w-])/;
      const rootOnly = sels.every((s) => ROOT_A.test(s));
      const anyA = sels.some((s) => ROOT_A.test(s));
      if (sels.every((s) => SKIP_SEL.test(s))) continue;
      const decls = declsOf(node.body);
      const mode = modeOf(decls);
      const mapped = decls.map((d) => ({ d, v: mapDecl(d.prop, d.value, mode) }));
      // Reglas que solo existen en A (`.a …`): se llevan completas. El selector raíz `.a{…}` se escribe a mano para B (variables, tipografía).
      if (anyA) {
        if (rootOnly && sels.length === 1 && sels[0] === '.a') continue;
        const body = mapped.map((m) => m.d.prop + ':' + m.v + (m.d.important ? '!important' : '')).join(';');
        out.push(sels.map((s) => s.replace(ROOT_A, prefix)).join(',') + '{' + body + '}');
        continue;
      }
      // El atajo `background` reinicia background-clip/size/position…: si cambia, se repiten los sub-valores de la misma regla (p. ej. texto con degradado).
      const bgShort = mapped.some((m) => m.d.prop.toLowerCase() === 'background' && m.v !== m.d.value);
      const BG_SUB = /^(-webkit-)?background-(clip|size|position|repeat|origin|attachment|blend-mode)$/i;
      const changed = mapped.filter((m) => m.v !== m.d.value || (bgShort && BG_SUB.test(m.d.prop)));
      if (!changed.length) continue;
      out.push(sels.map((s) => (SKIP_SEL.test(s) ? null : prefix + ' ' + s)).filter(Boolean).join(',') + '{' + changed.map((m) => m.d.prop + ':' + m.v + (m.d.important ? '!important' : '')).join(';') + '}');
    }
    return out.join('\n');
  }

  /* ---- HTML generado por las vistas ---- */
  function mapStyleAttr(style) {
    const parts = splitTop(style, ';'), pairs = parts.map((d) => { const idx = d.indexOf(':'); return idx < 0 ? { prop: '', value: '' } : { prop: d.slice(0, idx).trim(), value: d.slice(idx + 1) }; });
    const mode = modeOf(pairs);
    return parts.map((d) => { const idx = d.indexOf(':'); if (idx < 0) return d; return d.slice(0, idx) + ':' + mapDecl(d.slice(0, idx), d.slice(idx + 1), mode); }).join(';');
  }
  const TAG_RE = /<([a-zA-Z][\w-]*)((?:\s+[^<>"'=\s]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*\/?>/g;
  const ATTR_RE = /\s(style|fill|stroke|stop-color|flood-color)\s*=\s*"([^"]*)"/g;
  function mapHtml(html) {
    return html.replace(TAG_RE, (tag, name, attrs) => {
      if (!/(style|fill|stroke|stop-color|flood-color)\s*=/.test(attrs)) return tag;
      const isText = name === 'text' || name === 'tspan';
      const mapped = attrs.replace(ATTR_RE, (m, attr, val) => {
        if (attr === 'style') return ' style="' + mapStyleAttr(val) + '"';
        const role = attr === 'stroke' ? 'ln' : attr === 'fill' && isText ? 'fg' : 'bg';
        return ' ' + attr + '="' + mapTokens(val, role) + '"';
      });
      return '<' + name + mapped + (/\/>$/.test(tag) ? '/>' : '>');
    });
  }

  return { parseColor, mapColor, mapDecl, mapCss, mapHtml, mapStyleAttr, fmt };
})();
