import type { Metadata } from "next";

export const metadata: Metadata = { title: "Get started" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
