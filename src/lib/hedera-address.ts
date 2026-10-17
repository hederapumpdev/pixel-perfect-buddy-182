/** Only long-zero addresses can be converted locally; aliases require a mirror lookup. */
export function nativeHederaId(value: string): string | null {
  const address = value.trim().toLowerCase();
  if (/^\d+\.\d+\.\d+$/.test(address)) return address;
  if (!/^0x0{24}[a-f0-9]{16}$/.test(address)) return null;
  return `0.0.${BigInt(address).toString()}`;
}

export function fallbackAddress(value: string): string {
  return nativeHederaId(value) ?? (value.length > 18 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value);
}