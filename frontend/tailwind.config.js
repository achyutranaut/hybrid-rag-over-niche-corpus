/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: '#070709',
        surface: {
          DEFAULT: '#0D0D11',
          1: '#0D0D11',
          2: '#14141A',
          3: '#1C1C24',
          4: '#242430',
        },
        border: {
          DEFAULT: '#22222C',
          subtle: '#181820',
          strong: '#363644',
          accent: 'rgba(139, 126, 248, 0.35)',
        },
        ink: {
          primary: '#F4F4F6',
          muted: '#8E8E98',
          faint: '#52525C',
        },
        paper: {
          bg: '#F3F0E8',
          ink: '#1A1915',
          muted: '#636159',
          border: '#E2DDD0',
        },
        attack: {
          DEFAULT: '#8B7EF8',
          surface: 'rgba(139, 126, 248, 0.08)',
          border: 'rgba(139, 126, 248, 0.28)',
          ink: '#C2BBFB',
          glow: 'rgba(139, 126, 248, 0.15)',
        },
        cve: {
          warn: '#F59E0B',
          crit: '#EF4444',
          low: '#38BDF8',
          surface: 'rgba(245, 158, 11, 0.08)',
          border: 'rgba(245, 158, 11, 0.28)',
          ink: '#FDE68A',
        },
        valid: {
          DEFAULT: '#10B981',
          surface: 'rgba(16, 185, 129, 0.08)',
          border: 'rgba(16, 185, 129, 0.28)',
          ink: '#6EE7B7',
        },
        cyber: {
          bg: '#070709',
          card: '#0D0D11',
          border: '#22222C',
          accent: '#8B7EF8',
          success: '#10B981',
          warning: '#F59E0B',
          danger: '#EF4444',
          muted: '#8E8E98',
        }
      },
      fontFamily: {
        serif: ['Newsreader', 'Georgia', 'Cambria', 'Times New Roman', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'glow-sm': '0 0 14px rgba(139, 126, 248, 0.12)',
        'glow-accent': '0 0 24px rgba(139, 126, 248, 0.2)',
        'glow-valid': '0 0 20px rgba(16, 185, 129, 0.2)',
        'glow-warn': '0 0 20px rgba(245, 158, 11, 0.2)',
        'card-elevated': '0 4px 20px rgba(0, 0, 0, 0.45)',
      }
    },
  },
  plugins: [],
}
