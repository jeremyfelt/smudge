// Redraws the app icons with the same code Smudge uses to draw itself.
// Needs Playwright (npm i -D playwright) and the site served locally, e.g.:
//   python3 -m http.server 8123   then   node tools/icons.js http://localhost:8123/
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const base = process.argv[2] || 'http://localhost:8123/';
const out = (f) => path.join(__dirname, '..', 'icons', f);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(base);
  await page.waitForTimeout(600);
  const icons = await page.evaluate(() => ({
    'apple-touch-icon.png': Portrait.icon(180).toDataURL('image/png'),
    'icon-192.png': Portrait.icon(192).toDataURL('image/png'),
    'icon-512.png': Portrait.icon(512).toDataURL('image/png'),
    'icon-maskable-512.png': Portrait.icon(512, true).toDataURL('image/png'),
  }));
  for (const [name, data] of Object.entries(icons)) fs.writeFileSync(out(name), Buffer.from(data.split(',')[1], 'base64'));
  await browser.close();
  console.log('icons written');
})();
