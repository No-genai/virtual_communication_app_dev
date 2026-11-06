import { VILLAGES } from "../shared/themes.js";
export const WIDTH = 1000,
  HEIGHT = 680,
  RANGE = 180;
export const obstacles = [
  { x: 100, y: 120, w: 200, h: 80 },
  { x: 700, y: 120, w: 200, h: 80 },
  { x: 425, y: 260, w: 150, h: 95 },
  { x: 100, y: 460, w: 160, h: 90 },
  { x: 740, y: 460, w: 160, h: 90 },
];
export const zones = [
  { id: "meeting", name: "ミーティング", x: 65, y: 95, w: 280, h: 155 },
  { id: "quiet", name: "集中エリア", x: 710, y: 430, w: 220, h: 155 },
];
export function zoneAt(p) {
  if (p.village) return null;
  return (
    zones.find(
      (z) => p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h,
    )?.id || null
  );
}
// Village scenery is decorative: players can walk over every prop.
export function collisionObjects(room) {
  return ["villages", "city", "farm", "sky", "boss"].includes(room?.theme)
    ? []
    : room?.objects || obstacles;
}
// Collision follows the avatar feet, not the full sprite width.
// 24px gaps between village props must remain usable walkways.
export function walkable(x, y, objects = obstacles) {
  return (
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    x >= 22 &&
    y >= 22 &&
    x <= WIDTH - 22 &&
    y <= HEIGHT - 22 &&
    !objects.some(
      (o) =>
        x > o.x - 6 && x < o.x + o.w + 6 && y > o.y - 6 && y < o.y + o.h + 6,
    )
  );
}
export function near(a, b) {
  if (a.campfire || b.campfire) return !!a.campfire && !!b.campfire;
  if (a.village || b.village) return !!a.village && a.village === b.village;
  const za = zoneAt(a),
    zb = zoneAt(b);
  if (za === "meeting" || zb === "meeting") return za === zb;
  return Math.hypot(a.x - b.x, a.y - b.y) <= RANGE;
}
export function validName(v) {
  return (
    typeof v === "string" &&
    v.trim().length > 0 &&
    v.trim().length <= 20 &&
    !/[\x00-\x1f]/.test(v)
  );
}
export function canTalk(a, b) {
  return (
    a.room === b.room &&
    a.call &&
    b.call &&
    a.status !== "away" &&
    b.status !== "away" &&
    zoneAt(a) !== "quiet" &&
    zoneAt(b) !== "quiet" &&
    (a.broadcast || b.broadcast || near(a, b))
  );
}
export function template(name) {
  if (name === "villages")
    return [
      { x: 100, y: 120, w: 88, h: 76 },
      { x: 212, y: 108, w: 94, h: 55 },
      { x: 224, y: 202, w: 70, h: 42 },
      { x: 694, y: 116, w: 78, h: 92 },
      { x: 796, y: 110, w: 110, h: 52 },
      { x: 796, y: 188, w: 110, h: 52 },
      { x: 112, y: 444, w: 136, h: 82 },
      { x: 280, y: 474, w: 42, h: 60 },
      { x: 762, y: 440, w: 120, h: 100 },
      { x: 680, y: 480, w: 48, h: 54 },
      { x: 898, y: 476, w: 40, h: 62 },
      { x: 490, y: 346, w: 20, h: 38 },
    ];
  if (name === "garden")
    return [
      { x: 160, y: 160, w: 140, h: 70 },
      { x: 700, y: 170, w: 140, h: 70 },
      { x: 420, y: 310, w: 140, h: 70 },
    ];
  if (name === "classroom")
    return [
      { x: 400, y: 100, w: 200, h: 70 },
      ...Array.from({ length: 6 }, (_, i) => ({
        x: 160 + (i % 3) * 260,
        y: 290 + Math.floor(i / 3) * 130,
        w: 140,
        h: 65,
      })),
    ];
  return structuredClone(obstacles);
}

// Spread arrivals across the entrance so the first guests do not overlap.
export function spawnPoint(occupants, objects = obstacles) {
  const choices = [];
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -3; dx <= 3; dx++)
      choices.push({ x: 500 + dx * 56, y: 540 + dy * 56 });
  choices.sort(
    (a, b) =>
      Math.hypot(a.x - 500, a.y - 540) - Math.hypot(b.x - 500, b.y - 540),
  );
  return (
    choices.find(
      (p) =>
        walkable(p.x, p.y, objects) &&
        occupants.every((q) => Math.hypot(q.x - p.x, q.y - p.y) >= 40),
    ) || { x: 500, y: 540 }
  );
}

export function villageAt(p, theme) {
  if (theme !== "villages") return null;
  return (
    VILLAGES.find(
      (v) => p.x >= v.x && p.x < v.x + v.w && p.y >= v.y && p.y < v.y + v.h,
    )?.id || null
  );
}
export function villageSpawn(occupants, objects, id = "farm") {
  const v = VILLAGES.find((v) => v.id === id);
  if (!v) return null;
  const choices = [];
  for (let y = v.y + 28; y < v.y + v.h - 22; y += 44)
    for (let x = v.x + 28; x < v.x + v.w - 22; x += 44)
      if (walkable(x, y, objects)) choices.push({ x, y });
  choices.sort(
    (a, b) =>
      Math.hypot(a.x - v.x - v.w / 2, a.y - v.y - v.h / 2) -
      Math.hypot(b.x - v.x - v.w / 2, b.y - v.y - v.h / 2),
  );
  return (
    choices.find((p) =>
      occupants.every((q) => Math.hypot(q.x - p.x, q.y - p.y) >= 40),
    ) ||
    choices[0] ||
    null
  );
}

export function upgradeVillageLayout(room) {
  if (room.theme !== "villages") return room;
  const legacy = VILLAGES.flatMap((v) =>
    obstacles.map((o) => ({
      x: v.x + o.x / 2,
      y: v.y + o.y / 2,
      w: o.w / 2,
      h: o.h / 2,
    })),
  );
  const matches =
    room.objects?.length === legacy.length &&
    room.objects.every((o, i) =>
      ["x", "y", "w", "h"].every((k) => o[k] === legacy[i][k]),
    );
  const previous = template("villages").map((o) =>
    o.x === 490 && o.y === 346 ? { x: 425, y: 260, w: 150, h: 95 } : o,
  );
  const oldCommons =
    room.objects?.length === previous.length &&
    room.objects.every((o, i) =>
      ["x", "y", "w", "h"].every((k) => o[k] === previous[i][k]),
    );
  return matches || oldCommons
    ? { ...room, objects: template("villages") }
    : room;
}
