'use strict';
/* ===== JanusBarcode1D · lector de códigos de barras clásicos (pieza OPCIONAL de janus-attach) =====
 * EAN-13, UPC-A, EAN-8 y Code 128, sin dependencias y sin red. Lo usa janus-attach solo si el anfitrión lo carga y lo
 * pide con JanusAttach.configure({ formats: [...] }); quien no lo carga sigue leyendo únicamente QR, como siempre.
 * Método: varias líneas horizontales de la imagen → luminancia → umbral → anchos de barras → tablas del estándar.
 * Solo se devuelve un código si su dígito de control es correcto. El contenido leído es un DATO: nunca se abre ni ejecuta.
 * Límite conocido: códigos de frente y razonablemente horizontales; no corrige giros fuertes ni desenfoques grandes.
 */
const JanusBarcode1D = (() => {
  const EAN_L = ['3211', '2221', '2122', '1411', '1132', '1231', '1114', '1312', '1213', '3112'];
  const EAN_PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
  const C128 = '212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 311141 411131 211412 211214 211232 2331112'.split(' ');
  const digits = (text) => Array.from(text, Number);
  const L_PAT = EAN_L.map(digits), G_PAT = EAN_L.map((p) => digits(p).reverse()), C_PAT = C128.map(digits);

  // Error de ajuste de un grupo de anchos contra un patrón de N módulos (independiente de la escala).
  function fit(runs, at, pattern, modules) {
    let sum = 0; for (let i = 0; i < pattern.length; i += 1) sum += runs[at + i];
    if (sum <= 0) return 99;
    let error = 0; for (let i = 0; i < pattern.length; i += 1) error += Math.abs(runs[at + i] * modules / sum - pattern[i]);
    return error;
  }
  function best(runs, at, patterns, modules, from, to) {
    let value = -1, error = 99;
    for (let i = from || 0; i < (to == null ? patterns.length : to); i += 1) { const e = fit(runs, at, patterns[i], modules); if (e < error) { error = e; value = i; } }
    return { value: value, error: error };
  }
  const MAX_DIGIT_ERROR = 1.9, MAX_GUARD_ERROR = 1.2, MAX_C128_ERROR = 2.4;
  const eanCheck = (text) => { let sum = 0; for (let i = 0; i < text.length - 1; i += 1) sum += Number(text[text.length - 2 - i]) * (i % 2 === 0 ? 3 : 1); return (10 - (sum % 10)) % 10 === Number(text[text.length - 1]); };

  // runs: anchos alternos; runs[start] es una barra oscura. half = dígitos por lado (6 → EAN-13, 4 → EAN-8).
  function ean(runs, start, half) {
    const need = 3 + half * 4 + 5 + half * 4 + 3;
    if (start + need > runs.length) return null;
    if (fit(runs, start, [1, 1, 1], 3) > MAX_GUARD_ERROR) return null;
    const unit = (runs[start] + runs[start + 1] + runs[start + 2]) / 3;
    if (start > 0 && runs[start - 1] < unit * 3) return null; // zona en blanco previa
    let at = start + 3, text = '', parity = '';
    for (let i = 0; i < half; i += 1, at += 4) {
      const l = best(runs, at, L_PAT, 7), g = half === 6 ? best(runs, at, G_PAT, 7) : { error: 99, value: -1 };
      const pick = l.error <= g.error ? l : g;
      if (pick.error > MAX_DIGIT_ERROR) return null;
      text += pick.value; parity += pick === l ? 'L' : 'G';
    }
    if (fit(runs, at, [1, 1, 1, 1, 1], 5) > MAX_GUARD_ERROR * 1.5) return null;
    at += 5;
    for (let i = 0; i < half; i += 1, at += 4) { const r = best(runs, at, L_PAT, 7); if (r.error > MAX_DIGIT_ERROR) return null; text += r.value; }
    if (fit(runs, at, [1, 1, 1], 3) > MAX_GUARD_ERROR) return null;
    if (half === 4) return parity === 'LLLL' && eanCheck(text) ? { text: text, format: 'ean_8' } : null;
    const first = EAN_PARITY.indexOf(parity);
    if (first < 0) return null;
    const full = first + text;
    if (!eanCheck(full)) return null;
    return first === 0 ? { text: full.slice(1), format: 'upc_a' } : { text: full, format: 'ean_13' };
  }

  function code128(runs, start) {
    if (start + 6 + 6 + 7 > runs.length) return null;
    const head = best(runs, start, C_PAT, 11, 103, 106);
    if (head.error > MAX_C128_ERROR * 0.7) return null;
    const unit = (runs[start] + runs[start + 1] + runs[start + 2] + runs[start + 3] + runs[start + 4] + runs[start + 5]) / 11;
    if (start > 0 && runs[start - 1] < unit * 4) return null;
    const values = [];
    let at = start + 6, stopped = false;
    while (at + 6 <= runs.length && values.length < 90) {
      if (at + 7 <= runs.length && fit(runs, at, C_PAT[106], 13) < MAX_C128_ERROR * 0.6) { stopped = true; break; }
      const symbol = best(runs, at, C_PAT, 11, 0, 106);
      if (symbol.error > MAX_C128_ERROR) return null;
      values.push(symbol.value); at += 6;
    }
    if (!stopped || values.length < 2) return null;
    const check = values.pop();
    let sum = head.value; for (let i = 0; i < values.length; i += 1) sum += values[i] * (i + 1);
    if (sum % 103 !== check) return null;
    let set = head.value === 103 ? 'A' : head.value === 104 ? 'B' : 'C', shift = '', text = '';
    for (const value of values) {
      const active = shift || set; shift = '';
      if (active === 'C') {
        if (value < 100) text += (value < 10 ? '0' : '') + value; else if (value === 100) set = 'B'; else if (value === 101) set = 'A';
      } else if (value < 96) {
        text += String.fromCharCode(active === 'B' || value < 64 ? value + 32 : value - 64);
      } else if (value === 98) shift = active === 'A' ? 'B' : 'A';
      else if (value === 99) set = 'C';
      else if (value === 100 && active === 'A') set = 'B';
      else if (value === 101 && active === 'B') set = 'A';
    }
    return text ? { text: text, format: 'code_128' } : null;
  }

  function decodeRuns(runs, firstDark, formats) {
    const want = (name) => !formats || formats.indexOf(name) >= 0;
    const wantEan = want('ean_13') || want('upc_a'), wantEan8 = want('ean_8'), want128 = want('code_128');
    for (let i = firstDark ? 0 : 1; i < runs.length; i += 2) {
      let result = null;
      if (wantEan) { result = ean(runs, i, 6); if (result && !want(result.format)) result = null; }
      if (!result && wantEan8) result = ean(runs, i, 4);
      if (!result && want128) result = code128(runs, i);
      if (result) return result;
    }
    return null;
  }

  // Línea de luminancia (0 oscuro … 255 claro) → anchos. Umbral global y, si falla, umbral local (luz desigual).
  function toRuns(line, local) {
    const n = line.length, runs = []; if (n < 30) return { runs: runs, firstDark: false };
    let threshold = 0, prefix = null, half = 0;
    if (local) { prefix = new Float64Array(n + 1); for (let i = 0; i < n; i += 1) prefix[i + 1] = prefix[i] + line[i]; half = Math.max(8, Math.round(n / 14)); }
    else { let min = 255, max = 0; for (let i = 0; i < n; i += 1) { if (line[i] < min) min = line[i]; if (line[i] > max) max = line[i]; } if (max - min < 40) return { runs: runs, firstDark: false }; threshold = (min + max) / 2; }
    let previous = null, count = 0, firstDark = false;
    for (let i = 0; i < n; i += 1) {
      let t = threshold;
      if (local) { const a = Math.max(0, i - half), b = Math.min(n, i + half + 1); t = (prefix[b] - prefix[a]) / (b - a) - 6; }
      const dark = line[i] < t;
      if (previous === null) { previous = dark; firstDark = dark; count = 1; } else if (dark === previous) count += 1; else { runs.push(count); previous = dark; count = 1; }
    }
    runs.push(count);
    return { runs: runs, firstDark: firstDark };
  }
  function decodeLine(line, formats) {
    for (const local of [false, true]) {
      const r = toRuns(line, local); if (r.runs.length < 20) continue;
      const forward = decodeRuns(r.runs, r.firstDark, formats); if (forward) return forward;
      const reversed = r.runs.slice().reverse(), lastDark = r.runs.length % 2 === 1 ? r.firstDark : !r.firstDark;
      const backward = decodeRuns(reversed, lastDark, formats); if (backward) return backward;
    }
    return null;
  }

  const ROWS = [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74, 0.18, 0.82];
  /** imageData: { data: RGBA, width, height } (p. ej. de canvas.getContext('2d').getImageData). */
  function decode(imageData, formats) {
    const width = imageData.width, height = imageData.height, data = imageData.data;
    if (!width || !height || width < 60) return null;
    const line = new Float32Array(width);
    for (const fraction of ROWS) {
      const y0 = Math.min(height - 1, Math.max(0, Math.round(height * fraction)));
      for (let x = 0; x < width; x += 1) {
        let sum = 0, rows = 0;
        for (let dy = -1; dy <= 1; dy += 1) { const y = y0 + dy; if (y < 0 || y >= height) continue; const p = (y * width + x) * 4; sum += data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114; rows += 1; }
        line[x] = sum / rows;
      }
      const result = decodeLine(line, formats); if (result) return result;
    }
    return null;
  }
  return { decode: decode, decodeLine: decodeLine, formats: ['ean_13', 'upc_a', 'ean_8', 'code_128'] };
})();
if (typeof module === 'object' && module.exports) module.exports = JanusBarcode1D;
