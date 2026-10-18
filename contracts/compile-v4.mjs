// Compiles contracts/HederaPumpV4.sol (legacy HTS memo URL + referral fees) into
// a separate artifact; preserve previously deployed v4 bytecode. Run: bun contracts/compile-v4.mjs
import solc from "solc";
import { readFileSync, writeFileSync } from "node:fs";

const input = {
  language: "Solidity",
  sources: { "HederaPumpV4.sol": { content: readFileSync("contracts/HederaPumpV4.sol", "utf8") } },
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
const pump = out.contracts["HederaPumpV4.sol"].HederaPumpV4;
writeFileSync("src/lib/contract-artifact-v4-legacy.json", JSON.stringify({
  pumpAbi: pump.abi, bytecode: pump.evm.bytecode.object,
}));
console.log("bytecode bytes:", pump.evm.bytecode.object.length / 2);
