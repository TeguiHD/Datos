import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

export default {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        /* Tokens semánticos propios */
        bg:           'var(--color-bg)',
        surface:      'var(--color-surface)',
        'surface-2':  'var(--color-surface-2)',
        text:         'var(--color-text)',
        'ds-muted':   'var(--color-text-muted)',
        'ds-accent':  'var(--color-accent)',
        'accent-fg':  'var(--color-accent-fg)',
        'accent-dim': 'var(--color-accent-dim)',
        danger:       'var(--color-danger)',
        'danger-dim': 'var(--color-danger-dim)',
        warn:         'var(--color-warn)',
        'warn-dim':   'var(--color-warn-dim)',
        ok:           'var(--color-ok)',
        'ok-dim':     'var(--color-ok-dim)',
        /* shadcn HSL tokens */
        border:       'hsl(var(--border))',
        input:        'hsl(var(--input))',
        ring:         'hsl(var(--ring))',
        background:   'hsl(var(--background))',
        foreground:   'hsl(var(--foreground))',
        primary: {
          DEFAULT:    'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT:    'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT:    'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        card: {
          DEFAULT:    'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT:    'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        muted: {
          DEFAULT:    'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT:    'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        /* brand legacy */
        brand: {
          50:  '#eef7ff',
          500: '#2563eb',
          600: '#1d4ed8',
          900: '#0b2a6e',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-sora)', 'Trebuchet MS', 'Segoe UI', 'sans-serif'],
        mono: ['var(--font-plex-mono)', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
