/* Deepnames visual effects: ambient embers behind the page, and particle bursts,
   shockwave rings and smoke on a separate overlay canvas. Everything is skipped
   for people who ask their device for reduced motion. */
(() => {
"use strict";
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const amb = document.getElementById("ambient"), fxc = document.getElementById("fx");
const actx = amb.getContext("2d"), fctx = fxc.getContext("2d");
let W = 0, H = 0, DPR = 1;

// Stone grain used by card plates and panels.
try {
  const c = document.createElement("canvas"); c.width = c.height = 160;
  const x = c.getContext("2d"), d = x.createImageData(160, 160);
  for (let i = 0; i < d.data.length; i += 4) { const v = 110 + Math.random() * 145 | 0; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 26; }
  x.putImageData(d, 0, 0);
  document.documentElement.style.setProperty("--grain", `url(${c.toDataURL()})`);
} catch {}

function size() {
  DPR = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight;
  for (const c of [amb, fxc]) { c.width = W * DPR; c.height = H * DPR; }
  actx.setTransform(DPR, 0, 0, DPR, 0, 0); fctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
size(); addEventListener("resize", size);

// ---------- ambient embers ----------
const embers = [];
function ember(initial) {
  return { x: Math.random() * W, y: initial ? Math.random() * H : H + 8, r: .5 + Math.random() * 1.7,
    vy: -(.12 + Math.random() * .45), vx: (Math.random() - .5) * .18, ph: Math.random() * 6.283,
    hue: 22 + Math.random() * 22, a: .2 + Math.random() * .5 };
}
const emberCount = () => reduce ? 0 : Math.round(Math.min(80, (W * H) / 20000));
for (let i = 0; i < emberCount(); i++) embers.push(ember(true));
let tint = null; // temporary colour override for embers (victory)
let tintUntil = 0;

// ---------- burst particles ----------
let parts = [], rings = [], smokes = [];
const rand = (a, b) => a + Math.random() * (b - a);

function burst(x, y, color, { n = 40, speed = 5, gravity = .08, life = 60, size = 2.2, kind = "spark", spread = Math.PI * 2, dir = -Math.PI / 2 } = {}) {
  if (reduce) return;
  for (let i = 0; i < n; i++) {
    const a = dir + rand(-spread / 2, spread / 2), s = rand(.25, 1) * speed;
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: gravity, life: life * rand(.6, 1.2), max: 0, size: size * rand(.5, 1.4), color, kind, rot: rand(0, 6.28), vr: rand(-.2, .2) });
  }
}
function ring(x, y, color, max = 160, width = 4, life = 40) { if (!reduce) rings.push({ x, y, color, r: 4, max, width, life, t: 0 }); }
function smoke(x, y, { n = 26, color = "0,0,0", spread = 60, life = 110, grow = 1.6, size = 26 } = {}) {
  if (reduce) return;
  for (let i = 0; i < n; i++) smokes.push({ x: x + rand(-spread, spread) * .4, y: y + rand(-spread, spread) * .3, vx: rand(-1.4, 1.4), vy: rand(-1.6, .2), r: size * rand(.5, 1.2), grow: grow * rand(.6, 1.3), a: rand(.35, .7), life: life * rand(.7, 1.2), t: 0, color });
}

function center(el) { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r]; }

const COLORS = { E: "#ff5a70", A: "#79b4ff", B: "#e3d3ad", X: "#1a1a1a", gold: "#ffd98a" };

// What a card does when it turns over.
function reveal(el, role, good) {
  if (!el || reduce) return;
  const [x, y, r] = center(el);
  if (role === "X") {
    smoke(x, y, { n: 46, spread: r.width, size: r.width * .35, life: 150 });
    ring(x, y, "rgba(0,0,0,.9)", Math.max(W, H) * .7, 18, 70);
    burst(x, y, "#3a3a3a", { n: 50, speed: 7, kind: "shard", gravity: .2, life: 70, size: 4 });
    darken(1400);
    return;
  }
  if (role === "B") {
    burst(x, y, COLORS.B, { n: 26, speed: 2.4, kind: "dust", gravity: .015, life: 70, size: 5 });
    ring(x, y, "rgba(227,211,173,.6)", r.width * .9, 2, 30);
    return;
  }
  const c = COLORS[role];
  ring(x, y, c, r.width * 1.2, 3, 34);
  burst(x, y, c, { n: good ? 46 : 34, speed: good ? 6.5 : 5, life: 55, size: 2.4 });
  if (good) { burst(x, y, COLORS.gold, { n: 26, speed: 4.2, life: 70, size: 1.8, gravity: .03 }); }
  else burst(x, y, "#ffffff", { n: 10, speed: 3, life: 30, size: 1.4 });
}

let darkUntil = 0, darkFor = 1;
function darken(ms) { darkUntil = performance.now() + ms; darkFor = ms; }

function celebrate(team) {
  if (reduce) return;
  const c = COLORS[team] || COLORS.gold;
  tint = c; tintUntil = performance.now() + 5000;
  for (let k = 0; k < 6; k++) setTimeout(() => {
    burst(rand(W * .1, W * .9), H + 10, c, { n: 40, speed: 13, gravity: .14, life: 110, size: 2.8, spread: .7 });
    burst(rand(W * .1, W * .9), H + 10, COLORS.gold, { n: 26, speed: 12, gravity: .14, life: 120, size: 2, spread: .6 });
  }, k * 260);
}
function doom() {
  if (reduce) return;
  smoke(W / 2, H * .55, { n: 70, spread: W * .9, size: Math.max(60, W * .08), life: 220, grow: 2.4 });
  darken(2600);
}

// ---------- main loop ----------
function frame(t) {
  // embers
  actx.clearRect(0, 0, W, H);
  const want = emberCount();
  while (embers.length < want) embers.push(ember(true));
  if (embers.length > want) embers.length = want;
  const tinted = tint && t < tintUntil;
  for (const e of embers) {
    e.y += e.vy * (tinted ? 3 : 1); e.x += e.vx + Math.sin(t / 1500 + e.ph) * .14;
    if (e.y < -10) Object.assign(e, ember(false));
    const fl = .55 + .45 * Math.sin(t / 260 + e.ph * 3);
    actx.globalAlpha = e.a * fl;
    actx.fillStyle = tinted ? tint : `hsl(${e.hue},95%,62%)`;
    actx.beginPath(); actx.arc(e.x, e.y, e.r, 0, 6.283); actx.fill();
    actx.globalAlpha = e.a * fl * .18;
    actx.beginPath(); actx.arc(e.x, e.y, e.r * 4, 0, 6.283); actx.fill();
  }
  actx.globalAlpha = 1;

  // overlay effects
  fctx.clearRect(0, 0, W, H);
  const dark = Math.max(0, (darkUntil - t) / darkFor);
  if (dark > 0) {
    const g = fctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .15, W / 2, H / 2, Math.max(W, H) * .75);
    g.addColorStop(0, `rgba(0,0,0,${.25 * dark})`); g.addColorStop(1, `rgba(0,0,0,${.85 * dark})`);
    fctx.fillStyle = g; fctx.fillRect(0, 0, W, H);
  }
  if (smokes.length) {
    smokes = smokes.filter((s) => (s.t += 1) < s.life);
    for (const s of smokes) {
      s.x += s.vx; s.y += s.vy; s.vx *= .985; s.vy *= .985; s.r += s.grow;
      const k = 1 - s.t / s.life;
      const g = fctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
      g.addColorStop(0, `rgba(${s.color},${s.a * k})`); g.addColorStop(1, `rgba(${s.color},0)`);
      fctx.fillStyle = g; fctx.beginPath(); fctx.arc(s.x, s.y, s.r, 0, 6.283); fctx.fill();
    }
  }
  if (rings.length) {
    rings = rings.filter((r) => (r.t += 1) < r.life);
    for (const r of rings) {
      const k = r.t / r.life, e = 1 - Math.pow(1 - k, 3);
      fctx.strokeStyle = r.color; fctx.globalAlpha = 1 - k; fctx.lineWidth = r.width * (1 - k) + .5;
      fctx.beginPath(); fctx.arc(r.x, r.y, 4 + (r.max - 4) * e, 0, 6.283); fctx.stroke();
    }
    fctx.globalAlpha = 1;
  }
  if (parts.length) {
    parts = parts.filter((p) => (p.max += 1) < p.life);
    for (const p of parts) {
      p.vy += p.g; p.vx *= p.kind === "dust" ? .96 : .985; p.vy *= p.kind === "dust" ? .96 : .99;
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      const k = 1 - p.max / p.life;
      if (p.kind === "spark") {
        fctx.globalCompositeOperation = "lighter";
        fctx.globalAlpha = k; fctx.fillStyle = p.color;
        fctx.beginPath(); fctx.arc(p.x, p.y, p.size * (.4 + k * .6), 0, 6.283); fctx.fill();
        fctx.globalAlpha = k * .25; fctx.beginPath(); fctx.arc(p.x, p.y, p.size * 3, 0, 6.283); fctx.fill();
        fctx.globalCompositeOperation = "source-over";
      } else if (p.kind === "shard") {
        fctx.globalAlpha = k; fctx.fillStyle = p.color;
        fctx.save(); fctx.translate(p.x, p.y); fctx.rotate(p.rot);
        fctx.beginPath(); fctx.moveTo(-p.size, 0); fctx.lineTo(0, -p.size * 1.6); fctx.lineTo(p.size, 0); fctx.lineTo(0, p.size * .6); fctx.closePath(); fctx.fill();
        fctx.restore();
      } else {
        fctx.globalAlpha = k * .55; fctx.fillStyle = p.color;
        fctx.beginPath(); fctx.arc(p.x, p.y, p.size * (1.6 - k * .6), 0, 6.283); fctx.fill();
      }
    }
    fctx.globalAlpha = 1;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.FX = { burst, ring, smoke, reveal, celebrate, doom, darken, center, reduce };
})();
