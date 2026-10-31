import type { InboxGame } from "@/components/board/YourMoveInbox";

/** Design B7 sample inbox. */
export const INBOX_SAMPLE: InboxGame[] = [
  {
    id: "1",
    game: "oware",
    opponent: { name: "Kofi", color: "#FF8A3D" },
    detail: "He captured 4. Your move, 22 h left.",
    status: "your-move",
  },
  { id: "2", game: "chess", opponent: { name: "Zainab", color: "#FFD23F" }, detail: "Move 18. She offered a draw.", status: "your-move" },
  {
    id: "3",
    game: "draughts",
    opponent: { name: "Chidi", color: "#4D8BFF" },
    detail: "Forced capture waiting for you.",
    status: "your-move",
  },
  {
    id: "4",
    game: "chess",
    opponent: { name: "Kwame", color: "#FFC93C" },
    detail: "Their move, 9 h since you played",
    status: "their-move",
    canNudge: false,
  },
  { id: "5", game: "oware", opponent: { name: "Efua", color: "#8B7CFF" }, detail: "You won 27 to 21. Rematch?", status: "finished" },
];
