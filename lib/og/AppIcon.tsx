import { SpuzOG } from "./SpuzOG";

/**
 * App icon (Art Direction 01): Spuz in ink on a lime squircle; the tuft breaks the top edge.
 * Design frame: 148 px squircle, r 38, inset 0 -8px 0 rgba(0,0,0,.18); Spuz idle, 140 px, colour #1B1D2E,
 * at left 4, top -34.
 *
 * - "any": transparent canvas, squircle plus the tuft above it, as designed.
 * - "maskable": full-bleed lime (the OS applies its own mask); Spuz sits inside the 80% safe circle.
 */
const LIME = "#B8F23A";
const SPUZ_INK = "#1B1D2E";

export function AppIcon({ size, purpose }: { size: number; purpose: "any" | "maskable" }) {
  if (purpose === "maskable") {
    const spuz = size * 0.66;
    return (
      <div
        style={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: LIME,
        }}
      >
        <div style={{ display: "flex", marginTop: size * 0.02 }}>
          <SpuzOG mood="idle" size={spuz} color={SPUZ_INK} shadow="rgba(0,0,0,.18)" />
        </div>
      </div>
    );
  }
  // 148 wide, 34 + 148 tall in design units; fit 94% of the canvas height.
  const k = (size * 0.94) / 183;
  const sq = 148 * k;
  const top = (size - 182 * k) / 2 + 34 * k;
  const left = (size - sq) / 2;
  return (
    <div style={{ width: size, height: size, display: "flex", position: "relative" }}>
      <div
        style={{
          position: "absolute",
          left,
          top,
          width: sq,
          height: sq,
          display: "flex",
          borderRadius: 38 * k,
          background: LIME,
          boxShadow: `inset 0 ${-8 * k}px 0 rgba(0,0,0,.18)`,
        }}
      />
      <div style={{ position: "absolute", left: left + 4 * k, top: top - 34 * k, display: "flex" }}>
        <SpuzOG mood="idle" size={140 * k} color={SPUZ_INK} />
      </div>
    </div>
  );
}
