/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Surface elevation (darkest → lightest)
        void: '#020617',
        base: '#060b14',
        elevated: '#0d1520',
        overlay: '#152030',
        field: '#0a1018',

        // Text hierarchy
        ink: '#e2e8f0',
        'ink-secondary': '#94a3b8',
        'ink-muted': '#64748b',
        'ink-ghost': '#334155',

        // Border progression
        'border-subtle': 'rgba(255,255,255,0.04)',
        'border-default': 'rgba(255,255,255,0.06)',
        'border-emphasis': 'rgba(255,255,255,0.10)',

        // Primary accent — cyan (main actions)
        accent: {
          DEFAULT: '#06b6d4',
          light: '#22d3ee',
          dark: '#0891b2',
          glow: 'rgba(6,182,212,0.3)',
        },

        // Semantic
        success: '#22c55e',
        warning: '#eab308',
        danger: '#ef4444',
        info: '#3b82f6',

        // 7 AI Provider wavelength colors
        'provider-claude': '#f59e0b',
        'provider-gpt': '#10b981',
        'provider-gemini': '#4285f4',
        'provider-minimax': '#ec4899',
        'provider-moonshot': '#94a3b8',
        'provider-glm': '#06b6d4',
        'provider-deepseek': '#6366f1',
      },

      fontFamily: {
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
        body: ['JetBrains Mono', 'Noto Sans SC', 'monospace'],
        ui: ['system-ui', '-apple-system', 'Noto Sans SC', 'sans-serif'],
      },

      fontSize: {
        hero: ['1.5rem', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '700' }],
        h1: ['1.125rem', { lineHeight: '1.4', fontWeight: '600' }],
        h2: ['1rem', { lineHeight: '1.4', fontWeight: '600' }],
        body: ['0.875rem', { lineHeight: '1.6' }],
        caption: ['0.75rem', { lineHeight: '1.5' }],
        mono: ['0.8125rem', { lineHeight: '1.6' }],
      },

      spacing: {
        xs: '0.25rem',  // 4px
        sm: '0.5rem',   // 8px
        md: '0.75rem',  // 12px
        lg: '1rem',     // 16px
        xl: '1.5rem',   // 24px
        '2xl': '2rem',  // 32px
        '3xl': '3rem',  // 48px
      },

      borderRadius: {
        sm: '4px',
        md: '6px',
        lg: '8px',
      },

      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'slide-up': 'slide-up 0.2s ease-out',
        'fade-in': 'fade-in 0.15s ease-out',
        'waveform': 'waveform 1.2s ease-in-out infinite',
        'scanline': 'scanline 8s linear infinite',
      },

      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 4px rgba(6,182,212,0.3)' },
          '50%': { boxShadow: '0 0 12px rgba(6,182,212,0.5)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        waveform: {
          '0%, 100%': { height: '4px' },
          '50%': { height: '16px' },
        },
        scanline: {
          from: { transform: 'translateY(-100%)' },
          to: { transform: 'translateY(100vh)' },
        },
      },
    },
  },
  plugins: [],
};
