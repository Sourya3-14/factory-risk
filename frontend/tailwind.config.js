/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#070a13',
          secondary: '#0d1322',
          card: 'rgba(18, 26, 43, 0.75)',
          'card-hover': 'rgba(26, 38, 64, 0.9)',
          glass: 'rgba(14, 21, 37, 0.65)',
        },
        border: {
          glass: 'rgba(255, 255, 255, 0.08)',
          active: 'rgba(6, 182, 212, 0.5)',
        },
        accent: {
          cyan: '#06b6d4',
          'cyan-glow': 'rgba(6, 182, 212, 0.25)',
          emerald: '#10b981',
          'emerald-glow': 'rgba(16, 185, 129, 0.25)',
          amber: '#f59e0b',
          'amber-glow': 'rgba(245, 158, 11, 0.25)',
          rose: '#f43f5e',
          'rose-glow': 'rgba(244, 63, 94, 0.25)',
          rupee: '#fbbf24',
        },
        yw: {
          main: '#f1f5f9',
          muted: '#94a3b8',
          dim: '#64748b',
        },
      },
      fontFamily: {
        display: ['Outfit', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        card: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        glow: '0 0 20px rgba(6, 182, 212, 0.2)',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.6', transform: 'scale(1.15)' },
        },
      },
      animation: {
        'pulse-glow': 'pulse-glow 1.5s infinite',
      },
    },
  },
  plugins: [],
};
