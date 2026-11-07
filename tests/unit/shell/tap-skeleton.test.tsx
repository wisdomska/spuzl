// @vitest-environment jsdom
/* eslint-disable @next/next/no-html-link-for-pages -- plain anchors stand in for Next <Link>s (which render one) */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/components/game/ShellSkeleton", () => ({ ShellSkeleton: () => <div data-testid="shell" /> }));

import { TapSkeleton } from "@/components/shell/TapSkeleton";

afterEach(cleanup);

/** Like Next's <Link>: cancels the browser's navigation in its own click handler to route on the client. */
const cancel = (e: React.MouseEvent) => e.preventDefault();

describe("TapSkeleton (R2-01): the skeleton on the very frame a game is tapped", () => {
  it("shows for a Next <Link> to a game marked data-play-nav, even though the link cancels the click", () => {
    render(
      <>
        <TapSkeleton />
        <a href="/play/crownfall?mode=five" data-play-nav="" onClick={cancel}>
          Daily Five
        </a>
      </>,
    );
    act(() => void fireEvent.click(screen.getByText("Daily Five")));
    expect(screen.getByTestId("shell")).toBeTruthy();
  });

  it("not for an unmarked link whose handler cancels it (a Library row opens its card instead)", () => {
    render(
      <>
        <TapSkeleton />
        <a href="/play/dusk" onClick={cancel}>
          Dusk row
        </a>
      </>,
    );
    act(() => void fireEvent.click(screen.getByText("Dusk row")));
    expect(screen.queryByTestId("shell")).toBeNull();
  });

  it("not for Ctrl-click or a middle click (the browser opens a new page)", () => {
    render(
      <>
        <TapSkeleton />
        <a href="/play/crownfall" data-play-nav="" onClick={cancel}>
          Continue
        </a>
      </>,
    );
    act(() => void fireEvent.click(screen.getByText("Continue"), { ctrlKey: true }));
    act(() => void fireEvent.click(screen.getByText("Continue"), { button: 1 }));
    expect(screen.queryByTestId("shell")).toBeNull();
  });
});
