import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Montserrat', 'Inter', 'Noto Sans Gujarati', 'Noto Sans Devanagari', 'system-ui', 'sans-serif'],
        native: ['Noto Sans Gujarati', 'Noto Sans Devanagari', 'Noto Sans', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#386AF6', dark: '#2755E3', light: '#EEF2FF', 50: '#F4F6FA',
        },
        surface: { DEFAULT: '#FFFFFF', secondary: '#F5F7FA', chat: '#F0F4FF', page: '#F4F6FA' },
        txt:     { primary: '#1A1F36', secondary: '#7383A5', tertiary: '#B8C0CC' },
        bdr:     { DEFAULT: '#CFD8E6', light: '#E2E8F0', strong: '#B5C2D5' },
        ok:      { DEFAULT: '#4CAF50', light: '#E8F5E9' },
        warn:    { DEFAULT: '#FFB300', light: '#FFF8E1' },
        danger:  { DEFAULT: '#E53935', light: '#FFEBEE' },
        flag:    { DEFAULT: '#7C3AED', light: '#EDE9FE' },
      },
      borderRadius: { pill: '50px', card: '16px', xl: '12px' },
      boxShadow: {
        card:   '0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)',
        modal:  '0 4px 14px rgba(56, 106, 246, 0.18)',
        bottom: '0 -4px 24px rgba(56, 106, 246, 0.10)',
        canvas: '-8px 0 30px rgba(15, 23, 42, 0.10)',
      },
      keyframes: {
        'slide-in':    { '0%': { transform: 'translateY(8px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        'fade-in':     { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'bubble-in':   { '0%': { transform: 'translateY(4px) scale(0.98)', opacity: '0' }, '100%': { transform: 'translateY(0) scale(1)', opacity: '1' } },
        'canvas-slide':{ '0%': { transform: 'translateX(100%)' }, '100%': { transform: 'translateX(0)' } },
        'typing':      { '0%, 60%, 100%': { opacity: '0.3' }, '30%': { opacity: '1' } },
        'pulse-ring':  { '0%': { transform: 'scale(0.95)', opacity: '0.7' }, '100%': { transform: 'scale(1.6)', opacity: '0' } },
      },
      animation: {
        'slide-in':     'slide-in 240ms ease-out',
        'fade-in':      'fade-in 200ms ease-out',
        'bubble-in':    'bubble-in 200ms ease-out',
        'canvas-slide': 'canvas-slide 300ms ease-out',
        'typing':       'typing 1.2s infinite',
        'pulse-ring':   'pulse-ring 1.6s ease-out infinite',
      },
      zIndex: {
        60: '60',
      },
    },
  },
  plugins: [],
}

export default config
