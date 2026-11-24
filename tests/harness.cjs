const path = require('path');
const { chromium } = require('/opt/npm-tools/node_modules/playwright');

const ROOT = path.join(__dirname, '..');
const LIBS = [
  [/pcb-stackup@[^/]+\/dist\/pcb-stackup\.min\.js/, 'node_modules/pcb-stackup/dist/pcb-stackup.min.js'],
  [/gerber-to-svg@[^/]+\/dist\/gerber-to-svg\.min\.js/, 'node_modules/gerber-to-svg/dist/gerber-to-svg.min.js'],
  [/jszip\/[^/]+\/jszip\.min\.js/, 'node_modules/jszip/dist/jszip.min.js'],
];

async function openPage() {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route(/^https?:\/\//, (route) => {
    const url = route.request().url();
    const hit = LIBS.find(([re]) => re.test(url));
    if (hit) return route.fulfill({ path: path.join(ROOT, hit[1]), contentType: 'text/javascript' });
    return route.abort();
  });
  await page.goto('file://' + path.join(ROOT, 'index.html'));
  await page.waitForFunction(() => typeof window.render === 'function');
  return { page, browser, errors };
}

async function loadOwl(page) {
  await page.click('#btnSample');
  await page.waitForFunction(() => S.comps.length > 0 && ART.vb);
}

module.exports = { openPage, loadOwl, ROOT };
