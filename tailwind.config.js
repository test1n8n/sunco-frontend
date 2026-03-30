/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#080a0f',
        panel: '#0d1117',
        card: '#111520',
        border: '#1c2333',
        'text-primary': '#c9d1d9',
        'text-secondary': '#8b949e',
        'text-dim': '#4b5563',
        accent: '#f59e0b',
        'accent-hover': '#d97706',
        positive: '#22c55e',
        negative: '#ef4444',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
