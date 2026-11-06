import { DEFAULT_LOOK } from "../shared/play.js";
import { AVATARS, validAvatar } from "../shared/avatars.js";
const cache = new Map();
const outfits = ["#6f9763", "#ca8b55", "#8e7bb8", "#c78191", "#c9ac57"];
function rect(c, x, y, w, h, color) {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}
export function avatarSprite(
  id = 0,
  color = 0,
  step = 0,
  facing = "front",
  pose = "",
  frame = 0,
  look = DEFAULT_LOOK,
) {
  if (!validAvatar(id)) id = 0;
  const key = [
    id,
    color,
    step,
    facing,
    pose,
    frame,
    look.hat,
    look.clothes,
    look.accessory,
  ].join(":");
  if (cache.has(key)) return cache.get(key);
  const a = AVATARS[id],
    image = document.createElement("canvas");
  image.width = 24;
  image.height = 30;
  const c = image.getContext("2d"),
    r = (...v) => rect(c, ...v),
    outline = "#363b3c",
    shirt = outfits[color] || a.accent;
  // Each sprite is painted on an integer pixel grid; no external character assets.
  const lift = step ? 1 : 0;
  r(6, 26, 12, 2, "#31452c44");
  r(8, 24 - lift, 3, 3, outline);
  r(14, 24 + lift, 3, 3, outline);
  r(7, 15, 11, 10, outline);
  r(8, 16, 9, 8, shirt);
  r(8, 16, 2, 8, "#ffffff22");
  r(11, 16, 2, 7, "#ffffff40");
  r(7, 22, 11, 2, "#6b513a");
  r(11, 22, 2, 2, "#edce79");
  r(5, 17 + lift, 3, 6, outline);
  r(6, 18 + lift, 2, 4, shirt);
  r(6, 22 + lift, 2, 2, a.skin);
  r(17, 17 - lift, 3, 6, outline);
  r(17, 18 - lift, 2, 4, shirt);
  r(17, 22 - lift, 2, 2, a.skin);
  r(6, 6, 12, 10, outline);
  r(7, 5, 10, 3, a.hair);
  r(7, 8, 10, 7, a.skin);
  r(7, 7, 3, 3, a.hair);
  r(15, 7, 2, 3, a.hair);
  r(8, 15, 8, 1, "#a77050");
  if (facing === "back") {
    r(7, 8, 10, 7, a.hair);
    r(8, 9, 2, 5, "#ffffff18");
    r(9, 17, 7, 6, "#a67f48");
    r(10, 17, 5, 1, "#deba75");
  } else {
    r(9, 11, 2, 2, outline);
    r(14, 11, 2, 2, outline);
    r(9, 11, 1, 1, "#fff3d5");
    r(14, 11, 1, 1, "#fff3d5");
    r(11, 14, 2, 1, "#b77964");
    r(7, 13, 2, 1, "#dc987f");
    r(16, 13, 1, 1, "#dc987f");
  }
  if (a.role === "traveler") {
    r(5, 6, 14, 3, outline);
    r(7, 3, 10, 4, a.accent);
    r(9, 2, 6, 1, a.accent);
    r(6, 6, 12, 2, "#edcb76");
    r(16, 3, 2, 3, "#f8e5b4");
    r(11, 16, 4, 2, "#b8634c");
  }
  if (a.role === "mage") {
    r(4, 6, 17, 3, outline);
    r(5, 6, 15, 2, a.accent);
    r(8, 3, 10, 3, a.accent);
    r(10, 0, 6, 3, a.accent);
    r(10, 4, 3, 2, "#f2d37c");
    r(20, 12, 1, 14, "#795b43");
    r(19, 10, 3, 3, "#b7daeb");
    r(20, 9, 1, 1, "#faf5d4");
  }
  if (a.role === "ranger") {
    r(7, 3, 9, 4, a.accent);
    r(5, 6, 14, 2, a.accent);
    r(15, 2, 2, 4, "#f2d486");
    r(17, 1, 2, 2, "#f2d486");
    r(8, 16, 3, 5, "#506645");
    r(17, 16, 2, 6, "#506645");
  }
  if (a.role === "knight") {
    r(7, 4, 10, 5, "#859caa");
    r(9, 3, 6, 1, "#b2c2c5");
    r(7, 8, 2, 5, "#859caa");
    r(16, 8, 1, 5, "#859caa");
    r(11, 1, 3, 4, "#be6654");
    r(9, 17, 7, 5, "#9faeb2");
    r(3, 18, 5, 7, "#485c6e");
    r(4, 19, 3, 5, "#89aab6");
    r(5, 20, 1, 3, "#ebd08b");
  }
  if (a.role === "bard") {
    r(7, 4, 11, 4, "#b26d83");
    r(6, 7, 13, 2, "#d496a6");
    r(15, 2, 2, 4, "#f6ddb1");
    r(17, 0, 2, 3, "#f6ddb1");
    r(18, 15, 2, 9, "#775132");
    r(16, 20, 6, 5, "#be8f55");
    r(18, 21, 2, 2, "#5d4435");
  }
  if (a.role === "baker") {
    r(5, 3, 5, 5, "#fff0d2");
    r(9, 1, 6, 6, "#fff6e0");
    r(14, 3, 5, 5, "#fff0d2");
    r(7, 7, 10, 2, "#dbc8aa");
    r(9, 17, 6, 7, "#f2e6c9");
    r(9, 23, 7, 2, "#e0cda5");
    r(18, 18, 4, 5, "#b77b3d");
    r(18, 18, 3, 1, "#e4b66b");
  }
  if (a.role === "scholar") {
    r(6, 5, 12, 3, a.hair);
    r(7, 5, 4, 2, "#6a5d67");
    if (facing !== "back") {
      r(8, 10, 4, 4, "#584641");
      r(13, 10, 4, 4, "#584641");
      r(9, 11, 2, 2, "#bcd3ce");
      r(14, 11, 2, 2, "#bcd3ce");
      r(12, 11, 1, 1, "#584641");
    }
    r(17, 19, 5, 6, "#97614a");
    r(18, 20, 3, 4, "#f1dcb0");
  }
  if (a.role === "gardener") {
    r(5, 6, 15, 3, "#d6b16c");
    r(8, 3, 9, 4, "#dfbf78");
    r(8, 5, 9, 1, "#957349");
    r(16, 4, 3, 3, "#e69a9d");
    r(17, 5, 1, 1, "#f9df8f");
    r(8, 18, 8, 7, "#e4d5ab");
    r(19, 18, 1, 5, "#657d45");
    r(18, 16, 3, 3, "#df9a9c");
  }
  if (look.clothes !== "default") {
    r(8, 16, 9, 9, shirt);
    if (look.clothes === "coat") {
      r(11, 17, 1, 8, outline);
      r(13, 18, 1, 1, "#f5d887");
      r(13, 21, 1, 1, "#f5d887");
    }
    if (look.clothes === "stripe")
      for (const y of [17, 20, 23]) r(8, y, 9, 1, "#f9e9c6");
    if (look.clothes === "cape") {
      r(7, 16, 2, 9, "#713c63");
      r(16, 16, 3, 9, "#713c63");
      r(8, 16, 9, 2, "#a56589");
    }
  }
  if (look.hat !== "default") {
    c.clearRect(0, 0, 24, 10);
    r(6, 6, 12, 4, outline);
    r(7, 5, 10, 4, a.hair);
    r(9, 8, 6, 2, a.skin);
    if (facing === "back") r(7, 8, 10, 2, a.hair);
    if (look.hat === "beret") {
      r(5, 4, 14, 4, "#a45e78");
      r(8, 2, 9, 3, "#c58298");
      r(12, 1, 2, 2, "#63434e");
    }
    if (look.hat === "crown") {
      r(6, 3, 12, 4, "#e0b64f");
      for (const x of [6, 11, 16]) r(x, 0, 2, 4, "#f6d675");
      r(11, 4, 2, 2, "#c36b72");
    }
    if (look.hat === "flower") {
      r(5, 6, 14, 2, "#72945b");
      for (const x of [6, 11, 16]) {
        r(x, 4, 3, 3, "#eaa0af");
        r(x + 1, 5, 1, 1, "#f9e4a5");
      }
    }
  }
  if (look.accessory === "scarf") {
    r(7, 15, 11, 2, "#cf6556");
    r(14, 17, 3, 6, "#cf6556");
    r(14, 21, 3, 1, "#f2cd91");
  }
  if (look.accessory === "ribbon") {
    r(8, 16, 3, 3, "#e49ab6");
    r(13, 16, 3, 3, "#e49ab6");
    r(11, 17, 2, 1, "#9f5378");
  }
  if (pose) {
    // Replace the arms (and held tools) with an original two-frame pose.
    c.clearRect(3, 16, 5, 11);
    c.clearRect(17, 16, 6, 11);
    if (pose === "heart") {
      r(4, 16, 4, 5, outline);
      r(17, 16, 4, 5, outline);
      r(5, 17, 3, 3, shirt);
      r(17, 17, 3, 3, shirt);
      r(7, 18, 3, 2, a.skin);
      r(15, 18, 3, 2, a.skin);
      r(9, 17, 3, 2, a.skin);
      r(13, 17, 3, 2, a.skin);
      r(11, 19, 3, 2, a.skin);
      r(11, 17, 3, 2, "#dc718b");
    } else if (pose === "wave" || pose === "hand") {
      r(5, 17, 3, 6, shirt);
      r(5, 22, 3, 2, a.skin);
      r(17, 15, 3, 4, shirt);
      r(19, 11, 3, 6, shirt);
      r(19 + (pose === "wave" ? frame : 0), 7, 3, 5, a.skin);
    } else if (pose === "clap") {
      r(5, 17, 4, 5, shirt);
      r(17, 17, 4, 5, shirt);
      r(8 + frame * 2, 18, 3, 4, a.skin);
      r(14 - frame * 2, 18, 3, 4, a.skin);
    } else if (pose === "dance") {
      r(3, 14 + frame * 3, 5, 3, shirt);
      r(1, 12 + frame * 3, 3, 3, a.skin);
      r(17, 17 - frame * 3, 5, 3, shirt);
      r(21, 15 - frame * 3, 3, 3, a.skin);
    }
  }
  if (cache.size >= 512) cache.delete(cache.keys().next().value);
  cache.set(key, image);
  return image;
}
export function paintAvatar(
  c,
  x,
  y,
  id,
  color,
  scale = 2,
  step = 0,
  facing = "front",
  pose = "",
  frame = 0,
  look = DEFAULT_LOOK,
) {
  c.imageSmoothingEnabled = false;
  c.drawImage(
    avatarSprite(id, color, step, facing, pose, frame, look),
    Math.round(x - 12 * scale),
    Math.round(y - 26 * scale),
    24 * scale,
    30 * scale,
  );
}
export function paintPreview(canvas, id, color) {
  const c = canvas.getContext("2d");
  c.clearRect(0, 0, canvas.width, canvas.height);
  paintAvatar(c, canvas.width / 2, canvas.height - 13, id, color, 3);
}
