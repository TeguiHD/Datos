import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef7ff',
          500: '#2563eb',
          600: '#1d4ed8',
          900: '#0b2a6e',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
