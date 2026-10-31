import type { CSSProperties } from "react";

/**
 * Poster frame for Rage Ridge boards: the night scene background and its 20 px dot grid, painted with CSS
 * tokens so the board slot is never black while the board chunk or Phaser is still loading. It matches the
 * first frame the painters draw (SCENE.bg fill, 1.5 px SCENE.dot dots every 20 px starting at x 0, y 10).
 */
export const posterStyle: CSSProperties = {
  backgroundColor: "var(--rage-scene)",
  backgroundImage: "radial-gradient(circle, var(--rage-scene-dot) 1.5px, transparent 1.5px)",
  backgroundSize: "20px 20px",
  backgroundPosition: "-10px 0",
};

/** Board-registry loading fallback: same width and height rules as the RageBoard canvas (phaser/layout.ts). */
export function RagePoster({ tall = false }: { tall?: boolean }) {
  return (
    <div aria-hidden className="flex w-full flex-col gap-3.5">
      <div
        className={`rounded-[20px] ${
          tall ? "h-[clamp(300px,calc((min(100vw,560px)-36px)*0.9),400px)]" : "h-[clamp(230px,calc((min(100vw,560px)-36px)*0.7),320px)]"
        } max-sm:portrait:h-[max(60dvh,320px)]`}
        style={posterStyle}
      />
      {/* room for the controls row (jump button height) so nothing shifts when the board arrives */}
      <div className="h-24" />
    </div>
  );
}
