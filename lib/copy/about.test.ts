import { describe, expect, it } from "vitest";
import { aboutCopy } from "./about";

const S = aboutCopy.spil;

describe("about copy: SPIL sister app card", () => {
  it("mirrors SPIL's own compact card for SPUZL: eyebrow, question, one line and an https link", () => {
    expect(S.eyebrow).toBe("From the same studio");
    expect(S.title).toBe("Prefer party games?");
    expect(S.url).toBe("https://spil-party.vercel.app");
    expect(S.cta).toBe("Play SPIL");
    expect(S.newTab).toBe("(opens in a new tab)");
  });

  it("only states facts from SPIL's launch copy", () => {
    expect(S.body).toContain("ten games you play on your own phones");
    expect(S.body).not.toMatch(/\d{3,}|downloads|users|rated/i);
  });

  it("keeps the footer credit in place", () => {
    expect(aboutCopy.credit).toBe("Designed & Developed by Senya");
    expect(aboutCopy.creditUrl).toBe("https://wisdomska.site");
  });
});
