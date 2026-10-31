"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * Offline clears (SRS: "clears made offline are queued and submitted when back online").
 *
 * Usage from the play page:
 *
 *   import { finishOrQueue } from "@/lib/offline/queue";
 *   const r = await finishOrQueue(attemptId, { state, activeMs, mistakes, deaths, relaxed });
 *   if (r.queued) showOfflineResults();   // the time is safe on the device, it syncs later
 *   else showResults(r.result);           // normal FinishRes from the server
 *
 * Lower level:
 * - `enqueueFinish(attemptId, payload)` stores the finish in IndexedDB with `finishedAt` = now.
 * - `flush()` posts every queued finish to /api/v1/attempts/:id/finish with `offline: true` and the
 *   original `finishedAt` (the server re-verifies and checks the day). Safe to call any time; calls
 *   share one run, and tabs share one lock.
 * - `useOnlineStatus()` is `navigator.onLine` as a hook.
 * - `useOfflineSync()` flushes on mount, when the browser comes back online and when the tab returns.
 * - `onSynced(fn)` / `usePendingCount()` let a screen update when a queued clear lands.
 *
 * One entry per attempt (the server is idempotent per attempt too). Entries are dropped once the
 * server answers for good (2xx, or a 4xx that retrying cannot fix); network errors, 401, 429 and
 * 5xx keep the entry for the next flush.
 */

export interface FinishPayload {
  state: unknown;
  activeMs: number;
  mistakes: number;
  deaths?: number;
  relaxed?: boolean;
  localHour?: number;
}

export interface QueuedFinish {
  attemptId: string;
  payload: FinishPayload;
  /** ISO time the clear happened on the device */
  finishedAt: string;
  queuedAt: string;
  tries: number;
  lastError?: string;
}

export interface SyncedFinish {
  attemptId: string;
  /** server FinishRes, or null when the server had already closed the attempt */
  result: unknown;
  status: number;
}

export interface FlushResult {
  synced: SyncedFinish[];
  /** dropped: the server refused them for good (for example a clear outside its day) */
  rejected: { attemptId: string; status: number; error: string }[];
  /** still queued (offline, server error, rate limited, signed out) */
  remaining: number;
}

const DB_NAME = "spuzl-offline";
const STORE = "finishes";
const ENDPOINT = (id: string) => `/api/v1/attempts/${encodeURIComponent(id)}/finish`;

/* ---------------- IndexedDB (tiny promise wrapper, no dependency) ---------------- */

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("indexeddb_unavailable"));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "attemptId" });
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  }).catch((e) => {
    dbPromise = null;
    throw e;
  });
  return dbPromise;
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await openDb();
  return new Promise<T | undefined>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = run(t.objectStore(STORE));
    t.oncomplete = () => resolve(req ? req.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export async function listQueued(): Promise<QueuedFinish[]> {
  const all = (await tx<QueuedFinish[]>("readonly", (s) => s.getAll() as IDBRequest<QueuedFinish[]>)) ?? [];
  return all.sort((a, b) => a.finishedAt.localeCompare(b.finishedAt));
}

async function put(item: QueuedFinish) {
  await tx("readwrite", (s) => s.put(item));
}

async function remove(attemptId: string) {
  await tx("readwrite", (s) => s.delete(attemptId));
}

/* ---------------- change notifications ---------------- */

type Listener = () => void;
const listeners = new Set<Listener>();
const syncedListeners = new Set<(s: SyncedFinish) => void>();
let pending = 0;

function emit() {
  for (const l of listeners) l();
}

async function refreshCount() {
  try {
    pending = (await listQueued()).length;
  } catch {
    pending = 0;
  }
  emit();
}

/** Subscribe to queued clears landing on the server. Returns an unsubscribe function. */
export function onSynced(fn: (s: SyncedFinish) => void): () => void {
  syncedListeners.add(fn);
  return () => syncedListeners.delete(fn);
}

/* ---------------- public API ---------------- */

/** Stores a finish made offline. `finishedAt` defaults to now (the moment of the clear). */
export async function enqueueFinish(attemptId: string, payload: FinishPayload, finishedAt: Date = new Date()): Promise<QueuedFinish> {
  const item: QueuedFinish = {
    attemptId,
    payload: { ...payload, localHour: payload.localHour ?? finishedAt.getHours() },
    finishedAt: finishedAt.toISOString(),
    queuedAt: new Date().toISOString(),
    tries: 0,
  };
  await put(item);
  await refreshCount();
  return item;
}

/** Statuses worth retrying later; every other non-2xx is final. */
const RETRY = new Set([401, 408, 425, 429]);

async function postOne(item: QueuedFinish): Promise<{ kind: "synced" | "rejected" | "retry"; status: number; body: unknown }> {
  let res: Response;
  try {
    res = await fetch(ENDPOINT(item.attemptId), {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...item.payload, offline: true, finishedAt: item.finishedAt }),
    });
  } catch {
    return { kind: "retry", status: 0, body: null };
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* empty or non-JSON body */
  }
  if (res.ok) return { kind: "synced", status: res.status, body };
  const code = (body as { error?: string } | null)?.error;
  // attempt_closed: an earlier flush (another tab, or a lost response) already landed it.
  if (res.status === 409 && code === "attempt_closed") return { kind: "synced", status: res.status, body: null };
  if (res.status === 409 && code === "no_profile") return { kind: "retry", status: res.status, body };
  if (RETRY.has(res.status) || res.status >= 500) return { kind: "retry", status: res.status, body };
  return { kind: "rejected", status: res.status, body };
}

async function runFlush(): Promise<FlushResult> {
  const out: FlushResult = { synced: [], rejected: [], remaining: 0 };
  let items: QueuedFinish[];
  try {
    items = await listQueued();
  } catch {
    return out;
  }
  for (const item of items) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      out.remaining++;
      continue;
    }
    const r = await postOne(item);
    if (r.kind === "synced") {
      await remove(item.attemptId);
      const s = { attemptId: item.attemptId, result: r.body, status: r.status };
      out.synced.push(s);
      for (const fn of syncedListeners) fn(s);
    } else if (r.kind === "rejected") {
      await remove(item.attemptId);
      out.rejected.push({ attemptId: item.attemptId, status: r.status, error: (r.body as { error?: string } | null)?.error ?? "error" });
    } else {
      await put({ ...item, tries: item.tries + 1, lastError: r.status ? `http_${r.status}` : "network" });
      out.remaining++;
    }
  }
  await refreshCount();
  return out;
}

let inFlight: Promise<FlushResult> | null = null;

/** Sends every queued finish. Concurrent calls share one run; tabs take turns via the Web Locks API. */
export function flush(): Promise<FlushResult> {
  if (inFlight) return inFlight;
  const locks = typeof navigator !== "undefined" ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
  const run: () => Promise<FlushResult> = locks ? () => locks.request("spuzl-offline-flush", () => runFlush()).then((r) => r) : runFlush;
  const p = run().finally(() => {
    inFlight = null;
  });
  inFlight = p;
  return p;
}

export type FinishOutcome<R> = { queued: false; result: R } | { queued: true; item: QueuedFinish };

/**
 * Finish an attempt now, or queue it when the device is offline (or the request never reaches the
 * server). Server answers, including errors, are returned or thrown as usual.
 */
export async function finishOrQueue<R = unknown>(attemptId: string, payload: FinishPayload): Promise<FinishOutcome<R>> {
  const finishedAt = new Date();
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { queued: true, item: await enqueueFinish(attemptId, payload, finishedAt) };
  }
  let res: Response;
  try {
    res = await fetch(ENDPOINT(attemptId), {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...payload, localHour: payload.localHour ?? finishedAt.getHours() }),
    });
  } catch {
    return { queued: true, item: await enqueueFinish(attemptId, payload, finishedAt) };
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error((body as { message?: string } | null)?.message ?? (body as { error?: string } | null)?.error ?? "error");
    Object.assign(err, { status: res.status, code: (body as { error?: string } | null)?.error });
    throw err;
  }
  return { queued: false, result: body as R };
}

/* ---------------- hooks ---------------- */

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/** true while the browser reports a connection. Server render assumes online. */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

/** Number of clears waiting to sync on this device. */
export function usePendingCount(): number {
  useEffect(() => {
    void refreshCount();
  }, []);
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => pending,
    () => 0,
  );
}

/**
 * Flushes now (when online), on reconnect and whenever the tab becomes visible. Returns a stop function.
 * instrumentation-client.ts starts this once for the whole app, so screens do not need to.
 */
export function startOfflineSync(): () => void {
  if (typeof window === "undefined") return () => {};
  const go = () => {
    if (navigator.onLine) void flush();
  };
  const onVisible = () => {
    if (document.visibilityState === "visible") go();
  };
  go();
  window.addEventListener("online", go);
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    window.removeEventListener("online", go);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

/** startOfflineSync for the lifetime of a component (for pages rendered outside the app shell). */
export function useOfflineSync() {
  useEffect(() => startOfflineSync(), []);
}

/** Test hook: forget the cached connection so a fresh fake IndexedDB is picked up. */
export function __resetForTests() {
  dbPromise = null;
  inFlight = null;
  pending = 0;
  listeners.clear();
  syncedListeners.clear();
}
