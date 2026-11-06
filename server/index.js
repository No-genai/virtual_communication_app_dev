import { validBadge, atCampfire } from "../shared/learning.js";
import { createLearning } from "./learning.js";
import { DEFAULT_LOOK, DEFAULT_SCENERY, validLook } from "../shared/play.js";
import { createPlay } from "./play.js";
import { EMOTES, TRAVEL_MODES, TRAVEL_SPEED } from "../shared/actions.js";
import { validTheme, VILLAGES } from "../shared/themes.js";
import { AVATARS, validAvatar } from "../shared/avatars.js";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { randomBytes, randomUUID, randomInt } from "node:crypto";
import { Server } from "socket.io";
import {
  walkable,
  collisionObjects,
  near,
  validName,
  canTalk,
  template,
  spawnPoint,
  villageAt,
  villageSpawn,
} from "./world.js";
import {
  openStore,
  initialRoom,
  hashPassword,
  checkPassword,
} from "./store.js";
const store = await openStore(),
  rooms = store.rooms,
  players = new Map(),
  sessions = new Map(),
  blocked = new Map(),
  limits = new Map(),
  polls = new Map(),
  identities = new Map();
const production = process.env.NODE_ENV === "production";
const vite = production
  ? null
  : await (
      await import("vite")
    ).createServer({ server: { middlewareMode: true }, appType: "spa" });
let iceServers = [];
if (process.env.ICE_SERVERS) {
  iceServers = JSON.parse(process.env.ICE_SERVERS);
  if (!Array.isArray(iceServers))
    throw new Error("ICE_SERVERS must be a JSON array");
}
function limit(key, max, period) {
  const now = Date.now();
  let bucket = limits.get(key);
  if (!bucket || now > bucket.until) {
    bucket = { count: 0, until: now + period };
    limits.set(key, bucket);
  }
  return ++bucket.count <= max;
}
setInterval(() => {
  const now = Date.now();
  for (const [key, v] of limits) if (now > v.until) limits.delete(key);
  for (const [key, v] of sessions) if (now > v.expires) sessions.delete(key);
  for (const [key, v] of identities)
    if (now > v.expires) identities.delete(key);
}, 60000).unref();
const server = createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Permissions-Policy",
    "camera=(self), microphone=(self), display-capture=(self)",
  );
  if (production)
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' ws: wss:; img-src 'self' data:; media-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );
  if (req.url === "/health") {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true, participants: players.size }));
    return;
  }
  if (vite) {
    vite.middlewares(req, res);
    return;
  }
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    const file = pathname === "/" ? "index.html" : pathname.slice(1);
    const root = resolve("dist");
    const path = resolve(root, file);
    if (!path.startsWith(root + "/")) {
      res.writeHead(403).end();
      return;
    }
    const data = await readFile(path);
    res.setHeader(
      "Content-Type",
      {
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript",
        ".css": "text/css",
      }[extname(path)] || "application/octet-stream",
    );
    res.end(data);
  } catch {
    res.writeHead(404).end("Not found");
  }
});
const io = new Server(server, {
  maxHttpBufferSize: 65536,
  allowRequest: (req, cb) => {
    const origin = req.headers.origin;
    cb(
      null,
      (!origin ||
        origin ===
          (process.env.PUBLIC_ORIGIN || `http://${req.headers.host}`)) &&
        limit("connect:" + req.socket.remoteAddress, 120, 60000),
    );
  },
});
const roomPlayers = (id) => [...players.values()].filter((p) => p.room === id);
const publicRoom = (r) => ({
  id: r.id,
  name: r.name,
  description: r.description,
  theme: r.theme,
  public: r.public,
  locked: r.locked,
  capacity: r.capacity,
  protected: !!r.password,
  hasOwner: !!r.owner,
  count: roomPlayers(r.id).length,
});
const fullRoom = (r) => ({
  ...publicRoom(r),
  board: r.board,
  strokes: r.strokes,
  objects: r.objects,
  scenery: r.scenery || DEFAULT_SCENERY,
});
function roomList(socket) {
  socket.emit(
    "rooms",
    [...rooms.values()].filter((r) => r.public).map(publicRoom),
  );
}
function roomUpdate(room) {
  io.to(room.id).emit("room", fullRoom(room));
  for (const s of io.sockets.sockets.values()) roomList(s);
}
function isAdmin(p) {
  return (
    !!p?.admin &&
    sessions.get(p.admin)?.room === p.room &&
    sessions.get(p.admin).expires > Date.now()
  );
}
function pairAllowed(a, b) {
  return (
    !!a &&
    !!b &&
    a.id !== b.id &&
    canTalk(
      { ...a, broadcast: a.broadcast && isAdmin(a) },
      { ...b, broadcast: b.broadcast && isAdmin(b) },
    ) &&
    !blocked.get(a.id)?.has(b.id) &&
    !blocked.get(b.id)?.has(a.id)
  );
}
function peerIds(p) {
  const candidates = roomPlayers(p.room).filter((q) => pairAllowed(p, q));
  if (p.broadcast && isAdmin(p)) return candidates.map((q) => q.id);
  return [
    ...candidates.filter((q) => q.broadcast),
    ...candidates
      .filter((q) => !q.broadcast)
      .sort(
        (a, b) =>
          Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y) ||
          a.id.localeCompare(b.id),
      )
      .slice(0, 6),
  ].map((q) => q.id);
}
function peers(p) {
  return peerIds(p).filter((id) => peerIds(players.get(id)).includes(p.id));
}
function sendPoll(target, id) {
  const poll = polls.get(id);
  target.emit(
    "poll",
    poll
      ? {
          question: poll.question,
          options: poll.options,
          open: poll.open,
          counts: poll.options.map(
            (_, i) => [...poll.votes.values()].filter((v) => v === i).length,
          ),
          total: poll.votes.size,
        }
      : null,
  );
}
const play = createPlay({
  players,
  blocked,
  rooms,
  io,
  snapshot,
  roomUpdate,
  store,
  isAdmin,
  limit,
});
const learning = createLearning({ players, rooms, io, snapshot, limit });
function snapshot(id) {
  play.sync(id);
  for (const p of roomPlayers(id)) {
    p.village = villageAt(p, rooms.get(id).theme);
    p.campfire = atCampfire(p, rooms.get(id).theme);
  }
  io.to(id).emit(
    "world",
    roomPlayers(id).map(({ admin, identity, ...p }) => ({
      ...p,
      host: isAdmin(players.get(p.id)),
    })),
  );
  for (const p of roomPlayers(id)) io.to(p.id).emit("peers", peers(p));
}
function remove(socket) {
  const p = players.get(socket.id);
  if (!p) return;
  play.release(p);
  learning.remove(p.id);
  players.delete(socket.id);
  blocked.delete(socket.id);
  socket.leave(p.room);
  snapshot(p.room);
  for (const s of io.sockets.sockets.values()) roomList(s);
}
function cleanText(v, max) {
  return (
    typeof v === "string" &&
    v.trim().length > 0 &&
    v.length <= max &&
    !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v)
  );
}
function session(room) {
  const token = randomBytes(32).toString("hex");
  sessions.set(token, { room, expires: Date.now() + 8 * 3600000 });
  return token;
}
io.on("connection", (socket) => {
  const ip = socket.handshake.address;
  let lastMove = 0,
    lastChat = 0;
  let joining = false;
  roomList(socket);
  socket.use(([event], next) => {
    if (!limit("events:" + socket.id, 160, 1000)) {
      socket.disconnect(true);
      return;
    }
    next();
  });
  function handle(event, fn) {
    socket.on(event, async (data, ack) => {
      if (typeof ack !== "function") return;
      try {
        ack(await fn(data));
      } catch (e) {
        console.error("Event failed:", event, e.message);
        ack({
          error: "処理できませんでした。時間をおいて再試行してください。",
        });
      }
    });
  }
  const fail = (message) => ({ error: message });
  handle("room-info", (data) => {
    const r = rooms.get(data?.id);
    return r ? { room: publicRoom(r) } : fail("スペースが見つかりません。");
  });
  handle("create-room", async (data) => {
    if (!limit("create:" + ip, 5, 3600000) || rooms.size >= 100)
      return fail("作成上限に達しました。");
    if (
      !data ||
      !validName(data.name) ||
      typeof data.ownerPassword !== "string" ||
      data.ownerPassword.length < 10 ||
      data.ownerPassword.length > 128 ||
      typeof data.password !== "string" ||
      data.password.length > 128
    )
      return fail("名前と10〜128文字の管理パスワードを入力してください。");
    if (data.theme !== undefined && !validTheme(data.theme))
      return fail("村のテーマを選び直してください。");
    const room = {
      ...initialRoom(),
      theme: data.theme ?? "farm",
      objects: template(data.theme ?? "farm"),
      id: randomUUID(),
      name: data.name.trim(),
      description: "新しい交流スペース",
      public: data.public === true,
      owner: await hashPassword(data.ownerPassword),
      password: data.password ? await hashPassword(data.password) : null,
    };
    rooms.set(room.id, room);
    try {
      await store.save();
    } catch (e) {
      rooms.delete(room.id);
      throw e;
    }
    roomUpdate(room);
    return { room: publicRoom(room), adminToken: session(room.id) };
  });
  handle("admin-login", async (data) => {
    const p = players.get(socket.id),
      r = rooms.get(p?.room);
    if (!r?.owner || !limit("auth:" + ip, 12, 60000))
      return fail("認証できません。しばらくしてからお試しください。");
    if (!(await checkPassword(data?.password, r.owner)))
      return fail("パスワードが違います。");
    if (players.get(socket.id) !== p) return fail("再入室してください。");
    p.admin = session(r.id);
    snapshot(r.id);
    return { adminToken: p.admin };
  });
  handle("join", async (data) => {
    if (players.has(socket.id) || joining)
      return fail("すでに入室しています。");
    joining = true;
    try {
      const r = rooms.get(data?.room || "lounge");
      if (data?.avatar !== undefined && !validAvatar(data.avatar))
        return fail("アバターを選び直してください。");
      if (!r || !validName(data?.name) || players.size >= 300)
        return fail("名前またはスペースを確認してください。");
      const admin = sessions.get(data.adminToken);
      const host = admin?.room === r.id && admin.expires > Date.now();
      if ((r.locked && !host) || roomPlayers(r.id).length >= r.capacity)
        return fail("入室停止中か、満員です。");
      if (
        !host &&
        r.password &&
        (!limit("auth:" + ip, 12, 60000) ||
          !(await checkPassword(data.password, r.password)))
      )
        return fail("入室パスワードが違うか試行回数を超えました。");
      if (!socket.connected) return fail("再接続してください。");
      if (roomPlayers(r.id).length >= r.capacity || (r.locked && !host))
        return fail("入室停止中か、満員です。");
      let identity = identities.get(data.participantToken);
      if (
        !identity ||
        identity.room !== r.id ||
        identity.expires < Date.now()
      ) {
        const token = randomBytes(24).toString("hex");
        identity = { token, room: r.id, expires: Date.now() + 8 * 3600000 };
        identities.set(token, identity);
      }
      players.set(socket.id, {
        identity: identity.token,
        id: socket.id,
        room: r.id,
        name: data.name.trim(),
        bio: "",
        avatar: validAvatar(data.avatar)
          ? data.avatar
          : randomInt(AVATARS.length),
        color: Number.isInteger(data.color)
          ? Math.max(0, Math.min(4, data.color))
          : 0,
        ...(r.theme === "villages"
          ? villageSpawn(roomPlayers(r.id), collisionObjects(r), "farm")
          : spawnPoint(roomPlayers(r.id), collisionObjects(r))),
        status: "available",
        hand: false,
        badge: validBadge(data.badge) ? data.badge : "none",
        reaction: null,
        emote: null,
        travel: "walk",
        rideWith: null,
        look: validLook(data.look)
          ? Object.fromEntries(
              Object.keys(DEFAULT_LOOK).map((k) => [k, data.look[k]]),
            )
          : { ...DEFAULT_LOOK },
        call: false,
        mic: false,
        camera: false,
        screen: false,
        broadcast: false,
        admin: host ? data.adminToken : null,
      });
      blocked.set(socket.id, new Set());
      socket.join(r.id);
      socket.emit("room", fullRoom(r));
      const result = {
        id: socket.id,
        room: fullRoom(r),
        iceServers,
        relayConfigured: iceServers.some((s) =>
          [s.urls].flat().some((u) => /^turns?:/.test(u)),
        ),
        host,
        participantToken: identity.token,
      };
      sendPoll(socket, r.id);
      snapshot(r.id);
      for (const s of io.sockets.sockets.values()) roomList(s);
      return result;
    } finally {
      joining = false;
    }
  });
  handle("leave", () => {
    remove(socket);
    return { ok: true };
  });
  socket.on("move", (data) => {
    const p = players.get(socket.id),
      now = Date.now();
    if (
      !p ||
      p.rideWith ||
      now - lastMove < 35 ||
      !data ||
      !Number.isFinite(data.dx) ||
      !Number.isFinite(data.dy)
    )
      return;
    const dt = Math.min((now - lastMove) / 1000, 0.1);
    lastMove = now;
    const length = Math.hypot(data.dx, data.dy);
    if (!length || !Number.isFinite(length)) return;
    const speed = TRAVEL_SPEED[p.travel] || TRAVEL_SPEED.walk;
    const distance =
      Number.isFinite(data.distance) && data.distance >= 0
        ? Math.min(data.distance, speed * dt)
        : speed * dt;
    const dx = (data.dx / length) * distance,
      dy = (data.dy / length) * distance;
    const objects = collisionObjects(rooms.get(p.room));
    if (walkable(p.x + dx, p.y, objects)) p.x += dx;
    if (walkable(p.x, p.y + dy, objects)) p.y += dy;
    snapshot(p.room);
  });
  play.register(socket, handle);
  learning.register(socket, handle);
  handle("village-enter", (data) => {
    const p = players.get(socket.id),
      r = rooms.get(p?.room);
    if (
      !p ||
      p.rideWith ||
      r?.theme !== "villages" ||
      !VILLAGES.some((v) => v.id === data?.village) ||
      !limit("village:" + socket.id, 10, 10000)
    )
      return fail("移動先を確認し、少し間隔をあけてください。");
    const point = villageSpawn(
      roomPlayers(r.id).filter((q) => q.id !== p.id),
      collisionObjects(r),
      data.village,
    );
    if (!point) return fail("移動先の広場がふさがれています。");
    Object.assign(p, point);
    snapshot(p.room);
    return { ok: true };
  });
  handle("chat", (data) => {
    const p = players.get(socket.id),
      now = Date.now(),
      text = typeof data === "string" ? data : data?.text,
      scope = typeof data === "string" ? "nearby" : data?.scope;
    if (
      !p ||
      !cleanText(text, 300) ||
      now - lastChat < 700 ||
      !["nearby", "room", "dm"].includes(scope)
    )
      return fail("メッセージは1〜300文字、少し間隔をあけて送信してください。");
    const recipient = players.get(data?.to);
    if (
      scope === "dm" &&
      (!recipient || recipient.room !== p.room || recipient.id === p.id)
    )
      return fail("宛先が見つかりません。");
    lastChat = now;
    const message = {
      id: randomUUID(),
      from: p.id,
      name: p.name,
      text: text.trim(),
      time: now,
      scope,
      village: p.village,
      to: scope === "dm" ? recipient.name : null,
    };
    for (const other of roomPlayers(p.room)) {
      if (blocked.get(other.id)?.has(p.id) || blocked.get(p.id)?.has(other.id))
        continue;
      if (
        other.id === p.id ||
        scope === "room" ||
        (scope === "nearby" && near(p, other)) ||
        (scope === "dm" && other.id === recipient.id)
      )
        io.to(other.id).emit("message", message);
    }
    return { ok: true };
  });
  handle("profile", (data) => {
    const p = players.get(socket.id);
    if (
      !p ||
      !validName(data?.name) ||
      typeof data.bio !== "string" ||
      data.bio.length > 120 ||
      !Number.isInteger(data.color) ||
      data.color < 0 ||
      data.color > 4 ||
      (data.avatar !== undefined && !validAvatar(data.avatar))
    )
      return fail("プロフィールを確認してください。");
    Object.assign(p, {
      name: data.name.trim(),
      bio: data.bio,
      avatar: data.avatar ?? p.avatar,
      color: data.color,
    });
    snapshot(p.room);
    return { ok: true };
  });
  handle("presence", (data) => {
    const p = players.get(socket.id);
    if (
      !p ||
      !["available", "busy", "away"].includes(data?.status) ||
      typeof data.hand !== "boolean"
    )
      return fail("不正な状態です。");
    p.status = data.status;
    p.hand = data.hand;
    p.handAt = data.hand ? Date.now() : null;
    if (p.status === "away") {
      p.call = false;
      p.mic = false;
      p.camera = false;
      p.screen = false;
      p.broadcast = false;
    }
    snapshot(p.room);
    return { ok: true };
  });
  handle("avatar-action", (data) => {
    const p = players.get(socket.id);
    if (!p || !data || ![...EMOTES, ...TRAVEL_MODES, "stop"].includes(data.id))
      return fail("アクションを確認してください。");
    if (!limit("avatar-action:" + socket.id, 12, 5000))
      return fail("少し間隔をあけてください。");
    if (TRAVEL_MODES.includes(data.id) || data.id === "stop") play.release(p);
    if (data.id === "stop") {
      p.emote = null;
      p.travel = "walk";
    } else if (TRAVEL_MODES.includes(data.id)) p.travel = data.id;
    else p.emote = { id: data.id, until: Date.now() + 5000 };
    snapshot(p.room);
    return { ok: true };
  });
  handle("reaction", (data) => {
    const p = players.get(socket.id);
    if (
      !p ||
      !["👋", "👏", "❤️", "🎉", "👍"].includes(data?.emoji) ||
      !limit("reaction:" + socket.id, 3, 5000)
    )
      return fail("少し間隔をあけてください。");
    p.reaction = { emoji: data.emoji, until: Date.now() + 4000 };
    const pose = { "👋": "wave", "👏": "clap", "❤️": "heart", "🎉": "dance" }[
      data.emoji
    ];
    if (pose) p.emote = { id: pose, until: Date.now() + 5000 };
    snapshot(p.room);
    return { ok: true };
  });
  handle("block", (data) => {
    const p = players.get(socket.id),
      other = players.get(data?.id);
    if (
      !p ||
      !other ||
      other.room !== p.room ||
      other.id === p.id ||
      typeof data.blocked !== "boolean"
    )
      return fail("参加者が見つかりません。");
    if (data.blocked) blocked.get(p.id).add(other.id);
    else blocked.get(p.id).delete(other.id);
    snapshot(p.room);
    return { ok: true };
  });
  handle("media", (data) => {
    const p = players.get(socket.id);
    if (
      !p ||
      !data ||
      !["call", "mic", "camera", "screen"].every(
        (k) => typeof data[k] === "boolean",
      ) ||
      typeof data.broadcast !== "boolean" ||
      (data.broadcast && !isAdmin(p))
    )
      return fail("通話設定を変更できません。");
    Object.assign(p, {
      call: data.call,
      mic: data.mic,
      camera: data.camera,
      screen: data.screen,
      broadcast: data.broadcast,
    });
    snapshot(p.room);
    return { ok: true };
  });
  socket.on("signal", (data) => {
    const p = players.get(socket.id),
      other = players.get(data?.to);
    if (
      !p ||
      !other ||
      !peers(p).includes(other.id) ||
      !limit("signal:" + socket.id, 120, 1000)
    )
      return;
    const description = data.description;
    if (
      description &&
      (!["offer", "answer"].includes(description.type) ||
        typeof description.sdp !== "string" ||
        description.sdp.length > 50000)
    )
      return;
    if (!description && !data.candidate) return;
    io.to(other.id).emit("signal", {
      from: p.id,
      description,
      candidate: data.candidate,
    });
  });
  handle("poll-vote", (data) => {
    const p = players.get(socket.id),
      poll = polls.get(p?.room);
    if (
      !poll?.open ||
      !Number.isInteger(data?.choice) ||
      data.choice < 0 ||
      data.choice >= poll.options.length
    )
      return fail("投票できません。");
    poll.votes.set(p.identity, data.choice);
    sendPoll(io.to(p.room), p.room);
    return { ok: true };
  });
  handle("poll-manage", (data) => {
    const p = players.get(socket.id);
    if (!isAdmin(p)) return fail("管理者のみ操作できます。");
    if (data?.action === "close") {
      const poll = polls.get(p.room);
      if (poll) poll.open = false;
    } else {
      if (
        !cleanText(data?.question, 120) ||
        !Array.isArray(data.options) ||
        data.options.length < 2 ||
        data.options.length > 4 ||
        !data.options.every((v) => cleanText(v, 60))
      )
        return fail("質問と2〜4個の選択肢を入力してください。");
      polls.set(p.room, {
        question: data.question,
        options: data.options,
        votes: new Map(),
        open: true,
      });
    }
    sendPoll(io.to(p.room), p.room);
    return { ok: true };
  });
  handle("board-add", async (data) => {
    const p = players.get(socket.id),
      r = rooms.get(p?.room);
    if (
      !r ||
      !cleanText(data?.text, 500) ||
      r.board.length >= 50 ||
      !limit("board:" + socket.id, 5, 60000)
    )
      return fail("投稿は1〜500文字、最大50件です。");
    let url = "";
    if (data.url) {
      try {
        const parsed = new URL(data.url);
        if (
          parsed.protocol !== "https:" ||
          parsed.username ||
          parsed.password ||
          data.url.length > 500
        )
          return fail("リンクはHTTPSのURLを指定してください。");
        url = parsed.href;
      } catch {
        return fail("リンクの形式を確認してください。");
      }
    }
    const post = {
      id: randomUUID(),
      name: p.name,
      text: data.text.trim(),
      url,
      time: Date.now(),
    };
    r.board.push(post);
    try {
      await store.save();
    } catch (e) {
      r.board = r.board.filter((v) => v.id !== post.id);
      throw e;
    }
    roomUpdate(r);
    return { ok: true };
  });
  handle("board-delete", async (data) => {
    const p = players.get(socket.id),
      r = rooms.get(p?.room);
    if (!isAdmin(p)) return fail("管理者のみ操作できます。");
    r.board = r.board.filter((post) => post.id !== data?.id);
    await store.save();
    roomUpdate(r);
    return { ok: true };
  });
  handle("stroke", (data) => {
    const p = players.get(socket.id),
      r = rooms.get(p?.room);
    if (
      !r ||
      r.strokes.length >= 500 ||
      !limit("stroke:" + socket.id, 10, 1000) ||
      !["#365c49", "#bd655c", "#526db0", "#333333"].includes(data?.color) ||
      !Array.isArray(data.points) ||
      data.points.length < 2 ||
      data.points.length > 100 ||
      !data.points.every(
        (v) =>
          Array.isArray(v) &&
          v.length === 2 &&
          v.every((n) => Number.isFinite(n) && n >= 0 && n <= 1),
      )
    )
      return fail("描画を追加できません。");
    const stroke = { color: data.color, points: data.points };
    r.strokes.push(stroke);
    io.to(r.id).emit("stroke", stroke);
    return { ok: true };
  });
  handle("admin", async (data) => {
    const p = players.get(socket.id),
      r = rooms.get(p?.room);
    if (!isAdmin(p) || !r) return fail("管理者のみ操作できます。");
    switch (data?.action) {
      case "settings":
        if (
          !validName(data.name) ||
          typeof data.description !== "string" ||
          data.description.length > 120 ||
          !Number.isInteger(data.capacity) ||
          data.capacity < 2 ||
          data.capacity > 30
        )
          return fail("名前・説明・人数を確認してください。");
        Object.assign(r, {
          name: data.name.trim(),
          description: data.description,
          capacity: data.capacity,
          locked: !!data.locked,
          public: !!data.public,
        });
        break;
      case "password":
        if (typeof data.password !== "string" || data.password.length > 128)
          return fail("パスワードを確認してください。");
        r.password = data.password ? await hashPassword(data.password) : null;
        break;
      case "kick": {
        const other = players.get(data.id);
        if (
          !other ||
          other.room !== p.room ||
          other.id === p.id ||
          isAdmin(other)
        )
          return fail("この参加者は退出させられません。");
        const target = io.sockets.sockets.get(other.id);
        target.emit("kicked");
        remove(target);
        return { ok: true };
      }
      case "lower-hand": {
        const other = players.get(data.id);
        if (!other || other.room !== p.room)
          return fail("参加者が見つかりません。");
        other.hand = false;
        other.handAt = null;
        snapshot(r.id);
        return { ok: true };
      }
      case "announce":
        if (!cleanText(data.text, 300))
          return fail("お知らせは1〜300文字です。");
        io.to(r.id).emit("message", {
          id: randomUUID(),
          name: "管理者からのお知らせ",
          text: data.text,
          time: Date.now(),
          scope: "announcement",
        });
        return { ok: true };
      case "clear-board":
        r.strokes = [];
        break;
      case "template":
        if (!validTheme(data.theme)) return fail("テーマを確認してください。");
        r.theme = data.theme;
        r.objects = template(data.theme);
        break;
      case "furniture":
        if (
          !Array.isArray(data.objects) ||
          data.objects.length > 30 ||
          !data.objects.every(
            (o) =>
              o &&
              [o.x, o.y, o.w, o.h].every(Number.isFinite) &&
              o.x >= 40 &&
              o.y >= 70 &&
              o.w >= 30 &&
              o.h >= 30 &&
              o.w <= 250 &&
              o.h <= 150 &&
              o.x + o.w <= 960 &&
              o.y + o.h <= 600,
          ) ||
          !walkable(
            500,
            540,
            collisionObjects({ ...r, objects: data.objects }),
          ) ||
          (r.theme === "villages" &&
            VILLAGES.some(
              (v) =>
                !villageSpawn(
                  [],
                  collisionObjects({ ...r, objects: data.objects }),
                  v.id,
                ),
            ))
        )
          return fail("家具は30個まで、入口を空けて配置してください。");
        r.objects = data.objects.map(({ x, y, w, h }) => ({ x, y, w, h }));
        break;
      default:
        return fail("不明な操作です。");
    }
    await store.save();
    for (const other of roomPlayers(r.id))
      if (!walkable(other.x, other.y, collisionObjects(r))) {
        other.x = 500;
        other.y = 540;
      }
    roomUpdate(r);
    snapshot(r.id);
    return { ok: true };
  });
  socket.on("disconnect", () => remove(socket));
});
server.listen(
  Number(process.env.PORT) || 3000,
  process.env.HOST || "0.0.0.0",
  () => console.log("Komorebi listening on port", server.address().port),
);
