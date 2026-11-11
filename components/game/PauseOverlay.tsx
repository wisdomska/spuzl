"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { formatClock } from "@/lib/format";
import { useSettings } from "@/lib/settings/store";
import { pauseCopy as P } from "@/lib/copy/pause";
import { copy } from "@/lib/copy";

/**
 * G1 Pause: bottom sheet over a dimmed, blurred screen. The board itself is always covered while paused (R2-16:
 * GameShell puts an opaque cover over the board slot, so canvas and Phaser boards are hidden too, whatever the
 * browser does with backdrop blur). Reduced motion: no slide, a short fade only.
 */
export function PauseOverlay({
  open,
  title,
  elapsed,
  onResume,
  onQuit,
  onHelp,
}: {
  open: boolean;
  title: string;
  /** the time so far; null hides it (a practice round, or before the first move: R2-15) */
  elapsed: number | null;
  onResume: () => void;
  onQuit: () => void;
  onRestart?: () => void;
  onHelp?: () => void;
}) {
  const sfx = useSettings((s) => s.sfx);
  const relaxed = useSettings((s) => s.relaxed);
  const cb = useSettings((s) => s.cb);
  const textScale = useSettings((s) => s.textScale);
  const reducedMotion = useSettings((s) => s.reducedMotion);
  const haptics = useSettings((s) => s.haptics);
  const set = useSettings((s) => s.set);
  const T = copy.comfort;
  // Same store as /settings, so a change here is a change everywhere (and syncs to the account).
  const nextScale = ({ 100: 110, 110: 120, 120: 130, 130: 100 } as const)[textScale];
  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onResume()}
      title={P.title}
      describedBy="pause-desc"
      gap="gap-3"
      hideBehind
      aside={elapsed !== null ? <span className="num text-muted self-center text-[20px] font-semibold">{formatClock(elapsed)}</span> : null}
    >
      <p id="pause-desc" className="text-muted flex items-center gap-2 text-[15px]">
        <Icon name="eye-slash" size={18} className="shrink-0" />
        {P.hidden}
      </p>
      <Button size="lg" onClick={onResume} className="w-full text-[17px]" autoFocus>
        {P.resume}
      </Button>
      <Row icon="question" label={P.howTo} value={P.howToValue} onClick={onHelp} />
      <p className="text-muted mt-1 text-[13px] font-semibold tracking-[0.04em] uppercase">{T.title}</p>
      <Row
        icon="circles-three-plus"
        label={T.patterns}
        value={cb === "off" ? T.off : T.on}
        pressed={cb !== "off"}
        onClick={() => set("cb", cb === "off" ? "deutan" : "off")}
      />
      <Row icon="text-aa" label={T.textSize} value={`${textScale}%`} onClick={() => set("textScale", nextScale)} />
      <Row
        icon="person-simple-walk"
        label={T.reducedMotion}
        value={reducedMotion === "on" ? T.on : reducedMotion === "off" ? T.off : T.system}
        pressed={reducedMotion === "on"}
        onClick={() => set("reducedMotion", reducedMotion === "on" ? "off" : "on")}
      />
      <Row icon="timer" label={T.hideTimer} value={relaxed ? T.on : T.off} pressed={relaxed} onClick={() => set("relaxed", !relaxed)} />
      <Row
        icon={sfx ? "speaker-high" : "speaker-slash"}
        label={T.sound}
        value={sfx ? T.on : T.off}
        pressed={sfx}
        onClick={() => set("sfx", !sfx)}
      />
      <Row icon="vibrate" label={T.haptics} value={haptics ? T.on : T.off} pressed={haptics} onClick={() => set("haptics", !haptics)} />
      <Row icon="sign-out" label={P.quit} value={P.quitValue} danger onClick={onQuit} />
      <span className="sr-only">{title}</span>
    </Modal>
  );
}

function Row({
  icon,
  label,
  value,
  danger,
  pressed,
  onClick,
}: {
  icon: string;
  label: string;
  value: string;
  danger?: boolean;
  /** toggle rows report their state to assistive tech */
  pressed?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className="press bg-surface-raised flex h-[52px] items-center gap-3 rounded-[16px] px-4 text-left text-[16px] font-semibold"
      style={{ color: danger ? "var(--danger)" : undefined }}
    >
      <Icon name={icon} size={20} />
      <span className="flex-1">{label}</span>
      <span className="text-muted text-[14px] font-medium">{value}</span>
    </button>
  );
}
