import { api } from "./api";
import { normalizeRoomCode } from "@/lib/multiplayer/roomCode";
import type { CodeTarget } from "@/lib/multiplayer/types";

/** The page a friend's code opens: the Duel join, the Party room, or the Board Games invite. Null for a bad code. */
export async function codeHref(raw: string): Promise<string | null> {
  const code = normalizeRoomCode(raw);
  if (!code) return null;
  const t = await api<CodeTarget>("/api/v1/codes", { json: { code } });
  return t.kind === "duel" ? `/duel?code=${t.code}` : t.kind === "party" ? `/party/${t.code}` : `/bay/${t.id}?join=${t.code}`;
}
