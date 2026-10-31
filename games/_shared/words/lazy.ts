/** Client-side, lazy-loaded word list: the packed data is its own chunk, fetched on first use. */
import { unpack } from "./pack";

let pending: Promise<Set<string>> | null = null;

export function loadWords(): Promise<Set<string>> {
  pending ??= import("./en.data").then((m) => new Set(unpack(m.PACKED)));
  return pending;
}
