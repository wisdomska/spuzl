import { beforeAll, describe, expect, it } from "vitest";
import { adminSession, type AdminSession, type Role } from "./admin-helpers";

/**
 * Admin overhaul (helper A): the sidebar counts on /api/admin/me are things waiting on someone, and the Overview's
 * "needs your attention" counts, each null for a role that cannot open that page. Needs `supabase start` and the dev
 * server (API_BASE).
 * Run: API_BASE=http://localhost:3203 pnpm vitest run -c vitest.api.config.mts tests/api/admin-overhaul-home.test.ts
 */
const S = {} as Record<Role, AdminSession>;
beforeAll(async () => {
  for (const r of ["owner", "content_editor", "moderator", "analyst"] as Role[]) S[r] = await adminSession(r);
});

describe("admin overhaul: home counts", () => {
  it("sends sidebar counts only for pages the role can open", async () => {
    const owner = (await S.owner.aal2("/api/admin/me")).data.counts;
    expect(owner).toMatchObject({
      puzzles: expect.any(Number),
      moderation: expect.any(Number),
      review: expect.any(Number),
      content: expect.any(Number),
      feedback: expect.any(Number),
    });
    const analyst = (await S.analyst.aal2("/api/admin/me")).data.counts;
    expect(analyst.moderation).toBeNull();
    expect(analyst.content).toBeNull();
    expect(typeof analyst.review).toBe("number");
    const mod = (await S.moderator.aal2("/api/admin/me")).data.counts;
    expect(typeof mod.moderation).toBe("number");
    expect(mod.content).toBeNull();
  });

  it("adds puzzles and content to review and join requests to the Overview, by role", async () => {
    const owner = (await S.owner.aal2("/api/admin/overview")).data.attention;
    expect(owner).toEqual({
      puzzlesToReview: expect.any(Number),
      contentToReview: expect.any(Number),
      joinRequestsToday: expect.any(Number),
      joinRequestsWaiting: expect.any(Number),
    });
    const analyst = (await S.analyst.aal2("/api/admin/overview")).data.attention;
    expect(analyst.contentToReview).toBeNull();
    expect(analyst.joinRequestsToday).toBeNull();
    expect(typeof analyst.puzzlesToReview).toBe("number");
    const mod = (await S.moderator.aal2("/api/admin/overview")).data.attention;
    expect(typeof mod.joinRequestsToday).toBe("number");
    // content editors still cannot open the Overview at all
    expect((await S.content_editor.aal2("/api/admin/overview")).data.error).toBe("forbidden");
  });
});
