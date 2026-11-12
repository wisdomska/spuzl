/** Daily Five progress ring: 0 to 5 games played, the count in the middle. Decorative (callers give the words). */
export function FiveRing({ done, total, size = 48 }: { done: number; total: number; size?: number }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, done / Math.max(1, total));
  return (
    <span className="relative flex shrink-0 items-center justify-center" style={{ width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 48 48" className="absolute inset-0 -rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" stroke="var(--line)" strokeWidth="5" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-[400ms] motion-safe:ease-[cubic-bezier(.23,1,.32,1)]"
        />
      </svg>
      <span className="num text-[13px] leading-none font-black">
        {done}/{total}
      </span>
    </span>
  );
}
