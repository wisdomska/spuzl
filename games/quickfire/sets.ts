import type { QuickfireItem } from "./content";
import { GHANA_HISTORY } from "./ghana-history";

/**
 * Quiz sets a seasonal event can feature in Quickfire free play (lib/events EVENT_QUIZZES). Each set is played in
 * rounds of five, in order; a free board while the event is live is one of its rounds. The order of this list and
 * of each set's rows is part of every board's content index: append, never reorder.
 */
export const QUIZ_SETS: { id: string; items: QuickfireItem[] }[] = [{ id: "ghana-1957", items: GHANA_HISTORY }];

export const quizSetIndex = (id: string) => QUIZ_SETS.findIndex((s) => s.id === id);
