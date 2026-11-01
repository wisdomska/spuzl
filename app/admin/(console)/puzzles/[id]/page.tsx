import type { Metadata } from "next";
import { adminCopy } from "@/lib/copy/admin";
import { notFound } from "next/navigation";
import { pageGate } from "@/lib/admin/page-gate";
import { can } from "@/lib/admin/roles";
import { listSearch } from "@/lib/admin/url-filters";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Forbidden } from "@/components/admin/ui";
import { PuzzlePreview } from "@/components/admin/PuzzlePreview";

const P = adminCopy.pages;

export const metadata: Metadata = { title: P.puzzle.title };

export default async function Page({ params, searchParams }: PageProps<"/admin/puzzles/[id]">) {
  const { role, allowed } = await pageGate("calendar.read");
  if (!allowed) return <Forbidden what={P.puzzle.what} />;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data } = await supabaseAdmin().from("puzzles").select("game_id").eq("id", id).maybeSingle();
  if (!data) notFound();
  const back = `/admin/puzzles${listSearch((await searchParams).list)}`;
  return <PuzzlePreview puzzleId={id} game={data.game_id} canWrite={can(role, "calendar.write")} canSwap={false} backHref={back} />;
}
