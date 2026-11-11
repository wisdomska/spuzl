// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Sheet } from "@/components/meta/Sheet";

afterEach(cleanup);

/**
 * Sheets slide (CSS `sheet-up` on `.sheet-content`), and fade instead with reduced motion: the in-app setting
 * (`[data-motion="reduce"]` on <html>) and the OS setting both swap the slide for `sheet-fade`.
 */
const css = readFileSync(path.resolve(__dirname, "../../../app/globals.css"), "utf8");

describe("Sheet motion", () => {
  it("is the shared sheet frame, which slides in", () => {
    render(
      <Sheet open onOpenChange={() => {}} title="Title">
        <p>Body</p>
      </Sheet>,
    );
    const sheet = screen.getByRole("dialog", { name: "Title" });
    expect(sheet.className).toContain("sheet-content");
    expect(css).toMatch(/\.sheet-content\[data-state="open"\] \{\s*animation: sheet-up/);
  });

  it("fades instead of sliding with reduced motion (in-app and OS)", () => {
    expect(css).toMatch(/\[data-motion="reduce"\] \.sheet-content\[data-state="open"\] \{\s*animation: sheet-fade/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.sheet-content\[data-state="open"\] \{\s*animation: sheet-fade/);
    expect(css).toMatch(/\[data-motion="reduce"\] \.modal-content\[data-state="open"\],/);
  });
});
