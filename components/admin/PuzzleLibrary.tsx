"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ALL_GAMES, GAME_BY_ID } from "@/lib/catalog";
import { dayMonth, todayIso } from "@/lib/admin/dates";
import { PUZZLE_SORT } from "@/lib/admin/sorting";
import { errorText, useAdminQuery, type AdminPage } from "@/lib/client/admin";
import { adminCopy } from "@/lib/copy/admin";
import { Pagination, usePager } from "./Pagination";
import { SortHead, type HeadCol } from "./SortHeader";
import { useUrlFilters, useUrlSort } from "./useUrlFilters";
import { PUZZLE_STATES, PageHead, StateGuide, StatePill, When, puzzleState } from "./content-ui";
import { Empty, Field, Notice, RowsSkeleton, Swatch } from "./ui";
import { Select } from "@/components/ui/Select";

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

const C = adminCopy.puzzles;
const { common } = adminCopy;
const STATUSES = ["in_review", "scheduled", "approved", "draft", "retired"];
const SOURCES = ["generated", "human"];
const FILTERS = { game: "", status: "", source: "" } as const;
// Every game in code, retired ones too (marked), so their old puzzles stay findable.
const ALLOWED = { game: ALL_GAMES.map((g) => g.id), status: STATUSES, source: SOURCES };
type SortKey = (typeof PUZZLE_SORT.keys)[number];
const COLS: HeadCol<SortKey>[] = [
  { label: C.head[0], sort: "game" },
  { label: C.head[1], sort: "grade" },
  { label: C.head[2], sort: "status" },
  { label: C.head[3] },
  { label: C.head[4], sort: "checked_at" },
  { label: C.head[5], sort: "source" },
  { label: C.head[6], sort: "created_at" },
];

/** The puzzle list: every stored puzzle with its status in words, when players get it and when it was checked. */
export function PuzzleLibrary() {
  const [{ game, status, source }, setFilters] = useUrlFilters(FILTERS, ALLOWED);
  const pager = usePager();
  const sort = useUrlSort(PUZZLE_SORT);
  // The detail page's Back link returns to this filtered page.
  const here = useSearchParams().toString();
  const detail = (id: string) => `/admin/puzzles/${id}${here ? `?${new URLSearchParams({ list: here })}` : ""}`;
  const qs = new URLSearchParams({ ...(game && { game }), ...(status && { status }), ...(source && { source }) });
  const q = useAdminQuery<AdminPage<Row>>(
    ["puzzles", qs.toString(), sort.query, pager.query],
    `/api/admin/puzzles?${qs}${qs.size ? "&" : ""}${sort.query}&${pager.query}`,
    { keepPrevious: true },
  );
  const today = todayIso();
  return (
    <div className="flex flex-col gap-4 px-4 py-5 md:px-6">
      <PageHead title={C.title} purpose={C.intro}>
        {q.data && <span className="num text-muted text-[14px]">{C.total(q.data.total.toLocaleString("en-US"))}</span>}
      </PageHead>
      <StateGuide states={PUZZLE_STATES} />
      <div className="flex flex-wrap items-end gap-2">
        <Field label={common.game} htmlFor="pz-game">
          <Select
            id="pz-game"
            value={game}
            onValueChange={(v) => setFilters({ game: v })}
            options={[
              { value: "", label: common.allGames },
              ...ALL_GAMES.map((g) => ({ value: g.id, label: g.retired ? adminCopy.retired.option(g.name) : g.name })),
            ]}
            className="h-11 w-48"
          />
        </Field>
        <Field label={C.status} htmlFor="pz-status">
          <Select
            id="pz-status"
            value={status}
            onValueChange={(v) => setFilters({ status: v })}
            options={[{ value: "", label: C.anyStatus }, ...STATUSES.map((s) => ({ value: s, label: puzzleState(s).label }))]}
            className="h-11 w-44"
          />
        </Field>
        <Field label={C.source} htmlFor="pz-source">
          <Select
            id="pz-source"
            value={source}
            onValueChange={(v) => setFilters({ source: v })}
            options={[{ value: "", label: C.anySource }, ...SOURCES.map((s) => ({ value: s, label: C.sources[s] ?? s }))]}
            className="h-11 w-44"
          />
        </Field>
      </div>
      <div className="bg-surface max-h-[75dvh] overflow-auto rounded-[16px] [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-[1]">
        {q.isPending ? (
          <RowsSkeleton />
        ) : q.error ? (
          <div className="p-3">
            <Notice tone="danger" icon="warning">
              {C.loadError} {errorText(q.error)}
            </Notice>
          </div>
        ) : !q.data.rows.length ? (
          <Empty icon="magnifying-glass">{C.empty}</Empty>
        ) : (
          <table className="w-full min-w-[860px] border-collapse text-[14px]">
            <SortHead cols={COLS} sort={sort} />
            <tbody>
              {q.data.rows.map((r) => {
                const name = GAME_BY_ID[r.game_id]?.name ?? r.game_id;
                const level = C.difficulty(r.difficulty, (r.grade / 10).toFixed(1));
                const live = r.dailies.some((d) => d.date === today);
                return (
                  <tr key={r.id} className="border-line hover:bg-surface-raised/50 border-t">
                    <td className="px-3 py-2">
                      <Link
                        href={detail(r.id)}
                        aria-label={C.openAria(name, level)}
                        className="text-text flex min-h-11 items-center gap-2 font-semibold hover:underline"
                      >
                        <Swatch world={GAME_BY_ID[r.game_id]?.world ?? "logic"} />
                        {name}
                      </Link>
                    </td>
                    <td className="num px-3 py-2 text-[13px] whitespace-nowrap">{level}</td>
                    <td className="px-3 py-2">
                      <StatePill s={puzzleState(r.status, live)} />
                    </td>
                    <td className="num text-muted px-3 py-2 text-[13px]">
                      {r.dailies.map((d) => dayMonth(d.date)).join(", ") || C.noDaily}
                    </td>
                    <td className="num text-muted px-3 py-2 text-[13px] whitespace-nowrap">
                      {r.checked_at ? <When iso={r.checked_at} /> : C.neverChecked}
                    </td>
                    <td className="text-muted px-3 py-2 text-[13px]">{C.sources[r.source] ?? r.source}</td>
                    <td className="num text-muted px-3 py-2 text-[13px] whitespace-nowrap">
                      <When iso={r.created_at} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {q.data && <Pagination pager={pager} total={q.data.total} />}
    </div>
  );
}
