// Compiles contracts/HederaPumpHTS.sol (native Hedera tokens + SaucerSwap) into
// src/lib/contract-artifact-hts.json. Run: bun contracts/compile-hts.mjs
import solc from "solc";
import { readFileSync, writeFileSync } from "node:fs";

const input = {
  language: "Solidity",
  sources: { "HederaPumpHTS.sol": { content: readFileSync("contracts/HederaPumpHTS.sol", "utf8") } },
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
const pump = out.contracts["HederaPumpHTS.sol"].HederaPumpHTS;
writeFileSync("src/lib/contract-artifact-hts.json", JSON.stringify({
  pumpAbi: pump.abi, bytecode: pump.evm.bytecode.object,
}));
console.log("bytecode bytes:", pump.evm.bytecode.object.length / 2);
