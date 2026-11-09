import { Icon } from "@/components/ui/Icon";
import type { QA } from "@/lib/copy/seo";

/**
 * FAQ as an accordion (owner, 9 Nov). Native <details>/<summary>: no client JS, keyboard and screen-reader ready
 * (Enter or Space toggles, the open state is announced), and every answer stays in the page for search engines and
 * AI answers. Several can be open at once; the first opens by default so the section never looks empty.
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
  return (
    <div className={`flex flex-col gap-2.5 ${className}`}>
      {items.map((qa, i) => (
        <details
          key={qa.q}
          open={firstOpen && i === 0}
          className="group bg-surface border-line open:bg-surface-raised rounded-[20px] border"
        >
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-[20px] px-5 py-3.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] [&::-webkit-details-marker]:hidden">
            <h3 className="font-display text-[18px] leading-snug font-black sm:text-[20px]">{qa.q}</h3>
            <span
              aria-hidden
              className="bg-bg text-accent flex size-9 shrink-0 items-center justify-center rounded-full transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none"
            >
              <Icon name="plus" size={18} />
            </span>
          </summary>
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
        </details>
      ))}
    </div>
  );
}
