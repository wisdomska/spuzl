/**
 * The logo intro plays once each time SPUZL is opened (a new tab or a launch of the installed app), before Home. A
 * flag in sessionStorage marks this visit as opened, so reloads and moving between screens never replay it.
 */
export const OPENED_KEY = "spuzl-opened";

/** This page load, as the opened mark the app shell writes (the intro page writes "intro"). */
const thisLoad = () => String(Math.round(performance.timeOrigin));

/**
 * Whether an earlier page load of this visit already opened the app (or /intro played). Fixed for a page load, so
 * the intro that this load started keeps playing after the mark is written.
 */
export function wasOpened(): boolean {
  try {
    const v = sessionStorage.getItem(OPENED_KEY);
    return v !== null && v !== thisLoad();
  } catch {
    return true;
  }
}

export function markOpened(by: "intro" | "shell" = "shell") {
  try {
    sessionStorage.setItem(OPENED_KEY, by === "intro" ? "intro" : thisLoad());
  } catch {
    /* private mode: the intro may show again, nothing breaks */
  }
}

/** Runs in <head> before paint: hides the server-rendered intro at once on later page loads of the same visit. */
export const openSplashBootScript = `(function(){try{if(sessionStorage.getItem('${OPENED_KEY}')!==null)document.documentElement.dataset.opened='1'}catch(x){document.documentElement.dataset.opened='1'}})();`;
