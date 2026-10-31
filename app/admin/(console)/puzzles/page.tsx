import type { Metadata } from "next";
import { pageGate } from "@/lib/admin/page-gate";
import { Forbidden } from "@/components/admin/ui";
import { PuzzleLibrary } from "@/components/admin/PuzzleLibrary";

export const metadata: Metadata = { title: "Puzzles" };

export default async function Page() {
  const { allowed } = await pageGate("calendar.read");
  if (!allowed) return <Forbidden what="the puzzle library" />;
  return <PuzzleLibrary />;
}
