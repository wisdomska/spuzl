"use client";

import { useRef, type MouseEvent, type SyntheticEvent } from "react";
import { Icon } from "@/components/ui/Icon";
import type { QA } from "@/lib/copy/seo";

/** Open and close take 220 ms (grid rows 0fr ↔ 1fr with opacity, ease-out); the plus turns into a cross with them. */
const MS = 220;

/**
 * FAQ as an accordion (owner, 9 Nov). Native <details>/<summary>: keyboard and screen-reader ready (Enter or Space
 * toggles, the open state is announced), and every answer stays in the page for search engines and AI answers.
 * Several can be open at once; the first opens by default so the section never looks empty.
 *
 * R6: open and close animate. JS keeps <details> open through the closing slide (`data-state="closed"`), then
 * closes it; a click mid-way reverses from where it is (CSS transitions). Without JS, or under reduced motion, it
 * simply opens and shuts. Find-in-page opening a closed answer shows it at once.
 */
export function FaqAccordion({
  items,
  firstOpen = true,
  className = "",
}: {
  items: readonly QA[];
  firstOpen?: boolean;
  className?: string;
}) {
  const timers = useRef(new Map<HTMLDetailsElement, ReturnType<typeof setTimeout>>());

  const onSummary = (e: MouseEvent<HTMLElement>) => {
    const d = e.currentTarget.parentElement as HTMLDetailsElement;
    e.preventDefault();
    const pending = timers.current.get(d);
    if (pending) {
      clearTimeout(pending);
      timers.current.delete(d);
    }
    const closing = d.open && d.dataset.state !== "closed";
    if (closing) {
      d.dataset.state = "closed";
      const reduce = document.documentElement.dataset.motion === "reduce";
      timers.current.set(
        d,
        setTimeout(
          () => {
            timers.current.delete(d);
            d.open = false;
          },
          reduce ? 0 : MS,
        ),
      );
      return;
    }
    if (!d.open) {
      // Open at 0fr, let the browser lay that out, then grow to 1fr.
      d.dataset.state = "closed";
      d.open = true;
      void d.offsetHeight;
    }
    d.dataset.state = "open";
  };

  // Opened by the browser (find in page, a #fragment) rather than our click: show it.
  const onToggle = (e: SyntheticEvent<HTMLDetailsElement>) => {
    const d = e.currentTarget;
    if (d.open && !timers.current.has(d)) d.dataset.state = "open";
  };

  return (
    <div className={`flex flex-col gap-2.5 ${className}`}>
      {items.map((qa, i) => (
        <details
          key={qa.q}
          open={firstOpen && i === 0}
          onToggle={onToggle}
          className="group bg-surface border-line [&[open]:not([data-state=closed])]:bg-surface-raised rounded-[20px] border transition-colors duration-200"
        >
          <summary
            onClick={onSummary}
            className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-[20px] px-5 py-3.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] [&::-webkit-details-marker]:hidden"
          >
            <h3 className="font-display text-[18px] leading-snug font-black sm:text-[20px]">{qa.q}</h3>
            <span
              aria-hidden
              className="bg-bg text-accent flex size-9 shrink-0 items-center justify-center rounded-full transition-transform duration-[220ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none [details[open]:not([data-state=closed])_&]:rotate-45"
            >
              <Icon name="plus" size={18} />
            </span>
          </summary>
          <div
            // Shown while <details> is open and not on its way closed (data-state is only ever set by JS).
            className="grid grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity] duration-[220ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none [details[open]:not([data-state=closed])_&]:grid-rows-[1fr] [details[open]:not([data-state=closed])_&]:opacity-100"
          >
            <div className="min-h-0 overflow-hidden">
              <div className="text-muted flex flex-col gap-2 px-5 pb-5 text-[16px] leading-relaxed">
                <p>{qa.a}</p>
                {qa.points?.length ? (
                  <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-[var(--accent)]">
                    {qa.points.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}
