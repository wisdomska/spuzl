import type { CSSProperties, ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

/**
 * Floating island (Solo Screens Home): ellipse top, tapered underside, landmark block with the world
 * icon, bobbing 5 to 6 s ease-in-out. The deep underside mixes the world colour toward ink.
 */
export function Island({ color, icon, landmarkLeft = 46, bob = 5, children, dim }: { color: string; icon: string; landmarkLeft?: number; bob?: number; children?: ReactNode; dim?: boolean }) {
  const deep = `color-mix(in srgb, ${color} 45%, #0E0F1A)`;
  return (
    <div className="ambient relative h-[100px] w-[136px]" style={{ animation: `bob ${bob}s ease-in-out infinite`, opacity: dim ? 0.85 : 1 } as CSSProperties}>
      <div className="absolute top-[54px] left-[34px] h-[44px] w-[68px]" style={{ clipPath: "polygon(0 0,100% 0,62% 100%,40% 86%)", background: deep }} />
      <div className="absolute top-[40px] left-[10px] h-[30px] w-[116px] rounded-[50%]" style={{ background: color, boxShadow: "inset 0 -7px 0 rgba(0,0,0,.22)" }} />
      <div
        className="absolute top-0 flex h-[52px] w-[44px] items-center justify-center text-[#0E0F1A]"
        style={{ left: landmarkLeft, borderRadius: "13px 13px 9px 9px", background: color, boxShadow: "inset -4px -4px 0 rgba(0,0,0,.2), 0 0 0 3px var(--bg)" }}
      >
        <Icon name={icon} size={24} />
      </div>
      {children}
    </div>
  );
}
