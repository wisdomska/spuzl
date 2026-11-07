import { describe, expect, it } from "vitest";
import { EventCreate, EVENT_ACCENTS, MAX_EVENT_DAYS, windowProblem } from "./index";
import { EVENT_TEMPLATE_IDS, EVENT_TEMPLATES, isTemplateId, templateWindow } from "./templates";

const NOW = Date.parse("2026-11-07T10:00:00Z");

describe("event templates", () => {
  it("has the four ready-made events, each a valid event with a bonus quest on the existing goals", () => {
    expect(EVENT_TEMPLATE_IDS).toEqual(["detty-december", "exam-season", "afcon-week", "march-sixth"]);
    for (const id of EVENT_TEMPLATE_IDS) {
      const t = EVENT_TEMPLATES[id];
      const w = templateWindow(id, NOW);
      const parsed = EventCreate.safeParse({ name: t.name, ...w, accent: t.accent, banner: t.banner, quest: t.quest, quiz: t.quiz });
      expect(parsed.success, `${id}: ${JSON.stringify(parsed.error?.issues)}`).toBe(true);
      expect(windowProblem(w.startsAt, w.endsAt)).toBeNull();
      expect(EVENT_ACCENTS).toContain(t.accent);
      expect(t.banner.length).toBeLessThanOrEqual(140);
      expect(t.banner).not.toMatch(/[–—]/);
    }
    expect(isTemplateId("march-sixth")).toBe(true);
    expect(isTemplateId("christmas")).toBe(false);
  });

  it("dates Detty December 15 Dec to 5 Jan, still this season on 1 Jan", () => {
    expect(templateWindow("detty-december", NOW)).toEqual({ startsAt: "2026-12-15T00:00:00.000Z", endsAt: "2027-01-06T00:00:00.000Z" });
    expect(templateWindow("detty-december", Date.parse("2027-01-01T12:00:00Z")).startsAt).toBe("2026-12-15T00:00:00.000Z");
    expect(templateWindow("detty-december", Date.parse("2027-01-06T00:00:00Z")).startsAt).toBe("2027-12-15T00:00:00.000Z");
  });

  it("dates Exam Season over May and June within the 62-day limit", () => {
    const w = templateWindow("exam-season", NOW);
    expect(w).toEqual({ startsAt: "2027-05-01T00:00:00.000Z", endsAt: "2027-07-01T00:00:00.000Z" });
    expect((Date.parse(w.endsAt) - Date.parse(w.startsAt)) / 86_400_000).toBeLessThanOrEqual(MAX_EVENT_DAYS);
  });

  it("dates the 6 March Quiz on Independence Day and features the Ghana history set", () => {
    expect(templateWindow("march-sixth", NOW)).toEqual({ startsAt: "2027-03-06T00:00:00.000Z", endsAt: "2027-03-08T00:00:00.000Z" });
    expect(EVENT_TEMPLATES["march-sixth"].quiz).toBe("ghana-1957");
    expect(EVENT_TEMPLATES["march-sixth"].quest).toMatchObject({ kind: "world_clears", world: "word" });
  });

  it("leaves AFCON dates to the admin: a placeholder week from next Monday", () => {
    expect(EVENT_TEMPLATES["afcon-week"].fixedDates).toBe(false);
    // 7 Nov 2026 is a Saturday.
    expect(templateWindow("afcon-week", NOW)).toEqual({ startsAt: "2026-11-09T00:00:00.000Z", endsAt: "2026-11-16T00:00:00.000Z" });
    // On a Monday it is the following Monday, never today.
    expect(templateWindow("afcon-week", Date.parse("2026-11-09T08:00:00Z")).startsAt).toBe("2026-11-16T00:00:00.000Z");
  });
});
