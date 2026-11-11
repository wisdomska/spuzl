"use client";

/**
 * R4-02: the feedback form on /contact (SPIL's way): optional email, a message, what it's about, and the page the
 * player came from (`?from=<path>`, sanitised to a bare path). Works signed in or signed out; the server checks
 * everything again (POST /api/v1/feedback). The honeypot field is off-screen and out of the tab order.
 */
import { useId, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { HttpError, api } from "@/lib/client/api";
import { contactCopy } from "@/lib/copy/contact";
import { FEEDBACK_KINDS, MESSAGE_MAX, feedbackProblem, sanitiseFrom, type FeedbackKind } from "@/lib/feedback";
import { Select } from "@/components/ui/Select";

const C = contactCopy.form;
type State = { s: "idle" } | { s: "sending" } | { s: "sent"; withEmail: boolean } | { s: "error"; text: string };

const field = "bg-surface-raised text-text h-12 w-full rounded-[14px] px-3.5 text-[16px] outline-none";
const label = "text-[15px] font-bold";
const hint = "text-muted! text-[13px] leading-snug";

/** Reads `?from=` (inside a Suspense boundary on the page, so the rest of /contact stays prerendered). */
export function FeedbackFormFromQuery() {
  const sp = useSearchParams();
  return <FeedbackForm from={sanitiseFrom(sp.get("from"))} />;
}

export function FeedbackForm({ from }: { from: string | null }) {
  const id = useId();
  const [kind, setKind] = useState<"" | FeedbackKind>("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<State>({ s: "idle" });
  const [problem, setProblem] = useState<ReturnType<typeof feedbackProblem>>(null);
  const honeypot = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (state.s === "sending") return;
    const p = feedbackProblem({ message, email });
    setProblem(p);
    if (p) {
      (p === "email" ? emailRef : messageRef).current?.focus();
      return;
    }
    setState({ s: "sending" });
    try {
      await api("/api/v1/feedback", {
        json: {
          message: message.trim(),
          email: email.trim() || undefined,
          kind: kind || undefined,
          from: from ?? undefined,
          website: honeypot.current?.value || undefined,
        },
      });
      setState({ s: "sent", withEmail: !!email.trim() });
      setMessage("");
      setKind("");
    } catch (err) {
      const text =
        err instanceof HttpError
          ? err.status === 429
            ? C.errors.rate_limited
            : C.errors.generic
          : typeof navigator !== "undefined" && !navigator.onLine
            ? C.errors.offline
            : C.errors.generic;
      setState({ s: "error", text });
    }
  };

  if (state.s === "sent")
    return (
      <section aria-labelledby={`${id}-sent`} className="bg-surface flex flex-col items-start gap-3 rounded-[24px] p-5 sm:p-6">
        <Icon name="check-circle" size={32} className="text-accent" />
        <h2 id={`${id}-sent`} className="mt-0!" tabIndex={-1} ref={(el) => el?.focus()}>
          {C.sentTitle}
        </h2>
        <p className="text-muted!">{state.withEmail ? C.sentWithEmail : C.sentBody}</p>
        <Button variant="secondary" icon="chat-circle-text" onClick={() => setState({ s: "idle" })}>
          {C.another}
        </Button>
      </section>
    );

  const sending = state.s === "sending";
  const problemText = problem ? C.problems[problem] : null;
  return (
    <form
      aria-label={C.label}
      noValidate
      onSubmit={(e) => void submit(e)}
      className="bg-surface relative flex flex-col gap-5 rounded-[24px] p-5 sm:p-6"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-kind`} className={label}>
          {C.kind} <span className="text-muted text-[13px] font-medium">({C.kindOptional})</span>
        </label>
        <Select
          id={`${id}-kind`}
          name="kind"
          tone="app"
          value={kind}
          onValueChange={(v) => setKind(v as "" | FeedbackKind)}
          options={[{ value: "", label: C.kindAny }, ...FEEDBACK_KINDS.map((k) => ({ value: k, label: C.kinds[k] }))]}
          className="w-full"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-email`} className={label}>
          {C.email}
        </label>
        <input
          ref={emailRef}
          id={`${id}-email`}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={254}
          placeholder={C.emailPlaceholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={problem === "email" || undefined}
          aria-describedby={`${id}-email-hint${problem === "email" ? ` ${id}-problem` : ""}`}
          className={field}
        />
        <p id={`${id}-email-hint`} className={hint}>
          {C.emailHint}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-message`} className={label}>
          {C.message}
        </label>
        <textarea
          ref={messageRef}
          id={`${id}-message`}
          name="message"
          required
          rows={6}
          maxLength={MESSAGE_MAX}
          placeholder={C.messagePlaceholder}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          aria-invalid={problem === "short" || problem === "long" || undefined}
          aria-describedby={`${id}-message-hint${problem && problem !== "email" ? ` ${id}-problem` : ""}`}
          className="bg-surface-raised text-text min-h-[144px] w-full resize-y rounded-[14px] px-3.5 py-3 text-[16px] leading-relaxed outline-none"
        />
        <p id={`${id}-message-hint`} className={`${hint} flex justify-between gap-3`}>
          <span>{C.messageHint}</span>
          <span className="num" aria-hidden>
            {C.count(message.length)}
          </span>
        </p>
      </div>

      {/* Honeypot: people never see it; bots that fill every field are thanked and dropped. */}
      <div aria-hidden className="absolute -left-[9999px] size-px overflow-hidden">
        <label htmlFor={`${id}-website`}>{C.honeypot}</label>
        <input ref={honeypot} id={`${id}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {from && <p className={hint}>{C.from(from)}</p>}

      <div className="flex flex-col gap-3">
        <div aria-live="polite" className="flex flex-col gap-1">
          {problemText && (
            <p id={`${id}-problem`} className="text-danger! text-[14px] font-semibold">
              {problemText}
            </p>
          )}
          {state.s === "error" && <p className="text-danger! text-[14px] font-semibold">{state.text}</p>}
        </div>
        <Button type="submit" icon="chat-circle-text" loading={sending} className="self-stretch sm:self-start">
          {sending ? C.sending : C.send}
        </Button>
      </div>
    </form>
  );
}
