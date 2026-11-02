"use client";

import { useState, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Sheet } from "@/components/meta/Sheet";
import { Button } from "@/components/ui/Button";
import { BirthPicker, type Birth } from "./BirthPicker";
import { api, HttpError, type Me } from "@/lib/client/api";
import { birthProblem } from "@/lib/age";
import { ageCopy as C } from "@/lib/copy/age";

/**
 * Players who joined before birth month and year were asked add theirs once. The server accepts it only while it is
 * still empty, and only when it doesn't put them in an older band than the one they chose (else 409 age_locked, and
 * an admin can correct it). Their band keeps working whatever happens here: nobody is locked out.
 */
export function BirthAskSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const qc = useQueryClient();
  const [birth, setBirth] = useState<Birth>({ year: null, month: null });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!birth.year || !birth.month) return;
    if (birthProblem(birth.year, birth.month)) return setError(C.future);
    setSaving(true);
    setError(null);
    try {
      await api("/api/v1/profile", { json: { birthYear: birth.year, birthMonth: birth.month } });
      await qc.invalidateQueries({ queryKey: ["me"] });
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof HttpError && e.status < 500 ? e.message : C.ask.failed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={C.ask.title} description={C.ask.body}>
      <BirthPicker
        value={birth}
        error={error}
        onChange={(b) => {
          setBirth(b);
          setError(null);
        }}
      />
      <Button size="lg" className="mt-2 w-full" disabled={!birth.year || !birth.month} loading={saving} onClick={save}>
        {saving ? C.ask.saving : C.ask.save}
      </Button>
      <Button size="lg" variant="secondary" className="w-full" onClick={() => onOpenChange(false)}>
        {C.ask.later}
      </Button>
    </Sheet>
  );
}

const ASKED = "spuzl.birthAsked";
const noSubscribe = () => () => {};
const readAsked = () => {
  try {
    return localStorage.getItem(ASKED) === "1";
  } catch {
    return true;
  }
};

/** Home: asks once per device on the next visit; Settings keeps the way back in ("Add your birth month and year"). */
export function BirthAskOnce({ me }: { me: Me }) {
  const askedBefore = useSyncExternalStore(noSubscribe, readAsked, () => true);
  const [closed, setClosed] = useState(false);
  const open = me.birthSet === false && !askedBefore && !closed;
  return (
    <BirthAskSheet
      open={open}
      onOpenChange={(o) => {
        if (o) return;
        setClosed(true);
        try {
          localStorage.setItem(ASKED, "1");
        } catch {
          /* private mode */
        }
      }}
    />
  );
}
