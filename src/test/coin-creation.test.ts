import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import solc from "solc";
import { decodeFunctionData, type Abi } from "viem";
import { COIN_CREATION_ENABLED, PUMP_CONTRACTS, V4_CONTRACTS } from "@/lib/hedera-config";
import { encodePumpV4 } from "@/lib/curve";
import artifact from "@/lib/contract-artifact-v4.json";

type Ast = { nodeType: string; id?: number; name?: string; value?: string; memberName?: string; referencedDeclaration?: number; [key: string]: unknown };
function nodes(value: unknown): Ast[] {
  if (!value || typeof value !== "object") return [];
  const obj = value as Ast;
  return [...(typeof obj.nodeType === "string" ? [obj] : []), ...Object.values(obj).flatMap(nodes)];
}

describe("coin creation repair", () => {
  it("routes metadata creation to 0x16c and keeps legacy transfers at 0x167", () => {
    const source = readFileSync("contracts/HederaPumpV4.sol", "utf8");
    const output = JSON.parse(solc.compile(JSON.stringify({
      language: "Solidity", sources: { "Pump.sol": { content: source } },
      settings: { outputSelection: { "*": { "": ["ast"] } } },
    })));
    expect((output.errors ?? []).filter((e: { severity: string }) => e.severity === "error")).toEqual([]);
    const ast = nodes(output.sources["Pump.sol"].ast);
    const createService = ast.find(n => n.nodeType === "VariableDeclaration" && n.name === "HTS_CREATE");
    const legacyService = ast.find(n => n.nodeType === "VariableDeclaration" && n.name === "HTS");
    expect(nodes(createService).filter(n => n.nodeType === "Literal").map(n => n.value)).toContain("0x16c");
    expect(nodes(legacyService).filter(n => n.nodeType === "Literal").map(n => n.value)).toContain("0x167");
    const creationCall = ast.find(n => n.nodeType === "MemberAccess" && n.memberName === "createFungibleToken");
    expect(nodes(creationCall).find(n => n.nodeType === "Identifier")?.referencedDeclaration).toBe(createService?.id);
  });

  it("prevents paid creation retries while retaining original v4 for existing coins", () => {
    expect(COIN_CREATION_ENABLED).toBe(false);
    expect(PUMP_CONTRACTS).toContain("0.0.10924813");
    expect(V4_CONTRACTS).toContain("0.0.10924813");
  });

  it("encodes a v4 launch buy with the required third referrer argument", () => {
    const token = "0x0000000000000000000000000000000000a6b30d";
    const referrer = "0x0000000000000000000000000000000000000000";
    const decoded = decodeFunctionData({ abi: artifact.pumpAbi as Abi, data: encodePumpV4("buy", [token, 0n, referrer]) });
    expect(decoded.functionName).toBe("buy");
    expect(decoded.args).toEqual([token, 0n, referrer]);
  });
});