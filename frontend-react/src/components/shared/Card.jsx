export default function Card({ children, className = '', accent, onClick }) {
  const accentBorder = accent
    ? `border-l-[3px]`
    : '';

  const accentColor = accent === 'high' ? 'border-l-buy'
    : accent === 'medium' ? 'border-l-watch'
    : accent === 'low' ? 'border-l-sell'
    : accent === 'conflicting' ? 'border-l-conflicting'
    : '';

  return (
    <div
      onClick={onClick}
      className={`bg-surface border border-border-dim rounded-lg p-4 ${accentBorder} ${accentColor} ${onClick ? 'cursor-pointer hover:bg-overlay transition-colors duration-100' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
