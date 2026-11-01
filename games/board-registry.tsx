"use client";

/** Client board components (next/dynamic options must be an inline object literal) by id. Each game is its own chunk (NFR-PF-05: per-game chunk under 80 KB). */
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { BoardProps } from "./types";
import { BoardSkeleton } from "@/components/game/BoardSkeleton";
import { RagePoster } from "@/phaser/RagePoster";

type AnyBoard = ComponentType<BoardProps<any, any>>; // eslint-disable-line @typescript-eslint/no-explicit-any

export const BOARDS: Record<string, AnyBoard> = {
  crownfall: dynamic(() => import("./crownfall/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  dusk: dynamic(() => import("./dusk/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  sixer: dynamic(() => import("./sixer/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  nine: dynamic(() => import("./nine/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  pixl: dynamic(() => import("./pixl/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  blackout: dynamic(() => import("./blackout/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  tripwire: dynamic(() => import("./tripwire/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  chess: dynamic(() => import("./chess/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  draughts: dynamic(() => import("./draughts/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  oware: dynamic(() => import("./oware/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  fourup: dynamic(() => import("./fourup/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  flip: dynamic(() => import("./flip/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  ludo: dynamic(() => import("./ludo/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  weave: dynamic(() => import("./weave/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  flowline: dynamic(() => import("./flowline/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  isles: dynamic(() => import("./isles/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  pairup: dynamic(() => import("./pairup/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  lost: dynamic(() => import("./lost/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  hunch: dynamic(() => import("./hunch/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  echo: dynamic(() => import("./echo/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  twins: dynamic(() => import("./twins/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  flinch: dynamic(() => import("./flinch/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  quickfire: dynamic(() => import("./quickfire/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  flagged: dynamic(() => import("./flagged/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  pinned: dynamic(() => import("./pinned/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  quilt: dynamic(() => import("./quilt/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  deadon: dynamic(() => import("./deadon/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  snug: dynamic(() => import("./snug/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  shuffle: dynamic(() => import("./shuffle/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  reflect: dynamic(() => import("./reflect/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  squint: dynamic(() => import("./squint/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  merge: dynamic(() => import("./merge/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  sums: dynamic(() => import("./sums/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  equal: dynamic(() => import("./equal/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  // Rage Ridge: a poster frame of the night scene while the board (then Phaser) loads, never a black box.
  gotcha: dynamic(() => import("./gotcha/Board"), { ssr: false, loading: () => <RagePoster /> }),
  dash: dynamic(() => import("./dash/Board"), { ssr: false, loading: () => <RagePoster /> }),
  flipside: dynamic(() => import("./flipside/Board"), { ssr: false, loading: () => <RagePoster tall /> }),
  ricochet: dynamic(() => import("./ricochet/Board"), { ssr: false, loading: () => <RagePoster tall /> }),
  stacked: dynamic(() => import("./stacked/Board"), { ssr: false, loading: () => <RagePoster tall /> }),
  wobble: dynamic(() => import("./wobble/Board"), { ssr: false, loading: () => <RagePoster /> }),
  grapple: dynamic(() => import("./grapple/Board"), { ssr: false, loading: () => <RagePoster tall /> }),
  ghosted: dynamic(() => import("./ghosted/Board"), { ssr: false, loading: () => <RagePoster tall /> }),
  slip: dynamic(() => import("./slip/Board"), { ssr: false, loading: () => <RagePoster tall /> }),
  gauntlet: dynamic(() => import("./gauntlet/Board"), { ssr: false, loading: () => <RagePoster /> }),
  coil: dynamic(() => import("./coil/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  quads: dynamic(() => import("./quads/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  rungs: dynamic(() => import("./rungs/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  minicross: dynamic(() => import("./minicross/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  seven: dynamic(() => import("./seven/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  buried: dynamic(() => import("./buried/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  remix: dynamic(() => import("./remix/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  penalty: dynamic(() => import("./penalty/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  beattap: dynamic(() => import("./beattap/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  hilo: dynamic(() => import("./hilo/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  market: dynamic(() => import("./market/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  five: dynamic(() => import("./five/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  emojihits: dynamic(() => import("./emojihits/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  trotro: dynamic(() => import("./trotro/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  lightup: dynamic(() => import("./lightup/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
};
