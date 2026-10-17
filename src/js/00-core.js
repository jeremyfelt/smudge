'use strict';
/* ============================================================
   Smudge — core: utilities, environment, color science, names
   ============================================================ */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const TAU = Math.PI * 2;
const wrapPi = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const nowS = () => performance.now() / 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function hash32(str) { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pad2 = (n) => String(n).padStart(2, '0');
const pad4 = (n) => String(n).padStart(4, '0');
const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const keyToDate = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const fmtTime = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const fmtDay = (k, opts = { weekday: 'short', month: 'short', day: 'numeric' }) => keyToDate(k).toLocaleDateString([], opts);

/* ---------- where are we running? ---------- */
const ENV = (() => {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let framed = false;
  try { framed = window.self !== window.top; } catch (e) { framed = true; }
  const mq = (q) => { try { return matchMedia(q).matches; } catch (e) { return false; } };
  const standalone = navigator.standalone === true || mq('(display-mode: standalone)') || mq('(display-mode: fullscreen)');
  let p3css = false;
  try { p3css = CSS.supports('color', 'color(display-p3 1 0 0)'); } catch (e) {}
  return {
    ios, framed, standalone, p3css,
    p3screen: mq('(color-gamut: p3)'),
    reduced: mq('(prefers-reduced-motion: reduce)'),
    coarse: mq('(pointer: coarse)'),
    android: /Android/.test(ua),
  };
})();

/* ---------- color science (Display P3 in, OKLab for thinking) ---------- */
const Color = (() => {
  const toLin = (c) => { const a = Math.abs(c); const v = a <= 0.04045 ? a / 12.92 : Math.pow((a + 0.055) / 1.055, 2.4); return c < 0 ? -v : v; };
  const toGam = (c) => { const a = Math.abs(c); const v = a <= 0.0031308 ? a * 12.92 : 1.055 * Math.pow(a, 1 / 2.4) - 0.055; return c < 0 ? -v : v; };
  const mul = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
  const P3_XYZ = [0.4865709486, 0.2656676932, 0.1982172852, 0.2289745641, 0.6917385218, 0.0792869141, 0, 0.0451133819, 1.0439443689];
  const XYZ_P3 = [2.4934969119, -0.9313836179, -0.4027107845, -0.8294889696, 1.7626640603, 0.0236246858, 0.0358458302, -0.0761723893, 0.956884524];
  const SRGB_XYZ = [0.4123907993, 0.3575843394, 0.1804807884, 0.2126390059, 0.7151686788, 0.0721923054, 0.0193308187, 0.1191947798, 0.9505321522];
  const XYZ_SRGB = [3.2409699419, -1.5373831776, -0.4986107603, -0.9692436363, 1.8759675015, 0.0415550574, 0.0556300797, -0.2039769589, 1.0569715142];
  function linToLab([r, g, b]) {
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
  }
  function labToLin([L, a, b]) {
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  }
  function make(p3) {
    p3 = p3.map((v) => clamp(v, 0, 1));
    const xyz = mul(P3_XYZ, p3.map(toLin));
    const lin = mul(XYZ_SRGB, xyz);
    return { p3, lin, lab: linToLab(lin), Y: xyz[1] };
  }
  const fromP3 = (r, g, b) => make([r, g, b]);
  function fromSrgb(r, g, b) { const xyz = mul(SRGB_XYZ, [r, g, b].map(toLin)); return make(mul(XYZ_P3, xyz).map(toGam)); }
  function fromHex(h) { h = h.replace('#', ''); const n = parseInt(h, 16); return fromSrgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255); }
  function fromLab(L, a, b) { const xyz = mul(SRGB_XYZ, labToLin([L, a, b])); return make(mul(XYZ_P3, xyz).map(toGam)); }
  const fromLch = (L, C, h) => fromLab(L, C * Math.cos((h * Math.PI) / 180), C * Math.sin((h * Math.PI) / 180));
  function lch(c) { const [L, a, b] = c.lab; let h = (Math.atan2(b, a) * 180) / Math.PI; if (h < 0) h += 360; return { L, C: Math.hypot(a, b), h }; }
  const inSrgb = (c) => c.lin.every((v) => v >= -0.002 && v <= 1.002);
  const rgb255 = (c) => c.lin.map((v) => Math.round(clamp(toGam(clamp(v, 0, 1)), 0, 1) * 255));
  const hex = (c) => '#' + rgb255(c).map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  const p3css = (c, a = 1) => { const [r, g, b] = c.p3; return `color(display-p3 ${r.toFixed(4)} ${g.toFixed(4)} ${b.toFixed(4)}${a < 1 ? ' / ' + Math.max(0, a).toFixed(3) : ''})`; };
  const rgbcss = (c, a = 1) => { const [r, g, b] = rgb255(c); return a < 1 ? `rgba(${r},${g},${b},${Math.max(0, a).toFixed(3)})` : `rgb(${r},${g},${b})`; };
  const css = (c, a = 1) => (ENV.p3css ? p3css(c, a) : rgbcss(c, a));
  const lrv = (c) => Math.round(clamp(c.Y, 0, 1) * 100);
  const dE = (a, b) => Math.hypot(a.lab[0] - b.lab[0], a.lab[1] - b.lab[1], a.lab[2] - b.lab[2]);
  function mix(cols, ws) {
    let L = 0, A = 0, B = 0, W = 0;
    cols.forEach((c, i) => { const w = ws ? ws[i] : 1; L += c.lab[0] * w; A += c.lab[1] * w; B += c.lab[2] * w; W += w; });
    return W > 0 ? fromLab(L / W, A / W, B / W) : cols[0];
  }
  const lerpC = (a, b, t) => fromLab(lerp(a.lab[0], b.lab[0], t), lerp(a.lab[1], b.lab[1], t), lerp(a.lab[2], b.lab[2], t));
  function tone(c, dL, cMul = 1) { const { L, C, h } = lch(c); return fromLch(clamp(L + dL, 0, 1), C * cMul, h); }
  const ink = (c) => (c.lab[0] > 0.7 ? '#221d4a' : '#ffffff');
  return { fromP3, fromSrgb, fromHex, fromLab, fromLch, lch, inSrgb, hex, rgb255, css, p3css, rgbcss, lrv, dE, mix, lerpC, tone, ink, toLin, toGam };
})();

/* ---------- color names: the paint-chip department ----------
   Each hue family has four lightness bands, each with [vivid, vivid, muted, muted]. */
const Names = (() => {
  const FAM = [
    ['rose', 350, 12], ['red', 12, 38], ['orange', 38, 68], ['amber', 68, 92], ['yellow', 92, 120], ['lime', 120, 138],
    ['green', 138, 158], ['jade', 158, 180], ['teal', 180, 212], ['azure', 212, 250], ['blue', 250, 282], ['violet', 282, 310],
    ['purple', 310, 336], ['berry', 336, 350],
  ];
  const BANDS = { def: [0.8, 0.64, 0.47], red: [0.72, 0.6, 0.45], yellow: [0.86, 0.7, 0.53], lime: [0.84, 0.68, 0.5], azure: [0.78, 0.6, 0.42], blue: [0.74, 0.56, 0.38], violet: [0.74, 0.56, 0.38], purple: [0.76, 0.6, 0.42] };
  const T = {
    rose: { light: ['Bubblegum', 'Peony', 'Ballet Slipper', 'Rose Water'], mid: ['Watermelon', 'Flamingo', 'Dusty Rose', 'Old Valentine'], deep: ['Raspberry', 'Lipstick', 'Rosewood', 'Faded Jam'], dark: ['Beetroot', 'Black Cherry', 'Mulberry Stain', 'Wine Cork'] },
    red: { light: ['Salmon', 'Shrimp Cocktail', 'Blush', 'Pink Grapefruit'], mid: ['Tomato', 'Fire Truck', 'Brick Dust', 'Rhubarb'], deep: ['Cherry', 'Stop Sign', 'Terracotta', 'Clay Pot'], dark: ['Oxblood', 'Pomegranate', 'Maroon', 'Cranberry Sauce'] },
    orange: { light: ['Peach Fuzz', 'Apricot', 'Sandcastle', 'Seashell'], mid: ['Tangerine', 'Traffic Cone', 'Caramel', 'Sunburn'], deep: ['Rust', 'Paprika', 'Cinnamon', 'Gingerbread'], dark: ['Burnt Toast', 'Cola', 'Cocoa', 'Coffee Bean'] },
    amber: { light: ['Butterscotch', 'Cantaloupe', 'Oat Milk', 'Biscuit'], mid: ['Marigold', 'Honey', 'Camel', 'Peanut Butter'], deep: ['Amber', 'Maple Syrup', 'Toffee', 'Cardboard'], dark: ['Bronze', 'Old Penny', 'Walnut', 'Wet Bark'] },
    yellow: { light: ['Lemon Sherbet', 'Banana', 'Custard', 'Vanilla'], mid: ['Mustard Seed', 'Sunflower', 'Straw Hat', 'Hay Bale'], deep: ['Olive', 'Pickled Pepper', 'Olive Oil', 'Khaki'], dark: ['Dark Olive', 'Old Brass', 'Army Coat', 'Mud Pie'] },
    lime: { light: ['Key Lime', 'Pear Drop', 'Celery', 'Pistachio Cream'], mid: ['Tennis Ball', 'Chartreuse', 'Pea Soup', 'Lichen'], deep: ['Lime Peel', 'Grasshopper', 'Pickle', 'Moss'], dark: ['Avocado Skin', 'Bog', 'Seaweed', 'Swamp'] },
    green: { light: ['Mint Gum', 'Spring Shoot', 'Sage', 'Celadon'], mid: ['Lawn', 'Clover', 'Fern', 'Basil'], deep: ['Shamrock', 'Leaf', 'Spinach', 'Thyme'], dark: ['Pine', 'Bottle Green', 'Forest Floor', 'Ivy'] },
    jade: { light: ['Peppermint', 'Sea Glass', 'Eucalyptus', 'Frosted Mint'], mid: ['Jade', 'Spearmint', 'Verdigris', 'Seafoam'], deep: ['Emerald', 'Malachite', 'Pond', 'Copper Patina'], dark: ['Deep Jungle', 'Rainforest', 'Conifer', 'Kelp'] },
    teal: { light: ['Swimming Pool', 'Aqua', 'Glacier', 'Duck Egg'], mid: ['Lagoon', 'Turquoise', 'Teal Tile', 'Tidepool'], deep: ['Peacock', 'Deep Lagoon', 'Spruce', 'Harbor'], dark: ['Abyss', 'Deep End', 'Stormy Sea', 'Mallard'] },
    azure: { light: ['Sky', 'Forget-me-not', 'Baby Blue', 'Morning Haze'], mid: ['Cerulean', 'Kite', 'Chambray', 'Faded Jeans'], deep: ['Lake', 'Deep Sky', 'Denim', 'Steel Blue'], dark: ['Night Swim', 'Deep Water', 'Navy Coat', 'Storm'] },
    blue: { light: ['Periwinkle', 'Hydrangea', 'Powder Blue', 'Cloud Shadow'], mid: ['Bluebird', 'Ballpoint', 'Slate Blue', 'Old Jeans'], deep: ['Ultramarine', 'Cobalt', 'Dusk Blue', 'Ink Smudge'], dark: ['Midnight', 'Sapphire', 'Navy', 'Deep Sea'] },
    violet: { light: ['Lilac', 'Wisteria', 'Lavender', 'Thistle'], mid: ['Crocus', 'Iris', 'Heather', 'Twilight'], deep: ['Violet', 'Grape Soda', 'Smoky Iris', 'Bruise'], dark: ['Indigo', 'Deep Violet', 'Night Plum', 'Aubergine Ink'] },
    purple: { light: ['Orchid Bloom', 'Cotton Candy', 'Mauve', 'Lilac Soap'], mid: ['Magenta', 'Fuchsia Pop', 'Dusty Orchid', 'Heather Bloom'], deep: ['Purple Crayon', 'Boysenberry', 'Plum', 'Damson'], dark: ['Eggplant', 'Blackberry', 'Aubergine', 'Fig'] },
    berry: { light: ['Pink Lemonade', 'Candy Floss', 'Rose Quartz', 'Peach Blossom'], mid: ['Hot Pink', 'Dragonfruit', 'Rosebud', 'Antique Pink'], deep: ['Raspberry Sorbet', 'Berry Pop', 'Raspberry Jam', 'Berry Smoothie'], dark: ['Mulberry', 'Sangria', 'Plum Wine', 'Beet Juice'] },
  };
  const ULTRA = { rose: 'Neon Rose', red: 'Siren Red', orange: 'Hazard Orange', amber: 'Safety Vest', yellow: 'Highlighter', lime: 'Glowstick', green: 'Laser Lime', jade: 'Electric Mint', teal: 'Pool Light', azure: 'Electric Sky', blue: 'Electric Blue', violet: 'Ultraviolet', purple: 'Hot Magenta', berry: 'Neon Pink' };
  // neutral bands (light→dark) × [plain, warm, cool]
  const NEUTRAL = [
    [['Paper', 'Cloud'], ['Milk', 'Eggshell'], ['Snow', 'Ice']],
    [['Fog', 'Chalk'], ['Linen', 'Oyster'], ['Frost', 'Moth Wing']],
    [['Pebble', 'Dust Bunny'], ['Mushroom', 'Sand Dollar'], ['Pigeon', 'Silver']],
    [['Concrete', 'Pencil'], ['Driftwood', 'Taupe'], ['Rain Cloud', 'Zinc']],
    [['Slate', 'Elephant'], ['Mole', 'Wet Sand'], ['Storm Cloud', 'Pewter']],
    [['Charcoal', 'Graphite'], ['Espresso', 'Bark'], ['Gunmetal', 'Thundercloud']],
    [['Ink', 'Licorice'], ['Black Coffee', 'Soot'], ['Black Cat', 'Midnight Ink']],
  ];
  const TIME = (d) => { const h = d.getHours(); return h >= 5 && h < 8 ? 'Dawn' : h < 11 && h >= 8 ? 'Morning' : h >= 11 && h < 14 ? 'Noon' : h >= 14 && h < 17 ? 'Afternoon' : h >= 17 && h < 20 ? 'Dusk' : 'Midnight'; };
  function family(h) { for (const [n, a, b] of FAM) { if (a < b ? h >= a && h < b : h >= a || h < b) return n; } return 'rose'; }
  function describe(c) {
    const { L, C, h } = Color.lch(c);
    const nT = L > 0.85 ? 0.02 : L > 0.35 ? 0.03 : 0.022;
    if (C < nT) {
      const lb = L >= 0.94 ? 0 : L >= 0.84 ? 1 : L >= 0.7 ? 2 : L >= 0.55 ? 3 : L >= 0.4 ? 4 : L >= 0.25 ? 5 : 6;
      const tint = C > 0.008 && h >= 40 && h < 110 ? 1 : C > 0.008 && h >= 190 && h < 300 ? 2 : 0;
      return { fam: 'neutral', band: lb, set: NEUTRAL[lb][tint], muted: true, L, C, h };
    }
    const fam = family(h);
    const th = BANDS[fam] || BANDS.def;
    const band = L >= th[0] ? 'light' : L >= th[1] ? 'mid' : L >= th[2] ? 'deep' : 'dark';
    const mT = band === 'light' ? (fam === 'yellow' ? 0.07 : 0.045) : band === 'dark' ? 0.065 : 0.09;
    return { fam, band, set: T[fam][band], muted: C < mT, ultra: C > 0.24, L, C, h };
  }
  function name(c, t = Date.now()) {
    const hx = Color.hex(c);
    const seed = hash32(hx + ':' + c.p3.map((v) => v.toFixed(3)).join(','));
    const d = describe(c);
    let base;
    if (d.fam === 'neutral') base = d.set[seed & 1];
    else if (d.ultra && (d.band === 'light' || d.band === 'mid' || d.band === 'deep')) base = ULTRA[d.fam];
    else base = d.set[(d.muted ? 2 : 0) + (seed & 1)];
    const wide = !Color.inSrgb(c);
    let prefix = '';
    if (wide && !/Neon|Electric|Ultra|Laser|Hazard|Siren|Glow|Highlighter|Safety|Hot /.test(base)) prefix = ['Electric', 'Neon', 'Super'][seed % 3];
    else if (!wide && !base.includes(' ') && (seed >>> 4) % 100 < 36) { const p = TIME(new Date(t)); if (!base.includes(p)) prefix = p; }
    return { name: prefix ? `${prefix} ${base}` : base, fam: d.fam, band: d.band, wide };
  }
  const FLAVOR = {
    rose: ['sweet!', 'like a strawberry cloud', 'mmm, candy'],
    red: ['spicy!', 'ooh, zingy', 'that one tastes loud'],
    orange: ['tangy!', 'like a warm orange slice', 'crunchy and sunny'],
    amber: ['honey-ish', 'toasty', 'tastes like four o’clock'],
    yellow: ['lemony!', 'tastes like sunshine', 'fizzy!'],
    lime: ['sour, in a good way', 'like a green apple', 'zippy!'],
    green: ['crunchy. leafy.', 'tastes like a lawn', 'very salad'],
    jade: ['minty', 'cool and fresh', 'like sea glass'],
    teal: ['like a swimming pool', 'cool!', 'splashy'],
    azure: ['tastes like sky', 'airy', 'breezy'],
    blue: ['brr. cold!', 'like a blueberry', 'deep and cool'],
    violet: ['dreamy', 'tastes like evening', 'soft and floaty'],
    purple: ['jammy', 'grape-ish', 'rich!'],
    berry: ['bubblegum!', 'so sweet', 'fizzy pink'],
  };
  function flavor(c) {
    const d = describe(c);
    if (!Color.inSrgb(c)) return 'whoa. that one barely fits in hex';
    if (d.fam === 'neutral') return d.band <= 1 ? pick(['fluffy', 'like eating a cloud', 'quiet and soft']) : d.band >= 5 ? pick(['chewy', 'midnight snack', 'mysterious']) : pick(['hmm. plain.', 'a bit like porridge', 'calm']);
    if ((d.fam === 'orange' || d.fam === 'amber') && (d.band === 'deep' || d.band === 'dark') && d.C < 0.13) return pick(['toasty', 'chocolatey', 'like a cookie']);
    if (d.band === 'dark') return pick(['chewy!', 'a midnight snack', 'deep flavor']);
    return pick(FLAVOR[d.fam] || ['yum']);
  }
  return { name, flavor, describe, family };
})();

/* ---------- cravings: what Smudge would love next ---------- */
const Cravings = [
  { id: 'red', word: 'red', h: 27, hw: 20, cmin: 0.12, show: [0.63, 0.2, 27] },
  { id: 'orange', word: 'orange', h: 55, hw: 16, cmin: 0.1, show: [0.75, 0.16, 55] },
  { id: 'yellow', word: 'yellow', h: 100, hw: 15, cmin: 0.09, lmin: 0.72, show: [0.9, 0.16, 100] },
  { id: 'green', word: 'leafy', h: 142, hw: 24, cmin: 0.07, show: [0.72, 0.16, 145] },
  { id: 'teal', word: 'teal', h: 196, hw: 20, cmin: 0.05, show: [0.74, 0.11, 196] },
  { id: 'blue', word: 'blue', h: 255, hw: 24, cmin: 0.07, show: [0.62, 0.15, 258] },
  { id: 'purple', word: 'purple', h: 305, hw: 22, cmin: 0.07, show: [0.6, 0.15, 305] },
  { id: 'pink', word: 'pink', h: 352, hw: 20, cmin: 0.06, lmin: 0.62, show: [0.8, 0.12, 352] },
  { id: 'dark', word: 'very dark', lmax: 0.3, show: [0.25, 0.025, 285] },
  { id: 'pale', word: 'almost white', lmin: 0.9, cmax: 0.04, show: [0.965, 0.012, 95] },
  { id: 'brown', word: 'brown', h: 62, hw: 24, lmin: 0.26, lmax: 0.6, cmin: 0.03, cmax: 0.14, show: [0.5, 0.085, 60] },
];
const Crave = {
  get: (id) => Cravings.find((c) => c.id === id),
  show: (cr) => Color.fromLch(...cr.show),
  label: (cr) => `something ${cr.word}`,
  score(cr, c) {
    const { L, C, h } = Color.lch(c);
    let s = 1;
    if (cr.h !== undefined) { const dh = Math.abs(((h - cr.h + 540) % 360) - 180); s *= 1 - smoothstep(cr.hw * 0.6, cr.hw * 1.7, dh); }
    if (cr.cmin !== undefined) s *= smoothstep(cr.cmin * 0.45, cr.cmin, C);
    if (cr.cmax !== undefined) s *= 1 - smoothstep(cr.cmax, cr.cmax * 1.7, C);
    if (cr.lmin !== undefined) s *= smoothstep(cr.lmin - 0.1, cr.lmin, L);
    if (cr.lmax !== undefined) s *= 1 - smoothstep(cr.lmax, cr.lmax + 0.1, L);
    return s;
  },
};
