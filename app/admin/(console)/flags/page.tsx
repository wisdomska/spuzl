import { redirect } from "next/navigation";

/**
 * Feature switches were removed (11 Nov 2026): nothing in the app read them. Features players see are switched on
 * the Game settings page, so old links and bookmarks go there.
 */
export default function Page() {
  redirect("/admin/settings");
}
