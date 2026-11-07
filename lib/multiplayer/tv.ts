/**
 * Big-screen Party spectator view (R2-P5, admin setting "features.partyTv"): /party/<code>/tv, read only, for a
 * classroom projector or a TV. Pure, so the server route, the screens and unit tests share the rules.
 */
import type { MatchView } from "./types";
import { canPlayLive } from "./liveGate";

/** How often the TV page asks for the room (ms). */
export const TV_POLL_MS = 2000;

/** The path of a room's TV view. */
export const tvPath = (code: string) => `/party/${code.toUpperCase()}/tv`;

/**
 * Who may open their room to spectators: hosts 16 and over (the same line as Quick Match). An under-16 host's
 * room is friends only (R2-13), so it is never shown to anyone holding the code.
 */
export function canHostTv(host: { age_band?: string | null; birth_year?: number | null; birth_month?: number | null } | null): boolean {
  return !!host && canPlayLive(host);
}

/** A new room's default: on for classroom rooms, off otherwise. */
export const tvDefault = (classroom: boolean) => classroom;

/**
 * What a spectator may see of a room: nicknames, avatar colours, progress, places and points. Everything else a
 * player's view carries is dropped: city and country, level and rating, the puzzle and saved board, rewards,
 * head-to-head, the 18+ round, and who "me" is. Chat never travels with a view, and the TV page has none.
 */
export function spectatorView(v: MatchView): MatchView {
  return {
    ...v,
    me: "",
    players: v.players
      .filter((p) => !p.spectator || p.host)
      .map((p) => ({
        ...p,
        level: 0,
        country: null,
        city: null,
        rating: 0,
        ratingBefore: null,
        ratingAfter: null,
      })),
    puzzle: null,
    myState: null,
    reward: null,
    h2h: null,
    rulesFor: null,
    party: null,
    bot: null,
  };
}
