// Rule tests for game.js. Run: node test/game.test.js
const assert = require("assert/strict");
const { Room, GameError } = require("../game");

let n = 0;
function test(name, fn) { try { fn(); n++; } catch (e) { console.error("FAIL:", name); throw e; } }
const throws = (fn, re) => assert.throws(fn, (e) => e instanceof GameError && (!re || re.test(e.message)));

function setup() {
  const r = new Room("TEST");
  for (const [id, name] of [["p-host-0001", "Host"], ["p-espy-0002", "Espy"], ["p-eop1-0003", "Eop"], ["p-aspy-0004", "Aspy"], ["p-aop1-0005", "Aop"], ["p-watch-006", "Watcher"]]) r.join(id, id + "-tok", name);
  r.seat("p-espy-0002", "E", "spy"); r.seat("p-eop1-0003", "E", "op"); r.seat("p-host-0001", "E", "op");
  r.seat("p-aspy-0004", "A", "spy"); r.seat("p-aop1-0005", "A", "op");
  return r;
}
const spyOf = (t) => (t === "E" ? "p-espy-0002" : "p-aspy-0004");
const opOf = (t) => (t === "E" ? "p-eop1-0003" : "p-aop1-0005");
const idx = (r, role) => r.game.roles.findIndex((x, i) => x === role && !r.game.revealed[i]);
const safeClue = (r) => { // a clue that can't collide with board words
  for (const w of ["zzqx", "qqvv", "xxjj", "vvkk"]) { try { r.validateClue(w); return w; } catch {} }
  throw new Error("no safe clue");
};

test("board composition", () => {
  const r = setup(); r.start("p-host-0001");
  const g = r.game;
  assert.equal(g.words.length, 20);
  assert.equal(new Set(g.words.map((w) => w.toLowerCase())).size, 20);
  const c = (x) => g.roles.filter((y) => y === x).length;
  assert.equal(c(g.first), 7); assert.equal(c(g.first === "E" ? "A" : "E"), 6); assert.equal(c("B"), 6); assert.equal(c("X"), 1);
  assert.equal(g.turn, g.first); assert.equal(g.phase, "clue");
  for (const w of g.words) assert.ok(!/etris|etrea|authority|ethiron/i.test(w), w);
});

test("only host starts; start needs both spymasters + operatives", () => {
  const r = setup();
  throws(() => r.start("p-eop1-0003"), /host/);
  r.seat("p-aop1-0005", null, "op");
  throws(() => r.start("p-host-0001"), /operative/);
});

test("operatives never see unrevealed roles; spymasters do", () => {
  const r = setup(); r.start("p-host-0001");
  const opView = r.view("p-eop1-0003").game, spyView = r.view("p-espy-0002").game, watch = r.view("p-watch-006").game;
  assert.ok(opView.roles.every((x) => x === null));
  assert.ok(watch.roles.every((x) => x === null));
  assert.ok(spyView.roles.every((x) => x !== null));
});

test("only the current spymaster may give a clue; clue rules enforced", () => {
  const r = setup(); r.start("p-host-0001");
  const t = r.game.turn, o = t === "E" ? "A" : "E";
  throws(() => r.giveClue(spyOf(o), "zzqx", 1), /Only/);
  throws(() => r.giveClue(opOf(t), "zzqx", 1), /Only/);
  throws(() => r.giveClue(spyOf(t), "two words", 1), /single word/);
  const single = r.game.words.find((w) => /^[\p{L}]+$/u.test(w)) || "Mudskipper";
  if (r.game.words.includes(single)) throws(() => r.giveClue(spyOf(t), single, 1), /board|close/);
  const tok = (r.game.words.find((w) => w.includes(" ")) || single).split(" ")[0];
  if (tok.length >= 3) throws(() => r.giveClue(spyOf(t), tok + "ish", 1), /close|board/);
  throws(() => r.giveClue(spyOf(t), "zzqx", 10), /number/);
  r.giveClue(spyOf(t), safeClue(r), 2);
  assert.equal(r.game.phase, "guess"); assert.equal(r.game.guessesLeft, 3);
  throws(() => r.giveClue(spyOf(t), "qqvv", 1), /already/);
});

test("guess limits: N+1 then turn passes; must guess before ending", () => {
  const r = setup(); r.start("p-host-0001");
  const t = r.game.turn;
  r.giveClue(spyOf(t), safeClue(r), 1);
  throws(() => r.endGuessing(opOf(t)), /at least one/);
  throws(() => r.reveal(spyOf(t), idx(r, t)), /operatives/);
  throws(() => r.reveal(opOf(t === "E" ? "A" : "E"), idx(r, t)), /operatives/);
  r.reveal(opOf(t), idx(r, t)); assert.equal(r.game.turn, t); assert.equal(r.game.guessesLeft, 1);
  r.reveal(opOf(t), idx(r, t)); assert.notEqual(r.game.turn, t); assert.equal(r.game.phase, "clue");
});

test("bystander and enemy agent end the turn; enemy agent counts for them", () => {
  const r = setup(); r.start("p-host-0001");
  let t = r.game.turn, o = t === "E" ? "A" : "E";
  r.giveClue(spyOf(t), safeClue(r), 3);
  r.reveal(opOf(t), idx(r, "B"));
  assert.equal(r.game.turn, o);
  r.giveClue(spyOf(o), safeClue(r), 3);
  const before = r.remaining(t);
  r.reveal(opOf(o), idx(r, t));
  assert.equal(r.remaining(t), before - 1); assert.equal(r.game.turn, t);
});

test("unlimited guesses with 0 or ∞; end turn after a guess", () => {
  const r = setup(); r.start("p-host-0001");
  const t = r.game.turn;
  r.giveClue(spyOf(t), safeClue(r), 0);
  assert.equal(r.game.guessesLeft, null);
  for (let k = 0; k < 4; k++) r.reveal(opOf(t), idx(r, t));
  assert.equal(r.game.turn, t);
  r.endGuessing(opOf(t));
  assert.notEqual(r.game.turn, t);
  const o = r.game.turn;
  r.giveClue(spyOf(o), safeClue(r), "inf"); assert.equal(r.game.guessesLeft, null);
});

test("Ethiron loses instantly", () => {
  const r = setup(); r.start("p-host-0001");
  const t = r.game.turn;
  r.giveClue(spyOf(t), safeClue(r), 1);
  r.reveal(opOf(t), idx(r, "X"));
  assert.equal(r.game.phase, "over"); assert.equal(r.game.reason, "ethiron"); assert.equal(r.game.winner, t === "E" ? "A" : "E");
  assert.ok(r.view("p-eop1-0003").game.roles.every((x) => x)); // key shown at the end
  throws(() => r.reveal(opOf(t), 0), /no game/);
});

test("finding all your agents wins; revealing the rival's last agent hands them the win", () => {
  let r = setup(); r.start("p-host-0001");
  const t = r.game.turn;
  r.giveClue(spyOf(t), safeClue(r), "inf");
  for (let k = 0; k < 7; k++) r.reveal(opOf(t), idx(r, t));
  assert.equal(r.game.phase, "over"); assert.equal(r.game.winner, t); assert.equal(r.game.reason, "agents");

  r = setup(); r.start("p-host-0001");
  const t2 = r.game.turn, o2 = t2 === "E" ? "A" : "E";
  // burn the other side down to its last agent through their own turns
  r.giveClue(spyOf(t2), safeClue(r), 1); r.reveal(opOf(t2), idx(r, "B"));
  r.giveClue(spyOf(o2), safeClue(r), "inf");
  for (let k = 0; k < 5; k++) r.reveal(opOf(o2), idx(r, o2));
  r.endGuessing(opOf(o2));
  r.giveClue(spyOf(t2), safeClue(r), 1);
  r.reveal(opOf(t2), idx(r, o2));
  assert.equal(r.game.winner, o2); assert.equal(r.game.reason, "gift");
});

test("marks: toggle, only current operatives, cleared on turn change", () => {
  const r = setup(); r.start("p-host-0001");
  const t = r.game.turn;
  throws(() => r.mark(opOf(t), 0), /clue/);
  r.giveClue(spyOf(t), safeClue(r), 1);
  const i = idx(r, "B");
  r.mark(opOf(t), i); assert.deepEqual([...r.game.marks.get(i)], [opOf(t)]);
  r.mark(opOf(t), i); assert.equal(r.game.marks.has(i), false);
  r.mark(opOf(t), i);
  throws(() => r.mark(spyOf(t), i), /operatives/);
  r.reveal(opOf(t), i); assert.equal(r.game.marks.size, 0);
});

test("anti-cheat: anyone who saw the key can't become an operative this game", () => {
  const r = setup(); r.start("p-host-0001");
  throws(() => r.seat("p-espy-0002", "E", "op"), /seen the key/);
  r.seat("p-espy-0002", null, "op");
  throws(() => r.seat("p-espy-0002", "A", "op"), /seen the key/);
  throws(() => r.seat("p-watch-006", "A", "spy"), /already has/);
  throws(() => r.seat("p-aop1-0005", "E", "op"), /switch sides/);
  r.seat("p-watch-006", "E", "op"); // spectators can join as operatives mid-game
  r.seat("p-watch-006", "E", "spy"); // empty seat now: allowed, and they've now seen the key
  throws(() => r.seat("p-watch-006", "E", "op"), /seen the key/);
});

test("rematch rotates spymasters and resets the board", () => {
  const r = setup(); r.start("p-host-0001");
  const old = r.game.id;
  r.rematch("p-host-0001", true);
  assert.notEqual(r.game.id, old);
  assert.notEqual(r.spyOf("E").id, "p-espy-0002");
  assert.equal(r.game.phase, "clue");
});

test("identity: wrong token can't hijack a seat; kicked players stay out", () => {
  const r = setup();
  throws(() => r.join("p-espy-0002", "wrong-token-x", "Evil"), /belongs/);
  r.kick("p-host-0001", "p-watch-006");
  throws(() => r.join("p-watch-006", "p-watch-006-tok", "Back"), /removed/);
  throws(() => r.kick("p-eop1-0003", "p-aop1-0005"), /host/);
});

test("host leaves -> new host chosen", () => {
  const r = setup();
  for (const p of r.players.values()) p.online = true;
  r.leave("p-host-0001");
  assert.ok(r.hostId && r.hostId !== "p-host-0001");
});

test("settings validated", () => {
  const r = setup();
  throws(() => r.updateSettings("p-host-0001", { timer: 7 }), /timer/);
  r.updateSettings("p-host-0001", { timer: 90, packs: ["places", "bogus"], custom: "Alpha, Beta\nGamma" });
  assert.equal(r.settings.timer, 90); assert.deepEqual(r.settings.packs, ["places"]); assert.deepEqual(r.settings.custom, ["Alpha", "Beta", "Gamma"]);
  r.updateSettings("p-host-0001", { packs: [] , custom: [] });
  throws(() => r.start("p-host-0001"), /word packs/);
});

console.log(`game.test.js: ${n} tests passed`);
