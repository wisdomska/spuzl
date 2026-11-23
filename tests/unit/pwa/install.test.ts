// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  installCapture,
  isStandalone,
  platform,
  promptInstall,
  resetInstallForTests,
  syncAppBadge,
  useInstallState,
} from "@/lib/pwa/install";
import { followUpdates, IN_GAME, isChunkError, reloadOnChunkError } from "@/lib/pwa/updates";
import { renderHook, act } from "@testing-library/react";

/** The browser's one-time install offer, as Chrome sends it. */
function installOffer(outcome: "accepted" | "dismissed") {
  const e = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: string }>;
  };
  e.prompt = vi.fn(async () => {});
  e.userChoice = Promise.resolve({ outcome });
  return e;
}

const setUA = (ua: string) => Object.defineProperty(navigator, "userAgent", { configurable: true, value: ua });
const standalone = (on: boolean) =>
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (q: string) => ({ matches: on && q === "(display-mode: standalone)", addEventListener() {}, removeEventListener() {} }),
  });

beforeEach(() => {
  resetInstallForTests();
  standalone(false);
});

describe("installing SPUZL (from Clink)", () => {
  it("keeps the browser's install offer for our button, and installs with one tap", async () => {
    installCapture();
    const { result } = renderHook(() => useInstallState());
    expect(result.current).toBe("manual");
    const offer = installOffer("accepted");
    act(() => void window.dispatchEvent(offer));
    // our button instead of the browser's mini-bar
    expect(offer.defaultPrevented).toBe(true);
    expect(result.current).toBe("prompt");
    let ok = false;
    await act(async () => void (ok = await promptInstall()));
    expect(offer.prompt).toHaveBeenCalled();
    expect(ok).toBe(true);
    expect(result.current).toBe("installed");
  });

  it("a dismissed offer is used up: back to the steps", async () => {
    installCapture();
    const { result } = renderHook(() => useInstallState());
    act(() => void window.dispatchEvent(installOffer("dismissed")));
    await act(async () => void (await promptInstall()));
    expect(result.current).toBe("manual");
    expect(await promptInstall()).toBe(false);
  });

  it("knows when it's already installed (opened from the home screen, or just installed)", () => {
    installCapture();
    const { result } = renderHook(() => useInstallState());
    act(() => void window.dispatchEvent(new Event("appinstalled")));
    expect(result.current).toBe("installed");
    resetInstallForTests();
    standalone(true);
    expect(isStandalone()).toBe(true);
  });

  it("tells iPhones, iPads, Android and computers apart", () => {
    setUA("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1");
    expect(platform()).toBe("ios");
    setUA("Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36");
    expect(platform()).toBe("android");
    setUA("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36");
    expect(platform()).toBe("desktop");
  });

  it("puts the count on the app icon, and clears it at zero", () => {
    const set = vi.fn(async () => {});
    const clear = vi.fn(async () => {});
    Object.assign(navigator, { setAppBadge: set, clearAppBadge: clear });
    syncAppBadge(3);
    expect(set).toHaveBeenCalledWith(3);
    syncAppBadge(0);
    expect(clear).toHaveBeenCalled();
  });
});

describe("following new versions (from Clink)", () => {
  let reload: ReturnType<typeof vi.fn>;
  let listeners: Record<string, () => void>;
  beforeEach(() => {
    reload = vi.fn();
    listeners = {};
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload, pathname: "/" },
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        controller: {},
        addEventListener: (t: string, f: () => void) => (listeners[t] = f),
        removeEventListener: () => {},
      },
    });
  });
  afterEach(() => Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" }));

  const hidden = (h: boolean) =>
    Object.defineProperty(document, "visibilityState", { configurable: true, value: h ? "hidden" : "visible" });

  it("switches over unseen while the app is hidden", () => {
    const stop = followUpdates(null);
    hidden(true);
    listeners.controllerchange();
    expect(reload).toHaveBeenCalledTimes(1);
    stop();
  });

  it("never reloads the screen in front of the player: it waits for the way back", () => {
    const stop = followUpdates(null);
    hidden(false);
    listeners.controllerchange();
    expect(reload).not.toHaveBeenCalled();
    document.dispatchEvent(new Event("visibilitychange"));
    expect(reload).toHaveBeenCalledTimes(1);
    stop();
  });

  it("never in the middle of a game", () => {
    (window.location as { pathname: string }).pathname = "/play/crownfall";
    const stop = followUpdates(null);
    hidden(true);
    listeners.controllerchange();
    document.dispatchEvent(new Event("visibilitychange"));
    expect(reload).not.toHaveBeenCalled();
    // left the game: the next time away or back, it switches
    (window.location as { pathname: string }).pathname = "/";
    document.dispatchEvent(new Event("visibilitychange"));
    expect(reload).toHaveBeenCalledTimes(1);
    stop();
  });

  it("the first install isn't a new version", () => {
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { controller: null, addEventListener: (t: string, f: () => void) => (listeners[t] = f), removeEventListener() {} },
    });
    const stop = followUpdates(null);
    hidden(true);
    listeners.controllerchange();
    expect(reload).not.toHaveBeenCalled();
    stop();
  });

  it("game screens are the play, duel, party, board game, challenge and race routes", () => {
    for (const p of ["/play/dash", "/duel", "/party/ABCD", "/bay/123", "/challenge/x", "/race/1"]) expect(IN_GAME.test(p)).toBe(true);
    for (const p of ["/", "/library", "/settings", "/players/x"]) expect(IN_GAME.test(p)).toBe(false);
  });

  it("reloads once when an old tab can't load a chunk from the new release", () => {
    expect(isChunkError("ChunkLoadError: Loading chunk 123 failed.")).toBe(true);
    expect(isChunkError("Failed to fetch dynamically imported module: https://x/_next/a.js")).toBe(true);
    expect(isChunkError("TypeError: x is undefined")).toBe(false);
    sessionStorage.clear();
    const stop = reloadOnChunkError();
    const fire = () =>
      window.dispatchEvent(
        Object.assign(new Event("unhandledrejection"), { reason: new Error("ChunkLoadError: Loading chunk 9 failed.") }),
      );
    fire();
    fire();
    expect(reload).toHaveBeenCalledTimes(1);
    stop();
  });
});
