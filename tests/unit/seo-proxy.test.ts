import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { hasSessionCookie, isDocumentRequest } from "@/lib/auth/session-cookie";

/**
 * SEO: "/" serves the landing page (rewrite to /about) to every visitor without a session cookie, whatever Accept
 * header their client sends (search and AI crawlers often send *\/* or none), while players and in-app RSC requests
 * keep Home. The IndexNow key file is served only for the configured key.
 */
const KEY = "0123456789abcdef0123456789abcdef";

describe("visitor landing page at /", () => {
  beforeEach(() => {
    // A backend address that answers nothing: with no session cookie the client never needs it.
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:9");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  });
  afterEach(() => vi.unstubAllEnvs());

  const go = (headers: Record<string, string> = {}, path = "/", method = "GET") =>
    proxy(new NextRequest(`http://localhost${path}`, { headers, method }));
  const rewrite = (r: Response) => r.headers.get("x-middleware-rewrite");

  it("rewrites a visitor's page load to the landing page for browsers, crawlers and bare clients", async () => {
    for (const accept of ["text/html,application/xhtml+xml", "*/*", ""]) {
      const r = await go(accept ? { accept, "user-agent": "Googlebot/2.1" } : {});
      expect(rewrite(r), accept || "no accept").toBe("http://localhost/about");
    }
    expect(rewrite(await go({}, "/", "HEAD"))).toBe("http://localhost/about");
  });

  it("keeps Home for players and for in-app RSC requests and prefetches", async () => {
    expect(rewrite(await go({ cookie: "sb-abc-auth-token=x" }))).toBeNull();
    expect(rewrite(await go({ cookie: "sb-abc-auth-token.0=x" }))).toBeNull();
    expect(rewrite(await go({ rsc: "1" }))).toBeNull();
    expect(rewrite(await go({ "next-router-prefetch": "1", rsc: "1" }))).toBeNull();
    expect(rewrite(await go({}, "/?_rsc=abc"))).toBeNull();
    expect(rewrite(await go({}, "/library"))).toBeNull();
  });
});

describe("IndexNow key file", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("answers /<key>.txt with the key when INDEXNOW_KEY is set, and passes through otherwise", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("INDEXNOW_KEY", KEY);
    const r = await proxy(new NextRequest(`http://localhost/${KEY}.txt`));
    expect(r.status).toBe(200);
    expect(await r.text()).toBe(KEY);
    const other = await proxy(new NextRequest("http://localhost/abcdefgh12345678.txt"));
    expect(other.headers.get("x-middleware-next")).toBe("1");
    vi.stubEnv("INDEXNOW_KEY", "");
    const unset = await proxy(new NextRequest(`http://localhost/${KEY}.txt`));
    expect(unset.headers.get("x-middleware-next")).toBe("1");
  });
});

describe("request helpers", () => {
  it("reads the session from cookie names only", () => {
    expect(hasSessionCookie({ getAll: () => [{ name: "sb-xyz-auth-token" }] })).toBe(true);
    expect(hasSessionCookie({ getAll: () => [{ name: "spuzl-admin" }, { name: "theme" }] })).toBe(false);
  });

  it("counts GET and HEAD document loads, not RSC requests or form posts", () => {
    const req = (method: string, headers: Record<string, string> = {}, q = "") =>
      new NextRequest(`http://localhost/${q}`, { method, headers });
    expect(isDocumentRequest(req("GET"))).toBe(true);
    expect(isDocumentRequest(req("HEAD"))).toBe(true);
    expect(isDocumentRequest(req("POST"))).toBe(false);
    expect(isDocumentRequest(req("GET", { rsc: "1" }))).toBe(false);
    expect(isDocumentRequest(req("GET", {}, "?_rsc=1"))).toBe(false);
  });
});
