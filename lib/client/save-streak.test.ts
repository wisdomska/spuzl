import { describe, expect, it } from "vitest";
import { SAVE_PROMPT_SNOOZE_MS, shouldAskToSave } from "./save-streak";

const now = Date.UTC(2026, 10, 1);
const base = { guest: true, clears: 3, after: 3, dismissedAt: null, now };

describe("shouldAskToSave (SPZ-20)", () => {
  it("asks a guest from the Nth clear on", () => {
    expect(shouldAskToSave(base)).toBe(true);
    expect(shouldAskToSave({ ...base, clears: 9 })).toBe(true);
    expect(shouldAskToSave({ ...base, clears: 2 })).toBe(false);
  });
  it("never asks members, unknown counts, or when the setting is 0", () => {
    expect(shouldAskToSave({ ...base, guest: false })).toBe(false);
    expect(shouldAskToSave({ ...base, clears: undefined })).toBe(false);
    expect(shouldAskToSave({ ...base, after: 0, clears: 50 })).toBe(false);
  });
  it("re-asks at most once a week after a dismissal", () => {
    expect(shouldAskToSave({ ...base, dismissedAt: now - 1000 })).toBe(false);
    expect(shouldAskToSave({ ...base, dismissedAt: now - SAVE_PROMPT_SNOOZE_MS + 1 })).toBe(false);
    expect(shouldAskToSave({ ...base, dismissedAt: now - SAVE_PROMPT_SNOOZE_MS })).toBe(true);
  });
});
