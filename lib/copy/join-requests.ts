/** R2-13: friends-only rooms for under-16 hosts, and requests to join them. */
export const joinRequestsCopy = {
  /** the server's answer to a non-friend joining by code */
  friendsOnly: "This room is for the host's friends only. Ask to join and the host can let you in.",
  friendsOnlyTitle: (host: string | null) => (host ? `${host}'s room is friends only` : "This room is friends only"),
  /** R4-02: a Board Bay invite from an under-16 host, opened by someone who isn't their friend */
  bayFriendsOnly: "This game is for the host's friends only. Ask them to add you as a friend, then join.",
  friendsOnlyBody: "Only the host's friends can join straight away. Send a request and the host can let you in.",
  ask: "Request to join",
  asking: "Sending your request…",
  waitingTitle: "Request sent",
  waiting: (host: string | null) => (host ? `Waiting for ${host} to let you in.` : "Waiting for the host to let you in."),
  approved: "You're in. Joining now…",
  declinedTitle: "Not this time",
  declined: "The host said no to this room. Try another room or ask them to add you as a friend.",
  cancel: "Cancel request",
  failed: "Couldn't send your request. Try again.",
  tooMany: "This room has lots of requests waiting. Try again in a bit.",
  gone: "That room has closed.",
  back: "Back",
  // Host side, in the lobby
  hostNote: "Friends only. Anyone else has to ask, and you decide.",
  hostTitle: (n: number) => (n === 1 ? "1 player wants to join" : `${n} players want to join`),
  hostAnnounce: (name: string) => `${name} wants to join your room`,
  wantsIn: "wants to join",
  approve: "Let in",
  approveAria: (name: string) => `Let ${name} in`,
  decline: "Say no",
  declineAria: (name: string) => `Say no to ${name}`,
  decideFailed: "Couldn't answer that request. Try again.",
  // R4-17: Home card, for a host who left the lobby
  homeTitle: (n: number) => (n === 1 ? "Someone wants to join your room" : `${n} players want to join your rooms`),
  homeWants: (kind: "duel" | "party", code: string) => (kind === "duel" ? `wants to join your duel ${code}` : `wants to join room ${code}`),
  backToRoom: "Back to the room",
  backToRoomAria: (code: string) => `Back to room ${code}`,
  letInDone: (name: string) => `${name} can join now.`,
} as const;
