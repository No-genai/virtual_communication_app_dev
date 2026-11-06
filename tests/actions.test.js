import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { io } from "socket.io-client";
let server;
const url = "http://127.0.0.1:3012",
  clients = [];
before(async () => {
  server = spawn(process.execPath, ["server/index.js"], {
    env: {
      ...process.env,
      PORT: "3012",
      NODE_ENV: "production",
      DATA_DIR: `/tmp/komorebi-actions-${process.pid}`,
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
test("avatar actions synchronize, expire, reject invalid requests, and enforce travel speed", async () => {
  const a = await client(),
    b = await client(),
    stranger = await client();
  assert.ok((await emit(stranger, "avatar-action", { id: "run" })).error);
  const created = await emit(a, "create-room", {
    name: "動きのテスト",
    ownerPassword: "actions-password",
    password: "",
    public: false,
  });
  assert.ok(created.room, JSON.stringify(created));
  const room = created.room.id;
  await emit(a, "join", { name: "演者", room, adminToken: created.adminToken });
  await emit(b, "join", { name: "観客", room });
  await emit(a, "admin", { action: "furniture", objects: [] });
  for (const bad of [null, {}, { id: "fly" }, { id: {} }])
    assert.ok((await emit(a, "avatar-action", bad)).error);
  let state;
  b.on("world", (ps) => {
    state = ps.find((p) => p.id === a.id);
  });
  for (const id of ["heart", "wave", "clap", "dance"]) {
    const received = new Promise((resolve) => b.once("world", resolve));
    assert.ok((await emit(a, "avatar-action", { id, until: Infinity })).ok);
    const p = (await received).find((p) => p.id === a.id);
    assert.equal(p.emote.id, id);
    assert.ok(p.emote.until > Date.now() && p.emote.until <= Date.now() + 5000);
  }
  const { activeEmote } = await import("../shared/actions.js");
  assert.equal(activeEmote(state, state.emote.until), null);
  for (const [id, expected] of [
    ["walk", 19],
    ["run", 28],
    ["carriage", 24],
  ]) {
    await emit(a, "avatar-action", { id });
    await new Promise((r) => setTimeout(r, 120));
    const before = { ...state };
    const next = new Promise((resolve) => b.once("world", resolve));
    a.emit("move", { dx: 0, dy: 1e20, speed: 99999 });
    const after = (await next).find((p) => p.id === a.id);
    assert.ok(Math.abs(after.y - before.y - expected) < 0.01);
    assert.equal(after.travel, id);
  }
  await emit(a, "avatar-action", { id: "stop" });
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(state.travel, "walk");
  assert.equal(state.emote, null);
  let rejected = false;
  for (let i = 0; i < 15; i++)
    if ((await emit(a, "avatar-action", { id: "heart" })).error)
      rejected = true;
  assert.ok(rejected);
  a.disconnect();
  b.disconnect();
  stranger.disconnect();
});
