import { findPath } from "../shared/navigation.js";
import { initLearning, readBadge } from "./learning-ui.js";
import { BADGES } from "../shared/learning.js";
import { initPlay, readLook } from "./play-ui.js";
import { activeEmote } from "../shared/actions.js";
import { THEMES, themeFor, VILLAGES } from "../shared/themes.js";
import { AVATARS, validAvatar } from "../shared/avatars.js";
import { paintPreview } from "./pixel-art.js";
import { createWorldRenderer } from "./pixel-world.js";
import "./style.css";
import { io } from "socket.io-client";
import {
  template,
  collisionObjects,
  WIDTH,
  HEIGHT,
  RANGE,
  obstacles,
  near,
  zoneAt,
  zones,
} from "../server/world.js";
import { createMedia } from "./media.js";
const $ = (id) => document.getElementById(id),
  palette = ["#739d83", "#d59b70", "#9298bc", "#cb8996", "#d0b45d"];
let players = [],
  self = null,
  profile = null,
  target = null,
  currentRoom = null,
  availableRooms = [],
  host = false,
  editing = null,
  rosterKey = "",
  hand = false;
const keys = new Set(),
  blockedIds = new Set(),
  canvas = $("world"),
  ctx = canvas.getContext("2d"),
  socket = io();
const selectedRoom =
  new URL(location.href).searchParams.get("room") || "lounge";
let roomId = selectedRoom;
const read = (storage, key, fallback = "") => {
  try {
    return storage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
};
const write = (storage, key, value) => {
  try {
    storage.setItem(key, value);
  } catch {}
};
function notify(text) {
  $("notice").textContent = text;
}
const request = (event, data) =>
  new Promise((resolve) =>
    socket
      .timeout(8000)
      .emit(event, data, (error, result) =>
        resolve(
          error
            ? { error: "接続を確認し、もう一度お試しください。" }
            : result || { error: "応答がありません。" },
        ),
      ),
  );
const media = createMedia({
  socket,
  request,
  notify,
  onChange: (state) => {
    for (const [id, key, on, off] of [
      ["mic", "mic", "マイク ON", "マイク OFF"],
      ["camera", "camera", "カメラ ON", "カメラ OFF"],
      ["screen", "screen", "共有を停止", "画面を共有"],
      ["broadcast", "broadcast", "全体へ配信 ON", "全体へ配信 OFF"],
    ]) {
      $(id).textContent = state[key] ? on : off;
      $(id).setAttribute("aria-pressed", String(state[key]));
    }
    $("call").textContent = state.call ? "通話から退出" : "通話に参加";
  },
});
function button(text, action) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = text;
  b.addEventListener("click", action);
  return b;
}
async function action(event, data) {
  const result = await request(event, data);
  if (result.error) notify(result.error);
  return result;
}
function form(id, event, data, success) {
  $(id).addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget,
      submit = form.querySelector("button:not([type=button])"),
      error = form.querySelector(".form-error");
    if (submit) submit.disabled = true;
    try {
      const result = await request(event, data());
      if (error) error.textContent = result.error || "";
      if (!result.error) await success?.(result);
    } finally {
      if (submit) submit.disabled = false;
    }
  });
}
function enable(value) {
  for (const b of document.querySelectorAll("[data-action]"))
    b.disabled = !value;
  for (const id of [
    "message",
    "send",
    "leave",
    "invite",
    "open-profile",
    "open-board",
    "open-whiteboard",
    "open-admin",
    "presence",
    "hand",
    "open-actions",
    "call",
    "mic",
    "camera",
    "screen",
    "devices",
    "export-people",
  ])
    $(id).disabled = !value;
}
function setHost(value) {
  host = value;
  $("broadcast").hidden = !host;
  $("clear-whiteboard").hidden = !host;
  $("admin-login-form").hidden = host;
  $("admin-tools").hidden = !host;
  rosterKey = "";
  renderBoard();
}
function randomAvatar(previous = -1) {
  const choices = AVATARS.map((_, i) => i).filter((i) => i !== previous);
  return choices[
    crypto.getRandomValues(new Uint32Array(1))[0] % choices.length
  ];
}
function selectedAvatar(name = "avatar") {
  return Number(document.querySelector(`[name="${name}"]:checked`)?.value || 0);
}
function paintPicker(id, name, selected) {
  $(id).replaceChildren();
  AVATARS.forEach((avatar, i) => {
    const label = document.createElement("label"),
      radio = document.createElement("input"),
      preview = document.createElement("canvas"),
      caption = document.createElement("span");
    label.className = "avatar-option";
    radio.type = "radio";
    radio.name = name;
    radio.value = i;
    radio.checked = i === selected;
    radio.setAttribute("aria-label", avatar.name);
    preview.width = 84;
    preview.height = 100;
    preview.setAttribute("aria-hidden", "true");
    caption.textContent = avatar.name;
    label.append(radio, preview, caption);
    $(id).append(label);
    radio.addEventListener("change", () => {
      if (name === "avatar")
        $("avatar-caption").textContent = avatar.name + "を選択中";
    });
    paintPreview(
      preview,
      i,
      name === "avatar"
        ? Number(document.querySelector("[name=color]:checked")?.value || 0)
        : Number($("profile-color").value || 0),
    );
  });
  if (name === "avatar")
    $("avatar-caption").textContent = AVATARS[selected].name + "を選択中";
}
function refreshPreviews(id, name, color) {
  $(id)
    .querySelectorAll(".avatar-option canvas")
    .forEach((preview, i) => paintPreview(preview, i, color));
}
$("random-avatar").onclick = () =>
  paintPicker("avatars", "avatar", randomAvatar(selectedAvatar()));
$("random-profile-avatar").onclick = () =>
  paintPicker(
    "profile-avatars",
    "profile-avatar",
    randomAvatar(selectedAvatar("profile-avatar")),
  );
for (let i = 0; i < 5; i++) {
  const label = document.createElement("label"),
    radio = document.createElement("input");
  radio.type = "radio";
  radio.name = "color";
  radio.value = i;
  radio.checked = i === Number(read(localStorage, "komorebi-color", "0"));
  radio.setAttribute("aria-label", ["緑", "オレンジ", "紫", "ピンク", "黄"][i]);
  label.append(
    radio,
    document.createTextNode(["🌿", "🍊", "🪻", "🌸", "🌻"][i]),
  );
  radio.addEventListener("change", () =>
    refreshPreviews("avatars", "avatar", i),
  );
  $("colors").append(label);
}
paintPicker("avatars", "avatar", randomAvatar());
$("profile-color").addEventListener("change", () =>
  refreshPreviews(
    "profile-avatars",
    "profile-avatar",
    Number($("profile-color").value),
  ),
);
const themePreviews = new Map();
function showThemePreview(selectId, canvasId, descriptionId) {
  const theme = themeFor($(selectId).value);
  $(descriptionId).textContent = theme.description;
  if (!themePreviews.has(canvasId))
    themePreviews.set(canvasId, createWorldRenderer($(canvasId)));
  themePreviews.get(canvasId)(
    { theme: theme.id, objects: template(theme.id) },
    [],
    null,
    performance.now(),
  );
}
for (const [selectId, canvasId, descriptionId] of [
  ["create-theme", "create-theme-preview", "create-theme-description"],
  ["map-theme", "theme-preview", "theme-preview-description"],
]) {
  $(selectId).replaceChildren(
    ...THEMES.map((theme) => new Option(theme.name, theme.id)),
  );
  $(selectId).value = "villages";
  $(selectId).addEventListener("change", () =>
    showThemePreview(selectId, canvasId, descriptionId),
  );
  showThemePreview(selectId, canvasId, descriptionId);
}
for (const v of VILLAGES) {
  const theme = themeFor(v.id),
    b = button(theme.name, async () => {
      const result = await action("village-enter", { village: v.id });
      if (!result.error) {
        target = null;
        keys.clear();
        canvas.focus();
      }
    });
  b.id = "visit-" + v.id;
  b.setAttribute("aria-label", theme.name + "へ移動");
  $("village-nav").append(b);
  const label = document.createElement("span");
  label.id = "village-label-" + v.id;
  label.className = "village-map-label";
  label.style.left = `${v.x / 10 + 8}%`;
  label.style.top = `${v.y === 0 ? 7 : 59}%`;
  $("village-labels").append(label);
}
$("name").value = read(localStorage, "komorebi-name");
$("welcome").showModal();
$("welcome").addEventListener("cancel", (e) => e.preventDefault());
for (const close of document.querySelectorAll("[data-close]"))
  close.addEventListener("click", () => close.closest("dialog").close());
$("open-help").onclick = () => $("help-dialog").showModal();
$("open-create").onclick = () => {
  showThemePreview(
    "create-theme",
    "create-theme-preview",
    "create-theme-description",
  );
  $("create-dialog").showModal();
};
function renderRooms() {
  const select = $("room-select"),
    list = [...availableRooms];
  if (!list.some((r) => r.id === roomId))
    list.push({ id: roomId, name: currentRoom?.name || "招待されたスペース" });
  select.replaceChildren();
  for (const r of list) {
    const option = document.createElement("option");
    option.value = r.id;
    option.textContent = `${r.protected ? "🔒 " : ""}${r.name}${r.count !== undefined ? ` (${r.count}/${r.capacity})` : ""}`;
    select.append(option);
  }
  select.value = roomId;
}
socket.on("rooms", (data) => {
  availableRooms = data;
  renderRooms();
});
$("room-select").onchange = () => {
  roomId = $("room-select").value;
  $("join-password").value = "";
};
form(
  "create-form",
  "create-room",
  () => ({
    name: $("create-name").value,
    theme: $("create-theme").value,
    ownerPassword: $("owner-password").value,
    password: $("create-password").value,
    public: $("create-public").checked,
  }),
  (result) => {
    roomId = result.room.id;
    write(sessionStorage, "admin:" + roomId, result.adminToken);
    $("join-password").value = $("create-password").value;
    currentRoom = result.room;
    $("create-form").reset();
    $("create-dialog").close();
    renderRooms();
    notify("スペースを作成しました。名前を入力して入室してください。");
  },
);
async function enter() {
  if (!profile) return;
  const result = await request("join", {
    ...profile,
    look: readLook(),
    badge: readBadge(),
    room: roomId,
    password: $("join-password").value,
    adminToken: read(sessionStorage, "admin:" + roomId),
    participantToken: read(sessionStorage, "participant:" + roomId),
  });
  $("join-button").disabled = false;
  if (result.error) {
    $("join-error").textContent = result.error;
    notify(result.error);
    if (!$("welcome").open) $("welcome").showModal();
    return;
  }
  self = result.id;
  currentRoom = result.room;
  write(sessionStorage, "participant:" + roomId, result.participantToken);
  media.configure(self, result.iceServers);
  setHost(result.host);
  enable(true);
  $("welcome").close();
  $("connection").textContent = "● オンライン";
  $("call-info").textContent = result.relayConfigured
    ? "通話は任意参加。マイク・カメラは自分でONにするまで起動しません。"
    : "通話は任意参加。現在TURN未設定のため、別ネットワーク間では接続できない場合があります。";
  const url = new URL(location.href);
  url.searchParams.set("room", roomId);
  history.replaceState(null, "", url);
  renderRoom();
  refresh();
  canvas.focus();
}
$("join-form").addEventListener("submit", (e) => {
  e.preventDefault();
  if (!socket.connected) {
    $("join-error").textContent = "サーバーへ接続中です。少しお待ちください。";
    return;
  }
  profile = {
    name: $("name").value.trim(),
    avatar: selectedAvatar(),
    color: Number(document.querySelector("[name=color]:checked")?.value || 0),
  };
  if (!profile.name) return;
  write(localStorage, "komorebi-name", profile.name);
  write(localStorage, "komorebi-color", String(profile.color));
  $("join-button").disabled = true;
  $("join-error").textContent = "";
  enter();
});
socket.on("connect", async () => {
  $("connection").textContent = "● 接続済み";
  if (profile) await enter();
  else if (roomId !== "lounge") {
    const result = await request("room-info", { id: roomId });
    if (result.room) {
      currentRoom = result.room;
      renderRooms();
    } else $("join-error").textContent = result.error;
  }
});
socket.on("disconnect", () => {
  blockedIds.clear();
  self = null;
  players = [];
  keys.clear();
  target = null;
  media.disconnect();
  enable(false);
  $("connection").textContent = "再接続中…";
  refresh();
});
socket.on("connect_error", () => {
  $("connection").textContent = "接続できません。再試行中…";
  $("join-button").disabled = false;
});
socket.on("world", (data) => {
  players = data;
  media.members(data);
  const me = players.find((p) => p.id === self);
  if (me) {
    if (host !== me.host) setHost(me.host);
    hand = me.hand;
    $("hand").setAttribute("aria-pressed", String(hand));
    $("hand").textContent = hand ? "✋ 手を下ろす" : "✋ 挙手";
  }
  refresh();
});
socket.on("room", (data) => {
  currentRoom = data;
  renderRoom();
});
function renderRoom() {
  if (!currentRoom) return;
  const theme = themeFor(currentRoom.theme);
  const divided = currentRoom.theme === "villages";
  $("village-nav").hidden = !divided;
  $("village-labels").hidden = !divided;
  $("zone-label").hidden = divided;
  $("chat-scope").querySelector("[value=nearby]").textContent = divided
    ? "今いる村の部屋"
    : "近くの人";
  $("chat-scope").querySelector("[value=room]").textContent = divided
    ? "4つの村全体"
    : "スペース全体";
  $("movement-help").textContent = divided
    ? "村のボタン、または徒歩で移動できます。村名の表示が現在地の目印です。"
    : "点線は会話の範囲。ミーティング内では同じエリア全体に届きます。";
  $("shared-help").textContent = divided
    ? "掲示板・ホワイトボード・投票は全村共通です。"
    : "集中エリアでは通話を受信しません。";
  document.body.dataset.theme = theme.id;
  $("world").dataset.theme = theme.id;
  $("theme-name").textContent = theme.icon + " " + theme.name;
  $("theme-description").textContent = theme.description;
  $("room-name").textContent = currentRoom.name;
  $("space-title").textContent = currentRoom.name;
  $("space-description").textContent = currentRoom.description;
  renderBoard();
  drawWhiteboard();
}
function refresh() {
  const me = players.find((p) => p.id === self);
  $("count").textContent = players.length;
  for (const v of VILLAGES) {
    const theme = themeFor(v.id),
      count = players.filter((p) => p.village === v.id).length,
      active = me?.village === v.id;
    $("visit-" + v.id).textContent =
      theme.icon +
      " " +
      theme.name +
      " · " +
      count +
      "人" +
      (active ? " ／ 現在地" : "");
    $("visit-" + v.id).disabled = !self;
    $("visit-" + v.id).setAttribute(
      "aria-current",
      active ? "location" : "false",
    );
    $("village-label-" + v.id).textContent = theme.name + " · " + count + "人";
    $("village-label-" + v.id).classList.toggle("current", active);
  }
  const nearby = me ? players.filter((p) => p.id !== self && near(p, me)) : [];
  $("nearby").textContent = me
    ? nearby.length
      ? me.village
        ? `${themeFor(me.village).name}：${nearby.length}人と同じ部屋です`
        : `${nearby.length}人が近くにいます`
      : me.village
        ? `${themeFor(me.village).name}にはまだ誰もいません。他の村へ移動してみましょう`
        : "近くにはまだ誰もいません。歩いてみましょう"
    : "入室すると会話に参加できます";
  if (me?.campfire)
    $("nearby").textContent = `焚き火の輪：${nearby.length}人と話せます`;
  if (currentRoom?.theme === "villages")
    $("chat-scope").querySelector("[value=nearby]").textContent = me?.campfire
      ? "焚き火の輪の人"
      : "今いる村の部屋";
  const zone = me && zoneAt(me);
  $("zone-label").textContent =
    zone === "meeting"
      ? "ミーティング：エリア内で会話"
      : zone === "quiet"
        ? "集中エリア：通話を停止"
        : "☀ " + (currentRoom?.name || "ラウンジ");
  const key =
    JSON.stringify(players.map(({ x, y, reaction, ...p }) => p)) +
    self +
    $("people-search").value +
    [...blockedIds].join();
  if (key === rosterKey) return;
  rosterKey = key;
  $("people").replaceChildren();
  const previous = $("dm-to").value;
  $("dm-to").replaceChildren();
  for (const p of [...players].sort(
    (a, b) =>
      (b.hand ? 1 : 0) - (a.hand ? 1 : 0) || (a.handAt || 0) - (b.handAt || 0),
  )) {
    if (p.id !== self) {
      const option = document.createElement("option");
      option.value = p.id;
      option.textContent = p.name;
      $("dm-to").append(option);
    }
    if (!p.name.includes($("people-search").value)) continue;
    const li = document.createElement("li"),
      info = document.createElement("div"),
      dot = document.createElement("span"),
      bio = document.createElement("small"),
      actions = document.createElement("div");
    info.className = "person-info";
    dot.className = "dot";
    dot.style.backgroundColor = palette[p.color];
    info.append(
      dot,
      document.createTextNode(
        (p.hand ? "✋ " : "") +
          p.name +
          (p.id === self ? "（あなた）" : "") +
          (p.host ? " · 主催者" : ""),
      ),
    );
    li.dataset.avatar = String(p.avatar ?? 0);
    bio.textContent = [
      AVATARS[p.avatar]?.name || AVATARS[0].name,
      p.village ? themeFor(p.village).name : "",
      p.status === "away"
        ? "離席中"
        : p.status === "busy"
          ? "取り込み中"
          : "参加中",
      p.rideWith
        ? "相乗り中"
        : p.travel === "carriage"
          ? "馬車に乗車中"
          : p.travel === "run"
            ? "走るモード"
            : "",
      p.badge && p.badge !== "none" ? BADGES[p.badge] : "",
      p.bio,
    ]
      .filter(Boolean)
      .join(" · ");
    actions.className = "person-actions";
    if (p.id !== self) {
      actions.append(
        button("DM", () => {
          $("chat-scope").value = "dm";
          $("dm-to").hidden = false;
          $("dm-to").value = p.id;
          $("message").focus();
        }),
        button(blockedIds.has(p.id) ? "ブロック解除" : "ブロック", async () => {
          const value = !blockedIds.has(p.id);
          const r = await action("block", { id: p.id, blocked: value });
          if (!r.error) {
            if (value) blockedIds.add(p.id);
            else blockedIds.delete(p.id);
            rosterKey = "";
            refresh();
          }
        }),
      );
      if (host && !p.host)
        actions.append(
          button("退出させる", async () => {
            if (confirm(`${p.name}さんを退出させますか？`))
              await action("admin", { action: "kick", id: p.id });
          }),
        );
    }
    if (host && p.hand)
      actions.append(
        button("挙手を下ろす", () =>
          action("admin", { action: "lower-hand", id: p.id }),
        ),
      );
    li.append(info, bio, actions);
    $("people").append(li);
  }
  if ([...$("dm-to").options].some((o) => o.value === previous))
    $("dm-to").value = previous;
}
$("people-search").oninput = () => {
  rosterKey = "";
  refresh();
};
async function leave(kicked = false) {
  profile = null;
  await media.stop();
  if (!kicked) await request("leave", {});
  self = null;
  players = [];
  currentRoom = null;
  host = false;
  hand = false;
  editing = null;
  keys.clear();
  target = null;
  blockedIds.clear();
  setHost(false);
  enable(false);
  refresh();
  $("messages").replaceChildren();
  $("message").value = "";
  $("poll-panel").hidden = true;
  $("join-button").disabled = false;
  for (const d of document.querySelectorAll("dialog[open]")) d.close();
  $("welcome").showModal();
  if (kicked) notify("主催者によって退出しました。");
}
$("leave").onclick = () => leave();
socket.on("kicked", () => leave(true));
$("invite").onclick = async () => {
  const url = new URL(location.href);
  url.searchParams.set("room", roomId);
  try {
    await navigator.clipboard.writeText(url.href);
    notify(
      "招待リンクをコピーしました。localhostのリンクは別のPCでは開けません。共有時は公開HTTPSのURLをご利用ください。",
    );
  } catch {
    notify("招待リンク：" + url.href);
  }
};
socket.on("message", (m) => {
  if ($("messages").querySelector(".empty")) $("messages").replaceChildren();
  const el = document.createElement("article"),
    name = document.createElement("small"),
    body = document.createElement("p");
  el.className = "bubble " + (m.scope || "");
  name.textContent =
    m.name +
    " · " +
    ({
      room: "全体",
      dm: "個別 → " + m.to,
      nearby: m.village ? themeFor(m.village).name : "近く",
      announcement: "お知らせ",
    }[m.scope] || "近く") +
    " · " +
    new Date(m.time).toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
    });
  body.textContent = m.text;
  el.append(name, body);
  $("messages").append(el);
  while ($("messages").children.length > 100) $("messages").firstChild.remove();
  $("messages").scrollTop = $("messages").scrollHeight;
});
$("chat-scope").onchange = () => {
  $("dm-to").hidden = $("chat-scope").value !== "dm";
};
$("chat-form").onsubmit = async (e) => {
  e.preventDefault();
  const r = await request("chat", {
    text: $("message").value,
    scope: $("chat-scope").value,
    to: $("dm-to").value,
  });
  $("chat-status").textContent = r.error || "送信しました";
  if (!r.error) $("message").value = "";
};
$("open-profile").onclick = () => {
  const me = players.find((p) => p.id === self);
  if (!me) return;
  $("profile-name").value = me.name;
  $("profile-bio").value = me.bio;
  $("profile-color").value = me.color;
  paintPicker(
    "profile-avatars",
    "profile-avatar",
    validAvatar(me.avatar) ? me.avatar : 0,
  );
  $("profile-dialog").showModal();
};
form(
  "profile-form",
  "profile",
  () => ({
    name: $("profile-name").value,
    bio: $("profile-bio").value,
    avatar: selectedAvatar("profile-avatar"),
    color: Number($("profile-color").value),
  }),
  () => {
    profile = {
      name: $("profile-name").value,
      avatar: selectedAvatar("profile-avatar"),
      color: Number($("profile-color").value),
    };
    write(localStorage, "komorebi-name", profile.name);
    write(localStorage, "komorebi-color", String(profile.color));
    $("profile-dialog").close();
  },
);
async function presence() {
  if ($("presence").value === "away") await media.stop();
  await action("presence", { status: $("presence").value, hand });
}
$("presence").onchange = presence;
$("hand").onclick = () => {
  hand = !hand;
  presence();
};
function showCallSettings(open) {
  $("call-settings").hidden = !open;
  $("open-call-settings").setAttribute("aria-expanded", String(open));
  if (open) $("close-call-settings").focus();
  else canvas.focus();
}
$("open-call-settings").onclick = () =>
  showCallSettings($("call-settings").hidden);
$("close-call-settings").onclick = () => showCallSettings(false);
$("call-settings").addEventListener("keydown", (e) => {
  if (e.key === "Escape") showCallSettings(false);
});
$("open-actions").onclick = () => $("actions-dialog").showModal();
$("actions-dialog").addEventListener("close", () => canvas.focus());
function showChat(open) {
  document.body.classList.toggle("chat-open", open);
  $("toggle-chat").setAttribute("aria-expanded", String(open));
  if (open) $("message").focus();
  else canvas.focus();
}
$("toggle-chat").onclick = () => showChat(true);
$("close-chat").onclick = () => showChat(false);
for (const b of document.querySelectorAll("[data-action]")) {
  b.onclick = async () => {
    const me = players.find((p) => p.id === self);
    if (!me) return;
    const id = b.dataset.action;
    const result = await action("avatar-action", {
      id: me.travel === id ? "walk" : id,
    });
    if (!result.error) {
      $("actions-dialog").close();
      target = null;
      keys.clear();
      canvas.focus();
    }
  };
}
function refreshActionStatus() {
  const me = players.find((p) => p.id === self);
  const names = {
    heart: "ハートポーズ",
    wave: "手振り",
    clap: "拍手",
    dance: "ダンス",
  };
  for (const id of ["run", "carriage"])
    document
      .querySelector(`[data-action="${id}"]`)
      .setAttribute("aria-pressed", String(me?.travel === id));
  const pose = me && activeEmote(me);
  const label = !me
    ? "入室するとアクションを使えます。"
    : (me.rideWith
        ? "馬車に相乗り中"
        : me.travel === "carriage"
          ? "馬車に乗車中"
          : me.travel === "run"
            ? "走るモード"
            : "歩くモード") +
      (me.hand ? " · 挙手中" : pose ? " · " + names[pose] : "");
  if ($("action-status").textContent !== label)
    $("action-status").textContent = label;
}
setInterval(refreshActionStatus, 250);
for (const b of document.querySelectorAll("[data-emoji]"))
  b.onclick = () => {
    if (self) action("reaction", { emoji: b.dataset.emoji });
  };
for (const [id, slot, select] of [
  ["mic", 0, "audio-device"],
  ["camera", 1, "video-device"],
  ["screen", 2, null],
])
  $(id).onclick = async () => {
    $(id).disabled = true;
    try {
      await media.toggle(slot, select ? $(select).value : null);
    } catch (e) {
      notify(e.message);
    } finally {
      $(id).disabled = !self;
    }
  };
$("call").onclick = async () => {
  try {
    if (media.state().call) await media.stop();
    else await media.join();
  } catch (e) {
    notify(e.message);
  }
};
$("broadcast").onclick = async () => {
  try {
    if (!media.state().call) await media.join();
    await media.setBroadcast(!media.state().broadcast);
  } catch (e) {
    notify(e.message);
  }
};
$("mute-speakers").onclick = () => {
  $("mute-speakers").textContent = media.mute()
    ? "受信音声を再開"
    : "受信音声をミュート";
};
$("resume-audio").onclick = () => media.resume();
$("devices").onclick = async () => {
  const devices = await media.devices();
  for (const [id, kind] of [
    ["audio-device", "audioinput"],
    ["video-device", "videoinput"],
  ]) {
    const selected = $(id).value;
    $(id).replaceChildren(new Option("システム既定", ""));
    for (const d of devices.filter((d) => d.kind === kind))
      $(id).append(
        new Option(d.label || `デバイス ${$(id).options.length}`, d.deviceId),
      );
    $(id).value = selected;
  }
  $("devices-dialog").showModal();
};
$("open-board").onclick = () => {
  renderBoard();
  $("board-dialog").showModal();
};
function renderBoard() {
  if (!currentRoom?.board) return;
  $("board-posts").replaceChildren();
  if (!currentRoom.board.length)
    $("board-posts").textContent = "まだ投稿はありません。";
  for (const post of currentRoom.board) {
    const article = document.createElement("article"),
      name = document.createElement("small"),
      text = document.createElement("p");
    article.className = "board-post";
    name.textContent =
      post.name + " · " + new Date(post.time).toLocaleString("ja-JP");
    text.textContent = post.text;
    article.append(name, text);
    if (post.url) {
      const a = document.createElement("a");
      a.href = post.url;
      a.textContent = post.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      article.append(a);
    }
    if (host)
      article.append(
        button("削除", () => action("board-delete", { id: post.id })),
      );
    $("board-posts").append(article);
  }
}
form(
  "board-form",
  "board-add",
  () => ({ text: $("board-text").value, url: $("board-url").value }),
  () => {
    $("board-form").reset();
  },
);
const wb = $("whiteboard"),
  wc = wb.getContext("2d");
let stroke = null;
function paintStroke(s) {
  wc.strokeStyle = s.color;
  wc.lineWidth = 3;
  wc.lineCap = "round";
  wc.lineJoin = "round";
  wc.beginPath();
  s.points.forEach(([x, y], i) =>
    i ? wc.lineTo(x * 800, y * 450) : wc.moveTo(x * 800, y * 450),
  );
  wc.stroke();
}
function drawWhiteboard() {
  wc.clearRect(0, 0, 800, 450);
  for (const s of currentRoom?.strokes || []) paintStroke(s);
  if (stroke) paintStroke(stroke);
}
$("open-whiteboard").onclick = () => {
  $("whiteboard-dialog").showModal();
  drawWhiteboard();
};
const point = (e) => {
  const r = wb.getBoundingClientRect();
  return [
    Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
    Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
  ];
};
wb.onpointerdown = (e) => {
  stroke = { color: $("pen-color").value, points: [point(e)] };
  wb.setPointerCapture(e.pointerId);
};
wb.onpointermove = (e) => {
  if (stroke && stroke.points.length < 100) {
    stroke.points.push(point(e));
    drawWhiteboard();
  }
};
wb.onpointerup = async (e) => {
  if (!stroke) return;
  stroke.points.push(point(e));
  if (stroke.points.length > 100) stroke.points.length = 100;
  const data = stroke;
  stroke = null;
  await action("stroke", data);
  drawWhiteboard();
};
wb.onpointercancel = () => {
  stroke = null;
  drawWhiteboard();
};
socket.on("stroke", (s) => {
  if (currentRoom) {
    currentRoom.strokes.push(s);
    drawWhiteboard();
  }
});
$("clear-whiteboard").onclick = () => {
  if (confirm("全員の描画を消しますか？"))
    action("admin", { action: "clear-board" });
};
function download(name, blob) {
  const a = document.createElement("a"),
    url = URL.createObjectURL(blob);
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$("download-whiteboard").onclick = () =>
  wb.toBlob((blob) => {
    if (blob) download("komorebi-whiteboard.png", blob);
  });
$("export-people").onclick = () => {
  const cell = (value) =>
    '"' +
    String(value)
      .replace(/^[=+@\-\t\r]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  const rows = [
    ["表示名", "ひとこと", "状態", "挙手", "主催者"],
    ...players.map((p) => [
      p.name,
      p.travel === "carriage"
        ? "馬車に乗車中"
        : p.travel === "run"
          ? "走るモード"
          : "",
      p.badge && p.badge !== "none" ? BADGES[p.badge] : "",
      p.bio,
      p.status,
      p.hand ? "はい" : "",
      p.host ? "はい" : "",
    ]),
  ];
  download(
    "komorebi-participants.csv",
    new Blob(["\ufeff" + rows.map((r) => r.map(cell).join(",")).join("\r\n")], {
      type: "text/csv;charset=utf-8",
    }),
  );
};
$("open-admin").onclick = () => {
  if (!currentRoom?.hasOwner) {
    notify(
      "共用ラウンジには主催者がいません。退出・スペース切替から、新しいスペースを作成してください。",
    );
    return;
  }
  if (currentRoom) {
    $("settings-name").value = currentRoom.name;
    $("settings-description").value = currentRoom.description;
    $("settings-capacity").value = currentRoom.capacity;
    $("settings-locked").checked = currentRoom.locked;
    $("settings-public").checked = currentRoom.public;
    $("map-theme").value = currentRoom.theme;
    showThemePreview("map-theme", "theme-preview", "theme-preview-description");
  }
  $("admin-dialog").showModal();
};
form(
  "admin-login-form",
  "admin-login",
  () => ({ password: $("admin-password").value }),
  (r) => {
    write(sessionStorage, "admin:" + roomId, r.adminToken);
    $("admin-password").value = "";
    setHost(true);
  },
);
form(
  "settings-form",
  "admin",
  () => ({
    action: "settings",
    name: $("settings-name").value,
    description: $("settings-description").value,
    capacity: Number($("settings-capacity").value),
    locked: $("settings-locked").checked,
    public: $("settings-public").checked,
  }),
  () => notify("スペース設定を保存しました。"),
);
form(
  "password-form",
  "admin",
  () => ({ action: "password", password: $("settings-password").value }),
  () => {
    $("settings-password").value = "";
    notify("入室パスワードを更新しました。");
  },
);
form(
  "announce-form",
  "admin",
  () => ({ action: "announce", text: $("announcement").value }),
  () => {
    $("announcement").value = "";
    notify("全体へお知らせを送りました。");
  },
);
form(
  "poll-form",
  "poll-manage",
  () => ({
    question: $("poll-title").value,
    options: $("poll-choices")
      .value.split("\n")
      .map((v) => v.trim())
      .filter(Boolean),
  }),
  () => {
    notify("投票を開始しました。");
    $("admin-dialog").close();
  },
);
$("close-poll").onclick = () => action("poll-manage", { action: "close" });
socket.on("poll", (poll) => {
  $("poll-panel").hidden = !poll;
  if (!poll) return;
  $("poll-question").textContent = poll.question;
  $("poll-total").textContent =
    `${poll.total}人が回答 · ${poll.open ? "受付中（選択し直せます）" : "締切済み"}`;
  $("poll-options").replaceChildren();
  poll.options.forEach((option, i) => {
    const b = button(`${option} — ${poll.counts[i]}票`, () =>
      action("poll-vote", { choice: i }),
    );
    b.disabled = !poll.open;
    $("poll-options").append(b);
  });
});
for (const b of document.querySelectorAll("[data-section]"))
  b.onclick = () => {
    for (const section of ["settings", "event", "layout"])
      $("admin-" + section).hidden = section !== b.dataset.section;
  };
$("apply-theme").onclick = async () => {
  if (confirm("家具配置をテンプレートに置き換えますか？"))
    await action("admin", { action: "template", theme: $("map-theme").value });
};
function edit(mode) {
  editing = mode;
  document.querySelector(".map-wrap").classList.toggle("editing", !!mode);
  $("map-tip").textContent =
    mode === "add"
      ? "装飾を追加する場所をクリック（入口は空けてください）"
      : mode === "remove"
        ? "削除する装飾をクリック"
        : "クリックで移動 ／ ↑ ↓ ← → ・ WASD";
  if (mode) $("admin-dialog").close();
}
$("edit-add").onclick = () => edit("add");
$("edit-remove").onclick = () => edit("remove");
$("edit-stop").onclick = () => edit(null);
canvas.addEventListener("keydown", (e) => {
  if (
    e.isComposing ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey ||
    document.querySelector("dialog[open]")
  )
    return;
  const shortcut = {
    Digit1: "heart",
    Digit2: "wave",
    Digit3: "clap",
    Digit4: "dance",
    Digit6: "run",
    Digit7: "carriage",
    Digit0: "stop",
  }[e.code];
  if (shortcut || e.code === "Digit5") {
    if (e.shiftKey) return;
    e.preventDefault();
    if (e.repeat || !self || editing) return;
    if (e.code === "Digit5") $("hand").click();
    else document.querySelector(`[data-action="${shortcut}"]`).click();
    return;
  }

  if (e.key === "Escape") {
    edit(null);
    return;
  }
  if (
    [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "w",
      "a",
      "s",
      "d",
    ].includes(e.key)
  ) {
    e.preventDefault();
    keys.add(e.key);
    target = null;
  }
});
window.addEventListener("keyup", (e) => keys.delete(e.key));
window.addEventListener("blur", () => {
  keys.clear();
  target = null;
});
canvas.addEventListener("blur", () => keys.clear());
function navigateTo(point) {
  const me = players.find((p) => p.id === self);
  if (!me || me.rideWith) return;
  target = findPath(me, point, collisionObjects(currentRoom));
  keys.clear();
}
canvas.addEventListener("pointerdown", async (e) => {
  if (!self) return;
  const r = canvas.getBoundingClientRect(),
    x = ((e.clientX - r.left) * WIDTH) / r.width,
    y = ((e.clientY - r.top) * HEIGHT) / r.height;
  if (editing && host) {
    let objects = structuredClone(currentRoom.objects);
    if (editing === "add")
      objects.push({
        x: Math.round(x - 50),
        y: Math.round(y - 30),
        w: 100,
        h: 60,
      });
    else
      objects = objects.filter(
        (o) => !(x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h),
      );
    await action("admin", { action: "furniture", objects });
  } else navigateTo({ x, y });
  canvas.focus();
});
setInterval(() => {
  const me = players.find((p) => p.id === self);
  if (!me || editing) return;
  let dx =
      Number(keys.has("ArrowRight") || keys.has("d")) -
      Number(keys.has("ArrowLeft") || keys.has("a")),
    dy =
      Number(keys.has("ArrowDown") || keys.has("s")) -
      Number(keys.has("ArrowUp") || keys.has("w"));
  if (target?.length) {
    dx = target[0].x - me.x;
    dy = target[0].y - me.y;
    if (Math.hypot(dx, dy) < 2) {
      target.shift();
      if (!target.length) target = null;
      dx = dy = 0;
    }
  }
  if (dx || dy)
    socket.emit(
      "move",
      target ? { dx, dy, distance: Math.hypot(dx, dy) } : { dx, dy },
    );
}, 50);
const renderWorld = createWorldRenderer(canvas);
const playUI = initPlay({
  socket,
  action,
  canvas,
  notify,
  getState: () => ({ players, self, room: currentRoom }),
});
initLearning({
  socket,
  action,
  canvas,
  getState: () => ({ players, self, room: currentRoom }),
  moveTo: (point) => {
    navigateTo(point);
    keys.clear();
    canvas.focus();
  },
});
function draw(time) {
  renderWorld(playUI.effective(currentRoom), players, self, time);
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
