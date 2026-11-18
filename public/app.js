/* Deepnames client. The server owns all game state; this file only renders the
   snapshot it receives and sends the player's intents back. */
(() => {
"use strict";

// ---------- small helpers ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const mem = {};
const store = {
  get(k) { try { const v = localStorage.getItem(k); return v === null ? mem[k] ?? null : v; } catch { return mem[k] ?? null; } },
  set(k, v) { mem[k] = v; try { localStorage.setItem(k, v); } catch {} },
  del(k) { delete mem[k]; try { localStorage.removeItem(k); } catch {} },
};
function rid(bytes) {
  const a = new Uint8Array(bytes);
  (window.crypto || window.msCrypto).getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const pid = store.get("dn.pid") || (() => { const v = rid(12); store.set("dn.pid", v); return v; })();
const token = store.get("dn.token") || (() => { const v = rid(24); store.set("dn.token", v); return v; })();

// Internal codes: E = Ministry (red), A = Authority (blue), B = bystander, X = Vantablack Warrior.
const TEAM = { E: "Ministry", A: "Authority" };
const POSS = { E: "Ministry’s", A: "Authority’s" };
const OTHER = { E: "A", A: "E" };
const ASSASSIN = "Vantablack Warrior";
const ROLE_LINE = { E: "a <span class='tE'>Ministry</span> agent", A: "an <span class='tA'>Authority</span> agent", B: "a bystander", X: "<b>the VANTABLACK WARRIOR</b>" };
const glyph = (r, cls = "") => `<svg class="${cls}" viewBox="0 0 64 64" aria-hidden="true"><use href="#g-${r}"/></svg>`;
const teamName = (t) => `<span class="t${t}">${TEAM[t]}</span>`;

// ---------- state ----------
let S = null;            // latest snapshot
let prev = null;         // previous snapshot (for animations + sounds)
let currentCode = null;  // room we're in (or trying to join)
let clockOffset = 0;
let meta = { packs: [], timers: [0, 60, 90, 120, 180, 240] };
let overlayFor = null;   // game id whose result overlay was dismissed
let pickedNum = null;
let cardEls = [];
let boardGameId = null;
let sheetOpen = null;
let joining = false;

const socket = io({ transports: ["websocket", "polling"], reconnectionDelayMax: 4000 });

function emit(ev, data) {
  return new Promise((resolve) => {
    if (!socket.connected) { resolve({ error: "Not connected yet. Hang on a second and try again." }); return; }
    const t = setTimeout(() => resolve({ error: "The server didn't answer. Check your connection." }), 8000);
    socket.emit(ev, data, (res) => { clearTimeout(t); resolve(res || {}); });
  });
}
async function act(type, data = {}) {
  const res = await emit("act", { type, ...data });
  if (res.error) toast(res.error, true);
  return res;
}

let toastTimer;
function toast(msg, bad = false) {
  const t = $("#toast");
  t.textContent = msg; t.classList.toggle("bad", bad); t.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2800);
}

// ---------- sound ----------
let ac = null;
let muted = store.get("dn.muted") === "1";
function audio() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (ac.state === "suspended") ac.resume().catch(() => {});
  return ac;
}
document.addEventListener("pointerdown", () => audio(), { passive: true });
function tone(freq, dur, { type = "sine", vol = .18, at = 0, to = null } = {}) {
  const c = audio(); if (!c || muted) return;
  const t0 = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + .02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination); o.start(t0); o.stop(t0 + dur + .05);
}
function noise(dur, { vol = .2, at = 0, freq = 800 } = {}) {
  const c = audio(); if (!c || muted) return;
  const len = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  f.type = "lowpass"; f.frequency.value = freq; g.gain.value = vol;
  s.buffer = buf; s.connect(f).connect(g).connect(c.destination); s.start(c.currentTime + at);
}
const sfx = {
  flip() { noise(.12, { vol: .25, freq: 1800 }); },
  good() { tone(523, .25, { vol: .14, at: .08 }); tone(784, .4, { vol: .14, at: .2 }); },
  bad() { tone(196, .5, { type: "sawtooth", vol: .08, at: .08, to: 110 }); noise(.3, { vol: .2, at: .08, freq: 300 }); },
  neutral() { tone(330, .3, { type: "triangle", vol: .12, at: .08, to: 260 }); },
  doom() { noise(2.4, { vol: .5, freq: 160 }); tone(73, 2.6, { type: "sawtooth", vol: .16, to: 30 }); tone(110, 2.2, { type: "square", vol: .05, at: .3, to: 41 }); },
  bell() { tone(880, 1.2, { type: "triangle", vol: .12 }); tone(1320, .9, { vol: .05, at: .02 }); },
  turn() { tone(660, .2, { vol: .12 }); tone(990, .35, { vol: .12, at: .14 }); },
  win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, .5, { type: "triangle", vol: .13, at: i * .13 })); },
  start() { tone(392, .3, { vol: .12 }); tone(587, .5, { vol: .12, at: .18 }); },
  deal() { for (let k = 0; k < 20; k++) noise(.05, { vol: .12, at: .05 + k * .06, freq: 2600 }); },
  tick() { tone(1200, .06, { type: "square", vol: .05 }); },
};
function shake(small) {
  if (window.FX && FX.reduce) return;
  const el = $("#game");
  el.classList.remove("shake", "shake-sm"); void el.offsetWidth;
  el.classList.add(small ? "shake-sm" : "shake");
}
function syncSoundButtons() { $$("[data-sound] use").forEach((u) => u.setAttribute("href", muted ? "#i-mute" : "#i-sound")); }
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-sound]")) { muted = !muted; store.set("dn.muted", muted ? "1" : "0"); syncSoundButtons(); if (!muted) sfx.turn(); }
});
syncSoundButtons();

// ---------- routing ----------
function codeFromUrl() {
  const m = location.pathname.match(/^\/r\/([A-Za-z]{4})\/?$/) || location.search.match(/[?&]r=([A-Za-z]{4})/);
  return m ? m[1].toUpperCase() : null;
}
function setUrl(code) {
  const path = code ? `/r/${code}` : "/";
  if (location.pathname !== path) history.replaceState(null, "", path);
}
const roomLink = (code) => `${location.origin}/r/${code}`;

function show(screen) {
  for (const id of ["home", "lobby", "game"]) $("#" + id).hidden = id !== screen;
}

// ---------- home ----------
const nameInput = $("#nameInput"), codeInput = $("#codeInput");
nameInput.value = store.get("dn.name") || "";
function homeError(msg) { $("#homeError").textContent = msg || ""; }
function readName() {
  const n = nameInput.value.trim();
  if (!n) { homeError("Type your name first."); nameInput.focus(); return null; }
  store.set("dn.name", n); return n;
}
async function enterRoom(code, name, silent = false) {
  joining = true;
  const res = code ? await emit("join", { code, pid, token, name }) : await emit("create", { pid, token, name });
  joining = false;
  if (res.error) {
    if (silent) { currentCode = null; store.del("dn.room"); renderHome(); }
    homeError(res.error); show("home");
    return false;
  }
  currentCode = res.code; store.set("dn.room", res.code); setUrl(res.code); homeError("");
  return true;
}
$("#createBtn").onclick = async () => { const n = readName(); if (n) enterRoom(null, n); };
$("#joinBtn").onclick = async () => {
  const n = readName(); if (!n) return;
  const c = codeInput.value.trim().toUpperCase();
  if (!/^[A-Z]{4}$/.test(c)) { homeError("Room codes are 4 letters."); codeInput.focus(); return; }
  enterRoom(c, n);
};
codeInput.addEventListener("input", () => { codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4); });
codeInput.addEventListener("keydown", (e) => { if (e.key === "Enter") $("#joinBtn").click(); });
nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") (linkCode ? $("#joinLinkBtn") : $("#createBtn")).click(); });
let linkCode = codeFromUrl();
$("#joinLinkBtn").onclick = () => { const n = readName(); if (n) enterRoom(linkCode, n); };
$("#notThisRoom").onclick = () => { linkCode = null; setUrl(null); renderHome(); };
function renderHome() {
  $("#joinFromLink").hidden = !linkCode;
  $("#homeActions").hidden = !!linkCode;
  if (linkCode) $("#linkCode").textContent = linkCode;
}

// ---------- socket lifecycle ----------
socket.on("connect", async () => {
  $("#conn").hidden = true;
  const m = await emit("meta"); if (!m.error) meta = m;
  const name = store.get("dn.name");
  const want = currentCode || (linkCode && linkCode === store.get("dn.room") ? linkCode : null);
  if (want && name) enterRoom(want, name, true);
  else { renderHome(); show("home"); if (!name) nameInput.focus(); }
});
socket.on("disconnect", () => { if (currentCode) $("#conn").hidden = false; });
socket.on("connect_error", () => { if (currentCode) $("#conn").hidden = false; });
socket.on("kicked", () => {
  currentCode = null; store.del("dn.room"); S = null; prev = null; linkCode = null; setUrl(null);
  closeSheet(); $("#overlay").hidden = true; renderHome(); show("home");
  homeError("The host removed you from the room.");
});
socket.on("state", (state) => {
  if (joining) currentCode = state.code;
  if (!currentCode || state.code !== currentCode) return;
  clockOffset = state.serverNow - Date.now();
  prev = S; S = state;
  render();
  effects(prev, S);
});

async function leaveRoom() {
  await emit("leave");
  currentCode = null; store.del("dn.room"); S = null; prev = null; linkCode = null; setUrl(null);
  closeSheet(); $("#overlay").hidden = true; renderHome(); show("home");
}
document.addEventListener("click", (e) => { if (e.target.closest("[data-leave]")) leaveRoom(); });

// ---------- derived ----------
const me = () => S.players.find((p) => p.id === S.you) || { id: S.you, team: null, role: "op", name: "" };
const isHost = () => S.hostId === S.you;
const playerById = (id) => S.players.find((p) => p.id === id);
function canGuess() {
  const g = S.game, m = me();
  return !!g && g.phase === "guess" && m.team === g.turn && m.role === "op";
}

// ---------- render ----------
const seenPlayers = new Set();
function render() {
  if (!S) return;
  if (!S.game) { show("lobby"); renderLobby(); }
  else { show("game"); renderGame(); }
  if (sheetOpen) renderSheet();
  S.players.forEach((p) => seenPlayers.add(p.id));
}

// Big cinematic ribbon across the middle of the screen.
function banner(title, sub, team) {
  const b = $("#banner");
  b.className = `banner ${team || ""}`;
  b.innerHTML = `<div class="banner-band">${team ? glyph(team, "banner-glyph") : ""}<span class="banner-title">${esc(title)}</span>${sub ? `<span class="banner-sub">${esc(sub)}</span>` : ""}</div>`;
  void b.offsetWidth;
  b.classList.add("show");
  clearTimeout(banner.t); banner.t = setTimeout(() => b.classList.remove("show"), 2100);
}

function personRow(p, { actions = true } = {}) {
  const you = p.id === S.you;
  const host = p.id === S.hostId;
  const acts = actions && isHost() && !you
    ? `<span class="acts"><button class="btn tiny ghost" data-mkhost="${esc(p.id)}" type="button" title="Make host">Host</button><button class="btn tiny danger" data-kick="${esc(p.id)}" type="button" title="Remove from room">Remove</button></span>` : "";
  return `<li class="person ${p.online ? "" : "off"} ${seenPlayers.has(p.id) ? "" : "enter"}"><span class="dot" title="${p.online ? "Connected" : "Disconnected"}"></span>
    <span class="pname">${esc(p.name)}</span>${host ? `<svg class="crown" aria-label="Host"><use href="#i-crown"/></svg>` : ""}${you ? `<span class="you">you</span>` : ""}${acts}</li>`;
}

function renderLobby() {
  const code = S.code, m = me();
  $("#lobbyCode").textContent = code;
  $("#lobbyLink").textContent = roomLink(code).replace(/^https?:\/\//, "");
  const qr = $("#lobbyQr"); if (qr.dataset.code !== code) { qr.src = `/qr/${code}.svg`; qr.dataset.code = code; }
  $("[data-share]").hidden = !navigator.share;
  const ri = $("#renameInput"); if (document.activeElement !== ri) ri.value = m.name;
  $("#meHint").textContent = m.team ? `You're on ${TEAM[m.team]} as ${m.role === "spy" ? "spymaster" : "an operative"}.` : "Pick a side below to play, or stay out to watch.";

  const teamCard = (t) => {
    const spy = S.players.find((p) => p.team === t && p.role === "spy");
    const ops = S.players.filter((p) => p.team === t && p.role === "op");
    const mineSpy = m.team === t && m.role === "spy", mineOp = m.team === t && m.role === "op";
    return `<div class="team-card ${t}">
      <div class="team-head">${glyph(t)}<span class="team-title">${TEAM[t]}</span><span class="team-count">${(spy ? 1 : 0) + ops.length} players</span></div>
      <p class="slot-label">Spymaster</p>
      ${spy ? `<ul class="people">${personRow(spy)}</ul>` : `<div class="empty-slot">Nobody yet</div>`}
      ${mineSpy ? `<button class="btn slim ghost" data-seat="${t}:op" type="button">Step down to operative</button>`
        : !spy ? `<button class="btn slim ${t}" data-seat="${t}:spy" type="button">Be the spymaster</button>` : ""}
      <p class="slot-label">Operatives</p>
      ${ops.length ? `<ul class="people">${ops.map((p) => personRow(p)).join("")}</ul>` : `<div class="empty-slot">Nobody yet</div>`}
      ${mineOp ? "" : `<button class="btn ${t}" data-seat="${t}:op" type="button">Join ${TEAM[t]}</button>`}
    </div>`;
  };
  const watchers = S.players.filter((p) => !p.team);
  $("#lobbyTeams").innerHTML = teamCard("E") + teamCard("A") + `
    <div class="team-card watch">
      <div class="team-head"><span class="label">Not on a side yet · ${watchers.length}</span>
      ${isHost() ? `<button class="btn slim ghost" style="margin-left:auto" data-randomize type="button">Shuffle everyone into teams</button>` : ""}</div>
      ${watchers.length ? `<ul class="people">${watchers.map((p) => personRow(p)).join("")}</ul>` : `<div class="empty-slot">Everyone has picked a side</div>`}
      ${m.team ? `<button class="btn slim ghost" data-seat="none" type="button">Leave my side</button>` : ""}
    </div>`;

  // start panel
  const checks = [
    ["Ministry has a spymaster", !!S.players.find((p) => p.team === "E" && p.role === "spy")],
    ["Authority has a spymaster", !!S.players.find((p) => p.team === "A" && p.role === "spy")],
    ["Each side has at least one operative", S.players.some((p) => p.team === "E" && p.role === "op") && S.players.some((p) => p.team === "A" && p.role === "op")],
    [`At least 20 words switched on (${S.poolSize} now)`, S.poolSize >= 20],
  ];
  const ready = !S.readiness.length;
  $("#startPanel").innerHTML = `<h2 class="label">Ready to dive?</h2>
    <ul class="checklist">${checks.map(([t, ok]) => `<li class="${ok ? "ok" : ""}">${esc(t)}</li>`).join("")}</ul>
    ${isHost() ? `<button class="btn gold big" data-start type="button" ${ready ? "" : "disabled"}>Start the game</button>`
      : `<p class="hint">Waiting for <b>${esc(playerById(S.hostId)?.name || "the host")}</b> to start the game.</p>`}`;

  // settings
  const host = isHost(), dis = host ? "" : "disabled";
  const packs = meta.packs.length ? meta.packs : S.settings.packs.map((id) => ({ id, name: id, count: "" }));
  const sp = $("#settingsPanel");
  const ta = sp.querySelector("#customWords");
  const keepCustom = ta && document.activeElement === ta ? ta.value : null;
  sp.innerHTML = `<h2 class="label">Game settings ${host ? "" : "<span class='label dim'>· host only</span>"}</h2>
    <label class="field" for="timerSel"><span>Turn timer</span>
      <select id="timerSel" ${dis}>${meta.timers.map((t) => `<option value="${t}" ${S.settings.timer === t ? "selected" : ""}>${t ? `${t / 60 >= 1 && t % 60 === 0 ? t / 60 + " min" : t + " sec"} per turn` : "No timer"}</option>`).join("")}</select></label>
    <div class="field"><span>Word packs</span>
      <div class="packs">${packs.map((p) => `<label class="pack"><input type="checkbox" data-pack="${esc(p.id)}" ${S.settings.packs.includes(p.id) ? "checked" : ""} ${dis}> ${esc(p.name)} <span class="count">${p.count}</span></label>`).join("")}</div></div>
    <label class="field" for="customWords"><span>Your own words</span>
      <textarea id="customWords" placeholder="Comma or one per line, e.g. Mudskipper King, Sharko Soup" ${dis}>${esc(S.settings.custom.join("\n"))}</textarea></label>
    <span class="pool">${S.poolSize} words in the deck · 20 are dealt each game</span>`;
  if (keepCustom !== null) { const t = $("#customWords"); t.value = keepCustom; t.focus(); }
}

// lobby actions
document.addEventListener("click", async (e) => {
  const b = e.target.closest("button"); if (!b || !S) return;
  if (b.dataset.seat) {
    if (b.dataset.seat === "none") return act("seat", { team: null, role: "op" });
    const [team, role] = b.dataset.seat.split(":");
    return act("seat", { team, role });
  }
  if (b.dataset.kick) return confirmBox(`Remove ${playerById(b.dataset.kick)?.name || "this player"} from the room?`, "Remove", () => act("kick", { id: b.dataset.kick }));
  if (b.dataset.mkhost) return act("makeHost", { id: b.dataset.mkhost });
  if (b.hasAttribute("data-randomize")) return act("randomize");
  if (b.hasAttribute("data-start")) return act("start");
  if (b.hasAttribute("data-copy")) return copyLink();
  if (b.hasAttribute("data-share")) { try { await navigator.share({ title: "Deepnames", text: `Join my Deepnames room ${S.code}`, url: roomLink(S.code) }); } catch {} return; }
  if (b.hasAttribute("data-invite")) return openSheet("invite");
});
document.addEventListener("change", (e) => {
  if (!S) return;
  if (e.target.id === "timerSel") act("settings", { settings: { timer: Number(e.target.value) } });
  if (e.target.dataset.pack !== undefined) {
    const packs = $$("[data-pack]").filter((x) => x.checked).map((x) => x.dataset.pack);
    act("settings", { settings: { packs } });
  }
  if (e.target.id === "customWords") act("settings", { settings: { custom: e.target.value } });
});
$("#renameForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const n = $("#renameInput").value.trim();
  const res = await act("rename", { name: n });
  if (!res.error) { store.set("dn.name", n); toast("Name updated."); }
});
async function copyLink() {
  const link = roomLink(S.code);
  try { await navigator.clipboard.writeText(link); toast("Link copied. Send it to your party."); }
  catch { toast(link); }
}

// ---------- game ----------
function renderGame() {
  const g = S.game, m = me();
  $("#gameCode").textContent = S.code;
  const lastScore = renderGame.score || {};
  $("#scores").innerHTML = ["E", "A"].map((t) => `<span class="score ${t} ${lastScore.id === g.id && lastScore[t] !== g.remaining[t] ? "pop" : ""}">${glyph(t)}<b>${g.remaining[t]}</b><span>${TEAM[t]} left</span></span>`).join("");
  renderGame.score = { id: g.id, E: g.remaining.E, A: g.remaining.A };
  $("#game").classList.toggle("doom", g.phase === "over" && g.reason === "assassin");

  // board
  if (boardGameId !== g.id) buildBoard(g);
  const board = $("#board");
  const keyview = g.roles.some((r, i) => r && !g.revealed[i]);
  board.classList.toggle("keyview", keyview);
  const guess = canGuess();
  g.words.forEach((w, i) => {
    const el = cardEls[i], role = g.roles[i];
    if (role) { el.dataset.role = role; el.querySelector(".glyph use").setAttribute("href", `#g-${role}`); el.querySelector(".keyglyph use").setAttribute("href", `#g-${role}`); }
    else delete el.dataset.role;
    el.classList.toggle("rev", g.revealed[i]);
    el.querySelector(".by").textContent = g.revealedBy[i] ? `by ${g.revealedBy[i]}` : "";
    const marks = (g.marks[i] || []).map((id) => playerById(id)?.name || "?");
    el.classList.toggle("marked", !!marks.length && !g.revealed[i]);
    el.classList.toggle("mine", (g.marks[i] || []).includes(S.you));
    const markHtml = g.revealed[i] ? "" : marks.slice(0, 3).map((n) => `<span>${esc(n)}</span>`).join("") + (marks.length > 3 ? `<span>+${marks.length - 3}</span>` : "");
    const mk = el.querySelector(".marks");
    if (mk.dataset.html !== markHtml) { mk.innerHTML = markHtml; mk.dataset.html = markHtml; }
    const can = guess && !g.revealed[i];
    el.classList.toggle("can", can);
    el.setAttribute("aria-label", `${w}${g.revealed[i] ? ", revealed" : ""}${role && !g.revealed[i] ? `, ${role === "X" ? ASSASSIN : role === "B" ? "bystander" : TEAM[role]}` : ""}`);
    el.tabIndex = can ? 0 : -1;
  });

  renderTurnPanel();

  // viewer note
  let note = "";
  if (g.phase !== "over") {
    if (!m.team) note = g.sawKey ? "You're watching. You've seen the key this game, so you can rejoin a side next game." : "You're watching. Join a side from the panels to play.";
    else if (m.role === "spy") note = "You're the spymaster: you see the key. Red is Ministry, blue is Authority, sand is a bystander, black is the Vantablack Warrior.";
  }
  $("#viewerNote").textContent = note;

  // team sides
  for (const t of ["E", "A"]) {
    const spy = S.players.find((p) => p.team === t && p.role === "spy");
    const ops = S.players.filter((p) => p.team === t && p.role === "op");
    const active = g.phase !== "over" && g.turn === t;
    const canJoin = !m.team; // switching sides mid-game isn't allowed; watchers can join
    const el = $("#side" + t);
    el.className = `team-side ${t} ${active ? "active" : ""}`;
    el.innerHTML = `${active ? `<span class="turn-flag">${g.phase === "clue" ? "GIVING CLUE" : "GUESSING"}</span>` : ""}
      <div class="team-head">${glyph(t)}<span class="team-title">${TEAM[t]}</span></div>
      <div class="left-big"><b>${g.remaining[t]}</b><span>of ${g.total[t]} agents left</span></div>
      <div class="pips">${Array.from({ length: g.total[t] }, (_, k) => `<i class="${k < g.total[t] - g.remaining[t] ? "gone" : ""}"></i>`).join("")}</div>
      <p class="slot-label">Spymaster</p>
      ${spy ? `<ul class="people">${personRow(spy, { actions: false })}</ul>` : `<div class="empty-slot">Empty seat</div>${g.phase !== "over" && (!m.team || m.team === t) && m.role !== "spy" ? `<button class="btn slim ${t}" data-seat="${t}:spy" type="button">Take the spymaster seat</button>` : ""}`}
      <p class="slot-label">Operatives</p>
      ${ops.length ? `<ul class="people">${ops.map((p) => personRow(p, { actions: false })).join("")}</ul>` : `<div class="empty-slot">Nobody</div>`}
      ${g.phase !== "over" && canJoin && !(m.role === "spy" && m.team) && !g.sawKey ? `<button class="btn slim ${t}" data-seat="${t}:op" type="button">Join as operative</button>` : ""}
      ${g.clues[t].length ? `<p class="slot-label">Clues</p><ul class="clue-hist">${g.clues[t].map((c) => `<li><span>${esc(c.word)} · ${c.n === "inf" ? "∞" : c.n}</span><span class="hits">${c.hits} found</span></li>`).join("")}</ul>` : ""}`;
  }

  // log
  $("#log").innerHTML = g.log.slice().reverse().map(logLine).join("");

  // result overlay
  if (g.phase === "over" && overlayFor !== g.id) showResult();
  if (g.phase !== "over") $("#overlay").hidden = true;
}

function logLine(e) {
  const T = (t) => teamName(t);
  switch (e.k) {
    case "start": return `<li class="${e.team}">${T(e.team)} goes first.</li>`;
    case "clue": return `<li class="${e.team}"><b>${esc(e.by)}</b> gave the clue <b>${esc(e.word)} · ${e.n === "inf" ? "∞" : e.n}</b></li>`;
    case "reveal": return `<li class="${e.role === "X" ? "X" : e.team}"><b>${esc(e.by)}</b> revealed <b>${esc(e.word)}</b>: ${ROLE_LINE[e.role]}</li>`;
    case "out": return `<li class="${e.team}">${T(e.team)} used all their guesses.</li>`;
    case "end": return `<li class="${e.team}"><b>${esc(e.by)}</b> ended the ${T(e.team)} turn.</li>`;
    case "timeout": return `<li class="${e.team}">${T(e.team)} ran out of time.</li>`;
    case "win": return `<li class="${e.team}"><b>${T(e.team)} wins!</b></li>`;
    case "ended": return `<li>The host ended the game.</li>`;
    default: return "";
  }
}

// Size every card word so its longest part fits on one line, measured with the real font.
const measure = document.createElement("canvas").getContext("2d");
function fitWords() {
  const phone = innerWidth <= 640;
  measure.font = '700 100px "Cinzel Decorative", Cinzel, Georgia, serif';
  const minReadable = phone ? 11.5 : 13;
  $$("#board .word").forEach((el) => {
    const plate = el.parentElement, cs = getComputedStyle(plate);
    const back = !!el.closest(".back");
    const availW = plate.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 6;
    const availH = plate.clientHeight * (back ? 0.62 : 0.78);
    if (availW <= 0) return;
    const word = el.dataset.word || (el.dataset.word = el.textContent);
    const max = back ? (phone ? 14 : 19) : (phone ? 16 : 24);
    const space = measure.measureText(" ").width / 100;
    const fit = (parts, forced) => {
      const unit = parts.map((t) => measure.measureText(t).width / 100);
      let size = Math.min(max, (availW / Math.max(...unit)) * 0.98);
      const lineCount = (sz) => {
        let n = 1, line = 0;
        unit.forEach((u, k) => {
          const w = u * sz;
          if (line && (forced.has(k) || line + space * sz + w > availW)) { n++; line = w; } else line += (line ? space * sz : 0) + w;
        });
        return n;
      };
      while (size > 9 && lineCount(size) * size * 1.12 > availH) size -= 0.5;
      return size;
    };
    let parts = word.split(/\s+/);
    let size = fit(parts, new Set());
    let html = esc(word);
    // A single long name too small to read: break it with a hyphen instead of shrinking it.
    if (size < minReadable && parts.some((p) => p.length >= 8)) {
      const out = [], forced = new Set(), pieces = [];
      parts.forEach((p) => {
        if (p.length >= 8) { const [a, b] = splitWord(p); out.push(a + "-"); out.push(b); forced.add(out.length - 1); pieces.push(`${esc(a)}-<br>${esc(b)}`); }
        else { out.push(p); pieces.push(esc(p)); }
      });
      const split = fit(out, forced);
      if (split > size + 1) { size = split; html = pieces.join(" "); }
    }
    if (el.innerHTML !== html) el.innerHTML = html;
    el.style.fontSize = Math.max(9, size).toFixed(1) + "px";
  });
}
// Where to hyphenate a long name: at an existing hyphen, before a known word part
// (Rime-breakers, Kyrs-glass, Necro-skipper), or else at a syllable-like break near the middle.
const WORD_PARTS = ["breakers", "breaker", "shaper", "finder", "skipper", "glass", "charm", "draw", "call", "breathe", "cast", "sing", "rend",
  "walker", "strider", "striker", "warder", "seer", "heart", "kindred", "trimmer", "chemist", "harper", "weaver", "daunt", "sucker",
  "knight", "blade", "edge", "spark", "thorn", "claw", "splitter", "crusher", "bound", "skipper", "spindle", "spear", "fouler", "smith",
  "light", "less", "fire", "stone", "storm", "wind", "frost", "shadow", "iron", "blood", "keeper", "guard", "lord", "master", "point", "tooth",
  "power", "villager", "born", "fish", "fang", "glaive", "cleave", "screen", "sieger", "eye", "mare", "shoe", "monger", "scraper", "trick", "medallions", "pools", "wright"];
const DIGRAPHS = new Set(["th", "sh", "ch", "ck", "gh", "ph", "wh", "qu", "ng", "kn", "wr"]);
function splitWord(w) {
  if (w.includes("-")) { const k = w.indexOf("-"); return [w.slice(0, k), w.slice(k + 1)]; }
  const low = w.toLowerCase();
  for (const part of WORD_PARTS) {
    const k = low.lastIndexOf(part);
    if (k >= 3 && w.length - k >= 3 && k + part.length === w.length) return [w.slice(0, k), w.slice(k)];
  }
  const V = /[aeiouy]/i, C = (ch) => !!ch && /[a-z]/i.test(ch) && !V.test(ch), mid = w.length / 2;
  let best = null, bestScore = Infinity;
  for (let i = 3; i <= w.length - 3; i++) {
    let s = Math.abs(i - mid);
    if (C(w[i - 1]) && C(w[i]) && V.test(w[i - 2]) && V.test(w[i + 1] || "")) s -= 0.5;      // VC|CV
    else if (V.test(w[i - 1]) && C(w[i]) && V.test(w[i + 1] || "")) s -= 0.25;              // V|CV
    else s += 2;
    if (DIGRAPHS.has((w[i - 1] + w[i]).toLowerCase())) s += 4;
    if (s < bestScore) { bestScore = s; best = i; }
  }
  return [w.slice(0, best), w.slice(best)];
}
if (document.fonts && document.fonts.load) document.fonts.load('700 100px "Cinzel Decorative"').then(fitWords).catch(() => {});
let fitRaf = 0;
addEventListener("resize", () => { cancelAnimationFrame(fitRaf); fitRaf = requestAnimationFrame(fitWords); });

function buildBoard(g) {
  const board = $("#board");
  board.innerHTML = "";
  cardEls = g.words.map((w, i) => {
    const len = Math.max(...w.split(/\s+/).map((p) => p.length));
    const el = document.createElement("div");
    el.className = "card deal"; el.setAttribute("role", "button"); el.dataset.i = i;
    el.style.setProperty("--i", i);
    setTimeout(() => el.classList.remove("deal"), 1800 + i * 60);
    el.innerHTML = `<div class="flip">
        <div class="face front"><div class="plate"><span class="shine"></span><svg class="keyglyph" viewBox="0 0 64 64" aria-hidden="true"><use href="#g-B"/></svg><span class="word" style="--len:${len}">${esc(w)}</span></div></div>
        <div class="face back"><div class="plate"><svg class="glyph" viewBox="0 0 64 64" aria-hidden="true"><use href="#g-B"/></svg><span class="word" style="--len:${len}">${esc(w)}</span><span class="by"></span></div></div>
      </div><div class="marks"></div><button class="confirm" type="button" tabindex="-1">Reveal</button>`;
    el.addEventListener("click", (e) => {
      if (e.target.closest(".confirm")) { e.stopPropagation(); act("reveal", { i }); return; }
      if (el.classList.contains("can")) act("mark", { i });
      else if (S.game.phase === "clue" && !S.game.revealed[i] && me().team === S.game.turn && me().role === "op") toast(`Wait for your spymaster's clue.`);
    });
    el.addEventListener("keydown", (e) => {
      if (!el.classList.contains("can")) return;
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); el.classList.contains("marked") ? act("reveal", { i }) : act("mark", { i }); }
    });
    board.appendChild(el);
    return el;
  });
  boardGameId = g.id;
  requestAnimationFrame(fitWords);
}

function renderTurnPanel() {
  const g = S.game, m = me(), tp = $("#turnPanel");
  const focusedClue = document.activeElement && document.activeElement.id === "clueInput";
  if (focusedClue && g.phase === "clue" && m.team === g.turn && m.role === "spy") { updateTimer(); return; } // don't wipe a clue being typed
  const needsMe = (g.phase === "clue" && m.team === g.turn && m.role === "spy") || canGuess();
  tp.className = `turn-panel ${g.phase === "over" ? "over" : g.turn} ${needsMe ? "mine" : ""}`;
  const clueKey = `${g.id}:${g.turnNo}:${g.phase}`;
  const slam = g.phase === "guess" && renderTurnPanel.clueKey !== clueKey;
  renderTurnPanel.clueKey = clueKey;
  const spy = S.players.find((p) => p.team === g.turn && p.role === "spy");
  let html = "";
  if (g.phase === "over") {
    const title = g.reason === "ended" ? "Game ended" : `${TEAM[g.winner]} wins`;
    html = `<div class="turn-line"><span class="turn-who">${g.winner ? glyph(g.winner) : ""}${esc(title)}</span>
      <button class="btn slim" data-result type="button">Show result</button></div>
      ${isHost() ? hostAfterButtons() : `<p class="turn-sub">Waiting for the host to start the next game.</p>`}`;
  } else if (g.phase === "clue") {
    if (m.team === g.turn && m.role === "spy") {
      html = `<div class="turn-line"><span class="turn-who">${glyph(g.turn)}Your turn, spymaster</span><span class="timer-text" id="timerText"></span></div>
        <form class="clue-form" id="clueForm" autocomplete="off">
          <div class="row"><label class="sr" for="clueInput">Clue word</label><input id="clueInput" maxlength="24" placeholder="One-word clue" enterkeyhint="send" autocapitalize="characters">
          <button class="btn gold" type="submit">Give clue</button></div>
          <div class="nums" role="group" aria-label="Number of cards">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 0, "inf"].map((n) => `<button type="button" data-num="${n}" aria-pressed="${pickedNum === n}">${n === "inf" ? "∞" : n}</button>`).join("")}</div>
          <p class="turn-sub">Pick how many cards your clue points to. 0 or ∞ gives unlimited guesses.</p>
          <p class="form-error" id="clueError"></p>
        </form>`;
    } else {
      html = `<div class="turn-line"><span class="turn-who">${glyph(g.turn)}${POSS[g.turn]} turn</span><span class="timer-text" id="timerText"></span></div>
        <p class="turn-sub">${spy ? `Waiting for <b>${esc(spy.name)}</b>, the ${TEAM[g.turn]} spymaster, to give a clue.` : `${TEAM[g.turn]} has no spymaster. Someone needs to take the seat.`}</p>`;
    }
  } else {
    const myTurn = canGuess();
    const left = g.guessesLeft === null ? "Unlimited guesses" : `${g.guessesLeft} guess${g.guessesLeft === 1 ? "" : "es"} left`;
    html = `<div class="turn-line"><span class="turn-who">${glyph(g.turn)}${TEAM[g.turn]} guessing</span><span class="timer-text" id="timerText"></span></div>
      <div class="turn-line"><div class="clue-show ${slam ? "slam" : ""}"><span class="clue-word">${esc(g.clue.word)}</span><span class="clue-num">${g.clue.n === "inf" ? "∞" : g.clue.n}</span></div>
      <div class="guess-info"><span class="guess-count">${left}</span>${myTurn ? `<button class="btn slim" data-endturn type="button" ${g.guessesMade < 1 ? "disabled title='Make at least one guess first'" : ""}>End turn</button>` : ""}</div></div>
      <p class="turn-sub">${myTurn ? "Tap a card to suggest it to your team, then press <b>Reveal</b> on it." : m.team === g.turn && m.role === "spy" ? "Your operatives are guessing. Stay quiet!" : `${TEAM[g.turn]} operatives are guessing.`}</p>`;
  }
  if (g.deadline && g.phase !== "over") html += `<div class="timer"><i id="timerBar"></i></div>`;
  tp.innerHTML = html;
  const form = $("#clueForm");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const word = $("#clueInput").value.trim(), err = $("#clueError");
      if (pickedNum === null) { err.textContent = "Pick a number too."; return; }
      const res = await emit("act", { type: "clue", word, n: pickedNum });
      if (res.error) err.textContent = res.error; else { pickedNum = null; }
    });
    $$("[data-num]", form).forEach((b) => b.addEventListener("click", () => {
      pickedNum = b.dataset.num === "inf" ? "inf" : Number(b.dataset.num);
      $$("[data-num]", form).forEach((x) => x.setAttribute("aria-pressed", x === b));
    }));
  }
  updateTimer();
}

function hostAfterButtons() {
  return `<div class="btn-row"><button class="btn gold" data-rematch="0" type="button">New game</button>
    <button class="btn" data-rematch="1" type="button">New game, swap spymasters</button>
    <button class="btn ghost" data-lobby type="button">Back to lobby</button></div>`;
}

document.addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b || !S || !S.game) return;
  if (b.hasAttribute("data-endturn")) act("endTurn");
  if (b.dataset.rematch !== undefined) { $("#overlay").hidden = true; act("rematch", { rotate: b.dataset.rematch === "1" }); }
  if (b.hasAttribute("data-lobby")) { $("#overlay").hidden = true; act("lobby"); }
  if (b.hasAttribute("data-result")) { overlayFor = null; showResult(); }
});

function updateTimer() {
  const g = S && S.game, txt = $("#timerText"), bar = $("#timerBar");
  if (!g || !g.deadline || g.phase === "over") { if (txt) txt.textContent = ""; return; }
  const total = S.settings.timer * 1000, left = Math.max(0, g.deadline - (Date.now() + clockOffset));
  if (txt) {
    const s = Math.ceil(left / 1000);
    txt.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    txt.classList.toggle("low", s <= 10);
    $("#turnPanel").classList.toggle("urgent", s <= 10 && s > 0);
    if (s <= 5 && s > 0 && updateTimer.last !== s && me().team === g.turn) sfx.tick();
    updateTimer.last = s;
  }
  if (bar) bar.style.transform = `scaleX(${total ? left / total : 0})`;
}
setInterval(updateTimer, 250);

function showResult() {
  const g = S.game, ov = $("#overlay");
  let cls = g.winner || "", title, body, art;
  if (g.reason === "assassin") { cls = "X"; art = "X"; title = "The Vantablack Warrior rises"; body = `${TEAM[g.byTeam]} woke the Vantablack Warrior. ${TEAM[g.winner]} wins.`; }
  else if (g.reason === "agents") { art = g.winner; title = `${TEAM[g.winner]} wins`; body = `Every ${TEAM[g.winner]} agent has been found.`; }
  else if (g.reason === "gift") { art = g.winner; title = `${TEAM[g.winner]} wins`; body = `${TEAM[g.byTeam]} revealed the last ${TEAM[g.winner]} agent for them.`; }
  else { art = "B"; title = "Game ended"; body = "The host ended the game early."; }
  const m = me();
  const verdict = g.winner && m.team ? (m.team === g.winner ? "Your side won." : "Your side lost.") : "";
  ov.className = `overlay ${cls}`;
  ov.innerHTML = `<div class="rays" aria-hidden="true"></div><div class="ov" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="ov-art">${glyph(art)}</div><h2>${esc(title)}</h2><p>${esc(body)} ${esc(verdict)}</p>
    ${isHost() ? hostAfterButtons() : `<p class="hint">Waiting for the host to start the next game.</p>`}
    <button class="btn ghost" data-closeov type="button">View the board</button></div>`;
  ov.hidden = false;
  overlayFor = g.id;
}
document.addEventListener("click", (e) => { if (e.target.closest("[data-closeov]")) $("#overlay").hidden = true; });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") { $("#overlay").hidden = true; closeSheet(); } });

// ---------- effects: sounds + animations driven by state changes ----------
function effects(a, b) {
  if (!b || !b.game) return;
  const g = b.game, m = b.players.find((p) => p.id === b.you) || {};
  if (!a || !a.game || a.game.id !== g.id) {
    if (window.FX) FX.clear(); // never carry smoke or darkness into a new game
    if (a) {
      overlayFor = null; sfx.start(); sfx.deal();
      setTimeout(() => banner(`${TEAM[g.first]} goes first`, m.team === g.first ? "Your side has 7 agents" : "20 cards dealt", g.first), 900);
    }
    return;
  }
  const og = a.game;
  g.revealed.forEach((r, i) => {
    if (r && !og.revealed[i]) {
      const el = cardEls[i];
      const role = g.roles[i], guesser = og.turn;
      if (el) {
        el.classList.add("flipping", "just");
        setTimeout(() => el.classList.remove("flipping"), 800);
        setTimeout(() => el.classList.remove("just"), 1400);
        setTimeout(() => window.FX && FX.reveal(el, role, role === guesser), 330);
      }
      sfx.flip();
      if (role === "X") { sfx.doom(); shake(); }
      else if (role === guesser) sfx.good();
      else if (role === "B") sfx.neutral();
      else { sfx.bad(); shake(true); }
    }
  });
  if (og.phase === "clue" && g.phase === "guess") { sfx.bell(); banner(`${g.clue.word} · ${g.clue.n === "inf" ? "∞" : g.clue.n}`, `${TEAM[g.turn]} clue from ${g.clue.by}`, g.turn); }
  if (og.phase !== "over" && g.phase === "over") {
    const sameGame = () => S && S.game && S.game.id === g.id && S.game.phase === "over";
    if (g.reason === "assassin") setTimeout(() => sameGame() && window.FX && FX.doom(), 500);
    else if (g.winner) setTimeout(() => { if (!sameGame()) return; sfx.win(); window.FX && FX.celebrate(g.winner); }, 600);
  }
  if (g.phase === "clue" && og.turn !== g.turn && og.phase !== "over") {
    setTimeout(() => banner(`${POSS[g.turn]} turn`, m.team === g.turn ? (m.role === "spy" ? "Give your clue" : "Your spymaster is thinking") : "", g.turn), 900);
    if (m.team === g.turn) setTimeout(() => sfx.turn(), 900);
  }
  if (g.phase !== "over" && m.team === g.turn) document.title = g.phase === "clue" && m.role === "spy" ? "Your clue · Deepnames" : g.phase === "guess" && m.role === "op" ? "Your turn · Deepnames" : "Deepnames";
  else document.title = "Deepnames";
}

// ---------- side sheet (menu + invite) ----------
function openSheet(kind) { sheetOpen = kind; renderSheet(); }
function closeSheet() { sheetOpen = null; const s = $("#sheet"); s.hidden = true; s.innerHTML = ""; }
$("#menuBtn").onclick = () => openSheet("menu");
let pendingConfirm = null;
function confirmBox(text, label, fn) { pendingConfirm = { text, label, fn }; openSheet(sheetOpen || "confirm"); }
function renderSheet() {
  if (!S) return closeSheet();
  const s = $("#sheet"), g = S.game, host = isHost();
  const invite = `<section><h2 class="label">Invite</h2><img class="qr" src="/qr/${S.code}.svg" alt="QR code to join" width="200" height="200">
    <span class="room-code">${S.code}</span><span class="link">${esc(roomLink(S.code).replace(/^https?:\/\//, ""))}</span>
    <div class="btn-row"><button class="btn slim" data-copy type="button">Copy link</button></div></section>`;
  const conf = pendingConfirm ? `<div class="confirm-box"><p style="margin:0">${esc(pendingConfirm.text)}</p><div class="btn-row">
    <button class="btn slim danger" data-confirm-yes type="button">${esc(pendingConfirm.label)}</button><button class="btn slim ghost" data-confirm-no type="button">Cancel</button></div></div>` : "";
  let body = "";
  if (sheetOpen === "invite") body = invite;
  else if (sheetOpen === "confirm") body = conf;
  else {
    const watchers = S.players.filter((p) => !p.team);
    body = `${conf}${invite}
      <section><h2 class="label">Your name</h2><form id="sheetRename" class="rename"><input id="sheetName" maxlength="20" value="${esc(me().name)}"><button class="btn slim" type="submit">Rename</button></form></section>
      <section><h2 class="label">Players</h2><ul class="people">${S.players.map((p) => personRow(p)).join("")}</ul>
        <p class="hint">${watchers.length} watching.${host ? " As host you can hand over hosting or remove players here." : ""}</p></section>
      ${me().team && g && g.phase !== "over" ? `<section><button class="btn ghost" data-seat="none" type="button">Leave my side and watch</button></section>` : ""}
      ${host && g ? `<section><h2 class="label">Host</h2>${g.phase !== "over" ? `<button class="btn danger" data-endgame type="button">End this game</button>` : hostAfterButtons()}
        <button class="btn ghost" data-lobby type="button">Back to lobby</button></section>` : ""}
      <section><button class="btn ghost" data-leave type="button">Leave the room</button></section>`;
  }
  s.innerHTML = `<div class="sheet-body" role="dialog" aria-modal="true" aria-label="Menu"><div class="sheet-head"><span class="wordmark small">Deepnames</span><button class="btn slim ghost" data-closesheet type="button">Close</button></div>${body}</div>`;
  s.hidden = false;
  const f = $("#sheetRename");
  if (f) f.onsubmit = async (e) => { e.preventDefault(); const n = $("#sheetName").value.trim(); const r = await act("rename", { name: n }); if (!r.error) { store.set("dn.name", n); toast("Name updated."); } };
}
document.addEventListener("click", (e) => {
  const s = $("#sheet");
  if (!s.hidden && e.target === s) { pendingConfirm = null; closeSheet(); return; }
  const b = e.target.closest("button"); if (!b) return;
  if (b.hasAttribute("data-closesheet")) { pendingConfirm = null; closeSheet(); }
  if (b.hasAttribute("data-confirm-yes")) { const fn = pendingConfirm && pendingConfirm.fn; pendingConfirm = null; if (sheetOpen === "confirm") closeSheet(); else renderSheet(); fn && fn(); }
  if (b.hasAttribute("data-confirm-no")) { pendingConfirm = null; if (sheetOpen === "confirm") closeSheet(); else renderSheet(); }
  if (b.hasAttribute("data-endgame")) confirmBox("End this game for everyone? The board will be revealed.", "End game", () => act("endGame"));
  if ((b.hasAttribute("data-lobby") || b.dataset.rematch !== undefined) && sheetOpen) closeSheet();
});

renderHome();
})();
