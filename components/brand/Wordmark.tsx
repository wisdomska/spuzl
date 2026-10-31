/** SPUZL wordmark: Unbounded 900, lime skewed Z with its notch dot (Art Direction 01). */
export function Wordmark({ size = 72, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      className={`font-display relative inline-flex items-end font-black ${className}`}
      style={{ fontSize: size, lineHeight: 0.9, letterSpacing: "-0.05em" }}
      aria-label="SPUZL"
      role="img"
    >
      <span aria-hidden>SPU</span>
      <span aria-hidden className="text-accent relative inline-block" style={{ transform: "skewX(-10deg)" }}>
        Z<span className="bg-accent absolute rounded-full" style={{ right: "-0.13em", top: "0.31em", width: "0.2em", height: "0.2em" }} />
      </span>
      <span aria-hidden>L</span>
    </span>
  );
}
