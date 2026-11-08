/** Private and per-player paths kept out of crawling: the admin console, the API, player profiles, live rooms, dev tools. */
export const PRIVATE_PATHS = ["/admin", "/api/", "/u/", "/bay/", "/party/", "/duel/", "/challenge/", "/i/", "/dev/", "/auth/"];

/**
 * AI search and answer crawlers, named in robots.txt with their own allow group so SPUZL can be found and quoted
 * by AI answers (GEO). They read every public page, with the same private paths kept out.
 */
export const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-Web",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
];
