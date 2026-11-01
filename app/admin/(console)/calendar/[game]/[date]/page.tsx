import type { Metadata } from "next";
import { adminCopy } from "@/lib/copy/admin";
import { notFound } from "next/navigation";
import { pageGate } from "@/lib/admin/page-gate";
import { can } from "@/lib/admin/roles";
import { ISO_DATE } from "@/lib/admin/dates";
import { GAME_BY_ID } from "@/lib/catalog";
import { hasLogic } from "@/games/logic-registry";
import { Forbidden } from "@/components/admin/ui";
import { DailySlot } from "@/components/admin/DailySlot";

const P = adminCopy.pages;

export const metadata: Metadata = { title: P.dailySlot.title };

/** One Daily slot: the real Board, the solve-check and the publish panel (design: Admin preview). */
export default async function Page({ params }: PageProps<"/admin/calendar/[game]/[date]">) {
  const { role, allowed } = await pageGate("calendar.read");
  if (!allowed) return <Forbidden what={P.dailySlot.what} />;
  const { game, date } = await params;
  if (!GAME_BY_ID[game] || !hasLogic(game) || !ISO_DATE.test(date)) notFound();
  return <DailySlot game={game} date={date} canWrite={can(role, "calendar.write")} canSwap={can(role, "daily.swap")} />;
}
