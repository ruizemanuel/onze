import Pick5PoolJson from "./Pick5Pool.json";
import Pick5PoolFactoryJson from "./Pick5PoolFactory.json";
import SeasonPoolJson from "./SeasonPool.json";
import CoachAgentJson from "./CoachAgent.json";
import OnzePoolJson from "./OnzePool.json";
import OnzeCoachAgentJson from "./OnzeCoachAgent.json";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const pick5PoolAbi = Pick5PoolJson.abi as readonly any[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const pick5FactoryAbi = Pick5PoolFactoryJson.abi as readonly any[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const pick5SeasonAbi = SeasonPoolJson.abi as readonly any[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const coachAgentAbi = CoachAgentJson.abi as readonly any[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const onzePoolAbi = OnzePoolJson.abi as readonly any[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const onzeCoachAgentAbi = OnzeCoachAgentJson.abi as readonly any[];
