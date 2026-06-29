import Spinner from './Spinner';

const VARIANTS = {
  primary: 'bg-buy text-white hover:bg-buy/90 shadow-sm shadow-buy/20',
  secondary: 'bg-overlay border border-border-mid text-text-primary hover:border-border-hi hover:bg-elevated',
  danger: 'bg-sell text-white hover:bg-sell/90 shadow-sm shadow-sell/20',
  info: 'bg-info text-white hover:bg-info/90 shadow-sm shadow-info/20',
};

export default function PrimaryButton({
  onClick,
  disabled = false,
  loading = false,
  children,
  fullWidth = false,
  variant = 'primary',
  type = 'button',
  icon: Icon,
}) {
  const base = VARIANTS[variant] || VARIANTS.primary;
  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`h-11 px-5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${base} ${widthClass}`}
    >
      {loading && <Spinner size={14} className="text-white" />}
      {!loading && Icon && <Icon size={15} />}
      <span className={loading ? 'opacity-70' : ''}>{children}</span>
    </button>
  );
}
