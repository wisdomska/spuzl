"use client";

import { useEffect } from "react";
import { SIGN_IN_HREF } from "@/lib/landing-links";
import { isStandalone } from "@/lib/pwa/install";

/**
 * Opened from the home screen with no account yet (owner, 23 Nov 2026, from Clink): the installed app starts at "/",
 * which shows a visitor the website's landing page. An app should open on the app, so it goes straight to the
 * welcome screen (play as a guest, or sign in). Only at "/": the About page opened on purpose stays put.
 */
export function InstalledRedirect() {
  useEffect(() => {
    // A plain replace: this runs once, at launch, before the visitor has done anything (and needs no router).
    if (isStandalone() && window.location.pathname === "/") window.location.replace(SIGN_IN_HREF);
  }, []);
  return null;
}
