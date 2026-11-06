import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { io } from "socket.io-client";
let server;
const url = "http://127.0.0.1:3013",
  clients = [];
before(async () => {
  server = spawn(process.execPath, ["server/index.js"], {
    env: {
      ...process.env,
      PORT: "3013",
      NODE_ENV: "production",
      DATA_DIR: `/tmp/komorebi-play-${process.pid}`,
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
const pause = () => new Promise((r) => setTimeout(r, 80));
async function roomWithPeople(count = 2) {
  const a = await client();
  const created = await emit(a, "create-room", {
    name: "遊びの村",
    ownerPassword: "play-password",
    password: "",
    public: false,
    theme: "classroom",
  });
  assert.ok(created.room, JSON.stringify(created));
  await emit(a, "join", {
    name: "運転手",
    room: created.room.id,
    adminToken: created.adminToken,
  });
  const people = [a];
  for (let i = 1; i < count; i++) {
    const b = await client();
    await emit(b, "join", { name: "参加者" + i, room: created.room.id });
    people.push(b);
  }
  await emit(a, "admin", { action: "furniture", objects: [] });
  return { people, room: created.room.id };
}
test("ride consent, capacity, driver movement, dismount, cross-room rejection and disconnect cleanup", async () => {
  const {
      people: [a, b, c, d],
    } = await roomWithPeople(4),
    outside = await client();
  await emit(outside, "join", { name: "外の人" });
  let state = [];
  b.on("world", (v) => (state = v));
  assert.ok((await emit(b, "ride-answer", { accept: true })).error);
  await emit(a, "avatar-action", { id: "carriage" });
  await pause();
  assert.ok((await emit(a, "ride-invite", { id: outside.id })).error);
  for (const passenger of [b, c]) {
    const invitation = new Promise((r) => passenger.once("ride-invitation", r));
    assert.ok((await emit(a, "ride-invite", { id: passenger.id })).ok);
    assert.equal((await invitation).from, a.id);
    assert.ok(!state.find((p) => p.id === passenger.id)?.rideWith);
    assert.ok((await emit(passenger, "ride-answer", { accept: true })).ok);
  }
  await pause();
  assert.equal(state.find((p) => p.id === b.id).rideWith, a.id);
  assert.ok((await emit(a, "ride-invite", { id: d.id })).error);
  const before = state.find((p) => p.id === b.id);
  b.emit("move", { dx: 1, dy: 0 });
  await pause();
  assert.equal(state.find((p) => p.id === b.id).x, before.x);
  a.emit("move", { dx: 1, dy: 0 });
  await pause();
  assert.ok(state.find((p) => p.id === a.id).x > before.x);
  assert.equal(
    state.find((p) => p.id === b.id).x,
    state.find((p) => p.id === a.id).x,
  );
  await emit(b, "ride-leave");
  await pause();
  assert.equal(state.find((p) => p.id === b.id).rideWith, null);
  await emit(a, "avatar-action", { id: "stop" });
  await pause();
  assert.equal(state.find((p) => p.id === c.id).rideWith, null);
  await emit(c, "avatar-action", { id: "carriage" });
  await emit(c, "ride-invite", { id: b.id });
  await emit(b, "ride-answer", { accept: true });
  c.disconnect();
  await pause();
  assert.equal(state.find((p) => p.id === b.id).rideWith, null);
  await emit(a, "avatar-action", { id: "carriage" });
  assert.ok((await emit(a, "ride-invite", { id: b.id })).ok);
  await emit(b, "ride-answer", { accept: true });
  await emit(b, "block", { id: a.id, blocked: true });
  await pause();
  assert.equal(state.find((p) => p.id === b.id).rideWith, null);
  assert.ok((await emit(a, "ride-invite", { id: b.id })).error);
  for (const p of [a, b, d, outside]) p.disconnect();
});
test("wardrobe and pet sync; only owner may persist shared scenery", async () => {
  const {
    people: [a, b],
    room,
  } = await roomWithPeople();
  let state = [];
  b.on("world", (v) => (state = v));
  const look = {
    pet: "cat",
    hat: "crown",
    clothes: "coat",
    accessory: "scarf",
  };
  assert.ok((await emit(a, "look", { ...look, hat: "<script>" })).error);
  assert.ok((await emit(a, "look", look)).ok);
  await pause();
  assert.deepEqual(state.find((p) => p.id === a.id).look, look);
  assert.ok((await emit(a, "pet-stroke")).ok);
  await pause();
  assert.ok(state.find((p) => p.id === a.id).petHappyUntil > Date.now());
  const scenery = { weather: "snow", time: "night", season: "winter" };
  assert.ok((await emit(b, "scenery", scenery)).error);
  assert.ok((await emit(a, "scenery", { ...scenery, weather: "hail" })).error);
  const update = new Promise((r) => b.once("room", r));
  assert.ok((await emit(a, "scenery", scenery)).ok);
  assert.deepEqual((await update).scenery, scenery);
  const { readFile } = await import("node:fs/promises");
  const saved = JSON.parse(
    await readFile(`/tmp/komorebi-play-${process.pid}/rooms.json`, "utf8"),
  );
  assert.deepEqual(saved.rooms.find((r) => r.id === room).scenery, scenery);
  a.disconnect();
  b.disconnect();
});
test("automatic scenery follows Japan time and season boundaries", async () => {
  const { sceneryAt } = await import("../shared/play.js");
  assert.equal(
    sceneryAt(undefined, Date.parse("2026-06-01T14:00:00Z")).time,
    "day",
  );
  const auto = { weather: "clear", time: "auto", season: "auto" };
  assert.equal(
    sceneryAt(auto, Date.parse("2026-03-01T00:00:00Z")).season,
    "spring",
  );
  assert.equal(
    sceneryAt(auto, Date.parse("2026-06-01T00:00:00Z")).season,
    "summer",
  );
  assert.equal(
    sceneryAt(auto, Date.parse("2026-09-01T00:00:00Z")).season,
    "autumn",
  );
  assert.equal(
    sceneryAt(auto, Date.parse("2026-12-01T00:00:00Z")).season,
    "winter",
  );
  for (const [date, time] of [
    ["2026-06-01T00:00:00Z", "day"],
    ["2026-06-01T09:00:00Z", "sunset"],
    ["2026-06-01T14:00:00Z", "night"],
  ])
    assert.equal(sceneryAt(auto, Date.parse(date)).time, time);
});

test("expired invitations cannot board a carriage", async (t) => {
  const { createPlay } = await import("../server/play.js");
  let now = 1000;
  t.mock.method(Date, "now", () => now);
  const a = {
      id: "a",
      room: "r",
      x: 100,
      y: 100,
      travel: "carriage",
      name: "運転手",
    },
    b = { id: "b", room: "r", x: 120, y: 100, travel: "walk" };
  const players = new Map([
      ["a", a],
      ["b", b],
    ]),
    handlers = {};
  const play = createPlay({
    players,
    blocked: new Map(),
    rooms: new Map(),
    io: { to: () => ({ emit() {} }) },
    snapshot() {},
    roomUpdate() {},
    store: {},
    isAdmin: () => false,
    limit: () => true,
  });
  for (const id of ["a", "b"]) {
    handlers[id] = {};
    play.register({ id }, (name, fn) => (handlers[id][name] = fn));
  }
  assert.ok(handlers.a["ride-invite"]({ id: "b" }).ok);
  now = 31001;
  assert.ok(handlers.b["ride-answer"]({ accept: true }).error);
  assert.equal(b.rideWith, undefined);
});
