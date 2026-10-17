/* ============================================================
   Senses: haptics, tilt & shake, microphone, keeping the screen
   awake, and the Home Screen icon badge.
   ============================================================ */

/* ---------- Touch: iPhone haptics via the native switch control ---------- */
const Haptics = (() => {
  const ios = ENV.ios;
  function fire() {
    try {
      if (!ios && navigator.vibrate) { navigator.vibrate(10); return; }
      if (!ios) return;
      const label = document.createElement('label');
      label.setAttribute('aria-hidden', 'true');
      label.style.display = 'none';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      label.appendChild(input);
      label.addEventListener('click', (e) => e.stopPropagation());
      document.head.appendChild(label);
      label.click();
      label.remove();
    } catch (e) {}
  }
  const on = () => S.s.haptics;
  function seq(gaps) { if (!on()) return; fire(); let t = 0; for (const g of gaps) { t += g; setTimeout(fire, t); } }
  return {
    tap: () => on() && fire(),
    double: () => seq([110]),
    triple: () => seq([85, 85]),
    roll: (n = 4, gap = 55) => seq(Array(n - 1).fill(gap)),
    supported: ios || !!navigator.vibrate,
  };
})();

/* ---------- Balance: tilt, slosh, shake, lying flat ---------- */
const Motion = (() => {
  let on = false, sub = false, last = 0;
  const raw = { x: 0, y: -9.81, z: 0 }, fast = { x: 0, y: -9.81, z: 0 }, slow = { x: 0, y: -9.81, z: 0 };
  let shake = 0;
  const needsPermission = () => typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function';
  const available = () => typeof DeviceMotionEvent !== 'undefined' && !ENV.framed;
  function onMotion(e) {
    const a = e.accelerationIncludingGravity;
    if (!a || a.x == null) return;
    // iOS reports the pull of gravity; other platforms report the opposite.
    const s = ENV.ios ? 1 : -1;
    raw.x = a.x * s; raw.y = a.y * s; raw.z = a.z * s;
    last = performance.now();
  }
  async function enable() {
    if (typeof DeviceMotionEvent === 'undefined' || ENV.framed) return 'unavailable';
    try { if (needsPermission()) { const r = await DeviceMotionEvent.requestPermission(); if (r !== 'granted') return 'denied'; } } catch (e) { return 'denied'; }
    if (!sub) { window.addEventListener('devicemotion', onMotion); sub = true; }
    on = true; S.s.tilt = true; Store.save();
    return 'granted';
  }
  function disable() { on = false; S.s.tilt = false; Store.save(); }
  // re-attach after a relaunch; data only flows if permission was granted before
  function resume() { if (typeof DeviceMotionEvent === 'undefined' || ENV.framed) return; if (!sub) { window.addEventListener('devicemotion', onMotion); sub = true; } on = true; }
  const flowing = () => performance.now() - last < 1500;
  function toScreen(v) {
    let ang = 0;
    if (screen.orientation && typeof screen.orientation.angle === 'number') ang = screen.orientation.angle;
    else if (typeof window.orientation === 'number') ang = window.orientation;
    switch (((ang % 360) + 360) % 360) {
      case 90: return { x: -v.y, y: -v.x };
      case 180: return { x: -v.x, y: v.y };
      case 270: return { x: v.y, y: v.x };
      default: return { x: v.x, y: -v.y };
    }
  }
  function frame(dt) {
    if (!on || performance.now() - last > 1500) return null;
    const kf = 1 - Math.exp(-dt / 0.045), ks = 1 - Math.exp(-dt / 0.35);
    for (const k of ['x', 'y', 'z']) { fast[k] += (raw[k] - fast[k]) * kf; slow[k] += (raw[k] - slow[k]) * ks; }
    const jolt = Math.hypot(raw.x - slow.x, raw.y - slow.y, raw.z - slow.z);
    shake = Math.max(0, shake - dt * 1.1) + Math.max(0, jolt - 7) * dt * 0.8;
    const g = toScreen(fast);
    const inPlane = Math.hypot(slow.x, slow.y);
    return { g: { x: g.x / 9.81, y: g.y / 9.81 }, flat: 1 - smoothstep(2.2, 5.5, inPlane), shake: clamp(shake, 0, 1.5), faceDown: slow.z > 7.5 };
  }
  return { enable, disable, resume, frame, needsPermission, available, get on() { return on; }, get flowing() { return flowing(); } };
})();

/* ---------- Hearing: blowing, humming, and echoing tunes back ---------- */
const Mic = (() => {
  let on = false, stream = null, ac = null, an = null, td = null, fd = null, dec = null, sq = null;
  let floor = 0.01, frameN = 0, deafUntil = 0;
  const st = { level: 0, blow: 0, singing: false, midi: 0, clarity: 0 };
  let take = [], quiet = 0;
  let onEcho = null;

  async function start() {
    if (ENV.framed || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return 'unavailable';
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false } });
    } catch (e) { return e && (e.name === 'NotAllowedError' || e.name === 'SecurityError') ? 'denied' : 'unavailable'; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ac = new AC();
      if (ac.state !== 'running') await ac.resume().catch(() => {});
      const src = ac.createMediaStreamSource(stream);
      an = ac.createAnalyser(); an.fftSize = 2048; an.smoothingTimeConstant = 0.2;
      src.connect(an);
      td = new Float32Array(an.fftSize); fd = new Float32Array(an.frequencyBinCount);
      dec = new Float32Array(an.fftSize >> 1); sq = new Float32Array((an.fftSize >> 1) + 1);
    } catch (e) { stop(); return 'unavailable'; }
    on = true; take = []; quiet = 0; floor = 0.01;
    return 'granted';
  }
  function stop() {
    on = false;
    try { stream && stream.getTracks().forEach((t) => t.stop()); } catch (e) {}
    try { ac && ac.close(); } catch (e) {}
    stream = null; ac = null; an = null;
    st.level = st.blow = 0; st.singing = false;
    if (!Lullaby.playing) Sound.setSession('ambient');
  }
  function pitch(sr) {
    const N = dec.length;
    for (let i = 0; i < N; i++) dec[i] = (td[2 * i] + td[2 * i + 1]) * 0.5;
    sq[0] = 0; for (let i = 0; i < N; i++) sq[i + 1] = sq[i] + dec[i] * dec[i];
    const srd = sr / 2;
    const minLag = Math.max(2, Math.floor(srd / 1000)), maxLag = Math.min(N - 2, Math.floor(srd / 75));
    const nsdf = new Float32Array(maxLag + 2);
    let maxV = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let r = 0; const n = N - lag;
      for (let i = 0; i < n; i++) r += dec[i] * dec[i + lag];
      const m = sq[n] + (sq[N] - sq[lag]);
      const v = m > 0 ? (2 * r) / m : 0;
      nsdf[lag] = v; if (v > maxV) maxV = v;
    }
    // first peak that reaches 90% of the best one (avoids octave slips)
    let lag = 0, best = 0;
    for (let l = minLag + 1; l < maxLag; l++) {
      if (nsdf[l] > nsdf[l - 1] && nsdf[l] >= nsdf[l + 1] && nsdf[l] > 0.9 * maxV) { lag = l; best = nsdf[l]; break; }
    }
    if (!lag) return { f: 0, c: 0 };
    const a = nsdf[lag - 1], b = nsdf[lag], c = nsdf[lag + 1];
    const shift = (a - c) / (2 * (a - 2 * b + c) || 1);
    return { f: srd / (lag + clamp(shift, -0.5, 0.5)), c: best };
  }
  function frame(dt) {
    if (!on || !an) return null;
    an.getFloatTimeDomainData(td);
    let rms = 0; for (let i = 0; i < td.length; i++) rms += td[i] * td[i];
    rms = Math.sqrt(rms / td.length);
    floor = rms < floor ? lerp(floor, rms, 0.25) : lerp(floor, rms, 0.0015);
    floor = Math.max(floor, 0.0015);
    const deaf = performance.now() < deafUntil;
    st.level = deaf ? 0 : clamp((rms - floor * 1.5) / 0.15, 0, 1);
    // spectrum: is it breathy noise (blowing) or a tone (humming)?
    an.getFloatFrequencyData(fd);
    const bin = ac.sampleRate / an.fftSize;
    let sl = 0, sn = 0, n = 0, low = 0;
    for (let i = Math.floor(120 / bin); i < Math.floor(4000 / bin); i++) { const p = Math.pow(10, fd[i] / 10) + 1e-14; sl += Math.log(p); sn += p; n++; if (i * bin < 500) low += p; }
    const flatness = Math.exp(sl / n) / (sn / n);
    const lowShare = low / sn;
    frameN++;
    if (frameN % 2 === 0 && !deaf && rms > Math.max(0.006, floor * 2.5)) { const p = pitch(ac.sampleRate); st.clarity = p.c; st.midi = p.f ? 69 + 12 * Math.log2(p.f / 440) : 0; }
    else if (rms <= Math.max(0.006, floor * 2.5)) st.clarity = 0;
    // blowing is loud, breathy and has no steady pitch; humming has a clear one
    const blowing = !deaf && rms > Math.max(0.05, floor * 7) && st.clarity < 0.7 && (flatness > 0.12 || lowShare > 0.6);
    st.blow = clamp(st.blow + (blowing ? dt * 5 : -dt * 3.5), 0, 1);
    const singing = !deaf && !blowing && st.clarity > 0.84 && st.midi > 40 && st.midi < 86 && rms > Math.max(0.01, floor * 3);
    const now = performance.now() / 1000;
    if (singing) { quiet = 0; if (!take.length || now - take[take.length - 1].t >= 0.045) take.push({ m: st.midi, a: rms, t: now }); }
    else if (take.length) {
      quiet += dt;
      if (quiet > 0.7) finishTake();
      else if (now - take[take.length - 1].t >= 0.045) take.push({ m: 0, a: 0, t: now });
    }
    st.singing = singing;
    return st;
  }
  function finishTake() {
    const raw = take; take = []; quiet = 0;
    while (raw.length && raw[raw.length - 1].a === 0) raw.pop();
    const voiced = raw.filter((x) => x.a > 0);
    if (raw.length < 2 || raw[raw.length - 1].t - raw[0].t < 0.9 || voiced.length < 8) return; // under about a second
    const med = voiced.map((x) => x.m).sort((a, b) => a - b)[voiced.length >> 1];
    const shift = Math.round((76 - med) / 12) * 12;
    const notes = [];
    const end = Math.min(raw.length, raw.findIndex((x) => x.t - raw[0].t > 6) + 1 || raw.length);
    for (let i = 0; i < end; i++) {
      const x = raw[i];
      const d = i + 1 < raw.length ? clamp(raw[i + 1].t - x.t, 0.02, 0.2) : 0.12;
      const m = x.a > 0 ? Math.round(x.m + shift) : 0;
      const prev = notes[notes.length - 1];
      const on = x.a > 0 ? 1 : 0;
      if (prev && prev.a === on && (prev.m === m || !on)) prev.d += d; else notes.push({ m: m || (prev ? prev.m : 76), a: on, d });
    }
    onEcho && onEcho(notes);
  }
  function deafen(sec) { deafUntil = performance.now() + sec * 1000; take = []; }
  return { start, stop, frame, deafen, st, set onEcho(fn) { onEcho = fn; }, get on() { return on; }, available: () => !ENV.framed && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) };
})();

/* ---------- Keep the screen awake (nightlight, camera hunts) ---------- */
const Wake = (() => {
  let lock = null;
  const reasons = new Set();
  const supported = 'wakeLock' in navigator;
  async function sync() {
    if (!supported) return;
    if (reasons.size && !lock && document.visibilityState === 'visible') {
      try { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => { lock = null; }); } catch (e) { lock = null; }
    } else if (!reasons.size && lock) { const l = lock; lock = null; l.release().catch(() => {}); }
  }
  document.addEventListener('visibilitychange', sync);
  return { hold(r) { reasons.add(r); sync(); }, drop(r) { reasons.delete(r); sync(); }, supported, get held() { return !!lock; } };
})();

/* ---------- Home Screen icon badge: colors still to find today ---------- */
const Badge = (() => {
  const supported = () => 'setAppBadge' in navigator;
  const perm = () => ('Notification' in window ? Notification.permission : 'unavailable');
  async function enable() {
    if (!('Notification' in window) || !supported()) return 'unavailable';
    let p = Notification.permission;
    try { if (p === 'default') p = await Notification.requestPermission(); } catch (e) { p = 'denied'; }
    if (p !== 'granted') return 'denied';
    S.s.badge = true; Store.save(); update();
    return 'granted';
  }
  function disable() { S.s.badge = false; Store.save(); try { navigator.clearAppBadge && navigator.clearAppBadge().catch(() => {}); } catch (e) {} }
  function update() {
    if (!S.s.badge || !supported() || perm() !== 'granted') return;
    const left = Math.max(0, 5 - Store.todays().length);
    try { (left ? navigator.setAppBadge(left) : navigator.clearAppBadge()).catch(() => {}); } catch (e) {}
  }
  return { enable, disable, update, supported, perm };
})();
