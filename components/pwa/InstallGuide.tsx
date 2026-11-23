"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { alertsAllowed, alertsSupported, askAlerts } from "@/lib/client/alerts";
import { isStandalone, platform, promptInstall, useInstallState } from "@/lib/pwa/install";

type Tab = "android" | "iphone" | "computer" | "done";

const STEPS: Record<Exclude<Tab, "done">, [string, string][]> = {
  android: [
    ["1", "Tap the three dots in Chrome (top right)"],
    ["2", "Choose Install app, or Add to Home screen"],
    ["3", "Open SPUZL from your home screen"],
  ],
  iphone: [
    ["1", "Open this page in Safari"],
    ["2", "Tap Share, then Add to Home Screen"],
    ["3", "Open SPUZL from your home screen"],
  ],
  computer: [
    ["1", "In Chrome or Edge, click the install icon at the end of the address bar"],
    ["2", "Choose Install"],
    ["3", "SPUZL opens in its own window, and stays in your apps"],
  ],
};

const PICTURE: Record<Exclude<Tab, "done">, { from: string; to: string; label: string }> = {
  android: { from: "dots-three-vertical", to: "download-simple", label: "Menu, then Install app" },
  iphone: { from: "export", to: "plus-square", label: "Share, then Add to Home Screen" },
  computer: { from: "app-window", to: "download-simple", label: "Install icon, then Install" },
};

const NOTE: Record<Exclude<Tab, "done">, string> = {
  android: "Works in Chrome, Edge and Samsung Internet.",
  iphone: "Alerts on iPhone need iOS 16.4 or later, and SPUZL opened from the home screen.",
  computer: "Works in Chrome and Edge on Windows, Mac and Linux.",
};

/**
 * Put SPUZL on your home screen (owner, 23 Nov 2026, from Clink): the steps for this device (iPhone: Share, then Add
 * to Home Screen; Android: the menu, then Install app), the one-tap Install where the browser allows it, and once
 * installed, the alerts ask, so a turn or an invite reaches the player like a text.
 */
export function InstallGuide() {
  const state = useInstallState();
  const [picked, setPicked] = useState<Tab | null>(null);
  // Known only in the browser: until then the first tab, so the server and first client render agree.
  const [detected, setDetected] = useState<Tab>("android");
  const [alerts, setAlerts] = useState<"on" | "off" | "unsupported" | null>(null);
  useEffect(() => {
    const p = platform();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the device is only known on the client
    setDetected(isStandalone() ? "done" : p === "ios" ? "iphone" : p === "android" ? "android" : "computer");
    setAlerts(alertsSupported() ? (alertsAllowed() ? "on" : "off") : "unsupported");
  }, []);
  const tab: Tab = state === "installed" && !picked ? "done" : (picked ?? detected);

  return (
    <div className="flex flex-col gap-5" data-install-guide>
      <div className="flex flex-col gap-2">
        <h1>Put SPUZL on your home screen</h1>
        <p className="text-muted text-[17px]">
          It opens like an app, full screen, and your turns and invites arrive like texts. Takes 20 seconds.
        </p>
      </div>
      <div className="bg-surface flex gap-1 rounded-[16px] p-1" role="radiogroup" aria-label="Your device">
        {(
          [
            ["android", "Android"],
            ["iphone", "iPhone"],
            ["computer", "Computer"],
            ["done", "Installed"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={tab === v}
            onClick={() => setPicked(v)}
            className="press flex min-h-11 flex-1 items-center justify-center rounded-[12px] px-1 text-[14px] font-semibold"
            style={tab === v ? { background: "var(--surface-raised)" } : { color: "var(--text-muted)" }}
          >
            {label}
          </button>
        ))}
      </div>
      {tab !== "done" ? (
        <div key={tab} className="flex flex-col gap-5">
          <div className="bg-surface flex h-[160px] flex-col items-center justify-center gap-3 rounded-[20px]" aria-hidden>
            <div className="flex items-center gap-3">
              <Icon name={PICTURE[tab].from} size={40} />
              <Icon name="arrow-right" size={20} className="text-muted" />
              <Icon name={PICTURE[tab].to} size={40} />
            </div>
            <span className="text-muted text-[14px]">{PICTURE[tab].label}</span>
          </div>
          <ol className="m-0 flex list-none flex-col gap-3.5 p-0" aria-label="Steps">
            {STEPS[tab].map(([n, t]) => (
              <li key={n} className="flex items-center gap-3">
                <span className="bg-surface num flex size-8 flex-none items-center justify-center rounded-full text-[14px] font-semibold">
                  {n}
                </span>
                <span className="text-[16px] leading-[1.4]">{t}</span>
              </li>
            ))}
          </ol>
          <p className="text-muted m-0 text-[14px]">{NOTE[tab]}</p>
          {state === "prompt" && tab !== "iphone" && (
            <Button
              size="lg"
              icon="download-simple"
              onClick={async () => {
                if (await promptInstall()) setPicked("done");
              }}
            >
              Install SPUZL now
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3" role="status">
          <Icon name="check-circle" size={48} className="text-accent" />
          <p className="font-display m-0 text-[24px] leading-tight font-black">SPUZL is on your home screen.</p>
          {alerts === "on" ? (
            <p className="text-muted m-0">Alerts are on: your turns and invites will find you.</p>
          ) : alerts === "off" ? (
            <>
              <p className="text-muted m-0">Turn on alerts so a turn or an invite reaches you while SPUZL is closed.</p>
              <Button variant="secondary" icon="bell-ringing" onClick={async () => setAlerts((await askAlerts()) ? "on" : "off")}>
                Turn on alerts
              </Button>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
