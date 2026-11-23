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

/** Asks once for system notifications (from a press), then turns on push for this device. True when they are on. */
export async function askAlerts(): Promise<boolean> {
  if (!alertsSupported()) return false;
  if (Notification.permission === "denied") return false;
  if (Notification.permission !== "granted" && (await Notification.requestPermission()) !== "granted") return false;
  await enablePush();
  return true;
}

const pushSupported = () => typeof navigator !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const b64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Push for this device (alerts while SPUZL is closed): subscribes with the server's key and saves the
 * subscription. Quiet when push isn't available here or isn't set up on the server. Safe to call on every start.
 */
export async function enablePush(): Promise<boolean> {
  try {
    if (!pushSupported() || !alertsAllowed()) return false;
    const reg = await navigator.serviceWorker.ready;
    const { publicKey } = await (await fetch("/api/v1/push", { credentials: "include" })).json();
    if (!publicKey) return false;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
    const res = await fetch("/api/v1/push", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Where the account this device last saved its push subscription for is kept (with the subscription's address). */
const PUSH_OWNER_KEY = "spuzl.pushOwner";

/**
 * Push follows the account in use (owner, 23 Nov 2026, from Clink): a device has one push subscription, so with
 * several accounts on a phone it belongs to whichever is signed in. Saves it for `playerId` only when this device
 * last saved it for someone else (or the subscription changed), so it isn't sent to the server on every page load.
 */
export async function claimPushFor(playerId: string): Promise<boolean> {
  try {
    if (!pushSupported() || !alertsAllowed()) return false;
    const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
    const owner = `${playerId} ${sub?.endpoint ?? ""}`;
    try {
      if (sub && localStorage.getItem(PUSH_OWNER_KEY) === owner) return true;
    } catch {
      /* no storage: save it */
    }
    const ok = await enablePush();
    if (ok) {
      const now = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
      try {
        localStorage.setItem(PUSH_OWNER_KEY, `${playerId} ${now?.endpoint ?? ""}`);
      } catch {
        /* the next page load saves it again, no harm */
      }
    }
    return ok;
  } catch {
    return false;
  }
}

/** Stops push on this device (Settings). */
export async function disablePush(): Promise<void> {
  try {
    if (!pushSupported()) return;
    const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
    if (!sub) return;
    await fetch("/api/v1/push", {
      method: "DELETE",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
    await sub.unsubscribe();
    try {
      localStorage.removeItem(PUSH_OWNER_KEY);
    } catch {
      /* nothing kept */
    }
  } catch {
    // nothing to undo
  }
}

/** Whether this device has push on right now. */
export async function pushOn(): Promise<boolean> {
  try {
    if (!pushSupported() || !alertsAllowed()) return false;
    return !!(await (await navigator.serviceWorker.ready).pushManager.getSubscription());
  } catch {
    return false;
  }
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
