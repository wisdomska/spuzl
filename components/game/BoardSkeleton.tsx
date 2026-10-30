import { Skeleton } from "@/components/ui/Skeleton";

/** Board slot placeholder in the final layout (no spinner, visible after 300 ms). */
export function BoardSkeleton({ size = 358 }: { size?: number }) {
  return <Skeleton className="rounded-[20px]" style={{ width: `min(${size}px, calc(100vw - 36px))`, aspectRatio: "1" }} />;
}
