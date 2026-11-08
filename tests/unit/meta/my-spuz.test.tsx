// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { DEFAULT_SKIN, MySpuz } from "@/components/meta/MySpuz";
import { SpuzWear, TINY_SPUZ } from "@/components/meta/SpuzWear";
import type { Me } from "@/lib/client/api";

/** A query client whose cached profile is `me` (undefined: nothing cached yet, so the profile is still loading). */
function withMe(me: Partial<Me> | null | undefined, ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, enabled: false } } });
  if (me !== undefined) client.setQueryData(["me"], me);
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
}

/** The skin colour Spuz is drawn in: its body is the element with the body's border radius. */
const skinOf = (root: HTMLElement) => {
  const body = [...root.querySelectorAll<HTMLElement>(".spuz-root div")].find((d) => d.style.borderRadius.startsWith("3.6em"));
  return body?.style.background;
};
const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

afterEach(cleanup);

describe("MySpuz: the player's own Spuz wears their Shop look (R3-15)", () => {
  it("draws the signed-in player's skin colour and hat", () => {
    const { container } = render(
      withMe({ avatar_color: "#8B7CFF", hat: "shades", skin: "skin-violet" }, <MySpuz mood="cheer" size={120} />),
    );
    expect(container.querySelector("[data-hat]")?.getAttribute("data-hat")).toBe("shades");
    expect(skinOf(container)).toBe(rgb("#8B7CFF"));
    expect(screen.getByRole("img", { name: "Your Spuz" })).toBeTruthy();
  });

  it("the default look while the profile loads, when signed out, and outside the query provider", () => {
    for (const ui of [
      withMe(undefined, <MySpuz size={96} decorative />),
      withMe(null, <MySpuz size={96} decorative />),
      <MySpuz key="bare" size={96} decorative />,
    ]) {
      const { container } = render(ui);
      expect(container.querySelector("[data-hat]")).toBeNull();
      expect(skinOf(container)).toBe(rgb(DEFAULT_SKIN));
      cleanup();
    }
  });

  it("decorative: hidden from assistive tech; the box keeps its size with or without a hat (no layout shift)", () => {
    const { container } = render(withMe({ avatar_color: "#FFC93C", hat: "crown" }, <MySpuz size={88} decorative />));
    const box = container.firstElementChild as HTMLElement;
    expect(box.getAttribute("aria-hidden")).toBe("true");
    expect(screen.queryByRole("img")).toBeNull();
    expect([box.style.width, box.style.height]).toEqual(["88px", "88px"]);
  });

  it("a hat with a party mood swaps to cheer, so the built-in party hat never stacks on it", () => {
    const { container } = render(withMe({ avatar_color: "#B8F23A", hat: "kente" }, <MySpuz mood="party" size={64} decorative />));
    expect(container.querySelector(".spuz-root")?.getAttribute("data-mood")).toBe("cheer");
  });

  it("still and reduced motion: the hat sits inside the Spuz root, so the still flag freezes it too", () => {
    const { container } = render(withMe({ avatar_color: "#B8F23A", hat: "chef" }, <MySpuz size={60} still decorative />));
    const root = container.querySelector(".spuz-root")!;
    expect(root.getAttribute("data-still")).toBe("true");
    expect(root.querySelector("[data-hat='chef']")).toBeTruthy();
  });
});

describe("SpuzWear at avatar-chip sizes", () => {
  it("every hat renders at 24 and 40 px with thin lines kept at 1 px or more", () => {
    expect(TINY_SPUZ).toBeGreaterThan(40);
    for (const size of [24, 40])
      for (const hat of ["party", "crown", "kente", "shades", "headphones", "chef", "beanie"]) {
        const { container } = render(<SpuzWear size={size} color="#B8F23A" hat={hat} />);
        const layer = container.querySelector(`[data-hat='${hat}']`)!;
        expect(layer, `${hat} at ${size}`).toBeTruthy();
        for (const d of layer.querySelectorAll<HTMLElement>("div")) {
          const h = parseFloat(d.style.height);
          if (!Number.isNaN(h) && d.style.height.endsWith("px")) expect(h, `${hat} at ${size}`).toBeGreaterThanOrEqual(1);
        }
        cleanup();
      }
  });

  it("an unknown hat id falls back to the party hat", () => {
    const { container } = render(<SpuzWear size={40} color="#B8F23A" hat="top-hat" />);
    expect(container.querySelector("[data-hat]")?.getAttribute("data-hat")).toBe("party");
  });
});
