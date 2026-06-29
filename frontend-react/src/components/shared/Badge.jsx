const VARIANTS = {
  high: 'bg-buy/12 text-buy border border-buy/30',
  medium: 'bg-watch/12 text-watch border border-watch/30',
  low: 'bg-sell/12 text-sell border border-sell/30',
  conflicting: 'bg-conflicting/12 text-conflicting border border-conflicting/30',
  info: 'bg-info/12 text-info border border-info/30',
  neutral: 'bg-overlay text-text-secondary border border-border-dim',
  buy: 'bg-buy/12 text-buy border border-buy/30',
  sell: 'bg-sell/12 text-sell border border-sell/30',
  watch: 'bg-watch/12 text-watch border border-watch/30',
};

export default function Badge({ variant = 'neutral', children, className = '' }) {
  const styles = VARIANTS[variant] || VARIANTS.neutral;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide ${styles} ${className}`}>
      {children}
    </span>
  );
}
