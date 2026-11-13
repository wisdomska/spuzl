/** Player-facing copy for Tripwire (games/tripwire). The rest of its strings still live in the board (FOLLOW_UPS). */
export const TRIPWIRE_COPY = {
  zoomLabel: "Zoom",
  /** Tap-to-zoom (R7): a board whose tiles come out small opens zoomed on the first tap. */
  zoom: {
    start: "Tap to zoom in, then tap to reveal.",
    zoomed: "Zoomed in. Drag to look around, tap Zoom again to see the whole board.",
    whole: "Whole board.",
  },
} as const;
