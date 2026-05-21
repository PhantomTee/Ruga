export type RawSignal = {
  symbol: string;
  name: string;
  source: string;
  reason: string;
  address?: string;
  chain?: string;
};

export type AggregatedSignal = {
  symbol: string;
  name: string;
  sources: string[];
  reasons: string[];
  address?: string;
  chain?: string;
};
