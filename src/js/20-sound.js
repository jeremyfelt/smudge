/* ============================================================
   Sound: Smudge's voice, little noises, and the lullaby.
   Everything is synthesized with Web Audio; nothing is downloaded.
   ============================================================ */
const Sound = (() => {
  let G = null;
  let loops = {};
  let armed = false; // no audio until the first tap, so iOS never sees an unrequested context

  function setSession(type) {
    try { if ('audioSession' in navigator && navigator.audioSession.type !== type) navigator.audioSession.type = type; } catch (e) {}
  }
  function noiseBuf(ctx, sec) {
    const len = Math.floor(ctx.sampleRate * sec); const b = ctx.createBuffer(1, len, ctx.sampleRate); const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  function impulse(ctx, sec, decay) {
    const len = Math.floor(ctx.sampleRate * sec); const ch = ctx.destination.channelCount >= 2 ? 2 : 1;
    const b = ctx.createBuffer(ch, len, ctx.sampleRate);
    for (let c = 0; c < ch; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return b;
  }
  function build(ctx) {
    const master = ctx.createGain(); master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 3.5; comp.attack.value = 0.003; comp.release.value = 0.18;
    master.connect(comp); comp.connect(ctx.destination);
    const verb = ctx.createConvolver(); verb.buffer = impulse(ctx, 2.4, 3.2);
    verb.connect(master);
    const send = ctx.createGain(); send.gain.value = 0.25; send.connect(verb);
    const voice = ctx.createGain(); voice.gain.value = 1; voice.connect(master);
    const vsend = ctx.createGain(); vsend.gain.value = 0.12; voice.connect(vsend); vsend.connect(verb);
    return { ctx, master, send, voice, nb: noiseBuf(ctx, 2) };
  }
  function live() {
    if (!S.s.sound || !armed) return null;
    if (!G) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { G = build(new AC({ latencyHint: 'interactive' })); } catch (e) { return null; }
    }
    if (G.ctx.state !== 'running') { try { G.ctx.resume(); } catch (e) {} }
    return G;
  }
  function unlock() {
    armed = true;
    Mic.wake();
    if (!S.s.sound) return;
    if (!Mic.busy && !Lullaby.playing) setSession('ambient');
    const g = live(); if (!g) return;
    try { const b = g.ctx.createBuffer(1, 1, 22050); const s = g.ctx.createBufferSource(); s.buffer = b; s.connect(g.ctx.destination); s.start(0); } catch (e) {}
  }

  /* ---------- building blocks ---------- */
  function env(g, t, a, peak, d, dest) {
    const n = g.ctx.createGain();
    n.gain.setValueAtTime(0.0001, t);
    n.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    n.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    n.connect(dest || g.master);
    return n;
  }
  function tone(g, { type = 'sine', f0, f1, t, a = 0.005, d = 0.1, peak = 0.3, dest, send = 0 }) {
    const o = g.ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + a + d);
    const e = env(g, t, a, peak, d, dest);
    if (send) { const s = g.ctx.createGain(); s.gain.value = send; e.connect(s); s.connect(g.send); }
    o.connect(e); o.start(t); o.stop(t + a + d + 0.05);
    return o;
  }
  function vib(g, o, rate, depth, t, d) {
    const l = g.ctx.createOscillator(); l.frequency.value = rate;
    const lg = g.ctx.createGain(); lg.gain.setValueAtTime(depth, t); lg.gain.exponentialRampToValueAtTime(0.01, t + d);
    l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + d + 0.05);
  }
  function hiss(g, { t, d = 0.2, peak = 0.2, type = 'bandpass', f0 = 1000, f1, q = 1, dest }) {
    const s = g.ctx.createBufferSource(); s.buffer = g.nb;
    const f = g.ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + d);
    f.Q.value = q;
    const e = env(g, t, 0.01, peak, d, dest);
    s.connect(f); f.connect(e); s.start(t, Math.random() * 1.5); s.stop(t + d + 0.05);
  }
  function bell(g, { f, t, peak = 0.15, d = 1.4, ratio = 3.5, index = 2, send = 0.45, dest }) {
    const ctx = g.ctx;
    const car = ctx.createOscillator(); car.frequency.value = f;
    const mod = ctx.createOscillator(); mod.frequency.value = Math.min(f * ratio, ctx.sampleRate * 0.45);
    const mg = ctx.createGain(); mg.gain.setValueAtTime(f * index, t); mg.gain.exponentialRampToValueAtTime(Math.max(0.01, f * 0.01), t + d * 0.6);
    mod.connect(mg); mg.connect(car.frequency);
    const e = env(g, t, 0.004, peak, d, dest);
    if (send) { const s = ctx.createGain(); s.gain.value = send; e.connect(s); s.connect(g.send); }
    car.connect(e); car.start(t); mod.start(t); car.stop(t + d + 0.1); mod.stop(t + d + 0.1);
  }

  /* ---------- the voice: a tiny formant babble ---------- */
  const VOW = { a: [800, 1250], e: [500, 1900], i: [330, 2300], o: [520, 920], u: [380, 840] };
  function syll(g, t, f0, f1, dur, vowel, vol) {
    const ctx = g.ctx;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const s = ctx.createOscillator(); s.type = 'sine';
    s.frequency.setValueAtTime(f0, t); s.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const [F1, F2] = VOW[vowel] || VOW.a;
    const b1 = ctx.createBiquadFilter(); b1.type = 'bandpass'; b1.frequency.value = F1 * 1.35; b1.Q.value = 3.5;
    const b2 = ctx.createBiquadFilter(); b2.type = 'bandpass'; b2.frequency.value = F2 * 1.3; b2.Q.value = 5;
    const g2 = ctx.createGain(); g2.gain.value = 0.7;
    const sg = ctx.createGain(); sg.gain.value = 0.32;
    const e = ctx.createGain();
    e.gain.setValueAtTime(0.0001, t);
    e.gain.exponentialRampToValueAtTime(vol, t + 0.014);
    e.gain.exponentialRampToValueAtTime(vol * 0.55, t + dur * 0.7);
    e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(b1); o.connect(b2); b2.connect(g2); b1.connect(e); g2.connect(e); s.connect(sg); sg.connect(e);
    e.connect(g.voice || g.master);
    o.start(t); s.start(t); o.stop(t + dur + 0.04); s.stop(t + dur + 0.04);
  }
  let voicePitch = 1;
  function speak(text, { pitch = 1, vol = 0.55, slow = 1, whisper = false } = {}) {
    const letters = text.replace(/[^a-z]/gi, '').length;
    const n = clamp(Math.round(letters / 2.4), 1, 16);
    const q = /\?\s*$/.test(text), ex = /!\s*$/.test(text);
    const vowels = (text.toLowerCase().match(/[aeiou]/g) || ['a', 'o']);
    const g = live();
    const base = 540 * pitch * voicePitch * (whisper ? 0.85 : 1);
    const t0 = g ? g.ctx.currentTime + 0.03 : 0;
    const off = g ? nowS() - g.ctx.currentTime : nowS();
    const sched = [];
    let t = t0;
    for (let i = 0; i < n; i++) {
      const dur = rand(0.07, 0.12) * slow;
      const last = i === n - 1;
      let semi = rand(-2.5, 3) + (ex ? 2.5 : 0);
      if (last && q) semi += 5; else if (last && !ex) semi -= 2;
      const f0 = base * Math.pow(2, semi / 12);
      const f1 = f0 * (last && q ? 1.28 : rand(0.92, 1.06));
      if (g) syll(g, t, f0, f1, dur, vowels[i % vowels.length], (whisper ? 0.22 : vol) * (last ? 0.9 : 1));
      sched.push([t + off, t + dur + off]);
      t += dur + rand(0.025, 0.05) * slow;
    }
    if (g) hush(t - t0 + 0.3);
    return sched;
  }

  /* ---------- little noises ---------- */
  const SFX = {
    pop(g, t) { tone(g, { f0: 920, f1: 470, t, d: 0.09, peak: 0.3 }); },
    boop(g, t) { tone(g, { f0: 520, f1: 900, t, d: 0.08, peak: 0.24 }); },
    squeak(g, t) { const o = tone(g, { type: 'triangle', f0: 660, f1: 420, t, a: 0.02, d: 0.3, peak: 0.2 }); vib(g, o, 17, 40, t, 0.3); },
    boing(g, t) { const o = tone(g, { f0: 150, f1: 560, t, d: 0.4, peak: 0.32 }); vib(g, o, 13, 60, t, 0.4); },
    thump(g, t, k = 1) { tone(g, { f0: 150, f1: 48, t, d: 0.2, peak: 0.45 * k }); hiss(g, { t, d: 0.07, peak: 0.12 * k, type: 'lowpass', f0: 420 }); },
    slurp(g, t) { hiss(g, { t, d: 0.3, peak: 0.24, type: 'bandpass', f0: 420, f1: 2600, q: 2.2 }); tone(g, { f0: 420, f1: 980, t: t + 0.26, d: 0.07, peak: 0.2 }); },
    gulp(g, t) { tone(g, { f0: 360, f1: 92, t, a: 0.01, d: 0.2, peak: 0.42 }); tone(g, { f0: 520, f1: 1160, t: t + 0.2, d: 0.06, peak: 0.18 }); },
    chew(g, t) { for (let i = 0; i < 3; i++) hiss(g, { t: t + i * 0.16, d: 0.07, peak: 0.42, type: 'bandpass', f0: 520, q: 0.8 }); },
    chime(g, t) { [0, 4, 7, 12].forEach((s, i) => bell(g, { f: 1046.5 * 2 ** (s / 12), t: t + i * 0.09, peak: 0.12 })); },
    sparkle(g, t) { for (let i = 0; i < 3; i++) bell(g, { f: rand(1800, 3400), t: t + i * 0.07 + rand(0.03), peak: 0.05, d: 0.7, index: 1.2 }); },
    fanfare(g, t) { [0, 4, 7, 12, 16].forEach((s, i) => bell(g, { f: 784 * 2 ** (s / 12), t: t + i * 0.11, peak: 0.13, d: 1.6 })); },
    raspberry(g, t) {
      const ctx = g.ctx, d = 0.8;
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(96, t); o.frequency.exponentialRampToValueAtTime(58, t + d);
      vib(g, o, 31, 24, t, d);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(1500, t); f.frequency.exponentialRampToValueAtTime(480, t + d); f.Q.value = 3;
      const e = env(g, t, 0.02, 0.3, d); o.connect(f); f.connect(e); o.start(t); o.stop(t + d + 0.05);
      hiss(g, { t, d: d * 0.8, peak: 0.07, type: 'bandpass', f0: 320, q: 1.5 });
    },
    whoosh(g, t) { hiss(g, { t, d: 0.35, peak: 0.45, type: 'bandpass', f0: 600, f1: 1900, q: 0.9 }); },
    click(g, t) { tone(g, { f0: 1500, f1: 900, t, d: 0.04, peak: 0.14 }); },
    hop(g, t) { tone(g, { f0: 300, f1: 640, t, d: 0.1, peak: 0.14 }); },
    dizzy(g, t) { for (let i = 0; i < 4; i++) tone(g, { type: 'triangle', f0: 760 - i * 90, f1: 640 - i * 90, t: t + i * 0.12, d: 0.11, peak: 0.1 }); },
    yawn(g, t) { syll(g, t, 620, 360, 0.9, 'a', 0.4); syll(g, t + 0.92, 380, 300, 0.35, 'u', 0.25); },
    shutter(g, t) { hiss(g, { t, d: 0.05, peak: 0.12, type: 'highpass', f0: 2500 }); },
    snore(g, t) { hiss(g, { t, d: 1.2, peak: 0.2, type: 'bandpass', f0: 380, f1: 520, q: 1 }); hiss(g, { t: t + 1.5, d: 1.4, peak: 0.14, type: 'lowpass', f0: 420, f1: 300 }); },
  };
  // when Smudge's own sounds will have finished (the raw microphone hears the speaker)
  let quietAt = 0;
  const hush = (sec) => { quietAt = Math.max(quietAt, performance.now() + sec * 1000); };
  const LONG = { yawn: 1.5, raspberry: 1, fanfare: 1.6, chime: 1.2, snore: 3, boing: 0.5, dizzy: 0.6 };
  function play(name, ...args) { const g = live(); if (!g || !SFX[name]) return; hush((LONG[name] || 0.35) + 0.15); try { SFX[name](g, g.ctx.currentTime + 0.01, ...args); } catch (e) {} }
  function ping(k) { const g = live(); if (!g) return; tone(g, { f0: 880 + k * 1000, t: g.ctx.currentTime + 0.01, d: 0.06, peak: 0.04 + 0.06 * k, send: 0.35 }); }

  /* ---------- continuous voices: purring, inflating ---------- */
  function loop(kind) {
    const g = live(); if (!g) return null;
    if (loops[kind]) return loops[kind];
    const ctx = g.ctx;
    const src = ctx.createBufferSource(); src.buffer = g.nb; src.loop = true;
    const f = ctx.createBiquadFilter();
    const vol = ctx.createGain(); vol.gain.value = 0.0001;
    const nodes = [src];
    if (kind === 'purr') {
      f.type = 'bandpass'; f.frequency.value = 340; f.Q.value = 0.9;
      const am = ctx.createGain(); am.gain.value = 0.5;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 23; const lg = ctx.createGain(); lg.gain.value = 0.5;
      lfo.connect(lg); lg.connect(am.gain); lfo.start(); nodes.push(lfo);
      src.connect(f); f.connect(am); am.connect(vol);
    } else {
      f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 1.2;
      src.connect(f); f.connect(vol);
    }
    vol.connect(g.master); src.start();
    const L = {
      level(x) { const t = ctx.currentTime; vol.gain.setTargetAtTime(Math.max(0.0001, x), t, 0.06); if (kind === 'hiss') f.frequency.setTargetAtTime(700 + x * 6000, t, 0.08); },
      stop() { delete loops[kind]; vol.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.12); setTimeout(() => nodes.forEach((n) => { try { n.stop(); } catch (e) {} }), 700); },
    };
    loops[kind] = L;
    return L;
  }

  /* ---------- humming back what it heard ---------- */
  function echo(notes) {
    const g = live(); if (!g || notes.length < 3) return 0;
    const ctx = g.ctx; const t0 = ctx.currentTime + 0.05;
    const o = ctx.createOscillator(); o.type = 'triangle';
    const s = ctx.createOscillator(); s.type = 'sine';
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2400;
    const e = ctx.createGain(); e.gain.value = 0.0001;
    const sg = ctx.createGain(); sg.gain.value = 0.5;
    o.connect(f); s.connect(sg); sg.connect(f); f.connect(e); e.connect(g.voice);
    let t = t0;
    for (const nt of notes) {
      const fr = 440 * Math.pow(2, (nt.m - 69) / 12);
      o.frequency.setTargetAtTime(fr, t, 0.018); s.frequency.setTargetAtTime(fr, t, 0.018);
      e.gain.setTargetAtTime(nt.a > 0 ? 0.32 : 0.0001, t, 0.025);
      t += nt.d;
    }
    e.gain.setTargetAtTime(0.0001, t, 0.05);
    o.start(t0); s.start(t0); o.stop(t + 0.4); s.stop(t + 0.4);
    vib(g, o, 5.5, 6, t0, t - t0 + 0.2);
    hush(t - t0 + 0.5);
    return t - t0;
  }

  function setPitchFrom(c) { voicePitch = c ? lerp(0.86, 1.14, clamp((c.lab[0] - 0.35) / 0.55, 0, 1)) : 1; }
  function toggle(on) { S.s.sound = on; Store.save(); if (!on) { Object.values(loops).forEach((l) => l.stop()); if (G) G.ctx.suspend().catch(() => {}); } else unlock(); }

  return { unlock, play, speak, ping, loop, echo, setSession, setPitchFrom, toggle, build, tone, bell, hiss, env, syll, SFX, get ctx() { return G && G.ctx; }, get graph() { return live(); }, get busy() { return performance.now() < quietAt || !!loops.purr; } };
})();

/* ============================================================
   Lullaby: a 3/4 music-box loop composed from today's colors,
   rendered offline to a WAV so it can play on the lock screen.
   ============================================================ */
const Lullaby = (() => {
  const el = new Audio();
  el.setAttribute('playsinline', '');
  el.preload = 'auto';
  let cache = { key: '', url: '' };
  let art = '';
  let playing = false;
  let rendering = null;
  const SILENT = (() => { const n = 800; const ab = new ArrayBuffer(44 + n * 2); const v = new DataView(ab); writeHeader(v, n, 8000); return URL.createObjectURL(new Blob([ab], { type: 'audio/wav' })); })();

  function writeHeader(v, n, sr) {
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    w(36, 'data'); v.setUint32(40, n * 2, true);
  }
  function toWav(data, sr) {
    const n = data.length; const ab = new ArrayBuffer(44 + n * 2); const v = new DataView(ab); writeHeader(v, n, sr);
    let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(data[i]));
    const k = peak > 0 ? 0.88 / peak : 1;
    for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, clamp(data[i] * k, -1, 1) * 32767, true);
    return new Blob([ab], { type: 'audio/wav' });
  }
  const m2f = (m) => 440 * Math.pow(2, (m - 69) / 12);

  async function render(cols) {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC) throw new Error('no offline audio');
    const SR = 24000, BEAT = 60 / 58, BPB = 3, BARS = 16, LEN = BARS * BPB * BEAT, TAIL = 4;
    const ctx = new OAC(1, Math.ceil((LEN + TAIL) * SR), SR);
    const g = Sound.build(ctx);
    g.master.gain.value = 0.8;
    const root = 65; // F
    const CH = [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]]; // F, Dm, Bb, C (as offsets from F)
    const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
    const notes = (cols.length ? cols : [Color.fromHex('#B8A9E8'), Color.fromHex('#7FC8C0'), Color.fromHex('#F2A07B')]).map((c) => {
      const { L, h } = Color.lch(c);
      return root + PENTA[Math.floor((h / 360) * PENTA.length) % PENTA.length] + (L < 0.4 ? -12 : L > 0.85 ? 12 : 0);
    });
    const r = rng(hash32(notes.join(',')));
    for (let bar = 0; bar < BARS; bar++) {
      const ch = CH[Math.floor(bar / 2) % 4];
      const t = bar * BPB * BEAT;
      // pad: two detuned triangles per chord tone through a soft lowpass
      if (bar % 2 === 0) for (const n of ch) {
        for (const det of [-6, 6]) {
          const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = m2f(root - 12 + n) * Math.pow(2, det / 1200);
          const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
          const e = ctx.createGain(); const d = BPB * BEAT * 2;
          e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(0.03, t + 1.2); e.gain.setValueAtTime(0.03, t + d - 1); e.gain.linearRampToValueAtTime(0.0001, t + d + 0.8);
          o.connect(f); f.connect(e); e.connect(g.master); o.start(t); o.stop(t + d + 1);
        }
      }
      // bass on the downbeat
      Sound.tone(g, { f0: m2f(root - 24 + ch[0]), t, a: 0.05, d: BEAT * 2.4, peak: 0.09 });
      // melody: walk through the color motif, snapped near chord tones
      const steps = bar % 4 === 3 ? [0] : [0, 1, 2];
      for (const s of steps) {
        const idx = (bar * 3 + s) % notes.length;
        let m = notes[idx];
        if (s === 0) { const tgt = root + ch[(bar >> 1) % 3]; while (m - tgt > 6) m -= 12; while (tgt - m > 6) m += 12; }
        const tt = t + s * BEAT + (r() < 0.25 ? BEAT / 2 : 0);
        Sound.bell(g, { f: m2f(m + 12), t: tt, peak: s === 0 ? 0.13 : 0.09, d: 2.2, ratio: 4, index: 1.6, send: 0.55 });
      }
      if (bar % 4 === 1) Sound.bell(g, { f: m2f(root + 36 + PENTA[Math.floor(r() * 5)]), t: t + BEAT * 2.5, peak: 0.035, d: 1.6, index: 1, send: 0.7 });
    }
    const buf = await ctx.startRendering();
    const raw = buf.getChannelData(0);
    const n = Math.round(LEN * SR);
    const out = new Float32Array(n);
    out.set(raw.subarray(0, n));
    for (let i = n; i < raw.length; i++) out[i - n] += raw[i];
    return { blob: toWav(out, SR), dur: LEN };
  }

  function key(cols) { return cols.map((c) => Color.hex(c)).join(''); }
  async function prepare(cols) {
    const k = key(cols);
    if (cache.key === k && cache.url) return cache.url;
    if (rendering && rendering.k === k) return rendering.p;
    const p = render(cols).then(({ blob }) => { if (cache.url) URL.revokeObjectURL(cache.url); cache = { key: k, url: URL.createObjectURL(blob) }; return cache.url; }).finally(() => { rendering = null; });
    rendering = { k, p };
    return p;
  }

  async function start(cols, meta) {
    playing = true;
    Sound.setSession('playback');
    // play something inside the tap so iOS lets this element play later
    try { el.src = SILENT; el.loop = true; el.play().catch(() => {}); } catch (e) {}
    let url;
    try { url = await prepare(cols); } catch (e) { playing = false; return false; }
    if (!playing) return false;
    el.src = url; el.loop = true; el.volume = 0.9;
    try { await el.play(); } catch (e) { /* will retry on next tap */ }
    if ('mediaSession' in navigator) {
      try {
        if (art) URL.revokeObjectURL(art);
        art = meta.art || '';
        navigator.mediaSession.metadata = new MediaMetadata({ title: meta.title, artist: meta.artist, album: meta.album, artwork: art ? [{ src: art, sizes: '512x512', type: 'image/png' }] : [] });
        navigator.mediaSession.playbackState = 'playing';
        navigator.mediaSession.setActionHandler('play', () => { el.play(); navigator.mediaSession.playbackState = 'playing'; });
        navigator.mediaSession.setActionHandler('pause', () => { el.pause(); navigator.mediaSession.playbackState = 'paused'; });
        try { navigator.mediaSession.setActionHandler('stop', () => meta.onStop && meta.onStop()); } catch (e) {}
      } catch (e) {}
    }
    return true;
  }
  function stop() {
    playing = false;
    try { el.pause(); el.removeAttribute('src'); el.load(); } catch (e) {}
    if ('mediaSession' in navigator) { try { navigator.mediaSession.playbackState = 'none'; navigator.mediaSession.metadata = null; } catch (e) {} }
    if (!Mic.on) Sound.setSession('ambient');
  }
  return { prepare, start, stop, get playing() { return playing; }, el };
})();
