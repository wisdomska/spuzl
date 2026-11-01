import type { Metadata } from "next";
import { AdminLogin } from "@/components/admin/AdminLogin";

export const metadata: Metadata = { title: "Sign in" };

/** Admin sign-in: email and password, then TOTP (enrolled on first sign-in). Separate from the player guest flow. */
export default async function Page({ searchParams }: PageProps<"/admin/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/admin/") ? sp.next : "/admin";
  return <AdminLogin next={next} reason={typeof sp.e === "string" ? sp.e : null} />;
}
