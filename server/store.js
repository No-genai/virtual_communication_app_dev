import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { template, upgradeVillageLayout } from "./world.js";
const scrypt = promisify(scryptCallback);
export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scrypt(password, salt, 64)).toString("hex");
  return { salt, hash };
}
export async function checkPassword(password, stored) {
  if (!stored) return true;
  if (typeof password !== "string" || password.length > 128) return false;
  const hash = await scrypt(password, stored.salt, 64);
  return timingSafeEqual(hash, Buffer.from(stored.hash, "hex"));
}
export const initialRoom = () => ({
  id: "lounge",
  name: "みんなのラウンジ",
  description: "ふらっと集まる、小さな広場",
  theme: "villages",
  public: true,
  locked: false,
  capacity: 30,
  owner: null,
  password: null,
  board: [],
  strokes: [],
  objects: template("villages"),
});
export async function openStore() {
  const file = resolve(process.env.DATA_DIR || "data", "rooms.json");
  let rooms;
  try {
    const data = JSON.parse(await readFile(file, "utf8"));
    if (data.version !== 1 || !Array.isArray(data.rooms))
      throw new Error("Unsupported room store");
    rooms = new Map(data.rooms.map((r) => [r.id, upgradeVillageLayout(r)]));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    rooms = new Map([["lounge", initialRoom()]]);
  }
  let queue = Promise.resolve();
  return {
    rooms,
    async save() {
      const content = JSON.stringify({
        version: 1,
        rooms: [...rooms.values()].map((room) => ({ ...room, strokes: [] })),
      });
      const op = queue
        .catch(() => {})
        .then(async () => {
          await mkdir(dirname(file), { recursive: true, mode: 0o700 });
          await writeFile(file + ".tmp", content, { mode: 0o600 });
          await rename(file + ".tmp", file);
        });
      queue = op;
      return op;
    },
  };
}
