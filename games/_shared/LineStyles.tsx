/**
 * Line Lane motion (Handoff "Line drawn"): segment scaleX/scaleY from its origin, head scale pulse,
 * trail opacity 1 to 0 over 300 ms. Pipes turn with a 180 ms spring and water pulses through lit pipes.
 * Transform and opacity only. Reduced motion: the line appears, no trail, no pulse.
 * React 19 hoists and dedupes the <style> by href, so every Line Lane board can render this.
 */
const CSS = `
@keyframes ll-grow-x { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes ll-grow-y { from { transform: scaleY(0); } to { transform: scaleY(1); } }
@keyframes ll-head { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.5); opacity: .4; } }
@keyframes ll-trail { from { opacity: 1; } to { opacity: 0; } }
@keyframes ll-flow { 0% { opacity: .55; } 100% { opacity: 1; } }
@keyframes ll-fog { from { opacity: 1; } to { opacity: 0; } }
.ll-grow-x { animation: ll-grow-x 120ms var(--ease-out) both; }
.ll-grow-y { animation: ll-grow-y 120ms var(--ease-out) both; }
.ll-head { animation: ll-head 1s ease-in-out infinite; }
.ll-trail { animation: ll-trail 300ms var(--ease-out) both; pointer-events: none; }
.ll-flow { animation: ll-flow 420ms var(--ease-out) both; }
.ll-turn { transition: transform var(--dur-fast) var(--spring-press); }
.ll-fog { transition: opacity 260ms var(--ease-out); }
.ll-cam { transition: transform var(--dur-ui) var(--ease-out); }
[data-motion="reduce"] .ll-grow-x, [data-motion="reduce"] .ll-grow-y, [data-motion="reduce"] .ll-head, [data-motion="reduce"] .ll-flow { animation: none; }
[data-motion="reduce"] .ll-trail { display: none; }
[data-motion="reduce"] .ll-turn, [data-motion="reduce"] .ll-cam { transition: none; }
[data-motion="reduce"] .ll-fog { transition: opacity 80ms linear; }
`;

export function LineStyles() {
  return (
    <style href="spuzl-line-lane" precedence="default">
      {CSS}
    </style>
  );
}
