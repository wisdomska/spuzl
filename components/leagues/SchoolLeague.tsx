"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Icon } from "@/components/ui/Icon";
import { api, HttpError } from "@/lib/client/api";
import { useGameSettings } from "@/lib/game-settings/client";
import { leaguesCopy } from "@/lib/copy/leagues";
import { track } from "@/lib/analytics/track";
import type { SchoolKind, SchoolLeagueRow } from "@/lib/schools";

const T = leaguesCopy.school;

interface League {
  week: string;
  metric: string;
  rows: SchoolLeagueRow[];
  mine: { id: string; name: string; kind: SchoolKind; rank: number | null; changeAt: number | null } | null;
  canSearch: boolean;
}

interface SchoolHit {
  id: string;
  name: string;
  kind: SchoolKind;
  city: string | null;
}

/**
 * Leagues tab (R2-P5, admin "features.schoolLeagues"): the weekly school-vs-school table (school names and
 * averages only, never a player), the player's school and its rank, and a way in: search for players 16 and over,
 * the teacher's class code for under-16s (the server refuses them a search either way).
 */
export function SchoolLeague() {
  const on = useGameSettings()["features.schoolLeagues"];
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["school-league"], queryFn: () => api<League>("/api/v1/schools/league"), enabled: on, staleTime: 60_000 });
  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<SchoolHit[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canSearch = !!q.data?.canSearch && !q.data.mine;

  useEffect(() => {
    if (!canSearch || term.trim().length < 2) return;
    const t = window.setTimeout(() => {
      api<{ rows: SchoolHit[] }>(`/api/v1/schools?q=${encodeURIComponent(term.trim())}`)
        .then((r) => setHits(r.rows))
        .catch(() => setHits([]));
    }, 300);
    return () => window.clearTimeout(t);
  }, [term, canSearch]);

  if (!on || !q.data) return null;
  const d = q.data;
  const join = async (s: SchoolHit) => {
    setBusy(true);
    try {
      await api("/api/v1/schools/join", { json: { schoolId: s.id } });
      track("school_join", { via: "search", kind: s.kind });
      setMsg(T.joined(s.name));
      setTerm("");
      setHits(null);
      await qc.invalidateQueries({ queryKey: ["school-league"] });
    } catch (e) {
      setMsg(e instanceof HttpError && e.message !== e.code ? e.message : T.failed);
    } finally {
      setBusy(false);
    }
  };
  const leave = async () => {
    setBusy(true);
    try {
      await api("/api/v1/schools/join", { method: "DELETE" });
      setMsg(null);
      await qc.invalidateQueries({ queryKey: ["school-league"] });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-labelledby="school-league-title"
      className="bg-surface flex flex-col gap-3 rounded-[20px] p-4"
      data-testid="school-league"
    >
      <div className="flex items-start gap-3">
        <span className="bg-surface-raised text-accent flex size-11 shrink-0 items-center justify-center rounded-[14px]">
          <Icon name="graduation-cap" size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="school-league-title" className="font-display text-[18px] font-black">
            {T.title}
          </h2>
          <p className="text-muted text-[14px] leading-snug">{T.intro(d.metric)}</p>
        </div>
      </div>

      {d.mine ? (
        <div className="bg-bg flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 rounded-[14px] px-3.5 py-2.5">
          <span className="min-w-0 flex-1 text-[15px] font-semibold">{T.yours(d.mine.name)}</span>
          <span className="num text-accent text-[15px] font-bold">{d.mine.rank ? T.rank(d.mine.rank) : ""}</span>
          {!d.mine.rank && <span className="text-muted w-full text-[13px]">{T.unranked}</span>}
          {d.canSearch && (
            <button
              type="button"
              onClick={() => void leave()}
              disabled={busy}
              className="press text-muted min-h-11 rounded-[12px] px-2 text-[14px] font-semibold"
            >
              {T.leave}
            </button>
          )}
        </div>
      ) : canSearch ? (
        <div className="flex flex-col gap-2">
          <label htmlFor="school-search" className="text-[15px] font-semibold">
            {T.pick}
          </label>
          <input
            id="school-search"
            type="search"
            autoComplete="off"
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              if (e.target.value.trim().length < 2) setHits(null);
            }}
            placeholder={T.searchPlaceholder}
            aria-label={T.searchLabel}
            className="bg-bg text-text h-12 rounded-[14px] px-3.5 text-[16px] shadow-[inset_0_0_0_1px_var(--line)]"
          />
          {hits && hits.length === 0 && <p className="text-muted text-[14px]">{T.noMatch}</p>}
          {hits && hits.length > 0 && (
            <ul className="flex flex-col gap-1.5" aria-label={T.pick}>
              {hits.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void join(s)}
                    aria-label={T.join(s.name)}
                    className="press bg-bg flex min-h-12 w-full items-center gap-3 rounded-[14px] px-3.5 text-left"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[15px] font-semibold">{s.name}</span>
                      {s.city && <span className="text-muted text-[13px]">{s.city}</span>}
                    </span>
                    <Icon name="plus" size={18} className="text-accent" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-muted text-[13px]">{T.changeLater}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-[15px]">{T.classCode}</p>
          <Link
            href="/school-cup"
            className="press bg-surface-raised flex min-h-11 items-center gap-2 self-start rounded-[14px] px-4 text-[15px] font-semibold"
          >
            <Icon name="key" size={18} className="text-accent" />
            {T.classCodeCta}
          </Link>
        </div>
      )}
      {msg && (
        <p role="status" className="text-[14px] font-semibold">
          {msg}
        </p>
      )}

      {d.rows.length === 0 ? (
        <p className="text-muted text-[14px]">{T.empty}</p>
      ) : (
        <ol aria-label={T.tableLabel(d.rows.length)} className="flex flex-col gap-[3px]">
          {d.rows.slice(0, 20).map((r) => (
            <li
              key={r.id}
              className={`flex min-h-11 items-center gap-3 rounded-[12px] px-3 ${d.mine?.id === r.id ? "bg-[color-mix(in_srgb,var(--accent)_14%,var(--bg))]" : "bg-bg"}`}
            >
              <span className="num w-7 text-[15px] font-bold">{r.rank}</span>
              <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{r.name}</span>
              <span className="num text-muted text-[13px]">{r.active}</span>
              <span className="num w-24 text-right text-[15px] font-semibold">{T.average(r.average, d.metric)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
