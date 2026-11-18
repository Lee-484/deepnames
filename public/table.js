/* Deepnames 3D table: visuals, sound and the game-screen controller. */
(() => {
"use strict";
const $ = (s) => document.querySelector(s);
(() => {                                                  // procedural oak planks for the tabletop
  try {
    const W = 520, H = 520, c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
    x.fillStyle = "#3a2817"; x.fillRect(0, 0, W, H);
    const plank = 104;
    for (let p = 0; p < H / plank; p++) {
      const y0 = p * plank, tint = 0.85 + Math.random() * .3;
      x.fillStyle = `rgba(${Math.round(70 * tint)},${Math.round(48 * tint)},${Math.round(28 * tint)},.55)`; x.fillRect(0, y0, W, plank);
      for (let l = 0; l < 60; l++) {                       // grain lines with gentle waves and knots
        const y = y0 + Math.random() * plank, amp = 1 + Math.random() * 3, f = .004 + Math.random() * .01, ph = Math.random() * 6;
        x.beginPath();
        for (let px = 0; px <= W; px += 6) x.lineTo(px, y + Math.sin(px * f + ph) * amp + Math.sin(px * f * 3.1) * amp * .3);
        x.strokeStyle = Math.random() > .5 ? `rgba(20,12,6,${.12 + Math.random() * .22})` : `rgba(150,108,62,${.06 + Math.random() * .12})`;
        x.lineWidth = .5 + Math.random() * 1.4; x.stroke();
      }
      x.fillStyle = "rgba(10,6,3,.75)"; x.fillRect(0, y0, W, 1.5);                 // seam between planks
      x.fillStyle = "rgba(255,220,170,.06)"; x.fillRect(0, y0 + 1.5, W, 1);
    }
    document.documentElement.style.setProperty("--wood", `url(${c.toDataURL("image/jpeg", .85)})`);
  } catch {}
})();
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const G = (r, cls = "") => `<svg class="${cls}" viewBox="0 0 64 64" aria-hidden="true"><use href="#g-${r}"/></svg>`;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const TEAM = { E: "Ministry", A: "Authority" };
const EMBLEM = { E: "/emblems/ministry.png", A: "/emblems/authority.png" };
const emblem = (t, cls = "") => EMBLEM[t] ? `<img class="${cls}" src="${EMBLEM[t]}" alt="${TEAM[t]} emblem">` : G(t, cls);
const mark = (r, cls) => (r === "E" || r === "A") ? emblem(r, cls) : G(r, cls);
// ---------- sound ----------
let ac = null;
const audio = () => { if (!ac) try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } if (ac.state === "suspended") ac.resume(); return ac; };
function tone(f, d, { type = "sine", vol = .15, at = 0, to = null } = {}) { const c = audio(); if (!c) return; const t = c.currentTime + at, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + d); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g).connect(c.destination); o.start(t); o.stop(t + d + .05); }

// ---------- sound engine: layered synthesis through a stone-hall reverb and a master compressor ----------
let muted = false;
let volume = (() => { try { const v = parseFloat(localStorage.getItem("dn.volume")); return isNaN(v) ? .8 : Math.min(1, Math.max(0, v)); } catch { return .8; } })();
// Recorded sounds: Kenney "Casino Audio" and "RPG Audio" (CC0 1.0, kenney.nl)
const SAMPLE_FILES = {"beltHandle1": "/sounds/beltHandle1.mp3", "beltHandle2": "/sounds/beltHandle2.mp3", "bookClose": "/sounds/bookClose.mp3", "bookFlip1": "/sounds/bookFlip1.mp3", "bookFlip2": "/sounds/bookFlip2.mp3", "bookFlip3": "/sounds/bookFlip3.mp3", "bookOpen": "/sounds/bookOpen.mp3", "bookPlace1": "/sounds/bookPlace1.mp3", "bookPlace2": "/sounds/bookPlace2.mp3", "bookPlace3": "/sounds/bookPlace3.mp3", "card-fan-1": "/sounds/card-fan-1.mp3", "card-fan-2": "/sounds/card-fan-2.mp3", "card-place-1": "/sounds/card-place-1.mp3", "card-place-2": "/sounds/card-place-2.mp3", "card-place-3": "/sounds/card-place-3.mp3", "card-place-4": "/sounds/card-place-4.mp3", "card-shove-1": "/sounds/card-shove-1.mp3", "card-shove-2": "/sounds/card-shove-2.mp3", "card-shove-3": "/sounds/card-shove-3.mp3", "card-shove-4": "/sounds/card-shove-4.mp3", "card-shuffle": "/sounds/card-shuffle.mp3", "card-slide-1": "/sounds/card-slide-1.mp3", "card-slide-2": "/sounds/card-slide-2.mp3", "card-slide-3": "/sounds/card-slide-3.mp3", "card-slide-4": "/sounds/card-slide-4.mp3", "card-slide-5": "/sounds/card-slide-5.mp3", "cards-pack-open-1": "/sounds/cards-pack-open-1.mp3", "chip-lay-1": "/sounds/chip-lay-1.mp3", "chip-lay-2": "/sounds/chip-lay-2.mp3", "chip-lay-3": "/sounds/chip-lay-3.mp3", "chips-collide-1": "/sounds/chips-collide-1.mp3", "chips-collide-2": "/sounds/chips-collide-2.mp3", "chips-collide-3": "/sounds/chips-collide-3.mp3", "chips-handle-1": "/sounds/chips-handle-1.mp3", "chips-handle-2": "/sounds/chips-handle-2.mp3", "chips-handle-3": "/sounds/chips-handle-3.mp3", "chips-handle-5": "/sounds/chips-handle-5.mp3", "chips-stack-1": "/sounds/chips-stack-1.mp3", "chips-stack-2": "/sounds/chips-stack-2.mp3", "chips-stack-3": "/sounds/chips-stack-3.mp3", "chips-stack-5": "/sounds/chips-stack-5.mp3", "chop": "/sounds/chop.mp3", "cloth1": "/sounds/cloth1.mp3", "cloth2": "/sounds/cloth2.mp3", "cloth3": "/sounds/cloth3.mp3", "creak2": "/sounds/creak2.mp3", "creak3": "/sounds/creak3.mp3", "doorClose_2": "/sounds/doorClose_2.mp3", "doorClose_4": "/sounds/doorClose_4.mp3", "doorOpen_1": "/sounds/doorOpen_1.mp3", "doorOpen_2": "/sounds/doorOpen_2.mp3", "drawKnife1": "/sounds/drawKnife1.mp3", "dropLeather": "/sounds/dropLeather.mp3", "handleCoins": "/sounds/handleCoins.mp3", "handleCoins2": "/sounds/handleCoins2.mp3", "handleSmallLeather": "/sounds/handleSmallLeather.mp3", "metalClick": "/sounds/metalClick.mp3", "metalLatch": "/sounds/metalLatch.mp3", "metalPot1": "/sounds/metalPot1.mp3", "metalPot2": "/sounds/metalPot2.mp3"};
const SAMPLE_GROUPS = {"unmark": ["card-shove-1", "card-shove-2"], "dealcard": ["card-place-1", "card-place-2", "card-place-3", "card-place-4"], "snuff": ["chips-handle-2"], "mark:chip": ["chip-lay-1", "chip-lay-2", "chip-lay-3"], "mark:tap": ["card-place-2", "card-place-4"], "mark:click": ["metalClick"], "mark:leather": ["handleSmallLeather"], "flip:slide": ["card-slide-1", "card-slide-2", "card-slide-3", "card-slide-4"], "flip:fan": ["card-fan-1"], "flip:page": ["bookFlip2", "bookFlip3"], "flip:shove": ["card-shove-1", "card-shove-2", "card-shove-3"], "land:place": ["card-place-1", "card-place-2", "card-place-3", "card-place-4"], "land:slap": ["card-shove-4", "card-slide-5"], "land:book": ["bookPlace1", "bookPlace3"], "land:chip": ["chip-lay-2", "chip-lay-3"], "good:stack": ["chips-stack-1", "chips-stack-3", "chips-stack-5"], "good:coins": ["handleCoins2"], "good:collide": ["chips-collide-1", "chips-collide-2", "chips-collide-3"], "good:handful": ["chips-handle-1", "chips-handle-3"], "bad:door": ["doorClose_2", "doorClose_4"], "bad:pot": ["metalPot1", "metalPot2"], "bad:leather": ["dropLeather"], "bad:creak": ["creak2", "creak3"], "neutral:book": ["bookPlace1", "bookPlace2"], "neutral:leather": ["dropLeather"], "neutral:cloth": ["cloth2", "cloth3"], "neutral:chip": ["chip-lay-1"], "clue:close": ["bookClose"], "clue:chop": ["chop"], "clue:knife": ["drawKnife1"], "clue:latch": ["metalLatch"], "turn:page": ["bookFlip1", "bookFlip2"], "turn:open": ["bookOpen"], "turn:door": ["doorOpen_1", "doorOpen_2"], "turn:cloth": ["cloth1"], "press:latch": ["metalLatch"], "press:click": ["metalClick"], "press:belt": ["beltHandle1", "beltHandle2"], "press:door": ["doorClose_4"], "deal:deal": ["card-fan-2"], "deal:shuffle": ["card-shuffle"], "deal:pack": ["cards-pack-open-1"], "win:coins": ["handleCoins"], "win:chips": ["chips-handle-5", "chips-collide-3"], "win:both": ["handleCoins", "chips-stack-2"]};
const SOUND_OPTIONS = {"mark": [{"id": "chip", "label": "Poker chip set down"}, {"id": "tap", "label": "Card tapped on felt"}, {"id": "click", "label": "Small metal click"}, {"id": "leather", "label": "Leather pouch touch"}], "flip": [{"id": "slide", "label": "Card slid up"}, {"id": "fan", "label": "Quick card fan"}, {"id": "page", "label": "Page flick"}, {"id": "shove", "label": "Card pushed"}], "land": [{"id": "place", "label": "Card laid down"}, {"id": "slap", "label": "Card slapped down"}, {"id": "book", "label": "Book set down"}, {"id": "chip", "label": "Chip clack"}], "good": [{"id": "stack", "label": "Chips stacked"}, {"id": "coins", "label": "Coins in the hand"}, {"id": "collide", "label": "Chips clinking"}, {"id": "handful", "label": "Handful of chips"}], "bad": [{"id": "door", "label": "Heavy door slam"}, {"id": "pot", "label": "Iron pot clang"}, {"id": "leather", "label": "Dropped leather sack"}, {"id": "creak", "label": "Old wood creak"}], "neutral": [{"id": "book", "label": "Book set down"}, {"id": "leather", "label": "Dropped leather sack"}, {"id": "cloth", "label": "Cloth rustle"}, {"id": "chip", "label": "Single chip"}], "clue": [{"id": "close", "label": "Book shut"}, {"id": "chop", "label": "Blade into wood"}, {"id": "knife", "label": "Knife drawn"}, {"id": "latch", "label": "Latch thrown"}], "turn": [{"id": "page", "label": "Page turned"}, {"id": "open", "label": "Book opened"}, {"id": "door", "label": "Door opening"}, {"id": "cloth", "label": "Cloak swish"}], "press": [{"id": "latch", "label": "Metal latch"}, {"id": "click", "label": "Metal click"}, {"id": "belt", "label": "Belt buckle"}, {"id": "door", "label": "Door thud"}], "deal": [{"id": "deal", "label": "Fan, then cards dealt"}, {"id": "shuffle", "label": "Riffle shuffle"}, {"id": "pack", "label": "New pack opened"}], "win": [{"id": "coins", "label": "Purse of coins"}, {"id": "chips", "label": "Chips pushed in"}, {"id": "both", "label": "Coins and chips"}]};
const SOUND_LABELS = {"mark": "Suggesting a card", "flip": "Card flipping", "land": "Card landing", "good": "Your team's agent", "bad": "Other team's agent", "neutral": "Bystander", "clue": "New clue", "turn": "Turn change", "press": "End turn button", "deal": "Dealing", "win": "Victory"};
SOUND_OPTIONS.win = [
  { id: "melody", label: "Coin melody, then a purse poured out" },
  { id: "cascade", label: "Rising coin cascade" },
  { id: "chimes", label: "Chip chimes, then chips swept in" },
  { id: "purse", label: "Just the purse of coins" },
];
SOUND_OPTIONS.deal = [
  { id: "pack", label: "New pack opened, then cards dealt" },
  { id: "deal", label: "Fan, then cards dealt" },
  { id: "shuffle", label: "Riffle shuffle" },
];
SOUND_OPTIONS.doom = [
  { id: "abyss", label: "Abyss: iron boom, groan and rumble" },
  { id: "gate", label: "Gate: two iron slams in a vast hall" },
  { id: "toll", label: "Toll: a giant bell struck three times" },
  { id: "classic", label: "The original one" },
];
SOUND_LABELS.doom = "Vantablack Warrior";
SOUND_LABELS.unmark = "Unsuggesting a card";
Object.assign(SAMPLE_FILES, {"drawKnife2": "/sounds/drawKnife2.mp3", "drawKnife3": "/sounds/drawKnife3.mp3", "knifeSlice": "/sounds/knifeSlice.mp3", "knifeSlice2": "/sounds/knifeSlice2.mp3", "metalPot3": "/sounds/metalPot3.mp3", "doorClose_1": "/sounds/doorClose_1.mp3", "doorClose_3": "/sounds/doorClose_3.mp3", "dice-throw-1": "/sounds/dice-throw-1.mp3", "dice-throw-2": "/sounds/dice-throw-2.mp3", "die-throw-2": "/sounds/die-throw-2.mp3", "creak1": "/sounds/creak1.mp3", "chop": "/sounds/chop.mp3", "metalPot2": "/sounds/metalPot2.mp3", "metalLatch": "/sounds/metalLatch.mp3", "dropLeather": "/sounds/dropLeather.mp3", "metalPot1": "/sounds/metalPot1.mp3"});
// more choices for revealing the other team's agent
SOUND_OPTIONS.bad = [
  { id: "blade", label: "Blade drawn against you" },
  { id: "slash", label: "Knife slash" },
  { id: "dice", label: "Dice thrown: bad luck" },
  { id: "chop", label: "Heavy chop, then a sack drops" },
  { id: "slam", label: "Door slam and the latch falls" },
  { id: "curse", label: "Cursed creak over a low clang" },
];
{ const ordered = {}; for (const [k, v] of Object.entries(SOUND_OPTIONS)) { ordered[k] = v; if (k === "mark") ordered.unmark = [
    { id: "lift", label: "Click, lifted off (lower)" },
    { id: "chip", label: "Chip picked back up" },
    { id: "tap", label: "Soft card tap" },
    { id: "brush", label: "Leather brush" },
  ]; }
  for (const k of Object.keys(SOUND_OPTIONS)) delete SOUND_OPTIONS[k]; Object.assign(SOUND_OPTIONS, ordered); }
Object.assign(SAMPLE_GROUPS, { "unmark:lift": ["metalClick"], "unmark:chip": ["chip-lay-1", "chip-lay-3"], "unmark:tap": ["card-place-2"], "unmark:brush": ["handleSmallLeather"] });
// the picks you chose in the workshop are now the defaults
const DEFAULT_PICKS = { mark: "click", unmark: "brush", flip: "page", land: "book", good: "stack", bad: "pot", neutral: "leather", clue: "latch", turn: "page", press: "belt", deal: "pack", win: "cascade", doom: "classic" };
DEFAULT_PICKS.bad = "chop";
const soundPick = (() => { let saved = {}; try { saved = JSON.parse(localStorage.getItem('dn.sounds') || '{}'); } catch {}
  let v = null; try { v = localStorage.getItem("dn.sounds.v"); } catch {}
  if (v !== "5") { saved = {}; try { localStorage.setItem("dn.sounds.v", "5"); localStorage.removeItem("dn.sounds"); } catch {} }   // apply the chosen defaults once
  const p = {}; for (const m in SOUND_OPTIONS) { const ok = (id) => SOUND_OPTIONS[m].some((o) => o.id === id); p[m] = ok(saved[m]) ? saved[m] : ok(DEFAULT_PICKS[m]) ? DEFAULT_PICKS[m] : SOUND_OPTIONS[m][0].id; } return p; })();
const SFX = (() => {
  let c = null, bus, verbIn, nbuf, master; const bufs = {}, lastPick = {}, ready = {};
  function init() {
    if (c) return c;
    c = audio(); if (!c) return null;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = .004; comp.release.value = .25;
    master = c.createGain(); master.gain.value = .9 * volume; master.connect(comp); comp.connect(c.destination);
    bus = c.createGain(); bus.connect(master);
    const len = Math.floor(c.sampleRate * 2.6), ir = c.createBuffer(2, len, c.sampleRate);           // generated hall impulse
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.4) * (i < 400 ? i / 400 : 1); }
    const verb = c.createConvolver(); verb.buffer = ir;
    const damp = c.createBiquadFilter(); damp.type = "lowpass"; damp.frequency.value = 3800;
    verbIn = c.createGain(); verbIn.gain.value = .9; verbIn.connect(damp).connect(verb).connect(master);
    nbuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate); const nd = nbuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    for (const [name, url] of Object.entries(SAMPLE_FILES)) {
      ready[name] = fetch(url).then((r) => r.arrayBuffer()).then((ab) => new Promise((res) => c.decodeAudioData(ab, (buf) => { bufs[name] = buf; res(buf); }, () => res(null)))).catch(() => null);
    }
    return c;
  }
  const out = (node, wet) => { node.connect(bus); if (wet) { const s = c.createGain(); s.gain.value = wet; node.connect(s); s.connect(verbIn); } };
  function env(g, t, a, peak, d, hold = 0) { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.setValueAtTime(peak, t + a + hold); g.gain.exponentialRampToValueAtTime(.0001, t + a + hold + d); }
  function noise(t, dur, { type = "bandpass", f = 1000, f2 = null, q = 1, vol = .3, a = .004, wet = .15, hold = 0 } = {}) {
    const src = c.createBufferSource(); src.buffer = nbuf; src.playbackRate.value = .9 + Math.random() * .2;
    const fl = c.createBiquadFilter(); fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + a + hold + dur);
    const g = c.createGain(); env(g, t, a, vol, dur, hold);
    src.connect(fl).connect(g); out(g, wet); src.start(t, Math.random()); src.stop(t + a + hold + dur + .05);
  }
  function osc(t, f, dur, { type = "sine", vol = .2, a = .004, to = null, wet = .2, hold = 0, lp = null, detune = 0 } = {}) {
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune; if (to) o.frequency.exponentialRampToValueAtTime(to, t + a + hold + dur);
    const g = c.createGain(); env(g, t, a, vol, dur, hold);
    let n = o; if (lp) { const fl = c.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = lp; o.connect(fl); n = fl; }
    n.connect(g); out(g, wet); o.start(t); o.stop(t + a + hold + dur + .05);
  }
  function bell(t, f, vol = .15, dur = 2.2, wet = .5) {                 // inharmonic partials, like a struck metal bell
    [[1, 1], [2.01, .55], [2.76, .38], [5.4, .22], [8.93, .1]].forEach(([m, k], i) => osc(t, f * m, dur / (1 + i * .5), { vol: vol * k, a: .002, wet }));
  }
  function brass(t, f, dur, vol = .12, wet = .35) {                     // detuned saws through a closing low-pass
    for (const d of [-7, 0, 7]) {
      const o = c.createOscillator(); o.type = "sawtooth"; o.frequency.value = f; o.detune.value = d;
      const fl = c.createBiquadFilter(); fl.type = "lowpass"; fl.Q.value = 2; fl.frequency.setValueAtTime(300, t); fl.frequency.exponentialRampToValueAtTime(2400, t + .07); fl.frequency.exponentialRampToValueAtTime(700, t + dur);
      const g = c.createGain(); env(g, t, .03, vol / 3, dur);
      o.connect(fl).connect(g); out(g, wet); o.start(t); o.stop(t + dur + .1);
    }
  }
  // play one recording from a group: a different take each time, slightly varied in pitch and level
  function play(group, t, { vol = .8, rate = 1, wet = .18, offset = 0 } = {}) {
    if (SOUND_OPTIONS[group]) group = group + ":" + soundPick[group];
    const all = SAMPLE_GROUPS[group] || [];
    const list = all.filter((n) => bufs[n]);
    if (!list.length) {
      const n0 = all[Math.floor(Math.random() * all.length)];
      if (n0 && ready[n0]) ready[n0].then((buf) => {
        if (!buf) return;
        const src = c.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
        const g = c.createGain(); g.gain.value = vol; src.connect(g); out(g, wet); src.start(Math.max(c.currentTime, t), offset);
      });
      return !!n0;
    }
    let n = list[Math.floor(Math.random() * list.length)];
    if (list.length > 1 && n === lastPick[group]) n = list[(list.indexOf(n) + 1) % list.length];
    lastPick[group] = n;
    const src = c.createBufferSource(); src.buffer = bufs[n]; src.playbackRate.value = rate * (.96 + Math.random() * .08);
    const g = c.createGain(); g.gain.value = vol * (.88 + Math.random() * .2);
    src.connect(g); out(g, wet); src.start(t, offset); return true;
  }
  function pf(name, t, { vol = .8, rate = 1, wet = .25 } = {}) {
    const go = (buf) => { if (!buf) return; const src = c.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
      const g = c.createGain(); g.gain.value = vol; src.connect(g); out(g, wet); src.start(Math.max(c.currentTime, t)); };
    if (bufs[name]) go(bufs[name]); else if (ready[name]) ready[name].then(go);
  }
  const warm = () => { init(); if (c && c.state === "suspended") c.resume(); };
  const run = (fn) => { if (muted) return; if (!init()) return; try { fn(c.currentTime + .01); } catch {} };
  return {
    tick: (on) => run((t) => {
      if (on) { play("mark", t, { vol: .75, wet: .1 }); return; }
      const rate = { lift: .72, chip: 1.25, tap: 1.35, brush: 1 }[soundPick.unmark] || 1;
      play("unmark", t, { vol: .55, rate, wet: .1 });
    }),
    flip: () => run((t) => { play("flip", t, { vol: .8, rate: 1.05, wet: .12 }); }),
    land: (heavy) => run((t) => { play("land", t, { vol: 1, rate: heavy ? .8 : 1, wet: .2 }); }),
    good: () => run((t) => { play("good", t + .04, { vol: .9, wet: .22 }); }),
    bad: () => run((t) => {
      const pick = soundPick.bad, r = () => .96 + Math.random() * .08;
      if (pick === "pot") pf(Math.random() < .5 ? "metalPot1" : "metalPot2", t + .03, { vol: .9, rate: .92 * r(), wet: .3 });
      else if (pick === "potlow") pf("metalPot3", t + .03, { vol: .95, rate: .72 * r(), wet: .55 });
      else if (pick === "blade") pf(["drawKnife2", "drawKnife3"][Math.random() * 2 | 0], t + .02, { vol: .95, rate: .85 * r(), wet: .4 });
      else if (pick === "slash") pf(["knifeSlice", "knifeSlice2"][Math.random() * 2 | 0], t + .02, { vol: .95, rate: r(), wet: .3 });
      else if (pick === "dice") pf(["dice-throw-1", "dice-throw-2", "die-throw-2"][Math.random() * 3 | 0], t + .02, { vol: .95, rate: .9 * r(), wet: .3 });
      else if (pick === "chop") { pf("chop", t + .02, { vol: 1, rate: .75 * r(), wet: .35 }); pf("dropLeather", t + .16, { vol: .7, rate: .85, wet: .3 }); }
      else if (pick === "slam") { pf(["doorClose_1", "doorClose_3"][Math.random() * 2 | 0], t + .02, { vol: .95, rate: .9 * r(), wet: .4 }); pf("metalLatch", t + .16, { vol: .75, rate: .8, wet: .35 }); }
      else if (pick === "curse") { pf("creak1", t + .02, { vol: .85, rate: .8 * r(), wet: .5 }); pf("metalPot2", t + .05, { vol: .45, rate: .5, wet: .7 }); }
    }),
    neutral: () => run((t) => { play("neutral", t + .03, { vol: .85, wet: .2 }); }),
    // the Vantablack Warrior: a sub boom, a long dark rumble, a dissonant drone and a deep gong
    doomClassic: () => run((t) => {
      osc(t, 62, 2.6, { to: 26, vol: .55, wet: .3 }); noise(t, 3.2, { type: "lowpass", f: 260, f2: 90, vol: .42, a: .02, wet: .5 });
      for (const [f, d] of [[41, 0], [43.6, 0], [61.7, 6]]) osc(t + .1, f, 3.4, { type: "sawtooth", vol: .07, a: .5, lp: 320, detune: d, wet: .6 });
      bell(t + .05, 69, .22, 5, .7); noise(t, .25, { f: 1800, q: 1, vol: .3, wet: .4 });
    }),
    turn: () => run((t) => { play("turn", t, { vol: .9, wet: .28 }); }),
    clue: () => run((t) => { play("clue", t, { vol: 1, wet: .28 }); }),
    press: () => run((t) => { play("press", t, { vol: .95, wet: .15 }); }),
    snuff: () => run((t) => { play("snuff", t, { vol: .4, wet: .15 }); }),
    // called the instant the deal starts: each card lands ~0.77s after its own start, 70ms apart
    deal: () => run((t) => {
      const pick = soundPick.deal;
      if (pick === "pack") pf("cards-pack-open-1", t, { vol: .9, wet: .15 });
      else play("deal", t + .2, { vol: .75, wet: .15 });
      if (pick !== "shuffle") for (let k = 0; k < 20; k++) play("dealcard", t + .3 + k * .07, { vol: .5, rate: 1.1, wet: .1 });   // each card is down ~0.3s after it starts
    }),
    win: () => run((t) => {
      const N = [1, 1.26, 1.5, 2, 2.52];                    // C, E, G, C', E' as playback rates
      const pick = soundPick.win;
      if (pick === "melody") {
        [0, 1, 2, 3].forEach((n, k) => pf(["chip-lay-1", "chip-lay-2", "chip-lay-3", "chip-lay-2"][k], t + k * .13, { vol: .85, rate: N[n] * .9, wet: .45 }));
        pf("chips-collide-2", t + .52, { vol: .7, rate: 1.8, wet: .5 });
        pf("handleCoins", t + .62, { vol: .95, wet: .35 });
      } else if (pick === "cascade") {
        [0, 1, 2, 3, 4].forEach((n, k) => pf("handleCoins2", t + k * .16, { vol: .7 + k * .05, rate: N[n] * .85, wet: .45 }));
        pf("chips-stack-2", t + .82, { vol: .9, rate: 1.2, wet: .4 });
      } else if (pick === "chimes") {
        [0, 2, 1, 3].forEach((n, k) => pf("chips-collide-1", t + k * .15, { vol: .75, rate: N[n] * 1.4, wet: .55 }));
        pf("chips-handle-5", t + .65, { vol: .9, wet: .3 });
      } else pf("handleCoins", t, { vol: .95, wet: .3 });
    }),
    doom: () => {
      const pick = soundPick.doom;
      if (pick === "classic") return SFX.doomClassic();
      run((t) => {
        if (pick === "abyss") {
          pf("drawKnife1", t, { vol: .5, rate: .55, wet: .5 });                     // something unsheathed in the dark
          pf("doorClose_2", t + .08, { vol: 1, rate: .42, wet: .75 });             // a deep iron boom
          pf("metalPot1", t + .1, { vol: .55, rate: .32, wet: .85 });              // the ring of it, far below
          pf("creak2", t + .5, { vol: .6, rate: .45, wet: .7 });                  // a slow groan
          osc(t + .08, 48, 3, { to: 24, vol: .32, wet: .3 });                      // sub-bass you feel more than hear
          noise(t + .08, 3.2, { type: "lowpass", f: 220, f2: 70, vol: .28, a: .05, wet: .6 });
        } else if (pick === "gate") {
          pf("doorClose_4", t, { vol: 1, rate: .5, wet: .8 });
          pf("doorClose_2", t + .55, { vol: 1, rate: .38, wet: .85 });
          pf("metalLatch", t + .58, { vol: .6, rate: .45, wet: .8 });
          osc(t + .55, 44, 2.6, { to: 26, vol: .28, wet: .3 });
        } else if (pick === "toll") {
          [0, 1.1, 2.2].forEach((d, k) => { pf("metalPot2", t + d, { vol: .9 - k * .1, rate: .26, wet: .9 }); osc(t + d, 55, 1.6, { to: 40, vol: .18, wet: .4 }); });
        }
      });
    },
    // preview one option in the workshop
    audition: (moment, id) => run((t) => { const keep = soundPick[moment]; soundPick[moment] = id; if (moment === "deal" || moment === "win" || moment === "doom") { SFX[moment](); } else if (moment === "unmark") { SFX.tick(false); } else if (moment === "bad") { SFX.bad(); } else play(moment, t, { vol: .9, wet: .2 }); soundPick[moment] = keep; }),
    // the fuse: little crackles, faster when time is short
    warm: () => warm(),
    setVolume: (v) => { volume = v; if (master) master.gain.setTargetAtTime(.9 * v, c.currentTime, .03); },
    crackle: (hurry) => { if (!c || c.state !== "running" || muted) return; const t = c.currentTime; noise(t, .012 + Math.random() * .02, { f: 2500 + Math.random() * 3000, q: 3, vol: (hurry ? .1 : .055) * (.5 + Math.random()), wet: .05 }); },
  };
})();

window.SFX = SFX; window.SAMPLE_FILES = SAMPLE_FILES;
["pointerdown", "keydown", "touchstart"].forEach((ev) => document.addEventListener(ev, () => SFX.warm(), { capture: true, passive: true }));
(() => {
  const sl = document.getElementById("volSlider"), val = document.getElementById("volVal"), btn = document.getElementById("soundBtn") || document.createElement("i");
  const show = () => { const pct = Math.round(volume * 100); sl.value = pct; val.textContent = pct + "%"; sl.style.setProperty("--pct", pct + "%");
    const quiet = muted || volume === 0; btn.classList.toggle("off", quiet); btn.setAttribute("aria-pressed", !quiet); };
  show();
  sl.addEventListener("input", () => {
    volume = sl.value / 100; SFX.setVolume(volume); if (volume > 0 && muted) muted = false; show();
    try { localStorage.setItem("dn.volume", String(volume)); } catch {}
  });
  let t; sl.addEventListener("change", () => { clearTimeout(t); t = setTimeout(() => { audio(); SFX.tick(true); }, 30); });   // a sample at the new level
  window.__showVolume = show;
})();
function thud(vol = .4, freq = 140) { const c = audio(); if (!c) return; const n = Math.floor(c.sampleRate * .25), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3); const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); f.type = "lowpass"; f.frequency.value = freq * 3; g.gain.value = vol; s.buffer = b; s.connect(f).connect(g).connect(c.destination); s.start(); tone(freq, .3, { vol: vol * .5, to: freq * .5 }); }
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }
// ---------- waving cloth banners, drawn on canvas ----------
// The banner artwork (fabric, folds, embroidered emblem, braided trim, fringe) is painted
// once into an offscreen canvas, then redrawn every frame one row at a time with a
// travelling sideways ripple and matching light/shade, so it reads as one piece of cloth.
const SC = 5, PAD = 14, FR = 18;                    // FR: room below the cloth for the fringe
const FLAG_MODES = { real: { bw: 110, bh: 250, tokens: true }, huge: { bw: 270, bh: 640, tokens: false } };
let flagMode = "real", BW = 110, BH = 250;
const bannerState = {}, flashUntil = {}, artCanvas = {}, logoImg = {};
for (const t of ["E", "A"]) { logoImg[t] = new Image(); logoImg[t].onload = () => paintArt(t); logoImg[t].src = EMBLEM[t]; }
const weave = (() => {                               // fine woven-fabric noise
  const c = document.createElement("canvas"); c.width = c.height = 48; const x = c.getContext("2d");
  for (let i = 0; i < 48; i++) for (let j = 0; j < 48; j++) {
    const v = ((i % 2) ^ (j % 2)) ? 255 : 0; x.fillStyle = `rgba(${v},${v},${v},${(.04 + Math.random() * .06).toFixed(3)})`; x.fillRect(i, j, 1, 1);
  }
  return c;
})();
function shape(c, inset = 0) {
  c.beginPath(); c.moveTo(inset, inset); c.lineTo(BW - inset, inset); c.lineTo(BW - inset, BH * .82 - inset * .4);
  c.lineTo(BW / 2, BH - inset * 1.6); c.lineTo(inset, BH * .82 - inset * .4); c.closePath();
}
function applyFlagMode(mode) {
  flagMode = mode; ({ bw: BW, bh: BH } = FLAG_MODES[mode]);
  $("#canvas").classList.toggle("flags-huge", mode === "huge");
  for (const t of ["E", "A"]) {
    const cv = document.querySelector(`#flag${t} canvas.cloth`);
    cv.width = (BW + PAD * 2) * SC; cv.height = (BH + FR) * SC;
    cv.style.width = (BW + PAD * 2) + "px"; cv.style.height = (BH + FR) + "px";
    paintArt(t);
  }
}
function paintArt(t) {
  const st = bannerState[t]; if (!st) return;
  const cfg = FLAG_MODES[flagMode], k = BW / 110;    // k scales details for the huge flags
  const cv = artCanvas[t] || (artCanvas[t] = document.createElement("canvas"));
  cv.width = BW * SC; cv.height = (BH + FR) * SC;
  const c = cv.getContext("2d"); c.setTransform(SC, 0, 0, SC, 0, 0);
  const col = t === "E" ? ["#c4304a", "#8a1a2e", "#5a0e1c", "#3a0812"] : ["#3f7ccf", "#25549a", "#163564", "#0c2142"], glow = t === "E" ? "#ff6a80" : "#7fb4ff";
  shape(c); c.save(); c.clip();
  const g = c.createLinearGradient(0, 0, 0, BH); g.addColorStop(0, col[0]); g.addColorStop(.35, col[1]); g.addColorStop(.75, col[2]); g.addColorStop(1, col[3]);
  c.fillStyle = g; c.fillRect(0, 0, BW, BH);
  // drape: soft vertical folds hanging from the bar
  for (let f = 0; f < 5; f++) {
    const fx = BW * (f + .5) / 5, w = BW / 5;
    const fg = c.createLinearGradient(fx - w / 2, 0, fx + w / 2, 0);
    fg.addColorStop(0, "rgba(0,0,0,.18)"); fg.addColorStop(.45, "rgba(255,230,210,.07)"); fg.addColorStop(.55, "rgba(255,230,210,.09)"); fg.addColorStop(1, "rgba(0,0,0,.18)");
    c.fillStyle = fg; c.fillRect(fx - w / 2, 0, w, BH);
  }
  c.fillStyle = c.createPattern(weave, "repeat"); c.fillRect(0, 0, BW, BH);                           // woven fabric
  const sheen = c.createLinearGradient(0, 0, BW, BH); sheen.addColorStop(0, "rgba(255,255,255,.1)"); sheen.addColorStop(.5, "rgba(255,255,255,0)"); sheen.addColorStop(1, "rgba(0,0,0,.18)");
  c.fillStyle = sheen; c.fillRect(0, 0, BW, BH);
  c.restore();
  // braided gold trim
  c.lineJoin = "round";
  c.strokeStyle = "#5a3d16"; c.lineWidth = 3.6 * k; shape(c, 6 * k); c.stroke();
  c.strokeStyle = "#e7c47a"; c.lineWidth = 2.6 * k; shape(c, 6 * k); c.stroke();
  c.setLineDash([2.2 * k, 1.6 * k]); c.strokeStyle = "rgba(255,248,220,.85)"; c.lineWidth = 1.1 * k; shape(c, 6 * k); c.stroke(); c.setLineDash([]);
  c.strokeStyle = "rgba(40,20,6,.55)"; c.lineWidth = .8 * k; shape(c, 9.5 * k); c.stroke();
  // embroidered faction emblem: thread shadow, lit edge, then the stitched design
  const img = logoImg[t];
  if (img.complete && img.naturalWidth) {
    const h = cfg.tokens ? 84 : 150, w = h * img.naturalWidth / img.naturalHeight, ex = (BW - w) / 2, ey = cfg.tokens ? 40 : 60;
    c.save(); c.globalAlpha = .55; c.filter = "brightness(0)"; c.drawImage(img, ex + 1.4 * k, ey + 1.8 * k, w, h); c.restore();
    c.save(); c.globalAlpha = .35; c.filter = "brightness(2.2)"; c.drawImage(img, ex - .7 * k, ey - .7 * k, w, h); c.restore();
    c.save(); c.shadowColor = glow; c.shadowBlur = 10 * k; c.drawImage(img, ex, ey, w, h); c.restore();
  }
  c.textAlign = "center";
  if (cfg.tokens && false) {
    c.fillStyle = "#fff"; c.font = '400 46px "Fondamento", Georgia, serif';
    c.save(); c.shadowColor = glow; c.shadowBlur = 14; c.fillText(String(st.left), BW / 2, 126); c.restore();
    c.fillStyle = "#fff3d6"; c.font = '400 13px "Fondamento", Georgia, serif'; c.fillText(`of ${st.total} agents`, BW / 2, 143);
    const per = 4, size = 18, gap = 5, now = performance.now(), fl = flashUntil[t];
    for (let q = 0; q < st.total; q++) {
      const r = Math.floor(q / per), inRow = Math.min(per, st.total - r * per), i = q % per;
      const x = BW / 2 - (inRow * size + (inRow - 1) * gap) / 2 + i * (size + gap), y = 154 + r * (size + 6);
      const gone = q < st.total - st.left;
      c.save();
      c.beginPath(); c.arc(x + size / 2, y + size / 2, size / 2 + 2, 0, 7);
      c.fillStyle = gone ? "rgba(10,6,4,.7)" : "rgba(0,0,0,.35)"; c.fill();
      c.strokeStyle = gone ? "rgba(140,110,60,.5)" : "rgba(241,211,143,.85)"; c.lineWidth = 1.2; c.stroke();
      if (!gone) { c.shadowColor = glow; c.shadowBlur = 8; }
      c.globalAlpha = gone ? .22 : 1;
      if (img.complete && img.naturalWidth) { const h = size - 3, w = h * img.naturalWidth / img.naturalHeight; c.drawImage(img, x + (size - w) / 2, y + 1.5, w, h); }
      c.restore();
      if (fl && fl.k === q && now < fl.until) {
        const a = (fl.until - now) / 900;
        c.save(); c.globalAlpha = a; c.fillStyle = "#fff6d0"; c.shadowColor = glow; c.shadowBlur = 20;
        c.beginPath(); c.arc(x + size / 2, y + size / 2, size / 2 + 6 * (1 - a), 0, 7); c.fill(); c.restore();
      }
    }
  } else {
    c.fillStyle = "#f6e3b0"; c.font = `400 ${Math.round(40 * k / 2.2)}px "Fondamento", Georgia, serif`;
    c.save(); c.shadowColor = "rgba(0,0,0,.8)"; c.shadowOffsetY = 2; c.shadowBlur = 4; c.fillText(TEAM[t], BW / 2, 60 + 150 + 70); c.restore();
  }
  // gold fringe along the two lower edges, with tassels at the points
  const pts = [[0, BH * .82], [BW / 2, BH], [BW, BH * .82]];
  c.lineCap = "round";
  for (let seg = 0; seg < 2; seg++) {
    const [ax, ay] = pts[seg], [bx, by] = pts[seg + 1], n = Math.round(22 * k);
    for (let i = 0; i <= n; i++) {
      const u = i / n, x = ax + (bx - ax) * u, y = ay + (by - ay) * u - 2 * k, len = (7 + Math.sin(i * 1.7) * 1.5) * k;
      c.strokeStyle = i % 2 ? "#e7c47a" : "#b68e4a"; c.lineWidth = .9 * k;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + .6 * k, y + len); c.stroke();
    }
  }
  for (const [x, y] of pts) {                                                                           // tassels
    c.fillStyle = "#8a6428"; c.beginPath(); c.arc(x, y + 1 * k, 3.2 * k, 0, 7); c.fill();
    const tg = c.createLinearGradient(x - 3 * k, 0, x + 3 * k, 0); tg.addColorStop(0, "#8a6428"); tg.addColorStop(.5, "#fff0c4"); tg.addColorStop(1, "#8a6428");
    c.fillStyle = tg; c.beginPath(); c.moveTo(x - 3 * k, y + 3 * k); c.lineTo(x + 3 * k, y + 3 * k); c.lineTo(x + 4 * k, y + 14 * k); c.lineTo(x - 4 * k, y + 14 * k); c.closePath(); c.fill();
  }
}
function waveBanners(time) {
  const t = time / 1000, k = BW / 110;
  for (const team of ["E", "A"]) {
    const art = artCanvas[team]; if (!art) continue;
    if (flashUntil[team] && performance.now() < flashUntil[team].until) paintArt(team);
    const cv = document.querySelector(`#flag${team} canvas.cloth`), c = cv.getContext("2d");
    c.clearRect(0, 0, cv.width, cv.height);
    const W = BW * SC, H = (BH + FR) * SC, phase = team === "E" ? 0 : 1.7, freq = .018 / k, speed = flagMode === "huge" ? 1.3 : 2.1;
    for (let y = 0; y < H; y += 4) {
      const f = Math.min(1, y / (BH * SC));
      const dx = (Math.sin(y * freq - t * speed + phase) * 4.5 * f + Math.sin(t * .55 + phase) * 3 * f * f) * SC * k;
      c.drawImage(art, 0, y, W, 4, PAD * SC + dx, y, W, 4);
    }
    // light and shade follow the same ripple: faces turned to the light brighten, folds darken
    c.save(); c.globalCompositeOperation = "source-atop";
    for (let y = 0; y < H; y += 8) {
      const f = Math.min(1, y / (BH * SC)), slope = Math.cos(y * freq - t * speed + phase) * f;
      c.fillStyle = slope > 0 ? `rgba(255,236,210,${(slope * .1).toFixed(3)})` : `rgba(0,0,0,${(-slope * .24).toFixed(3)})`;
      c.fillRect(0, y, cv.width, 8);
    }
    c.restore();
    if (team === turn) {
      const cyc = (t % 5.5) / 5.5, by = -H * .4 + cyc * H * 1.8;
      const g = c.createLinearGradient(0, by - H * .18, 0, by + H * .18);
      g.addColorStop(0, "rgba(255,240,210,0)"); g.addColorStop(.5, "rgba(255,244,220,.22)"); g.addColorStop(1, "rgba(255,240,210,0)");
      c.save(); c.globalCompositeOperation = "source-atop"; c.fillStyle = g; c.fillRect(0, 0, cv.width, H); c.restore();
    }
  }
}
// agent counters on the team portraits (used with the huge flags)
function renderAgents() {
  for (const t of ["E", "A"]) {
    const st = bannerState[t]; if (!st) continue;
    $(`#agents${t}`).innerHTML = `<b>${st.left}</b><small>of ${st.total}</small>` +
      Array.from({ length: st.total }, (_, q) => `<i class="${q < st.total - st.left ? "gone" : ""}"><img src="${EMBLEM[t]}" alt=""></i>`).join("");
  }
}
// ---------- fuse around the table rim ----------
// A real three-strand laid rope: a detailed seamless tile is painted once, then mapped
// slice by slice along the rim path into an offscreen canvas. Each frame shows that
// rope and erases the burnt length, so the rope simply disappears behind the flame.
let timerSecs = 0, fuseStart = performance.now();
const TW = 1060, TH = 680;
const rimPath = document.getElementById("rimPath"), ropeLen = rimPath.getTotalLength();
const ropecv = document.getElementById("ropecv"), rc = ropecv.getContext("2d"), flameEl = document.getElementById("fuseflame");
rc.setTransform(2, 0, 0, 2, 0, 0);
const PTS = [];
for (let d = 0; d <= ropeLen; d += 1.5) {
  const a = rimPath.getPointAtLength(d), b = rimPath.getPointAtLength(Math.min(ropeLen, d + 1));
  const ang = Math.atan2(b.y - a.y, b.x - a.x) || 0;
  // real rope never lies perfectly straight: a gentle, uneven sideways wander
  const o = Math.sin(d * .041) * .9 + Math.sin(d * .013 + 1.1) * 1.5 + Math.sin(d * .0072 + 2.3) * 1.1;
  PTS.push({ d, x: a.x - Math.sin(ang) * o, y: a.y + Math.cos(ang) * o, ang });
}
const RL = 26, RT = 15, RS = 6;                     // tile length, rope thickness, tile detail scale
function ropeTile() {
  const t = document.createElement("canvas"); t.width = RL * RS; t.height = RT * RS;
  const c = t.getContext("2d"); c.scale(RS, RS);
  c.fillStyle = "#2b1a08"; c.fillRect(0, 0, RL, RT);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const P = RL / 3, slant = RT * .72;               // three strands per twist
  const tones = [["#8a6838", "#dcc08c", "#cfae74"], ["#80602f", "#d2b37c", "#c3a066"], ["#94713e", "#e4c995", "#d4b47c"]];
  for (let k = -3; k <= 5; k++) {
    const x0 = k * P, tn = tones[((k % 3) + 3) % 3];
    // strand body: a slanted band, round-shaded across its width, each strand a slightly different hemp tone
    const ax = x0, bx = x0 + slant, w = P * .98;
    const g = c.createLinearGradient(ax, 0, ax + w, 0);
    g.addColorStop(0, "#2a1808"); g.addColorStop(.16, tn[0]); g.addColorStop(.42, tn[1]); g.addColorStop(.6, tn[2]); g.addColorStop(.84, "#5e4019"); g.addColorStop(1, "#22140a");
    c.save(); c.beginPath(); c.moveTo(ax, 0); c.lineTo(ax + w, 0); c.lineTo(bx + w, RT); c.lineTo(bx, RT); c.closePath(); c.clip();
    c.setTransform(RS, 0, (slant / RT) * RS, RS, 0, 0);  // shear the gradient along the strand
    c.fillStyle = g; c.fillRect(ax - RL, 0, RL * 3, RT);
    c.setTransform(RS, 0, 0, RS, 0, 0);
    // fibres running along the strand
    for (let f = 0; f < 14; f++) {
      const fx = ax + rnd() * w, len = 3 + rnd() * 6, fy = rnd() * RT;
      c.beginPath(); c.moveTo(fx + (fy / RT) * slant, fy); c.lineTo(fx + ((fy + len) / RT) * slant + .3, fy + len);
      c.strokeStyle = rnd() > .5 ? `rgba(255,236,190,${.15 + rnd() * .25})` : `rgba(40,22,6,${.2 + rnd() * .3})`; c.lineWidth = .18 + rnd() * .2; c.stroke();
    }
    c.restore();
    // ridge highlight down the middle of the strand
    c.save(); c.filter = "blur(.35px)"; c.beginPath(); c.moveTo(ax + w * .42, 0); c.lineTo(bx + w * .42, RT);
    c.strokeStyle = "rgba(255,244,215,.38)"; c.lineWidth = .7; c.stroke(); c.restore();
    // the groove where two strands meet: deep shadow, with a lit lip on the next strand
    c.save(); c.filter = "blur(.45px)"; c.beginPath(); c.moveTo(ax, 0); c.lineTo(bx, RT); c.strokeStyle = "rgba(14,7,1,.92)"; c.lineWidth = 1.5; c.stroke(); c.restore();
    c.beginPath(); c.moveTo(ax + .9, 0); c.lineTo(bx + .9, RT); c.strokeStyle = "rgba(255,230,180,.18)"; c.lineWidth = .35; c.stroke();
  }
  // round cord shading: lit from above, darker underneath, soft rim light on the top edge
  const v = c.createLinearGradient(0, 0, 0, RT);
  v.addColorStop(0, "rgba(0,0,0,.55)"); v.addColorStop(.12, "rgba(255,238,200,.16)"); v.addColorStop(.3, "rgba(255,238,200,.06)");
  v.addColorStop(.55, "rgba(0,0,0,0)"); v.addColorStop(.8, "rgba(0,0,0,.3)"); v.addColorStop(1, "rgba(0,0,0,.75)");
  c.fillStyle = v; c.fillRect(0, 0, RL, RT);
  // stray hairs sticking out of the edges
  for (let h = 0; h < 6; h++) { const hx = rnd() * RL, top = rnd() > .5; c.beginPath(); c.moveTo(hx, top ? .6 : RT - .6); c.quadraticCurveTo(hx + 1, top ? -.6 : RT + .6, hx + 2.2, top ? -.2 : RT + .2); c.strokeStyle = "rgba(200,160,100,.5)"; c.lineWidth = .15; c.stroke(); }
  return t;
}
const ropeFull = document.createElement("canvas"); ropeFull.width = TW * 2; ropeFull.height = TH * 2;
(function paintRope() {
  const c = ropeFull.getContext("2d"), tile = ropeTile(); c.setTransform(2, 0, 0, 2, 0, 0);
  // shadows: a soft cast shadow, then a tight dark contact line where the rope touches the table
  c.save(); c.translate(2.5, 6); c.filter = "blur(4px)"; c.beginPath(); PTS.forEach((p, k) => k ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y));
  c.strokeStyle = "rgba(0,0,0,.55)"; c.lineWidth = RT + 4; c.lineJoin = "round"; c.stroke(); c.restore();
  c.save(); c.translate(.8, 2.2); c.filter = "blur(1.2px)"; c.beginPath(); PTS.forEach((p, k) => k ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y));
  c.strokeStyle = "rgba(0,0,0,.7)"; c.lineWidth = RT - 2; c.lineJoin = "round"; c.stroke(); c.restore();
  // map the tile along the path, one thin slice at a time
  for (const p of PTS) {
    const u = (p.d % RL) / RL * tile.width;
    c.save(); c.translate(p.x, p.y); c.rotate(p.ang);
    c.drawImage(tile, u, 0, Math.min(1.9 * RS, tile.width - u), tile.height, -.2, -RT / 2, 1.9, RT);
    c.restore();
  }
  // both ends: whipped with dark twine, then a frayed tuft of loose fibres
  const endCap = (p, dir) => {
    c.save(); c.translate(p.x, p.y); c.rotate(p.ang + (dir < 0 ? Math.PI : 0));
    for (let w = 0; w < 4; w++) {
      const x = -4 - w * 2.2;
      const g = c.createLinearGradient(0, -RT / 2, 0, RT / 2); g.addColorStop(0, "#1a0f06"); g.addColorStop(.35, "#5a3a1a"); g.addColorStop(1, "#120a04");
      c.fillStyle = g; c.fillRect(x, -RT / 2 - .4, 1.7, RT + .8);
    }
    for (let f = 0; f < 34; f++) {
      const y = (Math.random() - .5) * (RT - 2), len = 4 + Math.random() * 7, spread = (Math.random() - .5) * 1.2;
      c.beginPath(); c.moveTo(-1, y); c.quadraticCurveTo(len * .5, y + spread * 3, len, y + spread * 6);
      c.strokeStyle = Math.random() > .4 ? `rgba(225,195,140,${.55 + Math.random() * .4})` : "rgba(120,86,40,.8)"; c.lineWidth = .35 + Math.random() * .35; c.stroke();
    }
    c.restore();
  };
  endCap(PTS[0], -1); endCap(PTS[PTS.length - 1], 1);
})();
function resetFuse() {
  fuseStart = performance.now(); burnFuse.done = false;
  ropecv.classList.toggle("off", !timerSecs); flameEl.classList.toggle("off", !timerSecs);
}
function drawRope(burned, now) {
  rc.clearRect(0, 0, TW, TH);
  rc.drawImage(ropeFull, 0, 0, TW, TH);
  if (burned > 0) {                                  // the burnt length is simply gone
    rc.save(); rc.globalCompositeOperation = "destination-out"; rc.lineCap = "butt"; rc.lineJoin = "round"; rc.lineWidth = RT + 14;
    rc.beginPath(); let started = false;
    for (const p of PTS) { if (p.d > burned) break; started ? rc.lineTo(p.x, p.y) : rc.moveTo(p.x, p.y); started = true; }
    rc.stroke(); rc.restore();
  }
  // glowing, blackened tip right at the flame
  const tip = PTS.find((p) => p.d >= burned) || PTS[PTS.length - 1];
  const fl = .8 + .2 * Math.sin(now / 45);
  rc.save(); rc.translate(tip.x, tip.y); rc.rotate(tip.ang);
  const g = rc.createLinearGradient(0, 0, 9, 0);
  g.addColorStop(0, `rgba(255,${Math.round(190 * fl)},60,1)`); g.addColorStop(.35, "rgba(255,90,20,.9)"); g.addColorStop(.7, "rgba(40,18,8,.95)"); g.addColorStop(1, "rgba(40,18,8,0)");
  rc.fillStyle = g; rc.shadowColor = "rgba(255,120,30,.9)"; rc.shadowBlur = 14; rc.beginPath(); rc.ellipse(3, 0, 6.5, RT / 2 + .5, 0, 0, Math.PI * 2); rc.fill();
  rc.restore();
}

// Fire: additive particles that rise, cool from white to yellow to orange to deep red, and fade into smoke.
const fcv = document.getElementById("firecv"), fx = fcv.getContext("2d"), FW = 160, FH = 220, BX = 80, BY = 205;
fx.scale(2, 2);
let flames = [], smoke = [], sparks = [], lastFire = 0;
function stepFire(now, hurry) {
  const dt = Math.min(50, now - (lastFire || now)) / 16.7; lastFire = now;
  const rate = hurry ? 16 : 11;
  for (let k = 0; k < rate * dt; k++) {
    // a burning rope end: a wide, ragged base that tapers into licking tongues
    const off = (Math.random() - .5) * 22;
    flames.push({ x: BX + off, y: BY - Math.random() * 4, vx: (Math.random() - .5) * .6 - off * .01, vy: -(.9 + Math.random() * 1.6) * (hurry ? 1.25 : 1),
      r: 7 + Math.random() * 9, life: 0, max: 18 + Math.random() * 26, hot: Math.random() });
  }
  if (Math.random() < .35 * dt) smoke.push({ x: BX + (Math.random() - .5) * 6, y: BY - 34, vx: (Math.random() - .2) * .4, vy: -.7 - Math.random() * .5, r: 5, life: 0, max: 70 + Math.random() * 40 });
  if (Math.random() < (hurry ? .5 : .22) * dt) sparks.push({ x: BX, y: BY - 6, vx: (Math.random() - .5) * 2.4, vy: -2.5 - Math.random() * 2.8, life: 0, max: 30 + Math.random() * 30 });
  fx.clearRect(0, 0, FW, FH);
  // smoke (normal blending, behind the flame)
  smoke = smoke.filter((p) => (p.life += dt) < p.max);
  for (const p of smoke) {
    p.x += p.vx * dt + Math.sin((now / 400) + p.y * .05) * .2; p.y += p.vy * dt; p.r += .25 * dt;
    const a = .16 * (1 - p.life / p.max);
    const g = fx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r); g.addColorStop(0, `rgba(90,82,76,${a})`); g.addColorStop(1, "rgba(90,82,76,0)");
    fx.fillStyle = g; fx.beginPath(); fx.arc(p.x, p.y, p.r, 0, 7); fx.fill();
  }
  // warm light pooled under the flame
  const pool = fx.createRadialGradient(BX, BY, 0, BX, BY, 46); pool.addColorStop(0, "rgba(255,150,50,.45)"); pool.addColorStop(1, "rgba(255,120,30,0)");
  fx.fillStyle = pool; fx.beginPath(); fx.ellipse(BX, BY, 46, 18, 0, 0, 7); fx.fill();
  fx.globalCompositeOperation = "lighter";
  flames = flames.filter((p) => (p.life += dt) < p.max);
  for (const p of flames) {
    const t = p.life / p.max;
    p.vx += (BX - p.x) * .008 * dt + Math.sin(now / 140 + p.y * .11 + p.hot * 6) * .09;  // drawn inward into tongues, with turbulent sway
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy *= .995;
    const r = p.r * (1 - t * .8);
    let col;
    if (t < .07 && p.hot > .5) col = [255, 245, 215]; else if (t < .25) col = [255, 196, 80]; else if (t < .5) col = [255, 124, 30]; else if (t < .75) col = [214, 62, 14]; else col = [120, 28, 8];
    const a = (t < .1 ? t / .1 : 1) * (1 - t) * .5;
    const g = fx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    g.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${a})`); g.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
    fx.fillStyle = g; fx.beginPath(); fx.arc(p.x, p.y, r, 0, 7); fx.fill();
  }
  // blue root where the flame meets the rope
  const blue = fx.createRadialGradient(BX, BY - 2, 0, BX, BY - 2, 7); blue.addColorStop(0, "rgba(120,170,255,.55)"); blue.addColorStop(1, "rgba(60,100,255,0)");
  fx.fillStyle = blue; fx.beginPath(); fx.ellipse(BX, BY - 2, 7, 4, 0, 0, 7); fx.fill();
  sparks = sparks.filter((p) => (p.life += dt) < p.max);
  for (const p of sparks) {
    p.vy += .06 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    fx.fillStyle = `rgba(255,${200 - p.life * 2 | 0},90,${1 - p.life / p.max})`; fx.beginPath(); fx.arc(p.x, p.y, .9, 0, 7); fx.fill();
  }
  fx.globalCompositeOperation = "source-over";
}
const m = document.createElement("canvas").getContext("2d");
function fit() {
  m.font = '400 100px "Fondamento", Georgia, serif';
  document.querySelectorAll("#grid .word").forEach((el) => {
    const W = 166 * .82, H = 110 * .74;
    const parts = el.textContent.split(/\s+/), unit = parts.map((t) => m.measureText(t).width / 100), sp = m.measureText(" ").width / 100;
    let size = Math.min(26, W / Math.max(...unit) * .97);
    const lines = (s) => { let n = 1, line = 0; for (const u of unit) { const w = u * s; if (line && line + sp * s + w > W) { n++; line = w; } else line += (line ? sp * s : 0) + w; } return n; };
    while (size > 10 && lines(size) * size * 1.08 > H) size -= .5;
    el.style.fontSize = size.toFixed(1) + "px";
  });
}
// ===================== controller: the real multiplayer game drives the 3D table =====================
let turn = "E";
let ST = null, PREV = null, API = null;     // latest server snapshot, previous one, and the app's helpers
let boardId = null, victoryFor = null, seenLog = 0, clueKey = null, pickedN = null, confirmAction = null;
const TEAMN = TEAM;

const gEl = () => ST && ST.game;
const meP = () => (ST && ST.players.find((p) => p.id === ST.you)) || { id: ST && ST.you, team: null, role: "op", name: "" };
const byId = (id) => ST.players.find((p) => p.id === id);
const host = () => ST && ST.hostId === ST.you;
const canGuessNow = () => { const g = gEl(), m = meP(); return !!g && g.phase === "guess" && m.team === g.turn && m.role === "op"; };
const isSpyNow = () => { const g = gEl(), m = meP(); return !!g && g.phase !== "over" && !!m.team && m.role === "spy"; };

// ---------- scaling: fit the 1280x820 scene inside the window ----------
function scaleStage() {
  const w = innerWidth, h = innerHeight, s = Math.min(w / 1280, h / 820);
  const c = $("#canvas");
  c.style.setProperty("--s", s);
  c.style.setProperty("--ox", ((w - 1280 * s) / 2).toFixed(1) + "px");
  c.style.setProperty("--oy", ((h - 820 * s) / 2).toFixed(1) + "px");
}
addEventListener("resize", () => { scaleStage(); });

// ---------- board ----------
function slotHTML(w, i, role, rev) {
  return `<div class="slot ${rev ? "rev" : ""}" ${role ? `data-role="${role}"` : ""} data-i="${i}" style="--i:${i};--dx:${(Math.random() * 300 - 150).toFixed(0)}px;--dy:${(260 + Math.random() * 200).toFixed(0)}px;--rz:${(Math.random() * 60 - 30).toFixed(0)}deg">
      <div class="well"></div><div class="shadow"></div>
      <button type="button" class="tile" aria-label="${esc(w)}">
        <span class="layer l7"></span><span class="layer l6"></span><span class="layer l5"></span><span class="layer l4"></span><span class="layer l3"></span><span class="layer l2"></span><span class="layer l1"></span>
        <span class="face front"><span class="plate"><span class="kgw">${role ? mark(role, "kg") : ""}</span><span class="word">${esc(w)}</span></span></span>
        <span class="face back"><span class="plate"><span class="glw">${role ? mark(role, "glyph") : ""}</span><span class="word">${esc(w)}</span></span></span>
        <span class="pin"></span>
        <span class="rbtn" role="button">Reveal</span>
      </button>
    </div>`;
}
function buildBoard(g, deal) {
  const grid = $("#grid");
  grid.innerHTML = g.words.map((w, i) => slotHTML(w, i, g.roles[i], g.revealed[i])).join("");
  [...grid.children].forEach((slot, i) => {
    slot.querySelector(".tile").addEventListener("click", (e) => {
      if (!canGuessNow() || gEl().revealed[i]) return;
      audio();
      if (e.target.closest(".rbtn")) { API.act("reveal", { i }); return; }
      const mine = (gEl().marks[i] || []).includes(ST.you);
      SFX.tick(!mine);
      API.act("mark", { i });
    });
  });
  boardId = g.id;
  if (deal && !reduce) {
    [...grid.children].forEach((s) => s.classList.add("dealing"));
    SFX.deal();
    setTimeout(() => [...grid.children].forEach((s) => s.classList.remove("dealing")), 900 + 20 * 70 + 200);
  }
  lastLeft = {};
  fit();
}
let lastLeft = {};
function syncBoard(g) {
  const grid = $("#grid");
  [...grid.children].forEach((slot, i) => {
    const role = g.roles[i];
    if (role && slot.dataset.role !== role) {             // the key arrives (spymaster) or a card is revealed
      slot.dataset.role = role;
      slot.querySelector(".kgw").innerHTML = mark(role, "kg");
      slot.querySelector(".glw").innerHTML = mark(role, "glyph");
    }
    const ids = g.revealed[i] ? [] : (g.marks[i] || []);
    slot.classList.toggle("marked", ids.length > 0);
    slot.classList.toggle("mine", ids.includes(ST.you));
    const pin = ids.map((id) => { const n = id === ST.you ? "You" : (byId(id) || {}).name || "?"; return `<span class="tg ${id === ST.you ? "you" : ""}"><i>${esc(n[0].toUpperCase())}</i>${esc(n)}</span>`; }).join("");
    const pe = slot.querySelector(".pin"); if (pe.dataset.h !== pin) { pe.innerHTML = pin; pe.dataset.h = pin; }
  });
  const c = $("#canvas");
  c.classList.toggle("spy", isSpyNow());
  c.classList.toggle("can", canGuessNow());
}

// ---------- side panels, tablet, dock, end turn ----------
function renderSide(g) {
  turn = g.turn;
  for (const t of ["E", "A"]) {
    const total = g.total[t], left = g.remaining[t];
    if (lastLeft[t] !== undefined && left < lastLeft[t]) flashUntil[t] = { k: total - left - 1, until: performance.now() + 900 };
    lastLeft[t] = left;
    bannerState[t] = { total, left };
    paintArt(t);
    const crew = ST.players.filter((p) => p.team === t).sort((a, b) => (b.role === "spy") - (a.role === "spy"));
    $(`#crew${t}`).innerHTML = crew.map((p) => `<span class="av ${t} ${p.online ? "" : "off"}" title="${esc(p.name)}${p.role === "spy" ? " (spymaster)" : ""}">${p.role === "spy" ? `<svg class="crn" viewBox="0 0 24 16"><use href="#i-crown"/></svg>` : ""}${esc((p.name[0] || "?").toUpperCase())}</span>`).join("") || `<span class="empty">no players</span>`;
  }
  renderAgents();
  for (const t of ["E", "A"]) { const pe = $("#p" + t); if (!pe.firstChild) pe.innerHTML = emblem(t); }
  const over = g.phase === "over";
  document.querySelectorAll("#game .hud.hero").forEach((h) => h.querySelector(".portrait").classList.toggle("active", !over && h.classList.contains(g.turn)));
  for (const t of ["E", "A"]) { $("#flag" + t).classList.toggle("active", !over && t === g.turn); $("#glow" + t).classList.toggle("active", !over && t === g.turn); }
  renderTablet(g);
  // guesses left
  const dock = $("#game .dock"), gb = $("#guessBadge");
  dock.hidden = g.phase !== "guess";
  if (g.phase === "guess") {
    const left = g.guessesLeft === null ? "∞" : g.guessesLeft;
    gb.className = `gbadge ${g.turn}`;
    const html = `<b>${left}</b><span>${left === 1 ? "guess" : "guesses"}<br>left</span>`;
    if (gb.dataset.h !== html) { gb.innerHTML = html; gb.dataset.h = html; }
  }
  // end turn: only for the guessing team's operatives
  const et = $("#endturn");
  et.hidden = !canGuessNow();
  et.classList.toggle("disabled", g.guessesMade < 1);
  et.title = g.guessesMade < 1 ? "Make at least one guess first" : "";
  et.dataset.team = g.turn; et.querySelector(".et-emb").innerHTML = emblem(g.turn);
}
function renderTablet(g) {
  const tb = $("#tablet"), m = meP(), spy = ST.players.find((p) => p.team === g.turn && p.role === "spy");
  const key = `${g.id}:${g.turnNo}:${g.phase}`;
  const myClue = g.phase === "clue" && m.team === g.turn && m.role === "spy";
  if (myClue && document.activeElement && document.activeElement.id === "clueIn" && clueKey === key) return;   // don't wipe a clue being typed
  const slam = g.phase === "guess" && clueKey !== key;
  clueKey = key;
  tb.classList.toggle("formmode", myClue);
  tb.style.setProperty("--tc", `var(--${g.turn})`);
  if (g.phase === "over") {
    const t = g.reason === "ended" ? "Game ended" : g.reason === "assassin" ? "The Vantablack Warrior rose" : `${TEAMN[g.winner]} wins`;
    tb.innerHTML = `<div class="who">${g.winner ? emblem(g.winner) : ""}Game over</div><div class="wait">${esc(t)}</div>`;
  } else if (g.phase === "guess") {
    tb.innerHTML = `<div class="who ${g.turn}">${emblem(g.turn)}${TEAMN[g.turn]} clue${g.clue.by ? ` · ${esc(g.clue.by)}` : ""}</div><div class="row"><div class="clue">${esc(g.clue.word)}</div><div class="cnum ${g.turn}">${g.clue.n === "inf" ? "∞" : g.clue.n}</div></div>`;
    if (slam) { tb.classList.remove("slam"); void tb.offsetWidth; tb.classList.add("slam"); }
  } else if (myClue) {
    tb.innerHTML = `<form class="clueform" id="clueForm" autocomplete="off"><div class="who ${g.turn}">${emblem(g.turn)}Your clue, spymaster</div>
      <div class="row"><input id="clueIn" maxlength="24" placeholder="One word" aria-label="Clue word" enterkeyhint="send"><button type="submit" class="give">Give clue</button></div>
      <div class="nums" role="group" aria-label="How many cards">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 0, "inf"].map((n) => `<button type="button" data-n="${n}" aria-pressed="${pickedN === n}">${n === "inf" ? "∞" : n}</button>`).join("")}</div>
      <span class="hint">How many cards it points to · 0 or ∞ = unlimited guesses</span><span class="err" id="clueErr"></span></form>`;
    const f = $("#clueForm");
    f.querySelectorAll("[data-n]").forEach((b) => b.addEventListener("click", () => { pickedN = b.dataset.n === "inf" ? "inf" : +b.dataset.n; f.querySelectorAll("[data-n]").forEach((x) => x.setAttribute("aria-pressed", x === b)); SFX.tick(true); }));
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const word = $("#clueIn").value.trim(), err = $("#clueErr");
      if (!word) { err.textContent = "Type a one-word clue."; return; }
      if (pickedN === null) { err.textContent = "Pick a number too."; return; }
      const r = await API.act("clue", { word, n: pickedN }, true);
      if (r && r.error) err.textContent = r.error; else pickedN = null;
    });
  } else {
    tb.innerHTML = `<div class="who ${g.turn}">${emblem(g.turn)}${TEAMN[g.turn]}'s turn</div><div class="wait">${spy ? `Waiting for <b>${esc(spy.name)}</b>'s clue…` : `${TEAMN[g.turn]} needs a spymaster`}</div>`;
  }
}

// ---------- feed, ribbon, shake ----------
function feed(html, team) {
  const f = $("#feed"), d = document.createElement("div");
  d.innerHTML = html; d.style.setProperty("--tc", `var(--${team || "gold2"})`);
  f.prepend(d); while (f.children.length > 2) f.lastChild.remove();
  setTimeout(() => d.classList.add("fade"), 6000); setTimeout(() => d.remove(), 6700);
}
function ribbon(text, team) {
  const r = $("#ribbon"); r.style.setProperty("--tc", team ? `var(--${team})` : "#555");
  r.innerHTML = `${team === "E" || team === "A" ? emblem(team) : ""}<span>${esc(text)}</span>`; r.classList.remove("show"); void r.offsetWidth; r.classList.add("show");
}
function shake(big) { const s = $("#scene"); s.classList.remove("shake", "big"); void s.offsetWidth; s.classList.add("shake"); if (big) s.classList.add("big"); }
const LOGW = { E: "a Ministry agent", A: "an Authority agent", B: "a bystander", X: "the Vantablack Warrior" };
function logFeed(g) {
  const entries = g.log, start = Math.max(0, entries.length - (entries.length - seenLog));
  for (const e of entries.slice(seenLog)) {
    if (e.k === "clue") feed(`<b>${esc(e.by)}</b>: ${esc(e.word)} · ${e.n === "inf" ? "∞" : e.n}`, e.team);
    else if (e.k === "end") feed(`<b>${esc(e.by)}</b> ended the turn`, e.team);
    else if (e.k === "timeout") feed(`<b>${TEAMN[e.team]}</b> ran out of time`, e.team);
    else if (e.k === "out") feed(`<b>${TEAMN[e.team]}</b> used every guess`, e.team);
  }
  seenLog = entries.length;
}

// ---------- reveal effects (triggered when a card turns over in the shared state) ----------
function revealFx(g, i, guesser) {
  const slot = $("#grid").children[i]; if (!slot) return;
  const role = g.roles[i];
  slot.classList.add("rev");
  if (!reduce) slot.classList.add("flipping");
  SFX.flip();
  setTimeout(() => {
    slot.classList.remove("flipping"); slot.classList.add("flash"); setTimeout(() => slot.classList.remove("flash"), 1100);
    const dc = { E: "rgba(255,110,130,.9)", A: "rgba(130,180,255,.9)", B: "rgba(230,215,180,.8)", X: "rgba(0,0,0,.95)" }[role];
    const dust = document.createElement("span"); dust.className = "dust"; dust.style.setProperty("--dc", dc); slot.appendChild(dust); setTimeout(() => dust.remove(), 900);
    shake(role === "X");
    SFX.land(role === "X");
    if (role === guesser) { SFX.good(); const gb = $("#guessBadge"); gb.classList.remove("pop"); void gb.offsetWidth; gb.classList.add("pop"); SFX.snuff(); }
    else if (role === "B") SFX.neutral();
    else if (role !== "X") SFX.bad();
    if (role === "X") { document.querySelector("#game .top").style.setProperty("--glow", ".02"); ribbon("The Vantablack Warrior rises", null); SFX.doom(); }
    feed(`<b>${esc(g.revealedBy[i] || "Someone")}</b> revealed ${esc(g.words[i])}: ${LOGW[role] || "?"}`, role === "E" || role === "A" ? role : null);
  }, reduce ? 0 : 820);
}

// ---------- fuse: follows the server's turn deadline ----------
function burnFuse(now) {
  const g = gEl();
  const on = !!(g && g.deadline && g.phase !== "over" && ST.settings.timer);
  if (!on) { window.__fuse = { on: false, p: 0, hurry: false }; ropecv.classList.add("off"); flameEl.classList.add("off"); return; }
  ropecv.classList.remove("off");
  timerSecs = ST.settings.timer;
  const left = Math.max(0, g.deadline - (Date.now() + (API.clockOffset() || 0)));
  const p = Math.max(0, Math.min(1, 1 - left / (timerSecs * 1000))), burned = ropeLen * p;
  drawRope(burned, now);
  const pt = rimPath.getPointAtLength(Math.min(burned, ropeLen - .1));
  const bp = document.getElementById("burnpt");
  bp.style.setProperty("--fx", pt.x.toFixed(1) + "px"); bp.style.setProperty("--fy", pt.y.toFixed(1) + "px");
  const cr = $("#canvas").getBoundingClientRect(), br = bp.getBoundingClientRect(), sc = cr.width / 1280 || 1;
  flameEl.style.setProperty("--px", ((br.x + br.width / 2 - cr.x) / sc).toFixed(1) + "px");
  flameEl.style.setProperty("--py", ((br.y + br.height / 2 - cr.y) / sc).toFixed(1) + "px");
  const hurry = left < 15000;
  window.__fuse = { on: true, p, hurry };
  flameEl.classList.toggle("off", p >= 1);
  if (p < 1) { stepFire(now, hurry); if (Math.random() < (hurry ? .22 : .09)) SFX.crackle(hurry); }
  document.querySelector("#game .top").classList.toggle("hurry", hurry && p < 1);
}
function frame(now) {
  try { if (!$("#game").hidden) { waveBanners(now); burnFuse(now); } } catch (e) { console.error(e); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- victory ----------
function showVictory(g) {
  const v = $("#victory");
  const kind = g.reason === "assassin" ? "X" : g.reason === "ended" ? "B" : g.winner;
  v.className = `victory ${kind === "B" ? "" : kind}`;
  const art = kind === "X" ? G("X") : kind === "B" ? G("B") : emblem(g.winner);
  const title = kind === "X" ? "The Vantablack Warrior rises" : kind === "B" ? "Game ended" : `${TEAMN[g.winner]} wins`;
  const sub = kind === "X" ? `${TEAMN[g.byTeam]} woke the Vantablack Warrior. ${TEAMN[g.winner]} wins.`
    : kind === "B" ? "The host ended the game early."
    : g.reason === "gift" ? `${TEAMN[g.byTeam]} revealed the last ${TEAMN[g.winner]} agent for them.` : `Every ${TEAMN[g.winner]} agent has been found.`;
  const found = (t) => g.total[t] - g.remaining[t];
  const best = {}; for (const e of g.log) if (e.k === "reveal" && e.role === e.team) best[e.by] = (best[e.by] || 0) + 1;
  const top = Object.entries(best).sort((a, b) => b[1] - a[1])[0];
  const hostP = byId(ST.hostId);
  const acts = host()
    ? `<div class="row"><button type="button" class="bigbtn ready" data-v="again">Play again</button><button type="button" class="bigbtn stone" data-v="swap">Swap spymasters &amp; play</button></div>
       <div class="row"><button type="button" class="bigbtn stone" data-v="lobby" style="font-size:18px;padding:8px 20px">Back to lobby</button></div>`
    : `<div class="vwait"><i></i>Waiting for <b style="font-weight:400;color:var(--gold)">${esc(hostP ? hostP.name : "the host")}</b> to start the next game</div>`;
  v.innerHTML = `<div class="vrays"></div><div class="vcard"><div class="vrod"></div><div class="vbanner">${art}</div>
    <h2 class="vtitle">${esc(title)}</h2><p class="vsub">${esc(sub)}</p>
    <div class="vstats"><div><b>${found("E")} / ${g.total.E}</b><span>Ministry agents found</span></div><div><b>${found("A")} / ${g.total.A}</b><span>Authority agents found</span></div>
      ${top ? `<div><b>${esc(top[0])}</b><span>best operative · ${top[1]} found</span></div>` : `<div><b>${g.turnNo}</b><span>turns</span></div>`}</div>
    <div class="vactions">${acts}<button type="button" class="vlink" data-v="close">View the board</button></div></div>`;
  v.hidden = false;
  v.querySelectorAll("[data-v]").forEach((b) => b.addEventListener("click", () => {
    const k = b.dataset.v; audio(); SFX.press();
    if (k === "close") { v.hidden = true; return; }
    if (k === "again") API.act("rematch", { rotate: false });
    if (k === "swap") API.act("rematch", { rotate: true });
    if (k === "lobby") API.act("lobby");
  }));
  if (kind === "X") { shake(true); }
  else if (kind !== "B") {
    setTimeout(() => SFX.win(), 450);
    const col = g.winner === "A" ? "var(--A)" : "var(--E)";
    for (let k = 0; k < 70; k++) {
      const e = document.createElement("span"); e.className = "vember";
      e.style.left = Math.random() * 100 + "%"; e.style.setProperty("--ec", Math.random() < .6 ? col : "#ffd98a");
      e.style.setProperty("--dx", (Math.random() * 160 - 80).toFixed(0) + "px"); e.style.setProperty("--dur", (2.4 + Math.random() * 2.6).toFixed(2) + "s");
      e.style.animationDelay = (Math.random() * 1.6).toFixed(2) + "s"; v.appendChild(e); setTimeout(() => e.remove(), 6500);
    }
  }
  victoryFor = g.id;
}

// ---------- plaque + menu sheet ----------
function renderPlaque() {
  $("#roomCode").textContent = ST.code;
  const q = $("#qrImg"); if (q.dataset.code !== ST.code) { q.src = `/qr/${ST.code}.svg`; q.dataset.code = ST.code; }
}
function renderSheet() {
  const sh = $("#tsheet"); if (sh.hidden) return;
  const g = gEl(), m = meP();
  $("#shInvite").innerHTML = `<div class="invite"><img class="qr" src="/qr/${ST.code}.svg" alt="QR code to join"><div><span class="code">${ST.code}</span><span class="link">${esc(API.roomLink(ST.code).replace(/^https?:\/\//, ""))}</span><button type="button" class="sbtn" data-s="copy">Copy link</button></div></div>`;
  const roleOf = (p) => (p.team ? (p.role === "spy" ? "spymaster" : "operative") : "watching") + (p.id === ST.hostId ? " · host" : "") + (p.online ? "" : " · away");
  $("#plist").innerHTML = ST.players.map((p) => `<li class="${p.online ? "" : "off"}"><span class="av ${p.team || ""}">${esc((p.name[0] || "?").toUpperCase())}</span>${esc(p.name)}${p.id === ST.you ? ' <span class="you">you</span>' : ""}<small>${roleOf(p)}</small>
    ${host() && p.id !== ST.you ? `<span class="seat"><button type="button" class="sbtn" data-s="mkhost" data-id="${esc(p.id)}">Host</button><button type="button" class="sbtn danger" data-s="kick" data-id="${esc(p.id)}">Remove</button></span>` : ""}</li>`).join("");
  // seats: join a side mid-game, take an empty spymaster seat, or leave your side
  let seat = "";
  if (g && g.phase !== "over") {
    if (!m.team && !g.sawKey) seat += `<button type="button" class="sbtn E" data-s="seat" data-t="E" data-r="op">Join Ministry</button><button type="button" class="sbtn A" data-s="seat" data-t="A" data-r="op">Join Authority</button>`;
    for (const t of ["E", "A"]) if (!ST.players.some((p) => p.team === t && p.role === "spy") && (!m.team || m.team === t) && m.role !== "spy") seat += `<button type="button" class="sbtn ${t}" data-s="seat" data-t="${t}" data-r="spy">Take the ${TEAMN[t]} spymaster seat</button>`;
    if (m.team) seat += `<button type="button" class="sbtn" data-s="seat" data-t="" data-r="op">Leave my side and watch</button>`;
  }
  $("#shSeat").innerHTML = seat ? `<div class="seatrow">${seat}</div>` : "";
  $("#shHost").hidden = !host();
  $("#shHostBtns").innerHTML = g && g.phase !== "over" ? `<button type="button" class="sbtn danger" data-s="end">End game</button><button type="button" class="sbtn" data-s="lobby">Back to lobby</button>` : `<button type="button" class="sbtn" data-s="lobby">Back to lobby</button>`;
  $("#shConfirm").innerHTML = confirmAction ? `<div class="confirmbox"><span>${esc(confirmAction.text)}</span><div class="row2"><button type="button" class="sbtn danger" data-s="yes">${esc(confirmAction.label)}</button><button type="button" class="sbtn" data-s="no">Cancel</button></div></div>` : "";
}
function openSheet() { $("#tsheet").hidden = false; renderSheet(); }
document.addEventListener("click", async (e) => {
  const b = e.target.closest("#tsheet [data-s], #tsheet [data-close]"); if (!b) return;
  audio();
  if (b.hasAttribute("data-close")) { $("#tsheet").hidden = true; confirmAction = null; return; }
  const k = b.dataset.s;
  if (k === "copy") { try { await navigator.clipboard.writeText(API.roomLink(ST.code)); b.textContent = "Copied"; } catch { b.textContent = API.roomLink(ST.code); } }
  if (k === "seat") API.act("seat", { team: b.dataset.t || null, role: b.dataset.r });
  if (k === "mkhost") API.act("makeHost", { id: b.dataset.id });
  if (k === "kick") { const p = byId(b.dataset.id); confirmAction = { text: `Remove ${p ? p.name : "this player"} from the room?`, label: "Remove", fn: () => API.act("kick", { id: b.dataset.id }) }; }
  if (k === "end") confirmAction = { text: "End this game for everyone? The whole board will be revealed.", label: "End game", fn: () => API.act("endGame") };
  if (k === "lobby") { API.act("lobby"); $("#tsheet").hidden = true; }
  if (k === "yes") { const fn = confirmAction && confirmAction.fn; confirmAction = null; fn && fn(); }
  if (k === "no") confirmAction = null;
  if (k === "rename") { const f = $("#shRename"); f.hidden = !f.hidden; if (!f.hidden) { $("#shName").value = meP().name; $("#shName").focus(); } }
  if (k === "leave") { $("#tsheet").hidden = true; API.leave(); }
  SFX.tick(true);
  renderSheet();
});
document.addEventListener("submit", async (e) => {
  if (e.target.id !== "shRename") return;
  e.preventDefault();
  const n = $("#shName").value.trim(); if (!n) return;
  const r = await API.act("rename", { name: n }, true);
  if (!r || !r.error) { API.saveName(n); $("#shRename").hidden = true; }
});
$("#menuBtn").addEventListener("click", () => { audio(); SFX.press(); openSheet(); });
$("#qrTile").addEventListener("click", () => { audio(); SFX.press(); openSheet(); });
$("#roomTag").addEventListener("click", async (e) => {
  const tag = e.currentTarget; audio(); SFX.press();
  try { await navigator.clipboard.writeText(API.roomLink(ST.code)); } catch {}
  tag.classList.add("copied"); tag.querySelector("span").textContent = "Copied"; setTimeout(() => { tag.classList.remove("copied"); tag.querySelector("span").textContent = "Room"; }, 1400);
});
$("#endturn").addEventListener("click", () => {
  if (!canGuessNow()) return;
  audio(); SFX.press(); const b = $("#endturn"); b.classList.remove("pressed"); void b.offsetWidth; b.classList.add("pressed");
  API.act("endTurn");
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#game").hidden) { $("#tsheet").hidden = true; $("#victory").hidden = true; } });

// ---------- the one entry point the app calls on every state update ----------
let wasHidden = true;
window.Table = {
  update(state, prev, api) {
    ST = state; PREV = prev; API = api;
    const g = state.game; if (!g) { boardId = null; return; }
    if (wasHidden) { wasHidden = false; scaleStage(); window.__goldRebuild && window.__goldRebuild(); }
    const pg = prev && prev.game;
    const fresh = boardId !== g.id;
    if (fresh) {
      const dealt = !!prev && (!pg || pg.id !== g.id);              // a new game started while we were watching
      buildBoard(g, dealt);
      seenLog = g.log.length; clueKey = null; victoryFor = null; $("#victory").hidden = true;
      document.querySelector("#game .top").style.removeProperty("--glow");
      if (dealt) setTimeout(() => ribbon(`${TEAMN[g.first]} goes first`, g.first), 1700);
    }
    syncBoard(g);
    if (!fresh && pg && pg.id === g.id) {
      g.revealed.forEach((r, i) => { if (r && !pg.revealed[i]) revealFx(g, i, pg.turn); });
      if (pg.phase === "clue" && g.phase === "guess") SFX.clue();
      if (pg.turn !== g.turn && g.phase !== "over") setTimeout(() => { ribbon(`${TEAMN[g.turn]}'s turn`, g.turn); SFX.turn(); }, 900);
      logFeed(g);
    }
    renderSide(g);
    renderPlaque();
    renderSheet();
    if (g.phase === "over" && victoryFor !== g.id) setTimeout(() => { if (ST.game && ST.game.id === g.id && ST.game.phase === "over") showVictory(ST.game); }, fresh ? 0 : 1200);
    if (g.phase !== "over") $("#victory").hidden = true;
  },
  hide() { wasHidden = true; $("#tsheet").hidden = true; },
};
(document.fonts ? document.fonts.load('400 100px "Fondamento"') : Promise.resolve()).then(() => { fit(); paintArt("E"); paintArt("A"); }, () => {});

applyFlagMode("real");
})();
