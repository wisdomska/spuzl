import type { Metadata } from "next";
import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";
import { DailyFiveScreen } from "@/components/daily-five/DailyFiveScreen";
import { requirePlayerPage } from "@/lib/auth/gate";
import { loadMe } from "@/lib/server/player-data";
import { loadDailyFive } from "@/lib/daily-five/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { dailyFiveCopy as T } from "@/lib/copy/daily-five";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: T.pageTitle, description: T.pageIntro };

/**
 * /daily: today's Daily Five (R2-05), the deep link every share grid carries. Visitors without a session or a
 * profile go through the intro and onboarding (`?return=daily`) and land back here. The player and the five load
 * on the server, so the first paint is the real list.
 */
export default async function DailyFive() {
  const ctx = await requirePlayerPage({ back: "daily" });
  if (!ctx) return <DailyFiveScreen />;
  const qc = new QueryClient();
  const [me, five] = await Promise.all([loadMe(ctx.user, ctx.player), loadDailyFive(ctx.player.id, supabaseAdmin()).catch(() => null)]);
  qc.setQueryData(["me"], me);
  if (five) qc.setQueryData(["daily-five"], five);
  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <DailyFiveScreen />
    </HydrationBoundary>
  );
}
