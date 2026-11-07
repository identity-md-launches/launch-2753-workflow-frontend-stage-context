import { decodeEventLog, getAddress, type Address, type Hash } from "viem";
import handoff from "../deployment/handoff.json";
import type { Runtime } from "./config";
export type RouteStop = { epoch: bigint; destinationId: bigint };
export type Snapshot = {
  epoch: bigint;
  epochSeconds: bigint;
  end: bigint;
  block: bigint;
  timestamp: number;
  votes: bigint[];
  total: bigint;
  leader: readonly [bigint, bigint];
  pending: readonly [boolean, bigint];
  route: RouteStop[];
  ballot?: readonly [boolean, bigint];
  balance?: bigint;
  readAt: number;
};
export async function readSnapshot(runtime: Runtime): Promise<Snapshot> {
  const { client, contract, abi, deployment } = runtime;
  if ((await client.getChainId()) !== deployment.chainId)
    throw new Error("RPC returned another network. Voting is disabled.");
  const block = await client.getBlock();
  const code = await client.getCode({
    address: contract.address,
    blockNumber: block.number,
  });
  if (!code || code === "0x")
    throw new Error(
      "No voting contract code found on this network. Voting is disabled.",
    );
  const read = (functionName: string, args: readonly unknown[] = []) =>
    client.readContract({
      address: contract.address,
      abi,
      functionName,
      args,
      blockNumber: block.number,
    });
  const [epoch, epochSeconds, count] = (await Promise.all([
    read("currentEpoch"),
    read("epochSeconds"),
    read("destinationCount"),
  ])) as bigint[];
  if (count !== 64n || epochSeconds !== 86400n)
    throw new Error(
      "Contract settings differ from the approved game. Voting is disabled.",
    );
  const [end, total, leader, pending, route, ...votes] = await Promise.all([
    read("epochEnd", [epoch]),
    read("totalVotes", [epoch]),
    read("leaderOf", [epoch]),
    read("pendingEpoch"),
    read("route"),
    ...Array.from({ length: 64 }, (_, id) =>
      read("votesFor", [epoch, BigInt(id)]),
    ),
  ]);
  return {
    epoch,
    epochSeconds,
    end: end as bigint,
    block: block.number,
    timestamp: Number(block.timestamp),
    votes: votes as bigint[],
    total: total as bigint,
    leader: leader as [bigint, bigint],
    pending: pending as [boolean, bigint],
    route: route as RouteStop[],
    readAt: Date.now(),
  };
}
export async function readBallot(
  runtime: Runtime,
  epoch: bigint,
  account: Address,
) {
  const [ballot, balance] = await Promise.all([
    runtime.client.readContract({
      address: runtime.contract.address,
      abi: runtime.abi,
      functionName: "voteOf",
      args: [epoch, account],
    }),
    runtime.client.getBalance({ address: account }),
  ]);
  return { ballot: ballot as readonly [boolean, bigint], balance };
}
export type Navigator = { address: Address; wins: number; streak: number };
export type Finalization = {
  epoch: bigint;
  destinationId: bigint;
  votes: bigint;
  totalVotes: bigint;
  hash: Hash;
  block: bigint;
};
export type TripHistory = {
  navigators: Navigator[];
  finals: Finalization[];
  through: bigint;
  from: bigint;
};
export function rankNavigators(
  route: RouteStop[],
  votes: { epoch: bigint; voter: Address; destinationId: bigint }[],
): Navigator[] {
  const winners = new Map(route.map((s) => [String(s.epoch), s.destinationId]));
  const wins = new Map<Address, Set<bigint>>();
  for (const vote of votes) {
    if (winners.get(String(vote.epoch)) !== vote.destinationId) continue;
    const address = getAddress(vote.voter),
      epochs = wins.get(address) ?? new Set<bigint>();
    epochs.add(vote.epoch);
    wins.set(address, epochs);
  }
  return [...wins]
    .map(([address, epochs]) => {
      let best = 0,
        run = 0,
        last = -2n;
      for (const epoch of [...epochs].sort((a, b) => (a < b ? -1 : 1))) {
        run = epoch === last + 1n ? run + 1 : 1;
        best = Math.max(best, run);
        last = epoch;
      }
      return { address, wins: epochs.size, streak: best };
    })
    .sort(
      (a, b) =>
        b.wins - a.wins ||
        a.address.toLowerCase().localeCompare(b.address.toLowerCase()),
    );
}
// In-memory incremental history never accepts user-editable localStorage as chain evidence.
let historyCache:
  | {
      key: string;
      through: bigint;
      votes: { epoch: bigint; voter: Address; destinationId: bigint }[];
      finals: Finalization[];
    }
  | undefined;
export async function readNavigators(
  runtime: Runtime,
  _route: RouteStop[],
): Promise<TripHistory> {
  const { client, contract, abi, deployment } = runtime;
  const tip = await client.getBlockNumber({ cacheTime: 0 });
  const through = tip > 12n ? tip - 12n : 0n;
  const record = handoff.contracts.find(
    (c) =>
      c.name === contract.name &&
      c.address.toLowerCase() === contract.address.toLowerCase(),
  );
  if (!record || deployment.chainId !== handoff.chainId)
    throw new Error("History deployment does not match.");
  const from = BigInt(record.blockNumber),
    key = `${deployment.chainId}:${contract.address}`;
  const cache =
    historyCache?.key === key && historyCache.through <= through
      ? historyCache
      : undefined;
  const votes = cache ? [...cache.votes] : [],
    finals = cache ? [...cache.finals] : [];
  let cursor = cache ? cache.through + 1n : from,
    range = 5000n;
  while (cursor <= through) {
    const end = cursor + range - 1n > through ? through : cursor + range - 1n;
    try {
      const logs = await client.getContractEvents({
        address: contract.address,
        abi,
        fromBlock: cursor,
        toBlock: end,
        strict: true,
      });
      for (const log of logs) {
        if (log.eventName === "Voted")
          votes.push(
            log.args as unknown as {
              epoch: bigint;
              voter: Address;
              destinationId: bigint;
            },
          );
        if (
          log.eventName === "Finalized" &&
          log.transactionHash &&
          log.blockNumber !== null
        ) {
          const a = log.args as unknown as Omit<Finalization, "hash" | "block">;
          finals.push({
            ...a,
            hash: log.transactionHash,
            block: log.blockNumber,
          });
        }
      }
      cursor = end + 1n;
    } catch (error) {
      if (range <= 100n) throw error;
      range /= 2n;
    }
  }
  const safeRoute = (await client.readContract({
    address: contract.address,
    abi,
    functionName: "route",
    blockNumber: through,
  })) as RouteStop[];
  historyCache = { key, through, votes, finals };
  return {
    navigators: rankNavigators(safeRoute, votes),
    finals,
    through,
    from,
  };
}
export function creditedEpoch(
  runtime: Runtime,
  logs: { data: Hash; topics: readonly Hash[] }[],
): bigint | undefined {
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({
        abi: runtime.abi,
        data: log.data,
        topics: log.topics as [Hash, ...Hash[]],
      }) as { eventName: string; args: unknown };
      if (decoded.eventName === "Voted")
        return (decoded.args as { epoch: bigint }).epoch;
    } catch {
      /* unrelated log */
    }
  }
}
export const epochDate = (epoch: bigint, seconds = 86400n) =>
  new Date(Number(epoch * seconds) * 1000).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
export function friendlyError(error: unknown) {
  let current = error;
  const messages: string[] = [];
  for (let i = 0; i < 8 && current && typeof current === "object"; i++) {
    const e = current as {
      name?: string;
      shortMessage?: string;
      message?: string;
      code?: number;
      data?: { errorName?: string };
      cause?: unknown;
    };
    if (e.code === 4001 || e.name === "UserRejectedRequestError")
      return "Request declined in your wallet. You can try again.";
    if (e.data?.errorName) messages.push(e.data.errorName);
    messages.push(e.shortMessage ?? e.message ?? "");
    current = e.cause;
  }
  const message = messages.join(" ");
  const errors: Record<string, string> = {
    AlreadyVoted:
      "This wallet has already voted today. Come back after 00:00 UTC.",
    InvalidDestination: "Choose a destination from the list and try again.",
    EpochNotEnded:
      "Voting is still open for this day. Finalize after 00:00 UTC.",
    AlreadyFinalized: "This day is already in the route. Refresh the trip.",
    NoVotes: "This day has no votes, so it adds no stop.",
    NotNextInQueue:
      "An older day is waiting. Refresh and finalize that day first.",
    NotFinalized: "This day has not been finalized yet.",
    insufficient:
      "Your wallet needs Sepolia test ETH for gas. Use the faucet link.",
    "Account or chain changed":
      "Your wallet account or network changed. Review the action again.",
    locked: "Unlock your wallet, then try connecting again.",
    "already pending":
      "A request is already waiting in your wallet. Open the wallet to continue.",
    rejected: "Request declined in your wallet. You can try again.",
    denied: "Request declined in your wallet. You can try again.",
  };
  for (const [key, text] of Object.entries(errors))
    if (message.toLowerCase().includes(key.toLowerCase())) return text;
  return "The request could not complete. Check your connection and wallet, then try again.";
}
