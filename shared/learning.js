export const BADGES = {
  none: "目印なし",
  open: "💬 話しかけてOK",
  question: "❓ 質問したい",
  watch: "👀 見学中",
  focus: "📖 集中中",
};
export const validBadge = (v) =>
  typeof v === "string" && Object.hasOwn(BADGES, v);
export const CAMPFIRE = { x: 500, y: 440, radius: 90 };
export const CLASSROOM = { x: 350, y: 280 };
export const atCampfire = (p, theme) =>
  theme === "villages" &&
  Math.hypot(p.x - CAMPFIRE.x, p.y - CAMPFIRE.y) <= CAMPFIRE.radius;
export const NOTION_MATERIAL =
  "https://app.notion.com/p/38f3bf9cc77a80dda7f9c556aaea883d?source=copy_link";
