const VARIANTS = {
  high: 'bg-buy/15 text-buy border border-buy/40',
  medium: 'bg-watch/15 text-watch border border-watch/40',
  low: 'bg-sell/15 text-sell border border-sell/40',
  conflicting: 'bg-conflicting/15 text-conflicting border border-conflicting/40',
  info: 'bg-info/15 text-info border border-info/40',
  neutral: 'bg-overlay text-text-secondary border border-border-dim',
  buy: 'bg-buy/15 text-buy border border-buy/40',
  sell: 'bg-sell/15 text-sell border border-sell/40',
  watch: 'bg-watch/15 text-watch border border-watch/40',
};

export default function Badge({ variant = 'neutral', children, className = '' }) {
  const styles = VARIANTS[variant] || VARIANTS.neutral;

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${styles} ${className}`}>
      {children}
    </span>
  );
}
