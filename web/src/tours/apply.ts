import type { SystemInfo } from "../api/types";
import { resolveModel } from "../lib/hfModel";
import type { UrlState } from "../lib/urlState";
import { INVALIDATED } from "../state/store";

export function tourReset(state: UrlState, systems: SystemInfo[]) {
  const { ghost: ghostOn, ...rest } = state;
  return {
    ...rest,
    ghostOn,
    model: resolveModel(systems, state.system, state.model),
    ...INVALIDATED,
    hfLevels: null,
    forceLaw: null,
    forceStatus: "idle" as const,
    whatif: null,
    whatifStatus: "idle" as const,
  };
}
