// Compiles contracts/HederaPump.sol into src/lib/contract-artifact.json.
// Run: bun contracts/compile.mjs
import solc from "solc";
import { readFileSync, writeFileSync } from "node:fs";

const input = {
  language: "Solidity",
  sources: { "HederaPump.sol": { content: readFileSync("contracts/HederaPump.sol", "utf8") } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: "cancun",
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
  },
};
const out = JSON.parse(solc.compile(JSON.stringify(input)));
const errs = (out.errors ?? []).filter((e) => e.severity === "error");
if (errs.length) { console.error(errs.map((e) => e.formattedMessage).join("\n")); process.exit(1); }
const pump = out.contracts["HederaPump.sol"].HederaPump;
const token = out.contracts["HederaPump.sol"].PumpToken;
writeFileSync("src/lib/contract-artifact.json", JSON.stringify({
  pumpAbi: pump.abi, tokenAbi: token.abi, bytecode: pump.evm.bytecode.object,
}));
console.log("bytecode bytes:", pump.evm.bytecode.object.length / 2);
