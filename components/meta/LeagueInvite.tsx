"use client";

import { useState } from "react";
import { useInvite } from "@/lib/client/social";
import { useGameSettings } from "@/lib/game-settings/client";
import { leaguesCopy as T } from "@/lib/copy/leagues";
import { Icon } from "@/components/ui/Icon";
import { play } from "@/lib/audio";

/**
 * League invite card (SPZ-21): the player's friends invite link (same link as Friends) with WhatsApp and
 * copy, shown when the player has no league group yet or is alone in it.
 */
export function LeagueInvite() {
  const invite = useInvite();
  const settings = useGameSettings();
  const [copied, setCopied] = useState(false);
  const url = invite.data?.url ?? "";
  const pretty = url.replace(/^https?:\/\//, "");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      play("pop");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: the link is selectable on screen */
    }
  };
  return (
    <section aria-labelledby="league-invite-title" className="bg-surface flex flex-col gap-3 rounded-[22px] p-4">
      <div className="flex items-start gap-3">
        <span className="bg-surface-raised text-accent flex size-11 shrink-0 items-center justify-center rounded-[14px]">
          <Icon name="user-plus" size={22} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 id="league-invite-title" className="font-display text-[17px] font-extrabold">
            {T.inviteTitle}
          </h2>
          <p className="text-muted text-[14px] leading-snug">
            {settings["leagues.fillWithFriends"] ? T.inviteWithFriends : T.inviteGeneric}
          </p>
        </div>
      </div>
      <span
        aria-label={T.inviteAria}
        className="num bg-surface-raised text-accent truncate rounded-[12px] px-3 py-2.5 text-[14px] font-medium select-all"
      >
        {pretty || " "}
      </span>
      <div className="grid grid-cols-2 gap-2">
        <a
          href={url ? `https://wa.me/?text=${encodeURIComponent(T.inviteShare(url))}` : undefined}
          aria-disabled={!url}
          target="_blank"
          rel="noopener noreferrer"
          className="press bg-accent text-on-accent flex h-11 items-center justify-center gap-1.5 rounded-[12px] px-3 text-[15px] font-semibold"
        >
          <Icon name="whatsapp-logo" size={18} />
          {T.whatsapp}
        </a>
        <button
          type="button"
          onClick={copy}
          disabled={!url}
          className="press bg-surface-raised flex h-11 items-center justify-center gap-1.5 rounded-[12px] px-3 text-[15px] font-semibold"
        >
          <Icon name={copied ? "check" : "copy"} size={18} />
          {copied ? T.copied : T.copy}
        </button>
      </div>
      <span role="status" className="sr-only">
        {copied ? T.copiedStatus : ""}
      </span>
    </section>
  );
}
