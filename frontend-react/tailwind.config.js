/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        base: '#09090B',
        surface: '#111115',
        elevated: '#18181C',
        overlay: '#1E1E24',
        'border-dim': '#1F1F27',
        'border-mid': '#2A2A35',
        'border-hi': '#3A3A48',
        'text-primary': '#F0F0F4',
        'text-secondary': '#8B8B9A',
        'text-muted': '#4A4A58',
        buy: '#16A34A',
        sell: '#DC2626',
        watch: '#D97706',
        info: '#2563EB',
        conflicting: '#6B21A8',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'ui': ['11px', { letterSpacing: '0.08em', lineHeight: '1' }],
        'section': ['10px', { letterSpacing: '0.1em', lineHeight: '1' }],
      },
      spacing: {
        '4.5': '18px',
      },
      keyframes: {
        flashGreen: {
          '0%, 100%': { borderColor: '#1F1F27' },
          '50%': { borderColor: '#16A34A' },
        },
        flashRed: {
          '0%, 100%': { borderColor: '#1F1F27' },
          '50%': { borderColor: '#DC2626' },
        },
        hardStop: {
          '0%, 100%': { background: 'transparent' },
          '50%': { background: 'rgba(220,38,38,0.15)' },
        },
        slideIn: {
          from: { opacity: '0', transform: 'translateY(-8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
      },
      animation: {
        'flash-green': 'flashGreen 300ms ease-out',
        'flash-red': 'flashRed 300ms ease-out',
        'hard-stop': 'hardStop 300ms ease-out',
        'slide-in': 'slideIn 150ms ease-out',
        'shimmer': 'shimmer 1.5s infinite linear',
        'pulse-slow': 'pulse 2s infinite',
      },
    },
  },
  plugins: [],
}
