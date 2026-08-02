/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './assets/js/**/*.js'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink:      'rgb(var(--color-ink) / <alpha-value>)',
        surface:  'rgb(var(--color-surface) / <alpha-value>)',
        surface2: 'rgb(var(--color-surface2) / <alpha-value>)',
        hair:     'var(--color-hair)',
        text:     'rgb(var(--color-text) / <alpha-value>)',
        muted:    'rgb(var(--color-muted) / <alpha-value>)',
        amber:    'rgb(var(--color-amber) / <alpha-value>)',
        teal:     'rgb(var(--color-teal) / <alpha-value>)',
        danger:   'rgb(var(--color-danger) / <alpha-value>)',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        sans: ['"IBM Plex Sans"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      boxShadow: {
        window: '0 20px 60px -20px rgba(0,0,0,0.6)',
        glow: '0 0 0 4px rgba(227,168,87,0.15)',
      },
      keyframes: {
        blink: { '50%': { opacity: 0 } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        pop: { '0%': { transform: 'scale(.96)', opacity: 0 }, '100%': { transform: 'scale(1)', opacity: 1 } },
      },
      animation: {
        blink: 'blink 1.1s steps(1) infinite',
        shimmer: 'shimmer 1.6s infinite',
        pop: 'pop .25s ease',
      },
    },
  },
  plugins: [],
};
