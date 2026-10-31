import type { Metadata } from "next";

export const metadata: Metadata = { title: "Welcome" };

export default function IntroLayout({ children }: LayoutProps<"/intro">) {
  return children;
}
