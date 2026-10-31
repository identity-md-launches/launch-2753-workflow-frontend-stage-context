import { GAME } from "./config";
export type Wheel = {
  installation: string;
  settledWork: bigint;
  acceptedWork: bigint;
  distanceMm: bigint | null;
  observedMm: bigint;
  active: boolean;
  generatedAt: string;
  safeBlock: bigint;
  waiting: boolean;
};
const uint = (x: unknown): bigint => {
  if (typeof x !== "string" || !/^\d+$/.test(x))
    throw new Error("Invalid wheel counter.");
  return BigInt(x);
};
const obj = (x: unknown): Record<string, any> => {
  if (!x || typeof x !== "object")
    throw new Error("Wheel data is unavailable.");
  return x as Record<string, any>;
};
export function parseWheel(
  coreInput: unknown,
  statusInput: unknown,
  statsInput: unknown,
  chainId: number,
  previous?: Wheel,
): Wheel {
  const core = obj(coreInput),
    status = obj(statusInput),
    stats = obj(statsInput);
  if (
    core.schemaVersion !== 1 ||
    status.schemaVersion !== 1 ||
    stats.schemaVersion !== 1
  )
    throw new Error("Wheel API version changed. Movement is paused.");
  if (
    core.status !== "available" ||
    stats.status === "unavailable" ||
    status.status === "unavailable"
  )
    throw new Error(
      "Wheel API is unavailable. Last confirmed position is held.",
    );
  if (
    !core.installationId ||
    core.installationId !== status.installationId ||
    core.installationId !== stats.installationId ||
    Number(core.chain?.chainId) !== chainId
  )
    throw new Error("Wheel snapshots do not match. Movement is paused.");
  const settledWork = uint(core.core?.cumulativeWork),
    acceptedWork = uint(stats.lifetime?.acceptedWorkUnits),
    observedMm = uint(stats.lifetime?.observedDistanceMm);
  const safeBlock = uint(core.chain?.safeThroughBlock);
  const generated = Date.parse(status.generatedAt),
    observed = Date.parse(status.measurement?.observedAt);
  if (!Number.isFinite(generated) || !Number.isFinite(observed))
    throw new Error("Wheel timestamps are invalid.");
  const same = previous?.installation === core.installationId;
  if (previous && !same)
    throw new Error("Wheel installation changed. Movement is paused.");
  if (observedMm > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error(
      "Wheel distance exceeds the supported display range. Movement is paused.",
    );
  // Distance has no documented fixed conversion from work. Use the API's distance only
  // when ALL work behind that snapshot is settled. Never scale a provisional counter.
  let distanceMm =
    acceptedWork <= settledWork
      ? observedMm
      : same
        ? previous!.distanceMm
        : null;
  if (same && previous!.settledWork > settledWork)
    throw new Error("Settlement counter moved backwards. Movement is paused.");
  if (
    same &&
    distanceMm !== null &&
    previous!.distanceMm !== null &&
    distanceMm < previous!.distanceMm
  )
    throw new Error("Distance counter moved backwards. Movement is paused.");
  const age = Math.max(Date.now() - generated, Date.now() - observed);
  const fresh =
    status.measurement?.freshness === "online" &&
    age <=
      Math.max(120, Number(status.measurement.staleAfterSeconds) || 120) * 1000;
  const active =
    fresh &&
    typeof status.measurement.speedMmPerSecond === "number" &&
    status.measurement.speedMmPerSecond > 0;
  return {
    installation: core.installationId,
    settledWork,
    acceptedWork,
    distanceMm,
    observedMm,
    active,
    generatedAt: status.generatedAt,
    safeBlock,
    waiting: acceptedWork > settledWork,
  };
}
async function get(url: string) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(12000),
    cache: "no-cache",
    credentials: "omit",
  });
  if (!response.ok)
    throw new Error(
      `Wheel feed unavailable (${response.status}). Last confirmed position is held.`,
    );
  return response.json();
}
export async function readWheel(chainId: number, previous?: Wheel) {
  const data = await Promise.all([
    get(GAME.api.core),
    get(GAME.api.status),
    get(GAME.api.stats),
  ]);
  return parseWheel(
    ...(data as [unknown, unknown, unknown]),
    chainId,
    previous,
  );
}
