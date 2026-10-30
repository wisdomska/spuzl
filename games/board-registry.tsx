"use client";

/** Client board components (next/dynamic options must be an inline object literal) by id. Each game is its own chunk (NFR-PF-05: per-game chunk under 80 KB). */
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { BoardProps } from "./types";
import { BoardSkeleton } from "@/components/game/BoardSkeleton";

type AnyBoard = ComponentType<BoardProps<any, any>>; // eslint-disable-line @typescript-eslint/no-explicit-any

export const BOARDS: Record<string, AnyBoard> = {
  crownfall: dynamic(() => import("./crownfall/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  quilt: dynamic(() => import("./quilt/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  deadon: dynamic(() => import("./deadon/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  snug: dynamic(() => import("./snug/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  shuffle: dynamic(() => import("./shuffle/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  reflect: dynamic(() => import("./reflect/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  squint: dynamic(() => import("./squint/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  merge: dynamic(() => import("./merge/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  sums: dynamic(() => import("./sums/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
};
