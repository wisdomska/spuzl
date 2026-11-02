import { describe, expect, it } from "vitest";
import { adminSession } from "./admin-helpers";

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

async function mailCode(email: string, since: number): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const r = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}&limit=5`);
    const { messages = [] } = (await r.json()) as { messages?: { ID: string; Created: string }[] };
    const fresh = messages.find((m) => Date.parse(m.Created) >= since - 2000);
    if (fresh) {
      const m = (await (await fetch(`${MAILPIT}/api/v1/message/${fresh.ID}`)).json()) as { Text?: string; HTML?: string };
      const code = `${m.Text ?? ""} ${m.HTML ?? ""}`.match(/\b(\d{6})\b/)?.[1];
      if (code) return code;
    }
    await new Promise((res) => setTimeout(res, 500));
  }
  throw new Error(`no code emailed to ${email}`);
}

describe("admin second step by email code", () => {
  it("password alone is refused; a wrong code fails; the emailed code opens the console for that session", async () => {
    const acct = await adminSession("analyst");
    expect((await acct.aal1("/api/admin/me")).status).toBe(403);

    const since = Date.now();
    expect((await acct.aal1("/api/admin/login/code", { method: "POST" })).status).toBe(200);
    const wrong = await acct.aal1("/api/admin/login/verify", { method: "POST", json: { code: "000000" } });
    expect([wrong.status, wrong.data.error]).toEqual([400, "bad_code"]);

    const code = await mailCode(acct.email, since);
    expect((await acct.aal1("/api/admin/login/verify", { method: "POST", json: { code } })).status).toBe(200);
    expect((await acct.aal1("/api/admin/me")).status).toBe(200);
  });

  it("non-admins cannot ask for a code", async () => {
    const user = await adminSession(null);
    const r = await user.aal1("/api/admin/login/code", { method: "POST" });
    expect([r.status, r.data.error]).toEqual([403, "not_admin"]);
  });
});
