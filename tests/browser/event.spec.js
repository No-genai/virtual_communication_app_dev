import { test, expect } from "@playwright/test";
async function join(page, name, url = "/") {
  await page.goto(url);
  await page.getByLabel("あなたの名前").fill(name);
  await page.getByRole("button", { name: "ラウンジに入る" }).click();
  await expect(page.locator("#welcome")).not.toBeVisible();
}
async function create(page) {
  await page.goto("/");
  await page.getByRole("button", { name: "新しいスペースを作る" }).click();
  await page
    .getByLabel("スペース名", { exact: true })
    .first()
    .fill("授業のテスト");
  await page
    .getByLabel("管理パスワード（10文字以上）")
    .fill("test-host-password");
  await page.getByRole("button", { name: "作成する", exact: true }).click();
  await expect(page.locator("#create-dialog")).not.toBeVisible();
  await page.getByLabel("あなたの名前").fill("先生");
  await page.getByRole("button", { name: "ラウンジに入る" }).click();
  await expect(page.locator("#welcome")).not.toBeVisible();
  return page.url();
}
test("teacher creates space, announces, polls, shares board, sees hands and moderates", async ({
  browser,
}) => {
  const a = await browser.newContext(),
    b = await browser.newContext();
  const host = await a.newPage(),
    guest = await b.newPage();
  const errors = [];
  host.on("pageerror", (e) => errors.push(e.message));
  guest.on("pageerror", (e) => errors.push(e.message));
  const url = await create(host);
  await join(guest, "生徒", url);
  await guest.getByRole("button", { name: "✋ 挙手", exact: true }).click();
  await expect(host.locator("#people")).toContainText("✋ 生徒");
  await host.getByRole("button", { name: "挙手を下ろす" }).click();
  await expect(guest.locator("#hand")).toHaveAttribute("aria-pressed", "false");
  await host.getByRole("button", { name: "主催者メニュー" }).click();
  await host
    .getByRole("button", { name: "授業・イベント", exact: true })
    .click();
  await host.getByLabel("全体へのお知らせ").fill("授業を始めます");
  await host.getByRole("button", { name: "お知らせを送る" }).click();
  await expect(guest.locator("#messages")).toContainText("授業を始めます");
  await host
    .getByLabel("投票・理解度チェックの質問")
    .fill("理解できましたか？");
  await host.getByLabel("選択肢（1行に1つ、2〜4個）").fill("はい\nもう一度");
  await host.getByRole("button", { name: "投票を開始" }).click();
  await guest.getByRole("button", { name: "はい — 0票" }).click();
  await expect(host.locator("#poll-total")).toContainText("1人が回答");
  await guest
    .getByRole("button", { name: "掲示板・資料", exact: true })
    .click();
  await guest.getByLabel("お知らせ・メモ").fill("今日の共有メモ");
  await guest.getByRole("button", { name: "掲示板に投稿" }).click();
  await expect(guest.locator("#board-posts")).toContainText("今日の共有メモ");
  await guest.locator("#board-dialog [data-close]").click();
  await host.getByRole("button", { name: "掲示板・資料", exact: true }).click();
  await expect(host.locator("#board-posts")).toContainText("今日の共有メモ");
  await host.locator("#board-dialog [data-close]").click();
  await host
    .getByRole("button", { name: "ホワイトボード", exact: true })
    .click();
  await guest
    .getByRole("button", { name: "ホワイトボード", exact: true })
    .click();
  const before = await guest
    .locator("#whiteboard")
    .evaluate((c) => c.toDataURL());
  const rect = await host.locator("#whiteboard").boundingBox();
  await host.mouse.move(rect.x + 20, rect.y + 20);
  await host.mouse.down();
  await host.mouse.move(rect.x + 120, rect.y + 100, { steps: 5 });
  await host.mouse.up();
  await expect
    .poll(() => guest.locator("#whiteboard").evaluate((c) => c.toDataURL()))
    .not.toBe(before);
  await host.locator("#whiteboard-dialog [data-close]").click();
  await guest.locator("#whiteboard-dialog [data-close]").click();
  host.on("dialog", (d) => d.accept());
  await host.getByRole("button", { name: "退出させる" }).click();
  await expect(guest.locator("#welcome")).toBeVisible();
  await expect(host.locator("#count")).toHaveText("1");
  expect(errors).toEqual([]);
  await host.screenshot({
    path: "test-results/event-space.png",
    fullPage: true,
  });
  await a.close();
  await b.close();
});

test("host edits settings and map, and profile changes appear to another participant", async ({
  browser,
}) => {
  const a = await browser.newContext(),
    b = await browser.newContext();
  const host = await a.newPage(),
    guest = await b.newPage();
  const url = await create(host);
  await join(guest, "受講者", url);
  await guest
    .getByRole("button", { name: "プロフィール", exact: true })
    .click();
  await guest.getByLabel("表示名", { exact: true }).fill("受講者・変更後");
  await guest.getByLabel("ひとこと・所属").fill("初めての参加です");
  await guest
    .locator("#profile-form")
    .getByRole("button", { name: "保存", exact: true })
    .click();
  await expect(host.locator("#people")).toContainText("受講者・変更後");
  await expect(host.locator("#people")).toContainText("初めての参加です");
  await host.getByRole("button", { name: "主催者メニュー" }).click();
  await host.locator("#settings-name").fill("新しい教室");
  await host.getByRole("button", { name: "設定を保存" }).click();
  await expect(guest.locator("#room-name")).toHaveText("新しい教室");
  await host.getByRole("button", { name: "マップ編集", exact: true }).click();
  await host.getByLabel("マップテンプレート").selectOption("classroom");
  const before = await guest.locator("#world").evaluate((c) => c.toDataURL());
  host.once("dialog", (d) => d.accept());
  await host.getByRole("button", { name: "テンプレートを適用" }).click();
  await expect
    .poll(() => guest.locator("#world").evaluate((c) => c.toDataURL()))
    .not.toBe(before);
  await host.locator("#admin-dialog [data-close]").click();
  await guest.getByRole("button", { name: "退出・スペース切替" }).click();
  await guest.getByRole("button", { name: "ラウンジに入る" }).click();
  await expect(guest.locator("#welcome")).not.toBeVisible();
  await expect(guest.locator("#room-name")).toHaveText("新しい教室");
  await a.close();
  await b.close();
});

test("four village themes preview, apply, and synchronize with distinct scenery", async ({
  browser,
}) => {
  const a = await browser.newContext(),
    b = await browser.newContext();
  const p = await a.newPage(),
    q = await b.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  q.on("pageerror", (e) => errors.push(e.message));
  const url = await create(p);
  await join(q, "テーマを見る人", url);
  p.on("dialog", (d) => d.accept());
  const scenes = new Set();
  for (const [theme, label] of [
    ["city", "都会の広場"],
    ["farm", "農業の村"],
    ["sky", "天使の村"],
    ["boss", "ボスの村"],
  ]) {
    await p.getByRole("button", { name: "主催者メニュー" }).click();
    await p.getByRole("button", { name: "マップ編集", exact: true }).click();
    await p.getByLabel("マップテンプレート").selectOption(theme);
    await expect(p.locator("#theme-preview-description")).not.toHaveText("");
    await p.getByRole("button", { name: "テンプレートを適用" }).click();
    await expect(q.locator("#theme-name")).toContainText(label);
    await expect(q.locator("#world")).toHaveAttribute("data-theme", theme);
    await p.locator("#admin-dialog [data-close]").click();
    const image = await q.locator("#world").evaluate((c) => c.toDataURL());
    expect(scenes.has(image)).toBe(false);
    scenes.add(image);
    await q
      .locator(".map-wrap")
      .screenshot({ path: `test-results/theme-${theme}.png` });
  }
  await q.getByRole("button", { name: "退出・スペース切替" }).click();
  await q.getByRole("button", { name: "ラウンジに入る" }).click();
  await expect(q.locator("#theme-name")).toContainText("ボスの村");
  expect(errors).toEqual([]);
  await a.close();
  await b.close();
});
