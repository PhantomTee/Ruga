"use client";

export function PriceChart({ prices }: { prices: Array<[number, number]> }) {
  if (!prices.length) {
    return (
      <div className="h-56 bg-black flex flex-col items-center justify-center gap-2">
        <div className="font-mono text-xs text-white/30">NO PRICE HISTORY AVAILABLE</div>
        <div className="font-mono text-[10px] text-white/20">Token not indexed by CoinGecko</div>
      </div>
    );
  }

  const width = 820;
  const height = 260;
  const padding = 24;
  const positive = prices.filter(([, price]) => price > 0);
  const min = Math.min(...positive.map(([, price]) => Math.log10(price)));
  const max = Math.max(...positive.map(([, price]) => Math.log10(price)));
  const spread = max - min || 1;
  const firstTime = prices[0][0];
  const lastTime = prices[prices.length - 1][0];
  const timeSpread = lastTime - firstTime || 1;

  const path = prices
    .map(([time, price], index) => {
      const x = padding + ((time - firstTime) / timeSpread) * (width - padding * 2);
      const y = height - padding - ((Math.log10(Math.max(price, Number.MIN_VALUE)) - min) / spread) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg className="h-64 w-full border border-ruga-line bg-black" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Seven day logarithmic price chart">
      <path d={path} fill="none" stroke="#00ff41" strokeWidth="2" />
      <text x={padding} y={24} fill="#ffffff99" fontSize="12">
        LOG SCALE / 7D PRICE
      </text>
      <text x={padding} y={height - 8} fill="#ffffff66" fontSize="11">
        ${positive[0]?.[1]?.toExponential(3)}
      </text>
      <text x={width - 150} y={height - 8} fill="#ffffff66" fontSize="11">
        ${positive.at(-1)?.[1]?.toExponential(3)}
      </text>
    </svg>
  );
}
