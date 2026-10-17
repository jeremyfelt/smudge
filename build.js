// Builds Smudge from src/ into the files GitHub Pages serves from the repo root:
// index.html (styles, code and font inlined), sw.js and manifest.webmanifest.
//
//   node build.js                      build the Home Screen app
//   node build.js --artifact=out.html  also write a single-file preview (no <html>/<head>)
//
// No dependencies. Set SMUDGE_VERSION to pin the offline cache name.
const fs = require('fs');
const path = require('path');

const root = __dirname;
const src = (p) => path.join(root, 'src', p);
const version = process.env.SMUDGE_VERSION || new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');

const font = fs.readFileSync(src('fonts/bagel-fat-one-latin-400-normal.woff2')).toString('base64');
const css = fs.readFileSync(src('styles.css'), 'utf8').replace('__BAGEL__', font);
const body = fs.readFileSync(src('body.html'), 'utf8');
const js = fs.readdirSync(src('js')).filter((f) => f.endsWith('.js')).sort()
  .map((f) => `/* ---- ${f} ---- */\n` + fs.readFileSync(src('js/' + f), 'utf8')).join('\n');

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Smudge</title>
<meta name="description" content="A small creature that lives on your Home Screen and eats the colors you point your camera at.">
<meta name="theme-color" content="#2f3f86">
<meta name="color-scheme" content="light dark">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Smudge">
<meta name="format-detection" content="telephone=no">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<style>
${css}
</style>
</head>
<body>
${body}
<script>
${js}
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(root, 'index.html'), page);

const manifest = {
  id: './',
  name: 'Smudge',
  short_name: 'Smudge',
  description: 'A small creature that eats colors.',
  start_url: './',
  scope: './',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#151a45',
  theme_color: '#2f3f86',
  categories: ['entertainment', 'lifestyle'],
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};
fs.writeFileSync(path.join(root, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2) + '\n');
fs.writeFileSync(path.join(root, 'sw.js'), fs.readFileSync(src('sw.js'), 'utf8').replace('__VERSION__', version));

const flag = process.argv.find((a) => a.startsWith('--artifact='));
if (flag) {
  const out = path.resolve(flag.slice('--artifact='.length));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `<title>Smudge</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<style>\n${css}\n</style>\n${body}\n<script>\n${js}\n</script>\n`);
}
console.log(`built ${version} (${(page.length / 1024).toFixed(0)} KB)`);
