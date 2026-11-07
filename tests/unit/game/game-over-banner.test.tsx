// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const played: string[] = [];
vi.mock("@/lib/audio", () => ({ play: (n: string) => played.push(n) }));
vi.mock("@/components/fx/Confetti", () => ({ Confetti: () => <div data-testid="confetti" /> }));
vi.mock("@/components/brand/Spuz", () => ({ Spuz: () => <div /> }));
const tracked: unknown[][] = [];
vi.mock("@/lib/analytics/track", () => ({ track: (...a: unknown[]) => tracked.push(a) }));

import { GameOverBanner } from "@/components/game/GameOverBanner";

beforeEach(() => {
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as never;
  played.length = 0;
  tracked.length = 0;
  sessionStorage.clear();
});
afterEach(cleanup);

describe("GameOverBanner: the end of a game is unmissable", () => {
  it("nothing while the game is on", () => {
    render(<GameOverBanner id="m1" outcome={null} />);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(played).toEqual([]);
  });

  it("a win: the card says so, with the reason, the win sound and confetti; Rematch acts", () => {
    const rematch = vi.fn();
    render(<GameOverBanner id="m2" outcome="won" reason="Checkmate." actionLabel="Rematch" onAction={rematch} />);
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(screen.getByText("You won!")).toBeTruthy();
    expect(screen.getByText("Checkmate.")).toBeTruthy();
    expect(screen.getByTestId("confetti")).toBeTruthy();
    expect(played).toEqual(["duelWin"]);
    fireEvent.click(screen.getByRole("button", { name: /Rematch/ }));
    expect(rematch).toHaveBeenCalledOnce();
  });

  it("a loss or a draw: its own words and sound, no confetti; See the board closes it", () => {
    render(<GameOverBanner id="m3" outcome="lost" reason="They resigned." />);
    expect(screen.getByText("You lost")).toBeTruthy();
    expect(screen.queryByTestId("confetti")).toBeNull();
    expect(played).toEqual(["duelLose"]);
    fireEvent.click(screen.getAllByRole("button", { name: "See the board" }).at(-1)!);
    cleanup();
    render(<GameOverBanner id="m4" outcome="draw" />);
    expect(screen.getByText("It's a draw")).toBeTruthy();
  });

  it("once per game: opening the same finished game again doesn't replay it", () => {
    const { unmount } = render(<GameOverBanner id="m5" outcome="won" />);
    unmount();
    played.length = 0;
    render(<GameOverBanner id="m5" outcome="won" />);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(played).toEqual([]);
  });

  it("reports the result to the admin Metrics once per game (R2-ADMIN game_over)", () => {
    const { unmount } = render(<GameOverBanner id="m6" outcome="lost" metric={{ game: "chess", kind: "bot" }} />);
    expect(tracked).toEqual([["game_over", { game: "chess", mode: "bot", kind: "lost" }]]);
    fireEvent.click(screen.getAllByRole("button", { name: "See the board" }).at(-1)!);
    unmount();
    render(<GameOverBanner id="m6" outcome="lost" metric={{ game: "chess", kind: "bot" }} />);
    expect(tracked).toHaveLength(1);
    cleanup();
    render(<GameOverBanner id="m7" outcome="won" />); // no metric: nothing sent
    expect(tracked).toHaveLength(1);
  });
});
