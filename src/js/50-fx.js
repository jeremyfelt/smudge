/* ============================================================
   FX: confetti, sparkles, z's, notes, hearts, and the scoop of
   color flying from the camera into Smudge's mouth.
   ============================================================ */
const FX = (() => {
  const parts = [];
  let scoops = [];
  const add = (p) => { if (parts.length < 260) parts.push(Object.assign({ age: 0, vx: 0, vy: 0, g: 0, rot: 0, vr: 0, s: 1, a: 1 }, p)); };

  function confetti(x, y, colors, n = 40) {
    if (ENV.reduced) n = Math.round(n / 4);
    for (let i = 0; i < n; i++) {
      const a = rand(-Math.PI * 0.95, -Math.PI * 0.05), v = rand(260, 620);
      add({ kind: 'confetti', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 900, life: rand(1.4, 2.4), col: Color.css(pick(colors)), w: rand(5, 9), h: rand(3, 5), rot: rand(TAU), vr: rand(-12, 12) });
    }
  }
  function sparkle(x, y, n = 6, spread = 60) {
    for (let i = 0; i < n; i++) add({ kind: 'spark', x: x + rand(-spread, spread), y: y + rand(-spread, spread * 0.6), vy: rand(-40, -10), life: rand(0.5, 1), s: rand(4, 9) });
  }
  function zzz(x, y) { add({ kind: 'z', x, y, vx: rand(8, 20), vy: -26, life: 3, s: rand(13, 20), ph: rand(TAU) }); }
  function note(x, y) { add({ kind: 'note', x, y, vx: rand(-20, 20), vy: -50, life: 1.6, s: rand(15, 21), ph: rand(TAU), glyph: Math.random() < 0.3 ? '\u266b' : '\u266a' }); }
  function heart(x, y) { add({ kind: 'heart', x: x + rand(-14, 14), y, vx: rand(-15, 15), vy: rand(-80, -50), life: 1.3, s: rand(7, 11), ph: rand(TAU) }); }
  function puff(x, y, n = 6) { for (let i = 0; i < n; i++) { const a = rand(-0.4, 0.4) + (i % 2 ? 0 : Math.PI); add({ kind: 'puff', x, y, vx: Math.cos(a) * rand(40, 90), vy: rand(-30, -8), life: rand(0.5, 0.8), s: rand(6, 12) }); } }
  function drops(x, y, col, n = 5) { for (let i = 0; i < n; i++) add({ kind: 'drop', x, y, vx: rand(-120, 120), vy: rand(-260, -120), g: 1100, life: rand(0.5, 0.9), s: rand(3, 6), col: Color.css(col) }); }

  function scoop(x0, y0, r0, color, target, done) {
    scoops.push({ x0, y0, r0, color, css: Color.css(color), hi: Color.css(Color.tone(color, 0.18, 0.7)), target, done, t0: nowS(), dur: 0.62, trail: [] });
  }

  function update(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.age += dt;
      if (p.age > p.life) { parts.splice(i, 1); continue; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      if (p.kind === 'confetti') { p.vx *= 1 - dt * 1.5; p.vy *= 1 - dt * 0.6; }
    }
    const t = nowS();
    scoops = scoops.filter((s) => {
      const k = (t - s.t0) / s.dur;
      if (k >= 1) { s.done && s.done(); return false; }
      return true;
    });
  }

  function heartPath(ctx, s) { ctx.beginPath(); ctx.moveTo(0, s * 0.35); ctx.bezierCurveTo(-s * 1.2, -s * 0.4, -s * 0.45, -s * 1.15, 0, -s * 0.45); ctx.bezierCurveTo(s * 0.45, -s * 1.15, s * 1.2, -s * 0.4, 0, s * 0.35); ctx.closePath(); }
  function draw(ctx, t, night) {
    for (const p of parts) {
      const k = p.age / p.life;
      ctx.save();
      ctx.translate(p.x, p.y);
      switch (p.kind) {
        case 'confetti': ctx.rotate(p.rot); ctx.globalAlpha = 1 - smoothstep(0.7, 1, k); ctx.fillStyle = p.col; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.rot * 1.3)) + 0.5); break;
        case 'spark': {
          ctx.globalAlpha = Math.sin(k * Math.PI); const s = p.s * (0.6 + 0.4 * Math.sin(k * Math.PI));
          ctx.fillStyle = night ? '#fff6c9' : '#ffffff';
          ctx.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? s * 0.22 : s; const a = (i / 8) * TAU; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); break;
        }
        case 'z': ctx.translate(Math.sin(p.age * 2 + p.ph) * 8, 0); ctx.globalAlpha = Math.sin(k * Math.PI) * 0.85; ctx.fillStyle = night ? '#e8e4ff' : '#3a3470'; ctx.font = `${p.s * (0.7 + k * 0.6)}px "Bagel Fat One", ui-rounded, system-ui`; ctx.fillText('z', 0, 0); break;
        case 'note': ctx.translate(Math.sin(p.age * 4 + p.ph) * 6, 0); ctx.globalAlpha = Math.sin(k * Math.PI); ctx.fillStyle = night ? '#efeaff' : '#3a3470'; ctx.font = `${p.s}px ui-rounded, system-ui, sans-serif`; ctx.fillText(p.glyph || '♪', 0, 0); break;
        case 'heart': ctx.translate(Math.sin(p.age * 5 + p.ph) * 5, 0); ctx.globalAlpha = 1 - k; ctx.fillStyle = '#ff6f9c'; heartPath(ctx, p.s * (0.8 + k * 0.4)); ctx.fill(); break;
        case 'puff': ctx.globalAlpha = (1 - k) * 0.5; ctx.fillStyle = night ? 'rgba(220,215,255,.6)' : 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.arc(0, 0, p.s * (1 + k), 0, TAU); ctx.fill(); break;
        case 'drop': ctx.globalAlpha = 1 - k; ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(0, 0, p.s, 0, TAU); ctx.fill(); break;
      }
      ctx.restore();
    }
    for (const s of scoops) {
      const k = clamp((t - s.t0) / s.dur, 0, 1);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const to = s.target();
      const mx = (s.x0 + to.x) / 2 + (to.x - s.x0) * 0.1, my = Math.min(s.y0, to.y) - 90;
      const x = (1 - e) * (1 - e) * s.x0 + 2 * (1 - e) * e * mx + e * e * to.x;
      const y = (1 - e) * (1 - e) * s.y0 + 2 * (1 - e) * e * my + e * e * to.y;
      const r = lerp(s.r0, Pet.R * 0.12, e) * (1 + Math.sin(k * 30) * 0.06 * (1 - k));
      s.trail.push([x, y, r]); if (s.trail.length > 10) s.trail.shift();
      s.trail.forEach(([tx, ty, tr], i) => { ctx.globalAlpha = (i / s.trail.length) * 0.35; ctx.fillStyle = s.css; ctx.beginPath(); ctx.arc(tx, ty, tr * 0.55, 0, TAU); ctx.fill(); });
      ctx.globalAlpha = 1;
      ctx.save(); ctx.translate(x, y);
      ctx.beginPath();
      for (let i = 0; i <= 24; i++) { const a = (i / 24) * TAU; const rr = r * (1 + Math.sin(a * 3 + t * 14) * 0.07 * (1 - k)); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath();
      const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.05, 0, 0, r);
      g.addColorStop(0, s.hi); g.addColorStop(1, s.css);
      ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.ellipse(-r * 0.35, -r * 0.4, r * 0.22, r * 0.13, -0.6, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }
  return { confetti, sparkle, zzz, note, heart, puff, drops, scoop, update, draw, get busy() { return scoops.length > 0; } };
})();
