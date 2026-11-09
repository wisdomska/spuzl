import type { Metadata } from "next";
import { adminCopy } from "@/lib/copy/admin";
import { pageGate } from "@/lib/admin/page-gate";
import { can } from "@/lib/admin/roles";
import { Forbidden } from "@/components/admin/ui";
import { FeedbackPage } from "@/components/admin/FeedbackPage";

const P = adminCopy.pages;

export const metadata: Metadata = { title: P.feedback.title };

/** R4-02: messages from the /contact feedback form. */
export default async function Page() {
  const { role, allowed } = await pageGate("feedback.read");
  if (!allowed) return <Forbidden what={P.feedback.what} />;
  return <FeedbackPage canWrite={can(role, "feedback.write")} canOpenPlayers={can(role, "players.read")} />;
}
