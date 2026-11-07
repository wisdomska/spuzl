"use client";

import { Icon } from "@/components/ui/Icon";
import { api } from "@/lib/client/api";
import { useAdminAction, type AdminPage } from "@/lib/client/admin";
import { adminCopy } from "@/lib/copy/admin";
import { twoTruths, TRUTHS_THEME_LABEL } from "@/lib/copy/twotruths";
import { parseTruthsPack, truthsPackToJson } from "@/lib/admin/truths-pack";
import type { TruthsRound } from "@/games/twotruths/content";
import type { TruthsTheme } from "@/games/twotruths/rules";
import { PackPanel } from "./PackPanel";

const T = adminCopy.content.twotruths;

/**
 * A Two Truths and a Lie round as players see it once it is answered (R2-P5): the theme, the question, the three
 * statements with the lie marked (a cross and the words "The lie", never colour alone), then what is true instead
 * and where it was checked. The board shows the statements in a seeded order; the preview keeps them as written.
 */
export function TruthsPreview({ value }: { value: unknown }) {
  const r = (value ?? {}) as Partial<TruthsRound>;
  const truths = Array.isArray(r.truths) ? r.truths : [];
  const rows = [...truths.map((s) => ({ s, lie: false })), { s: r.lie ?? "", lie: true }];
  return (
    <section aria-label={T.preview} className="flex flex-col gap-1.5">
      <h3 className="text-[13px] font-semibold">{T.preview}</h3>
      <p className="text-muted text-[12px]">{T.previewHint}</p>
      <div className="flex flex-col gap-2 rounded-[16px] p-3" style={{ background: "var(--board-bg)" }}>
        <span className="text-muted text-[12px] font-semibold tracking-[.08em] uppercase">
          {TRUTHS_THEME_LABEL[r.theme as TruthsTheme] ?? r.theme ?? "…"}
        </span>
        <p className="text-[15px] font-semibold">{twoTruths.ask}</p>
        {rows.map((x, i) => (
          <div
            key={i}
            data-lie={x.lie || undefined}
            className="bg-surface-raised flex min-h-11 items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-[13px] font-medium"
            style={x.lie ? { boxShadow: "inset 0 0 0 2px var(--danger)" } : undefined}
          >
            <Icon name={x.lie ? "x" : "check"} size={12} />
            <span className="min-w-0 flex-1">{x.s || "…"}</span>
            {x.lie && <span className="text-danger text-[11px] font-bold uppercase">{T.lie}</span>}
          </div>
        ))}
        {r.fix && <p className="text-[13px]">{r.fix}</p>}
        {r.source && (
          <p className="text-muted text-[12px]">
            {T.source}: {r.source}
          </p>
        )}
      </div>
    </section>
  );
}

interface Row {
  payload: unknown;
}

/** Export the listed Two Truths items as a pack, or import a pack as drafts (POST /api/admin/content/import). */
export function TruthsPackPanel({ status, canWrite }: { status: string; canWrite: boolean }) {
  const imp = useAdminAction<{ game: "twotruths"; text: string }, { created: number }>("POST", "/api/admin/content/import");
  return (
    <PackPanel
      id="twotruths"
      words={T}
      canWrite={canWrite}
      check={parseTruthsPack}
      exportPack={async () => {
        const rows: Row[] = [];
        for (let page = 1; page <= 20; page++) {
          const r = await api<AdminPage<Row>>(
            `/api/admin/content?game=twotruths&${status ? `status=${status}&` : ""}pageSize=100&page=${page}`,
          );
          rows.push(...r.rows);
          if (rows.length >= r.total || !r.rows.length) break;
        }
        if (!rows.length) return { problem: T.nothing };
        return {
          file: `spuzl-twotruths-${status || "all"}.json`,
          text: truthsPackToJson(rows.map((r) => r.payload as TruthsRound)),
          note: T.exported(rows.length),
        };
      }}
      submit={async (text) => T.imported((await imp.mutateAsync({ game: "twotruths", text })).created)}
    />
  );
}
