export function paintPet(ctx, x, y, type, frame, happy = false) {
  if (!type || type === "none") return;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(2, 2);
  const r = (x, y, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };
  const color =
    type === "cat" ? "#c99c75" : type === "chick" ? "#edd079" : "#83ae8a";
  r(-7, 4, 14, 2, "#31452c44");
  r(-5, -4, 11, 8, color);
  r(-4, -9, 9, 7, color);
  if (type === "cat") {
    r(-5, -12, 3, 5, color);
    r(3, -12, 3, 5, color);
    r(6, -2, 5, 2, color);
    r(9, -5 - frame, 2, 4, color);
  }
  if (type === "chick") {
    r(4, -6, 4, 2, "#d88b51");
    r(-6, -1, 3, 3, "#d7b25c");
  }
  if (type === "dragon") {
    r(-7, -5, 3, 6, "#acc99b");
    r(6, -5, 3, 6, "#acc99b");
    r(-4, -12, 2, 4, "#eed6a0");
    r(3, -12, 2, 4, "#eed6a0");
  }
  r(-2, -7, 1, 2, "#34433e");
  r(3, -7, 1, 2, "#34433e");
  r(-3, 4, 2, 2 - frame, "#72573f");
  r(3, 4, 2, 1 + frame, "#72573f");
  if (happy) {
    r(-2, -20 - frame, 3, 2, "#e98ca8");
    r(2, -20 - frame, 3, 2, "#e98ca8");
    r(-1, -18 - frame, 5, 2, "#e98ca8");
    r(0, -16 - frame, 3, 1, "#e98ca8");
  }
  ctx.restore();
}
export function paintSeason(ctx, s) {
  ctx.save();
  const tint = {
    spring: "#f7c9d21b",
    summer: "#c0e86c12",
    autumn: "#d39a3b35",
    winter: "#e5f3ff60",
  }[s.season];
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, 1000, 680);
  for (let i = 0; i < 32; i++) {
    const x = 30 + ((i * 137) % 930),
      y = 30 + ((i * 83) % 620);
    ctx.fillStyle = {
      spring: "#f4bad1",
      summer: "#f4df82",
      autumn: "#c88148",
      winter: "#edf5ed",
    }[s.season];
    ctx.fillRect(
      x,
      y,
      s.season === "winter" ? 10 : 4,
      s.season === "winter" ? 4 : 3,
    );
  }
  if (s.time !== "day") {
    ctx.fillStyle = s.time === "night" ? "#24365c38" : "#ffc58a24";
    ctx.fillRect(0, 0, 1000, 680);
  }
  if (s.time === "night") {
    for (let i = 0; i < 18; i++) {
      ctx.fillStyle = "#fff0ac";
      ctx.fillRect((i * 71 + 31) % 980, 18 + ((i * 19) % 45), 2, 2);
    }
  }
  ctx.restore();
}
export function paintWeather(ctx, s, time, reduced) {
  if (s.weather === "clear") return;
  ctx.save();
  ctx.fillStyle = s.weather === "rain" ? "#b5d8ed99" : "#fffaf0dd";
  const phase = reduced ? 0 : time / 1000;
  for (let i = 0; i < 65; i++) {
    const x = (i * 173 + phase * (s.weather === "rain" ? 24 : 8)) % 1000,
      y = (i * 97 + phase * (s.weather === "rain" ? 210 : 28)) % 680;
    ctx.fillRect(
      Math.round(x),
      Math.round(y),
      s.weather === "rain" ? 1 : 3,
      s.weather === "rain" ? 10 : 3,
    );
  }
  ctx.restore();
}
