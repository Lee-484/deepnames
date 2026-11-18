// Deepnames game rules. The server holds one Room per game code and is the only
// source of truth: clients send intents, the room validates them, and every
// device receives a fresh snapshot after each change.

const crypto = require("crypto");
const { PACKS, wordsFor, defaultPacks } = require("./words");

const BOARD = 20;            // 4 × 5
const FIRST_TEAM_AGENTS = 7; // the team that starts gets one extra agent
const SECOND_TEAM_AGENTS = 6;
const ASSASSIN = 1; // the Vantablack Warrior
const BYSTANDERS = BOARD - FIRST_TEAM_AGENTS - SECOND_TEAM_AGENTS - ASSASSIN; // 6
const MAX_PLAYERS = 30;
const TIMER_CHOICES = [0, 60, 90, 120, 180, 240];
const TEAM_NAME = { E: "Ministry", A: "Authority" }; // internal codes: E = Ministry (red), A = Authority (blue), B = bystander, X = Vantablack Warrior

class GameError extends Error {}
const fail = (msg) => { throw new GameError(msg); };
const other = (t) => (t === "E" ? "A" : "E");
const rand = (n) => crypto.randomInt(n);
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const fold = (s) => String(s).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
const tokens = (s) => fold(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
const squash = (s) => fold(s).replace(/[^\p{L}\p{N}]/gu, "");

function cleanName(name) {
  const n = String(name ?? "").replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, 20);
  if (!n) fail("Pick a name first.");
  return n;
}

class Room {
  constructor(code, { onChange } = {}) {
    this.code = code;
    this.players = new Map();
    this.hostId = null;
    this.seq = 0;
    this.kicked = new Set();
    this.settings = { timer: 0, packs: defaultPacks(), custom: [] };
    this.game = null;
    this.onChange = onChange || (() => {});
    this.timer = null;
    this.lastActive = Date.now();
  }

  // ---------- players ----------
  join(pid, token, name) {
    if (typeof pid !== "string" || pid.length < 8 || pid.length > 64) fail("Bad player id.");
    if (typeof token !== "string" || token.length < 8 || token.length > 128) fail("Bad player token.");
    if (this.kicked.has(pid)) fail("The host removed you from this room.");
    let p = this.players.get(pid);
    if (p) {
      if (p.token !== token) fail("That player slot belongs to someone else.");
      if (name) p.name = cleanName(name);
    } else {
      if (this.players.size >= MAX_PLAYERS) fail("This room is full.");
      p = { id: pid, token, name: cleanName(name), team: null, role: "op", online: false, sockets: new Set(), order: this.seq++ };
      this.players.set(pid, p);
      if (!this.hostId) this.hostId = pid;
    }
    this.touch();
    return p;
  }

  leave(pid) {
    const p = this.players.get(pid);
    if (!p) return;
    this.players.delete(pid);
    if (this.game) this.clearMarksBy(pid);
    if (this.hostId === pid) this.pickNewHost();
  }

  pickNewHost() {
    const online = [...this.players.values()].filter((p) => p.online).sort((a, b) => a.order - b.order);
    const any = [...this.players.values()].sort((a, b) => a.order - b.order);
    this.hostId = (online[0] || any[0] || {}).id || null;
  }

  player(pid) {
    const p = this.players.get(pid);
    if (!p) fail("You're not in this room.");
    return p;
  }
  requireHost(pid) { if (pid !== this.hostId) fail("Only the host can do that."); }
  spyOf(team) { return [...this.players.values()].find((p) => p.team === team && p.role === "spy") || null; }
  opsOf(team) { return [...this.players.values()].filter((p) => p.team === team && p.role === "op").sort((a, b) => a.order - b.order); }

  rename(pid, name) { this.player(pid).name = cleanName(name); }

  seat(pid, team, role) {
    const p = this.player(pid);
    if (team !== null && team !== "E" && team !== "A") fail("Unknown team.");
    if (role !== "op" && role !== "spy") fail("Unknown role.");
    const g = this.game;
    if (team === null) {
      p.team = null; p.role = "op";
      if (g) this.clearMarksBy(pid);
      return;
    }
    if (g && g.phase !== "over" && p.team && p.team !== team) fail("You can't switch sides in the middle of a game.");
    if (role === "spy") {
      const holder = this.spyOf(team);
      if (holder && holder.id !== pid) fail(`${TEAM_NAME[team]} already has a spymaster.`);
      if (g && g.phase !== "over") g.sawKey.add(pid);
      if (g) this.clearMarksBy(pid);
    } else if (g && g.phase !== "over" && g.sawKey.has(pid)) {
      fail("You've seen the key this game, so you can't guess until the next one.");
    }
    p.team = team; p.role = role;
  }

  kick(byPid, pid) {
    this.requireHost(byPid);
    if (pid === byPid) fail("You can't remove yourself.");
    if (!this.players.has(pid)) fail("That player already left.");
    this.kicked.add(pid);
    this.leave(pid);
  }

  makeHost(byPid, pid) {
    this.requireHost(byPid);
    if (!this.players.has(pid)) fail("That player already left.");
    this.hostId = pid;
  }

  randomizeTeams(byPid) {
    this.requireHost(byPid);
    if (this.game && this.game.phase !== "over") fail("Finish or end the current game first.");
    const list = shuffle([...this.players.values()]);
    list.forEach((p, i) => { p.team = i % 2 ? "A" : "E"; p.role = "op"; });
    for (const t of ["E", "A"]) { const first = list.find((p) => p.team === t); if (first) first.role = "spy"; }
  }

  updateSettings(byPid, s) {
    this.requireHost(byPid);
    if (s == null || typeof s !== "object") fail("Bad settings.");
    if (s.timer !== undefined) {
      const t = Number(s.timer);
      if (!TIMER_CHOICES.includes(t)) fail("Pick a timer from the list.");
      this.settings.timer = t;
    }
    if (s.packs !== undefined) {
      if (!Array.isArray(s.packs)) fail("Bad word packs.");
      this.settings.packs = s.packs.filter((id) => typeof id === "string" && PACKS[id]);
    }
    if (s.custom !== undefined) {
      const list = Array.isArray(s.custom) ? s.custom : String(s.custom).split(/[\n,]+/);
      this.settings.custom = list.map((w) => String(w).replace(/[\u0000-\u001f]/g, "").trim()).filter((w) => w && w.length <= 24).slice(0, 400);
    }
  }

  pool() { return wordsFor(this.settings.packs, this.settings.custom); }

  // ---------- game lifecycle ----------
  readiness() {
    const issues = [];
    for (const t of ["E", "A"]) {
      if (!this.spyOf(t)) issues.push(`${TEAM_NAME[t]} needs a spymaster`);
      if (!this.opsOf(t).length) issues.push(`${TEAM_NAME[t]} needs at least one operative`);
    }
    if (this.pool().length < BOARD) issues.push(`Turn on more word packs (need ${BOARD} words)`);
    return issues;
  }

  start(byPid) {
    this.requireHost(byPid);
    if (this.game && this.game.phase !== "over") fail("A game is already running.");
    const issues = this.readiness();
    if (issues.length) fail(issues[0] + ".");
    const words = shuffle(this.pool()).slice(0, BOARD);
    const first = rand(2) ? "E" : "A";
    const roles = shuffle([
      ...Array(FIRST_TEAM_AGENTS).fill(first),
      ...Array(SECOND_TEAM_AGENTS).fill(other(first)),
      ...Array(BYSTANDERS).fill("B"),
      ...Array(ASSASSIN).fill("X"),
    ]);
    this.game = {
      id: crypto.randomUUID(),
      words, roles,
      revealed: Array(BOARD).fill(false),
      revealedBy: Array(BOARD).fill(null),
      first, turn: first,
      phase: "clue",
      clue: null, guessesLeft: null, guessesMade: 0,
      marks: new Map(),
      log: [{ k: "start", team: first }],
      clues: { E: [], A: [] },
      sawKey: new Set([this.spyOf("E").id, this.spyOf("A").id]),
      winner: null, reason: null, deadline: null, turnNo: 1, startedAt: Date.now(),
    };
    this.armTimer();
  }

  rematch(byPid, rotate) {
    this.requireHost(byPid);
    if (rotate) {
      for (const t of ["E", "A"]) {
        const spy = this.spyOf(t), ops = this.opsOf(t);
        if (!spy || !ops.length) continue;
        const next = ops.find((p) => p.order > spy.order) || ops[0];
        spy.role = "op"; next.role = "spy";
      }
    }
    if (this.game) this.game.phase = "over";
    this.start(byPid);
  }

  toLobby(byPid) {
    this.requireHost(byPid);
    this.clearTimer();
    this.game = null;
  }

  // ---------- turns ----------
  currentOp(pid) {
    const g = this.game;
    if (!g || g.phase === "over") fail("There's no game running.");
    if (g.phase !== "guess") fail(`Wait for the ${TEAM_NAME[g.turn]} spymaster's clue.`);
    const p = this.player(pid);
    if (p.team !== g.turn || p.role !== "op") fail(`Only ${TEAM_NAME[g.turn]} operatives can guess right now.`);
    return p;
  }

  validateClue(word) {
    const w = String(word ?? "").trim();
    if (!w) fail("Type a clue.");
    if (w.length > 24) fail("Keep the clue under 24 letters.");
    if (/\s/.test(w)) fail("Clues must be a single word.");
    if (!/^[\p{L}\p{N}'’-]+$/u.test(w)) fail("Use letters only in the clue.");
    const sq = squash(w);
    if (!sq) fail("Use letters only in the clue.");
    const g = this.game;
    for (let i = 0; i < BOARD; i++) {
      if (g.revealed[i]) continue;
      const word = g.words[i];
      if (squash(word) === sq) fail(`"${word}" is on the board.`);
      for (const t of tokens(word)) {
        if (t === sq || (t.length >= 3 && sq.includes(t)) || (sq.length >= 3 && t.includes(sq))) {
          fail(`Too close to "${word}", which is still on the board.`);
        }
      }
    }
    return w;
  }

  giveClue(pid, word, number) {
    const g = this.game;
    if (!g || g.phase === "over") fail("There's no game running.");
    if (g.phase !== "clue") fail("A clue is already in play.");
    const p = this.player(pid);
    if (p.team !== g.turn || p.role !== "spy") fail(`Only the ${TEAM_NAME[g.turn]} spymaster can give this clue.`);
    const w = this.validateClue(word);
    let n;
    if (number === "inf") n = "inf";
    else {
      n = Number(number);
      if (!Number.isInteger(n) || n < 0 || n > 9) fail("Pick a number from 0 to 9, or ∞.");
    }
    const unlimited = n === "inf" || n === 0;
    g.clue = { word: w.toUpperCase(), n, by: p.name };
    g.guessesLeft = unlimited ? null : n + 1;
    g.guessesMade = 0;
    g.phase = "guess";
    g.clues[g.turn].push({ word: w.toUpperCase(), n, hits: 0 });
    g.log.push({ k: "clue", team: g.turn, by: p.name, word: w.toUpperCase(), n });
    this.armTimer();
  }

  mark(pid, i) {
    const p = this.currentOp(pid);
    const g = this.game;
    i = this.cardIndex(i);
    if (g.revealed[i]) fail("That card is already revealed.");
    const set = g.marks.get(i) || new Set();
    if (set.has(p.id)) set.delete(p.id); else set.add(p.id);
    if (set.size) g.marks.set(i, set); else g.marks.delete(i);
  }

  reveal(pid, i) {
    const p = this.currentOp(pid);
    const g = this.game;
    i = this.cardIndex(i);
    if (g.revealed[i]) fail("That card is already revealed.");
    g.revealed[i] = true;
    g.revealedBy[i] = p.name;
    g.marks.delete(i);
    const role = g.roles[i], team = g.turn;
    g.log.push({ k: "reveal", team, by: p.name, word: g.words[i], role, i });

    if (role === "X") return this.finish(other(team), "assassin", team);
    if (role === "E" || role === "A") {
      if (this.remaining(role) === 0) return this.finish(role, role === team ? "agents" : "gift", team);
    }
    if (role === team) {
      g.guessesMade++;
      const cur = g.clues[team][g.clues[team].length - 1];
      if (cur) cur.hits++;
      if (g.guessesLeft !== null) {
        g.guessesLeft--;
        if (g.guessesLeft <= 0) { g.log.push({ k: "out", team }); return this.passTurn(); }
      }
      return;
    }
    this.passTurn();
  }

  endGuessing(pid) {
    this.currentOp(pid);
    const g = this.game;
    if (g.guessesMade < 1) fail("You must make at least one guess before ending your turn.");
    g.log.push({ k: "end", team: g.turn, by: this.players.get(pid).name });
    this.passTurn();
  }

  passTurn() {
    const g = this.game;
    g.turn = other(g.turn);
    g.phase = "clue";
    g.clue = null; g.guessesLeft = null; g.guessesMade = 0;
    g.marks.clear();
    g.turnNo++;
    this.armTimer();
  }

  finish(winner, reason, byTeam) {
    const g = this.game;
    g.phase = "over"; g.winner = winner; g.reason = reason; g.loser = other(winner); g.byTeam = byTeam;
    g.marks.clear(); g.deadline = null;
    g.log.push({ k: "win", team: winner, reason });
    this.clearTimer();
  }

  endGame(byPid) {
    this.requireHost(byPid);
    const g = this.game;
    if (!g || g.phase === "over") fail("There's no game running.");
    g.phase = "over"; g.winner = null; g.reason = "ended"; g.marks.clear(); g.deadline = null;
    g.log.push({ k: "ended" });
    this.clearTimer();
  }

  remaining(team) {
    const g = this.game;
    return g.roles.reduce((n, r, i) => n + (r === team && !g.revealed[i] ? 1 : 0), 0);
  }
  cardIndex(i) {
    const n = Number(i);
    if (!Number.isInteger(n) || n < 0 || n >= BOARD) fail("Unknown card.");
    return n;
  }
  clearMarksBy(pid) {
    const g = this.game;
    if (!g) return;
    for (const [i, set] of g.marks) { set.delete(pid); if (!set.size) g.marks.delete(i); }
  }

  // ---------- timer ----------
  clearTimer() { if (this.timer) clearTimeout(this.timer); this.timer = null; }
  armTimer() {
    this.clearTimer();
    const g = this.game;
    if (!g || g.phase === "over" || !this.settings.timer) { if (g) g.deadline = null; return; }
    g.deadline = Date.now() + this.settings.timer * 1000;
    const turnNo = g.turnNo, phase = g.phase;
    this.timer = setTimeout(() => {
      const cur = this.game;
      if (!cur || cur !== g || cur.turnNo !== turnNo || cur.phase !== phase) return;
      cur.log.push({ k: "timeout", team: cur.turn, phase });
      this.passTurn();
      this.onChange(this);
    }, this.settings.timer * 1000 + 250);
    if (this.timer.unref) this.timer.unref();
  }

  touch() { this.lastActive = Date.now(); }
  anyoneOnline() { for (const p of this.players.values()) if (p.online) return true; return false; }

  // ---------- what each device is allowed to see ----------
  view(pid) {
    const me = this.players.get(pid);
    const g = this.game;
    const players = [...this.players.values()].sort((a, b) => a.order - b.order)
      .map((p) => ({ id: p.id, name: p.name, team: p.team, role: p.role, online: p.online }));
    const out = {
      code: this.code, you: pid, hostId: this.hostId, players,
      settings: { ...this.settings, custom: this.settings.custom.slice() },
      poolSize: this.pool().length, readiness: this.readiness(), serverNow: Date.now(),
      game: null,
    };
    if (g) {
      const over = g.phase === "over";
      const seesKey = over || !!(me && me.team && me.role === "spy");
      out.game = {
        id: g.id, words: g.words,
        roles: g.roles.map((r, i) => (seesKey || g.revealed[i] ? r : null)),
        revealed: g.revealed, revealedBy: g.revealedBy,
        first: g.first, turn: g.turn, phase: g.phase, clue: g.clue,
        guessesLeft: g.guessesLeft, guessesMade: g.guessesMade,
        marks: Object.fromEntries([...g.marks].map(([i, s]) => [i, [...s]])),
        log: g.log.slice(-80), clues: g.clues,
        remaining: { E: this.remaining("E"), A: this.remaining("A") },
        total: { E: g.roles.filter((r) => r === "E").length, A: g.roles.filter((r) => r === "A").length },
        winner: g.winner, reason: g.reason, loser: g.loser || null, byTeam: g.byTeam || null,
        deadline: g.deadline, turnNo: g.turnNo,
        sawKey: !!(me && g.sawKey.has(me.id)),
      };
    }
    return out;
  }
}

function makeCode(taken) {
  const A = "BCDFGHJKLMNPQRSTVWXZ"; // consonants only: no accidental words, no 0/O or 1/I mix-ups
  for (let tries = 0; tries < 1000; tries++) {
    let c = "";
    for (let i = 0; i < 4; i++) c += A[rand(A.length)];
    if (!taken.has(c)) return c;
  }
  throw new Error("Could not allocate a room code");
}

module.exports = { Room, GameError, makeCode, BOARD, TIMER_CHOICES, TEAM_NAME };
