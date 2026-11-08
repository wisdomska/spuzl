/**
 * R3-03: start-up work that can wait (the error monitor, the analytics SDK) starts after the page's load event and
 * the browser's next idle moment, so it never adds to the main-thread work while the first screen hydrates.
 * Resolves at the latest `timeout` ms after the load event. Never resolves on the server.
 */
export function afterLoadIdle(timeout = 4000): Promise<void> {
  if (typeof window === "undefined") return new Promise(() => {});
  return new Promise((resolve) => {
    const idle = () => {
      const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
      if (typeof w.requestIdleCallback === "function") w.requestIdleCallback(() => resolve(), { timeout });
      else setTimeout(resolve, Math.min(timeout, 1500));
    };
    if (document.readyState === "complete") idle();
    else window.addEventListener("load", idle, { once: true });
  });
}
