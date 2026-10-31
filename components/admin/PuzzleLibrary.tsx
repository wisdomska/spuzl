"use client";

import Link from "next/link";
import { useState } from "react";
import { GAMES, GAME_BY_ID } from "@/lib/catalog";
import { dayMonth } from "@/lib/admin/dates";
import { errorText, useAdminQuery } from "@/lib/client/admin";
import { Btn, Empty, Notice, PageTitle, Pill, RowsSkeleton, Swatch, inputCls } from "./ui";

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

const STATUS_TONE: Record<string, "ok" | "warn" | "neutral"> = { scheduled: "ok", approved: "ok", in_review: "warn", draft: "warn", retired: "neutral" };

/** The puzzle library: every stored puzzle with its status and Daily dates. */
export function PuzzleLibrary() {
  const [game, setGame] = useState("");
  const [status, setStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const qs = new URLSearchParams({ ...(game && { game }), ...(status && { status }), offset: String(offset) });
  const q = useAdminQuery<{ total: number; rows: Row[] }>(["puzzles", game, status, offset], `/api/admin/puzzles?${qs}`);
  return (
    <div className="flex flex-col gap-3.5 px-6 py-5">
      <PageTitle
        title="Puzzles"
        aside={
          <>
            <select aria-label="Game" value={game} onChange={(e) => (setGame(e.target.value), setOffset(0))} className={`${inputCls} w-44`}>
              <option value="">All games</option>
              {GAMES.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <select aria-label="Status" value={status} onChange={(e) => (setStatus(e.target.value), setOffset(0))} className={`${inputCls} w-40`}>
              <option value="">Any status</option>
              {["in_review", "scheduled", "approved", "draft", "retired"].map((s) => (
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
                    <Link href={`/admin/puzzles/${r.id}`} className="flex items-center gap-2 font-semibold text-text hover:underline">
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
      {q.data && q.data.total > 50 && (
        <div className="flex items-center gap-2">
          <Btn size="sm" icon="caret-left" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))}>
            Newer
          </Btn>
          <span className="num text-muted text-[13px]">
            {offset + 1} to {Math.min(offset + 50, q.data.total)}
          </span>
          <Btn size="sm" disabled={offset + 50 >= q.data.total} onClick={() => setOffset(offset + 50)}>
            Older
          </Btn>
        </div>
      )}
    </div>
  );
}
