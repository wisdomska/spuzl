import type { Metadata } from "next";
import { PartyTv } from "@/components/multiplayer/PartyTv";
import { partyCopy } from "@/lib/copy/party";

export const metadata: Metadata = { title: partyCopy.tv.pageTitle, robots: { index: false } };

/**
 * /party/<code>/tv (R2-P5): read-only big-screen view of a Party room for a classroom projector or a TV. No player
 * profile needed; the server decides what it may show (GET /api/v1/rooms/<code>/tv).
 */
export default async function Page({ params }: PageProps<"/party/[code]/tv">) {
  const { code } = await params;
  return <PartyTv code={code} />;
}
