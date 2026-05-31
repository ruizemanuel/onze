export type FechaStatus = "soon" | "joining" | "scoring" | "settled";

/**
 * Derive a fecha's UI status from on-chain facts + now (seconds).
 * - poolExists=false → "soon" (configured but not created on-chain yet)
 * - finalized → "settled"
 * - now < lockTime → "joining"
 * - otherwise (locked / scores in, not finalized) → "scoring"
 */
export function fechaStatus(args: {
  poolExists: boolean;
  lockTime: number;
  finalized: boolean;
  now: number;
}): FechaStatus {
  if (!args.poolExists) return "soon";
  if (args.finalized) return "settled";
  if (args.now < args.lockTime) return "joining";
  return "scoring";
}
