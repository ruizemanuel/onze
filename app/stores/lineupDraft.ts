"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PlayerId = number;
type Lineup = (PlayerId | null)[]; // length 5
const EMPTY: Lineup = [null, null, null, null, null];

type LineupDraftState = {
  byFecha: Record<number, Lineup>;
  lineupFor: (tid: number) => Lineup;
  setSlot: (tid: number, idx: number, id: PlayerId | null) => void;
  randomFill: (tid: number, allIds: PlayerId[]) => void;
  clear: (tid: number) => void;
};

export const useLineupDraft = create<LineupDraftState>()(
  persist(
    (set, get) => ({
      byFecha: {},
      lineupFor: (tid) => get().byFecha[tid] ?? EMPTY,
      setSlot: (tid, idx, id) =>
        set((s) => {
          const cur = s.byFecha[tid] ?? EMPTY;
          if (id !== null && cur.includes(id)) return s;
          const next = [...cur];
          next[idx] = id;
          return { byFecha: { ...s.byFecha, [tid]: next } };
        }),
      randomFill: (tid, allIds) =>
        set((s) => {
          const shuffled = [...allIds].sort(() => Math.random() - 0.5).slice(0, 5);
          return { byFecha: { ...s.byFecha, [tid]: shuffled } };
        }),
      clear: (tid) =>
        set((s) => ({ byFecha: { ...s.byFecha, [tid]: [...EMPTY] } })),
    }),
    { name: "pick5-lineup-draft-v2" },
  ),
);
