"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useCup } from "@/lib/client/social";
import { CupRows } from "@/components/meta/CupBoard";
import { useNow } from "@/components/meta/useNow";
import { Wordmark } from "@/components/brand/Wordmark";
import { Spuz } from "@/components/brand/Spuz";
import { Icon } from "@/components/ui/Icon";
import { GAME_BY_ID, WORLD_BY_ID } from "@/lib/catalog";
import { formatLeft } from "@/lib/leagues";

/**
 * T2 Class board, TV mode: a fixed 1280 × 720 stage scaled to fit the projector, readable at 3 m
 * (text 26 px and up, 80 px rows). Refreshes every 30 s. Escape or the corner button goes back.
 */
export default function CupTvPage({ params }: PageProps<"/school-cup/[id]/tv">) {
  const { id } = use(params);
  const q = useCup(id, 30_000);
  const [scale, setScale] = useState(1);
  const now = useNow(30_000);
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 1280, window.innerHeight / 720));
    const raf = requestAnimationFrame(fit);
    window.addEventListener("resize", fit);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", fit);
    };
  }, []);
  const c = q.data;
  const left = c ? (c.startsInMs > 0 ? c.startsInMs : c.endsInMs) + q.dataUpdatedAt - now : 0;

  return (
    <main aria-label="Class board, TV mode" className="bg-bg fixed inset-0 overflow-hidden">
      <div
        className="tv-stage bg-bg absolute top-1/2 left-1/2 grid grid-cols-[480px_1fr] overflow-hidden"
        style={{ transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: "center" }}
      >
        <div className="bg-surface flex flex-col gap-4 p-11">
          <div className="flex items-end gap-3.5">
            <Wordmark size={40} />
            <span className="font-display text-muted text-[22px] font-bold">School Cup</span>
          </div>
          <h1 className="font-display mt-5 text-[52px] leading-none font-black tracking-[-0.03em]">{c?.className ?? " "}</h1>
          <p className="text-muted text-[28px] font-semibold">
            Week challenge · {c?.games.length ?? 0} {c?.games.length === 1 ? "game" : "games"}
          </p>
          <div className="mt-2.5 flex gap-3">
            {c?.games.map((g) => {
              const meta = GAME_BY_ID[g];
              return meta ? (
                <span
                  key={g}
                  className="flex size-[72px] items-center justify-center rounded-[22px]"
                  style={{ background: WORLD_BY_ID[meta.world].color, color: "#0E0F1A" }}
                  title={meta.name}
                >
                  <Icon name={meta.icon} size={36} label={meta.name} />
                </span>
              ) : null;
            })}
          </div>
          <div className="mt-auto flex items-end gap-2.5">
            <div className="flex flex-col gap-1">
              <span className="text-muted text-[26px] font-semibold">
                {c && c.startsInMs > 0 ? "Starts in" : c && left > 0 ? "Ends in" : "Final board"}
              </span>
              <span className="num text-[64px] leading-none font-semibold">{c && left > 0 ? formatLeft(left) : ""}</span>
            </div>
            <div className="ml-auto">
              <Spuz mood="party" size={150} decorative />
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2.5 px-10 py-9">
          {c && c.rows.length > 0 ? (
            <CupRows rows={c.rows} games={c.games.length} tv limit={7} />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-4">
              <Spuz mood="wave" size={160} decorative />
              <p className="font-display text-[34px] font-black">
                {q.isError ? "Board didn't load" : c ? "Join with the class code" : " "}
              </p>
              {c?.code && <p className="font-display text-accent text-[64px] font-black tracking-[0.12em]">{c.code}</p>}
            </div>
          )}
        </div>
      </div>
      <Link
        href={`/school-cup/${id}`}
        aria-label="Leave TV mode"
        className="bg-surface-raised text-muted absolute top-3 right-3 flex size-11 items-center justify-center rounded-[14px] opacity-40 hover:opacity-100 focus-visible:opacity-100"
      >
        <Icon name="x" size={20} />
      </Link>
    </main>
  );
}
