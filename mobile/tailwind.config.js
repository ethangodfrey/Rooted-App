/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#228B22',
        accent: '#50C878',
        honeydew: '#F0FFF0',
        sage: '#9CAF88',
        canvas: '#FFFFFF',
        ink: '#1A1A1A',
        muted: '#6B7280',
        subtle: '#6B7280',
        danger: '#DC2626',
        warn: '#D97706',
        forest: {
          DEFAULT: '#228B22',
          50: '#F0FFF0',
          100: '#F0FFF0',
          200: '#C8E6C9',
          300: '#9CAF88',
          400: '#50C878',
          500: '#228B22',
          600: '#1B6E1B',
          700: '#165816',
          800: '#104210',
          900: '#0A2C0A',
        },
        line: 'transparent',
      },
      borderRadius: {
        card: '14px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0, 0, 0, 0.08)',
      },
    },
  },
  plugins: [],
};
