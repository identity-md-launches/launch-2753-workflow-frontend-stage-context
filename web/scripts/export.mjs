import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { abiHash, readJSON } from "./shared.mjs";

const web = fileURLToPath(new URL("../", import.meta.url));
const root = resolve(web, "..");
const dist = join(root, "dist");
const handoff = await readJSON(join(web, "deployment/handoff.json"));
const network = await readJSON(join(web, "deployment/network.json"));
const contracts = [];
for (const contract of handoff.contracts) {
  if (!/^[A-Za-z0-9_]+$/.test(contract.name))
    throw new Error("Unsafe contract name");
  const sourcePath = `docs/abi/${contract.name}.json`;
  const pinned = execFileSync(
    "git",
    ["show", `${handoff.sourceCommit}:${sourcePath}`],
    { cwd: root },
  );
  const source = await readFile(join(root, sourcePath));
  if (!pinned.equals(source))
    throw new Error(`${sourcePath} differs from pinned source`);
  const abi = JSON.parse(source.toString());
  if (!Array.isArray(abi) || abiHash(abi) !== contract.abiHash)
    throw new Error(`ABI hash mismatch: ${contract.name}`);
  const abiPath = `abi/${contract.name}.json`;
  await mkdir(join(dist, "abi"), { recursive: true });
  await writeFile(join(dist, abiPath), source);
  contracts.push({
    name: contract.name,
    address: contract.address,
    abiHash: contract.abiHash,
    abiPath,
  });
}
const assets = [];
async function walk(directory, prefix = "") {
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort(
    (a, b) => a.name.localeCompare(b.name),
  )) {
    const path = prefix + entry.name;
    if (entry.isDirectory())
      await walk(join(directory, entry.name), `${path}/`);
    else if (path !== "imd-deployment.json") {
      const bytes = await readFile(join(dist, path));
      if (bytes.length > 8388608) throw new Error(`Oversized asset: ${path}`);
      assets.push({
        path,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
    }
  }
}
await walk(dist);
if (assets.length > 128) throw new Error("Too many assets");
const manifest = {
  version: 1,
  launchId: handoff.launchId,
  chainId: handoff.chainId,
  sourceCommit: handoff.sourceCommit,
  attestationHash: handoff.attestationHash,
  contracts,
  assets,
  ...(handoff.poolKey ? { poolKey: handoff.poolKey } : {}),
  network: network.network,
  ...(network.walletAddChain ? { walletAddChain: network.walletAddChain } : {}),
};
await writeFile(
  join(dist, "imd-deployment.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(`Export manifest: ${assets.length} assets; pinned ABIs verified.`);
