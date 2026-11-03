/**
 * Match chat (Duels and Parties): what can be said, shared by client and server. Rooms with a player under 16 get
 * the quick phrases only; 16+ rooms can also type (filtered on the server: abuse, contact details, links).
 */
export const CHAT_MAX = 80;
/** Up to this many messages are kept per player per 30 s. */
export const CHAT_BURST = 6;

export const QUICK_PHRASES = [
  "Good luck!",
  "Have fun!",
  "Nice one!",
  "So close!",
  "Well played",
  "GG",
  "Rematch?",
  "One more!",
  "Brb",
  "Thanks!",
] as const;

export interface ChatMessage {
  id: number;
  from: string;
  nickname: string;
  color: string;
  kind: "text" | "quick";
  body: string;
  at: number;
}
