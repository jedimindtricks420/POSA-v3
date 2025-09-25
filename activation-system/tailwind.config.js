/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './views/**/*.ejs',
    './public/**/*.{js,css}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      colors: {
        slate: {
          950: '#0b1120',
        },
        'apple-blue': '#0A84FF',
        'apple-gray': '#F2F2F7',
        'apple-green': '#30D158',
        'wallet-bg': '#F5F5F7',
        'wallet-dark': '#1C1C1E',
      },
      boxShadow: {
        wallet: '0 18px 40px rgba(15, 23, 42, 0.18)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
