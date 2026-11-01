// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HowToSheet } from "@/components/play/HowToSheet";
import { GAMES } from "@/lib/catalog";
import { boardGames } from "@/lib/copy/board-games";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const wrap = (ui: ReactNode) => <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>;

afterEach(cleanup);

describe("Help sheet tips", () => {
  const meta = { ...GAMES.find((g) => g.id === "chess")!, rule: boardGames.bot.rules.chess };

  it("a game vs the bot shows its own tips, with no Dailies or hints", () => {
    const h = boardGames.bot.help;
    render(wrap(<HowToSheet open meta={meta} onClose={() => {}} tips={[{ icon: "robot", text: h.casual }]} />));
    const sheet = screen.getByRole("dialog");
    expect(sheet.textContent).toContain(h.casual);
    expect(sheet.textContent).not.toMatch(/daily|hint/i);
  });

  it("solo play keeps the default tips", () => {
    render(wrap(<HowToSheet open meta={meta} onClose={() => {}} />));
    const sheet = screen.getByRole("dialog");
    expect(sheet.querySelectorAll("li").length).toBeGreaterThan(0);
    expect(sheet.textContent).not.toContain(boardGames.bot.help.casual);
  });
});
