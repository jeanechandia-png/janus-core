import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
// @ts-expect-error Browser ESM component without a declaration file.
import { LANGUAGES, currentLanguage, uiLabel } from '../apps/pwa/language-buttons.js';

const text = (path: string) => readFileSync(path, 'utf8');

test('real Core dashboards A/B receive approved language controls without replacing their design', () => {
  const runtime = text('apps/runtime/server.ts');
  const bridge = text('apps/pwa/dashboard-access.js');
  const css = text('apps/pwa/dashboard-access.css');
  assert.match(runtime, /dashboard\/a/);
  assert.match(runtime, /dashboard\/b/);
  assert.match(runtime, /dashboard-access\.js/);
  assert.match(bridge, /mountLanguageButtons\(languageControl, 'founder'/);
  assert.match(bridge, /'\/kendra'/);
  assert.match(bridge, /iconSrc: '\/icons\/janus-icon-180\.png'/);
  assert.match(css, /language-buttons\.css/);
  assert.ok(!bridge.includes('innerHTML'));
  assert.match(bridge, /mountInExistingHeader/);
  assert.ok(bridge.includes('#view:not([hidden]) .vh'));
  assert.ok(bridge.includes('header.append(controls)'));
  assert.doesNotMatch(bridge, /position:fixed/);
  assert.ok(css.includes('.janus-header-tools'));
  assert.ok(css.includes('.janus-access-menu'));
});

test('independent Kendra app retains its pairing, role isolation and original screen', () => {
  const child = text('apps/pwa/kendra.js');
  const html = text('apps/pwa/kendra.html');
  assert.match(child, /kendra\.device\.v1/);
  assert.match(child, /\/api\/kid\//);
  assert.match(child, /mountLanguageButtons\(languageHost, 'kendra'/);
  assert.match(child, /rebuildNav\(\); rebuildTop\(\);/);
  assert.match(html, /\/kendra\.webmanifest/);
  assert.match(html, /language-buttons\.css/);
  assert.match(html, /Content-Security-Policy/);
  assert.ok(!existsSync('apps/pwa/companion.html'), 'Do not replace the real protected Kendra app with a parallel screen');
});

test('founder and Kendra install as separate PWA identities with the approved icon', () => {
  const founder = JSON.parse(text('apps/pwa/manifest.webmanifest'));
  const child = JSON.parse(text('apps/pwa/kendra.webmanifest'));
  assert.equal(founder.start_url, '/dashboard/a');
  assert.equal(child.start_url, '/kendra');
  assert.equal(child.id, '/kendra');
  assert.notEqual(founder.id, child.id);
  for (const m of [founder, child]) {
    assert.equal(m.icons[0].src, '/icons/janus-icon-192.png');
    assert.equal(m.icons[1].src, '/icons/janus-icon-512.png');
  }
  assert.match(text('apps/pwa/kendra.html'), /\/icons\/janus-icon-180\.png/);
  assert.match(text('apps/pwa/index.html'), /\/icons\/janus-icon-180\.png/);
});

test('ES/NL use the supplied original medallions instead of generated emoji flags or CDN', () => {
  assert.deepEqual(LANGUAGES.map((l: {code: string}) => l.code), ['nl', 'es']);
  const source = text('apps/pwa/language-buttons.js');
  const worker = text('apps/pwa/sw.js');
  for (const name of ['nederland', 'espana']) {
    const asset = 'apps/pwa/language-art/' + name + '.webp.b64';
    const bytes = Buffer.from(text(asset).trim(), 'base64');
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
    assert.ok(bytes.length >= 1000);
    assert.ok(source.includes('/language-art/' + name + '.webp.b64'));
    assert.ok(worker.includes('/language-art/' + name + '.webp.b64'));
  }
  assert.ok(!source.includes('https://'));
});

test('medallions are small, tactile, accessible and respect reduced motion', () => {
  const css = text('apps/pwa/language-buttons.css');
  const source = text('apps/pwa/language-buttons.js');
  assert.match(css, /width:\s*44px/);
  assert.match(css, /height:\s*44px/);
  assert.match(css, /is-lit/);
  assert.match(css, /:active::after/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(source, /aria-pressed/);
  assert.match(source, /'janus\.language\.' \+ scope/);
});

test('language preferences are isolated by profile and UI chrome has translated labels', () => {
  const storage = {
    getItem(key: string) {
      if (key === 'janus.language.founder') return 'nl';
      if (key === 'janus.language.kendra') return 'es';
      return null;
    },
  };
  assert.equal(currentLanguage('founder', storage), 'nl');
  assert.equal(currentLanguage('kendra', storage), 'es');
  assert.equal(uiLabel('founder', 'install', '', storage), 'App installeren');
  assert.equal(uiLabel('founder', 'run', '', storage), 'Uitvoeren');
  assert.equal(uiLabel('kendra', 'home', '', storage), 'Inicio');
  assert.equal(uiLabel('kendra', 'parent', '', storage), 'Zona de padres');
  assert.equal(uiLabel('kendra', 'unknown', 'Fallback', storage), 'Fallback');
});

test('offline cache includes controls but does not store protected API responses', () => {
  const sw = text('apps/pwa/sw.js');
  assert.match(sw, /janus-shell-v30/);
  assert.match(sw, /'\/language-buttons\.js'/);
  assert.match(sw, /'\/language-buttons\.css'/);
  assert.match(sw, /url\.pathname\.startsWith\('\/api\/'\)/);
  assert.match(sw, /no-store/);
});


test('Founder menu authentication anchor exists and Kendra remains independent', () => {
  const html = text('apps/pwa/index.html');
  const app = text('apps/pwa/app.js');
  const access = text('apps/pwa/dashboard-access.js');
  assert.match(access, /#approvals/);
  assert.match(html, /id="approvals"[^>]*aria-labelledby="approvalsTitle"/);
  assert.match(html, /href="\/dashboard\/a"/);
  assert.match(html, /href="\/dashboard\/b"/);
  assert.match(html, /id="kendraOpenApp"[^>]*href="\/kendra"/);
  assert.match(app, /else void refreshKendraSummary\(\)/);
  assert.match(app, /const action = deviceKey \? founderSignInButton : founderLinkButton/);
});


test('la portada tablet usa la opción 2 y la app infantil conserva el mismo host', () => {
  const dash = text('prototypes/dashboard/src/dash.js');
  const app = text('prototypes/dashboard/src/app.js');
  const kid = text('apps/pwa/kendra.js');
  assert.match(dash, /function renderApprovedTabletHome/);
  assert.match(dash, /data-layout="approved-option-2"/);
  assert.match(app, /tabletHome \? renderApprovedTabletHome\(M, X\)/);
  assert.match(dash, /Sin datos verificados/);
  assert.match(kid, /kid-home-grid/);
  assert.match(kid, /kidDatesCard/);
  assert.match(kid, /mountGuardianAngel/);
  assert.match(kid, /createApprovedStage\(pet.id\)/);
});

test('Kendra: sin buscador, cada acceso abre solo un vídeo aún aprobado por Core', async () => {
  const kid = text('apps/pwa/kendra.js');
  const start = kid.indexOf('let mediaSelection = 0;');
  const end = kid.indexOf('function tabVer()', start);
  const next = kid.indexOf('function tabCasa()', end);
  assert.ok(start >= 0 && end > start && next > end);
  assert.doesNotMatch(kid.slice(end, next), /h\('input'|h\('form'|micButton\(/);
  assert.match(kid, /go\('ver'\); void openApprovedVideo\(video.id\)/);
  const video = { id: 'approved', label: 'Vídeo aprobado', embedUrl: 'https://www.youtube-nocookie.com/embed/approved' };
  const stale = { id: 'revoked', label: 'Retirado', embedUrl: 'https://example.invalid' };
  let response: { status: number; body: { status: string; videos?: typeof video[]; message?: string } } =
    { status: 200, body: { status: 'allow', videos: [video] } };
  const messages: string[] = [];
  const context = {
    tab: 'ver', player: null as typeof video | null,
    api: async () => response,
    renderMain: () => {}, flash: (message: string) => messages.push(message), showLock: () => {},
  };
  const open = runInNewContext(kid.slice(start, end) + '\nopenApprovedVideo;', context) as (id: string) => Promise<void>;
  await open(video.id);
  assert.equal(context.player?.id, video.id);
  await open(stale.id);
  assert.equal(context.player, null);
  assert.match(messages.at(-1) ?? '', /ya no está/);
  response = { status: 0, body: { status: 'offline' } };
  await open(video.id);
  assert.equal(context.player, null);
  response = { status: 200, body: { status: 'allow', videos: [video] } };
  context.tab = 'inicio';
  await open(video.id);
  assert.equal(context.player, null);
});

test('Founder: el brillo de los CTA no genera una caja mayor que el botón', () => {
  const css = text('prototypes/dashboard/src/companero-stage.css');
  const reflection = css.match(/\.jh-shell \.b3d:not\(\.off\)::before\{[^}]+\}/)?.[0] ?? '';
  assert.match(reflection, /inset:0;/);
  assert.match(reflection, /animation:janusHomeSpecularSweep/);
  assert.doesNotMatch(reflection, /inset:-|translateX\(/);
});
