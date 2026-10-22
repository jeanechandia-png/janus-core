const fs = require('fs');
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');

const arg = process.argv[2]; const jobs = JSON.parse(arg.endsWith('.json') ? fs.readFileSync(arg, 'utf8') : arg); jobs.forEach((j) => { if (j.opts.svgFile) { j.opts.svg = fs.readFileSync(j.opts.svgFile, 'utf8'); delete j.opts.svgFile; } });
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8765/render.html'); await p.waitForFunction(() => window.R && window.R.ready, null, { timeout: 30000 }).catch(() => {});
  if (errs.length) console.log('ERR', errs.join('|'));
  for (const j of jobs) {
    const t0 = Date.now();
    const url = await p.evaluate(async (j) => window.R[j.fn](j.opts), j);
    fs.writeFileSync(j.out, Buffer.from(url.split(',')[1], 'base64'));
    console.log('ok', j.out, ((Date.now() - t0) / 1000).toFixed(1) + 's');
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
