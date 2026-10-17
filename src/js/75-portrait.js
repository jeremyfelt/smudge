/* ============================================================
   Portrait: a still Smudge for the app icon, launch screen,
   lock-screen artwork and shareable paint-strip cards.
   ============================================================ */
const Portrait = (() => {
  const OPAL = Color.fromHex('#D8D2F4');
  const DEFAULT = ['#F2925C', '#5FC4B8', '#F49AC1'].map(Color.fromHex);

  function shape(ctx, x, y, R) {
    ctx.beginPath();
    for (let i = 0; i <= 72; i++) {
      const a = (i / 72) * TAU, c = Math.cos(a), s = Math.sin(a);
      const px = x + Math.sign(c) * Math.pow(Math.abs(c), 0.86) * R * 1.1;
      const py = y + (s > 0 ? Math.pow(s, 0.62) * R * 0.78 : -Math.pow(-s, 0.95) * R * 0.98);
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
  }
  function smudge(ctx, x, y, R, cols, { eyes = 'open', mouth = 'smile', glow = 0, shadow = true } = {}) {
    cols = cols && cols.length ? cols : DEFAULT;
    const base = Color.mix([OPAL, ...cols], [1.4, ...cols.map(() => 0.9 / cols.length)]);
    if (glow) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(x, y, R * 0.4, x, y, R * 2.6);
      g.addColorStop(0, Color.css(base, 0.5 * glow)); g.addColorStop(1, Color.css(base, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R * 2.6, 0, TAU); ctx.fill(); ctx.restore();
    }
    if (shadow) {
      ctx.save(); ctx.translate(x, y + R * 0.78); ctx.scale(1, 0.16);
      const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 1.2);
      sg.addColorStop(0, 'rgba(20,14,50,.35)'); sg.addColorStop(1, 'rgba(20,14,50,0)');
      ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(0, 0, R * 1.2, 0, TAU); ctx.fill(); ctx.restore();
    }
    shape(ctx, x, y, R);
    const fill = ctx.createRadialGradient(x - R * 0.35, y - R * 0.45, R * 0.05, x, y + R * 0.15, R * 1.3);
    fill.addColorStop(0, Color.css(Color.tone(base, 0.16, 0.7))); fill.addColorStop(0.55, Color.css(base)); fill.addColorStop(1, Color.css(Color.tone(base, -0.16, 1.1)));
    ctx.fillStyle = fill; ctx.fill();
    ctx.save(); ctx.clip();
    const spots = [[-0.45, 0.15, 0.85], [0.42, -0.1, 0.8], [0.05, 0.45, 0.75], [-0.1, -0.5, 0.7], [0.5, 0.45, 0.65]];
    cols.slice(0, 5).forEach((c, i) => {
      const [dx, dy, s] = spots[i];
      const px = x + dx * R, py = y + dy * R, r = R * s;
      const g = ctx.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, Color.css(c, 0.95)); g.addColorStop(0.55, Color.css(c, 0.5)); g.addColorStop(1, Color.css(c, 0));
      ctx.fillStyle = g; ctx.fillRect(px - r, py - r, r * 2, r * 2);
    });
    const sh = ctx.createLinearGradient(0, y - R * 0.2, 0, y + R);
    sh.addColorStop(0, 'rgba(30,20,70,0)'); sh.addColorStop(1, 'rgba(30,20,70,.2)');
    ctx.fillStyle = sh; ctx.fillRect(x - R * 2, y - R, R * 4, R * 3);
    ctx.restore();
    ctx.lineWidth = Math.max(1.5, R * 0.035);
    const rim = ctx.createLinearGradient(0, y - R, 0, y + R);
    rim.addColorStop(0, 'rgba(255,255,255,.7)'); rim.addColorStop(0.45, 'rgba(255,255,255,.08)'); rim.addColorStop(1, 'rgba(255,255,255,.25)');
    ctx.strokeStyle = rim; ctx.stroke();
    ctx.save(); ctx.translate(x - R * 0.4, y - R * 0.52); ctx.rotate(-0.55); ctx.scale(1, 0.5);
    const gl = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.32);
    gl.addColorStop(0, 'rgba(255,255,255,.9)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, R * 0.32, 0, TAU); ctx.fill(); ctx.restore();
    // face
    const ink = '#221c3e';
    const ex = R * 0.25, ey = y - R * 0.2, rx = R * 0.09, ry = R * 0.125;
    ctx.fillStyle = ink; ctx.strokeStyle = ink; ctx.lineCap = 'round'; ctx.lineWidth = R * 0.04;
    for (const s of [-1, 1]) {
      const cx = x + s * ex;
      if (eyes === 'closed') { ctx.beginPath(); ctx.moveTo(cx - rx * 1.1, ey); ctx.quadraticCurveTo(cx, ey + ry * 0.8, cx + rx * 1.1, ey); ctx.stroke(); continue; }
      ctx.beginPath(); ctx.ellipse(cx, ey, rx, ry, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx - rx * 0.32, ey - ry * 0.38, rx * 0.38, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + rx * 0.3, ey + ry * 0.34, rx * 0.15, 0, TAU); ctx.fill();
      ctx.fillStyle = ink;
    }
    ctx.fillStyle = 'rgba(255,110,150,.35)';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + s * R * 0.4, y - R * 0.04, R * 0.1, R * 0.055, 0, 0, TAU); ctx.fill(); }
    const my = y - R * 0.01, w = R * 0.11;
    ctx.beginPath();
    if (mouth === 'tiny') { ctx.moveTo(x - w * 0.5, my); ctx.quadraticCurveTo(x, my + w * 0.5, x + w * 0.5, my); }
    else { ctx.moveTo(x - w, my); ctx.quadraticCurveTo(x, my + w * 0.95, x + w, my); }
    ctx.lineWidth = R * 0.034; ctx.stroke();
    return base;
  }

  function sky(ctx, w, h, horizon, stops) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    const [top, mid, low] = stops.map((c) => Color.css(c));
    const hz = horizon / h;
    g.addColorStop(0, top); g.addColorStop(hz * 0.58, mid); g.addColorStop(hz, low);
    const gt = Color.css(Color.tone(stops[2], -0.07, 0.85)), gm = Color.css(Color.tone(stops[1], -0.1, 0.85)), gl = Color.css(Color.tone(stops[0], -0.12, 0.85));
    g.addColorStop(Math.min(1, hz + 0.0001), gt); g.addColorStop(Math.min(1, hz + (1 - hz) * 0.45), gm); g.addColorStop(1, gl);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const line = ctx.createLinearGradient(0, 0, w, 0);
    line.addColorStop(0, 'rgba(255,255,255,0)'); line.addColorStop(0.5, 'rgba(255,255,255,.7)'); line.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = line; ctx.fillRect(0, horizon - Math.max(1, h * 0.002) / 2, w, Math.max(1, h * 0.002));
  }
  const DUSK = ['#2f3f86', '#8c6aa6', '#f6a98c'].map(Color.fromHex);
  const NIGHT = ['#080c26', '#151a45', '#2d2a63'].map(Color.fromHex);

  function reflect(ctx, w, h, horizon, draw) {
    // draw the scene again, flipped and faded below the horizon
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.translate(0, horizon * 2 * 0.92); x.scale(1, -0.92); draw(x);
    x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'destination-in';
    const m = x.createLinearGradient(0, horizon, 0, horizon + (h - horizon) * 0.7);
    m.addColorStop(0, 'rgba(0,0,0,.4)'); m.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = m; x.fillRect(0, 0, w, h);
    ctx.drawImage(c, 0, 0);
  }

  function icon(size, maskable = false) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const ctx = c.getContext('2d');
    const hz = size * (maskable ? 0.64 : 0.68);
    sky(ctx, size, size, hz, DUSK);
    const R = size * (maskable ? 0.24 : 0.3);
    const cols = DEFAULT;
    const draw = (x) => smudge(x, size / 2, hz - R * 0.78, R, cols, { shadow: false });
    reflect(ctx, size, size, hz, draw);
    draw(ctx);
    return c;
  }
  function splash(w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    const hz = h * 0.62;
    sky(ctx, w, h, hz, NIGHT);
    const R = Math.min(w * 0.2, h * 0.1);
    const draw = (x) => smudge(x, w / 2, hz - R * 0.78, R, DEFAULT, { eyes: 'closed', mouth: 'tiny', glow: 0.8, shadow: false });
    reflect(ctx, w, h, hz, draw);
    draw(ctx);
    ctx.fillStyle = 'rgba(244,242,255,.92)'; ctx.textAlign = 'center';
    ctx.font = `400 ${Math.round(R * 0.62)}px "Bagel Fat One", ui-rounded, system-ui`;
    ctx.fillText('smudge', w / 2, hz - R * 2.25);
    return c;
  }
  function art(cols, size = 512) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const ctx = c.getContext('2d');
    const hz = size * 0.7;
    sky(ctx, size, size, hz, NIGHT);
    const R = size * 0.27;
    const draw = (x) => smudge(x, size / 2, hz - R * 0.78, R, cols, { eyes: 'closed', mouth: 'tiny', glow: 0.9, shadow: false });
    reflect(ctx, size, size, hz, draw);
    draw(ctx);
    ctx.fillStyle = '#fff';
    const r = rng(size); for (let i = 0; i < 40; i++) { ctx.globalAlpha = 0.3 + r() * 0.6; ctx.fillRect(r() * size, r() * hz * 0.7, 1.5, 1.5); }
    ctx.globalAlpha = 1;
    return c;
  }
  return { smudge, icon, splash, art, sky, DUSK, NIGHT };
})();

/* ============================================================
   Cards: render a day's paint strip (or one chip) as a PNG.
   ============================================================ */
const Cards = (() => {
  const cache = new Map();
  const ready = () => (document.fonts && document.fonts.load ? document.fonts.load('400 40px "Bagel Fat One"').catch(() => {}) : Promise.resolve());
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function fitFont(ctx, text, max, size, family) { let s = size; do { ctx.font = `400 ${s}px ${family}`; s -= 2; } while (ctx.measureText(text).width > max && s > 18); }
  const FAM = '"Bagel Fat One", ui-rounded, system-ui, sans-serif';
  const UIF = 'ui-rounded, system-ui, -apple-system, sans-serif';

  async function strip(day, meals) {
    const key = 'strip:' + day + ':' + meals.map((m) => m.id).join(',') + ':' + S.name;
    if (cache.has(key)) return cache.get(key);
    await ready();
    const W = 1080, H = 1350;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    let ctx = null; try { ctx = c.getContext('2d', { colorSpace: 'display-p3' }); } catch (e) {}
    ctx = ctx || c.getContext('2d');
    const cols = meals.map((m) => Color.fromP3(...m.p3));
    const g = ctx.createLinearGradient(0, 0, W * 0.3, H);
    g.addColorStop(0, '#c9c3f0'); g.addColorStop(0.55, '#ead7ee'); g.addColorStop(1, '#ffd9c2');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const bg = Color.fromHex('#d9cfee');
    const cw = 720, cx = (W - cw) / 2, cy = 96, chipH = 176, top = 118, ch = top + chipH * 5 + 150;
    ctx.save(); ctx.shadowColor = 'rgba(25,18,70,.28)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 24;
    rr(ctx, cx, cy, cw, ch, 34); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
    // punched hole
    ctx.save(); ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = Color.css(Color.tone(bg, 0.12, 0.4)); ctx.beginPath(); ctx.arc(W / 2, cy + 52, 17, 0, TAU); ctx.fill();
    const hs = ctx.createLinearGradient(0, cy + 35, 0, cy + 69); hs.addColorStop(0, 'rgba(20,14,60,.35)'); hs.addColorStop(0.4, 'rgba(20,14,60,0)');
    ctx.fillStyle = hs; ctx.beginPath(); ctx.arc(W / 2, cy + 52, 17, 0, TAU); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#2a2456'; ctx.textBaseline = 'alphabetic';
    ctx.font = `400 34px ${FAM}`; ctx.textAlign = 'left'; ctx.fillText('Smudge Color Co.', cx + 34, cy + 64);
    ctx.font = `600 26px ${UIF}`; ctx.textAlign = 'right'; ctx.fillStyle = '#6a6496';
    ctx.fillText(fmtDay(day, { month: 'short', day: 'numeric', year: 'numeric' }), cx + cw - 34, cy + 62);
    // chips
    const x0 = cx + 26, w0 = cw - 52;
    ctx.save(); rr(ctx, x0, cy + top, w0, chipH * 5, 22); ctx.clip();
    for (let i = 0; i < 5; i++) {
      const y = cy + top + i * chipH;
      const m = meals[i];
      if (!m) {
        ctx.fillStyle = '#f2f0f9'; ctx.fillRect(x0, y, w0, chipH);
        ctx.strokeStyle = '#e6e2f4'; ctx.lineWidth = 10;
        for (let k = -chipH; k < w0; k += 26) { ctx.beginPath(); ctx.moveTo(x0 + k, y + chipH); ctx.lineTo(x0 + k + chipH, y); ctx.stroke(); }
        ctx.fillStyle = '#9a95c0'; ctx.font = `600 30px ${UIF}`; ctx.textAlign = 'left'; ctx.fillText('not eaten yet', x0 + 30, y + chipH - 34);
        continue;
      }
      const col = cols[i];
      ctx.fillStyle = Color.css(col); ctx.fillRect(x0, y, w0, chipH + 1);
      const ink = Color.ink(col);
      ctx.fillStyle = ink;
      ctx.font = `600 25px ${UIF}`;
      const meta = `${m.hex}  LRV ${m.lrv}`, num = `№ ${pad4(m.n)}`;
      const mw = Math.max(ctx.measureText(meta).width, ctx.measureText(num).width);
      ctx.globalAlpha = 0.82; ctx.textAlign = 'right';
      ctx.fillText(num, x0 + w0 - 30, y + chipH - 70);
      ctx.fillText(meta, x0 + w0 - 30, y + chipH - 34);
      ctx.globalAlpha = 1; ctx.textAlign = 'left';
      fitFont(ctx, m.name, w0 - 60 - mw - 28, 54, FAM); ctx.fillText(m.name, x0 + 30, y + chipH - 34);
    }
    ctx.restore();
    // footer with a little Smudge
    ctx.fillStyle = '#2a2456'; ctx.textAlign = 'left'; ctx.font = `600 28px ${UIF}`;
    const fy = cy + top + chipH * 5 + 66;
    ctx.fillText(`Collected by ${S.name}`, cx + 34, fy);
    ctx.fillStyle = '#6a6496'; ctx.font = `500 24px ${UIF}`;
    ctx.fillText(`${meals.length} of 5 colors, found in the wild`, cx + 34, fy + 38);
    Portrait.smudge(ctx, cx + cw - 96, fy - 6, 56, cols, { shadow: false });
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    const out = { blob, url: URL.createObjectURL(blob), name: `smudge-palette-${day}.png` };
    cache.set(key, out);
    return out;
  }

  async function chip(m) {
    const key = 'chip:' + m.id;
    if (cache.has(key)) return cache.get(key);
    await ready();
    const W = 1080, H = 1350;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    let ctx = null; try { ctx = c.getContext('2d', { colorSpace: 'display-p3' }); } catch (e) {}
    ctx = ctx || c.getContext('2d');
    const col = Color.fromP3(...m.p3);
    ctx.fillStyle = Color.css(Color.tone(col, 0.25, 0.25)); ctx.fillRect(0, 0, W, H);
    const cw = 760, cx = (W - cw) / 2, cy = 130, chh = 1000;
    ctx.save(); ctx.shadowColor = 'rgba(25,18,70,.28)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 24;
    rr(ctx, cx, cy, cw, chh, 30); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
    ctx.save(); rr(ctx, cx + 28, cy + 28, cw - 56, 700, 20); ctx.clip(); ctx.fillStyle = Color.css(col); ctx.fillRect(cx, cy, cw, 760); ctx.restore();
    const crop = await Crops.get(m.id);
    if (crop) {
      const im = new Image(); im.src = crop; try { await im.decode(); } catch (e) {}
      ctx.save(); ctx.beginPath(); ctx.arc(cx + cw - 150, cy + 150, 92, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.beginPath(); ctx.arc(cx + cw - 150, cy + 150, 82, 0, TAU); ctx.clip(); ctx.drawImage(im, cx + cw - 232, cy + 68, 164, 164); ctx.restore();
    }
    ctx.fillStyle = '#2a2456'; ctx.textAlign = 'left';
    fitFont(ctx, m.name, cw - 80, 72, FAM); ctx.fillText(m.name, cx + 40, cy + 830);
    ctx.font = `600 28px ${UIF}`; ctx.fillStyle = '#6a6496';
    ctx.fillText(`№ ${pad4(m.n)}    ${m.hex}    LRV ${m.lrv}`, cx + 40, cy + 885);
    ctx.fillText(`Eaten by ${S.name} on ${fmtDay(m.day, { month: 'long', day: 'numeric' })}`, cx + 40, cy + 935);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    const out = { blob, url: URL.createObjectURL(blob), name: `smudge-${m.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png` };
    cache.set(key, out);
    return out;
  }

  async function share(card, title) {
    const file = new File([card.blob], card.name, { type: 'image/png' });
    if (!ENV.framed && navigator.canShare && navigator.share) {
      try { if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title }); return 'shared'; } }
      catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; if (e && e.name === 'NotAllowedError') return 'again'; }
    }
    try {
      if (window.claude && typeof window.claude.use === 'function') {
        const dl = await window.claude.use('downloads');
        if (dl) { try { await dl.save({ filename: card.name, data: card.blob }); return 'saved'; } catch (e) { return e && e.code === 'declined' ? 'cancelled' : 'failed'; } }
      }
    } catch (e) {}
    if (ENV.framed) return 'failed';
    const a = document.createElement('a'); a.href = card.url; a.download = card.name; document.body.appendChild(a); a.click(); a.remove();
    return 'saved';
  }
  return { strip, chip, share };
})();
