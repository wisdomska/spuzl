"use client";

import { useContext, type CSSProperties } from "react";
import { QueryClientContext } from "@tanstack/react-query";
import type { SpuzMood } from "@/components/brand/Spuz";
import { SpuzWear } from "@/components/meta/SpuzWear";
import { useMe } from "@/lib/client/api";
import { shopCopy } from "@/lib/copy/shop";

/** Classic Lime (the free `skin-lime`): the look before a profile loads, and for anyone signed out. */
export const DEFAULT_SKIN = "#B8F23A";

export interface MySpuzProps {
  mood?: SpuzMood;
  size: number;
  still?: boolean;
  /** hidden from assistive tech (most Spuz sit beside words that say the same) */
  decorative?: boolean;
  /** the accessible name when not decorative (default "Your Spuz") */
  label?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * R3-15: the signed-in player's own Spuz, wearing their Shop look (skin colour and hat) wherever Spuz stands
 * for them: Home, results, celebrations, the game-over card. Reads the cached profile (`useMe`); while it loads,
 * when signed out, or outside the app's query provider it shows the default lime Spuz with no hat, in the same
 * size × size box, so nothing moves when the look arrives.
 */
export function MySpuz(props: MySpuzProps) {
  // Landing pages and isolated renders have no query client: draw the default look instead of throwing.
  return useContext(QueryClientContext) ? <Signed {...props} /> : <Look {...props} color={DEFAULT_SKIN} hat={null} />;
}

function Signed(props: MySpuzProps) {
  const me = useMe().data;
  return <Look {...props} color={me?.avatar_color || DEFAULT_SKIN} hat={me?.hat ?? null} />;
}

function Look({ mood, size, still, decorative, label, className, style, color, hat }: MySpuzProps & { color: string; hat: string | null }) {
  return (
    <SpuzWear
      size={size}
      color={color}
      hat={hat}
      mood={mood}
      still={still}
      className={className}
      style={style}
      label={decorative ? undefined : (label ?? shopCopy.yourSpuz)}
    />
  );
}
