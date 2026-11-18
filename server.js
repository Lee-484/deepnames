// Deepnames server: serves the web app and runs every room over Socket.IO.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");
const QRCode = require("qrcode");
const { Room, GameError, makeCode, TIMER_CHOICES } = require("./game");
const { packSummary } = require("./words");

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC = path.join(__dirname, "public");
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json" };
const rooms = new Map();
const CODE_RE = /^[A-Z]{4}$/;

function originOf(req) {
  const proto = (req.headers["x-forwarded-proto"] || "http").split(",")[0].trim();
  const host = (req.headers["x-forwarded-host"] || req.headers.host || `localhost:${PORT}`).split(",")[0].trim();
  return `${proto}://${host}`;
}

// A build id from the files themselves. The page links its scripts and styles with
// ?v=<build>, so every deploy forces browsers to fetch the new files.
const BUILD = (() => {
  const h = require("crypto").createHash("sha1");
  for (const f of fs.readdirSync(PUBLIC).sort()) { try { h.update(f); h.update(fs.readFileSync(path.join(PUBLIC, f))); } catch {} }
  return h.digest("hex").slice(0, 8);
})();
const COMMIT = (process.env.RENDER_GIT_COMMIT || "").slice(0, 7);
let indexHtml = null;
function sendIndex(res) {
  if (!indexHtml) {
    indexHtml = fs.readFileSync(path.join(PUBLIC, "index.html"), "utf8")
      .replace(/(src|href)="\/(app\.js|fx\.js|style\.css)"/g, `$1="/$2?v=${BUILD}"`)
      .replace("{{BUILD}}", `build ${BUILD}${COMMIT ? ` · ${COMMIT}` : ""}`);
  }
  res.writeHead(200, { "Content-Type": MIME[".html"], "Cache-Control": "no-store" });
  res.end(indexHtml);
}

function sendFile(res, file, status = 200) {
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { "Content-Type": "text/plain" }); return res.end("Not found"); }
    const ext = path.extname(file);
    res.writeHead(status, { "Content-Type": MIME[ext] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const p = decodeURIComponent(url.pathname);
  if (p === "/healthz") { res.writeHead(200, { "Content-Type": "text/plain" }); return res.end("ok"); }
  if (p === "/version") { res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" }); return res.end(JSON.stringify({ build: BUILD, commit: COMMIT || null })); }
  const qr = p.match(/^\/qr\/([A-Za-z]{4})\.svg$/);
  if (qr) {
    const link = `${originOf(req)}/r/${qr[1].toUpperCase()}`;
    try {
      const svg = await QRCode.toString(link, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#1b120a", light: "#efe0b8" } });
      res.writeHead(200, { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=3600" });
      return res.end(svg);
    } catch { res.writeHead(500); return res.end(); }
  }
  if (p === "/" || p === "/index.html" || /^\/r\/[A-Za-z]{4}\/?$/.test(p)) return sendIndex(res);
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
  sendFile(res, file);
});

const io = new Server(server, { pingInterval: 10000, pingTimeout: 8000, maxHttpBufferSize: 64 * 1024 });

function broadcast(room) {
  for (const p of room.players.values()) {
    if (!p.sockets.size) continue;
    const state = room.view(p.id);
    for (const sid of p.sockets) io.to(sid).emit("state", state);
  }
}

function getRoom(code) {
  const c = String(code || "").toUpperCase();
  if (!CODE_RE.test(c)) throw new GameError("Room codes are 4 letters.");
  const room = rooms.get(c);
  if (!room) throw new GameError(`Room ${c} doesn't exist. Check the code or create a new room.`);
  return room;
}

const hostTimers = new Map();

io.on("connection", (socket) => {
  let room = null, pid = null;
  let bucket = 40, last = Date.now();
  const limited = () => {
    const now = Date.now();
    bucket = Math.min(40, bucket + ((now - last) / 1000) * 15); last = now;
    if (bucket < 1) return true;
    bucket--; return false;
  };

  function attach(r, p) {
    if (room && room !== r) detach();
    room = r; pid = p.id;
    p.sockets.add(socket.id); p.online = true;
    socket.join(r.code);
    clearTimeout(hostTimers.get(r.code + pid));
  }
  function detach() {
    if (!room) return;
    const r = room, p = r.players.get(pid);
    socket.leave(r.code);
    if (p) {
      p.sockets.delete(socket.id);
      if (!p.sockets.size) {
        p.online = false;
        if (r.hostId === p.id) {
          const key = r.code + p.id;
          hostTimers.set(key, setTimeout(() => {
            hostTimers.delete(key);
            const still = r.players.get(p.id);
            if (r.hostId === p.id && (!still || !still.online)) { r.pickNewHost(); broadcast(r); }
          }, 20000));
        }
      }
    }
    room = null; pid = null;
    broadcast(r);
  }

  const handle = (fn) => (payload, ack) => {
    const reply = typeof ack === "function" ? ack : () => {};
    if (limited()) return reply({ error: "Slow down a little." });
    try {
      const result = fn(payload || {}) || {};
      reply({ ok: true, ...result });
    } catch (e) {
      if (e instanceof GameError) reply({ error: e.message });
      else { console.error(e); reply({ error: "Something went wrong on the server." }); }
    }
  };

  socket.on("meta", handle(() => ({ packs: packSummary(), timers: TIMER_CHOICES })));

  socket.on("create", handle(({ pid: id, token, name }) => {
    const code = makeCode(rooms);
    const r = new Room(code, { onChange: broadcast });
    const p = r.join(id, token, name);
    rooms.set(code, r);
    attach(r, p);
    broadcast(r);
    return { code };
  }));

  socket.on("join", handle(({ code, pid: id, token, name }) => {
    const r = getRoom(code);
    const p = r.join(id, token, name);
    attach(r, p);
    broadcast(r);
    return { code: r.code };
  }));

  socket.on("leave", handle(() => {
    if (!room) return;
    const r = room, id = pid;
    detach();
    r.leave(id);
    broadcast(r);
  }));

  socket.on("act", handle(({ type, ...a }) => {
    if (!room) throw new GameError("You're not in a room. Refresh the page to rejoin.");
    const r = room;
    r.touch();
    switch (type) {
      case "rename": r.rename(pid, a.name); break;
      case "seat": r.seat(pid, a.team ?? null, a.role || "op"); break;
      case "settings": r.updateSettings(pid, a.settings); break;
      case "randomize": r.randomizeTeams(pid); break;
      case "kick": {
        const target = r.players.get(a.id);
        r.kick(pid, a.id);
        if (target) for (const sid of target.sockets) { const s = io.sockets.sockets.get(sid); if (s) { s.emit("kicked"); s.leave(r.code); } }
        break;
      }
      case "makeHost": r.makeHost(pid, a.id); break;
      case "start": r.start(pid); break;
      case "rematch": r.rematch(pid, !!a.rotate); break;
      case "lobby": r.toLobby(pid); break;
      case "endGame": r.endGame(pid); break;
      case "clue": r.giveClue(pid, a.word, a.n); break;
      case "mark": r.mark(pid, a.i); break;
      case "reveal": r.reveal(pid, a.i); break;
      case "endTurn": r.endGuessing(pid); break;
      default: throw new GameError("Unknown action.");
    }
    broadcast(r);
  }));

  socket.on("disconnect", () => detach());
});

// Tidy up rooms nobody has touched in a while.
setInterval(() => {
  const now = Date.now();
  for (const [code, r] of rooms) {
    if (!r.anyoneOnline() && now - r.lastActive > 3 * 60 * 60 * 1000) { r.clearTimer(); rooms.delete(code); }
  }
}, 10 * 60 * 1000).unref();

if (require.main === module) {
  server.listen(PORT, () => console.log(`Deepnames running on http://localhost:${PORT}`));
}

module.exports = { server, io, rooms };
