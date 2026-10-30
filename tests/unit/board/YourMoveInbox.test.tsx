// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { YourMoveInbox } from "@/components/board/YourMoveInbox";
import { INBOX_SAMPLE } from "./fixtures";

afterEach(cleanup);

describe("YourMoveInbox", () => {
  it("renders the design B7 inbox from props, your move first", () => {
    render(<YourMoveInbox games={[...INBOX_SAMPLE].reverse()} onPlay={() => {}} onNewGame={() => {}} />);
    expect(screen.getByText("3 waiting")).toBeTruthy();
    const titles = screen.getAllByText(/ vs /).map((n) => n.textContent);
    expect(titles.slice(0, 3).sort()).toEqual(["Chess vs Zainab", "Draughts vs Chidi", "Oware vs Kofi"]);
    expect(titles[4]).toBe("Oware vs Efua");
    expect(screen.getByText("New game with a friend")).toBeTruthy();
  });

  it("routes Play, Nudge, Rematch and New game to callbacks", () => {
    const onPlay = vi.fn(), onNudge = vi.fn(), onRematch = vi.fn(), onNewGame = vi.fn();
    const games = INBOX_SAMPLE.map((g) => (g.id === "4" ? { ...g, canNudge: true } : g));
    render(<YourMoveInbox games={games} onPlay={onPlay} onNudge={onNudge} onRematch={onRematch} onNewGame={onNewGame} />);
    fireEvent.click(screen.getByRole("button", { name: "Play: Oware vs Kofi" }));
    fireEvent.click(screen.getByRole("button", { name: "Nudge: Chess vs Kwame" }));
    fireEvent.click(screen.getByRole("button", { name: "Rematch: Oware vs Efua" }));
    fireEvent.click(screen.getByText("New game with a friend"));
    expect(onPlay).toHaveBeenCalledWith("1");
    expect(onNudge).toHaveBeenCalledWith("4");
    expect(onRematch).toHaveBeenCalledWith("5");
    expect(onNewGame).toHaveBeenCalledOnce();
  });

  it("disables nudging before 12 h or after a nudge, and shows an empty state", () => {
    const { rerender } = render(<YourMoveInbox games={INBOX_SAMPLE} onPlay={() => {}} onNudge={() => {}} onNewGame={() => {}} />);
    expect((screen.getByRole("button", { name: "Nudge: Chess vs Kwame" }) as HTMLButtonElement).disabled).toBe(true);
    rerender(<YourMoveInbox games={[{ ...INBOX_SAMPLE[3], canNudge: true, nudged: true }]} onPlay={() => {}} onNudge={() => {}} onNewGame={() => {}} />);
    expect((screen.getByRole("button", { name: "Nudged: Chess vs Kwame" }) as HTMLButtonElement).disabled).toBe(true);
    rerender(<YourMoveInbox games={[]} onPlay={() => {}} onNewGame={() => {}} />);
    expect(screen.getByText("No games on the go")).toBeTruthy();
    expect(screen.queryByText(/waiting/)).toBeNull();
  });
});
