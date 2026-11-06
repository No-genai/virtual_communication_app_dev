export const EMOTES = ["heart", "wave", "clap", "dance"];
export const TRAVEL_MODES = ["walk", "run", "carriage"];
export const TRAVEL_SPEED = { walk: 190, run: 280, carriage: 240 };
export function activeEmote(player, now = Date.now()) {
  return player.emote?.until > now && EMOTES.includes(player.emote.id)
    ? player.emote.id
    : null;
}
