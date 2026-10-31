import { Spuz } from "@/components/brand/Spuz";

/**
 * Full-screen wait state for route transitions (used by the loading.tsx files) and long saves.
 * It fades in after 200 ms, so fast navigations never flash it, then Spuz thinks while a status line
 * says what is happening. CSS-only, so it shows before any JavaScript runs.
 */
export function PageLoader({ message = "Loading", fill = "screen" }: { message?: string; fill?: "screen" | "content" }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`spuz-page-loader bg-bg flex flex-col items-center justify-center gap-3 px-6 text-center ${
        fill === "screen" ? "fixed inset-0 z-[80]" : "min-h-[70dvh] w-full"
      }`}
    >
      <div className="spuz-page-loader-bob">
        <Spuz mood="thinking" size={120} decorative />
      </div>
      <p className="font-display text-[18px] font-extrabold">
        {message}
        <span className="spuz-page-loader-dots" aria-hidden>
          <span>.</span>
          <span>.</span>
          <span>.</span>
        </span>
      </p>
      <div className="bg-surface-raised h-1.5 w-40 overflow-hidden rounded-full" aria-hidden>
        <div className="spuz-page-loader-bar bg-accent h-full w-1/3 rounded-full" />
      </div>
    </div>
  );
}
