/** Player-facing copy for age: the birth month and year step, the one-time ask for players from before, Settings. */
export const ageCopy = {
  months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  /** The month buttons on the birth step show these; screen readers hear the full name. */
  monthsShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  bands: { "13-15": "13 to 15", "16-17": "16 to 17", "18+": "18 or older" } as Record<string, string>,

  /** Onboarding step, straight after choosing how to start (guest, Google, email). */
  greeting: "Akwaaba, Spuzler.",
  title: "When were you born?",
  why: "It sets what's on for your age, to keep SPUZL safe. Never shown to anyone.",
  /** R2-09: honest that it's set once, and why, without the warning tone. */
  lockedNote: "Set once, so use your real month and year.",
  month: "Month",
  year: "Year",
  pickMonth: "Pick a month",
  pickYear: "Pick a year",
  /** R2-09: the year is a 4-digit field */
  yearPlaceholder: "YYYY",
  yearHelp: "Type all four digits of the year.",
  continue: "Continue",
  /** R2-09: the Continue button's accessible name says what it does (starts with the visible word). */
  continueLabel: "Continue with this birth month and year",
  future: "That's in the future. Check the month and year.",

  /** Under 13: no profile, nothing kept. */
  under13Title: "SPUZL is for 13 and up",
  under13Body: "Come back when you turn 13. We haven't kept anything you entered.",
  back: "Back",

  /** API messages (shown as they are). */
  locked: "Your birth month and year are already set. Contact us if they are wrong.",
  tooYoung: "SPUZL is for 13 and up.",
  birthInvalid: "Pick a real month and year.",
  birthRequired: "Tell us your birth month and year to start.",

  /** Once, for players who joined before birth month and year were asked. */
  ask: {
    title: "When were you born?",
    body: "Month and year only, for the age rules. Asked once; it can't be changed.",
    save: "Save",
    saving: "Saving…",
    later: "Not now",
    saved: "Saved. Thanks!",
    failed: "Couldn't save. Try again.",
  },

  /** Settings: the band, read-only. */
  settings: {
    title: "Age",
    row: "Age group",
    contact: "Contact us if this is wrong.",
    add: "Add your birth month and year",
  },
} as const;
