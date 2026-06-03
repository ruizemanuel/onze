import { describe, it, expect } from "vitest";
import { useLineupDraft } from "../lineupDraft";

describe("useLineupDraft.draftFor", () => {
  it("returns a STABLE reference for an unset fecha", () => {
    // Regression: draftFor is read through a Zustand selector
    // (useLineupDraft((s) => s.draftFor(tid))). If it returns a fresh object each
    // call, useSyncExternalStore sees a new snapshot every render and throws
    // "getServerSnapshot should be cached to avoid an infinite loop", crashing the
    // build/confirm pages. The empty case must hand back the same reference.
    const s = useLineupDraft.getState();
    const a = s.draftFor(999);
    const b = s.draftFor(999);
    expect(a).toBe(b);
    expect(a.slots).toHaveLength(11);
    expect(a.formation).toBe("4-3-3");
    expect(a.captainId).toBeNull();
  });
});
