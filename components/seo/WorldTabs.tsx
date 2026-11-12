"use client";

import { useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { tabFromHash, tabIndexForKey } from "@/lib/seo/world-tabs";

/** history.replaceState fires no event, so a tab switch tells the subscribers itself. */
const hashListeners = new Set<() => void>();
function subscribe(cb: () => void) {
  hashListeners.add(cb);
  window.addEventListener("hashchange", cb);
  return () => {
    hashListeners.delete(cb);
    window.removeEventListener("hashchange", cb);
  };
}
const readHash = () => window.location.hash;

export interface WorldTab {
  id: string;
  name: string;
  color: string;
  icon: string;
  /** "15 games" */
  count: string;
  /** the panel, rendered on the server (its heading, line and game links) */
  panel: ReactNode;
}

/**
 * The /games worlds as tabs (R6, WAI-ARIA tabs: arrows, Home, End; the selected world in the hash, "/games#word").
 * Every panel is in the server HTML, so crawlers and no-JS visitors get all the game links: without JS the tab row is
 * hidden and the panels stack under their own headings; with JS, panels after the first stay hidden from the first
 * paint (CSS `scripting: enabled`) until hydration takes over with `hidden`. A clicked switch fades the panel in
 * (180 ms); keyboard switches are instant.
 */
export function WorldTabs({ tabs, label }: { tabs: readonly WorldTab[]; label: string }) {
  const ids = tabs.map((t) => t.id);
  // The URL hash is the state; null on the server and during hydration (the first tab, as in the HTML).
  const hash = useSyncExternalStore(subscribe, readHash, () => null);
  const hydrated = hash !== null;
  const sel = (hydrated && tabFromHash(hash, ids)) || ids[0];
  const [animate, setAnimate] = useState(false);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (id: string, viaKey: boolean) => {
    setAnimate(!viaKey);
    // Replace, not push: the hash makes the tab linkable without filling the Back stack with tab switches.
    history.replaceState(history.state, "", id === ids[0] ? window.location.pathname + window.location.search : `#${id}`);
    hashListeners.forEach((l) => l());
  };

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const next = tabIndexForKey(e.key, i, tabs.length);
    if (next === null) return;
    e.preventDefault();
    select(tabs[next].id, true);
    refs.current[next]?.focus();
  };

  return (
    <div className="flex flex-col gap-6">
      <div role="tablist" aria-label={label} className="flex flex-wrap gap-2 [@media(scripting:none)]:hidden">
        {tabs.map((t, i) => {
          const on = t.id === sel;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={on}
              aria-controls={`panel-${t.id}`}
              tabIndex={on ? 0 : -1}
              onClick={() => on || select(t.id, false)}
              onKeyDown={(e) => onKey(e, i)}
              className={`press flex h-12 items-center gap-2 rounded-full border-2 pr-4 pl-1.5 text-[15px] font-bold transition-colors duration-150 ${
                on ? "bg-surface-raised text-text" : "bg-surface text-muted hover:text-text border-line"
              }`}
              style={on ? { borderColor: t.color } : undefined}
            >
              <span
                className="flex size-8 items-center justify-center rounded-full"
                style={{ background: t.color, color: "var(--on-accent)" }}
                aria-hidden
              >
                <Icon name={t.icon} size={16} />
              </span>
              {t.name}
              <span className="text-muted text-[13px] font-semibold">{t.count}</span>
            </button>
          );
        })}
      </div>
      {tabs.map((t, i) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`panel-${t.id}`}
          aria-labelledby={`tab-${t.id}`}
          tabIndex={0}
          hidden={hydrated ? t.id !== sel : undefined}
          className={`flex flex-col gap-4 rounded-[20px] ${
            !hydrated && i > 0 ? "[@media(scripting:enabled)]:hidden [@media(scripting:none)]:mt-6" : ""
          } ${hydrated && animate ? "panel-in" : ""}`}
        >
          {t.panel}
        </div>
      ))}
    </div>
  );
}
