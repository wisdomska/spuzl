"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Icon } from "@/components/ui/Icon";
import { HttpError } from "@/lib/client/api";
import type { MatchChat } from "@/lib/client/multiplayer";
import { CHAT_MAX, QUICK_PHRASES } from "@/lib/multiplayer/chat";
import type { EmoteId } from "@/lib/multiplayer/constants";
import { useSheetSound } from "@/lib/audio/useSheetSound";
import { play } from "@/lib/audio";
import { Avatar, EmoteBar } from "./ui";

/**
 * The room's chat panel (Duels and Parties): messages, the reactions, quick phrases and, in 16+ rooms, a text box.
 * Text is checked on the server (abuse, phone numbers, links and handles); a refusal is explained here.
 */
export function ChatPanel({ chat, me, onEmote }: { chat: MatchChat; me: string; onEmote: (e: EmoteId) => void }) {
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const list = useRef<HTMLOListElement>(null);
  useSheetSound(chat.open);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [chat.messages.length, chat.open]);
  const send = async (input: { quick: number } | { text: string }) => {
    setBusy(true);
    setErr("");
    try {
      await chat.send(input);
      if ("text" in input) setText("");
      play("tap");
    } catch (e) {
      setErr(
        e instanceof HttpError && e.code === "rate_limited"
          ? "Slow down a little."
          : e instanceof HttpError && e.message !== e.code
            ? e.message
            : "Couldn't send that.",
      );
    } finally {
      setBusy(false);
    }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (t) void send({ text: t });
  };
  return (
    <AnimatePresence>
      {chat.open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <motion.button
            type="button"
            aria-label="Close chat"
            className="absolute inset-0 bg-[rgba(6,7,13,.55)]"
            onClick={() => chat.setOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            data-no-tick
          />
          <motion.div
            role="dialog"
            aria-modal
            aria-label="Chat"
            className="bg-surface relative flex max-h-[80dvh] w-full max-w-[560px] flex-col gap-3 rounded-t-[28px] px-4 pt-3 pb-[max(20px,env(safe-area-inset-bottom))]"
            initial={{ transform: "translateY(100%)" }}
            animate={{ transform: "translateY(0%)" }}
            exit={{ transform: "translateY(100%)" }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
          >
            <div className="bg-line h-[5px] w-11 self-center rounded-[3px]" />
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[20px] font-black">Chat</h2>
              <button
                type="button"
                onClick={chat.toggleMute}
                aria-pressed={chat.muted}
                className="press text-muted flex h-9 items-center gap-1.5 rounded-[10px] px-2.5 text-[13px] font-semibold"
              >
                <Icon name={chat.muted ? "speaker-slash" : "speaker-high"} size={16} />
                {chat.muted ? "Muted" : "Mute pop-ups"}
              </button>
            </div>
            <ol ref={list} aria-label="Messages" aria-live="polite" className="flex min-h-[96px] flex-col gap-2 overflow-y-auto">
              {chat.messages.length === 0 ? (
                <li className="text-muted py-6 text-center text-[14px]">No messages yet. Say hi.</li>
              ) : (
                chat.messages.map((m) => {
                  const mine = m.from === me;
                  return (
                    <li key={m.id} className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                      {!mine && <Avatar name={m.nickname} color={m.color} hat={m.hat} size={28} />}
                      <div
                        className={`max-w-[78%] rounded-[16px] px-3 py-2 text-[15px] leading-snug ${mine ? "bg-accent text-on-accent rounded-br-[6px]" : "bg-surface-raised rounded-bl-[6px]"}`}
                      >
                        {!mine && <span className="text-muted block text-[12px] font-semibold">{m.nickname}</span>}
                        {m.body}
                      </div>
                    </li>
                  );
                })
              )}
            </ol>
            <EmoteBar
              onSend={(e) => {
                onEmote(e);
                chat.setOpen(false);
              }}
            />
            <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4" role="group" aria-label="Quick messages">
              {QUICK_PHRASES.map((q, i) => (
                <button
                  key={q}
                  type="button"
                  disabled={busy}
                  onClick={() => void send({ quick: i })}
                  className="press bg-surface-raised h-10 shrink-0 rounded-full px-3.5 text-[14px] font-semibold whitespace-nowrap"
                >
                  {q}
                </button>
              ))}
            </div>
            {chat.typing ? (
              <form onSubmit={submit} className="bg-bg flex h-12 items-center gap-2 rounded-[14px] pr-1.5 pl-3.5">
                <label htmlFor="chat-text" className="sr-only">
                  Message
                </label>
                <input
                  id="chat-text"
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, CHAT_MAX))}
                  placeholder="Say something nice"
                  autoComplete="off"
                  enterKeyHint="send"
                  className="placeholder:text-muted min-w-0 flex-1 bg-transparent text-[16px] outline-none"
                />
                <button
                  type="submit"
                  aria-label="Send"
                  disabled={busy || !text.trim()}
                  className="press bg-accent text-on-accent flex size-9 items-center justify-center rounded-[10px] disabled:opacity-50"
                >
                  <Icon name="arrow-up" size={18} />
                </button>
              </form>
            ) : (
              <p className="text-muted text-center text-[13px]">Quick messages only in this room.</p>
            )}
            {err && (
              <p role="alert" className="text-center text-[14px] text-[var(--danger)]">
                {err}
              </p>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/** A new message from someone else, popped up for a few seconds while the panel is closed. Tap to open chat. */
export function ChatPopup({ chat }: { chat: MatchChat }) {
  return (
    <AnimatePresence>
      {chat.incoming && !chat.open && (
        <motion.button
          key={chat.incoming.id}
          type="button"
          onClick={() => chat.setOpen(true)}
          className="bg-surface-raised fixed top-[max(64px,env(safe-area-inset-top))] left-1/2 z-[65] flex max-w-[min(92vw,420px)] -translate-x-1/2 items-center gap-2 rounded-full py-1.5 pr-4 pl-1.5 text-left shadow-[0_10px_30px_rgba(0,0,0,.4)]"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.2 }}
        >
          <Avatar name={chat.incoming.nickname} color={chat.incoming.color} hat={chat.incoming.hat} size={30} />
          <span className="min-w-0 truncate text-[14px]">
            <span className="font-semibold">{chat.incoming.nickname}: </span>
            {chat.incoming.body}
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
