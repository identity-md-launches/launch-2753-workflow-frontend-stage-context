import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useWriteContract } from "wagmi";
import { getAccount } from "@wagmi/core";
import { formatEther, type Hash } from "viem";
import { GAME, type Runtime } from "./config";
import { DESTINATIONS } from "./destinations";
import {
  readSnapshot,
  readBallot,
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
import { Postcard, PostcardPicture, LandmarkIcon } from "./Postcards";
import { LANDMARKS } from "./landmarks";
import {
  count,
  groupedStops,
  navigatorIdentity,
  distanceContext,
} from "./travel";
import { TripMemory, getObservedArrival } from "./TripMemory";
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
  const { address, chainId, status: accountStatus } = useAccount();
  const isConnected = accountStatus === "connected";
  const connectedAddress = isConnected ? address : undefined;
  const { writeContractAsync } = useWriteContract();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(0),
    [region, setRegion] = useState("All places"),
    [sort, setSort] = useState("votes"),
    [search, setSearch] = useState(""),
    [passportPlace, setPassportPlace] = useState<number | null>(null),
    [showAll, setShowAll] = useState(false),
    [paused, setPaused] = useState(false),
    [now, setNow] = useState(Date.now());
  const [review, setReview] = useState<Review | null>(null),
    [voteTx, setVoteTx] = useState<Tx>(emptyTx),
    [finalizeTx, setFinalizeTx] = useState<Tx>(emptyTx);
  const [help, setHelp] = useState(false);
  const [, refreshArrivals] = useState(0);
  useEffect(() => {
    const refresh = () => refreshArrivals((n) => n + 1);
    window.addEventListener("hrt-arrival-recorded", refresh);
    return () => window.removeEventListener("hrt-arrival-recorded", refresh);
  }, []);
  const lastWheel = useRef<Wheel | undefined>(undefined);
  const snapshot = useQuery({
    queryKey: ["snapshot"],
    queryFn: () => readSnapshot(runtime),
    refetchInterval: 15000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
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
  const ballot = useQuery({
    queryKey: ["ballot", snapshot.data?.epoch.toString(), connectedAddress],
    queryFn: () => readBallot(runtime, snapshot.data!.epoch, connectedAddress!),
    enabled: !!snapshot.data && !!connectedAddress,
    refetchInterval: 15000,
    retry: 1,
  });
  const data = snapshot.data ? { ...snapshot.data, ...ballot.data } : undefined;
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
    !connectedAddress ||
    data.ballot === undefined ||
    data.ballot[0] ||
    anyBusy ||
    secondsLeft === 0;
  const canFinalize = !!data?.pending[0] && data.pending[1] < data.epoch;
  const voteReason = !connectedAddress
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
    if (!connectedAddress || wrong || !data || stale || anyBusy) return;
    if (data.balance === 0n) {
      setTx(kind, {
        stage: "error",
        message:
          "Your wallet has no Sepolia test ETH. Use the faucet link before voting.",
      });
      return;
    }
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
        account: connectedAddress,
      };
      await runtime.client.simulateContract(options);
      const [gas, price] = await Promise.all([
        runtime.client.estimateContractGas(options),
        runtime.client.getGasPrice(),
      ]);
      setReview({
        kind,
        arg,
        account: connectedAddress,
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
      await queryClient.invalidateQueries({ queryKey: ["ballot"] });
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
        "Waiting for wallet. Confirm this action; no ETH is sent to the contract.",
    });
    try {
      const current = getAccount(runtime.walletConfig);
      if (
        current.status !== "connected" ||
        typeof current.connector?.getProvider !== "function" ||
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
    .filter(
      (d) =>
        (region === "All places" || d.region === region) &&
        `${d.name} ${d.country} ${LANDMARKS[d.id].name}`
          .toLocaleLowerCase()
          .includes(search.toLocaleLowerCase().trim()),
    )
    .sort((a, b) =>
      sort === "votes" && data
        ? data.votes[b.id] > data.votes[a.id]
          ? 1
          : data.votes[b.id] < data.votes[a.id]
            ? -1
            : a.id - b.id
        : a.id - b.id,
    );
  const visible = showAll || search ? places : places.slice(0, 8);
  const arrivalKnown = hasDistance && !!journey.data;
  const completed = arrivalKnown ? state.completed : 0;
  const groups = groupedStops(data?.route ?? []);
  const visited = new Set(
    data?.route.slice(0, completed).map((s) => Number(s.destinationId)) ?? [],
  );
  const finalFor = (epoch: bigint) =>
    navigators.data?.finals.find((f) => f.epoch === epoch);
  const currentCity =
    state.current?.from.name ??
    journey.data?.at(-1)?.to.name ??
    GAME.origin.name;
  const headingTo = state.current?.to.name;
  const tripTitle =
    visited.size === 64
      ? "A whole world, collected."
      : wheel.isError && !hasDistance
        ? "Squeek’s position is on hold"
        : !hasDistance || !journey.data
          ? "Checking on Squeek…"
          : running
            ? `Rolling toward ${headingTo}`
            : state.current && state.fraction > 0
              ? "Resting on the way"
              : `Resting in ${currentCity}`;
  const resetLocal = data
    ? new Date(Number(data.end) * 1000).toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      })
    : undefined;
  const voteCount = (id: number) =>
    data
      ? count(data.votes[id])
      : snapshot.isError
        ? "Votes unavailable"
        : "Votes loading…";
  const selectPlace = (id: number) => {
    setSelected(id);
    document
      .getElementById("vote")
      ?.scrollIntoView({ behavior: "instant", block: "start" });
  };
  return (
    <>
      <a href="#main" className="skip">
        Skip to the trip
      </a>
      <header className="site-header">
        <a
          className="brand"
          href="#main"
          aria-label="Squeek’s First Road Trip home"
        >
          <Hamster running />
          <span>
            Squeek’s First
            <br />
            Road Trip
            <span className="brand-sub">A tiny hamster. Your adventure.</span>
          </span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#destinations">Destinations</a>
          <a href="#trip-log">Trip log</a>
          <a href="#passport">Passport</a>
        </nav>
        <div className="header-actions">
          <button
            className="help-button"
            onClick={() => setHelp(true)}
            aria-label="How to play"
          >
            ?
          </button>
          <Wallet runtime={runtime} />
        </div>
      </header>
      <main id="main">
        <div className="intro">
          <div>
            <h1>
              Small wheel.<span className="hero-next"> Big world.</span>
            </h1>
            <p>Watch Squeek travel. Vote for the next stop.</p>
          </div>
          <span className="network-label">
            <span className="live-dot" />
            {runtime.chain.name} · Testnet
          </span>
        </div>
        <div className="dashboard">
          <section className="trip-scene" aria-label="Squeek’s current state">
            <div className="scene-sky" aria-hidden="true">
              <svg className="scene-clouds" viewBox="0 0 600 200">
                <path
                  fill="#fff8e7"
                  d="M30 60h22V38h40v10h24v26H30zM383 45h20V26h34v9h23v22h-77zM202 110h15V94h35v8h18v21h-68z"
                />
                <path fill="#e9dca9" d="M515 105h35v35h-35z" />
              </svg>
              <div className="scene-landmark">
                <LandmarkIcon
                  id={state.current?.to.id ?? selected}
                  size={200}
                />
              </div>
              <div className="scene-ground" />
              <div className={`scene-squeek ${running ? "travelling" : ""}`}>
                <Hamster running={running && !paused} />
              </div>
              <div className="scene-track" />
            </div>
            <div className="scene-status">
              <div className="section-head">
                <span className="status-label">
                  <span
                    className={`status-square ${running ? "active" : ""}`}
                  />
                  {wheel.isError
                    ? "Wheel status unavailable"
                    : !hasDistance
                      ? "Wheel status loading"
                      : running
                        ? "Squeek is running"
                        : "Squeek is resting"}
                </span>
                <button
                  className="icon-button"
                  onClick={() => setPaused(!paused)}
                  aria-label={paused ? "Resume animation" : "Pause animation"}
                >
                  <Icon name={paused ? "play" : "pause"} />
                </button>
              </div>
              <h2>{tripTitle}</h2>
              <p className="small">
                {visited.size === 64
                  ? "All 64 stops reached. The passport is complete; voting remains open."
                  : !arrivalKnown
                    ? "Position waits for settled wheel distance and the community route."
                    : headingTo
                      ? `Next: ${headingTo} · ${Math.round(state.fraction * 100)}% of this leg`
                      : completed > 0
                        ? "Every queued stop reached. Choose where Squeek goes next."
                        : "Starting in Miami Beach. Your votes set the route."}
              </p>
            </div>
          </section>
          <section
            className="vote-panel"
            id="vote"
            aria-labelledby="vote-title"
          >
            <div className="section-head">
              <h2 id="vote-title">Where to next?</h2>
              <Icon name="compass" />
            </div>
            <div className="epoch-row">
              <span>
                {data
                  ? epochDate(data.epoch)
                  : snapshot.isError
                    ? "Ballot unavailable"
                    : "Loading today’s ballot…"}
              </span>
              <span
                className="countdown"
                aria-label={`Voting closes in ${countdown}`}
              >
                {countdown}
              </span>
            </div>
            <label htmlFor="destination">Choose a destination</label>
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
            <button
              className="primary vote-action"
              disabled={
                isConnected
                  ? voteDisabled || data?.balance === 0n
                  : accountStatus === "reconnecting"
              }
              onClick={() => {
                if (!isConnected || wrong)
                  window.dispatchEvent(new Event("hrt-connect"));
                else void prepare("vote");
              }}
            >
              {!isConnected
                ? accountStatus === "reconnecting"
                  ? "Restoring wallet…"
                  : "Connect to vote"
                : voteTx.stage === "checking"
                  ? "Checking vote…"
                  : voteTx.stage === "signing"
                    ? "Waiting for wallet…"
                    : voteTx.stage === "confirming"
                      ? "Vote pending…"
                      : voteTx.stage === "unknown"
                        ? "Check confirmation below"
                        : data?.ballot?.[0]
                          ? "Voted today"
                          : `Vote for ${destination.name}`}
              <Icon name={data?.ballot?.[0] ? "check" : "arrow"} />
            </button>
            <p className="vote-help small muted">
              {!isConnected
                ? "Watch freely. One wallet, one vote each day."
                : voteReason}
            </p>
            {(snapshot.isError || snapshot.failureCount > 0 || stale) && (
              <div className="feed-note read-error" role="alert">
                <div>
                  <strong>Can’t reach the network, retrying</strong>
                  <p className="small">
                    {data
                      ? "Last verified votes remain visible. Voting pauses until Sepolia responds."
                      : "Votes and the route are unknown. Squeek’s atlas still works."}
                  </p>
                </div>
                <button
                  onClick={() => void snapshot.refetch()}
                  disabled={snapshot.isFetching}
                >
                  {snapshot.isFetching ? "Retrying…" : "Retry contract reads"}
                </button>
              </div>
            )}
            <div className="chosen-place">
              <LandmarkIcon id={selected} size={56} />
              <div>
                <h3>{destination.name}</h3>
                <span className="small muted">{LANDMARKS[selected].name}</span>
              </div>
              <span className="chosen-votes">
                {data
                  ? count(data.votes[selected])
                  : snapshot.isError
                    ? "Unavailable"
                    : "Loading…"}
              </span>
            </div>
            {wrong && (
              <p className="warning small">
                Use “Switch to Sepolia” in the header to vote.
              </p>
            )}
            {data?.balance === 0n && connectedAddress && (
              <p className="warning" role="status">
                Your wallet has no Sepolia test ETH.{" "}
                <a
                  href={runtime.deployment.network.faucets[0]}
                  target="_blank"
                  rel="noreferrer"
                >
                  Get test ETH from the faucet ↗
                </a>
              </p>
            )}
            {ballot.isError && (
              <p className="error small">
                Can’t read this wallet’s ballot.{" "}
                <button onClick={() => void ballot.refetch()}>
                  Retry wallet reads
                </button>
              </p>
            )}
            <TxStatus kind="vote" tx={voteTx} />
            <div className="vote-summary">
              <strong>
                {data
                  ? count(data.total)
                  : snapshot.isError
                    ? "Votes unavailable"
                    : "Votes loading…"}
              </strong>
              <span className="small">
                {data
                  ? data.total > 0n
                    ? `${DESTINATIONS[Number(data.leader[0])].name} leads`
                    : "No votes today. Be the first."
                  : snapshot.isError
                    ? "Retry network reads"
                    : "Reading Sepolia…"}
              </span>
            </div>
            <p className="small muted reset-time">
              Voting closes in {data ? countdown : "…"}. Reset:{" "}
              {resetLocal ?? "loading local time"} · 00:00 UTC.
            </p>
            <p className="small gas-note">
              Test ETH for gas only.{" "}
              <a
                href={runtime.deployment.network.faucets[0]}
                target="_blank"
                rel="noreferrer"
              >
                Get test ETH ↗
              </a>
            </p>
            {secondsLeft !== null && secondsLeft <= 120 && (
              <p className="warning small">
                A vote mined after 00:00 UTC counts for the next day.
              </p>
            )}
          </section>
          <section className="map-section" aria-label="Squeek’s journey">
            <TripMap
              legs={journey.data ?? []}
              position={state.position}
              active={running}
              paused={paused}
              selected={selected}
              onSelect={setSelected}
            />
            <div className="map-caption">
              <span>64 places to go. Select a pin to choose.</span>
              <a href="#destinations">Explore the atlas ↓</a>
            </div>
          </section>
        </div>
        <TripMemory
          runtime={runtime}
          route={data?.route}
          completed={arrivalKnown ? completed : undefined}
          block={data?.block}
          history={navigators.data}
        />
        <section className="stats-strip" aria-label="Wheel and trip statistics">
          <div>
            <span className="small muted">Settled wheel distance</span>
            <strong>
              {hasDistance
                ? `${(Number(wheel.data!.distanceMm) / 1e6).toLocaleString("en", { maximumFractionDigits: 2 })} km`
                : wheel.isError
                  ? "Unavailable"
                  : "Awaiting settlement"}
            </strong>
          </div>
          <div>
            <span className="small muted">Distance multiplier</span>
            <strong>
              ×{GAME.scale}
              <span className="small muted"> wheel km</span>
            </strong>
          </div>
          <div>
            <span className="small muted">Across the map</span>
            <strong>
              {arrivalKnown
                ? `${Math.round(state.travelled).toLocaleString("en")} km`
                : "Distance unknown"}
            </strong>
          </div>
          <div>
            <span className="small muted">Passport collected</span>
            <strong>
              {arrivalKnown ? `${visited.size} / 64` : "Arrivals unknown"}
            </strong>
          </div>
        </section>
        {arrivalKnown && state.travelled > 0 && (
          <p className="distance-context small">
            {distanceContext(state.travelled)}
          </p>
        )}
        {(wheel.isError || wheel.data?.waiting) && (
          <div className="feed-note">
            <p>
              {wheel.isError
                ? "Wheel feed unavailable. The last confirmed position is held."
                : hasDistance
                  ? "New wheel work is settling. Holding the last confirmed distance."
                  : "The latest distance includes unsettled work. The marker waits for confirmation."}
            </p>
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
            <span>The route could not load. Arrival progress is unknown.</span>
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
              <h2 id="destinations-title">Pick a little adventure</h2>
              <p className="muted">64 stops. One destination wins each day.</p>
            </div>
            <a href="#vote">
              Back to the ballot <Icon name="arrow" />
            </a>
          </div>
          <div className="filters">
            <label className="search-label">
              Search all 64 stops
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="City, country or landmark"
              />
            </label>
            <label>
              Region
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
              Order
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="votes">Most votes</option>
                <option value="id">Route atlas</option>
              </select>
            </label>
          </div>
          <div className="destination-grid">
            {visible.map((d) => (
              <button
                className={`destination-card ${selected === d.id ? "selected" : ""}`}
                key={d.id}
                onClick={() => selectPlace(d.id)}
                aria-pressed={selected === d.id}
              >
                <LandmarkIcon id={d.id} size={58} />
                <span className="place-copy">
                  <strong>{d.name}</strong>
                  <span className="small muted">{d.country}</span>
                  <span className="small">{voteCount(d.id)}</span>
                </span>
                <span className="selection-mark" aria-hidden="true">
                  {selected === d.id ? "✓" : "+"}
                </span>
                <span className="share-track" aria-hidden="true">
                  <span
                    style={{
                      width:
                        data && data.total > 0n
                          ? `${Number((data.votes[d.id] * 10000n) / data.total) / 100}%`
                          : "0%",
                    }}
                  />
                </span>
              </button>
            ))}
          </div>
          {places.length === 0 && (
            <div className="empty">
              <p>
                No stops match “{search}” in {region.toLowerCase()}.
              </p>
              <button
                onClick={() => {
                  setSearch("");
                  setRegion("All places");
                }}
              >
                Clear filters
              </button>
            </div>
          )}
          {places.length > 8 && !search && (
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
              <h2 id="queue-title">Up next</h2>
              <Icon name="compass" />
            </div>
            <p className="small muted">
              The community’s route, in voting order.
            </p>
            {!data ? (
              <p className="empty">
                {snapshot.isError
                  ? "Route unavailable. Retry network reads above."
                  : "Waiting for the route from Sepolia…"}
              </p>
            ) : data.route.length === 0 ? (
              <div className="empty">
                <Hamster />
                <p>
                  No stops queued yet. Today’s winning place will start the
                  adventure.
                </p>
                <a href="#vote">Choose the first stop ↑</a>
              </div>
            ) : !journey.data ? (
              <p className="empty">Finding roads and air crossings…</p>
            ) : arrivalKnown && completed === data.route.length ? (
              <div className="empty">
                <p>All queued stops reached. Choose where Squeek goes next.</p>
                <a href="#vote">Back to the ballot ↑</a>
              </div>
            ) : (
              <ol className="queue-list">
                {groups
                  .filter((g) => !arrivalKnown || g.start + g.days > completed)
                  .map((g) => {
                    const place = DESTINATIONS[Number(g.stop.destinationId)],
                      leg = journey.data?.[g.start];
                    return (
                      <li key={String(g.stop.epoch)}>
                        <span className="stop-number">
                          {String(g.start + 1).padStart(2, "0")}
                        </span>
                        <LandmarkIcon id={place.id} size={42} />
                        <div>
                          <strong>
                            {g.days > 1
                              ? `Day ${g.days} in ${place.name}`
                              : place.name}
                          </strong>
                          <span className="small muted">
                            Voted {epochDate(g.stop.epoch)}
                            {g.days > 1 ? ` – ${epochDate(g.through)}` : ""}
                          </span>
                          <span className="small">
                            {leg?.mode === "flight" ? (
                              <>
                                <PixelIcon type="plane" size={20} /> Air
                                crossing
                              </>
                            ) : (
                              "By road"
                            )}
                          </span>
                        </div>
                      </li>
                    );
                  })}
              </ol>
            )}
            <div className={`finalize-panel ${canFinalize ? "ready" : ""}`}>
              <h3>
                {canFinalize ? "A day is ready to close" : "Close a voting day"}
              </h3>
              <p className="small">
                {canFinalize
                  ? `${epochDate(data!.pending[1])} has ended. Close it to add the winning stop to Squeek’s route. Anyone can help.`
                  : "Ended days with votes close oldest first. Days with no votes are skipped, so Squeek can rest without blocking the trip."}
              </p>
              <button
                disabled={
                  !canFinalize ||
                  stale ||
                  anyBusy ||
                  (isConnected && wrong) ||
                  data?.balance === 0n ||
                  accountStatus === "reconnecting"
                }
                onClick={() => {
                  if (!isConnected)
                    window.dispatchEvent(new Event("hrt-connect"));
                  else void prepare("finalize");
                }}
              >
                {!isConnected && canFinalize
                  ? "Connect to close this day"
                  : finalizeTx.stage === "signing"
                    ? "Waiting for wallet…"
                    : finalizeTx.stage === "confirming"
                      ? "Finalization pending…"
                      : `Finalize ${canFinalize ? epochDate(data!.pending[1]) : "next day"}`}
              </button>
              <TxStatus kind="finalize" tx={finalizeTx} />
            </div>
          </section>
          <section id="leaderboard" aria-labelledby="leaderboard-title">
            <div className="section-head">
              <h2 id="leaderboard-title">Navigators</h2>
              <Icon name="compass" />
            </div>
            <p className="small muted">
              One point for each vote matching a finalized winner.
            </p>
            {navigators.isError || snapshot.isError ? (
              <div className="empty">
                <p>Can’t reach the network, retrying. Rankings are unknown.</p>
                <button onClick={() => void navigators.refetch()}>
                  Retry leaderboard
                </button>
              </div>
            ) : !navigators.data ? (
              <p className="empty">Reading confirmed voting events…</p>
            ) : navigators.data.navigators.length ? (
              <ol className="leaderboard-list">
                {navigators.data.navigators.map((n, i) => {
                  const identity = navigatorIdentity(n.address);
                  return (
                    <li
                      key={n.address}
                      className={
                        address?.toLowerCase() === n.address.toLowerCase()
                          ? "you"
                          : ""
                      }
                    >
                      <span className="stop-number">{i + 1}</span>
                      <svg
                        className="avatar"
                        width="40"
                        height="40"
                        viewBox="0 0 5 5"
                        aria-hidden="true"
                      >
                        <rect width="5" height="5" fill="#e6ddfa" />
                        {Array.from({ length: 15 }, (_, j) => {
                          const x = j % 3,
                            y = Math.floor(j / 3);
                          return parseInt(identity.seed[j], 16) % 2 ? (
                            <g key={j} fill="#624b93">
                              <rect x={x} y={y} width="1" height="1" />
                              <rect x={4 - x} y={y} width="1" height="1" />
                            </g>
                          ) : null;
                        })}
                      </svg>
                      <div className="navigator-name">
                        <strong>
                          {identity.name}
                          {address?.toLowerCase() === n.address.toLowerCase()
                            ? " · You"
                            : ""}
                        </strong>
                        <span className="small muted">
                          {n.wins >= 10
                            ? "Trail captain"
                            : n.wins >= 3
                              ? "Pathfinder"
                              : "Seed scout"}{" "}
                          · {n.streak}-day best streak
                        </span>
                        <Address
                          address={n.address}
                          runtime={runtime}
                          compact
                        />
                      </div>
                      <strong className="small">
                        {count(n.wins, "point")}
                      </strong>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className="empty">
                <PixelIcon type="compass" />
                <p>
                  No winning votes recorded yet. Your next choice could put you
                  on the board.
                </p>
              </div>
            )}
            {navigators.data && (
              <p className="small muted">
                Confirmed through block {String(navigators.data.through)}. The
                latest 12 blocks wait for confirmation. Names and avatars are
                generated from addresses.
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
            <a href="#passport">Open passport ↓</a>
          </div>
          {!data ? (
            <p className="empty">
              {snapshot.isError
                ? "Trip history unavailable until Sepolia responds."
                : "Loading trip history…"}
            </p>
          ) : !arrivalKnown && data.route.length > 0 ? (
            <p className="empty">
              Arrival history is waiting for settled distance.
            </p>
          ) : completed === 0 ? (
            <div className="first-postcard">
              <Hamster />
              <div>
                <h3>Greetings from Miami Beach</h3>
                <p>
                  The starting line. The first arrival postcard is waiting to
                  happen.
                </p>
              </div>
              <a href="#vote">Choose the next stop ↑</a>
            </div>
          ) : (
            <div className="postcard-grid">
              {groups
                .filter((g) => g.start < completed)
                .map((g) => {
                  const place = DESTINATIONS[Number(g.stop.destinationId)];
                  return (
                    <div key={String(g.stop.epoch)}>
                      {g.days > 1 && (
                        <p className="stay-label">
                          Day {Math.min(g.days, completed - g.start)} in{" "}
                          {place.name} · consecutive winning days
                        </p>
                      )}
                      <Postcard
                        place={place}
                        km={journey.data?.[g.start]?.km}
                        arrival={getObservedArrival(g.stop.epoch)}
                        final={finalFor(g.stop.epoch)}
                        explorer={runtime.deployment.network.explorer}
                      />
                    </div>
                  );
                })}
            </div>
          )}
          <p className="small muted arrival-note">
            Arrival dates are when this browser first observed settled distance
            reaching a stop, not a historical timestamp from the contract.
            Winning votes and transaction links use confirmed events.
          </p>
        </section>
        <section id="passport" aria-labelledby="passport-title">
          <div className="section-head">
            <div>
              <h2 id="passport-title">Squeek’s little passport</h2>
              <p className="muted">
                {arrivalKnown
                  ? `${visited.size} of 64 places visited.`
                  : "Arrival status loading."}{" "}
                Select a postcard to take a closer look.
              </p>
            </div>
            <span className="passport-stamp" aria-hidden="true">
              64 places
              <br />
              one small wheel
            </span>
          </div>
          <div className="passport-grid">
            {DESTINATIONS.map((place) => (
              <button
                className="passport-card"
                key={place.id}
                onClick={() => setPassportPlace(place.id)}
                aria-label={`${place.name}: ${visited.has(place.id) ? "visited postcard" : arrivalKnown ? "locked postcard" : "arrival status unknown"}`}
              >
                <PostcardPicture
                  place={place}
                  locked={!visited.has(place.id)}
                />
                <span className="passport-place">
                  <strong>{place.name}</strong>
                  <span className="small muted">
                    {LANDMARKS[place.id].name}
                  </span>
                  <span className="small">
                    {visited.has(place.id)
                      ? "Visited ✓"
                      : arrivalKnown
                        ? "Not visited yet"
                        : snapshot.isError || wheel.isError || journey.isError
                          ? "Arrivals unavailable"
                          : "Checking arrivals…"}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
        <details className="observability">
          <summary>Trip data & contract</summary>
          <div className="data-grid">
            <div>
              <h3>On Sepolia</h3>
              <Address address={runtime.contract.address} runtime={runtime} />
              <p className="small muted">
                {data
                  ? `Contract code verified · block ${data.block} · refreshed ${new Date(data.readAt).toLocaleTimeString()}`
                  : "Contract verification pending. Transactions are disabled."}
              </p>
              <p className="small muted">
                Source: {runtime.deployment.sourceCommit}
              </p>
              <a href="./imd-deployment.json" target="_blank" rel="noreferrer">
                Deployment manifest & asset hashes ↗
              </a>
            </div>
            <div>
              <h3>Only settled work moves the trip</h3>
              <p className="small muted">
                {wheel.data
                  ? `${wheel.data.settledWork.toLocaleString()} settled passages · safe block ${wheel.data.safeBlock}`
                  : "Waiting for wheel snapshots."}
              </p>
              <p className="small muted">
                Wheel distance is an API estimate, used only when settled work
                covers its snapshot. Unused distance waits for a queued stop.
                Roads use OSRM; disconnected roads use great-circle air
                crossings. Unavailable road routing pauses arrival progress.
                Routes are cached in this browser.
              </p>
              <a href={GAME.api.docs} target="_blank" rel="noreferrer">
                Squeekchain data documentation ↗
              </a>
            </div>
          </div>
        </details>
      </main>
      <footer>
        <div>
          <a className="footer-brand" href="#main">
            Squeek’s First Road Trip
          </a>
          <p className="small">Testnet: no real money.</p>
        </div>
        <div>
          <span className="small">Voting contract · Sepolia</span>
          <Address address={runtime.contract.address} runtime={runtime} />
        </div>
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
          <li>
            Watch without a wallet. Choose from 64 places; each wallet gets one
            vote per UTC day. Votes cannot be changed.
          </li>
          <li>
            After 00:00 UTC, anyone can finalize the oldest day with votes. Most
            votes wins; ties go to the lowest destination id. Empty days are
            skipped.
          </li>
          <li>
            Settled wheel distance moves Squeek along the winning stops at ×
            {GAME.scale}. Roads come from OSRM; air crossings use great-circle
            estimates.
          </li>
          <li>
            Squeek rests when the wheel is idle or there is no next stop.
            Consecutive wins in the same city appear as a longer stay.
          </li>
          <li>
            Every arrival unlocks a postcard. Match a finalized winner to earn a
            Navigator point. Streaks count consecutive UTC days with winning
            votes.
          </li>
          <li>
            This is Sepolia testnet. You pay only network gas in test ETH. No
            ETH goes to the voting contract.
          </li>
        </ol>
        <a
          href={runtime.deployment.network.faucets[0]}
          target="_blank"
          rel="noreferrer"
        >
          Get Sepolia test ETH ↗
        </a>
      </Modal>
      <Modal
        open={passportPlace !== null}
        onClose={() => setPassportPlace(null)}
        title={
          passportPlace !== null ? DESTINATIONS[passportPlace].name : "Postcard"
        }
      >
        {passportPlace !== null &&
          (() => {
            const place = DESTINATIONS[passportPlace],
              i =
                data?.route.findIndex(
                  (s, j) =>
                    j < completed && Number(s.destinationId) === passportPlace,
                ) ?? -1;
            return i >= 0 ? (
              <Postcard
                place={place}
                km={journey.data?.[i]?.km}
                arrival={getObservedArrival(data!.route[i].epoch)}
                final={finalFor(data!.route[i].epoch)}
                explorer={runtime.deployment.network.explorer}
              />
            ) : (
              <>
                <PostcardPicture place={place} locked />
                <p>
                  {arrivalKnown
                    ? "This postcard unlocks when Squeek arrives."
                    : "Arrival status is waiting for verified trip data."}
                </p>
                <button
                  onClick={() => {
                    setPassportPlace(null);
                    selectPlace(place.id);
                  }}
                >
                  Choose {place.name}
                </button>
              </>
            );
          })()}
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
                <dd>Sepolia testnet</dd>
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
              The wallet shows the final gas fee. USD context is unavailable.{" "}
              {review.kind === "vote"
                ? "A vote mined after 00:00 UTC belongs to the next day."
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
