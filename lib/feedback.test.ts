import { describe, expect, it } from "vitest";
import { FEEDBACK_RATE, FeedbackInput, MESSAGE_MAX, feedbackHref, feedbackProblem, sanitiseFrom, trimUserAgent } from "./feedback";

describe("feedback: sanitiseFrom (R4-02)", () => {
  it("keeps a same-site path and drops the query and hash", () => {
    expect(sanitiseFrom("/settings")).toBe("/settings");
    expect(sanitiseFrom("/games/crownfall?mode=daily#board")).toBe("/games/crownfall");
    expect(sanitiseFrom("  /me/  ")).toBe("/me");
    expect(sanitiseFrom("/")).toBe("/");
    expect(sanitiseFrom("/u/Kofi_123")).toBe("/u/Kofi_123");
  });

  it("drops anything that isn't a plain path on this site", () => {
    for (const bad of [
      "https://evil.example/x",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "settings",
      "/a/../admin",
      "/a/./b",
      "/<script>",
      "/a b",
      "/%2F%2Fevil",
      "/%E0%A4%A",
      "/%0Aheader",
      "",
      "/" + "a".repeat(250),
    ])
      expect(sanitiseFrom(bad), bad).toBeNull();
    expect(sanitiseFrom(undefined)).toBeNull();
    expect(sanitiseFrom(42)).toBeNull();
  });

  it("builds the in-app link to /contact", () => {
    expect(feedbackHref("/settings")).toBe("/contact?from=/settings");
    expect(feedbackHref("/games/crownfall?x=1")).toBe("/contact?from=/games/crownfall");
    expect(feedbackHref("https://evil.example")).toBe("/contact");
    expect(feedbackHref(null)).toBe("/contact");
  });
});

describe("feedback: input schema", () => {
  it("accepts a message alone, and the optional fields", () => {
    expect(FeedbackInput.parse({ message: "  The timer froze on level 3.  " }).message).toBe("The timer froze on level 3.");
    const full = FeedbackInput.parse({ message: "A puzzle had two answers.", email: " ama@example.com ", kind: "puzzle", from: "/daily" });
    expect(full).toMatchObject({ email: "ama@example.com", kind: "puzzle", from: "/daily" });
    expect(FeedbackInput.parse({ message: "Love it, more word games!", email: "" }).email).toBe("");
  });

  it("refuses short, long or blank messages, bad emails and unknown kinds", () => {
    expect(FeedbackInput.safeParse({ message: "too short" }).success).toBe(false);
    expect(FeedbackInput.safeParse({ message: "          x         " }).success).toBe(false);
    expect(FeedbackInput.safeParse({ message: "x".repeat(MESSAGE_MAX + 1) }).success).toBe(false);
    expect(FeedbackInput.safeParse({ message: "x".repeat(MESSAGE_MAX) }).success).toBe(true);
    expect(FeedbackInput.safeParse({ message: "A fine message here.", email: "not-an-email" }).success).toBe(false);
    expect(FeedbackInput.safeParse({ message: "A fine message here.", kind: "rant" }).success).toBe(false);
    expect(FeedbackInput.safeParse({}).success).toBe(false);
  });

  it("matches the client-side check", () => {
    expect(feedbackProblem({ message: "short", email: "" })).toBe("short");
    expect(feedbackProblem({ message: "x".repeat(MESSAGE_MAX + 1), email: "" })).toBe("long");
    expect(feedbackProblem({ message: "Long enough message", email: "nope@" })).toBe("email");
    expect(feedbackProblem({ message: "Long enough message", email: "" })).toBeNull();
    expect(feedbackProblem({ message: "Long enough message", email: "kofi@example.com" })).toBeNull();
  });

  it("cuts the user agent to 200 characters and strips control characters", () => {
    expect(trimUserAgent("x".repeat(500))).toHaveLength(200);
    expect(trimUserAgent("Mozilla/5.0\n(Android)")).toBe("Mozilla/5.0(Android)");
    expect(trimUserAgent(null)).toBeNull();
    expect(trimUserAgent("   ")).toBeNull();
  });

  it("limits sends to 5 an hour", () => {
    expect(FEEDBACK_RATE).toEqual({ max: 5, windowSeconds: 3600 });
  });
});
