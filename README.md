# Smudge

A small creature that lives on your iPhone's Home Screen and eats the colors you point your camera at. Every color it eats becomes a named paint chip, five a day fill a paint strip you can share, and at night it hums a lullaby made from what it ate.

## Install it on an iPhone

1. Open https://smudge.jeremyfelt.com/ in Safari.
2. Tap **Share** (in iOS 26 it's inside the **•••** menu), then **Add to Home Screen**.
3. Open Smudge from your Home Screen.

## What it uses on the phone

- **Camera:** samples the color under a ring in Display P3 and names it as you aim.
- **Haptics:** taps you can feel, through the native switch control.
- **Tilt and shake:** Smudge slides, leans, gets dizzy, and melts into a puddle when the phone lies flat.
- **Microphone:** hum and it sings your tune back; blow on it and it puffs up like a balloon.
- **Lock Screen:** a lullaby composed from the day's colors, with artwork, while it glows as a nightlight and keeps the screen awake.
- **Icon badge:** how many colors it still wants today.
- **Share sheet:** paint-strip and paint-chip cards as images.
- **Real sky:** the sun and moon for your time zone, or your exact location if you allow it.
- **Offline:** a service worker keeps the whole app on the phone. Swatches stay on the device and are never uploaded.

## Working on it

Edit files in `src/`, then run:

```sh
node build.js
```

That needs no dependencies. It writes `index.html` (styles, code and the font inlined), `sw.js` and `manifest.webmanifest` at the repo root, which is what GitHub Pages serves. Commit those along with your changes to `src/`.

`node tools/icons.js` redraws the icons with Smudge's own drawing code. It needs Playwright and the site served locally; the file explains how.

The display face is [Bagel Fat One](https://github.com/JAMO-TYPEFACE/BagelFat), under the SIL Open Font License (`src/fonts/OFL.txt`).
