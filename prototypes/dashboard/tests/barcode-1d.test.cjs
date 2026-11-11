'use strict';
// Lector de códigos de barras clásicos: se comprueba contra patrones generados por un codificador INDEPENDIENTE
// (fixtures/barcodes-1d.json), con escalas no enteras, desenfoque, ruido, luz desigual, lectura invertida y dentro de
// una imagen. Y que NO invente códigos: ruido, códigos cortados o con el control alterado → nada.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'lego', 'janus-attach', 'barcode-1d.js'), 'utf8');
const Barcode = new Function(source.replace(/if \(typeof module[^\n]*\n?$/, '') + '\nreturn JanusBarcode1D;')();
const { fixtures } = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'barcodes-1d.json'), 'utf8'));

let seed = 7; const random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
/** Dibuja el patrón en una línea de luminancia: `scale` px por módulo, margen blanco, desenfoque, ruido y gradiente. */
function render(bits, { scale = 3, quiet = 12, blur = 0, noise = 0, gradient = 0, reverse = false } = {}) {
  const modules = '0'.repeat(quiet) + bits + '0'.repeat(quiet), width = Math.round(modules.length * scale);
  let line = new Float32Array(width);
  for (let x = 0; x < width; x += 1) { // muestreo por área: bordes parciales como en una cámara real
    const a = x / scale, b = (x + 1) / scale; let dark = 0;
    for (let m = Math.floor(a); m < Math.min(modules.length, Math.ceil(b)); m += 1) if (modules[m] === '1') dark += Math.min(b, m + 1) - Math.max(a, m);
    line[x] = 235 - 215 * (dark / (b - a));
  }
  for (let pass = 0; pass < blur; pass += 1) { const next = new Float32Array(width); for (let x = 0; x < width; x += 1) next[x] = (line[Math.max(0, x - 1)] + 2 * line[x] + line[Math.min(width - 1, x + 1)]) / 4; line = next; }
  for (let x = 0; x < width; x += 1) line[x] = Math.max(0, Math.min(255, line[x] * (1 - gradient * (x / width)) + (random() - 0.5) * noise));
  return reverse ? line.reverse() : line;
}
function image(line, height = 60, rowsWithCode = [20, 40]) {
  const width = line.length, data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (let y = rowsWithCode[0]; y < rowsWithCode[1]; y += 1) for (let x = 0; x < width; x += 1) { const p = (y * width + x) * 4; data[p] = data[p + 1] = data[p + 2] = line[x]; }
  return { data, width, height };
}

test('lee EAN-13, UPC-A, EAN-8 y Code 128 generados por un codificador independiente', () => {
  assert.ok(fixtures.length >= 10);
  for (const f of fixtures) assert.deepEqual(Barcode.decodeLine(render(f.bits)), { text: f.text, format: f.format }, `${f.format} ${f.text}`);
});

test('aguanta escalas no enteras, desenfoque, ruido, luz desigual y lectura al revés', () => {
  const conditions = [{ scale: 2.3 }, { scale: 4.7, blur: 2 }, { scale: 3.4, noise: 26 }, { scale: 3, gradient: 0.45 }, { scale: 2.6, blur: 1, noise: 14, reverse: true }, { scale: 6.2, blur: 3, noise: 10, gradient: 0.3 }];
  let read = 0, total = 0;
  for (const f of fixtures) for (const c of conditions) {
    total += 1; const r = Barcode.decodeLine(render(f.bits, c));
    if (r) { assert.deepEqual(r, { text: f.text, format: f.format }, `lectura EQUIVOCADA en ${f.format} ${f.text} ${JSON.stringify(c)}`); read += 1; }
  }
  assert.ok(read / total >= 0.9, `solo leyó ${read}/${total}`);
});

test('lo encuentra dentro de una imagen (varias líneas de barrido) y respeta los formatos pedidos', () => {
  const ean = fixtures.find((f) => f.format === 'ean_13'), c128 = fixtures.find((f) => f.format === 'code_128');
  assert.deepEqual(Barcode.decode(image(render(ean.bits, { scale: 3.3, blur: 1 }))), { text: ean.text, format: 'ean_13' });
  assert.deepEqual(Barcode.decode(image(render(c128.bits, { scale: 2.8 }), 200, [140, 175])), { text: c128.text, format: 'code_128' });
  assert.equal(Barcode.decode(image(render(ean.bits)), ['code_128']), null, 'formato no pedido');
  assert.equal(Barcode.decode({ data: new Uint8ClampedArray(0), width: 0, height: 0 }), null);
});

test('no inventa códigos: ruido, código cortado o control alterado → nada', () => {
  for (let i = 0; i < 300; i += 1) { const line = new Float32Array(700); let level = 230, x = 0; while (x < 700) { const len = 2 + Math.floor(random() * 14); for (let k = 0; k < len && x < 700; k += 1, x += 1) line[x] = level; level = level > 128 ? 25 : 230; } assert.equal(Barcode.decodeLine(line), null, 'barras al azar'); }
  for (const f of fixtures) {
    assert.equal(Barcode.decodeLine(render(f.bits.slice(0, Math.floor(f.bits.length * 0.7)))), null, `cortado ${f.format}`);
    // Se intercambian dos símbolos distintos del interior: el patrón sigue siendo «válido» pero el control ya no cuadra.
    if (f.format !== 'code_128') continue;
    const head = f.bits.indexOf('1'), a = f.bits.slice(head + 11, head + 22), b = f.bits.slice(head + 22, head + 33);
    if (a === b) continue;
    const swapped = f.bits.slice(0, head + 11) + b + a + f.bits.slice(head + 33);
    assert.equal(Barcode.decodeLine(render(swapped)), null, `control alterado ${f.text}`);
  }
});
