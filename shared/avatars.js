// Original character presets. IDs are part of the client/server protocol.
export const AVATARS = [
  {
    name: "旅びと",
    hair: "#71492f",
    skin: "#f0c59a",
    accent: "#d4a448",
    role: "traveler",
  },
  {
    name: "星よみ",
    hair: "#d8c6a8",
    skin: "#ecc29f",
    accent: "#8775bb",
    role: "mage",
  },
  {
    name: "森の番人",
    hair: "#9c553d",
    skin: "#eac39b",
    accent: "#658f56",
    role: "ranger",
  },
  {
    name: "小さな騎士",
    hair: "#4e3e39",
    skin: "#c18b69",
    accent: "#719aa8",
    role: "knight",
  },
  {
    name: "吟遊詩人",
    hair: "#d6a14d",
    skin: "#f1c9a3",
    accent: "#c77b83",
    role: "bard",
  },
  {
    name: "パン職人",
    hair: "#6e4735",
    skin: "#b77e5b",
    accent: "#d4a257",
    role: "baker",
  },
  {
    name: "見習い学者",
    hair: "#473e48",
    skin: "#edbb92",
    accent: "#638aaf",
    role: "scholar",
  },
  {
    name: "花の世話人",
    hair: "#b76646",
    skin: "#e2b391",
    accent: "#7d9b5c",
    role: "gardener",
  },
];
export const validAvatar = (id) =>
  Number.isInteger(id) && id >= 0 && id < AVATARS.length;
