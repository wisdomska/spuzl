import { describe, expect, it } from "vitest";
import { can, ROLES } from "./roles";
import { FEEDBACK_CSV_HEAD, feedbackCsv, feedbackFilename, feedbackForConsole, parseFeedbackFilters, type FeedbackDbRow } from "./feedback";

const row: FeedbackDbRow = {
  id: "00000000-0000-0000-0000-000000000001",
  created_at: "2026-11-09T10:15:30.000Z",
  status: "new",
  kind: "bug",
  message: '=HYPERLINK("x"), the timer froze',
  email: "ama.mensah@example.com",
  age_band: "16-17",
  from_path: "/games/crownfall",
  user_agent: "Mozilla/5.0 (Android 14)",
  player_id: "00000000-0000-0000-0000-000000000002",
  handled_at: null,
};

describe("admin feedback (R4-02)", () => {
  it("gives feedback.read to every role and feedback.write to owner and moderator", () => {
    expect(ROLES.filter((r) => can(r, "feedback.read"))).toEqual(["owner", "content_editor", "moderator", "analyst"]);
    expect(ROLES.filter((r) => can(r, "feedback.write"))).toEqual(["owner", "moderator"]);
  });

  it("validates filters", () => {
    expect(parseFeedbackFilters({})).toEqual({ ok: true, filters: { status: "", kind: "" } });
    expect(parseFeedbackFilters({ status: "done", kind: "idea" })).toEqual({ ok: true, filters: { status: "done", kind: "idea" } });
    expect(parseFeedbackFilters({ status: "open" })).toEqual({ ok: false, error: "bad_status" });
    expect(parseFeedbackFilters({ kind: "rant" })).toEqual({ ok: false, error: "bad_kind" });
  });

  it("masks the email unless the role may see personal data, as on the Players page", () => {
    expect(feedbackForConsole(row, "Ama", true)).toMatchObject({ email: "ama.mensah@example.com", emailVisible: true, nickname: "Ama" });
    const masked = feedbackForConsole(row, "Ama", false);
    expect(masked.email).toBe("a•••@•••.com");
    expect(masked.emailVisible).toBe(false);
    expect(feedbackForConsole({ ...row, email: null }, null, false).email).toBeNull();
  });

  it("exports CSV with formulas neutralised and the masked email", () => {
    const csv = feedbackCsv([feedbackForConsole(row, "Ama", false)]);
    const [head, line] = csv.split("\r\n");
    expect(head).toBe(FEEDBACK_CSV_HEAD.join(","));
    expect(line).toContain(`"'=HYPERLINK(""x""), the timer froze"`);
    expect(line).toContain("a•••@•••.com");
    expect(line).not.toContain("ama.mensah");
    expect(line.startsWith("2026-11-09 10:15,new,bug,")).toBe(true);
    expect(feedbackFilename({ status: "new", kind: "" }, "2026-11-09")).toBe("spuzl-feedback-new-2026-11-09.csv");
    expect(feedbackFilename({ status: "", kind: "" }, "2026-11-09")).toBe("spuzl-feedback-all-2026-11-09.csv");
  });
});
