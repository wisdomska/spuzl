import type { CupBoard as CupBoardData } from "@/lib/client/social";
import { formatShort } from "@/lib/format";

export const POD_CHIP = [
  { bg: "var(--pos-1)", fg: "#0E0F1A" },
  { bg: "var(--pos-2)", fg: "#0E0F1A" },
  { bg: "var(--pos-3)", fg: "#0E0F1A" },
];

/** Class board rows (T2). `tv` scales to the 1280 × 720 stage: 80 px rows, text 26 px and up. */
export function CupRows({ rows, games, tv, limit }: { rows: CupBoardData["rows"]; games: number; tv?: boolean; limit?: number }) {
  const list = limit ? rows.slice(0, limit) : rows;
  return (
    <ol className={`flex flex-col ${tv ? "gap-2.5" : "gap-[3px]"}`} aria-label="Class board">
      {list.map((r) => {
        const pod = r.clears > 0 ? POD_CHIP[r.pos - 1] : undefined;
        return (
          <li
            key={r.id}
            className={`flex items-center ${tv ? "h-20 gap-5 rounded-[20px] px-[22px]" : "h-12 gap-2.5 rounded-[12px] px-2.5"}`}
            style={{ background: r.me ? "var(--success-tint)" : pod || !tv ? "var(--surface)" : "transparent" }}
            aria-label={`${r.pos}, ${r.nickname}, ${r.clears} of ${games} cleared, ${formatShort(r.timeMs)}`}
          >
            <span
              aria-hidden
              className={`font-display flex shrink-0 items-center justify-center font-black ${tv ? "size-[52px] rounded-[16px] text-[24px]" : "size-[30px] rounded-[9px] text-[13px]"}`}
              style={{ background: pod?.bg ?? "var(--surface-raised)", color: pod?.fg ?? "var(--text-muted)" }}
            >
              {r.pos}
            </span>
            <span aria-hidden className={`min-w-0 flex-1 truncate font-bold ${tv ? "text-[32px]" : "text-[15px]"}`}>
              {r.nickname}
            </span>
            <span aria-hidden className={`num text-muted font-semibold ${tv ? "text-[26px]" : "text-[13px]"}`}>
              {r.clears} / {games}
            </span>
            <span aria-hidden className={`num text-right font-semibold ${tv ? "w-[150px] text-[34px]" : "w-[56px] text-[15px]"}`}>
              {r.clears ? formatShort(r.timeMs) : ""}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
