/* ============================================================
   UI: speech bubbles, the top bar, the dock, sheets (swatch book,
   chip details, senses), toasts and the adopt card.
   ============================================================ */
const UI = (() => {
  const root = document.documentElement;
  const app = $('#app');
  const speech = $('#speech'), speechText = $('#speech-text');
  const thought = $('#thought'), thoughtText = $('.thought-text', thought);
  const toastEl = $('#toast');
  let sayTimer = 0, toastTimer = 0, speechW = 0, speechH = 0, thoughtW = 0;
  let thoughtCr = null;

  /* ---------- talking ---------- */
  function say(text, { whisper = false, hold = 0, voice = true, pitch = 1 } = {}) {
    const sched = voice ? Sound.speak(text, { whisper, pitch }) : [];
    Pet.talk(sched);
    speechText.textContent = text;
    speech.hidden = false;
    speech.classList.toggle('whisper', whisper);
    speech.classList.remove('pop'); void speech.offsetWidth; speech.classList.add('pop');
    speechW = speech.offsetWidth; speechH = speech.offsetHeight;
    const end = sched.length ? sched[sched.length - 1][1] - nowS() : text.length * 0.05;
    clearTimeout(sayTimer);
    sayTimer = setTimeout(() => { speech.hidden = true; }, (Math.max(0.6, end) + 1.7 + hold + text.length * 0.02) * 1000);
    thought.hidden = true;
    return sched;
  }
  const speaking = () => !speech.hidden;
  function hush() { clearTimeout(sayTimer); speech.hidden = true; }

  function setCraving(cr) {
    thoughtCr = cr;
    const c = cr ? Crave.show(cr) : Color.fromHex('#C9C3EC');
    root.style.setProperty('--crave', Color.css(c));
    root.style.setProperty('--crave-ink', c.lab[0] > 0.78 ? '#221d4a' : '#ffffff');
    if (cr) { thoughtText.textContent = `${Crave.label(cr)}?`; thought.setAttribute('aria-label', `${S.name} is craving ${Crave.label(cr)}. Tap to feed.`); }
    thoughtW = 0;
  }
  function showThought(on) {
    const want = on && !!thoughtCr && !speaking();
    if (want && thought.hidden) { thought.hidden = false; thought.classList.remove('pop'); void thought.offsetWidth; thought.classList.add('pop'); thoughtW = thought.offsetWidth; }
    else if (!want && !thought.hidden) thought.hidden = true;
  }
  // keep bubbles glued to Smudge's head
  let hudBottom = 80;
  function measure() { const r = $('#hud').getBoundingClientRect(); hudBottom = r.top + Math.max(...$$('#hud > *').map((n) => n.getBoundingClientRect().bottom - r.top), 60); }
  function place() {
    const W = innerWidth;
    const head = Pet.headTop();
    if (!speech.hidden) {
      let x = clamp(head.x, speechW / 2 + 12, W - speechW / 2 - 12);
      let top = head.y - 16 - speechH;
      const below = top < (app.dataset.mode === 'adopt' ? 14 : hudBottom + 8);
      if (below) { const st = Pet.state(); top = st.cy + st.local.maxY * 0.6 + 18; }
      speech.classList.toggle('below', below);
      speech.style.transform = `translate(${(x - speechW / 2).toFixed(1)}px, ${top.toFixed(1)}px)`;
      speech.style.setProperty('--tail', `${clamp(head.x - (x - speechW / 2), 22, speechW - 22).toFixed(0)}px`);
    }
    if (!thought.hidden) {
      if (!thoughtW) thoughtW = thought.offsetWidth;
      const R = Pet.R;
      let x = head.x + R * 0.45, y = Math.max(head.y - 72, hudBottom + 10);
      x = Math.min(x, W - thoughtW - 12);
      thought.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    }
  }

  function toast(msg, ms = 2600) {
    toastEl.textContent = msg; toastEl.hidden = false;
    toastEl.style.animation = 'none'; void toastEl.offsetWidth; toastEl.style.animation = '';
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastEl.hidden = true; }, ms);
  }

  /* ---------- top bar ---------- */
  function hud(status) {
    $('#pet-name').textContent = S.name;
    if (status != null) $('#pet-status').textContent = status;
  }
  function dots(fresh = false) {
    const meals = Store.todays();
    $$('#today .dot').forEach((d, i) => {
      const m = meals[i];
      d.classList.toggle('on', !!m);
      d.style.setProperty('--c', m ? Color.css(Color.fromP3(...m.p3)) : 'transparent');
      d.classList.toggle('fresh', fresh && i === meals.length - 1);
    });
    $('#today').setAttribute('aria-label', `Today's palette: ${meals.length} of 5 colors`);
  }
  function pressed(act, on) { const b = $(`#dock [data-act="${act}"]`); if (b) b.setAttribute('aria-pressed', on ? 'true' : 'false'); }

  /* ---------- sheets ---------- */
  const scrim = $('#scrim');
  let current = null;
  function openSheet(id) {
    const el = $('#' + id);
    if (current && current !== el) closeSheet(true);
    current = el;
    el.hidden = false; scrim.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => { el.classList.add('open'); scrim.classList.add('on'); }));
    app.inert = false;
    $$('#hud, #dock, #stage').forEach((n) => n.setAttribute('aria-hidden', 'true'));
    setTimeout(() => { const f = $('[data-close]', el); f && f.focus({ preventScroll: true }); }, 380);
  }
  function closeSheet(instant) {
    if (!current) return;
    const el = current; current = null;
    el.classList.remove('open'); scrim.classList.remove('on');
    $$('#hud, #dock, #stage').forEach((n) => n.removeAttribute('aria-hidden'));
    const done = () => { if (!el.classList.contains('open')) el.hidden = true; if (!current) scrim.hidden = true; };
    instant ? done() : setTimeout(done, 420);
  }
  scrim.addEventListener('click', () => closeSheet());
  $$('.sheet').forEach((el) => {
    $$('[data-close]', el).forEach((b) => b.addEventListener('click', () => closeSheet()));
    // drag the header down to dismiss
    const head = $('.sheet-head', el);
    let y0 = null, dy = 0;
    head.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; y0 = e.clientY; dy = 0; el.classList.add('dragging'); head.setPointerCapture(e.pointerId); });
    head.addEventListener('pointermove', (e) => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); el.style.translate = `0 ${dy}px`; });
    const end = () => { if (y0 == null) return; y0 = null; el.classList.remove('dragging'); el.style.translate = ''; if (dy > 90) closeSheet(); };
    head.addEventListener('pointerup', end); head.addEventListener('pointercancel', end);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

  /* ---------- swatch book ---------- */
  function chipStyle(m) { const c = Color.fromP3(...m.p3); return `--c:${Color.css(c)};--ci:${Color.ink(c)}`; }
  function stripHTML(day, meals, { fresh = false, share = true } = {}) {
    const chips = [];
    for (let i = 0; i < 5; i++) {
      const m = meals[i];
      if (m) chips.push(`<button type="button" class="chip${fresh && i === meals.length - 1 ? ' fresh' : ''}" style="${chipStyle(m)}" data-meal="${m.id}" aria-label="${esc(m.name)}, number ${m.n}"><span class="chip-name">${esc(m.name)}</span><span class="chip-meta"><span>№ ${pad4(m.n)}</span><span>LRV ${m.lrv}</span></span></button>`);
      else {
        const cr = i === meals.length && day === Store.today() && App.craving ? `Smudge wants ${Crave.label(App.craving)}` : 'not eaten yet';
        chips.push(`<div class="chip empty"><span class="chip-name">${esc(cr)}</span><span class="chip-meta"></span></div>`);
      }
    }
    const note = meals.length >= 5 ? 'Palette complete' : `${meals.length} of 5 colors`;
    return `<div class="strip" data-day="${day}">
      <div class="strip-top"><span class="strip-co">Smudge Color Co.</span><span class="strip-hole" aria-hidden="true"></span><span class="strip-date">${esc(fmtDay(day, { month: 'short', day: 'numeric' }))}</span></div>
      <div class="chips">${chips.join('')}</div>
      <div class="strip-foot"><span class="strip-note">${note}</span>${share && meals.length ? `<button type="button" class="pill-btn quiet small" data-share-day="${day}"><svg><use href="#i-share"/></svg>Share palette</button>` : ''}</div>
    </div>`;
  }
  function renderBook(opts = {}) {
    const today = Store.today();
    const meals = Store.todays();
    const days = Store.days().filter((d) => d !== today);
    const total = S.meals.length;
    $('#book-sub').textContent = total ? `${total} ${total === 1 ? 'color' : 'colors'} eaten since ${fmtDay(dayKey(new Date(S.born)), { month: 'short', day: 'numeric' })}. Tap a chip to see where it came from.` : 'Every color Smudge eats becomes a paint chip.';
    $('#book-today').innerHTML = `<h3 class="sec">Today</h3>${stripHTML(today, meals, { fresh: opts.fresh })}`;
    let earlier = '';
    if (days.length) {
      earlier = `<h3 class="sec">Earlier</h3><div class="days">${days.map((d) => {
        const ms = Store.mealsOn(d);
        return `<button type="button" class="day" data-day="${d}"><span><span class="day-date">${esc(fmtDay(d))}</span><br><span class="day-names">${esc(ms.map((m) => m.name).join(', '))}</span></span><span class="mini">${ms.map((m) => `<i style="--c:${Color.css(Color.fromP3(...m.p3))}"></i>`).join('')}</span></button>`;
      }).join('')}</div>`;
    } else if (!total) {
      earlier = `<div class="empty-note"><p class="lede">Smudge hasn’t eaten anything yet. Point the camera at something colorful and tap Feed.</p><button type="button" class="pill-btn solid small" data-go-feed>Feed Smudge</button></div>`;
    }
    $('#book-earlier').innerHTML = earlier;
    if (meals.length) Cards.strip(today, meals).catch(() => {});
  }
  function showDay(day) {
    const ms = Store.mealsOn(day);
    $('#book-earlier').innerHTML = `<div style="display:grid;gap:14px"><button type="button" class="pill-btn quiet small" data-back style="justify-self:start">All days</button>${stripHTML(day, ms)}</div>`;
    Cards.strip(day, ms).catch(() => {});
  }
  $('#sheet-book').addEventListener('click', async (e) => {
    const chip = e.target.closest('[data-meal]');
    if (chip) { Haptics.tap(); openChip(chip.dataset.meal); return; }
    const day = e.target.closest('.day[data-day]');
    if (day) { showDay(day.dataset.day); return; }
    if (e.target.closest('[data-back]')) { renderBook(); return; }
    if (e.target.closest('[data-go-feed]')) { closeSheet(); App.openFeed(); return; }
    const sh = e.target.closest('[data-share-day]');
    if (sh) {
      const d = sh.dataset.shareDay;
      const card = await Cards.strip(d, Store.mealsOn(d));
      const r = await Cards.share(card, `${S.name}'s palette`);
      if (r === 'again') toast('Tap Share palette once more');
      else if (r === 'saved') toast('Palette card saved');
      else if (r === 'failed') toast('Saving isn’t available here');
    }
  });

  /* ---------- one chip, up close ---------- */
  async function openChip(id) {
    const m = S.meals.find((x) => x.id === id);
    if (!m) return;
    const c = Color.fromP3(...m.p3);
    const [r, g, b] = Color.rgb255(c);
    const p3 = m.p3.map((v) => v.toFixed(3)).join(' ');
    $('#chip-body').innerHTML = `
      <div class="hero" style="${chipStyle(m)}">
        <img class="hero-crop" alt="Where ${esc(m.name)} was found" hidden>
        <span class="hero-no">№ ${pad4(m.n)}</span>
        <span class="hero-name" id="chip-name">${esc(m.name)}</span>
      </div>
      <dl class="facts">
        <div class="fact"><dt>Hex</dt><dd>${m.hex}</dd></div>
        <div class="fact"><dt>Light reflectance</dt><dd>LRV ${m.lrv}</dd></div>
        <div class="fact"><dt>sRGB</dt><dd>${r}, ${g}, ${b}</dd></div>
        <div class="fact"><dt>Display P3</dt><dd>${p3}</dd></div>
        <div class="fact wide"><dt>Eaten</dt><dd>${esc(fmtDay(m.day, { weekday: 'long', month: 'long', day: 'numeric' }))}, ${esc(fmtTime(m.t))}${m.crave ? '. Smudge was craving exactly this.' : '.'}</dd></div>
        ${m.wide ? '<div class="fact wide"><dt>Wide color</dt><dd>Too vivid for a hex code. Your iPhone can show it; the hex above is the closest standard color.</dd></div>' : ''}
      </dl>
      <div class="actions">
        <button type="button" class="pill-btn quiet" data-copy="${m.hex}"><svg><use href="#i-copy"/></svg>Copy hex</button>
        <button type="button" class="pill-btn quiet" data-share-chip="${m.id}"><svg><use href="#i-share"/></svg>Share chip</button>
      </div>`;
    openSheet('sheet-chip');
    const crop = await Crops.get(m.id);
    const im = $('.hero-crop', $('#chip-body'));
    if (crop && im) { im.src = crop; im.hidden = false; }
    Cards.chip(m).catch(() => {});
  }
  $('#sheet-chip').addEventListener('click', async (e) => {
    const cp = e.target.closest('[data-copy]');
    if (cp) {
      const hex = cp.dataset.copy;
      try { await navigator.clipboard.writeText(hex); toast(`Copied ${hex}`); Haptics.tap(); }
      catch (err) { const dd = $('.fact dd', $('#chip-body')); const range = document.createRange(); range.selectNodeContents(dd); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range); toast('Hex selected. Tap Copy to copy it.'); }
      return;
    }
    const sc = e.target.closest('[data-share-chip]');
    if (sc) {
      const m = S.meals.find((x) => x.id === sc.dataset.shareChip);
      const r = await Cards.share(await Cards.chip(m), m.name);
      if (r === 'again') toast('Tap Share chip once more');
      else if (r === 'saved') toast('Chip card saved');
      else if (r === 'failed') toast('Saving isn’t available here');
    }
  });

  /* ---------- senses ---------- */
  async function camState() {
    if (ENV.framed) return ['Photos only here'];
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return ['Not available'];
    try { const p = await navigator.permissions.query({ name: 'camera' }); return p.state === 'granted' ? ['Allowed', 'good'] : p.state === 'denied' ? ['Off in Settings'] : ['Asks when you feed']; } catch (e) { return ['Asks when you feed']; }
  }
  async function renderSenses() {
    $('#rename-input').value = S.name;
    const sw = 'serviceWorker' in navigator && !ENV.framed;
    const swReady = sw && !!navigator.serviceWorker.controller;
    let persisted = false; try { persisted = !!(navigator.storage && navigator.storage.persisted && await navigator.storage.persisted()); } catch (e) {}
    const cam = await camState();
    const place = Sky.place;
    const rows = [
      { id: 'home', ic: 'i-home', col: '#5b54d6', t: 'Home Screen', d: ENV.standalone ? 'Smudge lives here now and opens full screen, like any app.' : ENV.framed ? 'This is a preview inside Claude. Installed on a Home Screen, Smudge also gets the camera, tilt, hearing, badge and offline mode.' : 'Add Smudge to your Home Screen so it opens full screen and can use every sense below.', state: ENV.standalone ? ['Moved in', 'good'] : null, btn: !ENV.standalone && !ENV.framed ? ['How', () => { closeSheet(); App.showAdopt(true); }] : null },
      { id: 'offline', ic: 'i-offline', col: '#2f9e8f', t: 'Works offline', d: 'Smudge keeps a copy of itself on this phone, so it opens with no connection.', state: swReady ? ['Ready', 'good'] : sw ? ['After next open'] : ['Not here'] },
      { id: 'sight', ic: 'i-cam', col: '#ee8740', t: 'Sight', d: 'The camera is how Smudge finds colors. Only a small crop of each color you feed it is kept, on this phone.', state: cam },
      { id: 'touch', ic: 'i-touch', col: '#e4588d', t: 'Touch', d: Haptics.supported ? 'Taps you can feel when you poke, squish or feed Smudge.' : 'Taps you can feel. Works on iPhone.', toggle: ['haptics', S.s.haptics] },
      { id: 'balance', ic: 'i-tilt', col: '#45a866', t: 'Balance', d: 'Tilt to slide Smudge, shake it dizzy, lay the phone flat to make a puddle.', toggle: Motion.available() ? ['tilt', Motion.on] : null, state: Motion.available() ? null : ['Needs the Home Screen app'] },
      { id: 'hearing', ic: 'i-wave', col: '#8a58d4', t: 'Hearing', d: 'Hum and Smudge sings it back. Blow on it to puff it up. Nothing is recorded or sent.', toggle: Mic.available() ? ['listen', Mic.on] : null, state: Mic.available() ? null : ['Needs the Home Screen app'] },
      { id: 'voice', ic: 'i-speaker', col: '#3b8be0', t: 'Voice', d: 'audioSession' in navigator ? 'Babbles and squeaks. They follow your silent switch, and your music keeps playing.' : 'Babbles, squeaks and the bedtime lullaby.', toggle: ['sound', S.s.sound] },
      { id: 'glow', ic: 'i-moon', col: '#3e3a80', t: 'Nightlight', d: 'Tuck Smudge in and it glows and keeps the screen awake. Its lullaby shows on the Lock Screen.', toggle: ['glow', S.s.glow], state: Wake.supported ? null : ['Glow only'] },
      { id: 'badge', ic: 'i-badge', col: '#e0474c', t: 'Icon badge', d: 'The Home Screen icon counts the colors Smudge still wants today.', toggle: Badge.supported() && 'Notification' in window ? ['badge', S.s.badge && Badge.perm() === 'granted'] : null, state: Badge.supported() && 'Notification' in window ? null : ['Needs the Home Screen app'] },
      { id: 'sky', ic: 'i-horizon', col: '#dc9a2c', t: 'Real sky', d: place.exact ? 'The sun and moon follow your location. Smudge yawns after sunset.' : 'The sun and moon follow your time zone. Share your location for exact sunsets.', btn: place.exact ? ['Time zone', () => App.useLocation(false)] : (!ENV.framed && 'geolocation' in navigator ? ['Use location', () => App.useLocation(true)] : null) },
      { id: 'gamut', ic: 'i-gamut', col: 'conic-gradient(from 200deg, #ff3b6b, #ffb340, #3ddc84, #2fb7ff, #a35bff, #ff3b6b)', t: 'Wide color', d: ENV.p3screen ? 'Your screen shows Display P3, so Smudge can eat colors too vivid for a hex code.' : 'This screen shows standard sRGB color.', state: ENV.p3screen ? ['Display P3', 'good'] : ['sRGB'] },
      { id: 'memory', ic: 'i-box', col: '#6b6f86', t: 'Memory', d: `${S.meals.length} ${S.meals.length === 1 ? 'swatch' : 'swatches'} saved on this phone. Nothing is uploaded.`, state: persisted ? ['Kept safe', 'good'] : null },
    ];
    $('#senses-list').innerHTML = rows.map((r) => `
      <div class="sense" data-sense="${r.id}">
        <span class="sense-ic" style="--ic:${r.col}"><svg><use href="#${r.ic}"/></svg></span>
        <span><div class="sense-t">${r.t}</div><div class="sense-d">${r.d}</div></span>
        <span class="sense-ctl">${r.toggle ? `<input type="checkbox" switch id="sw-${r.toggle[0]}" data-toggle="${r.toggle[0]}" aria-label="${r.t}"${r.toggle[1] ? ' checked' : ''}>` : ''}${r.btn ? `<button type="button" class="pill-btn small" data-btn="${r.id}">${r.btn[0]}</button>` : ''}${r.state ? `<span class="sense-state${r.state[1] ? ' ' + r.state[1] : ''}">${r.state[0]}</span>` : ''}</span>
      </div>`).join('');
    rows.forEach((r) => { if (r.btn) $(`[data-btn="${r.id}"]`).addEventListener('click', r.btn[1]); });
  }
  $('#senses-list').addEventListener('change', async (e) => {
    const t = e.target.closest('[data-toggle]'); if (!t) return;
    const on = t.checked, k = t.dataset.toggle;
    if (k === 'haptics') { S.s.haptics = on; Store.save(); if (on) Haptics.tap(); }
    else if (k === 'sound') { Sound.toggle(on); if (on) Sound.play('boop'); }
    else if (k === 'glow') { S.s.glow = on; Store.save(); if (App.mode === 'sleep') on ? Wake.hold('sleep') : Wake.drop('sleep'); }
    else if (k === 'tilt') { if (on) { const r = await Motion.enable(); if (r !== 'granted') { t.checked = false; toast(r === 'denied' ? 'Motion access is off. Smudge will ask again next time you open it.' : 'Tilt isn’t available here'); } else { App.react('tiltOn'); } } else Motion.disable(); }
    else if (k === 'listen') { await App.toggleListen(on); t.checked = Mic.on; }
    else if (k === 'badge') { if (on) { const r = await Badge.enable(); if (r !== 'granted') { t.checked = false; toast(r === 'denied' ? 'Notifications are off for Smudge in Settings, so the badge can’t show' : 'Badges work once Smudge is on your Home Screen'); } else toast('The icon now shows colors left today'); } else Badge.disable(); }
  });
  $('#rename-input').addEventListener('change', (e) => {
    const v = e.target.value.trim().slice(0, 16);
    if (v && v !== S.name) { S.name = v; Store.save(); hud(); App.react('renamed'); }
    else e.target.value = S.name;
  });
  $('#rename-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });
  $('#reset').addEventListener('click', () => { $('#reset-confirm').hidden = false; $('#reset').hidden = true; });
  $('#reset-no').addEventListener('click', () => { $('#reset-confirm').hidden = true; $('#reset').hidden = false; });
  $('#reset-yes').addEventListener('click', () => { Store.reset(); location.reload(); });

  addEventListener('resize', () => setTimeout(measure, 50));
  setTimeout(measure, 0);
  return { measure, say, speaking, hush, setCraving, showThought, place, toast, hud, dots, pressed, openSheet, closeSheet, renderBook, openChip, renderSenses, get sheetOpen() { return !!current; } };
})();
