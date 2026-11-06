export const VILLAGES = [
  { id: "city", x: 0, y: 0, w: 500, h: 340 },
  { id: "farm", x: 500, y: 0, w: 500, h: 340 },
  { id: "sky", x: 0, y: 340, w: 500, h: 340 },
  { id: "boss", x: 500, y: 340, w: 500, h: 340 },
];
export const THEMES = [
  {
    id: "villages",
    name: "4つの村がつながる広場",
    tag: "FOUR VILLAGES",
    description: "中央の木と石畳を囲む、都会・農業・天使・ボスの4つの村。",
    icon: "▦",
  },
  {
    id: "city",
    name: "都会の広場",
    tag: "NEON CROSSING",
    description:
      "ネオン、横断歩道、街のアート。にぎやかな都会の待ち合わせ場所。",
    icon: "◆",
  },
  {
    id: "farm",
    name: "農業の村",
    tag: "HARVEST MEADOW",
    description: "実った畑、風車、収穫かご。のんびり話せる、緑いっぱいの村。",
    icon: "✿",
  },
  {
    id: "sky",
    name: "天使の村",
    tag: "ANGEL GARDEN",
    description: "雲の海、白い翼、金色の光。天使たちが見守る空の広場。",
    icon: "✧",
  },
  {
    id: "boss",
    name: "ボスの村",
    tag: "GUARDIAN VALLEY",
    description: "溶岩、結晶、大きな守り竜。ちょっと勇気がわく冒険者の集会場。",
    icon: "♜",
  },
  {
    id: "lounge",
    name: "こもれび広場",
    tag: "KOMOREBI COMMON",
    description: "大きな木とピクニックテーブルを囲む、いつもの交流広場。",
    icon: "✳",
  },
  {
    id: "garden",
    name: "ガーデン",
    tag: "GARDEN TABLE",
    description: "草花と木陰でくつろぐ、開放的なガーデン。",
    icon: "❀",
  },
  {
    id: "classroom",
    name: "青空教室",
    tag: "OPEN-AIR CLASS",
    description: "机を並べて一緒に学ぶ、屋外の教室。",
    icon: "▤",
  },
];
export const validTheme = (id) => THEMES.some((theme) => theme.id === id);
export const themeFor = (id) =>
  THEMES.find((theme) => theme.id === id) ||
  THEMES.find((theme) => theme.id === "farm");
