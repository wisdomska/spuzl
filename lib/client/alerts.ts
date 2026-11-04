"use client";

/**
 * Getting a player's attention when it matters (their turn, a friend's invite) and they are not looking:
 * the tab title flashes until they come back, and, if they allowed it, the system shows a notification.
 * Nothing here asks for permission by itself; `askAlerts` does, from a button the player pressed.
 */
let flashing: ReturnType<typeof setInterval> | null = null;
let baseTitle = "";

function flashTitle(text: string) {
  if (typeof document === "undefined") return;
  if (flashing) clearInterval(flashing);
  baseTitle = baseTitle || document.title;
  let on = false;
  flashing = setInterval(() => {
    on = !on;
    document.title = on ? text : baseTitle;
  }, 1000);
  const stop = () => {
    if (document.hidden) return;
    if (flashing) clearInterval(flashing);
    flashing = null;
    document.title = baseTitle;
    baseTitle = "";
    document.removeEventListener("visibilitychange", stop);
  };
  document.addEventListener("visibilitychange", stop);
}

export const alertsSupported = () => typeof window !== "undefined" && "Notification" in window;
export const alertsAllowed = () => alertsSupported() && Notification.permission === "granted";

/** Asks once for system notifications (from a press). True when they are on. */
export async function askAlerts(): Promise<boolean> {
  if (!alertsSupported()) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  return (await Notification.requestPermission()) === "granted";
}

/** Only when the tab is hidden: flash the title and, if allowed, show a system notification that opens `href`. */
export function alertIfAway(title: string, body: string, href: string, tag: string) {
  if (typeof document === "undefined" || !document.hidden) return;
  flashTitle(`● ${title}`);
  if (!alertsAllowed()) return;
  try {
    const n = new Notification(title, { body, tag, icon: "/icons/icon-192.png" });
    n.onclick = () => {
      window.focus();
      if (location.pathname + location.search !== href) location.assign(href);
      n.close();
    };
  } catch {
    // some mobile browsers only notify through a service worker: the flashing title still works
  }
}
