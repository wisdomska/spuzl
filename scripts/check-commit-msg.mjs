#!/usr/bin/env node
// Rejects AI attribution in commit messages. Used by the Husky commit-msg hook and by CI over every PR commit.
import fs from "node:fs";

export const FORBIDDEN = /co-authored-by|generated with|claude|anthropic/i;

const file = process.argv[2];
if (file) {
  const msg = fs.readFileSync(file, "utf8");
  if (FORBIDDEN.test(msg)) {
    console.error("commit-msg: AI attribution is not allowed in commit messages (Co-Authored-By, Generated with, Claude, Anthropic).");
    process.exit(1);
  }
}
