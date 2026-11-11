/** Copy for the shared controls in components/ui (Modal, Select, DateField), in the player app and the admin. */
export const uiCopy = {
  close: "Close",
  select: {
    placeholder: "Pick one",
  },
  date: {
    placeholder: "Pick a date",
    timePlaceholder: "Time",
    time: "Time",
    previousMonth: "Previous month",
    nextMonth: "Next month",
    today: "Today",
    clear: "Clear",
    calendar: (month: string) => `Calendar, ${month}`,
    months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    monthsShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    /** Monday first, as in Ghana and the UK. */
    weekdays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    weekdaysShort: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    weekdaysNarrow: ["M", "T", "W", "T", "F", "S", "S"],
  },
} as const;
