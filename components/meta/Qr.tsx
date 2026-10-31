"use client";

import { useMemo } from "react";
import QRCode from "qrcode";

/** QR code drawn as SVG rects from the `qrcode` matrix (no innerHTML). Always ink on light for scanners. */
export function Qr({ value, size, label }: { value: string; size: number; label: string }) {
  const m = useMemo(() => {
    const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
    return { n: qr.modules.size, data: qr.modules.data };
  }, [value]);
  const rects: string[] = [];
  for (let y = 0; y < m.n; y++) {
    let x = 0;
    while (x < m.n) {
      if (!m.data[y * m.n + x]) {
        x++;
        continue;
      }
      let run = 1;
      while (x + run < m.n && m.data[y * m.n + x + run]) run++;
      rects.push(`M${x} ${y}h${run}v1h-${run}z`);
      x += run;
    }
  }
  return (
    <svg role="img" aria-label={label} width={size} height={size} viewBox={`0 0 ${m.n} ${m.n}`} shapeRendering="crispEdges">
      <path d={rects.join("")} fill="#0E0F1A" />
    </svg>
  );
}
