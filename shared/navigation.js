import { walkable, WIDTH, HEIGHT } from "../server/world.js";
export function clearPath(a, b, objects) {
  const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4);
  for (let i = 0; i <= steps; i++) {
    const t = steps ? i / steps : 0;
    if (!walkable(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, objects))
      return false;
  }
  return true;
}
// Search only reachable ground; clicks on scenery stop at its nearest accessible edge.
export function findPath(start, goal, objects) {
  if (![start.x, start.y, goal.x, goal.y].every(Number.isFinite)) return [];
  if (clearPath(start, goal, objects)) return [goal];
  const nodes = [];
  for (let y = 24; y <= HEIGHT - 24; y += 10)
    for (let x = 24; x <= WIDTH - 24; x += 10)
      if (walkable(x, y, objects)) nodes.push({ x, y });
  const lookup = new Map(nodes.map((p, i) => [`${p.x},${p.y}`, i]));
  const queue = [],
    parents = new Map();
  nodes.forEach((p, i) => {
    if (
      Math.hypot(p.x - start.x, p.y - start.y) <= 32 &&
      clearPath(start, p, objects)
    ) {
      queue.push(i);
      parents.set(i, -1);
    }
  });
  let best = -1,
    distance = Infinity;
  for (let head = 0; head < queue.length; head++) {
    const id = queue[head],
      p = nodes[id],
      d = Math.hypot(p.x - goal.x, p.y - goal.y);
    if (d < distance) {
      best = id;
      distance = d;
    }
    for (const [dx, dy] of [
      [10, 0],
      [-10, 0],
      [0, 10],
      [0, -10],
    ]) {
      const next = lookup.get(`${p.x + dx},${p.y + dy}`);
      if (
        next === undefined ||
        parents.has(next) ||
        !clearPath(p, nodes[next], objects)
      )
        continue;
      parents.set(next, id);
      queue.push(next);
    }
  }
  if (best < 0) return [];
  const path = [];
  for (let id = best; id !== -1; id = parents.get(id)) path.unshift(nodes[id]);
  if (clearPath(path.at(-1), goal, objects)) path.push(goal);
  const result = [];
  let from = start;
  while (path.length) {
    let i = path.length - 1;
    while (i > 0 && !clearPath(from, path[i], objects)) i--;
    from = path[i];
    result.push(from);
    path.splice(0, i + 1);
  }
  return result;
}
