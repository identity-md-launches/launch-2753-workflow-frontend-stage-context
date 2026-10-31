import { readFile, readdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { abiHash, readJSON } from "./shared.mjs";
const web = fileURLToPath(new URL("../", import.meta.url));
const dist = resolve(web, "../dist");
const manifest = await readJSON(join(dist, "imd-deployment.json"));
const handoff = await readJSON(join(web, "deployment/handoff.json"));
const chainTable = await readJSON(join(web, "deployment/network.json"));
assert.deepEqual(
  Object.keys(manifest).sort(),
  [
    "version",
    "launchId",
    "chainId",
    "sourceCommit",
    "attestationHash",
    "contracts",
    "assets",
    "network",
    ...(chainTable.walletAddChain ? ["walletAddChain"] : []),
    ...(handoff.poolKey ? ["poolKey"] : []),
  ].sort(),
);
for (const key of [
  "version",
  "launchId",
  "chainId",
  "sourceCommit",
  "attestationHash",
])
  assert.equal(manifest[key], handoff[key]);
assert.deepEqual(manifest.network, chainTable.network);
assert.deepEqual(manifest.walletAddChain, chainTable.walletAddChain);
assert.deepEqual(manifest.poolKey, handoff.poolKey);
assert.deepEqual(
  manifest.contracts.map(({ name, address, abiHash }) => ({
    name,
    address,
    abiHash,
  })),
  handoff.contracts.map(({ name, address, abiHash }) => ({
    name,
    address,
    abiHash,
  })),
);
const safe = (path) =>
  typeof path === "string" &&
  !path.startsWith("/") &&
  !path.includes("..") &&
  !path.includes(":") &&
  !path.includes("\\");
for (const contract of manifest.contracts) {
  assert(safe(contract.abiPath));
  assert.equal(
    abiHash(await readJSON(join(dist, contract.abiPath))),
    contract.abiHash,
  );
}
const files = [];
async function walk(dir, prefix = "") {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    assert(!e.isSymbolicLink(), "No symlinks in export");
    if (e.isDirectory()) await walk(join(dir, e.name), `${prefix}${e.name}/`);
    else if (prefix + e.name !== "imd-deployment.json")
      files.push(prefix + e.name);
  }
}
await walk(dist);
assert(manifest.assets.length <= 128);
assert.deepEqual(files.sort(), manifest.assets.map((a) => a.path).sort());
assert.equal(new Set(manifest.assets.map((a) => a.path)).size, files.length);
let total = 0;
for (const asset of manifest.assets) {
  assert(safe(asset.path));
  assert.match(asset.sha256, /^[0-9a-f]{64}$/);
  const data = await readFile(join(dist, asset.path));
  total += data.length;
  assert(data.length <= 8388608);
  assert.equal(
    createHash("sha256").update(data).digest("hex"),
    asset.sha256,
    asset.path,
  );
}
total += (await stat(join(dist, "imd-deployment.json"))).size;
assert(total < 16 * 1024 * 1024, "Response budget headroom");
console.log(
  `Verified exact handoff, network, ABI and ${files.length} asset hashes; export ${total.toLocaleString()} bytes.`,
);
