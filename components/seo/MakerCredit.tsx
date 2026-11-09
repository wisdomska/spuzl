import { Icon } from "@/components/ui/Icon";
import { aboutCopy } from "@/lib/copy/about";

/**
 * "Designed & Developed by Senya", linking to the maker's site (owner, 9 Nov: on every page, like SPIL). A plain
 * link that opens a new tab, so it works in server and client components alike. 44 px tall for touch.
 */
export function MakerCredit({ className = "" }: { className?: string }) {
  return (
    <a
      href={aboutCopy.creditUrl}
      target="_blank"
      rel="noopener"
      className={`text-muted hover:text-text inline-flex min-h-11 items-center gap-1 text-[14px] font-medium ${className}`}
    >
      {aboutCopy.credit}
      <Icon name="arrow-square-out" size={14} />
    </a>
  );
}
