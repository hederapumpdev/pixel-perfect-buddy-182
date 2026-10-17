import { useQuery } from "@tanstack/react-query";
import { MIRROR_URL, NETWORK } from "@/lib/hedera-config";
import { fallbackAddress, nativeHederaId } from "@/lib/hedera-address";

export function useHederaId(address: string) {
  const native = nativeHederaId(address);
  const normalized = address.trim().toLowerCase();
  const query = useQuery({
    queryKey: ["hedera-account-id", NETWORK, normalized],
    enabled: !native && /^0x[a-f0-9]{40}$/.test(normalized),
    staleTime: 60 * 60 * 1000,
    retry: false,
    queryFn: async ({ signal }) => {
      const response = await fetch(`${MIRROR_URL}/api/v1/accounts/${normalized}?transactions=false`, { signal });
      if (!response.ok) return null;
      const account = await response.json();
      return typeof account.account === "string" ? nativeHederaId(account.account) : null;
    },
  });
  return native ?? query.data ?? null;
}

export function HederaAddress({ address }: { address: string }) {
  const id = useHederaId(address);
  return <span title={address}>{id ?? fallbackAddress(address)}</span>;
}