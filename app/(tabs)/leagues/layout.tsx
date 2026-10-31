import type { Metadata } from "next";

export const metadata: Metadata = { title: "Leagues" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
