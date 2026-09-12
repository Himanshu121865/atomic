import type { SystemInfo } from "../api/types";

export type SystemKind = SystemInfo["kind"] | null;

export function systemKind(systems: SystemInfo[], key: string): SystemKind {
  return systems.find((s) => s.key === key)?.kind ?? null;
}

export function isHydrogenic(systems: SystemInfo[], key: string): boolean {
  return systemKind(systems, key) === "hydrogenic";
}

export function isScreened(systems: SystemInfo[], key: string): boolean {
  return systemKind(systems, key) === "screened";
}
