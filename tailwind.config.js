/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{vue,js,ts,jsx,tsx}",
    "./pages/**/*.{vue,js,ts,jsx,tsx}",
    "./components/**/*.{vue,js,ts,jsx,tsx}",
    "./layouts/**/*.{vue,js,ts,jsx,tsx}",
    "./app.vue",
  ],
  theme: {
    extend: {
      colors: {
        'whisper': {
          black: '#121212',
          cream: '#FDFCF0',
          terracotta: '#C05A3E',
          ochre: '#D4A373',
          stone: '#E5E4D7',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'sans-serif'],
      },
      spacing: {
        '18': '4.5rem',
      }
    },
  },
  plugins: [],
}
