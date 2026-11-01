import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getGameSettings } from "@/lib/game-settings/server";

export const metadata: Metadata = { title: "Leaderboards" };

/** Daily-only screen: while Dailies are off (admin "features.dailies") it isn't reachable. */
export default async function Layout({ children }: { children: React.ReactNode }) {
  if (!(await getGameSettings())["features.dailies"]) redirect("/");
  return children;
}
