/**
 * The logo intro plays once each time SPUZL is opened in the browser (a new tab or window, or a launch of the installed
 * app), before Home (owner, 14 Nov 2026). Never on a reload, never when coming back to the Grid from a game. The mark
 * lives in sessionStorage, which belongs to the tab: it survives reloads and in-app navigation and is gone when the
 * tab closes. The /intro page and sign-up count as playing it.
 */
export const OPENED_KEY = "spuzl.introSeen";

/** Whether the intro already played in this tab. Storage blocked: count it as played (never nag). */
export function playedThisVisit(): boolean {
  try {
    return sessionStorage.getItem(OPENED_KEY) === "1";
  } catch {
    return true;
  }
}

export function markOpened() {
  try {
    sessionStorage.setItem(OPENED_KEY, "1");
  } catch {
    /* private mode: nothing to remember, and playedThisVisit() already says yes */
  }
}

/** Runs in <head> before paint: hides the server-rendered intro at once when it already played in this tab. */
export const openSplashBootScript = `(function(){try{if(sessionStorage.getItem('${OPENED_KEY}')==='1')document.documentElement.dataset.opened='1'}catch(x){document.documentElement.dataset.opened='1'}})();`;
