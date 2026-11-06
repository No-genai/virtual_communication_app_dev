import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { io } from "socket.io-client";
let server;
const url = "http://127.0.0.1:3011",
  clients = [];
before(async () => {
  server = spawn(process.execPath, ["server/index.js"], {
    env: {
      ...process.env,
      PORT: "3011",
      NODE_ENV: "production",
      DATA_DIR: `/tmp/komorebi-unit-${process.pid}`,
    },
    stdio: "pipe",
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("startup timeout")),
      10000,
    );
    server.stdout.once("data", () => {
      clearTimeout(timeout);
      resolve();
    });
    server.once("error", reject);
  });
});
after(() => {
  for (const c of clients) c.disconnect();
  server.kill();
});
async function client(options = {}) {
  const c = io(url, {
    transports: ["websocket"],
    reconnection: false,
    ...options,
  });
  clients.push(c);
  await new Promise((resolve, reject) => {
    c.once("connect", resolve);
    c.once("connect_error", reject);
  });
  return c;
}
const emit = (c, event, data) =>
  new Promise((resolve, reject) =>
    c.timeout(2000).emit(event, data, (e, r) => (e ? reject(e) : resolve(r))),
  );
test("origin rejection, payload validation, throttling and speed limit", async () => {
  await assert.rejects(
    client({ extraHeaders: { Origin: "https://attacker.example" } }),
  );
  const c = await client();
  assert.ok((await emit(c, "join", { name: "x".repeat(21) })).error);
  const firstWorld = new Promise((resolve) => c.once("world", resolve));
  assert.ok((await emit(c, "join", { name: "test", color: 999 })).id);
  const origin = (await firstWorld).find((p) => p.id === c.id);
  assert.ok((await emit(c, "join", { name: "duplicate" })).error);
  assert.ok((await emit(c, "chat", "x".repeat(301))).error);
  assert.ok((await emit(c, "chat", "hello")).ok);
  assert.ok((await emit(c, "chat", "spam")).error);
  const world = new Promise((resolve) => c.once("world", resolve));
  c.emit("move", { dx: 1e200, dy: 0 });
  const state = await world;
  const p = state.find((p) => p.id === c.id);
  assert.ok(Math.hypot(p.x - origin.x, p.y - origin.y) <= 19.01);
  assert.equal(p.color, 4);
});
test("production serves the app, adds CSP, and rejects traversal", async () => {
  const r = await fetch(url);
  assert.equal(r.status, 200);
  assert.match(
    r.headers.get("content-security-policy"),
    /frame-ancestors 'none'/,
  );
  assert.match(await r.text(), /こもれび/);
  const path = await fetch(url + "/%2e%2e%2fpackage.json");
  assert.equal(path.status, 403);
  const health = await fetch(url + "/health");
  assert.equal((await health.json()).ok, true);
});
test("private rooms isolate presence, messages, media, privileges, and persistence", async () => {
  const host = await client(),
    guest = await client(),
    outsider = await client();
  const created = await emit(host, "create-room", {
    name: "非公開の授業",
    ownerPassword: "owner-password-for-test",
    password: "guest-password",
    public: false,
  });
  assert.ok(created.room.id);
  assert.ok(created.adminToken);
  const room = created.room.id;
  const joinHost = await emit(host, "join", {
    name: "先生",
    room,
    adminToken: created.adminToken,
  });
  assert.ok(joinHost.host);
  assert.equal(joinHost.room.owner, undefined);
  assert.equal(joinHost.room.password, undefined);
  assert.ok(
    (await emit(guest, "join", { name: "生徒", room, password: "wrong" }))
      .error,
  );
  const joined = await emit(guest, "join", {
    name: "生徒",
    room,
    password: "guest-password",
  });
  assert.ok(joined.id);
  assert.equal(joined.host, false);
  await emit(outsider, "join", { name: "別室" });
  assert.ok(
    (
      await emit(guest, "admin", {
        action: "settings",
        name: "乗っ取り",
        description: "",
        capacity: 30,
      })
    ).error,
  );
  assert.ok(
    (
      await emit(guest, "media", {
        call: true,
        mic: false,
        camera: false,
        screen: false,
        broadcast: true,
      })
    ).error,
  );
  assert.ok(
    (
      await emit(outsider, "chat", {
        scope: "dm",
        to: guest.id,
        text: "別室への不正DM",
      })
    ).error,
  );
  let leaked = false;
  outsider.on("message", () => {
    leaked = true;
  });
  const message = new Promise((resolve) => guest.once("message", resolve));
  assert.ok(
    (await emit(host, "chat", { scope: "room", text: "この部屋だけ" })).ok,
  );
  assert.equal((await message).text, "この部屋だけ");
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(leaked, false);
  assert.ok(
    (
      await emit(guest, "board-add", {
        text: "unsafe",
        url: "javascript:alert(1)",
      })
    ).error,
  );
  assert.ok(
    (
      await emit(guest, "board-add", {
        text: "保存される資料",
        url: "https://example.com/lesson",
      })
    ).ok,
  );
  assert.ok(
    (
      await emit(guest, "poll-manage", {
        question: "不正投票",
        options: ["a", "b"],
      })
    ).error,
  );
  assert.ok(
    (
      await emit(host, "poll-manage", {
        question: "理解できた？",
        options: ["はい", "再説明"],
      })
    ).ok,
  );
  assert.ok((await emit(guest, "poll-vote", { choice: 0 })).ok);
  assert.ok((await emit(guest, "poll-vote", { choice: 1 })).ok);
  const pollUpdate = new Promise((resolve) => host.once("poll", resolve));
  await emit(host, "poll-manage", { action: "close" });
  const poll = await pollUpdate;
  assert.equal(poll.total, 1);
  assert.deepEqual(poll.counts, [0, 1]);
  assert.ok((await emit(guest, "poll-vote", { choice: 0 })).error);
  assert.ok(
    (
      await emit(host, "admin", {
        action: "furniture",
        objects: [{ x: 450, y: 500, w: 100, h: 80 }],
      })
    ).ok,
  );
  assert.ok(
    (
      await emit(host, "admin", {
        action: "settings",
        name: "授業",
        description: "学習スペース",
        capacity: 2,
        locked: true,
        public: false,
      })
    ).ok,
  );
  const extra = await client();
  assert.ok(
    (
      await emit(extra, "join", {
        name: "追加",
        room,
        password: "guest-password",
      })
    ).error,
  );
  const kicked = new Promise((resolve) => guest.once("kicked", resolve));
  assert.ok((await emit(host, "admin", { action: "kick", id: guest.id })).ok);
  await kicked;
  assert.ok((await emit(guest, "chat", "退出後の発言")).error);
  const { readFile } = await import("node:fs/promises");
  const persisted = JSON.parse(
    await readFile(`/tmp/komorebi-unit-${process.pid}/rooms.json`, "utf8"),
  );
  const saved = persisted.rooms.find((r) => r.id === room);
  assert.equal(saved.board[0].text, "保存される資料");
  assert.equal(saved.name, "授業");
  assert.equal(saved.locked, true);
  assert.ok(saved.owner.hash);
  assert.ok(!JSON.stringify(saved).includes("owner-password-for-test"));
  assert.ok(!JSON.stringify(saved).includes("guest-password"));
});
test("blocking cuts off chat and media and rejects cross-room signaling", async () => {
  const a = await client(),
    b = await client(),
    c = await client();
  await emit(a, "join", { name: "A" });
  await emit(b, "join", { name: "B" });
  const room = await emit(c, "create-room", {
    name: "別の部屋",
    ownerPassword: "another-owner-pass",
    password: "",
    public: false,
  });
  await emit(c, "join", { name: "C", room: room.room.id });
  const media = {
    call: true,
    mic: true,
    camera: false,
    screen: false,
    broadcast: false,
  };
  await emit(a, "media", media);
  let peersUpdate = new Promise((resolve) => a.once("peers", resolve));
  await emit(b, "media", media);
  assert.ok((await peersUpdate).includes(b.id));
  peersUpdate = new Promise((resolve) => a.once("peers", resolve));
  await emit(a, "block", { id: b.id, blocked: true });
  assert.ok(!(await peersUpdate).includes(b.id));
  let message = false,
    signal = false;
  a.on("message", () => (message = true));
  c.on("signal", () => (signal = true));
  await emit(b, "chat", { scope: "dm", to: a.id, text: "blocked" });
  a.emit("signal", {
    to: c.id,
    description: { type: "offer", sdp: "invalid" },
  });
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(message, false);
  assert.equal(signal, false);
});
test("a room admits 30 participants and rejects the 31st without leaking room credentials", async () => {
  const owner = await client();
  const created = await emit(owner, "create-room", {
    name: "30人の授業",
    ownerPassword: "thirty-student-test",
    password: "",
    public: false,
  });
  const room = created.room.id;
  const students = await Promise.all(
    Array.from({ length: 30 }, () => client()),
  );
  const responses = await Promise.all(
    students.map((s, i) => emit(s, "join", { name: "生徒" + i, room })),
  );
  assert.equal(responses.filter((r) => r.id).length, 30);
  assert.ok((await emit(owner, "join", { name: "満員の次", room })).error);
  const seen = new Promise((resolve) => students[29].once("message", resolve));
  await emit(students[0], "chat", { scope: "room", text: "30人への連絡" });
  assert.equal((await seen).text, "30人への連絡");
  for (const s of students) s.disconnect();
});

test("avatar choices are validated, randomized when omitted and synchronized after profile changes", async () => {
  const c = await client();
  assert.ok((await emit(c, "join", { name: "Avatar", avatar: 999 })).error);
  let update = new Promise((resolve) => c.once("world", resolve));
  await emit(c, "join", { name: "Avatar" });
  let p = (await update).find((p) => p.id === c.id);
  assert.ok(Number.isInteger(p.avatar) && p.avatar >= 0 && p.avatar < 8);
  assert.ok(
    (
      await emit(c, "profile", {
        name: "Avatar",
        bio: "",
        color: 0,
        avatar: -1,
      })
    ).error,
  );
  update = new Promise((resolve) => c.once("world", resolve));
  assert.ok(
    (
      await emit(c, "profile", {
        name: "Avatar",
        bio: "new look",
        color: 2,
        avatar: 5,
      })
    ).ok,
  );
  p = (await update).find((p) => p.id === c.id);
  assert.equal(p.avatar, 5);
  assert.equal(p.color, 2);
  c.disconnect();
});

test("village theme can be chosen at creation, changed by the owner and persisted", async () => {
  const c = await client();
  const created = await emit(c, "create-room", {
    name: "テーマの村",
    ownerPassword: "village-owner-password",
    password: "",
    public: false,
    theme: "sky",
  });
  assert.equal(created.room.theme, "sky");
  const joined = await emit(c, "join", {
    name: "村の主催者",
    room: created.room.id,
    adminToken: created.adminToken,
  });
  assert.equal(joined.room.theme, "sky");
  for (const theme of ["city", "farm", "sky", "boss"]) {
    const update = new Promise((resolve) => c.once("room", resolve));
    assert.ok((await emit(c, "admin", { action: "template", theme })).ok);
    const room = await update;
    assert.equal(room.theme, theme);
    assert.ok(room.objects.length > 0);
  }
  assert.ok(
    (await emit(c, "admin", { action: "template", theme: "unknown" })).error,
  );
  const { readFile } = await import("node:fs/promises");
  const saved = JSON.parse(
    await readFile(`/tmp/komorebi-unit-${process.pid}/rooms.json`, "utf8"),
  );
  assert.equal(saved.rooms.find((r) => r.id === created.room.id).theme, "boss");
  c.disconnect();
});

test("four villages isolate ordinary chat and signaling while explicit global chat crosses rooms", async () => {
  const owner = await client(),
    a = await client(),
    b = await client();
  const created = await emit(owner, "create-room", {
    name: "四つの部屋",
    ownerPassword: "four-village-password",
    password: "",
    public: false,
    theme: "villages",
  });
  const room = created.room.id;
  await emit(a, "join", { name: "A", room });
  await emit(b, "join", { name: "B", room });
  // Join broadcasts can still be queued on another client after its join ack.
  // Wait for the requested move, not merely the next arriving world packet.
  const update = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      a.off("world", receive);
      reject(new Error("city move snapshot timeout"));
    }, 2000);
    function receive(state) {
      if (state.find((p) => p.id === a.id)?.village === "city") {
        clearTimeout(timer);
        a.off("world", receive);
        resolve(state);
      }
    }
    a.on("world", receive);
  });
  assert.ok((await emit(a, "village-enter", { village: "city" })).ok);
  let state = await update;
  assert.equal(state.find((p) => p.id === a.id).village, "city");
  assert.equal(state.find((p) => p.id === b.id).village, "farm");
  assert.ok((await emit(a, "village-enter", { village: "invalid" })).error);
  let leaked = false;
  b.on("message", () => (leaked = true));
  await emit(a, "chat", { scope: "nearby", text: "city only" });
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(leaked, false);
  const media = {
    call: true,
    mic: true,
    camera: false,
    screen: false,
    broadcast: false,
  };
  await emit(a, "media", media);
  const outsidePeers = new Promise((resolve) => a.once("peers", resolve));
  await emit(b, "media", media);
  assert.ok(!(await outsidePeers).includes(b.id));
  const samePeers = new Promise((resolve) => a.once("peers", resolve));
  await emit(b, "village-enter", { village: "city" });
  assert.ok((await samePeers).includes(b.id));
  await new Promise((r) => setTimeout(r, 710));
  const local = new Promise((resolve) => b.once("message", resolve));
  await emit(a, "chat", { scope: "nearby", text: "same village" });
  assert.equal((await local).text, "same village");
  await emit(b, "village-enter", { village: "sky" });
  await new Promise((r) => setTimeout(r, 710));
  const global = new Promise((resolve) => b.once("message", resolve));
  await emit(a, "chat", { scope: "room", text: "all four" });
  assert.equal((await global).text, "all four");
  for (const c of [owner, a, b]) c.disconnect();
});
