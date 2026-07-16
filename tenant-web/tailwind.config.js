/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Iowan Old Style"', 'Palatino', 'Georgia', 'serif'],
        sans: ['"Source Sans 3"', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: {
          950: '#1a1410',
          800: '#3d342c',
          600: '#6b5e52',
          400: '#9a8b7a',
        },
        meadow: {
          600: '#3d6b4f',
          500: '#4f8a63',
        },
      },
    },
  },
  plugins: [],
};
