/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Barlow', 'system-ui', 'sans-serif'],
        display: ['"Barlow Condensed"', 'Barlow', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        ink: { 950: '#05060a', 900: '#0a0c12', 850: '#0e1119', 800: '#131722', 700: '#1b2030', 600: '#262c3f' },
        amber: { 300: '#ffd08a', 400: '#ffb347', 500: '#ff8a1f', 600: '#f06d00' },
        signal: { 400: '#5eead4', 500: '#22d3ee' },
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(255,138,31,.35), 0 10px 40px -10px rgba(255,138,31,.55)',
        card: '0 1px 0 0 rgba(255,255,255,.04) inset, 0 20px 50px -20px rgba(0,0,0,.6)',
      },
      keyframes: {
        road: { '0%': { strokeDashoffset: '0' }, '100%': { strokeDashoffset: '-120' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        pulsering: { '0%': { transform: 'scale(.8)', opacity: '.8' }, '100%': { transform: 'scale(2.4)', opacity: '0' } },
      },
      animation: {
        road: 'road 1.2s linear infinite',
        float: 'float 6s ease-in-out infinite',
        shimmer: 'shimmer 3s linear infinite',
        pulsering: 'pulsering 1.8s cubic-bezier(.2,.6,.4,1) infinite',
      },
    },
  },
  plugins: [],
};
