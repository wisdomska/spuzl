/** Player-facing copy for age: the birth month and year step, the one-time ask for players from before, Settings. */
export const ageCopy = {
  months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  bands: { "13-15": "13 to 15", "16-17": "16 to 17", "18+": "18 or older" } as Record<string, string>,

  /** Onboarding step, straight after choosing how to start (guest, Google, email). */
  greeting: "Akwaaba, Spuzler.",
  title: "When were you born?",
  why: "Your birth month and year set what's on for your age, to keep SPUZL safe and fair. We never show them to anyone.",
  lockedNote: "You can't change this later, so pick carefully.",
  month: "Month",
  year: "Year",
  pickMonth: "Pick a month",
  pickYear: "Pick a year",
  continue: "Continue",
  future: "That's in the future. Check the month and year.",

  /** Under 13: no profile, nothing kept. */
  under13Title: "SPUZL is for 13 and up",
  under13Body: "Come back when you turn 13. Spuz will keep your seat warm. We haven't kept anything you entered.",
  back: "Back",

  /** API messages (shown as they are). */
  locked: "Your birth month and year are already set. Contact us if they are wrong.",
  tooYoung: "SPUZL is for 13 and up.",
  birthInvalid: "Pick a real month and year.",
  birthRequired: "Tell us your birth month and year to start.",

  /** Once, for players who joined before birth month and year were asked. */
  ask: {
    title: "When were you born?",
    body: "We now keep your birth month and year (never the day) to apply the age rules. It's asked once and can't be changed later.",
    save: "Save",
    saving: "Saving…",
    later: "Not now",
    saved: "Saved. Thanks!",
    failed: "Couldn't save. Check your connection and try again.",
  },

  /** Settings: the band, read-only. */
  settings: {
    title: "Age",
    row: "Age group",
    contact: "Contact us if this is wrong.",
    contactLink: "Contact us",
    add: "Add your birth month and year",
  },
} as const;
