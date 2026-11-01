import { describe, expect, it } from "vitest";
import { INVITE_TARGETS, inviteHref } from "./targets";

describe("invite share targets", () => {
  const url = "https://spuzl.vercel.app/i/ABC123";
  it("offers more than WhatsApp, each with an address", () => {
    expect(INVITE_TARGETS.map((t) => t.id)).toEqual(
      expect.arrayContaining(["whatsapp", "snapchat", "instagram", "telegram", "sms", "email"]),
    );
    for (const t of INVITE_TARGETS) expect(inviteHref(t.id, url, `Join me ${url}`)).toMatch(/^(https:|sms:|mailto:)/);
  });
  it("puts the link in the message once", () => {
    expect(decodeURIComponent(inviteHref("whatsapp", url, `Join me ${url}`)).match(/ABC123/g)).toHaveLength(1);
    expect(decodeURIComponent(inviteHref("whatsapp", url, "Join me"))).toContain(url);
    expect(inviteHref("snapchat", url, "x")).toContain(encodeURIComponent(url));
  });
});
