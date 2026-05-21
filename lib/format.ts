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
  if (totalSeconds <= 0) return "ENDED";
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function timeAgoShort(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
