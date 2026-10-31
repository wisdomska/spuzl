import { Icon } from "@/components/ui/Icon";
import { AvatarChip } from "./ui";
import { formatNumber } from "@/lib/format";
import { ordinal, type Zone } from "@/lib/leagues";

export const ZONE_STYLE: Record<Zone, { bg: string; fg: string; icon: string; label: string }> = {
  promote: { bg: "var(--surface)", fg: "var(--accent)", icon: "caret-double-up", label: "promotion zone" },
  stay: { bg: "color-mix(in srgb, var(--surface) 72%, var(--bg))", fg: "var(--text-muted)", icon: "minus", label: "safe" },
  demote: { bg: "var(--danger-tint)", fg: "var(--danger)", icon: "caret-double-down", label: "demotion zone" },
};

/** League / leaderboard player row (Components file, Player row): default, you (pinned), zones with arrow icons. */
export function LeagueRow({
  pos,
  nickname,
  color,
  points,
  zone,
  me,
  tall,
}: {
  pos: number;
  nickname: string;
  color: string;
  points: number;
  zone: Zone;
  me?: boolean;
  tall?: boolean;
}) {
  const z = ZONE_STYLE[zone];
  return (
    <div
      className="flex items-center gap-2.5 rounded-[12px] px-2.5"
      style={{
        height: me || tall ? 50 : 44,
        background: me ? "var(--success-tint)" : z.bg,
        boxShadow: me ? "inset 0 0 0 2px var(--accent)" : undefined,
      }}
      aria-label={`${ordinal(pos)}, ${me ? "you" : nickname}, ${formatNumber(points)} points, ${z.label}`}
    >
      <span className="num w-6 text-[14px] font-semibold" style={{ color: z.fg }} aria-hidden>
        {pos}
      </span>
      <AvatarChip nickname={nickname} color={color} size={28} radius={9} />
      <span className={`min-w-0 flex-1 truncate text-[15px] ${me ? "font-bold" : "font-medium"}`} aria-hidden>
        {me ? "You" : nickname}
      </span>
      <Icon name={z.icon} size={14} style={{ color: z.fg }} />
      <span className="num text-[15px] font-semibold" aria-hidden>
        {formatNumber(points)}
      </span>
    </div>
  );
}
