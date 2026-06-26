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
    ? 'border-sell focus:border-sell'
    : success
    ? 'border-buy focus:border-buy'
    : 'border-border-dim focus:border-border-mid';

  return (
    <div className="w-full">
      {label && (
        <label className="block text-[10px] uppercase tracking-[0.08em] text-text-muted font-medium mb-1.5">
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
          className={`w-full h-10 bg-elevated border ${borderClass} rounded-md px-3 text-sm text-text-primary outline-none transition-colors duration-100 placeholder:text-text-muted disabled:opacity-50 disabled:cursor-not-allowed ${showToggle ? 'pr-10' : ''}`}
        />
        {showToggle && type === 'password' && (
          <button
            type="button"
            onClick={() => setVisible(!visible)}
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors duration-100"
          >
            {visible ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {error && (
        <p className="text-[12px] text-sell mt-1.5">{error}</p>
      )}
    </div>
  );
}
