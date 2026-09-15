import type { InfrastructureDevice } from "../utils/inventory";

// Known network infrastructure at its current addresses (verified 2026-09-14).
// Which WAX615 is AP1 vs AP2 is not confirmed yet, so they are named by IP.
export const KNOWN_INFRASTRUCTURE: InfrastructureDevice[] = [
  { ip: "172.16.40.1", name: "Nokia Gateway (AT&T)", role: "gateway" },
  { ip: "172.16.40.250", name: "Netgear WAX615 (.250)", role: "access-point" },
  { ip: "172.16.40.251", name: "Netgear WAX615 (.251)", role: "access-point" },
];
