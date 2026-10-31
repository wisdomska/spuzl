import { Spuz, MOOD_NAMES } from "@/components/brand/Spuz";
import { devOnly } from "@/lib/dev/guard";

export default function SpuzSheet() {
  devOnly();
  return (
    <main className="grid grid-cols-6 gap-4 p-8" style={{ background: "#171929" }}>
      {MOOD_NAMES.map((m) => (
        <div key={m} className="rounded-card flex flex-col items-center p-4" style={{ background: "#20233A" }}>
          <Spuz mood={m} size={150} still />
          <span className="font-display text-lg">{m}</span>
        </div>
      ))}
    </main>
  );
}
