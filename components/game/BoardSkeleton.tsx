import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Board slot placeholder in the final layout (no spinner, visible after 300 ms). On a wide screen it takes the
 * size a square board gets in the two-column shell (useBoardSize `boardBox`: the column less its gutters, the
 * height under the top bar, at most 80 % of the height and 760 px).
 */
export function BoardSkeleton({ size = 358 }: { size?: number }) {
  return (
    <Skeleton
      className="wide:[--board-skel:min(760px,calc(100vw_-_464px),calc(100dvh_-_108px),80dvh)] rounded-[20px]"
      style={{ width: `var(--board-skel, min(${size}px, calc(100vw - 36px)))`, aspectRatio: "1" }}
    />
  );
}
