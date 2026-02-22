/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './public/index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0C0B09',
        'bg-surface': '#131210',
        'bg-elevated': '#1C1A17',
        amber: '#E8B84B',
        'amber-dim': 'rgba(232,184,75,0.10)',
        'amber-border': 'rgba(232,184,75,0.25)',
        'amber-glow': 'rgba(232,184,75,0.06)',
        'flag-high': '#D94F4F',
        'flag-high-dim': 'rgba(217,79,79,0.10)',
        'flag-high-border': 'rgba(217,79,79,0.28)',
        'flag-medium': '#D4833A',
        'flag-medium-dim': 'rgba(212,131,58,0.10)',
        'flag-medium-border': 'rgba(212,131,58,0.28)',
        'flag-low': '#C4A832',
        'flag-low-dim': 'rgba(196,168,50,0.08)',
        'flag-low-border': 'rgba(196,168,50,0.25)',
        'text-primary': '#F0EDE6',
        'text-secondary': '#8C897F',
        'text-muted': '#4C4940',
        'text-code': '#C8C2B8',
        'border-subtle': 'rgba(255,255,255,0.05)',
        'border-default': 'rgba(255,255,255,0.10)',
        'border-strong': 'rgba(255,255,255,0.20)',
        'status-pending': '#8C897F',
        'status-response': '#6B8FC4',
        'status-resolved': '#5A9E6F',
        'status-denied': '#D94F4F',
      },
      fontFamily: {
        display: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        sharp: '2px',
      },
      animation: {
        'fade-up': 'fadeUp 0.5s ease-out forwards',
        scanline: 'scanline 3s linear infinite',
        'pulse-dot': 'pulseDot 2s ease-in-out infinite',
        'draw-check': 'drawCheck 0.6s ease-out 0.2s both',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(18px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '0.4', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.15)' },
        },
        drawCheck: {
          from: { strokeDashoffset: '100' },
          to: { strokeDashoffset: '0' },
        },
      },
    },
  },
  plugins: [],
}
