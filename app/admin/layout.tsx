import type { Metadata } from "next";

/** /admin is never indexed and has no player chrome (no bottom nav, no Spuz, no button ticks). */
export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · SPUZL admin" },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function AdminRoot({ children }: LayoutProps<"/admin">) {
  return (
    <div className="admin bg-bg text-text min-h-dvh" data-no-tick>
      {children}
    </div>
  );
}
