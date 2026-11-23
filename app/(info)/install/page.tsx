import type { Metadata } from "next";
import { InstallGuide } from "@/components/pwa/InstallGuide";
import { publicMetadata } from "@/lib/seo/site";

export const metadata: Metadata = publicMetadata({
  path: "/install",
  title: "Install SPUZL on your phone or computer | SPUZL",
  description:
    "Put SPUZL on your home screen in 20 seconds: it opens like an app, full screen, with alerts for your turns and invites. iPhone, Android and computer steps.",
});

/** /install: put SPUZL on the home screen (Settings and the alerts ask link here). */
export default function InstallPage() {
  return <InstallGuide />;
}
