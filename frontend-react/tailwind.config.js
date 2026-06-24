/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        dark: { 900: '#0a0e14', 800: '#111827', 700: '#1a2435', 600: '#243044' },
        accent: { blue: '#4da6ff', green: '#00d4aa', red: '#ff4757', amber: '#ffb347', purple: '#a78bfa' }
      }
    }
  },
  plugins: []
}
