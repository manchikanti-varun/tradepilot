import Spinner from './Spinner';

const VARIANTS = {
  primary: 'bg-buy text-white hover:bg-buy/90',
  secondary: 'bg-elevated border border-border-mid text-text-primary hover:border-border-hi',
  danger: 'bg-sell text-white hover:bg-sell/90',
};

export default function PrimaryButton({
  onClick,
  disabled = false,
  loading = false,
  children,
  fullWidth = false,
  variant = 'primary',
  type = 'button',
}) {
  const base = VARIANTS[variant] || VARIANTS.primary;
  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`h-11 px-5 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-colors duration-100 disabled:opacity-50 disabled:cursor-not-allowed ${base} ${widthClass}`}
    >
      {loading && <Spinner size={14} />}
      <span className={loading ? 'opacity-70' : ''}>{children}</span>
    </button>
  );
}
