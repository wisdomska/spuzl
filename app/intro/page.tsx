"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import { LogoIntro } from "@/components/brand/LogoIntro";
import { rememberReturn, writeOnboarding } from "@/lib/client/onboarding";
import { markOpened } from "@/lib/client/open-splash";

/** Where the intro goes next: `?next=` from the landing page's buttons (a same-site path), else sign-in. */
function nextPath() {
  const n = new URLSearchParams(window.location.search).get("next");
  return n && n.startsWith("/") && !n.startsWith("//") ? n : "/welcome";
}

/** The logo intro on its own page: the landing page's Play and Sign in come through here, then go on. */
export default function Intro() {
  const router = useRouter();

  // A deep link (e.g. /daily from a friend's share) comes back here as ?return=: onboarding ends there.
  useEffect(() => rememberReturn(new URLSearchParams(window.location.search).get("return")), []);

  const done = useCallback(() => {
    writeOnboarding({ introSeen: true });
    markOpened();
    router.replace(nextPath());
  }, [router]);

  return <LogoIntro onDone={done} />;
}
