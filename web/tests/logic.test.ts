import { describe, it, expect, vi, afterEach } from "vitest";
import { DESTINATIONS } from "../src/destinations";
import {
  greatCircle,
  distance,
  pointAlong,
  replay,
  loadLeg,
  type Leg,
} from "../src/journey";
import { parseWheel } from "../src/wheel";
import { switchNetwork, type Deployment } from "../src/config";
import { friendlyError } from "../src/chain";
import network from "../deployment/network.json";
import handoff from "../deployment/handoff.json";
afterEach(() => vi.unstubAllGlobals());
const fixtures = () => [
  {
    schemaVersion: 1,
    status: "available",
    installationId: "fixture",
    chain: {
      chainId: String(network.network.chainId),
      safeThroughBlock: "200",
    },
    core: { cumulativeWork: "100" },
  },
  {
    schemaVersion: 1,
    installationId: "fixture",
    generatedAt: new Date().toISOString(),
    measurement: {
      observedAt: new Date().toISOString(),
      freshness: "online",
      staleAfterSeconds: 120,
      speedMmPerSecond: 100,
    },
  },
  {
    schemaVersion: 1,
    installationId: "fixture",
    lifetime: { acceptedWorkUnits: "100", observedDistanceMm: "88000" },
  },
];
describe("permanent destination atlas", () => {
  it("has exactly 64 distinct ids, valid coordinates and original captions", () => {
    expect(DESTINATIONS).toHaveLength(64);
    expect(DESTINATIONS.map((d) => d.id)).toEqual(
      Array.from({ length: 64 }, (_, i) => i),
    );
    expect(new Set(DESTINATIONS.map((d) => d.name)).size).toBe(64);
    for (const d of DESTINATIONS) {
      expect(Math.abs(d.coordinates[0])).toBeLessThanOrEqual(180);
      expect(Math.abs(d.coordinates[1])).toBeLessThanOrEqual(90);
      expect(d.fact.length).toBeGreaterThan(25);
    }
  });
});
describe("settlement gate", () => {
  it("accepts reported distance only when its entire work counter is settled", () => {
    const [c, s, t] = fixtures();
    expect(parseWheel(c, s, t, network.network.chainId).distanceMm).toBe(
      88000n,
    );
    t.lifetime.acceptedWorkUnits = "101";
    expect(parseWheel(c, s, t, network.network.chainId).distanceMm).toBeNull();
  });
  it("holds the previous settled position rather than moving with provisional distance", () => {
    const [c, s, t] = fixtures();
    const previous = parseWheel(c, s, t, network.network.chainId);
    t.lifetime.acceptedWorkUnits = "150";
    t.lifetime.observedDistanceMm = "130000";
    const next = parseWheel(c, s, t, network.network.chainId, previous);
    expect(next.distanceMm).toBe(88000n);
    expect(next.waiting).toBe(true);
  });
  it("rejects unavailable, mismatched, unknown-version and decreasing counters", () => {
    const [c, s, t] = fixtures();
    expect(() =>
      parseWheel(
        { ...c, status: "unavailable" },
        s,
        t,
        network.network.chainId,
      ),
    ).toThrow();
    expect(() =>
      parseWheel(
        c,
        { ...s, installationId: "other" },
        t,
        network.network.chainId,
      ),
    ).toThrow();
    expect(() =>
      parseWheel(c, s, { ...t, schemaVersion: 2 }, network.network.chainId),
    ).toThrow();
    const previous = parseWheel(c, s, t, network.network.chainId);
    c.core.cumulativeWork = "99";
    expect(() =>
      parseWheel(c, s, t, network.network.chainId, previous),
    ).toThrow();
  });
  it("treats stale telemetry as idle", () => {
    const [c, s, t] = fixtures();
    s.generatedAt = "2020-01-01T00:00:00Z";
    expect(parseWheel(c, s, t, network.network.chainId).active).toBe(false);
  });
});
describe("route replay", () => {
  it("caches a returned road route and its endpoint connectors", async () => {
    const cache = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => cache.get(key) ?? null,
      setItem: (key: string, value: string) => cache.set(key, value),
    });
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: "Ok",
        routes: [
          {
            distance: 1000,
            geometry: {
              coordinates: [
                DESTINATIONS[10].coordinates,
                DESTINATIONS[11].coordinates,
              ],
            },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetch);
    const leg = await loadLeg(DESTINATIONS[10], DESTINATIONS[11]);
    expect(leg.source).toBe("OSRM");
    expect(leg.km).toBe(1);
    expect(cache.size).toBe(1);
    await loadLeg(DESTINATIONS[10], DESTINATIONS[11]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("uses an air arc only when the service confirms no road", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ code: "NoRoute" }),
      }),
    );
    const leg = await loadLeg(DESTINATIONS[59], DESTINATIONS[63]);
    expect(leg.source).toBe("great-circle");
    expect(leg.mode).toBe("flight");
    expect(leg.points.length).toBeGreaterThan(2);
  });
  it("pauses on service failure instead of inventing an air crossing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(loadLeg(DESTINATIONS[20], DESTINATIONS[21])).rejects.toThrow(
      "Journey progress waits",
    );
  });
  it("interpolates a great circle across the dateline without a world-spanning jump", () => {
    const arc = greatCircle([170, 20], [-170, 20]);
    expect(arc[0][0]).toBeCloseTo(170);
    expect(arc.at(-1)![0]).toBeCloseTo(190);
    expect(
      arc.every((p, i) => i === 0 || Math.abs(p[0] - arc[i - 1][0]) < 180),
    ).toBe(true);
  });
  it("uses real path length when positioning a marker", () => {
    const p = pointAlong(
      [
        [0, 0],
        [1, 0],
        [3, 0],
      ],
      0.5,
    );
    expect(p[0]).toBeCloseTo(1.5);
    expect(distance([0, 0], [0, 0])).toBe(0);
  });
  it("consumes stops in order, collects every arrival, and holds unknown distance at origin", () => {
    const legs = [
      {
        key: "1",
        from: DESTINATIONS[0],
        to: DESTINATIONS[1],
        points: [
          [0, 0],
          [1, 0],
        ],
        km: 10,
        mode: "road",
        source: "OSRM",
      },
      {
        key: "2",
        from: DESTINATIONS[1],
        to: DESTINATIONS[2],
        points: [
          [1, 0],
          [2, 0],
        ],
        km: 20,
        mode: "road",
        source: "OSRM",
      },
    ] as Leg[];
    const state = replay(legs, 150000n);
    expect(state.completed).toBe(1);
    expect(state.fraction).toBeCloseTo(0.25);
    expect(replay(legs, 400000n).completed).toBe(2);
    expect(replay(legs, 400000n).banked).toBe(10);
    expect(replay([], null).travelled).toBe(0);
  });
});
describe("wallet network and errors", () => {
  it("adds the exact supplied chain after 4902 then switches again", async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce({ code: 4902 })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    await switchNetwork(
      { request } as any,
      { ...handoff, ...network } as unknown as Deployment,
    );
    expect(request.mock.calls.map((c) => c[0].method)).toEqual([
      "wallet_switchEthereumChain",
      "wallet_addEthereumChain",
      "wallet_switchEthereumChain",
    ]);
    expect(request.mock.calls[1][0].params).toEqual([network.walletAddChain]);
  });
  it("does not add chains after a rejected switch", async () => {
    const request = vi.fn().mockRejectedValue({ code: 4001 });
    await expect(
      switchNetwork(
        { request } as any,
        { ...handoff, ...network } as unknown as Deployment,
      ),
    ).rejects.toBeDefined();
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("translates ABI and wallet errors into recoverable instructions", () => {
    expect(
      friendlyError({ cause: { data: { errorName: "AlreadyVoted" } } }),
    ).toContain("already voted");
    expect(friendlyError({ code: 4001 })).toContain("declined");
    expect(friendlyError(new Error("insufficient funds"))).toContain("faucet");
  });
});

describe("revision: shared atlas and event-derived labels", () => {
  it("has 64 named, distinct landmark silhouettes without remapping the ballot", async () => {
    const { LANDMARKS } = await import("../src/landmarks");
    expect(LANDMARKS).toHaveLength(64);
    expect(new Set(LANDMARKS.map((l) => l.path)).size).toBe(64);
    expect(
      LANDMARKS.every((l) => l.name.length > 3 && l.path.startsWith("M")),
    ).toBe(true);
    expect(DESTINATIONS.map((d) => d.id)).toEqual(
      Array.from({ length: 64 }, (_, i) => i),
    );
  });
  it("pluralizes zero, one and many without losing bigint precision", async () => {
    const { count } = await import("../src/travel");
    expect(count(0n)).toBe("0 votes");
    expect(count(1n)).toBe("1 vote");
    expect(count(2)).toBe("2 votes");
    expect(count(10n ** 24n)).toBe("1,000,000,000,000,000,000,000,000 votes");
  });
  it("groups only consecutive UTC wins in the same place", async () => {
    const { groupedStops } = await import("../src/travel");
    const groups = groupedStops([
      { epoch: 1n, destinationId: 0n },
      { epoch: 2n, destinationId: 0n },
      { epoch: 4n, destinationId: 0n },
      { epoch: 5n, destinationId: 1n },
    ]);
    expect(groups.map((g) => g.days)).toEqual([2, 1, 1]);
    expect(groups[0].through).toBe(2n);
  });
  it("awards one point per winning epoch and derives real consecutive-day streaks", async () => {
    const { rankNavigators } = await import("../src/chain");
    const voter = "0x1111111111111111111111111111111111111111" as const;
    const route = [
      { epoch: 1n, destinationId: 2n },
      { epoch: 2n, destinationId: 3n },
      { epoch: 4n, destinationId: 3n },
    ];
    const votes = [
      { epoch: 1n, destinationId: 2n, voter },
      { epoch: 1n, destinationId: 2n, voter },
      { epoch: 2n, destinationId: 3n, voter },
      { epoch: 4n, destinationId: 3n, voter },
      { epoch: 7n, destinationId: 3n, voter },
    ];
    expect(rankNavigators(route, votes)).toEqual([
      { address: voter, wins: 3, streak: 2 },
    ]);
  });
  it("a consecutive stay consumes no distance and calls no routing service", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const leg = await loadLeg(DESTINATIONS[0], DESTINATIONS[0]);
    expect(leg.km).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("generated Navigator identity is deterministic and address-specific", async () => {
    const { navigatorIdentity } = await import("../src/travel");
    expect(navigatorIdentity("0x1234")).toEqual(navigatorIdentity("0x1234"));
    expect(navigatorIdentity("0x1234").seed).not.toBe(
      navigatorIdentity("0x1235").seed,
    );
  });
});
