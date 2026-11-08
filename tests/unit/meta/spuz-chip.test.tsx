// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { SpuzChip } from "@/components/meta/SpuzChip";
import { AvatarChip } from "@/components/meta/ui";
import { Avatar } from "@/components/multiplayer/ui";
import type { Me } from "@/lib/client/api";

/** The skin colour Spuz is drawn in: its body is the element with the body's border radius. */
const skinOf = (root: ParentNode) =>
  [...root.querySelectorAll<HTMLElement>(".spuz-root div")].find((d) => d.style.borderRadius.startsWith("3.6em"))?.style.background;
const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};
function withMe(me: Partial<Me> | undefined, ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, enabled: false } } });
  if (me !== undefined) client.setQueryData(["me"], me);
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
}

afterEach(cleanup);

describe("SpuzChip: list avatars wear the player's look (R3-16)", () => {
  it("draws a still Spuz in the skin colour wearing the hat, with no letter", () => {
    const { container } = render(<AvatarChip nickname="ama" color="#8B7CFF" hat="shades" size={30} radius={9} />);
    expect(container.querySelector("[data-hat]")?.getAttribute("data-hat")).toBe("shades");
    expect(skinOf(container)).toBe(rgb("#8B7CFF"));
    expect(container.querySelector(".spuz-root")?.getAttribute("data-still")).toBe("true");
    expect(container.textContent).toBe("");
  });

  it("no hat: the plain Spuz (the default look), still in the player's colour", () => {
    for (const hat of [null, undefined]) {
      const { container } = render(<Avatar name="kofi" color="#FFC93C" hat={hat} size={28} />);
      expect(container.querySelector("[data-hat]")).toBeNull();
      expect(container.querySelector(".spuz-root")).toBeTruthy();
      expect(skinOf(container)).toBe(rgb("#FFC93C"));
      cleanup();
    }
  });

  it("decorative and the same size × size box as the letter avatar it replaces (no layout shift)", () => {
    for (const size of [22, 28, 36, 52]) {
      const { container } = render(<AvatarChip nickname="esi" color="#B8F23A" hat="crown" size={size} />);
      const box = container.firstElementChild as HTMLElement;
      expect(box.getAttribute("aria-hidden")).toBe("true");
      expect(box.getAttribute("data-avatar")).toBe("spuz");
      expect([box.style.width, box.style.height]).toEqual([`${size}px`, `${size}px`]);
      // the Spuz inside is exactly the box, so the hat never pokes out of the row
      const spuz = box.querySelector<HTMLElement>(".spuz-root")!.parentElement!;
      expect([spuz.style.width, spuz.style.height]).toEqual([`${size}px`, `${size}px`]);
      cleanup();
    }
  });

  it("keeps the presence dot and overlays (emote bubbles, the crown) as children", () => {
    const { container } = render(
      <Avatar name="yaw" color="#B8F23A" hat="kente">
        <span data-testid="bubble" />
      </Avatar>,
    );
    expect(container.querySelector("[data-testid='bubble']")).toBeTruthy();
    const online = render(<AvatarChip nickname="abena" color="#B8F23A" online size={34} />);
    expect(online.container.querySelectorAll("span.rounded-full").length).toBe(1);
  });

  it("dim fades the whole chip (an away seat, a stale rival)", () => {
    const { container } = render(<Avatar name="kwame" color="#5A5E78" hat="chef" dim />);
    expect((container.firstElementChild as HTMLElement).style.opacity).toBe("0.4");
  });

  it("me: the signed-in player's own row wears the live profile look, the row's look until it loads", () => {
    const live = render(withMe({ avatar_color: "#FF5A5F", hat: "headphones" }, <SpuzChip color="#B8F23A" hat={null} me size={30} />));
    expect(live.container.querySelector("[data-hat]")?.getAttribute("data-hat")).toBe("headphones");
    expect(skinOf(live.container)).toBe(rgb("#FF5A5F"));
    cleanup();
    const loading = render(withMe(undefined, <SpuzChip color="#2FD3E0" hat="beanie" me size={30} />));
    expect(loading.container.querySelector("[data-hat]")?.getAttribute("data-hat")).toBe("beanie");
    expect(skinOf(loading.container)).toBe(rgb("#2FD3E0"));
    cleanup();
    const bare = render(<SpuzChip color="#2FD3E0" hat="party" me size={30} />);
    expect(bare.container.querySelector("[data-hat]")?.getAttribute("data-hat")).toBe("party");
  });

  it("a 50-row list stays light: one still Spuz per row, no animated layers", () => {
    const { container } = render(
      <ol>
        {Array.from({ length: 50 }, (_, i) => (
          <li key={i}>
            <AvatarChip nickname={`p${i}`} color="#B8F23A" hat={i % 2 ? "shades" : null} size={30} radius={9} />
          </li>
        ))}
      </ol>,
    );
    const roots = container.querySelectorAll(".spuz-root");
    expect(roots.length).toBe(50);
    for (const r of roots) expect(r.getAttribute("data-still")).toBe("true");
    expect(container.querySelectorAll(".spuz-hop, .spuz-wave").length).toBe(0);
    // a light tree: well under 40 elements per row
    expect(container.querySelectorAll("*").length / 50).toBeLessThan(40);
  });
});
