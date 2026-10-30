"use client";

/** Client board components (next/dynamic options must be an inline object literal) by id. Each game is its own chunk (NFR-PF-05: per-game chunk under 80 KB). */
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { BoardProps } from "./types";
import { BoardSkeleton } from "@/components/game/BoardSkeleton";

type AnyBoard = ComponentType<BoardProps<any, any>>; // eslint-disable-line @typescript-eslint/no-explicit-any

export const BOARDS: Record<string, AnyBoard> = {
  crownfall: dynamic(() => import("./crownfall/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  weave: dynamic(() => import("./weave/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  flowline: dynamic(() => import("./flowline/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  isles: dynamic(() => import("./isles/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  pairup: dynamic(() => import("./pairup/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  lost: dynamic(() => import("./lost/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
};
