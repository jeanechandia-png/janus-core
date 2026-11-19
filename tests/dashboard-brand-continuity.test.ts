import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('JANUS original approved A/B dashboards are built from the same source, never a replacement product', () => {
  const builder = read('scripts/build-janus-dashboards.mjs');
  const code = read('prototypes/dashboard/build.cjs');
  const runtime = read('apps/runtime/server.ts');
  const router = read('prototypes/dashboard/src/app.js');
  assert.match(builder, /Janus-A-Obsidiana-interactivo\.html/);
  assert.match(builder, /Janus-B-Platino-interactivo\.html/);
  assert.match(builder, /prototypes\/dashboard\//);
  assert.match(code, /src\/icons\.js/);
  assert.match(code, /src\/depth\.js/);
  assert.match(code, /src\/premium\.css/);
  assert.match(code, /src\/dash-b\.css/);
  assert.match(code, /janus-gold\/janus-gold\.css/);
  assert.match(runtime, /\/dashboard\/a/);
  assert.match(runtime, /\/dashboard\/b/);
  assert.match(runtime, /\/work\/team/);
  assert.match(router, /VIEWS\[ROUTE\.v\]/);
  assert.match(router, /document\.getElementById\('dash'\)/);
  assert.match(router, /document\.getElementById\('view'\)/);
});

test('JANUS reuses original 3D object first, original polished material second, metallic relief as explicit fallback', () => {
  const generator = read('prototypes/dashboard/tools/gen-icons.cjs');
  const code = read('prototypes/dashboard/src/icons.js');
  assert.match(generator, /const ICON_KEYS = \$\{JSON\.stringify\(MAP\)\}/);
  assert.match(code, /const ICON_KEYS =/);
  assert.match(code, /GOLD\.o && GOLD\.o\[EMO_OBJ\[e\]\]/);
  assert.match(code, /GOLD\.i && GOLD\.i\[ICON_KEYS\[e\]\]/);
  assert.match(code, /ji-relief/);
  const mockGold = { o: { bot: 'data:image/webp;base64,AAA' },
    i: { droplet: 'data:image/webp;base64,BBB' } };
  const run = (gold: unknown) => runInNewContext(code +
    '\n;({ iconSvg, ICON_KEYS, EMO_OBJ, ICONS })', { GOLD: gold }) as
      { iconSvg: (emoji: string) => string; ICON_KEYS: Record<string, string>;
        EMO_OBJ: Record<string, string>; ICONS: Record<string, string> };
  const icons = run(mockGold);
  assert.ok(Object.keys(icons.ICONS).length >= 100);
  assert.match(icons.iconSvg('🤖'), /class="ji ji3" src="data:image\/webp;base64,AAA"/);
  assert.match(icons.iconSvg('💧'), /class="ji ji3" src="data:image\/webp;base64,BBB"/);
  assert.match(icons.iconSvg('📍'), /<svg class="ji ji-relief"/);
  const original = run({ o: {}, i: {} });
  assert.match(original.iconSvg('🤖'), /<svg class="ji ji-relief"/);
  // Never mislabel the vector fallback as an image-backed hyperreal object.
  assert.ok(Object.keys(icons.EMO_OBJ).length < Object.keys(icons.ICONS).length);
});

test('JANUS cards, tabs and CTAs share one light response without changing layouts or accessible motion settings', () => {
  const lighting = read('prototypes/dashboard/lego/janus-gold/janus-gold.js');
  const depth = read('prototypes/dashboard/src/depth.js');
  const cta = read('prototypes/dashboard/lego/janus-gold/janus-gold.css');
  const a = read('prototypes/dashboard/src/premium.css');
  const b = read('prototypes/dashboard/src/dash-b.css');
  const k = read('apps/pwa/kendra.css');
  const w = read('prototypes/dashboard/work/work-extra.css');
  assert.match(lighting, /\.cd,\.pl-cd,\.a2c/);
  assert.match(lighting, /pointerdown/);
  assert.match(depth, /JanusGold\.bindLit\(\)/);
  assert.match(depth, /#app \.cd, #app \.pl-cd, #app \.a2c/);
  assert.match(cta, /jg-cta::before,.jg-row::before/);
  assert.match(cta, /@keyframes jgSpecular/);
  assert.match(a, /data-lit="true"/);
  assert.match(a, /svg\.ji-relief/);
  assert.match(a, /\.tb2/);
  assert.match(b, /janusPlatinumSheen/);
  assert.match(b, /\.stage\.b \.pl-cd/);
  assert.match(k, /janusKendraSheen/);
  assert.match(k, /nav\.tabs button span/);
  assert.match(w, /janusWorkSpecular/);
  for (const [name, css] of Object.entries({ cta, a, b, k, w })) {
    assert.match(css, /prefers-reduced-motion:reduce/, name + ' must respect accessibility');
  }
});

test('JANUS Work stays on its locked approved skin; Kendra keeps local child-only APIs and original creature stage', () => {
  const workBuilder = read('prototypes/dashboard/work/build-work.cjs');
  const k = read('apps/pwa/kendra.js');
  const workExtras = read('prototypes/dashboard/work/work-extra.css');
  assert.match(workBuilder, /skin\.lock\.json/);
  assert.match(workBuilder, /work\/work-extra\.css/);
  assert.match(workBuilder, /skin\.lock/);
  assert.match(k, /\/api\/kid\//);
  assert.match(k, /createApprovedStage/);
  assert.match(k, /app\.addEventListener\('pointerdown'/);
  assert.doesNotMatch(workExtras, /position:\s*fixed.*(?:top|bottom):\s*0/s);
  const output = join(root, 'prototypes/dashboard/dist/Janus-A-Obsidiana-interactivo.html');
  if (existsSync(output)) {
    const html = readFileSync(output, 'utf8');
    assert.match(html, /JanusGold\.bindLit/);
    assert.match(html, /const ICON_KEYS =/);
  }
});
