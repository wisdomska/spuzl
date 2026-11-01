import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PODIUM } from "@/components/multiplayer/ui";

const root = path.resolve(__dirname, "../../..");
const party = readFileSync(path.join(root, "components/multiplayer/party.tsx"), "utf8");
const tokens = readFileSync(path.join(root, "styles/spuzl-tokens.css"), "utf8");
const defined = new Set([...tokens.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));

describe("Party colours", () => {
  it("uses design tokens, not raw hex", () => {
    expect(party.match(/#[0-9a-f]{3,8}\b/gi)).toBeNull();
    for (const c of PODIUM) expect(c).toMatch(/^var\(--pos-\d\)$/);
  });

  it("every token it names is defined", () => {
    const used = new Set([...party.matchAll(/var\((--[\w-]+[\w])\)/g)].map((m) => m[1]));
    for (let k = 1; k <= 7; k++) used.add(`--confetti-${k}`);
    for (const name of ["--qr-dark", "--qr-light", "--pos-1", "--pos-2", "--pos-3"]) used.add(name);
    const missing = [...used].filter((name) => !defined.has(name) && !name.startsWith("--world") && !name.startsWith("--btn"));
    expect(missing).toEqual([]);
  });

  it("keeps the QR code dark on white in both themes", () => {
    const light = tokens.slice(tokens.indexOf('[data-theme="light"] {'));
    expect(tokens).toMatch(/--qr-dark: #0e0f1a;/);
    expect(tokens).toMatch(/--qr-light: #ffffff;/);
    expect(light.slice(0, light.indexOf("}"))).not.toMatch(/--qr-/);
  });
});
