import {
  PETS,
  HATS,
  CLOTHES,
  ACCESSORIES,
  WEATHER,
  TIMES,
  SEASONS,
  DEFAULT_LOOK,
  DEFAULT_SCENERY,
  validLook,
  sceneryAt,
} from "../shared/play.js";
import { paintAvatar } from "./pixel-art.js";
import { paintPet } from "./pixel-play.js";
export function readLook() {
  try {
    const v = JSON.parse(localStorage.getItem("komorebi-look"));
    return validLook(v) ? v : { ...DEFAULT_LOOK };
  } catch {
    return { ...DEFAULT_LOOK };
  }
}
export function initPlay({ socket, action, getState, canvas, notify }) {
  const $ = (id) => document.getElementById(id);
  let preview = null,
    previewRoom = null,
    incoming = null;
  const me = () => {
    const s = getState();
    return s.players.find((p) => p.id === s.self);
  };
  function open(id) {
    $("actions-dialog").close();
    $(id).showModal();
  }
  for (const id of [
    "look-dialog",
    "ride-dialog",
    "scenery-dialog",
    "photo-dialog",
  ])
    $(id).addEventListener("close", () => canvas.focus());
  const options = (id, list) => {
    for (const [value, text] of Object.entries(list)) {
      const o = document.createElement("option");
      o.value = value;
      o.textContent = text;
      $(id).append(o);
    }
  };
  for (const [key, list] of Object.entries({
    pet: PETS,
    hat: HATS,
    clothes: CLOTHES,
    accessory: ACCESSORIES,
  }))
    options("look-" + key, list);
  for (const [key, list] of Object.entries({
    weather: WEATHER,
    time: TIMES,
    season: SEASONS,
  }))
    options("scenery-" + key, list);
  const selectedLook = () =>
    Object.fromEntries(
      Object.keys(DEFAULT_LOOK).map((k) => [k, $("look-" + k).value]),
    );
  function drawLook() {
    const p = me();
    if (!p) return;
    const c = $("look-preview").getContext("2d");
    c.fillStyle = "#e9e3c9";
    c.fillRect(0, 0, 240, 140);
    paintAvatar(
      c,
      105,
      115,
      p.avatar,
      p.color,
      4,
      0,
      "front",
      "",
      0,
      selectedLook(),
    );
    paintPet(c, 174, 111, $("look-pet").value, 0);
  }
  $("open-look").onclick = () => {
    const p = me();
    if (!p) return;
    for (const [k, v] of Object.entries(p.look || DEFAULT_LOOK))
      $("look-" + k).value = v;
    $("look-status").textContent = "";
    drawLook();
    open("look-dialog");
  };
  for (const k of Object.keys(DEFAULT_LOOK)) $("look-" + k).onchange = drawLook;
  $("save-look").onclick = async () => {
    const v = selectedLook(),
      r = await action("look", v);
    if (!r.error) {
      try {
        localStorage.setItem("komorebi-look", JSON.stringify(v));
      } catch {}
      $("look-dialog").close();
    }
  };
  $("stroke-pet").onclick = async () => {
    const r = await action("pet-stroke");
    if (!r.error) {
      $("look-dialog").close();
      notify("ペットがうれしそうにしています。");
    }
  };
  function renderRide() {
    const p = me();
    if (!p) return;
    const { players } = getState(),
      selected = $("ride-target").value;
    $("ride-target").replaceChildren();
    for (const q of players.filter(
      (q) =>
        q.id !== p.id &&
        !q.rideWith &&
        q.travel !== "carriage" &&
        Math.hypot(q.x - p.x, q.y - p.y) <= 180,
    )) {
      const o = document.createElement("option");
      o.value = q.id;
      o.textContent = q.name;
      $("ride-target").append(o);
    }
    if ([...$("ride-target").options].some((o) => o.value === selected))
      $("ride-target").value = selected;
    const riders = players.filter((q) => q.rideWith === p.id);
    $("ride-status").textContent = p.rideWith
      ? `${players.find((q) => q.id === p.rideWith)?.name || "友達"}の馬車に相乗り中。0キーでも降りられます。`
      : p.travel === "carriage"
        ? `運転中 · ${riders.length + 1}/3人${riders.length ? " · " + riders.map((q) => q.name).join("、") : ""}`
        : "馬車を出すか、友達からの招待を待ちましょう。";
    $("ride-start").disabled = !!p.rideWith || p.travel === "carriage";
    $("ride-invite").disabled =
      p.travel !== "carriage" ||
      !!p.rideWith ||
      !$("ride-target").value ||
      riders.length >= 2;
    $("ride-incoming").hidden = !incoming || incoming.until < Date.now();
    if (incoming)
      $("ride-invite-text").textContent =
        `${incoming.name}さんから相乗りの招待（30秒以内）`;
  }
  $("open-ride").onclick = () => {
    renderRide();
    open("ride-dialog");
  };
  $("ride-start").onclick = async () => {
    await action("avatar-action", { id: "carriage" });
    renderRide();
  };
  $("ride-invite").onclick = async () => {
    const r = await action("ride-invite", { id: $("ride-target").value });
    if (!r.error) notify("相乗りの招待を送りました。");
  };
  for (const [id, accept] of [
    ["ride-accept", true],
    ["ride-decline", false],
  ])
    $(id).onclick = async () => {
      const r = await action("ride-answer", { accept });
      incoming = null;
      renderRide();
      if (!r.error) $("ride-dialog").close();
    };
  $("ride-leave").onclick = async () => {
    const r = await action("ride-leave");
    if (!r.error) $("ride-dialog").close();
  };
  socket.on("ride-invitation", (v) => {
    incoming = v;
    renderRide();
    notify(
      `${v.name}さんから馬車への招待。「アクション・遊び → 相乗り馬車」で確認できます。`,
    );
    if (!document.querySelector("dialog[open]")) $("ride-dialog").showModal();
  });
  socket.on("world", () => {
    if ($("ride-dialog").open) setTimeout(renderRide, 0);
  });
  socket.on("disconnect", () => {
    incoming = null;
    preview = null;
  });
  setInterval(() => {
    if ($("ride-dialog").open) renderRide();
  }, 1000);
  function effective(room) {
    if (room?.id !== previewRoom) preview = null;
    return preview ? { ...room, scenery: preview } : room;
  }
  $("open-scenery").onclick = () => {
    const s = getState(),
      v = effective(s.room)?.scenery || DEFAULT_SCENERY;
    for (const k of Object.keys(DEFAULT_SCENERY))
      $("scenery-" + k).value = v[k];
    $("share-scenery").disabled = !me()?.host;
    $("scenery-status").textContent = preview
      ? "自分だけの景色を表示中"
      : "共有の景色を表示中";
    open("scenery-dialog");
  };
  const selectedScenery = () =>
    Object.fromEntries(
      Object.keys(DEFAULT_SCENERY).map((k) => [k, $("scenery-" + k).value]),
    );
  $("preview-scenery").onclick = () => {
    preview = selectedScenery();
    previewRoom = getState().room.id;
    $("scenery-dialog").close();
    notify("自分の画面の景色を変更しました。");
  };
  $("share-scenery").onclick = async () => {
    const r = await action("scenery", selectedScenery());
    if (!r.error) {
      preview = null;
      $("scenery-dialog").close();
    }
  };
  $("reset-scenery").onclick = () => {
    preview = null;
    $("scenery-dialog").close();
  };
  $("take-photo").onclick = () => {
    const s = getState();
    if (!me()) return;
    const photo = document.createElement("canvas");
    photo.width = 1000;
    photo.height = 736;
    const c = photo.getContext("2d");
    c.drawImage(canvas, 0, 0);
    // Include readable HTML signs, but never chat or video tiles.
    const bounds = canvas.getBoundingClientRect();
    for (const el of canvas.parentElement.querySelectorAll(
      ".world-sign,.village-map-label",
    )) {
      if (!el.getClientRects().length) continue;
      const b = el.getBoundingClientRect(),
        x = ((b.x - bounds.x) * 1000) / bounds.width,
        y = ((b.y - bounds.y) * 680) / bounds.height;
      c.font = "bold 13px system-ui";
      const w = c.measureText(el.textContent).width + 12;
      c.fillStyle = el.classList.contains("world-sign") ? "#fff0ca" : "#364c40";
      c.fillRect(x, y, w, 22);
      c.fillStyle = el.classList.contains("world-sign") ? "#4d3c29" : "#fff5d7";
      c.fillText(el.textContent, x + 6, y + 16);
    }
    c.fillStyle = "#293d43";
    c.fillRect(0, 680, 1000, 56);
    c.fillStyle = "#fff0c5";
    c.font = "bold 18px system-ui";
    c.fillText(s.room.name, 20, 714, 600);
    const scene = sceneryAt(effective(s.room)?.scenery);
    c.font = "13px system-ui";
    c.textAlign = "right";
    c.fillText(
      `${SEASONS[scene.season]} · ${WEATHER[scene.weather]} · ${new Date().toLocaleString("ja-JP")}`,
      980,
      714,
    );
    const url = photo.toDataURL("image/png");
    $("photo-preview").src = url;
    $("photo-download").href = url;
    $("photo-download").download =
      `komorebi-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
    open("photo-dialog");
  };
  return { effective };
}
