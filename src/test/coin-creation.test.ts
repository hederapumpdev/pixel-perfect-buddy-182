import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import solc from "solc";
import { decodeFunctionData, getAddress, type Abi } from "viem";
import { COIN_CREATION_ENABLED, LATEST_CONTRACT_ID, PUMP_CONTRACTS, V4_CONTRACTS, PUMP_CONTRACT_V4_LEGACY_ID } from "@/lib/hedera-config";
import { encodePumpV4 } from "@/lib/curve";
import artifact from "@/lib/contract-artifact-v4.json";

type Ast = { nodeType: string; id?: number; name?: string; value?: string; memberName?: string; referencedDeclaration?: number; [key: string]: unknown };
function nodes(value: unknown): Ast[] {
  if (!value || typeof value !== "object") return [];
  const obj = value as Ast;
  return [...(typeof obj.nodeType === "string" ? [obj] : []), ...Object.values(obj).flatMap(nodes)];
}

describe("coin creation repair", () => {
  it("creates with the legacy 0x167 service and tuple, never unsupported 0x16c", () => {
    const source = readFileSync("contracts/HederaPumpV4.sol", "utf8");
    const output = JSON.parse(solc.compile(JSON.stringify({
      language: "Solidity", sources: { "Pump.sol": { content: source } },
      settings: { outputSelection: { "*": { "": ["ast"] } } },
    })));
    expect((output.errors ?? []).filter((e: { severity: string }) => e.severity === "error")).toEqual([]);
    const ast = nodes(output.sources["Pump.sol"].ast);
    const legacyService = ast.find(n => n.nodeType === "VariableDeclaration" && n.name === "HTS");
    expect(nodes(legacyService).filter(n => n.nodeType === "Literal").map(n => n.value)).toContain("0x167");
    expect(ast.filter(n => n.nodeType === "Literal").map(n => n.value)).not.toContain("0x16c");
    const tuple = ast.find(n => n.nodeType === "StructDefinition" && n.name === "HederaToken");
    expect(nodes(tuple).filter(n => n.nodeType === "VariableDeclaration").map(n => n.name)).not.toContain("metadata");
    const creationCall = ast.find(n => n.nodeType === "MemberAccess" && n.memberName === "createFungibleToken");
    expect(nodes(creationCall).find(n => n.nodeType === "Identifier")?.referencedDeclaration).toBe(legacyService?.id);
  });

  it("enables creation only on the verified legacy replacement while retaining previous v4 coins", () => {
    expect(COIN_CREATION_ENABLED).toBe(true);
    expect(PUMP_CONTRACT_V4_LEGACY_ID).toBe("0.0.10925881");
    expect(LATEST_CONTRACT_ID).toBe("0.0.10925881");
    expect(V4_CONTRACTS).toContain("0.0.10925881");
    expect(PUMP_CONTRACTS).toContain("0.0.10925881");
    expect(V4_CONTRACTS).toContain("0.0.10925851");
    expect(PUMP_CONTRACTS).toContain("0.0.10924813");
    expect(V4_CONTRACTS).toContain("0.0.10924813");
  });

  it("encodes a v4 launch buy with the required third referrer argument", () => {
    const token = "0x0000000000000000000000000000000000a6b30d";
    const referrer = "0x0000000000000000000000000000000000000000";
    const decoded = decodeFunctionData({ abi: artifact.pumpAbi as Abi, data: encodePumpV4("buy", [token, 0n, referrer]) });
    expect(decoded.functionName).toBe("buy");
    expect(decoded.args).toEqual([getAddress(token), 0n, referrer]);
  });
});