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
};
