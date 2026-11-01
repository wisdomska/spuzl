import { Skeleton } from "@/components/ui/Skeleton";

/**
 * SPZ-01: shown the instant a game is tapped, before the route's code and data arrive. It has the shell's exact
 * layout (header, title, square board, tool bar) so the real board replaces it without a jump.
 */
export function ShellSkeleton() {
  return (
    <div className="bg-bg relative mx-auto flex min-h-dvh w-full max-w-[560px] flex-col" aria-busy aria-label="Loading the game">
      <div className="safe-top flex items-center gap-3 px-3 pb-2 lg:pt-6">
        <Skeleton className="size-11 rounded-[14px]" />
        <div className="flex min-w-0 flex-1 justify-center">
          <Skeleton className="h-11 w-[116px] rounded-[14px]" />
        </div>
        <Skeleton className="size-11 rounded-[14px]" />
        <Skeleton className="size-11 rounded-[14px]" />
      </div>
      <div className="flex flex-col gap-2 px-5 pt-1.5 pb-3.5">
        <Skeleton className="h-7 w-36 rounded-[10px]" />
        <Skeleton className="h-4 w-60 rounded-[8px]" />
      </div>
      <div className="flex justify-center p-[18px]">
        <Skeleton className="aspect-square w-full max-w-[384px] rounded-[20px]" />
      </div>
      <div className="safe-bottom mt-auto grid grid-cols-3 gap-2.5 px-4 pt-3.5 pb-7">
        <Skeleton className="h-[60px] rounded-[18px]" />
        <Skeleton className="h-[60px] rounded-[18px]" />
        <Skeleton className="h-[60px] rounded-[18px]" />
      </div>
    </div>
  );
}
