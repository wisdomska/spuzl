import "server-only";
import { ApiError } from "@/lib/api/server";
import { normalizeRoomCode } from "../roomCode";

/** Room code from a URL segment, case-insensitive. */
export function codeParam(raw: string): string {
  const code = normalizeRoomCode(decodeURIComponent(raw));
  if (!code) throw new ApiError(404, "room_not_found");
  return code;
}
