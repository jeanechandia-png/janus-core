/* Contract audit of approved A/B dashboards. No new dashboard, no external credentials.
 * Enumerates REAL rendered controls on both approved skins and viewport sizes,
 * and checks that each action and route corresponds to a declared implementation.
 * This checks registration/routing, not whether every external business integration is live.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = path.join(__dirname, '..');
// Discover the exact source modules assembled by the production build. A new
// route must never fail simply because a second, hand-maintained list went stale.
const buildSource = ts.createSourceFile('build.cjs', fs.readFileSync(path.join(base, 'build.cjs'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const uiModules = [];
function discoverBuildModules(node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'files' && node.initializer && ts.isArrayLiteralExpression(node.initializer)) {
    for (const element of node.initializer.elements) {
      if (ts.isStringLiteral(element) && /^src\/[a-z0-9-]+\.js$/i.test(element.text)) uiModules.push(element.text);
    }
  }
  ts.forEachChild(node, discoverBuildModules);
}
discoverBuildModules(buildSource);
if (!uiModules.includes('src/oraciones.js') || !uiModules.includes('src/app.js')) throw new Error('JANUS: production registry discovery incomplete');
const actions = new Set();
const routes = new Set();
for (const relativePath of uiModules) {
  const fullPath = path.join(base, relativePath);
  const source = ts.createSourceFile(fullPath, fs.readFileSync(fullPath, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const name = node.name.text;
      if ((name === 'ACTS' || name.endsWith('_ACTS') || name === 'VIEWS') &&
          node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
        for (const property of node.initializer.properties) {
          if (property.name && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) {
            (name === 'VIEWS' ? routes : actions).add(property.name.text);
          }
        }
      }
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isPropertyAccessExpression(node.left) && ts.isIdentifier(node.left.expression) &&
        node.left.expression.text === 'VIEWS') {
      routes.add(node.left.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}
const required = ['clima','dia','familia','prioridades','janus','ingresos','alcance','chatbots',
  'contenido','clientes','datos','trabajo','inicio','ofertas','correo','radar','casos','cuentas','offline','companero','oraciones'];
for (const id of required) {
  if (!routes.has(id)) throw new Error('JANUS: missing original approved view: ' + id);
}
for (const action of ['oraSel','oraLang','oraRecite','oraSpeak','oraStop']) {
  if (!actions.has(action)) throw new Error('JANUS: missing prayer action: ' + action);
}
if (actions.size < 25 || routes.size < 18) {
  throw new Error('JANUS: action/view registry was not discovered from original sources');
}

(async () => {
  const browser = await chromium.launch({
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
    args: ['--no-sandbox'],
  });
  const failures = [];
  let inspected = 0;
  let combinations = 0;
  try {
    const file = path.resolve(process.env.DASH_FILE || path.join(base, 'dist/Janus-A-Obsidiana-interactivo.html'));
    for (const skin of ['a', 'b']) {
      for (const [label, viewport] of [
        ['tablet', { width:1194, height:834 }],
        ['phone', { width:430, height:932 }],
      ]) {
        const context = await browser.newContext({ viewport, isMobile: label === 'phone', hasTouch: label === 'phone' });
        await context.route('**/*', (route) => {
          const url = route.request().url();
          if (/^(file|data|blob|about):/.test(url)) return route.continue();
          return route.abort();
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', e => errors.push(String(e)));
        await page.goto('file://' + file + '?skin=' + skin);
        for (const id of ['', ...routes]) {
          await page.evaluate((route) => { location.hash = route ? '#' + route : '#'; }, id);
          await page.waitForTimeout(65);
          const scan = await page.evaluate(() => {
            const root = document.querySelector('#app');
            return {
              hash: location.hash,
              viewOpen: !document.querySelector('#view').hidden,
              controls: [...root.querySelectorAll('[data-act],[data-go]')].map(el => ({
                action: el.getAttribute('data-act'),
                route: el.getAttribute('data-go'),
              })),
            };
          });
          if ((!!id && !(label === 'tablet' && id === 'inicio')) !== scan.viewOpen) failures.push(skin + '/' + label + '/' + id + ': route does not open approved view');
          for (const control of scan.controls) {
            inspected++;
            if (control.action !== null && !actions.has(control.action)) {
              failures.push(skin + '/' + label + '/' + (id || 'home') + ': unregistered action ' + control.action);
            }
            if (control.route !== null) {
              const destination = control.route.split('/')[0];
              if (destination && !routes.has(destination)) {
                failures.push(skin + '/' + label + '/' + (id || 'home') + ': unknown route ' + destination);
              }
            }
          }
          combinations++;
        }
        if (errors.length) failures.push(skin + '/' + label + ': JavaScript exceptions ' + errors.slice(0, 3).join(' | '));
        if (skin === 'a' && label === 'tablet') {
          // The original click handler must not silently accept unregistered actions/routes.
          const logs = [];
          page.on('console', msg => { if (msg.type() === 'error') logs.push(msg.text()); });
          await page.evaluate(() => {
            const root = document.getElementById('app');
            for (const attr of ['data-act', 'data-go']) {
              const el = document.createElement('span');
              el.setAttribute(attr, '__janus_missing__');
              root.appendChild(el);
              el.click();
              el.remove();
            }
          });
          if (!logs.some(s => s.includes('JANUS_UI_ACTION_NOT_REGISTERED'))) {
            failures.push('unknown action was silently accepted');
          }
          if (!logs.some(s => s.includes('JANUS_UI_ROUTE_NOT_REGISTERED'))) {
            failures.push('unknown route was silently accepted');
          }
        }
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  const unique = [...new Set(failures)];
  console.log('JANUS existing views:', routes.size, 'registered actions:', actions.size,
    'screens examined:', combinations, 'controls examined:', inspected, 'failures:', unique.length);
  if (unique.length) {
    for (const error of unique.slice(0, 40)) console.error('JANUS ACTION CONTRACT:', error);
    process.exitCode = 1;
  }
})().catch(error => { console.error('JANUS ACTION CONTRACT:', error); process.exitCode = 1; });
