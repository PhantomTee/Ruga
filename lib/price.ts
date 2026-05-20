import { PRICE_SCALE } from "./constants";

export function unscaleUsd(value: string | number | null | undefined) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return numeric / PRICE_SCALE;
}
