// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider, dehydrate, useQuery } from "@tanstack/react-query";
import { HydrateNow } from "@/components/shell/HydrateNow";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const KEY = ["game-settings"];
const SEED_AT = 1_000;

/** What the server drew with: the seed (SeedQueries), dehydrated. */
function seed(games: number) {
  const qc = new QueryClient();
  qc.setQueryData(KEY, { games }, { updatedAt: SEED_AT });
  return dehydrate(qc);
}

function Games({ fetchGames }: { fetchGames: () => Promise<{ games: number }> }) {
  const q = useQuery({ queryKey: KEY, queryFn: fetchGames, staleTime: Infinity });
  return <p>{q.data ? `${q.data.games} games` : "loading"}</p>;
}

const app = (qc: QueryClient, state: ReturnType<typeof seed>, fetchGames: () => Promise<{ games: number }>) => (
  <QueryClientProvider client={qc}>
    <HydrateNow state={state}>
      <Games fetchGames={fetchGames} />
    </HydrateNow>
  </QueryClientProvider>
);

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
});

describe("HydrateNow", () => {
  it("hydrates with the server's seed even when the browser already holds a newer copy, then refetches it", async () => {
    const state = seed(30);
    const fetchGames = vi.fn(async () => ({ games: 29 }));
    const el = document.createElement("div");
    el.innerHTML = renderToString(app(new QueryClient(), state, fetchGames));
    document.body.append(el);
    expect(el.textContent).toBe("30 games");

    // An admin turned a game off after the server drew the page; something outside the route fetched that already.
    const qc = new QueryClient();
    qc.setQueryData(KEY, { games: 29 }, { updatedAt: SEED_AT + 5_000 });
    const onRecoverableError = vi.fn();
    await act(async () => {
      root = hydrateRoot(el, app(qc, state, fetchGames), { onRecoverableError });
    });
    expect(onRecoverableError).not.toHaveBeenCalled(); // hydrated as the server drew it: no #418
    expect(fetchGames).toHaveBeenCalledTimes(1); // the newer copy is fetched again once the page is up
    await act(() => vi.waitFor(() => expect(el.textContent).toBe("29 games")));
  });

  it("leaves the cache alone when the browser's copy matches the seed", async () => {
    const state = seed(30);
    const fetchGames = vi.fn(async () => ({ games: 30 }));
    const el = document.createElement("div");
    el.innerHTML = renderToString(app(new QueryClient(), state, fetchGames));
    document.body.append(el);
    const qc = new QueryClient();
    qc.setQueryData(KEY, { games: 30 }, { updatedAt: SEED_AT + 5_000 });
    const onRecoverableError = vi.fn();
    await act(async () => {
      root = hydrateRoot(el, app(qc, state, fetchGames), { onRecoverableError });
    });
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(fetchGames).not.toHaveBeenCalled();
    expect(qc.getQueryState(KEY)?.dataUpdatedAt).toBe(SEED_AT + 5_000);
  });

  it("on a client-side navigation (no hydration) keeps the newer copy", async () => {
    const state = seed(30);
    const fetchGames = vi.fn(async () => ({ games: 29 }));
    const qc = new QueryClient();
    qc.setQueryData(KEY, { games: 29 }, { updatedAt: SEED_AT + 5_000 });
    const el = document.createElement("div");
    document.body.append(el);
    await act(async () => {
      root = createRoot(el);
      root.render(app(qc, state, fetchGames));
    });
    expect(el.textContent).toBe("29 games");
    expect(fetchGames).not.toHaveBeenCalled();
  });

  it("puts an older copy's newer seed in during the first render (the server draws with the seed too)", () => {
    const qc = new QueryClient();
    qc.setQueryData(KEY, { games: 12 }, { updatedAt: SEED_AT - 500 });
    expect(renderToString(app(qc, seed(30), async () => ({ games: 12 })))).toContain("30 games");
  });
});
