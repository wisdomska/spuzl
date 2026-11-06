import { Welcome } from "../Welcome";

/**
 * R2-08: the landing page's "Play now". No logo intro and no second guest / Google / email choice: the visitor is
 * a guest and the first screen is "When were you born?" (the age gate decides the band, as on /welcome). A static
 * page, so the landing's links prefetch it whole. Sign-in stays on the landing header and in Settings.
 */
export default function WelcomePlayPage() {
  return <Welcome first="age" />;
}
