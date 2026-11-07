import { keccak256, toHex } from "viem";
import { DESTINATIONS } from "./destinations";
import { distance } from "./journey";
import type { RouteStop } from "./chain";
export const count = (n: bigint | number, word = "vote") =>
  `${n.toLocaleString("en")} ${word}${n === 1 || n === 1n ? "" : "s"}`;
export function groupedStops(route: RouteStop[]) {
  const groups: {
    stop: RouteStop;
    start: number;
    days: number;
    through: bigint;
  }[] = [];
  route.forEach((stop, i) => {
    const last = groups.at(-1);
    if (
      last &&
      last.stop.destinationId === stop.destinationId &&
      last.through + 1n === stop.epoch
    ) {
      last.days++;
      last.through = stop.epoch;
    } else groups.push({ stop, start: i, days: 1, through: stop.epoch });
  });
  return groups;
}
export function navigatorIdentity(address: string) {
  const seed = keccak256(toHex(address.toLowerCase())).slice(2);
  const first = [
    "Cosmic",
    "Sunny",
    "Curious",
    "Daring",
    "Sleepy",
    "Mighty",
    "Wandering",
    "Velvet",
  ];
  const last = [
    "Acorn",
    "Comet",
    "Clover",
    "Pebble",
    "Pioneer",
    "Pistachio",
    "Sprout",
    "Waffle",
  ];
  return {
    name: `${first[parseInt(seed.slice(0, 2), 16) % 8]} ${last[parseInt(seed.slice(2, 4), 16) % 8]}`,
    seed,
  };
}
export function distanceContext(km: number) {
  const pairs = [
    [5, 8],
    [26, 30],
    [6, 10],
    [25, 58],
    [59, 60],
    [20, 21],
  ];
  const options = pairs.map(([a, b]) => ({
    a: DESTINATIONS[a],
    b: DESTINATIONS[b],
    km: distance(DESTINATIONS[a].coordinates, DESTINATIONS[b].coordinates),
  }));
  const nearest = options.sort(
    (a, b) => Math.abs(a.km - km) - Math.abs(b.km - km),
  )[0];
  return `${Math.round(km).toLocaleString("en")} km is about ${Math.max(0.1, Math.round((km / nearest.km) * 10) / 10)}× ${nearest.a.name} to ${nearest.b.name} (as the crow flies).`;
}
