/** @type {import('tailwindcss').Config} */



module.exports = {

  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],

  presets: [require('nativewind/preset')],

  theme: {

    extend: {

      colors: {

        primary: '#C4704B',

        terracotta: '#C4704B',

        accent: '#5B7C5F',

        garden: '#5B7C5F',

        sage: '#5B7C5F',

        honeydew: '#F3EDE4',

        'warm-sage': '#F0F4E8',

        'warm-sage-alt': '#EEF2E6',

        cream: '#FAF6F1',

        surface: '#F5F0EA',

        canvas: '#FAF6F1',

        ink: '#2D2A26',

        soil: '#2D2A26',

        stone: '#7A746B',

        muted: '#7A746B',

        harvest: '#D4A853',

        danger: '#B85C4A',

        warn: '#C4883A',

        forest: {

          DEFAULT: '#5B7C5F',

          50: '#F0F4E8',

          100: '#EEF2E6',

          200: '#DDE5D0',

          300: '#9BB09F',

          400: '#5B7C5F',

          500: '#4A6550',

          600: '#3D5242',

          700: '#314035',

          800: '#252E28',

          900: '#1A201C',

        },

        line: 'transparent',

      },

      borderRadius: {

        card: '20px',

        bento: '24px',

      },

      boxShadow: {

        card: '0 2px 8px rgba(45, 42, 38, 0.06)',

        fab: '0 6px 20px rgba(196, 112, 75, 0.28), 0 2px 8px rgba(91, 124, 95, 0.12)',

      },

    },

  },

  plugins: [],

};


