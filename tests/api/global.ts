import teardownGuests from "./teardown";

/** Vitest global setup for the API tests: nothing to set up; the returned function runs once after every file. */
export default function setup() {
  return teardownGuests;
}
