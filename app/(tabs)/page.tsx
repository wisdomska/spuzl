import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";
import { HomeScreen } from "@/components/home/HomeScreen";
import { requirePlayerPage } from "@/lib/auth/gate";
import { loadMe, loadToday } from "@/lib/server/player-data";
import { loadDailyFive } from "@/lib/daily-five/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Home. The player's profile and today's Dailies load here on the server and seed React Query, so the
 * first paint is the real Grid instead of a skeleton waiting on two client round trips.
 */
export default async function Home() {
  const ctx = await requirePlayerPage();
  if (!ctx) return <HomeScreen />;
  const qc = new QueryClient();
  // The Daily Five card (R2-05) is seeded too, so it paints with the map; if it fails, the card loads on the client.
  const [me, today, five] = await Promise.all([
    loadMe(ctx.user, ctx.player),
    loadToday(ctx.user),
    loadDailyFive(ctx.player.id, supabaseAdmin()).catch(() => null),
  ]);
  qc.setQueryData(["me"], me);
  qc.setQueryData(["today"], today);
  if (five) qc.setQueryData(["daily-five"], five);
  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <HomeScreen />
    </HydrationBoundary>
  );
}
