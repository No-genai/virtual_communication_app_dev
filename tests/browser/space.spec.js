async function chooseAction(page, id) {
  await page.locator("#open-actions").click();
  await page.locator(`[data-action="${id}"]`).click();
}
import { test, expect } from "@playwright/test";
async function join(page, name) {
  await page.goto("/");
  await page.getByLabel("あなたの名前").fill(name);
  await page.getByRole("button", { name: "ラウンジに入る" }).click();
  await expect(page.locator("#welcome")).not.toBeVisible();
}
test("two browsers join, chat safely, move out of range, reconnect and leave", async ({
  browser,
}) => {
  const a = await browser.newContext(),
    b = await browser.newContext();
  const p = await a.newPage(),
    q = await b.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await join(p, "はる");
  await join(q, "あお");
  await expect(p.locator("#count")).toHaveText("2");
  await p.locator("#message").fill("<img src=x onerror=alert(1)>");
  await p.getByRole("button", { name: "送信", exact: true }).click();
  await expect(q.locator("#messages")).toContainText(
    "<img src=x onerror=alert(1)>",
  );
  await expect(q.locator("#messages img")).toHaveCount(0);
  await q.locator("#world").focus();
  await q.keyboard.down("ArrowDown");
  await q.waitForTimeout(1600);
  await q.keyboard.up("ArrowDown");
  await expect(p.locator("#nearby")).toContainText("まだ誰も");
  await p.locator("#message").fill("遠くには届かない");
  await p.getByRole("button", { name: "送信", exact: true }).click();
  await expect(p.locator("#messages")).toContainText("遠くには届かない");
  await q.waitForTimeout(300);
  await expect(q.locator("#messages")).not.toContainText("遠くには届かない");
  await b.setOffline(true);
  await expect(q.locator("#connection")).toContainText("再接続中");
  await b.setOffline(false);
  await expect(q.locator("#connection")).toHaveText("● オンライン", {
    timeout: 15000,
  });
  await expect(p.locator("#count")).toHaveText("2");
  await q.getByRole("button", { name: "退出・スペース切替" }).click();
  await expect(p.locator("#count")).toHaveText("1");
  expect(errors).toEqual([]);
  await p.screenshot({ path: "test-results/lounge.png", fullPage: true });
  await a.close();
  await b.close();
});
test("mobile layout supports touch entry and movement", async ({ browser }) => {
  const c = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const p = await c.newPage();
  await join(p, "モバイル");
  await p.locator("#world").tap({ position: { x: 180, y: 160 } });
  await expect(p.locator("#count")).toHaveText("1");
  expect(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await c.close();
});

test("random avatar is preselected and manual/profile choices synchronize between browsers", async ({
  browser,
}) => {
  const a = await browser.newContext(),
    b = await browser.newContext();
  const p = await a.newPage(),
    q = await b.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  q.on("pageerror", (e) => errors.push(e.message));
  await p.goto("/");
  await expect(p.locator("#avatars input:checked")).toHaveCount(1);
  const initial = await p.locator("#avatars input:checked").inputValue();
  await p.getByRole("button", { name: "おまかせで選び直す" }).click();
  expect(await p.locator("#avatars input:checked").inputValue()).not.toBe(
    initial,
  );
  await p
    .locator("#avatars")
    .getByRole("radio", { name: "星よみ", exact: true })
    .check();
  await p.screenshot({
    path: "test-results/pixel-avatar-picker.png",
    fullPage: true,
  });
  await p.getByLabel("あなたの名前").fill("ドットの旅人");
  await p.getByRole("button", { name: "ラウンジに入る" }).click();
  await expect(p.locator("#welcome")).not.toBeVisible();
  await join(q, "友だち");
  await expect(q.locator("#people")).toContainText("星よみ");
  await p.getByRole("button", { name: "プロフィール", exact: true }).click();
  await p
    .locator("#profile-avatars")
    .getByRole("radio", { name: "パン職人", exact: true })
    .check();
  await p
    .locator("#profile-form")
    .getByRole("button", { name: "保存", exact: true })
    .click();
  await expect(q.locator("#people")).toContainText("パン職人");
  await p.getByRole("button", { name: "プロフィール", exact: true }).click();
  await expect(
    p
      .locator("#profile-avatars")
      .getByRole("radio", { name: "パン職人", exact: true }),
  ).toBeChecked();
  await p.locator("#profile-dialog [data-close]").click();
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.screenshot({
    path: "test-results/pixel-village.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
  await a.close();
  await b.close();
});

test("one continuous landscape shows four villages, buttons move between them and village chat stays isolated", async ({
  browser,
}) => {
  const a = await browser.newContext(),
    b = await browser.newContext();
  const p = await a.newPage(),
    q = await b.newPage();
  await join(p, "村めぐり");
  await join(q, "同級生");
  await expect(p.locator("#world")).toHaveAttribute("data-theme", "villages");
  await expect(p.locator(".village-map-label")).toHaveCount(4);
  await p.evaluate(() => window.scrollTo(0, 0));
  const bounds = await p.locator(".map-wrap").boundingBox();
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(
    await p.evaluate(() => innerHeight),
  );
  await expect(p.locator("#visit-farm")).toHaveAttribute(
    "aria-current",
    "location",
  );
  await q.getByRole("button", { name: "都会の広場へ移動" }).click();
  await expect(q.locator("#visit-city")).toHaveAttribute(
    "aria-current",
    "location",
  );
  await expect(p.locator("#visit-city")).toContainText("1人");
  await p.locator("#message").fill("農業の部屋だけ");
  await p.getByRole("button", { name: "送信", exact: true }).click();
  await expect(p.locator("#messages")).toContainText("農業の部屋だけ");
  await q.waitForTimeout(250);
  await expect(q.locator("#messages")).not.toContainText("農業の部屋だけ");
  await q.getByRole("button", { name: "農業の村へ移動" }).click();
  await expect(p.locator("#visit-farm")).toContainText("2人");
  await p.waitForTimeout(710);
  await p.locator("#message").fill("同じ部屋へようこそ");
  await p.getByRole("button", { name: "送信", exact: true }).click();
  await expect(q.locator("#messages")).toContainText("同じ部屋へようこそ");
  await q.getByRole("button", { name: "天使の村へ移動" }).click();
  await expect(q.locator("#visit-sky")).toHaveAttribute(
    "aria-current",
    "location",
  );
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.screenshot({
    path: "test-results/four-villages.png",
    fullPage: true,
  });
  await a.close();
  await b.close();
});

test("animated actions, hand raising and carriage controls work across browsers", async ({
  browser,
}) => {
  const a = await browser.newContext(),
    b = await browser.newContext();
  const p = await a.newPage(),
    q = await b.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  q.on("pageerror", (e) => errors.push(e.message));
  await join(p, "旅する人");
  await join(q, "応援する人");
  const canvas = q.locator("#world");
  await chooseAction(p, "heart");
  await expect(p.locator("#action-status")).toContainText("ハートポーズ");
  await p.locator("#hand").click();
  await expect(q.locator("#people")).toContainText("✋ 旅する人");
  await p.locator("#hand").click();
  for (const [id, label] of [
    ["wave", "手振り"],
    ["clap", "拍手"],
    ["dance", "ダンス"],
  ]) {
    await chooseAction(p, id);
    await expect(p.locator("#action-status")).toContainText(label);
  }
  await expect(p.locator("#action-status")).not.toContainText("ダンス", {
    timeout: 6500,
  });
  await chooseAction(p, "run");
  await expect(q.locator("#people")).toContainText("走るモード");
  await p.keyboard.down("ArrowDown");
  await p.waitForTimeout(400);
  await p.keyboard.up("ArrowDown");
  await chooseAction(p, "carriage");
  await expect(q.locator("#people")).toContainText("馬車に乗車中");
  await chooseAction(p, "heart");
  await chooseAction(q, "dance");
  await q.waitForTimeout(250);
  await canvas.screenshot({ path: "test-results/avatar-actions.png" });
  await chooseAction(p, "carriage");
  await expect(q.locator("#people")).not.toContainText("馬車に乗車中");
  await chooseAction(p, "stop");
  await expect(p.locator("#action-status")).toHaveText("歩くモード");
  expect(errors).toEqual([]);
  await a.close();
  await b.close();
});

test("viewport fits and shortcuts respect text entry and dialogs", async ({
  page: p,
}) => {
  await join(p, "キー操作");
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 1366, height: 768 },
    { width: 1024, height: 600 },
    { width: 390, height: 844 },
  ]) {
    await p.setViewportSize(viewport);
    await expect(p.locator("#world")).toBeVisible();
    const boxes = await Promise.all(
      ["#world", "#hand", "#open-actions", "#call"].map((id) =>
        p.locator(id).boundingBox(),
      ),
    );
    if (viewport.width === 1280) {
      expect(boxes[0].width).toBeGreaterThan(800);
      expect(boxes[0].height).toBeGreaterThan(540);
    }
    for (const box of boxes) {
      expect(box.width).toBeGreaterThan(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    }
    expect(
      await p.evaluate(
        () => document.documentElement.scrollHeight <= innerHeight,
      ),
    ).toBe(true);
    expect(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await p.locator("#open-call-settings").click();
  await expect(p.locator("#mic")).toBeVisible();
  await p.locator("#close-call-settings").click();
  await expect(p.locator("#call-settings")).toBeHidden();
  await p.locator("#toggle-chat").click();
  await expect(p.locator("#message")).toBeVisible();
  await p.locator("#close-chat").click();
  await p.setViewportSize({ width: 1280, height: 720 });
  await p.locator("#world").focus();
  await p.keyboard.press("1");
  await expect(p.locator("#action-status")).toContainText("ハートポーズ");
  await p.keyboard.press("6");
  await expect(p.locator("#action-status")).toContainText("走るモード");
  await p.keyboard.press("6");
  await expect(p.locator("#action-status")).toContainText("歩くモード");
  await p.keyboard.press("7");
  await expect(p.locator("#action-status")).toContainText("馬車に乗車中");
  await p.keyboard.press("5");
  await expect(p.locator("#hand")).toHaveAttribute("aria-pressed", "true");
  await p.keyboard.press("5");
  await expect(p.locator("#hand")).toHaveAttribute("aria-pressed", "false");
  await p.keyboard.press("0");
  await expect(p.locator("#action-status")).toHaveText("歩くモード");
  await p.locator("#message").fill("");
  await p.keyboard.type("12345670");
  await expect(p.locator("#message")).toHaveValue("12345670");
  await expect(p.locator("#action-status")).toHaveText("歩くモード");
  await p.locator("#open-actions").click();
  await p.keyboard.press("7");
  await expect(p.locator("#action-status")).toHaveText("歩くモード");
  await p.keyboard.press("Escape");
  await expect(p.locator("#world")).toBeFocused();
  await p.screenshot({
    path: "test-results/compact-shortcuts.png",
    fullPage: true,
  });
});

test("pets, clothes, carriage sharing, local scenery and photo download", async ({
  browser,
}) => {
  const a = await browser.newContext(),
    b = await browser.newContext();
  const p = await a.newPage(),
    q = await b.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  q.on("pageerror", (e) => errors.push(e.message));
  await join(p, "馬車の旅人");
  await join(q, "相乗りの友達");
  const menu = async (page, id) => {
    await page.locator("#open-actions").click();
    await page.locator(id).click();
  };
  await menu(p, "#open-look");
  await p.locator("#look-pet").selectOption("cat");
  await p.locator("#look-hat").selectOption("crown");
  await p.locator("#look-clothes").selectOption("coat");
  await p.locator("#look-accessory").selectOption("scarf");
  await p.locator("#save-look").click();
  await menu(p, "#open-look");
  await expect(p.locator("#look-hat")).toHaveValue("crown");
  await p.locator("#stroke-pet").click();
  await menu(p, "#open-ride");
  await p.locator("#ride-start").click();
  await p.locator("#ride-target").selectOption({ label: "相乗りの友達" });
  await p.locator("#ride-invite").click();
  await expect(q.locator("#ride-dialog")).toBeVisible();
  await q.locator("#ride-accept").click();
  await expect(q.locator("#action-status")).toContainText("相乗り中");
  await p.locator("#ride-dialog [data-close]").click();
  await p.locator("#world").focus();
  await p.keyboard.down("ArrowDown");
  await p.waitForTimeout(450);
  await p.keyboard.up("ArrowDown");
  await menu(p, "#open-scenery");
  await expect(p.locator("#share-scenery")).toBeDisabled();
  await p.locator("#scenery-weather").selectOption("snow");
  await p.locator("#scenery-season").selectOption("winter");
  await p.locator("#scenery-time").selectOption("day");
  await p.locator("#preview-scenery").click();
  await menu(q, "#open-scenery");
  await expect(q.locator("#scenery-weather")).toHaveValue("clear");
  await q.locator("#scenery-dialog [data-close]").click();
  await p.waitForTimeout(100);
  await menu(p, "#take-photo");
  await expect(p.locator("#photo-preview")).toBeVisible();
  const photo = await p.locator("#photo-preview").evaluate((img) => ({
    width: img.naturalWidth,
    height: img.naturalHeight,
    src: img.src,
  }));
  expect(photo.width).toBe(1000);
  expect(photo.height).toBe(736);
  expect(photo.src.startsWith("data:image/png;base64,")).toBe(true);
  const download = p.waitForEvent("download");
  await p.locator("#photo-download").click();
  expect((await download).suggestedFilename()).toMatch(/komorebi-.*\.png/);
  await p.locator("#photo-dialog [data-close]").click();
  await p.screenshot({ path: "test-results/play-options.png", fullPage: true });
  await q.locator("#world").focus();
  await q.keyboard.press("0");
  await expect(q.locator("#action-status")).toHaveText("歩くモード");
  await p.reload();
  await p.getByRole("button", { name: "ラウンジに入る" }).click();
  await expect(p.locator("#welcome")).not.toBeVisible();
  await menu(p, "#open-look");
  await expect(p.locator("#look-pet")).toHaveValue("cat");
  await expect(p.locator("#look-hat")).toHaveValue("crown");
  expect(errors).toEqual([]);
  await a.close();
  await b.close();
});

test("social badges, campfire and foundational quizzes are reachable without crowding the map", async ({
  browser,
}) => {
  const context = await browser.newContext(),
    p = await context.newPage(),
    q = await context.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await join(p, "学ぶ人");
  await join(q, "見る人");
  const menu = async (id) => {
    await p.locator("#open-actions").click();
    await p.locator(id).click();
  };
  await menu("#open-badge");
  await p.locator("#social-badge").selectOption("open");
  await p.locator("#save-badge").click();
  await expect(q.locator("#people")).toContainText("話しかけてOK");
  await p.locator("#fire-hotspot").click();
  await expect(p.locator("#campfire-topic")).not.toBeEmpty();
  await expect(p.locator("#next-topic")).toBeDisabled();
  await p.locator("#campfire-dialog [data-close]").click();
  await p.locator("#visit-city").click();
  await p.locator("#lesson-hotspot").click();
  await expect(p.locator(".material-status")).toContainText(
    "スパルタ塾コース：準備中",
  );
  await p.locator("#quiz-course").selectOption("linux");
  await p.locator("#quiz-start").click();
  for (let i = 0; i < 6; i++) {
    await p.locator("#quiz-choices button").first().click();
    await expect(p.locator("#quiz-feedback")).toContainText("正解：");
    await p.locator("#quiz-next").click();
  }
  await expect(p.locator("#quiz-score")).toContainText("6問中");
  await p.screenshot({ path: "test-results/learning-quiz.png" });
  await p.locator("#quiz-restart").click();
  await p.locator("#quiz-start").click();
  await p.locator("#quiz-cancel").click();
  await expect(p.locator("#quiz-courses")).toBeVisible();
  await p.locator("#learning-dialog [data-close]").click();
  await p.screenshot({ path: "test-results/campfire-village.png" });
  expect(errors).toEqual([]);
  await context.close();
});

test("GitHub guide, chapter quiz and reading progress work", async ({
  page: p,
}) => {
  await join(p, "GitHubを学ぶ人");
  await p.locator("#visit-city").click();
  await p.locator("#lesson-hotspot").click();
  await p.locator("#quiz-course").selectOption("git");
  await p.locator("#github-step").selectOption("clone");
  await expect(p.locator("#github-reading pre")).toContainText("YOUR_ACCOUNT");
  await p.locator("#github-mark-read").click();
  await expect(p.locator("#github-read-progress")).toContainText("1 / 6");
  await p.locator("#github-step").selectOption("pr");
  await expect(p.locator("#github-reading")).toContainText(
    "base repositoryも自分",
  );
  await p.screenshot({ path: "test-results/github-course.png" });
  await p.locator("#quiz-start").click();
  for (let i = 0; i < 2; i++) {
    await expect(p.locator("#quiz-progress")).toContainText("/ 2 問");
    await p.locator("#quiz-choices button").first().click();
    await expect(p.locator("#quiz-feedback")).toContainText("正解：");
    await p.locator("#quiz-next").click();
  }
  await expect(p.locator("#quiz-score")).toContainText("2問中");
  await p.locator("#quiz-restart").click();
  await p.locator("#github-step").selectOption("all");
  await p.locator("#quiz-start").click();
  await expect(p.locator("#quiz-progress")).toContainText("/ 6 問");
  await p.reload();
  await p.getByRole("button", { name: "ラウンジに入る" }).click();
  await p.locator("#lesson-hotspot").click();
  await expect(p.locator("#github-read-progress")).toContainText("1 / 6");
});

test("click movement reaches central paths and detours around the tree", async ({
  page: p,
}) => {
  let position;
  p.on("websocket", (ws) =>
    ws.on("framereceived", ({ payload }) => {
      const text = String(payload);
      if (!text.startsWith("42")) return;
      try {
        const [event, data] = JSON.parse(text.slice(2));
        if (event === "world")
          position = data.find((player) => player.name === "中央へ歩く人");
      } catch {}
    }),
  );
  await join(p, "中央へ歩く人");
  const box = await p.locator("#world").boundingBox();
  async function walk(x, y) {
    await p.mouse.click(
      box.x + (x * box.width) / 1000,
      box.y + (y * box.height) / 680,
    );
    await expect
      .poll(
        () =>
          position ? Math.hypot(position.x - x, position.y - y) : Infinity,
        { timeout: 15000 },
      )
      .toBeLessThan(16);
  }
  await walk(500, 540);
  await walk(500, 240);
  await walk(450, 320);
  await p.screenshot({ path: "test-results/central-path.png" });
});

test("farm windmill passage works with clicks and arrow keys", async ({
  page: p,
}) => {
  let position;
  p.on("websocket", (ws) =>
    ws.on("framereceived", ({ payload }) => {
      const text = String(payload);
      if (!text.startsWith("42")) return;
      try {
        const [event, data] = JSON.parse(text.slice(2));
        if (event === "world")
          position = data.find((v) => v.name === "農村の通路確認");
      } catch {}
    }),
  );
  await join(p, "農村の通路確認");
  const box = await p.locator("#world").boundingBox();
  async function walk(x, y) {
    await p.mouse.click(
      box.x + (x * box.width) / 1000,
      box.y + (y * box.height) / 680,
    );
    await expect
      .poll(
        () =>
          position ? Math.hypot(position.x - x, position.y - y) : Infinity,
        { timeout: 12000 },
      )
      .toBeLessThan(3);
  }
  await walk(784, 270);
  await walk(850, 175);
  await walk(784, 270);
  await p.locator("#world").focus();
  await p.keyboard.down("ArrowUp");
  await expect
    .poll(() => position?.y ?? 999, { timeout: 3000 })
    .toBeLessThan(130);
  await p.keyboard.up("ArrowUp");
  // Walk directly onto the windmill, crops and central tree.
  await walk(730, 160);
  await walk(850, 210);
  await walk(500, 365);
  await p.screenshot({ path: "test-results/farm-passage.png" });
});
