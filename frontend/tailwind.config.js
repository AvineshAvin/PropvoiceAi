/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0A0A0A',
          900: '#111111',
          700: '#3F3F46',
          500: '#71717A',
        },
        navy: {
          950: '#0A0A0A',
          900: '#111111',
          800: '#27272A',
          700: '#3F3F46',
        },
        brand: {
          50: '#F4F4F5',
          100: '#E4E4E7',
          500: '#18181B',
          600: '#111111',
          700: '#000000',
        },
      },
      fontFamily: {
        sans: ['Inter', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
