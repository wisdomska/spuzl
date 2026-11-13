"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Modal, ModalActions } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { ALL_WORLDS, GAME_BY_ID } from "@/lib/catalog";
import { duration } from "@/lib/admin/people-format";
import {
  GAME_RESULTS,
  GAME_SORT,
  NO_GAME_FILTER,
  filterGames,
  sortGames,
  type GameFilter,
  type GameResult,
  type GameRow,
  type GameSortKey,
} from "@/lib/admin/player-games";
import { adminCopy } from "@/lib/copy/admin";
import { Paged } from "./Pagination";
import { SortHead, type HeadCol } from "./SortHeader";
import { When } from "./people-ui";
import { Btn, Empty, Pill, inputCls, type PillTone } from "./ui";
import { useLocalSort } from "./useLocalSort";

const C = adminCopy.players;
const G = C.games;
const td = "border-line border-t px-3 py-2 align-top";

const RESULT_TONE: Record<GameResult, PillTone> = {
  won: "ok",
  solved: "ok",
  lost: "danger",
  not_solved: "warn",
  draw: "neutral",
  left: "neutral",
  playing: "warn",
  waiting: "neutral",
  suspicious: "danger",
};

const nameOf = (id: string) => GAME_BY_ID[id]?.name ?? id;
const typeOf = (id: string) => GAME_BY_ID[id]?.world ?? "other";
const typeName = (t: string) => ALL_WORLDS.find((w) => w.id === t)?.name ?? G.otherType;

/**
 * A player's games in one table (owner, 13 Nov 2026): puzzles and board games together, newest first. Filter by
 * game type, then pick particular games of that type in a sheet; filter by result; sort by any column.
 */
export function PlayerGamesTable({ rows }: { rows: readonly GameRow[] }) {
  const [f, setF] = useState<GameFilter>(NO_GAME_FILTER);
  const [picking, setPicking] = useState(false);
  const sort = useLocalSort(GAME_SORT);

  const types = useMemo(() => {
    const n = new Map<string, number>();
    for (const r of rows) n.set(typeOf(r.game_id), (n.get(typeOf(r.game_id)) ?? 0) + 1);
    return [...n].sort((a, b) => typeName(a[0]).localeCompare(typeName(b[0])));
  }, [rows]);
  const results = useMemo(() => GAME_RESULTS.filter((r) => rows.some((x) => x.result === r)), [rows]);
  const shown = useMemo(
    () => sortGames(filterGames(rows, f, typeOf), sort as { sort: GameSortKey; dir: "asc" | "desc" }, nameOf, (id) => typeName(typeOf(id))),
    [rows, f, sort],
  );
  const filtered = f.type !== null || f.games !== null || f.result !== null;

  const cols: HeadCol<GameSortKey>[] = [
    { label: G.head.game, sort: "game" },
    { label: G.head.type, sort: "type" },
    { label: G.head.how },
    { label: G.head.against },
    { label: G.head.result, sort: "result" },
    { label: G.head.time, sort: "time", className: "text-right" },
    { label: G.head.started, sort: "started" },
  ];

  if (!rows.length) return <Empty icon="puzzle-piece">{C.noAttempts}</Empty>;
  return (
    <div className="flex flex-col gap-3" data-player-games>
      <div className="flex flex-wrap items-end gap-2" role="group" aria-label={G.filters}>
        <label className="flex flex-col gap-1 text-[12px] font-semibold">
          <span className="text-muted">{G.typeLabel}</span>
          <Select
            aria-label={G.typeLabel}
            value={f.type ?? ""}
            onValueChange={(v) => setF({ ...f, type: v || null, games: null })}
            options={[
              { value: "", label: G.allTypes(rows.length) },
              ...types.map(([t, n]) => ({ value: t, label: `${typeName(t)} (${n})` })),
            ]}
            className="h-10 min-w-[180px]"
          />
        </label>
        <button
          type="button"
          onClick={() => setPicking(true)}
          className={`${inputCls} flex items-center gap-2 font-semibold`}
          aria-haspopup="dialog"
        >
          <Icon name="funnel" size={16} />
          {f.games ? G.gamesPicked(f.games.length) : G.pickGames}
        </button>
        <label className="flex flex-col gap-1 text-[12px] font-semibold">
          <span className="text-muted">{G.resultLabel}</span>
          <Select
            aria-label={G.resultLabel}
            value={f.result ?? ""}
            onValueChange={(v) => setF({ ...f, result: (v || null) as GameResult | null })}
            options={[{ value: "", label: G.allResults }, ...results.map((r) => ({ value: r, label: G.results[r] }))]}
            className="h-10 min-w-[150px]"
          />
        </label>
        {filtered && (
          <Btn tone="ghost" icon="x" onClick={() => setF(NO_GAME_FILTER)}>
            {G.clear}
          </Btn>
        )}
        <span className="text-muted num ml-auto self-center text-[13px]" aria-live="polite">
          {G.count(shown.length, rows.length)}
        </span>
      </div>

      {!shown.length ? (
        <Empty icon="funnel">{G.noMatch}</Empty>
      ) : (
        <Paged items={shown} label={C.pageLabel(G.title)}>
          {(page) => (
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-[13px]">
                <SortHead cols={cols} sort={sort} />
                <tbody>
                  {page.map((r) => (
                    <tr key={`${r.kind}:${r.id}`}>
                      <td className={`${td} font-semibold`}>{nameOf(r.game_id)}</td>
                      <td className={`${td} text-muted`}>{typeName(typeOf(r.game_id))}</td>
                      <td className={`${td} text-muted`}>
                        {[
                          r.kind === "puzzle" ? (C.modes[r.mode] ?? r.mode) : (C.boardModes[r.mode] ?? r.mode),
                          r.rated ? C.rated : null,
                          r.house === null ? null : r.house.length ? r.house.map((k) => C.ludoRules[k] ?? k).join(", ") : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </td>
                      <td className={td}>
                        {!r.against ? (
                          <span className="text-muted">{G.solo}</span>
                        ) : r.against.kind === "bot" ? (
                          <span className="text-muted inline-flex items-center gap-1.5 whitespace-nowrap">
                            <Icon name="robot" size={14} />
                            {C.againstBot(r.against.level)}
                          </span>
                        ) : r.against.players.length ? (
                          r.against.players.map((o, i) => (
                            <span key={o.id}>
                              {i > 0 && ", "}
                              <Link href={`/admin/players/${o.id}`} className="font-semibold underline-offset-4 hover:underline">
                                {o.nickname}
                              </Link>
                            </span>
                          ))
                        ) : (
                          <span className="text-muted">{C.againstUnknown}</span>
                        )}
                      </td>
                      <td className={td}>
                        <Pill tone={RESULT_TONE[r.result]}>{G.results[r.result]}</Pill>
                      </td>
                      <td className={`${td} num text-right`}>{r.timeMs !== null ? duration(r.timeMs) : C.noEmail}</td>
                      <td className={`${td} text-muted whitespace-nowrap`}>
                        <When iso={r.started} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Paged>
      )}

      <GamePicker
        open={picking}
        onOpenChange={setPicking}
        rows={rows}
        type={f.type}
        picked={f.games}
        onPick={(games) => setF({ ...f, games })}
      />
    </div>
  );
}

/** The sheet for picking particular games: those this player has played, of the chosen type, with a search. */
function GamePicker({
  open,
  onOpenChange,
  rows,
  type,
  picked,
  onPick,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rows: readonly GameRow[];
  type: string | null;
  picked: readonly string[] | null;
  onPick: (games: string[] | null) => void;
}) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [was, setWas] = useState(false);
  // Opening starts from the current choice (adjusted during render, not in an effect).
  if (open !== was) {
    setWas(open);
    if (open) {
      setSel(new Set(picked ?? []));
      setQ("");
    }
  }
  const games = useMemo(() => {
    const n = new Map<string, number>();
    for (const r of rows) if (!type || typeOf(r.game_id) === type) n.set(r.game_id, (n.get(r.game_id) ?? 0) + 1);
    return [...n].sort((a, b) => nameOf(a[0]).localeCompare(nameOf(b[0])));
  }, [rows, type]);
  const list = games.filter(([id]) => nameOf(id).toLowerCase().includes(q.trim().toLowerCase()));
  const flip = (id: string) =>
    setSel((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Modal
      kind="dialog"
      open={open}
      onOpenChange={onOpenChange}
      title={G.pickTitle}
      description={type ? G.pickIntroType(typeName(type)) : G.pickIntro}
    >
      <div className="flex flex-col gap-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={G.searchGames}
          aria-label={G.searchGames}
          className={`${inputCls} w-full`}
        />
        <div className="flex gap-2 text-[13px]">
          <button type="button" className="text-accent font-semibold" onClick={() => setSel(new Set(list.map(([id]) => id)))}>
            {G.selectShown}
          </button>
          <span className="text-muted" aria-hidden>
            ·
          </span>
          <button type="button" className="text-accent font-semibold" onClick={() => setSel(new Set())}>
            {G.selectNone}
          </button>
        </div>
        <ul className="flex max-h-[50vh] flex-col overflow-y-auto" aria-label={G.pickTitle}>
          {list.map(([id, n]) => (
            <li key={id}>
              <label className="hover:bg-surface-raised flex min-h-11 cursor-pointer items-center gap-3 rounded-[10px] px-2">
                <input type="checkbox" checked={sel.has(id)} onChange={() => flip(id)} />
                <span className="flex-1 text-[14px] font-semibold">{nameOf(id)}</span>
                <span className="text-muted num text-[13px]">{n}</span>
              </label>
            </li>
          ))}
          {!list.length && <li className="text-muted px-2 py-3 text-[14px]">{G.noGames}</li>}
        </ul>
        <ModalActions>
          <Btn
            tone="ghost"
            onClick={() => {
              onPick(null);
              onOpenChange(false);
            }}
          >
            {G.allGames}
          </Btn>
          <Btn
            tone="primary"
            onClick={() => {
              onPick(sel.size ? [...sel] : null);
              onOpenChange(false);
            }}
          >
            {G.apply}
          </Btn>
        </ModalActions>
      </div>
    </Modal>
  );
}
