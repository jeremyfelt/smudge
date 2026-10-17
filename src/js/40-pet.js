/* ============================================================
   Pet: Smudge's jelly body (a pressure + shape-matching soft body)
   and everything drawn on it: pigments, gloss, glow, face.
   ============================================================ */
const Pet = (() => {
  const N = 30;
  const P = Array.from({ length: N }, () => ({ x: 0, y: 0, vx: 0, vy: 0 }));
  const DIR = Array.from({ length: N }, (_, i) => { const a = (i / N) * TAU; return [Math.cos(a), Math.sin(a)]; });
  const G = 2000;
  let R = 100, Rt = 100;
  let cx = 0, cy = 0, vcx = 0, vcy = 0;
  let ang = 0, angV = 0;
  const B = { l: 0, t: 0, r: 0, b: 0 };
  const BT = { l: 0, t: 0, r: 0, b: 0 };
  const grav = { x: 0, y: 1 };
  let inertia = { x: 0, y: 0 };
  let squish = 0, squishT = 0, squishX = 0;
  let inflate = 0;
  let puddle = 0, puddleT = 0;
  let breathe = 0, breatheRate = 1.6;
  let grab = null;
  let landCb = null, lastImpact = 0;
  let contact = 0;
  let placed = false;
  const local = { minY: -1, maxY: 1, w: 2, h: 2 };
  const rest = Array.from({ length: N }, () => [0, 0]);
  let restLen = 0, A0 = 1;

  /* ---------- color ---------- */
  const OPAL = Color.fromHex('#D8D2F4');
  const SHEEN = ['#FFC8E4', '#BFF0EC', '#D4C6FF'].map(Color.fromHex);
  let pal = null;
  const pigs = [];  // { c, w, th, om, r, s, born }
  function setPigments(list, freshHex) {
    // list: [{c, w}] newest last; freshHex marks a color that was just swallowed
    const keep = pigs.slice();
    pigs.length = 0;
    list.forEach((p) => {
      const hx = Color.hex(p.c);
      const old = keep.find((k) => Color.hex(k.c) === hx);
      const born = hx === freshHex ? nowS() : -9;
      pigs.push(old && hx !== freshHex ? Object.assign(old, { w: p.w }) : { c: p.c, w: p.w, th: rand(TAU), om: rand(0.12, 0.3) * (Math.random() < 0.5 ? -1 : 1), r: rand(0.22, 0.48), s: rand(0.55, 0.85), born });
    });
    const W = pigs.reduce((a, p) => a + p.w, 0);
    const lead = pigs.length ? pigs.reduce((a, p) => (p.w > a.w ? p : a), pigs[0]) : null;
    const strength = lead ? clamp(lead.w, 0, 1) : 0;
    // tint toward the last thing eaten, lightened in its own hue (mixing with lilac turned yellows olive)
    let base = OPAL;
    if (lead) {
      const k = Color.lch(lead.c), t = strength * 0.7;
      base = Color.fromLch(lerp(0.9, clamp(k.L, 0.42, 0.88), t), k.C * t * 1.1, k.h);
      base = Color.mix([OPAL, base], [0.12, 0.88]);
    }
    const sat = clamp(W, 0, 1);
    const glowC = Color.tone(base, 0.05, 1.2);
    pal = {
      base, sat,
      css: Color.css(base),
      hi: Color.css(Color.tone(base, 0.16, 0.7)),
      lo: Color.css(Color.tone(base, -0.16, 1.1)),
      rim: Color.css(Color.tone(base, 0.25, 0.4), 0.7),
      glow: (a) => Color.css(glowC, a),
      tongue: Color.css(Color.mix([Color.fromHex('#FF7FA0'), base], [0.7, 0.3])),
    };
    pigs.forEach((p) => { p.css = Color.css(p.c, 0.85); p.css0 = Color.css(p.c, 0); });
  }

  /* ---------- layout ---------- */
  function layout({ l, t, r, b, radius }, snap) {
    Object.assign(BT, { l, t, r, b });
    Rt = radius;
    if (snap || !placed) {
      Object.assign(B, BT); R = Rt;
      if (!placed) place((l + r) / 2, b - R * 1.4);
      placed = true;
    }
  }
  function place(x, y) {
    computeRest();
    for (let i = 0; i < N; i++) { P[i].x = x + rest[i][0]; P[i].y = y + rest[i][1]; P[i].vx = P[i].vy = 0; }
    ang = 0; angV = 0;
  }

  function computeRest() {
    const infl = 1 + inflate * 0.62;
    let sx = lerp(1.02, 1.55, puddle) * (1 + squish * 0.3);
    let sy = lerp(1.04, 0.52, puddle) * (1 - squish * 0.45);
    sx = lerp(sx, 1, inflate * 0.8); sy = lerp(sy, 1, inflate * 0.8);
    const br = 1 + Math.sin(breathe) * 0.016;
    const rr = R * infl;
    for (let i = 0; i < N; i++) {
      const [dx, dy] = DIR[i];
      const flat = dy > 0 ? lerp(0.94, 1, inflate) : 1;
      rest[i][0] = dx * rr * sx * (2 - br);
      rest[i][1] = dy * rr * sy * br * flat;
    }
    let a = 0;
    for (let i = 0; i < N; i++) { const p = rest[i], q = rest[(i + 1) % N]; a += p[0] * q[1] - q[0] * p[1]; }
    A0 = Math.abs(a) / 2;
    restLen = Math.hypot(rest[1][0] - rest[0][0], rest[1][1] - rest[0][1]);
  }

  /* ---------- physics ---------- */
  function step(dt) {
    // ease layout
    const k = 1 - Math.exp(-dt * 6);
    B.l = lerp(B.l, BT.l, k); B.r = lerp(B.r, BT.r, k); B.t = lerp(B.t, BT.t, k); B.b = lerp(B.b, BT.b, k);
    R = lerp(R, Rt, k);
    squish = lerp(squish, squishT, 1 - Math.exp(-dt * 14));
    puddle = lerp(puddle, puddleT, 1 - Math.exp(-dt * 2.5));
    breathe += dt * breatheRate;
    computeRest();

    cx = cy = vcx = vcy = 0;
    for (const p of P) { cx += p.x; cy += p.y; vcx += p.vx; vcy += p.vy; }
    cx /= N; cy /= N; vcx /= N; vcy /= N;

    // best-fit rotation of the current shape vs the rest shape
    let num = 0, den = 0;
    for (let i = 0; i < N; i++) { const qx = P[i].x - cx, qy = P[i].y - cy; num += rest[i][0] * qy - rest[i][1] * qx; den += rest[i][0] * qx + rest[i][1] * qy; }
    const fit = Math.atan2(num, den);
    const gm = Math.hypot(grav.x, grav.y);
    const up = gm > 0.15 ? Math.atan2(-grav.x, grav.y) : ang;
    angV += (wrapPi(fit - ang) * 26 + wrapPi(up - ang) * (grab ? 2 : 7) - angV * 7) * dt;
    ang = wrapPi(ang + angV * dt);
    const ca = Math.cos(ang), sa = Math.sin(ang);

    // area
    let area = 0;
    for (let i = 0; i < N; i++) { const p = P[i], q = P[(i + 1) % N]; area += p.x * q.y - q.x * p.y; }
    area = Math.abs(area) / 2;
    const press = clamp((A0 - area) / A0, -0.6, 0.6) * 1400;

    const gmul = (1 - inflate * 1.3) * (R / 100) * 0.8;
    const gx = grav.x * G * gmul + inertia.x, gy = grav.y * G * gmul + inertia.y;
    const kS = lerp(250, 90, puddle), cS = 6.5;
    for (let i = 0; i < N; i++) {
      const p = P[i];
      const tx = cx + ca * rest[i][0] - sa * rest[i][1];
      const ty = cy + sa * rest[i][0] + ca * rest[i][1];
      let fx = gx + (tx - p.x) * kS - (p.vx - vcx) * cS;
      let fy = gy + (ty - p.y) * kS - (p.vy - vcy) * cS;
      const a = P[(i + N - 1) % N], b = P[(i + 1) % N];
      fx += (b.y - a.y) * 0.5 * press;
      fy += -(b.x - a.x) * 0.5 * press;
      if (grab && grab.w[i] > 0.01) {
        const w = grab.w[i];
        fx += (grab.x + grab.ox[i] - p.x) * 520 * w - p.vx * 16 * w;
        fy += (grab.y + grab.oy[i] - p.y) * 520 * w - p.vy * 16 * w;
      }
      if (squishT > 0) { const d = Math.abs(p.x - squishX) / R; if (d < 0.8) fy += 900 * (1 - d) * squishT * grav.y; }
      p.vx += fx * dt; p.vy += fy * dt;
    }
    // neighbor springs keep the skin smooth
    for (let i = 0; i < N; i++) {
      const p = P[i], q = P[(i + 1) % N];
      const dx = q.x - p.x, dy = q.y - p.y; const len = Math.hypot(dx, dy) || 1;
      const nx = dx / len, ny = dy / len;
      const rv = (q.vx - p.vx) * nx + (q.vy - p.vy) * ny;
      const f = ((len - restLen) * 700 + rv * 5) * dt;
      p.vx += nx * f; p.vy += ny * f; q.vx -= nx * f; q.vy -= ny * f;
    }
    let impact = 0, touching = 0;
    const air = 1 - (0.35 + 5 * puddle) * dt;
    for (const p of P) {
      p.vx *= air; p.vy *= air;
      p.x += p.vx * dt; p.y += p.vy * dt;
      // walls
      if (p.y > B.b) { p.y = B.b; if (p.vy > 0) { impact = Math.max(impact, p.vy); fric(p, 'vx', p.vy); p.vy *= -0.16; } touching++; }
      else if (p.y < B.t) { p.y = B.t; if (p.vy < 0) { impact = Math.max(impact, -p.vy); fric(p, 'vx', p.vy); p.vy *= -0.16; } touching++; }
      if (p.x < B.l) { p.x = B.l; if (p.vx < 0) { impact = Math.max(impact, -p.vx); fric(p, 'vy', p.vx); p.vx *= -0.16; } touching++; }
      else if (p.x > B.r) { p.x = B.r; if (p.vx > 0) { impact = Math.max(impact, p.vx); fric(p, 'vy', p.vx); p.vx *= -0.16; } touching++; }
    }
    contact = lerp(contact, touching > 0 ? 1 : 0, 0.2);
    const t = nowS();
    if (impact > 520 && t - lastImpact > 0.25) { lastImpact = t; landCb && landCb(clamp((impact - 520) / 1800, 0, 1)); }
  }
  function fric(p, axis, vn) { const lim = 0.42 * Math.abs(vn); const v = p[axis]; p[axis] = Math.abs(v) <= lim ? 0 : v - Math.sign(v) * lim; }

  function update(dt) {
    let acc = Math.min(dt, 1 / 20);
    const h = 1 / 120;
    while (acc > 1e-6) { const s = Math.min(h, acc); step(s); acc -= s; }
    // shape measurements in the body's own frame
    const ca = Math.cos(-ang), sa = Math.sin(-ang);
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const p of P) { const lx = (p.x - cx) * ca - (p.y - cy) * sa, ly = (p.x - cx) * sa + (p.y - cy) * ca; x0 = Math.min(x0, lx); x1 = Math.max(x1, lx); y0 = Math.min(y0, ly); y1 = Math.max(y1, ly); }
    local.minY = y0; local.maxY = y1; local.w = x1 - x0; local.h = y1 - y0;
    for (const p of pigs) p.th += p.om * dt;
    updateFace(dt);
  }

  /* ---------- touch ---------- */
  function hitTest(x, y, pad = 1.15) {
    const d = Math.hypot(x - cx, y - cy);
    return d < Math.max(local.w, local.h) * 0.5 * pad;
  }
  function poke(x, y, k = 1) {
    const dx = cx - x, dy = cy - y; const d = Math.hypot(dx, dy) || 1;
    for (const p of P) { const w = Math.exp(-((Math.hypot(p.x - x, p.y - y) / (R * 0.65)) ** 2)); p.vx += (dx / d) * 560 * w * k; p.vy += (dy / d) * 560 * w * k; }
    hop(130 * k);
  }
  function hop(s) { const gm = Math.hypot(grav.x, grav.y) || 1; for (const p of P) { p.vx -= (grav.x / gm) * s; p.vy -= (grav.y / gm) * s; } }
  function impulse(vx, vy) { for (const p of P) { p.vx += vx; p.vy += vy; } }
  function jiggle(k) { for (const p of P) { p.vx += rand(-1, 1) * k; p.vy += rand(-1, 1) * k; } }
  function wobble(k) { const ph = rand(TAU); P.forEach((p, i) => { const a = (i / N) * TAU; const s = Math.sin(a * 3 + ph) * k; p.vx += DIR[i][0] * s; p.vy += DIR[i][1] * s; }); }
  function ripple(x, y, dx, dy) { for (const p of P) { const w = Math.exp(-((Math.hypot(p.x - x, p.y - y) / (R * 0.5)) ** 2)); p.vx += dx * 9 * w; p.vy += dy * 4 * w; } }
  function grabStart(x, y) {
    grab = { x, y, w: P.map((p) => Math.exp(-((Math.hypot(p.x - x, p.y - y) / (R * 0.75)) ** 2))), ox: P.map((p) => p.x - x), oy: P.map((p) => p.y - y) };
    const mx = Math.max(...grab.w); grab.w = grab.w.map((w) => w / mx);
  }
  function grabMove(x, y) { if (grab) { grab.x = x; grab.y = y; } }
  function grabEnd() { grab = null; }
  function squishStart(x) { squishT = 1; squishX = x; }
  function squishEnd() { squishT = 0; }

  /* ---------- face ---------- */
  const face = { eyes: 'open', mouth: 'smile', blush: 0, blushT: 0, look: { x: 0, y: 0 }, lookT: { x: 0, y: 0 }, blink: 0, nextBlink: nowS() + 2, until: 0, base: ['open', 'smile'], talk: [], open: 0, openT: 0, spin: 0, chew: 0 };
  function setFace(eyes, mouth, dur = 1.2) { face.eyes = eyes || face.eyes; face.mouth = mouth || face.mouth; face.until = nowS() + dur; }
  function setBase(eyes, mouth) { face.base = [eyes, mouth]; if (nowS() > face.until) { face.eyes = eyes; face.mouth = mouth; } }
  function lookAt(x, y) { const dx = x - cx, dy = y - cy; const d = Math.hypot(dx, dy) || 1; const k = clamp(d / 220, 0, 1); face.lookT.x = (dx / d) * k; face.lookT.y = (dy / d) * k; }
  function lookDir(x, y) { face.lookT.x = clamp(x, -1, 1); face.lookT.y = clamp(y, -1, 1); }
  function talk(sched) { face.talk = sched; }
  function updateFace(dt) {
    const t = nowS();
    if (t > face.until) { face.eyes = face.base[0]; face.mouth = face.base[1]; }
    face.look.x = lerp(face.look.x, face.lookT.x, 1 - Math.exp(-dt * 10));
    face.look.y = lerp(face.look.y, face.lookT.y, 1 - Math.exp(-dt * 10));
    face.blush = lerp(face.blush, face.blushT, 1 - Math.exp(-dt * 3));
    if (t > face.nextBlink) { face.blink = 1; face.nextBlink = t + (Math.random() < 0.2 ? 0.22 : rand(2.2, 5.5)); }
    face.blink = Math.max(0, face.blink - dt * 9);
    let o = 0;
    for (const [a, b] of face.talk) { if (t >= a && t <= b) { o = Math.sin(((t - a) / (b - a)) * Math.PI); break; } }
    if (face.talk.length && t > face.talk[face.talk.length - 1][1]) face.talk = [];
    face.open = lerp(face.open, Math.max(o, face.openT), 1 - Math.exp(-dt * 30));
    face.spin += dt * 6;
    face.chew += dt * 14;
  }

  /* ---------- drawing ---------- */
  function pathOf(pts) {
    const p = new Path2D(); const n = pts.length;
    const mx = (a, b) => (a.x + b.x) / 2, my = (a, b) => (a.y + b.y) / 2;
    p.moveTo(mx(pts[n - 1], pts[0]), my(pts[n - 1], pts[0]));
    for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; p.quadraticCurveTo(a.x, a.y, mx(a, b), my(a, b)); }
    p.closePath();
    return p;
  }
  function anchor() {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const fy = local.minY * 0.18 + (local.maxY + local.minY) * 0.5 * 0.4;
    return { x: cx - sa * fy, y: cy + ca * fy, ca, sa };
  }
  function mouthPoint() { const a = anchor(); const my = R * 0.24 * (local.h / (R * 1.9)); return { x: a.x - a.sa * my, y: a.y + a.ca * my }; }
  function headTop() { const ca = Math.cos(ang), sa = Math.sin(ang); return { x: cx - sa * local.minY, y: cy + ca * local.minY }; }

  function drawBody(ctx, path, t, opt) {
    const rr = Math.max(local.w, local.h) * 0.5;
    const hx = cx - rr * 0.35, hy = cy - rr * 0.45;
    const g = ctx.createRadialGradient(hx, hy, rr * 0.05, cx, cy + rr * 0.15, rr * 1.25);
    g.addColorStop(0, pal.hi); g.addColorStop(0.55, pal.css); g.addColorStop(1, pal.lo);
    ctx.fillStyle = g; ctx.fill(path);
    ctx.save(); ctx.clip(path);
    // opal sheen (fades as Smudge fills with color); shifts with tilt like a hologram
    const sheen = (1 - pal.sat) * 0.55 + 0.12;
    const tx = clamp(-grav.x, -1, 1) * rr * 0.35, ty = clamp(1 - grav.y, -1, 1) * rr * 0.3;
    SHEEN.forEach((c, i) => {
      const a = t * 0.25 + i * 2.1;
      const x = cx + Math.cos(a) * rr * 0.45 + tx * (i - 1), y = cy + Math.sin(a * 0.8) * rr * 0.35 + ty;
      const sg = ctx.createRadialGradient(x, y, 0, x, y, rr * 0.75);
      sg.addColorStop(0, Color.css(c, sheen)); sg.addColorStop(1, Color.css(c, 0));
      ctx.fillStyle = sg; ctx.fillRect(x - rr * 0.75, y - rr * 0.75, rr * 1.5, rr * 1.5);
    });
    // pigments swirling inside
    const ca = Math.cos(ang), sa = Math.sin(ang);
    for (const p of pigs) {
      const age = t - p.born;
      const grow = p.born > 0 ? clamp(age / 1.6, 0, 1) : 1;
      let lx = Math.cos(p.th) * p.r * rr, ly = Math.sin(p.th) * p.r * rr * 0.8;
      if (grow < 1) { const m = mouthPoint(); const k = 1 - Math.pow(1 - grow, 3); lx = lerp(m.x - cx, lx, k); ly = lerp(m.y - cy, ly, k); }
      const x = cx + ca * lx - sa * ly, y = cy + sa * lx + ca * ly;
      const s = rr * p.s * lerp(0.25, 1, grow) * (0.55 + 0.45 * clamp(p.w, 0, 1));
      const pg = ctx.createRadialGradient(x, y, 0, x, y, s);
      pg.addColorStop(0, p.css); pg.addColorStop(0.5, Color.css(p.c, 0.5 * clamp(p.w * 1.4, 0.15, 1))); pg.addColorStop(1, p.css0);
      ctx.fillStyle = pg; ctx.fillRect(x - s, y - s, s * 2, s * 2);
    }
    // inner shade at the bottom
    const sh = ctx.createLinearGradient(0, cy - rr * 0.2, 0, cy + rr);
    sh.addColorStop(0, 'rgba(30,20,70,0)'); sh.addColorStop(1, `rgba(30,20,70,${opt.night ? 0.12 : 0.2})`);
    ctx.fillStyle = sh; ctx.fillRect(cx - rr * 2, cy - rr, rr * 4, rr * 3);
    ctx.restore();
    // rim light
    ctx.save();
    ctx.lineWidth = Math.max(1.5, rr * 0.035);
    const rg = ctx.createLinearGradient(0, cy - rr, 0, cy + rr);
    rg.addColorStop(0, 'rgba(255,255,255,.65)'); rg.addColorStop(0.45, 'rgba(255,255,255,.08)'); rg.addColorStop(1, 'rgba(255,255,255,.22)');
    ctx.strokeStyle = rg; ctx.stroke(path);
    ctx.restore();
    // gloss
    ctx.save();
    ctx.translate(cx - rr * 0.36 + grav.x * rr * 0.1, cy - rr * 0.5 + (grav.y - 1) * rr * 0.1);
    ctx.rotate(-0.55 + ang);
    const gl = ctx.createRadialGradient(0, 0, 0, 0, 0, rr * 0.3);
    gl.addColorStop(0, 'rgba(255,255,255,.85)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.scale(1, 0.5); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, rr * 0.3, 0, TAU); ctx.fill();
    ctx.restore();
  }

  const INK = '#221c3e';
  function drawFace(ctx, t) {
    const a = anchor();
    const sx = clamp(local.w / (R * 2.08), 0.6, 1.6), sy = clamp(local.h / (R * 1.84), 0.5, 1.5);
    ctx.save();
    ctx.translate(a.x, a.y); ctx.rotate(ang);
    ctx.scale(lerp(1, sx, 0.7), lerp(1, sy, 0.7));
    const u = R * (1 + inflate * 0.35);
    const ex = u * 0.23, ey = -u * 0.02;
    const rx = u * 0.085, ry = u * 0.118;
    const lk = face.look;
    // blush
    const bl = clamp(face.blush, 0, 1);
    if (bl > 0.02) {
      ctx.fillStyle = `rgba(255,110,150,${0.42 * bl})`;
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * u * 0.37, u * 0.13, u * 0.1, u * 0.055, 0, 0, TAU); ctx.fill(); }
    }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const s of [-1, 1]) drawEye(ctx, s * ex + lk.x * u * 0.035, ey + lk.y * u * 0.03, rx, ry, s, t, u);
    drawMouth(ctx, lk.x * u * 0.03, u * 0.2 + lk.y * u * 0.02, u, t);
    ctx.restore();
  }
  function drawEye(ctx, x, y, rx, ry, side, t, u) {
    const e = face.eyes;
    ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.lineWidth = u * 0.036;
    if (e === 'happy') { ctx.beginPath(); ctx.moveTo(x - rx * 1.1, y + ry * 0.25); ctx.quadraticCurveTo(x, y - ry * 1.1, x + rx * 1.1, y + ry * 0.25); ctx.stroke(); return; }
    if (e === 'closed') { ctx.beginPath(); ctx.moveTo(x - rx * 1.1, y); ctx.quadraticCurveTo(x, y + ry * 0.75, x + rx * 1.1, y); ctx.stroke(); return; }
    if (e === 'squint') { ctx.beginPath(); ctx.moveTo(x - rx * side, y - ry * 0.6); ctx.lineTo(x + rx * side * 0.9, y); ctx.lineTo(x - rx * side, y + ry * 0.6); ctx.stroke(); return; }
    if (e === 'dizzy') {
      ctx.lineWidth = u * 0.028; ctx.beginPath();
      for (let k = 0; k <= 34; k++) { const a = k * 0.55 + face.spin * side; const r = (k / 34) * rx * 1.25; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.stroke(); return;
    }
    if (e === 'half') {
      // sleepy: heavy lids, just the bottom of each eye showing
      const bl = face.blink > 0 ? Math.sin(face.blink * Math.PI) : 0;
      const h = ry * 0.62 * (1 - bl * 0.85), top = y + ry * 0.12;
      ctx.beginPath(); ctx.moveTo(x - rx * 1.05, top); ctx.quadraticCurveTo(x, top - ry * 0.12, x + rx * 1.05, top);
      ctx.ellipse(x, top, rx * 1.05, Math.max(0.6, h), 0, 0, Math.PI); ctx.closePath(); ctx.fill();
      if (h > ry * 0.3) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - rx * 0.35, top + h * 0.4, rx * 0.2, 0, TAU); ctx.fill(); }
      return;
    }
    let sy = ry, sx = rx;
    if (e === 'wide' || e === 'star') { sx *= 1.18; sy *= 1.2; }
    const bl = Math.max(face.blink > 0 ? Math.sin(face.blink * Math.PI) : 0, 0);
    sy *= 1 - bl * 0.9;
    ctx.beginPath(); ctx.ellipse(x, y, sx, Math.max(0.6, sy), 0, 0, TAU); ctx.fill();
    if (sy > ry * 0.3) {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x - sx * 0.32 + face.look.x * sx * 0.2, y - sy * 0.38, sx * (e === 'wide' || e === 'star' ? 0.44 : 0.36), 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(x + sx * 0.3, y + sy * 0.34, sx * 0.15, 0, TAU); ctx.fill();
      if (e === 'star') {
        const k = 0.6 + 0.4 * Math.sin(t * 9 + side);
        ctx.save(); ctx.translate(x + sx * 0.25, y - sy * 0.1); ctx.scale(k, k);
        ctx.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? sx * 0.12 : sx * 0.42; const a = (i / 8) * TAU; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
    if (e === 'annoyed') { ctx.strokeStyle = INK; ctx.lineWidth = u * 0.03; ctx.beginPath(); ctx.moveTo(x - rx * 1.2 * side, y - ry * 1.55); ctx.lineTo(x + rx * 1.1 * side, y - ry * 1.15); ctx.stroke(); }
  }
  function drawMouth(ctx, x, y, u, t) {
    const w = u * 0.11;
    let m = face.mouth;
    const open = face.open;
    ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = u * 0.032;
    if (open > 0.06 && m !== 'wide') m = 'talk';
    if (m === 'talk' || m === 'wide') {
      const o = m === 'wide' ? Math.max(open, 0.85) : open;
      const ry = w * (0.25 + 0.95 * o), rx = w * (0.62 + 0.25 * o);
      ctx.fillStyle = '#3d1d3c'; ctx.beginPath(); ctx.ellipse(x, y + ry * 0.35, rx, ry, 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.clip();
      ctx.fillStyle = pal.tongue; ctx.beginPath(); ctx.ellipse(x, y + ry * 1.15, rx * 0.8, ry * 0.6, 0, 0, TAU); ctx.fill();
      ctx.restore();
      return;
    }
    ctx.beginPath();
    switch (m) {
      case 'smile': ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x, y + w * 0.9, x + w, y); ctx.stroke(); break;
      case 'grin': ctx.moveTo(x - w * 1.1, y - w * 0.1); ctx.quadraticCurveTo(x, y + w * 1.6, x + w * 1.1, y - w * 0.1); ctx.closePath(); ctx.fillStyle = '#3d1d3c'; ctx.fill(); break;
      case 'o': ctx.ellipse(x, y + w * 0.3, w * 0.34, w * 0.42, 0, 0, TAU); ctx.fillStyle = '#3d1d3c'; ctx.fill(); break;
      case 'flat': ctx.moveTo(x - w * 0.6, y + w * 0.2); ctx.lineTo(x + w * 0.6, y + w * 0.2); ctx.stroke(); break;
      case 'frown': ctx.moveTo(x - w * 0.8, y + w * 0.5); ctx.quadraticCurveTo(x, y - w * 0.2, x + w * 0.8, y + w * 0.5); ctx.stroke(); break;
      case 'cat': ctx.moveTo(x - w * 0.9, y); ctx.quadraticCurveTo(x - w * 0.45, y + w * 0.7, x, y + w * 0.1); ctx.quadraticCurveTo(x + w * 0.45, y + w * 0.7, x + w * 0.9, y); ctx.stroke(); break;
      case 'chew': { const k = Math.sin(face.chew); ctx.moveTo(x - w * 0.8, y + w * 0.2); ctx.quadraticCurveTo(x - w * 0.4, y + w * (0.2 + 0.4 * k), x, y + w * 0.2); ctx.quadraticCurveTo(x + w * 0.4, y + w * (0.2 - 0.4 * k), x + w * 0.8, y + w * 0.2); ctx.stroke(); break; }
      case 'tiny': ctx.moveTo(x - w * 0.45, y + w * 0.1); ctx.quadraticCurveTo(x, y + w * 0.5, x + w * 0.45, y + w * 0.1); ctx.stroke(); break;
      case 'puff': ctx.moveTo(x - w * 0.35, y + w * 0.2); ctx.lineTo(x + w * 0.35, y + w * 0.2); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.25)'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(x + s * w * 1.9, y, w * 0.75, 0, TAU); ctx.fill(); } break;
      default: ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x, y + w * 0.9, x + w, y); ctx.stroke();
    }
  }

  let refl = null, rctx = null;
  function draw(ctx, dpr, t, opt) {
    if (!pal) setPigments([]);
    const path = pathOf(P);
    const rr = Math.max(local.w, local.h) * 0.5;
    const nearFloor = smoothstep(R * 1.2, 0, B.b - (cy + local.maxY));
    // reflection in the mirror ground
    if (opt.mirror && nearFloor > 0.01) {
      const W = ctx.canvas.width / dpr;
      const h = Math.ceil(R * 2.4);
      if (!refl) { refl = document.createElement('canvas'); rctx = refl.getContext('2d', ENV.p3css ? { colorSpace: 'display-p3' } : undefined) || refl.getContext('2d'); }
      if (refl.width !== Math.ceil(W * dpr) || refl.height !== Math.ceil(h * dpr)) { refl.width = Math.ceil(W * dpr); refl.height = Math.ceil(h * dpr); }
      rctx.setTransform(1, 0, 0, 1, 0, 0); rctx.globalCompositeOperation = 'source-over';
      rctx.clearRect(0, 0, refl.width, refl.height);
      rctx.setTransform(dpr, 0, 0, -dpr * 0.92, 0, B.b * dpr * 0.92);
      drawBody(rctx, path, t, opt); rctx.globalAlpha = 0.35; drawFace(rctx, t); rctx.globalAlpha = 1;
      rctx.setTransform(1, 0, 0, 1, 0, 0);
      rctx.globalCompositeOperation = 'destination-in';
      const mg = rctx.createLinearGradient(0, 0, 0, refl.height);
      mg.addColorStop(0, `rgba(0,0,0,${0.36 * nearFloor})`); mg.addColorStop(0.75, 'rgba(0,0,0,0)');
      rctx.fillStyle = mg; rctx.fillRect(0, 0, refl.width, refl.height);
      ctx.drawImage(refl, 0, 0, refl.width, refl.height, 0, B.b, W, h);
    }
    // contact shadow
    if (nearFloor > 0.01) {
      ctx.save();
      ctx.translate(cx, B.b); ctx.scale(1, 0.18);
      const sr = local.w * 0.62;
      const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, sr);
      sg.addColorStop(0, `rgba(20,14,50,${(opt.camera ? 0.45 : 0.26) * nearFloor})`); sg.addColorStop(1, 'rgba(20,14,50,0)');
      ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(0, 0, sr, 0, TAU); ctx.fill();
      ctx.restore();
    }
    // night glow
    if (opt.glow > 0.01) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const gr = rr * (2.3 + Math.sin(t * 0.8) * 0.12);
      const gg = ctx.createRadialGradient(cx, cy, rr * 0.5, cx, cy, gr);
      gg.addColorStop(0, pal.glow(0.42 * opt.glow)); gg.addColorStop(1, pal.glow(0));
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(cx, cy, gr, 0, TAU); ctx.fill();
      ctx.restore();
    }
    drawBody(ctx, path, t, opt);
    drawFace(ctx, t);
  }

  function state() { return { cx, cy, R, ang, local, inflate, contact, B }; }
  return {
    layout, place, update, draw, setPigments, pigs,
    hitTest, poke, hop, impulse, jiggle, wobble, ripple, grabStart, grabMove, grabEnd, squishStart, squishEnd,
    setFace, setBase, lookAt, lookDir, talk, face, mouthPoint, headTop, state,
    set gravity(v) { grav.x = v.x; grav.y = v.y; }, get gravity() { return grav; },
    set inertia(v) { inertia = v; },
    set inflate(v) { inflate = clamp(v, 0, 1); }, get inflate() { return inflate; },
    set puddle(v) { puddleT = clamp(v, 0, 1); },
    set breatheRate(v) { breatheRate = v; },
    set onLand(fn) { landCb = fn; },
    get grabbing() { return !!grab; },
    get palette() { return pal; },
    get R() { return R; },
  };
})();
