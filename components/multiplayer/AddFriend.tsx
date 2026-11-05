"use client";

import { Icon } from "@/components/ui/Icon";
import { HttpError } from "@/lib/client/api";
import { useAccept, useAddFriend, useFriends, useRemoveFriend } from "@/lib/client/social";

/**
 * After a match: add the player you just played as a friend. Knows where you already stand with them: nothing
 * when you're friends, Accept when they asked you, Requested (tap to cancel) when you asked them, Add otherwise.
 * Never for the Practice bot or yourself (pass `id` null).
 */
export function AddFriend({ id, nickname, onError }: { id: string | null; nickname: string; onError?: (text: string) => void }) {
  const q = useFriends(!!id);
  const add = useAddFriend();
  const accept = useAccept();
  const cancel = useRemoveFriend();
  if (!id || !q.data) return null;
  if (q.data.friends.some((f) => f.id === id)) return null;
  const incoming = q.data.incoming.some((f) => f.id === id);
  const outgoing = q.data.outgoing.some((f) => f.id === id);
  const busy = add.isPending || accept.isPending || cancel.isPending;
  const fail = (e: unknown) => onError?.(e instanceof HttpError && e.message !== e.code ? e.message : "Couldn't send a friend request.");
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        if (incoming) accept.mutate(id, { onError: fail });
        else if (outgoing) cancel.mutate(id, { onError: fail });
        else add.mutate(nickname, { onError: fail });
      }}
      aria-label={
        incoming ? `Accept ${nickname}'s friend request` : outgoing ? `Cancel your request to ${nickname}` : `Add ${nickname} as a friend`
      }
      className="press flex h-10 flex-none items-center gap-1.5 rounded-[12px] px-3 text-[14px] font-semibold disabled:opacity-60"
      style={
        outgoing
          ? { background: "var(--surface-raised)", color: "var(--text-muted)" }
          : { background: "var(--surface-raised)", color: "var(--accent)" }
      }
    >
      <Icon name={incoming ? "check" : outgoing ? "hourglass" : "user-plus"} size={16} />
      {incoming ? "Accept" : outgoing ? "Requested" : "Add friend"}
    </button>
  );
}
