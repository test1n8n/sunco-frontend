interface BiasBadgeProps {
  bias: 'bullish' | 'bearish' | 'neutral';
}

const biasStyles: Record<string, string> = {
  bullish: 'bg-positive/10 text-positive border border-positive/30',
  bearish: 'bg-negative/10 text-negative border border-negative/30',
  neutral: 'bg-text-dim/20 text-text-secondary border border-border',
};

export default function BiasBadge({ bias }: BiasBadgeProps) {
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded text-xs font-semibold uppercase tracking-widest ${biasStyles[bias]}`}
    >
      {bias}
    </span>
  );
}
