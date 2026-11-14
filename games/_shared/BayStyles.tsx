/**
 * Board Bay keyframes (Board Games design file). Transform and opacity only; the global
 * [data-motion="reduce"] rule collapses every animation to 1 ms, and the reduce variants below
 * swap movement for a fade where the design asks for one. React 19 hoists and dedupes this tag.
 */
const CSS = `
@keyframes bay-dot { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.25); } }
@keyframes bay-seed-hop { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
@keyframes bay-pop { 50% { transform: scale(1.08); } }
@keyframes bay-shake { 16%, 50%, 83% { transform: translateX(-6px); } 33%, 66% { transform: translateX(6px); } }
@keyframes bay-flash { 0%, 50%, 100% { opacity: 0; } 25%, 75% { opacity: 1; } }
@keyframes bay-fade-out { to { opacity: 0; transform: scale(.8); } }
@keyframes bay-drop { 0% { transform: translateY(var(--drop-from)); } 70% { transform: translateY(0); } 85% { transform: translateY(-8%); } 100% { transform: translateY(0); } }
@keyframes bay-flip { 0% { transform: rotateY(0); } 50% { transform: rotateY(90deg); } 100% { transform: rotateY(0); } }
@keyframes bay-roll { 0% { transform: rotate(0) scale(1); } 40% { transform: rotate(200deg) scale(.86); } 100% { transform: rotate(360deg) scale(1); } }
@keyframes bay-punch { 0% { transform: scale(1.6); opacity: 0; } 50% { transform: scale(.94); opacity: 1; } 100% { transform: scale(1); } }
@keyframes bay-rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.bay-dot { animation: bay-dot 1.6s ease-in-out infinite; }
.bay-pop { animation: bay-pop 180ms var(--ease-out); }
@keyframes bay-your-turn { 0% { transform: scale(.6); opacity: 0; } 55% { transform: scale(1.12); opacity: 1; } 75% { transform: scale(.96); } 100% { transform: scale(1); } }
.bay-your-turn { animation: bay-your-turn 520ms var(--ease-out); }
.bay-shake { animation: bay-shake var(--dur-shake) var(--ease-in-out); }
.bay-flash { animation: bay-flash 1s linear 1; }
@keyframes chess-slide { from { transform: translate(var(--slide-x), var(--slide-y)); } }
.chess-slide { animation: chess-slide 190ms var(--ease-out); }
[data-motion="reduce"] .chess-slide { animation: none; }
[data-motion="reduce"] .bay-dot, [data-low-data="true"] .bay-dot { animation: none; }
[data-motion="reduce"] .bay-pop, [data-motion="reduce"] .bay-your-turn { animation: fade-in 80ms linear; }
`;

export function BayStyles() {
  return (
    <style href="spuzl-board-bay" precedence="default">
      {CSS}
    </style>
  );
}

/** Design square colours shared by chess and draughts (board materials, same in both themes). */
/** Maple and walnut, to suit the boxwood and ebony pieces. `sel` is the picked-up piece's square, gold so it reads on wood. */
export const SQUARE = {
  light: "#F3E6CF",
  dark: "#9C6B45",
  lastLight: "#F1DC8E",
  lastDark: "#C9A65A",
  draughtsDark: "#7E5233",
  sel: "#F2C14E",
} as const;

/**
 * Draughts men in boxwood (light) and ebony (dark), matching the chess set: an inlaid ring near the edge, a turned
 * rim and a drop shadow. Kings add a gold ring around the disc (and a crown, drawn by the board), so a king reads at
 * a glance. Same in both themes, like the squares.
 */
export function draughtsDisc(light: boolean, king: boolean): { background: string; boxShadow: string; color: string } {
  const gold = king ? "0 0 0 3px #F2C14E, " : "";
  return light
    ? {
        background:
          "radial-gradient(circle at 50% 50%,transparent 0 56%,rgba(110,64,20,.35) 57% 60%,transparent 61%),radial-gradient(circle at 38% 32%,#F4D9A6,#E2B577 55%,#B9864A)",
        boxShadow: `inset 0 -4px 0 #9C6B35, inset 0 3px 0 #F8E4BC, ${gold}0 4px 0 #7A4F24, 0 7px 6px rgba(0,0,0,.45)`,
        color: "#4A2C10",
      }
    : {
        background:
          "radial-gradient(circle at 50% 50%,transparent 0 56%,rgba(226,181,119,.35) 57% 60%,transparent 61%),radial-gradient(circle at 38% 32%,#5A4436,#2A1A12 60%,#140C08)",
        boxShadow: `inset 0 -4px 0 #0A0604, inset 0 3px 0 #6A5446, ${gold}0 4px 0 #050302, 0 7px 6px rgba(0,0,0,.5)`,
        color: "#F2C14E",
      };
}

/** Square bevel from the design boards. */
export const BEVEL = "inset 0 2px 0 rgba(255,255,255,.22), inset 0 -2px 0 rgba(0,0,0,.14)";
