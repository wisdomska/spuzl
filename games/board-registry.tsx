"use client";

/** Client board components (next/dynamic options must be an inline object literal) by id. Each game is its own chunk (NFR-PF-05: per-game chunk under 80 KB). */
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { BoardProps } from "./types";
import { BoardSkeleton } from "@/components/game/BoardSkeleton";

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
};
