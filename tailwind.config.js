/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        retro: {
          beige: '#F5F1E8',
          cream: '#FAF7F0',
          green: '#00D084',
          'green-dark': '#00B872',
          'green-light': '#33DDA2',
          black: '#0A0A0A',
          gray: {
            100: '#E5E5E5',
            200: '#CCCCCC',
            300: '#B3B3B3',
            400: '#999999',
            500: '#666666',
            600: '#4D4D4D',
            700: '#333333',
            800: '#1A1A1A',
          },
        },
      },
      fontFamily: {
        mono: ['DM Mono', 'Courier New', 'monospace'],
      },
      borderRadius: {
        retro: '2px',
      },
      boxShadow: {
        retro: '4px 4px 0px rgba(0, 0, 0, 0.1)',
        'retro-lg': '8px 8px 0px rgba(0, 0, 0, 0.15)',
      },
    },
  },
  plugins: [],
}
