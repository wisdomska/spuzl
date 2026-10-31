"use client";

import { useState } from "react";
import { Sheet } from "./Sheet";
import { Switch } from "./ui";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { REPORT_REASONS, type ReportReason } from "@/lib/social";
import { useReport } from "@/lib/client/social";

/** F2 report sheet: preset reasons, "Also block them" (on by default), danger send. A human checks every report. */
export function ReportSheet({
  target,
  onClose,
  onDone,
}: {
  target: { id: string; nickname: string } | null;
  onClose: () => void;
  onDone?: (blocked: boolean) => void;
}) {
  const [reason, setReason] = useState<ReportReason>("nickname");
  const [block, setBlock] = useState(true);
  const [sent, setSent] = useState(false);
  const report = useReport();
  const close = () => {
    onClose();
    setTimeout(() => {
      setSent(false);
      report.reset();
    }, 300);
  };
  return (
    <Sheet
      open={!!target}
      onOpenChange={(o) => !o && close()}
      title={sent ? "Thanks. We'll take a look." : `Report ${target?.nickname ?? ""}`}
      description={sent ? "A moderator checks every report within a day." : "What's wrong? A human checks every report."}
    >
      {sent ? (
        <Button size="lg" variant="secondary" className="w-full" onClick={close} autoFocus>
          Done
        </Button>
      ) : (
        <>
          <div role="radiogroup" aria-label="Reason" className="flex flex-col gap-2">
            {REPORT_REASONS.map((o) => {
              const on = reason === o.id;
              return (
                <button
                  key={o.id}
                  role="radio"
                  aria-checked={on}
                  onClick={() => setReason(o.id)}
                  className="flex h-[52px] items-center gap-3 rounded-[14px] px-3.5 text-left text-[15px] font-semibold"
                  style={{ background: on ? "var(--success-tint)" : "var(--surface-raised)", boxShadow: on ? "inset 0 0 0 2px var(--accent)" : undefined }}
                >
                  <Icon name={o.icon} size={20} />
                  {o.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between px-0.5 py-1.5">
            <span className="text-[15px] font-semibold" id="also-block">
              Also block them
            </span>
            <Switch checked={block} onChange={setBlock} label="Also block them" />
          </div>
          <Button
            size="lg"
            variant="danger"
            className="w-full"
            loading={report.isPending}
            error={report.isError}
            onClick={async () => {
              if (!target) return;
              await report.mutateAsync({ playerId: target.id, reason, block });
              setSent(true);
              onDone?.(block);
            }}
          >
            Send report
          </Button>
          {report.isError && (
            <p role="alert" className="text-danger text-center text-[14px]">
              That didn&apos;t send. Try again.
            </p>
          )}
        </>
      )}
    </Sheet>
  );
}
