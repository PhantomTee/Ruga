export function truncateAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatUsd(value: string | number | null | undefined, digits = 2) {
  const num = Number(value || 0);
  return num.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function secondsRemaining(resolvesAt: string | null) {
  if (!resolvesAt) return 0;
  return Math.max(0, Math.floor((new Date(resolvesAt).getTime() - Date.now()) / 1000));
}

export function formatDuration(totalSeconds: number) {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
}
