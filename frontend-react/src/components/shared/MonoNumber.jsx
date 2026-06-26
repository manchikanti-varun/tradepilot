export default function MonoNumber({ value, prefix = '', suffix = '', color, className = '' }) {
  const colorClass = color === 'buy' ? 'text-buy'
    : color === 'sell' ? 'text-sell'
    : color === 'watch' ? 'text-watch'
    : color === 'info' ? 'text-info'
    : 'text-text-primary';

  return (
    <span className={`font-mono ${colorClass} ${className}`}>
      {prefix}{value}{suffix}
    </span>
  );
}
