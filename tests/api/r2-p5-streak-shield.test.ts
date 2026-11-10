import { describe, expect, it } from "vitest";
import { admin, BASE, guest, uniq } from "./helpers";
import { setSetting } from "./setup";

/**
 * R2-P5 streak shield: a guest who links an email (or Google) gets one Streak Freeze on the sync after linking,
 * once per account (ledger ref), audited; never while still a guest; none past the 2-Freeze cap.
 */
type G = Awaited<ReturnType<typeof guest>>;

/** Links an email to the guest (as confirming the emailed code does), then calls sync with the refreshed token. */
async function linkAndSync(g: G) {
  const { error } = await admin().auth.admin.updateUserById(g.userId, { email: `${uniq("shield")}@example.test`, email_confirm: true });
  if (error) throw error;
  const { data, error: e2 } = await g.sb.auth.refreshSession();
  if (e2) throw e2;
  const token = data.session!.access_token;
  const sync = async () => {
    const res = await fetch(`${BASE}/api/v1/account/sync`, { method: "POST", headers: { authorization: `Bearer ${token}` } });
    return { status: res.status, data: await res.json() };
  };
  return { sync };
}

const freezes = async (id: string) =>
  ((await admin().from("streaks").select("freezes_held").eq("player_id", id).maybeSingle()).data?.freezes_held as number | undefined) ?? 0;

describe("api: sign-in streak shield", () => {
  it("gives a guest who links an email one Streak Freeze, once, audited and visible to the admin", async () => {
    const g = await guest(uniq("shield_"));
    expect(await freezes(g.userId)).toBe(0);
    const { sync } = await linkAndSync(g);
    const first = await sync();
    expect(first.status).toBe(200);
    expect(first.data).toMatchObject({ guest: false, shield: { status: "granted", freezes: 1 } });
    expect(await freezes(g.userId)).toBe(1);

    const { data: ledger } = await admin()
      .from("sparks_ledger")
      .select("source, ref_id, amount")
      .eq("player_id", g.userId)
      .eq("source", "shield");
    expect(ledger).toEqual([{ source: "shield", ref_id: "signin", amount: 0 }]);
    const { data: audit } = await admin()
      .from("audit_log")
      .select("action, detail")
      .eq("target", `player:${g.userId}`)
      .eq("action", "player.shield");
    expect(audit).toHaveLength(1);
    expect(audit![0].detail).toMatchObject({ held: 1, granted: true });

    // A second sync, and even a row flipped back to guest, never pays twice.
    expect((await sync()).data.shield).toBeNull();
    await admin().from("players").update({ is_guest: true }).eq("id", g.userId);
    expect((await sync()).data.shield).toMatchObject({ status: "already" });
    expect(await freezes(g.userId)).toBe(1);
  });

  it("gives nothing while the account is still a guest", async () => {
    const g = await guest(uniq("sg_"));
    const r = await g.api("/api/v1/account/sync", { method: "POST" });
    expect(r.data).toMatchObject({ guest: true, shield: null });
    expect(await freezes(g.userId)).toBe(0);
  });

  it("keeps the 2-Freeze cap: a full guest is told so and keeps 2", async () => {
    const g = await guest(uniq("sf_"));
    await admin().from("streaks").upsert({ player_id: g.userId, freezes_held: 2 }, { onConflict: "player_id" });
    const { sync } = await linkAndSync(g);
    expect((await sync()).data.shield).toMatchObject({ status: "full", freezes: 2 });
    expect(await freezes(g.userId)).toBe(2);
  });

  it("gives nothing while features.streakShield is off", async () => {
    const g = await guest(uniq("so_"));
    await setSetting("features.streakShield", false);
    try {
      const { sync } = await linkAndSync(g);
      expect((await sync()).data).toMatchObject({ guest: false, shield: null });
      expect(await freezes(g.userId)).toBe(0);
    } finally {
      await setSetting("features.streakShield", true);
    }
  });
});
