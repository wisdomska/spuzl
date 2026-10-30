import type { Emblem, FlagSpec } from "./content";

/** Five pointed star, point up, as SVG polygon points. */
export function starPoints(cx: number, cy: number, r: number) {
  const pts: string[] = [];
  for (let k = 0; k < 10; k++) {
    const rad = k % 2 ? r * 0.382 : r;
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    pts.push(`${+(cx + rad * Math.cos(a)).toFixed(4)},${+(cy + rad * Math.sin(a)).toFixed(4)}`);
  }
  return pts.join(" ");
}

function EmblemShape({ e }: { e: Emblem }) {
  return e.type === "disc" ? <circle cx={e.cx} cy={e.cy} r={e.r} fill={e.color} /> : <polygon points={starPoints(e.cx, e.cy, e.r)} fill={e.color} />;
}

/** Draws a flag from its spec at its official ratio. A hairline frame keeps white fields visible. */
export function Flag({ spec, width = 200, label }: { spec: FlagSpec; width?: number; label: string }) {
  const { w, h } = spec;
  const parts: React.ReactNode[] = [];
  if (spec.kind === "h" || spec.kind === "v") {
    const weights = spec.weights ?? spec.stripes.map(() => 1);
    const sum = weights.reduce((a, b) => a + b, 0);
    let at = 0;
    spec.stripes.forEach((c, k) => {
      const size = ((spec.kind === "h" ? h : w) * weights[k]) / sum;
      parts.push(spec.kind === "h" ? <rect key={k} x={0} y={at} width={w} height={size} fill={c} /> : <rect key={k} x={at} y={0} width={size} height={h} fill={c} />);
      at += size;
    });
  } else if (spec.kind === "nordic") {
    parts.push(<rect key="f" width={w} height={h} fill={spec.field} />);
    for (const [k, c] of [spec.cross, spec.inner].entries()) {
      if (!c) continue;
      parts.push(<rect key={`v${k}`} x={c.x} y={0} width={c.t} height={h} fill={c.color} />, <rect key={`h${k}`} x={0} y={c.y} width={w} height={c.t} fill={c.color} />);
    }
  } else {
    parts.push(<rect key="f" width={w} height={h} fill={spec.field} />);
    spec.rects?.forEach(([x, y, rw, rh, c], k) => parts.push(<rect key={`r${k}`} x={x} y={y} width={rw} height={rh} fill={c} />));
    spec.polys?.forEach(([pts, c], k) => parts.push(<polygon key={`p${k}`} points={pts} fill={c} />));
  }
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${w} ${h}`} width={width} height={(width * h) / w} style={{ display: "block", borderRadius: 6, boxShadow: "0 0 0 1px var(--line)", overflow: "hidden" }}>
      {parts}
      {spec.emblems?.map((e, k) => <EmblemShape key={`e${k}`} e={e} />)}
    </svg>
  );
}
