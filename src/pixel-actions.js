// Original pixel drawings; coordinates share the world's pixel grid.
export function paintCarriage(ctx, x, y, step = 0, direction = 1) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(2 * direction, 2);
  const r = (x, y, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };
  r(-18, 4, 57, 3, "#31452c44");
  // Horse and harness to the right of the passenger carriage.
  r(14, -3, 13, 2, "#71553c");
  r(26, -12, 17, 9, "#a77d50");
  r(36, -20, 6, 13, "#a77d50");
  r(40, -20, 7, 6, "#bc9363");
  r(37, -23, 2, 4, "#71553c");
  r(41, -23, 2, 4, "#71553c");
  r(42, -18, 1, 1, "#252f35");
  r(36, -19, 2, 12, "#e5ce96");
  r(28, -4, 3, 8 - step * 2, "#71553c");
  r(39, -4, 3, 6 + step * 2, "#71553c");
  r(24, -12, 2, 9, "#594b39");
  r(27, -11, 15, 2, "#edd7a7");
  // Open carriage: passenger upper body stays visible above the side.
  r(-17, -3, 34, 10, "#634934");
  r(-15, -2, 30, 7, "#b78c52");
  r(-17, -5, 34, 3, "#edd3a0");
  r(-12, 0, 24, 2, "#ccaa72");
  for (const wx of [-11, 11]) {
    r(wx - 4, 3, 8, 8, "#403c36");
    r(wx - 2, 5, 4, 4, "#ccaa72");
    r(wx - (step ? 0 : 2), step ? 5 : 6, step ? 1 : 4, step ? 4 : 1, "#665440");
  }
  ctx.restore();
}
export function paintActionEffect(ctx, x, y, pose, frame, moving, travel) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(2, 2);
  const r = (x, y, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };
  if (pose === "heart") {
    const yy = -46 - frame * 3;
    r(-4, yy, 3, 2, "#e17f99");
    r(1, yy, 3, 2, "#e17f99");
    r(-5, yy + 2, 10, 3, "#e17f99");
    r(-3, yy + 5, 6, 2, "#e17f99");
    r(-1, yy + 7, 2, 2, "#e17f99");
  }
  if (pose === "clap")
    for (const xx of [-16, 15]) r(xx, -14 - frame * 2, 2, 3, "#e6bb61");
  if (pose === "dance") {
    r(17, -24 - frame * 3, 2, 8, "#9378b3");
    r(13, -18 - frame * 3, 4, 3, "#9378b3");
    r(18, -24 - frame * 3, 4, 2, "#9378b3");
  }
  if (moving && travel === "run") {
    r(-12 - frame * 3, 3, 4, 2, "#ccb98b");
    r(-17 + frame * 2, 0, 3, 2, "#e5d3a5");
  }
  ctx.restore();
}
