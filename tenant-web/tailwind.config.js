/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'media',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        canvas: {
          DEFAULT: '#FBFBFB',
          ink: '#09090B',
        },
        ink: {
          950: '#18181b',
          800: '#27272a',
          600: '#52525b',
          400: '#a1a1aa',
        },
        meadow: {
          600: '#059669',
          500: '#10b981',
        },
      },
    },
  },
  plugins: [],
};
