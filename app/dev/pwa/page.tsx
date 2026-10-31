import { devOnly } from "@/lib/dev/guard";
import { PwaFixture } from "./PwaFixture";

/** Fixture for the sharing, PWA and offline layer: banners, confetti, share sheet and an offline clear. */
export default function Page() {
  devOnly();
  return <PwaFixture />;
}
