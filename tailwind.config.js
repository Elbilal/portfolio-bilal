/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './assets/js/**/*.js'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink:      '#0B1215',
        surface:  '#121B1F',
        surface2: '#172327',
        hair:     'rgba(232,237,233,0.10)',
        text:     '#E7ECE8',
        muted:    '#93A3A0',
        amber:    '#E3A857',
        teal:     '#5FB8AE',
        danger:   '#E36857',
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
