import { createPublicClient, http } from "viem";
import { readJSON } from "./shared.mjs";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";
const web = fileURLToPath(new URL("../", import.meta.url));
const manifest = await readJSON(web + "../dist/imd-deployment.json");
const handoff = await readJSON(web + "deployment/handoff.json");
const rpc = process.argv[2] ?? manifest.network.rpcUrls[0];
const client = createPublicClient({
  transport: http(rpc, { batch: true, timeout: 15000, retryCount: 1 }),
});
const contract = manifest.contracts.find((c) => c.name === "RoadTripVotes");
const abi = await readJSON(web + "../dist/" + contract.abiPath);
const block = await client.getBlock();
const chainId = await client.getChainId();
if (chainId !== manifest.chainId) throw new Error("Wrong chain");
const code = await client.getCode({
  address: contract.address,
  blockNumber: block.number,
});
if (!code || code === "0x") throw new Error("Empty contract code");
const read = (functionName) =>
  client.readContract({
    address: contract.address,
    abi,
    functionName,
    blockNumber: block.number,
  });
const receipt = await client.getTransactionReceipt({
  hash: handoff.contracts[0].txHash,
});
const [epochSeconds, count, epoch, total, pending, length] = await Promise.all(
  [
    "epochSeconds",
    "destinationCount",
    "currentEpoch",
    "totalVotes",
    "pendingEpoch",
    "routeLength",
  ].map((name) =>
    name === "totalVotes"
      ? read("currentEpoch").then((epoch) =>
          client.readContract({
            address: contract.address,
            abi,
            functionName: name,
            args: [epoch],
            blockNumber: block.number,
          }),
        )
      : read(name),
  ),
);
if (
  epochSeconds !== 86400n ||
  count !== 64n ||
  receipt.status !== "success" ||
  receipt.blockNumber !== BigInt(handoff.contracts[0].blockNumber)
)
  throw new Error("Contract configuration or deployment receipt mismatch");
const result = {
  checkedAt: new Date().toISOString(),
  rpcSource: manifest.network.rpcUrls[0],
  chainId,
  block: String(block.number),
  contract: contract.address,
  runtimeCodeBytes: (code.length - 2) / 2,
  deploymentReceiptStatus: receipt.status,
  deploymentBlock: String(receipt.blockNumber),
  epochSeconds: String(epochSeconds),
  destinationCount: String(count),
  currentEpoch: String(epoch),
  totalVotes: String(total),
  pending: pending.map(String),
  routeLength: String(length),
  broadcastTransactions: 0,
};
await writeFile(
  web + "../docs/frontend/chain-check.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result, null, 2));
