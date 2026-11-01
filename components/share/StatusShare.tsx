"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { ShareSheet } from "./ShareSheet";
import { api } from "@/lib/client/api";
import { useGameSettings } from "@/lib/game-settings/client";
import { statusCopy as T } from "@/lib/copy/status";

interface StatusCardRes {
  image: string;
  width: number;
  height: number;
  text: string;
  alt: string;
}

/**
 * "Share my status" on Me (admin setting "features.statusCards"): fetches the signed card link and share text,
 * then opens the share sheet. Hidden while the setting is off; the server refuses the card then too.
 */
export function StatusShare() {
  const on = useGameSettings()["features.statusCards"];
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ["status-card"],
    queryFn: () => api<StatusCardRes>("/api/v1/me/status-card"),
    enabled: on && open,
    staleTime: 60_000,
  });
  if (!on) return null;
  return (
    <>
      <Button
        variant="secondary"
        icon="share-fat"
        className="w-full"
        loading={open && q.isFetching && !q.data}
        error={q.isError}
        onClick={() => {
          if (q.isError) void q.refetch();
          setOpen(true);
        }}
      >
        {open && q.isFetching && !q.data ? T.loading : T.button}
      </Button>
      {q.isError && (
        <p role="status" className="text-muted text-center text-[14px]">
          {T.failed}
        </p>
      )}
      {q.data && (
        <ShareSheet
          open={open}
          onOpenChange={setOpen}
          kind="status"
          title={T.sheetTitle}
          text={q.data.text}
          image={q.data.image}
          fileName="spuzl-status.png"
          preview={{ width: 154, height: 192, alt: T.previewAlt }}
        />
      )}
    </>
  );
}
