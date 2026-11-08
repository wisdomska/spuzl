import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LabTag, showsLabTag } from "@/components/ui/LabTag";
import { GAMES, LAB_GAMES, RETIRED_GAMES } from "@/lib/catalog";
import { labCopy } from "@/lib/copy/lab";

/** R3-05: switched-on lab games carry a "NEW" tag; live games never do. */
describe("LabTag", () => {
  it("shows on every lab game and on no live or retired game", () => {
    expect(LAB_GAMES.length).toBeGreaterThan(0);
    for (const g of LAB_GAMES) expect(showsLabTag(g.id), g.id).toBe(true);
    for (const g of GAMES) expect(showsLabTag(g.id), g.id).toBe(false);
    for (const g of RETIRED_GAMES) expect(showsLabTag(g.id), g.id).toBe(false);
    expect(showsLabTag("nope")).toBe(false);
  });

  it("renders the copy (visible, so it is part of the row's or card's accessible name) for a lab game", () => {
    const html = renderToStaticMarkup(<LabTag id={LAB_GAMES[0].id} />);
    expect(html).toContain("data-lab-tag");
    expect(html).toContain(labCopy.tag);
    // Visible words are not hidden from assistive tech; design tokens only.
    expect(html).not.toMatch(/aria-hidden="true"[^>]*>\s*New/);
    expect(html).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(html).toContain("var(--gold)");
  });

  it("renders nothing for a live game", () => {
    expect(renderToStaticMarkup(<LabTag id={GAMES[0].id} />)).toBe("");
  });

  it("compact fits the game header's 16 px label line", () => {
    expect(renderToStaticMarkup(<LabTag id={LAB_GAMES[0].id} compact />)).toContain("h-4");
  });

  it("copy keeps the house style: short, no em dash", () => {
    expect(labCopy.tag).toBe("NEW");
    for (const s of Object.values(labCopy)) expect(s).not.toContain("—");
  });
});
