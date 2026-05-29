import Pick5PoolJson from "./Pick5Pool.json";
import Pick5PoolFactoryJson from "./Pick5PoolFactory.json";
import CoachAgentJson from "./CoachAgent.json";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const pick5PoolAbi = Pick5PoolJson.abi as readonly any[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const pick5FactoryAbi = Pick5PoolFactoryJson.abi as readonly any[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const coachAgentAbi = CoachAgentJson.abi as readonly any[];
