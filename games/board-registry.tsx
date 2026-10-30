"use client";

/** Client board components (next/dynamic options must be an inline object literal) by id. Each game is its own chunk (NFR-PF-05: per-game chunk under 80 KB). */
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { BoardProps } from "./types";
import { BoardSkeleton } from "@/components/game/BoardSkeleton";

type AnyBoard = ComponentType<BoardProps<any, any>>; // eslint-disable-line @typescript-eslint/no-explicit-any

export const BOARDS: Record<string, AnyBoard> = {
  crownfall: dynamic(() => import("./crownfall/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  coil: dynamic(() => import("./coil/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  quads: dynamic(() => import("./quads/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  rungs: dynamic(() => import("./rungs/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  minicross: dynamic(() => import("./minicross/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  seven: dynamic(() => import("./seven/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  buried: dynamic(() => import("./buried/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
  remix: dynamic(() => import("./remix/Board"), { ssr: false, loading: () => <BoardSkeleton /> }),
};
