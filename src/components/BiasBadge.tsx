interface BiasBadgeProps {
  bias: 'bullish' | 'bearish' | 'neutral';
}

const biasStyles: Record<string, string> = {
  bullish: 'bg-[#2E7D32] text-white',
  bearish: 'bg-[#C62828] text-white',
  neutral: 'bg-[#757575] text-white',
};

export default function BiasBadge({ bias }: BiasBadgeProps) {
  return (
    <span
      className={`inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${biasStyles[bias]}`}
    >
      {bias}
    </span>
  );
}
