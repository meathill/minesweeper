/** @type {import('tailwindcss').Config} */
const daisyUi = require('daisyui');

module.exports = {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [daisyUi],
  daisyUi: {
    themes: ['cupcake', 'dark'],
  },
}
