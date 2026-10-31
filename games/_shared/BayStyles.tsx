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
.bay-shake { animation: bay-shake var(--dur-shake) var(--ease-in-out); }
.bay-flash { animation: bay-flash 1s linear 1; }
[data-motion="reduce"] .bay-dot, [data-low-data="true"] .bay-dot { animation: none; }
[data-motion="reduce"] .bay-pop { animation: fade-in 80ms linear; }
`;

export function BayStyles() {
  return (
    <style href="spuzl-board-bay" precedence="default">
      {CSS}
    </style>
  );
}

/** Design square colours shared by chess and draughts (board materials, same in both themes). */
export const SQUARE = { light: "#E9D9E4", dark: "#B784A7", lastLight: "#F3C9E6", lastDark: "#D98CC2", draughtsDark: "#7A4B6E" } as const;

/** Square bevel from the design boards. */
export const BEVEL = "inset 0 2px 0 rgba(255,255,255,.22), inset 0 -2px 0 rgba(0,0,0,.14)";
