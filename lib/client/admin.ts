"use client";

import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { api, HttpError } from "@/lib/client/api";
import type { Permission, Role } from "@/lib/admin/roles";

/** TanStack Query hooks for /api/admin. The admin session cookie rides along; the server decides everything. */

export interface AdminMe {
  id: string;
  email: string | null;
  role: Role;
  permissions: Permission[];
  counts: { puzzles: number; moderation: number | null; schools: number | null };
}
export const useAdminMe = () => useQuery({ queryKey: ["admin", "me"], queryFn: () => api<AdminMe>("/api/admin/me"), staleTime: 60_000 });

export function useAdminQuery<T>(key: QueryKey, path: string | null, opts: { refetchInterval?: number } = {}) {
  return useQuery({
    queryKey: ["admin", ...key],
    queryFn: () => api<T>(path!),
    enabled: !!path,
    retry: (n, e) => !(e instanceof HttpError && e.status < 500) && n < 1,
    refetchInterval: opts.refetchInterval,
  });
}

/** POST/PATCH/PUT to an admin route, then refresh every admin query (lists, counts and the audit log). */
export function useAdminAction<I, O = unknown>(method: "POST" | "PATCH" | "PUT", path: string | ((input: I) => string)) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: I) => api<O>(typeof path === "function" ? path(input) : path, { method, json: input }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
}

/** Human copy for API error codes. */
export function errorText(e: unknown): string {
  if (!(e instanceof HttpError)) return "Something went wrong. Try again.";
  const map: Record<string, string> = {
    forbidden: "Your role cannot do this.",
    aal2_required: "Confirm your authenticator code to continue.",
    unauthenticated: "Your session ended. Sign in again.",
    not_admin: "This account has no admin role.",
    locked: "This Daily is locked.",
    own_item: "A second person must review this item.",
    check_failed: "The solve-check failed. See the checks.",
    invalid_payload: "The payload does not match this game's format.",
    nickname_taken: "That nickname is taken.",
    not_flagged: "This score was already resolved.",
  };
  return e.message && e.message !== e.code ? e.message : (map[e.code] ?? `Request failed (${e.code}).`);
}
