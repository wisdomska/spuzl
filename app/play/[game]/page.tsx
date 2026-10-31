import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GAME_BY_ID } from "@/lib/catalog";
import { hasLogic } from "@/games/logic-registry";
import { PlayScreen } from "@/components/play/PlayScreen";

export async function generateMetadata({ params }: PageProps<"/play/[game]">): Promise<Metadata> {
  const { game } = await params;
  const meta = GAME_BY_ID[game];
  return meta ? { title: meta.name, description: meta.rule } : {};
}

/** /play/<game>?mode=daily|free|archive&date=YYYY-MM-DD&difficulty=easy|medium|hard|expert|mega (free play) */
export default async function Play({ params, searchParams }: PageProps<"/play/[game]">) {
  const { game } = await params;
  const sp = await searchParams;
  const meta = GAME_BY_ID[game];
  if (!meta || !hasLogic(game)) notFound();
  const mode = sp.mode === "free" || sp.mode === "archive" ? sp.mode : "daily";
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : undefined;
  const difficulty =
    typeof sp.difficulty === "string" && ["easy", "medium", "hard", "expert", "mega"].includes(sp.difficulty)
      ? (sp.difficulty as "easy" | "medium" | "hard" | "expert" | "mega")
      : undefined;
  return <PlayScreen meta={meta} initialMode={mode} date={date} difficulty={difficulty} />;
}
