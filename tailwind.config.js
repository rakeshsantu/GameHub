/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        /* ── Parchment / ivory ── */
        parchment: {
          50:  '#fefdf7',
          100: '#fdf8e7',
          200: '#f9edcb',
          300: '#f3dda4',
          400: '#e8c87a',
          500: '#d4a843',
        },
        /* ── Royal burgundy ── */
        royal: {
          50:  '#fdf2f4',
          100: '#fce7eb',
          400: '#e05a7a',
          500: '#c0395a',
          600: '#9b2a44',
          700: '#7a1f34',
          800: '#5c1526',
          900: '#3d0d19',
          950: '#200509',
        },
        /* ── Forest green ── */
        forest: {
          400: '#4a9e6b',
          500: '#357a52',
          600: '#235c3a',
          700: '#164429',
          800: '#0d2e1c',
          900: '#071a10',
        },
        /* ── Aged wood / mahogany ── */
        wood: {
          300: '#c4956a',
          400: '#a8703d',
          500: '#8b5a2b',
          600: '#6f4420',
          700: '#543016',
          800: '#3a1f0d',
          900: '#221208',
          950: '#130a04',
        },
        /* ── Gold ── */
        gold: {
          200: '#fef3c7',
          300: '#fde68a',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
        /* ── Ink (text) ── */
        ink: {
          100: '#f5f0e8',
          200: '#e8ddc8',
          300: '#cbb895',
          400: '#a8936a',
          500: '#7a6548',
          700: '#3d2e18',
          900: '#1a1208',
        },
      },
      fontFamily: {
        display:  ['"Cinzel Decorative"', 'Palatino Linotype', 'Georgia', 'serif'],
        serif:    ['"Crimson Text"', 'Georgia', 'serif'],
        mono:     ['"Courier New"', 'monospace'],
      },
      backgroundImage: {
        'parchment-texture': "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='400' height='400' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E\")",
        'royal-gradient':   'linear-gradient(160deg, #3d0d19 0%, #200509 40%, #0d2e1c 100%)',
        'card-classical':   'linear-gradient(135deg, rgba(212,168,67,0.08) 0%, rgba(155,42,68,0.08) 100%)',
        'board-wood':       'linear-gradient(145deg, #6f4420 0%, #8b5a2b 30%, #6f4420 60%, #543016 100%)',
      },
      boxShadow: {
        'classical':    '0 4px 20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(212,168,67,0.2)',
        'classical-lg': '0 8px 40px rgba(0,0,0,0.7), inset 0 1px 0 rgba(212,168,67,0.3)',
        'gold-glow':    '0 0 20px rgba(251,191,36,0.4), 0 0 40px rgba(251,191,36,0.2)',
        'inset-classical': 'inset 0 2px 8px rgba(0,0,0,0.5)',
      },
      borderColor: {
        classical: 'rgba(212,168,67,0.35)',
      },
      animation: {
        'float':       'float 3s ease-in-out infinite',
        'glow-pulse':  'glowPulse 2s ease-in-out infinite alternate',
        'slide-up':    'slideUp 0.35s ease-out',
        'fade-in':     'fadeIn 0.25s ease-out',
        'bounce-in':   'bounceIn 0.45s cubic-bezier(0.36,0.07,0.19,0.97)',
        'spin-slow':   'spin 8s linear infinite',
        'shimmer':     'shimmer 2.5s linear infinite',
        'dice-roll':   'diceRoll 0.6s ease-in-out',
      },
      keyframes: {
        float:      { '0%,100%':{ transform:'translateY(0)' }, '50%':{ transform:'translateY(-8px)' } },
        glowPulse:  { from:{ boxShadow:'0 0 8px #fbbf24, 0 0 16px #fbbf24' }, to:{ boxShadow:'0 0 20px #fbbf24, 0 0 40px #f59e0b, 0 0 60px #d97706' } },
        slideUp:    { from:{ transform:'translateY(16px)', opacity:'0' }, to:{ transform:'translateY(0)', opacity:'1' } },
        fadeIn:     { from:{ opacity:'0' }, to:{ opacity:'1' } },
        bounceIn:   { '0%':{ transform:'scale(0.3)', opacity:'0' }, '50%':{ transform:'scale(1.05)' }, '70%':{ transform:'scale(0.9)' }, '100%':{ transform:'scale(1)', opacity:'1' } },
        shimmer:    { '0%':{ backgroundPosition:'-200% 0' }, '100%':{ backgroundPosition:'200% 0' } },
        diceRoll:   { '0%':{ transform:'rotateX(0) rotateY(0)' }, '33%':{ transform:'rotateX(180deg) rotateY(90deg)' }, '66%':{ transform:'rotateX(90deg) rotateY(270deg)' }, '100%':{ transform:'rotateX(0) rotateY(0)' } },
      },
    },
  },
  plugins: [],
}
