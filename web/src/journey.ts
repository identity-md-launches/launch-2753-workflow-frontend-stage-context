import { GAME } from "./config";
import { DESTINATIONS, type Destination } from "./destinations";
import type { RouteStop } from "./chain";
export type Point = [number, number];
export type Leg = {
  key: string;
  from: Destination;
  to: Destination;
  points: Point[];
  km: number;
  mode: "road" | "flight";
  source: "OSRM" | "great-circle";
  reason?: string;
};
export const radians = (n: number) => (n * Math.PI) / 180;
export function distance(a: Point, b: Point) {
  const dLat = radians(b[1] - a[1]),
    dLng = radians(b[0] - a[0]);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a[1])) * Math.cos(radians(b[1])) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(Math.max(0, 1 - x)));
}
export function greatCircle(a: Point, b: Point, steps = 80): Point[] {
  const angle = distance(a, b) / 6371;
  if (angle < 1e-10) return [a, b];
  const va = [
    Math.cos(radians(a[1])) * Math.cos(radians(a[0])),
    Math.cos(radians(a[1])) * Math.sin(radians(a[0])),
    Math.sin(radians(a[1])),
  ];
  const vb = [
    Math.cos(radians(b[1])) * Math.cos(radians(b[0])),
    Math.cos(radians(b[1])) * Math.sin(radians(b[0])),
    Math.sin(radians(b[1])),
  ];
  const out: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps,
      A = Math.sin((1 - t) * angle) / Math.sin(angle),
      B = Math.sin(t * angle) / Math.sin(angle);
    const v = va.map((x, j) => A * x + B * vb[j]);
    let lng = (Math.atan2(v[1], v[0]) * 180) / Math.PI;
    if (out.length) {
      while (lng - out.at(-1)![0] > 180) lng -= 360;
      while (lng - out.at(-1)![0] < -180) lng += 360;
    }
    out.push([lng, (Math.atan2(v[2], Math.hypot(v[0], v[1])) * 180) / Math.PI]);
  }
  return out;
}
const routeCache = new Map<string, Leg>();
export async function loadLeg(
  from: Destination,
  to: Destination,
): Promise<Leg> {
  const key = `hrt-road-v1-${from.id}-${to.id}`;
  if (routeCache.has(key)) return routeCache.get(key)!;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const cached = JSON.parse(raw) as Leg;
      if (
        cached.key === key &&
        (cached.source === "OSRM" || cached.source === "great-circle") &&
        Number.isFinite(cached.km) &&
        cached.km >= 0 &&
        cached.points.length >= 2 &&
        cached.points.every((p) => p.length === 2 && p.every(Number.isFinite))
      ) {
        routeCache.set(key, cached);
        return cached;
      }
    }
  } catch {
    /* browser cache is optional */
  }
  const arc = (reason: string): Leg => ({
    key,
    from,
    to,
    points: greatCircle(from.coordinates, to.coordinates),
    km: distance(from.coordinates, to.coordinates),
    mode: "flight",
    source: "great-circle",
    reason,
  });
  try {
    const coords = `${from.coordinates.join(",")};${to.coordinates.join(",")}`;
    const response = await fetch(
      `${GAME.map.routing}${coords}?overview=simplified&geometries=geojson&radiuses=10000;10000`,
      { signal: AbortSignal.timeout(10000) },
    );
    const result = await response.json();
    if (result.code === "NoRoute" || result.code === "NoSegment") {
      const leg = arc("No connected road route.");
      routeCache.set(key, leg);
      try {
        localStorage.setItem(key, JSON.stringify(leg));
      } catch {
        /* optional cache */
      }
      return leg;
    }
    if (!response.ok || result.code !== "Ok")
      throw new Error("Road service unavailable.");
    const road = result.routes?.[0];
    const points = road?.geometry?.coordinates as Point[];
    if (
      !points ||
      points.length < 2 ||
      !Number.isFinite(road.distance) ||
      road.distance < 0 ||
      points.some((p) => p.length !== 2 || p.some((n) => !Number.isFinite(n)))
    )
      throw new Error("Road response invalid.");
    // Connect the endpoints to the service's snapped road coordinates, so arrivals are exact.
    const km =
      road.distance / 1000 +
      distance(from.coordinates, points[0]) +
      distance(points.at(-1)!, to.coordinates);
    const leg: Leg = {
      key,
      from,
      to,
      points: [from.coordinates, ...points, to.coordinates],
      km,
      mode: "road",
      source: "OSRM",
    };
    routeCache.set(key, leg);
    try {
      localStorage.setItem(key, JSON.stringify(leg));
    } catch {
      /* quota or privacy mode */
    }
    return leg;
  } catch {
    throw new Error(
      "Road service unavailable. Journey progress waits for a verified route.",
    );
  }
}
export async function loadJourney(route: RouteStop[]) {
  const legs: Leg[] = [];
  let from = GAME.origin as Destination;
  for (const stop of route) {
    const to = DESTINATIONS[Number(stop.destinationId)];
    if (!to) throw new Error("Route contains an unknown destination.");
    legs.push(await loadLeg(from, to));
    from = to;
  }
  return legs;
}
export function pointAlong(points: Point[], fraction: number): Point {
  if (fraction <= 0) return points[0];
  if (fraction >= 1) return points.at(-1)!;
  const lengths = points.slice(1).map((p, i) => distance(points[i], p));
  let remaining = lengths.reduce((a, b) => a + b, 0) * fraction;
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i]) {
      const f = lengths[i] ? remaining / lengths[i] : 0;
      return [
        points[i][0] + (points[i + 1][0] - points[i][0]) * f,
        points[i][1] + (points[i + 1][1] - points[i][1]) * f,
      ];
    }
    remaining -= lengths[i];
  }
  return points.at(-1)!;
}
export function replay(legs: Leg[], wheelMm: bigint | null) {
  let budget =
    wheelMm === null ? 0 : Number(wheelMm * BigInt(GAME.scale)) / 1e6;
  let completed = 0,
    consumed = 0;
  for (const leg of legs) {
    if (budget < leg.km) break;
    budget -= leg.km;
    consumed += leg.km;
    completed++;
  }
  const current = legs[completed];
  const fraction =
    current && current.km > 0 ? Math.min(1, budget / current.km) : 0;
  const position = current
    ? pointAlong(current.points, fraction)
    : (legs.at(-1)?.to.coordinates ?? GAME.origin.coordinates);
  return {
    completed,
    current,
    fraction,
    position,
    travelled: consumed + (current ? budget : 0),
    banked: current ? 0 : budget,
  };
}
