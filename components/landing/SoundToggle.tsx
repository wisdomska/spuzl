"use client";

import { Icon } from "@/components/ui/Icon";
import { configure, play } from "@/lib/audio";
import { aboutCopy as T } from "@/lib/copy/about";
import { useSettings } from "@/lib/settings/store";

/**
 * Sound on or off for the landing page (R6). Music is held off there (NoMusic), but the demo board and every button
 * make sounds; this flips the app's own sound effects setting (lib/settings/store `sfx`), so the choice is remembered
 * on this device and carries into the games. The app-wide press listener plays the falling toggle as it turns off; it
 * plays the rising one here when it turns back on (the listener ran while sound was still off).
 */
export function SoundToggle({ className = "" }: { className?: string }) {
  const on = useSettings((s) => s.sfx);
  const set = useSettings((s) => s.set);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={T.tryIt.sound}
      title={on ? T.tryIt.soundOn : T.tryIt.soundOff}
      onClick={() => {
        set("sfx", !on);
        if (!on) {
          configure({ sfx: true });
          play("toggle", { step: 1 });
        }
      }}
      className={`press text-muted hover:text-text flex size-11 items-center justify-center rounded-full ${className}`}
    >
      <Icon name={on ? "speaker-high" : "speaker-slash"} size={20} />
    </button>
  );
}
