import { GITHUB_STEPS, GITHUB_PRACTICE } from "../shared/github-course.js";
import {
  BADGES,
  validBadge,
  CAMPFIRE,
  CLASSROOM,
  NOTION_MATERIAL,
} from "../shared/learning.js";
export function readBadge() {
  try {
    const v = localStorage.getItem("komorebi-badge");
    return validBadge(v) ? v : "none";
  } catch {
    return "none";
  }
}
export function initLearning({ socket, action, getState, canvas, moveTo }) {
  const $ = (id) => document.getElementById(id);
  let session = null,
    pending = null,
    busy = false;
  const me = () => {
    const s = getState();
    return s.players.find((p) => p.id === s.self);
  };
  function open(id) {
    $("actions-dialog").close();
    $(id).showModal();
  }
  for (const id of ["campfire-dialog", "badge-dialog", "learning-dialog"])
    $(id).addEventListener("close", () => canvas.focus());
  for (const [value, name] of Object.entries(BADGES)) {
    const o = document.createElement("option");
    o.value = value;
    o.textContent = name;
    $("social-badge").append(o);
  }
  $("notion-material").href = NOTION_MATERIAL;
  function refresh() {
    const s = getState(),
      p = me(),
      world = s.room?.theme === "villages";
    $("fire-hotspot").hidden = !world;
    $("lesson-hotspot").hidden = !world;
    $("next-topic").disabled = !p?.campfire;
    $("walk-to-fire").disabled = !world || !!p?.rideWith;
    $("campfire-status").textContent = p?.campfire
      ? `焚き火の輪に${s.players.filter((q) => q.campfire).length}人が集まっています。`
      : "輪の近くに集まると、お題を変えたり参加者と話せます。";
    const ready = p?.village === "city" || s.room?.theme === "city";
    $("quiz-start").disabled = !ready || busy;
    $("walk-to-lesson").disabled = !world || !!p?.rideWith;
    $("quiz-location").textContent = ready
      ? "学びの広場にいます。挑戦するコースを選んでください。"
      : "都会の村に移動すると挑戦できます。";
  }
  async function openFire() {
    const r = await action("campfire-info");
    if (r.error) return;
    $("campfire-topic").textContent = r.text;
    refresh();
    open("campfire-dialog");
  }
  $("open-campfire").onclick = openFire;
  $("fire-hotspot").onclick = openFire;
  $("next-topic").onclick = async () => {
    const b = $("next-topic");
    b.disabled = true;
    try {
      await action("campfire-next");
    } finally {
      refresh();
    }
  };
  socket.on("campfire-topic", (r) => {
    $("campfire-topic").textContent = r.text;
  });
  $("walk-to-fire").onclick = () => {
    $("campfire-dialog").close();
    moveTo(CAMPFIRE);
  };
  $("walk-to-lesson").onclick = () => {
    $("learning-dialog").close();
    moveTo(CLASSROOM);
  };
  $("open-badge").onclick = () => {
    $("social-badge").value = me()?.badge || "none";
    open("badge-dialog");
  };
  $("save-badge").onclick = async () => {
    const badge = $("social-badge").value,
      r = await action("social-badge", { badge });
    if (!r.error) {
      try {
        localStorage.setItem("komorebi-badge", badge);
      } catch {}
      $("badge-dialog").close();
    }
  };
  function openLearning() {
    refresh();
    open("learning-dialog");
  }
  $("open-learning").onclick = openLearning;
  $("lesson-hotspot").onclick = openLearning;
  let readSteps = [];
  try {
    const saved = JSON.parse(
      localStorage.getItem("komorebi-github-read-v1") || "[]",
    );
    if (Array.isArray(saved))
      readSteps = saved.filter((id) => GITHUB_STEPS.some((s) => s.id === id));
  } catch {}
  $("github-practice").href = GITHUB_PRACTICE;
  for (const step of GITHUB_STEPS) {
    const option = document.createElement("option");
    option.value = step.id;
    option.textContent = step.title;
    $("github-step").append(option);
  }
  function renderGuide() {
    $("github-guide").hidden = $("quiz-course").value !== "git";
    const root = $("github-reading");
    root.replaceChildren();
    const selected = GITHUB_STEPS.find((s) => s.id === $("github-step").value);
    $("github-read-progress").textContent =
      `読んだ章（自己チェック）：${readSteps.length} / 6`;
    if (!selected) {
      for (const step of GITHUB_STEPS) {
        const button = document.createElement("button");
        button.textContent = `${readSteps.includes(step.id) ? "✓ " : ""}${step.title}`;
        button.onclick = () => {
          $("github-step").value = step.id;
          renderGuide();
        };
        root.append(button);
      }
      return;
    }
    for (const text of [selected.summary, selected.practice]) {
      const p = document.createElement("p");
      p.textContent = text;
      root.append(p);
    }
    if (selected.commands) {
      const pre = document.createElement("pre");
      pre.textContent = selected.commands;
      root.append(pre);
    }
    const check = document.createElement("p");
    check.textContent = selected.check;
    root.append(check);
    reference(root, selected.source);
    const mark = document.createElement("button");
    mark.id = "github-mark-read";
    mark.textContent = readSteps.includes(selected.id)
      ? "✓ この章は読了済み"
      : "この章を読んだ";
    mark.onclick = () => {
      if (!readSteps.includes(selected.id)) readSteps.push(selected.id);
      try {
        localStorage.setItem(
          "komorebi-github-read-v1",
          JSON.stringify(readSteps),
        );
      } catch {}
      renderGuide();
    };
    root.append(mark);
    const next = GITHUB_STEPS[GITHUB_STEPS.indexOf(selected) + 1];
    if (next) {
      const b = document.createElement("button");
      b.textContent = "次の章を読む →";
      b.onclick = () => {
        $("github-step").value = next.id;
        renderGuide();
      };
      root.append(b);
    }
  }
  $("quiz-course").onchange = renderGuide;
  $("github-step").onchange = renderGuide;
  renderGuide();
  function showQuestion(q, position, total) {
    $("quiz-progress").textContent =
      `${position + 1} / ${total} 問 · ${GITHUB_STEPS.find((s) => s.id === q.lesson)?.title || "一般基礎問題"}`;
    $("quiz-meter").value = position;
    $("quiz-meter").max = total;
    $("quiz-question").textContent = q.prompt;
    $("quiz-choices").replaceChildren();
    $("quiz-feedback").replaceChildren();
    $("quiz-next").hidden = true;
    q.choices.forEach((choice, index) => {
      const b = document.createElement("button");
      b.textContent = choice;
      b.onclick = () => answer(q.id, index);
      $("quiz-choices").append(b);
    });
  }
  function reference(container, url) {
    const a = document.createElement("a");
    a.href = url;
    a.textContent = "公式リファレンス ↗";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    container.append(a);
  }
  async function answer(id, choice) {
    if (busy) return;
    busy = true;
    $("quiz-error").textContent = "";
    for (const b of $("quiz-choices").children) b.disabled = true;
    try {
      const r = await action("quiz-answer", { session, question: id, choice });
      if (r.error) {
        $("quiz-error").textContent = r.error;
        for (const b of $("quiz-choices").children) b.disabled = false;
        return;
      }
      pending = r;
      const title = document.createElement("strong");
      title.textContent = r.correct ? "正解！" : "ここを確認しましょう";
      const explanation = document.createElement("p");
      explanation.textContent = `正解：${r.answer}。${r.explanation}`;
      $("quiz-feedback").replaceChildren(title, explanation);
      reference($("quiz-feedback"), r.source);
      $("quiz-meter").value = r.position;
      $("quiz-next").hidden = false;
      $("quiz-next").textContent = r.done ? "結果と復習を見る" : "次の問題へ";
    } finally {
      busy = false;
    }
  }
  $("quiz-start").onclick = async () => {
    if (busy) return;
    busy = true;
    refresh();
    $("quiz-error").textContent = "";
    try {
      const topic = $("quiz-course").value;
      const r = await action("quiz-start", {
        topic,
        ...(topic === "git" ? { lesson: $("github-step").value } : {}),
      });
      if (r.error) {
        $("quiz-error").textContent = r.error;
        return;
      }
      session = r.session;
      pending = null;
      $("quiz-courses").hidden = true;
      $("quiz-active").hidden = false;
      $("quiz-result").hidden = true;
      showQuestion(r.question, 0, r.total);
    } finally {
      busy = false;
      refresh();
    }
  };
  $("quiz-next").onclick = () => {
    if (!pending) return;
    const r = pending;
    pending = null;
    if (!r.done) {
      showQuestion(r.question, r.position, r.total);
      return;
    }
    $("quiz-active").hidden = true;
    $("quiz-result").hidden = false;
    $("quiz-score").textContent =
      `${r.result.total}問中${r.result.correct}問正解`;
    $("quiz-review").replaceChildren();
    if (!r.result.mistakes.length)
      $("quiz-review").textContent =
        "全問正解！別のコースにも挑戦してみましょう。";
    for (const item of r.result.mistakes) {
      const block = document.createElement("section"),
        h = document.createElement("h4"),
        p = document.createElement("p");
      h.textContent = item.prompt;
      p.textContent = `あなたの回答：${item.yourAnswer} ／ 正解：${item.answer}。${item.explanation}`;
      block.append(h, p);
      reference(block, item.source);
      if (item.lesson) {
        const b = document.createElement("button");
        b.textContent = "この章を読み直す";
        b.onclick = () => {
          $("quiz-restart").click();
          $("quiz-course").value = "git";
          $("github-step").value = item.lesson;
          renderGuide();
        };
        block.append(b);
      }
      $("quiz-review").append(block);
    }
  };
  $("quiz-cancel").onclick = $("quiz-restart").onclick = () => {
    if (busy) return;
    $("quiz-active").hidden = true;
    $("quiz-error").textContent = "";
    $("quiz-courses").hidden = false;
    $("quiz-result").hidden = true;
    session = null;
    refresh();
  };
  socket.on("world", () => setTimeout(refresh, 0));
  socket.on("room", () => setTimeout(refresh, 0));
  socket.on("disconnect", () => {
    session = null;
    pending = null;
    $("quiz-active").hidden = true;
    $("quiz-result").hidden = true;
    $("quiz-courses").hidden = false;
  });
  refresh();
  return { refresh };
}
