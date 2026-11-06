export const PETS = {
  none: "なし",
  cat: "ねこ",
  chick: "ひよこ",
  dragon: "小さな竜",
};
export const HATS = {
  default: "もとの帽子",
  none: "帽子なし",
  beret: "ベレー帽",
  crown: "王冠",
  flower: "花かんむり",
};
export const CLOTHES = {
  default: "もとの服",
  coat: "コート",
  stripe: "しましま",
  cape: "マント",
};
export const ACCESSORIES = {
  none: "なし",
  scarf: "マフラー",
  ribbon: "リボン",
};
export const WEATHER = { clear: "晴れ", rain: "雨", snow: "雪" };
export const TIMES = {
  auto: "自動（日本時間）",
  day: "昼",
  sunset: "夕暮れ",
  night: "夜",
};
export const SEASONS = {
  auto: "自動（日本の季節）",
  spring: "春",
  summer: "夏",
  autumn: "秋",
  winter: "冬",
};
export const DEFAULT_LOOK = {
  pet: "none",
  hat: "default",
  clothes: "default",
  accessory: "none",
};
export const DEFAULT_SCENERY = {
  weather: "clear",
  time: "day",
  season: "spring",
};
const member = (obj, key) => typeof key === "string" && Object.hasOwn(obj, key);
export const validLook = (v) =>
  !!v &&
  member(PETS, v.pet) &&
  member(HATS, v.hat) &&
  member(CLOTHES, v.clothes) &&
  member(ACCESSORIES, v.accessory);
export const validScenery = (v) =>
  !!v &&
  member(WEATHER, v.weather) &&
  member(TIMES, v.time) &&
  member(SEASONS, v.season);
export function sceneryAt(input, now = Date.now()) {
  const v = validScenery(input) ? input : DEFAULT_SCENERY;
  const date = new Date(now + 9 * 3600000),
    h = date.getUTCHours(),
    m = date.getUTCMonth();
  return {
    ...v,
    time:
      v.time === "auto"
        ? h >= 7 && h < 17
          ? "day"
          : h >= 17 && h < 19
            ? "sunset"
            : "night"
        : v.time,
    season:
      v.season === "auto"
        ? [
            "winter",
            "winter",
            "spring",
            "spring",
            "spring",
            "summer",
            "summer",
            "summer",
            "autumn",
            "autumn",
            "autumn",
            "winter",
          ][m]
        : v.season,
  };
}
