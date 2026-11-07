import { useEffect, useRef, useState } from "react";
import type { Runtime } from "./config";
import type { RouteStop, TripHistory } from "./chain";
import { DESTINATIONS } from "./destinations";
import { PostcardPicture } from "./Postcards";
import { count } from "./travel";
export function getObservedArrival(epoch: bigint) {
  try {
    const value = JSON.parse(localStorage.getItem("hrt-arrivals-v3") ?? "{}")[
      String(epoch)
    ];
    return typeof value === "string" && Number.isFinite(Date.parse(value))
      ? (value as string)
      : undefined;
  } catch {
    return undefined;
  }
}
export function TripMemory({
  runtime,
  route,
  completed,
  block,
  history,
}: {
  runtime: Runtime;
  route?: RouteStop[];
  completed?: number;
  block?: bigint;
  history?: TripHistory;
}) {
  const [recap, setRecap] = useState<string>(),
    [arrival, setArrival] = useState<number>(),
    [, update] = useState(0);
  const initialized = useRef(false),
    lastCompleted = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!route || completed === undefined || block === undefined) return;
    const key = `hrt-last-seen-v3-${runtime.chain.id}-${runtime.contract.address}`;
    let previous: { block: string; completed: number } | undefined;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const p = JSON.parse(raw);
        if (
          /^\d+$/.test(p.block) &&
          Number.isSafeInteger(p.completed) &&
          p.completed >= 0
        )
          previous = p;
      }
    } catch {
      /* optional */
    }
    const previousCompleted = lastCompleted.current ?? previous?.completed;
    if (previousCompleted !== undefined && completed > previousCompleted)
      setArrival(Number(route[completed - 1].destinationId));
    lastCompleted.current = completed;
    try {
      const raw = JSON.parse(localStorage.getItem("hrt-arrivals-v3") ?? "{}");
      const arrivals =
        raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
      let changed = false;
      route.slice(0, completed).forEach((s) => {
        if (typeof arrivals[String(s.epoch)] !== "string") {
          arrivals[String(s.epoch)] = new Date().toISOString();
          changed = true;
        }
      });
      if (changed) {
        localStorage.setItem("hrt-arrivals-v3", JSON.stringify(arrivals));
        update((v) => v + 1);
        window.dispatchEvent(new Event("hrt-arrival-recorded"));
      }
    } catch {
      /* Dates remain unknown when storage is unavailable. */
    }
    // Wait for confirmed event history before advancing the block used by the recap.
    if (history && !initialized.current) {
      initialized.current = true;
      if (previous) {
        const days = history.finals.filter(
          (f) => f.block > BigInt(previous.block),
        ).length;
        if (days > 0)
          setRecap(
            `While you were away, ${count(days, "voting day")} closed. ${Math.max(0, completed - previous.completed)} new arrivals observed. The route is ready to explore.`,
          );
      }
    }
    if (history)
      try {
        localStorage.setItem(
          key,
          JSON.stringify({ block: String(history.through), completed }),
        );
      } catch {
        /* optional */
      }
  }, [route, completed, block, history, runtime]);
  return (
    <>
      {recap && (
        <aside className="recap">
          <div>
            <h2>While you were away</h2>
            <p>{recap}</p>
            <a href="#trip-log">Catch up in the trip log ↓</a>
          </div>
          <button
            aria-label="Dismiss recap"
            onClick={() => setRecap(undefined)}
          >
            ×
          </button>
        </aside>
      )}
      {arrival !== undefined && (
        <aside className="arrival-celebration">
          <PostcardPicture place={DESTINATIONS[arrival]} />
          <div>
            <h2>Squeek made it!</h2>
            <p>A postcard from {DESTINATIONS[arrival].name} is ready.</p>
            <a href="#trip-log">Reveal the postcard ↓</a>
          </div>
          <button
            aria-label="Dismiss arrival celebration"
            onClick={() => setArrival(undefined)}
          >
            ×
          </button>
        </aside>
      )}
    </>
  );
}
