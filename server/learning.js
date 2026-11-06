import { GITHUB_STEPS } from "../shared/github-course.js";
import { GITHUB_QUESTIONS } from "./github-questions.js";
import { randomInt, randomUUID } from "node:crypto";
import { QUESTIONS } from "./lessons.js";
import { validBadge, atCampfire } from "../shared/learning.js";
const TOPICS = [
  "最近「できるようになったこと」を一つ教えてください。",
  "今、誰かに聞いてみたいことはありますか？",
  "GitやLinuxでつまずいたとき、どうやって調べていますか？",
  "好きな村と、その理由を教えてください。",
  "最近見つけた便利な工夫を一つ紹介してください。",
  "今日の学びを一言で表すなら？",
  "ペットに名前を付けるなら、どんな名前にしますか？",
  "次にみんなで挑戦したいことは何ですか？",
];
const shuffle = (a) => {
  const v = [...a];
  for (let i = v.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [v[i], v[j]] = [v[j], v[i]];
  }
  return v;
};
export function createLearning({ players, rooms, io, snapshot, limit }) {
  const topics = new Map(),
    sessions = new Map();
  const fail = (error) => ({ error });
  function topic(room) {
    const t = topics.get(room) || { index: 0, changedAt: 0 };
    return { text: TOPICS[t.index], index: t.index };
  }
  function question(s) {
    const q = s.questions[s.position];
    return q
      ? {
          id: q.id,
          prompt: q.prompt,
          choices: q.choices,
          topic: q.topic,
          lesson: q.lesson,
        }
      : null;
  }
  function remove(id) {
    sessions.delete(id);
  }
  function register(socket, handle) {
    handle("social-badge", (data) => {
      const p = players.get(socket.id);
      if (!p || !validBadge(data?.badge) || !limit("badge:" + p.id, 8, 5000))
        return fail("目印を選び直してください。");
      p.badge = data.badge;
      snapshot(p.room);
      return { ok: true };
    });
    handle("campfire-info", () => {
      const p = players.get(socket.id);
      return p ? topic(p.room) : fail("入室してください。");
    });
    handle("campfire-next", () => {
      const p = players.get(socket.id),
        r = rooms.get(p?.room);
      if (!p || !atCampfire(p, r?.theme))
        return fail("焚き火の近くに集まってください。");
      const prev = topics.get(p.room) || { index: 0, changedAt: 0 };
      if (Date.now() - prev.changedAt < 5000)
        return fail("次のお題までは5秒あけてください。");
      topics.set(p.room, {
        index: (prev.index + 1) % TOPICS.length,
        changedAt: Date.now(),
      });
      io.to(p.room).emit("campfire-topic", topic(p.room));
      return { ok: true };
    });
    handle("quiz-start", (data) => {
      const p = players.get(socket.id);
      if (
        !p ||
        !["git", "linux", "mixed"].includes(data?.topic) ||
        !limit("quiz-start:" + p.id, 6, 60000)
      )
        return fail("学習コースを選び、少し間隔をあけてください。");
      const r = rooms.get(p.room);
      if (
        r?.theme !== "city" &&
        !(r?.theme === "villages" && p.village === "city")
      )
        return fail("都会の学びの広場へ移動してください。");
      if (
        data.lesson !== undefined &&
        (data.topic !== "git" ||
          (data.lesson !== "all" &&
            !GITHUB_STEPS.some((s) => s.id === data.lesson)))
      )
        return fail("章を選び直してください。");
      const lesson = data.lesson || "all";
      const selected =
        data.topic === "git"
          ? lesson === "all"
            ? GITHUB_STEPS.map(
                (step) =>
                  shuffle(
                    GITHUB_QUESTIONS.filter((q) => q.lesson === step.id),
                  )[0],
              )
            : shuffle(GITHUB_QUESTIONS.filter((q) => q.lesson === lesson))
          : shuffle(
              QUESTIONS.filter(
                (q) => data.topic === "mixed" || q.topic === data.topic,
              ),
            ).slice(0, 6);
      const questions = selected.map((q) => {
        const order = shuffle(q.choices.map((_, i) => i));
        return {
          ...q,
          choices: order.map((i) => q.choices[i]),
          answer: order.indexOf(q.answer),
        };
      });
      const s = {
        id: randomUUID(),
        questions,
        position: 0,
        correct: 0,
        mistakes: [],
        until: Date.now() + 20 * 60000,
      };
      sessions.set(p.id, s);
      return {
        session: s.id,
        total: questions.length,
        position: 0,
        question: question(s),
        source:
          data.topic === "git"
            ? "GitHub基本操作コース（独自作成）"
            : "一般基礎問題（スパルタ塾の教材は未反映）",
      };
    });
    handle("quiz-answer", (data) => {
      const p = players.get(socket.id),
        s = sessions.get(socket.id),
        q = s?.questions[s.position];
      if (
        !p ||
        !s ||
        s.until < Date.now() ||
        s.id !== data?.session ||
        !q ||
        q.id !== data.question ||
        !Number.isInteger(data.choice) ||
        data.choice < 0 ||
        data.choice >= q.choices.length
      )
        return fail(
          "回答を確認してください。時間切れの場合は最初から挑戦できます。",
        );
      const correct = data.choice === q.answer;
      if (correct) s.correct++;
      else
        s.mistakes.push({
          prompt: q.prompt,
          topic: q.topic,
          lesson: q.lesson,
          yourAnswer: q.choices[data.choice],
          answer: q.choices[q.answer],
          explanation: q.explanation,
          source: q.source,
        });
      s.position++;
      const done = s.position === s.questions.length;
      return {
        correct,
        answer: q.choices[q.answer],
        explanation: q.explanation,
        source: q.source,
        done,
        position: s.position,
        total: s.questions.length,
        question: question(s),
        result: done
          ? {
              correct: s.correct,
              total: s.questions.length,
              mistakes: s.mistakes,
            }
          : null,
      };
    });
  }
  return { register, remove };
}
