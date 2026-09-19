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
        canvas: '#0A0A0B',
        surface: {
          DEFAULT: '#111113',
          1: '#111113',
          2: '#18181B',
          3: '#202024',
        },
        border: {
          DEFAULT: '#232326',
          subtle: '#1C1C1F',
          strong: '#323238',
        },
        ink: {
          primary: '#F5F3EE',
          muted: '#9A9A9F',
          faint: '#5E5E64',
        },
        paper: {
          bg: '#F3F0E8',
          ink: '#1A1915',
          muted: '#636159',
          border: '#E2DDD0',
        },
        attack: {
          DEFAULT: '#8B7EF8',
          surface: 'rgba(139, 126, 248, 0.09)',
          border: 'rgba(139, 126, 248, 0.28)',
          ink: '#C2BBFB',
        },
        cve: {
          warn: '#F59E0B',
          crit: '#EF4444',
          low: '#38BDF8',
        },
        valid: {
          DEFAULT: '#10B981',
          surface: 'rgba(16, 185, 129, 0.09)',
          border: 'rgba(16, 185, 129, 0.25)',
          ink: '#6EE7B7',
        },
        cyber: {
          bg: '#0A0A0B',
          card: '#111113',
          border: '#232326',
          accent: '#8B7EF8',
          success: '#10B981',
          warning: '#F59E0B',
          danger: '#EF4444',
          muted: '#9A9A9F',
        }
      },
      fontFamily: {
        serif: ['Newsreader', 'Georgia', 'Cambria', 'Times New Roman', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      }
    },
  },
  plugins: [],
}
