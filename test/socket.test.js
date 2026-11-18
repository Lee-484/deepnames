// End-to-end over real sockets: 5 players, full games, sync + secrecy checks.
const assert = require("assert/strict");
const { io: Client } = require("socket.io-client");
const { server, rooms } = require("../server");

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function client(port, id) {
  const s = Client(`http://localhost:${port}`, { transports: ["websocket"], forceNew: true });
  const c = { s, id, token: id + "-token-xyz", state: null, kicked: false };
  s.on("state", (st) => { c.state = st; });
  s.on("kicked", () => { c.kicked = true; });
  c.call = (ev, data) => new Promise((res) => s.emit(ev, data, res));
  c.act = (type, data = {}) => c.call("act", { type, ...data });
  return c;
}
async function settle(cs, pred = () => true) {
  for (let k = 0; k < 100; k++) { await wait(20); if (cs.every((c) => c.state) && pred()) return; }
}

(async () => {
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const host = client(port, "host-aaaa-1"), espy = client(port, "espy-bbbb-2"), aspy = client(port, "aspy-cccc-3"), aop = client(port, "aop-dddd-4"), watcher = client(port, "watch-eeee-5");
  const all = [host, espy, aspy, aop, watcher];
  await Promise.all(all.map((c) => new Promise((r) => c.s.on("connect", r))));

  const meta = await host.call("meta", {});
  assert.ok(meta.packs.length >= 5);

  const created = await host.call("create", { pid: host.id, token: host.token, name: "Host" });
  assert.ok(created.code && /^[A-Z]{4}$/.test(created.code), JSON.stringify(created));
  const code = created.code;
  assert.ok((await host.call("join", { code: "ZZZZ", pid: host.id, token: host.token, name: "Host" })).error);
  for (const [c, n] of [[espy, "Espy"], [aspy, "Aspy"], [aop, "Aop"], [watcher, "Watcher"]]) {
    const r = await c.call("join", { code, pid: c.id, token: c.token, name: n });
    assert.equal(r.code, code, JSON.stringify(r));
  }
  await settle(all, () => all.every((c) => c.state.players.length === 5));
  for (const c of all) assert.equal(c.state.players.length, 5, "everyone sees everyone in the lobby");

  assert.ok((await host.act("start")).error, "can't start without teams");
  await host.act("seat", { team: "E", role: "op" });
  await espy.act("seat", { team: "E", role: "spy" });
  assert.ok((await aop.act("seat", { team: "E", role: "spy" })).error, "one spymaster per side");
  await aspy.act("seat", { team: "A", role: "spy" });
  await aop.act("seat", { team: "A", role: "op" });
  assert.ok((await espy.act("start")).error, "only host starts");

  let games = 0, ethiron = 0, wins = 0;
  for (let round = 0; round < 6; round++) {
    const r = round === 0 ? await host.act("start") : await host.act("rematch", { rotate: false });
    assert.ok(r.ok, JSON.stringify(r));
    await settle(all, () => all.every((c) => c.state.game && c.state.game.phase === "clue" && c.state.game.id === host.state.game.id));
    const room = rooms.get(code);
    const ops = { E: host, A: aop }, spies = { E: espy, A: aspy };
    let guard = 0;
    while (room.game.phase !== "over" && guard++ < 200) {
      const g = room.game, t = g.turn;
      // secrecy: operatives and watchers never receive unrevealed roles
      await settle(all, () => all.every((c) => c.state.game.turnNo === g.turnNo && c.state.game.phase === g.phase));
      for (const c of [host, aop, watcher]) c.state.game.roles.forEach((x, i) => assert.ok(x === null || c.state.game.revealed[i], "role leaked to an operative"));
      for (const c of [espy, aspy]) assert.ok(c.state.game.roles.every((x) => x), "spymaster sees key");
      // sync: every device shows the same board
      const sig = (st) => JSON.stringify([st.game.words, st.game.revealed, st.game.turn, st.game.phase, st.game.clue, st.game.remaining]);
      for (const c of all) assert.equal(sig(c.state), sig(host.state), "devices out of sync");

      if (g.phase === "clue") {
        assert.ok((await ops[t].act("clue", { word: "qzv", n: 1 })).error, "operative can't give clue");
        let res;
        for (const w of ["qzvx", "jjkw", "vvqq"]) { res = await spies[t].act("clue", { word: w, n: 2 }); if (res.ok) break; }
        assert.ok(res.ok, JSON.stringify(res));
      } else {
        assert.ok((await spies[t].act("reveal", { i: 0 })).error, "spymaster can't guess");
        // pick a random unrevealed card, mark it, then reveal
        const open = g.words.map((_, i) => i).filter((i) => !g.revealed[i]);
        const i = open[Math.floor(Math.random() * open.length)];
        assert.ok((await ops[t].act("mark", { i })).ok);
        await settle(all, () => all.every((c) => (c.state.game.marks[i] || []).length === 1));
        const res = await ops[t].act("reveal", { i });
        assert.ok(res.ok, JSON.stringify(res));
      }
    }
    assert.equal(room.game.phase, "over", "game finished");
    games++; if (room.game.reason === "ethiron") ethiron++; else wins++;
    await settle(all, () => all.every((c) => c.state.game.phase === "over"));
    for (const c of all) assert.ok(c.state.game.roles.every((x) => x), "full key shown at the end");
  }

  // mid-game join and reconnect
  await host.act("rematch", { rotate: true });
  await settle(all, () => all.every((c) => c.state.game && c.state.game.phase === "clue"));
  const late = client(port, "late-ffff-6");
  await new Promise((r) => late.s.on("connect", r));
  await late.call("join", { code, pid: late.id, token: late.token, name: "Late" });
  await settle([late, host], () => late.state && late.state.game && host.state.players.length === 6);
  assert.ok(late.state.game.roles.every((x) => x === null), "late joiner sees no key");
  espy.s.disconnect();
  await settle([host], () => host.state.players.find((p) => p.id === espy.id && !p.online));
  assert.equal(host.state.players.find((p) => p.id === espy.id).online, false, "disconnect shows offline");
  const espy2 = client(port, espy.id); espy2.token = espy.token;
  await new Promise((r) => espy2.s.on("connect", r));
  const back = await espy2.call("join", { code, pid: espy.id, token: espy.token });
  assert.ok(back.ok, JSON.stringify(back));
  await settle([espy2, host], () => espy2.state && host.state.players.find((p) => p.id === espy.id).online);
  assert.ok(host.state.players.find((p) => p.id === espy.id).online, "reconnected");
  // kick
  await host.act("kick", { id: watcher.id });
  await settle([watcher], () => watcher.kicked);
  assert.ok(watcher.kicked, "kicked player told");

  console.log(`socket.test.js: ${games} full games over sockets (${wins} by agents, ${ethiron} by Ethiron), sync, secrecy, late join, reconnect and kick all OK`);
  for (const c of [...all, late, espy2]) c.s.close();
  server.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
