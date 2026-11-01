import type { EventGoal } from "@/lib/events";

/**
 * Admin console copy. Staff-facing, so plainer than player copy, but kept here for the same reasons: one place
 * to change wording, no strings inline in JSX.
 */
export const adminCopy = {
  common: {
    on: "On",
    off: "Off",
    savedAndLogged: "Saved and logged.",
    anyStatus: "Any status",
    allGames: "All games",
    status: "Status",
    game: "Game",
    /** Status ids (in_review) as words (in review). */
    statusLabel: (s: string) => s.replace(/_/g, " "),
  },

  /** Pagination bar under every admin list. */
  pagination: {
    label: "Pagination",
    showing: (first: string, last: string, total: string) => `Showing ${first}–${last} of ${total}`,
    rows: "Rows",
    previous: "Previous",
    previousAria: "Previous page",
    next: "Next",
    nextAria: "Next page",
    pageAria: (n: number) => `Page ${n}`,
    first: "First",
    firstAria: "First page",
    last: "Last",
    lastAria: (n: string) => `Last page, ${n}`,
    gap: "More pages",
    page: "Page",
    jumpAria: "Jump to page",
    of: (pages: string) => `of ${pages}`,
    go: "Go",
    noRows: "No rows",
  },

  /** Sortable column headers. */
  sort: {
    /** Screen-reader hint on a header button: what pressing it does next. */
    by: (column: string, next: "ascending" | "descending") => `Sort by ${column}, ${next}`,
  },

  puzzles: {
    title: "Puzzles",
    total: (n: string) => `${n} total`,
    empty: "No puzzles match.",
    head: ["Game", "Difficulty", "Grade", "Status", "Source", "Daily", "Checked"],
    noDaily: "none",
    neverChecked: "never",
  },

  moderation: {
    title: "Moderation queue",
    queue: "Queue",
    tabs: { reports: "Reports", nicknames: "Nicknames", flagged: "Anti-cheat" },
    open: (n: number) => `${n} open`,
    showing: "Showing",
    statuses: { open: "Open", actioned: "Actioned", dismissed: "Dismissed", all: "All" },
    empty: "Nothing waiting here.",
    emptyOthers: (n: number) => `Nothing in this tab. ${n} waiting in the other tabs.`,
    head: ["ID", "Report", "Kind", "Status", "Age"],
    caseLabel: "Case",
    pickCase: "Pick a case to review.",
  },

  content: {
    title: "Content",
    views: "Content views",
    tabs: { items: "Written items", files: "content.ts review" },
    newItem: "New item",
    emptyItems: "No written items yet.",
    itemsHead: ["Game", "Item", "Status", "Author", "Updated"],
    untitled: "Untitled",
    you: "you",
    editor: "editor",
    filesIntro: "Every content.ts below is marked needsReview.",
    filesOwner: "Approve entries to record your review.",
    filesNotOwner: "Only the owner can approve these.",
    show: "Show",
    showTabs: { todo: "To review", all: "All" },
    reject: (n: number) => `Reject ${n || ""}`.trim(),
    approve: (n: number) => `Approve ${n || ""}`.trim(),
    nothingLeft: (game: string) => `Nothing left to review for ${game}.`,
    selectAll: "Select all on this page",
    selectEntry: (i: number) => `Select entry ${i}`,
    entryHead: { index: "#", entry: "Entry", state: "State" },
    changedSince: "changed since",
  },

  shop: {
    title: "Shop and events",
    catalogue: "Catalogue",
    tabs: { cosmetics: "Cosmetics and prices", badges: "Badges", quests: "Quests" },
    ownerPrices: "Only the owner changes Sparks prices.",
    cosmeticsHead: ["Item", "Type", "Rarity", "Price (Sparks)", "In shop"],
    badgesHead: ["Badge", "Family", "Tier", "Sparks", "Secret"],
    questsHead: ["Quest", "Kind", "XP", "Sparks", "Active"],
    fieldAria: (item: string, field: string) => `${item} ${field.replace(/_/g, " ")}`,
    inShopAria: (name: string) => `${name} in shop`,
    secretAria: (name: string) => `${name} secret`,
    activeAria: (title: string) => `${title} active`,
  },

  audit: {
    title: "Audit log",
    intro: "Every admin action, newest first. Append-only.",
    who: "Who",
    anyone: "Anyone",
    system: "System (cron)",
    systemShort: "system",
    actionStarts: "Action starts with",
    actionPlaceholder: "daily.",
    targetContains: "Target contains",
    targetPlaceholder: "crownfall",
    from: "From",
    to: "To",
    empty: "No actions match.",
    head: ["When (GMT)", "Who", "Action", "Target", "Detail"],
  },

  /** Seasonal event bonus quests, listed in the Shop and events quest catalogue. */
  eventQuests: {
    heading: "Event quests",
    intro: "Each seasonal event's bonus quest, counted from free-play clears while the event runs.",
    editHere: "Change XP and Sparks here. Dates, goal and banner are on Seasonal events.",
    readOnly: "Read only for your role.",
    manage: "Open Seasonal events",
    empty: "No seasonal events yet.",
    head: ["Quest", "Event", "Runs", "Goal", "XP", "Sparks"],
    runs: (from: string, to: string) => `${from} to ${to}`,
    goal: {
      free_clears: (n: number) => `Clear ${n} free-play puzzles`,
      world_clears: (n: number, world: string) => `Clear ${n} free-play puzzles in ${world}`,
      no_hint_clears: (n: number) => `Clear ${n} free-play puzzles without hints`,
    } satisfies Record<EventGoal, (n: number, world: string) => string>,
    fieldLabel: (title: string, field: "XP" | "Sparks") => `${title} ${field}`,
    latestOnly: (shown: number, total: number) => `Showing the latest ${shown} of ${total} events.`,
  },
} as const;
