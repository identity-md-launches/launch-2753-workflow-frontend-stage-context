import { decodeEventLog, getAddress, type Address, type Hash } from "viem";
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
export async function readSnapshot(
  runtime: Runtime,
  account?: Address,
): Promise<Snapshot> {
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
  const [end, total, leader, pending, route, ballot, balance, ...votes] =
    await Promise.all([
      read("epochEnd", [epoch]),
      read("totalVotes", [epoch]),
      read("leaderOf", [epoch]),
      read("pendingEpoch"),
      read("route"),
      account ? read("voteOf", [epoch, account]) : undefined,
      account
        ? client.getBalance({ address: account, blockNumber: block.number })
        : undefined,
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
    ballot: ballot as [boolean, bigint] | undefined,
    balance: balance as bigint | undefined,
    readAt: Date.now(),
  };
}
export type Navigator = { address: Address; wins: number };
export async function readNavigators(
  runtime: Runtime,
  route: RouteStop[],
): Promise<{ navigators: Navigator[]; through: bigint; from: bigint }> {
  const { client, contract, abi, deployment } = runtime;
  const tip = await client.getBlockNumber();
  const through = tip > 12n ? tip - 12n : 0n;
  if (!route.length) return { navigators: [], through, from: through };
  const safeRoute = (await client.readContract({
    address: contract.address,
    abi,
    functionName: "route",
    blockNumber: through,
  })) as RouteStop[];
  if (!safeRoute.length) return { navigators: [], through, from: through };
  // Find the creation block from code, rather than maintaining another deployment map.
  let lo = 0n,
    hi = through;
  const key = `hrt-deploy-${deployment.chainId}-${contract.address}`;
  try {
    const saved = localStorage.getItem(key);
    if (saved && /^\d+$/.test(saved) && BigInt(saved) <= through)
      lo = hi = BigInt(saved);
  } catch {
    /* storage may be blocked */
  }
  while (lo < hi) {
    const mid = (lo + hi) / 2n;
    const code = await client.getCode({
      address: contract.address,
      blockNumber: mid,
    });
    if (code && code !== "0x") hi = mid;
    else lo = mid + 1n;
  }
  try {
    localStorage.setItem(key, lo.toString());
  } catch {
    /* optional cache */
  }
  const winners = new Map(
    safeRoute.map((stop) => [
      stop.epoch.toString(),
      Number(stop.destinationId),
    ]),
  );
  const wins = new Map<Address, Set<string>>();
  let cursor = lo,
    range = 5000n;
  while (cursor <= through) {
    const end = cursor + range - 1n > through ? through : cursor + range - 1n;
    try {
      const logs = await client.getContractEvents({
        address: contract.address,
        abi,
        eventName: "Voted",
        fromBlock: cursor,
        toBlock: end,
        strict: true,
      });
      for (const log of logs) {
        const args = log.args as unknown as {
          epoch: bigint;
          voter: Address;
          destinationId: bigint;
        };
        if (winners.get(args.epoch.toString()) === Number(args.destinationId)) {
          const address = getAddress(args.voter);
          const epochs = wins.get(address) ?? new Set<string>();
          epochs.add(args.epoch.toString());
          wins.set(address, epochs);
        }
      }
      cursor = end + 1n;
    } catch (error) {
      if (range <= 100n) throw error;
      range = range / 2n;
    }
  }
  return {
    navigators: [...wins]
      .map(([address, epochs]) => ({ address, wins: epochs.size }))
      .sort(
        (a, b) =>
          b.wins - a.wins ||
          a.address.toLowerCase().localeCompare(b.address.toLowerCase()),
      ),
    through,
    from: lo,
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
    rejected: "Request declined in your wallet. You can try again.",
    denied: "Request declined in your wallet. You can try again.",
  };
  for (const [key, text] of Object.entries(errors))
    if (message.toLowerCase().includes(key.toLowerCase())) return text;
  return "The request could not complete. Check your connection and wallet, then try again.";
}
