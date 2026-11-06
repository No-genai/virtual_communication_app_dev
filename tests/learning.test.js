import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { io } from "socket.io-client";
let server;
const url = "http://127.0.0.1:3014",
  clients = [];
before(async () => {
  server = spawn(process.execPath, ["server/index.js"], {
    env: {
      ...process.env,
      PORT: "3014",
      NODE_ENV: "production",
      DATA_DIR: `/tmp/komorebi-learning-${process.pid}`,
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
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function createRoom() {
  const a = await client();
  const created = await emit(a, "create-room", {
    name: "学びの村",
    ownerPassword: "learning-owner-password",
    password: "",
    theme: "villages",
  });
  assert.ok(created.room);
  await emit(a, "join", {
    name: "先生",
    room: created.room.id,
    adminToken: created.adminToken,
  });
  return { a, room: created.room.id };
}
test("quiz answers stay server-side, score once, isolate learners and return review explanations", async () => {
  const { a, room } = await createRoom();
  const b = await client();
  await emit(b, "join", { name: "生徒", room });
  assert.ok((await emit(a, "quiz-start", { topic: "git" })).error);
  await emit(a, "village-enter", { village: "city" });
  assert.ok((await emit(a, "quiz-start", { topic: "notion" })).error);
  const quiz = await emit(a, "quiz-start", { topic: "mixed" });
  assert.equal(quiz.total, 6);
  assert.match(quiz.source, /未反映/);
  let q = quiz.question;
  const { QUESTIONS } = await import("../server/lessons.js");
  let result;
  for (let i = 0; i < 6; i++) {
    assert.equal(q.answer, undefined);
    assert.equal(q.explanation, undefined);
    const authored = QUESTIONS.find((x) => x.id === q.id);
    const correct = q.choices.indexOf(authored.choices[authored.answer]);
    const choice = i % 2 === 0 ? correct : (correct + 1) % q.choices.length;
    assert.ok(
      (
        await emit(b, "quiz-answer", {
          session: quiz.session,
          question: q.id,
          choice,
        })
      ).error,
    );
    const answer = await emit(a, "quiz-answer", {
      session: quiz.session,
      question: q.id,
      choice,
    });
    assert.ok(answer.explanation);
    assert.equal(answer.correct, i % 2 === 0);
    assert.ok(
      (
        await emit(a, "quiz-answer", {
          session: quiz.session,
          question: q.id,
          choice,
        })
      ).error,
    );
    if (answer.done) result = answer.result;
    else q = answer.question;
  }
  assert.equal(result.correct, 3);
  assert.equal(result.mistakes.length, 3);
  a.disconnect();
  b.disconnect();
});
test("campfire joins conversation across village boundaries; badges and topics sync", async () => {
  const { a, room } = await createRoom();
  const b = await client(),
    c = await client();
  await emit(b, "join", { name: "仲間", room });
  await emit(c, "join", { name: "輪の外", room });
  let state = [];
  a.on("world", (v) => (state = v));
  await emit(a, "admin", { action: "furniture", objects: [] });
  await pause(50);
  assert.ok((await emit(a, "social-badge", { badge: "bad" })).error);
  assert.ok((await emit(a, "social-badge", { badge: "open" })).ok);
  await pause(30);
  assert.equal(state.find((p) => p.id === a.id).badge, "open");
  assert.ok((await emit(a, "campfire-next")).error);
  async function walk(socket, x, y) {
    for (let i = 0; i < 100; i++) {
      const p = state.find((q) => q.id === socket.id);
      if (Math.hypot(x - p.x, y - p.y) < 8) return;
      socket.emit("move", { dx: x - p.x, dy: y - p.y });
      await pause(45);
    }
    throw new Error("did not arrive");
  }
  await walk(a, 480, 440);
  await walk(b, 520, 440);
  assert.equal(state.find((p) => p.id === a.id).campfire, true);
  assert.equal(state.find((p) => p.id === b.id).campfire, true);
  assert.notEqual(
    state.find((p) => p.id === a.id).village,
    state.find((p) => p.id === b.id).village,
  );
  const topic = new Promise((r) => b.once("campfire-topic", r));
  assert.ok((await emit(a, "campfire-next")).ok);
  assert.ok((await topic).text);
  assert.ok((await emit(b, "campfire-next")).error);
  let leaked = false;
  c.on("message", () => (leaked = true));
  const message = new Promise((r) => b.once("message", r));
  await emit(a, "chat", { text: "焚き火でこんにちは", scope: "nearby" });
  assert.equal((await message).text, "焚き火でこんにちは");
  await pause(80);
  assert.equal(leaked, false);
  for (const p of [a, b, c]) p.disconnect();
});

test("GitHub course covers all six chapters and supports chapter-specific quizzes", async () => {
  const { a } = await createRoom();
  await emit(a, "village-enter", { village: "city" });
  assert.ok(
    (await emit(a, "quiz-start", { topic: "git", lesson: "invalid" })).error,
  );
  assert.ok(
    (await emit(a, "quiz-start", { topic: "linux", lesson: "pr" })).error,
  );
  const { GITHUB_QUESTIONS } = await import("../server/github-questions.js");
  const quiz = await emit(a, "quiz-start", { topic: "git", lesson: "all" });
  assert.equal(quiz.total, 6);
  const chapters = new Set();
  let q = quiz.question,
    last;
  for (let i = 0; i < 6; i++) {
    chapters.add(q.lesson);
    assert.equal(q.answer, undefined);
    const authored = GITHUB_QUESTIONS.find((x) => x.id === q.id);
    last = await emit(a, "quiz-answer", {
      session: quiz.session,
      question: q.id,
      choice: q.choices.indexOf(authored.choices[authored.answer]),
    });
    q = last.question;
  }
  assert.equal(chapters.size, 6);
  assert.equal(last.result.correct, 6);
  const chapter = await emit(a, "quiz-start", { topic: "git", lesson: "pr" });
  assert.equal(chapter.total, 2);
  assert.equal(chapter.question.lesson, "pr");
  a.disconnect();
});
