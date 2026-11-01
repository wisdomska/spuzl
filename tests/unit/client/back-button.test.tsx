// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const router = { back: vi.fn(), push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/duel" }));

const { BackButton } = await import("@/components/meta/ui");

afterEach(cleanup);

describe("BackButton", () => {
  it("goes to the Grid on a deep link, even with browser history from another site", () => {
    window.history.pushState({}, "", "/other");
    window.history.pushState({}, "", "/duel");
    expect(window.history.length).toBeGreaterThan(1);
    render(<BackButton />);
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(router.push).toHaveBeenCalledWith("/");
    expect(router.back).not.toHaveBeenCalled();
  });
});
