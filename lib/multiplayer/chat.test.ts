import { describe, expect, it } from "vitest";
import { partyTextProblem } from "@/lib/party-adult/filter";
import { CHAT_MAX, QUICK_PHRASES } from "./chat";
import { EMOTES, EMOTE_LABELS, isEmoteId } from "./constants";

describe("match chat", () => {
  it("has eight reactions, each with a spoken name", () => {
    expect(EMOTES).toHaveLength(8);
    expect(EMOTE_LABELS).toHaveLength(8);
    expect(isEmoteId(7)).toBe(true);
    expect(isEmoteId(8)).toBe(false);
    expect(isEmoteId(1.5)).toBe(false);
  });
  it("keeps quick phrases short and clean", () => {
    for (const q of QUICK_PHRASES) {
      expect(q.length).toBeLessThanOrEqual(CHAT_MAX);
      expect(partyTextProblem(q, "statement"), q).toBeNull();
    }
  });
  it("refuses contact details and abuse in typed chat (the server's filter)", () => {
    expect(partyTextProblem("add me 0244 123 456", "statement")).toBe("contact");
    expect(partyTextProblem("you are shit", "statement")).toBe("blocked");
    expect(partyTextProblem("nice game, well played", "statement")).toBeNull();
  });
});
