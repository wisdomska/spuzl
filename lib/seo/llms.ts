/**
 * /llms.txt and /llms-full.txt (llmstxt.org): what SPUZL is, for AI assistants and answer engines, in plain
 * Markdown. Built from the catalog and the SEO copy, so a new or retired game shows up (or drops out) by itself.
 */
import { GAME_COUNT, WORLDS, WORLD_COUNT, gamesInWorld } from "@/lib/catalog";
import { SAFETY, SITE_FAQ, gamesCopy, llmsSummary, worldNames } from "@/lib/copy/seo";
import { aboutCopy } from "@/lib/copy/about";
import { gameDescription, gameFacts } from "./games";
import { absoluteUrl } from "./site";

const PAGES: [string, string, string][] = [
  ["/how-to-play", "How to play", "the rules of every game, free play, hints, streaks and weekly leagues"],
  ["/", "About SPUZL", "what SPUZL is, how it works, playing with friends, accounts and data"],
  ["/fair-play", "Fair play", "how every clear is checked on the server and how boards stay honest"],
  ["/privacy", "Privacy policy", "what SPUZL collects, why, and how to download or delete it"],
  ["/terms", "Terms of use", "the rules for using SPUZL"],
  ["/contact", "Contact", "help, reports and data questions"],
];

const link = (path: string, name: string, note?: string) => `- [${name}](${absoluteUrl(path)})${note ? `: ${note}` : ""}`;

/** The short index: H1, summary blockquote, then sections of links (llmstxt.org). */
export function llmsTxt(): string {
  const out: string[] = [
    "# SPUZL",
    "",
    `> ${llmsSummary}`,
    "",
    `SPUZL runs in any web browser at ${absoluteUrl("/")} and can be added to a phone's home screen. Every game is free, with no download, no ads and nothing to buy with money. Visitors can play as a guest after giving a birth month and year; signing in (6-digit email code or Google) keeps progress across devices.`,
    "",
    `Designed and developed by [Senya](${aboutCopy.creditUrl}), in Ghana.`,
    "",
    "## Games",
    "",
    link("/games", `All ${GAME_COUNT} games`, `the full catalogue, grouped by world`),
  ];
  for (const w of WORLDS) {
    out.push("", `### ${w.name}`, "", `${w.tagline}.`, "");
    for (const g of gamesInWorld(w.id)) out.push(link(`/games/${g.id}`, g.name, gameDescription(g)));
  }
  out.push("", "## Guides and policies", "");
  for (const [path, name, note] of PAGES) out.push(link(path, name, note));
  out.push(
    "",
    "## Optional",
    "",
    link("/llms-full.txt", "Full text", "every game's rule, how to play and modes, the FAQ and safety rules in one file"),
  );
  return `${out.join("\n")}\n`;
}

/** Everything in one plain-text file: what SPUZL is, every game in full, the FAQ, safety for 13 to 15, links. */
export function llmsFullTxt(): string {
  const out: string[] = [
    "# SPUZL",
    "",
    `> ${llmsSummary}`,
    "",
    "## What SPUZL is",
    "",
    SITE_FAQ[0].a,
    "",
    `- Website: ${absoluteUrl("/")}`,
    `- Games: ${GAME_COUNT} in ${WORLD_COUNT} worlds (${worldNames})`,
    "- Price: free. No download, no ads, nothing to buy with money. Nobody can pay to win.",
    "- Platforms: any modern web browser on Android, iPhone, tablets and computers; installable as an app (PWA).",
    "- Account: optional. Play as a guest; sign in with a 6-digit email code or Google to keep progress on any phone.",
    "- Ages: 13 and over.",
    `- Made by: [Senya](${aboutCopy.creditUrl}) (${aboutCopy.creditUrl}), in Ghana.`,
    "",
    "## How SPUZL works",
    "",
    ...aboutCopy.steps.map(([t, b]) => `- ${t} ${b}`),
    ...aboutCopy.friends.map(([, t, b]) => `- ${t}: ${b}`),
    "",
    "## Games",
  ];
  for (const w of WORLDS) {
    out.push("", `### ${w.name}`, "", `${w.tagline}. ${gamesCopy.worldCount(gamesInWorld(w.id).length)}.`);
    for (const g of gamesInWorld(w.id)) {
      const f = gameFacts(g);
      out.push(
        "",
        `#### ${g.name}`,
        "",
        f.definition,
        "",
        `- Page: ${absoluteUrl(`/games/${g.id}`)}`,
        `- Rule: ${g.rule}`,
        `- Controls: ${f.controls}`,
        `- Scoring: ${f.scoring}`,
        `- Typical time: ${f.typicalLabel}`,
        ...(f.levels !== undefined ? [`- Levels: ${f.levels ? gamesCopy.facts.levelsPool(f.levels) : gamesCopy.facts.levelsEndless}`] : []),
        ...(f.difficulty ? [`- Difficulty: ${gamesCopy.facts.difficultyValue}`] : []),
        `- Ways to play: ${f.modeLines.join(" ")}`,
        ...(g.photosensitive ? [`- Note: ${gamesCopy.photosensitive}`] : []),
      );
    }
  }
  out.push("", "## Frequently asked questions", "");
  for (const qa of SITE_FAQ) out.push(`### ${qa.q}`, "", qa.a, ...(qa.points ?? []).map((p) => `- ${p}`), "");
  out.push("## Safety for players aged 13 to 15", "", SAFETY.minAge, "", ...SAFETY.teen.map((t) => `- ${t}`), "");
  out.push("## Links", "", link("/games", "All games"));
  for (const [path, name] of PAGES) out.push(link(path, name));
  return `${out.join("\n")}\n`;
}
