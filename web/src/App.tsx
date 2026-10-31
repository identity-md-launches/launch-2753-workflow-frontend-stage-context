import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useWriteContract } from "wagmi";
import { getAccount } from "@wagmi/core";
import { formatEther, type Hash } from "viem";
import { GAME, type Runtime } from "./config";
import { DESTINATIONS } from "./destinations";
import {
  readSnapshot,
  readNavigators,
  epochDate,
  friendlyError,
  creditedEpoch,
} from "./chain";
import { readWheel, type Wheel } from "./wheel";
import { loadJourney, replay } from "./journey";
import { TripMap } from "./Map";
import { Wallet, Modal, Address, shortAddress } from "./Wallet";
import { Hamster, PixelIcon, Icon } from "./art";
type Kind = "vote" | "finalize";
type Tx = {
  stage:
    | "idle"
    | "checking"
    | "review"
    | "signing"
    | "confirming"
    | "unknown"
    | "success"
    | "error";
  message: string;
  hash?: Hash;
};
type Review = {
  kind: Kind;
  arg: bigint;
  account: `0x${string}`;
  fee: bigint;
  epoch: bigint;
};
const pendingStages = [
  "checking",
  "review",
  "signing",
  "confirming",
  "unknown",
];
const emptyTx: Tx = { stage: "idle", message: "" };
export function App({ runtime }: { runtime: Runtime }) {
  const { address, chainId, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(0),
    [region, setRegion] = useState("All places"),
    [sort, setSort] = useState("id"),
    [showAll, setShowAll] = useState(false),
    [paused, setPaused] = useState(false),
    [now, setNow] = useState(Date.now());
  const [review, setReview] = useState<Review | null>(null),
    [voteTx, setVoteTx] = useState<Tx>(emptyTx),
    [finalizeTx, setFinalizeTx] = useState<Tx>(emptyTx);
  const [help, setHelp] = useState(false);
  const lastWheel = useRef<Wheel | undefined>(undefined);
  const snapshot = useQuery({
    queryKey: ["snapshot", address],
    queryFn: () => readSnapshot(runtime, address),
    refetchInterval: 15000,
    retry: 1,
    staleTime: 10000,
  });
  const wheel = useQuery({
    queryKey: ["wheel"],
    queryFn: async () => {
      const next = await readWheel(
        runtime.deployment.chainId,
        lastWheel.current,
      );
      lastWheel.current = next;
      return next;
    },
    refetchInterval: 60000,
    retry: 1,
    staleTime: 55000,
  });
  const route = snapshot.data?.route;
  const routeKey =
    route?.map((s) => `${s.epoch}:${s.destinationId}`).join(",") ?? "";
  const journey = useQuery({
    queryKey: ["journey", routeKey],
    queryFn: () => loadJourney(route!),
    enabled: !!route,
    staleTime: Infinity,
    retry: 1,
    placeholderData: (previous) => previous,
  });
  const navigators = useQuery({
    queryKey: ["navigators", routeKey],
    queryFn: () => readNavigators(runtime, route!),
    enabled: !!route,
    refetchInterval: 60000,
    staleTime: 55000,
    retry: 1,
  });
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.motion = paused ? "paused" : "playing";
  }, [paused]);
  const data = snapshot.data;
  const stale =
    !!data && (snapshot.isError || Date.now() - data.readAt > 60000);
  const state = replay(journey.data ?? [], wheel.data?.distanceMm ?? null);
  const hasDistance = wheel.data?.distanceMm != null;
  const running =
    !!wheel.data?.active &&
    !wheel.isError &&
    !!state.current &&
    wheel.data.distanceMm !== null;
  const destination = DESTINATIONS[selected];
  const wrong = isConnected && chainId !== runtime.deployment.chainId;
  const anyBusy = [voteTx, finalizeTx].some((t) =>
    pendingStages.includes(t.stage),
  );
  const secondsLeft = data
    ? Math.max(
        0,
        Number(data.end) -
          data.timestamp -
          Math.floor((now - data.readAt) / 1000),
      )
    : null;
  const countdown =
    secondsLeft === null
      ? "--:--:--"
      : [
          Math.floor(secondsLeft / 3600),
          Math.floor((secondsLeft % 3600) / 60),
          secondsLeft % 60,
        ]
          .map((x) => String(x).padStart(2, "0"))
          .join(":");
  const voteDisabled =
    !data ||
    stale ||
    wrong ||
    !address ||
    data.ballot === undefined ||
    data.ballot[0] ||
    anyBusy ||
    secondsLeft === 0;
  const canFinalize = !!data?.pending[0] && data.pending[1] < data.epoch;
  const voteReason = !address
    ? "Connect your wallet above to vote."
    : wrong
      ? `Switch to ${runtime.chain.name} using the wallet control above.`
      : !data
        ? "Waiting for verified contract reads."
        : stale
          ? "Contract reads are stale. Refresh before voting."
          : data.ballot?.[0]
            ? `Your vote is in: ${DESTINATIONS[Number(data.ballot[1])]?.name}.`
            : secondsLeft === 0
              ? "A new day is starting. Refresh the votes."
              : "One vote per wallet today. Votes cannot be changed.";
  const setTx = (kind: Kind, tx: Tx) =>
    kind === "vote" ? setVoteTx(tx) : setFinalizeTx(tx);
  async function prepare(kind: Kind) {
    if (!address || wrong || !data || stale || anyBusy) return;
    const arg = kind === "vote" ? BigInt(selected) : data.pending[1];
    setTx(kind, {
      stage: "checking",
      message: "Checking the transaction and network fee…",
    });
    try {
      const options = {
        address: runtime.contract.address,
        abi: runtime.abi,
        functionName: kind,
        args: [arg],
        account: address,
      };
      await runtime.client.simulateContract(options);
      const [gas, price] = await Promise.all([
        runtime.client.estimateContractGas(options),
        runtime.client.getGasPrice(),
      ]);
      setReview({
        kind,
        arg,
        account: address,
        fee: gas * price,
        epoch: data.epoch,
      });
      setTx(kind, {
        stage: "review",
        message: "Review this action before opening your wallet.",
      });
    } catch (e) {
      setTx(kind, { stage: "error", message: friendlyError(e) });
    }
  }
  function cancelReview() {
    if (review) {
      setTx(review.kind, emptyTx);
      setReview(null);
    }
  }
  async function finishReceipt(kind: Kind, hash: Hash) {
    try {
      const receipt = await runtime.client.waitForTransactionReceipt({
        hash,
        confirmations: 1,
        timeout: 120000,
        onReplaced: (replacement) =>
          setTx(kind, {
            stage: "confirming",
            message: "Waiting for the replacement transaction…",
            hash: replacement.transaction.hash,
          }),
      });
      if (receipt.status !== "success") {
        setTx(kind, {
          stage: "error",
          message: "The transaction reverted. Refresh the votes and try again.",
          hash: receipt.transactionHash,
        });
        return;
      }
      const credited =
        kind === "vote" ? creditedEpoch(runtime, receipt.logs) : undefined;
      setTx(kind, {
        stage: "success",
        message:
          kind === "vote"
            ? `Vote confirmed${credited !== undefined ? ` for ${epochDate(credited)}` : ""}. Your destination is on the ballot.`
            : "Day finalized. Its winning stop is now in the route.",
        hash: receipt.transactionHash,
      });
      await queryClient.invalidateQueries({ queryKey: ["snapshot"] });
      await queryClient.invalidateQueries({ queryKey: ["navigators"] });
    } catch {
      setTx(kind, {
        stage: "unknown",
        message:
          "Confirmation is taking longer. Check the transaction before trying another action.",
        hash,
      });
    }
  }
  async function confirm() {
    if (!review) return;
    const r = review;
    setReview(null);
    setTx(r.kind, {
      stage: "signing",
      message:
        "Confirm this action in your wallet. No ETH is sent to the contract.",
    });
    try {
      const current = getAccount(runtime.walletConfig);
      if (
        current.address?.toLowerCase() !== r.account.toLowerCase() ||
        current.chainId !== runtime.deployment.chainId
      )
        throw new Error("Account or chain changed");
      const options = {
        address: runtime.contract.address,
        abi: runtime.abi,
        functionName: r.kind,
        args: [r.arg],
        account: r.account,
      };
      await runtime.client.simulateContract(options);
      const hash = await writeContractAsync({
        ...options,
        chainId: runtime.deployment.chainId,
      });
      setTx(r.kind, {
        stage: "confirming",
        message: "Transaction submitted. Waiting for confirmation…",
        hash,
      });
      await finishReceipt(r.kind, hash);
    } catch (e) {
      setTx(r.kind, { stage: "error", message: friendlyError(e) });
    }
  }
  function TxStatus({ kind, tx }: { kind: Kind; tx: Tx }) {
    return (
      <div
        className={`transaction ${tx.stage === "error" ? "error" : ""}`}
        role="status"
        aria-live="polite"
      >
        {tx.message && <p>{tx.message}</p>}
        {tx.hash && (
          <a
            target="_blank"
            rel="noreferrer"
            href={`${runtime.deployment.network.explorer}/tx/${tx.hash}`}
          >
            View transaction <Icon name="external" />
          </a>
        )}
        {tx.stage === "unknown" && tx.hash && (
          <button
            onClick={() => {
              setTx(kind, {
                ...tx,
                stage: "confirming",
                message: "Checking confirmation…",
              });
              void finishReceipt(kind, tx.hash!);
            }}
          >
            Check confirmation
          </button>
        )}
      </div>
    );
  }
  const places = [...DESTINATIONS]
    .filter((d) => region === "All places" || d.region === region)
    .sort((a, b) =>
      sort === "votes" && data
        ? Number((data.votes[b.id] ?? 0n) - (data.votes[a.id] ?? 0n)) ||
          a.id - b.id
        : a.id - b.id,
    );
  const visible = showAll ? places : places.slice(0, 8);
  return (
    <>
      <a href="#main" className="skip">
        Skip to the trip
      </a>
      <header className="site-header">
        <a className="brand" href="#main" aria-label="Squeek’s First Road Trip home">
          <Hamster />
          <span>
            Squeek’s First
            <br />
            Road Trip
          </span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#destinations">Destinations</a>
          <a href="#trip-log">Trip log</a>
          <button
            className="help-button"
            onClick={() => setHelp(true)}
            aria-label="How to play"
          >
            ?
          </button>
        </nav>
        <Wallet runtime={runtime} />
      </header>
      <main id="main">
        <div className="intro">
          <div>
            <h1>Small wheel. Big world.</h1>
            <p>Squeek powers the trip. You choose the next stop.</p>
          </div>
          <span className="network-label">
            <span className="live-dot" />
            {runtime.chain.name} testnet
          </span>
        </div>
        <div className="dashboard">
          <section className="map-section" aria-label="Squeek’s journey">
            <TripMap
              legs={journey.data ?? []}
              position={state.position}
              active={running}
              paused={paused}
              selected={selected}
              onSelect={setSelected}
            />
            <div className="wheel-strip">
              <Hamster running={running && !paused} />
              <div>
                <strong>
                  {wheel.isError
                    ? "Wheel feed paused"
                    : !hasDistance
                      ? "Waiting for settled distance"
                      : state.current
                        ? running
                          ? "A little closer with every turn."
                          : "A tiny nap. A big adventure ahead."
                        : state.completed > 0
                          ? `Resting in ${journey.data?.at(-1)?.to.name}.`
                          : "Resting at the starting line."}
                </strong>
                <span className="muted small">
                  {hasDistance && state.current
                    ? `Next: ${state.current.to.name} · ${Math.round(state.fraction * 100)}% of this leg`
                    : "The wheel is ready for the community’s next stop."}
                </span>
              </div>
              <button
                className="icon-button"
                aria-label={paused ? "Resume animation" : "Pause animation"}
                onClick={() => setPaused(!paused)}
              >
                <Icon name={paused ? "play" : "pause"} />
              </button>
            </div>
          </section>
          <section
            className="vote-panel"
            id="vote"
            aria-labelledby="vote-title"
          >
            <div className="section-head">
              <h2 id="vote-title">Choose the next stop</h2>
              <Icon name="compass" />
            </div>
            <div className="epoch-row">
              <span>
                {data ? epochDate(data.epoch) : "Loading today’s vote…"}
              </span>
              <span
                className="countdown"
                aria-label={`Voting closes in ${countdown}`}
              >
                {countdown}
              </span>
            </div>
            <label className="select-label" htmlFor="destination">
              Where should we go?
            </label>
            <select
              id="destination"
              value={selected}
              onChange={(e) => setSelected(Number(e.target.value))}
            >
              {DESTINATIONS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}, {d.country}
                </option>
              ))}
            </select>
            <div className="chosen-place">
              <PixelIcon type={destination.icon} size={56} />
              <div>
                <h3>{destination.name}</h3>
                <span className="muted small">{destination.country}</span>
              </div>
              <span className="chosen-votes">
                <strong>{data ? String(data.votes[selected]) : "—"}</strong>
                <span className="small muted">votes</span>
              </span>
            </div>
            <button
              className="primary vote-action"
              disabled={voteDisabled}
              onClick={() => void prepare("vote")}
            >
              {voteTx.stage === "checking"
                ? "Checking vote…"
                : voteTx.stage === "signing"
                  ? "Confirm in wallet…"
                  : voteTx.stage === "confirming"
                    ? "Confirming vote…"
                    : voteTx.stage === "unknown"
                      ? "Checking confirmation needed"
                      : data?.ballot?.[0]
                        ? "Voted today"
                        : `Vote for ${destination.name}`}
              <Icon name={data?.ballot?.[0] ? "check" : "arrow"} />
            </button>
            <p className="vote-help small muted">{voteReason}</p>
            <TxStatus kind="vote" tx={voteTx} />
            {secondsLeft !== null && secondsLeft <= 120 && (
              <p className="warning small">
                A vote mined after 00:00 UTC counts for the next day.
              </p>
            )}
            <div className="vote-summary">
              <span>
                <strong>{data ? String(data.total) : "—"}</strong> votes today
              </span>
              <span>
                {data?.total
                  ? `${DESTINATIONS[Number(data.leader[0])].name} leads`
                  : "The route is yours to choose"}
              </span>
            </div>
            <p className="small gas-note">
              Only Sepolia test ETH for gas.{" "}
              <a
                href={runtime.deployment.network.faucets[0]}
                target="_blank"
                rel="noreferrer"
              >
                Get test ETH <Icon name="external" />
              </a>
            </p>
            {snapshot.isError && (
              <div className="read-error" role="alert">
                <p>Couldn’t refresh contract reads. Voting is paused.</p>
                <button onClick={() => void snapshot.refetch()}>
                  Retry contract reads
                </button>
              </div>
            )}
          </section>
        </div>
        <section className="stats-strip" aria-label="Wheel and trip statistics">
          <div>
            <span className="muted small">Settled wheel distance</span>
            <strong>
              {wheel.data?.distanceMm !== null &&
              wheel.data?.distanceMm !== undefined
                ? `${(Number(wheel.data.distanceMm) / 1e6).toLocaleString("en", { maximumFractionDigits: 2 })} km`
                : "Awaiting settlement"}
            </strong>
          </div>
          <div>
            <span className="muted small">Distance multiplier</span>
            <strong>
              ×{GAME.scale}
              <span className="muted small"> wheel km</span>
            </strong>
          </div>
          <div>
            <span className="muted small">Across the map</span>
            <strong>
              {wheel.data?.distanceMm !== null &&
              wheel.data?.distanceMm !== undefined
                ? `${state.travelled.toLocaleString("en", { maximumFractionDigits: 1 })} km`
                : "—"}
            </strong>
          </div>
          <div>
            <span className="muted small">Postcards collected</span>
            <strong>
              {data && journey.data && hasDistance
                ? String(state.completed)
                : "—"}
              <span className="muted small">
                {" "}
                / {data ? data.route.length : "—"} stops
              </span>
            </strong>
          </div>
        </section>
        {(wheel.isError || wheel.data?.waiting) && (
          <div className="feed-note">
            <span>
              {wheel.isError
                ? "Wheel feed unavailable. The last confirmed position is held."
                : wheel.data?.distanceMm === null
                  ? "The latest distance includes unsettled work. The marker waits for confirmation."
                  : "New wheel work is settling. Holding the last confirmed distance."}
            </span>
            <button
              onClick={() => void wheel.refetch()}
              disabled={wheel.isFetching}
            >
              {wheel.isFetching ? "Checking…" : "Retry wheel feed"}
            </button>
          </div>
        )}
        {journey.isError && (
          <div role="alert" className="feed-note">
            <span>The route could not load. The marker waits here.</span>
            <button onClick={() => void journey.refetch()}>Retry route</button>
          </div>
        )}
        <section
          id="destinations"
          className="destinations-section"
          aria-labelledby="destinations-title"
        >
          <div className="section-head">
            <div>
              <h2 id="destinations-title">A world of possibilities</h2>
              <p className="muted">64 stops. One destination wins each day.</p>
            </div>
            <a href="#vote">
              Back to the ballot <Icon name="arrow" />
            </a>
          </div>
          <div className="filters">
            <label>
              Explore{" "}
              <select
                value={region}
                onChange={(e) => {
                  setRegion(e.target.value);
                  setShowAll(false);
                }}
              >
                {[
                  "All places",
                  "Americas",
                  "Europe",
                  "Africa",
                  "Asia",
                  "Oceania",
                ].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <label>
              Order{" "}
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="id">Route atlas</option>
                <option value="votes">Most votes</option>
              </select>
            </label>
          </div>
          <div className="destination-grid">
            {visible.map((d) => (
              <button
                className={`destination-card ${selected === d.id ? "selected" : ""}`}
                key={d.id}
                onClick={() => {
                  setSelected(d.id);
                  document
                    .getElementById("vote")
                    ?.scrollIntoView({ behavior: "instant", block: "center" });
                  document
                    .getElementById("destination")
                    ?.focus({ preventScroll: true });
                }}
                aria-pressed={selected === d.id}
              >
                <PixelIcon type={d.icon} />
                <div>
                  <span className="place-name">{d.name}</span>
                  <span className="muted small">{d.country}</span>
                </div>
                <span className="destination-count">
                  {data ? String(data.votes[d.id]) : "—"}
                  <span className="small muted"> votes</span>
                </span>
              </button>
            ))}
          </div>
          {places.length > 8 && (
            <button
              className="show-places"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll
                ? "Show fewer destinations"
                : `Show all ${places.length} destinations`}
              <span aria-hidden="true">{showAll ? "−" : "+"}</span>
            </button>
          )}
        </section>
        <div className="trip-columns">
          <section id="route-queue" aria-labelledby="queue-title">
            <div className="section-head">
              <h2 id="queue-title">
                {hasDistance ? "Up next" : "Community route"}
              </h2>
              <span className="muted small">Epoch order</span>
            </div>
            {!!data?.route.length && !hasDistance && (
              <p className="small muted">
                Arrival progress is unknown until settled distance is available.
              </p>
            )}
            {!data ? (
              <p className="empty">Waiting for the route from Sepolia.</p>
            ) : data.route.length === 0 ? (
              <div className="empty">
                <Hamster />
                <p>
                  No stops queued yet.
                  <br />
                  Today’s winning place will start the adventure.
                </p>
              </div>
            ) : !journey.data ? (
              <p className="empty">Finding roads and ocean crossings…</p>
            ) : state.completed === data.route.length ? (
              <p className="empty">
                All queued stops reached. Choose where Squeek goes next.
              </p>
            ) : (
              <ol className="queue-list">
                {data.route.slice(state.completed).map((stop, i) => {
                  const place = DESTINATIONS[Number(stop.destinationId)],
                    leg = journey.data?.[state.completed + i];
                  return (
                    <li key={String(stop.epoch)}>
                      <span className="stop-number">
                        {String(state.completed + i + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <strong>{place.name}</strong>
                        <span className="small muted">
                          {epochDate(stop.epoch)} ·{" "}
                          {leg?.mode === "flight" ? "Air crossing" : "By road"}
                        </span>
                      </div>
                      <PixelIcon
                        type={leg?.mode === "flight" ? "ship" : place.icon}
                        size={28}
                      />
                    </li>
                  );
                })}
              </ol>
            )}
            <div className="finalize-panel">
              <h3>Close a voting day</h3>
              <p className="small muted">
                {canFinalize
                  ? `${epochDate(data!.pending[1])} is ready. Anyone can add its winner to the route.`
                  : "Ended days with votes are finalized oldest first. Empty days are skipped."}
              </p>
              <button
                disabled={!canFinalize || wrong || !address || stale || anyBusy}
                onClick={() => void prepare("finalize")}
              >
                {finalizeTx.stage === "checking"
                  ? "Checking day…"
                  : finalizeTx.stage === "signing"
                    ? "Confirm in wallet…"
                    : finalizeTx.stage === "confirming"
                      ? "Confirming day…"
                      : `Finalize ${canFinalize ? epochDate(data!.pending[1]) : "next day"}`}
              </button>
              {!address && canFinalize && (
                <p className="small muted">
                  Connect a wallet above to finalize.
                </p>
              )}
              <TxStatus kind="finalize" tx={finalizeTx} />
            </div>
          </section>
          <section id="leaderboard" aria-labelledby="leaderboard-title">
            <div className="section-head">
              <h2 id="leaderboard-title">Navigators</h2>
              <Icon name="compass" />
            </div>
            <p className="muted small">
              One point for each vote that matched a finalized winner.
            </p>
            {navigators.isError ? (
              <div className="empty">
                <p>Event history unavailable. Rankings are unknown.</p>
                <button onClick={() => void navigators.refetch()}>
                  Retry leaderboard
                </button>
              </div>
            ) : navigators.isFetching && !navigators.data ? (
              <p className="empty">Reading confirmed voting events…</p>
            ) : navigators.data?.navigators.length ? (
              <ol className="leaderboard-list">
                {navigators.data.navigators.map((n, i) => (
                  <li key={n.address}>
                    <span className="stop-number">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <Address address={n.address} runtime={runtime} compact />
                    <span>
                      {n.wins} {n.wins === 1 ? "point" : "points"}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="empty">
                <PixelIcon type="rocket" />
                <p>
                  No winning votes recorded yet.
                  <br />
                  Your next choice could put you on the board.
                </p>
              </div>
            )}
            {navigators.data && (
              <p className="small muted">
                Confirmed events through block {String(navigators.data.through)}
                . The latest 12 blocks wait for confirmation.
              </p>
            )}
          </section>
        </div>
        <section
          id="trip-log"
          className="trip-log"
          aria-labelledby="trip-log-title"
        >
          <div className="section-head">
            <div>
              <h2 id="trip-log-title">Postcards from the wheel</h2>
              <p className="muted">A little memory from every arrival.</p>
            </div>
            <span className="muted small">Trip log</span>
          </div>
          {!hasDistance && !!data?.route.length ? (
            <p className="empty">
              Arrival history is waiting for settled distance.
            </p>
          ) : state.completed === 0 ? (
            <div className="first-postcard">
              <PixelIcon type="palm" size={56} />
              <div>
                <h3>Greetings from Miami Beach</h3>
                <p className="muted">
                  A pocketful of seeds. An open road. The first postcard is
                  waiting to happen.
                </p>
              </div>
              <span className="small muted">Starting point</span>
            </div>
          ) : (
            <div className="postcard-grid">
              {data?.route.slice(0, state.completed).map((stop, i) => {
                const place = DESTINATIONS[Number(stop.destinationId)];
                return (
                  <article className="postcard" key={String(stop.epoch)}>
                    <div className="postcard-art">
                      <PixelIcon type={place.icon} size={56} />
                      <span className="small">
                        Stop {String(i + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <h3>{place.name}</h3>
                    <p>{place.fact}</p>
                    <span className="small muted">
                      Chosen {epochDate(stop.epoch)} · reached on settled
                      distance
                    </span>
                  </article>
                );
              })}
            </div>
          )}
        </section>
        <details className="observability">
          <summary>Trip data & contract</summary>
          <div className="data-grid">
            <div>
              <h3>On Sepolia</h3>
              <Address address={runtime.contract.address} runtime={runtime} />
              <p className="small muted">
                {data
                  ? `Contract code verified · block ${data.block} · refreshed ${new Date(data.readAt).toLocaleTimeString("en-GB", { timeZone: "UTC" })} UTC`
                  : "Contract verification pending. All transactions are disabled."}
              </p>
              <p className="small muted">
                Source: {runtime.deployment.sourceCommit}
              </p>
              <a href="./imd-deployment.json" target="_blank" rel="noreferrer">
                Deployment manifest & asset hashes
              </a>
            </div>
            <div>
              <h3>Only settled work moves the trip</h3>
              <p className="small muted">
                {wheel.data
                  ? `${wheel.data.settledWork.toLocaleString()} settled passages · ${wheel.data.acceptedWork.toLocaleString()} passages behind the observed distance · safe block ${wheel.data.safeBlock}`
                  : "Waiting for wheel snapshots."}
              </p>
              <p className="small muted">
                Wheel distance is an API estimate. A complete observed-distance
                snapshot must be covered by settled work before it moves the
                marker. Unused distance waits for a queued stop. Road routes are
                cached on this browser.
              </p>
              <p className="small muted">
                Routes:{" "}
                {journey.data?.some((l) => l.source === "OSRM")
                  ? "OSRM road service and great-circle crossings"
                  : "Great-circle crossings when no road connects stops"}
                {journey.data?.some((l) => l.reason?.includes("unavailable"))
                  ? " · Some routes are estimated because the road service is unavailable."
                  : ""}
                .
              </p>
              <a href={GAME.api.docs} target="_blank" rel="noreferrer">
                Squeekchain data documentation <Icon name="external" />
              </a>
              <p className="small muted">
                USD gas context is unavailable. Fees are shown in Sepolia test
                ETH.
              </p>
            </div>
          </div>
        </details>
      </main>
      <footer>
        <a className="footer-brand" href="#main">
          Squeek’s First Road Trip
        </a>
        <span>Powered by real wheel work. Steered by the community.</span>
        <button onClick={() => setHelp(true)}>
          How to play <Icon name="compass" />
        </button>
      </footer>
      <Modal
        open={help}
        onClose={() => setHelp(false)}
        title="How the trip works"
      >
        <ol className="help-list">
          <li>Choose from 64 places. Each wallet gets one vote per UTC day.</li>
          <li>
            After 00:00 UTC, anyone can finalize the oldest day with votes. Most
            votes wins; ties go to the lowest destination id.
          </li>
          <li>
            The wheel’s settled distance moves Squeek along the winning
            stops, at ×{GAME.scale}. Roads come from OSRM; oceans use
            great-circle air crossings.
          </li>
          <li>
            Squeek rests when there is no next stop or the wheel is idle.
            Each reached stop adds a postcard.
          </li>
          <li>
            Matching a finalized winner earns a Navigator point. This is a
            Sepolia game; voting and finalization use test ETH only for gas.
          </li>
        </ol>
        <a
          href={runtime.deployment.network.faucets[0]}
          target="_blank"
          rel="noreferrer"
        >
          Get Sepolia test ETH
        </a>
      </Modal>
      <Modal
        open={review !== null}
        onClose={cancelReview}
        title={
          review?.kind === "vote" ? "Review your vote" : "Review finalization"
        }
      >
        {review && (
          <>
            <p>
              {review.kind === "vote"
                ? `Vote for ${DESTINATIONS[Number(review.arg)].name}. This wallet cannot change its vote today.`
                : `Finalize ${epochDate(review.arg)} and append its winner to the route. Anyone can perform this action.`}
            </p>
            <dl className="review-list">
              <div>
                <dt>Network</dt>
                <dd>{runtime.chain.name} testnet</dd>
              </div>
              <div>
                <dt>Sent to contract</dt>
                <dd>0 ETH</dd>
              </div>
              {data?.balance !== undefined && (
                <div>
                  <dt>Gas balance</dt>
                  <dd>{formatEther(data.balance)} test ETH</dd>
                </div>
              )}
              <div>
                <dt>Estimated gas</dt>
                <dd>
                  {Number(formatEther(review.fee)).toPrecision(3)} test ETH
                </dd>
              </div>
            </dl>
            <p className="small muted">
              The wallet shows the final gas fee. USD context is unavailable.
              {review.kind === "vote"
                ? " A vote mined after 00:00 UTC belongs to the next day."
                : ""}
            </p>
            <Address address={runtime.contract.address} runtime={runtime} />
            <button className="primary" onClick={() => void confirm()}>
              Confirm {review.kind === "vote" ? "vote" : "finalization"} in
              wallet <Icon name="arrow" />
            </button>
            <button className="review-cancel" onClick={cancelReview}>
              Go back
            </button>
          </>
        )}
      </Modal>
    </>
  );
}
