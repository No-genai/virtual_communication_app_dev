import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openStore, hashPassword, checkPassword } from "../server/store.js";
test("saved spaces reload with hashed credentials and board posts, but not transient drawings", async () => {
  const dir = await mkdtemp(join(tmpdir(), "komorebi-store-"));
  process.env.DATA_DIR = dir;
  try {
    const store = await openStore();
    const room = store.rooms.get("lounge");
    room.name = "再起動後の授業";
    room.owner = await hashPassword("owner-password-test");
    room.board = [{ id: "post", text: "保存する資料" }];
    room.strokes = [
      {
        points: [
          [0, 0],
          [1, 1],
        ],
        color: "#333333",
      },
    ];
    await store.save();
    const restored = (await openStore()).rooms.get("lounge");
    assert.equal(restored.name, "再起動後の授業");
    assert.equal(restored.board[0].text, "保存する資料");
    assert.equal(restored.strokes.length, 0);
    assert.ok(await checkPassword("owner-password-test", restored.owner));
    assert.equal(await checkPassword("wrong", restored.owner), false);
  } finally {
    delete process.env.DATA_DIR;
    await rm(dir, { recursive: true, force: true });
  }
});
