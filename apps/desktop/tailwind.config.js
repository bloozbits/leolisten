/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#09090b',
        surface: {
          DEFAULT: '#121215',
          subtle: '#18181b',
          elevated: '#27272a',
          hover: '#2e2e33',
        },
        brand: {
          red: '#ff0033',
          DEFAULT: '#ff0033',
          glow: 'rgba(255, 0, 51, 0.4)',
        },
      },
      fontFamily: {
        sans: [
          'Rubik',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'sans-serif',
        ],
      },
      boxShadow: {
        'glow-red': '0 0 25px -5px rgba(255, 0, 51, 0.5)',
        'player': '0 -4px 20px 0 rgba(0, 0, 0, 0.6)',
      },
    },
  },
  plugins: [],
}

