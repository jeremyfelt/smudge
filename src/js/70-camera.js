/* ============================================================
   Sight: the rear camera (or a photo) as Smudge's buffet.
   Samples the color under the reticle in Display P3.
   ============================================================ */
const Cam = (() => {
  const video = $('#cam');
  const still = $('#still');
  let stream = null, mode = null, img = null, imgCanvas = null;
  const ret = { x: 0.5, y: 0.42 };
  let live = null, liveAt = 0;
  const sc = document.createElement('canvas'); sc.width = sc.height = 24;
  let sctx = null, P3 = false;
  try { sctx = sc.getContext('2d', { colorSpace: 'display-p3', willReadFrequently: true }); } catch (e) {}
  if (!sctx) sctx = sc.getContext('2d', { willReadFrequently: true });
  try { P3 = !!(sctx.getContextAttributes && sctx.getContextAttributes().colorSpace === 'display-p3'); } catch (e) {}

  async function openLive() {
    if (ENV.framed || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw Object.assign(new Error('nocam'), { name: 'NotSupportedError' });
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
    video.srcObject = stream;
    video.muted = true;
    try { await video.play(); } catch (e) {}
    mode = 'live'; img = null;
    still.hidden = true;
    video.classList.add('on');
  }
  function openStill(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file);
      const im = new Image();
      im.onload = () => {
        // keep a downscaled copy in a wide-gamut canvas for fast sampling
        const s = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight));
        const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
        let cx = null; try { cx = c.getContext('2d', { colorSpace: 'display-p3' }); } catch (e) {}
        (cx || c.getContext('2d')).drawImage(im, 0, 0, c.width, c.height);
        imgCanvas = c; img = im; mode = 'still';
        still.src = url; still.hidden = false;
        stopStream();
        video.classList.remove('on');
        res();
      };
      im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('That file could not be opened as a picture.')); };
      im.src = url;
    });
  }
  function stopStream() { try { stream && stream.getTracks().forEach((t) => t.stop()); } catch (e) {} stream = null; video.srcObject = null; }
  function close() {
    stopStream();
    video.classList.remove('on');
    if (still.src) { try { URL.revokeObjectURL(still.src); } catch (e) {} still.removeAttribute('src'); }
    still.hidden = true;
    mode = null; img = null; imgCanvas = null; live = null;
    ret.x = 0.5; ret.y = 0.42;
  }
  function dims() {
    if (mode === 'live') return [video.videoWidth, video.videoHeight];
    if (mode === 'still' && imgCanvas) return [imgCanvas.width, imgCanvas.height];
    return [0, 0];
  }
  // screen point → source pixel, matching object-fit: cover
  function toSource(px, py) {
    const [sw, sh] = dims(); const W = innerWidth, H = innerHeight;
    const s = Math.max(W / sw, H / sh);
    return { x: (px - (W - sw * s) / 2) / s, y: (py - (H - sh * s) / 2) / s, s };
  }
  function sample() {
    const [sw, sh] = dims();
    if (!sw || !sh) return null;
    const src = mode === 'live' ? video : imgCanvas;
    const { x, y, s } = toSource(ret.x * innerWidth, ret.y * innerHeight);
    const r = 15 / s;
    try {
      sctx.clearRect(0, 0, 24, 24);
      sctx.drawImage(src, x - r, y - r, r * 2, r * 2, 0, 0, 24, 24);
      const d = (P3 ? sctx.getImageData(0, 0, 24, 24, { colorSpace: 'display-p3' }) : sctx.getImageData(0, 0, 24, 24)).data;
      let R = 0, G = 0, B = 0, W = 0;
      for (let j = 0; j < 24; j++) for (let i = 0; i < 24; i++) {
        const dx = i - 11.5, dy = j - 11.5, w = Math.exp(-(dx * dx + dy * dy) / 50);
        const k = (j * 24 + i) * 4;
        if (d[k + 3] < 200) continue;
        R += Color.toLin(d[k] / 255) * w; G += Color.toLin(d[k + 1] / 255) * w; B += Color.toLin(d[k + 2] / 255) * w; W += w;
      }
      if (!W) return null;
      const c = [R / W, G / W, B / W].map(Color.toGam);
      const col = P3 ? Color.fromP3(...c) : Color.fromSrgb(...c);
      // smooth in OKLab so the name doesn't flicker
      if (live && performance.now() - liveAt < 400) live = Color.lerpC(live, col, mode === 'still' ? 1 : 0.35);
      else live = col;
      liveAt = performance.now();
      return live;
    } catch (e) { return null; }
  }
  function crop() {
    const [sw, sh] = dims(); if (!sw) return '';
    const src = mode === 'live' ? video : imgCanvas;
    const { x, y, s } = toSource(ret.x * innerWidth, ret.y * innerHeight);
    const r = 70 / s;
    const c = document.createElement('canvas'); c.width = c.height = 120;
    let cx = null; try { cx = c.getContext('2d', { colorSpace: 'display-p3' }); } catch (e) {}
    cx = cx || c.getContext('2d');
    try { cx.drawImage(src, x - r, y - r, r * 2, r * 2, 0, 0, 120, 120); return c.toDataURL('image/jpeg', 0.74); } catch (e) { return ''; }
  }
  function moveReticle(px, py) {
    ret.x = clamp(px / innerWidth, 0.08, 0.92);
    ret.y = clamp(py / innerHeight, 0.24, 0.66);
  }
  return { openLive, openStill, close, sample, crop, moveReticle, ret, get mode() { return mode; }, get color() { return live; }, get p3() { return P3; } };
})();
