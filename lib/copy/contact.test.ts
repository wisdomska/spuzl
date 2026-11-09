import { describe, expect, it } from "vitest";
import { FEEDBACK_KINDS } from "@/lib/feedback";
import { FALLBACK_SUPPORT_EMAIL, contactCopy as C } from "./contact";

describe("contact copy (R4-02)", () => {
  it("labels the form the way SPIL does", () => {
    expect(C.title).toBe("Contact");
    expect(C.form.email).toBe("Email, if you want a reply");
    expect(C.form.message).toBe("Message");
    expect(C.form.send).toBe("Send message");
    expect(C.orEmail).toBe("Or email");
    expect(FALLBACK_SUPPORT_EMAIL).toBe("wisdomska@gmail.com");
  });

  it("names every kind, and the select options read as the brief asks", () => {
    for (const k of FEEDBACK_KINDS) expect(C.form.kinds[k]).toBeTruthy();
    expect(Object.values(C.form.kinds)).toEqual(["Bug", "A puzzle looks wrong", "Idea", "Something else"]);
  });

  it("has warm, plain copy for every state, without em dashes", () => {
    const all = JSON.stringify(C);
    expect(all).not.toContain("—");
    expect(all).not.toContain("inbox opens at launch");
    expect(C.form.sending).toBeTruthy();
    expect(C.form.sentTitle).toBeTruthy();
    expect(C.form.errors.rate_limited).toBeTruthy();
    expect(C.form.from("/settings")).toContain("/settings");
    expect(C.form.count(12)).toBe("12 / 2000");
  });
});
