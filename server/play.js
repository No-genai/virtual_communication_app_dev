import { DEFAULT_LOOK, validLook, validScenery } from "../shared/play.js";
export function createPlay({
  players,
  blocked,
  rooms,
  io,
  snapshot,
  roomUpdate,
  store,
  isAdmin,
  limit,
}) {
  const invites = new Map();
  const denied = (a, b) =>
    blocked.get(a.id)?.has(b.id) || blocked.get(b.id)?.has(a.id);
  function release(p) {
    p.rideWith = null;
    for (const q of players.values())
      if (q.rideWith === p.id) {
        q.rideWith = null;
        q.travel = "walk";
      }
    for (const [id, v] of invites)
      if (v.from === p.id || id === p.id) invites.delete(id);
  }
  function sync(room) {
    for (const p of players.values())
      if (p.room === room && p.rideWith) {
        const driver = players.get(p.rideWith);
        if (
          !driver ||
          driver.room !== p.room ||
          driver.travel !== "carriage" ||
          driver.rideWith ||
          denied(p, driver)
        ) {
          p.rideWith = null;
          p.travel = "walk";
        } else {
          p.x = driver.x;
          p.y = driver.y;
        }
      }
  }
  function register(socket, handle) {
    const fail = (error) => ({ error });
    handle("look", (data) => {
      const p = players.get(socket.id);
      if (!p || !validLook(data) || !limit("look:" + p.id, 10, 5000))
        return fail("着せ替えの内容を確認してください。");
      p.look = Object.fromEntries(
        Object.keys(DEFAULT_LOOK).map((k) => [k, data[k]]),
      );
      snapshot(p.room);
      return { ok: true };
    });
    handle("pet-stroke", () => {
      const p = players.get(socket.id);
      if (
        !p ||
        !p.look ||
        p.look.pet === "none" ||
        !limit("pet:" + p.id, 3, 5000)
      )
        return fail("ペットを選び、少し間隔をあけてください。");
      p.petHappyUntil = Date.now() + 4000;
      snapshot(p.room);
      return { ok: true };
    });
    handle("ride-invite", (data) => {
      const p = players.get(socket.id),
        q = players.get(data?.id);
      for (const [id, v] of invites)
        if (v.until < Date.now()) invites.delete(id);
      if (
        !p ||
        !q ||
        p.id === q.id ||
        p.room !== q.room ||
        p.travel !== "carriage" ||
        p.rideWith ||
        q.rideWith ||
        q.travel === "carriage" ||
        denied(p, q) ||
        Math.hypot(p.x - q.x, p.y - q.y) > 180 ||
        !limit("ride:" + p.id, 4, 10000)
      )
        return fail("馬車に乗り、近くの参加者を選んでください。");
      if (invites.has(q.id)) return fail("その人は招待を確認中です。");
      if ([...players.values()].filter((v) => v.rideWith === p.id).length >= 2)
        return fail("馬車は3人までです。");
      const invite = { from: p.id, name: p.name, until: Date.now() + 30000 };
      invites.set(q.id, invite);
      io.to(q.id).emit("ride-invitation", invite);
      return { ok: true };
    });
    handle("ride-answer", (data) => {
      const p = players.get(socket.id),
        v = invites.get(socket.id),
        driver = players.get(v?.from);
      if (!p || !v || typeof data?.accept !== "boolean")
        return fail("招待がありません。");
      invites.delete(p.id);
      if (!data.accept) return { ok: true };
      if (
        v.until < Date.now() ||
        !driver ||
        driver.room !== p.room ||
        driver.travel !== "carriage" ||
        driver.rideWith ||
        p.rideWith ||
        p.travel === "carriage" ||
        denied(p, driver) ||
        Math.hypot(p.x - driver.x, p.y - driver.y) > 180 ||
        [...players.values()].filter((q) => q.rideWith === driver.id).length >=
          2
      )
        return fail("招待の期限切れ、満員、または馬車が遠くへ移動しました。");
      p.rideWith = driver.id;
      p.travel = "walk";
      snapshot(p.room);
      return { ok: true };
    });
    handle("ride-leave", () => {
      const p = players.get(socket.id);
      if (!p) return fail("入室してください。");
      release(p);
      p.travel = "walk";
      snapshot(p.room);
      return { ok: true };
    });
    handle("scenery", async (data) => {
      const p = players.get(socket.id),
        r = rooms.get(p?.room);
      if (
        !r ||
        !isAdmin(p) ||
        !validScenery(data) ||
        !limit("scenery:" + p.id, 8, 10000)
      )
        return fail("全員への変更は主催者のみ行えます。");
      const previous = r.scenery;
      r.scenery = {
        weather: data.weather,
        time: data.time,
        season: data.season,
      };
      try {
        await store.save();
      } catch (e) {
        r.scenery = previous;
        throw e;
      }
      roomUpdate(r);
      return { ok: true };
    });
  }
  return { release, sync, register };
}
