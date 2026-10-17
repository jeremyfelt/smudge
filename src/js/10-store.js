/* ============================================================
   Store: Smudge's memory (localStorage) + found-at photos (IndexedDB)
   ============================================================ */
const Store = (() => {
  const KEY = 'smudge.v1';
  const defaults = () => ({
    v: 1,
    name: 'Smudge',
    born: Date.now(),
    lastSeen: 0,
    visits: 0,
    n: 0,            // total colors ever eaten (chip numbers)
    meals: [],       // { id, n, t, day, p3:[r,g,b], name, fam, hex, lrv, wide, crave, src }
    pig: [],         // pigments inside the body: { p3, w, t }
    crave: null,     // current craving id
    s: { sound: true, haptics: true, tilt: false, badge: false, glow: true, loc: null },
    seen: {},        // one-time moments
  });
  let S = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const o = JSON.parse(raw); S = Object.assign(defaults(), o); S.s = Object.assign(defaults().s, o.s || {}); S.seen = o.seen || {}; }
  } catch (e) { /* private mode or blocked: run from memory */ }
  let timer = 0;
  function flush() { try { localStorage.setItem(KEY, JSON.stringify(S)); return true; } catch (e) { return false; } }
  function save() { clearTimeout(timer); timer = setTimeout(flush, 250); }
  function reset() { const fresh = defaults(); Object.keys(S).forEach((k) => delete S[k]); Object.assign(S, fresh); flush(); Crops.clear(); }

  const today = () => dayKey();
  const mealsOn = (k) => S.meals.filter((m) => m.day === k);
  const todays = () => mealsOn(today());
  function days() { const seen = new Set(); const out = []; for (let i = S.meals.length - 1; i >= 0; i--) { const d = S.meals[i].day; if (!seen.has(d)) { seen.add(d); out.push(d); } } return out; }
  return { get S() { return S; }, save, flush, reset, today, todays, mealsOn, days };
})();
const S = Store.S;

const Crops = (() => {
  let dbp = null;
  function db() {
    if (!dbp) dbp = new Promise((res, rej) => {
      try {
        const r = indexedDB.open('smudge', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('crops');
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      } catch (e) { rej(e); }
    });
    return dbp;
  }
  async function tx(mode, fn) {
    try {
      const d = await db();
      return await new Promise((res) => { const t = d.transaction('crops', mode); const out = fn(t.objectStore('crops')); t.oncomplete = () => res(out && 'result' in out ? out.result : true); t.onerror = () => res(null); t.onabort = () => res(null); });
    } catch (e) { return null; }
  }
  return {
    put: (k, v) => tx('readwrite', (s) => s.put(v, k)),
    get: (k) => tx('readonly', (s) => s.get(k)),
    clear: () => tx('readwrite', (s) => s.clear()),
  };
})();
