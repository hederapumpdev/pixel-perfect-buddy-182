// Compiles contracts/HederaPumpPool.sol (our own pools for graduated coins) into
// src/lib/contract-artifact-pool.json. Run: bun contracts/compile-pool.mjs
import solc from "solc";
import { readFileSync, writeFileSync } from "node:fs";

const input = {
  language: "Solidity",
  sources: { "HederaPumpPool.sol": { content: readFileSync("contracts/HederaPumpPool.sol", "utf8") } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    viaIR: true,
    evmVersion: "cancun",
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
  },
};
const out = JSON.parse(solc.compile(JSON.stringify(input)));
const errs = (out.errors ?? []).filter((e) => e.severity === "error");
if (errs.length) { console.error(errs.map((e) => e.formattedMessage).join("\n")); process.exit(1); }
const pool = out.contracts["HederaPumpPool.sol"].HederaPumpPool;
writeFileSync("src/lib/contract-artifact-pool.json", JSON.stringify({
  poolAbi: pool.abi, bytecode: pool.evm.bytecode.object,
}));
console.log("bytecode bytes:", pool.evm.bytecode.object.length / 2);
