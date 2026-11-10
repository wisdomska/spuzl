"use client";

import { MatchEnd, RoundEnd } from "@/components/multiplayer/duel";
import { Screen } from "@/components/multiplayer/ui";
import type { MatchPlayerView, MatchView } from "@/lib/multiplayer/types";

const player = (id: string, nickname: string, color: string, roundsWon: number, rating: number): MatchPlayerView => ({
  id,
  nickname,
  color,
  hat: id === "me" ? "shades" : null,
  level: 12,
  country: null,
  city: null,
  rating,
  seat: id === "me" ? 0 : 1,
  ready: true,
  roundsWon,
  points: 0,
  progress: 1,
  mistakes: 0,
  finishedMs: null,
  place: null,
  host: id === "me",
  spectator: false,
  left: false,
  stale: false,
  passed: false,
  rematch: false,
  ratingBefore: rating - 14,
  ratingAfter: rating,
});

const noop = () => {};

export function DevDuel({ screen, won, long }: { screen: "round" | "end"; won: boolean; long: boolean }) {
  const nick = long ? "Abenaa_Puzzlequeen" : "Kofi";
  const me = player("me", "Senya", "#C8F03C", won ? 2 : 1, 1214);
  const them = player("them", nick, "#FF9E7A", won ? 1 : 2, 1180);
  const rounds = [1, 2, 3].flatMap((round) => {
    const meWins = won ? round !== 2 : round === 2;
    return [
      { round, playerId: "me", gameId: "sixer", timeMs: 41_200 + round * 3000, mistakes: 0, place: null, points: 0, won: meWins },
      { round, playerId: "them", gameId: "sixer", timeMs: 44_900 + round * 2000, mistakes: 1, place: null, points: 0, won: !meWins },
    ];
  });
  const view = {
    id: "dev",
    kind: "duel",
    status: "finished",
    round: 3,
    bestOf: 3,
    setNo: 1,
    rated: true,
    isBot: false,
    winnerId: won ? "me" : "them",
    result: "win",
    me: "me",
    players: [me, them],
    rounds,
    bot: null,
    reward: { xp: won ? 40 : 10, sparks: 5 },
    h2h: long ? { me: 4, them: 3, draws: 1, played: 8 } : null,
  } as unknown as MatchView;
  return (
    <Screen label="Dev duel">
      {screen === "end" ? (
        <MatchEnd
          view={view}
          me={me}
          them={{ id: "them", nickname: nick, color: them.color, roundsWon: them.roundsWon }}
          onRematch={noop}
          onShare={noop}
          onHome={noop}
          onChat={noop}
          rematchWaiting={false}
          theyWantRematch={long}
        />
      ) : (
        <RoundEnd
          round={1}
          meWon={won}
          draw={false}
          me={{ nickname: "Senya", color: me.color, hat: "shades" }}
          them={{ nickname: nick, color: them.color }}
          myMs={44_200}
          theirMs={46_900}
          rounds={[won ? "me" : "them"]}
          oppColor={them.color}
          msToNext={4000}
          totalMs={8000}
          note={long ? `${nick} is reading the rules for the next game.` : null}
          onEmote={noop}
          onChat={noop}
          emote={null}
        />
      )}
    </Screen>
  );
}
