import { test } from "node:test";
import assert from "node:assert/strict";
import { walkable, near, validName } from "../server/world.js";
test("bounds, furniture and non-finite coordinates are rejected", () => {
  for (const p of [
    [NaN, 10],
    [Infinity, 10],
    [-1, 100],
    [999, 100],
    [150, 150],
  ])
    assert.equal(walkable(...p), false);
  assert.equal(walkable(500, 540), true);
});
test("proximity has an inclusive 180 pixel boundary", () => {
  assert.ok(near({ x: 0, y: 0 }, { x: 180, y: 0 }));
  assert.ok(!near({ x: 0, y: 0 }, { x: 181, y: 0 }));
});
test("names must be bounded strings without controls", () => {
  for (const n of ["", null, {}, "x".repeat(21), "a\nb"])
    assert.equal(validName(n), false);
  assert.ok(validName(" はる "));
});
test("meeting conversations stay inside their zone and custom furniture blocks movement", async () => {
  const { zoneAt, canTalk, template } = await import("../server/world.js");
  assert.equal(zoneAt({ x: 80, y: 220 }), "meeting");
  assert.ok(near({ x: 80, y: 220 }, { x: 320, y: 220 }));
  assert.ok(!near({ x: 80, y: 220 }, { x: 80, y: 260 }));
  const a = { room: "a", x: 500, y: 540, call: true, status: "available" },
    b = { ...a, x: 520 };
  assert.ok(canTalk(a, b));
  assert.ok(!canTalk(a, { ...b, room: "b" }));
  assert.ok(!canTalk(a, { ...b, status: "away" }));
  assert.ok(!canTalk(a, { ...b, x: 720, y: 560 }));
  assert.ok(walkable(500, 540, template("classroom")));
});

test("thirty arrivals have distinct walkable spawn locations", async () => {
  const { spawnPoint } = await import("../server/world.js");
  const occupants = [];
  for (let i = 0; i < 30; i++) {
    const p = spawnPoint(occupants);
    assert.ok(walkable(p.x, p.y));
    assert.ok(occupants.every((q) => Math.hypot(p.x - q.x, p.y - q.y) >= 40));
    occupants.push(p);
  }
});

test("four village boundaries isolate even adjacent people and provide thirty valid arrivals", async () => {
  const { villageAt, villageSpawn, template, near, canTalk } = await import(
    "../server/world.js"
  );
  const objects = template("villages");
  const a = {
      id: "a",
      room: "r",
      x: 499,
      y: 200,
      village: "city",
      call: true,
      status: "available",
    },
    b = { ...a, id: "b", x: 501, village: "farm" };
  assert.equal(villageAt(a, "villages"), "city");
  assert.equal(villageAt(b, "villages"), "farm");
  assert.equal(near(a, b), false);
  assert.equal(canTalk(a, b), false);
  assert.equal(canTalk({ ...a, broadcast: true }, b), true);
  assert.equal(near(a, { ...b, village: "city", x: 30, y: 30 }), true);
  for (const id of ["city", "farm", "sky", "boss"]) {
    const people = [];
    for (let i = 0; i < 30; i++) {
      const p = villageSpawn(people, objects, id);
      assert.ok(p);
      assert.ok(walkable(p.x, p.y, objects));
      assert.equal(villageAt(p, "villages"), id);
      assert.ok(people.every((q) => Math.hypot(q.x - p.x, q.y - p.y) >= 40));
      people.push(p);
    }
  }
});

test("standard tiled layout migrates while custom furniture and room settings survive", async () => {
  const { upgradeVillageLayout, obstacles, template } = await import(
    "../server/world.js"
  );
  const { VILLAGES } = await import("../shared/themes.js");
  const room = {
    id: "test",
    theme: "villages",
    passwordHash: "saved",
    posts: [{ text: "hello" }],
    objects: VILLAGES.flatMap((v) =>
      obstacles.map((o) => ({
        x: v.x + o.x / 2,
        y: v.y + o.y / 2,
        w: o.w / 2,
        h: o.h / 2,
      })),
    ),
  };
  const migrated = upgradeVillageLayout(room);
  assert.deepEqual(migrated, { ...room, objects: template("villages") });
  const custom = { ...room, objects: room.objects.slice(1) };
  assert.equal(upgradeVillageLayout(custom), custom);
  assert.equal(upgradeVillageLayout({ ...room, theme: "farm" }).theme, "farm");
});

test("central commons ground is accessible and old standard rooms migrate", async () => {
  const { template, upgradeVillageLayout } = await import("../server/world.js");
  const objects = template("villages");
  assert.ok(walkable(450, 320, objects));
  assert.ok(walkable(550, 320, objects));
  assert.equal(walkable(500, 365, objects), false);
  const old = objects.map((o) =>
    o.x === 490 ? { x: 425, y: 260, w: 150, h: 95 } : o,
  );
  assert.deepEqual(
    upgradeVillageLayout({ theme: "villages", objects: old }).objects,
    objects,
  );
});
test("click paths detour around central tree and stop outside blocked destinations", async () => {
  const { findPath, clearPath } = await import("../shared/navigation.js");
  const { template } = await import("../server/world.js");
  const objects = template("villages");
  for (const goal of [
    { x: 500, y: 240 },
    { x: 450, y: 320 },
    { x: 500, y: 365 },
    { x: 350, y: 280 },
  ]) {
    let from = { x: 500, y: 540 };
    const path = findPath(from, goal, objects);
    assert.ok(path.length);
    for (const p of path) {
      assert.ok(clearPath(from, p, objects));
      from = p;
    }
    assert.ok(walkable(from.x, from.y, objects));
    if (walkable(goal.x, goal.y, objects)) assert.deepEqual(from, goal);
  }
  assert.deepEqual(findPath({ x: 500, y: 540 }, { x: NaN, y: 0 }, objects), []);
});

test("farm paths between windmill and crop beds remain open", async () => {
  const { template } = await import("../server/world.js");
  const { findPath, clearPath } = await import("../shared/navigation.js");
  const objects = template("villages");
  for (let y = 90; y <= 270; y++)
    assert.ok(walkable(784, y, objects), `blocked at 784,${y}`);
  for (let x = 784; x <= 930; x++)
    assert.ok(walkable(x, 175, objects), `blocked at ${x},175`);
  assert.equal(walkable(830, 210, objects), false);
  const start = { x: 784, y: 270 },
    goal = { x: 850, y: 175 };
  const path = findPath(start, goal, objects);
  let from = start;
  for (const p of path) {
    assert.ok(clearPath(from, p, objects));
    from = p;
  }
  assert.deepEqual(from, goal);
});

test("village scenery is passable while world bounds and classroom furniture remain solid", async () => {
  const { collisionObjects, template } = await import("../server/world.js");
  for (const theme of ["villages", "farm", "city", "sky", "boss"]) {
    const objects = template(theme),
      collisions = collisionObjects({ theme, objects });
    for (const o of objects)
      assert.ok(walkable(o.x + o.w / 2, o.y + o.h / 2, collisions));
    assert.equal(walkable(-1, 300, collisions), false);
    assert.equal(walkable(1000, 300, collisions), false);
  }
  assert.equal(
    walkable(
      450,
      120,
      collisionObjects({ theme: "classroom", objects: template("classroom") }),
    ),
    false,
  );
});
