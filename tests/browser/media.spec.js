import { test, expect } from "@playwright/test";
async function join(page, name, url = "/") {
  await page.goto(url);
  await page.getByLabel("あなたの名前").fill(name);
  await page.getByRole("button", { name: "ラウンジに入る" }).click();
  await expect(page.locator("#welcome")).not.toBeVisible();
  await page.locator("#open-call-settings").click();
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
  await page.locator("#open-call-settings").click();
  return page.url();
}
test("real WebRTC audio/video tracks connect and stop when moving out of range", async ({
  browser,
}) => {
  const a = await browser.newContext({ permissions: ["camera", "microphone"] }),
    b = await browser.newContext({ permissions: ["camera", "microphone"] });
  const p = await a.newPage(),
    q = await b.newPage();
  await join(p, "通話A");
  await join(q, "通話B");
  await p.getByRole("button", { name: "マイク OFF", exact: true }).click();
  await p.getByRole("button", { name: "カメラ OFF", exact: true }).click();
  await q.getByRole("button", { name: "通話に参加", exact: true }).click();
  await expect(q.locator(".media-tile[data-peer]")).toHaveAttribute(
    "data-connection",
    "connected",
    { timeout: 15000 },
  );
  await expect
    .poll(() =>
      q
        .locator(".media-tile[data-peer] video")
        .first()
        .evaluate((v) => v.videoWidth),
    )
    .toBeGreaterThan(0);
  await expect
    .poll(() =>
      q
        .locator(".media-tile[data-peer] audio")
        .evaluate((a) => a.srcObject?.getAudioTracks()[0]?.readyState),
    )
    .toBe("live");
  await q.locator("#world").focus();
  await q.keyboard.down("ArrowLeft");
  await q.waitForTimeout(1600);
  await q.keyboard.up("ArrowLeft");
  await expect(q.locator(".media-tile[data-peer]")).toHaveCount(0);
  await p.getByRole("button", { name: "通話から退出" }).click();
  await expect(p.locator("#mic")).toHaveText("マイク OFF");
  await expect(p.locator(".local video").first()).not.toBeVisible();
  await a.close();
  await b.close();
});
test("presenter shares screen and broadcasts beyond proximity", async ({
  browser,
}) => {
  const a = await browser.newContext({ permissions: ["camera", "microphone"] }),
    b = await browser.newContext({ permissions: ["camera", "microphone"] });
  const p = await a.newPage(),
    q = await b.newPage();
  const url = await create(p);
  await join(q, "遠くの生徒", url);
  await q.locator("#world").focus();
  await q.keyboard.down("ArrowLeft");
  await q.waitForTimeout(1600);
  await q.keyboard.up("ArrowLeft");
  await p.getByRole("button", { name: "画面を共有", exact: true }).click();
  await expect(p.locator("#screen")).toHaveText("共有を停止", {
    timeout: 15000,
  });
  await p.getByRole("button", { name: "全体へ配信 OFF", exact: true }).click();
  await q.getByRole("button", { name: "通話に参加", exact: true }).click();
  await expect(q.locator(".media-tile[data-peer]")).toHaveAttribute(
    "data-connection",
    "connected",
    { timeout: 15000 },
  );
  await expect
    .poll(() => q.locator(".shared-screen").evaluate((v) => v.videoWidth))
    .toBeGreaterThan(0);
  await p.getByRole("button", { name: "共有を停止", exact: true }).click();
  await expect(q.locator(".shared-screen")).not.toBeVisible();
  await a.close();
  await b.close();
});
