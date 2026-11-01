import type { Metadata } from "next";
import { adminCopy } from "@/lib/copy/admin";
import { pageGate } from "@/lib/admin/page-gate";
import { Forbidden } from "@/components/admin/ui";
import { PuzzleLibrary } from "@/components/admin/PuzzleLibrary";

const P = adminCopy.pages;

export const metadata: Metadata = { title: P.puzzles.title };

export default async function Page() {
  const { allowed } = await pageGate("calendar.read");
  if (!allowed) return <Forbidden what={P.puzzles.what} />;
  return <PuzzleLibrary />;
}
