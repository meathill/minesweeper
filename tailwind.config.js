import daisyUi from 'daisyui';

/** @type {import('tailwindcss').Config} */
export default {
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
