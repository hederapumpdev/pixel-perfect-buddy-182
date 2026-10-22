// Compiles contracts/HederaPumpRouter.sol (Markets swap router). Run: bun contracts/compile-router.mjs
import solc from "solc";
import { readFileSync, writeFileSync } from "node:fs";

const input = {
  language: "Solidity",
  sources: { "HederaPumpRouter.sol": { content: readFileSync("contracts/HederaPumpRouter.sol", "utf8") } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: "cancun",
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
  },
};
const out = JSON.parse(solc.compile(JSON.stringify(input)));
const errs = (out.errors ?? []).filter((e) => e.severity === "error");
if (errs.length) { console.error(errs.map((e) => e.formattedMessage).join("\n")); process.exit(1); }
const c = out.contracts["HederaPumpRouter.sol"].HederaPumpRouter;
writeFileSync("src/lib/contract-artifact-router.json", JSON.stringify({ abi: c.abi, bytecode: c.evm.bytecode.object }));
console.log("bytecode bytes:", c.evm.bytecode.object.length / 2);
