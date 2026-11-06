import { BADGES, CAMPFIRE, CLASSROOM } from "../shared/learning.js";
import { DEFAULT_LOOK, sceneryAt } from "../shared/play.js";
import { paintPet, paintSeason, paintWeather } from "./pixel-play.js";
import { activeEmote } from "../shared/actions.js";
import { paintCarriage, paintActionEffect } from "./pixel-actions.js";
import { VILLAGES } from "../shared/themes.js";
import { obstacles, zones, RANGE } from "../server/world.js";
import { paintAvatar } from "./pixel-art.js";
// The static scenery is drawn at half resolution, then enlarged without smoothing.
export function createWorldRenderer(canvas) {
  const ctx = canvas.getContext("2d"),
    scene = document.createElement("canvas");
  scene.width = 500;
  scene.height = 340;
  const c = scene.getContext("2d");
  // Render world sign text as browser text, independent of pixel-art resolution.
  const signLayer =
    canvas.id === "world" ? document.createElement("div") : null;
  if (signLayer) {
    signLayer.className = "world-signs";
    signLayer.setAttribute("aria-label", "マップの看板");
    canvas.parentElement.append(signLayer);
  }

  let sceneKey = "",
    lastTime = 0;
  const motion = new Map();
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const r = (x, y, w, h, color) => {
    c.fillStyle = color;
    c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };
  function tree(x, y, size = 1) {
    c.save();
    c.translate(x, y);
    c.scale(size, size);
    r(-3, 9, 6, 12, "#76573e");
    r(-2, 10, 2, 10, "#ad8054");
    r(-12, 4, 24, 8, "#3c6545");
    r(-16, -5, 32, 13, "#426e47");
    r(-12, -13, 24, 15, "#52834f");
    r(-7, -18, 14, 13, "#649756");
    r(-10, -9, 7, 4, "#78a765");
    r(2, -14, 4, 3, "#87af68");
    r(7, 0, 6, 4, "#345e3d");
    c.restore();
  }
  function flowers(x, y) {
    r(x, y, 1, 4, "#54834e");
    r(x - 1, y - 1, 3, 2, "#f4d687");
    r(x, y - 2, 1, 4, "#f4d687");
    r(x, y, 1, 1, "#ac784c");
  }
  function paving(x, y, w, h) {
    r(x, y, w, h, "#b6ae91");
    for (let yy = y; yy < y + h; yy += 10)
      for (let xx = x; xx < x + w; xx += 16) {
        const offset = (Math.floor((yy - y) / 10) % 2) * 8;
        const left = xx + offset;
        if (left >= x + w) continue;
        r(left, yy, Math.min(14, x + w - left), 8, "#cfc7a8");
        r(left + 1, yy + 1, Math.min(12, x + w - left - 1), 1, "#dfd7b8");
      }
  }
  function sign(label, x, y) {
    if (signLayer) {
      const node = document.createElement("span");
      node.className = "world-sign";
      node.textContent = label;
      node.style.left = `${x / 5}%`;
      node.style.top = `${(y + 6) / 3.4}%`;
      signLayer.append(node);
      return;
    }

    c.font = "bold 6px monospace";
    const w = Math.ceil(c.measureText(label).width) + 12;
    r(x - w / 2, y, w, 12, "#564c3c");
    r(x - w / 2 + 1, y + 1, w - 2, 9, "#efe0b7");
    c.fillStyle = "#65513f";
    c.textAlign = "center";
    c.fillText(label, x, y + 8);
    r(x - 1, y + 12, 2, 5, "#866749");
  }
  function table(o) {
    const x = o.x / 2,
      y = o.y / 2,
      w = o.w / 2,
      h = o.h / 2;
    r(x + 2, y + 3, w, h, "#3a503c40");
    r(x, y, w, h, "#68523e");
    r(x + 2, y + 2, w - 4, h - 5, "#ae8451");
    for (let yy = y + 4; yy < y + h - 5; yy += 5)
      r(x + 2, yy, w - 4, 1, "#c6a16b");
    r(x + 3, y + h - 4, 4, 4, "#6c523e");
    r(x + w - 7, y + h - 4, 4, 4, "#6c523e");
    r(x + w / 2 - 5, y + 5, 9, 5, "#f0ddb3");
    r(x + w / 2 - 5, y + 5, 4, 4, "#90a194");
  }
  function patch(o, base, edge) {
    const x = o.x / 2,
      y = o.y / 2,
      w = o.w / 2,
      h = o.h / 2;
    r(x, y, w, h, edge);
    r(x + 2, y + 2, w - 4, h - 4, base);
    return { x, y, w, h };
  }
  function cropBed(o, index) {
    const { x, y, w, h } = patch(o, "#835e40", "#b89c65");
    for (let yy = y + 6; yy < y + h - 3; yy += 10) {
      r(x + 4, yy + 5, w - 8, 1, "#614a35");
      for (let xx = x + 7; xx < x + w - 4; xx += 11) {
        r(xx, yy, 2, 6, "#557a3e");
        r(xx - 2, yy + 1, 6, 2, "#83a64a");
        if (index % 2) {
          r(xx - 1, yy - 2, 4, 4, "#d58148");
          r(xx, yy - 3, 2, 1, "#acd066");
        } else {
          r(xx - 1, yy - 3, 2, 5, "#e3c564");
          r(xx + 2, yy - 4, 1, 6, "#f5db80");
        }
      }
    }
  }
  function windmill(o) {
    const { x, y, w, h } = patch(o, "#aab57a", "#71875c");
    const cx = x + w / 2,
      cy = y + 19;
    r(cx - 3, cy, 6, h - 19, "#6f543c");
    r(cx - 1, cy, 2, h - 21, "#c19c65");
    r(cx - 19, cy - 2, 38, 4, "#695a49");
    r(cx - 2, cy - 17, 4, 34, "#695a49");
    r(cx - 18, cy - 8, 14, 5, "#f1e1b2");
    r(cx + 4, cy + 3, 14, 5, "#f1e1b2");
    r(cx + 3, cy - 17, 5, 13, "#f1e1b2");
    r(cx - 8, cy + 4, 5, 13, "#f1e1b2");
    r(cx - 3, cy - 3, 6, 6, "#b78b4a");
    r(cx - 1, cy - 1, 2, 2, "#f3d48e");
    for (let i = 0; i < 3; i++) {
      r(x + 7 + i * 8, y + h - 10, 6, 7, "#d8ae56");
      r(x + 7 + i * 8, y + h - 7, 6, 1, "#96703f");
    }
  }
  function angel(x, y, scale = 1) {
    c.save();
    c.translate(x, y);
    c.scale(scale, scale);
    for (const direction of [-1, 1]) {
      c.save();
      c.scale(direction, 1);
      r(4, -5, 12, 6, "#c4d6ed");
      r(8, -10, 12, 7, "#e8f1fc");
      r(14, -14, 8, 5, "#fff8e5");
      r(6, 1, 9, 4, "#fff8e5");
      r(10, -5, 9, 3, "#fff8e5");
      c.restore();
    }
    r(-4, -10, 8, 8, "#f0c7a6");
    r(-5, -12, 10, 4, "#e3bb67");
    r(-3, -8, 1, 2, "#5b586d");
    r(2, -8, 1, 2, "#5b586d");
    r(-4, -2, 8, 12, "#f6f0df");
    r(-7, 5, 14, 5, "#f6f0df");
    r(-5, 10, 10, 2, "#d9c080");
    r(-3, -20, 6, 1, "#fff2b0");
    r(-5, -19, 2, 2, "#e4bf6e");
    r(3, -19, 2, 2, "#e4bf6e");
    r(-3, -17, 6, 1, "#e4bf6e");
    c.restore();
  }
  function cloud(x, y, size = 1) {
    c.save();
    c.translate(x, y);
    c.scale(size, size);
    r(-17, 0, 34, 6, "#cfdded");
    r(-23, -6, 46, 8, "#eaf1f8");
    r(-15, -12, 30, 12, "#f5f4ed");
    r(-6, -16, 16, 8, "#f5f4ed");
    c.restore();
  }
  function crystal(x, y, color) {
    r(x - 4, y - 9, 8, 16, color);
    r(x - 2, y - 14, 4, 5, color);
    r(x - 2, y - 10, 2, 12, "#ffffff66");
    r(x - 6, y + 7, 12, 2, "#242436");
  }
  function dragon(o) {
    const { x, y, w, h } = patch(o, "#443044", "#9d5b4f");
    const cx = x + w / 2,
      cy = y + h / 2 + 2;
    c.save();
    c.translate(cx, cy);
    const shade = "#46514c",
      body = "#71906a",
      light = "#9aaa76";
    for (const d of [-1, 1]) {
      c.save();
      c.scale(d, 1);
      r(8, -8, 20, 14, shade);
      r(11, -14, 12, 14, shade);
      r(19, -17, 5, 15, shade);
      r(12, -8, 12, 9, "#b87c62");
      r(15, -11, 3, 10, "#d09b70");
      r(10, 5, 10, 12, shade);
      r(10, 14, 13, 3, "#d0bc8c");
      c.restore();
    }
    r(-13, -3, 26, 20, shade);
    r(-11, -5, 22, 20, body);
    r(-6, 4, 12, 13, "#d1b578");
    r(-11, -16, 22, 17, shade);
    r(-9, -16, 18, 15, body);
    r(-11, -21, 5, 8, "#decc9b");
    r(6, -21, 5, 8, "#decc9b");
    r(-6, -13, 4, 4, "#f6d47d");
    r(3, -13, 4, 4, "#f6d47d");
    r(-4, -13, 1, 3, "#333a38");
    r(3, -13, 1, 3, "#333a38");
    r(-8, -5, 16, 7, light);
    r(-5, -3, 2, 2, "#495848");
    r(3, -3, 2, 2, "#495848");
    r(-5, 2, 10, 1, "#637451");
    c.restore();
  }
  function neon(o, index) {
    const { x, y, w, h } = patch(o, "#253b4b", "#78a0ae");
    if (index === 2) {
      r(x + 8, y + h - 8, w - 16, 5, "#668591");
      r(x + w / 2 - 2, y + 6, 4, h - 13, "#d492bd");
      r(x + w / 2 - 14, y + 13, 28, 4, "#d492bd");
      r(x + w / 2 - 10, y + 9, 20, 12, "#395a73");
      r(x + w / 2 - 7, y + 11, 14, 8, "#9dd0d7");
      r(x + w / 2 - 3, y + 13, 6, 4, "#eaf1c6");
    } else {
      r(x + 5, y + 5, w - 10, h - 10, "#37576b");
      for (let i = 0; i < Math.floor(w / 16); i++) {
        r(x + 7 + i * 15, y + 8, 9, 3, index % 2 ? "#da9fbc" : "#b7dc9f");
        r(x + 7 + i * 15, y + 14, 9, 1, "#78b1b7");
      }
      r(x + 7, y + h - 13, w - 14, 4, "#618a99");
      r(x + 9, y + h - 8, 4, 7, "#253442");
      r(x + w - 13, y + h - 8, 4, 7, "#253442");
    }
  }
  // One continuous landscape: the original tree, perimeter and paths connect
  // four small settlements. Never compose four miniature full maps here.
  function buildCommons(room) {
    r(0, 0, 500, 340, "#91ad72");
    for (let y = 0; y < 340; y += 12)
      for (let x = 0; x < 500; x += 12) {
        const seed = (x * 37 + y * 13) % 23;
        if (seed < 9) {
          r(x + 3, y + 5, 1, 2, "#77985b");
          r(x + 5, y + 4, 1, 3, "#77985b");
        }
        if (seed === 3) flowers(x + 6, y + 8);
      }
    paving(222, 18, 56, 308);
    paving(28, 185, 444, 35);
    paving(43, 277, 414, 23);
    // Local paving marks settlements without cutting the landscape into panels.
    paving(38, 43, 130, 83);
    paving(332, 43, 130, 83);
    r(42, 48, 122, 73, "#819a91");
    for (let x = 45; x < 162; x += 12)
      for (let y = 51; y < 120; y += 12) {
        r(x, y, 10, 1, "#a0b1a2");
        r(x, y, 1, 10, "#a0b1a2");
      }
    r(112, 47, 9, 74, "#526c70");
    for (let y = 50; y < 120; y += 12) r(116, y, 1, 5, "#e4d3a2");
    r(337, 48, 120, 73, "#9ead76");
    for (let x = 340; x < 456; x += 12) {
      r(x, 48, 6, 2, "#d1bb87");
      r(x, 120, 6, 2, "#d1bb87");
    }
    r(38, 214, 130, 70, "#b2ba9d");
    r(41, 217, 124, 64, "#e0ddc6");
    for (let y = 219; y < 280; y += 10) r(43, y, 120, 1, "#eee8d0");
    r(330, 214, 138, 70, "#887c70");
    r(334, 218, 130, 62, "#75656a");
    for (let y = 224; y < 278; y += 10)
      for (let x = 338; x < 461; x += 15) {
        r(x, y, 12, 1, "#948076");
        if ((x + y) % 3 === 0) r(x + 3, y + 3, 2, 2, "#665963");
      }
    // A central common green retains the reference illustration's landmark.
    r(179, 115, 142, 86, "#8c9c6c");
    paving(184, 119, 132, 78);
    const objects = room.objects || [];
    for (const o of objects) {
      const cx = o.x + o.w / 2,
        cy = o.y + o.h / 2;
      if (cx > 410 && cx < 590 && cy > 240 && cy < 390) {
        const p = patch(
          { x: 425, y: 260, w: 150, h: 95 },
          "#8aa172",
          "#73916a",
        );
        tree(p.x + p.w / 2, p.y + p.h * 0.62, 1.55);
      } else if (cx < 500 && cy < 340) {
        neon(o, 0);
      } else if (cx >= 500 && cy < 340) {
        if (o.h >= 80) windmill(o);
        else cropBed(o, Math.round(o.y / 40) % 2);
      } else if (cx < 500) {
        const p = patch(o, "#e8debe", "#b8ad88");
        r(p.x + 3, p.y + 3, p.w - 6, p.h - 6, "#d8d7dc");
        angel(
          p.x + p.w / 2,
          p.y + p.h / 2 + 5,
          Math.min(1.05, p.w / 43, p.h / 32),
        );
      } else if (o.w >= 100 && o.h >= 80) dragon(o);
      else {
        const p = patch(o, "#655761", "#9a8274");
        crystal(p.x + p.w / 2, p.y + p.h / 2 + 4, "#b591b1");
      }
    }
    // Small unmistakable village details, kept outdoors and without doors.
    for (const [x, y] of [
      [49, 48],
      [159, 49],
    ]) {
      r(x, y, 1, 17, "#657978");
      r(x - 2, y - 2, 5, 3, "#bdd6ce");
    }
    r(47, 106, 49, 4, "#546e72");
    r(49, 107, 45, 1, "#b2c8b3");
    for (let x = 343; x < 377; x += 8) {
      r(x, 112, 6, 6, "#b48c53");
      r(x, 113, 6, 1, "#e1c186");
      r(x + 1, 110, 4, 3, "#d6b754");
    }
    cloud(48, 224, 0.35);
    cloud(155, 276, 0.35);
    for (const [x, y] of [
      [48, 267],
      [157, 223],
    ]) {
      r(x, y, 1, 5, "#d3b776");
      r(x - 2, y + 2, 5, 1, "#d3b776");
    }
    for (const x of [338, 458]) {
      r(x, 248, 2, 13, "#5b4e4b");
      r(x - 2, 243, 6, 6, "#b36f4e");
      r(x, 241, 2, 6, "#f0c174");
    }
    for (let x = 12; x < 500; x += 30)
      if (x < 215 || x > 285) {
        tree(x, 14, 0.8);
        tree(x, 322, 0.72);
      }
    for (let y = 60; y < 300; y += 45) {
      tree(10, y, 0.7);
      tree(489, y, 0.7);
    }
    for (const [x, y] of [
      [178, 66],
      [317, 68],
      [164, 252],
      [334, 248],
    ])
      tree(x, y, 0.8);
    for (const [x, y] of [
      [190, 218],
      [307, 218],
      [215, 298],
      [282, 298],
    ]) {
      r(x, y, 2, 13, "#6e6249");
      r(x - 2, y - 5, 6, 7, "#625c48");
      r(x - 1, y - 4, 4, 5, "#eecb76");
      r(x, y - 3, 2, 3, "#fff0b0");
    }
    sign("CITY", 103, 128);
    sign("FARM", 398, 128);
    sign("ANGELS", 104, 286);
    sign("GUARDIAN", 402, 286);
    sign("KOMOREBI", 250, 310);
  }
  function build(room) {
    if (room?.theme === "villages") {
      buildCommons(room);
      return;
    }
    const os = room?.objects || obstacles,
      theme = room?.theme || "farm";
    const city = theme === "city",
      sky = theme === "sky",
      boss = theme === "boss",
      farm = theme === "farm";
    r(
      0,
      0,
      500,
      340,
      city ? "#293d51" : sky ? "#9fbdd7" : boss ? "#362e3f" : "#91ad72",
    );
    if (sky) {
      for (let i = 0; i < 10; i++) cloud((i * 83) % 500, (i * 97) % 340, 1.2);
      r(22, 36, 456, 272, "#d6d8da");
      r(28, 32, 444, 270, "#f3ecd9");
      r(35, 39, 430, 254, "#e9e6dc");
      for (let x = 40; x < 465; x += 22) r(x, 44, 12, 1, "#fffaf0");
    } else if (city) {
      for (let x = 5; x < 495; x += 24) {
        const h = 10 + ((x * 13) % 22);
        r(x, 3, 19, h, "#1d2d42");
        for (let y = 7; y < h; y += 6)
          for (let xx = x + 3; xx < x + 17; xx += 6)
            r(xx, y, 2, 2, (xx + y) % 3 ? "#82b9c8" : "#edc88b");
      }
      r(20, 36, 460, 273, "#485e6a");
      for (let x = 22; x < 480; x += 16)
        for (let y = 40; y < 306; y += 16) {
          r(x, y, 14, 1, "#536e79");
          r(x, y, 1, 14, "#536e79");
        }
    } else if (boss) {
      r(17, 34, 466, 274, "#55474d");
      for (let y = 42; y < 300; y += 16)
        for (let x = 25; x < 475; x += 18) {
          r(x, y, 15, 1, "#67565a");
          if ((x + y) % 5 === 0) r(x + 3, y + 4, 4, 2, "#3e3845");
        }
      for (let y = 30; y < 315; y += 8) {
        r(5 + (y % 3) * 2, y, 9, 7, "#ae554b");
        r(9, y, 3, 5, "#e49c58");
        r(486 - (y % 3) * 2, y, 9, 7, "#ae554b");
        r(488, y, 3, 5, "#e49c58");
      }
    } else {
      for (let y = 0; y < 340; y += 12)
        for (let x = 0; x < 500; x += 12) {
          const seed = (x * 37 + y * 13) % 23;
          if (seed < 9) {
            r(x + 3, y + 5, 1, 2, "#77985b");
            r(x + 5, y + 4, 1, 3, "#77985b");
          }
          if (seed === 3) flowers(x + 6, y + 8);
        }
    }
    if (city) {
      r(220, 34, 60, 275, "#303f4d");
      r(22, 185, 456, 35, "#303f4d");
      for (let y = 44; y < 305; y += 19) r(249, y, 2, 9, "#e5d596");
      for (let x = 30; x < 475; x += 20) r(x, 201, 10, 2, "#e5d596");
      for (let y = 175; y < 231; y += 8) {
        r(222, y, 18, 4, "#e1e3cb");
        r(260, y, 18, 4, "#e1e3cb");
      }
    } else {
      paving(222, 32, 56, 274);
      paving(28, 185, 444, 35);
      paving(43, 277, 414, 23);
      if (boss) {
        r(233, 37, 34, 144, "#8a4b58");
        r(237, 37, 2, 144, "#cba278");
        r(261, 37, 2, 144, "#cba278");
      }
    }
    for (const z of room?.overview ? [] : zones) {
      c.strokeStyle = sky ? "#b3a5ba" : boss ? "#c69684" : "#a9905b";
      c.setLineDash([2, 3]);
      c.strokeRect(z.x / 2, z.y / 2, z.w / 2, z.h / 2);
      c.setLineDash([]);
    }
    for (let i = 0; i < os.length; i++) {
      const o = os[i];
      const landmark = i === 2 && o.w >= 120 && o.h >= 70;
      if (city) neon(o, i);
      else if (farm) {
        if (landmark) windmill(o);
        else cropBed(o, i);
      } else if (sky) {
        const p = patch(o, "#f6ecd5", "#c0af83");
        r(p.x + 4, p.y + 4, p.w - 8, p.h - 8, "#dddce7");
        if (landmark) angel(p.x + p.w / 2, p.y + p.h / 2 + 5, 1.2);
        else {
          angel(p.x + p.w / 2, p.y + p.h / 2 + 7, 0.85);
          r(p.x + 6, p.y + 5, 3, p.h - 10, "#fdf7e6");
          r(p.x + p.w - 9, p.y + 5, 3, p.h - 10, "#fdf7e6");
        }
      } else if (boss) {
        if (landmark) dragon(o);
        else {
          const p = patch(o, "#433949", "#8b6267");
          for (let x = p.x + 15; x < p.x + p.w - 9; x += 22)
            crystal(x, p.y + p.h / 2 + 4, i % 2 ? "#ad809f" : "#9b827d");
        }
      } else if (theme === "lounge" && landmark) {
        const p = patch(
          { x: 425, y: 260, w: 150, h: 95 },
          "#8aa172",
          "#73916a",
        );
        tree(p.x + p.w / 2, p.y + p.h * 0.62, 1.4);
      } else table(o);
    }
    if (city) {
      for (const x of [18, 480])
        for (let y = 63; y < 300; y += 60) {
          r(x, y, 2, 18, "#b1bdba");
          r(x - 3, y - 4, 8, 5, "#83c5cd");
          r(x - 2, y - 3, 6, 3, "#d9f4df");
        }
      for (const x of [170, 312]) {
        r(x, 85, 16, 6, "#334d51");
        r(x + 3, 72, 10, 13, "#6e9e79");
      }
    } else if (sky) {
      for (const [x, y] of [
        [42, 30],
        [453, 30],
        [40, 305],
        [459, 302],
      ])
        cloud(x, y, 1.1);
      for (const [x, y] of [
        [180, 81],
        [320, 82],
        [166, 247],
        [333, 247],
      ]) {
        r(x, y, 1, 7, "#e7cb83");
        r(x - 3, y + 3, 7, 1, "#e7cb83");
      }
    } else if (boss) {
      for (let x = 32; x < 480; x += 42) {
        crystal(x, 26, "#936f88");
        crystal(x, 319, "#9a6d77");
      }
      sign("GUARDIAN", 250, 185);
    } else {
      for (let x = 12; x < 500; x += 30)
        if (x < 215 || x > 285) {
          tree(x, 14, 0.8);
          tree(x, 322, 0.72);
        }
      for (let y = 60; y < 300; y += 45) {
        tree(10, y, 0.7);
        tree(489, y, 0.7);
      }
      for (const [x, y] of [
        [178, 66],
        [317, 68],
        [164, 252],
        [334, 248],
      ])
        tree(x, y, 0.8);
    }
    if (!room?.overview) {
      sign("MEETING", 101, 127);
      sign("QUIET", 407, 288);
    }
    sign(
      city
        ? "NEON CROSSING"
        : farm
          ? "HARVEST MEADOW"
          : sky
            ? "ANGEL GARDEN"
            : boss
              ? "GUARDIAN VALLEY"
              : "KOMOREBI",
      250,
      310,
    );
  }
  return function draw(room, players, self, time) {
    const key = JSON.stringify([room?.theme, room?.objects]);
    if (key !== sceneKey) {
      sceneKey = key;
      signLayer?.replaceChildren();
      build(room);
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(scene, 0, 0, 1000, 680);
    const scenery = sceneryAt(room?.scenery);
    paintSeason(ctx, scenery);
    if (room?.theme === "villages") {
      ctx.save();
      ctx.strokeStyle = "#f5cc7880";
      ctx.setLineDash([5, 8]);
      ctx.beginPath();
      ctx.arc(CAMPFIRE.x, CAMPFIRE.y, CAMPFIRE.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      const x = CAMPFIRE.x,
        y = CAMPFIRE.y,
        frame = reduce.matches ? 0 : Math.floor(time / 550) % 2;
      ctx.fillStyle = "#76513e";
      ctx.fillRect(x - 19, y + 4, 38, 8);
      ctx.fillRect(x - 13, y + 11, 26, 5);
      ctx.fillStyle = "#dc8a4f";
      ctx.fillRect(x - 12, y - 19 - frame * 3, 24, 24 + frame * 3);
      ctx.fillStyle = "#f3be63";
      ctx.fillRect(x - 7, y - 25 + frame * 3, 14, 28 - frame * 3);
      ctx.fillStyle = "#fff0a2";
      ctx.fillRect(x - 3, y - 12, 6, 16);
      ctx.fillStyle = "#6d5740";
      ctx.fillRect(CLASSROOM.x - 21, CLASSROOM.y, 42, 10);
      ctx.fillStyle = "#fff0c6";
      ctx.fillRect(CLASSROOM.x - 18, CLASSROOM.y - 23, 36, 24);
      ctx.fillStyle = "#977956";
      ctx.fillRect(CLASSROOM.x - 1, CLASSROOM.y - 23, 2, 24);
      for (let k = 0; k < 3; k++) {
        ctx.fillRect(CLASSROOM.x - 15, CLASSROOM.y - 18 + k * 6, 10, 2);
        ctx.fillRect(CLASSROOM.x + 5, CLASSROOM.y - 18 + k * 6, 10, 2);
      }
      ctx.restore();
    }
    const dt = Math.min((time - lastTime) / 1000, 0.08);
    lastTime = time;
    const me = players.find((p) => p.id === self);
    if (me && room?.theme !== "villages") {
      ctx.strokeStyle = "#faf0b999";
      ctx.fillStyle = "#fff6c409";
      ctx.setLineDash([5, 7]);
      ctx.beginPath();
      ctx.arc(me.x, me.y, RANGE, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
    }
    const active = new Set(players.map((p) => p.id));
    for (const id of motion.keys()) if (!active.has(id)) motion.delete(id);
    const items = players
      .map((p) => {
        let m = motion.get(p.id);
        if (!m) {
          m = {
            x: p.x,
            y: p.y,
            lastX: p.x,
            lastY: p.y,
            until: 0,
            facing: "front",
          };
          motion.set(p.id, m);
        }
        if (Math.abs(p.x - m.lastX) > 0.1) m.direction = p.x > m.lastX ? 1 : -1;
        if (Math.hypot(p.x - m.lastX, p.y - m.lastY) > 0.1) {
          m.until = time + 120;
          m.facing =
            p.y < m.lastY ? "back" : p.y > m.lastY ? "front" : m.facing;
          m.lastX = p.x;
          m.lastY = p.y;
        }
        const blend = reduce.matches ? 1 : Math.min(1, dt * 18);
        m.x += (p.x - m.x) * blend;
        m.y += (p.y - m.y) * blend;
        return { p, m };
      })
      .sort((a, b) => a.m.y - b.m.y);
    for (const { p, m } of items) {
      if (p.rideWith) continue;
      const walking = !reduce.matches && time < m.until;
      const pose = p.hand ? "hand" : activeEmote(p);
      const frame = reduce.matches ? 0 : Math.floor(time / 220) % 2;
      const dancing = pose === "dance" && !reduce.matches;
      paintAvatar(
        ctx,
        m.x,
        m.y + 10 - (dancing ? frame * 4 : 0),
        p.avatar || 0,
        p.color,
        2,
        walking
          ? Math.floor(time / (p.travel === "run" ? 85 : 140)) % 2
          : dancing
            ? frame
            : 0,
        pose ? "front" : m.facing,
        pose,
        frame,
        p.look || DEFAULT_LOOK,
      );
      if (p.travel === "carriage") {
        const riders = players.filter((q) => q.rideWith === p.id);
        riders.forEach((q, i) =>
          paintAvatar(
            ctx,
            m.x + (i === 0 ? -20 : 20),
            m.y + 8,
            q.avatar,
            q.color,
            1.5,
            0,
            "front",
            q.hand ? "hand" : activeEmote(q),
            frame,
            q.look || DEFAULT_LOOK,
          ),
        );
        paintCarriage(ctx, m.x, m.y + 8, walking ? frame : 0, m.direction || 1);
      }
      const followX = m.x - (m.direction || 1) * 38,
        followY = m.y + 24;
      if (
        m.petX === undefined ||
        Math.hypot(m.petX - followX, m.petY - followY) > 200
      ) {
        m.petX = followX;
        m.petY = followY;
      }
      const follow = reduce.matches ? 1 : Math.min(1, dt * 5);
      m.petX += (followX - m.petX) * follow;
      m.petY += (followY - m.petY) * follow;
      paintPet(
        ctx,
        m.petX,
        m.petY,
        p.look?.pet,
        walking ? frame : 0,
        p.petHappyUntil > Date.now(),
      );
      paintActionEffect(ctx, m.x, m.y, pose, frame, walking, p.travel);
      ctx.font = "11px system-ui";
      const name =
        p.name +
        (p.travel === "carriage"
          ? " · " +
            (1 + players.filter((q) => q.rideWith === p.id).length) +
            "人乗車" +
            players
              .filter((q) => q.rideWith === p.id)
              .map((q) => " / " + q.name)
              .join("")
          : "") +
        (p.id === self ? " · あなた" : "") +
        (p.host ? " ★" : "");
      const w = ctx.measureText(name).width + 14;
      ctx.fillStyle = p.id === self ? "#293947" : "#38483ee8";
      ctx.fillRect(
        Math.round(m.x - w / 2),
        Math.round(m.y - 63),
        Math.round(w),
        20,
      );
      ctx.fillStyle = p.id === self ? "#f1d893" : "#f5eed5";
      ctx.textAlign = "center";
      ctx.fillText(name, m.x, m.y - 49);
      if (p.badge && p.badge !== "none" && BADGES[p.badge]) {
        const label = BADGES[p.badge];
        ctx.font = "bold 12px system-ui";
        const width = ctx.measureText(label).width + 12;
        ctx.fillStyle = "#fff7dd";
        ctx.fillRect(m.x - width / 2, m.y - 86, width, 19);
        ctx.fillStyle = "#35553e";
        ctx.fillText(label, m.x, m.y - 72);
      }
      if (p.hand || p.reaction?.until > Date.now()) {
        ctx.font = "21px system-ui";
        ctx.fillText(p.hand ? "✋" : p.reaction.emoji, m.x + 26, m.y - 24);
      }
      if (p.status === "away") {
        ctx.font = "12px monospace";
        ctx.fillStyle = "#fff2c9";
        ctx.fillText("zZ", m.x + 22, m.y - 25);
      }
    }
    paintWeather(ctx, scenery, time, reduce.matches);
  };
}
