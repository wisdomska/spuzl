import { Skeleton } from "@/components/ui/Skeleton";

/**
 * SPZ-01: shown the instant a game is tapped, before the route's code and data arrive. It has the shell's exact
 * layout (slim top bar, square board, tool row) so the real board replaces it without a jump.
 */
export function ShellSkeleton() {
  return (
    <div className="bg-bg relative mx-auto flex min-h-dvh w-full max-w-[560px] flex-col" aria-busy aria-label="Loading the game">
      <div className="safe-top short:pb-1.5 flex items-center gap-3 px-3 pb-2 lg:pt-6">
        <Skeleton className="size-11 rounded-[14px]" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Skeleton className="h-5 w-28 rounded-[8px]" />
          <Skeleton className="h-3 w-16 rounded-[6px]" />
        </div>
        <Skeleton className="h-11 w-[92px] rounded-[14px] max-[359px]:w-[72px]" />
        <Skeleton className="size-11 rounded-[14px]" />
      </div>
      <div className="short:py-1 flex justify-center px-3 py-2">
        <Skeleton className="aspect-square w-full max-w-[396px] rounded-[20px]" />
      </div>
      <div className="safe-bottom short:pt-1.5 mt-auto grid grid-cols-3 gap-2 px-3 pt-2.5">
        <Skeleton className="short:h-12 h-14 rounded-[16px]" />
        <Skeleton className="short:h-12 h-14 rounded-[16px]" />
        <Skeleton className="short:h-12 h-14 rounded-[16px]" />
      </div>
    </div>
  );
}
