/** Tab screens fade in (200 ms, opacity only so fixed bars stay put); reduced motion shortens it. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
