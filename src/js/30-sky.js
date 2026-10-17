/* ============================================================
   Sky: the real sun and moon for where you are (estimated from
   your time zone, or exact with location), drawn as Smudge's sky.
   ============================================================ */
const Sky = (() => {
  const RAD = Math.PI / 180;
  // rough latitudes for common time zones (no permission needed)
  const TZLAT = {
    'America/Los_Angeles': 37, 'America/Vancouver': 49, 'America/Denver': 39.7, 'America/Phoenix': 33.4, 'America/Chicago': 41.9, 'America/New_York': 40.7,
    'America/Toronto': 43.7, 'America/Halifax': 44.6, 'America/Anchorage': 61.2, 'Pacific/Honolulu': 21.3, 'America/Mexico_City': 19.4, 'America/Bogota': 4.7,
    'America/Lima': -12, 'America/Sao_Paulo': -23.5, 'America/Argentina/Buenos_Aires': -34.6, 'America/Santiago': -33.4, 'Europe/London': 51.5, 'Europe/Dublin': 53.3,
    'Europe/Lisbon': 38.7, 'Europe/Madrid': 40.4, 'Europe/Paris': 48.9, 'Europe/Berlin': 52.5, 'Europe/Amsterdam': 52.4, 'Europe/Rome': 41.9, 'Europe/Stockholm': 59.3,
    'Europe/Oslo': 59.9, 'Europe/Helsinki': 60.2, 'Europe/Warsaw': 52.2, 'Europe/Athens': 38, 'Europe/Istanbul': 41, 'Europe/Moscow': 55.8, 'Africa/Cairo': 30,
    'Africa/Lagos': 6.5, 'Africa/Nairobi': -1.3, 'Africa/Johannesburg': -26.2, 'Asia/Dubai': 25.2, 'Asia/Kolkata': 19, 'Asia/Calcutta': 19, 'Asia/Bangkok': 13.8,
    'Asia/Singapore': 1.35, 'Asia/Shanghai': 31.2, 'Asia/Hong_Kong': 22.3, 'Asia/Taipei': 25, 'Asia/Seoul': 37.6, 'Asia/Tokyo': 35.7, 'Australia/Perth': -31.9,
    'Australia/Adelaide': -34.9, 'Australia/Brisbane': -27.5, 'Australia/Sydney': -33.9, 'Australia/Melbourne': -37.8, 'Pacific/Auckland': -36.8,
  };
  function guessPlace() {
    const y = new Date().getFullYear();
    const jan = new Date(y, 0, 1).getTimezoneOffset(), jul = new Date(y, 6, 1).getTimezoneOffset();
    const std = Math.max(jan, jul);
    const lon = -std / 4;
    let lat = 40;
    try { const tz = Intl.DateTimeFormat().resolvedOptions().timeZone; if (tz in TZLAT) lat = TZLAT[tz]; else if (jan < jul) lat = -33; } catch (e) {}
    return { lat, lon, exact: false };
  }
  let place = guessPlace();
  function setPlace(p) { place = p ? { lat: p.lat, lon: p.lon, exact: true } : guessPlace(); }

  function solar(date) {
    const d = date.getTime() / 86400000 - 10957.5;
    const g = (357.529 + 0.98560028 * d) * RAD;
    const q = 280.459 + 0.98564736 * d;
    const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
    const e = (23.439 - 0.00000036 * d) * RAD;
    const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
    const dec = Math.asin(Math.sin(e) * Math.sin(L));
    const gmst = ((18.697374558 + 24.06570982441908 * d) % 24 + 24) % 24;
    return { d, L, e, ra, dec, gmst };
  }
  function altHA(ra, dec, gmst) {
    const lst = (gmst * 15 + place.lon) * RAD;
    const H = wrapPi(lst - ra);
    const lat = place.lat * RAD;
    const alt = Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H));
    return { alt: alt / RAD, H };
  }
  function now(date = new Date()) {
    const s = solar(date);
    const sun = altHA(s.ra, s.dec, s.gmst);
    // moon: age-based elongation (good enough for a sky you can glance at)
    const age = ((date.getTime() / 86400000 + 2440587.5 - 2451550.26) / 29.530588853) % 1;
    const phase = age < 0 ? age + 1 : age;
    const Lm = s.L + phase * TAU;
    const ram = Math.atan2(Math.cos(s.e) * Math.sin(Lm), Math.cos(Lm));
    const decm = Math.asin(Math.sin(s.e) * Math.sin(Lm));
    const moon = altHA(ram, decm, s.gmst);
    return { sun, moon, phase };
  }

  // sky keyframes by sun altitude: [alt, top, mid, low]
  const KEYS = [
    [-18, '#060a1f', '#0d1333', '#1a1f48'],
    [-11, '#0b1131', '#1b1f50', '#332c64'],
    [-6, '#1c2358', '#43386f', '#8a5b88'],
    [-2, '#2b3a78', '#7a5e97', '#e79c8e'],
    [2, '#3f5c9e', '#b38bb0', '#ffb27d'],
    [8, '#6c9ad8', '#c4b6d2', '#ffd8ab'],
    [20, '#78b3ee', '#b7d5f3', '#eef0ee'],
    [50, '#5aa3ee', '#a6cff8', '#e5f1f8'],
  ].map(([a, ...c]) => [a, ...c.map(Color.fromHex)]);
  function palette(alt) {
    let i = 0;
    while (i < KEYS.length - 2 && alt > KEYS[i + 1][0]) i++;
    const A = KEYS[i], B = KEYS[i + 1];
    const t = clamp((alt - A[0]) / (B[0] - A[0]), 0, 1);
    return [1, 2, 3].map((k) => Color.lerpC(A[k], B[k], t));
  }

  /* ---------- stars, clouds, shooting stars ---------- */
  const r = rng(7);
  const STARS = Array.from({ length: 150 }, () => ({ x: r(), y: Math.pow(r(), 1.4), s: 0.4 + r() * r() * 1.6, p: r() * TAU, w: 0.6 + r() * 2.2 }));
  const CLOUDS = Array.from({ length: 4 }, (_, i) => ({ x: r(), y: 0.12 + r() * 0.42, s: 0.6 + r() * 0.7, v: 0.004 + r() * 0.006, puffs: Array.from({ length: 5 }, () => [r() * 2 - 1, r() * 0.6 - 0.3, 0.35 + r() * 0.5]) }));
  let shoot = null, nextShoot = nowS() + rand(25, 60);

  function drawMoon(ctx, x, y, R, phase, alpha, night) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const glow = ctx.createRadialGradient(x, y, R * 0.8, x, y, R * 4);
    glow.addColorStop(0, `rgba(235,232,255,${0.22 * night})`); glow.addColorStop(1, 'rgba(235,232,255,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, R * 4, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(60,60,105,${0.4 * night})`;
    ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
    // lit part: right limb when waxing (northern-hemisphere view)
    const waxing = phase < 0.5;
    const k = Math.cos(phase * TAU); // 1 new, -1 full
    ctx.fillStyle = '#f6f2df';
    ctx.beginPath();
    ctx.arc(x, y, R, -Math.PI / 2, Math.PI / 2, !waxing);
    ctx.ellipse(x, y, Math.max(0.01, Math.abs(k) * R), R, 0, Math.PI / 2, -Math.PI / 2, (k > 0) === waxing);
    ctx.fill();
    ctx.restore();
  }
  function drawSun(ctx, x, y, R, alt, alpha) {
    const warm = smoothstep(14, -2, alt);
    const core = warm > 0.5 ? '255,214,160' : '255,250,232';
    ctx.save(); ctx.globalAlpha = alpha;
    const g = ctx.createRadialGradient(x, y, 0, x, y, R * 6);
    g.addColorStop(0, `rgba(${core},.75)`); g.addColorStop(0.18, `rgba(${core},.35)`); g.addColorStop(1, `rgba(${core},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R * 6, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(255,${Math.round(lerp(252, 226, warm))},${Math.round(lerp(240, 186, warm))},1)`;
    ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // where a body sits in Smudge's sky (facing the equator: rises on the left)
  function skyXY(b, W, horizon) {
    const flip = place.lat < 0 ? -1 : 1;
    const x = W / 2 + Math.sin(b.H) * W * 0.42 * flip;
    const y = horizon - clamp(b.alt / 70, -0.2, 1) * (horizon * 0.78);
    return [x, y];
  }

  function draw(ctx, W, horizon, H, t, st, mirror) {
    const night = smoothstep(-2, -12, st.sun.alt);
    const day = smoothstep(-4, 6, st.sun.alt);
    // stars
    if (night > 0.02) {
      ctx.fillStyle = '#fff';
      for (const s of STARS) {
        const y = s.y * horizon * 0.96;
        const a = night * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.w + s.p))) * (0.4 + 0.6 * (1 - s.y));
        ctx.globalAlpha = a;
        ctx.fillRect(s.x * W, y, s.s, s.s);
        if (mirror) { ctx.globalAlpha = a * 0.28; ctx.fillRect(s.x * W, horizon + (horizon - y) * 0.55, s.s, s.s * 0.6); }
      }
      ctx.globalAlpha = 1;
      // a shooting star now and then
      if (!shoot && t > nextShoot && !ENV.reduced) { shoot = { x: rand(0.15, 0.85) * W, y: rand(0.08, 0.35) * horizon, vx: rand(260, 420) * (Math.random() < 0.5 ? -1 : 1), vy: rand(90, 160), t0: t }; }
      if (shoot) {
        const k = t - shoot.t0;
        if (k > 0.9) { shoot = null; nextShoot = t + rand(30, 90); }
        else {
          const x = shoot.x + shoot.vx * k, y = shoot.y + shoot.vy * k;
          const grad = ctx.createLinearGradient(x, y, x - shoot.vx * 0.18, y - shoot.vy * 0.18);
          grad.addColorStop(0, `rgba(255,255,255,${night * (1 - k / 0.9)})`); grad.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.strokeStyle = grad; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - shoot.vx * 0.18, y - shoot.vy * 0.18); ctx.stroke();
        }
      }
    }
    // clouds by day, faint by dusk
    if (day > 0.05 && !ENV.reduced) {
      for (const c of CLOUDS) {
        const x = (((c.x + t * c.v * 0.02) % 1.3) - 0.15) * W;
        const y = c.y * horizon;
        const R = 34 * c.s * (W / 390);
        for (const [dx, dy, s] of c.puffs) {
          const g = ctx.createRadialGradient(x + dx * R, y + dy * R, 0, x + dx * R, y + dy * R, R * s * 1.6);
          g.addColorStop(0, `rgba(255,255,255,${0.32 * day})`); g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + dx * R, y + dy * R, R * s * 1.6, 0, TAU); ctx.fill();
        }
      }
    }
    // moon and sun, clipped to the sky, with their reflections clipped to the ground
    const mA = smoothstep(-3, 4, st.moon.alt) * lerp(0.6, 1, night);
    const sA = smoothstep(-3, 1.5, st.sun.alt);
    const k = W / 390;
    const bodies = [];
    if (mA > 0.01) { const [mx, my] = skyXY(st.moon, W, horizon); bodies.push((y, a) => drawMoon(ctx, mx, y, 9 * k, st.phase, mA * a, night), my); }
    if (sA > 0.01) { const [sx, sy] = skyXY(st.sun, W, horizon); bodies.push((y, a) => drawSun(ctx, sx, y, 15 * k, st.sun.alt, sA * a), sy); }
    for (let i = 0; i < bodies.length; i += 2) {
      const fn = bodies[i], y = bodies[i + 1];
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, horizon); ctx.clip(); fn(y, 1); ctx.restore();
      if (mirror) { ctx.save(); ctx.beginPath(); ctx.rect(0, horizon, W, H - horizon); ctx.clip(); fn(horizon + (horizon - y) * 0.55, 0.3); ctx.restore(); }
    }
  }
  function hit(x, y, W, horizon, st) {
    for (const [b, kind] of [[st.sun, 'sun'], [st.moon, 'moon']]) {
      if (b.alt < -2) continue;
      const [bx, by] = skyXY(b, W, horizon);
      if (Math.hypot(x - bx, y - by) < 34) return kind;
    }
    return null;
  }
  return { now, palette, draw, hit, setPlace, get place() { return place; } };
})();
