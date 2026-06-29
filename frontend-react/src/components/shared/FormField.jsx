import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function FormField({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
  success,
  showToggle = false,
  disabled = false,
  autoComplete,
  minLength,
  required,
  onKeyDown,
}) {
  const [visible, setVisible] = useState(false);

  const inputType = showToggle && type === 'password'
    ? (visible ? 'text' : 'password')
    : type;

  const borderClass = error
    ? 'border-sell focus:border-sell focus:ring-1 focus:ring-sell/20'
    : success
    ? 'border-buy focus:border-buy focus:ring-1 focus:ring-buy/20'
    : 'border-border-dim focus:border-info focus:ring-1 focus:ring-info/20';

  return (
    <div className="w-full">
      {label && (
        <label className="block text-[10px] uppercase tracking-wider text-text-muted font-semibold mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={autoComplete}
          minLength={minLength}
          required={required}
          onKeyDown={onKeyDown}
          className={`w-full h-11 bg-elevated border ${borderClass} rounded-xl px-4 text-sm text-text-primary outline-none transition-all placeholder:text-text-muted disabled:opacity-40 disabled:cursor-not-allowed ${showToggle ? 'pr-11' : ''}`}
        />
        {showToggle && type === 'password' && (
          <button
            type="button"
            onClick={() => setVisible(!visible)}
            tabIndex={-1}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
          >
            {visible ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {error && (
        <p className="text-[11px] text-sell mt-1.5 font-medium">{error}</p>
      )}
    </div>
  );
}
