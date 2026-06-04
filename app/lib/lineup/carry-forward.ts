import { inferFormation } from "./formations";
import type { Draft } from "@/stores/lineupDraft";

type PlayerInfo = { position: string; eliminated: boolean };

/**
 * Build the next phase's draft from the prior phase's on-chain XI: same formation,
 * players whose team is eliminated dropped to empty slots (positions preserved
 * because `priorIds` is already in formationSlots order), captain reset if it was
 * eliminated. `lookup` returns position + eliminated for an id (undefined if unknown).
 */
export function buildCarryForwardDraft(
  priorIds: number[],
  priorCaptainId: number | null,
  lookup: (id: number) => PlayerInfo | undefined,
): Draft {
  const positions = priorIds.map((id) => lookup(id)?.position ?? "MID");
  const formation = inferFormation(positions);
  const slots = priorIds.map((id) => (lookup(id)?.eliminated ? null : id));
  const captainId =
    priorCaptainId != null && slots.includes(priorCaptainId) ? priorCaptainId : null;
  return { formation, slots, captainId };
}
