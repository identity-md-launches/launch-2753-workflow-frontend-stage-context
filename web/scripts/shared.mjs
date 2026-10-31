import { readFile } from "node:fs/promises";
import { keccak256, toHex } from "viem";
export const canonical = (value) =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((k) => [k, canonical(value[k])]),
        )
      : value;
export const abiHash = (abi) =>
  keccak256(toHex(JSON.stringify(canonical(abi)))).slice(2);
export const readJSON = async (file) =>
  JSON.parse(await readFile(file, "utf8"));
