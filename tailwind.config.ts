import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        berry: {
          DEFAULT: '#D6336C',
          50: '#fff0f5',
          100: '#ffe3ec',
          200: '#ffc9da',
          300: '#ff9ebb',
          400: '#f05f8d',
          500: '#D6336C',
          600: '#C2255C',
          700: '#A61E4D',
          800: '#86143D',
          900: '#6B0F31',
        },
        leaf: {
          DEFAULT: '#0FA886',
          light: '#52D6C3',
        },
        surface: {
          base: '#F5F3EF',
          overlay: '#EBE7DF',
          dark: '#111115',
          elevated: '#17171D',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Manrope', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        brand: '0 18px 60px rgba(214, 51, 108, 0.22)',
        soft: '0 18px 60px rgba(40, 34, 31, 0.12)',
      },
    },
  },
  plugins: [],
}

export default config
