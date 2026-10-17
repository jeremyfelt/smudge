/* ============================================================
   App: Smudge's brain. Moods, feeding, sleeping, listening,
   the frame loop, and the Home Screen app plumbing.
   ============================================================ */
const App = (() => {
  const root = document.documentElement;
  const app = $('#app');
  const canvas = $('#stage');
  const photoInput = $('#photo-input');
  let ctx = null;
  let W = 0, H = 0, dpr = 1, floorY = 0;
  let mode = 'home';
  let sky = null, skyAt = 0, nightK = 0;
  let craving = null;
  let lastTouch = nowS(), nextLook = 0, nextHop = nowS() + 12, nextMuse = nowS() + 45, nextYawn = nowS() + 20, nextZ = 0, nextNote = 0, nextSave = 0, nextHud = 0, nextDay = 0;
  let pokes = [], gesture = null, expectLanding = false;
  let dizzyUntil = 0, puddleOn = false, flatSince = 0, faceDownSince = 0;
  let inflate = 0, inflateState = 'idle', thrust = 0, floatSaid = false;
  let lastSample = 0, lastPing = 0, lastName = '', lastNameAt = 0, ringMoved = true;
  let today = dayKey();
  let installEvt = null, askYes = null, lastAte = 0, introUntil = 0, frameOdd = false;
  const HALF = 36 * 3600e3;

  /* ---------- canvas + layout ---------- */
  try { ctx = canvas.getContext('2d', { colorSpace: 'display-p3' }); } catch (e) {}
  if (!ctx) ctx = canvas.getContext('2d');
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;inset:0;pointer-events:none;visibility:hidden;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
  document.body.appendChild(probe);
  function insets() { const cs = getComputedStyle(probe); return { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 }; }

  function layout(snap = false) {
    W = innerWidth; H = innerHeight; dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
    const ins = insets();
    const R = clamp(Math.min(W * 0.25, H * 0.135), 56, 150);
    let floor = Math.round(H * 0.665), radius = R;
    if (mode === 'camera') { floor = H - ins.b - 14 - 74 - 20 - 12; radius = R * 0.64; }
    if (mode === 'adopt') { const card = $('.adopt-card'); const top = card ? card.getBoundingClientRect().top : H * 0.55; floor = Math.round(clamp(top - 28, H * 0.28, H * 0.6)); radius = Math.min(R, (floor - ins.t - 40) / 2.4); }
    floorY = floor;
    if (mode !== 'camera') root.style.setProperty('--horizon', floor + 'px');
    Pet.layout({ l: ins.l + 6, r: W - ins.r - 6, t: ins.t + 74, b: floor, radius }, snap);
    if (Cam.mode !== 'still') Cam.ret.y = H < 720 ? 0.34 : H < 800 ? 0.37 : 0.4;
    root.style.setProperty('--ry', Cam.ret.y);
  }

  function makeGrain() {
    try {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const x = c.getContext('2d'); const d = x.createImageData(128, 128);
      for (let i = 0; i < d.data.length; i += 4) { const v = (Math.random() * 255) | 0; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
      x.putImageData(d, 0, 0);
      root.style.setProperty('--grain', `url(${c.toDataURL('image/png')})`);
    } catch (e) {}
  }

  /* ---------- sky ---------- */
  function updateSky(force) {
    const t = Date.now();
    if (!force && t - skyAt < 20000) return;
    skyAt = t;
    sky = Sky.now(new Date());
    const [top, mid, low] = Sky.palette(sky.sun.alt);
    const set = (k, c) => root.style.setProperty(k, Color.css(c));
    set('--sky-top', top); set('--sky-mid', mid); set('--sky-low', low);
    set('--gnd-top', Color.tone(low, -0.07, 0.85)); set('--gnd-mid', Color.tone(mid, -0.1, 0.85)); set('--gnd-low', Color.tone(top, -0.12, 0.85));
    nightK = smoothstep(-2, -10, sky.sun.alt);
    root.dataset.sky = sky.sun.alt < -5 ? 'night' : sky.sun.alt < 3 ? 'dusk' : 'day';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', Color.hex(top));
  }

  /* ---------- color in the belly ---------- */
  function refreshPigments(freshHex) {
    const now = Date.now();
    const w = (p) => p.w * Math.pow(0.5, (now - p.t) / HALF);
    S.pig = S.pig.filter((p) => w(p) > 0.04).slice(-6);
    const list = S.pig.map((p) => ({ c: Color.fromP3(...p.p3), w: w(p) }));
    Pet.setPigments(list, freshHex);
    Sound.setPitchFrom(list.length ? Pet.palette.base : null);
  }

  /* ---------- cravings ---------- */
  function pickCraving() {
    if (Store.todays().length >= 5) { craving = null; S.crave = null; UI.setCraving(null); Store.save(); return; }
    const eaten = Store.todays().map((m) => Color.fromP3(...m.p3));
    let opts = Cravings.filter((cr) => cr.id !== S.crave && !eaten.some((c) => Crave.score(cr, c) > 0.6));
    if (!opts.length) opts = Cravings.filter((cr) => cr.id !== S.crave);
    craving = pick(opts);
    S.crave = craving.id; S.misses = 0; Store.save();
    UI.setCraving(craving);
  }

  function status() {
    const n = Store.todays().length;
    if (mode === 'sleep') return 'asleep';
    if (Mic.on && Mic.st.singing) return 'listening to you hum';
    if (puddleOn) return 'being a puddle';
    if (n >= 5) return 'full, palette done';
    if (craving) return n ? `craving ${craving.word}, ${5 - n} to go` : `craving ${craving.word}`;
    return n ? `${5 - n} more colors today` : 'hungry for colors';
  }
  function restoreBase() {
    if (mode === 'sleep') Pet.setBase('closed', 'tiny');
    else if (puddleOn) Pet.setBase('closed', 'cat');
    else if (mode === 'camera') return;
    else if (nightK > 0.75) Pet.setBase('open', 'tiny');
    else Pet.setBase('open', 'smile');
  }
  function setMode(m) {
    mode = m; app.dataset.mode = m;
    layout();
    restoreBase();
  }

  /* ---------- touching Smudge ---------- */
  function onDown(e) {
    Sound.unlock();
    lastTouch = nowS();
    const x = e.clientX, y = e.clientY;
    Pet.lookAt(x, y);
    if (Pet.hitTest(x, y)) {
      gesture = { id: e.pointerId, x0: x, y0: y, x, y, t0: nowS(), kind: 'pending', rev: 0, dir: 0, pet: 0, heart: 70 };
      gesture.hold = setTimeout(startSquish, 240);
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    } else gesture = { id: e.pointerId, kind: 'sky', x0: x, y0: y, t0: nowS() };
  }
  function onMove(e) {
    const x = e.clientX, y = e.clientY;
    const g = gesture;
    if (!g || e.pointerId !== g.id) { if (e.pointerType === 'mouse') Pet.lookAt(x, y); return; }
    Pet.lookAt(x, y);
    if (g.kind === 'sky') return;
    const dx = x - g.x, dy = y - g.y;
    if (g.kind === 'pending' && Math.hypot(x - g.x0, y - g.y0) > 10) { clearTimeout(g.hold); g.kind = 'drag'; Pet.grabStart(g.x0, g.y0); Pet.setFace('wide', 'o', 30); }
    if (g.kind === 'drag') {
      Pet.grabMove(x, y);
      const d = Math.sign(dx);
      if (Math.abs(dx) > 1.5 && d !== g.dir) { if (g.dir) g.rev++; g.dir = d; }
      if (g.rev >= 2 && nowS() - g.t0 < 1.6 && Math.hypot(x - g.x0, y - g.y0) < Pet.R * 1.1) startPet(g);
    } else if (g.kind === 'pet') {
      Pet.ripple(x, y, dx, dy);
      const step = Math.hypot(dx, dy);
      g.pet += step;
      const lp = Sound.loop('purr'); lp && lp.level(clamp(step / 26, 0.12, 0.55));
      if (g.pet > g.heart) { g.heart = g.pet + 110; const h = Pet.headTop(); FX.heart(h.x, h.y + 6); }
    }
    g.x = x; g.y = y;
  }
  function onUp(e) {
    const g = gesture;
    if (!g || e.pointerId !== g.id) return;
    gesture = null; clearTimeout(g.hold);
    Sound.unlock();
    if (S.s.tilt && !Motion.flowing) Motion.enable();
    if (g.kind === 'pending') poke(g.x0, g.y0);
    else if (g.kind === 'drag') endDrag();
    else if (g.kind === 'pet') endPet(g);
    else if (g.kind === 'squish') endSquish();
    else if (g.kind === 'sky' && e.type === 'pointerup' && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) < 12) tapSky(g.x0, g.y0);
  }
  function poke(x, y) {
    if (mode === 'sleep') { Pet.wobble(70); UI.say(pick(['mm… five more minutes', 'zzz… not now', 'shh. dreaming of teal']), { whisper: true }); return; }
    Pet.poke(x, y); Haptics.tap(); Sound.play('pop');
    const t = nowS(); pokes = pokes.filter((p) => t - p < 3); pokes.push(t);
    S.pokes = (S.pokes || 0) + 1;
    if (pokes.length >= 6) { pokes = []; Pet.setFace('annoyed', 'frown', 1.8); UI.say(pick(['okay, okay!', 'hey! that’s a lot of poking', 'i’m not a button'])); return; }
    Pet.setFace(pick(['happy', 'wide', 'happy']), pick(['grin', 'o', 'grin']), 0.9);
    if (Math.random() < 0.42 && !UI.speaking()) UI.say(pick(['hee!', 'boop.', 'that tickles!', 'hi!', 'eep!', 'hehe']));
    if (S.pokes === 3) setTimeout(askTilt, 1600);
  }
  function startSquish() {
    const g = gesture; if (!g || g.kind !== 'pending') return;
    g.kind = 'squish';
    Pet.squishStart(g.x0); Pet.setFace('squint', 'puff', 30); Sound.play('squeak'); Haptics.tap();
  }
  function endSquish() { Pet.squishEnd(); Pet.hop(430); Sound.play('boing'); Haptics.tap(); Pet.setFace('happy', 'grin', 1); FX.puff(Pet.state().cx, floorY, 6); if (Math.random() < 0.5) UI.say(pick(['boing!', 'squish!', 'again!'])); }
  function endDrag() {
    Pet.grabEnd();
    const st = Pet.state();
    if (floorY - (st.cy + st.local.maxY) > 26) { Pet.setFace('happy', 'wide', 1.2); Sound.play('whoosh'); expectLanding = true; if (Math.random() < 0.6) UI.say(pick(['wheee!', 'weee!', 'flying!'])); }
    else Pet.setFace('happy', 'smile', 0.8);
    Haptics.tap();
  }
  function startPet(g) { Pet.grabEnd(); g.kind = 'pet'; Sound.loop('purr'); Pet.face.blushT = 1; Pet.setFace('closed', 'cat', 60); }
  function endPet(g) {
    const lp = Sound.loop('purr'); setTimeout(() => lp && lp.stop(), 250);
    Pet.setFace('happy', 'cat', 1.4); Haptics.tap();
    setTimeout(() => { Pet.face.blushT = 0; }, 2400);
    if (g.pet > 300 && Math.random() < 0.6) UI.say(pick(['more pets please', 'mmm. nice.', 'purrrr']));
  }
  function tapSky(x, y) {
    const hit = sky && mode !== 'camera' ? Sky.hit(x, y, W, floorY, sky) : null;
    FX.sparkle(x, y, 4, 10);
    Pet.lookAt(x, y);
    if (hit === 'moon') UI.say(pick(['the moon looks like a cookie', 'i want to taste the moon', 'hi, moon!']));
    else if (hit === 'sun') UI.say(pick(['too bright!', 'the sun tastes spicy', 'warm!']));
  }
  Pet.onLand = (k) => {
    const st = Pet.state();
    Sound.play('thump', 0.45 + k * 0.8);
    FX.puff(st.cx, floorY, 3 + Math.round(k * 6));
    if (k > 0.3) { Pet.setFace('squint', 'o', 0.45); Haptics.tap(); if (expectLanding && Math.random() < 0.5) setTimeout(() => UI.say(pick(['oof', 'ta-da!', 'landed it'])), 300); }
    expectLanding = false;
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  /* ---------- feeding ---------- */
  const camMsgEl = $('#cam-msg');
  const camMsg = (t) => { camMsgEl.textContent = t || ''; camMsgEl.hidden = !t; };
  function scoopState() {
    const full = Store.todays().length >= 5;
    $('#scoop').disabled = false;
    $('.scoop-label').textContent = full ? 'Full' : 'Feed';
    $('#scoop').setAttribute('aria-label', full ? `${S.name} is full for today` : 'Feed this color to Smudge');
  }
  async function openFeed() {
    if (mode === 'sleep') wakeUp(true);
    UI.closeSheet(true);
    hideAsk();
    setMode('camera');
    $('#camui').hidden = false;
    Wake.hold('feed');
    scoopState();
    Pet.setBase('open', 'o');
    lastName = ''; $('.ln-name').textContent = Store.todays().length >= 5 ? 'Just looking' : 'Looking…'; $('.ln-hint').textContent = '';
    if (ENV.framed || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      camMsg('Pick or take a photo, then drag the ring onto a color and tap Feed. The photo button is at the top right.');
      photoInput.click();
      return;
    }
    camMsg(null);
    try {
      await Cam.openLive();
      if (mode !== 'camera') { Cam.close(); return; }
      if (!S.seen.cam) { S.seen.cam = 1; Store.save(); setTimeout(() => UI.say('point me at something colorful!'), 500); }
    } catch (e) {
      const denied = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
      camMsg(denied ? 'Camera access is off for Smudge. Turn it on in Settings, or tap the photo button to feed it a picture.' : 'The camera isn’t available right now. Tap the photo button to feed Smudge a picture.');
    }
  }
  function closeFeed() {
    Cam.close();
    $('#camui').hidden = true;
    Wake.drop('feed');
    root.style.setProperty('--match', 0);
    root.style.setProperty('--rx', 0.5);
    setMode('home');
  }
  photoInput.addEventListener('change', async () => {
    const f = photoInput.files && photoInput.files[0];
    photoInput.value = '';
    if (!f) return;
    try { await Cam.openStill(f); camMsg(null); if (mode !== 'camera') { setMode('camera'); $('#camui').hidden = false; } ringMoved = false; lastName = ''; }
    catch (e) { camMsg(e.message || 'That picture couldn’t be opened.'); }
  });
  $('#cam-close').addEventListener('click', () => { Haptics.tap(); closeFeed(); });
  $('#cam-photos').addEventListener('click', () => photoInput.click());
  $('#scoop').addEventListener('click', () => { Sound.unlock(); scoopNow(); });
  // drag the ring around a photo (and tap it in live view)
  const pad = $('#cam-pad');
  let padDrag = false;
  pad.addEventListener('pointerdown', (e) => {
    if (Cam.mode === 'still') { padDrag = true; try { pad.setPointerCapture(e.pointerId); } catch (err) {} moveRing(e, false); }
    else if (Cam.mode === 'live') { const rx = Cam.ret.x * W, ry = Cam.ret.y * H; if (Math.hypot(e.clientX - rx, e.clientY - ry) < 70) scoopNow(); }
  });
  pad.addEventListener('pointermove', (e) => { if (padDrag) moveRing(e, true); });
  const endPad = () => { padDrag = false; };
  pad.addEventListener('pointerup', endPad); pad.addEventListener('pointercancel', endPad);
  function moveRing(e, lift) {
    Cam.moveReticle(e.clientX, e.clientY - (lift && e.pointerType === 'touch' ? 70 : 0));
    root.style.setProperty('--rx', Cam.ret.x); root.style.setProperty('--ry', Cam.ret.y);
    lastSample = 0; ringMoved = true;
  }
  function liveColor(c, t) {
    root.style.setProperty('--live', Color.css(c));
    const nm = Names.name(c);
    if (nm.name !== lastName && t - lastNameAt > 0.3) { lastName = nm.name; lastNameAt = t; $('.ln-name').textContent = nm.name; }
    const full = Store.todays().length >= 5;
    const m = craving && !full ? Crave.score(craving, c) : 0;
    root.style.setProperty('--match', m.toFixed(3));
    $('.ln-hint').textContent = full ? `${S.name} is full for today` : !ringMoved ? 'Drag the ring onto a color' : m > 0.6 ? `${S.name} wants this one!` : m > 0.3 ? 'getting warmer…' : `${Color.hex(c)}${nm.wide ? ', wider than sRGB' : ''}`;
    if (!FX.busy) {
      if (m > 0.6) Pet.setBase('star', 'grin'); else if (m > 0.3) Pet.setBase('wide', 'o'); else Pet.setBase('open', full ? 'puff' : 'o');
    }
    if (craving && m > 0.25 && t - lastPing > lerp(1, 0.2, m)) { lastPing = t; Sound.ping(m); if (m > 0.6) Pet.hop(70); }
    Pet.lookAt(Cam.ret.x * W, Cam.ret.y * H);
  }
  function scoopNow() {
    if (FX.busy) return;
    if (Store.todays().length >= 5) { Pet.setFace('squint', 'puff', 1.4); Sound.play('boop'); UI.say(pick(['i’m stuffed! tomorrow?', 'no room. today’s palette is done!'])); return; }
    const c = Cam.color;
    if (!c) { camMsg(Cam.mode ? 'Hold steady for a moment…' : 'Tap the photo button to pick a picture first.'); return; }
    Haptics.tap(); Sound.play('slurp');
    const crop = Cam.crop();
    const src = Cam.mode;
    Pet.face.openT = 1; Pet.setFace('wide', 'wide', 0.9);
    FX.scoop(Cam.ret.x * W, Cam.ret.y * H, 36, c, () => Pet.mouthPoint(), () => eat(c, crop, src));
  }
  function eat(c, crop, src) {
    const t = Date.now();
    const nm = Names.name(c, t);
    const hit = craving ? Crave.score(craving, c) >= 0.6 : false;
    const meal = { id: t.toString(36) + Math.random().toString(36).slice(2, 6), n: ++S.n, t, day: dayKey(), p3: c.p3.map((v) => +v.toFixed(4)), name: nm.name, fam: nm.fam, hex: Color.hex(c), lrv: Color.lrv(c), wide: nm.wide, crave: hit, src };
    S.meals.push(meal);
    S.pig.forEach((p) => { p.w *= 0.8; });
    S.pig.push({ p3: meal.p3, w: 1, t });
    Store.save();
    if (crop) Crops.put(meal.id, crop);
    refreshPigments(meal.hex);
    lastAte = nowS();
    Pet.face.openT = 0;
    Sound.play('gulp'); Haptics.double();
    Pet.setFace('closed', 'chew', 1.2); Pet.wobble(150);
    setTimeout(() => Sound.play('chew'), 230);
    const m = Pet.mouthPoint(); FX.drops(m.x, m.y, c, 4);
    UI.dots(true); setTimeout(() => Sound.play('click'), 420);
    Badge.update();
    const n = Store.todays().length;
    setTimeout(() => {
      const h = Pet.headTop();
      if (hit) { Sound.play('chime'); FX.sparkle(h.x, h.y, 9, 70); Pet.setFace('star', 'grin', 2.2); Pet.hop(380); UI.say(`${nm.name}! exactly what i wanted`); Haptics.triple(); }
      else UI.say(`${nm.name}. ${Names.flavor(c)}`);
    }, 1150);
    if (hit) { craving = null; S.crave = null; UI.setCraving(null); }
    else S.misses = (S.misses || 0) + 1;
    if (n >= 5) { craving = null; S.crave = null; UI.setCraving(null); setTimeout(paletteDone, 3300); }
    else if (!craving || S.misses >= 2) setTimeout(pickCraving, 3600);
    scoopState();
    if (S.meals.length === 2) setTimeout(askBadge, 5200);
    setTimeout(() => Lullaby.prepare(lullabyColors()).catch(() => {}), 6000);
  }
  function paletteDone() {
    const cols = Store.todays().map((m) => Color.fromP3(...m.p3));
    Sound.play('fanfare'); Haptics.triple();
    FX.confetti(W / 2, Pet.headTop().y, cols, 70);
    Pet.hop(520); Pet.setFace('star', 'grin', 2.6);
    UI.say('palette done! that’s all five');
    setTimeout(() => {
      if (mode === 'camera') closeFeed();
      setTimeout(() => { UI.renderBook({ fresh: true }); UI.openSheet('sheet-book'); }, 700);
    }, 2600);
  }

  /* ---------- sleeping ---------- */
  function lullabyColors() {
    const t = Store.todays().map((m) => Color.fromP3(...m.p3));
    if (t.length) return t;
    return S.pig.slice(-5).map((p) => Color.fromP3(...p.p3));
  }
  function tuckIn() {
    if (mode === 'camera') closeFeed();
    if (Mic.on) toggleListen(false, true);
    hideAsk();
    setMode('sleep');
    UI.pressed('sleep', true);
    Pet.breatheRate = 0.8;
    Sound.play('yawn');
    setTimeout(() => UI.say(pick(['goodnight…', 'night night', 'humming you my colors…']), { whisper: true }), 1100);
    const cols = lullabyColors();
    let art = '';
    try { art = Portrait.art(cols, 512).toDataURL('image/png'); } catch (e) {}
    if (S.s.sound) Lullaby.start(cols, { title: `${S.name}’s lullaby`, artist: 'Smudge', album: cols.length ? `Made from ${cols.length} colors` : 'Smudge', art, onStop: () => wakeUp() });
    else UI.toast('Voice is off in Senses, so no lullaby tonight');
    if (S.s.glow) Wake.hold('sleep');
    nextZ = nowS() + 1.5;
  }
  function wakeUp(quiet) {
    Lullaby.stop(); Wake.drop('sleep');
    UI.pressed('sleep', false);
    Pet.breatheRate = 1.6;
    setMode('home');
    if (quiet) return;
    Sound.play('yawn'); Pet.hop(260);
    setTimeout(() => UI.say(pick(['morning!', 'i’m up! i’m up!', 'i dreamed in colors'])), 1100);
  }

  /* ---------- listening ---------- */
  async function toggleListen(want, quiet) {
    if (want === undefined) want = !Mic.on;
    if (!want) { Mic.stop(); UI.pressed('listen', false); endInflate(); if (!quiet) UI.say('ears off'); return; }
    if (!Mic.available()) { UI.pressed('listen', false); UI.toast(ENV.framed ? 'Listening works once Smudge is on your Home Screen' : 'This browser can’t share the microphone'); return; }
    if (mode === 'sleep') wakeUp(true);
    const r = await Mic.start();
    if (r === 'granted') { UI.pressed('listen', true); Pet.setFace('wide', 'o', 1); UI.say(pick(['i’m listening! hum me a tune', 'ears on. hum, or blow on me!'])); }
    else { UI.pressed('listen', false); UI.toast(r === 'denied' ? 'Microphone access is off. You can allow it in Settings.' : 'The microphone isn’t available right now'); }
  }
  Mic.onEcho = (notes) => {
    const total = notes.reduce((a, n) => a + n.d, 0);
    Mic.deafen(total + 2);
    Pet.setFace('happy', 'grin', 0.9);
    UI.say(pick(['ooh! my turn', 'like this?', 'i know that one!']));
    setTimeout(() => {
      Sound.echo(notes);
      const t0 = nowS(); let acc = 0; const sched = [];
      for (const n of notes) { if (n.a) { const last = sched[sched.length - 1]; if (last && Math.abs(last[1] - (t0 + acc)) < 0.01) last[1] += n.d; else sched.push([t0 + acc, t0 + acc + n.d]); } acc += n.d; }
      Pet.talk(sched.map(([a, b]) => [a, b + 0.02]));
      Pet.setFace('closed', 'smile', total);
      for (let k = 0; k < total; k += 0.5) setTimeout(() => { const h = Pet.headTop(); FX.note(h.x + rand(-30, 30), h.y); }, k * 1000);
    }, 1100);
  };
  function endInflate() { const l = Sound.loop('hiss'); l && l.stop(); if (inflate > 0 && inflateState !== 'release') inflateState = 'deflating'; }

  /* ---------- asking for a sense, kindly, once ---------- */
  const askEl = $('#ask');
  function ask(id, text, yes, onYes) {
    if (S.seen[id] || mode !== 'home' || UI.sheetOpen) return;
    S.seen[id] = 1; Store.save();
    $('#ask-text').textContent = text; $('#ask-yes').textContent = yes;
    askYes = onYes; askEl.hidden = false;
  }
  function hideAsk() { askEl.hidden = true; askYes = null; }
  $('#ask-no').addEventListener('click', hideAsk);
  $('#ask-yes').addEventListener('click', async () => { const f = askYes; hideAsk(); f && (await f()); });
  function askTilt() {
    if (!Motion.available() || Motion.flowing || !ENV.coarse) return;
    ask('tilt', `Want ${S.name} to slide around when you tilt your phone?`, 'Let it feel tilts', async () => {
      const r = await Motion.enable();
      if (r === 'granted') react('tiltOn'); else UI.toast(r === 'denied' ? 'Motion access is off. You can turn it on in Senses later.' : 'Tilt isn’t available here');
    });
  }
  function askBadge() {
    if (!ENV.standalone || !Badge.supported() || !('Notification' in window) || S.s.badge) return;
    ask('badge', `Show how many colors ${S.name} still wants today on the Home Screen icon?`, 'Show on icon', async () => {
      const r = await Badge.enable();
      UI.toast(r === 'granted' ? 'The icon now shows colors left today' : 'Notifications are off, so the badge can’t show');
    });
  }
  function react(kind) {
    if (kind === 'tiltOn') { Pet.hop(320); Pet.setFace('wide', 'grin', 1.2); UI.say('ooh, i can feel that! tilt me'); }
    if (kind === 'renamed') { Pet.hop(240); Pet.setFace('happy', 'grin', 1.2); UI.say(`i’m ${S.name}!`); }
  }

  /* ---------- talk to yourself, a little ---------- */
  function muse() {
    const n = Store.todays().length;
    const lines = ['do clouds taste like milk?', 'i’m mostly jelly', 'colors are my favorite food. also my only food.', 'is that a color over there?', 'beep.'];
    if (craving) lines.push(`i could really go for ${Crave.label(craving)}`, `${Crave.label(craving)}… anywhere?`);
    if (n >= 5) lines.push('so full. so colorful.', 'digesting a rainbow');
    if (nightK > 0.6) lines.push('the stars look crunchy', 'getting sleepy…');
    else if (sky && sky.sun.alt < 8 && sky.sun.alt > -4) lines.push('the sky is doing the pretty thing');
    if (Motion.flowing) lines.push('tilt me! i like sliding');
    return pick(lines);
  }
  function greet(first) {
    const away = S.lastSeen ? (Date.now() - S.lastSeen) / 1000 : 0;
    const lines = [];
    if (first) {
      lines.push(ENV.standalone ? 'home sweet home!' : 'hi! i’m smudge.', 'i eat colors.');
      if (craving) lines.push(`can you find me ${Crave.label(craving)}?`);
    } else if (ENV.standalone && !S.seen.home) {
      lines.push('home sweet home!', 'i like it here.');
    } else if (S.lastDay && S.lastDay !== dayKey()) lines.push('new day! new colors.');
    else if (away > 8 * 3600) lines.push('you’re back! i missed you');
    else if (away > 3600) lines.push(pick(['oh hi!', 'welcome back!']));
    if (ENV.standalone) S.seen.home = 1;
    lines.forEach((l, i) => setTimeout(() => { if (mode === 'home') { UI.say(l); if (i === 0) Pet.hop(300); } }, 900 + i * 2600));
    introUntil = nowS() + 1 + lines.length * 2.6;
  }

  /* ---------- the frame loop ---------- */
  const listenBtn = $('#dock [data-act="listen"]');
  let lastT = performance.now();
  function frame(now) {
    const dt = clamp((now - lastT) / 1000, 0, 0.05); lastT = now;
    frameOdd = !frameOdd;
    tick(dt);
    if (!(mode === 'sleep' && frameOdd)) render();
    requestAnimationFrame(frame);
  }
  function tick(dt) {
    const t = nowS();
    // balance
    const m = Motion.frame(dt);
    if (m) {
      Pet.gravity = { x: m.g.x, y: m.g.y + 0.3 * m.flat };
      if (m.flat > 0.85) { if (!flatSince) flatSince = t; if (!puddleOn && t - flatSince > 1.1 && mode === 'home') { puddleOn = true; Pet.puddle = 1; UI.say(pick(['ahh. flat.', 'puddle mode', 'so relaxing'])); } }
      else { flatSince = 0; if (puddleOn && m.flat < 0.45) { puddleOn = false; Pet.puddle = 0; UI.say(pick(['oop!', 'back up!'])); } }
      if (m.shake > 0.9 && t > dizzyUntil + 2 && mode !== 'sleep') { dizzyUntil = t + 2.6; Pet.setFace('dizzy', 'o', 2.6); Sound.play('dizzy'); UI.say(pick(['whoa whoa whoa', 'the room is spinning', 'blehhh'])); }
      if (m.faceDown) { if (!faceDownSince) faceDownSince = t; }
      else if (faceDownSince) { if (t - faceDownSince > 0.8 && mode === 'home') { Pet.setFace('wide', 'grin', 1.2); Pet.hop(300); UI.say('peekaboo!'); } faceDownSince = 0; }
    } else { Pet.gravity = { x: 0, y: 1 }; if (puddleOn) { puddleOn = false; Pet.puddle = 0; } }

    // hearing
    const ms = Mic.frame(dt);
    if (ms) {
      listenBtn.style.setProperty('--lvl', ms.level.toFixed(2));
      if (ms.blow > 0.35 && mode !== 'sleep' && inflateState !== 'release') {
        if (inflateState !== 'filling') { inflateState = 'filling'; floatSaid = false; Pet.setFace('squint', 'puff', 60); }
        inflate = Math.min(1, inflate + dt * 0.45 * ms.blow);
        const l = Sound.loop('hiss'); l && l.level(0.03 + 0.08 * ms.blow);
        if (inflate >= 0.98 && !floatSaid) { floatSaid = true; UI.say('mmmf!'); }
      } else if (inflateState === 'filling') {
        const l = Sound.loop('hiss'); l && l.stop();
        if (inflate > 0.5) { inflateState = 'release'; thrust = rand(TAU); Sound.play('raspberry'); Pet.setFace('squint', 'o', 1.2); }
        else { inflateState = 'deflating'; Pet.setFace('happy', 'smile', 0.8); }
      }
      if (ms.singing && inflateState === 'idle') {
        Pet.face.openT = 0.25 + ms.level * 0.6;
        Pet.setFace('closed', 'smile', 0.4);
        Pet.impulse(Math.sin(t * 4.2) * 7, 0);
        if (t > nextNote) { nextNote = t + 0.5; const h = Pet.headTop(); FX.note(h.x + rand(-40, 40), h.y); }
      } else if (mode !== 'camera' && !FX.busy) Pet.face.openT = 0;
    } else if (inflateState === 'filling') endInflate();
    if (inflateState === 'release') {
      inflate = Math.max(0, inflate - dt * 1.25);
      thrust += rand(-1, 1) * dt * 14;
      Pet.impulse(Math.cos(thrust) * 2600 * dt, Math.sin(thrust) * 2600 * dt - 900 * dt);
      if (inflate <= 0) { inflateState = 'idle'; Pet.setFace('dizzy', 'o', 1.6); setTimeout(() => UI.say(pick(['again!', 'pbbbt. hehe', 'that was fun'])), 900); }
    } else if (inflateState === 'deflating') { inflate = Math.max(0, inflate - dt * 0.6); if (!inflate) inflateState = 'idle'; }
    Pet.inflate = inflate;

    Pet.update(dt);
    FX.update(dt);

    // feeding: read the color under the ring
    if (mode === 'camera' && Cam.mode && t - lastSample > 0.07) { lastSample = t; const c = Cam.sample(); if (c) liveColor(c, t); }

    // idle life
    if (mode === 'home' && !gesture) {
      if (t > nextLook) {
        nextLook = t + rand(1.6, 4.2);
        const r = Math.random();
        if (r < 0.3 && craving) { const f = $('#feed').getBoundingClientRect(); Pet.lookAt(f.x + f.width / 2, f.y); }
        else if (r < 0.5) Pet.lookDir(0, 0);
        else Pet.lookDir(rand(-1, 1), rand(-0.8, 0.4));
      }
      if (t > nextHop && !ENV.reduced && nightK < 0.6) { nextHop = t + rand(10, 24); Pet.hop(rand(150, 260)); }
      if (nightK > 0.7 && t > nextYawn && !UI.speaking()) {
        nextYawn = t + rand(9, 16);
        if (Math.random() < 0.3) { Sound.play('yawn'); Pet.setFace('closed', 'wide', 1.3); }
        else Pet.setFace('closed', 'tiny', rand(1.8, 3.2)); // nodding off
      }
      if (t > nextMuse && t - lastTouch > 25 && t > introUntil && !UI.speaking() && !UI.sheetOpen) { nextMuse = t + rand(45, 90); UI.say(muse()); }
    }
    if (mode === 'sleep' && t > nextZ) { nextZ = t + 2.4; const h = Pet.headTop(); FX.zzz(h.x + Pet.R * 0.35, h.y); }
    if (mode !== 'camera') restoreBase();
    UI.showThought(mode === 'home' && !gesture && Store.todays().length < 5 && !UI.sheetOpen && t - lastAte > 4 && t > introUntil - 2.6 && inflateState === 'idle');
    UI.place();

    if (t > nextHud) { nextHud = t + 0.5; UI.hud(status()); app.toggleAttribute('data-hungry', mode === 'home' && Store.todays().length < 5); updateSky(); }
    if (t > nextDay) { nextDay = t + 5; checkDay(); }
    if (t > nextSave) { nextSave = t + 30; S.lastSeen = Date.now(); S.lastDay = dayKey(); Store.save(); }
  }
  function render() {
    const t = nowS();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (mode !== 'camera' && sky) Sky.draw(ctx, W, floorY, H, t, sky, true);
    const glow = mode === 'sleep' ? 1 : nightK * 0.8;
    Pet.draw(ctx, dpr, t, { mirror: mode !== 'camera', glow, night: nightK > 0.5 || mode === 'sleep', camera: mode === 'camera' });
    FX.draw(ctx, t, nightK > 0.5 || mode === 'sleep');
  }
  function checkDay() {
    const k = dayKey();
    if (k === today) return;
    today = k;
    S.misses = 0; pickCraving(); UI.dots(); Badge.update(); scoopState();
    if (mode === 'home') UI.say('new day! new colors.');
  }

  /* ---------- buttons ---------- */
  $('#dock').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    Sound.unlock(); lastTouch = nowS();
    const act = b.dataset.act;
    if (act !== 'feed') Haptics.tap();
    if (act === 'feed') openFeed();
    else if (act === 'book') { UI.renderBook(); UI.openSheet('sheet-book'); }
    else if (act === 'senses') { UI.renderSenses(); UI.openSheet('sheet-senses'); }
    else if (act === 'sleep') mode === 'sleep' ? wakeUp() : tuckIn();
    else if (act === 'listen') toggleListen();
  });
  $('#today').addEventListener('click', () => { Haptics.tap(); if (mode === 'camera') return; UI.renderBook(); UI.openSheet('sheet-book'); });
  $('#nameplate').addEventListener('click', () => { Haptics.tap(); UI.renderSenses(); UI.openSheet('sheet-senses'); });
  $('#thought').addEventListener('click', () => { Sound.unlock(); openFeed(); });

  /* ---------- Home Screen app plumbing ---------- */
  function showAdopt(force) {
    if (ENV.standalone || ENV.framed) return false;
    let dismissed = false; try { dismissed = sessionStorage.getItem('smudge.adopt') === '1'; } catch (e) {}
    if (dismissed && !force) return false;
    if (!ENV.ios) {
      $('#adopt-title').textContent = 'Smudge is made for iPhone';
      $('#adopt-text').textContent = installEvt ? 'You can install it here too. On an iPhone, open this page in Safari and add it to your Home Screen to give it every sense.' : 'Open this page in Safari on an iPhone and add it to your Home Screen. Smudge will still play here.';
    }
    $('#adopt-install').hidden = !installEvt;
    $('#adopt').hidden = false;
    setMode('adopt');
    setTimeout(() => layout(), 750);
    setTimeout(() => { if (mode === 'adopt') { UI.say('take me home?'); Pet.lookDir(0, 1); } }, 1500);
    return true;
  }
  $('#adopt-later').addEventListener('click', () => {
    Sound.unlock();
    try { sessionStorage.setItem('smudge.adopt', '1'); } catch (e) {}
    $('#adopt').hidden = true; setMode('home'); UI.hush(); greet(S.visits <= 1);
  });
  $('#adopt-install').addEventListener('click', async () => { if (!installEvt) return; installEvt.prompt(); try { await installEvt.userChoice; } catch (e) {} installEvt = null; $('#adopt-install').hidden = true; });
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; if (!$('#adopt').hidden) $('#adopt-install').hidden = false; });

  function launchScreen() {
    // iOS reads this when you tap Add to Home Screen: a launch image sized for this exact phone
    if (!ENV.ios || ENV.standalone || ENV.framed) return;
    const go = () => {
      try {
        const w = Math.round(screen.width * devicePixelRatio), h = Math.round(screen.height * devicePixelRatio);
        const url = Portrait.splash(Math.min(w, h), Math.max(w, h)).toDataURL('image/png');
        const l = document.createElement('link'); l.rel = 'apple-touch-startup-image'; l.href = url;
        document.head.appendChild(l);
      } catch (e) {}
    };
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => setTimeout(go, 1200));
  }
  function plumbing() {
    if ('serviceWorker' in navigator && !ENV.framed && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
    if (ENV.standalone && navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    launchScreen();
  }
  function useLocation(on) {
    if (!on) { S.s.loc = null; Store.save(); Sky.setPlace(null); updateSky(true); UI.renderSenses(); UI.toast('The sky follows your time zone'); return; }
    navigator.geolocation.getCurrentPosition((p) => {
      S.s.loc = { lat: +p.coords.latitude.toFixed(1), lon: +p.coords.longitude.toFixed(1) }; Store.save();
      Sky.setPlace(S.s.loc); updateSky(true); UI.renderSenses(); UI.toast('The sky now matches where you are');
    }, () => UI.toast('Location is off, so the sky follows your time zone'), { maximumAge: 3600e3, timeout: 15000 });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      S.lastSeen = Date.now(); S.lastDay = dayKey(); Store.flush(); Badge.update();
      if (mode === 'camera') closeFeed();
      if (Mic.on) { Mic.stop(); UI.pressed('listen', false); endInflate(); }
      const l = Sound.loop('purr'); l && l.stop();
    } else {
      lastT = performance.now();
      updateSky(true); checkDay(); refreshPigments();
      const away = (Date.now() - (S.lastSeen || Date.now())) / 1000;
      if (away > 3600 && mode === 'home') greet(false);
      S.lastSeen = Date.now();
    }
  });
  window.addEventListener('pagehide', () => { S.lastSeen = Date.now(); S.lastDay = dayKey(); Store.flush(); });
  window.addEventListener('resize', () => layout());
  if (screen.orientation) screen.orientation.addEventListener('change', () => setTimeout(layout, 120));
  ['touchend', 'pointerup', 'keydown'].forEach((ev) => window.addEventListener(ev, () => Sound.unlock(), { passive: true, once: true }));
  // Safari's pinch gesture would zoom the whole app; Smudge isn't a web page to zoom
  ['gesturestart', 'gesturechange'].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault(), { passive: false }));

  /* ---------- boot ---------- */
  function boot() {
    makeGrain();
    if (S.s.loc) Sky.setPlace(S.s.loc);
    updateSky(true);
    refreshPigments();
    S.visits = (S.visits || 0) + 1;
    const first = S.visits === 1;
    craving = S.crave ? Crave.get(S.crave) : null;
    if (!craving && Store.todays().length < 5) pickCraving(); else UI.setCraving(craving);
    if (S.s.tilt) Motion.resume();
    document.body.appendChild(Lullaby.el);
    Lullaby.el.hidden = true;
    layout(true);
    UI.hud(status()); UI.dots();
    if (!showAdopt(false)) greet(first);
    S.lastSeen = Date.now(); S.lastDay = dayKey(); Store.save();
    plumbing();
    Badge.update();
    requestAnimationFrame(frame);
  }

  return { boot, openFeed, closeFeed, tuckIn, wakeUp, toggleListen, showAdopt, useLocation, react, get mode() { return mode; }, get craving() { return craving; } };
})();

App.boot();
