// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { Sheet } from "@/components/meta/Sheet";
import { useSettings } from "@/lib/settings/store";

beforeAll(() => {
  // jsdom has no matchMedia; the OS setting reads as "no preference".
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as never;
});
afterEach(cleanup);

describe("Sheet motion", () => {
  const open = () =>
    render(
      <Sheet open onOpenChange={() => {}} title="Title">
        <p>Body</p>
      </Sheet>,
    );

  it("slides in by default", () => {
    act(() => useSettings.setState({ hydrated: true, reducedMotion: "off" }));
    open();
    expect(screen.getByRole("dialog").style.transform).toContain("translateY(100%)");
  });

  it("fades instead of sliding with reduced motion on", () => {
    act(() => useSettings.setState({ hydrated: true, reducedMotion: "on" }));
    open();
    const sheet = screen.getByRole("dialog");
    expect(sheet.style.transform).toBe("");
    expect(sheet.style.opacity).toBe("0");
  });
});
