import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";
import { HomeScreen } from "@/components/home/HomeScreen";
import { requirePlayerPage } from "@/lib/auth/gate";
import { loadMe, loadToday } from "@/lib/server/player-data";

export const dynamic = "force-dynamic";

/**
 * Home. The player's profile and today's Dailies load here on the server and seed React Query, so the
 * first paint is the real Grid instead of a skeleton waiting on two client round trips.
 */
export default async function Home() {
  const ctx = await requirePlayerPage();
  if (!ctx) return <HomeScreen />;
  const qc = new QueryClient();
  const [me, today] = await Promise.all([loadMe(ctx.user, ctx.player), loadToday(ctx.user)]);
  qc.setQueryData(["me"], me);
  qc.setQueryData(["today"], today);
  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <HomeScreen />
    </HydrationBoundary>
  );
}
