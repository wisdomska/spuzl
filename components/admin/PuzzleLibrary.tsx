"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { GAMES, GAME_BY_ID } from "@/lib/catalog";
import { dayMonth } from "@/lib/admin/dates";
import { errorText, useAdminQuery, type AdminPage } from "@/lib/client/admin";
import { Pagination, usePager } from "./Pagination";
import { useUrlFilters } from "./useUrlFilters";
import { Empty, Notice, PageTitle, Pill, RowsSkeleton, Swatch, inputCls } from "./ui";

interface Row {
  id: string;
  game_id: string;
  seed: string;
  difficulty: string;
  grade: number;
  source: string;
  status: string;
  created_at: string;
  checked_at: string | null;
  dailies: { date: string }[];
}

const STATUSES = ["in_review", "scheduled", "approved", "draft", "retired"];
const FILTERS = { game: "", status: "" } as const;
const ALLOWED = { game: GAMES.map((g) => g.id), status: STATUSES };

const STATUS_TONE: Record<string, "ok" | "warn" | "neutral"> = {
  scheduled: "ok",
  approved: "ok",
  in_review: "warn",
  draft: "warn",
  retired: "neutral",
};

/** The puzzle library: every stored puzzle with its status and Daily dates. */
export function PuzzleLibrary() {
  const [{ game, status }, setFilters] = useUrlFilters(FILTERS, ALLOWED);
  const pager = usePager();
  // The detail page's Back link returns to this filtered page.
  const here = useSearchParams().toString();
  const detail = (id: string) => `/admin/puzzles/${id}${here ? `?${new URLSearchParams({ list: here })}` : ""}`;
  const qs = new URLSearchParams({ ...(game && { game }), ...(status && { status }) });
  const q = useAdminQuery<AdminPage<Row>>(
    ["puzzles", game, status, pager.query],
    `/api/admin/puzzles?${qs}${qs.size ? "&" : ""}${pager.query}`,
    { keepPrevious: true },
  );
  return (
    <div className="flex flex-col gap-3.5 px-6 py-5">
      <PageTitle
        title="Puzzles"
        aside={
          <>
            <select aria-label="Game" value={game} onChange={(e) => setFilters({ game: e.target.value })} className={`${inputCls} w-44`}>
              <option value="">All games</option>
              {GAMES.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Status"
              value={status}
              onChange={(e) => setFilters({ status: e.target.value })}
              className={`${inputCls} w-40`}
            >
              <option value="">Any status</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>
          </>
        }
      >
        {q.data && <span className="num text-muted text-[14px]">{q.data.total.toLocaleString("en-US")} total</span>}
      </PageTitle>
      <div className="bg-surface overflow-x-auto rounded-[12px]">
        {q.isPending ? (
          <RowsSkeleton />
        ) : q.error ? (
          <div className="p-3">
            <Notice tone="danger" icon="warning">
              {errorText(q.error)}
            </Notice>
          </div>
        ) : !q.data.rows.length ? (
          <Empty>No puzzles match.</Empty>
        ) : (
          <table className="w-full min-w-[760px] border-collapse text-[14px]">
            <thead>
              <tr className="bg-surface-raised num text-muted text-left text-[12px]">
                {["Game", "Difficulty", "Grade", "Status", "Source", "Daily", "Checked"].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2.5 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {q.data.rows.map((r) => (
                <tr key={r.id} className="border-line hover:bg-surface-raised/50 border-t">
                  <td className="px-3 py-2">
                    <Link href={detail(r.id)} className="text-text flex items-center gap-2 font-semibold hover:underline">
                      <Swatch world={GAME_BY_ID[r.game_id]?.world ?? "logic"} />
                      {GAME_BY_ID[r.game_id]?.name ?? r.game_id}
                    </Link>
                  </td>
                  <td className="num text-muted px-3 py-2 text-[13px]">{r.difficulty}</td>
                  <td className="num px-3 py-2 text-[13px]">{(r.grade / 10).toFixed(1)}</td>
                  <td className="px-3 py-2">
                    <Pill tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status.replace("_", " ")}</Pill>
                  </td>
                  <td className="text-muted px-3 py-2 text-[13px]">{r.source}</td>
                  <td className="num text-muted px-3 py-2 text-[13px]">{r.dailies.map((d) => dayMonth(d.date)).join(", ") || "none"}</td>
                  <td className="num text-muted px-3 py-2 text-[13px]">{r.checked_at ? r.checked_at.slice(0, 10) : "never"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {q.data && <Pagination pager={pager} total={q.data.total} />}
    </div>
  );
}
